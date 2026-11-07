// v0.1.68: GPT's 0.1.67 review (old free verdict after a server refusal; state before tier; missing tier; old field list),
// the switch on every tab, the account box opening anywhere with the link under the V5 row, preset order.
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
const OPUS={tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:100,isNegative:false,timeUntilNextPercent:600},perks:{contextTokens:8192},anlas:{subscription:1000,purchased:0}};
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width);const st=ask(page);
  const acct={sub:OPUS,fail:false,shape:['tier: number','active: boolean']};
  await page.route('**/api/plugins/naice-shot/status**',r=>{const q=new URL(r.request().url()).searchParams;
   if(acct.fail)return r.fulfill({status:502,json:{error:'NAI 계정 확인 실패 (503).',code:'nai-account'}});
   return r.fulfill({json:{keyConfigured:true,version:'0.1.16',features:[...features,'account-shape'],minClient:'0.1.44',subscription:{...acct.sub,...(q.get('shape')==='1'?{shape:acct.shape}:{})}}});});
  let refuse=null;const sent=[];
  await page.route('**/api/plugins/naice-shot/generate',r=>{sent.push(1);if(refuse)return r.fulfill({status:refuse.status,json:refuse.json});return r.fallback();});
  const verdict=()=>page.locator('#ncs-verdict').innerText(),details=page.locator('#ncs-account-details'),note=page.locator('#ncs-consent-note');
  const model=async id=>{if(!await page.locator('#ncs-gen-box').evaluate(d=>d.open))await page.locator('#ncs-gen-box > summary').click();await page.locator('[data-gen="model"]').selectOption(id);};
  const recheck=async()=>{await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="refresh-anlas"]').disabled);await page.waitForTimeout(50);};
  await page.locator('#ncs-allow-anlas').uncheck();await model('nai-diffusion-4-5-full');await recheck();
  assert.equal(await verdict(),'Opus · V4.5 무료 조건에 해당해요 ✓');
  // The whole box unfolds on tap (line 1 too), not on ↻.
  await page.locator('#ncs-verdict').click();assert.equal(await details.isVisible(),true,'line 1 opens it');
  await page.locator('.ncs-account-note').click();assert.equal(await details.isVisible(),false,'a tap inside closes it');
  await recheck();assert.equal(await details.isVisible(),false,'↻ does not toggle');
  // V5: the NovelAI link sits under the V5 row at the right, and only its words are a link.
  await model('nai-diffusion-5-full');await page.locator('#ncs-verdict').click();
  const link=await page.locator('#ncs-cost-link').boundingBox(),box=await details.boundingBox(),v5row=await page.locator('#ncs-v5-row').boundingBox();
  assert.ok(link.y>=v5row.y+v5row.height-1,'under the V5 row');assert.ok(box.x+box.width-(link.x+link.width)<=8,'at the right edge');assert.ok(link.width<150,`only the words (${Math.round(link.width)}px)`);
  let popups=0;page.on('popup',()=>popups++);
  await page.mouse.click(box.x+20,link.y+link.height/2);await page.waitForTimeout(200);assert.equal(popups,0,'empty space beside the link opens nothing');
  await model('nai-diffusion-4-5-full');
  if(await details.isVisible())await page.locator('#ncs-verdict').click();
  // UI-067-01: the server refuses (account changed to inactive) → the old "free" goes, the switch note shows, the re-check decides.
  acct.sub={...OPUS,active:false};refuse={status:428,json:{error:'구독이 활성 상태가 아니라 무료 생성 대상이 아니에요. Anlas 사용 허용이 꺼져 있어서 보내지 않았어요.',code:'anlas-consent'}};
  await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>/허용이 꺼져 있어서 보내지 않았어요/.test(document.querySelector('#ncs-notice').textContent));
  await page.waitForFunction(()=>!/무료 조건/.test(document.querySelector('#ncs-verdict').textContent));
  assert.equal(await note.isVisible(),true,'the refusal note shows');await page.waitForFunction(()=>/구독 비활성/.test(document.querySelector('#ncs-verdict').textContent));
  assert.equal(await note.isVisible(),true,'still shown after the re-check (inactive is blocked)');
  // A failed account check just before sending: same, and the note stays while the re-check also fails.
  acct.sub=OPUS;await recheck();assert.equal(await verdict(),'Opus · V4.5 무료 조건에 해당해요 ✓');assert.equal(await note.isHidden(),true,'a fresh successful check clears it');
  refuse={status:502,json:{error:'NAI 계정 확인 실패 (503).',code:'nai-account'}};acct.fail=true;
  await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>/계정 확인 실패/.test(document.querySelector('#ncs-verdict').textContent));
  assert.equal(await note.isVisible(),true,'refusal note kept while the account cannot be checked');assert.doesNotMatch(await verdict(),/무료/);
  acct.fail=false;refuse=null;await recheck();assert.equal(await verdict(),'Opus · V4.5 무료 조건에 해당해요 ✓');assert.equal(await note.isHidden(),true);
  // The switch shows on every tab and leaves you where you are.
  for(const tab of ['settings','history','profiles']){await page.locator(`[data-tab="${tab}"]`).click();assert.equal(await page.locator('#ncs-mode-fields').isVisible(),true,`${tab}: switch shown`);}
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="free"]').getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('[data-tab="settings"]').getAttribute('aria-selected'),'true','stays on 설정');
  await page.locator('[data-tab="history"]').click();await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('[data-tab="history"]').getAttribute('aria-selected'),'true','stays on 이력');
  assert.equal(await page.locator('.ncs-header small').isVisible(),true,'subtitle kept');
  // UI-066-01 + help text: a failed check marks the old list and stops copying it.
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="status"]').click();await page.locator('#ncs-account-shape').waitFor();
  await page.locator('#ncs-account-shape > summary').click();
  assert.match(await page.locator('.ncs-shape-help').innerText(),/개인정보는 없나요\?[\s\S]*서버에서부터 빼고 보내요[\s\S]*이 목록은 뭔가요\?/); // 0.1.86: the privacy answer comes first
  assert.equal(await page.locator('[data-action="copy-shape"]').isDisabled(),false);
  acct.fail=true;await page.locator('[data-action="status"]').click();await page.waitForFunction(()=>/이전 조회/.test(document.querySelector('#ncs-shape-status').textContent));
  assert.equal(await page.locator('[data-action="copy-shape"]').isDisabled(),true,'old list cannot be copied as current');
  acct.fail=false;await page.locator('[data-action="status"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="copy-shape"]').disabled);
  assert.equal(await page.locator('#ncs-shape-status').innerText(),'');
  // [변경 저장] keeps the preset in its place.
  const as=page.locator('[data-action="save-preset-as"]'),over=page.locator('[data-action="save-preset"]'),name=page.locator('#ncs-common-preset-name');
  for(const n of ['Mira A','Leo B','Kai C']){await name.fill(n);await as.click();await page.waitForFunction(n=>mock.extensionSettings.naice_shot.imagePresets.some(p=>p.name===n),n);}
  const first=await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresets[0].id);
  await page.locator('#ncs-common-preset').selectOption(first);await page.waitForFunction(()=>!document.querySelector('[data-action="save-preset"]').hidden);
  await page.locator('#ncs-steps').fill('21');await page.locator('#ncs-steps').dispatchEvent('change');st.answer=true;await over.click();
  await page.waitForFunction(()=>mock.extensionSettings.naice_shot.imagePresets[0].options.steps===21);
  assert.deepEqual(await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresets.map(p=>p.name)),['Mira A','Leo B','Kai C'],'order kept');
  assert.deepEqual(await page.locator('#ncs-common-preset option').allInnerTexts().then(t=>t.slice(1)),['Mira A','Leo B','Kai C']);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: account box unfolds anywhere (not ↻), NovelAI link under the V5 row with only its words clickable; a server refusal or failed check drops the old free verdict and keeps the note until a fresh check; switch on every tab, stays in place; old field list marked and not copied after a failed check, help text; [변경 저장] keeps preset order (375/1100)');
}finally{await browser.close();server.close();}
