// v0.1.56 (GPT review of 0.1.55): "혼자" leaves a kept temporary person out of the picture (UI-055-02); requested
// clothing uses the matched, cleaned scene (UI-055-03); a request changed during extraction drops the old result
// (UI-055-04); the applied line belongs to the candidate it was applied to (UI-055-05).
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
const names=page=>page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value).characters.map(c=>c.name));
const one=(c,extra={})=>({moments:[{title:'앉는다',characters:[c],unregistered:[],location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''}],defaultIndex:0,requestMatched:true,requestApplied:[],requestIgnored:[],requestOutfits:[],requestVisibleOnly:false,...extra});
const leo=(extra={})=>({id:'leo',name:'Leo',expression:'calm',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:'',...extra});
const run=async(page,wish,extraction)=>{await page.evaluate(x=>{mock.extraction=x;},extraction);await page.locator('#ncs-moment-wish').fill(wish);await page.locator('[data-action="extract"]').click();await idle(page);};
try{
 {// UI-055-02
  const {page,errors}=await open(375);
  await page.locator('[data-action="add-temp"]').click();await page.locator('[data-temp="name"]').last().fill('Kai');
  assert.deepEqual(await names(page),['Leo','Kai']);
  await run(page,'Leo 혼자',one(leo(),{requestApplied:['혼자'],requestVisibleOnly:true}));
  assert.deepEqual(await names(page),['Leo'],'the kept temporary person is left out');
  assert.equal(await page.locator('[data-temp="name"]').count(),1,'its card stays');
  assert.equal(await page.locator('[data-temp="name"]').locator('xpath=ancestor::article').locator('[data-field="included"]').isChecked(),false);
  // Without such a request the kept person is drawn again.
  await run(page,'',one(leo()));assert.deepEqual(await names(page),['Leo','Kai']);
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-055-03
  const {page,errors}=await open(375);
  await page.evaluate(()=>{mock.chatMetadata.naice_shot={outfits:{leo:{value:'navy coat',locked:true}}};});
  await run(page,'빨간 코트',one(leo({id:'wrong-id',outfitMode:'replace',outfit:'red coat'}),{requestApplied:['빨간 코트'],requestOutfits:[{id:'wrong-id',name:'Leo',outfit:'red coat'}]}));
  const once=page.locator('[data-character="leo"] [data-field="manualOutfit"]');
  assert.equal(await once.inputValue(),'red coat','matched by name after identity matching, despite the lock');
  await run(page,'빨간 코트, 파란 머리',one(leo({outfitMode:'replace',outfit:"Leo's red coat, blue hair"}),{requestApplied:['빨간 코트'],requestOutfits:[{id:'leo',name:'Leo',outfit:"Leo's red coat, blue hair"}]}));
  const v=await once.inputValue();assert.doesNotMatch(v,/blue hair|Leo/,'no fixed look or name in the outfit');assert.match(v,/red coat/);
  assert.match(await page.locator('#ncs-request-applied').innerText(),/반영하지 않음:.*머리·눈 등 · 프로필 고정 외형/);
  assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>JSON.parse(document.querySelector('#ncs-final').value))),/blue hair/);
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-055-04
  const {page,errors}=await open(375);
  await page.evaluate(x=>{mock.extraction=x;let done;mock.extractionDeferred=new Promise(r=>done=r);mock.finishExtraction=()=>{const p=mock.extractionDeferred;mock.extractionDeferred=null;done(JSON.stringify(x));return p;};},one(leo(),{requestApplied:['밤']}));
  await page.locator('#ncs-moment-wish').fill('밤으로');await page.locator('[data-action="extract"]').click();
  await page.waitForFunction(()=>!document.querySelector('#ncs-progress').hidden);
  await page.locator('#ncs-moment-wish').fill('아침으로');await page.evaluate(()=>mock.finishExtraction());await idle(page);
  assert.match(await page.locator('#ncs-notice').innerText(),/추가 요청이 바뀌어서 결과를 적용하지 않았어요/);
  assert.equal(await page.locator('#ncs-lighting').inputValue(),'sunlight','the old result was not applied');
  assert.equal(await page.locator('#ncs-request-applied').isVisible(),false);
  assert.deepEqual(errors,[]);await page.close();
 }
 {// UI-055-05
  const {page,errors}=await open(375);
  const two={moments:[{title:'들어온다',characters:[leo({action:'walking in'})],unregistered:[],location:'cafe',lighting:'sunlight',camera:'medium shot',interaction:''},{title:'앉는다',characters:[leo()],unregistered:[],location:'cafe',lighting:'moonlight',camera:'medium shot',interaction:''}],defaultIndex:1,requestMatched:true,requestApplied:['밤'],requestIgnored:[],requestOutfits:[],requestVisibleOnly:false};
  await run(page,'앉은 모습을 밤으로',two);
  assert.match(await page.locator('#ncs-request-applied').innerText(),/추가 요청 반영: 밤/);
  await page.locator('.ncs-moment[data-moment="0"]').click();
  assert.equal(await page.locator('#ncs-lighting').inputValue(),'sunlight');assert.equal(await page.locator('#ncs-request-applied').isVisible(),false,'not shown on another candidate');
  await page.locator('.ncs-moment[data-moment="1"]').click();assert.match(await page.locator('#ncs-request-applied').innerText(),/추가 요청 반영: 밤/);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: "혼자" leaves a kept temporary person out (card kept), requested clothing matched by name and cleaned of fixed-look words, a request changed mid-extraction drops the old result, applied line follows its candidate');
}finally{await browser.close();server.close();}
