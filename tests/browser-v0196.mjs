// v0.1.96: GPT review of 0.1.95. P2-1: work kept in the other mode while work memory was held is compared when its
// mode comes back (not loaded over); 취소 there holds the tab again; a chat change drops only the lost 챗샷 work's mark.
// P2-2: a scene with only unregistered people is work; a screen that cannot be packed (too long) is never replaced.
// P3-1: the listed-message count and a valid final JSON's key order do not count as a difference. P3-2: presses while
// a connect runs share it (one status check, one question). Header copied from browser-v0195 (+ page.draftByKey).
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
   if(!post&&page.draftReply){page.draftReads=(page.draftReads??0)+1;const g=page.draftGates?.shift();const reply=page.draftReply;return (g??Promise.resolve()).then(()=>r.fulfill({json:reply}));}
   if(!post&&page.draftByKey){const k=u.searchParams.get('chatKey');page.draftReads=(page.draftReads??0)+1;const w=page.draftByKey[k]??null;return r.fulfill({json:{revision:w?'saved':null,work:w}});}
   if(post&&!body.delete){(page.draftPosts??=[]).push(body);page.lastDraft=body;if(page.draftConflict)return r.fulfill({status:409,json:{error:'다른 창에서 먼저 저장했어요.'}});}
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
try{
 const made=async(fill)=>{const {page}=await open(375);await fill(page);let before=-1;
  for(let i=0;i<60;i++){await page.waitForTimeout(100);const n=(page.draftPosts??[]).length;if(n&&n===before)break;before=n;}
  await page.waitForTimeout(900);const w=page.lastDraft.work;await page.close();return w;};
 const savedChat=await made(p=>p.locator('#ncs-location').fill('saved harbor'));
 const savedFree=await made(async p=>{await mode(p,'free');await p.locator('#ncs-free-text').fill('saved free text');});
 assert.equal(savedChat.scene.location,'saved harbor');assert.equal(savedFree.freeText,'saved free text');
 for(const width of [375,1100]){
  // P2-1, 챗샷 held: 취소 in 챗샷, connect in 프리샷 (nothing saved there), back to 챗샷 → compared and asked, not loaded.
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[KEY]:savedChat};page.refuse=true;
   await page.locator('#ncs-location').fill('my new place');await reconnect(page,'retry');assert.equal(asks(asked),1);assert.equal(await box(page),HOLD);
   await mode(page,'free');await reconnect(page,'retry');assert.equal(asks(asked),1,'프리샷: nothing saved, no question');
   await mode(page,'chat');assert.equal(asks(asked),2,'back in 챗샷: asked');
   assert.equal(await page.locator('#ncs-location').inputValue(),'my new place','취소: the edit stays');assert.equal(await box(page),HOLD,'취소: the tab is held again');
   await page.waitForTimeout(1500);assert.equal(posts(page,KEY),0,'nothing written for 챗샷');
   page.refuse=false;await reconnect(page,'retry');assert.equal(asks(asked),3);assert.equal(await page.locator('#ncs-location').inputValue(),'saved harbor','확인 loads it');
   assert.deepEqual(errors,[]);await page.close();}
  // P2-1, 프리샷 held: the same the other way, 확인 on return loads the saved 프리샷 work.
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[FREE]:savedFree};page.refuse=true;
   await mode(page,'free');await page.locator('#ncs-free-text').fill('my free edit');await reconnect(page,'retry');assert.equal(asks(asked),1);
   await mode(page,'chat');await reconnect(page,'status');assert.equal(asks(asked),1,'챗샷: nothing saved, no question');
   page.refuse=false;await mode(page,'free');assert.equal(asks(asked),2,'back in 프리샷: asked');
   assert.equal(await page.locator('#ncs-free-text').evaluate(e=>e.value),'saved free text','확인 loads it');assert.equal(posts(page,FREE),0);
   assert.deepEqual(errors,[]);await page.close();}
  // A chat change: in 프리샷 the old chat's 챗샷 work is gone, so its mark goes (the next chat loads as usual) …
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[KEY]:savedChat,[OTHER]:savedChat};page.refuse=true;
   await page.locator('#ncs-location').fill('my new place');await reconnect(page,'retry');
   await mode(page,'free');await reconnect(page,'retry');await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(400);
   await mode(page,'chat');assert.equal(asks(asked),1,'the new chat: no question');assert.equal(await page.locator('#ncs-location').inputValue(),'saved harbor');
   assert.deepEqual(errors,[]);await page.close();}
  // … while in 챗샷 the 프리샷 work stays, and so does its mark.
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[FREE]:savedFree};page.refuse=true;
   await mode(page,'free');await page.locator('#ncs-free-text').fill('my free edit');await reconnect(page,'retry');
   await mode(page,'chat');await reconnect(page,'retry');await page.evaluate(()=>mock.switchChat('B'));await page.waitForTimeout(600);
   await mode(page,'free');assert.equal(asks(asked),2,'프리샷 after a chat change: still asked');
   assert.equal(await page.locator('#ncs-free-text').evaluate(e=>e.value),'my free edit');assert.equal(posts(page,FREE),0);
   assert.deepEqual(errors,[]);await page.close();}
  // P2-2: only unregistered people extracted → work, asked.
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[KEY]:savedChat};page.refuse=true;
   await page.evaluate(()=>{mock.extraction={characters:[],unregistered:['a tall visitor'],location:'',lighting:'',camera:'',interaction:''};});
   await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&!document.querySelector('[data-action="extract"]').disabled);
   assert.match(await page.locator('#naice-shot-dialog').innerText(),/a tall visitor/,'extracted');
   await reconnect(page,'retry');assert.equal(asks(asked),1,'unregistered-only work: asked');
   assert.match(await page.locator('#naice-shot-dialog').innerText(),/a tall visitor/,'the extracted person stays');assert.equal(await box(page),HOLD);
   assert.deepEqual(errors,[]);await page.close();}
  // P2-2: a place too long to save: with a saved copy → held, screen kept; with none → connected, the save error shows.
  for(const withSaved of [true,false]){
   const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey=withSaved?{[KEY]:savedChat}:{};
   const long='x'.repeat(200001);await page.locator('#ncs-location').evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},long);
   await reconnect(page,'retry');assert.equal(asks(asked),0,'no question');
   assert.equal((await page.locator('#ncs-location').inputValue()).length,200001,'the screen stays');
   if(withSaved){assert.match(await box(page),/^지금 작업을 확인하지 못해서 작업 기억을 잠시 멈췄어요\(작업 내용이 너무 길어요\)\. 지금 편집은 아직 저장되지 않았어요\./);
    assert.equal(await retry(page).innerText(),'작업 기억 다시 연결');}
   else assert.match(await box(page),/작업 저장을 확인해 주세요: 작업 내용이 너무 길어요/);
   assert.equal(posts(page,KEY),0);assert.deepEqual(errors,[]);await page.close();}
  // P3-1: [더 보기] in the target list, or a valid final JSON with keys in another order, is the same work.
  {const sameWork=await made(p=>p.locator('#ncs-location').fill('my new place'));
   const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[KEY]:sameWork};
   await page.evaluate(()=>{for(let i=0;i<14;i++)mock.chat.push({name:i%2?'Leo':'Mira',mes:`line ${i}`});mock.savedChat=JSON.stringify(mock.chat);mock.renderChat();});
   await page.locator('#ncs-location').fill('my new place');
   await page.locator('#ncs-target-picker > summary').click();const more=page.locator('#ncs-target-picker [data-action="target-more"]');
   if(await more.count())await more.click();await page.locator('#ncs-target-picker > summary').click();
   await reconnect(page,'retry');assert.equal(asks(asked),0,'[더 보기] only: no question');assert.notEqual(await box(page),HOLD);
   assert.deepEqual(errors,[]);await page.close();}
  {const typeFinal=(page,reverse)=>page.locator('#ncs-final').evaluate((e,reverse)=>{e.closest('details').open=true;const v=JSON.parse(e.value||'{}');const o=reverse?Object.fromEntries(Object.entries(v).reverse()):v;e.value=JSON.stringify(o,null,reverse?1:2);e.dispatchEvent(new Event('input',{bubbles:true}));},reverse);
   const finalWork=await made(async p=>{await p.locator('#ncs-location').fill('my new place');await typeFinal(p,false);});
   assert.ok(finalWork.finalOverride,'the saved work has an edited final prompt');
   const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[KEY]:finalWork};
   await page.locator('#ncs-location').fill('my new place');await typeFinal(page,true);
   assert.notEqual(await page.locator('#ncs-final').inputValue(),finalWork.finalText,'typed differently');
   await reconnect(page,'retry');assert.equal(asks(asked),0,'same JSON, other key order: no question');
   // An invalid JSON is compared as typed: asked.
   await page.close();
   const t=await openBlindWith(width,{});t.page.draftByKey={[KEY]:finalWork};t.page.refuse=true;
   await t.page.locator('#ncs-location').fill('my new place');await typeFinal(t.page,false);
   await t.page.locator('#ncs-final').evaluate(e=>{e.value=e.value.slice(0,-1);e.dispatchEvent(new Event('input',{bubbles:true}));});
   await reconnect(t.page,'retry');assert.equal(asks(t.asked),1,'an invalid JSON differs');assert.equal(await t.page.locator('#ncs-final').inputValue(),finalWork.finalText.slice(0,-1),'kept as typed');
   assert.deepEqual(errors,[]);assert.deepEqual(t.errors,[]);await t.page.close();}
  // P3-2: presses during a connect share it — one status check, one question; a press after it ends tries again.
  {const {page,errors,asked}=await openBlindWith(width,{});page.draftByKey={[KEY]:savedChat};page.refuse=true;
   await page.locator('#ncs-location').fill('my new place');page.quickFail=false;
   const g=gate();page.quickHolds=[{gate:g,json:{keyConfigured:true,version:'0.1.25',features:FEATURES,minClient:'0.1.90'}}];const q=page.quickCalls??0;
   await retry(page).evaluate(b=>b.click());await page.waitForTimeout(150);await page.locator('[data-action="status"]').evaluate(b=>b.click());await retry(page).evaluate(b=>b.click());await page.waitForTimeout(150);
   g.open();for(let i=0;i<60&&asks(asked)<1;i++)await page.waitForTimeout(100);await page.waitForTimeout(800);
   assert.equal((page.quickCalls??0)-q,1,'one status check');assert.equal(asks(asked),1,'one question');assert.equal(await box(page),HOLD);
   await reconnect(page,'retry');assert.equal(asks(asked),2,'a later press asks again');
   assert.deepEqual(errors,[]);await page.close();}
 }
 console.log('PASS: work kept in the other mode while held is compared on return (both ways), 취소 holds the tab again, a chat change drops only the lost 챗샷 mark; unregistered-only work asks; a too-long screen is kept (held with a saved copy, save error without); [더 보기] and a reordered valid final JSON are the same work, an invalid one differs; presses during a connect share one status check and one question (375/1100)');
}finally{await browser.close();server.close();}
