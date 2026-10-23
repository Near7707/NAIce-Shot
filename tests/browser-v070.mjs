// v0.1.0 end-to-end with the real server plugin: the all-chats history view, chat filter, storage size,
// cross-chat selected delete, deleting a whole (possibly removed) chat, viewer delete, and use without an open chat.
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {hasServer,serverModule,SKIP_NOTE} from './server-dir.mjs';
if(!hasServer){console.log(SKIP_NOTE);process.exit(0);}
const {createHandlers}=await serverModule('handlers.mjs');
import {DEFAULTS} from '../core.mjs';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
function archive(data){const name=Buffer.from('image_0.png'),packed=deflateRawSync(data),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
 const start=local.length+name.length+packed.length;end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(start,16);
 return Buffer.concat([local,name,packed,central,name,end]);}
const userRoot=await fs.mkdtemp(path.join(os.tmpdir(),'naice-shot-all-'));
const directories={root:userRoot,userImages:path.join(userRoot,'user','images')};
const handlers=createHandlers({readKey:()=>'k',fetcher:async url=>url.endsWith('/subscription')?new Response(JSON.stringify({tier:3,perks:{unlimitedImageGeneration:true}})):new Response(archive(png))});
let legacy=false;
const call=(name,{query={},body=null}={})=>new Promise(resolve=>{const res={statusCode:200,status(n){this.statusCode=n;return this;},json(d){resolve({status:this.statusCode,body:d});return this;}};handlers[name]({user:{directories},query,body},res);});
const key=chat=>JSON.stringify({group:null,card:'Leo.png',chat});
const A=key('A'),B=key('Leo - old chat'),C=key('Leo - another chat');
const seed=async chatKey=>{const r=(await call('generate',{body:{requestId:randomUUID(),chatKey,allowAnlas:true,options:{...DEFAULTS.options,seed:1},assembled:{base:'x',negative:'',characters:[]},snapshot:null}})).body;await new Promise(r=>setTimeout(r,3));return r;};
const a=[await seed(A),await seed(A),await seed(A)],b=[await seed(B),await seed(B)],c=[await seed(C)];
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),rel=url.pathname;
 if(rel.startsWith('/api/plugins/naice-shot/')){const route=rel.split('/').pop(),chunks=[];for await(const x of req)chunks.push(x);
  const out=await call(route,{query:Object.fromEntries(url.searchParams),body:chunks.length?JSON.parse(Buffer.concat(chunks)):null});
  if(legacy&&route==='history'){delete out.body.scope;delete out.body.chats;}
  res.writeHead(out.status,{'Content-Type':'application/json'}).end(JSON.stringify(out.body));return;}
 const m=rel.match(/^\/user\/images\/naice-shot\/([0-9a-f-]+\.png)$/);
 if(m){try{const x=await fs.readFile(path.join(directories.userImages,'naice-shot',m[1]));res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.end(x);}catch{res.writeHead(404).end();}return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(req.method==='HEAD'?undefined:bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
const cards=()=>page.locator('#ncs-history .ncs-history-card').count();
const files=async()=>(await fs.readdir(path.join(directories.userImages,'naice-shot'))).length;
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings > summary').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-tab="history"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===3);

 // 1) All chats: every image, per-chat filter, storage, no chat-only controls.
 await page.locator('[data-history-scope="all"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===6);
 assert.match(await page.locator('#ncs-history-storage').textContent(),/저장된 그림 전체 6장 · \d+ KB/);
 assert.equal(await page.locator('#ncs-history-filter option').count(),4);
 assert.match(await page.locator('#ncs-history-filter').textContent(),/A · 지금 채팅 · 3장/);assert.match(await page.locator('#ncs-history-filter').textContent(),/Leo - old chat · 2장/);
 assert.equal(await page.locator('#ncs-history [data-history-attach],#ncs-history [data-history-id]').count(),0,'no attach or restore in the all-chats view');
 assert.equal(await page.locator('#ncs-history-target-row').isHidden(),true);assert.equal(await page.locator('[data-action="delete-chat-history"]').isHidden(),true);
 assert.equal(await page.locator('#ncs-history .ncs-chat-name').first().textContent(),'Leo - another chat');

 // 2) Filter to a chat that no longer exists and clear it entirely.
 await page.locator('#ncs-history-filter').selectOption(B);
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===2);
 assert.equal(await page.locator('[data-action="delete-filter-chat"]').isVisible(),true);
 await click('delete-filter-chat');assert.match(dialogs.at(-1),/"Leo - old chat" 채팅의 그림 2장을 모두/);
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===4);
 assert.equal(await page.locator('#ncs-history-filter').inputValue(),'','filter returns to every chat once that chat is empty');
 assert.equal(await files(),4);assert.equal((await call('history',{query:{chatKey:A}})).body.total,3,'other chats untouched');

 // 3) Attach one of this chat's images, then delete a cross-chat selection: one request per chat, attachment cleaned.
 await page.locator('[data-history-scope="chat"]').click();await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===3);
 await page.locator(`[data-history-attach="${a[2].id}"]`).click();await page.waitForFunction(id=>mock.chat[1]?.extra?.naice_shot_images?.some(x=>x.id===id),a[2].id);
 await page.locator('[data-history-scope="all"]').click();await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===4);
 await page.locator(`[data-history-pick="${a[2].id}"]`).check();await page.locator(`[data-history-pick="${c[0].id}"]`).check();
 await click('delete-selected');
 assert.match(dialogs.at(-1),/선택한 그림 2장을/);assert.match(dialogs.at(-1),/지금 채팅 본문 아래에 붙인 그림 1장/);assert.match(dialogs.at(-1),/다른 채팅에 붙여 둔 그림/);
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===2);
 assert.equal(await page.evaluate(()=>mock.chat[1].extra?.naice_shot_images),undefined);
 assert.equal((await call('history',{query:{chatKey:C}})).body.total,0);assert.equal(await files(),2);

 // 4) Viewer delete from the all-chats view.
 await page.locator(`[data-view-history="${a[1].id}"]`).click();await page.locator('#ncs-viewer[open]').waitFor();
 await page.locator('#ncs-viewer [data-v="delete"]').click();await page.locator('#ncs-viewer').waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===1);
 assert.match(await page.locator('#ncs-history-storage').textContent(),/전체 1장/);

 // 5) Works without an open chat; the per-chat view explains why it is empty.
 await page.evaluate(()=>{mock.chatId=null;mock.emit('chat');});
 await page.locator('[data-tab="history"]').click();await page.locator('[data-history-scope="all"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===1);
 await page.locator('[data-history-scope="chat"]').click();
 await page.waitForFunction(()=>/모든 채팅 보기에서는 채팅을 열지 않아도/.test(document.querySelector('#ncs-history').textContent));

 // 6) An older server plugin gets a clear update message.
 legacy=true;await page.locator('[data-history-scope="all"]').click();
 await page.waitForFunction(()=>/서버 플러그인 v0\.1\.0이 필요해요/.test(document.querySelector('#ncs-history').textContent));
 legacy=false;

 // 7) Mobile fit.
 await page.setViewportSize({width:375,height:760});await page.locator('[data-history-scope="all"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===1);
 assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS: all-chats view with filter and storage, clearing a removed chat, cross-chat selected delete with attachment cleanup, viewer delete, no open chat, old-server message, 375px');
}finally{await browser.close();server.close();await fs.rm(userRoot,{recursive:true,force:true});}
