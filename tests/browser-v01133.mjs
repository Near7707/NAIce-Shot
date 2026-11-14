// v0.1.133: GPT review of 0.1.132 — an edit already in the save queue (not only one waiting 450ms) is sent before
// another work's deletion holds the queue (P2); when the reread after [더 보기] fails, the deleted card still leaves and
// [더 보기] stays, so the picture that moved up is not lost (P3).
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
  // 0.1.133: page.failHistory (read when the request arrives) answers 500. 0.1.131: pages by offset/limit (the list moves up when a picture is deleted, like the server).
  if(u.pathname.endsWith('/history')&&page.paged)return (async()=>{const fail=page.failHistory;if(page.holdHistory)await page.holdHistory;if(fail)return r.fulfill({status:500,json:{error:'잠시 실패'}});const off=Number(u.searchParams.get('offset'))||0,lim=Number(u.searchParams.get('limit'))||20;
   return r.fulfill({json:{items:items.slice(off,off+lim),pending:[],pendingBytes:0,total:items.length,hasMore:off+lim<items.length,scope:'chat',kind:'all',chats:[],imageCount:items.length,bytes:1}});})();
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,pending:page.pendingList,pendingBytes:page.pendingList.reduce((s,e)=>s+e.bytes,0),total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  // 0.1.128: drafts kept on the test side, so a page reload reads back what was saved.
  if(u.pathname.endsWith('/draft')){if(r.request().method()==='GET')return (async()=>{if(page.holdDraft)await page.holdDraft;const s=store.get(u.searchParams.get('chatKey'));return r.fulfill({json:s??{revision:null,work:null}});})();
   return (async()=>{const q=r.request().postDataJSON();if(page.holdPost)await page.holdPost;if(q.work)store.set(q.chatKey,{revision:`r${++saves}`,work:q.work});return r.fulfill({json:{revision:`r${saves}`}});})();}
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
const uid=n=>`${String(n).padStart(8,'0')}-aaaa-4bbb-8ccc-${String(n).padStart(12,'0')}`;
const pic=n=>({id:uid(n),created:new Date(Date.UTC(2026,10,5,10,59-n)).toISOString(),chatKey:KEY,image:`/user/images/naice-shot/${uid(n)}.png`,seed:n,assembled:{base:'',negative:'',characters:[]},options:{model:'nai-diffusion-4-5-full',width:832,height:1216,steps:28},snapshot:{}});
try{
 const gate=()=>{let open;const p=new Promise(r=>{open=r;});return {p,open};};
 const tab=(page,t)=>page.locator(`[data-tab="${t}"]`).click();
 const otherTabDeletes=(page,id)=>page.evaluate(x=>localStorage.setItem('naice-shot-deleted-pictures',JSON.stringify([x])),id);
 const card=(page,id)=>page.locator(`[data-history-delete="${id}"]`).count();
 const FREE=JSON.stringify({free:true});
 for(const width of [375,1100]){
  // --- P2: an edit in chat A; about 0.55s later (its 450ms capture done, its 650ms queue wait not) 프리샷 이력 전체 삭제.
  // The queued edit reaches the server while the deletion is still held, so a leave or reload then keeps it.
  {const {page,errors}=await open(width,{seed:[{...pic(1),chatKey:FREE}]});ask(page);
   await run(page,'smiling',one(leo()));await page.waitForTimeout(1500);
   assert.equal(page.store.get(KEY)?.work?.scene?.location,'cafe','setup: the scene is saved');
   await tab(page,'history');await page.locator('#ncs-history-scope').selectOption('free');await page.locator(`[data-history-delete="${uid(1)}"]`).waitFor();
   const g=gate();page.holdDelete=g.p;
   await page.evaluate(()=>new Promise(done=>{const f=document.querySelector('#ncs-location');f.value='night harbor';f.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(()=>{document.querySelector('[data-action="delete-chat-history"]').click();done();},560);}));
   for(let i=0;i<25&&page.store.get(KEY)?.work?.scene?.location!=='night harbor';i++)await page.waitForTimeout(100); // the deletion stays held
   assert.equal(page.store.get(KEY)?.work?.scene?.location,'night harbor',`${width}px: the queued edit was sent before the deletion held the saves`);
   page.holdDelete=null;g.open();await page.waitForTimeout(800);
   assert.deepEqual(errors,[]);await page.close();}
  // --- P3: 22 pictures, 20 shown; [더 보기] waits; another tab deletes a shown one; the reread fails.
  // The deleted card leaves, [더 보기] stays, and pressing it brings the pictures that moved up.
  {const seed=Array.from({length:22},(_,i)=>pic(i+1));const {page,errors,items}=await open(width,{seed});ask(page);page.paged=true;
   await tab(page,'history');await page.locator(`[data-history-delete="${uid(20)}"]`).waitFor();
   const g=gate();page.holdHistory=g.p;
   await page.locator('[data-action="history-more"]').click();await page.waitForTimeout(200);
   items.splice(items.findIndex(x=>x.id===uid(4)),1);await otherTabDeletes(page,uid(4));
   page.failHistory=true;page.holdHistory=null;g.open();await page.waitForTimeout(1200);
   assert.equal(await card(page,uid(4)),0,`${width}px: the deleted card leaves though the reread failed`);
   assert.equal(await card(page,uid(21)),0,'setup: the answer that would skip a picture was not used');
   assert.equal(await page.locator('[data-action="history-more"]').isVisible(),true,`${width}px: [더 보기] stays after the failed reread`);
   page.failHistory=false;await page.locator('[data-action="history-more"]').click();await page.waitForTimeout(1200);
   assert.equal(await card(page,uid(21)),1,`${width}px: [더 보기] brings the picture that moved up`);
   assert.equal(await card(page,uid(22)),1,`${width}px: and the last one`);
   assert.equal(await page.locator('[data-history-delete]').count(),21,`${width}px: 21 cards`);
   assert.deepEqual(errors,[]);await page.close();}
 }
 console.log('PASS: a queued edit survives another work\'s deletion; a failed reread after [더 보기] keeps [더 보기] and skips no picture');
}finally{await browser.close();server.close();}
