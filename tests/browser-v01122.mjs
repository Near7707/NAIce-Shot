// v0.1.121: GPT review of 0.1.120 — an undo to a text no longer remembered keeps only links whose name one profile has;
// an undo back over a plain retyped name gets its one-profile link back; a dropped input's note is not used by a cut.
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
  const set=(sel,v)=>page.locator(sel).evaluate((f,v)=>{f.value=v;},v);
  const select=(sel,a,b)=>page.locator(sel).evaluate((f,[a,b])=>{f.focus();f.setSelectionRange(a,b);},[a,b]);
  const paste=(sel,plain,internal)=>page.locator(sel).evaluate((f,[plain,internal])=>{const d=new DataTransfer();d.setData('text/plain',plain);if(internal)d.setData('text/x-ncs-ref',internal);
   f.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));},[plain,internal]);
  const cut=sel=>page.locator(sel).evaluate(f=>{const d=new DataTransfer();f.dispatchEvent(new ClipboardEvent('cut',{clipboardData:d,bubbles:true,cancelable:true}));return d.getData('text/plain');});
  const text=sel=>page.locator(sel).evaluate(f=>HTMLTextAreaElement.prototype.__lookupGetter__('value').call(f));
  const undoTo=async(sel,want)=>{for(let i=0;i<80&&await text(sel)!==want;i++)await page.keyboard.press('Control+z');assert.equal(await text(sel),want);};
  const typeMany=async n=>{for(let i=0;i<n;i++)await page.keyboard.type(String.fromCharCode(97+i%26));};
  const one=async()=>{await caret(page,W,4);await page.keyboard.type('x');await select(W,0,5);await paste(W,'@Leo',tok('Leo','leo2'));assert.deepEqual(await ids(page,W),['leo2']);};
  // --- P2: back to the same-looking "@Leo" after more than 60 edits (a cut makes "@Leo 웃는다" again with the second Leo):
  // the first state is no longer remembered, so the second Leo is not taken from the later states. It is picked again.
  await set(W,`${tok('Leo','leo')} 웃는다`);await one();
  await caret(page,W,-1);await typeMany(65);
  await select(W,8,73);await cut(W);assert.equal(await text(W),'@Leo 웃는다');assert.deepEqual(await ids(page,W),['leo2']);
  await undoTo(W,'@Leox 웃는다');await page.keyboard.press('Control+z');assert.equal(await text(W),'@Leo 웃는다');
  assert.deepEqual(await ids(page,W),[''],`${width}px: the first state was dropped, so the second Leo is not brought back`);
  // --- P2: the first Leo renamed to Leon: the second Leo is the only "Leo" now, but this box linked "Leo" to both.
  await set(W,`${tok('Leo','leo')} 웃는다`);await one();
  await caret(page,W,-1);await typeMany(65);
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo').name='Leon';});
  await undoTo(W,'@Leo 웃는다');
  assert.deepEqual(await ids(page,W),[''],`${width}px: after a rename the old text is not given the other Leo`);
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo').name='Leo';});
  // --- P3: a link to a deleted profile, or with no id, typed over with the same plain letters: undo does not bring it back
  // (0.1.124: it is left as a broken link with no id instead of plain letters).
  for(const id of ['gone','']){
   await set(W,`${tok('Ghost',id)}x 웃는다`);await select(W,0,6);await page.keyboard.insertText('@Ghost');
   assert.deepEqual(await ids(page,W),[]);
   await page.keyboard.press('Control+z');assert.equal(await text(W),'@Ghostx 웃는다');
   // 0.1.124 (GPT 0.1.123 P2-2): an unsure place is always left broken (no id, pick again), also for a name nobody has.
   assert.deepEqual(await ids(page,W),[''],`${width}px: a broken link ("${id}") is not brought back as a link`);
  }
  // ...a one-profile link still is (0.1.121).
  await set(W,`${tok('Mira','mira')}x 웃는다`);await select(W,0,5);await page.keyboard.insertText('@Mira');
  await page.keyboard.press('Control+z');assert.deepEqual(await ids(page,W),['mira'],`${width}px: one-profile link still comes back`);
  // A broken link that was in the text all along stays, so the extraction still says so.
  await set(W,`${tok('Shade','gone')} 웃는다`);await caret(page,W,-1);await page.keyboard.type('x');
  await page.keyboard.press('Control+z');assert.equal(await text(W),'@Shade 웃는다');
  assert.deepEqual(await ids(page,W),['gone'],`${width}px: a broken link kept by every state stays`);
  await caret(page,W,-1);await typeMany(65);await undoTo(W,'@Shade 웃는다');
  assert.deepEqual(await ids(page,W),['gone'],`${width}px: a broken link moved along stays`);
  await set(W,'');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: undo after dropped states or a rename does not give a twin name the other id; broken links are not brought back but kept when already there');
}finally{await browser.close();server.close();}
