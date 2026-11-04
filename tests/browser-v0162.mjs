// v0.1.62 phone polish: Steps wording, [↓ 생성] landing, one banner while working, folding notices, viewer rows, detach label.
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
async function open(width,{cardName,extra,seed}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());if(seed)items.push(...seed);
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
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
try{
 for(const width of [375,1100]){// Steps wording, [↓ 생성] lands the real button at the bottom, one banner while working, success notices fold.
  const {page,errors}=await open(width);ask(page);
  await page.locator('[data-tab="settings"]').click();assert.match(await page.locator('label:has(#ncs-steps)').innerText(),/^Steps · 최대 28/);
  assert.doesNotMatch(await page.locator('#naice-shot-dialog').evaluate(d=>d.textContent),/스텝/,'no 스텝 anywhere in the panel');
  await page.locator('[data-tab="scene"]').click();assert.match(await page.locator('#ncs-gen-line').innerText(),/28 Steps/);
  const content=page.locator('#naice-shot-dialog .ncs-content');await content.evaluate(e=>e.scrollTop=0);await page.waitForTimeout(200);
  if(await page.locator('#ncs-jump-generate').isVisible()){await page.locator('#ncs-jump-generate').click();await page.waitForTimeout(900);
  const [b,c]=await page.evaluate(()=>[document.querySelector('[data-action="generate"]').getBoundingClientRect().bottom,document.querySelector('#naice-shot-dialog .ncs-content').getBoundingClientRect().bottom]);
  assert.ok(b<=c&&c-b<40,`the generate button sits at the bottom edge (${Math.round(c-b)}px above it)`);}
  // One banner while working: the progress box only.
  await page.evaluate(()=>{let done;mock.extractionDeferred=new Promise(r=>done=r);mock.finishExtraction=()=>{mock.extractionDeferred=null;done(JSON.stringify(mock.extraction));};});
  await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-progress').hidden);
  assert.equal(await page.locator('#ncs-notice').isVisible(),false,'no second banner during progress');
  await page.evaluate(()=>mock.finishExtraction());await idle(page);assert.equal(await page.locator('#ncs-notice').isVisible(),true,'the result notice shows afterwards');
  // A short success notice folds away; an error stays.
  // UI-062-05: wait for the fold instead of a fixed time.
  await freeOn(page);await page.waitForFunction(()=>document.querySelector('#ncs-notice').hidden,null,{timeout:20000});
  await page.locator('[data-action="extract"]').click();assert.match(await page.locator('#ncs-notice').innerText(),/그릴 상황을 적어/);
  await page.waitForTimeout(6600);assert.equal(await page.locator('#ncs-notice').isVisible(),true,'an error stays');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// Viewer rows and "채팅에서 이 그림 빼기".
  const {page,errors}=await open(375);ask(page);
  for(let i=0;i<2;i++){await page.locator('[data-action="generate"]').click();await idle(page);}
  await page.locator('[data-action="attach"]').click();await page.locator('[data-attach-target="1"]').click();await page.locator('[data-action="attach-confirm"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').waitFor();
  await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=2);
  const detach=page.locator('[data-history-detach]').first();assert.equal(await detach.evaluate(e=>e.textContent),'채팅에서 이 그림 빼기');
  await page.locator('[data-view-history]').first().click();await page.locator('.ncsv-stage img').waitFor();
  const v=await page.evaluate(()=>{const d=document.getElementById('ncs-viewer'),bar=d.querySelector('.ncsv-bar').getBoundingClientRect(),tools=d.querySelector('.ncsv-tools');
   return {bar:bar.height,tools:tools.getBoundingClientRect().height,save:!!tools.querySelector('[data-v="save-menu"]'),nav:!!tools.querySelector('.ncsv-navigation'),prev:d.querySelector('[data-v="previous"]').textContent,overflow:d.scrollWidth>d.clientWidth};});
  assert.ok(v.bar<62,`one top row (${v.bar}px)`);assert.ok(v.tools<62,`one tools row (${v.tools}px)`);assert.equal(v.save&&v.nav,true);assert.equal(v.prev,'‹');assert.equal(v.overflow,false);
  await page.locator('[data-v="save-menu"]').click();const menu=await page.locator('.ncsv-save-menu').boundingBox(),tg=await page.locator('[data-v="save-menu"]').boundingBox();assert.ok(menu.y+menu.height<=tg.y+1,'the save menu opens upward');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: Steps wording everywhere, [↓ 생성] lands the generate button at the bottom, one banner while working, success notices fold and errors stay, viewer in two rows with an upward save menu, "채팅에서 이 그림 빼기"');
}finally{await browser.close();server.close();}
