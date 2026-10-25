// Skin picker in a real browser: switching, saving, viewer tint, ST-theme independence,
// and falling back to the built-in look when a skin file has been deleted.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
let deleted=new Set();
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(/^\/user\/images\/naice-shot\/[0-9a-f-]+\.png$/.test(rel)){res.setHeader('Content-Type','image/png');res.end(png);return;}
 if([...deleted].some(name=>rel.endsWith(`/skins/${name}`))){res.writeHead(404).end();return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');
 res.end(req.method==='HEAD'?undefined:bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const errors=[];
async function open(preset){
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 const id='00000000-0000-4000-8000-000000000001';
 await page.route('**/api/plugins/naice-shot/**',route=>{const u=new URL(route.request().url());
  route.fulfill({json:u.pathname.endsWith('/history')?{items:[{id,created:new Date().toISOString(),chatKey:u.searchParams.get('chatKey'),image:`/user/images/naice-shot/${id}.png`,seed:5,options:{model:'nai-diffusion-5-full'},assembled:{base:'',negative:'',characters:[]},snapshot:null}],total:1,hasMore:false}:{}});});
 if(preset)await page.addInitScript(skin=>{document.addEventListener('DOMContentLoaded',()=>{window.mock.extensionSettings.naice_shot.skin=skin;});},preset);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 return page;
}
const skinOf=page=>page.locator('#naice-shot-dialog').getAttribute('data-skin');
try{
 let page=await open();
 await page.locator('[data-tab="settings"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-skins .ncs-skin').length===15);
 assert.equal(await skinOf(page),'classic');assert.equal(await page.locator('#ncs-skin-css').count(),0,'classic loads no extra file');
 assert.equal(await page.locator('.ncs-tabs [data-tab] .ncs-tab-icon svg').count(),4,'tab icons');

 // Switch and save; only the chosen file is loaded.
 for(const id of ['glass','minimal','cream','matcha','deepblue','lavender','milk','strawberrymilk','bananamilk','chocomilk','coffeemilk','apple','cocoa','pastel']){
  await page.locator(`#ncs-skins input[value="${id}"]`).check({force:true});
  await page.waitForFunction(id=>document.querySelector('#naice-shot-dialog').dataset.skin===id,id);
  assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.skin),id);
  assert.equal(await page.locator('link#ncs-skin-css').count(),1);assert.match(await page.locator('link#ncs-skin-css').getAttribute('href'),new RegExp(`skins/${id}\\.css$`));
  assert.equal(await page.locator('.ncs-skin.ncs-selected input').getAttribute('value'),id);
 }
 // Fixed palette: the same pastel colors under a light and a dark ST theme, checkbox included.
 const sample=async()=>{await page.evaluate(()=>{document.querySelector('#ncs-schema').checked=true;});await page.waitForTimeout(300); // let the color transition finish
  return page.evaluate(()=>{const d=document.querySelector('#naice-shot-dialog'),cb=document.querySelector('#ncs-schema');return [getComputedStyle(d).backgroundColor,getComputedStyle(cb).backgroundColor,getComputedStyle(cb).borderTopColor];});};
 await page.evaluate(()=>{document.documentElement.style.setProperty('--SmartThemeBlurTintColor','#fcf7ef');document.documentElement.style.setProperty('--SmartThemeBodyColor','#403d3a');});
 const light=await sample();
 await page.evaluate(()=>{document.documentElement.style.setProperty('--SmartThemeBlurTintColor','#111');document.documentElement.style.setProperty('--SmartThemeBodyColor','#eee');});
 const dark=await sample();
 assert.deepEqual(light,dark,'skin colors do not follow the ST theme');assert.equal(light[1],'rgb(31, 111, 158)','checked box uses the skin color');
 // Viewer takes the skin accent.
 await page.locator('[data-tab="history"]').click();await page.locator('#ncs-history .ncs-image-open').first().click();
 await page.locator('#ncs-viewer[open]').waitFor();assert.equal(await page.locator('#ncs-viewer').getAttribute('data-skin'),'pastel');
 assert.equal(await page.locator('#ncs-viewer .ncsv-save').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 224, 138)');
 await page.keyboard.press('Escape');
 // Mobile: every skin keeps the settings tab inside 375px.
 await page.setViewportSize({width:375,height:760});await page.locator('[data-tab="settings"]').click();
 for(const id of ['classic','glass','minimal','pastel','cream','matcha','deepblue','lavender','milk','strawberrymilk','bananamilk','chocomilk','coffeemilk','apple','cocoa']){
  await page.locator(`#ncs-skins input[value="${id}"]`).check({force:true});
  await page.waitForFunction(id=>document.querySelector('#naice-shot-dialog').dataset.skin===id,id);
  for(const tab of ['scene','profiles','settings','history']){
   await page.locator(`[data-tab="${tab}"]`).click();
   const fit=await page.evaluate(()=>{const d=document.querySelector('#naice-shot-dialog'),c=d.querySelector('.ncs-content'),r=d.getBoundingClientRect();return c.scrollWidth<=c.clientWidth+1&&r.left>=0&&r.right<=innerWidth;});
   assert.ok(fit,`${id} ${tab} fits 375px`);
  }
  await page.locator('[data-tab="settings"]').click();
 }
 await page.close();

 // A deleted skin file disappears from the picker and the saved choice falls back to the built-in look.
 deleted=new Set(['pastel.css']);
 page=await open('pastel');
 await page.locator('[data-tab="settings"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-skins .ncs-skin').length===14);
 assert.equal(await page.locator('#ncs-skins input[value="pastel"]').count(),0);
 await page.waitForFunction(()=>/찾지 못해 기본으로/.test(document.querySelector('#ncs-skin-state').textContent));
 assert.equal(await skinOf(page),'classic');assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.skin),'classic');
 await page.close();
 // The removed neon skin: someone who had it saved gets the built-in look.
 deleted=new Set();
 page=await open('neon');
 await page.locator('[data-tab="settings"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-skins .ncs-skin').length===15);
 assert.equal(await page.locator('#ncs-skins input[value="neon"]').count(),0);
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.skin==='classic');
 assert.equal(await skinOf(page),'classic');
 await page.close();
 assert.deepEqual(errors,[]);
 console.log('PASS: skin picker, saved choice, single CSS file, theme-independent colors and checkbox, viewer tint, 375px for all skins, deleted-skin fallback');
}finally{await browser.close();server.close();}
