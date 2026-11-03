// 0.1.33: wardrobe (옷장) per profile and the four clothes controls on a scene card — 당분간 이 복장 (this chat),
// 평생 박제 (lock), 입고 버림 (this image only), 옷장으로 (keep for later) — plus "프롬프트 보기" in history.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
try{
 for(const width of [1280,375]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],sent=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  let history=[];
  await page.route('**/api/plugins/naice-shot/**',async route=>{const url=new URL(route.request().url());
   if(url.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);const item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};history=[item];return route.fulfill({json:item});}
   return route.fulfill({json:{items:history,total:history.length,hasMore:false}});});
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  const settings=()=>page.evaluate(()=>mock.extensionSettings.naice_shot);
  const card=page.locator('[data-character="leo"]'),once=card.locator('[data-field="manualOutfit"]');
  // Profile tab: put a pair of pajamas in the wardrobe; the default outfit stays.
  await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile="leo"]').click();
  assert.match(await page.locator('#ncs-wardrobe-list').innerText(),/비어 있어요/);
  await page.locator('[data-action="wardrobe-add"]').click();
  const row=page.locator('.ncs-wardrobe-item').last();await row.locator('summary').click();await row.locator('[data-w="name"]').fill('잠옷');await row.locator('[data-w="outfit"]').fill('pajamas, slippers');
  await page.locator('[data-action="wardrobe-add"]').click();await page.locator('.ncs-wardrobe-item').last().locator('summary').click();await page.locator('.ncs-wardrobe-item').last().locator('[data-w="name"]').fill('정장');await page.locator('.ncs-wardrobe-item').last().locator('[data-w="outfit"]').fill('black suit, tie');
  await page.locator('#ncs-profile-submit').click();
  let leo=(await settings()).profiles.find(p=>p.id==='leo');
  assert.deepEqual(leo.wardrobe.map(w=>[w.name,w.outfit]),[['잠옷','pajamas, slippers'],['정장','black suit, tie']]);assert.equal(leo.defaultOutfit,'navy coat, white shirt, jeans');
  // Scene card: the four controls with their notes.
  await page.locator('[data-tab="scene"]').click();await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&document.querySelector('[data-character="leo"]'));
  const text=await card.innerText();for(const label of ['이번 그림','이 채팅에서','채팅 기본 복장','복장 잠금','옷장에 저장'])assert.ok(text.includes(label),label);
  assert.match(text,/채팅 기본 복장이 없어서 프로필 기본 복장을 기준으로 해요/);
  assert.match(text,/메시지에 복장 설명이 없으면 이 채팅에서 기본으로 입는 옷이에요./);assert.match(text,/AI가 이 채팅에서 복장을 바꾸지 못하게 해요/);assert.match(text,/AI가 찾은 새 옷/);
  // 이 채팅 기본 복장: picking 잠옷 saves it for this chat and puts it on this image, over the AI's new outfit.
  await card.locator('[data-chat-outfit]').selectOption({label:'잠옷'});
  await page.waitForFunction(()=>mock.chatMetadata.naice_shot?.outfits?.leo?.value==='pajamas, slippers');
  assert.equal(await once.inputValue(),'pajamas, slippers');assert.match(await page.locator('#ncs-final').inputValue(),/pajamas, slippers/);
  // Lit at a glance: a badge by the name, the picker and the button.
  assert.match(await card.locator('.ncs-clothes-badges').innerText(),/채팅 기본 복장/);
  assert.equal(await card.locator('select[data-chat-outfit].ncs-on').count(),1);
  assert.equal(await card.locator('[data-save-outfit]').getAttribute('aria-pressed'),'true');assert.match(await card.locator('[data-save-outfit]').innerText(),/✓ 채팅 기본 복장/);
  // 평생 박제, then a new extraction with different clothes: the image keeps the locked pajamas.
  await card.locator('[data-lock]').check();await page.waitForFunction(()=>mock.chatMetadata.naice_shot.outfits.leo.locked===true);
  assert.match(await card.locator('.ncs-clothes-badges').innerText(),/복장 잠금/);
  await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden);
  assert.equal(await card.locator('[data-chat-outfit]').inputValue(),(await settings()).profiles.find(p=>p.id==='leo').wardrobe.map(w=>`w:${w.id}`)[0]);
  assert.equal(await once.inputValue(),'pajamas, slippers');assert.match(await card.innerText(),/잠긴 복장을 유지해요/);
  // 옷장에서 꺼내 입기: this image only; the chat keeps the pajamas.
  await card.locator('[data-wear-once]').selectOption({label:'정장'});
  assert.equal(await card.locator('[data-save-outfit]').getAttribute('aria-pressed'),'false','a one-off outfit is not the chat default');
  assert.equal(await once.inputValue(),'black suit, tie');assert.equal((await page.evaluate(()=>mock.chatMetadata.naice_shot.outfits.leo.value)),'pajamas, slippers');
  // 입고 버림 edit, then 옷장으로 with a name: the profile and the open profile form both get it.
  await once.fill('raincoat, boots');await card.locator('[data-to-wardrobe]').click();
  await page.locator('[data-wardrobe-confirm]').click();assert.match(await page.locator('#ncs-notice').innerText(),/이름을 적어/);
  await page.locator('#ncs-wardrobe-name').fill('잠옷');await page.locator('[data-wardrobe-confirm]').click();assert.match(await page.locator('#ncs-notice').innerText(),/이미/);
  await page.locator('#ncs-wardrobe-name').fill('비 오는 날');await page.locator('[data-wardrobe-confirm]').click();
  leo=(await settings()).profiles.find(p=>p.id==='leo');assert.deepEqual(leo.wardrobe.map(w=>w.name),['잠옷','정장','비 오는 날']);assert.equal(leo.wardrobe[2].outfit,'raincoat, boots');
  assert.equal(await page.locator('#ncs-wardrobe-list .ncs-wardrobe-item').count(),3,'open form updated');
  // Editing a wardrobe item later never rewrites what the chat already saved.
  await page.locator('[data-tab="profiles"]').click();await page.locator('.ncs-wardrobe-item').first().locator('summary').click();await page.locator('.ncs-wardrobe-item').first().locator('[data-w="outfit"]').fill('striped pajamas');await page.locator('#ncs-profile-submit').click();
  assert.equal((await settings()).profiles.find(p=>p.id==='leo').wardrobe.length,3,'saving the form keeps the item added from the scene');
  assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.outfits.leo.value),'pajamas, slippers');
  await page.locator('[data-tab="scene"]').click();assert.equal(await card.locator('[data-chat-outfit]').inputValue(),'custom','no longer matches the edited item');
  // 되돌리기 and 이 옷 당분간 입기.
  await card.locator('[data-reset-outfit]').click();assert.equal(await once.inputValue(),'pajamas, slippers');
  assert.equal(await card.locator('[data-save-outfit]').getAttribute('aria-pressed'),'true');
  await once.fill('hoodie');assert.equal(await card.locator('[data-save-outfit]').getAttribute('aria-pressed'),'false','typing turns the button off at once');await card.locator('[data-save-outfit]').click();await page.waitForFunction(()=>mock.chatMetadata.naice_shot.outfits.leo.value==='hoodie');
  assert.match(await card.locator('.ncs-saved-note').innerText(),/✓ 채팅 기본 복장: hoodie · 잠금/);
  // Pressing the lit button again clears the chat default; the lock stays.
  await card.locator('[data-save-outfit][aria-pressed="true"]').click();await page.waitForFunction(()=>mock.chatMetadata.naice_shot.outfits.leo.value===undefined&&mock.chatMetadata.naice_shot.outfits.leo.locked===true);
  assert.equal(await card.locator('[data-save-outfit]').getAttribute('aria-pressed'),'false');assert.doesNotMatch(await card.locator('.ncs-clothes-badges').innerText(),/채팅 기본 복장/);
  // "정하지 않음" in the picker clears too, and locking alone never sets a default.
  await card.locator('[data-chat-outfit]').selectOption({label:'잠옷'});await page.waitForFunction(()=>!!mock.chatMetadata.naice_shot.outfits.leo.value);
  await card.locator('[data-chat-outfit]').selectOption('default');await page.waitForFunction(()=>mock.chatMetadata.naice_shot.outfits.leo.value===undefined);
  await card.locator('[data-lock]').uncheck();await page.waitForFunction(()=>mock.chatMetadata.naice_shot.outfits.leo===undefined);
  await card.locator('[data-lock]').check();await page.waitForFunction(()=>mock.chatMetadata.naice_shot.outfits.leo?.locked===true);
  assert.equal(await page.evaluate(()=>'value' in mock.chatMetadata.naice_shot.outfits.leo),false,'a lock alone sets no default');
  await once.fill('hoodie');await card.locator('[data-save-outfit]').click();await page.waitForFunction(()=>mock.chatMetadata.naice_shot.outfits.leo.value==='hoodie');
  // The shared viewer builds the prompt only after its disclosure opens.
  await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&document.querySelector('#ncs-result img'));
  await page.locator('[data-tab="history"]').click();await page.locator('[data-view-history]').first().click();
  assert.equal(await page.locator('.ncsv-prompt-text').innerText(),'','nothing built while closed');
  await page.locator('.ncsv-prompt > summary').click();await page.waitForFunction(()=>!document.querySelector('[data-v="copy"]').disabled);
  const shown=await page.locator('.ncsv-prompt-text').innerText();assert.match(shown,/\[공통 Positive\]/);assert.match(shown,/hoodie/);assert.match(shown,/seed /);
  await page.context().grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});
  await page.locator('[data-v="copy"]').click();await page.waitForFunction(()=>/복사했어요/.test(document.querySelector('.ncsv-copy-status').textContent));
  await page.locator('#ncs-viewer [data-v="close"]').click();
  // Backups carry the wardrobe.
  await page.locator('[data-tab="settings"]').click();
  const backup=JSON.stringify({...(await settings())});
  await page.locator('#ncs-import').setInputFiles({name:'b.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await page.waitForFunction(()=>/백업을 가져왔어요/.test(document.querySelector('#ncs-notice').textContent));
  assert.equal((await settings()).profiles.find(p=>p.id==='leo').wardrobe.length,3);
  assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: wardrobe in the profile form (default outfit untouched), 채팅 기본 복장 saves for the chat and applies now, 복장 잠금 keeps it through re-extraction, the lit button clears the default, a lock alone sets none, wear-once from the wardrobe, 옷장에 저장 with name checks updates profile and open form, later wardrobe edits do not rewrite chat clothes, revert and keep, history prompt view built on open with copy, backups include wardrobe, 375px fit');
}finally{await browser.close();server.close();}
