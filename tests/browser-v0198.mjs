// v0.1.98: GPT review of 0.1.97.
// P2-1: the server's deletion record is a server state in recallDraft. [서버 작업 다시 불러오기] after a 409 empties the
// screen (it already asked); a connect or another fresh read with edits on screen asks "서버에 이 작업의 삭제 기록이 있어요…"
// (확인 empties, 취소 keeps and holds); an empty screen connects without a question. Nothing is written over the record unasked.
// P2-2: a generation started while work memory was paused never writes the old chat's saved work when it ends elsewhere.
// P3: an off-screen 챗샷 already saved is not reported as dropped while work memory is paused.
// Header copied from browser-v0197 (+ page.deletedKeys: chat keys whose saved work has a deletion record; page.holdGen).
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
async function open(width,{version='0.1.25',seed=[],features=FEATURES,marks=null,pending=null,broken=[],draft=null,skin=null,height=900,touch=false}={}){
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
 if(skin)await page.addInitScript(k=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.skin=k;}),skin);
 if(marks)await page.addInitScript(m=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.imageMarks=m;}),marks);
 if(pending)await page.addInitScript(p=>sessionStorage.setItem('naice-shot-pending-generation',JSON.stringify(p)),pending);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('#naice-shot-dialog[open]').waitFor();
 return {page,errors,asked,items};
}
const stored=page=>page.evaluate(()=>structuredClone(mock.extensionSettings.naice_shot.imageMarks??{}));
const history=async page=>{await page.locator('[data-tab="history"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="history-more"]')?.textContent.includes('불러오는'));};
const cards=page=>page.locator('#ncs-history [data-view-history]').evaluateAll(els=>els.map(e=>e.dataset.viewHistory));
const closePanel=page=>page.evaluate(()=>document.getElementById('naice-shot-dialog').close());
const reply=async(page,text,type='normal',extra={})=>page.evaluate(([t,type,extra])=>{mock.chat.push({name:'Leo',mes:t,...extra});mock.savedChat=JSON.stringify(mock.chat);mock.renderChat();mock.emit('rendered',mock.chat.length-1,type);return mock.chat.length-1;},[text,type,extra]);
const popup=page=>page.locator('#ncs-tag-pop');
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);

const SCAN=(rootSel)=>{
 const parse=c=>{if(!c)return null;const srgb=c.startsWith('color(');const m=c.replace(/^color\(srgb/,'').match(/[\d.]+/g);if(!m)return null;let [r,g,b,a=1]=m.map(Number);if(srgb){r*=255;g*=255;b*=255;a=c.includes('/')?Number(c.split('/')[1].replace(')','')):1;}return {r,g,b,a};};
 const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
 const ratio=(x,y)=>{const a=lum(x),b=lum(y);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 const behind=el=>{for(let e=el;e;e=e.parentElement){const s=getComputedStyle(e),img=s.backgroundImage;
   if(img&&img!=='none'){if(!img.includes('gradient')||img.includes('url('))return null;const stops=[...img.matchAll(/(?:rgba?|color)\([^)]*\)/g)].map(m=>parse(m[0])).filter(x=>x&&x.a>=.6);if(stops.length)return stops;}
   const c=parse(s.backgroundColor);if(c&&c.a>=.9)return [c];}return [{r:255,g:255,b:255,a:1}];};
 const out=[];
 for(const el of [...document.querySelectorAll(rootSel)].flatMap(r=>[r,...r.querySelectorAll('*')])){
  const pseudo=getComputedStyle(el,'::after').content;const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  if(!own&&!(pseudo&&pseudo!=='none'&&pseudo!=='""'))continue;
  const s=getComputedStyle(el),box=el.getBoundingClientRect();if(!box.width||!box.height||s.visibility==='hidden')continue;
  const check=(color,label)=>{const fg0=parse(color),bgs=behind(el);if(!fg0||!bgs)return;let alpha=fg0.a;for(let e=el;e;e=e.parentElement)alpha*=Number(getComputedStyle(e).opacity);
   const blend=b=>({r:fg0.r*alpha+b.r*(1-alpha),g:fg0.g*alpha+b.g*(1-alpha),b:fg0.b*alpha+b.b*(1-alpha)});
   const worst=Math.min(...bgs.map(b=>ratio(blend(b),b)));if(worst<4.5)out.push(`${worst.toFixed(2)} ${label}`);};
  if(own)check(s.color,`"${el.textContent.trim().slice(0,24)}"`);
  if(pseudo&&pseudo!=='none'&&pseudo!=='""')check(getComputedStyle(el,'::after').color,`::after ${pseudo}`);
 }
 return out;
};
const skins=['classic',...(await fs.readdir(path.join(root,'skins'))).filter(f=>f.endsWith('.css')).map(f=>f.slice(0,-4)).sort()];
const rectOf=(page,sel)=>page.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right};});
const notice=page=>page.locator('#ncs-notice').innerText();
const waitNotice=(page,re)=>page.waitForFunction(src=>new RegExp(src).test(document.querySelector('#ncs-notice').innerText),re.source);
const shot=(page,name)=>process.env.NCS_SHOTS?page.screenshot({path:`${process.env.NCS_SHOTS}/${name}.png`}):null; // optional, for looking
const inChat=(id,where='message')=>page=>page.evaluate(([id,where])=>{const m=mock.chat[1];if(where==='swipe'){m.swipe_id=0;m.swipes=[m.mes,'other'];m.swipe_info=[{},{extra:{naice_shot_images:[{id}]}}];}else m.extra={...(m.extra??{}),naice_shot_images:[{id}]};mock.savedChat=JSON.stringify(mock.chat);mock.renderChat();},[id,where]);

const gate=()=>{let open;const p=new Promise(r=>open=r);p.open=open;return p;};
const OPUS=(percent,purchasedPercent=100,more={})=>({tier:3,active:true,isGracePeriod:false,usage:{percent,purchasedPercent,isNegative:false,timeUntilNextPercent:600,...more},anlas:{subscription:1000,purchased:0}});
const account=async(page,sub)=>{page.sub=sub;await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="refresh-anlas"]').disabled);await page.waitForTimeout(60);};
const verdict=page=>page.locator('#ncs-verdict').innerText(),state=page=>page.locator('#ncs-anlas-box').getAttribute('data-state');
const css=(page,sel,prop)=>page.locator(sel).first().evaluate((e,p)=>getComputedStyle(e)[p],prop);
const varColor=(page,v)=>page.evaluate(v=>{const p=document.createElement('span');p.style.color=`var(${v})`;document.getElementById('naice-shot-dialog').append(p);const c=getComputedStyle(p).color;p.remove();return c;},v);
// A fake server /generate that asks like server 0.1.25 (400; 0.1.24 answered 428, see browser-v0190) while `page.ask` is set, unless the request carries confirmUsage.
const fakeGenerate=async page=>{page.generated=[];
 await page.route('**/api/plugins/naice-shot/generate',r=>{const b=r.request().postDataJSON();page.generated.push(b);
  if(page.ask&&b.confirmUsage!==true){const reply=()=>r.fulfill({status:400,json:{error:page.ask,code:'usage-confirm'}});const g=page.holdAsk;page.holdAsk=null;return g?g.then(reply):reply();} // 400 since server 0.1.25
  return r.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});});};
// Dialogs: everything is accepted except the usage question when page.no is set; every message is kept.
const dialogs=page=>{const asked=[];page.removeAllListeners('dialog');page.on('dialog',d=>{asked.push(d.message());(page.no&&/이번만 생성할까요/.test(d.message()))?d.dismiss():d.accept();});return asked;};
const ready=async page=>{await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled&&document.querySelector('#ncs-progress').hidden);};
const model=async(page,id)=>{const box=page.locator('#ncs-gen-box');if(!await box.evaluate(d=>d.open))await page.locator('#ncs-gen-box > summary').click();await page.locator('[data-gen="model"]').selectOption(id);};
const idle=page=>page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&!document.querySelector('[data-action="generate"]').disabled);

const OLD=FEATURES.filter(f=>f!=='usage-confirm');
const clearNotice=page=>page.evaluate(()=>{document.querySelector('#ncs-notice').textContent='';});
const closeCompat=async page=>{const b=page.locator('[data-action="dismiss-compat"]');if(await b.isVisible())await b.click();};

const press=async page=>{await closeCompat(page);await clearNotice(page);await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent&&!/보내고 있어요/.test(document.querySelector('#ncs-notice').textContent));await idle(page);return notice(page);};
const ASK='V5 사용량이 1% 남았어요. 이번 생성에서 Anlas가 차감될 수 있어요.';
const EDITED=/^기다리는 동안 내용이 바뀌어서 보내지 않았어요\. 바뀐 내용으로 \[이미지 생성\]을 다시 눌러 주세요\.$/;
const noMark=async page=>{assert.equal(await page.locator('#ncs-generation-recover').isHidden(),true,'no 확인 필요 mark');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('naice-shot-pending-generation')??'[]').then(v=>JSON.parse(v).length),0);};

const settle=page=>page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent&&!/보내고 있어요/.test(document.querySelector('#ncs-notice').textContent)).then(()=>idle(page));
const MARKS='naice-shot-pending-generation';
// A /generate route that records the pending marks at the moment of sending (a later route wins over fakeGenerate).
const markingGenerate=async page=>{page.marksAtSend=[];
 await page.route('**/api/plugins/naice-shot/generate',async r=>{const b=r.request().postDataJSON();page.generated.push(b);
  page.marksAtSend.push(await page.evaluate(k=>sessionStorage.getItem(k)??'[]',MARKS));
  if(page.ask&&b.confirmUsage!==true)return r.fulfill({status:400,json:{error:page.ask,code:'usage-confirm'}});
  return r.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});});};

const STATUS_GONE='서버 상태를 확인하지 못해서 생성 요청을 보내지 않았어요. 다시 눌러 주세요.';
// Opens the panel with the first server check failing, so the tab knows no features.
const openBlind=async width=>{const t=await open(width);t.page.quickFail=true;await t.page.reload();
 await t.page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await t.page.locator('.ncs-launch-button').click();await t.page.locator('#naice-shot-dialog[open]').waitFor();return t;};
const openBlindWith=async(width,opts)=>{const t=await open(width,opts);t.page.quickFail=true;await t.page.reload();
 await t.page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await t.page.locator('.ncs-launch-button').click();await t.page.locator('#naice-shot-dialog[open]').waitFor();
 await t.page.waitForFunction(()=>!document.getElementById('ncs-work-fields').disabled);return t;};
const HOLD='서버에 다른 작업이 저장돼 있어서 작업 기억을 잠시 멈췄어요. 지금 편집은 아직 저장되지 않았어요. 채팅을 바꾸면 사라질 수 있어요.';
const LOAD_Q=/^서버에 저장된 마지막 작업을 불러올까요\?/;
const box=page=>page.locator('#ncs-draft-status').innerText(),retry=page=>page.locator('#ncs-draft-retry');
// The two connect buttons: the drawing tab's retry button and Settings' 서버·NAI 연결 확인.
const reconnect=async(page,via)=>{page.quickFail=false;const q=page.quickCalls??0;
 if(via==='retry')await retry(page).evaluate(b=>b.click());else await page.locator('[data-action="status"]').evaluate(b=>b.click());
 for(let i=0;i<80&&(page.quickCalls??0)===q;i++)await page.waitForTimeout(50);
 await page.waitForFunction(()=>!document.getElementById('ncs-work-fields').disabled);await page.waitForTimeout(250);};
const posts=(page,key)=>(page.draftPosts??[]).filter(b=>b.chatKey===key).length;
const mode=async(page,m)=>{await page.locator(`[data-mode="${m}"]`).click();await page.waitForFunction(()=>!document.getElementById('ncs-work-fields').disabled);await page.waitForTimeout(300);};
const asks=asked=>asked.filter(m=>LOAD_Q.test(m)).length;
const LOST=/이전 채팅의 챗샷 편집은 저장되지 않은 채 비워졌어요\./;
const wrote=(page,key,re)=>(page.draftPosts??[]).filter(b=>b.chatKey===key).some(b=>re.test(JSON.stringify(b.work)));
const typeFinal=(page,text)=>page.locator('#ncs-final').evaluate((e,text)=>{e.closest('details').open=true;e.value=JSON.stringify({base:text});e.dispatchEvent(new Event('input',{bubbles:true}));},text);
const DEL_Q=/^서버에 이 작업의 삭제 기록이 있어요\. 화면에 남은 편집도 비울까요\?/;
const DEL_HOLD='서버에 이 작업의 삭제 기록이 있어서 작업 기억을 잠시 멈췄어요. 지금 편집은 아직 저장되지 않았어요. 채팅을 바꾸면 사라질 수 있어요.';
const delAsks=asked=>asked.filter(m=>DEL_Q.test(m)).length;
const RELOAD_Q=/^서버에 저장된 작업을 다시 불러올까요\?/;
const waitWrote=async(page,key,re)=>{for(let i=0;i<50&&!wrote(page,key,re);i++)await page.waitForTimeout(100);return wrote(page,key,re);};
try{
 const made=async(fill)=>{const {page}=await open(375);await fill(page);let before=-1;
  for(let i=0;i<60;i++){await page.waitForTimeout(100);const n=(page.draftPosts??[]).length;if(n&&n===before)break;before=n;}
  await page.waitForTimeout(900);const w=page.lastDraft.work;await page.close();return w;};
 const savedChat=await made(p=>p.locator('#ncs-location').fill('saved harbor'));
 const savedFree=await made(async p=>{await mode(p,'free');await p.locator('#ncs-free-text').fill('saved free text');});
 for(const width of [375,1100]){
  // P2-1 (GPT's case): deleted in another window → this window's save gets 409 → [서버 작업 다시 불러오기] 확인:
  // the screen is emptied (no second question) and nothing is written over the deletion record.
  {const {page,errors,asked}=await open(width);
   await page.locator('#ncs-location').fill('my place');assert.ok(await waitWrote(page,KEY,/my place/),'saved while connected');
   page.draftConflict=true;page.deletedKeys=[KEY];
   await page.locator('#ncs-location').fill('edit after delete');for(let i=0;i<50&&await retry(page).textContent()!=='서버 작업 다시 불러오기';i++)await page.waitForTimeout(100);
   assert.equal(await retry(page).textContent(),'서버 작업 다시 불러오기');
   page.draftConflict=false;const n=posts(page,KEY);
   await retry(page).evaluate(b=>b.click());await page.waitForTimeout(1500);
   assert.equal(asked.filter(m=>RELOAD_Q.test(m)).length,1,'the reload asked once');assert.equal(delAsks(asked),0,'no second question');
   assert.equal(await page.locator('#ncs-location').inputValue(),'','the deleted work is applied: the screen is empty');
   assert.equal(posts(page,KEY),n,'nothing written over the deletion record');
   assert.equal(await box(page),'서버에서 삭제된 작업이라 화면을 비웠어요.');
   await page.locator('#ncs-location').fill('new after delete');assert.ok(await waitWrote(page,KEY,/new after delete/),'a new edit saves');
   assert.equal(page.lastDraft.expectedRevision,'tomb','on the deletion record\'s revision');
   assert.deepEqual(errors,[]);await page.close();}
  // P2-1 (user decision): a connect reads the deletion record while edits are on screen → asked. 취소 keeps the edit and
  // holds (nothing written), 확인 later empties the screen; an empty screen connects without a question.
  {const {page,errors,asked}=await openBlindWith(width,{});page.deletedKeys=[KEY];
   await page.locator('#ncs-location').fill('offline edit');page.refuse=true;
   await reconnect(page,'retry');assert.equal(delAsks(asked),1,'asked on connect');assert.equal(asks(asked),0,'not the load question');
   assert.equal(await page.locator('#ncs-location').inputValue(),'offline edit','취소 keeps the edit');assert.equal(await box(page),DEL_HOLD);
   await page.waitForTimeout(1500);assert.equal(posts(page,KEY),0,'nothing written while held');
   page.refuse=false;await reconnect(page,'status');assert.equal(delAsks(asked),2,'asked again on the next connect');
   assert.equal(await page.locator('#ncs-location').inputValue(),'','확인 empties it');
   await page.waitForTimeout(1500);assert.equal(posts(page,KEY),0,'still nothing written');
   assert.equal(await box(page),'서버에서 삭제된 작업이라 화면을 비웠어요.');
   assert.deepEqual(errors,[]);await page.close();}
  {const {page,errors,asked}=await openBlindWith(width,{});page.deletedKeys=[KEY];
   await reconnect(page,'retry');assert.equal(delAsks(asked)+asks(asked),0,'empty screen: no question');
   await page.locator('#ncs-location').fill('fresh start');assert.ok(await waitWrote(page,KEY,/fresh start/),'connected');
   assert.deepEqual(errors,[]);await page.close();}
  // P2-1: a fresh read that is not a connect ([다시 시도] after a failed read on return) decides the same way.
  {const {page,errors,asked}=await openBlindWith(width,{});
   await page.locator('#ncs-location').fill('chat edit');await mode(page,'free');await reconnect(page,'retry');
   page.draftReadFails=true;page.deletedKeys=[KEY];await mode(page,'chat');
   assert.equal(await page.locator('#ncs-location').inputValue(),'chat edit');
   page.draftReadFails=false;page.refuse=true;await retry(page).evaluate(b=>b.click());await page.waitForTimeout(600);
   assert.equal(delAsks(asked),1,'[다시 시도] asks');assert.equal(await page.locator('#ncs-location').inputValue(),'chat edit','취소 keeps it');
   assert.equal(await box(page),DEL_HOLD);await page.waitForTimeout(1200);assert.equal(posts(page,KEY),0);
   page.refuse=false;await reconnect(page,'retry');assert.equal(delAsks(asked),2);assert.equal(await page.locator('#ncs-location').inputValue(),'');
   assert.equal(posts(page,KEY),0);
   assert.deepEqual(errors,[]);await page.close();}
  // P2-2: chat A's saved work is in the queue, work memory is paused (from 프리샷), a generation starts in A, the chat
  // changes to B and work memory connects there; when A's generation ends, A's saved work is not written.
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[KEY]:savedChat,[FREE]:savedFree};
   await page.route('**/api/plugins/naice-shot/generate',r=>{const b=r.request().postDataJSON();(page.generated??=[]).push(b);
    const reply=()=>r.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});
    const g=page.holdGen;page.holdGen=null;return g?g.then(reply):reply();});
   await mode(page,'free');await page.locator('#ncs-free-text').fill('my free edit');await mode(page,'chat');
   await reconnect(page,'retry');assert.equal(await page.locator('#ncs-location').inputValue(),'saved harbor');
   page.refuse=true;await mode(page,'free');assert.equal(asks(asked),1);assert.equal(await box(page),HOLD);
   page.refuse=false;await mode(page,'chat');await ready(page);
   const g=gate();page.holdGen=g;const before=posts(page,KEY);
   await page.locator('[data-action="generate"]').click();for(let i=0;i<50&&!(page.generated?.length);i++)await page.waitForTimeout(100);
   assert.equal(page.generated.length,1,'sent');
   await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(400);await reconnect(page,'retry');
   g.open();await page.waitForFunction(()=>/생성이 끝났어요/.test(document.querySelector('#ncs-notice').innerText));await page.waitForTimeout(1200);
   assert.equal(posts(page,KEY),before,'A\'s saved work is left alone');
   assert.equal(wrote(page,KEY,new RegExp(page.generated[0].requestId)),false);
   assert.deepEqual(errors,[]);await page.close();}
  // … connected all along: the old chat's saved work still takes the result (0.1.80 behavior kept).
  {const {page,errors}=await open(width);await fakeGenerate(page);
   await page.unroute('**/api/plugins/naice-shot/generate');
   await page.route('**/api/plugins/naice-shot/generate',r=>{const b=r.request().postDataJSON();(page.generated??=[]).push(b);
    const reply=()=>r.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});
    const g=page.holdGen;page.holdGen=null;return g?g.then(reply):reply();});
   await ready(page);await page.waitForTimeout(900);const g=gate();page.holdGen=g;
   await page.locator('[data-action="generate"]').click();for(let i=0;i<50&&!(page.generated?.length);i++)await page.waitForTimeout(100);
   await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(400);
   g.open();await page.waitForFunction(()=>/생성이 끝났어요/.test(document.querySelector('#ncs-notice').innerText));
   assert.ok(await waitWrote(page,KEY,new RegExp(page.generated[0].requestId)),'the result is remembered for A');
   assert.deepEqual(errors,[]);await page.close();}
  // P3: a 챗샷 saved before work memory paused in 프리샷 is not reported as dropped on a chat change.
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[FREE]:savedFree};
   await mode(page,'free');await page.locator('#ncs-free-text').fill('my free edit');await mode(page,'chat');
   await reconnect(page,'retry');await page.locator('#ncs-location').fill('saved chat edit');assert.ok(await waitWrote(page,KEY,/saved chat edit/));
   await page.waitForTimeout(900);
   page.refuse=true;await mode(page,'free');assert.equal(asks(asked),1);assert.equal(await box(page),HOLD);
   await clearNotice(page);await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(1200);
   assert.doesNotMatch(await notice(page),LOST,'saved: not reported as dropped');
   assert.deepEqual(errors,[]);await page.close();}
  // … an edit that was not saved still is (the 0.1.97 case).
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[FREE]:savedFree};
   await mode(page,'free');await page.locator('#ncs-free-text').fill('my free edit');await mode(page,'chat');
   await reconnect(page,'retry');await page.locator('#ncs-location').fill('saved chat edit');assert.ok(await waitWrote(page,KEY,/saved chat edit/));
   page.refuse=true;await mode(page,'free');assert.equal(asks(asked),1);
   await mode(page,'chat');await page.locator('#ncs-location').fill('held chat edit');await mode(page,'free');
   await clearNotice(page);await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(1200);
   assert.match(await notice(page),LOST);
   assert.deepEqual(errors,[]);await page.close();}
  // … and so is an edit whose save failed before the pause (a paused tab reads that work fresh when it connects).
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[FREE]:savedFree};
   await mode(page,'free');await page.locator('#ncs-free-text').fill('my free edit');await mode(page,'chat');
   await reconnect(page,'retry');await page.locator('#ncs-location').fill('saved chat edit');assert.ok(await waitWrote(page,KEY,/saved chat edit/));
   page.draftConflict=true;await page.locator('#ncs-location').fill('refused chat edit');
   for(let i=0;i<50&&await retry(page).textContent()!=='서버 작업 다시 불러오기';i++)await page.waitForTimeout(100);
   page.refuse=true;await mode(page,'free');assert.equal(asks(asked),1);
   await clearNotice(page);await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(1200);page.draftConflict=false;
   assert.match(await notice(page),LOST,'the refused save is told');
   assert.deepEqual(errors,[]);await page.close();}
 }
 console.log('PASS: deletion record — the asked reload empties the screen, a connect or [다시 시도] with edits asks (취소 holds, 확인 empties), nothing written over it; a generation started while paused leaves the old chat\'s saved work alone (connected: still kept); a saved 챗샷 is not reported dropped (375/1100)');
}finally{await browser.close();server.close();}
