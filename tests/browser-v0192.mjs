// v0.1.92: GPT review of 0.1.91. User decision A: Opus V5 goes only to server 0.1.25+, checked with a fresh status
// answer right before each V5 press (switch on or off, a tab left open while the server goes back, an unreachable
// server). What a press sends is fixed when it is pressed and compared again after every wait (server check, the
// saving check, the usage question): a settings change (like a backup import), a reloaded server work or an edit stops
// it; an extraction setting does not. Header copied from browser-v0191 (+ page.draftConflict, statusFail, holdStatus).
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
  if(u.pathname.endsWith('/generation')&&u.searchParams.has('chatKey')&&page.holdPending){const g=page.holdPending;page.holdPending=null;return g.then(()=>r.fulfill({json:{pending:[]}}));}
  if(u.pathname.endsWith('/generation'))return r.fulfill({json:u.searchParams.has('chatKey')?{pending:[]}:(page.generationReply??{state:'unknown'})});
  if(u.pathname.endsWith('/draft')){
   if(post&&body.delete&&page.loseDraftDelete)return r.abort();
   if(post&&body.delete&&page.holdDraftDelete){const gate=page.holdDraftDelete;page.holdDraftDelete=null;return gate.then(()=>r.fulfill({json:{deleted:1}}));}
   if(!post&&page.draftReadFails)return r.abort();
   if(!post&&page.draftReply){page.draftReads=(page.draftReads??0)+1;const g=page.draftGates?.shift();const reply=page.draftReply;return (g??Promise.resolve()).then(()=>r.fulfill({json:reply}));}
   if(post&&!body.delete){page.lastDraft=body;if(page.draftConflict)return r.fulfill({status:409,json:{error:'다른 창에서 먼저 저장했어요.'}});}
   return r.fulfill({json:post?{revision:'r'}:{revision:draft?'saved':null,work:draft}});}
  }
  page.statusCalls=(page.statusCalls??0)+1;if(page.statusFail)return r.abort();if(page.holdStatus){const g=page.holdStatus;page.holdStatus=null;return g.then(()=>r.fulfill({json:{keyConfigured:true,version:page.version??version,features:page.features??features,minClient:'0.1.90'}}));}
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
try{
 for(const width of [375,1100]){
  // Server 0.1.24 (it has usage-confirm), switch OFF, 82 %: the update notice and no /generate at all (a banner alone
  // would have let it go). The same with the switch on. V4.5 still goes.
  {const {page,errors}=await open(width,{version:'0.1.24'});dialogs(page);await fakeGenerate(page);
   await page.locator('#ncs-allow-anlas').uncheck();await account(page,OPUS(82));await ready(page);
   assert.match(await press(page),/^서버 플러그인이 이전 버전이라 V5 생성을 보내지 않았어요\. 서버 플러그인을 0\.1\.25 이상으로/);
   assert.equal(page.generated.length,0,'0.1.24 + switch off: nothing sent');await noMark(page);
   await page.locator('#ncs-allow-anlas').check();assert.match(await press(page),/이전 버전이라 V5 생성을 보내지 않았어요/);assert.equal(page.generated.length,0);
   await model(page,'nai-diffusion-4-5-full');assert.match(await press(page),/^생성했어요/);assert.equal(page.generated.length,1);
   assert.deepEqual(errors,[]);await page.close();}
  // A tab left open: 0.1.25 first (sent), then the server goes back to 0.1.23 — the next V5 press checks again and
  // stops, switch on or off. An unreachable server stops it too, with its own words.
  {const {page,errors}=await open(width);dialogs(page);await fakeGenerate(page);
   await account(page,OPUS(82));await ready(page);assert.match(await press(page),/^생성했어요/);assert.equal(page.generated.length,1);
   page.version='0.1.23';page.features=OLD;
   for(const on of [true,false]){await page.locator('#ncs-allow-anlas').setChecked(on);
    assert.match(await press(page),/이전 버전이라 V5 생성을 보내지 않았어요/,String(on));assert.equal(page.generated.length,1,`went back, switch ${on}`);}
   page.version=null;page.features=null;page.statusFail=true;
   assert.equal(await press(page),'서버 플러그인 버전을 확인하지 못해서 V5 생성을 보내지 않았어요. 서버 연결을 확인하고 다시 눌러 주세요.');assert.equal(page.generated.length,1);await noMark(page);
   page.statusFail=false;assert.match(await press(page),/^생성했어요/);assert.equal(page.generated.length,2);
   assert.deepEqual(errors,[]);await page.close();}
  // During the server check: the switch turned off (as a backup import does) or the place edited → stopped, nothing
  // sent; an extraction setting changed → sent as pressed.
  {const {page,errors}=await open(width);dialogs(page);await fakeGenerate(page);
   await page.locator('#ncs-allow-anlas').check();await account(page,OPUS(82));await ready(page);
   const during=async(change)=>{const g=gate();page.holdStatus=g;await closeCompat(page);await clearNotice(page);await page.locator('[data-action="generate"]').click();
    await page.waitForTimeout(150);await change();g.open();await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent&&!/보내고 있어요/.test(document.querySelector('#ncs-notice').textContent));await idle(page);return notice(page);};
   assert.match(await during(()=>page.locator('#ncs-allow-anlas').uncheck()),EDITED);assert.equal(page.generated.length,0,'switch changed');await noMark(page);
   assert.match(await during(()=>page.locator('#ncs-location').fill('quiet pier')),EDITED);assert.equal(page.generated.length,0,'place changed');
   const max=page.locator('#ncs-extraction-max-tokens');
   assert.match(await during(async()=>{await max.evaluate(e=>{e.value=String(Number(e.value)+100);e.dispatchEvent(new Event('input',{bubbles:true}));});}),/^생성했어요/);
   assert.equal(page.generated.length,1,'an extraction setting is not part of the request');assert.match(JSON.stringify(page.generated[0].assembled),/quiet pier/);
   assert.equal(page.generated[0].allowAnlas,false,'sent with the switch as it is now');
   // The same during the saving check (/generation?chatKey) that comes after it.
   const pendingWait=async(change)=>{const g=gate();page.holdPending=g;await clearNotice(page);await page.locator('[data-action="generate"]').click();
    await page.waitForTimeout(150);await change();g.open();await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent&&!/보내고 있어요/.test(document.querySelector('#ncs-notice').textContent));await idle(page);return notice(page);};
   assert.match(await pendingWait(()=>page.locator('#ncs-location').fill('windy cliff')),EDITED);assert.equal(page.generated.length,1,'edited during the saving check');
   assert.match(await pendingWait(()=>max.evaluate(e=>{e.value=String(Number(e.value)-100);e.dispatchEvent(new Event('input',{bubbles:true}));})),/^생성했어요/);
   assert.equal(page.generated.length,2);assert.match(JSON.stringify(page.generated[1].assembled),/windy cliff/);
   assert.deepEqual(errors,[]);await page.close();}
  // An earlier request still unconfirmed (no saving check then): the server check alone must catch an edit.
  {const {page,errors}=await open(width,{pending:[[KEY,uid(99)]]});const asked=dialogs(page);await fakeGenerate(page);
   await account(page,OPUS(82));await ready(page);
   const g=gate();page.holdStatus=g;await closeCompat(page);await clearNotice(page);await page.locator('[data-action="generate"]').click();
   await page.waitForTimeout(150);await page.locator('#ncs-location').fill('stone bridge');g.open();
   await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent&&!/보내고 있어요/.test(document.querySelector('#ncs-notice').textContent));await idle(page);
   assert.match(await notice(page),EDITED);assert.equal(page.generated.length,0,'edited during the server check, no saving check after it');
   assert.ok(!asked.some(m=>/이전 요청의 결과/.test(m)),'stopped before the earlier-request question');
   assert.deepEqual(errors,[]);await page.close();}
  // During the usage question's first try: an extraction setting changed → asked and sent (once more, same body plus
  // confirmUsage); the server work reloaded with another place → not asked, not sent again.
  {const {page,errors}=await open(width);const asked=dialogs(page);await fakeGenerate(page);
   await account(page,OPUS(1));await ready(page);page.ask=ASK;
   const g=gate();page.holdAsk=g;await clearNotice(page);await page.locator('[data-action="generate"]').click();await page.waitForTimeout(200);
   const max=page.locator('#ncs-extraction-max-tokens');await max.evaluate(e=>{e.value=String(Number(e.value)+100);e.dispatchEvent(new Event('input',{bubbles:true}));});g.open();
   await waitNotice(page,/^생성했어요/);assert.equal(page.generated.length,2);assert.equal(asked.filter(m=>/이번만/.test(m)).length,1);
   const [first,second]=page.generated;assert.deepEqual({...second,confirmUsage:undefined},{...first,confirmUsage:undefined},'the first body again');assert.equal(second.confirmUsage,true);
   // Reload the server work while the first try waits (the save conflicted, [서버 작업 다시 불러오기]).
   page.draftConflict=true;await page.locator('#ncs-location').fill('local place');
   await page.waitForFunction(()=>!document.querySelector('#ncs-draft-retry').hidden);
   const saved=page.lastDraft.work;page.draftReply={revision:'other',work:{...saved,scene:{...saved.scene,location:'reloaded harbor'}}};
   const g2=gate();page.holdAsk=g2;const n=asked.length;await clearNotice(page);await page.locator('[data-action="generate"]').click();await page.waitForTimeout(200);
   assert.equal(page.generated.length,3);page.draftConflict=false;
   await page.locator('#ncs-draft-retry').evaluate(b=>b.click()); // the progress banner covers it here; a person scrolls
   await page.waitForFunction(()=>document.querySelector('#ncs-location').value==='reloaded harbor');g2.open();
   await waitNotice(page,EDITED);await idle(page);
   assert.equal(page.generated.length,3,'the old place is not sent again');assert.ok(!asked.slice(n).some(m=>/이번만/.test(m)),'not asked about the old place');await noMark(page);
   assert.deepEqual(errors,[]);await page.close();}
 }
 console.log('PASS: Opus V5 only to server 0.1.25+ with a fresh check (0.1.24 switch off/on: notice, no /generate; a tab left open while the server goes back to 0.1.23; unreachable server), V4.5 still goes; the switch turned off or the place edited during the server check or the saving check stops it, an extraction setting does not; during the usage question an extraction setting passes (same body + confirmUsage) and a reloaded server work stops it (375/1100)');
}finally{await browser.close();server.close();}
