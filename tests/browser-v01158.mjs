// v0.1.158: a pill under an @ field is a button: its menu shows the profile, picks another one for all its links, or takes
// them out of the field; a broken pill lists the profiles at once. Esc, a tap elsewhere, typing or a new value close it.
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
const pillsOf=(page,field)=>page.evaluate(id=>{const b=document.querySelector(`[data-pills-for="${id}"]`);
 return {hidden:b.hidden||!b.getClientRects().length,pills:[...b.querySelectorAll('.ncs-ref-pill')].map(p=>({name:p.querySelector('b').textContent,note:p.querySelector('small')?.textContent??'',broken:p.classList.contains('ncs-ref-pill-broken')}))};},field);
const waitPills=(page,field,names)=>page.waitForFunction(([id,names])=>{const b=document.querySelector(`[data-pills-for="${id}"]`);
 return JSON.stringify([...b.querySelectorAll('.ncs-ref-pill b')].map(x=>x.textContent))===JSON.stringify(names);},[field,names]);
const menuOpen=page=>page.locator('.ncs-pill-menu').count().then(n=>n>0);
const menuItems=page=>page.locator('.ncs-pill-menu button').evaluateAll(bs=>bs.map(b=>b.querySelector('b')?.textContent??b.textContent));
const pillBtn=(page,field,name)=>page.locator(`[data-pills-for="${field}"] .ncs-ref-pill`,{hasText:name});
try{
 for(const width of [320,375,1100]){
  const {page,errors}=await open(width,{extra:true});ask(page);
  const set=(sel,v)=>page.locator(sel).evaluate((f,v)=>{f.value=v;},v);
  const WID='ncs-moment-wish',FID='ncs-free-text';
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.push({id:'ada',name:'Ada',aliases:[],subject:'girl',appearance:'short silver hair',defaultOutfit:'',positive:'',negative:'',cardKey:''});});
  // --- a tap on a linked pill opens its menu; [칸에서 지우기] takes every link of that profile out, with one space each
  {await set(W,`${tok('Leo','leo')} and ${tok('Mira','mira')} hold hands ${tok('Leo','leo')}`);await waitPills(page,WID,['@Leo','@Mira']);
   await pillBtn(page,WID,'@Leo').click();assert.equal(await menuOpen(page),true);
   assert.deepEqual(await menuItems(page),['프로필 보기','다시 고르기','칸에서 지우기']);
   assert.equal(await pillBtn(page,WID,'@Leo').getAttribute('aria-expanded'),'true');
   await page.locator('.ncs-pill-menu [data-pill-do="drop"]').click();
   await waitPills(page,WID,['@Mira']);assert.equal(await val(page,W),`and ${tok('Mira','mira')} hold hands`);
   assert.equal(await menuOpen(page),false,'the menu closes after the edit');
   // the browser's undo brings the text back with its links
   await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');
   await page.waitForFunction(()=>document.querySelector('#ncs-moment-wish').value.includes('ref:leo'));
   assert.equal(await val(page,W),`${tok('Leo','leo')} and ${tok('Mira','mira')} hold hands ${tok('Leo','leo')}`);}
  // --- [다시 고르기] lists the other profiles (with their look) and puts the chosen one at every link
  {await set(W,`${tok('Mira','mira')} smiles at ${tok('Mira','mira')}`);await waitPills(page,WID,['@Mira']);
   await pillBtn(page,WID,'@Mira').click();await page.locator('.ncs-pill-menu [data-pill-do="pick"]').click();
   const items=await menuItems(page);assert.ok(!items.includes('Mira'),'not the profile it is now');assert.ok(items.includes('Leo')&&items.includes('Ada'));
   assert.equal(await page.locator('.ncs-pill-menu [data-pill-pick="ada"] .ncs-ref-look').textContent(),await page.evaluate(()=>'short silver hair'));
   await page.locator('.ncs-pill-menu [data-pill-pick="ada"]').click();
   await waitPills(page,WID,['@Ada']);assert.equal(await val(page,W),`${tok('Ada','ada')} smiles at ${tok('Ada','ada')}`);}
  // --- a broken pill shows the profiles at once (a name that matches first); a removed profile's link too
  {await set(W,`${tok('Kai','')} behind ${tok('Ghost','gone-id')}`);await waitPills(page,WID,['@Kai','@Ghost']);
   await pillBtn(page,WID,'@Kai').click();
   const items=await menuItems(page);assert.ok(items.includes('Leo')&&items.includes('Mira')&&items.includes('Ada')&&items.at(-1)==='칸에서 지우기',items.join());
   assert.match(await page.locator('.ncs-pill-menu-head').textContent(),/끊긴 연결/);
   await page.locator('.ncs-pill-menu [data-pill-pick="mira"]').click();
   await page.waitForFunction(()=>document.querySelector('#ncs-moment-wish').value.includes('ref:mira'));
   assert.equal(await val(page,W),`${tok('Mira','mira')} behind ${tok('Ghost','gone-id')}`);
   await pillBtn(page,WID,'@Ghost').click();await page.locator('.ncs-pill-menu [data-pill-do="drop"]').click();
   await waitPills(page,WID,['@Mira']);assert.equal(await val(page,W),`${tok('Mira','mira')} behind`);
   await set(W,`${tok('Ad','')} waves`);await waitPills(page,WID,['@Ad']);await pillBtn(page,WID,'@Ad').click();
   assert.equal((await menuItems(page))[0],'Ada','a profile whose name starts with the broken name comes first');
   await page.keyboard.press('Escape');}
  // --- [프로필 보기] opens that profile in 프로필
  {await set(W,`${tok('Mira','mira')} sits`);await waitPills(page,WID,['@Mira']);
   await pillBtn(page,WID,'@Mira').click();await page.locator('.ncs-pill-menu [data-pill-do="profile"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-tab="profiles"]').getAttribute('aria-selected')==='true');
   assert.equal(await page.locator('#ncs-profile-id').inputValue(),'mira');assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Mira');
   await page.locator('[data-tab="scene"]').click();}
  // --- Esc closes only the menu; the same pill again, a tap elsewhere, typing and a new value close it too
  {await set(W,`${tok('Leo','leo')} sits`);await waitPills(page,WID,['@Leo']);
   await pillBtn(page,WID,'@Leo').click();await page.keyboard.press('Escape');assert.equal(await menuOpen(page),false);
   assert.equal(await page.evaluate(()=>document.getElementById('naice-shot-dialog').open),true,'the panel stays open');
   await pillBtn(page,WID,'@Leo').click();await page.locator('.ncs-pill-menu [data-pill-do="pick"]').click();
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Escape');
   assert.equal(await menuOpen(page),false);assert.equal(await page.evaluate(()=>document.getElementById('naice-shot-dialog').open),true,'Esc with the focus outside the menu closes only the menu');
   await pillBtn(page,WID,'@Leo').click();await pillBtn(page,WID,'@Leo').click();assert.equal(await menuOpen(page),false,'tapped again: closed');
   await pillBtn(page,WID,'@Leo').click();await page.locator('#ncs-wish-label').click({position:{x:2,y:2}});assert.equal(await menuOpen(page),false,'a tap elsewhere');
   await pillBtn(page,WID,'@Leo').click();await caret(page,W,-1);await page.keyboard.type('x');await page.waitForTimeout(50);assert.equal(await menuOpen(page),false,'typing');
   await pillBtn(page,WID,'@Leo').click();await set(W,`${tok('Mira','mira')} only`);await waitPills(page,WID,['@Mira']);assert.equal(await menuOpen(page),false,'a new value');}
  // --- the text changed under an open menu (no event): the menu acts on the links as they are now, nothing else goes
  {await set(W,`${tok('Leo','leo')} and ${tok('Mira','mira')}`);await waitPills(page,WID,['@Leo','@Mira']);
   await pillBtn(page,WID,'@Leo').click();
   await page.locator(W).evaluate(f=>HTMLTextAreaElement.prototype.__lookupSetter__('value').call(f,'Leo and @Mira'));
   await page.locator('.ncs-pill-menu [data-pill-do="drop"]').click();await page.waitForTimeout(80);
   assert.equal(await val(page,W),`Leo and ${tok('Mira','mira')}`,'Mira stays');assert.equal(await menuOpen(page),false);
   await waitPills(page,WID,['@Mira']);}
  // --- the other @ field (프리샷 상황) works the same
  {await freeOn(page);await set(F,`${tok('Leo','leo')} and ${tok('Ada','ada')} at the bridge`);await waitPills(page,FID,['@Leo','@Ada']);
   await pillBtn(page,FID,'@Ada').click();await page.locator('.ncs-pill-menu [data-pill-do="drop"]').click();
   await waitPills(page,FID,['@Leo']);assert.equal(await val(page,F),`${tok('Leo','leo')} and at the bridge`);
   await page.locator('[data-mode="chat"]').click();}
  // --- names are escaped in the menu; the menu stays inside the panel
  {await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.push({id:'xss',name:'<img src=x onerror="window.__pwned=1">',aliases:[],subject:'',appearance:'',defaultOutfit:'',positive:'',negative:'',cardKey:''});});
   await set(W,`${tok('Zed','')} waits`);await waitPills(page,WID,['@Zed']);await pillBtn(page,WID,'@Zed').click();
   assert.equal(await page.locator('.ncs-pill-menu img').count(),0);assert.equal(await page.evaluate(()=>window.__pwned),undefined);
   const r=await page.locator('.ncs-pill-menu').boundingBox(),c=await page.locator('#naice-shot-dialog').boundingBox();
   assert.ok(r.x>=c.x-1&&r.x+r.width<=c.x+c.width+1,`menu inside the panel at ${width}px`);
   await page.keyboard.press('Escape');}
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: a pill opens a menu — 프로필 보기, 다시 고르기 (every link of it, the profile it is now left out), 칸에서 지우기 (one space each, undo brings it back); a broken pill lists profiles at once; Esc, the pill again, a tap elsewhere, typing and a new value close it; it acts on the links as they are; both @ fields; names escaped');
}finally{await browser.close();server.close();}
