// 0.1.31: one extraction returns up to three moments of the target message; each candidate has its own scene
// fields and keeps its own edits; the picker shows only when there is more than one moment.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pick,reveal} from './menu-helper.mjs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const profiles=[{id:'mira',name:'Mira',aliases:[],cardKey:'',subject:'girl',appearance:'mira fixed',defaultOutfit:'grey coat',positive:'',negative:''},
 {id:'leo',name:'Leo',aliases:[],cardKey:'',subject:'boy',appearance:'leo fixed',defaultOutfit:'hoodie',positive:'',negative:''}];
const person=(id,name,action,extra={})=>({id,name,expression:'smile',action,position:'auto',outfitMode:'unchanged',outfit:'',...extra});
const moment=(title,people,location,unregistered=[])=>({title,characters:people,unregistered,interaction:'',location,lighting:'',camera:''});
const three={moments:[
 moment('식탁에서 식사하는 순간',[person('mira','Mira','sitting, eating'),person('leo','Leo','sitting, eating'),person('','Street vendor','standing')],'dining room',['Street vendor']),
 moment('자리에서 일어나는 순간',[person('mira','Mira','standing up')],'dining room'),
 moment('문을 열고 나가는 순간',[person('mira','Mira','opening door')],'hallway')],defaultIndex:2,requestMatched:true};
try{
 for(const width of [1280,375]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],sent=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  let history=[];
  await page.route('**/api/plugins/naice-shot/**',async route=>{const url=new URL(route.request().url());
   if(url.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);const item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};history=[item];return route.fulfill({json:item});}
   return route.fulfill({json:{items:history,total:history.length,hasMore:false}});});
  await page.addInitScript(cfg=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.profiles=cfg.profiles;mock.extraction=cfg.three;mock.extensionSettings.naice_shot.allowAnlas=true;}),{profiles,three});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  const extract=async()=>{const before=await page.evaluate(()=>mock.extractCalls??0);await page.locator('[data-action="extract"]').click();await page.waitForFunction(n=>(mock.extractCalls??0)>n&&document.querySelector('#ncs-progress').hidden,before);};
  const action=id=>page.locator(`[data-character="${id}"] [data-field="action"]`);
  const pressed=()=>page.locator('.ncs-moment[aria-pressed="true"]').getAttribute('data-moment');
  await extract();
  // Three candidates, the final instant chosen by default; its own fields only.
  assert.equal(await page.locator('.ncs-moment').count(),3);assert.equal(await pressed(),'2');
  assert.match(await page.locator('.ncs-moment').nth(2).innerText(),/문을 열고 나가는 순간[\s\S]*마지막 순간/);
  assert.equal(await page.locator('[data-character]').count(),1);assert.equal(await action('mira').inputValue(),'opening door');
  assert.equal(await page.locator('#ncs-location').inputValue(),'hallway');assert.equal(await page.locator('#ncs-left-out').isHidden(),true);
  assert.match(await page.locator('#ncs-notice').innerText(),/장면 후보 3개/);
  assert.equal(await page.evaluate(()=>mock.extractCalls),1);
  // Switching needs no AI call and replaces every scene field, people and missing-profile hints included.
  await page.locator('.ncs-moment[data-moment="0"]').click();
  assert.equal(await pressed(),'0');assert.equal(await page.locator('[data-character]').count(),2);
  assert.equal(await action('mira').inputValue(),'sitting, eating');assert.equal(await page.locator('#ncs-location').inputValue(),'dining room');
  assert.match(await page.locator('#ncs-left-out').innerText(),/Street vendor/);
  assert.match(await page.locator('#ncs-warnings').innerText(),/앞쪽 순간을 골랐어요/);
  assert.equal(await page.evaluate(()=>mock.extractCalls),1,'no extra AI call');
  // Edits stay with their own candidate.
  await action('mira').fill('sitting, eating, holding chopsticks');
  await page.locator('.ncs-moment[data-moment="2"]').click();assert.equal(await action('mira').inputValue(),'opening door');
  assert.doesNotMatch(await page.locator('#ncs-warnings').innerText(),/앞쪽 순간을 골랐어요/);
  await page.locator('.ncs-moment[data-moment="0"]').click();assert.equal(await action('mira').inputValue(),'sitting, eating, holding chopsticks');
  // A direct final-prompt edit is not dropped silently: cancelling keeps the candidate.
  await page.locator('#ncs-final-box > summary').click();await page.locator('[data-final="base"]').fill('custom base');
  page.once('dialog',d=>d.dismiss());await page.locator('.ncs-moment[data-moment="1"]').click();assert.equal(await pressed(),'0');
  page.once('dialog',d=>d.accept());await page.locator('.ncs-moment[data-moment="1"]').click();assert.equal(await pressed(),'1');
  await page.locator('#ncs-final-box > summary').click();
  // Generate: the snapshot carries every candidate and the choice, with edits.
  await page.locator('.ncs-moment[data-moment="0"]').click();
  await page.locator('[data-action="generate"]').click();
  if(await page.locator('#ncs-missing-dialog[open]').count())await page.locator('[data-action="missing-proceed"]').click();
  await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&document.querySelector('#ncs-result img'));
  const snap=sent.at(-1).snapshot.scene;assert.equal(snap.moments.length,3);assert.equal(snap.momentIndex,0);
  assert.equal(snap.moments[0].scene.characters.find(c=>c.id==='mira').action,'sitting, eating, holding chopsticks');
  assert.match(sent.at(-1).assembled.characters.find(c=>c.name==='Mira').prompt,/holding chopsticks/);
  assert.doesNotMatch(JSON.stringify(sent.at(-1).assembled),/opening door|standing up/,'other moments never reach the image prompt');
  // History restore brings the candidates back, still switchable without AI.
  await page.locator('.ncs-clear-slot [data-action="blank"]').click();assert.equal(await page.locator('#ncs-moments').isHidden(),true);
  await page.locator('[data-tab="history"]').click();await pick(page,'[data-history-id]');
  assert.equal(await page.locator('.ncs-moment').count(),3);assert.equal(await pressed(),'0');
  await page.locator('.ncs-moment[data-moment="2"]').click();assert.equal(await action('mira').inputValue(),'opening door');
  // Wished moment: sent as data, kept for regeneration, cleared when the target message changes; not-found notice.
  await page.locator('#ncs-moment-wish').fill('식탁에서 밥 먹는 순간');
  await page.evaluate(d=>{mock.extraction={...d,requestMatched:false};},three);await extract();
  assert.match(await page.evaluate(()=>mock.lastExtract.prompt),/USER REQUEST for this picture \(data\): "식탁에서 밥 먹는 순간"/);
  assert.match(await page.locator('#ncs-notice').innerText(),/찾지 못해서 마지막 순간으로 골랐어요/);assert.equal(await pressed(),'2');
  assert.equal(await page.locator('#ncs-moment-wish').inputValue(),'식탁에서 밥 먹는 순간');
  await page.evaluate(()=>{document.querySelector('#ncs-target-picker').open=true;});await page.locator('#ncs-target-list [data-message-index]').first().click();
  assert.equal(await page.locator('#ncs-moment-wish').inputValue(),'');
  // A single scene shows no picker.
  await page.evaluate(()=>{mock.extraction={characters:[{id:'mira',name:'Mira',expression:'',action:'reading',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],interaction:'',location:'library',lighting:'',camera:''};});
  await extract();assert.equal(await page.locator('#ncs-moments').isHidden(),true);assert.equal(await action('mira').inputValue(),'reading');
  assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: up to three moments per message, final moment by default, per-candidate fields and people, edits kept per candidate, no extra AI call on switch, final-edit confirm, history keeps candidates, wished moment as data and reset on target change, single scene hides picker, 375px fit');
}finally{await browser.close();server.close();}
