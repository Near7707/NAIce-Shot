// 0.1.37: temporary people (임시 인물) — drawn in this scene only, from the "no profile" list or the add row;
// kept through regeneration, re-extraction and candidate switches (asking for a check unless found again);
// saved in history; "프로필로 저장" turns the slot into a real profile without doubling the person.
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
const leo=(action='sitting')=>({id:'leo',name:'Leo',expression:'smile',action,position:'auto',outfitMode:'unchanged',outfit:''});
const vendor=(action='selling fruit')=>({id:'',name:'Street vendor',expression:'grin',action,position:'right',outfitMode:'replace',outfit:'apron'});
const frame=(people,unregistered=[])=>({characters:people,unregistered,interaction:'',location:'market',lighting:'',camera:''});
try{
 for(const width of [1280,375]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],sent=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  let history=[];
  await page.route('**/api/plugins/naice-shot/**',async route=>{const url=new URL(route.request().url());
   if(url.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);const item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};history=[item];return route.fulfill({json:item});}
   return route.fulfill({json:{items:history,total:history.length,hasMore:false}});});
  await page.addInitScript(d=>document.addEventListener('DOMContentLoaded',()=>{mock.extraction=d;mock.extensionSettings.naice_shot.allowAnlas=true;}),frame([leo(),vendor()],['Street vendor']));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  const extract=async()=>{const n=await page.evaluate(()=>mock.extractCalls??0);await page.locator('[data-action="extract"]').click();await page.waitForFunction(n=>(mock.extractCalls??0)>n&&document.querySelector('#ncs-progress').hidden,n);};
  const temp=page.locator('.ncs-temp');
  await extract();
  assert.match(await page.locator('#ncs-left-out').innerText(),/Street vendor/);
  // From the "no profile" list: the extracted expression, action, place and clothes come along.
  await page.locator('[data-temp-from="Street vendor"]').click();
  assert.equal(await temp.count(),1);assert.equal(await temp.locator('[data-temp="name"]').inputValue(),'Street vendor');
  assert.equal(await temp.locator('[data-field="action"]').inputValue(),'selling fruit');assert.equal(await temp.locator('[data-temp="outfit"]').inputValue(),'apron');
  assert.equal(await temp.locator('[data-field="position"]').inputValue(),'right');
  assert.equal(await page.locator('#ncs-left-out').isHidden(),true,'no longer left out');
  assert.match(await page.locator('#ncs-warnings').innerText(),/외형이 비어 있어요/);
  await temp.locator('[data-temp="appearance"]').fill('old man, grey beard');await temp.locator('[data-temp="subject"]').selectOption('boy');
  const final=JSON.parse(await page.locator('#ncs-final').inputValue());
  assert.match(final.base,/2boys/);const slot=final.characters.find(c=>c.name==='Street vendor');
  assert.match(slot.prompt,/^boy, old man, grey beard, apron, grin, selling fruit, on the right$/);assert.doesNotMatch(JSON.stringify(final.characters.map(c=>c.prompt)),/Street vendor/,'the name stays out of the prompt');
  // Regenerate-ready and saved in history.
  await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&document.querySelector('#ncs-result img'));
  assert.ok(sent.at(-1).snapshot.scene.characters.some(c=>c.temp&&c.appearance==='old man, grey beard'));
  assert.equal(await temp.count(),1,'still there after generating');
  await page.locator('[data-action="blank"]').click();assert.equal(await temp.count(),0);
  await page.locator('[data-tab="history"]').click();await page.locator('[data-history-id]').first().click();assert.equal(await temp.count(),1,'history restores it');
  // Re-extraction without them: kept, flagged for a check, not silently confirmed.
  await page.evaluate(d=>{mock.extraction=d;},frame([leo('standing')]));await extract();
  assert.equal(await temp.count(),1);assert.match(await temp.innerText(),/지금 장면에도 있는지/);
  await temp.locator('[data-temp-confirm]').click();assert.doesNotMatch(await temp.innerText(),/지금 장면에도 있는지/);
  // Found again: fresh fields, no flag.
  await page.evaluate(d=>{mock.extraction=d;},frame([leo(),vendor('waving')],['Street vendor']));await extract();
  assert.equal(await temp.locator('[data-field="action"]').inputValue(),'waving');assert.doesNotMatch(await temp.innerText(),/지금 장면에도 있는지/);
  assert.equal(await temp.locator('[data-temp="appearance"]').inputValue(),'old man, grey beard','own appearance kept');
  assert.equal(await page.locator('#ncs-left-out').isHidden(),true);
  // Candidates: carried to another moment with a check.
  await page.evaluate(d=>{mock.extraction=d;},{moments:[{title:'앞',...frame([leo('walking')])},{title:'뒤',...frame([leo(),vendor()],['Street vendor'])}],defaultIndex:1,requestMatched:true});
  await extract();assert.doesNotMatch(await temp.innerText(),/지금 장면에도 있는지/);
  await page.locator('.ncs-moment[data-moment="0"]').click();assert.equal(await temp.count(),1);assert.match(await temp.innerText(),/지금 장면에도 있는지/);
  // A blank temporary person from the add row; the header follows the name.
  await page.locator('[data-action="add-temp"]').click();assert.equal(await temp.count(),2);
  await temp.nth(1).locator('[data-temp="name"]').fill('Kai');assert.match(await temp.nth(1).locator('strong').innerText(),/Kai/);
  await temp.nth(1).locator('[data-remove]').click();assert.equal(await temp.count(),1);
  // 프로필로 저장: the form opens filled; saving swaps the slot for the profile without doubling.
  const before=await page.locator('[data-character]').count();
  await temp.locator('[data-temp-save]').click();
  assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Street vendor');assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'old man, grey beard');
  assert.equal(await page.locator('#ncs-profile-outfit').inputValue(),'apron');assert.equal(await page.locator('#ncs-profile-subject').inputValue(),'boy');
  await page.locator('#ncs-profile-submit').click();
  assert.equal(await temp.count(),0);assert.equal(await page.locator('[data-character]').count(),before);
  const id=await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Street vendor')?.id);assert.ok(id);
  const card=page.locator(`[data-character="${id}"]`);assert.equal(await card.locator('[data-field="action"]').inputValue(),'waving','the action this candidate carried');
  assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Street vendor').appearance),'old man, grey beard');
  await page.locator('.ncs-moment[data-moment="1"]').click();assert.equal(await page.locator('.ncs-temp').count(),0,'converted in every candidate');
  assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(errors,[]);await page.close();
 }
 // Without any profile, a temporary person can still be added.
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.route('**/api/plugins/naice-shot/**',route=>route.fulfill({json:{items:[],total:0,hasMore:false}}));
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.profiles=[];}));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 assert.equal(await page.locator('[data-action="add-temp"]').isVisible(),true);assert.equal(await page.locator('#ncs-add-profile').isVisible(),false);
 await page.locator('[data-action="add-temp"]').click();assert.equal(await page.locator('.ncs-temp').count(),1);
 await page.close();
 console.log('PASS: temporary people from the no-profile list with extracted fields, name kept out of the prompt, subject counts, kept after generating and restored from history, re-extraction asks for a check unless found again, candidates carry them with a check, blank add and remove, 프로필로 저장 swaps the slot in every candidate without doubling, works without profiles, 375px fit');
}finally{await browser.close();server.close();}
