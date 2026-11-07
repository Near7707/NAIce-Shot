// v0.1.64: GPT's 0.1.63 review (viewer target while the next picture loads, no empty frame, tap-to-close click,
// notices) and "연결된 메시지 없음" in the viewer.
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
const idle=page=>page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&!document.querySelector('[data-action="generate"]').disabled); // 0.1.92: V5 checks the server first (buttons off, no banner)
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
const pos=page=>page.locator('.ncsv-position').innerText();
const shownImg=page=>page.evaluate(()=>{const i=document.querySelector('#ncs-viewer .ncsv-stage img');return {src:i.getAttribute('src'),w:i.naturalWidth,hidden:i.style.visibility==='hidden',href:document.querySelector('#ncs-viewer .ncsv-save').getAttribute('href'),seed:document.querySelector('#ncs-viewer [data-v="seed"]').textContent};});
const sample=page=>page.evaluate(()=>{window.__frames=[];const tick=()=>{const i=document.querySelector('#ncs-viewer .ncsv-stage img');if(!i)return;
  window.__frames.push(i.style.visibility==='hidden'||!i.naturalWidth||!i.style.transform?'empty':`${i.naturalWidth}x${i.naturalHeight}:${i.style.width}`);if(window.__sampling)requestAnimationFrame(tick);};window.__sampling=true;requestAnimationFrame(tick);});
const frames=page=>page.evaluate(()=>{window.__sampling=false;return window.__frames;});
const viewerReady=page=>page.waitForFunction(()=>{const d=document.getElementById('ncs-viewer'),i=d?.querySelector('.ncsv-stage img');return d?.open&&d.dataset.loaded&&i?.naturalWidth&&i.style.visibility!=='hidden';});
try{
 for(const width of [375,1100]){// UI-063-01 + UI-063-05: while the next picture loads, the shown one keeps its target; then all switch at once with no empty frame.
  const {page,errors}=await open(width);ask(page);
  for(let i=0;i<3;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  const deletes=[];page.on('request',r=>{if(r.url().endsWith('/delete'))deletes.push(r.postDataJSON());});
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=3);
  await page.locator('[data-view-history]').first().click();await viewerReady(page);
  const a=await shownImg(page);
  // The next picture is slow to arrive (the history thumbnails already hold the file, so its decoding is held back).
  await page.evaluate(()=>{const real=HTMLImageElement.prototype.decode;window.__hold=new Promise(r=>window.__release=r);
   HTMLImageElement.prototype.decode=async function(){const h=window.__hold;await real.call(this);if(h)await h;};});
  await page.locator('[data-v="next"]').click();await page.waitForFunction(()=>/불러오는 중/.test(document.querySelector('.ncsv-toast').textContent)&&!document.querySelector('.ncsv-toast').hidden);
  const waiting=await shownImg(page);
  assert.equal(waiting.src,a.src,'the shown picture stays');assert.equal(waiting.href,a.href,'save link still the shown picture');assert.equal(waiting.seed,a.seed,'seed still the shown picture');
  assert.equal(await page.locator('[data-v="delete"]').isDisabled(),true,'삭제 waits while the next picture loads');
  await page.locator('[data-v="delete"]').evaluate(b=>b.click());await page.waitForTimeout(100);assert.equal(deletes.length,0,'no delete sent for a picture not shown');
  await page.evaluate(()=>{const r=window.__release;window.__hold=null;r();});await page.waitForFunction(()=>document.querySelector('.ncsv-toast').hidden);
  const b=await shownImg(page);assert.notEqual(b.src,a.src);assert.notEqual(b.href,a.href);assert.notEqual(b.seed,a.seed);
  // Deleting now takes the shown picture.
  await page.locator('[data-v="delete"]').click();await page.waitForFunction(()=>document.querySelector('.ncsv-position').textContent.endsWith('/ 2'));
  assert.ok(b.src.includes(deletes.at(-1).ids[0]),'the deleted picture is the one that was on screen');
  // Moving between portrait, landscape and square pictures that are never cached: no empty or mis-sized frame.
  await page.locator('[data-v="close"]').click();
  for(let i=0;i<2;i++){await page.locator('[data-tab="scene"]').click();await page.locator('[data-action="generate"]').click();await idle(page);}
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=4);
  await page.locator('[data-view-history]').first().click();await viewerReady(page);
  await sample(page);
  for(const dir of ['next','next','next','previous','previous']){const at=await pos(page);await page.locator(`[data-v="${dir}"]`).click();await page.waitForFunction(t=>document.querySelector('.ncsv-position').textContent!==t,at);await page.waitForTimeout(60);}
  const f=await frames(page);assert.ok(f.length>20,'frames sampled');assert.ok(!f.includes('empty'),`no empty frame (${f.filter(x=>x==='empty').length} of ${f.length})`);
  assert.ok(f.every(x=>{const [n,css]=x.split(':');return css===`${n.split('x')[0]}px`;}),'each frame shows the picture at its own size');
  assert.ok(new Set(f.map(x=>x.split(':')[0])).size>=2,'pictures of different shapes were shown');
  assert.deepEqual(errors,[]);await page.close();
 }
 for(const width of [375,1100]){// UI-063-02: a tap on empty space closes only after its own click, which never reaches what lies underneath.
  const {page,errors}=await open(width);ask(page);
  await page.locator('[data-action="generate"]').click();await idle(page);
  await page.locator('[data-action="attach"]').click();await page.locator('[data-attach-target="1"]').click();await page.locator('[data-action="attach-confirm"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').waitFor();
  await page.locator('[data-action="close"]').click();
  for(let round=0;round<3;round++){
   await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').click();await viewerReady(page);
   const r=await page.evaluate(async()=>{const d=document.getElementById('ncs-viewer'),s=d.querySelector('.ncsv-stage'),b=s.getBoundingClientRect(),x=b.left+4,y=b.top+4;
    let reached=0;const count=()=>reached++;document.addEventListener('click',count);
    const send=t=>s.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:7,pointerType:'touch',clientX:x,clientY:y,button:0}));
    send('pointerdown');send('pointerup');
    await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0)); // the old close ran here, before the click
    const target=document.elementFromPoint(x,y),inside=!!target?.closest('#ncs-viewer');target?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y}));
    await new Promise(r=>setTimeout(r,50));document.removeEventListener('click',count);return {inside,reached,open:d.open};});
   assert.equal(r.inside,true,`round ${round}: the tap's click lands on the viewer, not under it`);assert.equal(r.reached,0,'that click is swallowed');assert.equal(r.open,false,'and the viewer is closed');
  }
  // A tap whose click never comes still closes.
  await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').click();await viewerReady(page);
  await page.locator('#ncs-viewer .ncsv-stage').evaluate(s=>{const b=s.getBoundingClientRect();for(const t of ['pointerdown','pointerup'])s.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:8,pointerType:'touch',clientX:b.left+4,clientY:b.top+4,button:0}));});
  await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open,null,{timeout:2000});
  assert.deepEqual(errors,[]);await page.close();
 }
 {// (가) 연결된 메시지 없음: a picture with no recorded message says so in a small line; one with a message keeps 메시지로 가기.
  const {page,errors,items}=await open(375);ask(page);
  for(let i=0;i<2;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  items[0].snapshot={...items[0].snapshot,scene:{...items[0].snapshot.scene,source:null}}; // made from the saved prompt, without 장면 추출
  await page.locator('[data-tab="history"]').click();await page.locator('.ncs-refresh-button').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=2);
  await page.locator('[data-view-history]').first().click();await viewerReady(page);
  // 0.1.70: no line in the viewer any more; ⋯ ends with a disabled 메시지로 가기 that gives the reason (like the history card).
  const moreItems=page.locator('#ncs-viewer .ncsv-more-items button'),last=()=>moreItems.last();
  await page.locator('#ncs-viewer [data-v="more"]').click();
  assert.equal(await last().isDisabled(),true);assert.match(await last().innerText(),/^메시지로 가기\n장면 추출 없이 만들었거나 예전 그림이라 연결된 메시지가 없어요/);
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#ncs-viewer').evaluate(d=>d.scrollWidth<=d.clientWidth+1),'no sideways scroll');
  await page.locator('[data-v="next"]').click();await page.waitForFunction(()=>/2 \//.test(document.querySelector('.ncsv-position').textContent));
  await page.locator('#ncs-viewer [data-v="more"]').click();assert.equal(await last().isDisabled(),false,'a picture with a message: 메시지로 가기 works');await page.keyboard.press('Escape');
  // A chat picture is opened from its own message: ⋯ ends with 이력에서 보기, and row 2 has 이 메시지에서 빼기.
  await page.locator('[data-v="close"]').click();await page.locator('[data-tab="scene"]').click();
  await page.locator('[data-action="attach"]').click();await page.locator('[data-attach-target="1"]').click();await page.locator('[data-action="attach-confirm"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').waitFor();
  await page.locator('[data-action="close"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').click();await viewerReady(page);
  await page.locator('#ncs-viewer [data-v="more"]').click();assert.match(await last().innerText(),/^이력에서 보기/);await page.keyboard.press('Escape');
  assert.equal(await page.locator('#ncs-viewer .ncsv-prompt-row [data-v="detach"]').isVisible(),true);
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-063-03: the 프리샷 result notice stays on 그리기, even if the user moved to 설정 while it ran. UI-063-04: the 챗샷 English warning stays.
  const {page,errors}=await open(375,{clock:true});ask(page);
  await freeOn(page);await addTemp(page,'Robin');const robin=await page.locator('.ncs-temp').last().getAttribute('data-character');
  await page.locator(`[data-character="${robin}"] [data-temp="appearance"]`).fill('short grey hair');
  await page.evaluate(x=>{let done;mock.generateRaw=async function(){this.extractCalls=(this.extractCalls??0)+1;await new Promise(r=>done=r);return JSON.stringify(x);};mock.finishExtraction=()=>done();},freeX([{id:'leo',name:'Leo',expression:'laughing'}]));
  await page.locator('#ncs-free-text').fill('레오가 웃는다');await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-progress').hidden);
  await page.locator('[data-tab="settings"]').click();await page.evaluate(()=>mock.finishExtraction());await idle(page);
  assert.doesNotMatch(await page.locator('#ncs-notice').innerText().catch(()=>''),/글에 없는 카드/,'not on 설정');
  await page.locator('[data-tab="scene"]').click();assert.match(await page.locator('#ncs-notice').innerText(),/글에 없는 카드를 지웠어요: Robin/);
  await page.clock.fastForward(30000);assert.equal(await shown(page),true,'kept on 그리기');
  // 챗샷: Korean twice → the warning to fix stays.
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  await reply(page,JSON.stringify(one(leo({action:'책을 읽는다'}))));await page.locator('[data-action="extract"]').click();await idle(page);
  assert.match(await page.locator('#ncs-notice').innerText(),/영어로 바뀌지 않은 칸이 있어요[\s\S]*직접 고치거나 다시 추출해 주세요/);
  await page.clock.fastForward(30000);assert.equal(await shown(page),true,'the English warning stays');
  // An all-English reply still folds.
  await reply(page,JSON.stringify(one(leo())));await page.locator('[data-action="extract"]').click();await idle(page);
  await page.clock.fastForward(30000);assert.equal(await shown(page),false,'a plain success folds');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: viewer keeps the shown picture as the target until the next is ready, switches all at once with no empty frame (375/1100), delete waits; a tap on empty space closes after its own click (375/1100); 연결된 메시지 없음 with its reason; 프리샷 result notice stays on 그리기; 챗샷 English warning stays');
}finally{await browser.close();server.close();}
