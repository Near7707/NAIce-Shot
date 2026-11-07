// v0.1.60: fixes from GPT's review of 0.1.59 (UI-059-01…05) and the shorter PNG guide.
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
 {// UI-059-01: cancelling the switch from [프로필로 저장] leaves the profile being edited untouched.
  const {page,errors}=await open(375);const st=ask(page);
  await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile="leo"]').click();await page.locator('#ncs-profile-appearance').fill('brown hair, green eyes, scar');
  await page.locator('[data-tab="scene"]').click();await freeOn(page);await addTemp(page,'Kai');await page.locator('.ncs-temp [data-temp="appearance"]').last().fill('pink hair');
  st.answer=false;await page.locator('[data-temp-save]').last().click();await page.waitForTimeout(200);
  assert.match(st.asked.at(-1),/작성 중인 프로필 내용이 아직 저장되지 않았어요/);
  assert.equal(await page.locator('#ncs-profile-id').inputValue(),'leo');assert.equal(await page.locator('#ncs-profile-name').inputValue(),'Leo','not filled with Kai');
  assert.equal(await page.locator('#ncs-profile-appearance').inputValue(),'brown hair, green eyes, scar');
  // UI-059-02: a description not turned into tags yet is protected too.
  await page.locator('[data-tab="profiles"]').click();await page.locator('[data-action="new-profile"]').first().click().catch(()=>{});
  st.answer=true;await page.evaluate(()=>{document.querySelector('[data-profile-mode="describe"]').click();});
  await page.locator('[data-profile="leo"]').click(); // reopen Leo (clean); 0.1.78: it opens on 직접 입력, so choose 설명으로 만들기 again
  await page.evaluate(()=>{document.querySelector('[data-profile-mode="describe"]').click();});
  await page.locator('#ncs-profile-appearance').fill('brown hair, green eyes');await page.locator('#ncs-profile-describe').fill('갈색 머리에 키 큰 남자');
  await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles.push({id:'mira',name:'Mira',aliases:[],subject:'girl',appearance:'',defaultOutfit:'',positive:'',negative:'',cardKey:''});});
  await page.locator('[data-tab="scene"]').click();await page.locator('[data-tab="profiles"]').click();
  const n=st.asked.length;st.answer=false;await page.locator('[data-profile="leo"]').click(); // same profile: kept without asking
  assert.equal(st.asked.length,n);assert.equal(await page.locator('#ncs-profile-describe').inputValue(),'갈색 머리에 키 큰 남자');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-059-03: an old temporary person's clothes (from history) are kept as chosen; UI-059-05: a shared alias stays a temporary person.
  const old={id:'0ld00000-0000-4000-8000-000000000001'.replace('0ld','a1d'),created:new Date().toISOString(),chatKey:JSON.stringify({free:true}),image:'/user/images/naice-shot/a1d00000-0000-4000-8000-000000000001.png',seed:1,assembled:{base:'night',negative:'',characters:[]},options:{model:'nai-diffusion-4-5-full',width:832,height:1216,steps:23,scale:5,seed:1,sampler:'k_euler_ancestral'},
   snapshot:{freeText:'Kai at the bar',scene:{characters:[{id:'tmp-old',temp:true,name:'Kai',subject:'girl',appearance:'pink hair',outfit:'apron',included:true,expression:'',action:'',position:'auto'}],location:'bar',lighting:'',camera:'',interaction:''}}};
  const {page,errors}=await open(375,{seed:[old]});ask(page);await freeOn(page);
  await page.locator('[data-tab="history"]').click();await page.locator('#ncs-history-scope').selectOption('free').catch(()=>{});await pick(page,'[data-history-free]');
  assert.equal(await page.locator('[data-pin="tmp-old"]').innerText(),'📌 고정됨','old card pinned');
  await freeRun(page,'Kai가 웃는다',freeX([{name:'Kai',subject:'girl',outfit:''}]));
  assert.equal(await page.locator('[data-character="tmp-old"] [data-temp="outfit"]').inputValue(),'apron','old clothes stay');
  await page.evaluate(()=>{const s=mock.extensionSettings.naice_shot;s.profiles[0].aliases=['레오','Robin'];s.profiles.push({id:'mira',name:'Mira',aliases:['Robin'],subject:'girl',appearance:'',defaultOutfit:'',positive:'',negative:'',cardKey:''});});
  await freeRun(page,'Kai와 Robin',freeX([{name:'Kai',subject:'girl'},{id:'mira',name:'Robin',subject:'girl',appearance:'short black hair'}]));
  assert.equal(await page.locator('[data-character="mira"]').count(),0,'the AI id is not proof');assert.match(await page.locator('#ncs-notice').innerText(),/여러 개라 임시 인물로 넣었어요: Robin/);
  assert.equal(await page.locator('.ncs-temp [data-temp="appearance"]').last().inputValue(),'short black hair');
  // PNG guide: three lines, the last one stands out.
  const lines=await page.locator('.ncs-png-info p').allInnerTexts();assert.equal(lines.length,3);assert.equal(lines[2],'공유하기 전에 다시 한번 확인하세요.');
  assert.match(lines[0],/메타데이터\(EXIF 포함\)를 모두 지운 사본이에요\. 투명한 부분은 불투명하게 바뀌어요\./);assert.doesNotMatch(lines.join(' '),/이름·글자|이력은 그대로/);
  const [c1,c2]=await page.locator('.ncs-png-info p').evaluateAll(els=>[getComputedStyle(els[0]).color,getComputedStyle(els[2]).color]);assert.notEqual(c1,c2,'the check line has its own colour');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-059-04: a temporary person's chosen empty outfit stays chosen after [프로필로 저장].
  const {page,errors}=await open(375);ask(page);await freeOn(page);await addTemp(page,'Kai');
  const t=page.locator('.ncs-temp [data-temp="outfit"]').last();await t.fill('x');await t.fill('');
  await page.locator('[data-temp-save]').last().click();await page.locator('#ncs-profile-submit').click();
  await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.some(p=>p.name==='Kai'));
  const id=await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Kai').id);
  await freeRun(page,'Kai',freeX([{id,name:'Kai',outfit:'apron'}]));
  assert.equal(await page.locator(`[data-character="${id}"] [data-field="manualOutfit"]`).inputValue(),'','still drawn without clothes');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: cancelled switch leaves the edited profile alone, unsaved description protected, old temporary clothes kept as chosen, shared alias → temporary person despite the AI id, empty chosen outfit survives 프로필로 저장, PNG guide in three lines with the check line highlighted');
}finally{await browser.close();server.close();}
