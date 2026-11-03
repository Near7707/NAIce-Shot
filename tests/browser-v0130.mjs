// 0.1.30: only NovelAI's free-sized choices. Settings saved with a custom size or more than 28 steps (older versions,
// imported backups) come back as portrait / 28, the size list has no custom entry, and the notes are in place.
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
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:375,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/plugins/naice-shot/**',route=>route.fulfill({json:{items:[],total:0,hasMore:false}}));
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
  mock.extensionSettings.naice_shot={options:{model:'nai-diffusion-4-5-full',width:1536,height:1024,steps:40}};
 }));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-tab="settings"]').click();
 const o=await page.evaluate(()=>mock.extensionSettings.naice_shot.options);
 assert.deepEqual([o.width,o.height,o.steps],[832,1216,28],'saved custom size and steps fall back to free values');
 assert.equal(await page.locator('#ncs-size-preset').inputValue(),'portrait');assert.equal(await page.locator('#ncs-steps').inputValue(),'28');
 assert.equal(await page.locator('#ncs-size-preset option[value="custom"]').count(),0);assert.equal(await page.locator('#ncs-steps').getAttribute('max'),'28');
 assert.match(await page.locator('[data-page="settings"]').innerText(),/세 크기 모두 Opus 무료 범위예요/);
 await page.locator('[data-tab="scene"]').click();
 assert.match(await page.locator('[data-page="scene"]').innerText(),/Anlas가 들 수 있는 생성\(Opus가 아닌 구독, V5, 기본보다 큰 크기·많은 스텝\)은 이 항목을 켜야 보내요/);
 assert.deepEqual(errors,[]);
 console.log('PASS: three free sizes only, saved custom size and >28 steps fall back to portrait/28, size and V5 notes shown');
}finally{await browser.close();server.close();}
