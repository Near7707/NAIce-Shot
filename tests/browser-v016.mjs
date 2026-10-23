// 0.1.6: skins leave the page behind the panel alone, no display-name or Noise Schedule settings,
// and "모든 칸 비우기" / "+ 새 프로필 만들기" reset the whole profile form.
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
 if(/^\/user\/images\//.test(rel)){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const sent=[];
await page.route('**/api/plugins/naice-shot/**',async route=>{const u=new URL(route.request().url());
 if(u.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);
  return route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});}
 route.fulfill({json:{items:[],total:0,hasMore:false}});});
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 // Settings saved by an older version: a custom display name and a non-default Noise Schedule.
 await page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;s.displayName='옛 이름';s.options={...(s.options??{}),scheduler:'exponential'};});
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 const backdrop=()=>page.locator('#naice-shot-dialog').evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor);
 const classic=await backdrop();assert.equal(classic,'rgba(0, 0, 0, 0.6)');

 // 1) Every skin keeps the same dim layer over the page.
 await page.locator('[data-tab="settings"]').click();
 for(const skin of await page.locator('#ncs-skins input[name="ncs-skin"]').evaluateAll(els=>els.map(e=>e.value))){
  await page.locator(`.ncs-skin:has(input[value="${skin}"])`).click();await page.waitForTimeout(200);
  assert.equal(await backdrop(),classic,`${skin} changes the page behind the panel`);
 }

 // 2) No display-name setting; the old saved name is ignored.
 assert.equal(await page.locator('#ncs-display-name').count(),0);
 assert.equal(await page.locator('.ncs-header [data-brand]').innerText(),'NAIce Shot');
 assert.doesNotMatch(await page.locator('#naice-shot-dialog').innerText(),/확장 표시 이름/);

 // 3) No Noise Schedule control; generation sends the default even if an old value was saved.
 assert.equal(await page.locator('#ncs-scheduler').count(),0);assert.doesNotMatch(await page.locator('#naice-shot-dialog').innerText(),/Noise Schedule|노이즈 스케줄/);
 await page.locator('[data-tab="scene"]').click();await click('extract');await page.locator('[data-character="leo"]').waitFor();
 await page.locator('#ncs-allow-anlas').check();await click('generate');await page.locator('#ncs-result img').waitFor();
 assert.equal(sent.at(-1).options.scheduler,'karras');

 // 4) Profile form: editing a saved profile, then "모든 칸 비우기" clears everything and keeps the saved profile.
 await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile="leo"]').click();
 assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Leo');
 await page.locator('#ncs-profile-describe').fill('갈색 머리');await page.locator('#ncs-profile-outfit').fill('changed outfit');
 await click('clear-profile-form');
 const fields=['id','name','aliases','appearance','outfit','positive','negative','describe'];
 for(const f of fields)assert.equal(await page.locator(`#ncs-profile-${f}`).inputValue(),'',f);
 assert.equal(await page.locator('#ncs-profile-subject').inputValue(),'boy');
 assert.match(await page.locator('#ncs-profile-editing').innerText(),/새 프로필 작성 중/);
 assert.match(await page.locator('#ncs-binding').innerText(),/연결된 카드 없음/);
 assert.match(await page.locator('#ncs-notice').innerText(),/저장해 둔 프로필은 그대로/);
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo').defaultOutfit),'navy coat, white shirt, jeans');
 assert.equal(await page.locator('[data-profile="leo"].ncs-selected').count(),0);
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'ncs-profile-name');
 // The top button does the same.
 await page.locator('#ncs-profile-name').fill('Temp');await page.locator('#ncs-profile-appearance').fill('red hair');
 await page.locator('[data-action="new-profile"]').click();
 assert.equal(await page.locator('#ncs-profile-name').inputValue(),'');assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'');
 assert.equal(await page.locator('[data-action="new-profile"]').innerText(),'+ 새 프로필 만들기');

 await page.setViewportSize({width:375,height:760});
 assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS: same page dim on every skin, no display-name or Noise Schedule settings (old values ignored, karras sent), profile form clears from both buttons and keeps saved profiles, 375px');
}finally{await browser.close();server.close();}
