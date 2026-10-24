// 0.1.11: preset buttons — "+ 새 프리셋 만들기" clears prompts and settings, "프리셋 저장" overwrites the
// selected preset (or creates one when none is selected), "새 프리셋으로 저장" always adds a new one.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {DEFAULTS} from '../core.mjs';
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
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());d.accept();});
await page.route('**/api/plugins/naice-shot/**',r=>r.fulfill({json:{items:[],total:0,hasMore:false}}));
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
const presets=()=>page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresets.map(p=>({name:p.name,positive:p.positive,negative:p.negative,steps:p.options.steps})));
const selected=()=>page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;return s.imagePresets.find(p=>p.id===s.imagePresetId)?.name??'';});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-tab="settings"]').click();
 assert.equal(await page.locator('[data-action="save-preset"]').innerText(),'프리셋 저장');
 assert.equal(await page.locator('[data-action="save-preset-as"]').innerText(),'새 프리셋으로 저장');
 assert.equal(await page.locator('[data-action="new-preset"]').innerText(),'+ 새 프리셋 만들기');
 assert.equal(await page.locator('[data-action="update-preset"]').count(),0);

 // Nothing selected: 프리셋 저장 creates one and selects it.
 await page.locator('#ncs-positive').fill('watercolor');await page.locator('#ncs-steps').fill('20');
 await page.locator('#ncs-common-preset-name').fill('수채화');await click('save-preset');
 assert.deepEqual(await presets(),[{name:'수채화',positive:'watercolor',negative:'',steps:20}]);assert.equal(await selected(),'수채화');
 assert.match(await page.locator('#ncs-preset-save-hint').innerText(),/"수채화"에 지금 값을 덮어써요/);

 // Selected: 프리셋 저장 overwrites it.
 await page.locator('#ncs-negative').fill('photo');await click('save-preset');
 assert.deepEqual(await presets(),[{name:'수채화',positive:'watercolor',negative:'photo',steps:20}]);

 // 새 프리셋으로 저장 adds another and leaves the first alone.
 await page.locator('#ncs-positive').fill('ink sketch');await page.locator('#ncs-common-preset-name').fill('잉크');await click('save-preset-as');
 assert.equal((await presets()).length,2);assert.equal(await selected(),'잉크');
 assert.equal((await presets()).find(p=>p.name==='수채화').positive,'watercolor');
 // Same name again is refused.
 await page.locator('#ncs-common-preset-name').fill('잉크');await click('save-preset-as');
 assert.match(await page.locator('#ncs-notice').innerText(),/같은 이름의 프리셋이 있어요/);assert.equal((await presets()).length,2);

 // + 새 프리셋 만들기: asks first, then empties prompts, resets generation settings, deselects, empties the name.
 await click('new-preset');
 assert.match(dialogs.at(-1),/새 프리셋을 시작할까요/);
 assert.equal(await page.locator('#ncs-positive').inputValue(),'');assert.equal(await page.locator('#ncs-negative').inputValue(),'');
 assert.equal(await page.locator('#ncs-steps').inputValue(),String(DEFAULTS.options.steps));
 assert.equal(await page.locator('#ncs-common-preset').inputValue(),'');assert.equal(await page.locator('#ncs-common-preset-name').inputValue(),'');
 assert.equal(await selected(),'');assert.equal((await presets()).length,2,'saved presets untouched');
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'ncs-common-preset-name');
 assert.match(await page.locator('#ncs-preset-save-hint').innerText(),/새로 저장해요/);
 // Empty name is refused with a clear message.
 await click('save-preset');assert.match(await page.locator('#ncs-notice').innerText(),/저장할 이름을 입력해 주세요/);
 // Already blank: no confirmation needed.
 const asked=dialogs.length;await click('new-preset');assert.equal(dialogs.length,asked);
 // Then save the fresh one.
 await page.locator('#ncs-positive').fill('flat color');await page.locator('#ncs-common-preset-name').fill('플랫');await click('save-preset');
 assert.equal((await presets()).length,3);assert.equal(await selected(),'플랫');

 await page.setViewportSize({width:375,height:760});
 assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS: 프리셋 저장 creates then overwrites the selected preset, 새 프리셋으로 저장 adds one (duplicate name refused), + 새 프리셋 만들기 confirms and clears prompts/settings/name/selection, empty name refused, 375px');
}finally{await browser.close();server.close();}
