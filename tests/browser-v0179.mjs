// v0.1.79: GPT review of 0.1.77–0.1.78 — the save check stays on the chat it started in, no success note when a move is unchecked, length
// after typed names become chips, list pick that would not fit, backup keeps each mode, link undo reaches other candidates, short closable notes, delete cleanup.
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
  if(u.pathname.endsWith('/delete')){const q=r.request().postDataJSON(),ids=q.ids??[],deleted=[],skipped=[];for(const id of ids){const i=items.findIndex(x=>x.id===id&&x.chatKey===q.chatKey);if(i>=0){items.splice(i,1);deleted.push(id);}else skipped.push(id);}return r.fulfill({json:{deleted,skipped}});} // like the server: only the given chat's pictures
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items:page.noHistory?[]:items,total:page.noHistory?0:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
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
const field='#ncs-free-text';
const val=(page,sel=field)=>page.locator(sel).evaluate(f=>f.value);
const tok=(name,id)=>`@[${name}](ref:${id})`;
const chips=(page,sel=field)=>page.locator(`${sel} .ncs-chip`).evaluateAll(els=>els.map(e=>({text:e.textContent,id:e.dataset.refId,broken:e.classList.contains('ncs-chip-broken')})));
const items=page=>page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').allInnerTexts();
const noteText=page=>page.locator('#ncs-notice').innerText();
const type=async(page,sel,text)=>{await page.locator(sel).focus();await page.keyboard.type(text);};
const addProfile=(page,p)=>page.evaluate(p=>{mock.extensionSettings.naice_shot.profiles.push({aliases:[],subject:'boy',appearance:'short hair',defaultOutfit:'',positive:'',negative:'',cardKey:'',...p});},p);
const cand=(title)=>({title,characters:[],unregistered:['Visitor'],location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''});
const viewerReady=page=>page.waitForFunction(()=>{const d=document.getElementById('ncs-viewer'),i=d?.querySelector('.ncsv-stage img');return d?.open&&d.dataset.loaded&&i?.naturalWidth;});
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{extra:true});
  await addProfile(page,{id:'longq',name:'가'.repeat(120),aliases:['Q']});
  // UI-078-03: a long error note stays short, scrolls inside, and closes with ×; the field under it can be used again
  await freeOn(page);
  await page.locator(field).fill(Array.from({length:15},(_,i)=>`@없는사람${i}`).join(' '));
  await page.locator('[data-action="extract"]').click();
  await page.waitForFunction(()=>document.querySelector('#ncs-notice').classList.contains('ncs-error'));
  const h=await page.locator('#ncs-notice').evaluate(n=>({h:n.getBoundingClientRect().height,scroll:n.scrollHeight>n.clientHeight}));
  assert.ok(h.h<150,`note height ${h.h}`);assert.equal(h.scroll,true,'the rest scrolls inside');
  await page.locator('#ncs-notice .ncs-notice-close').click();assert.equal(await page.locator('#ncs-notice').isHidden(),true);
  await page.locator(field).click();assert.equal(await page.evaluate(()=>document.activeElement?.id),'ncs-free-text','the field takes the tap again');
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  // UI-076-02: a short typed alias that becomes a long chip is checked again before anything is sent
  await page.evaluate(()=>{mock.extractCalls=0;});
  await page.locator('#ncs-moment-wish').fill('가'.repeat(190)+' @Q');
  await page.locator('[data-action="extract"]').click();
  await page.waitForFunction(()=>/칩으로 바꾸면/.test(document.querySelector('#ncs-notice').innerText));
  assert.equal(await page.evaluate(()=>mock.extractCalls??0),0);assert.equal(await val(page,'#ncs-moment-wish'),'가'.repeat(190)+' @Q','nothing changed in the field');
  // …and a list pick that would not fit is refused
  await page.evaluate(()=>{document.querySelector('#ncs-moment-wish').value='가'.repeat(190);});
  await page.locator('#ncs-moment-wish').focus();await page.keyboard.press('End');await page.keyboard.type(' @Q');
  await page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').first().waitFor();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#ncs-moment-wish .ncs-chip').count(),0,'no chip');assert.match(await noteText(page),/칩을 넣지 못했어요/);
  await page.evaluate(()=>{document.querySelector('#ncs-moment-wish').value='';});
  assert.deepEqual(errors,[]);await page.close();
 }
 {
  // UI-078-01: a backup keeps each mode's own generation settings
  const {page,errors}=await open(375);
  await page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;s.positive='chat pos';});
  await freeOn(page);await page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;s.positive='free pos';s.options.scale=7;});
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>mock.extensionSettings.naice_shot.positive==='chat pos');
  const backup=await page.evaluate(()=>JSON.stringify(mock.extensionSettings.naice_shot));
  await page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;s.genByMode={};s.positive='other';});
  await page.locator('[data-tab="settings"]').click();
  await page.locator('#ncs-import').setInputFiles({name:'b.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await page.waitForFunction(()=>/백업을 가져왔어요/.test(document.querySelector('#ncs-notice').textContent));
  assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.positive),'chat pos');
  await page.locator('[data-tab="scene"]').click();await freeOn(page);
  assert.deepEqual(await page.evaluate(()=>[mock.extensionSettings.naice_shot.positive,mock.extensionSettings.naice_shot.options.scale]),['free pos',7],'프리샷 got its own back from the backup');
  assert.deepEqual(errors,[]);await page.close();
 }
 {
  // UI-078-02: undoing a link also undoes it in the other 장면 후보
  const {page,errors}=await open(375);
  await page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;s.profiles=s.profiles.filter(p=>p.id==='leo').map(p=>({...p,id:'kai',name:'Kai',aliases:[],cardKey:''}));});
  await page.evaluate(d=>{mock.extraction=d;},{moments:[cand('하나'),cand('둘'),cand('셋')],defaultIndex:0,requestMatched:true,requestApplied:[],requestIgnored:[],requestOutfits:[],requestVisibleOnly:false});
  await page.locator('[data-action="extract"]').click();await idle(page);
  await page.locator('[data-missing-do="link"][data-missing-name="Visitor"]').click();await page.locator('#ncs-link-profile').selectOption('kai');await page.locator('[data-missing-do="link-confirm"]').click();
  await page.locator('[data-character="kai"]').waitFor();
  await page.locator('[data-missing-do="link-undo"]').click();await page.waitForFunction(()=>!document.querySelector('[data-character="kai"]'));
  await page.locator('[data-moment="1"]').click();
  assert.equal(await page.locator('[data-character="kai"]').count(),0,'no Kai card in the other candidate');
  assert.equal(await page.locator('[data-quick-profile-name="Visitor"]').count(),1,'Visitor is without a profile there again');
  assert.deepEqual(errors,[]);await page.close();
 }
 {
  // UI-072-01: an unchecked move shows no success note; UI-078-04: a failed chat save after deleting still clears the result
  const {page,errors}=await open(375);
  await page.evaluate(()=>{window.__toasts=[];window.toastr={info:m=>__toasts.push(['info',m]),success:m=>__toasts.push(['success',m]),warning:m=>__toasts.push(['warning',m]),error:m=>__toasts.push(['error',m])};});
  await page.locator('[data-action="generate"]').click();await idle(page);
  await page.locator('#ncs-result [data-action="attach"]').click();await page.locator('#ncs-attach-dialog[open]').waitFor();await page.locator('[data-attach-target="1"]').click();await page.locator('#ncs-attach-dialog [data-action="attach-confirm"]').click();
  await page.waitForFunction(()=>mock.chat[1].extra?.naice_shot_images?.length===1&&!document.getElementById('ncs-attach-dialog').open);
  // the chat is changed while the save runs: the check still reads the chat it started in
  await page.locator('#ncs-result [data-action="attach"]').click();await page.locator('#ncs-attach-dialog[open]').waitFor();await page.locator('[data-attach-target="0"]').click();
  await page.evaluate(()=>{mock.chatReads=[];window.__save=mock.saveChat;mock.saveChat=async function(){await window.__save.call(this);this.chatId='B';};});
  await page.locator('#ncs-attach-dialog [data-action="attach-confirm"]').click();
  await page.waitForFunction(()=>mock.chatReads.length===2);
  assert.deepEqual(await page.evaluate(()=>mock.chatReads.map(r=>r.file_name??r.id)),['A','A'],'read the chat the change started in before and after saving');
  await page.evaluate(()=>{mock.saveChat=window.__save;mock.chatId='A';});
  await page.locator('[data-action="close"]').click();
  await page.evaluate(()=>{mock.chatReadFails=true;});
  await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').first().click();await viewerReady(page);
  await page.locator('#ncs-viewer [data-v="more"]').click();await page.locator('#ncs-viewer .ncsv-more-items button',{hasText:'옮기기'}).first().click();
  await page.waitForFunction(()=>__toasts.length>0);await page.waitForTimeout(300);
  const toasts=await page.evaluate(()=>__toasts);
  assert.ok(toasts.some(t=>/확인하지 못했어요/.test(t[1])),JSON.stringify(toasts));assert.ok(!toasts.some(t=>/옮겼어요/.test(t[1])),'no success note: '+JSON.stringify(toasts));
  await page.evaluate(()=>{mock.chatReadFails=false;});
  // delete the attached picture while the chat save silently fails
  await page.locator('.ncs-launch-button').click();await page.locator('#naice-shot-dialog[open]').waitFor();
  await page.evaluate(()=>{mock.saveChat=async function(){};});
  page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());
  await page.locator('[data-action="delete-result"]').click();
  await page.waitForFunction(()=>/삭제했어요/.test(document.querySelector('#ncs-notice').innerText));
  assert.match(await noteText(page),/채팅에서 그림을 빼는 저장은 실패/);
  assert.equal(await page.locator('#ncs-result [data-action="delete-result"]').count(),0,'the result is cleared');
  assert.deepEqual(errors,[]);await page.close();
 }
 // A second client edits a middle message, with the same message count and last message.
 {
  const {page,errors}=await open(375);
  await page.locator('[data-action="generate"]').click();await idle(page);
  await page.evaluate(()=>{
    const newer=structuredClone(mock.chat);newer[0].mes='A newer edit saved by another tab.';
    mock.savedChat=JSON.stringify(newer);
  });
  await page.locator('#ncs-result [data-action="attach"]').click();
  await page.locator('[data-attach-target="1"]').click();
  await page.locator('#ncs-attach-dialog [data-action="attach-confirm"]').click();
  await page.waitForFunction(()=>/서버의 채팅과 화면/.test(document.querySelector('#ncs-notice').innerText));
  assert.equal(await page.evaluate(()=>mock.chatSaves??0),0);
  assert.equal(await page.evaluate(()=>mock.chat.some(m=>m.extra?.naice_shot_images)),false);
  await page.evaluate(()=>{
    mock.savedChat=JSON.stringify(mock.chat);
    mock.savedMetadata={anotherTab:{updated:true}};
    const placement=document.querySelector('#ncs-chat-image-placement');
    placement.value='below';placement.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.querySelector('#ncs-chat-image-placement').value==='');
  assert.equal(await page.evaluate(()=>mock.saves??0),0);
  assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot),undefined);
  assert.deepEqual(errors,[]);await page.close();
 }
 // A browser that lost the generation reply can reload and retrieve the exact request.
 {
  const {page,errors}=await open(375);let request,calls=0,checks=0,saves=0;
  await page.route('**/api/plugins/naice-shot/**',async r=>{
   const url=new URL(r.request().url()),{pathname}=url;
   if(pathname.endsWith('/status'))return r.fulfill({json:{keyConfigured:true,version:'0.1.20',features:[...features,'generation-recovery'],subscription:{tier:3,active:true,isGracePeriod:false}}});
   if(pathname.endsWith('/generate')){request=r.request().postDataJSON();calls++;return r.abort('failed');}
   if(pathname.endsWith('/generation')){
    if(r.request().method()==='GET'){
     checks++;assert.equal(url.searchParams.get('requestId'),request.requestId);
     return r.fulfill({json:{state:'save-failed'}});
    }
    saves++;assert.equal(r.request().postDataJSON().requestId,request.requestId);
    return r.fulfill({json:{state:'complete',item:{id:request.requestId,chatKey:request.chatKey,
     image:`/user/images/naice-shot/${request.requestId}.png`,seed:request.options.seed,options:request.options}}});
   }
   return r.fallback();
  });
  await page.reload();await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  await page.locator('[data-action="extract"]').click();await idle(page);
  await page.locator('[data-action="generate"]').click();
  await page.waitForFunction(()=>/생성 결과를 받지 못했어요/.test(document.querySelector('#ncs-notice').innerText));
  await page.reload();await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  await page.locator('[data-action="generation-check"]').click();
  await page.locator('#ncs-result [data-view-result]').first().waitFor();
  assert.equal(calls,1);assert.equal(checks,1);assert.equal(saves,1);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: closable short notes; typed names checked again after becoming chips; a pick that does not fit is refused; backups keep each mode; link undo reaches other candidates; no success note for an unchecked move; delete cleans up after a failed chat save');
}finally{await browser.close();server.close();}
