// v0.1.63: GPT's 0.1.62 review (notices) and the viewer/chat-picture polish.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {pick} from './menu-helper.mjs';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/naice-shot/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep))throw Error();
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const features=['paged-history','delete','private-records','all-history','history-kinds','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes'];
async function open(width,{cardName,extra,seed,clock}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());if(seed)items.push(...seed);if(clock)await page.clock.install();
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
 return {page,errors};
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
try{
 {// UI-062-01/02/03: a warning to act on stays; notices wait while something runs; each notice folds on its own timer.
  const {page,errors}=await open(375,{clock:true});ask(page);
  const text=JSON.stringify(two),cut=text.slice(0,text.indexOf('일어나는 순간')+30);
  await reply(page,cut);await page.locator('[data-action="extract"]').click();await idle(page);
  assert.match(await page.locator('#ncs-notice').innerText(),/응답이 불완전해요/);
  await page.clock.fastForward(30000);assert.equal(await shown(page),true,'the incomplete-reply warning stays');
  await reply(page,JSON.stringify({...two,moments:[two.moments[0]],defaultIndex:0}));
  await page.locator('[data-action="extract"]').click();await idle(page);assert.doesNotMatch(await page.locator('#ncs-notice').innerText(),/불완전/);
  await page.clock.fastForward(30000);assert.equal(await shown(page),false,'a plain success folds');
  // A settings notice, then an extraction on the drawing tab that fails.
  await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-message-button').check();assert.equal(await shown(page),true,'settings notice');
  await page.locator('[data-tab="scene"]').click();
  await page.evaluate(()=>{let done,n=0;mock.generateRaw=async function(){this.extractCalls=(this.extractCalls??0)+1;if(n++===0)return await new Promise(r=>done=r);return 'not json';};mock.finishExtraction=()=>done('not json');});
  await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-progress').hidden);
  await page.locator('[data-tab="settings"]').click();assert.equal(await shown(page),false,'nothing but the progress box while working');
  await page.locator('[data-tab="scene"]').click();await page.evaluate(()=>mock.finishExtraction());
  await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden);
  assert.equal(await shown(page),true,'the error shows once the work ends');
  await page.clock.fastForward(30000);await page.locator('[data-tab="settings"]').click();assert.equal(await shown(page),false,"another tab's error does not keep this notice open");
  assert.deepEqual(errors,[]);await page.close();
 }
 {// Viewer: date only, 메시지로 가기 beside 프롬프트 보기, readable notes, no flash; chat pictures: no ⋯, [삭제], date and seed.
  const {page,errors}=await open(375);ask(page);
  for(let i=0;i<2;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  await page.locator('#ncs-result [data-image-target]').selectOption('1');await page.locator('[data-action="attach"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').waitFor();
  assert.equal(await page.locator('#chat .ncs-inline-more').count(),0,'no ⋯ over the picture');
  const entry=await page.evaluate(()=>mock.chat[1].extra.naice_shot_images[0]);assert.ok(entry.created&&Number.isInteger(entry.seed),'date and seed stored with the attachment');
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=2);
  await page.locator('[data-view-history]').first().click();await page.waitForFunction(()=>document.getElementById('ncs-viewer').dataset.loaded);
  const meta=page.locator('#ncs-viewer .ncsv-meta');assert.doesNotMatch(await meta.textContent(),/×/,'no size');assert.match(await meta.textContent(),/\d{4}\. \d+\. \d+\./);
  assert.equal(await page.locator('#ncs-viewer [data-v="more"]').isVisible(),true,'0.1.70: 메시지로 가기 lives in ⋯');
  const small=await page.locator('.ncsv-save-menu small').first().evaluate(e=>getComputedStyle(e).color);assert.match(small,/rgba?\((2[0-5]\d|1[89]\d), /,`readable note colour (${small})`);
  await page.locator('[data-v="next"]').click();
  const seen=await page.evaluate(()=>new Promise(res=>{const img=document.querySelector('#ncs-viewer .ncsv-stage img');const vals=[];const t=setInterval(()=>{vals.push([img.style.visibility,img.style.transform]);if(vals.length>40){clearInterval(t);res(vals);}},10);}));
  assert.ok(seen.every(([v,t])=>v==='hidden'||t),'never an unfitted picture on screen');
  await page.locator('[data-v="close"]').click();await page.locator('[data-action="close"]').click();
  // An attachment from before 0.1.63 (no date or seed): looked up from history.
  await page.evaluate(()=>{const e=mock.chat[1].extra.naice_shot_images[0];delete e.created;delete e.seed;});
  await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').click();await page.locator('#ncs-viewer[open]').waitFor();
  await page.waitForFunction(()=>/\d{4}\./.test(document.querySelector('#ncs-viewer .ncsv-meta').textContent));
  await page.waitForFunction(()=>!document.querySelector('#ncs-viewer [data-v="seed"]').hidden);
  const del=page.locator('#ncs-viewer [data-v="delete"]');assert.equal(await del.isVisible(),true,'삭제 from the chat');
  const st=ask(page);await del.click();await page.waitForFunction(()=>!document.getElementById('ncs-viewer').open);
  assert.match(st.asked.at(-1),/삭제할까요[\s\S]*함께 빠져요/);assert.equal(await page.evaluate(()=>(mock.chat[1].extra?.naice_shot_images??[]).length),0,'taken out of the message');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: incomplete-reply warning stays, plain success folds, notices wait while working and fold on their own timers, viewer date only with 메시지로 가기 in the prompt row and readable menu notes, no flash when moving, chat pictures without ⋯, with date/seed (old ones looked up) and [삭제]');
}finally{await browser.close();server.close();}
