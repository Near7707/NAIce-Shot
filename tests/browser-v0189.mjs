// v0.1.89: GPT review of 0.1.88 (P2-1 B2 base only from a value read on the disk, P2-2 one deletion check per work and
// no late answer after it settled, no history import into locked work, P3-1 a failed ★→# goes back to the last view
// that loaded, P3-2 the count line on its own line). Header copied from browser-v0188 (with a POST plan for /history,
// a count override and a set /draft answer with gates).
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
  return r.fulfill({json:{keyConfigured:true,version:'0.1.24',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},anlas:{subscription:1000,purchased:0}}}});
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
try{
 // GPT P2-1 (a): the disk has "off", memory turns "on", a generation is stopped (nothing saved). Taking a picture out
 // of the chat afterwards still saves: the stop never made the unsaved "on" the base.
 const off={sticky:{},cooldown:{}},on={sticky:{'7':{hash:7,start:1,end:9,protected:false}},cooldown:{}},later={sticky:{'8':{hash:8,start:2,end:6,protected:false}},cooldown:{}};
 const look=async(page,run,arg=null)=>{const n=await page.evaluate(()=>(mock.chatReads??[]).length);await page.evaluate(run,arg);
  await page.waitForFunction(n=>(mock.chatReads??[]).length>n,n);await page.waitForTimeout(150);};
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{seed:[pic(3)]});
  await history(page);await inChat(uid(3))(page);
  await page.evaluate(off=>{mock.chatMetadata.timedWorldInfo=structuredClone(off);mock.savedMetadata=structuredClone(mock.chatMetadata);},off);
  await look(page,()=>mock.emit('received')); // SillyTavern saved "off" and this window read it
  await page.evaluate(on=>{mock.chatMetadata.timedWorldInfo=on;mock.emit('stopped');},on);await page.waitForTimeout(1600); // "on" only in memory
  await page.locator(`[data-history-delete="${uid(3)}"]`).click();
  await waitNotice(page,/그림 1장을 삭제했어요/);
  assert.doesNotMatch(await notice(page),/빼는 저장은 실패|화면이 달라요/);
  assert.equal(await page.evaluate(()=>!!mock.chat[1].extra?.naice_shot_images),false,'taken out of the chat');
  assert.deepEqual(errors,[]);await page.close();
 }

 // GPT P2-1 (b): after the stop, another window happens to save that unconfirmed "on"; this window's memory moves on.
 // The disk value was never confirmed by this window, so it is not overwritten with the memory value.
 {const {page,errors}=await open(375,{seed:[pic(4)]});
  await history(page);await inChat(uid(4))(page);
  await page.evaluate(off=>{mock.chatMetadata.timedWorldInfo=structuredClone(off);mock.savedMetadata=structuredClone(mock.chatMetadata);},off);
  await look(page,()=>mock.emit('received'));
  await page.evaluate(on=>{mock.chatMetadata.timedWorldInfo=structuredClone(on);mock.emit('stopped');},on);
  await page.waitForTimeout(1600); // the stop's look at the disk: still "off" there
  await page.evaluate(([on,later])=>{mock.savedMetadata.timedWorldInfo=structuredClone(on);mock.chatMetadata.timedWorldInfo=structuredClone(later);},[on,later]);
  await page.locator(`[data-history-delete="${uid(4)}"]`).click();
  await waitNotice(page,/빼는 저장은 실패/);
  assert.deepEqual(await page.evaluate(()=>mock.savedMetadata.timedWorldInfo),on,'the other window\'s value is still on the disk');
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P2-1 (c): this window's own save whose result is not on the disk afterwards does not become the base either.
 {const {page,errors}=await open(375,{seed:[pic(4),pic(6)]});
  await history(page);
  await page.evaluate(([a,b])=>{mock.chat[1].extra={naice_shot_images:[{id:a}]};mock.chat[0].extra={naice_shot_images:[{id:b}]};mock.savedChat=JSON.stringify(mock.chat);mock.renderChat();},[uid(4),uid(6)]);
  await page.evaluate(off=>{mock.chatMetadata.timedWorldInfo=structuredClone(off);mock.savedMetadata=structuredClone(mock.chatMetadata);},off);
  await look(page,()=>mock.emit('received'));
  await page.evaluate(on=>{mock.chatMetadata.timedWorldInfo=structuredClone(on);mock.emit('stopped');},on);await page.waitForTimeout(1600);
  // the first deletion's save: the messages reach the disk, the timed effects do not, and the check after it cannot
  // read the chat (unverified)
  await page.evaluate(()=>{window.__save=mock.saveChat;mock.saveChat=async function(){mock.savedChat=JSON.stringify(mock.chat);mock.chatReadFails=true;};});
  await page.locator(`[data-history-delete="${uid(4)}"]`).click();await waitNotice(page,/확인하지 못했어요/);
  await page.evaluate(()=>{mock.saveChat=window.__save;mock.chatReadFails=false;});
  await page.evaluate(([on,later])=>{mock.savedMetadata.timedWorldInfo=structuredClone(on);mock.chatMetadata.timedWorldInfo=structuredClone(later);},[on,later]);
  await page.locator(`[data-history-delete="${uid(6)}"]`).click();
  await page.waitForTimeout(1500);
  assert.deepEqual(await page.evaluate(()=>mock.savedMetadata.timedWorldInfo),on,'the other window\'s value is still on the disk');
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P2-2 (a): [삭제 결과 다시 확인] pressed twice. One check runs; its answer opens the lock; what is typed after
 // that stays even when the server answers the same again.
 {const {page,errors}=await open(375);
  const fields=()=>page.evaluate(()=>document.querySelector('#ncs-work-fields').disabled);
  await page.locator('#ncs-location').fill('cafe at night');await page.waitForTimeout(900);
  page.loseDraftDelete=true;page.draftReadFails=true;
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await waitNotice(page,/전체 삭제 응답을 받지 못했어요/);
  await page.locator('[data-tab="scene"]').click();assert.equal(await fields(),true);
  page.loseDraftDelete=false;page.draftReadFails=false;
  const g1=gate(),g2=gate();page.draftGates=[g1,g2];page.draftReply={revision:'gone-1',deleted:true};page.draftReads=0;
  const retry=page.locator('#ncs-draft-retry');
  await retry.click();await page.waitForTimeout(150);await retry.click();await page.waitForTimeout(300);
  assert.equal(page.draftReads,1,'one check for the two presses');
  g1.open();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  page.draftReply=null; // later reads (the open work) get the normal answer
  await page.locator('#ncs-location').fill('typed after');
  g2.open();await page.waitForTimeout(800);
  assert.equal(await page.locator('#ncs-location').inputValue(),'typed after','a later answer does not empty it');
  assert.equal(await fields(),false);
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P2-2 (a'): a check that started before an earlier answer settled the deletion changes nothing when it ends.
 {const {page,errors}=await open(375);
  await page.locator('#ncs-location').fill('cafe at night');await page.waitForTimeout(900);
  page.loseDraftDelete=true;page.draftReadFails=true;
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await waitNotice(page,/전체 삭제 응답을 받지 못했어요/);
  await page.locator('[data-tab="scene"]').click();
  page.loseDraftDelete=false;page.draftReadFails=false;
  const g1=gate();page.draftGates=[g1];page.draftReply={revision:'gone-2',deleted:true};
  await page.locator('#ncs-draft-retry').click();await page.waitForTimeout(150);
  // the same deletion is settled meanwhile by another answer (a successful 작업 전체 삭제)
  const answer=page.draftReply;page.draftReply=null;
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await waitNotice(page,/저장된 작업 \d+개를 지웠어요/);
  await page.locator('[data-tab="scene"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  await page.locator('#ncs-location').fill('typed after');
  page.draftReply=answer;g1.open();await page.waitForTimeout(800);page.draftReply=null;
  assert.equal(await page.locator('#ncs-location').inputValue(),'typed after');
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P2-2 (b): while 작업 전체 삭제 runs, the history's [챗샷으로 보내기] is refused (the work stays locked).
 for(const how of ['card','viewer']){
  const {page,errors}=await open(375,{seed:[pic(5)]});
  await page.locator('#ncs-location').fill('cafe at night');await page.waitForTimeout(900);
  const hold=gate();page.holdDraftDelete=hold;
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await page.waitForFunction(()=>document.querySelector('#ncs-work-fields').disabled);
  await history(page);
  if(how==='card')await pick(page,`[data-history-id="${uid(5)}"]`);
  else{await page.locator(`[data-view-history="${uid(5)}"]`).click();await page.locator('#ncs-viewer[open]').waitFor();
   await page.locator('#ncs-viewer [data-v="more"]').click();await page.locator('#ncs-viewer .ncsv-more-items button',{hasText:'챗샷으로 보내기'}).first().click();}
  await waitNotice(page,/잠가 두었어요/);
  assert.doesNotMatch(await notice(page),/가져왔어요/);
  hold.open();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  assert.equal(await page.evaluate(()=>document.querySelector('#ncs-viewer')?.open??false),false,'no viewer left open');
  assert.deepEqual(errors,[]);await page.close();
 }

 // GPT P3-1: ★ is still loading when # is pressed and fails: the list goes back to the last loaded view (all
 // pictures), not to the empty ★ list; the late ★ answer is dropped.
 {const marks={[uid(1)]:{chatKey:KEY,star:true},[uid(2)]:{chatKey:KEY,tags:['rain']}};
  const {page,errors}=await open(375,{seed:[pic(1),pic(2),pic(3)],marks});
  await history(page);
  const all=await cards(page);assert.equal(all.length,3);
  const slow=gate(),now=gate();now.open();page.postPlan=[{wait:slow},{wait:now,fail:true}];
  await page.locator('[data-action="history-star-only"]').click();await page.waitForTimeout(150);
  await page.locator('[data-action="history-tag-only"]').click().catch(()=>{});
  await page.waitForFunction(()=>document.querySelectorAll('#ncs-history [data-view-history]').length===3);
  slow.open();await page.waitForTimeout(500);
  assert.deepEqual(await cards(page),all,'the whole list is back');
  assert.equal(await page.locator('[data-action="history-star-only"]').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('[data-action="history-tag-only"]').getAttribute('aria-pressed'),'false');
  assert.match(await page.locator('#ncs-history-count').innerText(),/총 3장/);
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P3-2 + user choice: the count has its own line, ☆ # ↻ 새로고침 the next line at the right — at every width,
 // long count or short; the refresh text fits its button and nothing scrolls sideways.
 for(const width of [320,375,1100])for(const long of [true,false]){
  const {page,errors}=await open(width,{seed:Array.from({length:6},(_,i)=>pic(i+1))});
  if(long)page.historyOverride={total:1200,hasMore:true,pendingBytes:110100480,pending:Array.from({length:100},(_,i)=>({...pic(200+i),orphaned:true}))};
  await history(page);
  await page.locator(`[data-history-pick="${uid(1)}"]`).check();
  const m=await page.evaluate(()=>{const r=e=>e.getBoundingClientRect(),row=document.querySelector('.ncs-count-row'),c=document.getElementById('ncs-history-count'),
   btns=[...row.querySelectorAll('button')].map(r),ref=row.querySelector('.ncs-refresh-button');
   return {text:c.innerText,countBottom:r(c).bottom,btnTop:Math.min(...btns.map(b=>b.top)),btnTops:btns.map(b=>Math.round(b.top)),
    refreshRight:r(ref).right,rowRight:r(row).right,refreshFits:ref.scrollWidth<=ref.clientWidth+1,wide:document.documentElement.scrollWidth<=innerWidth+1,
    dialogWide:[...document.querySelectorAll('#naice-shot-dialog *')].every(e=>e.scrollWidth<=e.clientWidth+1||getComputedStyle(e).overflowX==='visible'||e.clientWidth===0)};});
  if(long)assert.match(m.text,/저장 대기 100장 · 105\.0 MB.*1장 고름/s);else assert.match(m.text,/1장 고름/);
  assert.ok(m.btnTop>=m.countBottom-1,`buttons under the count (${width} ${long})`);
  assert.equal(new Set(m.btnTops).size,1,'☆ # ↻ in one row');
  assert.ok(Math.abs(m.refreshRight-m.rowRight)<=1,'at the right');
  assert.ok(m.refreshFits,`refresh text fits (${width} ${long})`);
  assert.ok(m.wide&&m.dialogWide,`no sideways scroll (${width} ${long})`);
  await shot(page,`count-${width}-${long?'long':'short'}`);
  assert.deepEqual(errors,[]);await page.close();
 }

 console.log('PASS: B2 base only from the disk (a stopped generation saves nothing; an unconfirmed value another window saved is kept); one deletion check for two presses and no late answer after it settled; no history import (card ⋯ and enlarged view) while work is being deleted; a failed ★→# while ★ loads goes back to the loaded list; the count line on its own line with ☆ # ↻ under it at 320/375/1100 (long and short)');
}finally{await browser.close();server.close();}
