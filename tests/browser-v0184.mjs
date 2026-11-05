// v0.1.84: tags and favorites on history pictures (keyed by picture ID), the ★-only view, the tag-suggestion popup
// (random match, stays until closed, on per chat, insert through the usual list), favorites named in the delete question,
// marks cleaned only after a confirmed deletion, and request records without a picture counted apart (server 0.1.22, P3-2).
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
async function open(width,{seed=[],features=FEATURES,marks=null,pending=null,broken=[]}={}){
 const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true}),errors=[],asked=[];
 page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{asked.push(d.message());page.refuse?d.dismiss():d.accept();});
 const items=[...seed];page.deleteFail=[];page.deleteExtra={};page.posts=[];
 await page.route('**/user/images/naice-shot/**',r=>{const id=path.basename(new URL(r.request().url()).pathname,'.png');if(broken.includes(id))return r.fulfill({status:404,body:''});return r.fulfill({status:200,headers:{'Content-Type':'image/png'},body:pngOf(64,96)});});
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url()),post=r.request().method()==='POST',body=post?r.request().postDataJSON():null;
  if(u.pathname.endsWith('/history')){
   const q=post?body:Object.fromEntries(u.searchParams);if(post)page.posts.push(body);
   const all=q.scope==='all',inScope=items.filter(x=>all?(!q.chatKey||x.chatKey===q.chatKey):x.chatKey===q.chatKey).sort((a,b)=>b.created.localeCompare(a.created));
   const list=post&&q.ids?inScope.filter(x=>q.ids.includes(x.id)):inScope,offset=Number(q.offset??0),limit=Number(q.limit??20);
   const chats=[...new Set(items.map(x=>x.chatKey))].map(k=>({chatKey:k,count:items.filter(x=>x.chatKey===k).length,latest:''}));
   return r.fulfill({json:{items:list.slice(offset,offset+limit),total:list.length,hasMore:offset+limit<list.length,pending:[],pendingBytes:0,
    ...(post&&q.ids?{filtered:true,unfilteredCount:inScope.length}:{}),...(all?{scope:'all',kind:q.kind==='chat'?'chat':'all',chats,imageCount:items.length,bytes:1}:{})}});
  }
  if(u.pathname.endsWith('/delete')){const deleted=[],failed=[],skipped=[];
   const wanted=body.all?items.filter(x=>x.chatKey===body.chatKey).map(x=>x.id):body.ids;
   for(const id of wanted){if(page.deleteFail.includes(id)){failed.push(id);continue;}const i=items.findIndex(x=>x.id===id&&x.chatKey===body.chatKey);if(i>=0){items.splice(i,1);deleted.push(id);}else skipped.push(id);}
   return r.fulfill({json:{deleted,skipped,workDeleted:false,...page.deleteExtra,...(failed.length?{failed}:{})}});}
  if(u.pathname.endsWith('/delete-check'))return r.fulfill({json:{absent:[],remaining:true}});
  if(u.pathname.endsWith('/generation'))return r.fulfill({json:u.searchParams.has('chatKey')?{pending:[]}:(page.generationReply??{state:'unknown'})});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:post?{revision:'r'}:{revision:null,work:null}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.22',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},anlas:{subscription:1000,purchased:0}}}});
 });
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
try{
 for(const width of [375,1100]){
  // ☆ → ★ on the card, kept by the picture's own ID; ★ only lists favorites through the server's ID filter
  {const {page,errors,asked}=await open(width,{seed:[pic(1),pic(2),pic(3),pic(4,FREE)]});
   await history(page);
   assert.deepEqual(await cards(page),[uid(3),uid(2),uid(1)]);
   const star=page.locator(`[data-history-star="${uid(2)}"]`);
   assert.equal(await star.textContent(),'☆');assert.equal(await star.getAttribute('aria-pressed'),'false');
   await star.click();
   assert.equal(await star.textContent(),'★');assert.equal(await star.getAttribute('aria-pressed'),'true');
   assert.deepEqual(await stored(page),{[uid(2)]:{chatKey:KEY,star:true}});
   // the star button sits on the date line and stays small
   const box=await star.boundingBox(),date=await page.locator(`[data-view-history="${uid(2)}"]`).locator('xpath=ancestor::article').locator('.ncs-history-date').boundingBox();
   assert.ok(box.width<=34&&Math.abs((box.y+box.height/2)-(date.y+date.height/2))<6,'☆ is a small button on the date line');
   await page.locator('[data-action="history-star-only"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#ncs-history [data-view-history]').length===1);
   assert.deepEqual(await cards(page),[uid(2)]);
   assert.equal(await page.locator('[data-action="history-star-only"]').getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('#ncs-history-count').innerText(),/즐겨찾기 1장/);
   assert.deepEqual(page.posts.at(-1).ids,[uid(2)]);assert.equal(page.posts.at(-1).chatKey,KEY);
   // "delete all" in ★ only still counts every picture of the chat (3), and names the favorite
   await page.locator('[data-action="delete-chat-history"]').isEnabled();
   page.refuse=true;await page.locator('[data-action="delete-chat-history"]').click();page.refuse=false;
   assert.match(asked.at(-1),/그림 3장을 모두 삭제할까요/);assert.match(asked.at(-1),/즐겨찾기한 그림 1장도 함께 삭제돼요/);
   // un-starring in ★ only takes the card out
   await page.locator(`[data-history-star="${uid(2)}"]`).click();
   await page.waitForFunction(()=>/즐겨찾기\(★\)한 그림이 없어요/.test(document.querySelector('#ncs-history').innerText));
   assert.deepEqual(await stored(page),{});
   await page.locator('[data-action="history-star-only"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#ncs-history [data-view-history]').length===3);
   assert.ok(await noOverflow(page),'no sideways scroll on the history tab');
   const row=await page.locator('.ncs-count-row').boundingBox(),refresh=await page.locator('.ncs-count-row [data-action="history"]').boundingBox(),filter=await page.locator('[data-action="history-star-only"]').boundingBox();
   assert.ok(filter.y>=row.y-1&&filter.y+filter.height<=row.y+row.height+1&&filter.x<refresh.x,'★ only sits in the count row, left of ↻');
   assert.deepEqual(errors,[]);await page.close();}

  // 태그 편집 from ⋯; Enter saves; chips show; 프리샷 pictures cannot take tags
  {const {page,errors}=await open(width,{seed:[pic(1),pic(2)],marks:{}});
   await history(page);
   await pick(page,`[data-history-tags="${uid(1)}"]`);
   const input=page.locator('#ncs-history-tag-input');await input.waitFor();
   await input.fill('웃음,  비 오는 날, 웃음');await input.press('Enter');
   await page.locator(`[data-view-history="${uid(1)}"]`).locator('xpath=ancestor::article').locator('.ncs-tag-chip').first().waitFor();
   assert.deepEqual(await page.locator(`[data-view-history="${uid(1)}"]`).locator('xpath=ancestor::article').locator('.ncs-tag-chip').allInnerTexts(),['#웃음','#비 오는 날']);
   assert.deepEqual(await stored(page),{[uid(1)]:{chatKey:KEY,tags:['웃음','비 오는 날']}});
   assert.equal(await page.locator(`[data-view-history="${uid(2)}"]`).locator('xpath=ancestor::article').locator('.ncs-tag-chip').count(),0);
   // too many tags: refused with a note, nothing saved
   await pick(page,`[data-history-tags="${uid(2)}"]`);
   await page.locator('#ncs-history-tag-input').fill(Array.from({length:11},(_,i)=>`t${i}`).join(','));
   await page.locator(`[data-history-tag-save="${uid(2)}"]`).click();
   await page.waitForFunction(()=>/10개까지/.test(document.querySelector('#ncs-notice').innerText));
   assert.equal((await stored(page))[uid(2)],undefined);
   await page.locator('[data-history-tag-cancel]').click();
   // clearing every tag removes the entry
   await pick(page,`[data-history-tags="${uid(1)}"]`);
   assert.equal(await page.locator('#ncs-history-tag-input').inputValue(),'웃음, 비 오는 날');
   await page.locator('#ncs-history-tag-input').fill(' ');await page.locator(`[data-history-tag-save="${uid(1)}"]`).click();
   await page.waitForFunction(()=>!document.querySelector('#ncs-history .ncs-tag-chip'));
   assert.deepEqual(await stored(page),{});
   await page.locator('#ncs-history-scope').selectOption('free');
   await page.waitForFunction(()=>document.querySelector('#ncs-history').innerText.includes('없어요'));
   assert.deepEqual(errors,[]);await page.close();}
  {const {page,errors}=await open(width,{seed:[pic(5,FREE)]});
   await history(page);await page.locator('#ncs-history-scope').selectOption('free');
   await page.locator(`[data-history-tags="${uid(5)}"]`).waitFor({state:'attached'});
   assert.equal(await page.locator(`[data-history-tags="${uid(5)}"]`).isDisabled(),true);
   assert.match(await page.locator(`[data-history-tags="${uid(5)}"]`).textContent(),/프리샷 그림은 캐릭터가 없어서/);
   assert.deepEqual(errors,[]);await page.close();}

  // Deleting: favorites named in the question; marks go only for pictures the server confirmed deleted
  {const marks={[uid(1)]:{chatKey:KEY,star:true,tags:['a']},[uid(2)]:{chatKey:KEY,star:true},[uid(3)]:{chatKey:KEY,tags:['c']},[uid(9)]:{chatKey:OTHER,star:true}};
   const {page,errors,asked}=await open(width,{seed:[pic(1),pic(2),pic(3),pic(9,OTHER)],marks});
   await history(page);
   page.deleteFail=[uid(2)];
   await page.locator(`[data-history-pick="${uid(1)}"]`).check();await page.locator(`[data-history-pick="${uid(2)}"]`).check();await page.locator(`[data-history-pick="${uid(3)}"]`).check();
   await page.locator('[data-action="delete-selected"]').click();
   await page.waitForFunction(()=>/삭제가 끝나지 않았어요/.test(document.querySelector('#ncs-notice').innerText));
   assert.match(asked.at(-1),/선택한 그림 3장을/);assert.match(asked.at(-1),/즐겨찾기한 그림 2장도 함께 삭제돼요/);
   // 1 and 3 were deleted; 2 failed and keeps its star; the other chat's 9 is untouched
   assert.deepEqual(Object.keys(await stored(page)).sort(),[uid(2),uid(9)].sort());
   await page.waitForFunction(()=>document.querySelectorAll('#ncs-history [data-view-history]').length===1);
   assert.equal(await page.locator(`[data-history-star="${uid(2)}"]`).textContent(),'★');
   // no favorite among the chosen: no extra line
   page.deleteFail=[];page.refuse=true;
   await page.locator(`[data-history-star="${uid(2)}"]`).click();
   await page.locator(`[data-history-pick="${uid(2)}"]`).check();await page.locator('[data-action="delete-selected"]').click();
   assert.doesNotMatch(asked.at(-1),/즐겨찾기/);page.refuse=false;
   await page.locator(`[data-history-star="${uid(2)}"]`).click();
   // delete all of this chat: the chat's marks go after the server confirms; the other chat's stay
   await page.locator('[data-action="delete-chat-history"]').click();
   await page.waitForFunction(()=>/그림 1장을 삭제했어요/.test(document.querySelector('#ncs-notice').innerText));
   assert.match(asked.at(-1),/즐겨찾기한 그림 1장도 함께 삭제돼요/);
   assert.deepEqual(Object.keys(await stored(page)),[uid(9)]);
   assert.deepEqual(errors,[]);await page.close();}

  // P3-2 (server 0.1.22): request records without a picture are counted apart; an unknown result keeps 확인 필요
  {const ghost='0000000a-aaaa-4bbb-8ccc-00000000000a',refused='0000000b-aaaa-4bbb-8ccc-00000000000b';
   const {page,errors}=await open(width,{seed:[pic(1)],pending:[[KEY,ghost]]});
   await page.locator('[data-action="generation-check"]:not([hidden])').waitFor();
   page.deleteExtra={cleared:[ghost,refused],unconfirmed:[ghost]};
   await history(page);await page.locator('[data-action="delete-chat-history"]').click();
   await page.waitForFunction(()=>/그림 1장을 삭제했어요/.test(document.querySelector('#ncs-notice').innerText));
   const note=await page.locator('#ncs-notice').innerText();
   assert.match(note,/그림이 없는 생성 요청 기록 2건도 정리했어요/);assert.match(note,/1건은 결과를 끝내 확인하지 못한 요청/);
   assert.equal(await page.locator('#ncs-notice').evaluate(n=>n.classList.contains('ncs-error')),true);
   await page.locator('[data-tab="scene"]').click();
   assert.equal(await page.locator('[data-action="generation-check"]').isHidden(),false,'the 확인 필요 mark stays for the unknown request');
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('naice-shot-pending-generation')).then(x=>x.includes('0000000a')),true);
   // checking it says it was cleared but may still have been charged, and the mark stays until [확인 표시 지우기]
   page.generationReply={state:'discarded',unconfirmed:true};
   await page.locator('[data-action="generation-check"]').click();
   await page.waitForFunction(()=>/차감 여부는 확인하지 못했어요/.test(document.querySelector('#ncs-notice').innerText));
   assert.equal(await page.locator('[data-action="generation-check"]').isHidden(),false);
   await page.locator('[data-action="generation-forget"]').click();
   await page.locator('[data-action="generation-check"]').waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);await page.close();}
  {const refused='0000000b-aaaa-4bbb-8ccc-00000000000b';
   const {page,errors}=await open(width,{seed:[pic(1)],pending:[[KEY,refused]]});
   page.deleteExtra={cleared:[refused],unconfirmed:[]};
   await history(page);await page.locator('[data-action="delete-chat-history"]').click();
   await page.waitForFunction(()=>/그림 1장을 삭제했어요/.test(document.querySelector('#ncs-notice').innerText));
   assert.doesNotMatch(await page.locator('#ncs-notice').innerText(),/확인하지 못한 요청/);
   await page.locator('[data-tab="scene"]').click();
   assert.equal(await page.locator('[data-action="generation-check"]').isHidden(),true,'a refused request needs no check');
   assert.deepEqual(errors,[]);await page.close();}

  // The popup: off by default, on per chat; a reply with a tag shows one picture of the same character
  {const marks={[uid(1)]:{chatKey:KEY,tags:['웃음']},[uid(2)]:{chatKey:OTHER,tags:['웃음']},[uid(3)]:{chatKey:KAI,tags:['웃음']},[uid(4)]:{chatKey:KEY,star:true}};
   const {page,errors}=await open(width,{seed:[pic(1),pic(2,OTHER)],marks});
   await page.locator('[data-tab="settings"]').click();
   const toggle=page.locator('#ncs-tag-popup');
   assert.equal(await toggle.isChecked(),false);assert.match(await page.locator('#ncs-tag-popup-state').innerText(),/이 캐릭터의 태그 붙은 그림 2장/);
   await closePanel(page);
   await reply(page,'Leo 웃음을 터뜨린다.');await page.waitForTimeout(150);
   assert.equal(await popup(page).count(),0,'off by default');
   await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="settings"]').click();
   await toggle.check();
   assert.deepEqual(await page.evaluate(()=>mock.extensionSettings.naice_shot.tagPopupChats),{[KEY]:true});
   assert.match(await page.locator('#ncs-tag-popup-state').innerText(),/켜짐/);
   // while the panel is open nothing pops up behind it
   await reply(page,'웃음');await page.waitForTimeout(150);assert.equal(await popup(page).count(),0);
   await closePanel(page);
   // no tag, the user's own message, a greeting: nothing
   await reply(page,'창밖을 본다.');await page.waitForTimeout(100);assert.equal(await popup(page).count(),0);
   await page.evaluate(()=>{mock.chat.push({name:'Mira',is_user:true,mes:'웃음'});mock.emit('rendered',mock.chat.length-1,'normal');});
   await reply(page,'웃음','first_message');await page.waitForTimeout(100);assert.equal(await popup(page).count(),0);
   // a match: one picture of Leo (this chat or another Leo chat), never Kai's; the matched tag is shown
   const seen=new Set();
   for(let i=0;i<14&&seen.size<2;i++){await reply(page,`그녀가 *웃음* 짓는다 ${i}`);await popup(page).waitFor();
    const src=await popup(page).locator('img').getAttribute('src');seen.add(path.basename(src,'.png'));}
   assert.deepEqual([...seen].sort(),[uid(1),uid(2)].sort(),'random among the same character only');
   assert.equal(await page.locator('#ncs-tag-pop').count(),1,'one popup at a time');
   assert.match(await popup(page).locator('.ncs-tag-pop-tags').innerText(),/#웃음/);
   // stays until closed
   await page.waitForTimeout(1500);assert.equal(await popup(page).isVisible(),true);
   const pb=await popup(page).boundingBox();assert.ok(pb.x>=0&&pb.x+pb.width<=width+1,'popup inside the screen');assert.ok(await noOverflow(page));
   // a picture of another chat: view only
   for(let i=0;i<20;i++){if(path.basename(await popup(page).locator('img').getAttribute('src'),'.png')===uid(2))break;await reply(page,`웃음 ${i}`);await popup(page).waitFor();}
   assert.equal(path.basename(await popup(page).locator('img').getAttribute('src'),'.png'),uid(2));
   assert.equal(await popup(page).locator('[data-tag-pop="insert"]').isDisabled(),true);
   assert.match(await popup(page).innerText(),/다른 채팅에서 만든 그림이라 보기만/);
   await popup(page).locator('[data-tag-pop="close"]').click();assert.equal(await popup(page).count(),0);
   // a picture of this chat: [넣기] opens the usual list with the reply that showed it already chosen
   let idx;
   for(let i=0;i<20;i++){idx=await reply(page,`웃음 가득 ${i}`);await popup(page).waitFor();if(path.basename(await popup(page).locator('img').getAttribute('src'),'.png')===uid(1))break;}
   assert.equal(path.basename(await popup(page).locator('img').getAttribute('src'),'.png'),uid(1));
   await popup(page).locator('[data-tag-pop="insert"]').click();
   await page.locator('#ncs-attach-dialog[open]').waitFor();
   assert.equal(await popup(page).count(),0);
   assert.equal(await page.locator('#ncs-attach-dialog [data-action="attach-confirm"]').innerText(),`#${idx}에 넣기`);
   assert.equal(await page.locator(`[data-attach-target="${idx}"]`).getAttribute('aria-pressed'),'true');
   await page.locator('#ncs-attach-dialog [data-action="attach-confirm"]').click();
   await page.waitForFunction(i=>mock.chat[i].extra?.naice_shot_images?.some(x=>x.id==='00000001-aaaa-4bbb-8ccc-000000000001'),idx);
   await closePanel(page);
   // [이 채팅에서 끄기] turns this chat off
   await reply(page,'웃음');await popup(page).waitFor();
   await popup(page).locator('[data-tag-pop="off"]').click();
   assert.equal(await popup(page).count(),0);assert.deepEqual(await page.evaluate(()=>mock.extensionSettings.naice_shot.tagPopupChats),{});
   await reply(page,'웃음');await page.waitForTimeout(100);assert.equal(await popup(page).count(),0);
   assert.deepEqual(errors,[]);await page.close();}

  // A picture that no longer loads gives way to another match; a chat change closes the popup
  {const marks={[uid(1)]:{chatKey:KEY,tags:['rain']},[uid(2)]:{chatKey:KEY,tags:['rain']}};
   const {page,errors}=await open(width,{seed:[pic(1),pic(2)],marks,broken:[uid(1)]});
   await page.evaluate(k=>{mock.extensionSettings.naice_shot.tagPopupChats={[k]:true};},KEY);
   await closePanel(page);
   for(let i=0;i<6;i++){await reply(page,`The rain falls ${i}.`);await page.waitForFunction(()=>document.querySelector('#ncs-tag-pop img')?.complete);
    assert.equal(path.basename(await popup(page).locator('img').getAttribute('src'),'.png'),uid(2));}
   await reply(page,'They catch a train.');await page.waitForTimeout(100);
   assert.equal(path.basename(await popup(page).locator('img').getAttribute('src'),'.png'),uid(2),'"rain" is a whole word: "train" does not replace the popup');
   await page.evaluate(()=>mock.switchChat('C'));
   assert.equal(await popup(page).count(),0);
   assert.deepEqual(errors,[]);await page.close();}

  // Backups leave tags, stars and popup switches out, and importing one keeps the current ones
  if(width===1100){const marks={[uid(1)]:{chatKey:KEY,star:true}};
   const {page,errors}=await open(width,{seed:[pic(1)],marks});
   await page.evaluate(k=>{mock.extensionSettings.naice_shot.tagPopupChats={[k]:true};},KEY);
   await page.locator('[data-tab="settings"]').click();
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="export"]').click()]);
   const text=await fs.readFile(await download.path(),'utf8'),saved=JSON.parse(text);
   assert.equal('imageMarks' in saved,false);assert.equal('tagPopupChats' in saved,false);assert.doesNotMatch(text,/Leo\.png/);
   await page.locator('#ncs-import').setInputFiles({name:'b.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...saved,imageMarks:{[uid(7)]:{chatKey:KEY,star:true}}}))});
   await page.waitForFunction(()=>/백업을 가져왔어요/.test(document.querySelector('#ncs-notice').innerText));
   assert.deepEqual(await stored(page),marks);assert.deepEqual(await page.evaluate(()=>mock.extensionSettings.naice_shot.tagPopupChats),{[KEY]:true});
   assert.deepEqual(errors,[]);await page.close();}

  // An older server: ★ only waits for the update
  {const {page,errors}=await open(width,{seed:[pic(1)],features:FEATURES.filter(f=>!['history-ids','delete-cleared'].includes(f))});
   await history(page);
   assert.equal(await page.locator('[data-action="history-star-only"]').isDisabled(),true);
   assert.match(await page.locator('[data-action="history-star-only"]').getAttribute('title'),/v0\.1\.22/);
   assert.deepEqual(errors,[]);await page.close();}
 }
 console.log('PASS: ☆/★ and tags kept by picture ID; ★ only through the ID filter; tags edited from ⋯ with Enter; favorites named when deleting and cleaned only after confirmed deletion; request records counted apart and unknown ones keep 확인 필요; the tag popup (per chat, same character, random, stays, view-only from other chats, [넣기] with the reply chosen, broken picture skipped); backups leave marks out');
}finally{await browser.close();server.close();}
