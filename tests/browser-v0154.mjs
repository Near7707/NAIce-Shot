// v0.1.54 (GPT review of 0.1.53, UI-053-01): with the drawn message's send time recorded, the same words in
// another message (at the old number, elsewhere or in another swipe) are not taken for the source, and
// 본문에 넣기 (자동) does not attach there.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {textSignature} from '../core.mjs';
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
async function open(width,{cardName,extra=[],chats=['A','B']}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[...extra];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;mock.chat.forEach((m,i)=>m.send_date=`2026-01-01 ${i}`);}));
 // SillyTavern's chat list for a card (checked before switching, so a missing chat is never created).
 await page.route('**/api/characters/chats',r=>r.fulfill({json:Object.fromEntries(chats.map((c,i)=>[i,{file_name:`${c}.jsonl`}]))}));
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 return {page,errors};
}
const slot=page=>page.locator('.ncs-image-popup:popover-open .ncs-jump-slot button');
const openMore=async(page,n=0)=>{await page.locator('.ncs-history-card [data-image-more]:not(.ncs-save-toggle)').nth(n).click();await page.locator('.ncs-image-popup:popover-open').waitFor();};
const historyTab=async page=>{await page.locator('[data-tab="history"]').click();await page.locator('.ncs-history-card').first().waitFor();};
const noticeMatches=(page,re)=>page.waitForFunction(src=>new RegExp(src).test(document.querySelector('#ncs-notice')?.innerText??''),re.source);
const fake=(id,chatKey,index,text,extra={})=>({id,chatKey,created:new Date().toISOString(),image:`/user/images/naice-shot/${id}.png`,seed:1,options:{},assembled:{base:'x',negative:'',characters:[]},snapshot:{scene:{characters:[],source:{target:index,fingerprints:[{index,swipeId:0,signature:textSignature(text),...extra}]}}}});
const here=JSON.stringify({group:null,card:'Leo.png',chat:'A'});
try{
 for(const where of ['same number','elsewhere','other swipe']){
  const {page,errors}=await open(375);
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
  await historyTab(page);
  const drawn=await page.evaluate(()=>mock.chat[1].mes);
  await page.evaluate(([w,t])=>{
   if(w==='same number')mock.chat[1]={name:'Leo',mes:t,send_date:'2099-01-01 later'};
   else if(w==='elsewhere'){mock.chat.splice(1,1);mock.chat.push({name:'Mira',mes:'Something else.',send_date:'x1'},{name:'Leo',mes:t,send_date:'2099-01-01 later'});}
   else{mock.chat.splice(1,1);mock.chat.push({name:'Leo',mes:'Another reply.',send_date:'x2',swipe_id:0,swipes:['Another reply.',t],swipe_info:[{send_date:'x2'},{send_date:'x3'}]});}
   mock.renderChat();},[where,drawn]);
  await openMore(page);
  assert.equal(await slot(page).first().isDisabled(),true,`${where}: not taken for the source`);
  await page.locator('.ncs-image-popup:popover-open [data-history-attach]').click();await page.locator('#ncs-attach-dialog[open]').waitFor();assert.equal(await page.locator('#ncs-attach-dialog [aria-pressed="true"]').count(),0,'no message chosen for it');assert.equal(await page.locator('[data-action="attach-confirm"]').isDisabled(),true);await page.locator('[data-action="attach-cancel"]').click();
  assert.equal(await page.evaluate(()=>mock.chat.some(m=>m.extra?.naice_shot_images?.length)),false,`${where}: nothing attached`);
  assert.deepEqual(errors,[]);await page.close();
 }
 {// The real message, moved and on another swipe, is still found.
  const {page,errors}=await open(375);
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
  await historyTab(page);
  await page.evaluate(()=>{const m=mock.chat[1];const d=m.send_date;m.swipes=[m.mes,'Leo waves.'];m.swipe_info=[{send_date:d},{send_date:'new'}];m.swipe_id=1;m.mes='Leo waves.';m.send_date='new';mock.chat.unshift({name:'Mira',mes:'Earlier note.',send_date:'e'});mock.renderChat();});
  await openMore(page);assert.match(await slot(page).first().innerText(),/#2 · 이 그림을 만든 메시지 · 다른 스와이프에서 만들었어요/);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: same words at the old number, elsewhere or in another swipe are not the source; the real message is found after moving and swiping');
}finally{await browser.close();server.close();}
