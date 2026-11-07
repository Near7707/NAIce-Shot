// v0.1.61: rest of UI-059-03 (cards already pinned by 0.1.59) and UI-060-01 (cancelled [직접 만들기]).
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
try{
 {// UI-059-03 (rest): a card saved by 0.1.59 with only the pin keeps its old clothes.
  const old={id:'a1d00000-0000-4000-8000-000000000002',created:new Date().toISOString(),chatKey:JSON.stringify({free:true}),image:'/user/images/naice-shot/a1d00000-0000-4000-8000-000000000002.png',seed:1,
   assembled:{base:'night',negative:'',characters:[]},options:{model:'nai-diffusion-4-5-full',width:832,height:1216,steps:23,scale:5,seed:1,sampler:'k_euler_ancestral'},
   snapshot:{freeText:'Kai at the bar',scene:{characters:[{id:'tmp-old',temp:true,pinned:true,name:'Kai',subject:'girl',appearance:'pink hair',outfit:'old coat',included:true,expression:'',action:'',position:'auto'}],location:'bar',lighting:'',camera:'',interaction:''}}};
  const {page,errors}=await open(375,{seed:[old]});ask(page);await freeOn(page);
  await page.locator('[data-tab="history"]').click();await pick(page,'[data-history-free]');
  await freeRun(page,'Kai가 웃는다',freeX([{name:'Kai',subject:'girl',outfit:''}]));
  assert.equal(await page.locator('[data-character="tmp-old"] [data-temp="outfit"]').inputValue(),'old coat','already pinned old card keeps its clothes');
  // Clothes the AI fills in are automatic: they go when the next text has none.
  await addTemp(page,'Sam');await freeRun(page,'Kai와 Sam',freeX([{name:'Kai',subject:'girl'},{name:'Sam',subject:'boy',outfit:'apron'}]));
  const sam=page.locator('.ncs-temp').filter({has:page.locator('[data-temp="name"][value="Sam"]')}).locator('[data-temp="outfit"]');
  assert.equal(await sam.inputValue(),'apron');await freeRun(page,'Kai와 Sam',freeX([{name:'Kai',subject:'girl'},{name:'Sam',subject:'boy',outfit:''}]));assert.equal(await sam.inputValue(),'');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-060-01: cancelling [직접 만들기] for a left-out person plans no card link for the profile being edited.
  const {page,errors}=await open(375,{cardName:'Kai'});const st=ask(page);
  await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile="leo"]').click();await page.locator('#ncs-profile-positive').fill('round glasses, scarf');
  await page.locator('[data-tab="scene"]').click();
  const direct=page.locator('[data-missing-do="direct"]').first();
  assert.ok(await direct.count()>0,'the fixture has a left-out person');
  st.answer=false;await direct.click();await page.waitForTimeout(200);assert.match(st.asked.at(-1),/작성 중인 프로필 내용/);
  const before=await page.evaluate(()=>JSON.stringify(mock.chatMetadata.naice_shot?.bindings??null));
  await page.locator('[data-tab="profiles"]').click();await page.locator('#ncs-profile-submit').click();
  const leo=await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo'));
  assert.equal(leo.positive,'round glasses, scarf');assert.equal(leo.cardKey,'','no card linked');
  assert.equal(await page.evaluate(()=>JSON.stringify(mock.chatMetadata.naice_shot?.bindings??null)),before,'no chat link');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: a card saved by 0.1.59 with only the pin keeps its old clothes, AI clothes are automatic, cancelled [직접 만들기] plans no link');
}finally{await browser.close();server.close();}
