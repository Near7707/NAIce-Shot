// v0.1.90: the new V5 rule (user decision, server 0.1.24): above 1 % of base usage Opus V5 is sent without the
// Anlas switch; at 1 % or 0 %, when usage cannot be used or is unknown, the server asks for this one request
// (428 usage-confirm, before anything reaches NovelAI) and the panel asks with a confirm, then sends the same request
// once more. Account box: 24-hour time, bold labels, (+N%) coloured, NovelAI link for every model, a line in place of
// the switch, orange "ask" with warning words, number colour not red on the red skins. Header copied from browser-v0189.
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
async function open(width,{seed=[],features=FEATURES,marks=null,pending=null,broken=[],draft=null,skin=null,height=900,touch=false}={}){
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
  if(u.pathname.endsWith('/generation'))return r.fulfill({json:u.searchParams.has('chatKey')?{pending:[]}:(page.generationReply??{state:'unknown'})});
  if(u.pathname.endsWith('/draft')){
   if(post&&body.delete&&page.loseDraftDelete)return r.abort();
   if(post&&body.delete&&page.holdDraftDelete){const gate=page.holdDraftDelete;page.holdDraftDelete=null;return gate.then(()=>r.fulfill({json:{deleted:1}}));}
   if(!post&&page.draftReadFails)return r.abort();
   if(!post&&page.draftReply){page.draftReads=(page.draftReads??0)+1;const g=page.draftGates?.shift();const reply=page.draftReply;return (g??Promise.resolve()).then(()=>r.fulfill({json:reply}));}
   return r.fulfill({json:post?{revision:'r'}:{revision:draft?'saved':null,work:draft}});}
  }
  return r.fulfill({json:{keyConfigured:true,version:'0.1.25',features,minClient:'0.1.44',subscription:page.sub??{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},anlas:{subscription:1000,purchased:0}}}});
 });
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
// A fake server /generate that asks like server 0.1.24 while `page.ask` is set, unless the request carries confirmUsage.
const fakeGenerate=async page=>{page.generated=[];
 await page.route('**/api/plugins/naice-shot/generate',r=>{const b=r.request().postDataJSON();page.generated.push(b);
  if(page.ask&&b.confirmUsage!==true)return r.fulfill({status:428,json:{error:page.ask,code:'usage-confirm'}});
  return r.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});});};
// Dialogs: everything is accepted except the usage question when page.no is set; every message is kept.
const dialogs=page=>{const asked=[];page.removeAllListeners('dialog');page.on('dialog',d=>{asked.push(d.message());(page.no&&/이번만 생성할까요/.test(d.message()))?d.dismiss():d.accept();});return asked;};
const ready=async page=>{await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled&&document.querySelector('#ncs-progress').hidden);};
const model=async(page,id)=>{const box=page.locator('#ncs-gen-box');if(!await box.evaluate(d=>d.open))await page.locator('#ncs-gen-box > summary').click();await page.locator('[data-gen="model"]').selectOption(id);};
const idle=page=>page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden&&!document.querySelector('[data-action="generate"]').disabled);
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width);const asked=dialogs(page);await fakeGenerate(page);
  await page.locator('#ncs-allow-anlas').uncheck();
  // The switch's own words say V5 no longer needs it.
  assert.match(await page.locator('#ncs-allow-anlas').evaluate(e=>e.closest('label').nextElementSibling.querySelector(':scope > p:not(.ncs-help-short)').textContent),/^Tablet·Scroll, 구독 확인이 안 될 때처럼 Anlas를 쓰는 생성에 필요해요\. 한 번 켜면 유지돼요\. Opus V5는 기본 사용량이 2% 이상이고 지금 쓸 수 있으면 이 설정 없이 생성하고, 1% 이하이거나 사용량을 확인 못 함·지금 쓸 수 없음이면 생성할 때마다 따로 물어봐요\./);
  // 100 % (+100 %): green, the line in place of the switch, no switch by the box.
  await account(page,OPUS(100));
  assert.equal(await verdict(page),'Opus · V5 남은 사용량으로 생성');assert.equal(await state(page),'ok');
  assert.equal(await page.locator('#ncs-usage-note').innerText(),'확인한 사용량 기준으로 V5 사용량으로 생성해요.');
  assert.equal(await page.locator('.ncs-consent-row').evaluate(r=>[...r.children].every(c=>c.hidden)),true,'no switch by the box');
  const line=await page.locator('#ncs-anlas-balance').innerText();
  assert.match(line,/^Anlas 1,000 · V5 100% \(\+100%\) · \d{2}:\d{2} 확인$/,'24-hour time');assert.doesNotMatch(line,/오전|오후/);
  assert.equal(await css(page,'#ncs-anlas-balance .ncs-anlas-label','fontWeight'),'700');
  const num=await css(page,'#ncs-anlas-balance b','color');
  assert.equal(await css(page,'#ncs-anlas-balance .ncs-v5-extra','color'),num,'(+N%) in the number colour');assert.equal(num,await varColor(page,'--ncs-accent-text'));
  await page.locator('[data-action="toggle-account"]').click();assert.equal(await page.locator('#ncs-cost-link').isVisible(),true);
  // V4.5 free: the NovelAI link shows too.
  await model(page,'nai-diffusion-4-5-full');
  await page.waitForFunction(()=>/V4\.5 무료/.test(document.querySelector('#ncs-verdict').textContent));
  assert.equal(await page.locator('#ncs-cost-link').isVisible(),true,'link for V4.5 as well');assert.equal(await page.locator('#ncs-usage-note').isHidden(),true);
  await model(page,'nai-diffusion-5-full');
  await page.waitForFunction(()=>/V5 남은 사용량/.test(document.querySelector('#ncs-verdict').textContent));
  // Sent with the switch off, once, without a question.
  await ready(page);let n=page.generated.length;
  await page.evaluate(()=>{document.querySelector('#ncs-notice').textContent='';});await page.locator('[data-action="generate"]').click();await waitNotice(page,/^생성했어요/);
  assert.equal(page.generated.length,n+1);assert.equal(page.generated.at(-1).confirmUsage,undefined);assert.ok(!asked.some(m=>/이번만 생성할까요/.test(m)));
  // 1 %: orange dot, warning words, the base number in the warning colour, the line says it will ask.
  await account(page,OPUS(1));
  assert.equal(await verdict(page),'Opus · V5 사용량 거의 소진 · 생성 때 확인');assert.equal(await state(page),'ask');
  assert.equal(await css(page,'.ncs-cost-dot','backgroundColor'),'rgb(224, 154, 43)');
  const warn=await varColor(page,'--ncs-warning');assert.equal(await css(page,'#ncs-verdict','color'),warn);assert.equal(await css(page,'#ncs-anlas-balance b.ncs-low','color'),warn);
  assert.equal(await page.locator('#ncs-usage-note').innerText(),'V5 사용량이 1% 남았어요. 이제부터 Anlas가 차감될 수 있어서 생성할 때마다 한 번씩 물어봐요.');
  // The server asks; yes → the same request once more with confirmUsage, then the image.
  page.ask='V5 사용량이 1% 남았어요. 이번 생성에서 Anlas가 차감될 수 있어요.';n=page.generated.length;const before=asked.length;
  await page.evaluate(()=>{document.querySelector('#ncs-notice').textContent='';});await page.locator('[data-action="generate"]').click();
  await page.waitForFunction(()=>document.querySelector('#ncs-notice').textContent);await idle(page);
  assert.match(await notice(page),/^생성했어요/,'the image came after the yes');
  const [first,second]=page.generated.slice(n);assert.equal(page.generated.length,n+2);
  assert.equal(first.confirmUsage,undefined);assert.equal(second.confirmUsage,true);assert.equal(second.requestId,first.requestId,'the same request');
  assert.deepEqual({...second,confirmUsage:undefined},{...first,confirmUsage:undefined},'the same content');
  assert.deepEqual(asked.slice(before).filter(m=>/이번만/.test(m)),['V5 사용량이 1% 남았어요.\n이번 생성에서 Anlas가 차감될 수 있어요.\n이번만 생성할까요?']);
  // No → nothing more is sent, no "result unknown" mark is left, and it says so.
  page.no=true;n=page.generated.length;
  await page.evaluate(()=>{document.querySelector('#ncs-notice').textContent='';});await page.locator('[data-action="generate"]').click();await waitNotice(page,/^생성 요청을 보내지 않았어요/);await idle(page);
  assert.equal(page.generated.length,n+1,'only the refused try');
  assert.equal(await page.locator('#ncs-generation-recover').isHidden(),true,'no 확인 필요 mark');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('naice-shot-pending-generation')??'[]').then(v=>JSON.parse(v).length),0);
  // The saved switch does not answer the question: on, it still asks (the server decides; the panel never skips it).
  page.no=false;await page.locator('#ncs-allow-anlas').check();n=page.generated.length;const before2=asked.length;
  await page.evaluate(()=>{document.querySelector('#ncs-notice').textContent='';});await page.locator('[data-action="generate"]').click();await waitNotice(page,/^생성했어요/);
  assert.equal(page.generated.length,n+2);assert.equal(asked.slice(before2).filter(m=>/이번만/.test(m)).length,1);
  await page.locator('#ncs-allow-anlas').uncheck();page.ask=null;
  // 0 % with extra usage, unusable, unknown: each its own words; unknown is red.
  await account(page,OPUS(0,100));assert.equal(await verdict(page),'Opus · V5 기본 사용량 0% · 생성 때 확인');assert.equal(await state(page),'ask');
  assert.match(await page.locator('#ncs-usage-note').innerText(),/^기본 사용량이 0%로 표시돼요\. 추가 구매 사용량이 먼저 쓰일 수도 있지만 Anlas가 차감될 수도 있어서/);
  await account(page,OPUS(0,0));assert.match(await page.locator('#ncs-usage-note').innerText(),/^V5 기본 사용량이 0%로 표시돼요\./);
  await account(page,OPUS(50,0,{isNegative:true}));assert.equal(await verdict(page),'Opus · V5 사용량을 지금 쓸 수 없어요');assert.equal(await state(page),'warn');
  await account(page,(({usage,...rest})=>rest)(OPUS(1)));assert.equal(await verdict(page),'Opus · V5 사용량 확인 못 함');assert.equal(await state(page),'warn');
  assert.match(await page.locator('#ncs-usage-note').innerText(),/^사용량을 확인하지 못했어요\. ↻로 다시 확인해 주세요\./);
  assert.equal(await page.locator('.ncs-consent-check').isHidden(),true,'V5 never shows the switch');
  assert.ok(await noOverflow(page));await shot(page,`account-${width}`);
  assert.deepEqual(errors,[]);await page.close();
 }
 // Red skins: the numbers and the green verdict are not red; 0 / 1 % stays in the warning colour.
 for(const [skin,colour] of [['candycane','rgb(31, 107, 74)'],['strawberrymilk','rgb(91, 58, 140)']]){
  const {page,errors}=await open(375,{skin});await page.waitForFunction(k=>document.getElementById('naice-shot-dialog').dataset.skin===k,skin);
  await account(page,OPUS(100));
  assert.equal(await css(page,'#ncs-anlas-balance b','color'),colour);assert.equal(await css(page,'#ncs-verdict','color'),colour);
  assert.notEqual(colour,await varColor(page,'--ncs-warning'));
  await account(page,OPUS(1));assert.equal(await css(page,'#ncs-anlas-balance b.ncs-low','color'),await varColor(page,'--ncs-warning'));
  assert.deepEqual(errors,[]);await page.close();
 }
 // Other skins keep their own accent text colour for the numbers.
 {const {page,errors}=await open(375,{skin:'milk'});await account(page,OPUS(100));
  assert.equal(await css(page,'#ncs-anlas-balance b','color'),await varColor(page,'--ncs-accent-text'));assert.deepEqual(errors,[]);await page.close();}
 console.log('PASS: Opus V5 with usage left is sent with the switch off; at 1 % the server asks, yes sends the same request once with confirmUsage, no sends nothing and leaves no mark, the switch on still asks; 0 %/extra/unusable/unknown words; 24-hour time, bold labels, (+N%) coloured, link for V4.5 too, no switch for V5; red skins use their own number colour (375/1100)');
}finally{await browser.close();server.close();}
