// v0.1.73: 추출 AI 세부 설정 folded (values in its title), an edited profile keeps its place, the history card's ⋯
// comes first, 넘겨보기 without a frame (buttons only) and 격자 at one height without grey cells.
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
const rect=(page,sel)=>page.locator(sel).first().boundingBox();
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{extra:true});
  // --- 추출 AI: the connection, its refresh button and the cost line stay; the rest is folded with its values in the title.
  await page.locator('[data-tab="settings"]').click();
  const more=page.locator('#ncs-extraction-more');
  assert.equal(await more.evaluate(d=>d.open),false,'folded by default');
  for(const sel of ['#ncs-extraction-profile','[data-action="refresh-extraction-profiles"]'])assert.equal(await page.locator(sel).isVisible(),true,sel);
  assert.equal(await page.locator('p',{hasText:'추출 요청에도 해당 AI의 사용량·API 비용이 들어가요'}).isVisible(),true,'cost line visible');
  for(const sel of ['#ncs-extraction-max-tokens','#ncs-extraction-temperature','#ncs-schema'])assert.equal(await page.locator(sel).isVisible(),false,`${sel} folded`);
  assert.equal(await page.locator('#ncs-extraction-state').isVisible(),false,'no "○○로 추출" line');
  const summary=page.locator('#ncs-extraction-summary');
  assert.match(await summary.innerText(),/응답 한도 \d+ · 온도 연결 값 · JSON (켬|끔)/);
  await more.locator('summary').click();await page.locator('#ncs-extraction-temperature').fill('0.3');await page.locator('#ncs-extraction-temperature').blur();
  await page.waitForFunction(()=>/온도 0\.3/.test(document.querySelector('#ncs-extraction-summary').textContent));
  const json=await page.locator('#ncs-schema').isChecked();await page.locator('#ncs-schema').click();
  await page.waitForFunction(on=>document.querySelector('#ncs-extraction-summary').textContent.includes(on?'JSON 끔':'JSON 켬'),json);
  await page.locator('#ncs-extraction-max-tokens').fill('4096');await page.locator('#ncs-extraction-max-tokens').blur();
  await page.waitForFunction(()=>/응답 한도 4096/.test(document.querySelector('#ncs-extraction-summary').textContent));
  // A connection that is gone still says so, outside the fold.
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.extractionProfileId='gone-profile';});await page.locator('[data-action="refresh-extraction-profiles"]').click();
  await page.waitForFunction(()=>!document.querySelector('#ncs-extraction-state').hidden);assert.match(await page.locator('#ncs-extraction-state').innerText(),/찾지 못했어요/);
  // --- An edited profile keeps its place.
  const order=()=>page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.map(p=>p.id));
  const before=await order();assert.ok(before.indexOf('leo')<before.indexOf('mira'));
  await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile="leo"]').click();
  await page.locator('#ncs-profile-appearance').fill('short silver hair');await page.locator('#ncs-profile-form [type="submit"]').first().click();
  await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo').appearance==='short silver hair');
  assert.deepEqual(await order(),before,'same order after saving');
  const chips=await page.locator('#ncs-profile-list [data-profile]').evaluateAll(els=>els.map(e=>e.dataset.profile));assert.deepEqual(chips,before,'the list shows the same order');
  // A new profile still goes to the end.
  await page.locator('[data-action="new-profile"]').click();await page.locator('#ncs-profile-name').fill('Kai');await page.locator('#ncs-profile-appearance').fill('short black hair');
  await page.locator('#ncs-profile-form [type="submit"]').first().click();await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.at(-1).name==='Kai');
  // --- History card: ⋯ | 저장 ▾ | 삭제, and ⋯ opens toward the card.
  await page.locator('[data-tab="scene"]').click();await page.locator('[data-action="generate"]').click();await idle(page);
  await page.locator('[data-tab="history"]').click();await page.locator('.ncs-history-card').first().waitFor();
  const c='.ncs-history-card .ncs-history-actions',dots=await rect(page,`${c} [data-image-more]:not(.ncs-save-toggle)`),save=await rect(page,`${c} .ncs-save-toggle`),del=await rect(page,`${c} [data-history-delete]`);
  assert.ok(dots.x+dots.width<=save.x+0.5&&save.x+save.width<=del.x+0.5,'⋯ | 저장 | 삭제');
  await page.locator(`${c} [data-image-more]:not(.ncs-save-toggle)`).first().click();const menu=await rect(page,'.ncs-image-popup:popover-open');
  assert.ok(Math.abs(menu.x-Math.max(8,dots.x))<=1&&menu.x+menu.width<=width,'the menu opens from ⋯ and stays on screen');
  assert.match(await page.locator('.ncs-image-popup:popover-open').innerText(),/챗샷으로 보내기/);await page.keyboard.press('Escape');
  const save2=await rect(page,`${c} .ncs-save-toggle`);await page.locator(`${c} .ncs-save-toggle`).first().click();const sm=await rect(page,'.ncs-image-popup:popover-open');
  assert.ok(sm.x>=0&&sm.x+sm.width<=width&&Math.abs(sm.x-Math.min(save2.x,width-8-sm.width))<=1,'저장 menu opens from 저장');await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: 추출 AI keeps the connection, refresh and cost line in view and folds the rest with its values in the title (updated on change), a lost connection is still told; an edited profile keeps its place (a new one goes last); history card ⋯ | 저장 | 삭제 with menus opening from their buttons (375/1100)');
}finally{await browser.close();server.close();}
