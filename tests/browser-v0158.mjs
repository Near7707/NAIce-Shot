// v0.1.58 bug fixes: UI-057-01/02 (profile form merge, look undo), UI-056-01/02 (request outfits), UI-054-02/04 (프리샷
// identity, stale text), the empty 프리샷 wardrobe hint, the PNG guide one sentence per line and the full-width PC layout.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
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
async function open(width,{cardName}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
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
const freeRun=async(page,text,x)=>{await page.evaluate(x=>{mock.extraction=x;},x);await page.locator('#ncs-free-text').fill(text);await page.locator('[data-action="extract"]').click();await idle(page);};
const freeOne=c=>({characters:[{subject:'boy',appearance:'',outfit:'',expression:'smile',action:'reading',position:'auto',...c}],location:'library',lighting:'lamp light',camera:'wide shot',interaction:''});
try{
 for(const width of [375,1100]){const tag=`${width}px`;
  {// UI-057-01: a stale profile form keeps what the card's [프로필 업데이트] saved meanwhile.
   const {page,errors}=await open(width);
   await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile="leo"]').click();
   // Saved elsewhere meanwhile (0.1.59 has one editor; another tab or a wardrobe save can still change the profile).
   await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles[0].appearance='brown hair, green eyes, freckles';});
   await page.locator('#ncs-profile-positive').fill('round glasses, scarf');await page.locator('#ncs-profile-submit').click();
   const p=await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo'));
   assert.equal(p.appearance,'brown hair, green eyes, freckles',`${tag}: the change made meanwhile is kept`);assert.equal(p.positive,'round glasses, scarf',`${tag}: the form's own edit is saved`);
   assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'brown hair, green eyes, freckles','the form shows the merged profile');
   // PNG guide: split into lines (0.1.60 made it three).
   await page.locator('[data-tab="history"]').click();
   const lines=await page.locator('.ncs-png-info p').allInnerTexts();assert.equal(lines.length,3,'0.1.60: three lines (see browser-v0160)');
   // PC (가): the page uses the whole panel width, button groups as wide as the fields.
   if(width>=1000){await page.locator('[data-tab="settings"]').click();const sec=await page.locator('[data-page="settings"]').boundingBox();assert.ok(sec.width>700,`${tag}: no 640px column (${sec.width})`);
    const field=await page.locator('#ncs-common-preset-name').boundingBox(),acts=await page.locator('.ncs-preset-savebox .ncs-actions').boundingBox();assert.ok(Math.abs((field.x+field.width)-(acts.x+acts.width))<=2,`${tag}: field and buttons end together`);}
   assert.deepEqual(errors,[]);await page.close();
  }
 }
 {// UI-056-01/02: a natural "blue hair tied back" is not clothing; the request person is found by alias; no wrong lock note.
  const {page,errors}=await open(375);
  await page.evaluate(()=>{mock.chatMetadata.naice_shot={outfits:{leo:{value:'navy coat',locked:true}}};});
  const once=page.locator('[data-character="leo"] [data-field="manualOutfit"]');
  await run(page,'파란 머리 묶기',one(leo({id:'wrong-id',name:'레오',outfitMode:'replace',outfit:'blue hair tied back'}),{requestApplied:['파란 머리'],requestOutfits:[{id:'wrong-id',name:'레오',outfit:'blue hair tied back'}]}));
  assert.doesNotMatch(await once.inputValue(),/blue hair/,'only looks: nothing taken as clothing');
  assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value))),/blue hair/,'the raw phrase does not come back');
  await run(page,'빨간 코트',one(leo({id:'wrong-id',name:'레오',outfitMode:'replace',outfit:'red coat with blue hair tied back'}),{requestApplied:['빨간 코트'],requestOutfits:[{id:'wrong-id',name:'레오',outfit:'red coat with blue hair tied back'}]}));
  assert.equal(await once.inputValue(),'red coat','matched by alias, look piece dropped');
  assert.doesNotMatch(await page.locator('#ncs-warnings').innerText(),/잠긴 복장을 입혀요/,'the request outfit is drawn, so no lock note');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-054-02/04 and the empty wardrobe hint in 프리샷.
  const {page,errors}=await open(375);await freeOn(page);
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.push({id:'mira',name:'Mira',aliases:[],subject:'girl',appearance:'',defaultOutfit:'',positive:'',negative:'',cardKey:''});});
  await freeRun(page,'도서관의 레오',freeOne({id:'mira',name:'레오',appearance:'pink hair'}));
  assert.equal(await page.locator('[data-character="mira"]').count(),0,'a wrong roster id is not trusted');
  assert.equal(await page.locator('[data-character="leo"]').count(),1,'the name wins over a wrong id');assert.equal(await page.locator('[data-temp="name"]').count(),0);
  assert.match(await page.locator('#ncs-notice').innerText(),/이름에 맞는 프로필로 바로잡았어요/);
  assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value))),/pink hair/,'a profile keeps its fixed look');
  assert.match(await page.locator('[data-character="leo"] .ncs-wardrobe-empty').innerText(),/옷장이 비어 있어요\. 챗샷에서 \[옷장에 저장\]하면 프리샷에서도 꺼내 입을 수 있어요\./);
  // Two profiles answer to the same name: a temporary person that keeps its look.
  await page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;s.profiles.push({id:'leo2',name:'Leo B',aliases:['Robin'],subject:'boy',appearance:'',defaultOutfit:'',positive:'',negative:'',cardKey:''});s.profiles[0].aliases=['레오','Robin'];});
  // 0.1.60 (UI-059-05): Leo's card is already in this work, so that card decides; with no such card see browser-v0160.
  await freeRun(page,'Robin',freeOne({id:'',name:'Robin',appearance:'short black hair'}));
  assert.equal(await page.locator('[data-character="leo"] [data-field="included"]').isChecked(),true);assert.equal(await page.locator('[data-character="leo2"]').count(),0);
  await page.locator('[data-remove="leo"]').click();
  await freeRun(page,'Robin',freeOne({id:'',name:'Robin',appearance:'short black hair'}));
  assert.match(await page.locator('#ncs-notice').innerText(),/여러 개라 임시 인물로 넣었어요/);
  assert.equal(await page.locator('[data-temp="appearance"]').last().inputValue(),'short black hair');
  // The situation text changed while extracting: the old result is not applied.
  await page.evaluate(x=>{mock.extraction=x;let done;mock.extractionDeferred=new Promise(r=>done=r);mock.finishExtraction=()=>{mock.extractionDeferred=null;done(JSON.stringify(x));};},freeOne({id:'leo',name:'Leo',action:'swimming'}));
  await page.locator('#ncs-free-text').fill('수영장의 레오');await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-progress').hidden);
  await page.locator('#ncs-free-text').fill('바다의 레오');await page.evaluate(()=>mock.finishExtraction());await idle(page);
  assert.match(await page.locator('#ncs-notice').innerText(),/상황 글이 바뀌어서 결과를 적용하지 않았어요/);
  assert.doesNotMatch(await page.locator('#ncs-final').inputValue(),/swimming/);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: stale profile form keeps a change saved meanwhile, look words dropped from request outfits (natural phrases) with alias matching, 프리샷 identity check and stale-text guard, empty wardrobe hint, PNG guide one sentence per line, full-width PC layout');
}finally{await browser.close();server.close();}
