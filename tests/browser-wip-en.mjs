// wip-en (screen language experiment): an English-screen Chat Shot can pick a target, extract, read the cost and
// generate one picture, and the language changes nothing but words on screen.
// 1. The same AI reply in Korean and in English saves the same work. The extraction prompt differs only in the lines
//    asking for the words shown to the person (a candidate's title, the 추가 요청 result words): Korean asks for Korean, English for English.
// 2. The extract/generate buttons and the progress box stay English while they are redrawn (Korean stays Korean).
// 3. Cost: the Opus V5 usage question is English; cancelling it sends no generation (Korean: the same requests).
// 4. Work saved from the Korean screen (its undo label is Korean) loads on the English screen and its undo still works.
// 5. Every answer of [같은 요청으로 다시 확인] says in English what to check on NovelAI (GPT wip-en P2).
// 6. A user named like a dictionary word (세로) and the AI's request words stay as they are in English notices (P3).
// 7. The drawing tab (person cards, the no-profile box, Free Shot) is English; names, the AI's words and wardrobe
//    names stay as written even when they are dictionary words.
// 8. The language switch only adds uiLanguage to the settings.
// 9. The Profiles tab is English; profile and wardrobe names stay as written; the same edits save the same profiles.
// 10. The Settings tab is English (language box and server-version line too); a preset or outfit named "밤 / 보통 / 옷"
//     stays whole in its notices; the header switch reads Chat / Free and fits; the chat-changed notice is English;
//     the same preset save keeps the same settings.
// 11. The History tab is English; a chat name and a tag that are dictionary words stay as written; putting a picture in
//     a message, deleting and [챗샷으로 보내기] do the same in both languages (the undo label stays Korean).
// 12. The enlarged view and the pictures in the chat are English; "불러오는 중…" still clears in English; moving a chat
//     picture saves the same in both languages.
// 13. Outside the panel (the extension list entry, the message draw button and its notices, the tag pop-up) is English;
//     at 320 and 375px no English button's words run outside its box on any tab, while saving or in the viewer either.
// 14. The confirms that can drop edits (another candidate over a hand-edited prompt, reloading after a save conflict) and
//     the work memory's status line after the work came back are English.
// 15. The viewer's row 1 with a 4- and 5-digit count (3 / 1630, user's iPhone): in English › never runs under Save ▾ and
//     nothing on the row overlaps at 320, 375 and 393px; in Korean ‹ n/m › stays exactly centred as before.
// 16. The 사용 가이드: the English screen reads guide-en.md (contents, icons, bar, a group's text: no Korean), the Korean
//     screen reads guide.md as before; the @ pill row and its menu, which the guide names, are English.
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
// Two moments, with Korean titles and request words (as the Korean screen asks): whatever the AI writes is shown as written.
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
   {const ko=runs.ko.prompt.split('\n'),en=runs.en.prompt.split('\n');assert.equal(en.length,ko.length);
    const changed=ko.map((l,i)=>l===en[i]?null:[l,en[i]]).filter(Boolean);
    assert.deepEqual(changed.map(([k])=>k.split(':')[0]),['title','requestApplied','requestIgnored'],'only the words shown to the person follow the language');
    for(const [k,e] of changed){assert.match(k,/short Korean/);assert.match(e,/short English/);assert.ok(!HANGUL.test(e),e);}}
   const en=runs.en.page,ko=runs.ko.page;
   assert.match(runs.en.note,/^Found 2 scene candidates\. .*Request applied: 미소\. Not applied: 머리색 · 프로필 고정 외형\./,'English frame, the AI words as given');
   assert.match(runs.ko.note,/^장면 후보 2개를 찾았어요\./,'Korean as before');
   await noKorean(en,['.ncs-tabs','#ncs-source-title','[data-action="extract"]','[data-action="generate"]','#ncs-target-label','.ncs-moments-title','.ncs-clear-slot .ncs-action-slot']);
   assert.equal((await text(en,'#ncs-request-applied')).startsWith('Request applied: 미소 / Not applied:'),true);
   assert.deepEqual(await en.locator('.ncs-moment-name').allInnerTexts(),['앉는 순간','일어나는 순간'],'candidate titles are the AI words, as written');
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
  // --- 5. [같은 요청으로 다시 확인]: every answer says in English what to check before generating again (GPT wip-en P2)
  {
   const id=uid(9),t=await open(width,{lang:'en',pending:[[KEY,id]]});const {page}=t;
   const check=async reply=>{page.generationReply=reply;await clearNotice(page);
    await page.locator('[data-action="generation-check"]').first().evaluate(b=>b.click());
    await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent.trim());return notice(page);};
   for(const reply of [{state:'missing'},{state:'unknown'},{state:'discarded',unconfirmed:true},{state:'processing'},{state:'save-failed'}]){
    const said=await check(reply);assert.ok(!HANGUL.test(said),`${reply.state}: ${said}`);
    if(['missing','unknown','discarded'].includes(reply.state))assert.match(said,/Check on NovelAI/,`${reply.state} says what to check`);
   }
   assert.ok(!t.asked.some(a=>HANGUL.test(a)),`the re-save question is English: ${t.asked.join(' | ')}`);
   const said=await check({state:'rejected'});assert.equal(said,'NovelAI refused this request.');
   assert.deepEqual(t.errors,[]);await page.close();
  }
  // --- 6. a person's name and the AI's words stay as they are inside English notices (GPT wip-en P3)
  {
   const t=await open(width,{lang:'en'});const {page}=t;
   await page.evaluate(()=>{mock.name1='세로';mock.emit('edited');}); // a user named like a dictionary word, no profile
   await page.waitForFunction(()=>/세로/.test(document.querySelector('#ncs-matching-state').textContent));
   assert.equal(await page.locator('#ncs-matching-state').textContent(),'세로: no automatic match. Link a user profile if needed.');
   await extractWith(page,{...TWO,requestApplied:['밤 / 정사각형 / 혼자']},'night');
   const said=await notice(page);
   assert.match(said,/Request applied: 밤 \/ 정사각형 \/ 혼자\./,`the AI words as given: ${said}`);
   assert.ok(!/Square|Portrait|Vertical/.test(said),said);
   // the AI's words hold 스텝: the panel still writes it as Steps, but the other words are not looked up again
   await extractWith(page,{...TWO,requestApplied:['스텝 / 정사각형 / 밤']},'dance');
   const steps=await notice(page);
   assert.match(steps,/Request applied: Steps \/ 정사각형 \/ 밤\./,`the AI words as given: ${steps}`);
   assert.ok(!/Square/.test(steps),steps);
   assert.deepEqual(t.errors,[]);await page.close();
  }
  // --- 7. the drawing tab: person cards, the no-profile box and Free Shot read in English, while names, the AI's
  // words and wardrobe names stay exactly as written even when they are dictionary words (가운데, 비우기, 저장).
  {
   const t=await open(width,{lang:'en'});const {page}=t;await fakeGenerate(page);
   const leftKorean=sel=>page.evaluate(([sel,own])=>{const H=/[가-힣]/,out=[];for(const root of document.querySelectorAll(sel)){
     const w=document.createTreeWalker(root,4);for(let n=w.nextNode();n;n=w.nextNode()){const v=n.nodeValue.trim();if(v&&H.test(v.replaceAll('비우기',''))&&!n.parentElement.closest(own))out.push(v);}
     for(const el of root.querySelectorAll('*'))for(const a of ['aria-label','title','placeholder'])if(H.test(el.getAttribute(a)??''))out.push(`@${a} ${el.getAttribute(a)}`);}return out;},
    [sel,'textarea,strong,select[data-profile-switch],select[data-wear-once] option:not([value=""]),select[data-chat-outfit] option[value^="w:"]']);
   await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles[0].wardrobe=[{id:'w1',name:'저장',outfit:'yellow raincoat'}];
    mock.extraction={characters:[{id:'leo',name:'Leo',expression:'가운데',action:'sitting',position:'auto',outfitMode:'replace',outfit:'white shirt'}],unregistered:['비우기','A $$ B'],location:'cafe',lighting:'sun',camera:'medium shot',interaction:''};});
   await page.locator('[data-action="extract"]').click();await idle(page);
   assert.deepEqual(await leftKorean('#ncs-characters'),[],'the card words are English');
   assert.equal(await page.locator('[data-character="leo"] [data-field="expression"]').inputValue(),'가운데','the AI words stay');
   assert.equal(await page.locator('[data-character="leo"] select[data-wear-once] option[value="w1"]').textContent(),'저장','a wardrobe name stays');
   assert.deepEqual(await leftKorean('#ncs-unregistered'),[],'the no-profile list is English');
   assert.equal(await text(page,'[data-quick-profile-name="비우기"]'),'＋ Create a profile for 비우기','the name stays inside the English button');
   assert.equal(await text(page,'[data-quick-profile-name="A $$ B"]'),'＋ Create a profile for A $$ B','"$$" in a name stays as written');
   assert.equal(await page.locator('#ncs-missing-main strong').first().textContent(),'⚠ No profile is linked to User "Mira".');
   await page.locator('[data-missing-do="link"]').first().evaluate(b=>b.click());
   assert.deepEqual(await leftKorean('#ncs-missing-main'),[],'the no-profile box and its link picker are English');
   await page.locator('[data-temp-from="비우기"]').evaluate(b=>b.click());await page.locator('.ncs-temp strong').waitFor();
   assert.equal(await page.locator('.ncs-temp strong').textContent(),'비우기','a temporary person keeps their name');
   assert.deepEqual(await leftKorean('#ncs-characters'),[],'the temporary card is English');
   await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="free"]').getAttribute('aria-pressed')==='true');
   assert.deepEqual(await leftKorean('#ncs-free-source'),[],'the Free Shot words are English');
   await page.evaluate(()=>{mock.extraction={characters:[{id:'leo',name:'Leo',subject:'boy',appearance:'',outfit:'',expression:'smile',action:'standing',position:'auto'}],location:'bridge',lighting:'night',camera:'wide shot',interaction:''};});
   await page.locator('#ncs-free-text').fill('Leo on a bridge');await extractWith(page);
   assert.match(await notice(page),/^Filled the scene fields\. People to draw: 1\./);
   assert.deepEqual(await leftKorean('#ncs-characters'),[],'the Free Shot card is English (pin included)');
   assert.deepEqual(t.errors,[]);await page.close();
  }
  // --- 8. the switch writes uiLanguage only
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
  // --- 9. the Profiles tab reads in English; profile and wardrobe names stay as written even when they are dictionary
  // words (옷장, 제거), and the same edits save the same profiles in both languages.
  {
   const saved={};
   for(const lang of ['ko','en']){
    const t=await open(width,{lang});const {page}=t;
    await page.evaluate(()=>{mock.extensionSettings.naice_shot.profiles[0].wardrobe=[{id:'w1',name:'제거',outfit:'pajamas'}];});
    await page.locator('[data-tab="profiles"]').click();const P2=page.locator('#ncs-profile-list [data-profile]',{hasText:'옷장'});
    await page.locator('#ncs-profile-name').fill('옷장');await page.locator('#ncs-profile-appearance').fill('red hair');await page.locator('#ncs-profile-submit').click();
    await P2.waitFor();await page.locator('[data-profile="leo"]').click();
    await page.locator('[data-profile-mode="describe"]').click();await page.locator('.ncs-wardrobe-item').first().evaluate(d=>d.open=true);
    assert.equal(await P2.innerText(),'옷장','a profile name stays');
    assert.equal(await text(page,'.ncs-wardrobe-item summary'),'제거','a wardrobe name stays');
    if(lang==='en'){
     const left=await page.evaluate(()=>{const H=/[가-힣]/,out=[],root=document.querySelector('section[data-page="profiles"]'),own='#ncs-profile-list,.ncs-wardrobe-item summary';
      const w=document.createTreeWalker(root,4);for(let n=w.nextNode();n;n=w.nextNode()){const v=n.nodeValue.trim();if(v&&H.test(v)&&!n.parentElement.closest(own))out.push(v);}
      for(const el of root.querySelectorAll('*'))for(const a of ['aria-label','title','placeholder','data-short'])if(H.test(el.getAttribute(a)??''))out.push(`@${a} ${el.getAttribute(a)}`);return out;});
     assert.deepEqual(left,[],'the Profiles tab is English');
     assert.equal(await text(page,'#ncs-profile-editing'),'Editing the Leo profile');
    }
    await page.locator('#ncs-profile-aliases').fill('Lee');
    await page.locator('[data-action="wardrobe-add"]').click();await page.locator('.ncs-wardrobe-item').last().evaluate(d=>d.open=true);
    const last=page.locator('.ncs-wardrobe-item').last();
    await last.locator('[data-w="name"]').fill('x');await last.locator('[data-w="name"]').fill('');
    assert.equal(await last.locator('summary').innerText(),lang==='en'?'New outfit':'새 옷','an emptied outfit name reads in the screen language');
    await last.locator('[data-w="name"]').fill('robe');await page.locator('.ncs-wardrobe-item').last().locator('[data-w="outfit"]').fill('bathrobe');
    await clearNotice(page);await page.locator('#ncs-profile-submit').click();
    assert.equal(await notice(page),lang==='en'?'Profile saved.':'프로필을 저장했어요.');
    await P2.click();await page.locator('[data-action="delete-profile"]').click();await P2.waitFor({state:'detached'});
    assert.equal(t.asked.at(-1),lang==='en'?'Delete this profile and its wardrobe? This cannot be undone. Generation history is kept.':'이 프로필과 옷장을 삭제할까요? 되돌릴 수 없어요. 생성 이력은 유지돼요.');
    saved[lang]=await page.evaluate(()=>structuredClone(mock.extensionSettings.naice_shot.profiles).map(p=>({...p,wardrobe:p.wardrobe.map(({id,...w})=>w)})));
    assert.deepEqual(t.errors,[]);await page.close();
   }
   assert.deepEqual(saved.en,saved.ko,'the same profiles are saved in both languages');
   assert.deepEqual(saved.en[0].wardrobe.map(w=>w.name),['제거','robe']);
  }
  // --- 10. the Settings tab reads in English (the language box too, apart from "한국어", and the server-version line);
  // a preset or outfit named with " / " and a dictionary word (밤 / 보통 / 옷, 보통 = Medium) stays whole in the finished
  // notices (GPT wip-en P3, fourth review); the header switch reads Chat / Free and fits; the chat-changed notice is
  // English; the same save keeps the same preset.
  {
   const saved={},NAME='밤 / 보통 / 옷';
   for(const lang of ['ko','en']){
    const t=await open(width,{lang});const {page}=t;const en=lang==='en';
    const modes=await page.evaluate(()=>[...document.querySelectorAll('.ncs-header [data-mode]')].map(b=>[b.textContent,b.getAttribute('aria-label'),b.scrollWidth<=b.clientWidth]));
    assert.deepEqual(modes.map(m=>m.slice(0,2)),en?[['Chat','Chat Shot'],['Free','Free Shot']]:[['챗샷',null],['프리샷',null]]);
    if(en)assert.ok(modes.every(m=>m[2]),'Chat / Free fit their buttons');
    // wearing a wardrobe outfit for this picture: the outfit name stays whole in the notice
    await page.evaluate(n=>{mock.extensionSettings.naice_shot.profiles[0].wardrobe=[{id:'w9',name:n,outfit:'pajamas'}];
     mock.extraction={characters:[{id:'leo',name:'Leo',expression:'calm',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'cafe',lighting:'sun',camera:'medium shot',interaction:''};},NAME);
    await page.locator('[data-action="extract"]').click();await idle(page);await clearNotice(page);
    await page.locator('[data-character="leo"] select[data-wear-once]').selectOption('w9');
    assert.equal(await notice(page),en?`Wearing "${NAME}" in this picture only. The clothes saved in the chat are unchanged.`:`이번 그림에만 "${NAME}"을(를) 입혀요. 채팅에 저장된 옷은 그대로예요.`);
    // the same outfit as this chat's default outfit: the name stays whole too (GPT wip-en P3, fifth review)
    await clearNotice(page);await page.locator('[data-character="leo"] select[data-chat-outfit]').selectOption('w:w9');
    await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent);
    assert.equal(await notice(page),en?`Set Leo's chat default outfit to "${NAME}". Also applied to this picture.`:`Leo의 채팅 기본 복장을 "${NAME}"(으)로 지정했어요. 이번 그림에도 적용했어요.`);
    // an empty extraction reply in Chat Shot and in Free Shot: the whole notice reads in English (GPT wip-en P3, fifth review)
    await page.evaluate(()=>{mock.extractionDeferred=Promise.resolve('{}');});
    await clearNotice(page);await page.locator('[data-action="extract"]').click();await idle(page);
    const chatFail=await notice(page);
    await page.locator('[data-mode="free"]').click();await page.locator('#ncs-free-text').fill('Leo waves.');
    await clearNotice(page);await page.locator('[data-action="extract"]').click();await idle(page);
    const freeFail=await notice(page);
    await page.evaluate(()=>{mock.extractionDeferred=null;});await page.locator('[data-mode="chat"]').click();
    for(const said of [chatFail,freeFail]){assert.match(said,en?/empty response/:/빈 응답/,said);if(en)assert.ok(!HANGUL.test(said),said);}
    assert.match(freeFail,en?/^Scene extraction failed/:/^장면 추출 실패/);
    await page.locator('[data-tab="settings"]').click();
    await page.locator('#ncs-common-preset-name').fill(NAME);await clearNotice(page);await page.locator('[data-action="save-preset-as"]').click();
    assert.equal(await notice(page),en?`Saved the current values as the new preset "${NAME}".`:`지금 값을 새 프리셋 "${NAME}"(으)로 저장했어요.`);
    await clearNotice(page);await page.locator('[data-action="save-preset"]').click();
    assert.equal(await notice(page),en?`Saved the current values to the "${NAME}" preset.`:`"${NAME}" 프리셋에 지금 값을 저장했어요.`);
    assert.ok((await page.locator('#ncs-common-preset option:checked').innerText()).startsWith(NAME),'the preset name stays in the list');
    assert.ok((await text(page,'#ncs-preset-state')).startsWith(NAME+' · '),'the preset name stays in its line');
    assert.equal(await text(page,'[data-action="save-preset"]'),en?`Save changes · ${NAME}`:`변경 저장 · ${NAME}`);
    await page.waitForFunction(()=>document.querySelector('#ncs-server-version').textContent);
    assert.match(await page.locator('#ncs-server-version').textContent(),en?/^Server plugin v/:/^서버 플러그인 v/);
    const box=await page.evaluate(()=>[document.querySelector('#ncs-ui-language-box h3').textContent,...[...document.querySelectorAll('#ncs-ui-language option')].map(o=>o.textContent)]);
    assert.deepEqual(box,en?['Language','한국어','English (experimental)']:['화면 언어 · Language','한국어','English (시험판 · experimental)']);
    if(en){
     const left=await page.evaluate(n=>{const H=/[가-힣]/,out=[],root=document.querySelector('section[data-page="settings"]'),own='code,#ncs-extraction-profile',clean=v=>v.replaceAll(n,'').replace(/^한국어$/,'');
      const w=document.createTreeWalker(root,4);for(let x=w.nextNode();x;x=w.nextNode()){const v=clean(x.nodeValue.trim());if(v&&H.test(v)&&!x.parentElement.closest(own))out.push(v);}
      for(const el of root.querySelectorAll('*'))for(const a of ['aria-label','title','placeholder','data-short'])if(H.test(clean(el.getAttribute(a)??'')))out.push(`@${a} ${el.getAttribute(a)}`);return out;},NAME);
     assert.deepEqual(left,[],'the Settings tab is English');
     assert.match(await page.locator('#ncs-skins').textContent(),/Default/);
    }
    saved[lang]=await page.evaluate(()=>structuredClone(mock.extensionSettings.naice_shot.imagePresets).map(({id,...p})=>p));
    await page.locator('[data-action="delete-preset"]').click();
    assert.equal(t.asked.at(-1),en?'Delete the selected image preset? The prompt and generation settings now entered stay.':'선택한 이미지 프리셋을 삭제할까요? 현재 입력된 프롬프트와 생성 설정은 유지돼요.');
    await page.locator('[data-tab="scene"]').click();await clearNotice(page);await page.evaluate(()=>mock.switchChat('B'));
    await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent);
    assert.equal(await notice(page),en?"The chat changed. This chat's links, outfits and History are used.":'채팅이 바뀌었어요. 이 채팅의 연결·복장과 이력을 사용해요.');
    assert.deepEqual(t.errors,[]);await page.close();
   }
   assert.deepEqual(saved.en,saved.ko,'the same preset is saved in both languages');
   assert.equal(saved.en[0].name,NAME);
  }
  // --- 11. the History tab reads in English (cards, ⋯ menu with its message lines, count line, chat filter, the attach
  //     picker); a chat named "선택" and a tag "1에 넣기" (dictionary words) stay as written; putting a picture in a message,
  //     deleting one and [챗샷으로 보내기] send and save the same in both languages, and the import's undo label stays Korean.
  {
   const seen={},CHAT=JSON.stringify({group:null,card:'Leo.png',chat:'선택'});
   const left=(page,sel)=>page.evaluate(sel=>{const H=/[가-힣]/,out=[],own='.ncs-history-date,.ncs-history-tags,.ncs-chat-name,#ncs-history-filter';
    for(const root of document.querySelectorAll(sel)){const w=document.createTreeWalker(root,4);for(let x=w.nextNode();x;x=w.nextNode()){const v=x.nodeValue.trim();if(v&&H.test(v)&&!x.parentElement.closest(own))out.push(v);}
     for(const el of [root,...root.querySelectorAll('*')])for(const a of ['aria-label','title','placeholder','data-short','alt'])if(H.test(el.getAttribute(a)??''))out.push(`@${a} ${el.getAttribute(a)}`);}return out;},sel);
   for(const lang of ['ko','en']){
    const t=await open(width,{lang,seed:[pic(1),pic(2),pic(3,CHAT)],marks:{[uid(1)]:{star:true,tags:['1에 넣기'],chatKey:KEY}}});const {page}=t;const en=lang==='en';
    await closeCompat(page);await page.locator('[data-tab="history"]').click();await page.waitForSelector('.ncs-history-card');
    await page.evaluate(()=>document.querySelectorAll('section[data-page="history"] details').forEach(d=>{d.open=true;}));
    // the selection buttons fit their boxes on a phone ("Put in message" ran over [Save] on the user's iPhone), and a card's
    // date reads in the screen language ("Nov 14, 2026, 7:27 PM"); Korean keeps its form ("2026. 11. 14. 오후 7:27")
    assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.ncs-history-tools > button:not([hidden])')].filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent)),[],'the selection buttons fit');
    assert.equal(await text(page,'[data-action="attach-selected"]'),en?'Insert':'본문에 넣기');
    const dates=await page.locator('.ncs-history-date').allTextContents();assert.ok(dates.length>=2);
    for(const d of dates)assert.match(d,en?/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s[AP]M$/:/^\d{4}\. \d{1,2}\. \d{1,2}\. 오[전후] \d{1,2}:\d{2}$/);
    await page.locator('[data-history-pick]').first().check();
    await page.waitForFunction(()=>document.querySelector('#ncs-history-count').textContent.includes('·'));
    assert.equal(await text(page,'#ncs-history-count'),en?'Total 2 · 1 picked':'총 2장 · 1장 고름');
    assert.equal(await text(page,'.ncs-history-tags'),'#1에 넣기','a tag stays as written (it reads like "#{0}에 넣기")');
    await page.locator('[data-image-more^="ncs-history-menu"]').first().click();
    const menu=await page.locator('.ncs-history-card [id^="ncs-history-menu"]').first().textContent();
    assert.match(menu,en?/Send to Chat Shot.*Go to message/s:/챗샷으로 보내기.*메시지로 가기/s);
    if(en)assert.deepEqual(await left(page,'section[data-page="history"]'),[],'the History tab is English');
    await page.keyboard.press('Escape');
    // every chat: the chat named "선택" stays as written on its card and in the chat filter
    await page.selectOption('#ncs-history-scope','chats');await page.waitForFunction(()=>document.querySelectorAll('.ncs-chat-name').length===3);
    assert.equal(await page.locator('.ncs-history-card .ncs-chat-name').first().innerText(),'선택');
    const filter=await page.locator('#ncs-history-filter option').allTextContents();
    assert.ok(filter.includes(en?'선택 · 1':'선택 · 1장'),filter.join(' | '));assert.equal(filter[0],en?'All chats · 3':'모든 채팅 · 3장');
    if(en)assert.deepEqual(await left(page,'section[data-page="history"]'),[],'the every-chat view is English');
    await page.selectOption('#ncs-history-scope','chat');await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length===2);
    // [본문에 넣기] → the picker → #1
    await page.evaluate(id=>document.querySelector(`[data-history-attach="${id}"]`).click(),uid(1));await page.waitForSelector('#ncs-attach-dialog[open]');
    await page.locator('[data-attach-target="1"]').click();
    if(en)assert.deepEqual(await left(page,'#ncs-attach-dialog .ncs-attach-card > :not(.ncs-target-list)'),[],'the attach picker is English');
    assert.equal(await text(page,'[data-action="attach-confirm"]'),en?'Put in #1':'#1에 넣기');
    await clearNotice(page);await page.locator('[data-action="attach-confirm"]').click();
    await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent);
    assert.equal(await notice(page),en?'Put the picture in message #1. The message text is unchanged.':'#1 메시지에 그림을 넣었어요. 본문은 그대로예요.');
    const attached=await page.evaluate(()=>mock.chat[1].extra?.naice_shot_images?.map(x=>x.id));
    // delete the other picture
    await clearNotice(page);await page.evaluate(id=>document.querySelector(`[data-history-delete="${id}"]`).click(),uid(2));
    await page.waitForFunction(()=>/삭제했어요|Deleted/.test(document.querySelector('#ncs-notice').textContent));
    assert.equal(t.asked.at(-1),en?'Delete this picture?\nThe original PNGs and records are removed from the server. This cannot be undone.':'이 그림을 삭제할까요?\n원본 PNG와 생성 기록이 서버에서 지워지며 되돌릴 수 없어요.');
    assert.equal(await notice(page),en?'Deleted 1 picture(s).':'그림 1장을 삭제했어요.');
    // [챗샷으로 보내기]: the undo label is saved in Korean on both screens
    await clearNotice(page);await page.evaluate(id=>document.querySelector(`[data-history-id="${id}"]`).click(),uid(1));
    await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent);
    const said=await notice(page);if(en)assert.ok(!HANGUL.test(said),said);
    const work=await settledWork(page);
    assert.equal(work.undoClear.label,'이력에서 가져왔어요. 원래 챗샷 작업은 되돌리기로 돌아와요.');
    assert.equal(await page.locator('.ncs-import-undo').getAttribute('title'),en?'Brought from the history. The earlier Chat Shot work comes back with undo.':work.undoClear.label);
    seen[lang]={attached,deletions:page.deletions,scene:work.scene,label:work.undoClear.label};
    // a missing picture file, server errors on ↻, and [Go to message] in the same chat after the message was edited
    // (GPT wip-en P3 ×3, sixth review)
    {
     const SRC={target:1,fingerprints:[{index:1,swipeId:0,sendDate:'t1',text:'Leo sits by the window. Scene Info: sunny afternoon.'}]};
     const u=await open(width,{lang,seed:[{...pic(7),snapshot:{scene:{source:SRC}}}],broken:[uid(7)]});const p=u.page;
     await closeCompat(p);await p.locator('[data-tab="history"]').click();await p.waitForSelector('.ncs-image-open.ncs-missing');
     assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.ncs-image-open.ncs-missing'),'::after').content),en?'"Picture file not found"':'"그림 파일을 찾을 수 없어요"');
     for(const [status,reply,said] of [[502,{contentType:'text/html',body:'<html>Bad gateway</html>'},en?'Check the server plugin (502).':'서버 플러그인을 확인해 주세요 (502).'],[503,{json:{}},en?'Request failed (503)':'요청 실패 (503)']]){
      const fail=r=>r.fulfill({status,...reply});await p.route('**/api/plugins/naice-shot/history?*',fail);
      await clearNotice(p);await p.locator('[data-action="history"]').click();await p.waitForFunction(()=>document.querySelector('#ncs-notice').textContent);
      assert.equal(await notice(p),said);await p.unroute('**/api/plugins/naice-shot/history?*',fail);
     }
     // the card drawn before the failed refreshes stays (an error keeps the list); refreshing again here let its late
     // reply redraw the card under the open ⋯ menu (GPT wip-en P3, seventh review)
     await p.evaluate(()=>{window.__toasts=[];const keep=m=>window.__toasts.push(m);window.toastr={info:keep,warning:keep,success:keep,error:keep};mock.chat[1].send_date='t1';mock.chat[1].mes='Leo stands up and leaves.';mock.renderChat();});
     await p.locator('[data-image-more^="ncs-history-menu"]').first().click();await p.locator('.ncs-image-popup:popover-open [data-history-jump]').click();
     await p.waitForFunction(()=>window.__toasts.length);
     assert.deepEqual(await p.evaluate(()=>window.__toasts),[en?'#1 · changed after the picture was made.':'#1 · 그림을 만든 뒤 내용이 바뀌었어요.']);
     assert.deepEqual(u.errors,[]);await p.close();
    }
    assert.deepEqual(t.errors,[]);await page.close();
   }
   assert.deepEqual(seen.en,seen.ko,'the same history actions send and save the same in both languages');
  }
  // --- 12. the enlarged view (viewer) reads in English: its fixed words, ⋯ menu, prompt lines and toasts; "불러오는 중…"
  //     still clears after a slow page in English (it was compared by its Korean words); a picture in the chat (its
  //     buttons, the slide arrows, a missing file's note) is English; moving it in the chat saves the same in both languages.
  {
   const seen={};
   const left=(page,sel,own='')=>page.evaluate(([sel,own])=>{const H=/[가-힣]/,out=[];
    for(const root of document.querySelectorAll(sel)){const w=document.createTreeWalker(root,4);for(let x=w.nextNode();x;x=w.nextNode()){const v=x.nodeValue.trim();if(v&&H.test(v)&&!(own&&x.parentElement.closest(own)))out.push(v);}
     for(const el of [root,...root.querySelectorAll('*')])for(const a of ['aria-label','title','placeholder','data-short','alt'])if(H.test(el.getAttribute(a)??''))out.push(`@${a} ${el.getAttribute(a)}`);}return out;},[sel,own]);
   for(const lang of ['ko','en']){
    const idOf=n=>`${String(n).padStart(8,'0')}-aaaa-4bbb-8ccc-${String(n).padStart(12,'0')}`; // uid() fits one digit only
    const t=await open(width,{lang,seed:Array.from({length:21},(x,i)=>({...pic(i+1),id:idOf(i+1),image:`/user/images/naice-shot/${idOf(i+1)}.png`})),broken:[idOf(30)]});const {page}=t;const en=lang==='en';
    await page.evaluate(()=>{window.__toasts=[];const keep=m=>window.__toasts.push(m);window.toastr={info:keep,warning:keep,success:keep,error:keep};});
    // 21 pictures: the list shows 20; the viewer's next page (offset 20) waits until released and then brings nothing (the
    // last picture was deleted elsewhere), so no new picture is shown and only the loading flag can clear the note
    const slow=gate();
    await page.route('**/api/plugins/naice-shot/history?*',r=>new URL(r.request().url()).searchParams.get('offset')==='20'?slow.then(()=>r.fulfill({json:{items:[],total:20,hasMore:false,pending:[],pendingBytes:0}})):r.fallback());
    await closeCompat(page);await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length===20);
    // the 20th card (uid(2)): opening it already asks for the next page
    await page.evaluate(id=>document.querySelector(`[data-view-history="${id}"]`).click(),uid(2));
    await page.waitForSelector('#ncs-viewer[open] .ncsv-stage img[src]');
    await page.locator('#ncs-viewer [data-v="more"]').click();
    const more=await page.locator('#ncs-viewer .ncsv-more-items').innerText();
    assert.match(more,en?/Send to Chat Shot[\s\S]*Settings as a preset[\s\S]*Name it on the history card and save\.[\s\S]*Go to message/:/챗샷으로 보내기[\s\S]*설정을 프리셋으로[\s\S]*메시지로 가기/);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{const d=document.querySelector('#ncs-viewer .ncsv-prompt');d.open=true;d.dispatchEvent(new Event('toggle'));});
    await page.waitForFunction(()=>/1boy/.test(document.querySelector('#ncs-viewer .ncsv-prompt-text').textContent));
    const prompt=await page.locator('#ncs-viewer .ncsv-prompt-text').textContent();
    assert.ok(prompt.startsWith(en?'Model: V4.5 Full · 832×1216 · Steps 28 · seed 2':'모델: V4.5 Full · 832×1216 · Steps 28 · seed 2'),prompt);
    assert.ok(prompt.includes(en?'[Common Positive]\n1boy':'[공통 Positive]\n1boy'),prompt);
    assert.equal(await text(page,'#ncs-viewer [data-v="seed"]'),en?'Copy seed 2':'seed 2 복사');
    // the caption's date reads in the screen language too
    if(en){assert.deepEqual(await left(page,'#ncs-viewer'),[],'the viewer is English');assert.match(await text(page,'#ncs-viewer .ncsv-meta'),/[AP]M/);}
    // › waits for the slow page: "불러오는 중…" shows, and goes once the page is in
    assert.equal(await text(page,'#ncs-viewer .ncsv-position'),'20 / 21');
    await page.locator('#ncs-viewer [data-v="next"]').click();
    await page.waitForFunction(()=>!document.querySelector('#ncs-viewer .ncsv-toast').hidden);
    assert.equal(await text(page,'#ncs-viewer .ncsv-toast'),en?'Loading…':'불러오는 중…');
    slow.open();await page.waitForFunction(()=>document.querySelector('#ncs-viewer .ncsv-position').textContent==='20 / 20');
    await page.waitForFunction(()=>document.querySelector('#ncs-viewer .ncsv-toast').hidden,null,{timeout:4000});
    // copying fails (clipboard and the fallback both refuse): the seed toast and the prompt's copy line are English (GPT wip-en P3)
    await page.evaluate(()=>{window.__exec=document.execCommand;document.execCommand=()=>false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}});});
    await page.locator('#ncs-viewer [data-v="seed"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-viewer .ncsv-toast').hidden);
    const copyFail=en?"Couldn't copy. Please select the text and copy it yourself.":'복사하지 못했어요. 내용을 직접 선택해 복사해 주세요.';
    assert.equal(await text(page,'#ncs-viewer .ncsv-toast'),copyFail);
    await page.evaluate(()=>{const d=document.querySelector('#ncs-viewer .ncsv-prompt');d.open=true;d.dispatchEvent(new Event('toggle'));});
    await page.waitForFunction(()=>!document.querySelector('#ncs-viewer [data-v="copy"]').disabled);
    await page.locator('#ncs-viewer [data-v="copy"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-viewer .ncsv-copy-status').textContent);
    assert.equal(await page.locator('#ncs-viewer .ncsv-copy-status').textContent(),copyFail);
    await page.evaluate(()=>{document.execCommand=window.__exec;});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#ncs-viewer').open);
    // a picture in the chat: put in #1 from the history, then a second one whose file is missing (slide layout, two pictures)
    await page.evaluate(id=>document.querySelector(`[data-history-attach="${id}"]`).click(),uid(2));await page.waitForSelector('#ncs-attach-dialog[open]');
    await page.locator('[data-attach-target="1"]').click();await page.locator('[data-action="attach-confirm"]').click();
    await page.waitForFunction(()=>mock.chat[1].extra?.naice_shot_images?.length===1);
    await page.evaluate(id=>{const list=mock.chat[1].extra.naice_shot_images;list.push({...list[0],id,image:`/user/images/naice-shot/${id}.png`});mock.savedChat=JSON.stringify(mock.chat);mock.renderChat();mock.emit('edited');},idOf(30));
    await page.evaluate(()=>document.getElementById('naice-shot-dialog').close());
    // slide layout: the second picture loads (lazy) once it is shown
    await page.locator('#chat .ncs-inline-slide-next').click();await page.waitForSelector('#chat .ncs-missing-note');
    assert.equal(await page.locator('#chat .ncs-inline-slide-next').getAttribute('aria-label'),en?'Next picture':'다음 그림');
    assert.equal(await text(page,'#chat .ncs-missing-note'),en?'This picture was deleted or cannot be found.':'삭제됐거나 찾을 수 없는 그림이에요.');
    assert.equal(await page.locator('#chat .ncs-inline-remove:not([hidden])').innerText(),en?'Take out of this message':'이 메시지에서 빼기');
    if(en)assert.deepEqual(await left(page,'#chat .ncs-inline-images'),[],'the chat pictures are English');
    // [이 메시지에서 빼기] with the panel closed, and the chat is not saved: the picture comes back, the toast is English (GPT wip-en P3)
    await page.evaluate(()=>{window.__toasts=[];window.__save=mock.saveChat;mock.saveChat=async function(){};});
    await page.locator('#chat .ncs-inline-remove:not([hidden])').click();await page.waitForFunction(()=>window.__toasts.length);
    assert.deepEqual(await page.evaluate(()=>window.__toasts),[en?'The chat was not saved, so it was put back as it was.':'채팅이 저장되지 않아 원래대로 돌려놨어요.']);
    assert.equal(await page.evaluate(()=>mock.chat[1].extra.naice_shot_images.length),2,'the picture is back in the message');
    await page.evaluate(()=>{mock.saveChat=window.__save;window.__toasts=[];});
    // the picture opened from its message: [이 메시지에서 빼기] on row 2, ⋯ → move below the text
    await page.locator('#chat .ncs-inline-slide-prev').click();await page.locator(`#chat [data-ncs-inline-view="${uid(2)}"]`).click();await page.waitForSelector('#ncs-viewer[open] .ncsv-stage img[src]');
    assert.equal(await text(page,'#ncs-viewer [data-v="detach"]'),en?'Take out of this message':'이 메시지에서 빼기');
    await page.locator('#ncs-viewer [data-v="more"]').click();
    const chatMore=await page.locator('#ncs-viewer .ncsv-more-items').innerText();
    assert.match(chatMore,en?/Move below the text[\s\S]*Moves only this picture\.[\s\S]*View in history/:/글 아래로 옮기기[\s\S]*이 그림만 옮겨요\.[\s\S]*이력에서 보기/);
    if(en)assert.deepEqual(await left(page,'#ncs-viewer'),[],'the viewer opened from the chat is English');
    await page.locator('#ncs-viewer .ncsv-more-items button',{hasText:en?'Move below the text':'글 아래로 옮기기'}).click();
    await page.waitForFunction(()=>window.__toasts.length);
    assert.deepEqual(await page.evaluate(()=>window.__toasts),[en?'Moved the picture below the text.':'그림을 글 아래로 옮겼어요.']);
    seen[lang]=await page.evaluate(()=>mock.chat[1].extra.naice_shot_images.map(x=>[x.id,x.placement??null]));
    assert.deepEqual(t.errors,[]);await page.close();
   }
   assert.deepEqual(seen.en,seen.ko,'moving a chat picture saves the same in both languages');
  }
  // --- 13. outside the panel and on narrow phones (GPT wip-en P3 ×3): the extension list entry, the message draw button
  //     (its name and the notices it leaves) and the tag pop-up are English (Korean stays as written); at 320 and 375px no
  //     button's words run outside its box on any tab, also while picked pictures are being saved ("준비 중…") and in the viewer.
  for(const w of width===375?[320,375]:[]){
   // Words outside their button: a text line past the button's left or right edge, or a button wider inside than outside
   // (a name cut with "…" on purpose is left out).
   const over=page=>page.evaluate(()=>{const out=[],vis=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    for(const b of document.querySelectorAll('#naice-shot-dialog button,#naice-shot-dialog summary,#ncs-viewer button')){
     if(!vis(b))continue;const r=b.getBoundingClientRect();if(r.width<2)continue;let worst=0;
     const walk=document.createTreeWalker(b,4);for(let n=walk.nextNode();n;n=walk.nextNode()){if(!n.nodeValue.trim())continue;const g=document.createRange();g.selectNodeContents(n);for(const q of g.getClientRects())worst=Math.max(worst,r.left-q.left,q.right-r.right);}
     const cut=[b,...b.querySelectorAll('*')].some(x=>getComputedStyle(x).textOverflow==='ellipsis');
     if(worst>0.5||(b.scrollWidth>b.clientWidth+1&&!cut))out.push(`${b.innerText.replace(/\s+/g,' ').trim()} (${worst.toFixed(1)}px)`);}
    return out;});
   const openAll=page=>page.evaluate(()=>{for(const d of document.querySelectorAll('#naice-shot-dialog details'))d.open=true;});
   // English only: the Korean screen is main's CSS as it is, and Korean fonts differ between machines ("준비 중…" ran
   // 1.2px over at 320px on another machine, GPT wip-en P3, ninth review); this step is about the longer English words.
   const fits=async(page,where)=>{if(await page.evaluate(()=>document.getElementById('naice-shot-dialog').classList.contains('ncs-lang-en')))assert.deepEqual(await over(page),[],`${w}px ${where}: every button's words stay inside it`);};
   const waitNotice=(page,want)=>page.waitForFunction(want=>document.querySelector('#ncs-notice').textContent.includes(want),want);
   for(const lang of ['ko','en']){
    const en=lang==='en',t=await open(w,{lang,seed:[pic(1),pic(2)],marks:{[uid(1)]:{chatKey:KEY,tags:['웃음']}}});const {page}=t;await closeCompat(page);
    assert.equal((await page.locator('#ncs-extension-settings .ncs-extension-body').innerText()).replace(/\s+/g,' ').trim(),
     en?'Profiles · Scene editing · Image generation Open NAIce Shot':'프로필 · 장면 편집 · 이미지 생성 NAIce Shot 열기');
    // every tab, folded lines opened
    await openAll(page);await fits(page,'Chat Shot');
    await page.locator('.ncs-header [data-mode="free"]').click();await page.waitForSelector('.ncs-header [data-mode="free"][aria-pressed="true"]');await openAll(page);await fits(page,'Free Shot');
    await page.locator('.ncs-header [data-mode="chat"]').click();await page.waitForSelector('.ncs-header [data-mode="chat"][aria-pressed="true"]');
    await extractWith(page,TWO,'smiling');await openAll(page);await fits(page,'after extraction');
    for(const tab of ['profiles','settings']){await page.locator(`[data-tab="${tab}"]`).click();await openAll(page);await fits(page,tab);}
    await page.locator('[data-tab="profiles"]').click();await page.locator('[data-action="new-profile"]').click();await openAll(page);await fits(page,'profile form');
    await page.locator('[data-tab="history"]').click();await page.waitForSelector('.ncs-history-card');await openAll(page);await fits(page,'history');
    await page.locator('[data-action="select-all-history"]').click();await fits(page,'history, all picked');
    // saving the picked pictures: the picture files are held, so the button shows "준비 중…" (GPT wip-en P3-1)
    const held=gate();await page.route('**/user/images/naice-shot/**',async r=>{await held;await r.fallback();});
    await page.locator('[data-image-more="ncs-selection-save"]').click();await page.locator('[data-action="save-selected-clean"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-image-more="ncs-selection-save"]').disabled);
    await fits(page,'history, saving');
    assert.equal(await page.locator('[data-image-more="ncs-selection-save"] .ncs-save-label').textContent(),en?'Saving…':'준비 중…');held.open();
    await page.waitForFunction(()=>!document.querySelector('[data-image-more="ncs-selection-save"]').disabled);
    await page.locator(`[data-view-history="${uid(1)}"]`).click();await page.locator('#ncs-viewer[open]').waitFor();await page.waitForTimeout(150);await fits(page,'viewer');
    await page.evaluate(()=>document.getElementById('ncs-viewer').close());
    // the message draw button: its name, and the notices of a press (picked / changed meanwhile / cannot be picked)
    await page.locator('[data-tab="settings"]').click();await page.evaluate(()=>{document.getElementById('ncs-chat-image-more').open=true;});
    await page.locator('#ncs-message-button').check();const draw=page.locator('#chat .mes[mesid="1"] .ncs-mes-draw');await draw.waitFor();
    assert.deepEqual(await draw.evaluate(b=>[b.title,b.getAttribute('aria-label')]),en?['Draw with NAIce Shot','Draw a NAIce Shot picture from this message']:['NAIce Shot으로 그리기','이 메시지로 NAIce Shot 그림 그리기']);
    const press=async()=>{await page.evaluate(()=>{document.querySelector('dialog[open]')?.close();document.querySelector('#ncs-notice').textContent='';});await draw.click();};
    await press();await waitNotice(page,en?'Picked message #1. Press "Extract scene" to go on.':'#1 메시지를 대상으로 골랐어요. "장면 추출"을 눌러 진행해 주세요.');
    await page.evaluate(()=>{const o=HTMLDialogElement.prototype.showModal;HTMLDialogElement.prototype.showModal=function(){HTMLDialogElement.prototype.showModal=o;mock.chat[1].mes='Leo looks away.';return o.call(this);};});
    await press();await waitNotice(page,en?'The message changed after you pressed the button. Check the message and press it again.':'버튼을 누른 뒤 그 메시지가 바뀌었어요. 메시지를 확인하고 다시 눌러 주세요.');
    await page.evaluate(()=>{delete mock.chat[1].mes;});
    await press();await waitNotice(page,en?"This message can't be picked for a picture.":'이 메시지는 그림 대상으로 고를 수 없어요.');
    // the tag pop-up (on the chat screen, the panel closed)
    await page.evaluate(k=>{mock.chat[1].mes='Leo looks away.';mock.extensionSettings.naice_shot.tagPopupChats={[k]:true};document.querySelector('dialog[open]')?.close();
     mock.chat.push({name:'Leo',mes:'웃음'});mock.savedChat=JSON.stringify(mock.chat);mock.renderChat();mock.emit('rendered',mock.chat.length-1,'normal');},KEY);
    const pop=page.locator('#ncs-tag-pop');await pop.waitFor();
    assert.deepEqual(await pop.evaluate(p=>[p.getAttribute('aria-label'),p.title,p.querySelector('img').alt,p.querySelector('[data-tag-pop="close"]').getAttribute('aria-label'),p.querySelector('[data-tag-pop="close"]').title]),
     en?['Tag pop-up picture','Tap to view large · Hold to move','Tag pop-up picture','Close','Close']:['태그 추천 그림','눌러서 크게 보기 · 길게 눌러 옮기기','태그 추천 그림','닫기','닫기']);
    assert.deepEqual(t.errors,[]);await page.close();
   }
  }
  // --- 14. the confirms that can drop edits and the work memory's status line read in English (GPT wip-en P3, ninth review):
  //     another candidate with a hand-edited final prompt, reloading the server's work after a save conflict (both cancelled:
  //     nothing changes), and the line after Chat Shot work came back from the server. Free Shot's card question is checked
  //     line by line in tests/i18n-sweep.test.mjs.
  {
   // Every read waits for its own text (GPT wip-en P3, twelfth review: a slow reply left the notice empty after a fixed wait).
   const shows=(p,sel,want)=>p.waitForFunction(([s,w])=>{const t=document.querySelector(s)?.innerText??'';return w.re?new RegExp(w.re).test(t):t.includes(w);},[sel,want]).catch(()=>{});
   const asked=async(t,n)=>{for(let i=0;i<100&&t.asked.length===n;i++)await t.page.waitForTimeout(30);};
   for(const lang of ['ko','en']){
    const en=lang==='en',t=await open(width,{lang});const {page}=t;await closeCompat(page);
    await extractWith(page,TWO,'smiling');
    await page.locator('#ncs-final-box > summary').click();
    await page.locator('#ncs-final-form [data-final="prompt"][data-slot="0"]').fill('1boy, edited by hand');await page.locator('#ncs-final-badge').waitFor();
    page.refuse=true;let n=t.asked.length;await page.locator('[data-moment="0"]').click();await asked(t,n);page.refuse=false;
    assert.equal(await page.locator('[data-moment="1"]').getAttribute('aria-pressed'),'true','cancelled: the moment stays');
    assert.deepEqual(t.asked.slice(n),[en?"You edited the final prompt by hand. Switching to another moment puts back that moment's assembled prompt. Switch?":'직접 고친 최종 프롬프트가 있어요. 다른 순간으로 바꾸면 고른 순간의 조립 결과로 돌아가요. 바꿀까요?']);
    const saved=await settledWork(page);
    page.draftConflict=true;await page.locator('#ncs-location').fill('local place');await page.waitForFunction(()=>!document.querySelector('#ncs-draft-retry').hidden);
    page.refuse=true;n=t.asked.length;await page.locator('#ncs-draft-retry').evaluate(b=>b.click());await asked(t,n);page.refuse=false;page.draftConflict=false;
    assert.equal(await page.locator('#ncs-location').inputValue(),'local place','cancelled: the edit stays');
    assert.deepEqual(t.asked.slice(n),[en?'Load the work saved on the server again? Unsaved edits on screen will be replaced.':'서버에 저장된 작업을 다시 불러올까요? 현재 화면의 저장되지 않은 편집은 바뀌어요.']);
    page.draftByKey={[KEY]:saved};await reopen(page);
    await page.waitForFunction(()=>document.querySelector('#ncs-location').value==='cafe');
    await shows(page,'#ncs-draft-status',{re:en?'^Chat scene loaded':'^이 채팅에서 작업하던 장면을 불러왔어요'});
    assert.match(await page.locator('#ncs-draft-status').innerText(),en?/^Chat scene loaded · Target message(: latest| #\d+)$/:/^이 채팅에서 작업하던 장면을 불러왔어요 · 대상 메시지(: 최신| #\d+)$/);
    assert.deepEqual(t.errors,[]);await page.close();
    // The notice after another candidate is English and the AI's title stays as written ("닫기" is a dictionary word),
    // also with the note on a required person added to that candidate (GPT wip-en P3, eleventh review).
    {
     const c=await open(width,{lang}),p=c.page;await closeCompat(p);
     const NIGHT={...TWO,moments:[{...TWO.moments[0],title:'밤 / 닫기 / 정사각형',characters:[]},TWO.moments[1]]};
     await p.locator('#ncs-moment-wish').evaluate(f=>{f.value='@[Leo](ref:leo) 미소';});
     await extractWith(p,NIGHT);
     await clearNotice(p);await p.locator('[data-moment="0"]').click();await shows(p,'#ncs-notice',en?'Switched':'순간으로 바꿨어요');
     assert.equal(await notice(p),en?'Switched to the "밤 / 닫기 / 정사각형" moment. Each candidate keeps its own edits. Added required people missing from the result: Leo. Their expression and action are empty; fill them in or extract again.':
      '"밤 / 닫기 / 정사각형" 순간으로 바꿨어요. 후보마다 고친 내용은 따로 남아 있어요. 결과에 없던 필수 인물을 넣었어요: Leo. 표정·행동이 비어 있어요. 직접 채우거나 다시 추출해 주세요.');
     assert.equal(await p.locator('[data-moment="0"] .ncs-moment-name').innerText(),'밤 / 닫기 / 정사각형','the button keeps the title');
     await clearNotice(p);await p.locator('[data-moment="1"]').click();await shows(p,'#ncs-notice',en?'Switched':'순간으로 바꿨어요');
     assert.equal(await notice(p),en?'Switched to the "일어나는 순간" moment. Each candidate keeps its own edits.':'"일어나는 순간" 순간으로 바꿨어요. 후보마다 고친 내용은 따로 남아 있어요.');
     assert.ok(JSON.stringify(await settledWork(p)).includes('"밤 / 닫기 / 정사각형"'),'saved as written');
     assert.deepEqual(c.errors,[]);await p.close();
    }
    // The AI leaves out a required field (GPT wip-en P3, twelfth review): the whole reply cannot be read, or one candidate
    // is left out beside a good one. The reason is English, the field name as written.
    {
     const c=await open(width,{lang}),p=c.page;await closeCompat(p);
     const {lighting,...noLight}=TWO.moments[0];
     await extractWith(p,{characters:noLight.characters,unregistered:[],location:'cafe',camera:'medium shot',interaction:''});
     await shows(p,'#ncs-notice','lighting');const whole=await notice(p);
     assert.ok(whole.includes(en?'Could not read the JSON: the lighting field has the wrong format.':'JSON을 읽지 못했어요: lighting 필드 형식이 잘못됐어요.'),whole);
     if(en)assert.ok(!HANGUL.test(whole),whole);
     await extractWith(p,{...TWO,moments:[noLight,TWO.moments[1]],defaultIndex:0});
     await shows(p,'#ncs-notice','lighting');const one=await notice(p);
     assert.ok(one.includes(en?'Left out a candidate that could not be read: the lighting field has the wrong format.':'읽지 못한 후보를 뺐어요: lighting 필드 형식이 잘못됐어요.'),one);
     // An unknown ID without a name is left out, and lighting stays Korean after the second ask (GPT wip-en P3, twelfth review):
     // both warnings are English, the ID as written.
     const {title,...untitled}=TWO.moments[1],odd={...untitled,characters:[...untitled.characters,{id:'unlisted123',expression:'calm',action:'standing',position:'auto',outfitMode:'unchanged',outfit:''}],lighting:'달빛'};
     await extractWith(p,odd);await shows(p,'#ncs-notice',en?'Left out an unknown ID':'미등록 ID 제외');
     const odds=await notice(p);
     assert.ok(odds.includes(en?'Left out an unknown ID: unlisted123':'미등록 ID 제외: unlisted123'),odds);
     assert.ok(odds.includes(en?'Some fields are not in English (lighting). Fix them yourself or extract again.':'영어로 바뀌지 않은 칸이 있어요(lighting). 직접 고치거나 다시 추출해 주세요.'),odds);
     if(en)assert.ok(!HANGUL.test(odds.replace(/달빛/g,'')),odds);
     // A known ID without its name stops the extraction, and a name in the scene description is taken out
     // (GPT wip-en P3, thirteenth review): both texts in each language.
     const {name,...nameless}=untitled.characters[0];
     await extractWith(p,{...untitled,characters:[nameless]});await shows(p,'#ncs-notice',en?'no name field':'name 필드가 없어요');
     const stop=await notice(p);
     assert.ok(stop.includes(en?'A person in the result has no name field. The reply must include the real name of each person.':'추출 인물의 name 필드가 없어요. 실제 인물 이름을 함께 반환해야 해요.'),stop);
     if(en)assert.ok(!HANGUL.test(stop),stop);
     await extractWith(p,{...untitled,location:'cafe where Leo waits'});await shows(p,'#ncs-notice',en?'Removed the names':'장면 설명에 들어간 이름');
     const plain=await notice(p);
     assert.ok(plain.includes(en?'Removed the names in the scene description (Leo) and used general wording instead.':'장면 설명에 들어간 이름(Leo)을 빼고 일반 표현으로 정리했어요.'),plain);
     if(en)assert.ok(!HANGUL.test(plain),plain);
     assert.deepEqual(c.errors,[]);await p.close();
    }
    // The status line when the work changed elsewhere while a deletion was being checked (GPT wip-en P3, eleventh review):
    // the deletion's reply is lost, the check then finds another revision on the server. The edit stays.
    {
     const c=await open(width,{lang}),p=c.page;await closeCompat(p);
     await p.locator('#ncs-location').fill('cafe at night');await settledWork(p);
     p.loseDraftDelete=true;p.draftReadFails=true;
     await p.locator('[data-tab="settings"]').click();await p.locator('[data-action="delete-all-work"]').click();
     // wait for the notice that the deletion was not verified (the fields lock already while the request is out)
     await p.waitForFunction(()=>/전체 삭제 응답을 받지 못했어요|No reply to the delete-all request/.test(document.querySelector('#ncs-notice').textContent));
     assert.equal(await p.locator('#ncs-work-fields').evaluate(f=>f.disabled),true,'locked until checked');
     p.loseDraftDelete=false;p.draftReadFails=false;p.draftReply={revision:'elsewhere',work:null};
     await p.locator('[data-tab="scene"]').click();await p.locator('#ncs-draft-retry').click();
     await p.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
     await shows(p,'#ncs-draft-status',en?'Check work saving':'작업 저장을 확인해 주세요');
     assert.equal(await p.locator('#ncs-draft-status').innerText(),en?'Check work saving: The work was changed elsewhere.':'작업 저장을 확인해 주세요: 다른 곳에서 작업이 바뀌었어요.');
     assert.equal(await p.locator('#ncs-location').inputValue(),'cafe at night','the edit stays');
     assert.deepEqual(c.errors,[]);await p.close();
    }
    // Work memory that cannot connect says why in each language (GPT wip-en P3, tenth review): the server's work could not
    // be read, or the edits on screen are too long to compare with the saved copy. The edits stay either way.
    for(const why of ['unread','long']){
     const b=await open(width,{lang}),p=b.page;p.quickFail=true;await p.reload();
     await p.locator('#ncs-extension-settings .inline-drawer-toggle').click();await p.locator('.ncs-launch-button').click();await p.locator('#naice-shot-dialog[open]').waitFor();
     await p.waitForFunction(()=>!document.getElementById('ncs-work-fields').disabled);
     p.draftByKey={[KEY]:saved};
     if(why==='long')await p.locator('#ncs-location').evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},'x'.repeat(200001));
     else{await p.locator('#ncs-location').fill('local place');p.draftReadFails=true;}
     p.quickFail=false;const q=p.quickCalls??0;await p.locator('#ncs-draft-retry').evaluate(x=>x.click());
     for(let i=0;i<80&&(p.quickCalls??0)===q;i++)await p.waitForTimeout(50);
     await p.waitForFunction(()=>!document.getElementById('ncs-work-fields').disabled);
     // wait for the result itself: the notice (unread) or the status line and the notice (long)
     if(why==='unread')await shows(p,'#ncs-notice',en?"Couldn't check the server's work":'서버 작업을 확인하지 못해서');
     else{await shows(p,'#ncs-draft-status',en?"Couldn't check the current work":'지금 작업을 확인하지 못해서');await shows(p,'#ncs-notice',en?"Couldn't check the current work":'지금 작업을 확인하지 못해서');}
     if(why==='unread'){
      assert.equal(await notice(p),en?"Couldn't check the server's work, so work memory is not connected. Please press again.":'서버 작업을 확인하지 못해서 작업 기억을 연결하지 않았어요. 다시 눌러 주세요.');
      assert.equal(await p.locator('#ncs-location').inputValue(),'local place','the edit stays');
     }else{
      const said=en?"Couldn't check the current work, so work memory is paused (The work is too long). Your edits are not saved yet and may be lost if you change chats.":
       '지금 작업을 확인하지 못해서 작업 기억을 잠시 멈췄어요(작업 내용이 너무 길어요). 지금 편집은 아직 저장되지 않았어요. 채팅을 바꾸면 사라질 수 있어요.';
      assert.equal(await p.locator('#ncs-draft-status').innerText(),said);assert.equal(await notice(p),said);
      assert.equal((await p.locator('#ncs-location').inputValue()).length,200001,'the edit stays');
     }
     assert.deepEqual(b.errors,[]);await p.close();
    }
   }
  }
  // --- 15. the viewer's row 1 with a big count (user's iPhone: "3 / 1630" put › under the red Save). English Save ▾ ·
  //     Delete are wider than 저장 ▾ · 삭제; ‹ n/m › now slides left only when they need the room (English CSS only).
  for(const w of width===375?[320,375,393]:[]){
   const idOf=n=>`${String(n).padStart(8,'0')}-aaaa-4bbb-8ccc-${String(n).padStart(12,'0')}`;
   for(const lang of ['ko','en'])for(const total of [1630,12345]){
    const en=lang==='en',t=await open(w,{lang,seed:Array.from({length:21},(x,i)=>({...pic(i+1),id:idOf(i+1),image:`/user/images/naice-shot/${idOf(i+1)}.png`}))});const {page}=t;
    page.historyOverride={total,hasMore:true};
    await closeCompat(page);await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length===20);
    await page.evaluate(()=>document.querySelectorAll('[data-view-history]')[17].click());
    await page.waitForFunction(want=>document.querySelector('#ncs-viewer[open] .ncsv-position')?.textContent===want,`18 / ${total}`);
    const row=await page.evaluate(()=>{const box=s=>document.querySelector('#ncs-viewer '+s).getBoundingClientRect();
     const parts=['.ncsv-more','[data-v=previous]','.ncsv-position','[data-v=next]','.ncs-save-toggle','.ncsv-delete'].map(s=>[s,box(s)]),hits=[];
     for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const [a,p]=parts[i],[b,q]=parts[j];if(p.left<q.right-0.5&&q.left<p.right-0.5)hits.push(`${a} × ${b}`);}
     const nav=box('.ncsv-navigation'),bar=box('.ncsv-tools');
     return {hits,offCentre:Math.abs((nav.left+nav.right)/2-(bar.left+bar.right)/2),inside:parts.every(([,r])=>r.left>=bar.left&&r.right<=bar.right)};});
    assert.ok(row.inside,`${w}px ${lang} ${total}: row 1 stays on the screen`);
    if(en)assert.deepEqual(row.hits,[],`${w}px ${total}: nothing on the English row 1 overlaps`);
    else assert.ok(row.offCentre<0.5,`${w}px ${total}: Korean ‹ n/m › stays exactly centred (${row.offCentre})`);
    assert.deepEqual(t.errors,[]);await page.close();
   }
  }
  // --- 16. the guide in each language (the user's iPhone: "가이드는 아직 한글"), and the @ pill row and menu it names.
  for(const w of width===375?[375]:[]){
   const tok=(name,id)=>`@[${name}](ref:${id})`;
   // Korean left on screen (a profile's own name or alias in the pick list, `own`, is the user's and stays as written).
   const hangul=(page,sel,own='')=>page.evaluate(([sel,own])=>{const H=/[가-힣]/,out=[],root=document.querySelector(sel);const t=document.createTreeWalker(root,4);
    for(let x=t.nextNode();x;x=t.nextNode())if(H.test(x.nodeValue)&&!(own&&x.parentElement.closest(own)))out.push(x.nodeValue.trim());
    for(const el of [root,...root.querySelectorAll('*')])for(const a of ['aria-label','title'])if(H.test(el.getAttribute(a)??''))out.push(`@${a} ${el.getAttribute(a)}`);return out;},[sel,own]);
   const seen={};
   for(const lang of ['ko','en']){
    const en=lang==='en',t=await open(w,{lang});const {page}=t;await closeCompat(page);
    const asked=[];page.on('request',r=>{if(/\/guide(-en)?\.md/.test(r.url()))asked.push(new URL(r.url()).pathname.split('/').pop());});
    await page.locator('[data-action="open-guide"]').click();await page.waitForSelector('#ncs-guide:not([hidden]) .ncs-guide-toc button');
    assert.deepEqual(asked,[en?'guide-en.md':'guide.md']);
    const toc=await page.locator('#ncs-guide .ncs-guide-toc-name').allInnerTexts(),icons=await page.locator('#ncs-guide .ncs-guide-toc-icon').allInnerTexts();
    assert.equal(toc.length,8);assert.equal(toc[0],en?'1. Getting started':'1. 처음 사용하기');assert.equal(toc[2],en?'3. Drawing':'3. 그리기');
    assert.ok(!icons.includes('📘'),`every group keeps its icon: ${icons}`);seen[lang]=icons;
    if(en)assert.deepEqual(await hangul(page,'#ncs-guide'),[],'the guide contents are English');
    // a group: the bar (‹ 이전 · n / 8 · 다음 ›, main 0.1.165), ☰ 목차 beside ✕ 닫기, and the text
    await page.locator('#ncs-guide [data-guide-group="2"]').click();await page.waitForSelector('#ncs-guide-nav:not([hidden]) [data-guide-prev]');
    assert.equal(await text(page,'.ncs-guide-head [data-guide-toc]'),en?'☰ Contents':'☰ 목차');
    assert.equal(await text(page,'#ncs-guide-nav [data-guide-prev]'),en?'‹ Prev':'‹ 이전');
    assert.equal(await text(page,'#ncs-guide-nav [data-guide-group]'),en?'Next ›':'다음 ›');
    assert.equal(await text(page,'#ncs-guide-body h3'),en?'3. Drawing':'3. 그리기');
    if(en)assert.deepEqual(await hangul(page,'#ncs-guide'),[],'a group of the guide is English');
    else assert.match(await text(page,'#ncs-guide-body'),/챗샷 — 채팅 장면으로 그리기/);
    await page.locator('#ncs-guide [data-action="close-guide"]').click();await page.waitForSelector('#ncs-guide[hidden]',{state:'attached'});
    // the @ pill row (a linked pill and a broken one) and the menu of each
    await page.locator('#ncs-moment-wish').evaluate((f,v)=>{f.value=v;},`${tok('Leo','leo')} and ${tok('Ghost','gone')}`);
    await page.waitForFunction(()=>document.querySelectorAll('[data-pills-for="ncs-moment-wish"] .ncs-ref-pill').length===2);
    assert.equal(await text(page,'[data-pills-for="ncs-moment-wish"] .ncs-ref-pills-cap'),en?'Linked':'연결됨');
    assert.equal(await text(page,'[data-pills-for="ncs-moment-wish"] .ncs-ref-pill-broken small'),en?'broken':'끊김');
    await page.locator('[data-pills-for="ncs-moment-wish"] .ncs-ref-pill',{hasText:'@Leo'}).click();await page.waitForSelector('.ncs-pill-menu');
    assert.deepEqual(await page.locator('.ncs-pill-menu button').allInnerTexts(),en?['View profile','Pick again','Remove from box']:['프로필 보기','다시 고르기','칸에서 지우기']);
    if(en)assert.deepEqual(await hangul(page,'[data-pills-for="ncs-moment-wish"]'),[],'the pill row and its menu are English');
    await page.locator('[data-pills-for="ncs-moment-wish"] .ncs-ref-pill-broken').click();await page.waitForSelector('.ncs-pill-menu .ncs-pill-menu-head:text-matches("Ghost")');
    assert.match(await text(page,'.ncs-pill-menu-head'),en?/^@Ghost · broken link$/:/^@Ghost · 끊긴 연결$/);
    assert.equal(await text(page,'.ncs-pill-menu .ncs-pill-menu-drop'),en?'Remove from box':'칸에서 지우기');
    if(en)assert.deepEqual(await hangul(page,'[data-pills-for="ncs-moment-wish"]','.ncs-ref-item'),[],'the broken pill\'s menu is English');
    assert.deepEqual(t.errors,[]);await page.close();
   }
   assert.deepEqual(seen.en,seen.ko,'the same icons in both languages');
  }
 }
 console.log('PASS browser-wip-en');
}finally{await browser.close();server.close();}
