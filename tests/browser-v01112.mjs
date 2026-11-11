// v0.1.112: GPT review of 0.1.111. A long history refresh is read in pieces of 100; a picture deleted or made between the
// pieces moved what offset 100 pointed at (a deleted card kept and one missing, or a new one missing). Now a changed total
// reads the list again once from the start, and if it changes again only the first piece is shown. The enlarged view
// does not fetch the next picture when the browser asks to save data.
import zlib from 'node:zlib';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {pick,reveal} from './menu-helper.mjs';
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
const HIST_ONLY='생성이 끝났어요. 그사이 작업이 바뀌어서 결과는 이력에만 남겼어요.';
const FAILED=/이전 채팅의 챗샷 편집은 서버에 저장되지 않았어요\./;
const holdingGenerate=page=>page.route('**/api/plugins/naice-shot/generate',r=>{const b=r.request().postDataJSON();(page.generated??=[]).push(b);
 const reply=()=>r.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});
 const g=page.holdGen;page.holdGen=null;return g?g.then(reply):reply();});
const pressGen=async page=>{const g=gate();page.holdGen=g;await page.locator('[data-action="generate"]').click();
 for(let i=0;i<50&&!(page.generated?.length);i++)await page.waitForTimeout(100);assert.equal(page.generated?.length,1,'sent');return {g};}; // not the promise itself: an async function would wait on it
const ended=async(page,re)=>{await page.waitForFunction(re=>new RegExp(re).test(document.querySelector('#ncs-notice').innerText),re,{timeout:15000}).catch(async e=>{throw new Error('notice: '+await notice(page));});await page.waitForTimeout(1500);};
const shown=page=>page.locator('#ncs-result img').count();
const reloadBtn=async page=>{for(let i=0;i<50&&await retry(page).textContent()!=='서버 작업 다시 불러오기';i++)await page.waitForTimeout(100);assert.equal(await retry(page).textContent(),'서버 작업 다시 불러오기');};
const checkHeld=page=>page.route('**/api/plugins/naice-shot/generation?requestId=*',r=>{const g=page.holdCheck;page.holdCheck=null;
 const reply=()=>r.fulfill({json:page.generationReply??{state:'unknown'}});return g?g.then(reply):reply();});
const pressCheck=async page=>{const g=gate();page.holdCheck=g;await clearNotice(page);await page.locator('[data-action="generation-check"]').evaluate(b=>b.click());await page.waitForTimeout(400);return {g};};
const CHECKED=/같은 요청의 그림을 불러왔어요|이력에만 남겼어요/;
// Chat B whose first read fails: the queue entry for B stays unread and [다시 시도] shows.
const unreadB=async page=>{page.draftReadFails=true;await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(700);
 assert.equal(await retry(page).textContent(),'다시 시도','read failed');page.draftReadFails=false;};
const clearBtn=page=>page.locator('.ncs-clear-slot .ncs-action-slot');
const offWhile=async(page,label)=>{assert.equal(await clearBtn(page).isDisabled(),true,`${label}: clear off`);
 await clearBtn(page).evaluate(b=>b.click());await page.waitForTimeout(300);
 assert.equal(await page.locator('#ncs-location').inputValue(),'my place',`${label}: not emptied`);};
// SillyTavern's own rule for code (public/style.css), with its variables written out.
const ST_CODE='code{font-family:monospace;white-space:pre-wrap;border:1px solid rgb(0,200,0);border-radius:5px;background-color:rgba(0,0,0,.7);padding:0 3px;line-height:16px;color:rgba(255,255,255,.7);}';
const SKINS=[null,...(await fs.readdir(new URL("../skins/",import.meta.url))).filter(f=>f.endsWith('.css')).map(f=>f.slice(0,-4))];
const contrastOf=(page,sel,i=0)=>page.evaluate(([sel,i])=>{
 const parse=c=>{const m=c.match(/[\d.]+/g).map(Number);if(c.startsWith('color(srgb'))return [m[0]*255,m[1]*255,m[2]*255,m[3]??1];return [m[0],m[1],m[2],m[3]??1];};
 const over=(top,under)=>[0,1,2].map(k=>top[k]*top[3]+under[k]*(1-top[3])).concat(1);
 const bgAt=e=>{const stack=[];for(let n=e;n;n=n.parentElement){const b=parse(getComputedStyle(n).backgroundColor);if(b[3]>0)stack.push(b);if(b[3]>=1)break;}
  let c=[20,20,20,1];for(const b of stack.reverse())c=over(b,c);return c;};
 const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);};
 const e=document.querySelectorAll(sel)[i],bg=bgAt(e),fg=over(parse(getComputedStyle(e).color),bg),a=lum(fg),b=lum(bg);
 return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);},[sel,i]);
// SillyTavern dims every small (public/style.css: small{opacity:.7}).
const ST_SMALL='small{opacity:.7}';
const id8=n=>`${String(n).padStart(8,'0')}-aaaa-4bbb-8ccc-${String(n).padStart(12,'0')}`;
const many=n=>({...pic(n),id:id8(n),image:`/user/images/naice-shot/${id8(n)}.png`,seed:n});
const nCards=page=>page.evaluate(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length);
async function grow(page,to){
 while(await nCards(page)<to){const n=await nCards(page);await page.locator('[data-action="history-more"]').evaluate(b=>b.click());await page.waitForFunction(n=>document.querySelectorAll('#ncs-history .ncs-history-card').length>n,n);}
}
const until=async(f,label,ms=8000)=>{const end=Date.now()+ms;for(;;){if(await f())return;if(Date.now()>end)throw new Error(`timed out: ${label}`);await new Promise(r=>setTimeout(r,60));}};
// The server's history list for one chat, answered here so a test can change it between two reads.
async function serve(page,list){
 const reads=[];
 await page.route('**/api/plugins/naice-shot/history?*',async r=>{
  if(r.request().method()!=='GET')return r.fallback();
  const q=new URL(r.request().url()).searchParams,offset=Number(q.get('offset')),limit=Number(q.get('limit'));
  if(q.get('chatKey')!==KEY)return r.fallback();
  await page.beforeRead?.(offset,limit);reads.push([offset,limit]);
  const sorted=[...list].sort((a,b)=>b.created.localeCompare(a.created));
  return r.fulfill({json:{items:sorted.slice(offset,offset+limit),total:sorted.length,hasMore:offset+limit<sorted.length,pending:[],pendingBytes:0}});
 });
 return reads;
}
const ids=page=>page.locator('#ncs-history [data-view-history]').evaluateAll(els=>els.map(e=>e.dataset.viewHistory));
const want=list=>[...list].sort((a,b)=>b.created.localeCompare(a.created)).map(x=>x.id);
async function refresh(page){ // another tab and back: the history tab reads its list again
 await page.locator('[data-tab="scene"]').click();await page.locator('[data-tab="history"]').click();
 await until(async()=>!(await page.evaluate(()=>document.querySelector('[data-action="history-more"]')?.textContent.includes('불러오는'))),'refresh');
 await page.waitForTimeout(200);
}
try{
 for(const width of [375,1100]){
  // Deleted between the pieces (the newest picture): read again, 120 cards, none deleted, none missing.
  {const list=Array.from({length:300},(_,i)=>many(i+1));const {page,errors}=await open(width,{height:800});const reads=await serve(page,list);
   await history(page);await grow(page,120);reads.length=0;
   page.beforeRead=(offset)=>{if(offset===100&&!page.done){page.done=true;list.splice(list.findIndex(x=>x.id===id8(300)),1);}};
   await refresh(page);
   assert.deepEqual(await ids(page),want(list).slice(0,120),`${width}px: deleted in between → the current first 120`);
   assert.deepEqual(reads,[[0,100],[100,20],[0,100],[100,20]],'read again once from the start');
   assert.match(await page.locator('#ncs-history-count').textContent(),/총 299장 · 120장 표시/);
   assert.deepEqual(errors,[]);await page.close();}
  // Made between the pieces: the new one is first, 120 cards.
  {const list=Array.from({length:300},(_,i)=>many(i+1));const {page,errors}=await open(width,{height:800});const reads=await serve(page,list);
   await history(page);await grow(page,120);reads.length=0;
   page.beforeRead=(offset)=>{if(offset===100&&!page.done){page.done=true;list.push(many(301));}};
   await refresh(page);
   const shown=await ids(page);assert.equal(shown.length,120);assert.equal(shown[0],id8(301),'the new picture is there');
   assert.deepEqual(shown,want(list).slice(0,120));
   assert.deepEqual(errors,[]);await page.close();}
  // Changed again during the second read: only that read's first piece (100 in a row, no gap), with 더 보기 still there.
  {const list=Array.from({length:300},(_,i)=>many(i+1));const {page,errors}=await open(width,{height:800});const reads=await serve(page,list);
   await history(page);await grow(page,120);reads.length=0;let n=0,second=null;
   page.beforeRead=(offset)=>{if(offset===0&&n===1)second=want(list).slice(0,100);if(offset===100&&n<2){n++;list.push(many(400+n));}};
   await refresh(page);
   assert.deepEqual(await ids(page),second,`${width}px: changed twice → the first 100 of the second read only`);
   assert.deepEqual(reads,[[0,100],[100,20],[0,100],[100,20]]);
   assert.equal(await page.locator('[data-action="history-more"]').isVisible(),true,'더 보기 goes on from there');
   assert.deepEqual(errors,[]);await page.close();}
  // Nothing changes: the same reads as 0.1.111 (100 + 20), once.
  {const list=Array.from({length:300},(_,i)=>many(i+1));const {page,errors}=await open(width,{height:800});const reads=await serve(page,list);
   await history(page);await grow(page,120);reads.length=0;await refresh(page);
   assert.deepEqual(reads,[[0,100],[100,20]]);assert.deepEqual(await ids(page),want(list).slice(0,120));
   assert.deepEqual(errors,[]);await page.close();}
 }
 console.log('PASS: a list that changes between pieces is read again, never shown mixed');
 // Save-Data: no picture fetched ahead; without it, one ahead as in 0.1.111.
 for(const save of [true,false]){
  const list=Array.from({length:300},(_,i)=>many(i+1));const {page,errors}=await open(375,{height:800});await serve(page,list);
  if(save)await page.evaluate(()=>Object.defineProperty(navigator,'connection',{configurable:true,get:()=>({saveData:true})}));
  const got=new Set();page.on('request',r=>{const m=r.url().match(/naice-shot\/([0-9a-f-]{36})\.png/);if(m)got.add(m[1]);});
  await history(page);await grow(page,120);
  await page.locator('#ncs-history [data-view-history]').nth(119).evaluate(b=>b.click());await page.waitForFunction(()=>document.getElementById('ncs-viewer')?.open);
  if(save){await page.waitForTimeout(1200);assert.equal(got.has(id8(180)),false,'save-data: nothing fetched ahead');
   await page.locator('#ncs-viewer [data-v="next"]').click();await until(()=>page.evaluate(n=>document.getElementById('ncs-viewer').dataset.loaded.includes(n),id8(180)),'› still works');
   await page.waitForTimeout(800);assert.equal(got.has(id8(179)),false,'still nothing ahead');}
  else await until(()=>got.has(id8(180)),'one ahead without save-data');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: no fetching ahead with Save-Data');
}finally{await browser.close();server.close();}
