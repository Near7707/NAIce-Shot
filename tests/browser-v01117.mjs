// v0.1.117: the @ fields are plain textareas (iPhone Safari would not type into the contenteditable box inside SillyTavern);
// the links stay by place (twins kept apart, text right after a link keeps it, an edit inside ends it). GPT review of
// 0.1.113~0.1.116: a history error stays in the history tab; swipe-down closes only by touch at fit size; a touch double tap
// toggles the size once.
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
const viewerReady=page=>page.waitForFunction(()=>{const d=document.getElementById('ncs-viewer'),i=d?.querySelector('.ncsv-stage img');return d?.open&&d.dataset.loaded&&i?.naturalWidth&&i.style.visibility!=='hidden';});
const holdDecode=page=>page.evaluate(()=>{const real=HTMLImageElement.prototype.decode;window.__hold=new Promise(r=>window.__release=r);
 HTMLImageElement.prototype.decode=async function(){const h=window.__hold;await real.call(this);if(h)await h;};});
const releaseDecode=page=>page.evaluate(()=>{const r=window.__release;window.__hold=null;r?.();});
// One touch drag on the viewer stage, from a point to a point (several moves in between).
const drag=(page,fx,fy,tx,ty,id)=>page.locator('#ncs-viewer .ncsv-stage').evaluate((s,[fx,fy,tx,ty,id])=>{const b=s.getBoundingClientRect(),x0=b.left+b.width*fx,y0=b.top+b.height*fy,x1=b.left+b.width*fx+tx,y1=b.top+b.height*fy+ty;
 const send=(t,x,y)=>s.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0}));
 send('pointerdown',x0,y0);for(let i=1;i<=5;i++)send('pointermove',x0+(x1-x0)*i/5,y0+(y1-y0)*i/5);send('pointerup',x1,y1);},[fx,fy,tx,ty,id]);
const isOpen=page=>page.evaluate(()=>document.getElementById('ncs-viewer').open);
const tok=(name,id)=>`@[${name}](ref:${id})`;
const val=(page,sel)=>page.locator(sel).evaluate(f=>f.value);
const ids=(page,sel)=>page.locator(sel).evaluate(f=>[...f.value.matchAll(/\(ref:([A-Za-z0-9_-]*)\)/g)].map(m=>m[1]));
const caret=(page,sel,at)=>page.locator(sel).evaluate((f,a)=>{f.focus();const n=a<0?f.textLength:a;f.setSelectionRange(n,n);},at);
const W='#ncs-moment-wish',F='#ncs-free-text';
const fitPressed=page=>page.locator('#ncs-viewer [data-v="fit"]').getAttribute('aria-pressed');
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{extra:true});ask(page);
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.push({id:'leo2',name:'Leo',aliases:[],subject:'boy',appearance:'blond hair',defaultOutfit:'',positive:'',negative:'',cardKey:''});});
  // --- The two @ fields are textareas with the seen-length limit of the box itself.
  assert.deepEqual(await page.evaluate(()=>['ncs-moment-wish','ncs-free-text'].map(i=>{const f=document.getElementById(i);return [f.tagName,f.maxLength];})),[['TEXTAREA',200],['TEXTAREA',4000]]);
  await page.locator(W).click();await page.keyboard.type('Mira waves');assert.equal(await val(page,W),'Mira waves');
  // One line: Enter adds no line break (no list open).
  await page.keyboard.press('Enter');assert.equal(await val(page,W),'Mira waves');
  // It grows with wrapped text.
  const h0=await page.locator(W).evaluate(f=>f.offsetHeight);
  await page.locator(W).fill('');await page.locator(W).focus();await page.keyboard.type('비 오는 밤 '.repeat(14));
  assert.ok(await page.locator(W).evaluate(f=>f.offsetHeight)>h0+10,`${width}px: the one-line request grows`);
  assert.equal(await page.locator(W).evaluate(f=>f.scrollHeight<=f.clientHeight+1),true,'all of it is seen');
  // --- Twins stay apart: two "Leo" links keep their own ids through a save form round trip and typing after them.
  await page.locator(W).evaluate((f,t)=>{f.value=t;},`${tok('Leo','leo')}와 ${tok('Leo','leo2')}`);
  assert.equal(await page.locator(W).evaluate(f=>HTMLTextAreaElement.prototype.__lookupGetter__('value').call(f)),'@Leo와 @Leo','seen as @name');
  await caret(page,W,-1);await page.keyboard.type('가 걷는다');
  assert.equal(await val(page,W),`${tok('Leo','leo')}와 ${tok('Leo','leo2')}가 걷는다`);
  // A picked name keeps its link with a letter typed right after it (like text after a chip).
  await page.locator(W).fill('');await page.locator(W).focus();await page.keyboard.type('@Mi');
  await page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').first().waitFor();await page.keyboard.press('Enter');
  assert.equal(await val(page,W),tok('Mira','mira')+' ');
  await page.waitForTimeout(50);assert.equal(await page.locator('#ncs-ref-list').isHidden(),true,'a picked name does not open the list again');
  // The same letter as the name's last one typed right after it (the caret tells where the edit was).
  await page.keyboard.press('Backspace');await page.keyboard.type('a');assert.equal(await val(page,W),tok('Mira','mira')+'a');
  await page.keyboard.press('Backspace');await page.keyboard.type('님');
  assert.equal(await val(page,W),tok('Mira','mira')+'님','text right after keeps the link');
  // iPhone Hangul: the keyboard deletes the last letter and puts the joined one back (no composition events).
  await page.locator(W).evaluate(f=>{f.focus();f.setSelectionRange(f.textLength-1,f.textLength);document.execCommand('insertText',false,'님이');});
  assert.equal(await val(page,W),tok('Mira','mira')+'님이');
  // An "@" typed right before a link moves the link along; a letter typed inside a link ends it.
  await caret(page,W,0);await page.keyboard.type('@');
  assert.equal(await val(page,W),'@'+tok('Mira','mira')+'님이','the link moved along');
  await caret(page,W,3);await page.keyboard.type('x');
  assert.deepEqual(await ids(page,W),[],'an edit inside ends the link');assert.equal(await page.locator(W).evaluate(f=>f.textLength),'@@Mxira님이'.length);
  await page.locator(W).fill('');
  // The 프리샷 box takes typing and line breaks.
  await freeOn(page);await page.locator(F).fill('');await page.locator(F).focus();await page.keyboard.type('첫 줄');await page.keyboard.press('Enter');await page.keyboard.type('둘째');
  assert.equal(await val(page,F),'첫 줄\n둘째');await page.locator(F).fill('');
  await page.locator('[data-mode="chat"]').click();
  // --- GPT 0.1.116 P3-1: a history read started on the history tab fails after a move to 설정: its error stays with 이력.
  for(let i=0;i<2;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  let release;const gate=new Promise(r=>{release=r;});
  await page.route('**/api/plugins/naice-shot/history?*',async r=>{await gate;return r.fulfill({status:503,json:{error:'mock history busy'}});});
  await page.locator('[data-tab="history"]').click();await page.locator('[data-tab="settings"]').click();
  release();await page.waitForTimeout(300);
  assert.equal(await page.locator('#ncs-notice').evaluate(n=>n.hidden||!/busy|이력/.test(n.textContent)),true,`${width}px: no history error in 설정`);
  await page.unroute('**/api/plugins/naice-shot/history?*');
  await page.locator('[data-tab="history"]').click();
  assert.equal(await page.locator('#ncs-notice').evaluate(n=>!n.hidden&&/mock history busy/.test(n.textContent)),true,`${width}px: the error waits in 이력`);await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=2);
  // --- The viewer.
  const view=async()=>{await page.locator('[data-view-history]').first().click();await viewerReady(page);};
  const stage=(t,pts)=>page.locator('#ncs-viewer .ncsv-stage').evaluate((s,[t,pts])=>{const b=s.getBoundingClientRect();
   for(const [type,fx,fy,id,kind] of pts)(type==='dblclick'?s.querySelector('img'):s).dispatchEvent(type==='dblclick'?new MouseEvent('dblclick',{bubbles:true,clientX:b.left+b.width*fx,clientY:b.top+b.height*fy})
    :new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:kind,clientX:b.left+b.width*fx,clientY:b.top+b.height*fy,button:0}));},[t,pts]);
  // P3-3: a pen drag down does not close it.
  await view();
  await stage(0,[['pointerdown',.5,.3,31,'pen'],['pointermove',.5,.4,31,'pen'],['pointermove',.5,.5,31,'pen'],['pointermove',.5,.6,31,'pen'],['pointerup',.5,.6,31,'pen']]);
  await page.waitForTimeout(100);assert.equal(await isOpen(page),true,`${width}px: a pen drag stays`);
  // P3-3: zoomed in before the finger lifts: no close.
  await stage(0,[['pointerdown',.5,.3,32,'touch'],['pointermove',.5,.45,32,'touch']]);
  await page.locator('#ncs-viewer [data-v="original"]').evaluate(b=>b.click());
  await stage(0,[['pointermove',.5,.6,32,'touch'],['pointerup',.5,.6,32,'touch']]);
  await page.waitForTimeout(100);assert.equal(await isOpen(page),true,`${width}px: zoomed before lifting stays`);
  // Still: a plain touch swipe down at fit size closes it.
  await page.locator('#ncs-viewer [data-v="fit"]').click();
  await drag(page,.5,.3,0,140,33);await page.waitForTimeout(100);assert.equal(await isOpen(page),false,`${width}px: a touch swipe down still closes`);
  // P3-4: a touch double tap on the picture toggles once, even with the browser's dblclick after it.
  await view();assert.equal(await fitPressed(page),'true');
  await page.locator('#ncs-viewer .ncsv-stage img').evaluate(img=>{const b=img.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,s=img.parentElement;
   const p=(t,id)=>img.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0}));
   p('pointerdown',41);p('pointerup',41);p('pointerdown',42);p('pointerup',42);img.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:x,clientY:y}));});
  await page.waitForTimeout(100);assert.equal(await fitPressed(page),'false',`${width}px: one toggle, not two`);
  // A mouse double click a moment later still toggles (back to fit).
  await page.waitForTimeout(700);
  await page.locator('#ncs-viewer .ncsv-stage img').evaluate(img=>{const b=img.getBoundingClientRect();img.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:b.left+b.width/2,clientY:b.top+b.height/2}));});
  assert.equal(await fitPressed(page),'true','a mouse double click still toggles');
  await page.locator('#ncs-viewer [data-v="close"]').click();
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: @ fields are textareas (limit, one line, grows); twin links stay apart; a link survives text after it and iPhone-style Hangul; an edit inside ends it; history errors stay in 이력; pen/zoomed drags do not close; a touch double tap toggles once');
}finally{await browser.close();server.close();}
