import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
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
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
try{
 for(const width of [1280,375]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],sent=[];page.on('pageerror',e=>errors.push(e.message));
  let releaseGeneration,startedGeneration;const started=new Promise(r=>{startedGeneration=r;});
  await page.route('**/user/images/**',route=>route.fulfill({contentType:'image/png',body:png}));
  await page.route('**/api/plugins/naice-shot/**',async route=>{
   if(new URL(route.request().url()).pathname.endsWith('/generate')){
    const b=route.request().postDataJSON();sent.push(b);await new Promise(r=>{releaseGeneration=r;startedGeneration();});
    return route.fulfill({json:{id:b.requestId,created:'2026-10-29T00:00:00Z',chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});
   }
   return route.fulfill({json:{items:[],total:0,hasMore:false}});
  });
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
   mock.extensionSettings.naice_shot.messageButton=true;mock.extensionSettings.naice_shot.allowAnlas=true;
   mock.chat=[
    {name:'Mira',is_user:true,is_system:true,mes:'Mira holds a cup in the hidden cafe scene.'},
    {name:'Leo',is_user:false,is_system:true,mes:'Leo waves beside the hidden cafe window.',extra:{reasoning:'PRIVATE REASONING NEVER SEND'}},
    {name:'SillyTavern System',is_system:true,mes:'SYSTEM HELP NEVER SEND',extra:{type:'help'}},
    {name:'Leo',is_user:false,mes:'Leo stands in the visible garden.'},
    {name:'Leo',is_user:false,is_system:true,mes:'Leo waits in the hidden later scene.'},
    {name:'SillyTavern System',is_system:true,mes:'SYSTEM NOTICE NEVER SEND',extra:{type:'generic'}},
   ];mock.renderChat();
  }));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>document.querySelectorAll('#chat .ncs-mes-draw').length===4);
  const icon=i=>page.locator(`#chat .mes[mesid="${i}"] .ncs-mes-draw`),action=name=>page.locator(`[data-action="${name}"]`).first().click();
  assert.equal(await icon(0).count(),1,'hidden user has a button');assert.equal(await icon(1).count(),1,'hidden character has a button');assert.equal(await icon(2).count(),0,'help has none');assert.equal(await icon(5).count(),0,'system notice has none');
  const before=await page.evaluate(()=>structuredClone(mock.chat));
  await icon(1).click();assert.equal(await page.locator('#ncs-target').inputValue(),'1');assert.match(await page.locator('#ncs-target-label').innerText(),/숨김/);
  assert.equal(await page.evaluate(()=>mock.extractCalls??0),0,'selecting hidden text never calls AI automatically');
  await page.locator('#ncs-target-label').click();await page.locator('#ncs-target-list [data-message-index="4"]').waitFor();
  assert.deepEqual(await page.locator('#ncs-target-list [data-message-index]').evaluateAll(els=>els.map(e=>e.dataset.messageIndex)),['4','3','1','0']);
  assert.match(await page.locator('#ncs-target-list [data-message-index="1"]').innerText(),/숨김/);
  assert.doesNotMatch(await page.locator('#ncs-target-list [data-message-index="3"]').innerText(),/숨김/);
  await page.locator('#ncs-target-list [data-message-index="1"]').click();await action('extract');
  await page.waitForFunction(()=>mock.extractCalls===1&&document.querySelector('#ncs-progress').hidden);
  const hiddenPrompt=await page.evaluate(()=>mock.lastExtract.prompt);
  assert.match(hiddenPrompt,/hidden cafe scene/);assert.match(hiddenPrompt,/hidden cafe window/);
  assert.doesNotMatch(hiddenPrompt,/SYSTEM HELP|SYSTEM NOTICE|PRIVATE REASONING|visible garden|hidden later/);
  assert.deepEqual(await page.evaluate(()=>mock.chat),before,'extraction changes neither hide nor message data');
  await action('generate');await started;await action('close');await icon(0).click();
  assert.equal(await page.locator('#ncs-target').inputValue(),'1','message icon cannot change target during image generation');
  assert.match(await page.locator('#ncs-notice').innerText(),/진행 중인 작업이 끝난 뒤/);releaseGeneration();
  await page.locator('#ncs-result img').waitFor();await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden);
  assert.equal(sent[0].snapshot.scene.source.target,1);assert.equal(sent[0].snapshot.rawExtraction,undefined);
  assert.deepEqual(sent[0].snapshot.scene.source.fingerprints.map(f=>f.index),[0,1]);
  assert.ok(sent[0].snapshot.scene.source.fingerprints.every(f=>!('text' in f)));
  assert.equal(await page.locator('#ncs-result [data-image-target]').inputValue(),'1','attachment defaults to selected hidden message');
  await action('attach');await page.waitForFunction(()=>mock.chat[1].extra.naice_shot_images?.length===1);
  assert.equal(await page.evaluate(()=>mock.chat[1].is_system),true);assert.equal(await page.locator('#chat .mes[mesid="1"] .ncs-inline-images img').count(),1);
  assert.equal(await page.evaluate(()=>JSON.parse(mock.savedChat)[1].is_system),true,'saved chat stays hidden too');
  assert.deepEqual(await page.evaluate(()=>mock.chat.map(m=>({text:m.mes,hidden:m.is_system}))),before.map(m=>({text:m.mes,hidden:m.is_system})));
  // Automatic latest keeps hidden history excluded, even when hidden text is newer.
  await page.locator('#ncs-target-label').click();await page.locator('#ncs-target-list [data-action="target-latest"]').click();await action('extract');
  await page.waitForFunction(()=>mock.extractCalls===2&&document.querySelector('#ncs-progress').hidden);
  const latest=await page.evaluate(()=>mock.lastExtract.prompt);assert.match(latest,/visible garden/);assert.doesNotMatch(latest,/hidden cafe|hidden later|SYSTEM HELP|SYSTEM NOTICE/);
  // /hide changes the DOM is_system attribute without re-rendering the message.
  await page.locator('#ncs-target-label').click();await page.evaluate(()=>{mock.chat[3].is_system=true;document.querySelector('#chat .mes[mesid="3"]').setAttribute('is_system','true');});
  await page.waitForFunction(()=>document.querySelector('#ncs-target-list [data-message-index="3"]')?.textContent.includes('숨김'));
  assert.equal(await icon(3).count(),1);
  await page.evaluate(()=>{mock.chat[3].is_system=false;document.querySelector('#chat .mes[mesid="3"]').setAttribute('is_system','false');});
  await page.waitForFunction(()=>{const row=document.querySelector('#ncs-target-list [data-message-index="3"]');return row&&!row.textContent.includes('숨김');});
  assert.equal(await icon(3).count(),1);assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.locator('#ncs-target-label').click();await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-message-button').uncheck();
  assert.equal(await page.locator('#chat .ncs-mes-draw').count(),0);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: hidden user/character icons, tagged system exclusion, hidden labels, explicit hidden extraction/reference scope, unchanged chat/hide/privacy, generation guard, hidden image attachment, visible latest mode, live hide/unhide updates and mobile fit.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
