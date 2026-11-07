// v0.1.65: GPT's 0.1.64 review (no lock left after a slow move; a pending tap-close is dropped when the viewer
// closes another way) and the thin 챗샷/프리샷 switch.
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
try{
 for(const width of [375,1100]){
  {// UI-064-01: a lock from a slow move in the history gallery never carries over to the next picture opened on its own.
   const {page,errors}=await open(width);ask(page);
   for(let i=0;i<2;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
   await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=2);
   await page.locator('[data-view-history]').first().click();await viewerReady(page);
   await holdDecode(page);await page.locator('[data-v="next"]').click();
   await page.waitForFunction(()=>/불러오는 중/.test(document.querySelector('.ncsv-toast').textContent)&&!document.querySelector('.ncsv-toast').hidden);
   assert.equal(await page.locator('#ncs-viewer [data-v="more"]').isDisabled(),true,'⋯ locked while the slow move runs');
   await page.locator('[data-v="close"]').click();
   await page.locator('[data-tab="scene"]').click();await page.locator('#ncs-result .ncs-image-open').click();await viewerReady(page);
   const jump=page.locator('#ncs-viewer [data-v="more"]'); // 0.1.70: 메시지로 가기 lives in ⋯, which locks the same way
   assert.equal(await jump.isVisible(),true,'the result picture has ⋯');assert.equal(await jump.isDisabled(),false,'⋯ is not left locked');
   assert.equal(await page.locator('#ncs-viewer [data-v="delete"]').isDisabled(),false,'삭제 is not left locked');
   await releaseDecode(page);await page.waitForTimeout(400);
   assert.equal(await jump.isDisabled(),false,'the old move finishing later does not lock it again');
   assert.equal(await page.locator('.ncsv-navigation').isHidden(),true,'still the single result picture');
   assert.deepEqual(errors,[]);await page.close();
  }
  {// UI-064-02: closing another way (Escape) right after a tap drops the pending tap-close; the next click is not swallowed.
   const {page,errors}=await open(width);ask(page);
   await page.locator('[data-action="generate"]').click();await idle(page);
   await page.locator('[data-action="attach"]').click();await page.locator('[data-attach-target="1"]').click();await page.locator('[data-action="attach-confirm"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').waitFor();
   await page.locator('[data-action="close"]').click();
   for(const how of ['escape','close-button']){
    await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').click();await viewerReady(page);
    await page.locator('#ncs-viewer .ncsv-stage').evaluate(s=>{const b=s.getBoundingClientRect();for(const t of ['pointerdown','pointerup'])s.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:9,pointerType:'touch',clientX:b.left+4,clientY:b.top+4,button:0}));});
    if(how==='escape')await page.keyboard.press('Escape');else await page.locator('#ncs-viewer [data-v="close"]').click();
    await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open);
    const t0=Date.now();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').click();
    await page.waitForFunction(()=>document.getElementById('ncs-viewer').open,null,{timeout:1000});
    assert.ok(Date.now()-t0<700,`${how}: the first click right after opened the picture`);
    await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>document.getElementById('ncs-viewer').open),true,`${how}: the old timer does not close the new view`);
    await page.locator('#ncs-viewer [data-v="close"]').click();
   }
   // The tap path itself still closes and swallows its own click (UI-063-02 stays fixed).
   await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').click();await viewerReady(page);
   const r=await page.evaluate(async()=>{const d=document.getElementById('ncs-viewer'),s=d.querySelector('.ncsv-stage'),b=s.getBoundingClientRect(),x=b.left+4,y=b.top+4;
    let reached=0;const count=()=>reached++;document.addEventListener('click',count);
    for(const t of ['pointerdown','pointerup'])s.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:10,pointerType:'touch',clientX:x,clientY:y,button:0}));
    await new Promise(r=>setTimeout(r,0));document.elementFromPoint(x,y)?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y}));
    await new Promise(r=>setTimeout(r,50));document.removeEventListener('click',count);return {reached,open:d.open};});
   assert.deepEqual(r,{reached:0,open:false});
   assert.deepEqual(errors,[]);await page.close();
  }
  {// (가) → 0.1.67 title row: the switch never scrolls away and keeps readable 32px+ buttons on one line.
   const {page,errors}=await open(width);ask(page);
   const btn=await page.locator('[data-mode="free"]').boundingBox();assert.ok(btn.height>=32,`${width}px: buttons stay ${btn.height}px`);
   assert.equal(await page.locator('[data-mode="chat"]').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'one line');
   await page.evaluate(()=>document.querySelector('.ncs-content').scrollTop=900);await page.waitForTimeout(100);
   const after=await page.locator('[data-mode="free"]').boundingBox(),content=await page.locator('.ncs-content').boundingBox();
   assert.ok(after.y+after.height<=content.y+1,'stays at the top while scrolling');
   await page.locator('[data-mode="free"]').click();assert.equal(await page.locator('[data-mode="free"]').getAttribute('aria-pressed'),'true');
   assert.deepEqual(errors,[]);await page.close();
  }
 }
 console.log('PASS: no lock left over after a slow gallery move (375/1100); Escape or ✕ after a tap drops the pending close and the next click works; tap-close still swallows its click; 챗샷/프리샷 switch stays at the top');
}finally{await browser.close();server.close();}
