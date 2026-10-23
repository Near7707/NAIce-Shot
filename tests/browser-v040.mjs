// v0.4.0 end-to-end: the real server plugin handlers on a temp user folder, driven through the browser UI.
// Covers paged history, shared target, single/selected/all/viewer/result delete, chat attachment cleanup,
// missing-file notes, mixed positions, final JSON preservation, history options and backup import.
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

const userRoot=await fs.mkdtemp(path.join(os.tmpdir(),'naice-shot-e2e-'));
const directories={root:userRoot,userImages:path.join(userRoot,'user','images')};
const naiRequests=[];
const handlers=createHandlers({readKey:()=>'test-key',fetcher:async(url,options)=>{
 if(url.endsWith('/subscription'))return new Response(JSON.stringify({tier:3,perks:{unlimitedImageGeneration:true}}));
 naiRequests.push(JSON.parse(options.body));return new Response(archive(png));
}});
const call=(name,{query={},body=null}={})=>new Promise(resolve=>{
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(data){resolve({status:this.statusCode,body:data});return this;}};
 handlers[name]({user:{directories},query,body},res);
});
const chatA=JSON.stringify({group:null,card:'Leo.png',chat:'A'}),chatB=JSON.stringify({group:null,card:'Leo.png',chat:'B'});
const seed=async chatKey=>(await call('generate',{body:{requestId:randomUUID(),chatKey,allowAnlas:true,options:{...DEFAULTS.options,seed:Math.floor(Math.random()*1e6)},
 assembled:{base:'cafe',negative:'',characters:[{id:'leo',name:'Leo',prompt:'boy',negative:'',position:'auto',outfit:''}]},snapshot:null}})).body;
const seeded=[];for(let i=0;i<23;i++){seeded.push(await seed(chatA));await new Promise(r=>setTimeout(r,2));}
const otherChat=await seed(chatB);

const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),rel=url.pathname;
 if(rel.startsWith('/api/plugins/naice-shot/')){
  const route=rel.slice('/api/plugins/naice-shot/'.length),chunks=[];for await(const c of req)chunks.push(c);
  const name={status:'status',history:'history',generate:'generate',delete:'delete'}[route];
  if(!name){res.writeHead(404).end('not found');return;}
  const out=await call(name,{query:Object.fromEntries(url.searchParams),body:chunks.length?JSON.parse(Buffer.concat(chunks)):null});
  res.writeHead(out.status,{'Content-Type':'application/json'}).end(JSON.stringify(out.body));return;
 }
 const m=rel.match(/^\/user\/images\/naice-shot\/([0-9a-f-]+\.png)$/);
 if(m){try{const b=await fs.readFile(path.join(directories.userImages,'naice-shot',m[1]));res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.end(b);}catch{res.writeHead(404,{'Cache-Control':'no-store'}).end();}return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let dialogAnswer=true;const dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());dialogAnswer?d.accept():d.dismiss();});
const click=action=>page.locator(`[data-action="${action}"]`).click();
const total=async()=>(await call('history',{query:{chatKey:chatA,limit:'100'}})).body.total;
const publicPngs=async()=>(await fs.readdir(path.join(directories.userImages,'naice-shot'))).length;
const records=async()=>(await fs.readdir(path.join(userRoot,'naice-shot-records'))).filter(n=>n!=='index.json').length;
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.push({id:'mira',name:'Mira',aliases:[],subject:'girl',appearance:'short hair',defaultOutfit:'hoodie',positive:'',negative:'',cardKey:''});});
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();

 // 1) Paged history: 20 first, then 더 보기.
 await page.locator('[data-tab="history"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===20);
 assert.match(await page.locator('#ncs-history-count').textContent(),/총 23장 · 20장/);
 assert.equal(await page.locator('#ncs-history [data-image-target]').count(),0,'no per-card message selector');
 assert.equal(await page.locator('#ncs-history-target option').count(),3,'one shared selector: auto + 2 chat messages');
 await click('history-more');await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===23);
 assert.equal(await page.locator('[data-action="history-more"]').isHidden(),true);

 // 2) Attach via the shared selector (auto → latest), then delete two selected incl. the attached one.
 const newest=seeded.at(-1),second=seeded.at(-2);
 await page.locator(`[data-history-attach="${newest.id}"]`).click();
 await page.waitForFunction(id=>mock.chat[1]?.extra?.naice_shot_images?.some(x=>x.id===id),newest.id);
 await page.locator('#chat .ncs-inline-images img').waitFor();
 await page.locator(`[data-history-pick="${newest.id}"]`).check();await page.locator(`[data-history-pick="${second.id}"]`).check();
 assert.equal(await page.locator('[data-action="delete-selected"]').textContent(),'선택 삭제 (2)');
 dialogAnswer=false;await click('delete-selected');assert.equal(await total(),23,'cancelled confirm deletes nothing');
 assert.match(dialogs.at(-1),/선택한 그림 2장/);assert.match(dialogs.at(-1),/붙인 그림 1장도 함께/);
 dialogAnswer=true;await click('delete-selected');
 await page.waitForFunction(()=>/2장을 삭제/.test(document.querySelector('#ncs-notice').textContent));
 assert.equal(await total(),21);assert.equal(await publicPngs(),22,'21 in chat A + 1 in chat B');assert.equal(await records(),22);
 assert.equal(await page.evaluate(()=>mock.chat[1].extra?.naice_shot_images),undefined,'chat attachment cleaned');
 assert.equal(await page.locator('#chat .ncs-inline-images').count(),0);
 await page.waitForFunction(()=>/총 21장/.test(document.querySelector('#ncs-history-count').textContent));
 assert.equal(await page.locator('#ncs-history .ncs-history-card').count(),21,'refresh keeps everything that was shown');

 // 3) Single delete from a card, then from the viewer.
 const third=seeded.at(-3);await page.locator(`[data-history-delete="${third.id}"]`).click();
 await page.waitForFunction(()=>/총 20장/.test(document.querySelector('#ncs-history-count').textContent));assert.equal(await total(),20);
 const fourth=seeded.at(-4);await page.locator(`[data-view-history="${fourth.id}"]`).click();await page.locator('#ncs-viewer[open]').waitFor();
 assert.equal(await page.locator('#ncs-viewer [data-v="delete"]').isVisible(),true);
 await page.locator('#ncs-viewer [data-v="delete"]').click();await page.locator('#ncs-viewer').waitFor({state:'hidden'});
 await page.waitForFunction(()=>/총 19장/.test(document.querySelector('#ncs-history-count').textContent));assert.equal(await total(),19);

 // 4) Missing PNG (removed by hand) shows a note in chat instead of a broken image; viewer from chat can still delete.
 const fifth=seeded.at(-5);
 await page.locator('#ncs-history-target').selectOption('1');await page.locator(`[data-history-attach="${fifth.id}"]`).click();
 await page.locator('#chat .ncs-inline-images img').waitFor();
 await fs.unlink(path.join(directories.userImages,'naice-shot',`${fifth.id}.png`));
 await page.evaluate(()=>{mock.renderChat();});
 await page.locator('#chat .ncs-inline-image.ncs-missing').waitFor();
 assert.match(await page.locator('#chat .ncs-missing-note').textContent(),/찾을 수 없는/);
 assert.equal(await page.locator('#chat [data-ncs-inline-remove]').isVisible(),true);

 // 5) Generate with a mixed AI placement: no blocking error, a warning, no coordinates.
 await page.locator('[data-tab="scene"]').click();
 await page.evaluate(()=>{mock.extraction={characters:[
  {id:'leo',name:'Leo',expression:'smile',action:'sitting',position:'center',outfitMode:'unchanged',outfit:''},
  {id:'leo',name:'Mira',expression:'',action:'walking in',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'cafe',lighting:'',camera:'',interaction:''};});
 await click('extract');await page.locator('[data-character="mira"]').waitFor();
 assert.equal(await page.locator('[data-character]').count(),2,'repeated ID corrected by name');
 assert.match(await page.locator('#ncs-warnings').textContent(),/일부 인물만 위치/);
 await page.locator('#ncs-allow-anlas').check();await click('generate');await page.locator('#ncs-result img').waitFor();
 assert.equal(naiRequests.at(-1).parameters.use_coords,false);assert.match(naiRequests.at(-1).parameters.v4_prompt.caption.char_captions[0].char_caption,/on the center/);

 // 6) Delete the fresh result from the result area.
 const resultId=await page.evaluate(()=>document.querySelector('#ncs-result a[download]').getAttribute('download').replace('naice-shot-','').replace('.png',''));
 await click('delete-result');await page.waitForFunction(()=>!document.querySelector('#ncs-result img'));
 assert.equal((await call('history',{query:{chatKey:chatA,limit:'100'}})).body.items.some(x=>x.id===resultId),false);

 // 7) Invalid final JSON survives a settings change and blocks generation with a friendly message.
 await page.locator('#ncs-final').evaluate(el=>{for(let d=el.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;});
 await page.locator('#ncs-final').fill('{ "base": "broken"');
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-steps').fill('20');await page.locator('[data-tab="scene"]').click();
 assert.equal(await page.locator('#ncs-final').inputValue(),'{ "base": "broken"');
 await click('generate');await page.waitForFunction(()=>/최종 프롬프트 JSON이 올바르지 않아요/.test(document.querySelector('#ncs-notice').textContent));
 await click('reset-final');

 // 8) History restore uses stored options for this generation only; the settings tab keeps seed -1.
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-seed').fill('-1');
 await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length>0);
 const restored=seeded.at(-6);await page.locator(`[data-history-id="${restored.id}"]`).click();
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.options.seed),-1);
 assert.match(await page.locator('#ncs-warnings').textContent(),new RegExp(`seed ${restored.seed}`));
 await click('generate');await page.waitForFunction(()=>document.querySelector('#ncs-result img'));
 assert.equal(naiRequests.at(-1).parameters.seed,restored.seed);
 await page.locator('[data-tab="settings"]').click();assert.equal(await page.locator('#ncs-seed').inputValue(),'-1');

 // 9) Delete the whole chat history: only chat A, chat B untouched.
 await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length>0);
 await click('delete-chat-history');assert.match(dialogs.at(-1),/모두 삭제/);
 await page.waitForFunction(()=>/아직 생성 이력이 없어요/.test(document.querySelector('#ncs-history').textContent));
 assert.equal(await total(),0);assert.deepEqual((await fs.readdir(path.join(directories.userImages,'naice-shot'))),[`${otherChat.id}.png`]);
 assert.equal((await call('history',{query:{chatKey:chatB}})).body.total,1);
 assert.equal(await page.evaluate(()=>JSON.stringify(mock.chat.map(m=>m.extra?.naice_shot_images??null))),'[null,null]','all attachments cleaned');
 assert.equal(await page.locator('[data-action="delete-chat-history"]').isDisabled(),true);

 // 10) Importing a backup never switches on paid generation.
 await page.locator('[data-tab="settings"]').click();
 const backup=await page.evaluate(()=>({...structuredClone(mock.extensionSettings.naice_shot),allowAnlas:true}));
 await page.locator('#ncs-import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.waitForFunction(()=>/Anlas 사용 가능성 허용.*꺼진 상태로/.test(document.querySelector('#ncs-notice').textContent));
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.allowAnlas),false);

 // 11) Mobile history layout fits.
 await page.setViewportSize({width:375,height:760});await page.locator('[data-tab="history"]').click();
 const fit=await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1);assert.ok(fit,'history fits 375px');
 assert.deepEqual(errors,[]);
 console.log('PASS: real server paging + delete (selected/single/viewer/result/all), attachment cleanup, missing-file note, mixed positions, final JSON kept, history options scoped, backup Anlas off, 375px');
}finally{await browser.close();server.close();await fs.rm(userRoot,{recursive:true,force:true});}
