// 0.1.12 regressions: (1) clearing the profile form during a tag conversion drops the late result,
// (2) reopening the panel on the history tab after switching chats loads that chat's history,
// (3) picking skins quickly can never end on an earlier, slower-loading skin.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const slow=new Map();
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(/^\/user\/images\//.test(rel)){res.setHeader('Content-Type','image/png');res.end(png);return;}
 if(slow.has(rel))await new Promise(r=>setTimeout(r,slow.get(rel)));
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.setHeader('Cache-Control','no-store');res.end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const item=(n,chat)=>({id:`00000000-0000-4000-8000-0000000000${String(n).padStart(2,'0')}`,created:new Date(2026,9,24,10,n).toISOString(),chatKey:chat,image:`/user/images/naice-shot/00000000-0000-4000-8000-0000000000${String(n).padStart(2,'0')}.png`,seed:n,options:{},assembled:{base:'',negative:'',characters:[]}});
let historyCalls=0;
await page.route('**/api/plugins/naice-shot/**',route=>{const u=new URL(route.request().url());
 if(u.pathname.endsWith('/history')){historyCalls++;const key=u.searchParams.get('chatKey')??'';const chat=JSON.parse(key||'{}').chat;
  const items=chat==='A'?[item(1,key),item(2,key)]:chat==='B'?[item(3,key)]:[];return route.fulfill({json:{items,total:items.length,hasMore:false}});}
 route.fulfill({json:{keyConfigured:true,version:'0.1.7',features:['paged-history','delete','private-records','all-history','privacy-controls'],minClient:'0.1.0'}});});
await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{const m=window.mock;
 m.generateRaw=async function(options){if(options.prompt.startsWith('Convert ONE character description')){if(this.draftDeferred)return await this.draftDeferred;}
  return JSON.stringify({name:'Late',aliases:[],subject:'boy',appearance:'late result hair',defaultOutfit:'late coat',positive:'',negative:''});};});});
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();

 // 1) Late conversion result after clearing the form (both buttons).
 for(const action of ['clear-profile-form','new-profile']){
  await page.locator('[data-tab="profiles"]').click();await click('new-profile');
  await page.locator('#ncs-profile-name').fill('Draft');await page.locator('#ncs-profile-describe').fill('갈색 머리 남자');
  await page.evaluate(()=>{mock.draftDeferred=new Promise(r=>{window.__finishDraft=r;});});
  await click('convert-profile');await page.locator('#ncs-progress').waitFor({state:'visible'});
  await click(action);
  await page.locator('#ncs-progress').waitFor({state:'hidden'});
  await page.evaluate(()=>window.__finishDraft(JSON.stringify({name:'Late',aliases:[],subject:'boy',appearance:'late result hair',defaultOutfit:'late coat',positive:'',negative:''})));
  await page.waitForTimeout(300);
  for(const f of ['name','appearance','outfit','describe'])assert.equal(await page.locator(`#ncs-profile-${f}`).inputValue(),'',`${action}: ${f} stays empty`);
  assert.equal(await page.locator('[data-action="convert-profile"]').isDisabled(),false,'busy state released');
  await page.evaluate(()=>{mock.draftDeferred=null;});
 }
 // A conversion that is not interrupted still fills the form.
 await page.locator('#ncs-profile-describe').fill('갈색 머리 남자');await click('convert-profile');
 await page.waitForFunction(()=>document.querySelector('#ncs-profile-appearance').value.includes('late result hair'));

 // 2) History tab left open, panel closed, chat switched, panel reopened: the new chat's history loads by itself.
 await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===2);
 await click('close');
 await page.evaluate(()=>mock.switchChat('B'));
 const before=historyCalls;
 await page.locator('.ncs-launch-button').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===1);
 assert.ok(historyCalls>before,'history requested on reopen');
 assert.doesNotMatch(await page.locator('#ncs-history').innerText(),/아직 생성 이력이 없어요/);

 // 3) Quick skin picks: glass loads slowly, pastel picked right after; pastel must win and be saved.
 slow.set('/skins/glass.css',900);
 await page.locator('[data-tab="settings"]').click();await page.waitForFunction(()=>document.querySelectorAll('#ncs-skins .ncs-skin').length===15);
 await page.locator('.ncs-skin:has(input[value="glass"])').click();
 await page.waitForTimeout(80);
 await page.locator('.ncs-skin:has(input[value="pastel"])').click();
 await page.waitForTimeout(1500);
 assert.equal(await page.locator('#naice-shot-dialog').getAttribute('data-skin'),'pastel');
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.skin),'pastel');
 assert.equal(await page.locator('head link[href*="/skins/"]').count(),1,'one skin stylesheet');
 assert.match(await page.locator('head link[href*="/skins/"]').getAttribute('href'),/pastel\.css$/);
 assert.equal(await page.locator('.ncs-skin.ncs-selected input').getAttribute('value'),'pastel');
 // And back to the built-in look while a file skin is still loading.
 await page.locator('.ncs-skin:has(input[value="glass"])').click();await page.waitForTimeout(80);
 await page.locator('.ncs-skin:has(input[value="classic"])').click();await page.waitForTimeout(1500);
 assert.equal(await page.locator('#naice-shot-dialog').getAttribute('data-skin'),'classic');
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.skin),'classic');
 assert.equal(await page.locator('head link[href*="/skins/"]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: late tag conversion ignored after 모든 칸 비우기 / 새 프로필 (busy released, normal conversion still fills), reopened history tab loads the new chat, quick skin picks end on the last choice (file and built-in) and save it');
}finally{await browser.close();server.close();}
