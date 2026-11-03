// 0.1.39: 그리기창 비우기 with a lasting 되돌리기, and 프리샷 — drawing from free text with no chat, its own work,
// its own history bucket, and 이력 → 프리샷으로 보내기.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pick,reveal} from './menu-helper.mjs';
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
const leo=a=>({id:'leo',name:'Leo',expression:'smile',action:a,position:'auto',outfitMode:'unchanged',outfit:''});
const moment=(title,a,l)=>({title,characters:[leo(a)],unregistered:[],interaction:'',location:l,lighting:'',camera:''});
const three={moments:[moment('앉아 있는 순간','sitting','cafe'),moment('일어나는 순간','standing up','cafe'),moment('나가는 순간','walking out','street')],defaultIndex:2,requestMatched:true};
const free={characters:[{id:'leo',name:'Leo',subject:'boy',appearance:'',outfit:'raincoat',expression:'smile',action:'holding umbrella',position:'auto'},
 {id:'',name:'bartender',subject:'girl',appearance:'long red hair',outfit:'apron',expression:'calm',action:'pouring drink',position:'auto'}],interaction:'',location:'convenience store',lighting:'night, rain',camera:'wide shot'};
try{
 for(const width of [1280,375]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],sent=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  const store=new Map();
  await page.route('**/api/plugins/naice-shot/**',async route=>{const url=new URL(route.request().url());
   if(url.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);const item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};store.set(item.id,item);return route.fulfill({json:item});}
   const key=url.searchParams.get('chatKey'),items=[...store.values()].filter(x=>url.searchParams.get('scope')==='all'||x.chatKey===key).reverse();
   return route.fulfill({json:{items,total:items.length,hasMore:false,scope:url.searchParams.get('scope')??undefined,chats:[],bytes:0,imageCount:items.length}});});
  await page.addInitScript(d=>document.addEventListener('DOMContentLoaded',()=>{mock.extraction=d;mock.extensionSettings.naice_shot.allowAnlas=true;mock.extensionSettings.naice_shot.positive='masterpiece';}),three);
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  const chatClear=page.locator('#ncs-chat-source [data-action="blank"]'),freeClear=page.locator('#ncs-free-source [data-action="blank"]');
  const idle=()=>page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&!document.querySelector('[data-action="generate"]').disabled);
  const extract=async()=>{await page.locator('[data-action="extract"]').click();await idle();};
  const generate=async()=>{const n=sent.length;await page.locator('[data-action="generate"]').click();await idle();assert.equal(sent.length,n+1);};
  // --- Clearing in 챗샷 and a full undo ----------------------------------------------------------------
  await page.evaluate(()=>{document.querySelector('#ncs-target-picker').open=true;});await page.locator('#ncs-target-list [data-message-index="1"]').click();
  await page.locator('#ncs-moment-wish').fill('앉아 있는 순간');await extract();await page.locator('.ncs-moment[data-moment="0"]').click();
  await generate();await page.locator('[data-tab="history"]').click();await pick(page,'[data-history-id]');
  await page.locator('.ncs-moment[data-moment="0"]').waitFor();
  const look=()=>page.evaluate(()=>({people:document.querySelectorAll('[data-character]').length,moment:document.querySelector('.ncs-moment[aria-pressed="true"]')?.dataset.moment??null,
   wish:document.querySelector('#ncs-moment-wish').value,target:document.querySelector('#ncs-target').value,badge:!document.querySelector('#ncs-final-badge').hidden,
   scope:document.querySelector('#ncs-gen-scope').textContent,preview:!!document.querySelector('#ncs-result img')}));
  const full=await look();assert.deepEqual(full,{people:1,moment:'0',wish:'앉아 있는 순간',target:'1',badge:true,scope:'이력 설정 · 이번 생성에만',preview:true});
  await chatClear.click();
  assert.deepEqual(await look(),{people:0,moment:null,wish:'',target:'',badge:false,scope:'기본 생성 설정 · 다음 생성에도 유지',preview:false});
  assert.match(await page.locator('#ncs-undo-clear').innerText(),/이번 작업을 비웠어요. 공통 프롬프트와 기본 설정은 유지돼요./);
  assert.match(await page.locator('#ncs-final').inputValue(),/masterpiece/,'common prompt stays');
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-tab="scene"]').click();assert.equal(await page.locator('#ncs-undo-clear').isVisible(),true,'switching tabs keeps undo');
  await page.locator('[data-action="undo-clear"]').click();assert.deepEqual(await look(),full,'everything comes back together');
  await chatClear.click();await page.locator('#ncs-location').fill('park');assert.equal(await page.locator('#ncs-undo-clear').isHidden(),true,'an edit ends undo');
  // Clearing is off while an extraction runs.
  await page.evaluate(()=>{mock.extractionDeferred=new Promise(r=>{mock.releaseExtraction=()=>r(JSON.stringify(mock.extraction));});});
  await page.locator('[data-action="extract"]').click();assert.equal(await chatClear.isDisabled(),true);
  await page.evaluate(()=>{mock.releaseExtraction();delete mock.extractionDeferred;});await idle();
  const chatPeople=await page.locator('[data-character]').count();assert.ok(chatPeople>0);
  // --- 프리샷 ---------------------------------------------------------------------------------------------
  await page.locator('[data-mode="free"]').click();
  assert.equal(await page.locator('#ncs-source-title').innerText(),'1 · 그릴 장면');assert.equal(await page.locator('#ncs-chat-source').isHidden(),true);
  assert.equal(await page.locator('[data-character]').count(),0,'프리샷 has its own work');
  await page.locator('[data-action="free-fill"]').click();assert.match(await page.locator('#ncs-notice').innerText(),/그릴 상황을 적어/);
  await page.locator('#ncs-add-profile').selectOption('leo');await page.locator('[data-action="add-character"]').click();
  assert.equal(await page.locator('[data-chat-outfit]').count(),0,'no chat clothes in 프리샷');
  await page.locator('#ncs-free-text').fill('비 오는 밤 편의점 앞, 레오가 우산을 들고 웃고 빨간 머리 점원이 음료를 따른다');
  const ko={...free,characters:[{...free.characters[0],action:'우산을 든다'},free.characters[1]]};
  await page.evaluate(([bad,good])=>{let n=0;mock.generateRaw=async function(o){this.extractCalls=(this.extractCalls??0)+1;this.lastExtract=o;return JSON.stringify(n++===0?bad:good);};},[ko,free]);
  await page.locator('[data-action="free-fill"]').click();await idle();
  const prompt=await page.evaluate(()=>mock.lastExtract.prompt);
  assert.match(prompt,/SELECTED \(already in the picture\):\n\[\{"id":"leo","name":"Leo"\}\]/);assert.match(prompt,/SITUATION:\n"비 오는 밤/);assert.match(prompt,/Your previous reply wrote descriptive fields in a language other than English/);
  assert.equal(await page.locator('[data-character]').count(),2,'Leo was not doubled');
  assert.equal(await page.locator('[data-character="leo"] [data-field="action"]').inputValue(),'holding umbrella');assert.equal(await page.locator('[data-character="leo"] [data-field="manualOutfit"]').inputValue(),'raincoat');
  assert.equal(await page.locator('.ncs-temp [data-temp="appearance"]').inputValue(),'long red hair');assert.equal(await page.locator('#ncs-location').inputValue(),'convenience store');
  // Each mode keeps its own work while the other is in use.
  await page.locator('[data-mode="chat"]').click();assert.equal(await page.locator('[data-character]').count(),chatPeople);assert.equal(await page.locator('#ncs-chat-source').isVisible(),true);
  await page.locator('[data-mode="free"]').click();assert.equal(await page.locator('[data-character]').count(),2);assert.match(await page.locator('#ncs-free-text').inputValue(),/비 오는 밤/);
  // Works with no chat open, into its own history bucket; no chat clothes touched.
  await page.evaluate(()=>{mock.chatId=null;mock.emit('chat');});
  assert.equal(await page.locator('[data-character]').count(),2,'a chat change leaves 프리샷 alone');
  await generate();const last=sent.at(-1);assert.equal(last.chatKey,'{"free":true}');assert.match(last.snapshot.freeText,/비 오는 밤/);
  assert.match(last.assembled.characters.find(c=>c.name==='Leo').prompt,/raincoat/);assert.equal(await page.evaluate(()=>JSON.stringify(mock.chatMetadata.naice_shot?.outfits??{})),'{}');
  assert.equal(await page.locator('#ncs-result [data-action="attach"]').count(),0,'nothing to attach to in 프리샷');
  await page.locator('[data-tab="history"]').click();assert.equal(await page.locator('[data-history-scope="chat"]').innerText(),'프리샷');
  await page.locator('[data-history-id]').first().waitFor({state:'attached'});assert.equal(await page.locator('[data-history-attach]').count(),0);
  // Clearing 프리샷 clears only 프리샷; history restore brings the text back.
  await page.locator('[data-tab="scene"]').click();await freeClear.click();assert.equal(await page.locator('#ncs-free-text').inputValue(),'');
  await page.locator('[data-tab="history"]').click();await pick(page,'[data-history-id]');assert.match(await page.locator('#ncs-free-text').inputValue(),/비 오는 밤/);
  // 이력 → 프리샷으로 보내기 from 챗샷, with the old 프리샷 work one 되돌리기 away.
  await page.evaluate(()=>{mock.chatId='A';mock.emit('chat');});
  await page.locator('[data-tab="scene"]').click();await page.locator('[data-mode="chat"]').click();
  await page.locator('[data-tab="history"]').click();await pick(page,'[data-history-free]');
  assert.equal(await page.locator('[data-mode="free"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#ncs-free-text').inputValue(),'');
  assert.match(await page.locator('[data-character="leo"] [data-field="action"]').inputValue(),/sitting/);assert.equal(await page.locator('.ncs-moment').count(),0,'one moment only');
  assert.match(await page.locator('#ncs-undo-clear').innerText(),/이력에서 가져왔어요/);
  await page.locator('[data-action="undo-clear"]').click();assert.match(await page.locator('#ncs-free-text').inputValue(),/비 오는 밤/);
  assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: clear empties the work and keeps the common prompt, undo stays across tabs and restores people/candidate/wish/target/final/one-off options/preview together, an edit ends it, disabled while extracting; 프리샷 keeps its own work, fills from text with selected and temporary people (no doubling, English retry), no chat clothes, works with no chat, own history bucket without attaching, clearing is per mode, 프리샷으로 보내기 with undo, 375px fit');
}finally{await browser.close();server.close();}
