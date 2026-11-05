// v0.1.50: outfit saves never lose later edits or their hold (UI-049-03/04), typing shows 자동으로 되돌리기 at once
// (UI-049-05), long preset names keep 덮어쓰기 on one line (UI-049-06), the card character without a profile gets
// make/link buttons, the ⋯ order, 클린 PNG wording, the PNG guide in the history tab, and one focus ring in menus.
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
async function open(width,{cardName}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 return {page,errors};
}
const textLines=(loc)=>loc.evaluate(e=>{const tops=new Set(),w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode()){const r=document.createRange();r.selectNodeContents(n);for(const x of r.getClientRects())if(x.width>1)tops.add(Math.round(x.top));}return tops.size;});
try{
 {// Outfit saving: a failed save keeps what was typed afterwards; a rebuilt card keeps its hold.
  const {page,errors}=await open(375);const card=page.locator('[data-character="leo"]'),once=card.locator('[data-field="manualOutfit"]');
  // UI-049-05: typing shows 자동으로 되돌리기 and the "지금" line at once.
  assert.equal(await card.locator('[data-reset-outfit]').count(),0);
  await once.fill('orange coat');await card.locator('[data-reset-outfit]').waitFor();assert.match(await card.locator('.ncs-outfit-now').innerText(),/직접|편집/);
  // UI-049-03: save A, type B while it waits, the save fails → B stays.
  await page.evaluate(()=>{mock.normalSave=mock.saveMetadata;mock.saveMetadata=()=>new Promise((_,no)=>mock.failMetadata=()=>no(Error('mock failure')));});
  await card.locator('[data-save-outfit]').click();await card.locator('.ncs-outfit-saving').waitFor();
  await once.fill('green scarf');
  // UI-049-04: rebuilding the card (이번 그림 → 비우기) keeps the hold and "저장 중…".
  await card.locator('[data-empty-outfit]').click();
  assert.equal(await card.locator('.ncs-outfit-saving').count(),1,'saving note survives a rebuild');
  assert.equal(await card.locator('[data-outfit-hold] [data-save-outfit]').isDisabled(),true,'chat controls stay held');
  assert.equal(await page.locator('#ncs-work-fields').isDisabled(),false,'the drawing window is not held');
  await once.fill('green scarf');
  await page.waitForFunction(()=>typeof mock.failMetadata==='function');await page.evaluate(()=>mock.failMetadata());await page.waitForFunction(()=>!document.querySelector('.ncs-outfit-saving'));
  assert.equal(await once.inputValue(),'green scarf','later edit kept after the failed save');
  assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot?.outfits?.leo?.value),undefined,'failed save rolled back');
  assert.equal(await card.locator('[data-outfit-hold] [data-save-outfit]').isDisabled(),false);
  await page.evaluate(()=>{mock.saveMetadata=mock.normalSave;});
  // An unchanged field still returns to its value from before the failed save.
  await page.evaluate(()=>{mock.saveMetadata=async()=>{throw Error('mock failure');};});await card.locator('[data-save-outfit]').click();
  await page.waitForFunction(()=>/저장하지 못했어요/.test(document.querySelector('#ncs-notice').innerText));assert.equal(await once.inputValue(),'green scarf');
  await page.evaluate(()=>{mock.saveMetadata=mock.normalSave;});
  // ⋯ order, 클린 PNG wording, the PNG guide in the history tab, one focus ring.
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
  await page.locator('[data-tab="history"]').click();await page.locator('.ncs-history-card').first().waitFor();
  assert.match(await page.locator('.ncs-png-info').innerText(),/클린 PNG[\s\S]*메타데이터\(EXIF 포함\)[\s\S]*공유하기 전에 다시 한번 확인하세요/);
  assert.equal(await page.locator('#ncs-history-filter').locator('xpath=..').evaluate(l=>l.firstChild.textContent.trim()),'채팅방 선택');
  assert.equal(await page.locator('#tab-settings .ncs-png-info, [data-panel="settings"] .ncs-png-info').count(),0);
  const more=page.locator('.ncs-history-card [data-image-more]:not(.ncs-save-toggle)').first();await more.click();
  const order=await page.locator('.ncs-image-popup:popover-open button').evaluateAll(b=>b.map(x=>x.firstChild.textContent.trim()));
  assert.deepEqual(order,['챗샷으로 보내기','프리샷으로 보내기','설정을 프리셋으로','본문에 넣기','메시지로 가기']);await page.keyboard.press('Escape');
  await page.locator('.ncs-history-card .ncs-save-toggle').first().click();
  const first=page.locator('.ncs-image-popup:popover-open .ncs-popup-primary');
  assert.match(await first.innerText(),/^클린 PNG\s*프롬프트·seed 등 메타데이터를 제거한 사본이에요\./);
  assert.match(await page.locator('.ncs-image-popup:popover-open a').innerText(),/^원본 PNG\s*프롬프트·seed 등 메타데이터를 제거하지 않고 그대로 저장해요\./);
  await page.keyboard.press('Shift');await first.focus();
  const ring=await first.evaluate(e=>{const s=getComputedStyle(e);return {visible:e.matches(':focus-visible'),outline:s.outlineStyle,shadow:s.boxShadow};});
  assert.equal(ring.visible,true,'keyboard focus shown');
  assert.equal(ring.outline,'none','no second ring outside the accented item');assert.match(ring.shadow,/inset/);
  assert.deepEqual(errors,[]);await page.close();
 }
 for(const width of [320,375,1100]){// UI-049-06: a long preset name keeps 덮어쓰기 on one line.
  const {page,errors}=await open(width);await page.locator('[data-tab="settings"]').click();
  const name='Winter watercolor illustration preset with soft light';
  await page.locator('#ncs-common-preset-name').fill(name);await page.locator('[data-action="save-preset-as"]').click();
  const over=page.locator('[data-action="save-preset"]');await page.waitForFunction(()=>!document.querySelector('[data-action="save-preset"]').disabled);
  assert.equal(await textLines(over),1,`${width}px: 덮어쓰기 stays on one line`);
  assert.ok(await over.evaluate(e=>e.scrollHeight<=e.clientHeight+1));
  assert.match(await over.getAttribute('title'),new RegExp(name));
  assert.deepEqual(errors,[]);await page.close();
 }
 {// The card character has no profile and the extraction did not list them: make/link buttons still appear.
  const {page,errors}=await open(375,{cardName:'Robin'});
  const box=page.locator('#ncs-missing-main .ncs-missing-main').filter({hasText:'캐릭터'}); // 0.1.78: the user without a profile has their own box tooawait box.waitFor();
  assert.match(await box.innerText(),/"Robin"에 연결된 프로필이 없어요[\s\S]*AI가 찾지 못했어요/);
  assert.equal(await box.locator('[data-missing-do="direct"]').count(),1);assert.equal(await box.locator('[data-missing-do="source"]').count(),1);
  assert.doesNotMatch(await page.locator('#ncs-left-out').innerText(),/Robin/,'not counted as left out of this picture');
  await box.locator('[data-missing-do="direct"]').click();await page.locator('#ncs-profile-name').waitFor();
  assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Robin');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: outfit save rollback and hold, instant typing state, one-line preset overwrite, card character buttons, ⋯ order, 클린 PNG wording, PNG guide in history, single focus ring');
}finally{await browser.close();server.close();}
