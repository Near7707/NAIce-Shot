// 0.1.19: one-generation overrides and focused editors must not leak to another generation/chat.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?pathToFileURL(path.join(modules,'playwright/index.mjs')).href:'playwright');
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

const {DEFAULTS}=await import('../core.mjs');
const id='11111111-1111-4111-8111-111111111111';
const history={id,created:'2026-10-27T00:00:00Z',chatKey:JSON.stringify({group:null,card:'Leo.png',chat:'A'}),image:`/user/images/naice-shot/${id}.png`,
  seed:777,options:{...DEFAULTS.options,seed:777,steps:19,width:1024,height:1024},
  assembled:{base:'history only prompt',negative:'old negative',characters:[],warnings:[]},snapshot:null};
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],sent=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/plugins/naice-shot/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/generate')){
    const b=route.request().postDataJSON();sent.push(b);
    await route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});return;
  }
  await route.fulfill({json:{items:[history],total:1,hasMore:false}});
});
await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
  mock.extensionSettings.naice_shot.positive='current settings prompt';
  mock.extensionSettings.naice_shot.allowAnlas=true;
}));
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
const restore=async()=>{
  await page.locator('[data-tab="history"]').click();
  await page.locator('[data-history-id]').first().click();
  await assert.equal(await page.locator('[data-final="base"]').inputValue(),'history only prompt');
};
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();
  await page.locator('.ncs-launch-button').click();
  const normal=await page.evaluate(()=>structuredClone(mock.extensionSettings.naice_shot.options));
  await restore();
  await page.locator('#ncs-final-box').evaluate(el=>{el.open=true;});
  await page.locator('[data-final="base"]').fill('one generation edit');
  await click('generate');
  await page.waitForFunction(()=>document.querySelector('#ncs-final-badge').hidden&&document.querySelector('#ncs-result img'));
  assert.equal(sent[0].assembled.base,'one generation edit');
  assert.equal(sent[0].options.seed,777);
  assert.equal(await page.locator('[data-final="base"]').inputValue(),'current settings prompt');
  await click('generate');
  await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled);
  assert.equal(sent[1].assembled.base,'current settings prompt');
  assert.equal(sent[1].options.steps,normal.steps);
  assert.equal(sent[1].options.width,normal.width);
  assert.deepEqual(await page.evaluate(()=>mock.extensionSettings.naice_shot.options),normal);

  await restore();
  await page.locator('[data-final="base"]').focus();
  await page.evaluate(()=>mock.switchChat('B'));
  assert.equal(await page.locator('[data-final="base"]').inputValue(),'current settings prompt','chat switching must replace even the focused editor');
  assert.equal(await page.locator('#ncs-final-badge').isHidden(),true);
  assert.doesNotMatch(await page.locator('#ncs-warnings').textContent(),/seed 777/);
  await click('generate');
  await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled);
  assert.equal(JSON.parse(sent[2].chatKey).chat,'B');
  assert.equal(sent[2].assembled.base,'current settings prompt');
  assert.equal(sent[2].options.steps,normal.steps);

  await page.evaluate(()=>mock.switchChat('A'));
  await restore();
  await click('reset-final');
  assert.doesNotMatch(await page.locator('#ncs-warnings').textContent(),/seed 777/);
  await click('generate');
  await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled);
  assert.equal(sent[3].options.steps,normal.steps);
  assert.equal(sent[3].assembled.base,'current settings prompt');
  assert.deepEqual(errors,[]);
  console.log('PASS: successful generation consumes overrides; next request uses current settings; focused editor and history options reset on chat change; reset-final clears history options.');
}finally{await page.close();await browser.close();await new Promise(r=>server.close(r));}
