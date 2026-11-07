// v0.1.77: lengths by what a person sees (Hangul composition never cuts old text), long chip names fit at 375px, copy keeps the
// trailing newline, picking from the list replaces the rest of a typed name, pre-generate length error.
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
const field='#ncs-free-text';
const val=(page,sel=field)=>page.locator(sel).evaluate(f=>f.value);
const tok=(name,id)=>`@[${name}](ref:${id})`;
const chips=(page,sel=field)=>page.locator(`${sel} .ncs-chip`).evaluateAll(els=>els.map(e=>({text:e.textContent,id:e.dataset.refId,broken:e.classList.contains('ncs-chip-broken')})));
const items=page=>page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').allInnerTexts();
const noteText=page=>page.locator('#ncs-notice').innerText();
const type=async(page,sel,text)=>{await page.locator(sel).focus();await page.keyboard.type(text);};
const addProfile=(page,p)=>page.evaluate(p=>{mock.extensionSettings.naice_shot.profiles.push({aliases:[],subject:'boy',appearance:'short hair',defaultOutfit:'',positive:'',negative:'',cardKey:'',...p});},p);
const idOf=(n)=>`${n}`.padEnd(36,'0');
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{extra:true});
  await addProfile(page,{id:'long',name:'가'.repeat(95),aliases:[]});
  await freeOn(page);
  // UI-076-03: a 95-character name stays inside the field at this width
  await page.evaluate(()=>{document.querySelector('#ncs-free-text').value='';});
  await page.locator(field).focus();await page.keyboard.type('@가가');await page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').first().click();
  const box=await page.locator(`${field} .ncs-chip`).evaluate(c=>{const f=c.closest('.ncs-chipfield').getBoundingClientRect(),r=c.getBoundingClientRect();return {over:r.right>f.right+1,wide:r.width>f.width+1};});
  assert.deepEqual(box,{over:false,wide:false},'long chip fits');
  assert.equal(await page.locator(`${field} .ncs-chip`).getAttribute('title'),'@'+'가'.repeat(95));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no sideways page scroll');
  // UI-075-07: picking for "@Le|o" replaces the rest of the name
  await page.evaluate(()=>{document.querySelector('#ncs-free-text').value='';});
  await page.locator(field).focus();await page.keyboard.type('@Leo 가');
  await page.evaluate(()=>{const f=document.querySelector('#ncs-free-text'),n=f.firstChild;const r=document.createRange();r.setStart(n,3);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));});
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft'); // refresh the list at "@Le|o"
  await page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').first().waitFor();
  await page.keyboard.press('Enter');
  assert.equal(await val(page),tok('Leo','leo')+' 가'.replace(' ',' ').replace(/^/,''),'no leftover "o"'.concat(await val(page)));
  // copy keeps a trailing newline
  await page.evaluate(()=>{document.querySelector('#ncs-free-text').value='첫줄\n둘째\n';});
  const copied=await page.locator(field).evaluate(f=>{f.focus();const r=document.createRange();r.selectNodeContents(f);const s=getSelection();s.removeAllRanges();s.addRange(r);const h=document.createElement('div');h.append(r.cloneContents());return null;});
  const sel=await page.locator(field).evaluate(f=>{f.focus();const n=f.childNodes;const r=document.createRange();r.setStart(f.firstChild,0);r.setEnd(f,2);const s=getSelection();s.removeAllRanges();s.addRange(r);const dt=new DataTransfer();f.dispatchEvent(new ClipboardEvent('copy',{clipboardData:dt,bubbles:true,cancelable:true}));return dt.getData('text/plain');});
  assert.equal(sel,'첫줄\n','copied text keeps the selected trailing newline: '+JSON.stringify(sel));
  assert.equal(await val(page),'첫줄\n둘째\n','the field itself still ignores its placeholder line');
  // Lengths: the limit is what is seen. 3,961 characters with a chip are fine; 4,001 are not.
  await page.evaluate(()=>{const f=document.querySelector('#ncs-free-text');f.value='@[Leo](ref:leo)'+'가'.repeat(3990);});
  assert.equal(await page.locator(field).evaluate(f=>f.textContent.length>3990),true);
  await page.locator(field).focus();await page.keyboard.press('End');await page.keyboard.type('나'.repeat(20));
  assert.equal(await page.locator(field).evaluate(f=>f.textContent.replace(/[​]/g,'').length),4000,'typing stops at 4,000 seen characters (chip = @Leo = 4)');
  // Hangul composition: only the part composed this time is trimmed; existing text and chips stay (UI-076-02)
  const composeOver=(data,claim)=>page.locator(field).evaluate((f,[d,c])=>{
   f.focus();const sel=getSelection(),r=document.createRange();r.selectNodeContents(f);r.collapse(false);sel.removeAllRanges();sel.addRange(r);
   document.execCommand('insertText',false,d); // what the keyboard put in; beforeinput of a composition cannot be refused
   f.dispatchEvent(new CompositionEvent('compositionend',{data:c??d,bubbles:true}));return f.value;},[data,claim]);
  await page.evaluate(()=>{document.querySelector('#ncs-free-text').value='@[Leo](ref:leo)'+'가'.repeat(3990);});
  await page.locator(field).evaluate(f=>{f.addEventListener('ncs-field-over',()=>{window.__over=(window.__over||0)+1;});});
  let after=await composeOver('나'.repeat(12));
  assert.equal(after,'@[Leo](ref:leo)'+'가'.repeat(3990)+'나'.repeat(6),'trimmed to 4,000 seen characters; old text and chip untouched');
  // the composed part cannot be located: nothing is cut, the person is told, extraction stays blocked
  await page.evaluate(()=>{document.querySelector('#ncs-free-text').value='@[Leo](ref:leo)'+'가'.repeat(3990);window.__over=0;});
  after=await composeOver('나'.repeat(12),'다른글자');
  assert.equal(after,'@[Leo](ref:leo)'+'가'.repeat(3990)+'나'.repeat(12),'nothing cut when the part is not found');
  assert.equal(await page.evaluate(()=>window.__over),1);
  await page.locator('[data-action="extract"]').click();assert.match(await noteText(page),/4,000자까지/);
  // Extract with an over-long field is stopped with a clear message before any call
  await page.evaluate(()=>{document.querySelector('#ncs-free-text').value='가'.repeat(4500);mock.extractCalls=0;});
  await page.locator('[data-action="extract"]').click();
  assert.match(await noteText(page),/4,000자까지/);assert.equal(await page.evaluate(()=>mock.extractCalls??0),0);
  // wish field: 200 seen characters; a chip counts as @name
  await page.evaluate(()=>{document.querySelector('#ncs-moment-wish').value='@[Leo](ref:leo)'+'가'.repeat(196);});
  await page.locator('#ncs-moment-wish').focus();await page.keyboard.press('End');await page.keyboard.type('나나나');
  assert.equal(await page.locator('#ncs-moment-wish').evaluate(f=>f.textContent.replace(/[​]/g,'').length),200);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: long chip names fit at 375px; list pick replaces the typed name rest; copy keeps the trailing newline; lengths follow what is seen and over-long text stops extraction');

 {
  const {page,errors}=await open(375);
  await page.locator('[data-action="generate"]').click();await idle(page);
  const attach=async n=>{await page.locator('#ncs-result [data-action="attach"]').click();await page.locator('#ncs-attach-dialog[open]').waitFor();await page.locator(`[data-attach-target="${n}"]`).click();await page.locator('#ncs-attach-dialog [data-action="attach-confirm"]').click();await page.waitForFunction(()=>!document.getElementById('ncs-attach-dialog').open);};
  const count=()=>page.evaluate(()=>mock.chat[1].extra?.naice_shot_images?.length??0);
  const noticeHas=re=>page.waitForFunction(r=>new RegExp(r).test(document.querySelector('#ncs-notice').innerText),re.source);
  // a save that silently does nothing: the picture does not stay attached on screen
  await page.evaluate(()=>{window.__save=mock.saveChat;mock.saveChat=async function(){};});
  await attach(1);await noticeHas(/저장되지 않아/);assert.equal(await count(),0);
  // the chat cannot be read back: kept as is, and the person is told it could not be checked
  await page.evaluate(()=>{mock.saveChat=async function(){await window.__save.call(this);mock.chatReadFails=true;};});
  await attach(1);await noticeHas(/확인하지 못했어요/);assert.equal(await count(),1);
  // a normal save: plain success
  await page.evaluate(()=>{mock.chatReadFails=false;mock.saveChat=window.__save;mock.chat[1].extra={};mock.savedChat=JSON.stringify(mock.chat);});
  await attach(1);await noticeHas(/#1 메시지에 그림을 넣었어요/);assert.equal(await count(),1);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: a silent failed save is undone with a message; a chat that cannot be read back is reported as unchecked and kept; a normal save succeeds');
}finally{await browser.close();server.close();}
