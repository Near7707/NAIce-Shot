// Neutral browser fixtures cover imports, clothing undo, collapsed range choice and paged viewer navigation.
import http from 'node:http';
import {deflateSync} from 'node:zlib';
import {crc32} from '../zip.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {pick} from './menu-helper.mjs';
const {chromium}=await import(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright/index.mjs`);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const chunk=(type,data)=>{const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);};
const header=Buffer.alloc(13);header.writeUInt32BE(832,0);header.writeUInt32BE(1216,4);header[8]=8;header[9]=2;
const fontRoot=process.env.NAICE_TEST_FONTS;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((832*3+1)*1216,0))),chunk('IEND',Buffer.alloc(0))]);
const host=http.createServer(async(req,res)=>{try{const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/naice-shot/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 if(fontRoot&&rel.startsWith('/test-font/')){const f=path.join(fontRoot,rel.slice(11));if(!f.startsWith(fontRoot+'/'))throw Error();res.setHeader('Content-Type',f.endsWith('.css')?'text/css':'font/woff2');res.end(await fs.readFile(f));return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>host.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const width of [1100,375,320]){
 const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<600});page.setDefaultTimeout(8000);const errors=[],generated=[],deleted=[],requests=[],drafts=new Map();page.on('pageerror',e=>errors.push(e.message));let accept=true;page.on('dialog',d=>accept?d.accept():d.dismiss());
 const key=JSON.stringify({group:null,card:'Leo.png',chat:'A'}),other=JSON.stringify({group:null,card:'Leo.png',chat:'Z'}),free=JSON.stringify({free:true});
 const options={model:'nai-diffusion-4-5-full',width:832,height:1216,steps:28,scale:5,cfgRescale:0,sampler:'k_euler_ancestral',scheduler:'karras',seed:10};
 let items=Array.from({length:47},(_,i)=>{const id=`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;return {id,chatKey:i%3===0?free:i%3===1?key:other,created:new Date(1800000000000-i*1000).toISOString(),seed:i+10,options:{...options,seed:i+10},image:`/user/images/naice-shot/${id}.png`,assembled:{base:`place ${i}`,negative:'',characters:[]},snapshot:{scene:{characters:[],location:`place ${i}`,lighting:'',camera:'',interaction:'',source:{target:0,fingerprints:[{index:0,signature:'old',swipeId:0}]}},...(i%3===0?{freeText:`Free scene ${i}`}:{})}};});
 const originals=structuredClone(items);let heldDraft=null,releaseDraft=null,heldPage=false,releasePage=null,failPage=false;
 await page.route('**/api/plugins/naice-shot/**',async route=>{const u=new URL(route.request().url()),b=route.request().method()==='POST'?route.request().postDataJSON():null;
  if(u.pathname.endsWith('/status'))return route.fulfill({json:{version:'0.1.13',keyConfigured:true,features:['paged-history','all-history','history-kinds','delete','private-records','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes'],subscription:{tier:3,perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});
  if(u.pathname.endsWith('/draft')){if(b){drafts.set(b.chatKey,b.work);return route.fulfill({json:{revision:'r'}});}if(u.searchParams.get('chatKey')===heldDraft){await new Promise(r=>releaseDraft=r);heldDraft=null;}return route.fulfill({json:{revision:null,work:drafts.get(u.searchParams.get('chatKey'))??null}});}
  if(u.pathname.endsWith('/generate')){generated.push(b);const id=b.requestId;return route.fulfill({json:{...b,id,image:`/user/images/naice-shot/${id}.png`,seed:b.options.seed,created:new Date().toISOString()}});}
  if(u.pathname.endsWith('/delete')){deleted.push(b);const gone=items.filter(x=>x.chatKey===b.chatKey&&(b.ids==='all'||b.ids?.includes(x.id))).map(x=>x.id);items=items.filter(x=>!gone.includes(x.id));return route.fulfill({json:{deleted:gone,skipped:[]}});}
  if(u.pathname.endsWith('/history')){const all=u.searchParams.get('scope')==='all',kind=u.searchParams.get('kind'),chat=u.searchParams.get('chatKey'),offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||20);requests.push({all,kind,chat,offset});
   if(offset&&heldPage)await new Promise(r=>releasePage=r);
   if(offset&&failPage)return route.fulfill({status:500,json:{error:'Page unavailable'}});
   const every=items.filter(x=>kind!=='chat'||x.chatKey!==free),filtered=every.filter(x=>all?(!chat||x.chatKey===chat):x.chatKey===chat);
   return route.fulfill({json:{items:filtered.slice(offset,offset+limit),total:filtered.length,hasMore:offset+limit<filtered.length,...(all?{scope:'all',kind:kind==='chat'?'chat':'all',chats:[...new Set(every.map(x=>x.chatKey))].map(chatKey=>({chatKey,count:every.filter(x=>x.chatKey===chatKey).length})),imageCount:every.length,bytes:1000}:{})}});}
  throw Error('Unexpected request '+u.pathname);
 });
 await page.goto(`http://127.0.0.1:${host.address().port}/`);await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();if(fontRoot){await page.addStyleTag({content:'@import url("/test-font/400.css"); @import url("/test-font/700.css"); body {font-family:"Noto Sans KR",sans-serif}'});await page.evaluate(()=>document.fonts.ready);}
 const tab=async name=>page.locator(`[data-tab="${name}"]`).click(),action=async name=>page.locator(`[data-action="${name}"]`).click();
 const idle=()=>page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled&&document.querySelector('#ncs-progress').hidden);
 const range=async name=>{await page.locator('#ncs-history-scope').selectOption(name);await page.waitForFunction(()=>!document.querySelector('[data-action="history-more"]').disabled);};
 const card=page.locator('[data-character="leo"]'),once=card.locator('[data-field="manualOutfit"]');
 // Stepper association and momentary touch feedback, without focusing the numeric keyboard.
 assert.equal(await page.locator('.ncs-number-stepper').evaluate(e=>!!e.closest('label')),false);
 await page.locator('#ncs-recent').fill('1');await action('recent-more');await action('recent-less');assert.equal(await page.locator('#ncs-recent').inputValue(),'1');assert.equal(await page.evaluate(()=>document.activeElement?.id==='ncs-recent'),false);
 assert.match(await page.locator('#ncs-recent-help').innerText(),/^보낼 메시지 수가 1이면/);assert.equal(await page.locator('#ncs-recent').getAttribute('aria-describedby'),'ncs-recent-help');
 assert.match(await page.locator('.ncs-review-reminder').innerText(),/부정확할 수 있어요/);
 // Reproduce the reported operation, then verify chat restoration separately from this-image reset.
 await action('extract');await card.waitFor();await idle();await once.fill('hoodie');await card.locator('[data-save-outfit]').click();await idle();await card.locator('[data-lock]').check();await idle();
 await card.locator('[data-save-outfit]').click();await idle();assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.outfits.leo.value),undefined);
 await card.locator('[data-undo-chat-outfit]').click();await idle();assert.equal(await once.inputValue(),'hoodie');assert.deepEqual(await page.evaluate(()=>[mock.chatMetadata.naice_shot.outfits.leo.value,mock.chatMetadata.naice_shot.outfits.leo.locked]),['hoodie',true]);
 await once.fill('raincoat');await card.locator('[data-reset-outfit]').click();assert.equal(await once.inputValue(),'hoodie');
 await card.locator('[data-lock]').uncheck();await idle();await card.locator('[data-default-outfit]').click();assert.equal(await once.inputValue(),'hoodie');assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.outfits.leo.value),'hoodie');
 // A failed metadata save restores the exact state and remains usable.
 await page.evaluate(()=>{mock.normalSave=mock.saveMetadata;mock.saveMetadata=async()=>{throw Error('mock failure');};});
 await card.locator('[data-save-outfit]').click();await idle();assert.match(await page.locator('#ncs-notice').innerText(),/저장하지 못했어요/);assert.equal(await once.inputValue(),'hoodie');assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.outfits.leo.value),'hoodie');await page.evaluate(()=>mock.saveMetadata=mock.normalSave);
 await card.locator('[data-save-outfit]').click();await idle();await card.locator('[data-undo-chat-outfit]').waitFor();
 if(process.env.NAICE_SCREENSHOT_DIR){await once.scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.NAICE_SCREENSHOT_DIR}/outfit-${width}.png`});}
 // Save completion after a chat switch cannot repaint or write into the new chat.
 await page.evaluate(()=>{mock.saveMetadata=()=>new Promise(r=>mock.finishMetadata=r);});
 await card.locator('[data-undo-chat-outfit]').click();await page.waitForFunction(()=>document.querySelector('#ncs-work-fields').disabled);
 await page.evaluate(()=>{mock.switchChat('B');mock.finishMetadata();mock.saveMetadata=mock.normalSave;});await idle();
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot?.outfits?.leo),undefined);
 
 await page.evaluate(()=>mock.switchChat('B'));await idle();assert.equal(await page.locator('[data-undo-chat-outfit]').count(),0);assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot?.outfits?.leo),undefined);
 // Establish a current-chat target and work before importing a foreign picture.
 await page.evaluate(()=>mock.switchChat('A'));await idle();await page.locator('#ncs-location').fill('my draft');await page.locator('#ncs-target-picker > summary').click();await page.locator('[data-message-index="0"]').click();
 await tab('history');await range('all');assert.equal(await page.locator('#ncs-history-scope').inputValue(),'all');assert.equal(await page.locator('[data-history-scope]').count(),0);
 const foreign=originals[2];await pick(page,`[data-history-id="${foreign.id}"]`);assert.match(await page.locator('#ncs-notice').innerText(),/다른 채팅의 그림/);assert.equal(await page.locator('#ncs-target').inputValue(),'');assert.equal(await page.locator('#ncs-location').inputValue(),'place 2');assert.equal(generated.length,0);
 await action('undo-clear');assert.equal(await page.locator('#ncs-location').inputValue(),'my draft');assert.equal(await page.locator('#ncs-target').inputValue(),'0');
 await tab('history');await pick(page,`[data-history-id="${foreign.id}"]`);await page.evaluate(()=>{mock.chatMetadata.naice_shot??={};mock.chatMetadata.naice_shot.skipMissingWarning=true;});await action('generate');await page.waitForFunction(()=>document.querySelector('#ncs-result img'));await idle();assert.equal(generated.at(-1).chatKey,key);assert.equal(generated.at(-1).snapshot.scene.source,null);assert.equal(originals[2].chatKey,other);assert.equal(originals[2].snapshot.scene.source.target,0);
 // Free destination works with no open chat; chat destination clearly explains why it is unavailable.
 await tab('history');await pick(page,`[data-history-free="${foreign.id}"]`);assert.equal(await page.locator('[data-mode="free"]').getAttribute('aria-pressed'),'true');await idle();
 await page.evaluate(()=>{mock.chatId=null;mock.emit('chat');});await tab('history');await range('all');await pick(page,`.ncs-history-card:first-child [data-image-more]:not(.ncs-save-toggle)`); // menu is directly clickable
 assert.equal(await page.locator('.ncs-image-popup:visible [data-history-id]').isDisabled(),true);assert.match(await page.locator('.ncs-image-popup:visible [data-history-id]').innerText(),/채팅을 먼저/);await page.keyboard.press('Escape');
 await pick(page,`[data-history-free="${foreign.id}"]`);assert.equal(await page.locator('#ncs-location').inputValue(),'place 2');
 // Gallery follows the selected chat filter and its server order, including the full total.
 await tab('history');await range('all');await page.locator('#ncs-history-filter').selectOption(other);await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length===15);
 await page.locator('[data-view-history]').first().click();await page.locator('.ncsv-stage img').waitFor();assert.equal(await page.locator('.ncsv-position').innerText(),'1 / 15');assert.equal(await page.locator('[data-v="previous"]').isDisabled(),true);
 await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.ncsv-position').innerText(),'2 / 15');assert.match(await page.locator('.ncsv-seed').innerText(),/seed 15/);await page.locator('.ncsv-prompt > summary').click();await page.waitForFunction(()=>document.querySelector('.ncsv-prompt-text').textContent.includes('place 5'));
 await page.locator('[data-v="close"]').click();await range('all');
 // One next-page request, pending repeated navigation, and safe pagination failure/retry.
 heldPage=true;await page.locator('[data-view-history]').nth(19).click();await page.waitForFunction(()=>document.querySelector('.ncsv-stage img').complete);while(!releasePage)await page.waitForTimeout(20);
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');assert.match(await page.locator('.ncsv-position').innerText(),/^20 \/ 47/);assert.equal(requests.filter(r=>r.offset===20&&r.all&&!r.chat).length,1);
 heldPage=false;releasePage();await page.waitForFunction(()=>document.querySelector('.ncsv-position').textContent==='21 / 47');assert.match(await page.locator('.ncsv-seed').innerText(),/seed 30/);
 // Touch swipes only navigate at fit. Pinch (including the remaining pointer) and zoomed pans never navigate.
 const swipe=async({pinch=false}={})=>page.locator('.ncsv-stage').evaluate((e,pinch)=>{const r=e.getBoundingClientRect(),y=r.top+r.height/2,x=r.left+r.width*.8;
  const send=(type,id,x,y)=>e.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0}));
  send('pointerdown',1,x,y);if(pinch){send('pointerdown',2,x-60,y);send('pointermove',2,x-100,y);send('pointerup',2,x-100,y);}send('pointermove',1,x-140,y);send('pointerup',1,x-140,y);},pinch);
 await page.locator('[data-v="fit"]').click();await swipe();await page.waitForFunction(()=>document.querySelector('.ncsv-position').textContent==='22 / 47');
 await page.locator('[data-v="in"]').click();await swipe();assert.equal(await page.locator('.ncsv-position').innerText(),'22 / 47');await page.locator('[data-v="fit"]').click();await swipe({pinch:true});assert.equal(await page.locator('.ncsv-position').innerText(),'22 / 47');
 // Delete cancel keeps the image; successful delete keeps the gallery open on the adjacent image.
 accept=false;await page.locator('[data-v="delete"]').click();assert.equal(deleted.length,0);accept=true;await page.locator('[data-v="delete"]').click();await page.waitForFunction(()=>document.querySelector('.ncsv-position').textContent==='22 / 46');assert.equal(deleted.at(-1).ids[0],originals[21].id);assert.match(await page.locator('.ncsv-seed').innerText(),/seed 32/);
 // Failed pagination leaves the current picture usable; retry keeps order and reaches the final boundary.
 failPage=true;
 for(let i=0;i<17;i++)await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.ncsv-position').textContent==='39 / 46');await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('.ncsv-meta').textContent==='Page unavailable');assert.equal(await page.locator('.ncsv-position').innerText(),'39 / 46');
 failPage=false;await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.ncsv-position').textContent==='40 / 46');
 for(let i=0;i<6;i++)await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('.ncsv-position').innerText(),'46 / 46');assert.equal(await page.locator('[data-v="next"]').isDisabled(),true);assert.match(await page.locator('.ncsv-seed').innerText(),/seed 56/);
 await page.waitForFunction(()=>document.querySelector('.ncsv-meta').textContent.includes('832 × 1216'));if(process.env.NAICE_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NAICE_SCREENSHOT_DIR}/viewer-${width}.png`});
 await page.locator('[data-v="close"]').click();await tab('scene');await page.locator('#ncs-result .ncs-image-open').click();assert.equal(await page.locator('.ncsv-navigation').isHidden(),true,'result previews stay single-image');await page.locator('[data-v="close"]').click();
 await tab('settings');assert.match(await page.locator('#ncs-delete-work-box').innerText(),/모든 채팅과 프리샷의 작성 중인 작업을 삭제해요/);await tab('scene');assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 if(process.env.NAICE_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.NAICE_SCREENSHOT_DIR}/drawing-${width}.png`});
 // A delayed destination draft must not apply an import after the user changes chats.
 drafts.delete(free);heldDraft=free;releaseDraft=null;await page.reload();await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();await idle();
 await tab('history');await range('all');await pick(page,`[data-history-free="${originals[5].id}"]`);
 while(!releaseDraft)await page.waitForTimeout(20);await page.evaluate(()=>mock.switchChat('B'));releaseDraft();await idle();await tab('scene');
 assert.notEqual(await page.locator('#ncs-location').inputValue(),'place 5');assert.equal(await page.locator('#ncs-result img').count(),0);
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS v0.1.48 ${width}px: clothes clear/undo/reset/failure/chat switch, cross-chat import/source/target/undo, no-chat free import, range/filter, paged gallery/keyboard/swipe/pinch/delete, help/stepper`);
}}finally{await browser.close();await new Promise(r=>host.close(r));}
