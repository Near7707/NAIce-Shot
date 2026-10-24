// 0.1.10: backup import button has no visible file picker under it (iPhone Safari overlap), the skin
// picker is the last settings section, and the menu entry uses SillyTavern's 20px icon box so the
// camera and the name line up with other extensions.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/plugins/naice-shot/**',r=>r.fulfill({json:{items:[],total:0,hasMore:false}}));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 // SillyTavern's menu rules (style.css) plus a normal extension entry to compare with.
 await page.addStyleTag({content:`#extensionsMenu{display:block!important;width:300px}
  #extensionsMenu>div:not(.extension_container){display:flex;column-gap:10px;align-items:baseline;padding:5px}
  .flexGap5{gap:5px}.extensionsMenuExtensionButton{height:20px;width:20px;display:flex;align-items:center;justify-content:center}
  select,input,textarea{opacity:1!important;width:100%!important}`});
 await page.evaluate(()=>{const d=document.createElement('div');d.className='list-group-item flex-container flexGap5';d.innerHTML='<div class="extensionsMenuExtensionButton">★</div>Other';document.getElementById('extensionsMenu').prepend(d);});
 await page.locator('#extensionsMenu .ncs-menu-item').waitFor();
 const rows=await page.$$eval('#extensionsMenu > div',els=>els.map(e=>{const i=e.querySelector('.extensionsMenuExtensionButton').getBoundingClientRect(),r=document.createRange();
  const t=e.querySelector('span[data-brand]')??[...e.childNodes].find(n=>n.nodeType===3);r.selectNodeContents(t);const tr=r.getBoundingClientRect();return {ix:i.x,iw:i.width,ih:i.height,im:i.y+i.height/2,tx:tr.x,tm:tr.y+tr.height/2};}));
 const [other,ours]=rows;
 assert.equal(ours.iw,20);assert.equal(ours.ih,20);assert.equal(ours.ix,other.ix,'icon column');assert.equal(ours.tx,other.tx,'text column');
 assert.ok(Math.abs(ours.im-ours.tm)<=1.5,`icon and text centers ${ours.im} vs ${ours.tm}`);
 assert.equal(await page.locator('#extensionsMenu .ncs-menu-item svg').count(),1,'color camera kept');

 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-tab="settings"]').click();
 const sections=await page.$$eval('[data-page="settings"] > .ncs-section h3',hs=>hs.map(h=>h.textContent));
 assert.equal(sections.at(-1),'스킨');assert.equal(sections.at(-2),'설정 백업');
 // The file picker is invisible and exactly covers its label button, even with a theme forcing inputs visible.
 const g=await page.evaluate(()=>{const l=document.querySelector('.ncs-file').getBoundingClientRect(),i=document.querySelector('#ncs-import'),r=i.getBoundingClientRect();
  return {l:[l.left,l.top,l.right,l.bottom],i:[r.left,r.top,r.right,r.bottom],o:getComputedStyle(i).opacity};});
 assert.equal(g.o,'0');for(let k=0;k<4;k++)assert.ok(Math.abs(g.i[k]-g.l[k])<=1.5,`file input inside its label (${g.i} vs ${g.l})`);
 const row=await page.locator('[data-action="export"]').evaluate(b=>{const r=b.parentElement.getBoundingClientRect();return {bottom:r.bottom,next:b.parentElement.nextElementSibling.getBoundingClientRect().top};});
 assert.ok(row.next>=row.bottom-1,'nothing hangs below the backup buttons');
 assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 // The label still opens the picker.
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.ncs-file').click()]);assert.ok(chooser);
 assert.deepEqual(errors,[]);
 console.log('PASS: menu icon in a 20px box aligned with other entries (color camera kept), skin picker last, invisible file picker covering its button with nothing below it, picker still opens, 390px');
}finally{await browser.close();server.close();}
