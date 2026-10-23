// v0.3.1 browser checks: visible extraction progress + cancel, and the image viewer from result/history/chat.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// 640×960 PNG so fit/zoom math has a real aspect ratio.
const {deflateSync}=await import('node:zlib');
function makePng(w,h){const crcT=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=b=>{let c=~0;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (~c)>>>0;};
 const chunk=(t,d)=>{const len=Buffer.alloc(4);len.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;raw[o]=x*4;raw[o+1]=y*2;raw[o+2]=160;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
const png=makePng(640,960);
const server=http.createServer(async(req,res)=>{
 try{const rel=new URL(req.url,'http://localhost').pathname;
  if(/^\/user\/images\/naice-shot\/[0-9a-f-]+\.png$/.test(rel)){res.setHeader('Content-Type','image/png');res.end(png);return;}
  const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const items=[];
await page.route('**/api/plugins/naice-shot/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname.endsWith('/history'))return route.fulfill({json:{items:items.filter(x=>x.chatKey===url.searchParams.get('chatKey')),total:items.length}});
 if(url.pathname.endsWith('/status'))return route.fulfill({json:{keyConfigured:true,version:'0.1.0',subscription:{tier:3,perks:{unlimitedImageGeneration:true}}}});
 const b=req.postDataJSON();const item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};
 items.push(item);route.fulfill({json:item});
});
const click=action=>page.locator(`[data-action="${action}"]`).click();
const zoom=()=>page.locator('#ncs-viewer .ncsv-zoom').textContent();
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(()=>{mock.stopEvents=[];mock.eventSource.emit=async type=>{mock.stopEvents.push(type);};mock.eventTypes.GENERATION_STOPPED='generation_stopped';});
 await page.locator('#ncs-extension-settings > summary').click();await page.locator('.ncs-launch-button').click();
 assert.equal(await page.locator('#ncs-progress').isHidden(),true,'banner hidden while idle');
 assert.match(await page.locator('footer').textContent(),/v\d+\.\d+\.\d+/);

 // 1) Extraction that never answers: banner is prominent, cancel releases the UI and stops ST's raw request.
 await page.evaluate(()=>{mock.extractionDeferred=new Promise(()=>{});});
 await click('extract');
 await page.locator('#ncs-progress').waitFor({state:'visible'});
 assert.match(await page.locator('#ncs-progress-title').textContent(),/장면 추출 중/);
 assert.equal(await page.locator('[data-action="extract"]').textContent(),'장면 추출 중…');
 assert.equal(await page.locator('[data-action="extract"]').isDisabled(),true);
 const banner=await page.locator('#ncs-progress').evaluate(el=>{const r=el.getBoundingClientRect(),c=document.querySelector('.ncs-content').getBoundingClientRect();return {top:r.top,contentTop:c.top,cancel:getComputedStyle(document.querySelector('#ncs-progress-cancel')).display};});
 assert.ok(banner.top<banner.contentTop,'banner sits above the scrolling content');assert.notEqual(banner.cancel,'none');
 await page.waitForFunction(()=>/1초|2초/.test(document.querySelector('#ncs-progress-detail').textContent),null,{timeout:4000});
 await page.locator('#ncs-progress-cancel').click();
 await page.locator('#ncs-progress').waitFor({state:'hidden'});
 assert.equal(await page.locator('[data-action="extract"]').isDisabled(),false);
 assert.equal(await page.locator('[data-action="extract"]').textContent(),'장면 추출');
 assert.match(await page.locator('#ncs-notice').textContent(),/추출을 중단했어요/);
 assert.deepEqual(await page.evaluate(()=>mock.stopEvents),['generation_stopped']);
 // Restarting right away works and a normal extraction still applies.
 await page.evaluate(()=>{mock.extractionDeferred=null;});await click('extract');await page.locator('[data-character="leo"]').waitFor();
 assert.equal(await page.locator('#ncs-progress').isHidden(),true);

 // 2) Generation shows the banner without a cancel button.
 await page.locator('#ncs-allow-anlas').check();
 let releaseGen;await page.unroute('**/api/plugins/naice-shot/**');
 await page.route('**/api/plugins/naice-shot/**',async route=>{const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith('/history'))return route.fulfill({json:{items:items.filter(x=>x.chatKey===url.searchParams.get('chatKey')),total:items.length}});
  const b=req.postDataJSON();await new Promise(r=>{releaseGen=r;});
  const item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};items.push(item);route.fulfill({json:item});});
 await click('generate');await page.locator('#ncs-progress').waitFor({state:'visible'});
 assert.match(await page.locator('#ncs-progress-title').textContent(),/NAI 이미지 생성 중/);
 assert.equal(await page.locator('#ncs-progress-cancel').isHidden(),true,'paid request has no cancel');
 while(!releaseGen)await new Promise(r=>setTimeout(r,20));releaseGen();
 await page.locator('#ncs-result img').waitFor();await page.locator('#ncs-progress').waitFor({state:'hidden'});

 // 3) Viewer from the result thumbnail.
 await page.locator('#ncs-result .ncs-image-open').click();
 await page.locator('#ncs-viewer[open]').waitFor();
 await page.waitForFunction(()=>/640 × 960/.test(document.querySelector('#ncs-viewer .ncsv-meta').textContent));
 const fitPct=parseInt(await zoom());assert.ok(fitPct<100&&fitPct>50,'tall image is fitted down to the screen');
 assert.equal(await page.locator('#ncs-viewer [data-v="fit"]').getAttribute('aria-pressed'),'true');
 await page.locator('#ncs-viewer [data-v="original"]').click();assert.equal(await zoom(),'100%');
 const box=await page.locator('#ncs-viewer img').boundingBox();assert.equal(Math.round(box.width),640);assert.equal(Math.round(box.height),960);
 await page.locator('#ncs-viewer [data-v="in"]').click();assert.equal(await zoom(),'125%');
 await page.locator('#ncs-viewer [data-v="out"]').click();await page.locator('#ncs-viewer [data-v="out"]').click();assert.equal(await zoom(),'80%');
 await page.keyboard.press('0');assert.equal(parseInt(await zoom()),fitPct,'0 key fits');
 const save=page.locator('#ncs-viewer .ncsv-save');const id=items.at(-1).id;
 assert.equal(await save.getAttribute('href'),`/user/images/naice-shot/${id}.png`);assert.equal(await save.getAttribute('download'),`naice-shot-${id}.png`);
 const [download]=await Promise.all([page.waitForEvent('download'),save.click()]);
 assert.equal(download.suggestedFilename(),`naice-shot-${id}.png`);
 assert.deepEqual(await fs.readFile(await download.path()),png,'saves the original PNG bytes');
 // Wheel zoom around the cursor, then drag-pan stays inside bounds.
 await page.locator('#ncs-viewer [data-v="original"]').click();await page.locator('#ncs-viewer [data-v="in"]').click();
  const before=await page.locator('#ncs-viewer img').boundingBox();
 await page.mouse.move(640,500);await page.mouse.down();await page.mouse.move(400,300,{steps:5});await page.mouse.up();
 const after=await page.locator('#ncs-viewer img').boundingBox();assert.ok(after.y<before.y-100,'drag pans the zoomed image vertically');assert.ok(Math.abs(after.x-before.x)<1,'narrower axis stays centred');
 await page.locator('#ncs-viewer [data-v="close"]').click();await page.locator('#ncs-viewer').waitFor({state:'hidden'});
 assert.equal(await page.locator('#naice-shot-dialog').evaluate(d=>d.open),true,'panel stays open after the viewer closes');

 // 4) Viewer from history, then from the chat attachment.
 await page.locator('[data-tab="history"]').click();await page.locator('#ncs-history .ncs-image-open').first().click();
 await page.locator('#ncs-viewer[open]').waitFor();assert.match(await page.locator('#ncs-viewer .ncsv-meta').textContent(),/seed/);
 await page.keyboard.press('Escape');await page.locator('#ncs-viewer').waitFor({state:'hidden'});
 await page.locator('[data-tab="scene"]').click();await click('attach');await page.locator('#chat .ncs-inline-open img').waitFor();
 await click('close');
 await page.locator('#chat .ncs-inline-open').click();await page.locator('#ncs-viewer[open]').waitFor();
 assert.equal(await page.locator('#ncs-viewer .ncsv-save').getAttribute('download'),`naice-shot-${id}.png`);
 // A tap on empty stage area closes.
 await page.mouse.click(5,450);await page.locator('#ncs-viewer').waitFor({state:'hidden'});
 assert.equal(await page.locator('#chat .ncs-inline-image [data-ncs-inline-remove]').count(),1,'remove button still present');

 // 5) Mobile: toolbar fits, pinch zoom changes scale.
 await page.setViewportSize({width:375,height:740});
 await page.locator('#chat .ncs-inline-open').click();await page.locator('#ncs-viewer[open]').waitFor();
 await page.waitForFunction(()=>/640 × 960/.test(document.querySelector('#ncs-viewer .ncsv-meta').textContent));
 const geo=await page.locator('#ncs-viewer').evaluate(v=>({w:v.scrollWidth,cw:v.clientWidth,bar:v.querySelector('.ncsv-bar').getBoundingClientRect().height,right:Math.max(...[...v.querySelectorAll('button,a')].map(b=>b.getBoundingClientRect().right))}));
 assert.ok(geo.w<=geo.cw+1 && geo.right<=375,'toolbar fits 375px');assert.ok(geo.bar<120,'toolbar at most two rows');
 const pinchBefore=parseInt(await zoom());
 await page.locator('#ncs-viewer .ncsv-stage').evaluate(stage=>{
  const r=stage.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const ev=(type,id,x)=>stage.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:cy,bubbles:true,isPrimary:id===1}));
  ev('pointerdown',1,cx-20);ev('pointerdown',2,cx+20);ev('pointermove',1,cx-60);ev('pointermove',2,cx+60);ev('pointerup',1,cx-60);ev('pointerup',2,cx+60);
 });
 assert.ok(parseInt(await zoom())>pinchBefore*2.5,'pinch out zooms in');
 await fs.mkdir(path.join(root,'test-output'),{recursive:true});await page.screenshot({path:path.join(root,'test-output','viewer-mobile.png')});
 await page.locator('#ncs-viewer [data-v="close"]').click();
 assert.deepEqual(errors,[]);
 console.log('PASS: extraction progress banner + cancel, generation banner, viewer fit/original/zoom/pan/pinch/save from result, history and chat, 375px toolbar');
}finally{await browser.close();server.close();}
