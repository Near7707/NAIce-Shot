// v0.1.51 메시지로 가기: one line when the made and attached messages are the same, two when they differ; the
// enlarged viewer offers the same; another chat asks first and opens it; missing or changed messages are said
// plainly; 본문에 넣기 no longer silently falls back to the last message.
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
async function open(width,{cardName,extra=[]}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[...extra];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 return {page,errors};
}
const slot=page=>page.locator('.ncs-image-popup:popover-open .ncs-jump-slot button');
const lines=async page=>(await slot(page).allInnerTexts()).map(t=>t.replace(/\s+/g,' ').trim());
const openMore=async(page,n=0)=>{await page.locator('.ncs-history-card [data-image-more]:not(.ncs-save-toggle)').nth(n).click();await page.locator('.ncs-image-popup:popover-open').waitFor();};
const reopen=async page=>{await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="history"]').click();await page.locator('.ncs-history-card').first().waitFor();};
try{
 for(const width of [375,1100]){
  const free=JSON.stringify({free:true});
  const {page,errors}=await open(width,{extra:[{id:'00000000-0000-4000-8000-00000000f00d',chatKey:free,created:new Date(0).toISOString(),image:'/user/images/naice-shot/00000000-0000-4000-8000-00000000f00d.png',seed:1,options:{},assembled:{base:'x',negative:'',characters:[]},snapshot:{scene:{characters:[],source:null},mode:'free'}}]});
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
  await page.locator('[data-tab="history"]').click();await page.locator('.ncs-history-card').first().waitFor();
  // Made, not attached: one line.
  await openMore(page);
  assert.deepEqual(await lines(page),['메시지로 가기 #1 · 이 그림을 만든 메시지']);
  assert.equal(await page.locator('.ncs-image-popup:popover-open hr').count(),1);
  await slot(page).first().click();
  await page.waitForFunction(()=>!document.querySelector('#naice-shot-dialog').open);
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"]')?.classList.contains('ncs-jump-flash'));
  await page.waitForFunction(()=>!document.querySelector('#chat .ncs-jump-flash'),null,{timeout:4000});
  // Attached to the same message: still one line, saying so.
  await reopen(page);await page.locator('#ncs-history-target').selectOption('1');await openMore(page);await page.locator('.ncs-image-popup:popover-open [data-history-attach]').click();
  await page.waitForFunction(()=>mock.chat[1].extra?.naice_shot_images?.length===1);
  await openMore(page);assert.deepEqual(await lines(page),['메시지로 가기 #1 · 이 그림을 만들고 넣은 메시지']);await page.keyboard.press('Escape');
  // Attached elsewhere too: two lines to choose from; the attached one goes to that message.
  await page.locator('#ncs-history-target').selectOption('0');await openMore(page);await page.locator('.ncs-image-popup:popover-open [data-history-attach]').click();
  await page.waitForFunction(()=>mock.chat[0].extra?.naice_shot_images?.length===1);
  await page.evaluate(()=>{delete mock.chat[1].extra.naice_shot_images;mock.renderChat();});
  await openMore(page);assert.deepEqual(await lines(page),['넣은 메시지로 가기 #0 · 지금 그림이 들어 있는 곳','만든 메시지로 가기 #1 · 이 그림을 만든 메시지']);await page.keyboard.press('Escape');
  // The enlarged viewer offers the same two.
  await page.locator('.ncs-history-card .ncs-image-open').first().click();await page.locator('#ncs-viewer[open]').waitFor();
  const jump=page.locator('#ncs-viewer [data-v="jump"]');assert.equal(await jump.innerText(),'메시지로 가기 ▾');await jump.click();
  assert.deepEqual((await page.locator('#ncs-viewer .ncsv-jump-menu button').allInnerTexts()).map(t=>t.split('\n')[0]),['넣은 메시지로 가기','만든 메시지로 가기']);
  await page.locator('#ncs-viewer .ncsv-jump-menu button').first().click();
  await page.waitForFunction(()=>!document.querySelector('#ncs-viewer').open&&!document.querySelector('#naice-shot-dialog').open);
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="0"]')?.classList.contains('ncs-jump-flash'));
  // The made message was edited afterwards: still offered, with a note.
  await page.evaluate(()=>{delete mock.chat[0].extra.naice_shot_images;mock.chat[1].mes='Leo stands up and leaves the cafe.';mock.renderChat();});
  await reopen(page);await openMore(page);assert.deepEqual(await lines(page),['메시지로 가기 #1 · 이 그림을 만든 메시지 · 그림을 만든 뒤 내용이 바뀌었어요']);await page.keyboard.press('Escape');
  // Gone: the line is greyed with the reason, and 본문에 넣기 (auto) asks for a message instead of using the last one.
  await page.evaluate(()=>{mock.chat.splice(1,1);mock.renderChat();});
  await openMore(page);assert.equal(await slot(page).first().isDisabled(),true);assert.match(await slot(page).first().innerText(),/찾지 못했어요/);
  await page.locator('#ncs-history-target').selectOption('');await page.locator('.ncs-image-popup:popover-open [data-history-attach]').click();
  await page.waitForFunction(()=>/넣을 메시지를 골라 주세요/.test(document.querySelector('#ncs-notice')?.innerText??''));
  assert.equal(await page.evaluate(()=>mock.chat.some(m=>m.extra?.naice_shot_images?.length)),false,'nothing attached silently');
  // Another chat: asks, opens it, then goes to the message.
  await page.evaluate(()=>{mock.chat.push({name:'Leo',mes:'Leo sits by the window. Scene Info: sunny afternoon.'});mock.savedChats={A:structuredClone(mock.chat)};mock.switchChat('B');});
  await page.locator('#ncs-history-scope').selectOption('all');await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=2);
  const cards=page.locator('.ncs-history-card');let made=-1,freeCard=-1;
  for(let i=0;i<await cards.count();i++){const t=await cards.nth(i).innerText();if(/프리샷/.test(t))freeCard=i;else made=i;}
  await openMore(page,freeCard);assert.equal(await slot(page).first().isDisabled(),true);assert.match(await slot(page).first().innerText(),/프리샷 그림은 연결된 메시지가 없어요/);await page.keyboard.press('Escape');
  await openMore(page,made);assert.deepEqual(await lines(page),['메시지로 가기 다른 채팅이에요. 이동 전에 물어봐요.']);
  const asked=page.waitForEvent('dialog');await slot(page).first().click();assert.match((await asked).message(),/채팅으로 이동할까요/);
  await page.waitForFunction(()=>mock.chatId==='A'&&!document.querySelector('#naice-shot-dialog').open);
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"]')?.classList.contains('ncs-jump-flash'));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: 메시지로 가기 one/two lines, viewer choice, edited and missing messages, free images, another chat asks and opens, 본문에 넣기 asks instead of the last message');
}finally{await browser.close();server.close();}
