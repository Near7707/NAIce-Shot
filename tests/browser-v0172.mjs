// v0.1.72: 본문에 넣기 opens the message list (newest first, the made message chosen), 선택 본문에 넣기, from the enlarged
// view too; UI-071-02 (dates per message), UI-071-03 (no chat re-scan while sliding).
import zlib from 'node:zlib';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {pick} from './menu-helper.mjs';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return ~c>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
function pngOf(w,h){const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
 const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;raw[o]=w;raw[o+1]=h;raw[o+2]=120;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep))throw Error();
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const features=['paged-history','delete','private-records','all-history','history-kinds','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes'];
async function open(width,{cardName,extra,seed,clock}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());if(seed)items.push(...seed);if(clock)await page.clock.install();
 // Pictures: a real PNG per id in one of three shapes, never cached, and holdable to slow the next one down.
 const sizes=[[64,96],[96,64],[80,80]],seen=new Map();page.hold=null;
 await page.route('**/user/images/naice-shot/**',async r=>{const id=new URL(r.request().url()).pathname;if(!seen.has(id))seen.set(id,sizes[seen.size%3]);
  if(page.hold)await page.hold;const [w,h]=seen.get(id);await r.fulfill({status:200,headers:{'Content-Type':'image/png','Cache-Control':'no-store'},body:pngOf(w,h)});});
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/delete')){const q=r.request().postDataJSON(),ids=q.ids??[];for(const id of ids){const i=items.findIndex(x=>x.id===id);if(i>=0)items.splice(i,1);}return r.fulfill({json:{deleted:ids,skipped:[]}});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
 if(extra)await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.profiles.push({id:'mira',name:'Mira',aliases:[],subject:'girl',appearance:'long black hair',defaultOutfit:'',positive:'',negative:'',cardKey:''});}));
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 return {page,errors,items};
}
const idle=page=>page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden);
const names=page=>page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.map(c=>c.name));
const one=(c,extra={})=>({moments:[{title:'앉는다',characters:[c],unregistered:[],location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''}],defaultIndex:0,requestMatched:true,requestApplied:[],requestIgnored:[],requestOutfits:[],requestVisibleOnly:false,...extra});
const leo=(extra={})=>({id:'leo',name:'Leo',expression:'calm',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:'',...extra});
const run=async(page,wish,extraction)=>{await page.evaluate(x=>{mock.extraction=x;},extraction);await page.locator('#ncs-moment-wish').fill(wish);await page.locator('[data-action="extract"]').click();await idle(page);};
const freeOn=async page=>{await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="free"]').getAttribute('aria-pressed')==='true');};
const ask=page=>{const st={answer:true,asked:[]};page.removeAllListeners('dialog');page.on('dialog',d=>{st.asked.push(d.message());st.answer?d.accept():d.dismiss();});return st;};
const freeX=(people)=>({characters:people.map(c=>({id:'',name:'',subject:'boy',appearance:'',outfit:'',expression:'smile',action:'standing',position:'auto',...c})),location:'bridge',lighting:'night',camera:'wide shot',interaction:''});
const freeRun=async(page,text,x)=>{await page.evaluate(x=>{mock.extraction=x;},x);await page.locator('#ncs-free-text').fill(text);await page.locator('[data-action="extract"]').click();await idle(page);};
const cardIds=page=>page.locator('#ncs-characters [data-character]').evaluateAll(els=>els.map(e=>e.dataset.character));
const ticked=(page,id)=>page.locator(`[data-character="${id}"] [data-field="included"]`).isChecked();
const addTemp=async(page,name)=>{await page.locator('[data-action="add-temp"]').click();await page.locator('[data-temp="name"]').last().fill(name);};
const two={moments:[{title:'앉는 순간',characters:[{id:'leo',name:'Leo',expression:'calm',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''},
 {title:'일어나는 순간',characters:[{id:'leo',name:'Leo',expression:'calm',action:'standing up',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''}],defaultIndex:1,requestMatched:true,requestApplied:[],requestIgnored:[],requestOutfits:[],requestVisibleOnly:false};
const shown=page=>page.locator('#ncs-notice').isVisible();
const reply=(page,text)=>page.evaluate(t=>{mock.generateRaw=async function(o){this.extractCalls=(this.extractCalls??0)+1;this.lastExtract=o;return t;};},text);
const viewerReady=page=>page.waitForFunction(()=>{const d=document.getElementById('ncs-viewer'),i=d?.querySelector('.ncsv-stage img');return d?.open&&d.dataset.loaded&&i?.naturalWidth&&i.style.visibility!=='hidden';});
const holder='#chat .mes[mesid="1"] .ncs-inline-images';
const rows=page=>page.locator('#ncs-attach-dialog [data-attach-target]').evaluateAll(els=>els.map(e=>[Number(e.dataset.attachTarget),e.getAttribute('aria-pressed')==='true',e.querySelector('.ncs-target-meta').textContent]));
const confirm=page=>page.locator('#ncs-attach-dialog [data-action="attach-confirm"]');
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width);
  // A third message, so the drawing is made for #2.
  await page.evaluate(()=>{mock.chat.push({name:'Leo',mes:'Leo waves at the door.'});mock.renderChat();});
  await page.locator('[data-action="close"]').click();await page.locator('.ncs-launch-button').click();
  await page.locator('[data-action="extract"]').click();await idle(page);
  await page.locator('[data-action="generate"]').click();await idle(page);
  // --- The result: no message box any more; 본문에 넣기 opens the list, newest first, #2 (made for) chosen.
  assert.equal(await page.locator('[data-image-target],#ncs-history-target').count(),0,'no message dropdowns');
  await page.locator('#ncs-result [data-action="attach"]').click();await page.locator('#ncs-attach-dialog[open]').waitFor();
  let list=await rows(page);assert.deepEqual(list.map(r=>r[0]),[2,1,0],'newest first');assert.deepEqual(list.map(r=>r[1]),[true,false,false],'the made message is chosen');
  assert.match(list[0][2],/만든 메시지/);assert.equal(await confirm(page).innerText(),'#2에 넣기');
  const card=await page.locator('#ncs-attach-dialog .ncs-attach-card').boundingBox(),btn=await confirm(page).boundingBox();
  assert.ok(card.x>=0&&card.x+card.width<=width&&btn.y+btn.height<=900,'the box and 넣기 fit the screen');
  // Escape closes the list only.
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('ncs-attach-dialog').open);assert.equal(await page.locator('#naice-shot-dialog').evaluate(d=>d.open),true);
  // Pick #1 instead.
  await page.locator('#ncs-result [data-action="attach"]').click();await page.locator('[data-attach-target="1"]').click();
  assert.equal(await confirm(page).innerText(),'#1에 넣기');await confirm(page).click();
  await page.waitForFunction(()=>mock.chat[1].extra?.naice_shot_images?.length===1&&!document.getElementById('ncs-attach-dialog').open);
  await page.waitForFunction(()=>/#1 메시지에 그림을 넣었어요/.test(document.querySelector('#ncs-notice').innerText));
  // Opening it again: where it already is comes first.
  await page.locator('#ncs-result [data-action="attach"]').click();list=await rows(page);
  assert.deepEqual(list.find(r=>r[1])[0],1);assert.match(list.find(r=>r[0]===1)[2],/이미 넣음/);await page.locator('[data-action="attach-cancel"]').click();
  // --- 선택 본문에 넣기: two more pictures, both into #1 with one save.
  for(let i=0;i<2;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length===3);
  const sel=page.locator('[data-action="attach-selected"]');assert.equal(await sel.isDisabled(),true);
  const ids=await page.locator('[data-history-pick]').evaluateAll(els=>els.map(e=>e.dataset.historyPick));
  for(const id of ids.slice(0,2))await page.locator(`[data-history-pick="${id}"]`).check();
  assert.equal(await sel.innerText(),'본문에 넣기');assert.match(await page.locator('#ncs-history-count').innerText(),/2장 고름/);await sel.click(); // 0.1.88: short label, count in the count line
  assert.match(await page.locator('#ncs-attach-dialog small').innerText(),/선택된 2장을 넣어요/);
  assert.equal((await rows(page)).find(r=>r[1])?.[0],2,'both were made for #2');
  const saves=await page.evaluate(()=>mock.chatSaves??0);await page.locator('[data-attach-target="1"]').click();await confirm(page).click();
  await page.waitForFunction(()=>mock.chat[1].extra?.naice_shot_images?.length===3);
  assert.equal(await page.evaluate(()=>mock.chatSaves),saves+1,'one save');
  await page.waitForFunction(()=>/#1 메시지에 2장을 넣었어요/.test(document.querySelector('#ncs-notice').innerText));
  // --- From the enlarged view: ⋯ → 본문에 넣기 closes it and opens the list over the panel.
  await page.locator('[data-view-history]').first().click();await viewerReady(page);
  await page.locator('#ncs-viewer [data-v="more"]').click();await page.locator('#ncs-viewer .ncsv-more-items button',{hasText:'본문에 넣기'}).click();
  await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open&&document.getElementById('naice-shot-dialog').open&&document.getElementById('ncs-attach-dialog').open);
  await page.locator('[data-action="attach-cancel"]').click();
  // --- A picture whose message cannot be found: nothing chosen, 넣기 waits for a choice.
  await page.locator('[data-tab="scene"]').click();await page.locator('[data-action="generate"]').click();await idle(page);
  await page.evaluate(()=>{mock.chat.splice(2,1);mock.renderChat();});
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length===4);
  const last=await page.locator('[data-history-pick]').first().getAttribute('data-history-pick');
  await page.evaluate(id=>{const b=document.querySelector(`[data-history-attach="${id}"]`);b.click();},last);
  await page.locator('#ncs-attach-dialog[open]').waitFor();assert.equal((await rows(page)).filter(r=>r[1]).length,0);assert.equal(await confirm(page).isDisabled(),true);
  assert.equal(await confirm(page).innerText(),'넣을 메시지를 골라 주세요');await page.locator('[data-action="attach-cancel"]').click();
  await page.locator('[data-action="close"]').click();
  // --- 0.1.73: no swipe on 넘겨보기 — nothing in the strip is marked or holds touches back, so a swipe on it behaves
  // like a swipe on a single picture. (UI-071-01 no longer applies.)
  await page.waitForFunction(()=>document.querySelectorAll('#chat .mes[mesid="1"] .ncs-inline-image').length===3);
  assert.equal(await page.locator(`${holder} [data-swipe-ignore], ${holder} .ncs-inline-track`).count(),0);
  // A missing picture still shows its note and 빼기 in 넘겨보기.
  await page.route('**/user/images/naice-shot/**',r=>r.fulfill({status:404,body:''}));
  await page.evaluate(()=>{const e=mock.chat[1].extra.naice_shot_images;const g='99999999-9999-4999-8999-999999999999';mock.chat[1].extra.naice_shot_images=[{...e[0],id:g,image:`/user/images/naice-shot/${g}.png`},...e];});
  await page.evaluate(()=>{for(const h of document.querySelectorAll('.ncs-inline-images'))h.remove();});await page.locator('.ncs-launch-button').click();await page.locator('[data-action="close"]').click();
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .ncs-missing-note'));
  await page.unroute('**/user/images/naice-shot/**');
  await page.evaluate(()=>{const e=mock.chat[1].extra.naice_shot_images;mock.chat[1].extra.naice_shot_images=e.slice(1);for(const h of document.querySelectorAll('.ncs-inline-images'))h.remove();});
  await page.locator('.ncs-launch-button').click();await page.locator('[data-action="close"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#chat .mes[mesid="1"] .ncs-inline-open img').length===3&&!document.querySelector('#chat .ncs-missing-note'));
  // --- UI-071-03: sliding does not make NAIce Shot look through the whole chat again.
  await page.evaluate(()=>{window.__scans=0;const real=Element.prototype.querySelectorAll;Element.prototype.querySelectorAll=function(q){if(this.id==='chat'&&/\.mes\[mesid\]/.test(q))window.__scans++;return real.call(this,q);};});
  for(let step=0;step<2;step++)await page.locator(`${holder} .ncs-inline-slide-next`).click();
  await page.locator(`${holder} .ncs-inline-slide-prev`).click();await page.locator(`${holder} .ncs-inline-slide-next`).click();
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .ncs-inline-slide-count').textContent==='3 / 3');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__scans),0,'no chat re-scan while sliding');
  // --- UI-071-02: dates shown on some messages only — each message decides for itself.
  await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="settings"]').click();await page.evaluate(()=>{const d=document.getElementById('ncs-chat-image-more');if(d)d.open=true;});await page.locator('#ncs-message-button').check();await page.locator('[data-action="close"]').click();
  await page.evaluate(()=>{for(const m of document.querySelectorAll('#chat .mes')){const s=document.createElement('small');s.className='timestamp';s.textContent='2026. 1. 1. 오후 3:00';if(m.getAttribute('mesid')==='0')s.style.display='none';m.querySelector('.mes_block').prepend(s);}});
  await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="settings"]').click();await page.evaluate(()=>{const d=document.getElementById('ncs-chat-image-more');if(d)d.open=true;});await page.locator('#ncs-message-button').uncheck();await page.locator('#ncs-message-button').check();await page.locator('[data-action="close"]').click();
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .timestamp + .ncs-mes-draw')&&document.querySelector('#chat .mes[mesid="0"] .extraMesButtons .ncs-mes-draw'));
  assert.equal(await page.locator('#chat .ncs-mes-draw').count(),2,'one each');
  // The date of #0 shows later: its icon moves to the date on the next pass.
  await page.evaluate(()=>{document.querySelector('#chat .mes[mesid="0"] .timestamp').style.display='';mock.renderChat&&0;});
  await page.evaluate(()=>{const d=document.createElement('span');document.querySelector('#chat .mes[mesid="0"] .mes_block').append(d);});
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="0"] .timestamp + .ncs-mes-draw')&&!document.querySelector('#chat .mes[mesid="0"] .extraMesButtons .ncs-mes-draw'));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: 본문에 넣기 opens the message list (newest first, made message chosen and marked, 이미 넣음 marked, Escape closes only the list), 선택 본문에 넣기 puts two pictures in with one save, the enlarged view opens the same list, an unknown message waits for a choice; sliding re-scans nothing; message icons follow each message\'s own date (375/1100)');
}finally{await browser.close();server.close();}
