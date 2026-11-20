// wip-en (screen language experiment): an English-screen Chat Shot can pick a target, extract, read the cost and
// generate one picture, and the language changes nothing but words on screen.
// 1. The same AI reply in Korean and in English saves the same work and sends the same extraction prompt.
// 2. The extract/generate buttons and the progress box stay English while they are redrawn (Korean stays Korean).
// 3. Cost: the Opus V5 usage question is English; cancelling it sends no generation (Korean: the same requests).
// 4. Work saved from the Korean screen (its undo label is Korean) loads on the English screen and its undo still works.
// 5. The language switch only adds uiLanguage to the settings.
// Header copied from browser-v01101 (lines 1–91) with a `lang` option; helpers from the same file.
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
const KEY=JSON.stringify({group:null,card:'Leo.png',chat:'A'}),OTHER=JSON.stringify({group:null,card:'Leo.png',chat:'B'}),KAI=JSON.stringify({group:null,card:'Kai.png',chat:'K'}),FREE=JSON.stringify({free:true});
const uid=n=>`0000000${n}-aaaa-4bbb-8ccc-${String(n).padStart(12,'0')}`;
const pic=(n,chatKey=KEY,mins=n)=>({id:uid(n),created:new Date(Date.UTC(2026,10,5,10,mins)).toISOString(),chatKey,image:`/user/images/naice-shot/${uid(n)}.png`,seed:n,
 options:{model:'nai-diffusion-4-5-full',width:832,height:1216,steps:28,scale:5,seed:n,sampler:'k_euler_ancestral',scheduler:'karras',cfgRescale:0},
 assembled:{base:'1boy',negative:'',characters:[]},snapshot:{scene:null}});
const FEATURES=['paged-history','delete','private-records','all-history','history-kinds','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes','generation-recovery','pending-history','delete-check','history-ids','delete-cleared','usage-confirm'];
async function open(width,{version='0.1.25',seed=[],features=FEATURES,marks=null,pending=null,broken=[],draft=null,skin=null,height=900,touch=false,lang='ko'}={}){
 const page=await browser.newPage({viewport:{width,height},acceptDownloads:true,hasTouch:touch}),errors=[],asked=[];
 page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{asked.push(d.message());page.refuse?d.dismiss():d.accept();});
 const items=[...seed];page.deleteFail=[];page.deleteExtra={};page.posts=[];page.deletions=[];page.unexpectedImages=[];
 await page.route('https://example.invalid/**',r=>{page.unexpectedImages.push(r.request().url());return r.abort();});
 await page.route('**/user/images/naice-shot/**',r=>{const id=path.basename(new URL(r.request().url()).pathname,'.png');if(broken.includes(id))return r.fulfill({status:404,body:''});return r.fulfill({status:200,headers:{'Content-Type':'image/png'},body:pngOf(64,96)});});
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url()),post=r.request().method()==='POST',body=post?r.request().postDataJSON():null;
  if(u.pathname.endsWith('/history')){
   if(page.historyFail)return r.fulfill({status:503,json:{error:'mock busy'}});
   if(post&&page.holdPost){const gate=page.holdPost;page.holdPost=null;return gate.then(()=>r.fulfill({status:503,json:{error:'mock busy'}}));}
   if(post&&page.postPlan?.length){const plan=page.postPlan.shift();return plan.wait.then(()=>plan.fail?r.fulfill({status:503,json:{error:'mock busy'}}):answerHistory(r,u,post,body));}
   return answerHistory(r,u,post,body);}
  function answerHistory(r,u,post,body){
   const q=post?body:Object.fromEntries(u.searchParams);if(post)page.posts.push(body);
   const all=q.scope==='all',inScope=items.filter(x=>all?(!q.chatKey||x.chatKey===q.chatKey):x.chatKey===q.chatKey).sort((a,b)=>b.created.localeCompare(a.created));
   const saved=inScope.filter(x=>!x.orphaned),pending=post&&q.ids?[]:inScope.filter(x=>x.orphaned);
   const list=post&&q.ids?saved.filter(x=>q.ids.includes(x.id)):saved,offset=Number(q.offset??0),limit=Number(q.limit??20);
   const chats=[...new Set(items.map(x=>x.chatKey))].map(k=>({chatKey:k,count:items.filter(x=>x.chatKey===k).length,latest:''}));
   return r.fulfill({json:{items:list.slice(offset,offset+limit),total:list.length,hasMore:offset+limit<list.length,pending,pendingBytes:0,
    ...(post&&q.ids?{filtered:true,unfilteredCount:inScope.length}:{}),...(all?{scope:'all',kind:q.kind==='chat'?'chat':'all',chats,imageCount:items.length,bytes:1}:{}),...(page.historyOverride??{})}});
  }
  {
  if(u.pathname.endsWith('/delete')){page.deletions.push(body);const deleted=[],failed=[],skipped=[];
   const wanted=body.all?items.filter(x=>x.chatKey===body.chatKey).map(x=>x.id):body.ids;
   for(const id of wanted){if(page.deleteFail.includes(id)){failed.push(id);continue;}const i=items.findIndex(x=>x.id===id&&x.chatKey===body.chatKey);if(i>=0){items.splice(i,1);deleted.push(id);}else skipped.push(id);}
   if(page.loseDeleteReply)return r.abort();
   return r.fulfill({json:{deleted,skipped,workDeleted:false,...page.deleteExtra,...(failed.length?{failed}:{})}});}
  if(u.pathname.endsWith('/delete-check'))return r.fulfill({json:page.deleteCheckReply??{absent:[],remaining:true}});
  if(u.pathname.endsWith('/generation')&&u.searchParams.has('chatKey'))page.pendingChecks=(page.pendingChecks??0)+1;
  if(u.pathname.endsWith('/generation')&&u.searchParams.has('chatKey')&&page.holdPending){const g=page.holdPending;page.holdPending=null;return g.then(()=>r.fulfill({json:{pending:[]}}));}
  if(u.pathname.endsWith('/generation'))return r.fulfill({json:u.searchParams.has('chatKey')?{pending:page.pendingReply??[]}:(page.generationReply??{state:'unknown'})});
  if(u.pathname.endsWith('/draft')){
   if(post&&body.delete&&page.loseDraftDelete)return r.abort();
   if(post&&body.delete&&page.holdDraftDelete){const gate=page.holdDraftDelete;page.holdDraftDelete=null;return gate.then(()=>r.fulfill({json:{deleted:1}}));}
   if(!post&&page.draftReadFails)return r.abort();
   if(!post&&page.deletedKeys?.includes(u.searchParams.get('chatKey'))){page.draftReads=(page.draftReads??0)+1;return r.fulfill({json:{revision:'tomb',work:null,deleted:true}});}
   if(!post&&page.draftReply){page.draftReads=(page.draftReads??0)+1;const g=page.draftGates?.shift();const reply=page.draftReply;return (g??Promise.resolve()).then(()=>r.fulfill({json:reply}));}
   if(!post&&page.draftByKey){const k=u.searchParams.get('chatKey');page.draftReads=(page.draftReads??0)+1;const w=page.draftByKey[k]??null;return r.fulfill({json:{revision:w?'saved':null,work:w}});}
   if(post&&!body.delete){(page.draftPosts??=[]).push(body);page.lastDraft=body;if(page.draftConflict)return r.fulfill({status:409,json:{error:'다른 창에서 먼저 저장했어요.'}});}
   if(post&&!body.delete&&page.deletedKeys)page.deletedKeys=page.deletedKeys.filter(k=>k!==body.chatKey); // a save replaces the record
   if(post&&!body.delete&&page.holdDraftPost){const g=page.holdDraftPost;page.holdDraftPost=null;page.heldPosts=(page.heldPosts??0)+1;return g.then(()=>r.fulfill({json:{revision:'r'}}));}
   return r.fulfill({json:post?{revision:'r'}:{revision:draft?'saved':null,work:draft}});}
  }
  page.statusCalls=(page.statusCalls??0)+1;const quick=u.searchParams.get('quick')==='1';if(quick)page.quickCalls=(page.quickCalls??0)+1;
  if(quick&&page.quickFail)return r.abort();
  if(quick&&page.quickHolds?.length){const h=page.quickHolds.shift();return h.gate.then(()=>r.fulfill({json:h.json}));}
  if(page.statusFail)return r.abort();if(page.holdStatus){const g=page.holdStatus;page.holdStatus=null;return g.then(()=>r.fulfill({json:{keyConfigured:true,version:page.version??version,features:page.features??features,minClient:'0.1.90'}}));}
  return r.fulfill({json:{keyConfigured:true,version:page.version??version,features:page.features??features,minClient:'0.1.90',subscription:page.sub??{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},anlas:{subscription:1000,purchased:0}}}});
 });
 await page.addInitScript(()=>{window.__ncsExactFeatures=true;}); // this check's fake status answers are exact
 // The language is read once when the extension starts (before DOMContentLoaded), so it is set the moment the extension
 // makes its settings object (a new person's settings, as in every other check).
 await page.addInitScript(l=>{const lang=sessionStorage.getItem('test-lang')??l;let v;Object.defineProperty(window,'mock',{configurable:true,get(){return v;},set(x){v=x;const es=x.extensionSettings;let own;Object.defineProperty(es,'naice_shot',{configurable:true,enumerable:true,get(){return own;},set(y){own=y;if(y&&typeof y==='object')y.uiLanguage=lang;}});}});},lang); // the extension makes its settings itself
 if(skin)await page.addInitScript(k=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.skin=k;}),skin);
 if(marks)await page.addInitScript(m=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.imageMarks=m;}),marks);
 if(pending)await page.addInitScript(p=>sessionStorage.setItem('naice-shot-pending-generation',JSON.stringify(p)),pending);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('#naice-shot-dialog[open]').waitFor();
 return {page,errors,asked,items};
}
const gate=()=>{let open;const p=new Promise(r=>open=r);p.open=open;return p;};
const OPUS=(percent,purchasedPercent=0)=>({tier:3,active:true,isGracePeriod:false,usage:{percent,purchasedPercent,isNegative:false,timeUntilNextPercent:600},anlas:{subscription:1000,purchased:0}});
const fakeGenerate=async page=>{page.generated=[];
 await page.route('**/api/plugins/naice-shot/generate',r=>{const b=r.request().postDataJSON();page.generated.push(b);
  if(page.ask&&b.confirmUsage!==true)return r.fulfill({status:400,json:{error:page.ask,code:'usage-confirm'}});
  return r.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});});};
const idle=page=>page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&!document.querySelector('[data-action="generate"]').disabled);
const closeCompat=async page=>{const b=page.locator('[data-action="dismiss-compat"]');if(await b.isVisible())await b.click();};
const clearNotice=page=>page.evaluate(()=>{document.querySelector('#ncs-notice').textContent='';});
const notice=page=>page.locator('#ncs-notice').innerText();
const text=(page,sel)=>page.locator(sel).first().innerText();
const HANGUL=/[가-힣]/;
const noKorean=async(page,sels)=>{for(const sel of sels){const t=await text(page,sel);assert.ok(!HANGUL.test(t),`${sel} is English: ${t}`);}};
// Two moments, with request words the AI writes in Korean (the AI output language is a later step).
const TWO={moments:[{title:'앉는 순간',characters:[{id:'leo',name:'Leo',expression:'calm',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''},
 {title:'일어나는 순간',characters:[{id:'leo',name:'Leo',expression:'smile',action:'standing up',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''}],
 defaultIndex:1,requestMatched:true,requestApplied:['미소'],requestIgnored:['머리색 · 프로필 고정 외형'],requestOutfits:[],requestVisibleOnly:false};
const ASK='V5 사용량이 1% 남았어요. 이번 생성에서 Anlas가 차감될 수 있어요.';
// An extraction first, so the second one leaves an undo (an empty screen has nothing to undo).
const twice=async page=>{await extractWith(page,null);await extractWith(page,TWO,'smiling');};
// The last saved work once the save queue is quiet (no newer POST for 1.2 s).
const settledWork=async page=>{let last=-1;for(let i=0;i<40;i++){const n=(page.draftPosts??[]).length;if(n===last&&n>0)break;last=n;await page.waitForTimeout(1200);}return structuredClone(page.lastDraft.work);};
const extractWith=async(page,x,wish)=>{if(x)await page.evaluate(x=>{mock.extraction=x;},x);if(wish!==undefined)await page.locator('#ncs-moment-wish').fill(wish);
 await clearNotice(page);await page.locator('[data-action="extract"]').click();await idle(page);};
const press=async page=>{await closeCompat(page);await clearNotice(page);await page.locator('[data-action="generate"]').click();
 await page.waitForFunction(()=>{const t=document.querySelector('#ncs-notice').textContent;return t&&!/보내고 있어요|Sending the generation/.test(t);});await idle(page);return notice(page);};
const account=async(page,sub)=>{page.sub=sub;await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="refresh-anlas"]').disabled);await page.waitForTimeout(60);};
const reopen=async page=>{await page.reload();await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('#naice-shot-dialog[open]').waitFor();await page.waitForFunction(()=>!document.getElementById('ncs-work-fields').disabled);};

try{
 for(const width of [375,1100]){
  // --- 1. same reply, same saved work and prompt; the English screen reads in English
  {
   const runs={};
   for(const lang of ['ko','en']){
    const t=await open(width,{lang});const {page}=t;await fakeGenerate(page);
    await twice(page);
    runs[lang]={work:await settledWork(page),prompt:await page.evaluate(()=>mock.lastExtract.prompt),note:await notice(page),page,t};
   }
   assert.deepEqual(runs.en.work,runs.ko.work,'the same AI reply saves the same work in both languages');
   assert.equal(runs.en.prompt,runs.ko.prompt,'the extraction prompt does not depend on the screen language');
   const en=runs.en.page,ko=runs.ko.page;
   assert.match(runs.en.note,/^Found 2 scene candidates\. .*Request applied: 미소\. Not applied: 머리색 · 프로필 고정 외형\./,'English frame, the AI words as given');
   assert.match(runs.ko.note,/^장면 후보 2개를 찾았어요\./,'Korean as before');
   await noKorean(en,['.ncs-tabs','#ncs-source-title','[data-action="extract"]','[data-action="generate"]','#ncs-target-label','.ncs-moments-title','.ncs-clear-slot .ncs-action-slot']);
   assert.equal((await text(en,'#ncs-request-applied')).startsWith('Request applied: 미소 / Not applied:'),true);
   assert.deepEqual(await en.locator('.ncs-moment-name').allInnerTexts(),['앉는 순간','일어나는 순간'],'candidate titles are the AI words (Korean is fine for now)');
   assert.equal(await text(ko,'[data-action="extract"]'),'장면 추출');
   for(const r of Object.values(runs)){assert.deepEqual(r.t.errors,[]);await r.page.close();}
  }
  // --- 2. buttons and progress stay in their language while redrawn
  for(const lang of ['ko','en']){
   const L=lang==='en'?{extract:'Extract scene',busy:'Extract scene…',title:/^Extracting scene/,stop:'Stop extraction',gen:'Generate image',done:/^Generated · tap the picture/}
    :{extract:'장면 추출',busy:'장면 추출 중…',title:/^장면 추출 중/,stop:'추출 중단',gen:'이미지 생성',done:/^생성했어요 · 그림을 누르면/};
   const t=await open(width,{lang});const {page}=t;await fakeGenerate(page);
   await page.evaluate(()=>{mock.extractionDeferred=new Promise(r=>{window.__release=()=>r(JSON.stringify(mock.extraction));});});
   await page.locator('[data-action="extract"]').click();
   await page.waitForFunction(()=>!document.querySelector('#ncs-progress').hidden);await page.waitForTimeout(1100); // one redraw of the timer
   assert.equal(await text(page,'[data-action="extract"]'),L.busy);assert.match(await text(page,'#ncs-progress-title'),L.title);assert.equal(await text(page,'#ncs-progress-cancel'),L.stop);
   if(lang==='en')await noKorean(page,['#ncs-progress-detail']);
   await page.evaluate(()=>{mock.extractionDeferred=null;window.__release();});await idle(page);
   assert.equal(await text(page,'[data-action="extract"]'),L.extract,'back to its name after extracting');
   assert.match(await press(page),L.done);assert.equal(await text(page,'[data-action="generate"]'),L.gen);
   assert.equal(page.generated.length,1);
   if(lang==='en'){await noKorean(page,['#ncs-result .ncs-row','#ncs-verdict','#ncs-anlas-balance']);
    assert.match(t.asked.join('\n'),/^No image preset chosen\./m,'the no-preset question is English');assert.ok(!t.asked.some(a=>HANGUL.test(a)),'every question English');}
   assert.deepEqual(t.errors,[]);await page.close();
  }
  // --- 3. Opus V5 with 1% left: English question, cancel sends nothing more (Korean: the same requests)
  for(const lang of ['ko','en']){
   const t=await open(width,{lang});const {page}=t;await fakeGenerate(page);await account(page,OPUS(1));
   await page.evaluate(()=>{mock.extraction={...mock.extraction};});await page.locator('[data-action="extract"]').click();await idle(page);
   if(lang==='en'){assert.equal(await text(page,'#ncs-verdict'),'Opus · V5 usage nearly gone · asks when generating');await noKorean(page,['#ncs-usage-note','#ncs-cost']);}
   page.ask=ASK;page.removeAllListeners('dialog');t.asked.length=0;
   page.on('dialog',d=>{t.asked.push(d.message());/이번만 생성할까요|Generate this one anyway/.test(d.message())?d.dismiss():d.accept();});
   const said=await press(page);
   assert.equal(page.generated.length,1,'only the first request, which the server answered with the question');
   assert.equal(page.generated.some(b=>b.confirmUsage===true),false,'no confirmed request after cancel');
   assert.equal(await page.locator('#ncs-result img').count(),0,'no picture');
   const q=t.asked.find(a=>/이번만 생성할까요|Generate this one anyway/.test(a));
   if(lang==='en'){assert.equal(q,'1% V5 usage left.\nThis generation may spend Anlas.\nGenerate this one anyway?\n(OK: generate · Cancel: do not send)');assert.equal(said,'The generation request was not sent.');}
   else{assert.equal(q,'V5 사용량이 1% 남았어요.\n이번 생성에서 Anlas가 차감될 수 있어요.\n이번만 생성할까요?');assert.equal(said,'생성 요청을 보내지 않았어요.');}
   assert.deepEqual(t.errors,[]);await page.close();
  }
  // --- 4. work saved on one screen language and loaded on the other (both ways): its undo still knows it is an extraction.
  // Only Free Shot's extraction leaves an undo (label saved in Korean, the kind read back from it).
  {
   const after={},FREE_X={characters:[{id:'leo',name:'Leo',subject:'boy',appearance:'',outfit:'',expression:'smile',action:'standing',position:'auto'}],location:'bridge',lighting:'night',camera:'wide shot',interaction:''};
   const free=async page=>{await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="free"]').getAttribute('aria-pressed')==='true');};
   for(const [from,lang] of [['ko','ko'],['ko','en'],['en','ko']]){
    const t=await open(width,{lang:from});const {page}=t;await fakeGenerate(page);await free(page);
    await page.evaluate(x=>{mock.extraction=x;},FREE_X);await page.locator('#ncs-free-text').fill('Leo on a bridge at night');
    await page.locator('[data-action="extract"]').click();await idle(page);const saved=await settledWork(page);
    assert.equal(saved.undoClear.label.startsWith('추출 전'),true,`the saved undo label is Korean (saved on the ${from} screen)`);
    page.draftByKey={[FREE]:saved};page.draftPosts=[];await page.evaluate(l=>sessionStorage.setItem('test-lang',l),lang);await reopen(page);
    if(await page.locator('[data-mode="free"]').getAttribute('aria-pressed')!=='true')await free(page);
    await page.locator('.ncs-import-undo').waitFor();
    assert.equal(await text(page,'.ncs-import-undo'),lang==='en'?'↶ Undo extraction':'↶ 추출 취소','the kind is still read from the Korean label');
    if(lang==='en')assert.equal(await page.locator('.ncs-import-undo').getAttribute('title'),'Brings back the work before extraction. Gone after your next edit, generation, clear or import.');
    await clearNotice(page);await page.locator('.ncs-import-undo').click();
    assert.equal(await notice(page),lang==='en'?'Back to before the extraction.':'추출 전으로 되돌렸어요.');
    assert.equal(await page.locator('#ncs-location').inputValue(),'','the scene before the extraction');
    after[`${from}>${lang}`]=await settledWork(page);
    assert.deepEqual(t.errors,[]);await page.close();
   }
   assert.deepEqual(after['ko>en'],after['ko>ko'],'undo saves the same work in both languages');assert.deepEqual(after['en>ko'],after['ko>ko']);
   assert.equal(after['ko>en'].undoClear,null);
  }
  // --- 5. the switch writes uiLanguage only
  {
   const t=await open(width);const {page}=t;
   const before=await page.evaluate(()=>structuredClone(mock.extensionSettings.naice_shot));
   await page.locator('[data-tab="settings"]').click();await clearNotice(page);await page.locator('#ncs-ui-language').selectOption('en');
   const mid=await page.evaluate(()=>structuredClone(mock.extensionSettings.naice_shot));
   assert.equal(mid.uiLanguage,'en');assert.deepEqual({...mid,uiLanguage:before.uiLanguage},before,'nothing else changes');
   assert.match(await notice(page),/Reload SillyTavern to apply/);
   assert.equal(await text(page,'[data-action="extract"]'),'장면 추출','this screen stays Korean until reloaded');
   await page.locator('#ncs-ui-language').selectOption('ko');assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.uiLanguage),'ko');
   assert.deepEqual(t.errors,[]);await page.close();
  }
 }
 console.log('PASS browser-wip-en');
}finally{await browser.close();server.close();}
