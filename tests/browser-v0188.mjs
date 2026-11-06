// v0.1.88: GPT review of 0.1.87 (B2 a window going back to an older timed effect, one work lock for loading/deleting/
// unknown results, a late ★→# failure after the view changed, the keyboard room after a touch, a second finger on the
// popup). Header copied from browser-v0187.
// (was) v0.1.87: GPT review of 0.1.86 (B2 timed world info from another window, B5 first press above the keyboard,
// saved-data notes outside the folds, small popup ✕ on a low screen, ★→# failure), P3-3 lock while a deletion is
// unknown, and the user's feedback (popup ✕ only + tap/hold, 프리샷 box, folds, recovery buttons, alignment, colours).
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
const FEATURES=['paged-history','delete','private-records','all-history','history-kinds','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes','generation-recovery','pending-history','delete-check','history-ids','delete-cleared'];
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
   const q=post?body:Object.fromEntries(u.searchParams);if(post)page.posts.push(body);
   const all=q.scope==='all',inScope=items.filter(x=>all?(!q.chatKey||x.chatKey===q.chatKey):x.chatKey===q.chatKey).sort((a,b)=>b.created.localeCompare(a.created));
   const saved=inScope.filter(x=>!x.orphaned),pending=post&&q.ids?[]:inScope.filter(x=>x.orphaned);
   const list=post&&q.ids?saved.filter(x=>q.ids.includes(x.id)):saved,offset=Number(q.offset??0),limit=Number(q.limit??20);
   const chats=[...new Set(items.map(x=>x.chatKey))].map(k=>({chatKey:k,count:items.filter(x=>x.chatKey===k).length,latest:''}));
   return r.fulfill({json:{items:list.slice(offset,offset+limit),total:list.length,hasMore:offset+limit<list.length,pending,pendingBytes:0,
    ...(post&&q.ids?{filtered:true,unfilteredCount:inScope.length}:{}),...(all?{scope:'all',kind:q.kind==='chat'?'chat':'all',chats,imageCount:items.length,bytes:1}:{})}});
  }
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
   return r.fulfill({json:post?{revision:'r'}:{revision:draft?'saved':null,work:draft}});}
  return r.fulfill({json:{keyConfigured:true,version:'0.1.23',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},anlas:{subscription:1000,purchased:0}}}});
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

 // GPT P2 B2: another window goes back to a value this window once had (off) after this window saved "on".
 for(const width of [375,1100]){
  const {page,errors}=await open(width,{seed:[pic(3)]});
  await history(page);await inChat(uid(3))(page);
  const off={sticky:{},cooldown:{}},on={sticky:{'7':{hash:7,start:1,end:9,protected:false}},cooldown:{}};
  await page.evaluate(([off,on])=>{const m=mock.chatMetadata;
   m.timedWorldInfo=structuredClone(off);mock.emit('received');mock.savedMetadata=structuredClone(m); // this window sees off (saved)
   m.timedWorldInfo=structuredClone(on);mock.emit('received');mock.savedMetadata=structuredClone(m); // then on, and saves it
   mock.savedMetadata.timedWorldInfo=structuredClone(off); // another window turns it off again and saves
  },[off,on]);
  await page.locator(`[data-history-delete="${uid(3)}"]`).click();
  await waitNotice(page,/빼는 저장은 실패/);
  assert.deepEqual(await page.evaluate(()=>mock.savedMetadata.timedWorldInfo),off,'the other window\'s "off" is still on the disk');
  assert.equal(await page.evaluate(()=>!!mock.chat[1].extra?.naice_shot_images),true);
  assert.deepEqual(errors,[]);await page.close();
 }

 // GPT P2 P3-3: one lock — loading another chat's work does not open it while a deletion runs; a later successful
 // deletion opens it again (and the check button goes).
 {const {page,errors}=await open(375);
  const fields=()=>page.evaluate(()=>document.querySelector('#ncs-work-fields').disabled);
  await page.locator('#ncs-location').fill('cafe at night');await page.waitForTimeout(900);
  const hold=gate();page.holdDraftDelete=hold;
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await page.waitForFunction(()=>document.querySelector('#ncs-work-fields').disabled);
  await closePanel(page);await page.evaluate(()=>mock.switchChat('B'));
  await page.locator('.ncs-launch-button').click();await page.locator('#naice-shot-dialog[open]').waitFor();
  await page.waitForTimeout(600); // the work of chat B has loaded
  assert.equal(await fields(),true,'still locked while the deletion runs');
  assert.equal(await page.locator('#ncs-location').isEditable(),false);
  hold.open();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  await page.locator('[data-tab="scene"]').click();await page.locator('#ncs-location').fill('typed after');await page.waitForTimeout(400);
  assert.equal(await page.locator('#ncs-location').inputValue(),'typed after','what is typed after the deletion stays');
  // held (reply and check lost), then 작업 전체 삭제 again succeeds: unlocked, no check button
  page.loseDraftDelete=true;page.draftReadFails=true;
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await waitNotice(page,/전체 삭제 응답을 받지 못했어요/);
  await page.locator('[data-tab="scene"]').click();assert.equal(await fields(),true);
  page.loseDraftDelete=false;page.draftReadFails=false;
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await waitNotice(page,/저장된 작업 \d+개를 지웠어요/);
  await page.locator('[data-tab="scene"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  assert.equal(await page.locator('#ncs-draft-retry').isVisible(),false);
  assert.equal(await page.locator('[data-mode="free"]').isEnabled(),true,'mode switch open too');
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P2 ★→#: a late failure of the old request after switching to 프리샷 leaves the 프리샷 view (and its delete count).
 {const marks={[uid(1)]:{chatKey:KEY,tags:['rain']},[uid(2)]:{chatKey:KEY,star:true}};
  const {page,errors,asked}=await open(375,{seed:[pic(1),pic(2),pic(5,FREE),pic(6,FREE),pic(7,FREE),pic(8,FREE)],marks});
  await history(page);
  await page.locator('[data-action="history-star-only"]').click();await page.waitForFunction(id=>[...document.querySelectorAll('#ncs-history [data-view-history]')].map(e=>e.dataset.viewHistory).join()===id,uid(2));
  const hold=gate();page.holdPost=hold;
  await page.locator('[data-action="history-tag-only"]').click();
  await page.locator('#ncs-history-scope').selectOption('free');
  // the # view of 프리샷 has loaded (no tagged 프리샷 pictures)
  await page.waitForFunction(()=>/태그를 붙인 그림이 없어요/.test(document.querySelector('#ncs-history').innerText));
  hold.open();await page.waitForTimeout(400);
  assert.equal(await page.locator('#ncs-history-scope').inputValue(),'free');
  assert.deepEqual(await cards(page),[],'not the old ★ card');
  assert.match(await page.locator('#ncs-history').innerText(),/태그를 붙인 그림이 없어요/);
  assert.equal(await page.locator('[data-action="history-tag-only"]').getAttribute('aria-pressed'),'true');
  assert.doesNotMatch(await page.locator('#ncs-history-count').innerText(),/즐겨찾기/);
  page.refuse=true;await page.locator('[data-action="delete-chat-history"]').click();page.refuse=false;
  assert.match(asked.at(-1),/4장/,'the question counts the 프리샷 pictures');
  assert.doesNotMatch(await notice(page).catch(()=>''),/503|mock busy/);
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P3 B5: a touch on 저장 leaves no room behind; editing another card does not grow it.
 {const {page,errors}=await open(375,{seed:[pic(1),pic(2),pic(3),pic(5),pic(6)],touch:true});
  await history(page);
  const pad=()=>page.locator('.ncs-content').evaluate(e=>[e.style.paddingBottom,getComputedStyle(e).paddingBottom]);
  const before=(await pad())[1];
  await page.evaluate(()=>{const vv=new EventTarget();vv.offsetTop=0;vv.height=360;vv.width=375;Object.defineProperty(window,'visualViewport',{value:vv,configurable:true});});
  const ids=await cards(page);
  for(const id of [ids.at(-1),ids.at(-2)]){
   await pick(page,`[data-history-tags="${id}"]`);await page.locator('#ncs-history-tag-input').waitFor();await page.waitForTimeout(150);
   await page.locator('#ncs-history-tag-input').fill('rain');
   const b=await rectOf(page,'[data-history-tag-save]');await page.touchscreen.tap(b.x+b.w/2,b.y+b.h/2);
   await page.waitForFunction(id=>(mock.extensionSettings.naice_shot.imageMarks?.[id]?.tags??[]).length===1,id);
   await page.waitForTimeout(500);
   assert.deepEqual(await pad(),['',before],'no room left after a touch save');
  }
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P3 popup: a second finger during a drag never opens the enlarged view.
 {const marks={[uid(1)]:{chatKey:KEY,tags:['웃음']}};
  const {page,errors}=await open(375,{seed:[pic(1)],marks,touch:true});
  await page.evaluate(k=>{mock.extensionSettings.naice_shot.tagPopupChats={[k]:true};},KEY);await closePanel(page);
  await reply(page,'웃음');await popup(page).waitFor();await page.waitForFunction(()=>document.querySelector('#ncs-tag-pop img')?.complete);await page.waitForTimeout(50);
  const b=await rectOf(page,'#ncs-tag-pop'),cx=b.x+b.w/2,cy=b.y+b.h/2,cdp=await page.context().newCDPSession(page);
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await touch('touchStart',[{x:cx,y:cy,id:1}]);
  for(let i=1;i<=4;i++)await touch('touchMove',[{x:cx,y:cy+i*10,id:1}]);
  await touch('touchStart',[{x:cx,y:cy+40,id:1},{x:cx+5,y:cy+20,id:2}]);
  await touch('touchEnd',[{x:cx,y:cy+40,id:1}]);await touch('touchEnd',[]);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#ncs-viewer[open]').count(),0,'no enlarged view');
  const at=await rectOf(page,'#ncs-tag-pop');assert.ok(Math.abs(at.y-(b.y+40))<=2,`moved by the first finger (${b.y} → ${at.y})`);
  // one finger: a tap still zooms
  await page.touchscreen.tap(at.x+at.w/2,at.y+at.h/2);await page.locator('#ncs-viewer[open]').waitFor();
  assert.deepEqual(errors,[]);await page.close();}

 console.log('PASS: B2 a window going back to an older timed effect is kept; one work lock (another chat\'s load during a deletion, a later successful deletion); a late ★→# failure leaves the 프리샷 view and count; no keyboard room after a touch save; a second finger on the popup never zooms');
}finally{await browser.close();server.close();}
