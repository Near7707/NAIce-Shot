// 0.1.9: the settings drawer uses SillyTavern's drawer markup and is attached before the panel file
// loads (so it keeps its place in the extension list), and text fields stay readable on every skin
// even when a theme forces all inputs to one color with !important.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let panelDelay=0;
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel==='/panel.html'&&panelDelay)await new Promise(r=>setTimeout(r,panelDelay));
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const rgb=s=>s.match(/[\d.]+/g).map(Number);
const lum=c=>{const [r,g,b]=c.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const over=(top,under)=>{const a=top[3]??1;return [0,1,2].map(i=>top[i]*a+under[i]*(1-a));};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)];return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
try{
 // 1) Drawer is in place before the slow panel file arrives, ahead of an extension that mounts later.
 panelDelay=1500;
 let page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/plugins/naice-shot/**',r=>r.fulfill({json:{items:[],total:0,hasMore:false}}));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(()=>{const other=document.createElement('div');other.id='later-extension';document.getElementById('extensions_settings2').append(other);});
 assert.equal(await page.locator('#naice-shot-dialog').count(),0,'panel file still loading');
 assert.deepEqual(await page.locator('#extensions_settings2 > *').evaluateAll(els=>els.map(e=>e.id)),['ncs-extension-settings','later-extension']);
 assert.equal(await page.locator('#ncs-extension-settings .inline-drawer > .inline-drawer-toggle.inline-drawer-header').count(),1);
 assert.equal(await page.locator('#ncs-extension-settings .inline-drawer-icon.fa-circle-chevron-down').count(),1);
 // Clicking 열기 while the panel is still loading opens it once ready.
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('#naice-shot-dialog[open]').waitFor({timeout:10000});
 assert.deepEqual(errors,[]);await page.close();panelDelay=0;

 // 2) Text fields and dropdowns stay readable on every skin under a theme that forces inputs white/grey.
 for(const theme of [{bg:'#ffffff',fg:'#aaaaaa'},{bg:'#111111',fg:'#333333'}]){
  page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('**/api/plugins/naice-shot/**',r=>r.fulfill({json:{items:[],total:0,hasMore:false}}));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.addStyleTag({content:`select,input,textarea{background:${theme.bg}!important;background-color:${theme.bg}!important;color:${theme.fg}!important;-webkit-text-fill-color:${theme.fg}!important}`});
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  await page.locator('[data-tab="settings"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#ncs-skins .ncs-skin').length===13);
  for(const skin of ['classic','glass','minimal','pastel','cream','matcha','deepblue','lavender','milk','strawberrymilk','bananamilk','chocomilk','coffeemilk']){
   await page.locator(`.ncs-skin:has(input[value="${skin}"])`).click();await page.waitForTimeout(250);
   for(const sel of ['#ncs-image-placement','#ncs-positive','#ncs-steps']){
    const look=await page.locator(sel).evaluate(el=>{const d=document.querySelector('#naice-shot-dialog'),s=getComputedStyle(el),ds=getComputedStyle(d);
     return {fg:s.webkitTextFillColor||s.color,bg:s.backgroundColor,panel:ds.backgroundColor};});
    // Worst case behind a translucent panel: black.
    const panel=over(rgb(look.panel),[0,0,0]),field=over(rgb(look.bg),panel);
    const r=ratio(rgb(look.fg),field);
    assert.ok(r>=4.5,`${skin} ${sel} under ${theme.bg} theme: ${look.fg} on ${look.bg} = ${r.toFixed(2)}:1`);
   }
  }
  await page.close();
 }
 console.log('PASS: drawer uses SillyTavern markup, mounts before the panel file and ahead of later extensions, opens once ready; fields readable (>=4.5:1) on 13 skins under forced white and dark input themes');
}finally{await browser.close();server.close();}
