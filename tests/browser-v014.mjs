// 0.1.4: save selected history images (one PNG, or one ZIP for several), and checkboxes that stay
// visible on every skin even when a SillyTavern theme restyles all checkboxes with !important.
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const ids=[1,2,3,4].map(i=>`00000000-0000-4000-8000-00000000000${i}`),missingId=ids[3];
const items=ids.map((id,i)=>({id,created:new Date(2026,9,23,10,i).toISOString(),chatKey:'',image:`/user/images/naice-shot/${id}.png`,seed:i,options:{},assembled:{base:'',negative:'',characters:[]}}));
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname,m=rel.match(/^\/user\/images\/naice-shot\/([0-9a-f-]+)\.png$/);
 if(m){if(m[1]===missingId){res.writeHead(404).end();return;}res.setHeader('Content-Type','image/png');res.end(Buffer.concat([png,Buffer.from(m[1])]));return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'naice-save-'));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/plugins/naice-shot/**',route=>{const u=new URL(route.request().url());
 if(u.pathname.endsWith('/history'))return route.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',chats:[],imageCount:items.length,bytes:400}});
 route.fulfill({json:{keyConfigured:true,version:'0.1.3',features:['paged-history','delete','private-records','all-history'],minClient:'0.1.0'}});});
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
const zipNames=file=>JSON.parse(execFileSync('python3',['-I','-c',"import zipfile,sys,json\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None\nprint(json.dumps([[i.filename,z.read(i)[-36:].decode()] for i in z.infolist()]))",file]).toString());
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 // A hostile theme: SillyTavern-like checkbox rules plus custom CSS forcing every checkbox and tick.
 await page.addStyleTag({content:`input[type=checkbox]{appearance:none;background-color:#fff!important;border:1px solid #fff!important;filter:brightness(1.2)!important;overflow:hidden!important}
  input[type=checkbox]::before{content:""!important;box-shadow:inset 1em 1em #fff!important;background:#fff!important;transform:scale(0)}
  input[type=checkbox]:checked::before{transform:scale(1)}input[type=checkbox]::after{content:"x"!important}`});
 await page.locator('#ncs-extension-settings > summary').click();await page.locator('.ncs-launch-button').click();
 await page.locator('[data-tab="history"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===4);
 const save=page.locator('[data-action="save-selected"]');
 assert.equal(await save.isDisabled(),true,'nothing selected yet');

 // 1) One image: plain PNG download.
 await page.locator(`[data-history-pick="${ids[0]}"]`).check();
 assert.equal(await save.textContent(),'선택 저장 (1)');
 let [download]=await Promise.all([page.waitForEvent('download'),save.click()]);
 assert.equal(download.suggestedFilename(),`naice-shot-${ids[0]}.png`);

 // 2) Several images, one missing on disk: one ZIP with the rest, oldest first, and a note.
 await click('select-all-history');assert.equal(await save.textContent(),'선택 저장 (4)');
 [download]=await Promise.all([page.waitForEvent('download'),save.click()]);
 assert.match(download.suggestedFilename(),/^naice-shot-\d{8}-\d{4}-3\.zip$/);
 const file=path.join(tmp,'sel.zip');await download.saveAs(file);
 assert.deepEqual(zipNames(file),ids.slice(0,3).map(id=>[`naice-shot-${id}.png`,id]),'each PNG intact, in creation order');
 await page.waitForFunction(()=>/3장을 ZIP 파일 하나로 저장했어요.*찾지 못한 1장은 빠졌어요/.test(document.querySelector('#ncs-notice').textContent));
 assert.equal(await page.locator('#ncs-history [data-history-pick]:checked').count(),4,'selection stays after saving');
 assert.equal(await save.isDisabled(),false);

 // 3) Checkboxes stay readable on every skin despite the hostile theme.
 const skins=await page.locator('#ncs-skins input[name="ncs-skin"]').evaluateAll(els=>els.map(e=>e.value));
 for(const skin of skins){
  await page.locator('[data-tab="settings"]').click();await page.locator(`.ncs-skin:has(input[value="${skin}"])`).click();
  await page.waitForFunction(s=>document.querySelector('#naice-shot-dialog').dataset.skin===s||s==='classic',skin);
  await page.locator('[data-tab="history"]').click();await page.waitForTimeout(250);
  const look=await page.locator(`[data-history-pick="${ids[0]}"]`).evaluate(el=>{const box=getComputedStyle(el),mark=getComputedStyle(el,'::before'),after=getComputedStyle(el,'::after');
   return {box:box.backgroundColor,mark:mark.backgroundColor,shadow:mark.boxShadow,scale:mark.transform,after:after.content,filter:box.filter,w:box.width};});
  const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
  const [a,b]=[lum(rgb(look.box)),lum(rgb(look.mark))],ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.ok(ratio>=4.5,`${skin}: checkmark ${look.mark} on ${look.box} is only ${ratio.toFixed(2)}:1`);
  assert.equal(look.shadow,'none',`${skin}: theme tick shadow ignored`);assert.equal(look.scale,'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(look.after,'none');assert.equal(look.filter,'none');assert.equal(look.w,'20px');
 }

 // 4) Mobile: the history toolbar with the new button fits.
 await page.setViewportSize({width:375,height:760});
 assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.deepEqual(errors,[]);
 console.log(`PASS: single PNG save, multi-select ZIP (missing file skipped, order kept, selection kept), checkmark >=4.5:1 on ${skins.length} skins under a hostile theme, 375px`);
}finally{await browser.close();server.close();await fs.rm(tmp,{recursive:true,force:true});}
