// v0.1.59 프리샷 people rework: 📌 고정, text-decided cards with a question before deleting, [↶ 추출 취소], automatic vs
// chosen clothes, one profile editor (card [프로필 편집]), [↓ 생성] and the message button opening 챗샷.
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
async function open(width,{cardName,extra}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
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
 {// 📌 고정, deletion with a question, cancel changes nothing, [↶ 추출 취소]
  const {page,errors}=await open(375);const st=ask(page);await freeOn(page);
  await freeRun(page,'레오가 다리 위에 서 있다',freeX([{id:'leo',name:'Leo'}]));
  assert.deepEqual(await cardIds(page),['leo']);
  await addTemp(page,'Kai');const kai=await page.locator('.ncs-temp').last().getAttribute('data-character');
  await page.locator(`[data-pin="${kai}"]`).click();assert.equal(await page.locator(`[data-pin="${kai}"]`).innerText(),'📌 고정됨');
  await addTemp(page,'Robin');const robin=await page.locator('.ncs-temp').last().getAttribute('data-character');
  await page.locator(`[data-character="${robin}"] [data-temp="appearance"]`).fill('short grey hair');
  // Cancel: no request, nothing changes.
  const calls=await page.evaluate(()=>mock.extractCalls);st.answer=false;
  await freeRun(page,'레오가 웃는다',freeX([{id:'leo',name:'Leo',expression:'laughing'}]));
  assert.match(st.asked.at(-1),/지워져요: Robin \(고정 안 함\)[\s\S]*체크만 풀려요: Kai \(📌 고정\)/);
  assert.equal(await page.evaluate(()=>mock.extractCalls),calls,'취소: no request sent');assert.equal((await cardIds(page)).length,3);assert.equal(await ticked(page,kai),true);
  // Confirm: Robin goes, Kai stays unticked.
  st.answer=true;await freeRun(page,'레오가 웃는다',freeX([{id:'leo',name:'Leo',expression:'laughing'}]));
  assert.deepEqual(await cardIds(page),['leo',kai]);assert.equal(await ticked(page,kai),false);
  assert.match(await page.locator('#ncs-notice').innerText(),/글에 없는 카드를 지웠어요: Robin[\s\S]*📌 고정 카드는 남기고 체크를 풀었어요: Kai/);
  const undo=page.locator('.ncs-extract-undo');assert.equal(await undo.innerText(),'↶ 추출 취소');
  await undo.click();assert.equal((await cardIds(page)).length,3,'undo brings Robin back');assert.equal(await ticked(page,kai),true);
  assert.equal(await page.locator(`[data-character="${robin}"] [data-temp="appearance"]`).inputValue(),'short grey hair');
  // A failed extraction keeps the work and the undo of the last successful one.
  st.answer=true;await freeRun(page,'레오가 웃는다',freeX([{id:'leo',name:'Leo'}]));assert.equal(await undo.isVisible(),true);
  await page.evaluate(()=>{mock.extraction='not json';});await page.locator('[data-action="extract"]').click();await idle(page);
  assert.equal(await undo.isVisible(),true,'a failed extraction keeps the undo');assert.deepEqual(await cardIds(page),['leo',kai]);
  // Kai named again → ticked again; pinned temp keeps its look.
  await page.locator(`[data-character="${kai}"] [data-temp="appearance"]`).fill('blue hair');
  await freeRun(page,'레오와 Kai',freeX([{id:'leo',name:'Leo'},{name:'Kai',subject:'girl',appearance:'pink hair'}]));
  assert.equal(await ticked(page,kai),true);assert.equal(await page.locator(`[data-character="${kai}"] [data-temp="appearance"]`).inputValue(),'blue hair');
  // Named but not visible: kept, unticked (the AI decides who is visible).
  st.asked.length=0;await freeRun(page,'레오는 없고 Kai만 있다',freeX([{name:'Kai',subject:'girl'}]));
  assert.equal(st.asked.length,0,'nothing lost: no question');assert.equal(await ticked(page,'leo'),false);assert.deepEqual(await cardIds(page),['leo',kai]);
  assert.match(await page.locator('#ncs-notice').innerText(),/보이지 않아 체크를 풀었어요: Leo/);
  assert.doesNotMatch(await page.evaluate(()=>mock.lastExtract.prompt??JSON.stringify(mock.lastExtract)),/SELECTED/);
  assert.deepEqual(errors,[]);await page.close();
 }
 {// Clothes: AI clothes are automatic, the user's choice wins (empty too); 기본 복장 입기 vs 자동으로 되돌리기.
  const {page,errors}=await open(375);ask(page);await freeOn(page);const once=page.locator('[data-character="leo"] [data-field="manualOutfit"]');
  await freeRun(page,'우비 입은 레오',freeX([{id:'leo',name:'Leo',outfit:'raincoat'}]));assert.equal(await once.inputValue(),'raincoat');
  await once.fill('pajamas');await freeRun(page,'레오',freeX([{id:'leo',name:'Leo'}]));assert.equal(await once.inputValue(),'pajamas','typed clothes stay');
  await page.locator('[data-reset-outfit="leo"]').click();assert.equal(await once.inputValue(),'navy coat, white shirt, jeans','자동: no AI clothes → default');
  await freeRun(page,'우비 입은 레오',freeX([{id:'leo',name:'Leo',outfit:'raincoat'}]));await once.fill('pajamas');
  await page.locator('[data-reset-outfit="leo"]').click();assert.equal(await once.inputValue(),'raincoat','자동으로 되돌리기 → the AI clothes');
  await page.locator('[data-default-outfit="leo"]').click();assert.equal(await once.inputValue(),'navy coat, white shirt, jeans','기본 복장 입기 → the default');
  await freeRun(page,'우비 입은 레오',freeX([{id:'leo',name:'Leo',outfit:'raincoat'}]));assert.equal(await once.inputValue(),'navy coat, white shirt, jeans','기본 복장 입기 is a choice');
  await page.locator('[data-empty-outfit="leo"]').click();await freeRun(page,'우비 입은 레오',freeX([{id:'leo',name:'Leo',outfit:'raincoat'}]));
  assert.equal(await once.inputValue(),'','비우기 stays empty');assert.equal(await page.locator('[data-character="leo"] [data-lock]').count(),0,'no 프리샷 lock');
  assert.deepEqual(errors,[]);await page.close();
 }
 for(const width of [375,1100]){const tag=`${width}px`;
  {// One profile editor: [프로필 편집] on the card, unsaved typing is protected; message button opens 챗샷; [↓ 생성].
   const {page,errors}=await open(width,{extra:true});const st=ask(page);
   const card=page.locator('[data-character="leo"]');await card.locator('.ncs-fixed-look summary').click();
   assert.equal(await card.locator('[data-look-field]').count(),3,'0.1.70: the look is editable on the card');assert.match(await card.locator('[data-look-field="appearance"]').inputValue(),/brown hair, green eyes/);
   await card.locator('[data-edit-profile="leo"]').click();
   const slot=page.locator('#ncs-scene-profile-slot');assert.equal(await slot.isVisible(),true);assert.equal(await slot.locator('.ncs-quick-head strong').innerText(),'프로필 편집');
   assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'brown hair, green eyes');assert.equal(await page.locator('#ncs-profile-submit').innerText(),'프로필 저장');
   await page.locator('#ncs-profile-appearance').fill('brown hair, green eyes, freckles');
   st.answer=false;await page.locator('#ncs-profile-submit').click();assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo').appearance),'brown hair, green eyes','취소: nothing saved');
   assert.match(st.asked.at(-1),/모든 채팅에서 함께 쓰여서/);
   // Opening another profile asks before dropping the typing.
   await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile="mira"]').click();
   assert.match(st.asked.at(-1),/작성 중인 프로필 내용이 아직 저장되지 않았어요/);assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'brown hair, green eyes, freckles','kept');
   await page.locator('[data-tab="scene"]').click();await card.locator('.ncs-fixed-look').evaluate(d=>d.open=true);await card.locator('[data-edit-profile="leo"]').click();
   assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'brown hair, green eyes, freckles','the same profile keeps its typing');
   st.answer=true;await page.locator('#ncs-profile-submit').click();await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='leo').appearance.endsWith('freckles'));
   assert.equal(await slot.isVisible(),false,'the editor goes back to the profile tab');assert.match(await card.locator('[data-look-field="appearance"]').inputValue(),/freckles/);
   // [↓ 생성]
   const jump=page.locator('#ncs-jump-generate');await page.locator('.ncs-content').evaluate(e=>e.scrollTop=0);await page.waitForTimeout(150);
   if(width<1000){assert.equal(await jump.isVisible(),true,`${tag}: shown while the generate area is out of sight`);
    await jump.click();await page.waitForFunction(()=>{const r=document.querySelector('#ncs-generate-section').getBoundingClientRect(),c=document.querySelector('#naice-shot-dialog .ncs-content').getBoundingClientRect();return r.top<c.bottom&&r.bottom>c.top;});
    await page.waitForTimeout(400);assert.equal(await jump.isVisible(),false,`${tag}: hidden once there`);assert.equal(await page.locator('[data-action="generate"]').isVisible(),true);}
   // Message button from 프리샷 opens 챗샷 with that message.
   await freeOn(page);await page.locator('[data-tab="settings"]').click();await page.evaluate(()=>{const d=document.getElementById('ncs-chat-image-more');if(d)d.open=true;});await page.locator('#ncs-message-button').check();
   await page.locator('[data-action="close"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-mes-draw').click();
   await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true'&&document.querySelector('#ncs-target').value==='1');
   assert.equal(await page.locator('[data-page="scene"]').isVisible(),true);
   assert.deepEqual(errors,[]);await page.close();
  }
 }
 console.log('PASS: 프리샷 📌 고정 and deletion with a question (cancel sends nothing), [↶ 추출 취소], failed extraction keeps work and undo, ticks follow each extraction, pinned look kept, automatic vs chosen clothes (기본 복장 입기 / 자동으로 되돌리기 / 비우기), no 프리샷 lock, one profile editor with unsaved typing protected, [↓ 생성], message button opens 챗샷');
}finally{await browser.close();server.close();}
