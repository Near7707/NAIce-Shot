// 0.1.3: server plugin version check on panel open, with a dismissible banner.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {VERSION} from '../core.mjs';
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
const {REQUIRED_SERVER_FEATURES:features}=await import('../compat.mjs');
async function run(statusReply,viewport={width:1280,height:900}){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let quick=0;
 await page.route('**/api/plugins/naice-shot/**',route=>{const u=new URL(route.request().url());
  if(u.pathname.endsWith('/status')){if(u.searchParams.get('quick')==='1')quick++;return statusReply(route,u);}
  route.fulfill({json:{items:[],total:0,hasMore:false}});});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings > summary').click();await page.locator('.ncs-launch-button').click();
 await page.waitForFunction(()=>document.querySelector('#ncs-compat').dataset.level);
 return {page,errors,quick:()=>quick};
}
try{
 // 1) Old server: warning banner with the fix, dismiss hides it, reopening the panel does not nag again.
 let r=await run(route=>route.fulfill({json:{keyConfigured:true,version:'0.0.9',features:['delete']}}));
 assert.equal(await r.page.locator('#ncs-compat').isVisible(),true);
 assert.match(await r.page.locator('#ncs-compat-text').textContent(),/서버 플러그인이 이전 버전\(v0\.0\.9\)이에요.*재시작/);
 await r.page.locator('[data-action="dismiss-compat"]').click();assert.equal(await r.page.locator('#ncs-compat').isHidden(),true);
 await r.page.locator('[data-action="close"]').first().click();await r.page.locator('.ncs-launch-button').click();
 assert.equal(await r.page.locator('#ncs-compat').isHidden(),true);assert.equal(r.quick(),1,'checked once per page load');
 assert.deepEqual(r.errors,[]);await r.page.close();

 // 2) Plugin missing (404 HTML): error banner explains the folder and config. Fits at 375px.
 r=await run(route=>route.fulfill({status:404,contentType:'text/html',body:'Not found'}),{width:375,height:760});
 assert.equal(await r.page.locator('#ncs-compat').isVisible(),true);
 assert.match(await r.page.locator('#ncs-compat-text').textContent(),/서버 플러그인을 찾지 못했어요.*enableServerPlugins/);
 assert.ok(await r.page.locator('#naice-shot-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.deepEqual(r.errors,[]);await r.page.close();

 // 3) Matching server: no banner; settings shows both versions.
 r=await run((route,u)=>route.fulfill({json:u.searchParams.get('quick')==='1'?{keyConfigured:true,version:VERSION,features,minClient:'0.1.0'}:{keyConfigured:false,version:VERSION,features}}));
 assert.equal(await r.page.locator('#ncs-compat').isHidden(),true);
 assert.equal(await r.page.locator('#ncs-compat').getAttribute('data-level'),'ok');
 await r.page.locator('[data-tab="settings"]').click();
 assert.match(await r.page.locator('#ncs-server-version').textContent(),new RegExp(`서버 플러그인 v${VERSION.replace(/\./g,'\\.')} · 확장 v`));
 assert.deepEqual(r.errors,[]);await r.page.close();
 console.log('PASS: old-server banner and dismiss, missing-plugin banner at 375px, matching versions stay quiet with versions in settings');
}finally{await browser.close();server.close();}
