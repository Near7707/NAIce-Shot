// 0.1.17: people left out of the image. The chat's own character / group members / user get a strong
// warning with 직접 만들기, 캐릭터 카드·페르소나에서 만들기 and 기존 프로필 연결하기; side characters stay a soft hint;
// a line above 이미지 생성 lists everyone left out; generating asks first (with "don't ask again").
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
 if(/^\/user\/images\//.test(rel)){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const profile=(id,name,extra={})=>({id,name,aliases:[],subject:'girl',appearance:'short black hair',defaultOutfit:'grey hoodie',positive:'',negative:'',cardKey:'',...extra});
const DRAFT={name:'Leo',aliases:[],subject:'boy',appearance:'silver hair, grey eyes, tall',defaultOutfit:'long navy coat, boots',positive:'',negative:'black hair'};
async function setup({profiles,extraction,card='',persona=''}){
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const sent=[];
 await page.route('**/api/plugins/naice-shot/**',async route=>{const u=new URL(route.request().url());
  if(u.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);
   return route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});}
  route.fulfill({json:{items:[],total:0,hasMore:false}});});
 await page.addInitScript(cfg=>{document.addEventListener('DOMContentLoaded',()=>{const m=window.mock;
  m.extensionSettings.naice_shot.profiles=cfg.profiles;m.extraction=cfg.extraction;m.characters[0].description=cfg.card;m.powerUserSettings={persona_description:cfg.persona};m.drafts=[];
  const base=m.generateRaw;m.generateRaw=async function(options){if(options.prompt.startsWith('Convert ONE character description')){this.drafts.push(options.prompt);return JSON.stringify(cfg.draft);}return base.call(this,options);};});},{profiles,extraction,card,persona,draft:DRAFT});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 await click('extract');await page.waitForFunction(()=>document.querySelector('#ncs-location').value!=='');
 return {page,errors,sent,click};
}
const scene=(characters,unregistered)=>({characters,unregistered,location:'cafe',lighting:'sunlight',camera:'medium shot',interaction:''});
const mira={id:'mira',name:'Mira',expression:'smile',action:'standing',position:'auto',outfitMode:'unchanged',outfit:''};
const leo={id:'leo',name:'Leo',expression:'calm',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:''};
try{
 // A) The open character card has no profile; a side character too.
 let t=await setup({profiles:[profile('mira','Mira')],extraction:scene([mira],['Leo','street vendor']),card:'Tall young man with silver hair and grey eyes. Usually wears a long navy coat and boots. Quiet and kind.'});
 let {page}=t;
 const box=page.locator('#ncs-missing-main .ncs-missing-main');
 assert.equal(await box.count(),1);
 assert.match(await box.innerText(),/대화 중인 캐릭터 "Leo"의 프로필이 없어서 이번 그림에 안 그려져요/);
 assert.match(await box.innerText(),/원문 앞부분\(최대 4,000자\)을 추출 AI로 보내.*최대 2회/);
 assert.equal(await box.locator('[data-missing-do="source"]').innerText(),'캐릭터 카드에서 만들기');
 assert.equal(await box.locator('[data-missing-do="direct"]').innerText(),'직접 만들기');
 assert.equal(await box.locator('[data-missing-do="link"]').innerText(),'기존 프로필 연결하기');
 assert.equal(await page.locator('#ncs-unregistered [data-quick-profile-name]').count(),1,'only the side character stays a chip');
 assert.match(await page.locator('#ncs-unregistered').innerText(),/조연이나 잠깐 나온 인물이면 그냥 두셔도 돼요/);
 assert.equal(await page.locator('#ncs-left-out').innerText(),'이번 그림에서 빠지는 인물: Leo(대화 중인 캐릭터), street vendor');
 assert.doesNotMatch(await page.locator('#ncs-warnings').innerText(),/미등록 인물은/);

 // Generate asks first; 취소 sends nothing.
 await page.locator('#ncs-allow-anlas').check();
 await t.click('generate');await page.locator('#ncs-missing-dialog').waitFor();
 assert.match(await page.locator('#ncs-missing-dialog').innerText(),/Leo · 대화 중인 캐릭터/);
 assert.doesNotMatch(await page.locator('#ncs-missing-dialog').innerText(),/street vendor/,'side characters do not trigger the dialog');
 await t.click('missing-cancel');assert.equal(await page.locator('#ncs-missing-dialog').isHidden(),true);assert.equal(t.sent.length,0);
 // 그래도 그리기 generates without Leo.
 await t.click('generate');await t.click('missing-proceed');await page.locator('#ncs-result img').waitFor();
 assert.equal(t.sent.length,1);assert.deepEqual(t.sent[0].assembled.characters.map(c=>c.name),['Mira']);
 // "Don't ask again" for this chat: the dialog stops, the box and the line stay.
 await t.click('generate');await page.locator('#ncs-missing-skip').check();await t.click('missing-proceed');
 await page.waitForFunction(()=>mock.chatMetadata.naice_shot?.skipMissingWarning===true);
 const before=t.sent.length;await t.click('generate');await page.waitForFunction(n=>document.querySelectorAll('#ncs-result img').length&&true,before);
 await page.waitForTimeout(300);assert.equal(await page.locator('#ncs-missing-dialog').isHidden(),true);assert.equal(t.sent.length,before+1);
 assert.equal(await box.count(),1);assert.equal(await page.locator('#ncs-left-out').isVisible(),true);

 // 캐릭터 카드에서 만들기: card description goes to the tag conversion, fields fill, saving links the card and adds Leo.
 await box.locator('[data-missing-do="source"]').click();
 await page.waitForFunction(()=>document.querySelector('#ncs-profile-appearance').value.includes('silver hair'));
 assert.match(await page.evaluate(()=>mock.drafts.at(-1)),/silver hair and grey eyes/);
 assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Leo');assert.equal(await page.locator('#ncs-profile-outfit').inputValue(),'long navy coat, boots');
 assert.match(await page.locator('#ncs-notice').innerText(),/캐릭터 카드에서 외형·복장을 가져왔어요/);
 await page.locator('#ncs-profile-submit').click();
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.some(p=>p.name==='Leo'));
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Leo').cardKey),'Leo.png','linked to the open card');
 assert.equal(await box.count(),0,'warning gone');
 assert.match(await page.locator('#ncs-left-out').innerText(),/^이번 그림에서 빠지는 인물: street vendor · 이 채팅에서는 생성 전 경고창을 띄우지 않아요\. 경고창 다시 켜기$/);
 assert.equal(await page.locator('[data-character]').count(),2);
 assert.deepEqual(t.errors,[]);await page.close();

 // B) 기존 프로필 연결하기 with the alias option; the chat binding follows.
 t=await setup({profiles:[profile('mira','Mira'),profile('kai','Kai',{subject:'boy'})],extraction:scene([mira],['Leo']),card:''});page=t.page;
 assert.equal(await page.locator('#ncs-missing-main [data-missing-do="source"]').isDisabled(),true,'empty card description');
 assert.match(await page.locator('#ncs-missing-main').innerText(),/캐릭터 카드 설명이 비어 있어서/);
 await page.locator('#ncs-missing-main [data-missing-do="link"]').click();
 await page.locator('#ncs-link-profile').selectOption('kai');assert.equal(await page.locator('#ncs-link-alias').isChecked(),true,'alias option on by default');
 await page.locator('#ncs-missing-main [data-missing-do="link-confirm"]').click();
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='kai').aliases.includes('Leo'));
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.bindings.characterProfileId),'kai');
 assert.equal(await page.locator('#ncs-missing-main .ncs-missing-main').count(),0);assert.equal(await page.locator('[data-character="kai"]').count(),1);
 assert.equal(await page.locator('#ncs-left-out').isHidden(),true);
 // Now generate goes straight through.
 await page.locator('#ncs-allow-anlas').check();await t.click('generate');await page.locator('#ncs-result img').waitFor();
 assert.equal(await page.locator('#ncs-missing-dialog').isHidden(),true);
 assert.deepEqual(t.errors,[]);await page.close();

 // C) The user (persona) has no profile: 페르소나에서 만들기 is offered; 직접 만들기 binds the saved profile to the user.
 t=await setup({profiles:[profile('leo','Leo',{subject:'boy'})],extraction:scene([leo],['Mira']),persona:'Short woman with a red bob haircut and freckles, wears a yellow raincoat.'});page=t.page;
 const ubox=page.locator('#ncs-missing-main .ncs-missing-main');
 assert.match(await ubox.innerText(),/유저 "Mira"의 프로필이 없어서/);assert.equal(await ubox.locator('[data-missing-do="source"]').innerText(),'페르소나에서 만들기');
 await ubox.locator('[data-missing-do="direct"]').click();
 assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Mira');assert.equal(await page.locator('#ncs-describe-box').isHidden(),true,'direct mode');
 await page.locator('#ncs-profile-subject').selectOption('girl');await page.locator('#ncs-profile-appearance').fill('red bob hair, freckles');
 await page.locator('#ncs-profile-submit').click();
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.some(p=>p.name==='Mira'));
 const miraId=await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Mira').id);
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.bindings.userProfileId),miraId);
 assert.equal(await ubox.count(),0);
 // Persona source path on a fresh page.
 await page.close();
 t=await setup({profiles:[profile('leo','Leo',{subject:'boy'})],extraction:scene([leo],['Mira']),persona:'Short woman with a red bob haircut and freckles, wears a yellow raincoat.'});page=t.page;
 await page.locator('#ncs-missing-main [data-missing-do="source"]').click();
 await page.waitForFunction(()=>mock.drafts.length===1);assert.match(await page.evaluate(()=>mock.drafts[0]),/red bob haircut/);
 await page.setViewportSize({width:375,height:760});
 assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.deepEqual(t.errors,[]);await page.close();
 console.log('PASS: strong warning for card/user with three actions and API note, side characters soft, left-out line, generate dialog (cancel/proceed/don\'t ask again), card→profile with card link, link existing with alias + chat binding, empty card disables the source button, persona direct/source with user binding, 375px');
}finally{await browser.close();server.close();}
