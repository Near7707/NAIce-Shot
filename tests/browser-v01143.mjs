// v0.1.143: GPT review of 0.1.142 — a picture brought back from the same chat's history restores 추가 요청 only with its
// own target (P2-1); an extraction answer is not applied when the target changed meanwhile (P2-3); the same chat loaded
// again draws the open target list again (P3).
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
  // 0.1.134: paged lists carry page.pendingList too. 0.1.133: page.failHistory (read when the request arrives) answers 500. 0.1.131: pages by offset/limit (the list moves up when a picture is deleted, like the server).
  if(u.pathname.endsWith('/history')&&page.paged)return (async()=>{const fail=page.failHistory;if(page.holdHistory)await page.holdHistory;if(fail)return r.fulfill({status:500,json:{error:'잠시 실패'}});const off=Number(u.searchParams.get('offset'))||0,lim=Number(u.searchParams.get('limit'))||20;
   return r.fulfill({json:{items:items.slice(off,off+lim),pending:page.pendingList,pendingBytes:page.pendingList.reduce((s,e)=>s+e.bytes,0),total:items.length,hasMore:off+lim<items.length,scope:'chat',kind:'all',chats:[],imageCount:items.length,bytes:1}});})();
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,pending:page.pendingList,pendingBytes:page.pendingList.reduce((s,e)=>s+e.bytes,0),total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:page.chats??[],imageCount:items.length,bytes:1}});
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

 const KEY_B=JSON.stringify({group:null,card:'Leo.png',chat:'B'});
 const at=(x,loc)=>(x.moments[0].location=loc,x);
 const has=(page,key,word)=>JSON.stringify(page.store.get(key)?.work??null).includes(word);
 const LOC='#ncs-location';
 // B saved its own work once in this tab; back in A (both saved).
 const twoChats=async page=>{
  await run(page,'smiling',at(one(leo()),'riverside cafe'));await page.waitForTimeout(1500);
  await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(800);
  await run(page,'waving',at(one(leo({action:'waving'})),'quiet park'));await page.waitForTimeout(1500);
  assert.ok(has(page,KEY,'riverside cafe')&&has(page,KEY_B,'quiet park'),'setup: A and B are saved');
  await page.evaluate(()=>mock.switchChat('A'));await page.waitForFunction(()=>document.querySelector('#ncs-location').value==='riverside cafe');await page.waitForTimeout(500);
 };
 // SillyTavern's order: the id first (no event yet), the event later.
 const idOnly=(page,id)=>page.evaluate(id=>{mock.chatId=id;mock.characters[0].chat=id;},id);
 const keptB=page=>has(page,KEY_B,'quiet park')&&has(page,KEY_B,'waving')&&!has(page,KEY_B,'riverside cafe')&&!has(page,KEY_B,'smiling');
 const keptA=page=>has(page,KEY,'riverside cafe')&&has(page,KEY,'smiling');
 const KAI=page=>page.evaluate(()=>{mock.characters[1]={name:'Kai',avatar:'Kai.png',chat:'K'};mock.characterId=1;mock.chatId='K';mock.chat=[];});
 const deletes=page=>{const sent=[];page.on('request',r=>{if(r.url().endsWith('/delete'))sent.push(r.postDataJSON());});return sent;};
 const holdGet=async page=>{const g=gate();await page.route(u=>u.pathname.endsWith('/history'),async r=>{await g.p;return r.fallback();});return g;};
 const clearOn=page=>page.waitForFunction(()=>{const b=document.querySelector('[data-action="delete-chat-history"]');return !b.hidden&&!b.disabled;});
 const B_TAGS='green raincoat, rubber boots';
 const metaB=page=>page.evaluate(t=>{mock.chatMetadata={naice_shot:{outfits:{leo:{value:t,locked:false}}}};},B_TAGS);
 // History by chat key, 20 at a time (the shared fake gives every picture to every chat); B's reads fail while page.failB.
 const keyedHistory=page=>page.route(u=>u.pathname.endsWith('/history'),async r=>{
  if(r.request().method()!=='GET')return r.fallback();
  const u=new URL(r.request().url()),key=u.searchParams.get('chatKey');if(!key||u.searchParams.get('scope')==='all')return r.fallback();
  if(page.failB&&key===KEY_B)return r.fulfill({status:500,json:{error:'잠시 실패'}});
  const list=page.items.filter(x=>x.chatKey===key),off=Number(u.searchParams.get('offset'))||0,lim=Number(u.searchParams.get('limit'))||20;
  return r.fulfill({json:{items:list.slice(off,off+lim),pending:[],pendingBytes:0,total:list.length,hasMore:off+lim<list.length,scope:'chat',kind:'all',chats:[],imageCount:list.length,bytes:1}});});
 const cards=page=>page.locator('[data-history-delete]').evaluateAll(els=>els.map(e=>e.dataset.historyDelete));
 const OLD=JSON.stringify({group:'g1',card:'Leo.png',chat:'G'}),GROUP=JSON.stringify({group:'g1',card:null,chat:'G'});
 const groupChat=page=>page.evaluate(()=>{mock.groupId='g1';mock.characterId=undefined;mock.chatId='G';mock.chat=[{name:'Leo',mes:'Walking along the river.'}];mock.renderChat();mock.emit('chat');});
 // An older group picture put in message #0 through 본문에 넣기 (works since 0.1.139).
 const attachOld=async(page,id)=>{await tab(page,'history');await page.locator(`[data-history-delete="${id}"]`).waitFor({state:'attached'});
  await page.evaluate(id=>document.querySelector(`[data-history-attach="${id}"]`).click(),id);
  await page.locator('[data-attach-target="0"]').click();await page.locator('[data-action="attach-confirm"]').click();
  await page.waitForFunction(()=>(mock.chat[0].extra?.naice_shot_images?.length??0)>0);await page.waitForTimeout(300);};
 const historyReads=page=>{const keys=[];page.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('/history')&&r.method()==='GET')keys.push(u.searchParams.get('chatKey'));});return keys;};
 const shownText=(page,sel)=>page.locator(sel).evaluate(f=>HTMLTextAreaElement.prototype.__lookupGetter__('value').call(f));
 // A's message text differs from now on whenever A is opened again.
 const changeA=(page,text='Running along the river.')=>page.evaluate(t=>{mock.switchChat=function(id){this.chatId=id;this.characters[0].chat=id;this.chatMetadata={};this.savedChat=undefined;this.savedMetadata=undefined;
  this.chat=[{name:'Leo',mes:id==='A'?t:'Walking along the river.'}];this.renderChat();this.emit('chat');};},text);
 const pickTarget=async page=>{await page.evaluate(()=>{document.getElementById('ncs-target-picker').open=true;});await page.locator('[data-action="target-message"][data-message-index="0"]').click();await page.waitForTimeout(500);};
 const reopen=async page=>{await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();await page.waitForTimeout(800);};
 const extractCount=page=>page.evaluate(()=>{const f=mock.generateRaw;mock.extractCalls=0;mock.generateRaw=async function(o){this.extractCalls++;return f.call(this,o);};});
 const pickAt=async(page,i)=>{await page.evaluate(()=>{document.getElementById('ncs-target-picker').open=true;});await page.locator(`[data-action="target-message"][data-message-index="${i}"]`).click();await page.waitForTimeout(500);};
 // #0 picked with 추가 요청 'smiling', extracted and drawn; then #1 picked (추가 요청 empties); returns the picture id.
 const drawnAt0=async(page,items)=>{
  await pickAt(page,0);await page.evaluate(x=>{mock.extraction=x;},at(one(leo()),'riverside cafe'));await page.locator(W).fill('smiling');
  await page.locator('[data-action="extract"]').click();await idle(page);
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();await idle(page);
  await pickAt(page,1);assert.equal(await shownText(page,W),'','setup: 추가 요청 empties with another target');
  return items[0].id;};
 const bring=async(page,id)=>{await tab(page,'history');await page.locator(`[data-history-id="${id}"]`).waitFor({state:'attached'});
  await page.evaluate(id=>document.querySelector(`[data-history-id="${id}"]`).click(),id);await page.waitForTimeout(1500);};
 for(const width of [375,1100]){
  // --- P2-1: a picture of #0 brought back while #1 is chosen: 추가 요청 comes back with target #0 (screen and saved).
  {const {page,errors,items}=await open(width);ask(page);
   const id=await drawnAt0(page,items);await bring(page,id);
   assert.equal(await page.locator('#ncs-target').inputValue(),'0',`${width}px: the picture's target comes back`);
   assert.equal(await shownText(page,W),'smiling',`${width}px: with its 추가 요청`);
   await page.waitForTimeout(1200);
   assert.equal(page.store.get(KEY)?.work?.target,'0',`${width}px: saved target is #0`);
   assert.equal(page.store.get(KEY)?.work?.wish,'smiling',`${width}px: saved 추가 요청`);
   assert.deepEqual(errors,[]);await page.close();}
  // --- P2-1: the picture's message was edited since: target #0 comes back and extraction stops (no AI call).
  {const {page,errors,items}=await open(width);ask(page);
   const id=await drawnAt0(page,items);
   await page.evaluate(()=>{mock.chat[0].mes='Mira runs into the cafe.';mock.renderChat();mock.emit('edited');});await page.waitForTimeout(300);
   await bring(page,id);await extractCount(page);await page.locator('#ncs-notice').evaluate(n=>{n.textContent='';});
   await page.locator('[data-action="extract"]').click();await page.waitForTimeout(800);
   assert.equal(await page.evaluate(()=>mock.extractCalls),0,`${width}px: no extraction with 추가 요청 of a changed message`);
   assert.match(await page.locator('#ncs-notice').innerText(),/다시 골라/,`${width}px: asks to pick the target again`);
   assert.deepEqual(errors,[]);await page.close();}
  // --- P2-1: an older picture without its target: 추가 요청 is not put under the chosen #1.
  {const old={...pic(1),snapshot:{scene:{characters:[],location:'old cafe',lighting:'',camera:'',interaction:'',unregistered:[],momentWish:'waving'}}};
   const {page,errors}=await open(width,{seed:[old]});ask(page);
   await pickAt(page,1);await bring(page,old.id);
   assert.equal(await page.locator(LOC).inputValue(),'old cafe','setup: the picture came back');
   assert.equal(await page.locator('#ncs-target').inputValue(),'1',`${width}px: the chosen target stays`);
   assert.equal(await shownText(page,W),'',`${width}px: no 추가 요청 of an unknown message`);
   assert.deepEqual(errors,[]);await page.close();}
  // --- P2-3: #1 chosen while the extraction for #0 is answered: the answer is not applied.
  {const {page,errors}=await open(width);ask(page);
   await pickAt(page,0);await page.evaluate(x=>{mock.extraction=x;},at(one(leo()),'late cafe'));
   await page.evaluate(()=>{const f=mock.generateRaw;mock.calls=0;window.__go=new Promise(r=>{window.__release=r;});mock.generateRaw=async function(o){this.calls++;await window.__go;return f.call(this,o);};});
   await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>mock.calls>0);
   await pickAt(page,1);await page.evaluate(()=>window.__release());await idle(page);
   assert.equal(await page.locator('#ncs-target').inputValue(),'1','setup: #1 is chosen');
   assert.notEqual(await page.locator(LOC).inputValue(),'late cafe',`${width}px: #0's scene is not put under #1`);
   assert.match(await page.locator('#ncs-notice').innerText(),/대상 메시지가 바뀌어서/,`${width}px: says why`);
   assert.deepEqual(errors,[]);await page.close();}
  // --- P3: the list opened while the chat is empty (reload, same id) shows the messages again when they are back.
  {const {page,errors}=await open(width);ask(page);
   await page.evaluate(()=>{window.__kept=structuredClone(mock.chat);mock.chat=[];mock.renderChat();const d=document.getElementById('ncs-target-picker');d.open=true;d.dispatchEvent(new Event('toggle'));});
   await page.waitForTimeout(500);assert.match(await page.locator('#ncs-target-page').innerText(),/선택할 메시지가 없어요/,'setup: empty list');
   await page.evaluate(()=>{mock.chat=window.__kept;mock.renderChat();mock.emit('chat');});await page.waitForTimeout(800);
   assert.ok(await page.locator('[data-action="target-message"]').count()>0,`${width}px: the messages are listed again`);
   assert.doesNotMatch(await page.locator('#ncs-target-page').innerText(),/선택할 메시지가 없어요/,`${width}px: the count line is back`);
   assert.deepEqual(errors,[]);await page.close();}
 }
 console.log('PASS: a history picture restores 추가 요청 only with its own target; an extraction answer for an old target is not applied; a reloaded chat redraws the open target list');
}finally{await browser.close();server.close();}
