// Message order and independent tab scroll memory, including asynchronous history refreshes.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(req.method==='HEAD'?undefined:await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
try{
 for(const width of [1280,375]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/plugins/naice-shot/**',route=>route.fulfill({json:{items:[],total:0,hasMore:false}}));
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
   mock.chat=Array.from({length:60},(_,i)=>({name:'Character A',mes:`Example scene message ${i}.`}));mock.renderChat();
   mock.extensionSettings.naice_shot.messageButton=true;
  }));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  const box=page.locator('#ncs-target-scroll'),summary=page.locator('#ncs-target-label'),list=page.locator('#ncs-target-list [data-message-index]');
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const open=async()=>{await summary.click();await list.first().waitFor();await settle();};
  const scroll=async y=>{await box.evaluate((el,value)=>{el.scrollTop=value;},y);await settle();return box.evaluate(el=>el.scrollTop);};
  const same=async(y,label)=>{await settle();const actual=await box.evaluate(el=>el.scrollTop);assert.ok(Math.abs(actual-y)<3,`${width}px ${label}: expected ${y}, got ${actual}`);};
  await open();let saved=await scroll(250);assert.ok(saved>100);
  await summary.click();await settle();assert.equal(await list.count(),0);await open();await same(saved,'close/open keeps browsing offset instead of following latest selection');
  await summary.evaluate(el=>{el.click();el.click();});await same(saved,'rapid collapse/reopen');
  // Growing the list must not jump to the focused more button or erase the offset.
  await page.locator('[data-action="target-more"]').click();assert.equal(await list.count(),20);saved=await scroll(500);
  await summary.click();await settle();await open();await same(saved,'grown list retains offset and loaded rows');assert.equal(await list.count(),20);
  // Tab and outer-panel round trips retain the inner list as well as the main scroll.
  await page.locator('[data-tab="profiles"]').click();await page.locator('[data-tab="scene"]').click();await same(saved,'tab round trip');
  for(const close of [()=>page.locator('[data-action="close"]').click(),()=>page.keyboard.press('Escape')]){
   await close();await page.locator('.ncs-launch-button').click();await same(saved,'outer panel close/reopen');
  }
  await page.evaluate(()=>mock.emit('edited'));await same(saved,'message refresh');
  await page.evaluate(()=>{mock.chat.push({name:'Character A',mes:'New scene message.'});mock.renderChat();mock.emit('received');});await same(saved,'new message refresh');
  // Picking a row remembers the actual browsing position; reopening need not jump to it.
  const chosen=list.nth(8);await chosen.click();const chosenId=await page.locator('#ncs-target').inputValue();assert.notEqual(chosenId,'');
  await open();saved=await scroll(120);await summary.click();await settle();await open();await same(saved,'selected message does not override later browsing');
  // A direct chat icon is a new target request, so reveal that target once.
  await page.locator('[data-action="close"]').click();await page.locator('#chat .mes[mesid="0"] .ncs-mes-draw').click();await open();
  assert.equal(await page.locator('#ncs-target').inputValue(),'0');
  assert.ok(await page.locator('#ncs-target-list [data-message-index="0"]').evaluate(el=>{const b=document.querySelector('#ncs-target-scroll').getBoundingClientRect(),r=el.getBoundingClientRect();return r.top>=b.top-1&&r.bottom<=b.bottom+1;}));
  saved=await scroll(200);await summary.click();await settle();await open();await same(saved,'browse after direct target reveal');
  // Explicit latest and switching chats start at the top, without stale delayed scroll events.
  await page.locator('#ncs-target-list [data-action="target-latest"]').click();await open();await same(0,'latest shortcut');assert.equal(await list.count(),10);
  await scroll(200);await page.evaluate(()=>mock.switchChat('B'));await open();await same(0,'new chat');assert.equal(await list.count(),1);
  assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: picker browse position and loaded rows survive collapse/reopen, tab switches, close/Escape/reopen, message refreshes; selection reveal once, latest/chat reset and mobile fit.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
