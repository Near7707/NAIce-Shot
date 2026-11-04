// v0.1.75: @프로필 참조 — the list while typing @, @Name#id in the text, typed names confirmed, unclear references stop,
// required people always in the result (added when the AI leaves them out), the model's limit, nothing @ reaches NovelAI.
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
const items=page=>page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').allInnerTexts();
const noteText=page=>page.locator('#ncs-notice').innerText();
const type=async(page,sel,text)=>{await page.locator(sel).focus();await page.keyboard.type(text);};
const addProfile=(page,p)=>page.evaluate(p=>{mock.extensionSettings.naice_shot.profiles.push({aliases:[],subject:'boy',appearance:'short hair',defaultOutfit:'',positive:'',negative:'',cardKey:'',...p});},p);
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{extra:true});
  await addProfile(page,{id:'kai',name:'Kai Lee',aliases:['카이']});
  await freeOn(page);
  // --- The list: '@' opens it with names, aliases and short ids; typing narrows it; Enter puts @Name#id in.
  await page.locator(field).fill('');await type(page,field,'@');
  await page.locator('#ncs-ref-list:not([hidden])').waitFor();
  const all=await items(page);assert.ok(all.some(t=>/Leo/.test(t)&&/레오/.test(t)&&/#leo/.test(t)),all.join('|'));
  const box=await page.locator('#ncs-ref-list').boundingBox(),fb=await page.locator(field).boundingBox();
  assert.ok(box.x>=0&&box.x+box.width<=width&&Math.abs(box.y-(fb.y+fb.height+4))<=2,'under the field, on screen');
  await page.keyboard.type('레');assert.deepEqual((await items(page)).map(t=>t.split('\n')[0]),['Leo']);
  // While Hangul is still being composed, Enter belongs to the keyboard: nothing is picked.
  await page.locator(field).evaluate(f=>{f.dispatchEvent(new CompositionEvent('compositionstart'));f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));});
  assert.equal(await page.locator(field).inputValue(),'@레');assert.equal(await page.locator('#ncs-ref-list').isVisible(),true);
  await page.locator(field).evaluate(f=>f.dispatchEvent(new CompositionEvent('compositionend',{data:'레'})));
  await page.keyboard.press('Enter');assert.equal(await page.locator(field).inputValue(),'@Leo#leo');
  assert.equal(await page.locator('#ncs-ref-list').isHidden(),true);
  await page.keyboard.type('랑 @mi');await page.locator('#ncs-ref-list .ncs-ref-item',{hasText:'Mira'}).click();
  assert.equal(await page.locator(field).inputValue(),'@Leo#leo랑 @Mira#mira');
  // Escape closes only the list.
  await page.keyboard.type(' @');await page.locator('#ncs-ref-list:not([hidden])').waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.locator('#ncs-ref-list').isHidden(),true);assert.equal(await page.locator('#naice-shot-dialog').evaluate(d=>d.open),true);
  // An email is not a reference.
  await page.locator(field).fill('');await type(page,field,'mail a@');await page.waitForTimeout(50);assert.equal(await page.locator('#ncs-ref-list').isHidden(),true);
  // --- Required: the AI leaves Leo out; Leo is added ticked with an empty pose and a note. The AI never sees @ or #id.
  await page.locator(field).fill('@Leo#leo랑 @Mira#mira, 레오는 빼고 공원 산책');
  await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'mira',name:'Mira',subject:'girl',expression:'smile',action:'walking'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  const prompt=await page.evaluate(()=>mock.lastExtract.prompt??JSON.stringify(mock.lastExtract));
  const situation=prompt.slice(prompt.indexOf('SITUATION:'));
  assert.ok(!/@|#leo|#mira/.test(situation.split('REQUIRED PEOPLE')[0]),'no @ or #id in the situation');assert.match(prompt,/Leo \(roster id leo\)/);
  assert.match(prompt,/REQUIRED PEOPLE[^\n]*"id":"leo"[^\n]*"id":"mira"/);
  assert.equal(await page.locator('[data-character="leo"] [data-field="included"]').isChecked(),true,'Leo is in');
  assert.match(await noteText(page),/결과에 없던 필수 인물을 넣었어요: Leo\. 표정·행동이 비어 있어요/);
  assert.ok(!/@|#leo/.test(await page.locator('#ncs-final').inputValue()),'nothing @ in the final prompt');
  // --- A typed name is confirmed into the id form, and said so.
  await page.locator(field).fill('@레오랑 @카이가 걷는다');await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'leo',name:'Leo'},{id:'kai',name:'Kai Lee'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  assert.equal(await page.locator(field).inputValue(),'@Leo#leo랑 @Kai Lee#kai가 걷는다');assert.match(await noteText(page),/@레오 → @Leo#leo, @카이 → @Kai Lee#kai로 확정했어요/);
  // --- Unclear references stop before anything is sent.
  const calls=()=>page.evaluate(()=>mock.extractCalls??0);
  for(const [text,why] of [['@미라클 산책',/이 이름의 프로필을 찾지 못했어요/],['@Leo가방 들기',/찾지 못했어요/],['@Leo#zz99 산책',/지워졌거나 찾을 수 없는/],['@Leo#leo가방',/붙어 있어요/]]){
   const before=await calls();await page.locator(field).fill(text);await page.locator('[data-action="extract"]').click();
   await page.waitForFunction(()=>document.querySelector('#ncs-notice').classList.contains('ncs-error')||/확인해 주세요/.test(document.querySelector('#ncs-notice').innerText));
   assert.match(await noteText(page),why,text);assert.equal(await calls(),before,`${text}: nothing sent`);
  }
  // --- Same name twice: a typed name stops; picked ids keep them apart, and the AI's id decides.
  await addProfile(page,{id:'leon-two',name:'Leo',aliases:[]});
  await page.locator(field).fill('@Leo 산책');await page.locator('[data-action="extract"]').click();
  await page.waitForFunction(()=>/여러 개예요/.test(document.querySelector('#ncs-notice').innerText));
  await page.locator(field).fill('');await type(page,field,'@Leo');
  const twins=await items(page);assert.ok(twins.some(t=>/#leo$/.test(t.replace(/\s/g,'')))&&twins.some(t=>/#leon$/.test(t.replace(/\s/g,''))),twins.join('|'));
  await page.locator(field).fill('@Leo#leon 혼자');await page.evaluate(x=>{mock.extraction=x;},freeX([{id:'leon-two',name:'Leo',expression:'calm',action:'reading'}]));
  await page.locator('[data-action="extract"]').click();await idle(page);
  assert.equal(await page.locator('[data-character="leon-two"] [data-field="included"]').isChecked(),true,'the picked Leo, not the other');
  // --- More required people than the model allows stops (V4.5: 6). The same profile twice counts once.
  for(let i=0;i<6;i++)await addProfile(page,{id:`extra-${i}`,name:`Sam${i}`});
  await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-model').selectOption('nai-diffusion-4-5-full');await page.locator('[data-tab="scene"]').click();
  await page.locator(field).fill('@Leo#leo @레오 '+Array.from({length:5},(_,i)=>`@Sam${i}#extra-${i}`).join(' '));const before=await calls();
  await page.locator('[data-action="extract"]').click();await idle(page);assert.equal(await calls(),before+1,'Leo twice + 5 = 6 is fine');
  await page.locator(field).fill(Array.from({length:6},(_,i)=>`@Sam${i}#extra-${i}`).join(' ')+' @Leo#leo');
  await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>/한도\(6명\)를 넘어요/.test(document.querySelector('#ncs-notice').innerText));
  assert.equal(await calls(),before+1,'7 stops');
  await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-model').selectOption('nai-diffusion-5-full');await page.locator('[data-tab="scene"]').click();
  // --- 챗샷 추가 요청: someone not in the message can be required.
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  await page.locator('#ncs-moment-wish').fill('');await type(page,'#ncs-moment-wish','@카');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#ncs-moment-wish').inputValue(),'@Kai Lee#kai');await page.keyboard.type('도 같이');
  await page.evaluate(x=>{mock.extraction=x;},one(leo()));await page.locator('[data-action="extract"]').click();await idle(page);
  const chatPrompt=await page.evaluate(()=>mock.lastExtract.prompt??JSON.stringify(mock.lastExtract));
  assert.match(chatPrompt,/REQUIRED PEOPLE[^\n]*"id":"kai"/);assert.match(chatPrompt,/Kai Lee \(roster id kai\)도 같이/);
  assert.equal(await page.locator('[data-character="kai"] [data-field="included"]').isChecked(),true,'Kai is in');
  assert.match(await noteText(page),/결과에 없던 필수 인물을 넣었어요: Kai Lee/);
  assert.ok(!/@|#kai/.test(await page.locator('#ncs-final').inputValue()));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: @ opens the profile list (aliases, short ids) under the field; Enter/click puts @Name#id in; Escape closes only the list; an email is no reference; required people reach the AI as name + roster id with a REQUIRED block, are added when left out (note on the empty pose) and never reach the final prompt; typed names are confirmed with a note; unknown names, stuck particles, gone ids and same names stop before sending; picked twins stay apart; more required people than the model allows stop (same profile counted once); 챗샷 추가 요청 can require someone not in the message (375/1100)');
}finally{await browser.close();server.close();}
