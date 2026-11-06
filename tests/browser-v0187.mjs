// v0.1.87: GPT review of 0.1.86 (B2 timed world info from another window, B5 first press above the keyboard,
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
async function open(width,{seed=[],features=FEATURES,marks=null,pending=null,broken=[],draft=null,skin=null,height=900}={}){
 const page=await browser.newPage({viewport:{width,height},acceptDownloads:true}),errors=[],asked=[];
 page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{asked.push(d.message());page.refuse?d.dismiss():d.accept();});
 const items=[...seed];page.deleteFail=[];page.deleteExtra={};page.posts=[];page.deletions=[];page.unexpectedImages=[];
 await page.route('https://example.invalid/**',r=>{page.unexpectedImages.push(r.request().url());return r.abort();});
 await page.route('**/user/images/naice-shot/**',r=>{const id=path.basename(new URL(r.request().url()).pathname,'.png');if(broken.includes(id))return r.fulfill({status:404,body:''});return r.fulfill({status:200,headers:{'Content-Type':'image/png'},body:pngOf(64,96)});});
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url()),post=r.request().method()==='POST',body=post?r.request().postDataJSON():null;
  if(u.pathname.endsWith('/history')){
   if(page.historyFail)return r.fulfill({status:503,json:{error:'mock busy'}});
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

try{

 // GPT P2 B2: a sticky/cooldown effect another window saved is never written back to its old value.
 for(const width of [375,1100]){
  // the disk has a timed effect this window never had: the picture is not taken out, the disk value stays
  {const {page,errors}=await open(width,{seed:[pic(3)]});
   await history(page);await inChat(uid(3))(page);
   const elsewhere={sticky:{'7':{hash:7,start:1,end:9,protected:false}},cooldown:{}};
   await page.evaluate(e=>{const m=mock.chatMetadata;const disk={...structuredClone(m),timedWorldInfo:e};m.timedWorldInfo={sticky:{},cooldown:{}};mock.savedMetadata=disk;},elsewhere);
   page.refuse=false;await page.locator(`[data-history-delete="${uid(3)}"]`).click();
   await waitNotice(page,/빼는 저장은 실패/); // the picture file goes; the chat is left as the other window saved it
   assert.deepEqual(await page.evaluate(()=>mock.savedMetadata.timedWorldInfo),elsewhere,'the other window\'s sticky effect is still on the disk');
   assert.equal(await page.evaluate(()=>!!mock.chat[1].extra?.naice_shot_images),true,'the picture is still in the chat (nothing was saved)');
   assert.deepEqual(errors,[]);await page.close();}
  // the disk still has what this window had (here: none, then a value it saw after a reply): the save goes through
  {const {page,errors}=await open(width,{seed:[pic(4)]});
   await history(page);await inChat(uid(4))(page);
   const seen={sticky:{'3':{hash:3,start:1,end:4,protected:false}},cooldown:{}};
   // ST changes the effect during a reply and saves it; this window saw it then (MESSAGE_RECEIVED)
   await page.evaluate(s=>{mock.chatMetadata.timedWorldInfo=structuredClone(s);mock.emit('received');mock.savedMetadata=structuredClone(mock.chatMetadata);mock.chatMetadata.timedWorldInfo={sticky:{},cooldown:{}};},seen);
   await page.locator(`[data-history-delete="${uid(4)}"]`).click();
   await waitNotice(page,/그림 1장을 삭제했어요/);
   assert.doesNotMatch(await notice(page),/빼는 저장은 실패|화면이 달라요/);
   assert.equal(await page.evaluate(()=>!!mock.chat[1].extra?.naice_shot_images),false,'taken out of the chat');
   assert.deepEqual(errors,[]);await page.close();}
 }

 // GPT P2 B5: with the keyboard open, the first press on [저장] under the last card saves the tags.
 for(const how of ['click','slow']){
  const {page,errors}=await open(375,{seed:[pic(1),pic(2),pic(3),pic(5),pic(6)]});
  await history(page);
  await page.evaluate(()=>{const vv=new EventTarget();vv.offsetTop=0;vv.height=360;vv.width=375;Object.defineProperty(window,'visualViewport',{value:vv,configurable:true});window.__vv=vv;});
  const last=(await cards(page)).at(-1);
  await pick(page,`[data-history-tags="${last}"]`);await page.locator('#ncs-history-tag-input').waitFor();await page.waitForTimeout(120);
  await page.locator('#ncs-history-tag-input').fill('rain, 비');
  const btn=await rectOf(page,'[data-history-tag-save]');assert.ok(btn.b<=361,'저장 is above the keyboard');
  const room=await page.locator('.ncs-content').evaluate(e=>e.style.paddingBottom);assert.notEqual(room,'','extra room while typing');
  await page.mouse.move(btn.x+btn.w/2,btn.y+btn.h/2);await page.mouse.down();
  if(how==='slow')await page.waitForTimeout(500); // a slow press: the room must still be there when the finger lifts
  const during=await rectOf(page,'[data-history-tag-save]');assert.ok(Math.abs(during.y-btn.y)<1,`the button did not move under the finger (${btn.y} → ${during.y})`);
  await page.mouse.up();
  await page.waitForFunction(id=>(mock.extensionSettings.naice_shot.imageMarks?.[id]?.tags??[]).length===2,last);
  assert.deepEqual((await stored(page))[last].tags,['rain','비']);
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.ncs-content').evaluate(e=>e.style.paddingBottom),'','the room is given back after saving');
  // 취소 works on the first press too
  await pick(page,`[data-history-tags="${last}"]`);await page.locator('#ncs-history-tag-input').waitFor();await page.waitForTimeout(120);
  const cancel=await rectOf(page,'[data-history-tag-cancel]');await page.mouse.click(cancel.x+cancel.w/2,cancel.y+cancel.h/2);
  await page.waitForFunction(()=>!document.querySelector('.ncs-tag-form'));
  assert.deepEqual(errors,[]);await page.close();
 }

 // P3-3 (A): while a work deletion's result is unknown, the drawing window is locked, so nothing typed can be lost.
 {const {page,errors}=await open(375);
  await page.locator('#ncs-location').fill('cafe at night');await page.waitForTimeout(900);
  page.loseDraftDelete=true;page.draftReadFails=true;
  await page.locator('[data-tab="settings"]').click();await page.locator('[data-action="delete-all-work"]').click();
  await waitNotice(page,/전체 삭제 응답을 받지 못했어요/);
  assert.match(await notice(page),/확인할 때까지 잠갔어요/);
  await page.locator('[data-tab="scene"]').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#ncs-work-fields').disabled),true,'locked while the result is unknown');
  assert.equal(await page.locator('#ncs-draft-status').innerText(),'삭제 결과를 확인할 때까지 작업을 잠갔어요.');
  assert.equal(await page.locator('#ncs-draft-retry').isVisible(),true);assert.equal(await page.locator('#ncs-draft-retry').isEnabled(),true);
  assert.equal(await page.locator('#ncs-location').isEditable(),false);
  // checking again while the server is still unreachable keeps it locked
  const shut=()=>page.locator('.ncs-notice-close').click(); // the error note sits over the top of the tab until closed
  await page.locator('#ncs-draft-retry').click();await waitNotice(page,/잠가 둘게요/);
  assert.equal(await page.evaluate(()=>document.querySelector('#ncs-work-fields').disabled),true);
  // once the server answers (the work was kept), the window opens again with what was there
  page.draftReadFails=false;await shut();await page.locator('#ncs-draft-retry').click();
  await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  assert.equal(await page.locator('#ncs-location').isEditable(),true);
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P3: the two saved-data notes are never folded on a phone.
 {const {page,errors}=await open(375);
  for(const text of ['장면·프롬프트는 서버에 따로 기억해요.','고친 내용은 채팅별 마지막 작업에 함께 기억해요.']){
   const el=page.locator('small',{hasText:text}).first();
   if(text.startsWith('고친'))await page.locator('#ncs-final-box > summary').click();
   assert.equal(await el.isVisible(),true,text);assert.equal(await el.evaluate(e=>!!e.closest('.ncs-help')),false,`${text} is outside the folds`);
  }
  const folded=await page.locator('.ncs-help').evaluateAll(els=>els.map(e=>e.textContent));
  for(const t of folded)assert.doesNotMatch(t,/기억해요|Anlas|비용|개인정보|삭제|되돌릴 수 없|저장돼요|PNG|JSON\)|서버 플러그인/,t.slice(0,60));
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P3: the ✕ of a small popup stays on a low screen, even at the left edge.
 {const marks={[uid(1)]:{chatKey:KEY,tags:['웃음']}};
  const {page,errors}=await open(640,{seed:[pic(1)],marks,height:280});
  await page.evaluate(k=>{mock.extensionSettings.naice_shot.tagPopupChats={[k]:true};localStorage.setItem('naice-shot-tag-pop-size-pc','small');},KEY);
  await closePanel(page);await reply(page,'웃음');await popup(page).waitFor();await page.waitForFunction(()=>document.querySelector('#ncs-tag-pop img')?.complete);
  const b=await rectOf(page,'#ncs-tag-pop');
  await page.mouse.move(b.x+b.w/2,b.y+b.h/2);await page.mouse.down();await page.mouse.move(b.x+b.w/2-2000,b.y+b.h/2+2000,{steps:4});await page.mouse.up();
  const x=await rectOf(page,'[data-tag-pop="close"]'),p=await rectOf(page,'#ncs-tag-pop');
  assert.ok(x.x>=0&&x.y>=0&&x.r<=640&&x.b<=280,`✕ fully on the screen (${JSON.stringify(x)})`);assert.ok(p.x>=0&&p.b<=280);
  await page.locator('[data-tag-pop="close"]').click();assert.equal(await popup(page).count(),0);
  // a very low screen: the picture is narrower than its ✕, which must still not leave the screen at the left edge
  await page.setViewportSize({width:640,height:90});await reply(page,'웃음');await popup(page).waitFor();await page.waitForFunction(()=>document.querySelector('#ncs-tag-pop img')?.complete);await page.waitForTimeout(50);
  const t=await rectOf(page,'#ncs-tag-pop');assert.ok(t.w<24,`the picture is narrower than the ✕ (${t.w})`);
  await page.mouse.move(t.x+t.w/2,t.y+t.h/2);await page.mouse.down();await page.mouse.move(t.x-2000,t.y+t.h/2,{steps:4});await page.mouse.up();
  const tx=await rectOf(page,'[data-tag-pop="close"]');assert.ok(tx.x>=0&&tx.y>=0,`✕ on the screen (${JSON.stringify(tx)})`);
  assert.deepEqual(errors,[]);await page.close();}

 // GPT P3: ★ → # when the list cannot be read: the ★ view stays whole (button and cards), and # works afterwards.
 for(const width of [375,1100]){
  const marks={[uid(1)]:{chatKey:KEY,tags:['rain']},[uid(2)]:{chatKey:KEY,star:true}};
  const {page,errors}=await open(width,{seed:[pic(1),pic(2),pic(3)],marks});
  await history(page);
  const star=page.locator('[data-action="history-star-only"]'),tag=page.locator('[data-action="history-tag-only"]');
  await star.click();await page.waitForFunction(id=>[...document.querySelectorAll('#ncs-history [data-view-history]')].map(e=>e.dataset.viewHistory).join()===id,uid(2));
  page.historyFail=true;await tag.click();await waitNotice(page,/./);await page.waitForTimeout(150);
  assert.deepEqual([await star.getAttribute('aria-pressed'),await tag.getAttribute('aria-pressed')],['true','false'],'still the ★ view');
  assert.deepEqual(await cards(page),[uid(2)]);assert.match(await page.locator('#ncs-history-count').innerText(),/^즐겨찾기 1장/);
  page.historyFail=false;await tag.click();await page.waitForFunction(id=>[...document.querySelectorAll('#ncs-history [data-view-history]')].map(e=>e.dataset.viewHistory).join()===id,uid(1));
  assert.deepEqual([await star.getAttribute('aria-pressed'),await tag.getAttribute('aria-pressed')],['false','true']);
  assert.deepEqual(errors.filter(e=>!/503/.test(e)),[]);await page.close();
 }

 // User feedback 1: the popup has only a small ✕ on a lighter circle; a short press zooms, a long press then drag moves.
 for(const width of [375,1100]){
  const marks={[uid(1)]:{chatKey:KEY,tags:['웃음']}};
  const {page,errors}=await open(width,{seed:[pic(1)],marks});
  await page.evaluate(k=>{mock.extensionSettings.naice_shot.tagPopupChats={[k]:true};},KEY);await closePanel(page);
  await reply(page,'웃음');await popup(page).waitFor();await page.waitForFunction(()=>document.querySelector('#ncs-tag-pop img')?.complete);await page.waitForTimeout(50);
  assert.deepEqual(await popup(page).locator('button').evaluateAll(b=>b.map(x=>x.dataset.tagPop)),['close'],'no 🔍');
  const x=await rectOf(page,'[data-tag-pop="close"]');assert.ok(x.w<=24.5&&x.h<=24.5,`✕ is small (${x.w}×${x.h})`);
  const bg=await page.locator('[data-tag-pop="close"]').evaluate(e=>getComputedStyle(e).backgroundColor);
  const alpha=Number(bg.match(/[\d.]+\)$/)?.[0]?.replace(')','')??1);assert.ok(alpha<=0.4,`lighter circle (${bg})`);
  let b=await rectOf(page,'#ncs-tag-pop');
  // a long press without moving does nothing
  await page.mouse.move(b.x+b.w/2,b.y+b.h/2);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();await page.waitForTimeout(150);
  assert.equal(await page.locator('#ncs-viewer[open]').count(),0);
  // hold, then drag: it moves and the place is kept
  await page.mouse.down();await page.waitForTimeout(400);
  assert.equal(await popup(page).evaluate(e=>e.classList.contains('ncs-dragging')),true,'picked up after holding');
  await page.mouse.move(b.x+b.w/2-20,b.y+b.h/2+60,{steps:5});await page.mouse.up();
  let at=await rectOf(page,'#ncs-tag-pop');assert.ok(Math.abs(at.y-(b.y+60))<=1,'moved with the pointer');
  assert.equal(await page.locator('#ncs-viewer[open]').count(),0,'a move never zooms');
  // a short press opens the enlarged view of that picture
  await page.mouse.click(at.x+at.w/2,at.y+at.h/2);await page.locator('#ncs-viewer[open]').waitFor();
  assert.match(await page.locator('#ncs-viewer .ncsv-stage img').getAttribute('src'),new RegExp(uid(1)));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('ncs-viewer')?.open);
  assert.deepEqual(errors,[]);await page.close();
 }

 // User feedback 2–7, 10, 11
 for(const width of [375,1100]){
  const phone=width<=520;
  const {page,errors}=await open(width,{seed:[pic(1),pic(2)]});
  // 2: the 프리샷 situation box is four lines tall again
  await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  const free=await rectOf(page,'#ncs-free-text');assert.ok(free.h>=90,`프리샷 상황 칸 ${free.h}px`);
  // 6: one 더보기 above 장면 추출 (프리샷 and 챗샷)
  const helps=sel=>page.locator(sel).evaluateAll(els=>els.filter(e=>e.offsetParent).length);
  if(phone)assert.equal(await helps('#ncs-free-source .ncs-help-short'),2,'프리샷: the box above, one under the field');
  assert.equal(await page.locator('#ncs-free-source .ncs-help').count(),2);
  // the floating ↓ 생성 never covers 장면 추출
  await page.locator('[data-action="extract"]').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
  assert.equal(await page.locator('#ncs-jump-generate').isVisible(),false,'↓ 생성 hidden while 장면 추출 shows');
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>!document.querySelector('#ncs-work-fields').disabled);
  assert.equal(await page.locator('#ncs-request .ncs-help').count(),1,'챗샷: one fold for the request field');
  if(phone)assert.match(await page.locator('#ncs-request .ncs-help-short').innerText(),/이번 추출에만 쓰는 요청이에요\. @로 고른 인물은 꼭 들어가요\./);
  // 5: generating does not flash 같은 요청으로 다시 확인 / 확인 표시 지우기
  await page.locator('#ncs-allow-anlas').check();
  await page.locator('[data-action="extract"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled);
  await page.evaluate(()=>{window.__flash=false;const box=document.getElementById('ncs-generation-recover');window.__flashMo=new MutationObserver(()=>{if(!box.hidden)window.__flash=true;});window.__flashMo.observe(box,{attributes:true});});
  await page.route('**/api/plugins/naice-shot/generate',r=>{const b=r.request().postDataJSON();return r.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});});
  await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>document.querySelector('#ncs-result img'));await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>{window.__flashMo.disconnect();return window.__flash;}),false,'the two buttons never showed');
  // they show (as one even row) only when a request is really left unchecked
  await page.evaluate(k=>{sessionStorage.setItem('naice-shot-pending-generation',JSON.stringify([[k,'x']]));},KEY);
  await page.reload();await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();await page.locator('#naice-shot-dialog[open]').waitFor();
  await page.waitForFunction(()=>!document.getElementById('ncs-generation-recover').hidden);
  const [c1,c2]=[await rectOf(page,'[data-action="generation-check"]'),await rectOf(page,'[data-action="generation-forget"]')];
  assert.ok(Math.abs(c1.w-c2.w)<=1&&Math.abs(c1.y-c2.y)<=1,'two equal buttons on one line');
  const gen=await rectOf(page,'[data-action="generate"]');assert.ok(Math.abs(c1.x-gen.x)<=1&&Math.abs(c2.r-gen.r)<=1,'as wide as 이미지 생성 together');assert.ok(c1.y>=gen.b+4,'a gap under 이미지 생성');
  // 11: the NAI status box — the dot says what this generation costs, numbers stand out
  await page.waitForFunction(()=>document.querySelector('#ncs-anlas-box').dataset.state!=='neutral');
  const dot=await page.locator('.ncs-cost-dot').evaluate(e=>getComputedStyle(e).backgroundColor);
  const state=await page.locator('#ncs-anlas-box').getAttribute('data-state');
  assert.ok(['ok','spend'].includes(state),state);assert.equal(dot,state==='ok'?'rgb(58, 157, 79)':'rgb(224, 154, 43)');
  const num=await page.locator('#ncs-anlas-balance b').first().evaluate(e=>[getComputedStyle(e).color,getComputedStyle(e.parentElement).color]);
  const accent=await page.evaluate(()=>{const p=document.createElement('span');p.style.color='var(--ncs-accent-text)';document.getElementById('naice-shot-dialog').append(p);const c=getComputedStyle(p).color;p.remove();return c;});
  assert.equal(num[0],accent,'the number takes the accent text colour');assert.notEqual(num[0],num[1]);
  // 3: the folded 추출 AI 원문 보관 line shows its state
  await page.locator('[data-tab="settings"]').click();
  assert.equal((await page.locator('#ncs-retain-summary').innerText()).trim(),'· 꺼짐');
  // 4: the tag rules live in Settings → 태그 추천 팝업; the history # view has no explanation of its own
  const tagHelp=await page.locator('.ncs-tag-popup-box .ncs-help').textContent();
  assert.match(tagHelp,/짧게 누르면 크게[\s\S]*길게 눌러 끌면 옮겨요[\s\S]*비, rain[\s\S]*10개[\s\S]*30자[\s\S]*# 태그/);
  assert.doesNotMatch(tagHelp,/🔍/);
  // 10: side-by-side rows line up (with SillyTavern's own select margin, which the phone screenshot showed)
  await page.addStyleTag({content:'select{margin-bottom:5px}'});
  const sz=await rectOf(page,'#ncs-tag-popup-size'),home=await rectOf(page,'[data-action="tag-popup-home"]');
  assert.ok(Math.abs(sz.y-home.y)<=1&&Math.abs(sz.h-home.h)<=1,`팝업 크기 ↔ 위치 처음으로 (${sz.y}/${sz.h} vs ${home.y}/${home.h})`);
  const ex=await rectOf(page,'[data-action="export"]'),im=await rectOf(page,'.ncs-file');
  assert.ok(Math.abs(ex.y-im.y)<=1&&Math.abs(ex.h-im.h)<=1,`내보내기 ↔ 가져오기 (${ex.y}/${ex.h} vs ${im.y}/${im.h})`);
  await shot(page,`settings-${width}`);
  await history(page);
  assert.equal(await page.locator('#ncs-tag-view-help').count(),0);
  // 7: the empty ★ message uses the whole width
  await page.locator('[data-action="history-star-only"]').click();await page.waitForFunction(()=>/즐겨찾기\(★\)한 그림이 없어요/.test(document.querySelector('#ncs-history').innerText));
  const empty=await rectOf(page,'#ncs-history > p'),grid=await rectOf(page,'#ncs-history');
  assert.ok(empty.w>=grid.w-1,`empty message ${empty.w} of ${grid.w}`);
  assert.ok(await noOverflow(page));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: B2 another window\'s timed world info is kept (own values still pass); B5 first press on 저장/취소 above the keyboard (quick and slow); P3-3 work locked while a deletion is unknown; saved-data notes never folded; small-popup ✕ on a low screen; ★→# failure keeps the ★ view; popup ✕ only, tap = zoom, hold = move; 프리샷 box height, one 더보기, ↓ 생성 off 장면 추출, no recovery-button flash (even row), status colours, 원문 보관 state, tag help in Settings, aligned rows, full-width empty message');
}finally{await browser.close();server.close();}
