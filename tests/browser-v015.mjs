// 0.1.5: chat images can sit above or below the message text; display only, message text untouched.
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
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/plugins/naice-shot/**',async route=>{const u=new URL(route.request().url());
 if(u.pathname.endsWith('/generate')){const b=route.request().postDataJSON();
  return route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});}
 route.fulfill({json:{items:[],total:0,hasMore:false}});});
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
// 'text-first' when the image holder comes after the message text, 'image-first' when before.
const order=()=>page.evaluate(()=>{const holder=document.querySelector('#chat .ncs-inline-images'),text=holder?.closest('.mes')?.querySelector('.mes_text');
 if(!holder||!text)return 'missing';return text.compareDocumentPosition(holder)&Node.DOCUMENT_POSITION_FOLLOWING?'text-first':'image-first';});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await click('extract');await page.locator('[data-character="leo"]').waitFor();
 await page.locator('#ncs-allow-anlas').check();await click('generate');await page.locator('#ncs-result img').waitFor();
 const before=await page.evaluate(()=>JSON.stringify(mock.chat.map(m=>m.mes)));
 await click('attach');await page.waitForFunction(()=>document.querySelector('#chat .ncs-inline-images'));
 assert.equal(await order(),'text-first','default is below the text');

 await page.locator('[data-tab="settings"]').click();
 assert.equal(await page.locator('#ncs-image-placement').inputValue(),'below');
 await page.locator('#ncs-image-placement').selectOption('above');
 await page.waitForFunction(()=>document.querySelector('#chat .ncs-inline-images')?.dataset.placement==='above');
 assert.equal(await order(),'image-first','moves above the text right away');
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePlacement),'above','saved');
 assert.equal(await page.evaluate(()=>JSON.stringify(mock.chat.map(m=>m.mes))),before,'message text untouched');
 assert.equal(await page.locator('#chat .ncs-inline-images').count(),1,'no duplicate holder');

 // New messages and re-renders keep the chosen side.
 await page.evaluate(()=>mock.emit('MESSAGE_EDITED'));await page.waitForTimeout(100);
 assert.equal(await order(),'image-first');
 await page.locator('#ncs-image-placement').selectOption('below');
 await page.waitForFunction(()=>document.querySelector('#chat .ncs-inline-images')?.dataset.placement==='below');
 assert.equal(await order(),'text-first');
 assert.deepEqual(errors,[]);
 console.log('PASS: chat image placement below by default, switch to above and back moves existing images at once, saved, text untouched, no duplicates');
}finally{await browser.close();server.close();}
