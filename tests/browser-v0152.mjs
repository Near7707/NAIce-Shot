// v0.1.52 (GPT review of 0.1.50): a successful outfit save keeps a final prompt edited while it waited
// (UI-050-03); making or linking a profile from the card-character box turns a same-name temporary person into it
// instead of adding a second one (UI-050-04); same-name profiles also get the box (UI-050-05).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/naice-shot/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep))throw Error();
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const features=['paged-history','delete','private-records','all-history','history-kinds','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes'];
async function open(width,{cardName,profiles}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
 if(profiles)await page.addInitScript(list=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.profiles.push(...list);}),profiles);
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 return {page,errors};
}
const names=page=>page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.map(c=>c.name));
try{
 {// UI-050-03
  const {page,errors}=await open(375);const card=page.locator('[data-character="leo"]');
  await page.evaluate(()=>{mock.normalSave=mock.saveMetadata;mock.saveMetadata=()=>new Promise(r=>mock.finishMetadata=r);});
  await card.locator('[data-save-outfit]').click();await card.locator('.ncs-outfit-saving').waitFor();
  await page.locator('#ncs-final-box > summary').click();const base=page.locator('[data-final="base"]');
  await base.fill('my own base words');await page.locator('#ncs-final-badge').waitFor();
  await page.evaluate(()=>mock.finishMetadata());await page.waitForFunction(()=>!document.querySelector('.ncs-outfit-saving'));
  assert.equal(await base.inputValue(),'my own base words','final prompt edited while saving is kept');
  assert.equal(await page.locator('#ncs-final-badge').isVisible(),true);
  assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.outfits.leo.value),'white shirt, jeans','the outfit was saved');
  // A save without later edits still rebuilds the prompt from the new clothes.
  await page.evaluate(()=>{mock.saveMetadata=mock.normalSave;});
  assert.deepEqual(errors,[]);await page.close();
 }
 for(const how of ['direct','link']){// UI-050-04
  const {page,errors}=await open(375,{cardName:'Robin',profiles:how==='link'?[{id:'kai',name:'Kai',aliases:[],subject:'boy',appearance:'short hair',defaultOutfit:'',positive:'',negative:'',cardKey:''}]:undefined});
  await page.locator('[data-action="add-temp"]').click();await page.locator('[data-temp="name"]').last().fill('Robin');
  await page.locator('[data-temp="appearance"]').last().fill('long red hair');
  assert.deepEqual(await names(page),['Leo','Robin']);
  const box=page.locator('#ncs-missing-main .ncs-missing-main');await box.waitFor();
  if(how==='direct'){
   await box.locator('[data-missing-do="direct"]').click();await page.locator('#ncs-profile-name').waitFor();
   await page.locator('#ncs-profile-appearance').fill('long red hair, freckles');await page.locator('#ncs-profile-submit').click();
  }else{
   await box.locator('[data-missing-do="link"]').click();await page.locator('#ncs-link-profile').selectOption('kai');await page.locator('[data-missing-do="link-confirm"]').click();
  }
  await page.waitForFunction(()=>!document.querySelector('#ncs-missing-main .ncs-missing-main'));
  const after=await names(page);assert.equal(after.length,2,`${how}: still two people, got ${after}`);
  assert.equal(await page.locator('[data-character] [data-temp="name"]').count(),0,`${how}: the temporary card became the profile`);
  if(how==='link'){await page.locator('[data-missing-do="link-undo"]').click();assert.deepEqual(await names(page),['Leo','Robin'],'undo brings the temporary person back');}
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-050-05
  const twin=n=>({id:`robin-${n}`,name:'Robin',aliases:[],subject:'girl',appearance:`look ${n}`,defaultOutfit:'',positive:'',negative:'',cardKey:''});
  const {page,errors}=await open(375,{cardName:'Robin',profiles:[twin(1),twin(2)]});
  const box=page.locator('#ncs-missing-main .ncs-missing-main');await box.waitFor();
  assert.match(await box.innerText(),/이름이 같은 프로필이 여러 개라 연결하지 못했어요[\s\S]*기존 프로필 연결하기/);
  await box.locator('[data-missing-do="link"]').click();await page.locator('#ncs-link-profile').selectOption('robin-2');await page.locator('[data-missing-do="link-confirm"]').click();
  await page.waitForFunction(()=>!document.querySelector('#ncs-missing-main .ncs-missing-main'));
  assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.bindings.characterProfileId),'robin-2');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: final prompt kept across an outfit save, same-name temporary person converted (make and link, with undo), same-name profiles get the link box');
}finally{await browser.close();server.close();}
