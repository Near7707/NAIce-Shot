// v0.1.69: GPT's 0.1.68 review — a check started before a refusal cannot restore the old verdict (UI-068-01);
// an account-check failure of any kind drops it too (UI-068-02, server 0.1.17).
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
const OPUS={tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:100,isNegative:false,timeUntilNextPercent:600},perks:{contextTokens:8192},anlas:{subscription:1000,purchased:0}};
try{
 for(const width of [375,1100]){
  for(const after of ['inactive','fails']){
   const {page,errors}=await open(width);ask(page);
   // Status answers are queued: each call takes the next one; a held answer waits until released.
   const queue=[];let calls=0;
   await page.route('**/api/plugins/naice-shot/status**',async r=>{calls++;const next=queue.shift()??{sub:OPUS};if(next.hold)await next.hold;
    if(next.fail)return r.fulfill({status:502,json:{error:'NAI 계정 확인 실패 (연결하지 못했어요). 생성 요청은 보내지 않았어요.',code:'nai-account'}});
    return r.fulfill({json:{keyConfigured:true,version:'0.1.17',features:[...features,'account-shape'],minClient:'0.1.44',subscription:next.sub}});});
   let refuse=null;await page.route('**/api/plugins/naice-shot/generate',r=>refuse?r.fulfill({status:refuse.status,json:refuse.json}):r.fallback());
   const verdict=()=>page.locator('#ncs-verdict').innerText(),note=page.locator('#ncs-consent-note');
   await page.locator('#ncs-allow-anlas').uncheck();await page.locator('#ncs-gen-box > summary').click();await page.locator('[data-gen="model"]').selectOption('nai-diffusion-4-5-full');
   await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(()=>/무료 조건/.test(document.querySelector('#ncs-verdict').textContent));
   // UI-068-01: ↻ starts a check that is slow; meanwhile the server refuses the generation.
   let release;const held={sub:OPUS,hold:new Promise(r=>release=r)};queue.push(held,after==='inactive'?{sub:{...OPUS,active:false}}:{fail:true});
   const before=calls;await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(n=>true,before);
   await page.waitForTimeout(100);assert.equal(calls,before+1,'the slow check is under way');
   refuse={status:428,json:{error:'구독이 활성 상태가 아니라 무료 생성 대상이 아니에요. Anlas 사용 허용이 꺼져 있어서 보내지 않았어요.',code:'anlas-consent'}};
   await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>/허용이 꺼져 있어서 보내지 않았어요/.test(document.querySelector('#ncs-notice').textContent));
   const wanted=after==='inactive'?/구독 비활성/:/계정 확인 실패/;
   await page.waitForFunction(re=>new RegExp(re).test(document.querySelector('#ncs-verdict').textContent),wanted.source);
   assert.ok(calls>=before+2,'a new check started after the refusal');assert.equal(await note.isVisible(),true);
   release();await page.waitForTimeout(400);
   assert.match(await verdict(),wanted,`${after}: the old answer arriving late does not bring "free" back`);assert.doesNotMatch(await verdict(),/무료 조건/);
   assert.equal(await note.isVisible(),true,'the refusal note stays');
   // A check started after the refusal that succeeds does decide again.
   queue.push({sub:OPUS});await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(()=>/무료 조건/.test(document.querySelector('#ncs-verdict').textContent));
   assert.equal(await note.isHidden(),true,'a fresh successful check clears the note');
   // UI-068-02 (UI side): an account-check timeout just before sending drops the verdict and says nothing was sent.
   refuse={status:504,json:{error:'NAI 계정 확인 시간이 초과됐어요. 생성 요청은 보내지 않았어요.',code:'nai-account'}};queue.push({fail:true});
   await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>/생성 요청은 보내지 않았어요/.test(document.querySelector('#ncs-notice').textContent));
   await page.waitForFunction(()=>/계정 확인 실패/.test(document.querySelector('#ncs-verdict').textContent));
   assert.doesNotMatch(await page.locator('#ncs-notice').innerText(),/실제 생성·차감/);assert.equal(await note.isVisible(),true);
   assert.deepEqual(errors,[]);await page.close();
  }
 }
 console.log('PASS: a slow check started before a server refusal cannot restore "free" or clear the note (new check inactive or failing), a later fresh check decides; an account-check timeout drops the verdict and says nothing was sent (375/1100)');
}finally{await browser.close();server.close();}
