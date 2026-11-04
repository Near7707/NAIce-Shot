// v0.1.57 다듬기: preset save box with selection-based buttons, "이 복장을" row and folded lock help, editable fixed
// look with [프로필 업데이트] (asks, one undo), 「추출 AI 응답 원문 추가 보관」 wording, (the 640px PC column became full width in 0.1.58),
// [모두 선택] ↔ [모두 해제], chat menus in the theme's colours, folded history notes and "↻ 새로고침".
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/naice-shot/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep))throw Error();
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const features=['paged-history','delete','private-records','all-history','history-kinds','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes'];
async function open(width,{cardName,skin}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
 if(skin)await page.addInitScript(k=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.skin=k;}),skin);
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 return {page,errors};
}
const idle=page=>page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden);
try{
 for(const width of [320,375,1100]){
  const {page,errors}=await open(width);const tag=`${width}px`;let answer=true;page.removeAllListeners('dialog');page.on('dialog',d=>answer?d.accept():d.dismiss());
  // ---- Settings: preset save box
  await page.locator('[data-tab="settings"]').click();
  const over=page.locator('[data-action="save-preset"]'),as=page.locator('[data-action="save-preset-as"]'),del=page.locator('[data-action="delete-preset"]');
  assert.equal(await page.locator('.ncs-preset-savebox #ncs-common-preset-name').count(),1,'save box holds the name');
  assert.equal(await over.isVisible(),false);assert.equal(await del.isVisible(),false);assert.equal(await as.evaluate(b=>b.classList.contains('ncs-primary')),true);
  const y=async id=>Math.round((await page.locator('#'+id).boundingBox()).y);
  assert.equal(await y('ncs-model'),await y('ncs-size-preset'),`${tag}: model and size share a row`);assert.equal(await y('ncs-steps'),await y('ncs-scale'));assert.equal(await y('ncs-seed'),await y('ncs-cfg'));
  await page.locator('#ncs-common-preset-name').fill('Mira portrait');await as.click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="save-preset"]').hidden);
  assert.match(await over.innerText(),/^변경 저장 · Mira portrait/);assert.equal(await over.evaluate(b=>b.classList.contains('ncs-primary')),true);assert.equal(await as.evaluate(b=>b.classList.contains('ncs-primary')),false);assert.equal(await del.isVisible(),true);
  await page.locator('#ncs-steps').fill('20');await page.locator('#ncs-steps').dispatchEvent('change');
  answer=false;await over.click();assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresets[0].options.steps)!==20,true,'취소: nothing overwritten');
  answer=true;await over.click();await page.waitForFunction(()=>mock.extensionSettings.naice_shot.imagePresets[0].options.steps===20);
  await page.locator('[data-action="new-preset"]').click();await page.waitForFunction(()=>document.querySelector('[data-action="save-preset"]').hidden);
  assert.equal(await as.evaluate(b=>b.classList.contains('ncs-primary')),true);
  assert.match(await page.locator('.ncs-advanced > summary').innerText(),/추출 AI 응답 원문 추가 보관/);
  assert.match(await page.locator('.ncs-advanced').evaluate(e=>e.textContent),/이 옵션을 꺼도 생성 기록\(JSON\)은 실리태번 폴더에 저장돼요[\s\S]*개인정보 주의[\s\S]*이름·대화 인용[\s\S]*AI가 인용한 내용은/);
  if(width>=1000){const field=await page.locator('#ncs-common-preset-name').boundingBox(),acts=await page.locator('.ncs-preset-savebox .ncs-actions').boundingBox();assert.ok(Math.abs((field.x+field.width)-(acts.x+acts.width))<=2,`${tag}: field and buttons end together`);}
  // ---- Drawing: clothes and fixed look
  await page.locator('[data-tab="scene"]').click();const card=page.locator('[data-character="leo"]');
  assert.match(await card.locator('.ncs-outfit-image').innerText(),/이번 그림 복장[\s\S]*이 복장을/);
  assert.equal(await card.locator('.ncs-outfit-image .ncs-outfit-to [data-save-outfit]').count(),1);assert.equal(await card.locator('.ncs-outfit-chat [data-save-outfit]').count(),0);
  assert.equal(await card.locator('.ncs-lock-help').evaluate(d=>d.open),false);
  await page.evaluate(()=>{mock.normalSave=mock.saveMetadata;mock.saveMetadata=()=>new Promise(r=>mock.finishMetadata=r);});
  await card.locator('[data-save-outfit]').click();await card.locator('.ncs-outfit-saving').waitFor();
  assert.equal(await card.locator('.ncs-outfit-to [data-to-wardrobe]').isDisabled(),true,'"이 복장을" is held while saving');
  await page.evaluate(()=>mock.finishMetadata());await page.waitForFunction(()=>!document.querySelector('.ncs-outfit-saving'));await page.evaluate(()=>{mock.saveMetadata=mock.normalSave;});
  assert.match(await card.locator('[data-save-outfit]').innerText(),/✓ 이 채팅 기본 복장/);
  // 0.1.59: the card no longer edits the fixed look itself ([프로필 편집] opens the one editor; see browser-v0159).
  // ---- History: two images, select all ↔ clear all
  for(let i=0;i<2;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=2);
  const all=page.locator('[data-action="select-all-history"]');assert.match(await all.innerText(),/모두 선택/);
  await all.click();assert.equal(await all.innerText(),'모두 해제');
  await page.locator('[data-history-pick]').first().uncheck();assert.equal(await all.innerText(),'모두 해제','still there with one picked');
  await all.click();assert.match(await all.innerText(),/모두 선택/);assert.equal(await page.locator('[data-history-pick]:checked').count(),0);
  assert.equal(await page.locator('[data-action="history"]').innerText(),'↻ 새로고침');
  assert.equal(await page.locator('.ncs-history-more').first().evaluate(d=>d.open),false);
  assert.match(await page.locator('.ncs-storage-info').evaluate(e=>e.textContent),/naice-shot-records[\s\S]*함께 지워져요[\s\S]*폴더에서 직접 지워야 해요/);
  assert.equal(await page.locator('.ncs-png-info').isVisible(),true,'the PNG warning stays open');
  assert.deepEqual(errors,[]);await page.close();
 }
 // 0.1.63: chat pictures have no ⋯ menu any more (see browser-v0163), so the chat-menu colour check is gone.
 console.log('PASS: preset save box follows the selection (asks before overwriting), two-per-row fields, retention wording, fields and buttons end together on PC, "이 복장을" row held while saving, folded lock help, select all ↔ clear all, folded history notes');
}finally{await browser.close();server.close();}
