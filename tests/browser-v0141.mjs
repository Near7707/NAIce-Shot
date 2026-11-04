// Stage one: compact actions, shared prompt viewer and message-scoped attachment removal.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {pick,reveal} from './menu-helper.mjs';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (~c)>>>0;};
const chunk=(t,data)=>{const name=Buffer.from(t),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,data])),out.length-4);return out;};
const w=400,h=300,ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
const pixels=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;pixels[o]=70;pixels[o+1]=110+x%100;pixels[o+2]=170;}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
const fontRoot=process.env.NAICE_TEST_FONTS;
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/naice-shot/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 if(fontRoot&&rel.startsWith('/test-font/')){const f=path.join(fontRoot,rel.slice(11));if(!f.startsWith(fontRoot+'/'))throw Error();res.setHeader('Content-Type',f.endsWith('.css')?'text/css':'font/woff2');res.end(await fs.readFile(f));return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/'))throw Error();
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
try{
 for(const width of [1100,375]){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(9000);
  const entries=new Map(),errors=[],history=[];let writes=0,deleteFails=false,saveBefore=null,saveAfter=null,held=0,order=[],failed=false,revision=0,accept=true,slowRead=null,genFails=false,genWait=null;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>accept?d.accept():d.dismiss());
  await page.route('**/api/plugins/naice-shot/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/status'))return route.fulfill({json:{keyConfigured:true,version:'0.1.11',features:['paged-history','delete','private-records','all-history','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone'],subscription:{tier:3,perks:{unlimitedImageGeneration:true}}}});
   if(u.pathname.endsWith('/draft')){
    if(route.request().method()==='GET'){const key=u.searchParams.get('chatKey');if(slowRead&&key.includes('B'))await slowRead;return route.fulfill({json:entries.get(key)??{revision:null,work:null}});}
    const b=route.request().postDataJSON();if(failed)return route.fulfill({status:500,json:{error:'mock save failed'}});
    if(b.delete&&deleteFails)return route.fulfill({status:500,json:{error:'mock delete failed'}});
    if(b.delete&&b.all){order.push('delete-all');let n=0;for(const [k,v] of entries){if(v.work)n++;entries.set(k,{revision:String(++revision),work:null});}return route.fulfill({json:{deleted:n}});}
    if(saveBefore){held++;await saveBefore;held--;}
    const old=entries.get(b.chatKey);if((old?.revision??null)!==b.expectedRevision)return route.fulfill({status:409,json:{error:'다른 창이나 기기에서 작업이 바뀌었어요.'}});
    const r=String(++revision);entries.set(b.chatKey,{revision:r,work:b.work});writes++;order.push('save');if(saveAfter){held++;await saveAfter;held--;}return route.fulfill({json:{revision:r}});
   }
   if(u.pathname.endsWith('/delete')){if(deleteFails)return route.fulfill({status:500,json:{error:'mock delete failed'}});const b=route.request().postDataJSON();const gone=history.filter(h=>h.chatKey===b.chatKey).map(h=>h.id);history.splice(0,history.length,...history.filter(h=>h.chatKey!==b.chatKey));const had=!!entries.get(b.chatKey)?.work;if(entries.has(b.chatKey))entries.set(b.chatKey,{revision:String(++revision),work:null});return route.fulfill({json:{deleted:gone,skipped:[],workDeleted:had}});}
   if(u.pathname.endsWith('/history')){const all=u.searchParams.get('scope')==='all',only=u.searchParams.get('chatKey'),items=history.filter(h=>all?(!only||h.chatKey===only):h.chatKey===only);
    const chats=[...new Set(history.map(h=>h.chatKey))].map(chatKey=>({chatKey,count:history.filter(h=>h.chatKey===chatKey).length,latest:''}));
    return route.fulfill({json:{items,total:items.length,hasMore:false,...(all?{scope:'all',chats,imageCount:history.length,bytes:1}:{})}});}
   if(u.pathname.endsWith('/generate')){if(genWait)await genWait;if(genFails)return route.fulfill({status:500,json:{error:'mock generation failed'}});const b=route.request().postDataJSON();return route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});}
   throw Error('Unexpected API '+u.pathname);
  });
  const open=async()=>{await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);};
  const saved=async()=>{await page.waitForFunction(()=>document.querySelector('#ncs-draft-status').textContent==='마지막 작업을 서버에 기억해요.'||/작업하던 장면을 불러왔어요/.test(document.querySelector('#ncs-draft-status').textContent));};
  const value=()=>page.locator('#ncs-location').inputValue();
  const stored=()=>[...entries.values()].filter(v=>v.work).length,hasWork=k=>!!entries.get(k)?.work;
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await open();
  assert.equal(await page.locator('[data-tab="scene"]').innerText(),'그리기');
  await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
  await page.locator('#ncs-location').fill('A edited cafe');await saved();
  await page.waitForFunction(()=>document.querySelector('#ncs-draft-status').textContent!=='마지막 작업 저장 중…');
  // Flush through close before leaving, without waiting for the debounce.
  await page.locator('[data-action="close"]').click();await page.waitForTimeout(100);
  await page.evaluate(()=>mock.switchChat('B'));await page.locator('.ncs-launch-button').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  assert.equal(await value(),'');await page.locator('#ncs-location').fill('B river');
  await page.evaluate(()=>mock.switchChat('A'));await page.waitForFunction(()=>document.querySelector('#ncs-location').value==='A edited cafe');
  assert.match(await page.locator('#ncs-draft-status').innerText(),/원문이나 리롤/);
  // Cancelling an in-flight extraction while switching must not save A's work into a loaded B cache.
  await page.evaluate(()=>{mock.extractionDeferred=new Promise(r=>{window.finishExtraction=r;});});await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-progress').hidden);
  await page.evaluate(()=>mock.switchChat('B'));await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);assert.equal(await value(),'B river');
  await page.evaluate(()=>{finishExtraction(JSON.stringify(mock.extraction));delete mock.extractionDeferred;mock.switchChat('A');});await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);assert.equal(await value(),'A edited cafe');
  // Last work survives refresh; no new extraction call is made.
  await page.reload();await open();assert.equal(await value(),'A edited cafe');assert.match(await page.locator('#ncs-draft-status').innerText(),/^이 채팅에서 작업하던 장면을 불러왔어요 · 대상 메시지/);assert.equal(await page.evaluate(()=>mock.extractCalls??0),0);
  assert.equal([...entries.values()].some(e=>e.work.raw),false,'raw off stays off in persisted drafts');
  // One clear undo is stored with the empty draft and survives a different chat and refresh.
  await page.locator('[data-action="blank"]').first().click();await page.evaluate(()=>mock.switchChat('B'));await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  await page.evaluate(()=>mock.switchChat('A'));await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  assert.equal(await value(),'');assert.equal(await page.locator('.ncs-clear-slot .ncs-action-slot').innerText(),'↶ 비우기 취소');
  await page.reload();await open();assert.equal(await page.locator('.ncs-clear-slot .ncs-action-slot').innerText(),'↶ 비우기 취소');await page.locator('[data-action="undo-clear"]').click();assert.equal(await value(),'A edited cafe');
  // Free work has a separate bucket and does not follow the chat.
  await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  await page.locator('#ncs-free-text').fill('A quiet garden');await page.locator('#ncs-location').fill('free garden');
  await page.evaluate(()=>mock.switchChat('B'));assert.equal(await value(),'free garden');
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);assert.equal(await value(),'B river');
  await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);assert.equal(await page.locator('#ncs-free-text').inputValue(),'A quiet garden');
  // A failed save keeps editable work and retries the same bucket.
  failed=true;await page.locator('#ncs-location').fill('unsaved garden');await page.waitForFunction(()=>document.querySelector('#ncs-draft-status').textContent.includes('mock save failed'));
  assert.equal(await value(),'unsaved garden');failed=false;await page.locator('#ncs-draft-retry').click();await saved();
  // A concurrent writer is never overwritten automatically.
  const freeKey=JSON.stringify({free:true});entries.set(freeKey,{...entries.get(freeKey),revision:'external'});
  await page.locator('#ncs-location').fill('local conflict');await page.waitForFunction(()=>document.querySelector('#ncs-draft-status').textContent.includes('다른 창'));
  assert.equal(await value(),'local conflict');assert.equal(entries.get(freeKey).work.scene.location,'unsaved garden');
  accept=false;await page.locator('#ncs-draft-retry').click();assert.equal(await value(),'local conflict');accept=true;await page.locator('#ncs-draft-retry').click();await page.waitForFunction(()=>document.querySelector('#ncs-location').value==='unsaved garden');
  // Restored one-off options survive failed generation, but success consumes them before refresh.
  const historyId='22222222-2222-4222-8222-222222222222';history.push({id:historyId,created:new Date().toISOString(),chatKey:freeKey,image:`/user/images/naice-shot/${historyId}.png`,seed:777,assembled:{base:'history garden',negative:'',characters:[],warnings:[]},options:{model:'nai-diffusion-4-5-full',width:832,height:1216,steps:17,scale:4,cfgRescale:0,sampler:'k_euler',scheduler:'karras',seed:777},snapshot:{scene:{characters:[],location:'history garden'}}});
  await page.locator('[data-tab="history"]').click();await page.locator('#ncs-history-scope').selectOption('free');await pick(page,'[data-history-free]');
  assert.match(await page.locator('#ncs-gen-scope').innerText(),/이력/);
  genFails=true;await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent.includes('mock generation failed'));assert.match(await page.locator('#ncs-gen-scope').innerText(),/이력/);
  genFails=false;await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent.startsWith('생성했어요'));assert.doesNotMatch(await page.locator('#ncs-gen-scope').innerText(),/이력/);
  await page.locator('[data-action="close"]').click();await page.reload();await open();await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);assert.doesNotMatch(await page.locator('#ncs-gen-scope').innerText(),/이력/);
  // Old delayed reads cannot replace a newer chat.
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  let release;slowRead=new Promise(r=>release=r);await page.evaluate(()=>mock.switchChat('B-new'));await page.evaluate(()=>mock.switchChat('A'));release();slowRead=null;await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);assert.equal(await value(),'A edited cafe');
  // Completion after leaving a chat consumes only that chat's one-off override.
  history.push({...history[0],id:'44444444-4444-4444-8444-444444444444',image:'/user/images/naice-shot/44444444-4444-4444-8444-444444444444.png',chatKey:JSON.stringify({group:null,card:'Leo.png',chat:'A'})});
  await page.locator('[data-tab="history"]').click();await page.locator('#ncs-history-scope').selectOption('chat');await pick(page,'[data-history-id]');
  let finishGeneration;genWait=new Promise(r=>finishGeneration=r);await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-progress').hidden);
  await page.evaluate(()=>mock.switchChat('B'));await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);assert.equal(await value(),'B river');
  finishGeneration();genWait=null;await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden);assert.equal(await value(),'B river');
  await page.evaluate(()=>mock.switchChat('A'));await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);assert.doesNotMatch(await page.locator('#ncs-gen-scope').innerText(),/이력/);
  await page.locator('[data-tab="settings"]').click();await page.locator('.ncs-advanced > summary').click();accept=false;await page.locator('#ncs-retain-raw').click();assert.equal(await page.locator('#ncs-retain-raw').isChecked(),false);
  accept=true;await page.locator('#ncs-retain-raw').check();assert.match(await page.locator('#ncs-retain-state').innerText(),/켜짐/);await page.locator('#ncs-retain-raw').uncheck();
  // Saved work can be deleted: all at once from settings, or with a chat's whole history.
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await page.waitForFunction(()=>/저장된 작업 \d+개를 지웠어요/.test(document.querySelector('#ncs-notice').textContent));
  await page.waitForTimeout(1200);assert.equal(stored(),0,'nothing is saved straight back');await page.locator('[data-tab="scene"]').click();assert.equal(await value(),'');
  await page.locator('#ncs-location').fill('fresh start');await saved();assert.equal(stored(),1,'a new save on the deletion marker is accepted');
  await page.locator('[data-tab="history"]').click();await page.locator('[data-action="delete-chat-history"]').click();
  await page.waitForFunction(()=>document.querySelector('#ncs-location').value==='');await page.waitForTimeout(1200);assert.equal(stored(),0,'chat history deletion forgets that chat\'s work');
  // A save still on its way when everything is deleted: deletion waits for it, so nothing comes back.
  const waitHeld=async()=>{for(let i=0;i<60&&!held;i++)await page.waitForTimeout(100);assert.equal(held,1,'a save is on its way');};
  await page.locator('[data-tab="scene"]').click();let releaseSave;saveBefore=new Promise(r=>releaseSave=r);
  await page.locator('#ncs-location').fill('sent before delete');await waitHeld();
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();await page.waitForTimeout(400);
  assert.notEqual(order.at(-1),'delete-all','deletion waits for the save already sent');releaseSave();saveBefore=null;
  await page.waitForFunction(()=>/저장된 작업 \d+개를 지웠어요/.test(document.querySelector('#ncs-notice').textContent));
  assert.deepEqual(order.slice(-2),['save','delete-all']);assert.equal(stored(),0);
  await page.reload();await open();assert.equal(await value(),'','deleted work does not come back after refresh');
  // A save whose reply arrives late: the next edit after deletion still saves without a conflict.
  saveAfter=new Promise(r=>releaseSave=r);await page.locator('#ncs-location').fill('reply comes late');await waitHeld();
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();await page.waitForTimeout(400);releaseSave();saveAfter=null;
  await page.waitForFunction(()=>/저장된 작업 \d+개를 지웠어요/.test(document.querySelector('#ncs-notice').textContent));assert.equal(stored(),0);
  await page.locator('[data-tab="scene"]').click();await page.locator('#ncs-location').fill('after delete');await saved();
  assert.ok([...entries.values()].some(v=>v.work?.scene.location==='after delete'),'saved without a conflict');
  // A deletion that fails keeps the edit that was waiting to be saved, and saves it afterwards.
  const savedPlace=p=>[...entries.values()].some(v=>v.work?.scene.location===p);
  deleteFails=true;await page.locator('#ncs-location').fill('kept edit');
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await page.waitForFunction(()=>/삭제하지 못했어요\. 작업은 그대로예요/.test(document.querySelector('#ncs-notice').textContent));
  await page.waitForFunction(()=>document.querySelector('#ncs-draft-status').textContent==='마지막 작업을 서버에 기억해요.');assert.ok(savedPlace('kept edit'),'the held edit is saved after the failure');
  await page.locator('[data-tab="scene"]').click();await page.locator('#ncs-location').fill('kept history edit');
  history.push({id:historyId,chatKey:JSON.stringify({group:null,card:'Leo.png',chat:'A'}),image:`/user/images/naice-shot/${historyId}.png`,created:new Date().toISOString()});
  await page.locator('[data-tab="history"]').click();await page.locator('[data-action="delete-chat-history"]').click();
  await page.waitForFunction(()=>/삭제하지 못했어요/.test(document.querySelector('#ncs-notice').textContent));
  await page.waitForFunction(()=>document.querySelector('#ncs-draft-status').textContent==='마지막 작업을 서버에 기억해요.');assert.ok(savedPlace('kept history edit'));deleteFails=false;
  await page.reload();await open();assert.equal(await value(),'kept history edit','nothing was lost');
  // A chat with images but no saved work yet: deleting its history still empties the drawing window.
  await page.evaluate(()=>mock.switchChat('C'));await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  history.push({id:historyId,chatKey:JSON.stringify({group:null,card:'Leo.png',chat:'C'}),image:`/user/images/naice-shot/${historyId}.png`,created:new Date().toISOString()});
  await page.locator('#ncs-location').fill('unsaved C');await page.locator('[data-tab="history"]').click();await page.locator('[data-action="delete-chat-history"]').click();
  await page.waitForFunction(()=>document.querySelector('#ncs-location').value==='');await page.waitForTimeout(1200);assert.equal(savedPlace('unsaved C'),false);
  await page.locator('[data-tab="scene"]').click();await page.evaluate(()=>mock.switchChat('A'));await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  // 프리샷 work waiting off screen is emptied when its history is deleted from 챗샷.
  await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  await page.locator('#ncs-free-text').fill('Leftover garden text');await page.locator('#ncs-location').fill('leftover');await saved();assert.ok(hasWork(freeKey));
  const freeImage='33333333-3333-4333-8333-333333333333';history.push({id:freeImage,created:new Date().toISOString(),chatKey:freeKey,image:`/user/images/naice-shot/${freeImage}.png`,seed:5,assembled:{base:'x',negative:'',characters:[],warnings:[]},options:{model:'nai-diffusion-4-5-full',width:832,height:1216,steps:28,scale:5,seed:5,cfgRescale:0,sampler:'k_euler'},snapshot:{scene:{location:'x'}}});
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  await page.locator('[data-tab="history"]').click();await page.locator('#ncs-history-scope').selectOption('all');
  await page.waitForFunction(k=>[...document.querySelectorAll('#ncs-history-filter option')].some(o=>o.value===k),freeKey);await page.locator('#ncs-history-filter').selectOption(freeKey);
  await page.locator('[data-action="delete-filter-chat"]').click();await page.waitForFunction(()=>/삭제했어요/.test(document.querySelector('#ncs-notice').textContent));
  assert.equal(hasWork(freeKey),false);
  await page.locator('[data-tab="scene"]').click();await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  assert.equal(await page.locator('#ncs-free-text').inputValue(),'');assert.equal(await value(),'');
  await page.waitForTimeout(1200);assert.equal(hasWork(freeKey),false,'nothing comes back and no empty work is saved');
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  // Saving uses one small menu: 클린 / 원본 with notes, no extra warning and no "don't ask again".
  await page.locator('[data-action="close"]').click();
  const id='11111111-1111-4111-8111-111111111111';
  // Use a genuine result-shaped image viewer through the inline UI; attachment signatures are required.
  await page.evaluate(async id=>{const {attachInlineImage}=await import('/inline-images.mjs');await attachInlineImage(mock,{id,chatKey:JSON.stringify({group:null,card:'Leo.png',chat:'A'}),image:`/user/images/naice-shot/${id}.png`},{targetIndex:0});mock.emit('received');},id);
  await page.locator('#chat .ncs-inline-open').first().click();const toggle=page.locator('#ncs-viewer [data-v="save-menu"]');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  const menu=page.locator('.ncsv-save-menu');assert.deepEqual((await menu.locator('button,a').allInnerTexts()).map(t=>t.split('\n')[0]),['클린 PNG','원본 PNG']);
  assert.equal(await menu.locator('text=다시 묻지').count(),0);assert.equal(await menu.locator('text=취소').count(),0);
  await page.keyboard.press('Escape');assert.equal(await menu.isHidden(),true);assert.equal(await page.locator('#ncs-viewer').isVisible(),true,'Escape closes only the menu');
  await toggle.click();await page.locator('#ncs-viewer .ncsv-tools').click({position:{x:3,y:3}});assert.equal(await menu.isHidden(),true,'a click outside closes it');
  await toggle.click();await toggle.click();assert.equal(await menu.isHidden(),true,'the button folds it again');
  if(fontRoot){await page.addStyleTag({content:'@import url("/test-font/400.css"); body {font-family:"Noto Sans KR",sans-serif}'});await page.evaluate(()=>document.fonts.ready);await toggle.click();await page.screenshot({path:`/tmp/naice-save-menu-${width}.png`});await toggle.click();}
  await toggle.click();const cleanDownload=page.waitForEvent('download');await menu.locator('[data-v="clean"]').click();assert.match((await cleanDownload).suggestedFilename(),/-clean\.png$/);assert.equal(await menu.isHidden(),true);
  await toggle.click();const download=page.waitForEvent('download');await menu.locator('.ncsv-save').click();assert.match((await download).suggestedFilename(),/\.png$/);
  assert.equal(await page.locator('#ncs-privacy-dialog').count(),0,'no extra warning for 원본');
  await page.locator('#ncs-viewer [data-v="close"]').click();
  assert.ok(writes>5);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: per-chat and free drafts, refresh restore without AI, persistent clear undo, failed saves/retry, conflict refusal, stale reads, raw consent, deletion while a save is on its way or its reply is late, 프리샷 work waiting off screen, the two-choice save menu without extra warnings, 1100/375px');
}finally{await browser.close();server.close();}
