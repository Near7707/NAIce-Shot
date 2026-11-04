// v0.1.70: the enlarged view in the user's layout (all enlarged pictures), chat pictures moving within their message,
// 이력에서 보기, the window button, the wardrobe name box, the look edited on the card, 직접 입력 first, UI-069-01.
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
const rect=(page,sel)=>page.locator(sel).boundingBox();
const menuLabels=page=>page.locator('#ncs-viewer .ncsv-more-items button').allInnerTexts().then(t=>t.map(x=>x.split('\n')[0]));
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width);const st=ask(page);
  for(let i=0;i<3;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  // Two pictures in message #1.
  for(let i=0;i<2;i++){await page.locator('#ncs-result [data-image-target]').selectOption('1');await page.locator('[data-action="attach"]').click();await page.waitForTimeout(150);if(i===0){await page.locator('[data-action="generate"]').click();await idle(page);}}
  await page.waitForFunction(()=>document.querySelectorAll('#chat .mes[mesid="1"] .ncs-inline-open').length===2);
  // --- History picture: layout.
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=3);
  await page.locator('[data-view-history]').nth(1).click();await viewerReady(page);
  assert.deepEqual(await page.locator('#ncs-viewer .ncsv-modes button').allInnerTexts(),['맞춤','원본']);
  const bar=await rect(page,'#ncs-viewer .ncsv-bar'),zoom=await rect(page,'#ncs-viewer .ncsv-zooms');
  assert.ok(Math.abs(zoom.x+zoom.width/2-(bar.x+bar.width/2))<=2,`zoom in the middle of the top row`);assert.ok(bar.height<=46,`thin top row (${bar.height})`);
  assert.equal(await page.locator('#ncs-viewer [data-v="panel"]').isVisible(),true,'window button on top');
  const nav=await rect(page,'#ncs-viewer .ncsv-navigation'),tools=await rect(page,'#ncs-viewer .ncsv-tools'),more=await rect(page,'#ncs-viewer [data-v="more"]'),saveG=await rect(page,'#ncs-viewer .ncsv-save-group');
  assert.ok(Math.abs(nav.x+nav.width/2-(tools.x+tools.width/2))<=2,`‹ n/m › exactly in the middle (${Math.round(nav.x+nav.width/2)} of ${Math.round(tools.x+tools.width/2)})`);
  assert.ok(more.x<nav.x&&nav.x+nav.width<=saveG.x,'⋯ | ‹ n/m › | 저장 · 삭제, no overlap');assert.ok(tools.height<=56,'one line');
  assert.match(await page.locator('#ncs-viewer .ncsv-prompt summary').innerText(),/프롬프트 보기/);
  assert.equal(await page.locator('#ncs-viewer .ncsv-meta').isVisible(),false,'date folded away');assert.equal(await page.locator('#ncs-viewer [data-v="detach"]').isVisible(),false,'no 빼기 for a history picture');
  assert.equal(await page.locator('#ncs-viewer [data-v="jump"]').isVisible(),false,'메시지로 가기 is not in row 2');
  // Info covers the picture, not the buttons, and does not move the picture.
  const stageBefore=await rect(page,'#ncs-viewer .ncsv-stage');await page.locator('#ncs-viewer .ncsv-prompt summary').click();await page.waitForFunction(()=>document.querySelector('#ncs-viewer .ncsv-prompt-text').textContent.length>0);
  const body=await rect(page,'#ncs-viewer .ncsv-prompt-body'),stageAfter=await rect(page,'#ncs-viewer .ncsv-stage'),toolsNow=await rect(page,'#ncs-viewer .ncsv-tools');
  assert.deepEqual([stageAfter.y,stageAfter.height],[stageBefore.y,stageBefore.height],'the picture area is not pushed');assert.ok(body.y+body.height<=toolsNow.y+1,'covers the picture, not row 1');
  assert.match(await page.locator('#ncs-viewer .ncsv-meta').innerText(),/^\d{4}\. \d+\. \d+\. (오전|오후) \d+:\d\d$/,'date and time only');
  const seed=await rect(page,'#ncs-viewer [data-v="seed"]'),copy=await rect(page,'#ncs-viewer [data-v="copy"]');assert.ok(Math.abs(seed.y-copy.y)<=2,'seed and prompt copy on one line');
  assert.match(await page.locator('#ncs-viewer .ncsv-prompt-text').innerText(),/^모델: /);
  await page.locator('#ncs-viewer .ncsv-prompt summary').click();
  // ⋯ = the history card's ⋯, ending with 메시지로 가기.
  await page.locator('#ncs-viewer [data-v="more"]').click();const labels=await menuLabels(page);
  assert.deepEqual(labels.slice(0,4),['챗샷으로 보내기','프리샷으로 보내기','설정을 프리셋으로','본문에 넣기']);assert.match(labels.at(-1),/메시지로 가기/);
  const mm=await rect(page,'#ncs-viewer .ncsv-more-menu');assert.ok(mm.y+mm.height<=toolsNow.y+1&&mm.x>=0&&mm.x+mm.width<=width,'menu opens upward inside the screen');
  await page.locator('#ncs-viewer .ncsv-more-items button',{hasText:'프리샷으로 보내기'}).click();
  await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open&&document.querySelector('[data-mode="free"]').getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('[data-tab="scene"]').getAttribute('aria-selected'),'true','sent to 프리샷 and shown on 그리기');
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  // --- Chat pictures: the message's pictures move together; row 2 has 이 메시지에서 빼기; ⋯ ends with 이력에서 보기.
  await page.locator('[data-action="close"]').click();
  await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').first().click();await viewerReady(page);
  assert.equal(await page.locator('#ncs-viewer .ncsv-position').innerText(),'1 / 2');await page.locator('#ncs-viewer [data-v="next"]').click();
  await page.waitForFunction(()=>document.querySelector('#ncs-viewer .ncsv-position').textContent==='2 / 2');
  assert.equal(await page.locator('#ncs-viewer .ncsv-prompt-row [data-v="detach"]').isVisible(),true);
  await page.locator('#ncs-viewer [data-v="more"]').click();assert.match((await menuLabels(page)).at(-1),/^이력에서 보기/);
  const shown=await page.evaluate(()=>document.querySelector('#ncs-viewer .ncsv-stage img').getAttribute('src').match(/([\w-]+)\.png/)[1]);
  await page.locator('#ncs-viewer .ncsv-more-items button',{hasText:'이력에서 보기'}).click();
  await page.waitForFunction(()=>document.getElementById('naice-shot-dialog').open&&!document.getElementById('ncs-viewer').open);
  assert.equal(await page.locator('[data-tab="history"]').getAttribute('aria-selected'),'true');
  await page.waitForFunction(id=>document.querySelector(`[data-view-history="${id}"]`)?.closest('.ncs-history-card')?.classList.contains('ncs-card-found'),shown);
  // The window button closes the view and opens the panel.
  await page.locator('[data-action="close"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').first().click();await viewerReady(page);
  await page.locator('#ncs-viewer [data-v="panel"]').click();await page.waitForFunction(()=>document.getElementById('naice-shot-dialog').open&&!document.getElementById('ncs-viewer').open);
  // --- Drawing tab: the wardrobe name box sits right under its button; the look is edited here for this picture only.
  await page.locator('[data-tab="scene"]').click();
  const card=page.locator('[data-character="leo"]'),to=card.locator('[data-to-wardrobe="leo"]');await to.scrollIntoViewIfNeeded();await to.click();
  const tb=await to.boundingBox(),nb=await card.locator('.ncs-wardrobe-save').boundingBox();assert.ok(nb.y>=tb.y+tb.height-1&&nb.y-(tb.y+tb.height)<=24,`name box right under the button (${Math.round(nb.y-(tb.y+tb.height))}px)`);
  await card.locator('[data-wardrobe-cancel]').click();
  await card.locator('.ncs-fixed-look summary').click();const look=card.locator('[data-look-field="appearance"]');
  const before=await look.inputValue();await look.fill(before+', freckles');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.some(c=>/freckles/.test(c.prompt)));
  assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo').appearance),before,'the profile is not changed');
  assert.equal(await card.locator('.ncs-look-edited').isVisible(),true);await card.locator('[data-look-reset="leo"]').click();
  await page.waitForFunction(()=>!JSON.parse(document.querySelector('#ncs-final').value).characters.some(c=>/freckles/.test(c.prompt)));
  assert.equal(await page.locator('[data-character="leo"] [data-look-field="appearance"]').inputValue(),before);
  // --- A new profile starts on 직접 입력.
  await page.locator('[data-tab="profiles"]').click();assert.equal(await page.locator('[data-profile-mode="direct"]').getAttribute('aria-pressed'),'true');
  // --- UI-069-01: ↻ locks as soon as a check starts.
  await page.locator('[data-tab="scene"]').click();let release;
  await page.route('**/api/plugins/naice-shot/status**',async r=>{await new Promise(res=>release=res);r.fallback();});
  await page.locator('[data-action="refresh-anlas"]').click();await page.waitForTimeout(30);
  assert.equal(await page.locator('[data-action="refresh-anlas"]').isDisabled(),true,'locked at once');release();
  await page.waitForFunction(()=>!document.querySelector('[data-action="refresh-anlas"]').disabled);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: enlarged view — thin top row with the zoom in the middle and the window button, ⋯ | ‹ n/m › centred | 저장 · 삭제, info covers the picture only with date/time and copy buttons on one line, ⋯ like the history card; chat pictures move within the message, 이 메시지에서 빼기 in row 2, 이력에서 보기 rings the card; window button opens the panel; wardrobe name box under its button; look edited for this picture only and reset; profile form starts on 직접 입력; ↻ locks at once (375/1100)');
}finally{await browser.close();server.close();}
