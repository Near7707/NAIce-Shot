// 0.1.32: extraction limits and stability — new users start at 8192 / one message, existing users keep their
// values and get a "권장값 적용" button, an optional temperature for a separate connection only, cut-off replies
// are reported without calling the last surviving candidate the final moment, and hand-picked positions survive.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const person=(action,position='auto')=>({id:'leo',name:'Leo',expression:'smile',action,position,outfitMode:'unchanged',outfit:''});
const moment=(title,action)=>({title,characters:[person(action)],unregistered:[],interaction:'',location:'cafe',lighting:'',camera:''});
const three={moments:[moment('창가에서 책 읽는 순간','reading book'),moment('핸드폰으로 메시지 보내는 순간','holding phone, typing'),moment('문으로 걸어가는 순간','walking to door')],defaultIndex:2,requestMatched:true};
async function load(init=''){
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/plugins/naice-shot/**',route=>route.fulfill({json:{items:[],total:0,hasMore:false}}));
 if(init)await page.addInitScript(new Function(init));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 return {page,errors};
}
const extract=async page=>{const before=await page.evaluate(()=>(mock.extractCalls??0)+(mock.profileCalls??0));await page.locator('[data-action="extract"]').click();
 await page.waitForFunction(n=>(mock.extractCalls??0)+(mock.profileCalls??0)>n&&document.querySelector('#ncs-progress').hidden,before);};
try{
 // A brand-new user starts with 8192 and one message (the target only).
 let {page,errors}=await load("document.addEventListener('DOMContentLoaded',()=>{delete mock.extensionSettings.naice_shot;});");
 assert.equal(await page.evaluate(()=>[mock.extensionSettings.naice_shot.extractionMaxTokens,mock.extensionSettings.naice_shot.recent].join()),'8192,1');
 assert.equal(await page.locator('#ncs-recent').inputValue(),'1');assert.match(await page.locator('[data-page="scene"]').innerText(),/보낼 메시지 수 · 대상 포함/);
 assert.deepEqual(errors,[]);await page.close();

 // An existing user keeps 4096 and 3 until they press the recommended button (which leaves the message count alone).
 ({page,errors}=await load("document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.extractionMaxTokens=4096;mock.extensionSettings.naice_shot.recent=3;});"));
 await page.locator('[data-tab="settings"]').click();assert.equal(await page.locator('#ncs-extraction-max-tokens').inputValue(),'4096');
 await page.locator('#ncs-extraction-more > summary').click();await page.locator('[data-action="extraction-recommended"]').click();
 assert.equal(await page.locator('#ncs-extraction-max-tokens').inputValue(),'8192');assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.extractionMaxTokens),8192);
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.recent),3);
 // Temperature goes only with a separate connection, only for this request; empty sends nothing.
 await page.locator('#ncs-extraction-profile').selectOption('extract-cheap');await page.locator('#ncs-extraction-temperature').fill('0.2');
 await page.evaluate(d=>{mock.extraction=d;},three);await page.locator('[data-tab="scene"]').click();await extract(page);
 assert.equal(await page.evaluate(()=>mock.profileRequest.override.temperature),0.2);assert.equal(await page.evaluate(()=>mock.profileRequest.maxTokens),8192);
 assert.ok(await page.evaluate(()=>!!mock.profileRequest.override.json_schema),'structured output still sent');
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-extraction-temperature').fill('');
 await page.locator('[data-tab="scene"]').click();await extract(page);assert.equal(await page.evaluate(()=>'temperature' in mock.profileRequest.override),false);
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-extraction-temperature').fill('0.2');await page.locator('#ncs-extraction-profile').selectOption('');
 await page.locator('[data-tab="scene"]').click();await extract(page);assert.equal(await page.evaluate(()=>'temperature' in mock.lastExtract),false,'main connection never gets a temperature');
 // A cut-off reply keeps complete candidates, does not call the last of them the final moment, and says how to fix it.
 const text=JSON.stringify(three),cut=text.slice(0,text.indexOf('문으로 걸어가는 순간')+10);
 await page.evaluate(raw=>{mock.generateRaw=async function(o){this.extractCalls=(this.extractCalls??0)+1;this.lastExtract=o;return raw;};},cut);
 await extract(page);
 assert.equal(await page.locator('.ncs-moment').count(),2);assert.doesNotMatch(await page.locator('#ncs-moments').innerText(),/마지막 순간/);
 const n=await page.locator('#ncs-notice').innerText();assert.match(n,/응답이 불완전해요/);assert.match(n,/마지막 순간이 빠졌을 수 있어요/);assert.match(n,/본편 프리셋의 응답 길이/);
 assert.match(await page.locator('.ncs-moment').nth(1).innerText(),/핸드폰으로 메시지 보내는 순간/);
 // A reply cut before any candidate closed fails with the same hint.
 await page.evaluate(raw=>{mock.generateRaw=async function(o){this.extractCalls=(this.extractCalls??0)+1;this.lastExtract=o;return raw;};},text.slice(0,40));
 await extract(page);assert.match(await page.locator('#ncs-notice').innerText(),/추출 실패[\s\S]*응답이 불완전해요/);
 // A complete reply with two candidates is not reported as cut off.
 await page.evaluate(d=>{mock.generateRaw=async function(o){this.extractCalls=(this.extractCalls??0)+1;this.lastExtract=o;return JSON.stringify(d);};},{...three,moments:three.moments.slice(1),defaultIndex:1});
 await extract(page);assert.doesNotMatch(await page.locator('#ncs-notice').innerText(),/불완전/);assert.match(await page.locator('#ncs-moments').innerText(),/마지막 순간/);
 // Korean in descriptive fields: one more request asking for English; the English answer is used.
 const ko={...three,moments:three.moments.map(m=>({...m,location:'카페',characters:[{...m.characters[0],action:'책을 읽는다'}]}))};
 await page.evaluate(([bad,good])=>{let n=0;mock.generateRaw=async function(o){this.extractCalls=(this.extractCalls??0)+1;this.lastExtract=o;return JSON.stringify(n++===0?bad:good);};},[ko,three]);
 await extract(page);
 assert.match(await page.evaluate(()=>mock.lastExtract.prompt),/Your previous reply wrote descriptive fields in a language other than English/);
 assert.equal(await page.locator('#ncs-location').inputValue(),'cafe');assert.ok(await page.evaluate(()=>!!mock.lastExtract.jsonSchema),'the language retry keeps structured output');
 // If the second answer is still Korean, it is used with a note instead of failing.
 await page.evaluate(bad=>{mock.generateRaw=async function(o){this.extractCalls=(this.extractCalls??0)+1;this.lastExtract=o;return JSON.stringify(bad);};},ko);
 await extract(page);assert.match(await page.locator('#ncs-notice').innerText(),/영어로 바뀌지 않은 칸이 있어요\(.*(action|location)/);
 await page.evaluate(d=>{mock.generateRaw=async function(o){this.extractCalls=(this.extractCalls??0)+1;this.lastExtract=o;return JSON.stringify(d);};},{...three,moments:three.moments.slice(1),defaultIndex:1});await extract(page);
 // A position chosen by hand survives re-extracting the same message; the AI's "auto" does not overwrite it.
 await page.locator('[data-character="leo"] [data-field="position"]').selectOption('left');
 await extract(page);
 assert.equal(await page.locator('[data-character="leo"] [data-field="position"]').inputValue(),'left');
 await page.locator('.ncs-moment[data-moment="0"]').click();assert.equal(await page.locator('[data-character="leo"] [data-field="position"]').inputValue(),'left','every candidate keeps it');
 // The prompt tells the AI not to invent placements but to follow stated ones.
 assert.match(await page.evaluate(()=>mock.lastExtract.prompt),/Never choose a side yourself to make a composition/);
 assert.deepEqual(errors,[]);await page.close();
 console.log('PASS: new users 8192 / one message, existing values kept until "권장값 적용", temperature only on a separate connection and only when set, cut-off replies flagged without a false final moment, complete short replies not flagged, hand-picked positions survive re-extraction');
}finally{await browser.close();server.close();}
