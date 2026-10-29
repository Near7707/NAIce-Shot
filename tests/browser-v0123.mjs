// 0.1.23: "메시지에 그리기 버튼 표시" (off by default) puts a draw button in each message's extra menu;
// it opens the scene tab with that message as the target, refuses to switch targets while work runs,
// and leaves no buttons behind when turned off. Also: the new brand icon everywhere, in color on 미니멀.
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
async function load(page,init=''){
 await page.route('**/api/plugins/naice-shot/**',r=>r.fulfill({json:{items:[],total:0,hasMore:false}}));
 await page.addInitScript(code=>{document.addEventListener('DOMContentLoaded',()=>{const m=window.mock;
  m.chat.push({name:'System',is_system:true,mes:'A system note.',extra:{type:'generic'}},{name:'Leo',mes:'   '},{name:'Leo',mes:'He looks out at the rain.'});m.renderChat();
  if(code)new Function('m',code)(m);});},init);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
}
const buttons=page=>page.locator('#chat .ncs-mes-draw');
try{
 let page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await load(page);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').waitFor();
 // Brand icon: the prism star in the drawer and the menu; no gradient ids to clash.
 for(const sel of ['#ncs-extension-settings .ncs-drawer-title svg','#extensionsMenu .ncs-menu-item svg']){
  const svg=await page.locator(sel).first().evaluate(s=>s.outerHTML);assert.match(svg,/#ffd65a/);assert.doesNotMatch(svg,/url\(#|<linearGradient/);
 }
 // Off by default: nothing added.
 await page.waitForTimeout(200);assert.equal(await buttons(page).count(),0);
 await page.evaluate(()=>mock.renderChat());await page.waitForTimeout(100);assert.equal(await buttons(page).count(),0,'stays off after a re-render');

 // Turn it on: AI and user messages get it, system and empty ones do not.
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 assert.match(await page.locator('#ncs-brand-icon').innerHTML(),/#ffd65a/);
 await page.locator('[data-tab="settings"]').click();assert.equal(await page.locator('#ncs-message-button').isChecked(),false);
 await page.locator('#ncs-message-button').check();
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.messageButton),true);
 assert.deepEqual(await page.$$eval('#chat .mes[mesid]',els=>els.filter(e=>e.querySelector('.ncs-mes-draw')).map(e=>e.getAttribute('mesid'))),['0','1','4']);
 assert.equal(await page.locator('#chat .mes[mesid="0"] .extraMesButtons .ncs-mes-draw').count(),1,'inside the extra message menu');
 // A new message gets one too, without duplicates on re-render.
 await page.evaluate(()=>{mock.chat.push({name:'Mira',is_user:true,mes:'She waves.'});mock.renderChat();});
 await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="5"] .ncs-mes-draw'));
 await page.evaluate(()=>mock.renderChat());await page.waitForTimeout(100);
 assert.equal(await page.locator('#chat .mes[mesid="5"] .ncs-mes-draw').count(),1);

 // Click: scene tab opens with that message targeted.
 await page.locator('[data-action="close"]').first().click();
 await page.locator('#chat .mes[mesid="4"] .ncs-mes-draw').click();
 await page.locator('#naice-shot-dialog[open]').waitFor();
 assert.equal(await page.locator('[data-tab="scene"]').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('#ncs-target').inputValue(),'4');assert.match(await page.locator('#ncs-target-label').innerText(),/^#4 · Leo · He looks out at the rain\./);
 assert.match(await page.locator('#ncs-notice').innerText(),/#4 메시지를 대상으로 골랐어요/);
 assert.equal(await page.evaluate(()=>mock.extractCalls??0),0,'no automatic extraction');
 // Keyboard works too.
 await page.locator('[data-action="close"]').first().click();
 await page.locator('#chat .mes[mesid="0"] .ncs-mes-draw').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#ncs-target').value==='0');

 // While an extraction runs, the target does not change.
 await page.evaluate(()=>{mock.extractionDeferred=new Promise(()=>{});});
 await page.locator('[data-action="extract"]').first().click();await page.locator('#ncs-progress').waitFor({state:'visible'});
 await page.locator('[data-action="close"]').first().click();
 await page.locator('#chat .mes[mesid="1"] .ncs-mes-draw').click();
 await page.locator('#naice-shot-dialog[open]').waitFor();
 assert.equal(await page.locator('#ncs-target').inputValue(),'0','target kept during work');
 assert.match(await page.locator('#ncs-notice').innerText(),/진행 중인 작업이 끝난 뒤 선택해 주세요/);
 await page.locator('#ncs-progress-cancel').click();

 // Off again: every button removed and none come back.
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-message-button').uncheck();
 assert.equal(await buttons(page).count(),0);
 await page.evaluate(()=>mock.renderChat());await page.waitForTimeout(150);assert.equal(await buttons(page).count(),0);
 // 미니멀 keeps the icon in color.
 await page.locator('.ncs-skin:has(input[value="minimal"])').click();await page.waitForFunction(()=>document.querySelector('#naice-shot-dialog').dataset.skin==='minimal');
 assert.equal(await page.locator('#ncs-brand-icon .ncs-icon').evaluate(e=>getComputedStyle(e).filter),'none');
 assert.deepEqual(errors,[]);await page.close();

 // Saved "on" setting: buttons appear at startup.
 page=await browser.newPage({viewport:{width:1280,height:900}});
 await load(page,"m.extensionSettings.naice_shot.messageButton=true;");
 await page.waitForFunction(()=>document.querySelectorAll('#chat .ncs-mes-draw').length===3);
 await page.close();
 console.log('PASS: brand icon (no gradient ids) in drawer/menu/header; message button off by default, on for AI+user messages only (not system/empty), inside the extra menu, no duplicates, opens scene tab with that target, keyboard, blocked during extraction, removed when off, starts on when saved; 미니멀 keeps color');
}finally{await browser.close();server.close();}
