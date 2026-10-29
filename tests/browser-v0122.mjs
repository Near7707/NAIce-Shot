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
  const page=await browser.newPage({viewport:{width,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/plugins/naice-shot/**',route=>route.fulfill({json:{items:[],total:0,hasMore:false}}));
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
   mock.chat=Array.from({length:57},(_,i)=>({name:i===56?'<img src=x onerror=alert(1)>':'Character A',mes:`Message ${i} in a cafe.`}));
   mock.chat[20].is_system=true;mock.chat[21].mes='   ';
  }));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  const list=page.locator('#ncs-target-list button'),action=name=>page.locator(`[data-action="${name}"]`).click();
  const open=async()=>{await page.locator('#ncs-target-label').focus();await page.keyboard.press('Enter');await list.first().waitFor();};
  assert.equal(await list.count(),0,'closed picker does not build previews');await open();
  const before=await page.locator('.ncs-content').evaluate(el=>el.scrollTop);await list.first().hover();await page.mouse.wheel(0,350);
  await page.waitForFunction(y=>document.querySelector('.ncs-content').scrollTop>y+50,before);

  const expected=Array.from({length:57},(_,i)=>56-i).filter(i=>i!==20&&i!==21),seen=[];
  for(let p=0;p<6;p++){
   const values=await list.evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.messageIndex)));assert.deepEqual(values,expected.slice(p*10,p*10+10));seen.push(...values);
   assert.ok(values.length<=10);assert.equal(await page.locator('#ncs-target-list img').count(),0,'names are text, not HTML');
   if(p<5)await action('target-older');
  }
  assert.deepEqual(seen,expected,'every older message is reachable without scrolling a native menu');
  assert.equal(await page.locator('[data-action="target-older"]').isDisabled(),true);
  await page.locator('[data-message-index="0"]').click();assert.equal(await page.locator('#ncs-target').inputValue(),'0');
  assert.match(await page.locator('#ncs-target-label').textContent(),/#0/);assert.equal(await list.count(),0);
  await page.locator('#ncs-recent').fill('1');await action('extract');await page.waitForFunction(()=>mock.extractCalls===1&&document.querySelector('#ncs-progress').hidden);
  assert.match(await page.evaluate(()=>mock.lastExtract.prompt),/Message 0 in a cafe/);assert.doesNotMatch(await page.evaluate(()=>mock.lastExtract.prompt),/Message 56 in a cafe/);
  await open();await action('target-newer');await action('target-newer');assert.equal(await page.locator('#ncs-target').inputValue(),'0','browsing pages never changes the selected target');
  await page.evaluate(()=>{mock.chat.push({name:'Character A',mes:'New message'});mock.emit('received');});assert.equal(await page.locator('#ncs-target').inputValue(),'0');
  await action('target-latest');assert.equal(await page.locator('#ncs-target').inputValue(),'');
  await open();assert.equal(await list.first().getAttribute('data-message-index'),'57');assert.equal(await page.locator('[data-action="target-newer"]').isDisabled(),true);
  // At most ten rows, even for a long chat; no DOM for thousands of hidden options.
  await page.evaluate(()=>{mock.chat=Array.from({length:5000},(_,i)=>({name:'Character A',mes:`Example message ${i}`}));mock.emit('received');});assert.equal(await list.count(),10);
  assert.equal(await list.first().getAttribute('data-message-index'),'4999');
  assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.evaluate(()=>mock.switchChat('B'));assert.equal(await page.locator('#ncs-target').inputValue(),'');assert.equal(await page.locator('#ncs-target-picker').evaluate(el=>el.open),false);
  await open();assert.equal(await list.count(),1);assert.equal(await list.first().getAttribute('data-message-index'),'0');
  await page.evaluate(()=>{mock.chat=[];mock.emit('received');});assert.equal(await list.count(),0);assert.equal(await page.locator('[data-action="target-older"]').isDisabled(),true);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: keyboard-opened HTML picker, all 55 eligible messages reachable in 10-row pages, oldest extraction, stable selection, latest mode, 5000-message DOM bound, chat reset, escaping, empty chat and mobile fit.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
