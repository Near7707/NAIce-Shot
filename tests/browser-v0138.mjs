// 0.1.38: generation settings box in the scene tab (same values as the settings tab; a one-off copy while
// history options are in use), presets saved from there, "설정을 프리셋으로" from history without touching
// current work, and a confirm before drawing a scene that was never extracted.
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
  let history=[],answer=true;page.on('dialog',d=>answer?d.accept():d.dismiss());
  await page.route('**/api/plugins/naice-shot/**',async route=>{const url=new URL(route.request().url());
   if(url.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);const item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};history=[item,...history];return route.fulfill({json:item});}
   return route.fulfill({json:{items:history,total:history.length,hasMore:false}});});
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const s=mock.extensionSettings.naice_shot;s.allowAnlas=true;s.positive='masterpiece, watercolor';s.negative='lowres';}));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  const opts=()=>page.evaluate(()=>mock.extensionSettings.naice_shot.options),gen=k=>page.locator(`[data-gen="${k}"]`);
  const generate=async()=>{const n=sent.length;await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&!document.querySelector('[data-action="generate"]').disabled);return sent.length>n;};
  // An empty scene asks first; cancelling sends nothing.
  answer=false;assert.equal(await generate(),false);assert.match(await page.locator('#ncs-notice').innerText(),/장면 추출.*먼저/);answer=true;
  await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&document.querySelector('[data-character]'));
  // The box: folded, with its scope and a one-line summary; edits are the settings tab's values.
  assert.equal(await page.locator('#ncs-gen-box').evaluate(el=>el.open),false);
  assert.match(await page.locator('#ncs-gen-scope').innerText(),/기본 생성 설정 · 다음 생성에도 유지/);assert.match(await page.locator('#ncs-gen-line').innerText(),/832×1216 · 28스텝/);
  await page.locator('#ncs-gen-box > summary').click();
  await gen('scale').fill('6.5');await gen('size').selectOption('landscape');await gen('steps').fill('40');
  let o=await opts();assert.deepEqual([o.scale,o.width,o.height,o.steps],[6.5,1216,832,28]);assert.equal(await gen('steps').inputValue(),'28');
  assert.equal(await page.locator('#ncs-scale').inputValue(),'6.5');assert.equal(await page.locator('#ncs-size-preset').inputValue(),'landscape');
  // Presets from the box: save new, then the overwrite button names its target.
  assert.equal(await page.locator('[data-action="gen-preset-overwrite"]').isHidden(),true);
  await page.locator('[data-action="gen-preset-new"]').click();await page.locator('#ncs-gen-preset-name').fill('가로 수채화');await page.locator('[data-action="gen-preset-new-confirm"]').click();
  assert.match(await page.locator('[data-action="gen-preset-overwrite"]').innerText(),/‘가로 수채화’에 덮어쓰기/);
  await gen('scale').fill('7');assert.match(await page.locator('#ncs-gen-preset-state').innerText(),/수정됨/);
  await page.locator('[data-action="gen-preset-overwrite"]').click();
  assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresets.find(p=>p.name==='가로 수채화').options.scale),7);
  assert.match(await page.locator('#ncs-gen-preset-state').innerText(),/그대로/);
  assert.equal(await generate(),true);assert.equal(sent.at(-1).options.scale,7);
  // History options: the box says so, edits stay one-off, and there is a way back.
  await page.locator('[data-tab="history"]').click();await page.locator('[data-history-id]').first().click();
  assert.match(await page.locator('#ncs-gen-scope').innerText(),/이력 설정 · 이번 생성에만/);assert.equal(await page.locator('#ncs-gen-override').isVisible(),true);
  assert.equal(await page.locator('#ncs-gen-presets').isHidden(),true);
  await gen('steps').fill('20');assert.equal((await opts()).steps,28,'settings untouched');
  assert.equal(await generate(),true);assert.equal(sent.at(-1).options.steps,20,'the one-off copy was used');
  assert.match(await page.locator('#ncs-gen-scope').innerText(),/기본 생성 설정/,'back to normal after a successful generation');
  await page.locator('[data-tab="history"]').click();await page.locator('[data-history-id]').first().click();
  await page.locator('[data-action="gen-restore-default"]').click();assert.match(await page.locator('#ncs-gen-scope').innerText(),/기본 생성 설정/);
  // 설정을 프리셋으로: a new preset from one image; current work and the chosen preset do not change.
  const before=await page.evaluate(()=>({id:mock.extensionSettings.naice_shot.imagePresetId,options:{...mock.extensionSettings.naice_shot.options}}));
  await page.locator('[data-tab="history"]').click();await page.locator('[data-history-preset]').last().click();
  await page.locator('[data-history-preset-save]').click();assert.match(await page.locator('#ncs-notice').innerText(),/이름을 적어/);
  await page.locator('#ncs-history-preset-name').fill('가로 수채화');await page.locator('[data-history-preset-save]').click();assert.match(await page.locator('#ncs-notice').innerText(),/같은 이름/);
  await page.locator('#ncs-history-preset-name').fill('첫 그림 설정');await page.locator('[data-history-preset-save]').click();
  const p=await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresets.find(p=>p.name==='첫 그림 설정'));
  const first=sent[0];
  assert.deepEqual([p.options.scale,p.options.width,p.options.steps,p.options.seed],[first.options.scale,first.options.width,first.options.steps,-1]);
  assert.equal(p.positive,'masterpiece, watercolor','common Positive recovered from the image');assert.equal(p.negative,'lowres');
  assert.doesNotMatch(JSON.stringify(p),/smile|sitting|navy coat|brown hair/,'no scene or people in the preset');
  assert.match(await page.locator('#ncs-notice').innerText(),/이 그림에서 가져왔어요.*그대로예요/);
  const after=await page.evaluate(()=>({id:mock.extensionSettings.naice_shot.imagePresetId,options:{...mock.extensionSettings.naice_shot.options}}));assert.deepEqual(after,before);
  assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: empty scene asks before generating, generation box shows scope and summary and edits the settings values, presets saved/overwritten from the box with the target named, history options shown as one-off with a way back, 설정을 프리셋으로 saves options and common prompts only without changing current work, 375px fit');
}finally{await browser.close();server.close();}
