// v0.1.76: @프로필 참조 as chips — a pill "@Leo" that keeps the full profile id (one block, Backspace removes it whole), the list with
// a short look, copy/paste between our fields, saved and restored with broken chips, old marks and malformed ones stop, twins, required people.
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
try{
 for(const width of [375,1100]){
  const {page,errors,items:saved}=await open(width,{extra:true});
  await addProfile(page,{id:'kai',name:'Kai Lee',aliases:['카이']});
  await page.evaluate(()=>{const p=mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo');p.appearance='short brown hair, green eyes';p.defaultOutfit='white shirt';});
  await freeOn(page);
  // --- The list: '@' opens it with names, aliases and a short look (never the id); typing narrows it; Enter puts a chip in.
  await page.locator(field).fill('');await type(page,field,'@');
  await page.locator('#ncs-ref-list:not([hidden])').waitFor();
  const all=await items(page);assert.ok(all.some(t=>/Leo/.test(t)&&/레오/.test(t)&&/green eyes/.test(t)&&/white shirt/.test(t)),all.join('|'));
  assert.ok(!all.some(t=>/#|\bleo\b.*\bleo\b/.test(t.replace(/Leo|레오/g,''))),'no id shown: '+all.join('|'));
  const box=await page.locator('#ncs-ref-list').boundingBox(),fb=await page.locator(field).boundingBox();
  assert.ok(box.x>=0&&box.x+box.width<=width&&Math.abs(box.y-(fb.y+fb.height+4))<=2,'under the field, on screen');
  await page.keyboard.type('레');assert.deepEqual((await items(page)).map(t=>t.split('\n')[0]),['Leo']);
  // While Hangul is still being composed, Enter belongs to the keyboard: nothing is picked.
  await page.locator(field).evaluate(f=>{f.dispatchEvent(new CompositionEvent('compositionstart'));f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));});
  assert.deepEqual(await chips(page),[]);assert.equal(await page.locator('#ncs-ref-list').isVisible(),true);
  await page.locator(field).evaluate(f=>f.dispatchEvent(new CompositionEvent('compositionend',{data:'레'})));
  await page.keyboard.press('Enter');
  assert.deepEqual(await chips(page),[{text:'@Leo',id:'leo',broken:false}]);assert.equal(await val(page),tok('Leo','leo')+' ');
  assert.equal(await page.locator('#ncs-ref-list').isHidden(),true);
  await page.keyboard.type('랑 @mi');await page.locator('#ncs-ref-list .ncs-ref-item',{hasText:'Mira'}).click();
  assert.deepEqual((await chips(page)).map(c=>c.id),['leo','mira']);assert.equal(await val(page),`${tok('Leo','leo')} 랑 ${tok('Mira','mira')} `);
  // Escape closes only the list.
  await page.keyboard.type('@');await page.locator('#ncs-ref-list:not([hidden])').waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.locator('#ncs-ref-list').isHidden(),true);assert.equal(await page.locator('#naice-shot-dialog').evaluate(d=>d.open),true);
  // A chip is one block: Backspace takes it out whole; no leftover letters, no hidden link.
  await page.locator(field).evaluate(f=>{f.value=`놀기 ${f.value}`;f.focus();const r=document.createRange();r.selectNodeContents(f);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);});
  for(let i=0;i<3;i++)await page.keyboard.press('Backspace'); // '@' , the space, then the Mira chip
  assert.deepEqual((await chips(page)).map(c=>c.id),['leo'],'the Mira chip went in one press');
  assert.ok(!/Mira|미라/.test(await val(page)),await val(page));
  // Ctrl+Z brings back what the browser removed (the browser's own undo still works with chips).
  // An email is not a reference.
  await page.locator(field).fill('');await type(page,field,'mail a@');await page.waitForTimeout(50);assert.equal(await page.locator('#ncs-ref-list').isHidden(),true);
  // --- Required: the AI leaves Leo out; Leo is added ticked with an empty pose and a note. The AI never sees a chip or an @.
  await page.locator(field).evaluate((f,t)=>{f.value=t;},`${tok('Leo','leo')}랑 ${tok('Mira','mira')}, 레오는 빼고 공원 산책`);
  await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'mira',name:'Mira',subject:'girl',expression:'smile',action:'walking'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  const prompt=await page.evaluate(()=>mock.lastExtract.prompt??JSON.stringify(mock.lastExtract));
  const situation=prompt.slice(prompt.indexOf('SITUATION:'));
  assert.ok(!/@|\]\(ref:/.test(situation.split('REQUIRED PEOPLE')[0]),'no @ or chip text in the situation');assert.match(prompt,/Leo \(roster id leo\)/);
  assert.match(prompt,/REQUIRED PEOPLE[^\n]*"id":"leo"[^\n]*"id":"mira"/);
  assert.equal(await ticked(page,'leo'),true,'Leo is in');
  assert.match(await noteText(page),/결과에 없던 필수 인물을 넣었어요: Leo\. 표정·행동이 비어 있어요/);
  assert.ok(!/@|ref:/.test(await page.locator('#ncs-final').inputValue()),'nothing @ in the final prompt');
  assert.deepEqual((await chips(page)).map(c=>c.id),['leo','mira'],'the chips stay in the field after extracting');
  // --- A typed name is confirmed into a chip, and said so.
  await page.locator(field).fill('@레오랑 @카이가 걷는다');await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'leo',name:'Leo'},{id:'kai',name:'Kai Lee'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  assert.deepEqual((await chips(page)).map(c=>c.id),['leo','kai']);assert.equal(await val(page),`${tok('Leo','leo')}랑 ${tok('Kai Lee','kai')}가 걷는다`);
  assert.match(await noteText(page),/@레오, @카이을\(를\) 칩으로 확정했어요/);
  // --- Unclear references stop before anything is sent: unknown names, stuck letters, old or malformed marks, a chip whose profile is gone.
  const calls=()=>page.evaluate(()=>mock.extractCalls??0);
  const stops=[['@미라클 산책',/이 이름의 프로필을 찾지 못했어요/],['@Leo가방 들기',/찾지 못했어요/],['@Leo#zz99 산책',/예전 형식/],['@Ada#a 산책',/예전 형식/],['@Ada#a3 산책',/예전 형식/],['@Ada# 산책',/예전 형식/],
   [`${tok('Ghost','gone-id')} 산책`,/지워졌거나 찾을 수 없는/],['@[Leo](ref:) 산책',/지워졌거나 찾을 수 없는/]];
  // The same marks set from saved work (history, last work) are broken chips and stop with the "pick again" note.
  const savedStops=['@Leo#zz99 산책','@Ada# 산책'];
  for(const [text,why] of stops){
   // Typed or pasted text (fill) keeps old marks as plain text; set from saved work they show as broken chips.
   const before=await calls();await page.locator(field).fill(text);await page.locator('[data-action="extract"]').click();
   await page.waitForFunction(()=>document.querySelector('#ncs-notice').classList.contains('ncs-error')||/확인해 주세요/.test(document.querySelector('#ncs-notice').innerText));
   assert.match(await noteText(page),why,text);assert.equal(await calls(),before,`${text}: nothing sent`);
  }
  for(const text of savedStops){
   const before=await calls();await page.locator(field).evaluate((f,t)=>{f.value=t;},text);await page.locator('[data-action="extract"]').click();
   await page.waitForFunction(()=>/찾을 수 없는/.test(document.querySelector('#ncs-notice').innerText));assert.equal(await calls(),before,`${text}: nothing sent`);
  }
  // Broken chips look broken (dashed) and an old 0.1.75 mark shows as one; a good chip next to it does not.
  await page.locator(field).evaluate((f,t)=>{f.value=t;},`${tok('Ghost','gone-id')} ${tok('Leo','leo')} @Ada#a1b2`);
  assert.deepEqual(await chips(page),[{text:'@Ghost',id:'gone-id',broken:true},{text:'@Leo',id:'leo',broken:false},{text:'@Ada',id:'',broken:true}]);
  assert.match(await page.locator(`${field} .ncs-chip-broken`).first().getAttribute('title'),/지우고 @를 쳐서 다시 골라/);
  // A profile deleted while the chip is in the field: the chip turns broken when the field is used again.
  await page.locator(field).evaluate((f,t)=>{f.value=t;},tok('Kai Lee','kai'));
  await page.evaluate(()=>{const ps=mock.extensionSettings.naice_shot.profiles;ps.splice(ps.findIndex(p=>p.id==='kai'),1);});
  await page.locator(field).focus();assert.equal((await chips(page))[0].broken,true);
  await addProfile(page,{id:'kai',name:'Kai Lee',aliases:['카이']});await page.locator(field).evaluate(f=>f.blur());await page.locator(field).focus();assert.equal((await chips(page))[0].broken,false,'back when the profile is back');
  // --- Same name twice: a typed name stops; the list tells them apart by look; chips keep them apart, and the AI's id decides.
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.push({id:'leon-two',name:'Leo',aliases:[],subject:'boy',appearance:'blond hair, blue eyes',defaultOutfit:'red coat',positive:'',negative:'',cardKey:''});});
  await page.locator(field).fill('@Leo 산책');await page.locator('[data-action="extract"]').click();
  await page.waitForFunction(()=>/여러 개예요/.test(document.querySelector('#ncs-notice').innerText));
  await page.locator(field).fill('');await type(page,field,'@Leo');
  const twins=await items(page);assert.ok(twins.some(t=>/brown hair/.test(t))&&twins.some(t=>/blond hair/.test(t)&&/red coat/.test(t)),twins.join('|'));
  await page.locator('#ncs-ref-list .ncs-ref-item',{hasText:'blond hair'}).click();
  assert.deepEqual((await chips(page)).map(c=>c.id),['leon-two']);
  await page.keyboard.type('혼자');await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'leon-two',name:'Leo',expression:'calm',action:'reading'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  assert.equal(await ticked(page,'leon-two'),true,'the picked Leo, not the other');
  // Both Leos at once: both stay (the second is not dropped for having the same name, UI-075-03).
  await page.locator(field).evaluate((f,t)=>{f.value=t;},`${tok('Leo','leo')} ${tok('Leo','leon-two')} 대화`);
  await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'leo',name:'Leo',expression:'calm',action:'reading'},{id:'leon-two',name:'Leo',expression:'smile',action:'waving'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  assert.deepEqual((await cardIds(page)).filter(id=>id==='leo'||id==='leon-two').sort(),['leo','leon-two']);
  assert.equal(await ticked(page,'leo'),true);assert.equal(await ticked(page,'leon-two'),true);
  // --- Saved and restored: the saved text keeps the full id; sending a history picture back brings the chips back, and a profile
  // deleted in between comes back as a broken chip that stops the extraction.
  await page.locator(field).evaluate((f,t)=>{f.value=t;},`${tok('Leo','leo')}랑 ${tok('Kai Lee','kai')} 산책`);
  await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'leo',name:'Leo'},{id:'kai',name:'Kai Lee'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent.startsWith('생성했어요'));
  assert.equal(saved[0].snapshot.freeText,`${tok('Leo','leo')}랑 ${tok('Kai Lee','kai')} 산책`,'history keeps the ids');
  await page.locator(field).fill('다른 글');
  await page.locator('[data-tab="history"]').click();await pick(page,'[data-history-free]');
  assert.deepEqual(await chips(page),[{text:'@Leo',id:'leo',broken:false},{text:'@Kai Lee',id:'kai',broken:false}]);
  await page.evaluate(()=>{const ps=mock.extensionSettings.naice_shot.profiles;ps.splice(ps.findIndex(p=>p.id==='kai'),1);});
  await page.locator('[data-tab="history"]').click();await pick(page,'[data-history-free]');
  assert.deepEqual((await chips(page)).map(c=>c.broken),[false,true],'the deleted profile is a broken chip');
  const sentBefore=await page.evaluate(()=>mock.extractCalls??0);
  await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>/찾을 수 없는/.test(document.querySelector('#ncs-notice').innerText));
  assert.equal(await page.evaluate(()=>mock.extractCalls??0),sentBefore,'a broken chip sends nothing');
  await addProfile(page,{id:'kai',name:'Kai Lee',aliases:['카이']});
  // --- Copy and paste: our fields keep the ids; another app gets "@Leo" and what comes back from there is a typed name.
  await page.locator(field).evaluate((f,t)=>{f.value=t;},`${tok('Leo','leo')}랑 ${tok('Mira','mira')}`);
  const clip=await page.locator(field).evaluate(f=>{f.focus();const r=document.createRange();r.selectNodeContents(f);getSelection().removeAllRanges();getSelection().addRange(r);
   const dt=new DataTransfer();f.dispatchEvent(new ClipboardEvent('copy',{clipboardData:dt,bubbles:true,cancelable:true}));return {plain:dt.getData('text/plain'),ref:dt.getData('text/x-ncs-ref')};});
  assert.equal(clip.plain,'@Leo랑 @Mira');assert.equal(clip.ref,`${tok('Leo','leo')}랑 ${tok('Mira','mira')}`);
  const paste=(sel,data)=>page.locator(sel).evaluate((f,d)=>{f.focus();const dt=new DataTransfer();if(d.ref)dt.setData('text/x-ncs-ref',d.ref);dt.setData('text/plain',d.plain);f.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));},data);
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  await page.locator('#ncs-moment-wish').fill('');await paste('#ncs-moment-wish',clip);
  assert.deepEqual((await chips(page,'#ncs-moment-wish')).map(c=>c.id),['leo','mira'],'ids survive a copy between our fields');
  await page.locator('#ncs-moment-wish').fill('');await paste('#ncs-moment-wish',{plain:clip.plain});
  assert.deepEqual(await chips(page,'#ncs-moment-wish'),[],'text from another app is a typed name, not a chip');
  assert.equal(await val(page,'#ncs-moment-wish'),'@Leo랑 @Mira');
  // A line break in a paste becomes a space in the one-line request.
  await page.locator('#ncs-moment-wish').fill('');await paste('#ncs-moment-wish',{plain:'밥 먹는\n순간'});assert.equal(await val(page,'#ncs-moment-wish'),'밥 먹는 순간');
  // The length limits hold (request: 200 as shown; a chip counts as its "@name").
  await page.locator('#ncs-moment-wish').fill('');await page.locator('#ncs-moment-wish').focus();await page.keyboard.type('가'.repeat(205));
  assert.ok((await val(page,'#ncs-moment-wish')).length<=200,'request limited to 200');
  await page.locator('#ncs-moment-wish').fill('');
  // --- Undo: Ctrl+Z takes a just-picked chip back out.
  await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="free"]').getAttribute('aria-pressed')==='true');
  await page.locator(field).fill('');await type(page,field,'@레');await page.keyboard.press('Enter');assert.equal((await chips(page)).length,1);
  await page.keyboard.press('Control+KeyZ');assert.equal((await chips(page)).length,0,'undo removes the chip: '+await val(page));
  // --- The list scrolls with the arrow keys: the chosen item stays inside the list (UI-075-06).
  for(let i=0;i<10;i++)await addProfile(page,{id:`pad-${i}`,name:`Pad${i}`});
  await page.locator(field).fill('');await type(page,field,'@');await page.locator('#ncs-ref-list:not([hidden])').waitFor();
  for(let i=0;i<7;i++)await page.keyboard.press('ArrowDown');
  const inside=await page.evaluate(()=>{const b=document.querySelector('#ncs-ref-list').getBoundingClientRect(),r=document.querySelector('#ncs-ref-list [aria-selected="true"]').getBoundingClientRect();return r.top>=b.top-1&&r.bottom<=b.bottom+1;});
  assert.equal(inside,true,'the 8th item is in view');
  await page.keyboard.press('Escape');await page.locator(field).fill('');
  // --- UI-075-04: a required person left over from an earlier scene, missing from this answer, is ticked but loses the old pose.
  await page.locator(field).evaluate((f,t)=>{f.value=t;},`${tok('Leo','leo')} 걷는다`);
  await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'leo',name:'Leo',expression:'smile',action:'walking'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  assert.equal(await page.locator('[data-character="leo"] [data-field="action"]').inputValue(),'walking');
  await page.locator(field).evaluate((f,t)=>{f.value=t;},`${tok('Leo','leo')}랑 ${tok('Mira','mira')} 대화`);
  await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'mira',name:'Mira',subject:'girl',expression:'smile',action:'talking'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  assert.equal(await page.locator('[data-character="leo"] [data-field="action"]').inputValue(),'','the old pose is gone');
  assert.equal(await page.locator('[data-character="leo"] [data-field="expression"]').inputValue(),'');assert.equal(await ticked(page,'leo'),true);
  assert.match(await noteText(page),/결과에 없던 필수 인물을 넣었어요: Leo\. 표정·행동이 비어 있어요/);
  // --- More required people than the model allows stops (V4.5: 6). The same profile twice counts once.
  for(let i=0;i<6;i++)await addProfile(page,{id:`extra-${i}`,name:`Sam${i}`});
  await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-model').selectOption('nai-diffusion-4-5-full');await page.locator('[data-tab="scene"]').click();
  await page.locator(field).evaluate((f,t)=>{f.value=t;},`${tok('Leo','leo')} @레오 `+Array.from({length:5},(_,i)=>tok(`Sam${i}`,`extra-${i}`)).join(' '));const before6=await page.evaluate(()=>mock.extractCalls??0);
  await page.locator('[data-action="extract"]').click();await idle(page);assert.equal(await page.evaluate(()=>mock.extractCalls??0),before6+1,'Leo twice + 5 = 6 is fine');
  await page.locator(field).evaluate((f,t)=>{f.value=t;},Array.from({length:6},(_,i)=>tok(`Sam${i}`,`extra-${i}`)).join(' ')+` ${tok('Leo','leo')}`);
  await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>/한도\(6명\)를 넘어요/.test(document.querySelector('#ncs-notice').innerText));
  assert.equal(await page.evaluate(()=>mock.extractCalls??0),before6+1,'7 stops');
  await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-model').selectOption('nai-diffusion-5-full');await page.locator('[data-tab="scene"]').click();
  // --- 챗샷 추가 요청: someone not in the message can be required; a picked twin is the one drawn (UI-075-02).
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  await page.locator('#ncs-moment-wish').fill('');await type(page,'#ncs-moment-wish','@카');await page.keyboard.press('Enter');
  assert.deepEqual((await chips(page,'#ncs-moment-wish')).map(c=>c.id),['kai']);await page.keyboard.type('도 같이');
  await page.evaluate(x=>{mock.extraction=x;},one(leo()));await page.locator('[data-action="extract"]').click();await idle(page);
  const chatPrompt=await page.evaluate(()=>mock.lastExtract.prompt??JSON.stringify(mock.lastExtract));
  assert.match(chatPrompt,/REQUIRED PEOPLE[^\n]*"id":"kai"/);assert.match(chatPrompt,/Kai Lee \(roster id kai\)\s*도 같이/);
  assert.equal(await ticked(page,'kai'),true,'Kai is in');
  assert.match(await noteText(page),/결과에 없던 필수 인물을 넣었어요: Kai Lee/);
  assert.ok(!/@|ref:/.test(await page.locator('#ncs-final').inputValue()));
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.push({id:'leon-three',name:'Leo',aliases:[],subject:'boy',appearance:'white hair',defaultOutfit:'',positive:'',negative:'',cardKey:''});});
  await page.locator('#ncs-moment-wish').evaluate((f,t)=>{f.value=t;},tok('Leo','leon-three'));
  await page.evaluate(x=>{mock.extraction=x;},one(leo({id:'leon-three',name:'Leo',action:'reading'})));await page.locator('[data-action="extract"]').click();await idle(page);
  assert.equal(await page.locator('[data-character="leon-three"] [data-field="action"]').inputValue(),'reading','the picked Leo gets the action, not the Leo the chat is connected to');
  assert.equal(await ticked(page,'leon-three'),true);
  // --- UI-075-08: a person added only to another candidate is named again when that candidate is chosen.
  await page.locator('#ncs-moment-wish').evaluate((f,t)=>{f.value=t;},tok('Kai Lee','kai'));
  await page.evaluate(x=>{mock.extraction=x;},two);await page.locator('[data-action="extract"]').click();await idle(page);
  assert.match(await noteText(page),/Kai Lee/);
  await page.locator('[data-moment="0"]').click();assert.match(await noteText(page),/필수 인물을 넣었어요: Kai Lee/);assert.equal(await ticked(page,'kai'),true);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: @ opens the profile list (aliases, a short look, no id) under the field; Enter/click puts a chip in (one block, Backspace takes it out whole, Ctrl+Z undoes it); Escape closes only the list; the arrow keys keep the chosen item in view; an email is no reference; required people reach the AI as name + roster id with a REQUIRED block, are added when left out (a left-over pose from an earlier scene is cleared, with a note) and never reach the final prompt; typed names are confirmed into chips with a note; unknown names, stuck particles, old and malformed marks, gone profiles and same names stop before sending; saved work and history keep the id and restore chips (broken when the profile is gone); copy between our fields keeps ids, text from another app is a typed name; twins stay apart (also with the chat connection); a person added only to another candidate is named again; more required people than the model allows stop; 챗샷 추가 요청 can require someone not in the message (375/1100)');
}finally{await browser.close();server.close();}
