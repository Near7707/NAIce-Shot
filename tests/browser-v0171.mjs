// v0.1.71: UI-070-01..04 (narrow viewer row while loading, menus over the prompt, the look reset on a profile switch,
// delete errors inside the view), the message icon on the date line, 넘겨보기·격자·세로 in three sizes, the short storage note.
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
const viewerReady=page=>page.waitForFunction(()=>{const d=document.getElementById('ncs-viewer'),i=d?.querySelector('.ncsv-stage img');return d?.open&&d.dataset.loaded&&i?.naturalWidth&&i.style.visibility!=='hidden';});
const rect=(page,sel)=>page.locator(sel).first().boundingBox();
const apart=(a,b)=>a.x+a.width<=b.x+0.5;
const holder='#chat .mes[mesid="1"] .ncs-inline-images';
const setting=async(page,id,value)=>{await page.locator('[data-tab="settings"]').click();await page.locator(`#${id}`).selectOption(value);await page.waitForFunction(([v])=>document.querySelector('#chat .mes[mesid="1"] .ncs-inline-images')?.dataset.layout&&true,[value]);};
// Three pictures in message #1.
async function threeInMessage(page){
 for(let i=0;i<3;i++){await page.locator('[data-action="generate"]').click();await idle(page);await page.locator('[data-action="attach"]').click();await page.locator('[data-attach-target="1"]').click();await page.locator('[data-action="attach-confirm"]').click();await page.waitForTimeout(150);}
 await page.waitForFunction(()=>document.querySelectorAll('#chat .mes[mesid="1"] .ncs-inline-open').length===3);
}
try{
 // --- UI-070-01: ⋯ | ‹ n/m › | 저장 · 삭제 never touch, also while the next picture is still loading.
 for(const width of [320,360,375]){
  const {page,errors}=await open(width);
  for(let i=0;i<3;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=3);
  await page.locator('[data-view-history]').first().click();await viewerReady(page);
  const check=async when=>{const more=await rect(page,'#ncs-viewer .ncsv-more-wrap'),nav=await rect(page,'#ncs-viewer .ncsv-navigation'),save=await rect(page,'#ncs-viewer .ncsv-save-group');
   assert.ok(apart(more,nav)&&apart(nav,save),`${width}px ${when}: no overlap (${Math.round(more.x+more.width)}|${Math.round(nav.x)}-${Math.round(nav.x+nav.width)}|${Math.round(save.x)})`);assert.ok(save.x+save.width<=width,'inside the screen');};
  await check('idle');
  // The history thumbnails already hold the file, so the next picture's decoding is held back instead.
  await page.evaluate(()=>{const real=HTMLImageElement.prototype.decode;window.__hold=new Promise(r=>window.__release=r);
   HTMLImageElement.prototype.decode=async function(){const h=window.__hold;await real.call(this);if(h)await h;};});
  await page.locator('#ncs-viewer [data-v="next"]').click();
  await page.waitForFunction(()=>{const t=document.querySelector('#ncs-viewer .ncsv-toast');return t&&!t.hidden&&t.textContent==='불러오는 중…';});
  await check('loading');await page.evaluate(()=>{const r=window.__release;window.__hold=null;r();});
  await page.waitForFunction(()=>document.querySelector('#ncs-viewer .ncsv-toast').textContent!=='불러오는 중…');await viewerReady(page);
  assert.deepEqual(errors,[]);await page.close();
 }
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{extra:true});const st=ask(page);
  await threeInMessage(page);await page.locator('[data-action="close"]').click();
  // --- 넘겨보기 is the default: one picture at a time, ‹ 1/3 ›, the shown picture opens.
  assert.equal(await page.locator(holder).getAttribute('data-layout'),'slide');assert.equal(await page.locator(holder).getAttribute('data-size'),'medium');
  const count=page.locator(`${holder} .ncs-inline-slide-count`);assert.equal(await count.innerText(),'1 / 3');
  assert.equal(await page.locator(`${holder} .ncs-inline-slide-prev`).isDisabled(),true);
  const frame=await rect(page,`${holder} .ncs-inline-image`);assert.ok(Math.abs(frame.height-Math.min(320,900*.7))<=1,`보통 = 320px (${frame.height})`);
  assert.equal(await page.locator(`${holder} .ncs-inline-track`).getAttribute('data-swipe-ignore'),'true','a sideways swipe is not a reroll');
  await page.locator(`${holder} .ncs-inline-slide-next`).click();await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .ncs-inline-slide-count').textContent==='2 / 3');
  await page.waitForFunction(()=>{const h=document.querySelector('#chat .mes[mesid="1"] .ncs-inline-images'),t=h.querySelector('.ncs-inline-track').getBoundingClientRect(),s=h.querySelectorAll('.ncs-inline-image')[1].getBoundingClientRect();return Math.abs(s.x-t.x)<=2;},null,{timeout:3000}); // the second picture is in view
  await page.locator(`${holder} .ncs-inline-open`).nth(1).click();await viewerReady(page);assert.equal(await page.locator('#ncs-viewer .ncsv-position').innerText(),'2 / 3');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open);
  // Swipe = native scroll with snapping.
  await page.locator(`${holder} .ncs-inline-track`).evaluate(t=>t.scrollTo({left:t.clientWidth*2}));await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .ncs-inline-slide-count').textContent==='3 / 3');
  assert.equal(await page.locator(`${holder} .ncs-inline-slide-next`).isDisabled(),true);
  // --- 격자: 2 columns on a phone, 3 on PC; 작게 = 120px tiles.
  await page.locator('.ncs-launch-button').click();
  await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-inline-layout').selectOption('grid');await page.locator('#ncs-inline-size').selectOption('small');
  await page.waitForFunction(()=>{const h=document.querySelector('#chat .mes[mesid="1"] .ncs-inline-images');return h.dataset.layout==='grid'&&h.dataset.size==='small';});
  const tiles=await page.locator(`${holder} .ncs-inline-image`).evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.y),Math.round(r.height)];}));
  const firstRow=tiles.filter(t=>t[0]===tiles[0][0]).length;assert.equal(firstRow,width<700?2:3,`${width<700?2:3} per row`);assert.ok(tiles.every(t=>t[1]===120),'작게 = 120px tiles');
  assert.equal(await page.locator(`${holder} .ncs-inline-image img`).first().evaluate(i=>getComputedStyle(i).objectFit),'contain','whole picture, not cropped');
  // --- 세로 + 크게: one under another, up to 480px.
  await page.locator('#ncs-inline-layout').selectOption('stack');await page.locator('#ncs-inline-size').selectOption('large');
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .ncs-inline-images').dataset.layout==='stack');
  assert.equal(await page.locator(`${holder} .ncs-inline-image img`).first().evaluate(i=>getComputedStyle(i).maxHeight),'480px');
  assert.deepEqual(await page.evaluate(()=>[mock.extensionSettings.naice_shot.inlineLayout,mock.extensionSettings.naice_shot.inlineSize]),['stack','large'],'saved');
  // --- One picture: just the picture, whatever the layout.
  await page.locator('#ncs-inline-layout').selectOption('slide');
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .ncs-inline-images').dataset.layout==='slide');
  // --- The storage note: the short version.
  await page.locator('[data-tab="history"]').click();await page.locator('.ncs-storage-info summary').click();
  const note=await page.locator('.ncs-storage-info').innerText();
  for(const line of ['SillyTavern/data/<사용자>/ 아래에 저장돼요.','그림: user/images/naice-shot/','생성 기록(프롬프트·설정·장면): naice-shot-records/','마지막 작업: naice-shot-work/','파일명에는 사용자·캐릭터·채팅 이름이 들어가지 않아요. 단, 원본 PNG와 생성 기록 안에는 프롬프트가 남아요.',
   '[삭제]: 그림과 기록을 함께 지워요.','[이 메시지에서 빼기]: 채팅에서만 빼요. 그림과 기록은 남아요.','이력 전체 삭제: 그 채팅의 그림·기록과 마지막 작업까지 지워요.','설정 → 저장된 작업 모두 지우기: 마지막 작업만 지워요. 그림과 기록은 남아요.'])assert.ok(note.includes(line),line);
  assert.doesNotMatch(note,/다운로드 폴더|폴더에서 직접/,'the long parts moved to the manual');
  // --- UI-070-02: with the prompt open, 저장 ▾ and its notes sit on top.
  await page.locator('[data-view-history]').first().click();await viewerReady(page);
  await page.locator('#ncs-viewer .ncsv-prompt summary').click();await page.waitForFunction(()=>document.querySelector('#ncs-viewer .ncsv-prompt-text').textContent.length>0);
  await page.locator('#ncs-viewer [data-v="save-menu"]').click();
  const onTop=await page.locator('#ncs-viewer [data-v="clean"]').evaluate(b=>{const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
  assert.equal(onTop,true,'클린 PNG can be clicked over the prompt');
  await page.route('**/user/images/naice-shot/**',r=>r.abort(),{times:1});await page.locator('#ncs-viewer [data-v="clean"]').click();
  await page.waitForFunction(()=>{const t=document.querySelector('#ncs-viewer .ncsv-toast');return t&&!t.hidden&&t.textContent.length>0;});
  // The note ignores taps (pointer-events:none), so compare the layers: row 1 (with the note) above the prompt row.
  const toastTop=await page.evaluate(()=>{const v=document.getElementById('ncs-viewer'),z=s=>Number(getComputedStyle(v.querySelector(s)).zIndex);return v.querySelector('.ncsv-toast').parentElement.classList.contains('ncsv-tools')&&z('.ncsv-tools')>z('.ncsv-prompt-row')&&!v.querySelector('.ncsv-toast').hidden;});
  assert.equal(toastTop,true,'the failure note is not under the prompt');
  // --- UI-070-04: a failed delete is told inside the view.
  await page.route('**/api/plugins/naice-shot/delete',r=>r.fulfill({status:500,json:{error:'삭제 실패 예시'}}),{times:1});
  await page.locator('#ncs-viewer [data-v="delete"]').click();
  await page.waitForFunction(()=>/삭제|실패|오류/.test(document.querySelector('#ncs-viewer .ncsv-toast').textContent)&&document.getElementById('ncs-viewer').open);
  assert.equal(await page.locator('#ncs-viewer').evaluate(d=>d.open),true,'the view stays');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open);
  // --- UI-070-03: switching the card to another profile drops the old look edit.
  await page.locator('[data-tab="scene"]').click();const card=page.locator('[data-character="leo"]');
  await card.locator('.ncs-fixed-look summary').click();await card.locator('[data-look-field="appearance"]').fill('silver hair, freckles');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.some(c=>/freckles/.test(c.prompt)));
  await card.locator('[data-profile-switch]').selectOption('mira');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.some(c=>c.name==='Mira'));
  const fin=await page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.find(c=>c.name==='Mira').prompt);
  assert.doesNotMatch(fin,/freckles/);assert.match(fin,/long black hair/);
  // --- Message icon: always visible after the date; at the end of the button row when the theme hides the date.
  await page.locator('[data-tab="settings"]').click();const box=page.locator('#ncs-message-button');await box.check();
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .extraMesButtons .ncs-mes-draw'));
  await page.locator('[data-action="close"]').click();
  await page.evaluate(()=>{for(const m of document.querySelectorAll('#chat .mes')){const s=document.createElement('small');s.className='timestamp';s.textContent='2026. 1. 1. 오후 3:00';m.querySelector('.mes_block').prepend(s);}});
  await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="settings"]').click();await box.uncheck();await box.check();await page.locator('[data-action="close"]').click();
  const icon=page.locator('#chat .mes[mesid="1"] .timestamp + .ncs-mes-draw');await icon.waitFor();
  assert.equal(await icon.isVisible(),true,'shown without opening any menu');assert.equal(await page.locator('#chat .mes[mesid="1"] .extraMesButtons .ncs-mes-draw').count(),0,'only one icon');
  const ib=await icon.boundingBox(),sb=await rect(page,'#chat .mes[mesid="1"] .timestamp');assert.ok(Math.abs((ib.y+ib.height/2)-(sb.y+sb.height/2))<=4&&ib.x>=sb.x+sb.width,'on the date line, right after it');
  await icon.click();await page.waitForFunction(()=>document.getElementById('naice-shot-dialog').open);
  await page.locator('[data-action="close"]').click();
  await page.addStyleTag({content:'#chat .timestamp{display:none}'});await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="settings"]').click();await box.uncheck();await box.check();
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .extraMesButtons .ncs-mes-draw')&&!document.querySelector('#chat .timestamp + .ncs-mes-draw'));
  await box.uncheck();await page.waitForFunction(()=>!document.querySelector('#chat .ncs-mes-draw'));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: viewer row never overlaps at 320/360/375 even while loading; 저장 ▾ and notes over the prompt; a failed delete is told in the view; a profile switch drops the old look; message pictures 넘겨보기 (default, ‹ › and swipe) / 격자 (2 or 3 per row) / 세로 in 작게·보통·크게, saved; short storage note; message icon right after the date, or at the end of the button row when the date is hidden (375/1100)');
}finally{await browser.close();server.close();}
