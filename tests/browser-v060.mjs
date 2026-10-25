// v0.6.0: profile from a description (AI draft + cancel), quick profile inside the scene tab,
// unregistered-person chips, identical layout across skins, and no sideways panning on mobile.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(req.method==='HEAD'?undefined:bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let answer=true;const dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());answer?d.accept():d.dismiss();});
await page.route('**/api/plugins/naice-shot/**',route=>route.fulfill({json:{items:[],total:0,hasMore:false}}));
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
try{
 // Start with no profiles; the AI answers profile prompts with a draft and scene prompts with a scene.
 await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{
  const m=window.mock;m.extensionSettings.naice_shot.profiles=[];
  m.draft={name:'Theo',aliases:['테오'],subject:'boy',appearance:'brown hair, short hair, green eyes, slim',defaultOutfit:'beige trench coat, grey sweater, jeans',positive:'',negative:'black hair'};
  m.generateRaw=async function(options){this.prompts=[...(this.prompts??[]),options];
   if(options.prompt.startsWith('Convert ONE character description')){if(this.draftDeferred)return await this.draftDeferred;return JSON.stringify(this.draft);}
   return JSON.stringify(this.extraction);};
  m.stopEvents=[];m.eventSource.emit=async type=>{m.stopEvents.push(type);};m.eventTypes.GENERATION_STOPPED='generation_stopped';
 });});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();

 // 1) Empty state in the scene tab, and 장면 추출 opens the quick profile instead of failing.
 assert.equal(await page.locator('#ncs-no-profiles').isVisible(),true);assert.equal(await page.locator('#ncs-add-row').isHidden(),true);
 await click('extract');
 await page.locator('#ncs-scene-profile-slot #ncs-profile-form').waitFor();
 assert.match(await page.locator('#ncs-notice').textContent(),/첫 프로필을 만들면/);
 assert.equal(await page.locator('#ncs-no-profiles').isHidden(),true);
 assert.equal(await page.locator('#ncs-profile-submit').textContent(),'저장하고 장면에 추가');
 assert.equal(await page.locator('#ncs-scene-profile-slot [data-action="delete-profile"]').isHidden(),true);
 assert.equal(await page.evaluate(()=>mock.prompts?.length??0),0,'no extraction request without profiles');

 // 2) Describe mode is the default; cancel a slow conversion, then convert for real.
 assert.equal(await page.locator('[data-profile-mode="describe"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#ncs-describe-box').isVisible(),true);
 await page.locator('#ncs-profile-describe').fill('갈색 곱슬머리에 초록 눈, 키 큰 30대 남자. 베이지 트렌치코트에 회색 니트.');
 await page.evaluate(()=>{mock.draftDeferred=new Promise(()=>{});});
 await click('convert-profile');
 await page.locator('#ncs-progress').waitFor({state:'visible'});
 assert.match(await page.locator('#ncs-progress-title').textContent(),/프로필 태그 변환 중/);
 assert.equal(await page.locator('#ncs-progress-cancel').textContent(),'변환 중단');
 await page.locator('#ncs-progress-cancel').click();await page.locator('#ncs-progress').waitFor({state:'hidden'});
 assert.match(await page.locator('#ncs-notice').textContent(),/변환을 중단/);assert.deepEqual(await page.evaluate(()=>mock.stopEvents),['generation_stopped']);
 assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'','cancel leaves fields untouched');
 await page.evaluate(()=>{mock.draftDeferred=null;});
 await click('convert-profile');
 await page.waitForFunction(()=>document.querySelector('#ncs-profile-appearance').value.includes('brown hair'));
 const last=await page.evaluate(()=>mock.prompts.at(-1));
 assert.match(last.systemPrompt,/convert character descriptions/);assert.equal(last.jsonSchema.name,'naice_shot_profile');
 assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Theo');assert.equal(await page.locator('#ncs-profile-aliases').inputValue(),'테오');
 assert.equal(await page.locator('#ncs-profile-subject').inputValue(),'boy');assert.equal(await page.locator('#ncs-profile-outfit').inputValue(),'beige trench coat, grey sweater, jeans');
 assert.equal(await page.locator('#ncs-profile-negative').inputValue(),'black hair');
 // Converting again over filled fields asks first; declining keeps the user's edit.
 await page.locator('#ncs-profile-appearance').fill('brown hair, my edit');answer=false;await click('convert-profile');
 await page.waitForFunction(()=>/적용하지 않았어요/.test(document.querySelector('#ncs-notice').textContent));
 assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'brown hair, my edit');assert.match(dialogs.at(-1),/변환 결과로 바꿀까요/);answer=true;

 // 3) Save from the scene tab: the profile is stored and placed into the scene.
 await page.locator('#ncs-profile-submit').click();
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.length===1);
 await page.locator('[data-character]').first().waitFor();
 assert.equal(await page.locator('#ncs-scene-profile-slot').isHidden(),true);assert.equal(await page.locator('#ncs-profile-slot #ncs-profile-form').count(),1,'form back in the profile tab');
 assert.match(await page.locator('#ncs-notice').textContent(),/Theo 프로필을 저장하고 장면에 넣었어요/);
 assert.match(await page.locator('#ncs-final').inputValue(),/brown hair, my edit/);
 assert.equal(await page.locator('#ncs-add-row').isVisible(),true);

 // 4) Direct mode hides the description box and is remembered.
 await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile-mode="direct"]').click();
 assert.equal(await page.locator('#ncs-describe-box').isHidden(),true);assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.profileInputMode),'direct');
 await page.locator('[data-profile-mode="describe"]').click();

 // 5) An unregistered visible person gets a chip that opens the quick profile with the name filled in.
 await page.locator('[data-tab="scene"]').click();
 await page.evaluate(()=>{mock.chat[1].mes='Theo sits by the window. Mina waves from the door.';mock.extraction={characters:[{id:'x',name:'Theo',expression:'smile',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:['Mina'],location:'cafe',lighting:'',camera:'',interaction:''};});
 await click('extract');await page.locator('[data-quick-profile-name="Mina"]').waitFor();
 await page.locator('[data-quick-profile-name="Mina"]').click();
 assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Mina');assert.equal(await page.locator('#ncs-scene-profile-slot').isVisible(),true);
 await page.locator('[data-profile-mode="direct"]').click();await page.locator('#ncs-profile-appearance').fill('black hair, ponytail');await page.locator('#ncs-profile-subject').selectOption('girl');
 await page.locator('#ncs-profile-submit').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-character]').length===2);
 assert.equal(await page.locator('[data-quick-profile-name="Mina"]').count(),0,'chip disappears once the profile exists');
 // Moving to the profile tab mid-way keeps what was typed.
 await page.locator('#ncs-add-row [data-action="quick-profile"]').click();await page.locator('#ncs-profile-name').fill('Draft person');
 await page.locator('[data-tab="profiles"]').click();assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Draft person');
 assert.equal(await page.locator('#ncs-profile-slot #ncs-profile-form').count(),1);

 // 6) Every skin keeps the header icon, title, tabs and fonts in the same place.
 const geometry=()=>page.evaluate(()=>{const r=el=>{const b=el.getBoundingClientRect();return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)];};
  const d=document.querySelector('#naice-shot-dialog');
  return {icon:r(d.querySelector('.ncs-brand .ncs-icon')),title:r(d.querySelector('.ncs-header strong')),tabs:[...d.querySelectorAll('.ncs-tabs [data-tab]')].map(r),
   tabIcons:[...d.querySelectorAll('.ncs-tab-icon')].map(r),fonts:[d.querySelector('.ncs-header strong'),d.querySelector('h3'),d.querySelector('.ncs-tabs button')].map(e=>getComputedStyle(e).fontFamily+'|'+getComputedStyle(e).fontSize),
   firstHeading:r(d.querySelector('[data-page="settings"] h3'))};});
 for(const width of [1280,375]){
  await page.setViewportSize({width,height:860});await page.locator('[data-tab="settings"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#ncs-skins .ncs-skin').length===8);
  let base=null;
  for(const skin of ['classic','glass','minimal','pastel','cream','matcha','deepblue','lavender']){
   await page.locator(`#ncs-skins input[value="${skin}"]`).check({force:true});
   await page.waitForFunction(s=>document.querySelector('#naice-shot-dialog').dataset.skin===s,skin);await page.locator('.ncs-content').evaluate(el=>el.scrollTop=0);
   const g=await geometry();
   if(!base)base=g;else for(const key of Object.keys(base))assert.deepEqual(g[key],base[key],`${skin} ${key} at ${width}px`);
  }
 }

 // 7) No sideways panning even when something inside is too wide.
 await page.locator('[data-tab="settings"]').click();
 const pan=await page.evaluate(async()=>{const c=document.querySelector('.ncs-content');const wide=document.createElement('div');wide.style.width='900px';wide.style.height='10px';c.querySelector('[data-page="settings"]').append(wide);
  const style=getComputedStyle(c).overflowX;wide.remove();return style;});
 assert.equal(pan,'hidden');
 await page.locator('.ncs-content').evaluate(c=>{const wide=document.createElement('div');wide.id='too-wide';wide.style.width='900px';wide.style.height='10px';c.querySelector('[data-page="settings"]').prepend(wide);});
 const box=await page.locator('.ncs-content').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+100);await page.mouse.wheel(400,0);await page.waitForTimeout(200);
 assert.equal(await page.locator('.ncs-content').evaluate(c=>c.scrollLeft),0,'horizontal wheel does not pan');
 await page.locator('#too-wide').evaluate(el=>el.remove());
 assert.deepEqual(errors,[]);
 console.log('PASS: empty-state quick profile, describe→tags with cancel and overwrite guard, save into scene, mode memory, unregistered chips, same layout on every skin (1280/375), no sideways panning');
}finally{await browser.close();server.close();}
