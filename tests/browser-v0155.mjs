// v0.1.55 그리기 탭 정리: one 장면 추출 for 챗샷 and 프리샷 (no 글로 채우기), 추출 표현 shown in both, the clear slot
// by the 2 · 장면 편집 heading (each mode keeps its own undo), 추가 요청 above 장면 추출 and under the candidates once
// there are some, request results applied (requested clothing as this picture's own choice, even with a lock),
// the 챗샷/프리샷 switch staying in view, 인물 추가 emphasis and + 인물 칸 추가, and the question before generating
// without a 공통 이미지 프리셋.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
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
async function open(width,{cardName}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.allowAnlas=true;}));
 if(cardName)await page.addInitScript(n=>document.addEventListener('DOMContentLoaded',()=>{mock.characters[0].name=n;mock.name2=n;}),cardName);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 return {page,errors};
}
const idle=page=>page.waitForFunction(()=>document.querySelector('#ncs-progress').hidden);
const moment=(title,action,lighting)=>({title,characters:[{id:'leo',name:'Leo',expression:'smile',action,position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'cafe',lighting,camera:'medium shot',interaction:''});
try{
 for(const width of [375,1100]){
  const {page,errors}=await open(width);const tag=`${width}px`;
  // One main button; 추출 표현 is common; the request box sits above 장면 추출 before there are candidates.
  assert.equal(await page.locator('[data-action="free-fill"]').count(),0,'no separate 글로 채우기');
  assert.equal(await page.locator('[data-action="extract"]').count(),1);
  assert.equal(await page.locator('#ncs-request-home #ncs-request').count(),1,`${tag}: request above 장면 추출`);
  assert.match(await page.locator('#ncs-request').innerText(),/추가 요청 · 선택[\s\S]*바꿀 내용을 적어 주세요/);
  assert.equal(await page.locator('#ncs-format').isVisible(),true);
  assert.equal(await page.locator('.ncs-section-head .ncs-clear-slot .ncs-action-slot').innerText(),'그리기창 비우기');
  assert.equal(await page.locator('[data-action="add-character"]').evaluate(b=>b.classList.contains('ncs-accent')),true);
  assert.equal(await page.locator('[data-action="add-temp"]').innerText(),'+ 인물 칸 추가');
  // Candidates + request: the box moves under them, results are shown, requested clothing beats the lock.
  await page.evaluate(([a,b])=>{mock.chatMetadata.naice_shot={outfits:{leo:{value:'navy coat',locked:true}}};mock.extraction={moments:[a,b],defaultIndex:1,requestMatched:true,requestApplied:['밤','앉은 자세'],requestIgnored:['머리색 · 프로필 고정 외형'],requestOutfits:[{id:'leo',name:'Leo',outfit:'red raincoat'}],requestVisibleOnly:false};},[moment('들어온다','walking in','sunlight'),{...moment('앉는다','sitting at night','moonlight'),characters:[{id:'leo',name:'Leo',expression:'smile',action:'sitting at night',position:'auto',outfitMode:'replace',outfit:'red raincoat'}]}]);
  await page.locator('#ncs-moment-wish').fill('밤에 앉아 있는 모습, 빨간 우비');await page.locator('[data-action="extract"]').click();await idle(page);
  assert.match(await page.evaluate(()=>mock.lastExtract.prompt??JSON.stringify(mock.lastExtract)),/USER REQUEST for this picture/);
  assert.equal(await page.locator('#ncs-request-near #ncs-request').count(),1,`${tag}: request under the candidates`);
  assert.equal(await page.locator('.ncs-request-again').isVisible(),true);
  assert.match(await page.locator('#ncs-request-applied').innerText(),/추가 요청 반영: 밤 · 앉은 자세 \/ 반영하지 않음: 머리색/);
  assert.match(await page.locator('#ncs-notice').innerText(),/추가 요청 반영: 밤 · 앉은 자세/);
  assert.equal(await page.locator('[data-character="leo"] [data-field="manualOutfit"]').inputValue(),'red raincoat','requested clothing wins over the lock');
  // The switch stays in view while the drawing tab scrolls.
  await page.evaluate(()=>document.querySelector('.ncs-content').scrollTop=900);await page.waitForTimeout(100);
  // 0.1.67: the switch lives in the title row, which never scrolls.
  const bar=await page.locator('[data-mode="free"]').boundingBox(),content=await page.locator('.ncs-content').boundingBox();
  assert.ok(bar&&bar.y+bar.height<=content.y+1,`${tag}: 챗샷/프리샷 stays at the top`);
  await page.evaluate(()=>document.querySelector('.ncs-content').scrollTop=0);
  // Each mode keeps its own clear undo in the shared slot.
  const slot=page.locator('.ncs-clear-slot .ncs-action-slot');
  await slot.click();assert.equal(await slot.innerText(),'↶ 비우기 취소');
  await page.locator('[data-mode="free"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="free"]').getAttribute('aria-pressed')==='true');
  assert.equal(await slot.innerText(),'그리기창 비우기','프리샷 has no undo of its own yet');
  assert.equal(await page.locator('#ncs-request').isVisible(),false,'추가 요청 is 챗샷 only');assert.equal(await page.locator('#ncs-format').isVisible(),true,'추출 표현 also in 프리샷');
  assert.match(await page.locator('#ncs-free-source p').innerText(),/별칭을 쓰면 인물을 미리 추가하지 않아도/);
  // 프리샷 uses the same 장면 추출 (the free-scene prompt, nothing from the chat).
  await page.evaluate(()=>{mock.extraction={characters:[{id:'leo',name:'Leo',subject:'boy',appearance:'',outfit:'',expression:'smile',action:'reading',position:'auto'}],location:'library',lighting:'lamp light',camera:'wide shot',interaction:''};});
  await page.locator('#ncs-free-text').fill('도서관에서 책 읽는 레오');await page.locator('[data-action="extract"]').click();await idle(page);
  const sent=await page.evaluate(()=>JSON.stringify(mock.lastExtract));
  assert.match(sent,/ROSTER \(saved profiles\)/);assert.doesNotMatch(sent,/Leo sits by the window/,'no chat message in a 프리샷 request');assert.doesNotMatch(sent,/navy coat/,'no chat clothes in a 프리샷 request');
  assert.equal(await page.locator('#ncs-location').inputValue(),'library');
  await page.locator('[data-mode="chat"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode="chat"]').getAttribute('aria-pressed')==='true');
  assert.equal(await slot.innerText(),'↶ 비우기 취소','챗샷 keeps its undo');
  assert.deepEqual(errors,[]);await page.close();
 }
 {// Generating without a 공통 이미지 프리셋 asks first; 취소 sends nothing, 확인 generates.
  const {page,errors}=await open(375);await page.evaluate(()=>{window.realPresetConfirm=true;});
  let asked=[];page.removeAllListeners('dialog');let answer=false;page.on('dialog',d=>{asked.push(d.message());answer?d.accept():d.dismiss();});
  const sent=()=>page.evaluate(()=>window.__gen??0);
  await page.route('**/api/plugins/naice-shot/generate',r=>{page.evaluate(()=>window.__gen=(window.__gen??0)+1).catch(()=>{});return r.fallback();});
  await page.locator('[data-action="generate"]').click();await page.waitForTimeout(300);
  assert.match(asked[0]??'',/공통 이미지 프리셋을 고르지 않았어요/);assert.match(await page.locator('#ncs-notice').innerText(),/생성하지 않았어요/);
  answer=true;await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
  assert.equal(asked.length,2);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: one 장면 추출 for both modes, common 추출 표현, shared clear slot with per-mode undo, 추가 요청 above extract then under candidates with applied/ignored and requested clothing over a lock, 프리샷 request free of chat data, sticky mode switch, 인물 추가 emphasis, preset question before generating');
}finally{await browser.close();server.close();}
