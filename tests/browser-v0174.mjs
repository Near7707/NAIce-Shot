// v0.1.74: each picture can sit above or below the message text (chosen when putting it in, moved from the enlarged
// view), the default is above, '이 채팅의 기본 위치', and 채팅 속 그림 folded with its values in the title.
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
const sides=page=>page.evaluate(()=>{const m=document.querySelector('#chat .mes[mesid="1"]'),t=m.querySelector('.mes_text');const out={};
 for(const h of m.querySelectorAll('.ncs-inline-images')){out[h.dataset.placement]={n:h.querySelectorAll('.ncs-inline-image').length,before:!!(h.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING)};}return out;});
const placeOf=(page,id)=>page.evaluate(id=>mock.chat[1].extra.naice_shot_images.find(x=>x.id===id)?.placement??null,id);
const openFold=page=>page.evaluate(()=>{document.getElementById('ncs-chat-image-more').open=true;});
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width);
  // --- Settings: folded, values in the title; the default is above.
  await page.locator('[data-tab="settings"]').click();
  assert.equal(await page.locator('#ncs-chat-image-more').evaluate(d=>d.open),false,'folded');
  assert.equal(await page.locator('#ncs-image-placement').isVisible(),false);
  assert.equal(await page.locator('#ncs-chat-image-summary').innerText(),' · 글 위 · 넘겨보기 · 보통 · 그리기 아이콘 끔');
  await openFold(page);assert.equal(await page.locator('#ncs-image-placement').inputValue(),'above');
  assert.match(await page.locator('#ncs-chat-image-more').innerText(),/이 채팅의 기본 위치/);
  assert.match(await page.locator('.ncs-place-note').innerText(),/그림마다 위치를 따로 정할 수도 있어요\. \[본문에 넣기\]로 넣을 때 고르거나, 채팅 속 그림을 눌러 확대창 ⋯에서 옮길 수 있어요\. 따로 정한 그림은 기본 위치를 바꿔도 그 자리에 있어요\./);
  // --- Put one in below on purpose.
  await page.locator('[data-tab="scene"]').click();await page.locator('[data-action="generate"]').click();await idle(page);
  const a=await page.evaluate(()=>document.querySelector('#ncs-result img').getAttribute('src').match(/([\w-]+)\.png/)[1]);
  await page.locator('#ncs-result [data-action="attach"]').click();
  assert.equal(await page.locator('[data-attach-place=""]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-attach-place=""]').innerText(),'기본 위치 (글 위)');
  await page.locator('[data-attach-target="1"]').click();await page.locator('[data-attach-place="below"]').click();
  assert.equal(await page.locator('[data-attach-place="below"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-action="attach-confirm"]').click();
  await page.waitForFunction(()=>/#1 메시지 글 아래에 그림을 넣었어요/.test(document.querySelector('#ncs-notice').innerText));
  assert.equal(await placeOf(page,a),'below');assert.deepEqual(await sides(page),{below:{n:1,before:false}});
  // --- A second one with the default: above the text.
  await page.locator('[data-action="generate"]').click();await idle(page);
  const b=await page.evaluate(()=>document.querySelector('#ncs-result img').getAttribute('src').match(/([\w-]+)\.png/)[1]);
  await page.locator('#ncs-result [data-action="attach"]').click();await page.locator('[data-attach-target="1"]').click();await page.locator('[data-action="attach-confirm"]').click();
  await page.waitForFunction(id=>mock.chat[1].extra.naice_shot_images.some(x=>x.id===id),b);
  assert.equal(await placeOf(page,b),null,'no own place');assert.deepEqual(await sides(page),{above:{n:1,before:true},below:{n:1,before:false}});
  // --- 이 채팅의 기본 위치 = below: the default one follows, the chosen one stays; one group of two.
  await page.locator('[data-tab="settings"]').click();await openFold(page);await page.locator('#ncs-chat-image-placement').selectOption('below');
  await page.waitForFunction(()=>!document.querySelector('#chat .mes[mesid="1"] .ncs-inline-images[data-placement="above"]'));
  assert.deepEqual(await sides(page),{below:{n:2,before:false}});assert.match(await page.locator('#ncs-chat-image-summary').innerText(),/글 아래\(이 채팅\)/);
  await page.locator('#ncs-chat-image-placement').selectOption('');await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="1"] .ncs-inline-images[data-placement="above"]'));
  await page.locator('[data-action="close"]').click();
  // --- From the enlarged view: 글 위로 옮기기, then 기본 위치로 되돌리기. Above comes first when moving through them.
  await page.locator('#chat .mes[mesid="1"] .ncs-inline-images[data-placement="below"] .ncs-inline-open').click();await viewerReady(page);
  assert.equal(await page.locator('#ncs-viewer .ncsv-position').innerText(),'2 / 2','the picture above the text comes first');
  await page.locator('#ncs-viewer [data-v="more"]').click();
  const labels=await page.locator('#ncs-viewer .ncsv-more-items button').allInnerTexts().then(t=>t.map(x=>x.split('\n')[0]));
  assert.ok(labels.includes('글 위로 옮기기')&&labels.includes('기본 위치로 되돌리기')&&!labels.includes('글 아래로 옮기기'),labels.join(','));
  await page.locator('#ncs-viewer .ncsv-more-items button',{hasText:'글 위로 옮기기'}).click();
  await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open);await page.waitForFunction(id=>mock.chat[1].extra.naice_shot_images.find(x=>x.id===id).placement==='above',a);
  await page.waitForFunction(()=>!document.querySelector('#chat .mes[mesid="1"] .ncs-inline-images[data-placement="below"]'));
  assert.deepEqual(await sides(page),{above:{n:2,before:true}});
  await page.locator('#chat .mes[mesid="1"] .ncs-inline-image.ncs-current .ncs-inline-open').click();await viewerReady(page);
  await page.locator('#ncs-viewer [data-v="more"]').click();await page.locator('#ncs-viewer .ncsv-more-items button',{hasText:'기본 위치로 되돌리기'}).click();
  await page.waitForFunction(id=>!('placement' in mock.chat[1].extra.naice_shot_images.find(x=>x.id===id)),a);
  // A picture without its own place offers only the move.
  await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').first().click();await viewerReady(page);await page.locator('#ncs-viewer [data-v="more"]').click();
  const plain=await page.locator('#ncs-viewer .ncsv-more-items button').allInnerTexts().then(t=>t.map(x=>x.split('\n')[0]));
  assert.ok(plain.includes('글 아래로 옮기기')&&!plain.includes('기본 위치로 되돌리기'));await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open);
  // --- Putting an attached picture in again with another place moves it.
  await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="scene"]').click();await page.locator('#ncs-result [data-action="attach"]').click();
  assert.equal(await page.locator('[data-attach-target="1"]').getAttribute('aria-pressed'),'true');await page.locator('[data-attach-place="below"]').click();await page.locator('[data-action="attach-confirm"]').click();
  await page.waitForFunction(()=>/이미 있던 1장은 글 아래로 옮겼어요/.test(document.querySelector('#ncs-notice').innerText));
  assert.equal(await placeOf(page,b),'below');assert.equal(await page.evaluate(()=>mock.chat[1].extra.naice_shot_images.length),2,'not added twice');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: 채팅 속 그림 folded with values in its title, default above, 이 채팅의 기본 위치 and the per-picture note; 본문에 넣기 chooses 기본 위치/글 위/글 아래; the chat default moves only pictures without their own place; the enlarged view moves a picture and puts it back to the default, above coming first; putting an attached picture in again with another place moves it (375/1100)');
}finally{await browser.close();server.close();}
