// v0.1.155 (GPT 0.1.154 P2·P3-1): with little room above and under the field (a phone keyboard), the @ list goes to the
// side with more room and is cut to it: it never covers the field and its last item can be reached. A field scrolled out of
// what is seen closes the list.
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
 // A stand-in visualViewport: the real one unless a test sets window.__vvTop / window.__vvH (a keyboard taking the bottom).
 await page.addInitScript(()=>{const real=window.visualViewport,t=new EventTarget();
  for(const [k,f] of Object.entries({offsetTop:()=>window.__vvTop??real?.offsetTop??0,height:()=>window.__vvH??real?.height??innerHeight,width:()=>real?.width??innerWidth,offsetLeft:()=>0,pageTop:()=>scrollY,pageLeft:()=>scrollX,scale:()=>1}))Object.defineProperty(t,k,{get:f});
  Object.defineProperty(window,'visualViewport',{value:t,configurable:true});window.__vvEvent=type=>t.dispatchEvent(new Event(type));});
 if(extra)await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{for(const [id,name] of [['mira','Mira'],['ada','Ada'],['adam','Adam'],['alba','Alba'],['alex','Alex'],['ana','Ana'],['andy','Andy'],['ari','Ari'],['asa','Asa']])mock.extensionSettings.naice_shot.profiles.push({id,name,aliases:[],subject:'girl',appearance:'long black hair',defaultOutfit:'',positive:'',negative:'',cardKey:''});}));
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
const pillsOf=(page,field)=>page.evaluate(id=>{const b=document.querySelector(`[data-pills-for="${id}"]`);
 return {hidden:b.hidden||!b.getClientRects().length,pills:[...b.querySelectorAll('.ncs-ref-pill')].map(p=>({name:p.querySelector('b').textContent,note:p.querySelector('small')?.textContent??'',broken:p.classList.contains('ncs-ref-pill-broken')}))};},field);
const waitPills=(page,field,names)=>page.waitForFunction(([id,names])=>{const b=document.querySelector(`[data-pills-for="${id}"]`);
 return JSON.stringify([...b.querySelectorAll('.ncs-ref-pill b')].map(x=>x.textContent))===JSON.stringify(names);},[field,names]);
const rects=page=>page.evaluate(()=>{const f=document.getElementById('ncs-moment-wish').getBoundingClientRect(),b=document.getElementById('ncs-ref-list').getBoundingClientRect();return {fTop:f.top,fBottom:f.bottom,lTop:b.top,lBottom:b.bottom};});
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<=2,`${msg}: ${a} vs ${b}`);
const list=page=>page.evaluate(()=>{const b=document.getElementById('ncs-ref-list');return {hidden:b.hidden,max:b.style.maxHeight,h:b.getBoundingClientRect().height,count:b.querySelectorAll('.ncs-ref-item').length};});
const seen=page=>page.evaluate(()=>({top:visualViewport.offsetTop,bottom:visualViewport.offsetTop+visualViewport.height}));
// The list scrolled to its end: where its last item is.
const lastItem=page=>page.evaluate(()=>{const b=document.getElementById('ncs-ref-list');b.scrollTop=b.scrollHeight;const it=[...b.querySelectorAll('.ncs-ref-item')].pop();const r=it.getBoundingClientRect();return {top:r.top,bottom:r.bottom,name:it.querySelector('b').textContent};});
try{
 for(const width of [320,375,1100]){
  const {page,errors}=await open(width,{extra:true});ask(page);
  const set=(sel,v)=>page.locator(sel).evaluate((f,v)=>{f.value=v;},v);
  const WID='ncs-moment-wish';
  const openList=async()=>{await set(W,'');await caret(page,W,0);await page.keyboard.type('@');await page.waitForFunction(()=>!document.getElementById('ncs-ref-list').hidden);};
  const room=async(up,down)=>{const fb=await page.locator(W).boundingBox();await page.evaluate(([t,h])=>{window.__vvTop=t;window.__vvH=h;},[Math.round(fb.y-up),Math.round(up+fb.height+down)]);};
  const reset=()=>page.evaluate(()=>{window.__vvTop=undefined;window.__vvH=undefined;window.__vvEvent('resize');});
  // --- plenty of room: the whole list (8 suggestions) under the field, no cut
  const full=await(async()=>{await openList();const r=await rects(page),l=await list(page);near(r.lTop,r.fBottom+4,'under the field');assert.equal(l.max,'');assert.equal(l.count,8);await page.keyboard.press('Escape');return l.h;})();
  // --- little room on both sides, more above (about 320px seen): above the field, cut, not covering it, last item reachable
  {await room(150,60);await openList();const r=await rects(page),l=await list(page),v=await seen(page);
   assert.ok(l.h<full-1,`cut: ${l.h} of ${full}`);assert.ok(r.lBottom<=r.fTop+0.5,`not covering the field: ${r.lBottom} > ${r.fTop}`);
   assert.ok(r.lTop>=v.top-0.5,'inside what is seen');near(r.lBottom,r.fTop-4,'just above the field');
   const last=await lastItem(page);assert.ok(last.top>=v.top-0.5&&last.bottom<=r.fTop+0.5,`last item above the field: ${last.top}..${last.bottom}`);
   await page.keyboard.press('Escape');}
  // --- little room on both sides, more under (about 220px seen): under the field, cut to what is above the keyboard
  {await room(40,130);await openList();const r=await rects(page),l=await list(page),v=await seen(page);
   assert.ok(l.h<full-1,`cut: ${l.h} of ${full}`);near(r.lTop,r.fBottom+4,'just under the field');assert.ok(r.lBottom<=v.bottom+0.5,`not behind the keyboard: ${r.lBottom} > ${v.bottom}`);
   const last=await lastItem(page);assert.ok(last.bottom<=v.bottom+0.5,`last item behind the keyboard: ${last.bottom} > ${v.bottom}`);
   // ... and the cut list still picks
   await page.locator('#ncs-ref-list .ncs-ref-item',{hasText:last.name}).click();await waitPills(page,WID,['@'+last.name]);}
  // --- the keyboard going away: the same open list goes back to its full height under the field
  {await room(40,130);await openList();assert.notEqual((await list(page)).max,'');await reset();
   await page.waitForFunction(()=>document.getElementById('ncs-ref-list').style.maxHeight==='');
   const r=await rects(page),l=await list(page);near(r.lTop,r.fBottom+4,'back under the field');near(l.h,full,'full height again');await page.keyboard.press('Escape');}
  // --- the field scrolled above what is seen: the list closes (P3-1); with the field seen again it opens as before
  {await openList();const fb=await page.locator(W).boundingBox();
   await page.evaluate(t=>{window.__vvTop=t;window.__vvH=300;window.__vvEvent('scroll');},Math.round(fb.y+fb.height+40));
   await page.waitForFunction(()=>document.getElementById('ncs-ref-list').hidden);
   await reset();await openList();const r=await rects(page);near(r.lTop,r.fBottom+4,'opens again');await page.keyboard.press('Escape');}
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: with little room the @ list goes to the larger side cut to fit (never over the field, last item reachable), grows back when the keyboard goes, and closes when the field leaves what is seen');
}finally{await browser.close();server.close();}
