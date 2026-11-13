// v0.1.80: GPT review of 0.1.79 — an unknown one of two same-name picked people adds no third person (프리샷), long chip names
// count in full, and a link undo in the other candidates takes back only what that link changed.
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
// 0.1.117: the field is a textarea; its links are read from the saved form (a link to a missing profile is broken).
const chips=(page,sel=field)=>page.locator(sel).evaluate(f=>{const ps=mock.extensionSettings.naice_shot.profiles;return [...f.value.matchAll(/@\[([^\]\n]*)\]\(ref:([A-Za-z0-9_-]*)\)/g)].map(m=>{const p=ps.find(p=>p.id===m[2]);return {text:`@${p?p.name:m[1]}`,id:m[2],broken:!m[2]||!p};});});
const items=page=>page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').allInnerTexts();
const noteText=page=>page.locator('#ncs-notice').innerText();
const type=async(page,sel,text)=>{await page.locator(sel).focus();await page.keyboard.type(text);};
const addProfile=(page,p)=>page.evaluate(p=>{mock.extensionSettings.naice_shot.profiles.push({aliases:[],subject:'boy',appearance:'short hair',defaultOutfit:'',positive:'',negative:'',cardKey:'',...p});},p);
const cand=(title,names)=>({title,characters:[],unregistered:names,location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''});
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{extra:true});
  // UI-076-01: two picked Leos, the AI answers "Leo / reading" with no id → no third person
  await addProfile(page,{id:'leo2',name:'Leo',aliases:[],appearance:'blond hair'});
  await freeOn(page);
  await page.evaluate(()=>{document.querySelector('#ncs-free-text').value='@[Leo](ref:leo)와 @[Leo](ref:leo2)가 책을 읽는다';});
  await page.evaluate(x=>{mock.extraction=x;},freeX([{name:'Leo',id:'',action:'reading'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  assert.deepEqual(await names(page),['Leo','Leo'],'two people, not three');
  assert.match(await noteText(page),/누구인지 알 수 없어 비워 뒀어요/);
  assert.equal(await page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.some(c=>/reading/.test(c.prompt))),false,'the action is given to nobody');
  // UI-076-02: a 70-letter name counts in full — the third chip (216 seen) does not go in
  await addProfile(page,{id:'long70',name:'가'.repeat(70),aliases:['QQ']});
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  await page.evaluate(()=>{document.querySelector('#ncs-moment-wish').value='';});
  for(let i=0;i<3;i++){await page.locator('#ncs-moment-wish').focus();await page.keyboard.press('End');await page.keyboard.type('@QQ');
   await page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').first().waitFor();await page.keyboard.press('Enter');}
  assert.equal((await chips(page,'#ncs-moment-wish')).length,2,'the third does not fit');
  assert.match(await noteText(page),/@이름을 넣지 못했어요/);
  assert.ok(await page.locator('#ncs-moment-wish').evaluate(f=>f.textLength)<=200);
  await page.evaluate(()=>{document.querySelector('#ncs-moment-wish').value='';});
  assert.deepEqual(errors,[]);await page.close();
 }
 {
  // UI-078-02: link Visitor → Kai, make a Robin profile, undo the Visitor link: the other candidate keeps Robin
  const {page,errors}=await open(375);
  await page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;s.profiles=s.profiles.filter(p=>p.id==='leo').map(p=>({...p,id:'kai',name:'Kai',aliases:[],cardKey:''}));});
  await page.evaluate(d=>{mock.extraction=d;},{moments:[cand('하나',['Visitor','Robin']),cand('둘',['Visitor','Robin']),cand('셋',['Visitor'])],defaultIndex:0,requestMatched:true,requestApplied:[],requestIgnored:[],requestOutfits:[],requestVisibleOnly:false});
  await page.locator('[data-action="extract"]').click();await idle(page);
  await page.locator('[data-missing-do="link"][data-missing-name="Visitor"]').click();await page.locator('#ncs-link-profile').selectOption('kai');await page.locator('[data-missing-do="link-confirm"]').click();
  await page.locator('[data-character="kai"]').waitFor();
  await page.locator('[data-quick-profile-name="Robin"]').click();
  await page.locator('[data-profile-mode="direct"]').click();await page.locator('#ncs-profile-appearance').fill('red hair');await page.locator('#ncs-profile-submit').click();
  const robin=await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Robin').id);
  await page.locator(`[data-character="${robin}"]`).waitFor();
  // the undo button is still there after making Robin? (it belongs to the Visitor link)
  if(await page.locator('[data-missing-do="link-undo"]').count()){
   await page.locator('[data-missing-do="link-undo"]').click();await page.waitForFunction(()=>!document.querySelector('[data-character="kai"]'));
   await page.locator('[data-moment="1"]').click();
   assert.equal(await page.locator('[data-character="kai"]').count(),0,'Kai is undone in the other candidate');
   assert.equal(await page.locator(`[data-character="${robin}"]`).count(),1,'Robin made afterwards stays');
   assert.equal(await page.locator('[data-quick-profile-name="Robin"]').count(),0);assert.equal(await page.locator('[data-quick-profile-name="Visitor"]').count(),1);
  }else console.log('NOTE: making a profile clears the link undo, so the GPT order cannot happen here');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: no third person for an unknown one of two picked Leos; a 70-letter chip counts in full; a link undo keeps a profile made afterwards in the other candidates');
}finally{await browser.close();server.close();}
