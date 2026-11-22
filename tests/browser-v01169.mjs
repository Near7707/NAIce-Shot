// v0.1.169: the @ check's stop notice (a broken @name in 추가 요청 or the 프리샷 상황 글) reads in English on the
// English screen — the sentence and each problem; the typed @name stays as written. Korean reads exactly as before.
// No extraction is sent in either language.
// Header copied from browser-i18n (lines 32–150).
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

const free=async page=>{await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="free"]').getAttribute('aria-pressed')==='true');};
const put=(page,sel,v)=>page.evaluate(([sel,v])=>{const f=document.querySelector(sel);f.value=v;f.dispatchEvent(new Event('input',{bubbles:true}));},[sel,v]);
const calls=page=>page.evaluate(()=>{if(!mock.__counted){mock.__counted=true;mock.extractCalls=0;const g=mock.generateRaw;mock.generateRaw=(...a)=>{mock.extractCalls++;return g(...a);};}return mock.extractCalls;});
const stopNote=async(page,sel,value)=>{await calls(page);await put(page,sel,value);await clearNotice(page);await page.locator('[data-action="extract"]').click();
 await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent.trim());const n=await notice(page);
 assert.equal(await calls(page),0,'no extraction sent');return n;};
const KO_GONE='@Ghost: 지워졌거나 찾을 수 없는 프로필이에요. 이 @이름을 지우고 @를 쳐서 목록에서 다시 골라 주세요.';
const EN_GONE="@Ghost: this profile was deleted or can't be found. Delete this @name, type @ and pick again from the list.";

try{
 for(const width of [375,1100]){
  {
   for(const lang of ['ko','en']){
    const t=await open(width,{lang});const {page}=t;const en=lang==='en';
    // 챗샷 추가 요청
    {const n=await stopNote(page,'#ncs-moment-wish','@[Ghost](ref:gone) waving');
     assert.equal(n,en?`Check the @references in the extra request. ${EN_GONE}`:`추가 요청의 @참조를 확인해 주세요. ${KO_GONE}`,n);}
    // 프리샷 상황 글: two problems, each read on its own; a typed name that reads like an app sentence stays as written
    await free(page);
    {const n=await stopNote(page,'#ncs-free-text','@[Ghost](ref:gone) and @[위치 값이 잘못됐어요.](ref:none) on a bridge');
     const second=en?"@위치 값이 잘못됐어요.: this profile was deleted or can't be found. Delete this @name, type @ and pick again from the list."
       :'@위치 값이 잘못됐어요.: 지워졌거나 찾을 수 없는 프로필이에요. 이 @이름을 지우고 @를 쳐서 목록에서 다시 골라 주세요.';
     assert.equal(n,en?`Check the @references in the situation text. ${EN_GONE} ${second}`:`상황 글의 @참조를 확인해 주세요. ${KO_GONE} ${second}`,n);}
    assert.deepEqual(t.errors,[]);await page.close();
   }
  }
 }
 console.log('PASS browser-v01169');
}finally{await browser.close();server.close();}
