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
  let historyRequests=0;
  await page.route('**/api/plugins/naice-shot/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/status'))return route.fulfill({json:{version:'0.1.7',minClient:'0.1.7',features:['history','delete','privacy-controls'],keyConfigured:true}});
   historyRequests++;
   // Delay replacement to exercise restoring after the tab is already visible.
   await new Promise(r=>setTimeout(r,80));
   const items=Array.from({length:20},(_,i)=>{const id=`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`;return {id,created:'2026-10-29T00:00:00Z',seed:i,image:`/user/images/naice-shot/${id}.png`,chatKey:JSON.stringify({group:null,card:'Leo.png',chat:'A'})};});
   await route.fulfill({json:{items,total:20,hasMore:false}});
  });
  // A large valid PNG avoids broken-image placeholders and simulates delayed image layout.
  await page.route('**/user/images/**',async route=>{
   await new Promise(r=>setTimeout(r,100));
   await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="tan"/></svg>'});
  });
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
   mock.chat=[{name:'One',mes:'Oldest'},{name:'System',is_system:true,mes:'Skip system'},{name:'Two',mes:'  '},{name:'Three',mes:'Middle'},{name:'Four',mes:'Newest'}];mock.renderChat();
  }));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  const content=page.locator('.ncs-content'),tab=name=>page.locator(`[data-tab="${name}"]`).click();
  const top=()=>content.evaluate(el=>el.scrollTop);
  const scroll=async value=>{await content.evaluate((el,y)=>{el.scrollTop=y;},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return top();};
  const same=async(value,label)=>assert.ok(Math.abs(await top()-value)<3,`${width}px ${label}: expected ${value}, got ${await top()}`);
  assert.deepEqual(await page.locator('#ncs-target option').evaluateAll(opts=>opts.map(o=>o.value)),['','4','3','0']);
  await page.locator('#ncs-target').selectOption('3');await page.evaluate(()=>mock.emit('received'));assert.equal(await page.locator('#ncs-target').inputValue(),'3','refresh preserves original message index');
  assert.deepEqual(await page.evaluate(()=>mock.chat.map(m=>m.mes)),['Oldest','Skip system','  ','Middle','Newest'],'sorting never changes the conversation');
  const scene=await scroll(220);assert.ok(scene>100);
  await tab('settings');await same(0,'first settings visit');const settings=await scroll(800);assert.ok(settings>500);
  await tab('profiles');await same(0,'first profile visit');const profiles=await scroll(180);assert.ok(profiles>50);
  await tab('history');await page.locator('[data-history-id]').first().waitFor();await page.locator('#ncs-history img').first().evaluate(img=>img.decode());
  const history=await scroll(1300);assert.ok(history>700);
  for(const [name,y] of [['settings',settings],['profiles',profiles],['scene',scene],['history',history]]){await tab(name);await same(y,`${name} return`);}
  const before=historyRequests;await page.locator('[data-action="history"]').evaluate(el=>el.click());await page.waitForResponse(r=>r.url().includes('/history?'));await page.waitForTimeout(200);assert.ok(historyRequests>before);await same(history,'after explicit history reload and images');
  await page.locator('[data-view-history]').first().evaluate(el=>el.click());await page.locator('#ncs-viewer').waitFor();await page.locator('#ncs-viewer [data-v="close"]').click();await same(history,'after viewer');
  // Closing by button and native Escape both retain the current tab position.
  for(const close of [()=>page.locator('[data-action="close"]').click(),()=>page.keyboard.press('Escape')]){
   await close();await page.locator('.ncs-launch-button').click();await same(history,'after reopening');
  }
  await tab('settings');await same(settings,'settings after reopen');
  // Fast switches must not let an old history response scroll the current settings tab.
  await tab('history');await tab('settings');await page.waitForTimeout(200);await same(settings,'late hidden history response');
  assert.ok(await content.evaluate(el=>el.scrollWidth<=el.clientWidth+1));assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: newest-first targets with stable IDs, four independent tab positions, asynchronous history/images, viewer, close/Escape/reopen, rapid switches and mobile width.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
