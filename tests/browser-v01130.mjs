// v0.1.130: GPT review of 0.1.129 — leaving the browser tab saves the screen only for a waiting edit (P2-1); a picture
// deleted in another tab is left out of every save and of a late [같은 요청으로 다시 확인] answer (P2-2); a late history
// answer leaves deleted pictures out (P3-1); a discarded 저장 대기 entry and its size leave at once (P3-2).
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
const features=['paged-history','delete','private-records','all-history','history-kinds','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes','history-ids','pending-history','generation-recovery'];
async function open(width,{cardName,extra,seed,clock,pending}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[],store=new Map();let saves=0;page.store=store;page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());if(seed)items.push(...seed);if(clock)await page.clock.install();
 // Pictures: a real PNG per id in one of three shapes, never cached, and holdable to slow the next one down.
 const sizes=[[64,96],[96,64],[80,80]],seen=new Map();page.hold=null;page.pendingList=[];
 await page.route('**/user/images/naice-shot/**',async r=>{const id=new URL(r.request().url()).pathname;if(!seen.has(id))seen.set(id,sizes[seen.size%3]);
  if(page.hold)await page.hold;const [w,h]=seen.get(id);await r.fulfill({status:200,headers:{'Content-Type':'image/png','Cache-Control':'no-store'},body:pngOf(w,h)});});
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/delete'))return (async()=>{if(page.holdDelete)await page.holdDelete;const q=r.request().postDataJSON(),ids=q.ids??[];for(const id of ids){const i=items.findIndex(x=>x.id===id);if(i>=0)items.splice(i,1);page.pendingList=page.pendingList.filter(x=>x.id!==id);}return r.fulfill({json:{deleted:ids,skipped:[]}});})();
  // 0.1.130: a lost reply checked again ([같은 요청으로 다시 확인]), holdable; 저장 대기 entries in the history.
  if(u.pathname.endsWith('/generation')&&u.searchParams.has('requestId'))return (async()=>{if(page.holdCheck)await page.holdCheck;return r.fulfill({json:page.generationReply??{state:'unknown'}});})();
  if(u.pathname.endsWith('/generation'))return r.fulfill({json:{pending:[]}});
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,pending:page.pendingList,pendingBytes:page.pendingList.reduce((s,e)=>s+e.bytes,0),total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  // 0.1.128: drafts kept on the test side, so a page reload reads back what was saved.
  if(u.pathname.endsWith('/draft')){if(r.request().method()==='GET')return (async()=>{if(page.holdDraft)await page.holdDraft;const s=store.get(u.searchParams.get('chatKey'));return r.fulfill({json:s??{revision:null,work:null}});})();
   const q=r.request().postDataJSON();if(q.work)store.set(q.chatKey,{revision:`r${++saves}`,work:q.work});return r.fulfill({json:{revision:`r${saves}`}});}
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
 if(extra)await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.profiles.push({id:'mira',name:'Mira',aliases:[],subject:'girl',appearance:'long black hair',defaultOutfit:'',positive:'',negative:'',cardKey:''});}));
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 if(pending)await page.addInitScript(p=>sessionStorage.setItem('naice-shot-pending-generation',JSON.stringify(p)),pending);
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
const W='#ncs-moment-wish';
const KEY=JSON.stringify({group:null,card:'Leo.png',chat:'A'});
const uid=n=>`0000000${n}-aaaa-4bbb-8ccc-${String(n).padStart(12,'0')}`;
const hide=(page,state)=>page.evaluate(s=>{Object.defineProperty(document,'visibilityState',{value:s,configurable:true});document.dispatchEvent(new Event('visibilitychange'));},state);
try{
 const gate=()=>{let open;const p=new Promise(r=>{open=r;});return {p,open};};
 const tab=(page,t)=>page.locator(`[data-tab="${t}"]`).click();
 const deleted=page=>page.waitForFunction(()=>/삭제했어요/.test(document.querySelector('#ncs-notice').innerText));
 const pics=page=>page.locator('#ncs-result img').count();
 const shownText=(page,sel)=>page.locator(sel).evaluate(f=>HTMLTextAreaElement.prototype.__lookupGetter__('value').call(f));
 const otherTabDeletes=(page,id)=>page.evaluate(x=>localStorage.setItem('naice-shot-deleted-pictures',JSON.stringify([x])),id);
 const count=page=>page.locator('#ncs-history-count').innerText();
 for(const width of [375,1100]){
  // --- P2-1: A's message changes after its picture and 추가 요청 are saved; reopened (0.1.142: 추가 요청 stays on screen),
  // the saved copy keeps it. Leaving for another browser tab keeps it too; an edit just before leaving is saved.
  {const {page,errors,items}=await open(width);ask(page);
   await run(page,'smiling',one(leo()));
   await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();await idle(page);
   const keyA=items[0].chatKey;await page.waitForTimeout(1200);
   assert.equal(page.store.get(keyA)?.work?.wish,'smiling','setup: 추가 요청 saved for A');
   await page.evaluate(()=>{mock.switchChat=function(id){this.chatId=id;this.characters[0].chat=id;this.chatMetadata={};this.savedChat=undefined;this.savedMetadata=undefined;
    this.chat=[{name:'Leo',mes:id==='A'?'Running along the river.':'Walking along the river.'}];this.renderChat();this.emit('chat');};mock.switchChat('B');});
   await page.waitForTimeout(800);await page.evaluate(()=>{mock.switchChat('A');});await page.waitForTimeout(1500);
   assert.equal(await shownText(page,W),'smiling','setup: 0.1.142: a changed message keeps 추가 요청 on screen');
   await hide(page,'hidden');await page.waitForTimeout(1200);
   assert.equal(page.store.get(keyA)?.work?.wish,'smiling',`${width}px: leaving the browser tab keeps A's saved 추가 요청`);
   await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.waitForTimeout(800);
   assert.equal(page.store.get(keyA)?.work?.wish,'smiling',`${width}px: so does pagehide`);
   await hide(page,'visible');
   await page.locator(W).fill('waving');await hide(page,'hidden');await page.waitForTimeout(300); // before the 450 ms save
   assert.equal(page.store.get(keyA)?.work?.wish,'waving',`${width}px: an edit waiting to be saved is saved on leaving`);
   await hide(page,'visible');assert.deepEqual(errors,[]);await page.close();}
  // --- P2-2 (save): the picture on screen is deleted in another tab; an edit here saves the work without it.
  {const {page,errors,items}=await open(width);ask(page);
   await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();await idle(page);
   const id=items[0].id,key=items[0].chatKey;await page.waitForTimeout(1200);
   assert.equal(page.store.get(key)?.work?.result?.id,id,'setup: saved with the picture');
   await otherTabDeletes(page,id);
   await page.locator('#ncs-location').fill('harbor at dawn');await page.waitForTimeout(1200);
   const w=page.store.get(key)?.work;
   assert.equal(w?.scene?.location,'harbor at dawn','setup: the edit is saved');
   assert.equal(w?.result??null,null,`${width}px: the deleted picture is not saved with the edit`);
   assert.equal(await pics(page),0,`${width}px: and it leaves the screen`);
   assert.deepEqual(errors,[]);await page.close();}
  // --- P2-2 (check again): [같은 요청으로 다시 확인] waits; another tab deletes the picture; the late answer is not shown.
  {const id=uid(5);const {page,errors}=await open(width,{pending:[[KEY,id]]});ask(page);
   page.generationReply={state:'complete',item:{id,created:new Date().toISOString(),chatKey:KEY,image:`/user/images/naice-shot/${id}.png`,seed:5,assembled:{base:'',negative:'',characters:[]},options:{model:'nai-diffusion-4-5-full',width:832,height:1216,steps:28},snapshot:{}}};
   await page.locator('#ncs-location').fill('quiet road');await page.waitForTimeout(1200);
   const g=gate();page.holdCheck=g.p;await page.locator('#ncs-notice').evaluate(n=>{n.textContent='';});
   await page.locator('[data-action="generation-check"]').evaluate(b=>b.click());await page.waitForTimeout(400);
   await otherTabDeletes(page,id);page.holdCheck=null;g.open();await page.waitForTimeout(1500);
   assert.equal(await pics(page),0,`${width}px: the late answer is not put in the result`);
   assert.notEqual(page.store.get(KEY)?.work?.result?.id,id,`${width}px: nor saved`);
   assert.equal(page.store.get(KEY)?.work?.scene?.location,'quiet road','setup: the work is still there');
   assert.match(await page.locator('#ncs-notice').innerText(),/이미 삭제한 그림이라 결과 칸에 넣지 않았어요/);
   assert.deepEqual(errors,[]);await page.close();}
  // --- P3-1: a history refresh read before another tab's deletion arrives after it: the card stays out.
  {const {page,errors,items}=await open(width);ask(page);
   await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();await idle(page);
   const id=items[0].id;await tab(page,'history');await page.locator(`[data-history-delete="${id}"]`).waitFor();
   const g=gate();await page.route('**/history?*',async r=>{await g.p;await r.fallback();});
   await page.locator('[data-action="history"]').evaluate(b=>b.click());await page.waitForTimeout(300);
   await otherTabDeletes(page,id);g.open();await page.waitForTimeout(1000);
   assert.equal(await page.locator(`[data-history-delete="${id}"]`).count(),0,`${width}px: the deleted card does not come back`);
   assert.doesNotMatch(await count(page),/총 1장/,`${width}px: nor is it counted`);
   await page.unroute('**/history?*');assert.deepEqual(errors,[]);await page.close();}
  // --- P3-2: two 저장 대기 entries; one discarded while the refresh is slow, ★ pressed and failing meanwhile, then the
  // refresh fails too: one entry left, its own size.
  {const {page,errors}=await open(width);ask(page);
   const entry=(n,bytes)=>({id:uid(n),chatKey:KEY,created:new Date(Date.UTC(2026,10,5,10,n)).toISOString(),bytes});
   page.pendingList=[entry(7,3*1048576),entry(8,1048576)];
   await tab(page,'history');await page.locator(`[data-pending-discard="${uid(7)}"]`).waitFor();
   assert.match(await count(page),/저장 대기 2장 · 4\.0 MB/,'setup: two waiting');
   const g=gate();await page.route('**/history?*',async r=>{await g.p;await r.fulfill({status:500,json:{error:'down'}});});
   await page.route(u=>u.pathname.endsWith('/history'),r=>r.request().method()==='POST'?r.fulfill({status:500,json:{error:'down'}}):r.fallback());
   await page.locator('#ncs-notice').evaluate(n=>{n.textContent='';});
   await page.locator(`[data-pending-discard="${uid(7)}"]`).click();await page.waitForTimeout(600);
   assert.equal(await page.locator(`[data-pending-discard="${uid(7)}"]`).count(),0,`${width}px: the discarded entry leaves at once`);
   assert.match(await count(page),/저장 대기 1장 · 1\.0 MB/,`${width}px: counted again from what is left`);
   await page.locator('[data-action="history-star-only"]').click();await page.waitForTimeout(400);
   g.open();await page.waitForTimeout(800);
   assert.equal(await page.locator('[data-action="history-star-only"]').getAttribute('aria-pressed'),'false','setup: the ★ view went back after its failure');
   assert.equal(await page.locator(`[data-pending-discard="${uid(7)}"]`).count(),0,`${width}px: the ★ failure does not bring it back`);
   assert.match(await count(page),/저장 대기 1장 · 1\.0 MB/,`${width}px: nor its size`);
   await page.unroute('**/history?*');assert.deepEqual(errors.filter(e=>!/down/.test(e)),[]);await page.close();}
 }
 console.log('PASS: leaving the tab keeps the saved 추가 요청; a picture deleted in another tab is neither saved nor shown by a late check; late history and 저장 대기 leave deleted entries out');
}finally{await browser.close();server.close();}
