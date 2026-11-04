// v0.1.53 (GPT review of 0.1.52): moving to another chat stops before any wrong change (other group, refused
// character selection, reply being written, missing chat file) (UI-052-01/02); a message that slid into the old
// number is not taken for the source (UI-052-03); one-off options edited during an outfit save stay (UI-052-04);
// linking a temporary person to a profile already in the scene merges, and undo removes only what it added
// (UI-052-05); old messages keep loading while each press adds more (UI-052-06).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {textSignature} from '../core.mjs';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/naice-shot/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep))throw Error();
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const features=['paged-history','delete','private-records','all-history','history-kinds','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes'];
async function open(width,{cardName,extra=[],chats=['A','B']}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[...extra];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;mock.chat.forEach((m,i)=>m.send_date=`2026-01-01 ${i}`);}));
 // SillyTavern's chat list for a card (checked before switching, so a missing chat is never created).
 await page.route('**/api/characters/chats',r=>r.fulfill({json:Object.fromEntries(chats.map((c,i)=>[i,{file_name:`${c}.jsonl`}]))}));
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 return {page,errors};
}
const slot=page=>page.locator('.ncs-image-popup:popover-open .ncs-jump-slot button');
const openMore=async(page,n=0)=>{await page.locator('.ncs-history-card [data-image-more]:not(.ncs-save-toggle)').nth(n).click();await page.locator('.ncs-image-popup:popover-open').waitFor();};
const historyTab=async page=>{await page.locator('[data-tab="history"]').click();await page.locator('.ncs-history-card').first().waitFor();};
const noticeMatches=(page,re)=>page.waitForFunction(src=>new RegExp(src).test(document.querySelector('#ncs-notice')?.innerText??''),re.source);
const fake=(id,chatKey,index,text,extra={})=>({id,chatKey,created:new Date().toISOString(),image:`/user/images/naice-shot/${id}.png`,seed:1,options:{},assembled:{base:'x',negative:'',characters:[]},snapshot:{scene:{characters:[],source:{target:index,fingerprints:[{index,swipeId:0,signature:textSignature(text),...extra}]}}}});
const here=JSON.stringify({group:null,card:'Leo.png',chat:'A'});
try{
 {// UI-052-01/02: every refused step stops before anything is opened.
  const group=JSON.stringify({group:'g1',chat:'G chat'}),kai=JSON.stringify({group:null,card:'Kai.png',chat:'K1'}),gone=JSON.stringify({group:null,card:'Leo.png',chat:'Old'});
  const ids=['0000000a','0000000b','0000000c'].map(x=>`00000000-0000-4000-8000-0000${x}`);
  const {page,errors}=await open(375,{chats:['A','B','K1'],extra:[fake(ids[0],group,0,'x'),fake(ids[1],kai,0,'x'),fake(ids[2],gone,0,'x')]});
  await page.evaluate(()=>{mock.characters.push({name:'Kai',avatar:'Kai.png',chat:'K1'});mock.groups=[{id:'g1',chats:['G chat'],members:['Leo.png']}];mock.openGroupChat=(...a)=>{mock.groupOpened=a;return Promise.resolve();};});
  await page.locator('[data-tab="history"]').click();await page.locator('#ncs-history-scope').selectOption('all');await page.waitForFunction(()=>document.querySelectorAll('.ncs-history-card').length>=3);
  const cardOf=async id=>{const cards=page.locator('.ncs-history-card');for(let i=0;i<await cards.count();i++)if(await cards.nth(i).locator(`[data-history-delete="${id}"]`).count())return i;throw Error('card '+id);};
  const tryJump=async(id,re)=>{await openMore(page,await cardOf(id));await slot(page).first().click();await noticeMatches(page,re);assert.equal(await page.locator('#naice-shot-dialog').evaluate(d=>d.open),true,'panel stays open');};
  await tryJump(ids[0],/다른 그룹의 채팅으로는 바로 이동할 수 없어요/);assert.equal(await page.evaluate(()=>mock.groupOpened),undefined,'no group chat opened');
  await page.evaluate(()=>{mock.refuseSelect=true;});
  await tryJump(ids[1],/캐릭터를 바꾸지 못했어요/);
  assert.deepEqual(await page.evaluate(()=>[mock.selected,mock.opened??null,mock.characterId,mock.chatId]),[['1'],null,0,'A'],'refused selection: nothing opened, still in chat A');
  await page.evaluate(()=>{mock.refuseSelect=false;const s=document.createElement('div');s.id='mes_stop';s.style.display='flex';document.body.append(s);});
  await tryJump(ids[1],/본편 답변을 만드는 중이에요/);assert.equal(await page.evaluate(()=>mock.opened??null),null);
  await page.evaluate(()=>document.getElementById('mes_stop').style.display='none');
  await tryJump(ids[2],/그 채팅을 찾지 못했어요/);assert.equal(await page.evaluate(()=>mock.opened??null),null,'a missing chat is never created');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-052-03: the source message is deleted and a later one slides into its number.
  const {page,errors}=await open(375);
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
  await page.evaluate(()=>{mock.chat.push({name:'Mira',mes:'A later, unrelated message.',send_date:'2026-01-01 9'});mock.chat.splice(1,1);mock.renderChat();});
  await historyTab(page);await openMore(page);
  assert.equal(await slot(page).first().isDisabled(),true,'not taken for the source');assert.match(await slot(page).first().innerText(),/찾지 못했어요/);
  await page.locator('.ncs-image-popup:popover-open [data-history-attach]').click();await page.locator('#ncs-attach-dialog[open]').waitFor();assert.equal(await page.locator('#ncs-attach-dialog [data-attach-target][aria-pressed="true"]').count(),0,'no message chosen for it');assert.equal(await page.locator('[data-action="attach-confirm"]').isDisabled(),true);await page.locator('[data-action="attach-cancel"]').click();
  assert.equal(await page.evaluate(()=>mock.chat.some(m=>m.extra?.naice_shot_images?.length)),false,'nothing attached to the unrelated message');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-052-04: history options loaded, edited while an outfit save waits → kept.
  const {page,errors}=await open(375);
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
  await historyTab(page);await openMore(page);await page.locator('.ncs-image-popup:popover-open [data-history-id]').click();
  await page.locator('[data-character="leo"]').waitFor();await page.locator('#ncs-gen-override').waitFor({state:'visible'}).catch(()=>{});
  const card=page.locator('[data-character="leo"]');
  await page.evaluate(()=>{mock.normalSave=mock.saveMetadata;mock.saveMetadata=()=>new Promise(r=>mock.finishMetadata=r);});
  await card.locator('[data-save-outfit]').click();await card.locator('.ncs-outfit-saving').waitFor();
  await page.locator('#ncs-gen-box > summary').click();const scale=page.locator('[data-gen="scale"]');await scale.fill('9');await scale.dispatchEvent('change');
  await page.evaluate(()=>mock.finishMetadata());await page.waitForFunction(()=>!document.querySelector('.ncs-outfit-saving'));
  assert.equal(await scale.inputValue(),'9','one-off Guidance edited while saving is kept');
  await page.evaluate(()=>{mock.saveMetadata=mock.normalSave;});assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-052-05: Leo is already in the scene; a temporary "Robin" is linked to Leo → one Leo card; undo keeps Leo.
  const {page,errors}=await open(375,{cardName:'Robin'});
  await page.locator('[data-action="add-temp"]').click();await page.locator('[data-temp="name"]').last().fill('Robin');
  const names=()=>page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.map(c=>c.name));
  assert.deepEqual(await names(),['Leo','Robin']);
  const box=page.locator('#ncs-missing-main .ncs-missing-main');await box.waitFor();
  await box.locator('[data-missing-do="link"]').click();await page.locator('#ncs-link-profile').selectOption('leo');await page.locator('[data-missing-do="link-confirm"]').click();
  await page.locator('[data-missing-do="link-undo"]').waitFor();
  assert.deepEqual(await names(),['Leo'],'merged into the Leo card already there');assert.equal(await page.locator('[data-character="leo"]').count(),1);
  await page.locator('[data-missing-do="link-undo"]').click();
  assert.deepEqual(await names(),['Leo','Robin'],'undo brings the temporary card back and keeps Leo');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-052-06: 700 messages, 10 shown and 10 more per press (70 presses) → still reaches #0.
  const text='The very first message.',id='00000000-0000-4000-8000-0000000000aa';
  const {page,errors}=await open(375,{extra:[fake(id,here,0,text)]});
  await page.evaluate(t=>{mock.chat=Array.from({length:700},(_,i)=>({name:i%2?'Leo':'Mira',is_user:!(i%2),mes:i?`Message ${i}`:t,send_date:`d${i}`}));
   let shown=10;const draw=()=>{mock.renderChat();const rows=[...document.querySelectorAll('#chat .mes')];rows.slice(0,rows.length-shown).forEach(r=>r.remove());
    document.getElementById('show_more_messages')?.remove();if(shown<mock.chat.length){const b=document.createElement('div');b.id='show_more_messages';b.onclick=()=>setTimeout(()=>{shown+=10;draw();},20);document.getElementById('chat').prepend(b);}};
   draw();},text);
  await historyTab(page);await openMore(page,0);
  assert.match(await slot(page).first().innerText(),/#0/);await slot(page).first().click();
  await page.waitForFunction(()=>document.querySelector('#chat .mes[mesid="0"]')?.classList.contains('ncs-jump-flash'),null,{timeout:30000});
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: other group / refused selection / reply in progress / missing chat stop before opening anything, slid-in message not taken for the source, one-off options kept across an outfit save, temp linked to a profile in the scene merges and undo keeps it, old messages load past 60 presses');
}finally{await browser.close();server.close();}
