// v0.1.86: deleting a picture that is not in the chat skips the chat save (B1); keys SillyTavern changes in memory only
// do not block a save (B2); the prompt view lists every generation setting (B3); the chosen target row is readable on
// every theme (B4); the tag editor stays above a phone keyboard (B5); 36px controls and tighter spacing; hover colours
// only on devices that hover; ☆ at the card's top right; the official-preset note; explanations folded on phones;
// the # 태그 view; the new tag popup (picture only, 🔍/✕, dragged and remembered per device, three sizes).
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
async function open(width,{seed=[],features=FEATURES,marks=null,pending=null,broken=[],draft=null,skin=null}={}){
 const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true}),errors=[],asked=[];
 page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{asked.push(d.message());page.refuse?d.dismiss():d.accept();});
 const items=[...seed];page.deleteFail=[];page.deleteExtra={};page.posts=[];page.deletions=[];page.unexpectedImages=[];
 await page.route('https://example.invalid/**',r=>{page.unexpectedImages.push(r.request().url());return r.abort();});
 await page.route('**/user/images/naice-shot/**',r=>{const id=path.basename(new URL(r.request().url()).pathname,'.png');if(broken.includes(id))return r.fulfill({status:404,body:''});return r.fulfill({status:200,headers:{'Content-Type':'image/png'},body:pngOf(64,96)});});
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url()),post=r.request().method()==='POST',body=post?r.request().postDataJSON():null;
  if(u.pathname.endsWith('/history')){
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
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:post?{revision:'r'}:{revision:draft?'saved':null,work:draft}});
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

 // Hover colours live inside @media (hover:hover), so a tap on a phone leaves nothing lit (style.css and every theme).
 {const outside=[];
  for(const file of ['style.css',...(await fs.readdir(path.join(root,'skins'))).filter(f=>f.endsWith('.css')).map(f=>`skins/${f}`)]){
   const css=(await fs.readFile(path.join(root,file),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');let depth=0,media=[],sel='';
   for(let i=0;i<css.length;i++){const c=css[i];
    if(c==='{'){const head=sel.trim();if(head.startsWith('@'))media.push(head);else if(head.includes(':hover')&&!media.some(m=>/hover:\s*hover/.test(m)))outside.push(`${file}: ${head.slice(0,90)}`);depth++;sel='';if(!head.startsWith('@'))media.push('');}
    else if(c==='}'){depth--;media.pop();sel='';}else if(c===';'&&!media.at(-1)?.startsWith?.('@'))sel='';else sel+=c;}
  }
  // Two rules are not hover colours: the menu's first item looks the same hovered or not, and the −/+ reset.
  assert.deepEqual(outside.filter(x=>!/ncs-popup-primary|ncs-number-stepper button:hover/.test(x)),[],'hover rules outside @media (hover:hover)');}

 // B4: the chosen row of 대상 메시지 and the highlighted @ row are readable on every theme (✓ included).
 {const problems=[];
  for(const skin of skins){
   const {page,errors}=await open(375,{skin});
   await page.waitForFunction(k=>document.querySelector('#naice-shot-dialog').dataset.skin===k||k==='classic',skin);
   await page.locator('#ncs-target-picker > summary').click();await page.locator('.ncs-target-item[aria-pressed="true"]').waitFor();
   for(const x of await page.evaluate(SCAN,'.ncs-target-item[aria-pressed="true"]'))problems.push(`${skin} 대상 메시지: ${x}`);
   await page.locator('#ncs-moment-wish').click();await page.keyboard.type('@');await page.locator('#ncs-ref-list:not([hidden]) .ncs-ref-item').first().waitFor();
   if(!await page.locator('.ncs-ref-item[aria-selected="true"]').count())await page.keyboard.press('ArrowDown');
   for(const x of await page.evaluate(SCAN,'.ncs-ref-item[aria-selected="true"]'))problems.push(`${skin} @ 목록: ${x}`);
   assert.deepEqual(errors,[]);await page.close();
  }
  assert.deepEqual(problems,[],'selected rows below 4.5:1');}

 // B5: the tag editor stays above a phone keyboard (visualViewport shrinks; a real keyboard could not be used here).
 {const {page,errors}=await open(375,{seed:[pic(1),pic(2),pic(3),pic(5),pic(6)]});
  await history(page);
  await page.evaluate(()=>{const vv=new EventTarget();vv.offsetTop=0;vv.height=360;vv.width=375;Object.defineProperty(window,'visualViewport',{value:vv,configurable:true});window.__vv=vv;});
  await pick(page,`[data-history-tags="${uid(1)}"]`);await page.locator('#ncs-history-tag-input').waitFor();await page.waitForTimeout(120);
  let r=await rectOf(page,'.ncs-tag-form');assert.ok(r.y>=0&&r.b<=361,`the form is above the keyboard (${Math.round(r.y)}–${Math.round(r.b)})`);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ncs-history-tag-input');
  await page.evaluate(()=>{__vv.height=250;__vv.dispatchEvent(new Event('resize'));});await page.waitForTimeout(80);
  r=await rectOf(page,'.ncs-tag-form');assert.ok(r.y>=0&&r.b<=251,'still above a taller keyboard');
  // the hint is inside the field only
  assert.equal(await page.locator('#ncs-history-tag-input').getAttribute('placeholder'),'웃음, 비, rain');
  assert.equal(await page.locator('.ncs-tag-form small').count(),0);
  assert.deepEqual(errors,[]);await page.close();}

 for(const width of [375,1100]){
  const phone=width<=520;
  // B1: a picture that is not in the chat is deleted without touching the chat file (no false "save failed" note).
  {const {page,errors}=await open(width,{seed:[pic(1),pic(2)]});
   await history(page);
   await page.evaluate(()=>{mock.savedMetadata={...structuredClone(mock.chatMetadata),variables:{x:1}};mock.chatReads=[];}); // a chat save would be refused here
   await page.locator(`[data-history-delete="${uid(1)}"]`).click();
   await waitNotice(page,/그림 1장을 삭제했어요/);
   assert.doesNotMatch(await notice(page),/빼는 저장은 실패|확인하지 못했어요/);
   assert.equal(await page.evaluate(()=>mock.chatReads.length),0,'no chat read for a picture that is not in the chat');
   // a picture on another swipe of a message is in the chat: it is taken out with a checked save
   await page.evaluate(()=>{mock.savedMetadata=undefined;});await inChat(uid(2),'swipe')(page);
   await page.locator(`[data-history-delete="${uid(2)}"]`).click();
   await page.waitForFunction(()=>!mock.chat[1].swipe_info[1].extra?.naice_shot_images&&mock.chatReads.length>0);
   assert.deepEqual(errors,[]);await page.close();}

  // B2: keys SillyTavern changes in memory only (not saved yet) do not stop the chat save.
  {const {page,errors}=await open(width,{seed:[pic(3)]});
   await history(page);await inChat(uid(3))(page);
   await page.evaluate(()=>{const m=mock.chatMetadata;const disk=structuredClone(m);Object.assign(m,{lastInContextMessageId:1,chat_id_hash:77,timedWorldInfo:{sticky:{},cooldown:{}}});mock.savedMetadata=disk;});
   await page.locator(`[data-history-delete="${uid(3)}"]`).click();
   await waitNotice(page,/그림 1장을 삭제했어요/);
   assert.doesNotMatch(await notice(page),/빼는 저장은 실패/);
   assert.equal(await page.evaluate(()=>!!mock.chat[1].extra?.naice_shot_images),false,'taken out of the chat');
   assert.deepEqual(errors,[]);await page.close();}

  // B3, ☆ place, 36px controls and spacing, the official-preset note, explanations folded on phones
  {const {page,errors}=await open(width,{seed:[pic(1),pic(2)]});
   // spacing (user's choice: 중간) and control heights
   const pad=sel=>page.locator(sel).first().evaluate(e=>getComputedStyle(e).padding);
   assert.equal(await pad('#naice-shot-dialog .ncs-header'),phone?'9px 11px':'12px 16px');
   assert.equal(await pad('#naice-shot-dialog .ncs-tabs'),phone?'5px 7px':'7px 13px');
   assert.equal(await pad('#naice-shot-dialog .ncs-content'),phone?'0px 11px 11px':'0px 16px 13px');
   assert.equal(await pad('#naice-shot-dialog footer'),phone?'7px 11px':'9px 16px');
   assert.equal(Math.round((await rectOf(page,'.ncs-header .ncs-mode button')).h),32,'챗샷/프리샷 32px');
   assert.equal(Math.round((await rectOf(page,'.ncs-target-summary')).h),36);
   assert.equal(Math.round((await rectOf(page,'[data-action="recent-less"]')).h),36);
   await page.locator('[data-tab="settings"]').click();
   assert.equal(Math.round((await rectOf(page,'[data-action="new-preset"]')).h),36);
   assert.equal(Math.round((await rectOf(page,'#ncs-steps')).h),36);
   assert.equal(Math.round((await rectOf(page,'#ncs-model')).h),36);
   // the official-preset note: one light line right under the Negative field, never folded
   const note=page.locator('#ncs-official-preset-note');assert.equal(await note.isVisible(),true);
   assert.equal(await note.innerText(),'공식 사이트의 퀄리티 태그·부정 프리셋은 자동으로 붙지 않아요. 쓰던 분은 직접 넣어 주세요.');
   assert.ok((await rectOf(page,'#ncs-official-preset-note')).y>=(await rectOf(page,'#ncs-negative')).b);
   assert.equal(await note.evaluate(e=>!!e.closest('.ncs-help')),false);
   // explanations: phone = one line + 더보기 ›, PC = the full text
   const fold=page.locator('.ncs-help[data-short="프롬프트와 생성 설정을 한 묶음으로 저장해요."]'),full=fold.locator('> p:not(.ncs-help-short)');
   if(phone){
    assert.equal(await fold.locator('.ncs-help-short').isVisible(),true);assert.equal(await full.isVisible(),false);
    await fold.locator('[data-help-toggle="open"]').click();
    assert.equal(await full.isVisible(),true);assert.equal(await fold.locator('.ncs-help-short').isVisible(),false);
    await fold.locator('[data-help-toggle="close"]').click();assert.equal(await full.isVisible(),false);
   }else{
    assert.equal(await fold.locator('.ncs-help-short').isVisible(),false);assert.equal(await full.isVisible(),true);
    assert.equal(await fold.locator('[data-help-toggle]:visible').count(),0);
   }
   // never folded: costs, privacy, deleting, saved data
   const folded=await page.locator('.ncs-help:not(#ncs-tag-view-help)').evaluateAll(els=>els.map(e=>e.textContent));
   assert.ok(folded.length>=22,`${folded.length} folds`); // 0.1.87: three fewer (mode note unfolded, two pairs merged)
   for(const t of folded)assert.doesNotMatch(t,/Anlas|비용|개인정보|삭제|되돌릴 수 없|저장돼요|PNG|JSON\)|서버 플러그인/,t.slice(0,60));
   assert.equal(await page.locator('small',{hasText:'V4.5의 Opus 무료 생성 크기예요'}).isVisible(),true);
   assert.equal(await page.locator('p',{hasText:'추출 요청에도 해당 AI의 사용량·API 비용이 들어가요'}).isVisible(),true);
   assert.match(await page.locator('#ncs-account-shape > summary').textContent(),/^문제가 생겼을 때/);
   assert.equal(await page.locator('#ncs-account-shape .ncs-shape-help > :first-child').evaluate(e=>e.classList.contains('ncs-privacy-note')),true,'the privacy answer comes first');
   assert.equal(await page.locator('.ncs-hidden-note').textContent(),'하이드한 메시지도 고를 수 있어요.');
   assert.equal(await page.locator('.ncs-hidden-note').evaluate(e=>!!e.closest('.ncs-help')),false);
   assert.ok(await noOverflow(page));
   // ☆ at the card's top right, on the 선택 line, about the checkbox's size
   await history(page);
   const card=page.locator('.ncs-history-card').first(),cb=await card.locator('input[data-history-pick]').boundingBox(),st=await card.locator('.ncs-star').boundingBox(),cr=await card.boundingBox();
   assert.ok(Math.abs((cb.y+cb.height/2)-(st.y+st.height/2))<4,'☆ on the 선택 line');
   assert.ok(cr.x+cr.width-(st.x+st.width)<16,'☆ at the right');assert.ok(st.width<=26&&st.height<=26,'☆ about the checkbox size');
   assert.equal(Math.round((await card.locator('.ncs-history-actions button').first().boundingBox()).height),36);
   // B3: the prompt view shows Guidance, CFG Rescale, Sampler and Noise Schedule under the names the editor uses
   await page.locator(`[data-view-history="${uid(2)}"]`).click();await page.locator('#ncs-viewer[open]').waitFor();
   await page.locator('#ncs-viewer .ncsv-prompt summary').click();await page.waitForFunction(()=>document.querySelector('#ncs-viewer .ncsv-prompt-text').textContent.length>0);
   assert.match(await page.locator('#ncs-viewer .ncsv-prompt-text').innerText(),/^모델: .* · 832×1216 · Steps 28 · seed 2\nGuidance 5 · CFG Rescale 0 · Sampler k_euler_ancestral · Noise Schedule karras\n/);
   await page.keyboard.press('Escape');
   assert.deepEqual(errors,[]);await page.close();}

  // # 태그: every tagged picture through the ID filter; only one of ★ and # is on; delete all still counts everything
  {const marks={[uid(1)]:{chatKey:KEY,tags:['rain','비']},[uid(2)]:{chatKey:KEY,star:true}};
   const {page,errors,asked}=await open(width,{seed:[pic(1),pic(2),pic(3)],marks});
   await history(page);
   const tagBtn=page.locator('[data-action="history-tag-only"]'),star=page.locator('[data-action="history-star-only"]'),help=page.locator('#ncs-tag-view-help');
   assert.equal(await tagBtn.innerText(),'#'); // 0.1.88: icon onlyassert.equal(await help.count(),0,'0.1.87: the explanation moved to Settings → 태그 추천 팝업');
   await tagBtn.click();await page.waitForFunction(()=>document.querySelectorAll('#ncs-history [data-view-history]').length===1);
   assert.deepEqual(await cards(page),[uid(1)]);assert.deepEqual(page.posts.at(-1).ids,[uid(1)]);
   assert.equal(await tagBtn.getAttribute('aria-pressed'),'true');assert.equal(await star.getAttribute('aria-pressed'),'false');
   assert.match(await page.locator('#ncs-history-count').innerText(),/^태그 1장/);
   assert.ok(await noOverflow(page));await shot(page,`tag-view-${width}`);
   // delete all still asks about every picture of the chat
   page.refuse=true;await page.locator('[data-action="delete-chat-history"]').click();page.refuse=false;
   assert.match(asked.at(-1),/그림 3장을 모두/);
   // ★ turns # off
   await star.click();await page.waitForFunction(()=>document.querySelector('[data-action="history-tag-only"]').getAttribute('aria-pressed')==='false');
   await page.waitForFunction(id=>[...document.querySelectorAll('#ncs-history [data-view-history]')].map(e=>e.dataset.viewHistory).join()===id,uid(2));
   assert.equal(await star.getAttribute('aria-pressed'),'true');
   // pressing it again shows every picture, with neither on
   await star.click();await page.waitForFunction(()=>document.querySelectorAll('#ncs-history [data-view-history]').length===3);
   assert.deepEqual([await star.getAttribute('aria-pressed'),await tagBtn.getAttribute('aria-pressed')],['false','false']);
   assert.match(await page.locator('#ncs-history-count').innerText(),/^총 3장/);
   await tagBtn.click();await page.waitForFunction(()=>document.querySelector('[data-action="history-star-only"]').getAttribute('aria-pressed')==='false');
   await page.waitForFunction(id=>[...document.querySelectorAll('#ncs-history [data-view-history]')].map(e=>e.dataset.viewHistory).join()===id,uid(1));
   // taking the last tags off leaves the # view
   await pick(page,`[data-history-tags="${uid(1)}"]`);await page.locator('#ncs-history-tag-input').fill('');await page.keyboard.press('Enter');
   await page.waitForFunction(()=>/태그를 붙인 그림이 없어요/.test(document.querySelector('#ncs-history').innerText));
   assert.deepEqual(errors,[]);await page.close();}

  // The tag popup: picture only, top centre of the chat, 🔍 and ✕, dragged by the picture and remembered per device
  {const marks={[uid(1)]:{chatKey:KEY,tags:['웃음']}},device=phone?'phone':'pc';
   const {page,errors}=await open(width,{seed:[pic(1)],marks});
   await page.evaluate(k=>{mock.extensionSettings.naice_shot.tagPopupChats={[k]:true};},KEY);
   await closePanel(page);
   const show=async()=>{await reply(page,'웃음');await popup(page).waitFor();await page.waitForFunction(()=>document.querySelector('#ncs-tag-pop img')?.complete);await page.waitForTimeout(50);return rectOf(page,'#ncs-tag-pop');};
   let box=await show();
   const look=await popup(page).evaluate(e=>{const s=getComputedStyle(e);return [s.borderTopWidth,s.paddingTop,e.innerText.trim()];});
   assert.deepEqual(look,['0px','0px',''],'no frame, no padding, no tag text');await shot(page,`popup-${width}`);
   // 0.1.87 (user's choice): 🔍 removed, only ✕; a short press on the picture zooms (browser-v0187)
   assert.deepEqual(await popup(page).locator('.ncs-tag-pop-tools button').evaluateAll(b=>b.map(x=>[x.dataset.tagPop,!!x.querySelector('svg')])),[['close',true]]);
   assert.equal(await popup(page).locator('[data-tag-pop="insert"],[data-tag-pop="off"]').count(),0);
   const chat=await rectOf(page,'#chat');
   assert.ok(Math.abs((box.x+box.w/2)-(chat.x+chat.w/2))<=2,'centred over the chat');assert.ok(box.y<=Math.max(chat.y+8,56)+1,'at the top');
   assert.ok(box.x>=0&&box.r<=width+1);
   // 0.1.87: a tap on the picture opens the enlarged view and leaves the popup where it is
   await page.mouse.click(box.x+box.w/2,box.y+box.h/2);await page.locator('#ncs-viewer[open]').waitFor();
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('ncs-viewer')?.open);
   let at=await rectOf(page,'#ncs-tag-pop');assert.deepEqual([at.x,at.y],[box.x,box.y]);
   // dragging moves it and the place is kept on this device
   await page.mouse.move(box.x+box.w/2,box.y+box.h/2);await page.mouse.down();await page.mouse.move(box.x+box.w/2-30,box.y+box.h/2+80,{steps:6});await page.mouse.up();
   at=await rectOf(page,'#ncs-tag-pop');assert.ok(Math.abs(at.x-(box.x-30))<=1&&Math.abs(at.y-(box.y+80))<=1,'moved with the pointer');
   assert.deepEqual(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),`naice-shot-tag-pop-place-${device}`)),{x:Math.round(at.x),y:Math.round(at.y)});
   // pulled past the edge: it stays on the screen
   await page.mouse.move(at.x+at.w/2,at.y+at.h/2);await page.mouse.down();await page.mouse.move(at.x+at.w/2+3000,at.y+at.h/2+3000,{steps:4});await page.mouse.up();
   const edge=await rectOf(page,'#ncs-tag-pop');assert.ok(edge.r<=width&&edge.b<=900,'kept inside the screen');
   // a press on ✕ never drags: it closes; the next popup comes back where it was left
   await popup(page).locator('[data-tag-pop="close"]').click();assert.equal(await popup(page).count(),0);
   box=await show();assert.deepEqual([box.x,box.y],[edge.x,edge.y]);
   // a short press opens the usual enlarged view of that picture (0.1.87: was 🔍)
   await page.mouse.click(box.x+box.w/2,box.y+box.h/2);await page.locator('#ncs-viewer[open]').waitFor();
   assert.match(await page.locator('#ncs-viewer .ncsv-stage img').getAttribute('src'),new RegExp(uid(1)));
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('ncs-viewer')?.open);
   // Settings: size per device (기본 보통) and 위치 처음으로
   await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="settings"]').click();
   assert.equal(await page.locator('#ncs-tag-popup-size').inputValue(),'medium');
   const home=page.locator('[data-action="tag-popup-home"]');assert.equal(await home.isDisabled(),false);
   await page.locator('#ncs-tag-popup-size').selectOption('large');
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),`naice-shot-tag-pop-size-${device}`),'large');
   await home.click();assert.equal(await page.evaluate(k=>localStorage.getItem(k),`naice-shot-tag-pop-place-${device}`),null);
   assert.equal(await home.isDisabled(),true);
   await closePanel(page);
   box=await show();assert.ok(Math.abs((box.x+box.w/2)-(chat.x+chat.w/2))<=2,'back at the top centre');
   assert.equal(await popup(page).locator('img').evaluate(e=>getComputedStyle(e).maxHeight),'450px','크게 = half the screen height');
   await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="settings"]').click();
   await page.locator('#ncs-tag-popup-size').selectOption('small');await closePanel(page);await show();
   assert.equal(await popup(page).locator('img').evaluate(e=>getComputedStyle(e).maxHeight),'225px','작게 = a quarter');
   assert.deepEqual(errors,[]);await page.close();}
 }
 console.log('PASS: B1 no chat save for a picture not in the chat (a swipe still counts); B2 memory-only keys; B3 all settings in the prompt view; B4 selected rows readable on every theme; B5 tag editor above the keyboard; 36px controls, 중간 spacing, hover only where it hovers; ☆ top right; official-preset note; phone folds (costs, privacy, deleting, saved data never folded); # 태그 view; tag popup (picture only, top centre, 🔍/✕, drag + place per device, sizes, 위치 처음으로)');
}finally{await browser.close();server.close();}
