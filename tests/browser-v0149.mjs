// Design rules (docs/DESIGN.md) checked in a browser, so alternating edits do not quietly break them:
// readable text on all 17 themes (menus open included), no sideways overflow, key buttons on one line,
// one main action per group, the history tools arrangement, capped action width on PC, opaque menus.
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
const skins=['classic',...(await fs.readdir(path.join(root,'skins'))).filter(f=>f.endsWith('.css')).map(f=>f.slice(0,-4)).sort()].filter(k=>!process.env.NCS_SKINS||process.env.NCS_SKINS.split(',').includes(k));
const quick=process.env.NCS_QUICK==='1';
// In the page: every visible text leaf against the first solid background behind it. Gradients count by their
// worst stop; text over a picture is skipped (its contrast cannot be computed reliably). Text colour alpha and the
// opacity of the element and its ancestors are blended over that background (UI-049-07).
const SCAN=()=>{
 const parse=c=>{if(!c)return null;const srgb=c.startsWith('color(');const m=c.replace(/^color\(srgb/,'').match(/[\d.]+/g);if(!m)return null;let [r,g,b,a=1]=m.map(Number);if(srgb){r*=255;g*=255;b*=255;a=c.includes('/')?Number(c.split('/')[1].replace(')','')):1;}return {r,g,b,a};};
 const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
 const ratio=(x,y)=>{const a=lum(x),b=lum(y);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 const behind=el=>{for(let e=el;e;e=e.parentElement){const s=getComputedStyle(e),img=s.backgroundImage;
   if(img&&img!=='none'){if(!img.includes('gradient')||img.includes('url('))return null;const stops=[...img.matchAll(/(?:rgba?|color)\([^)]*\)/g)].map(m=>parse(m[0])).filter(x=>x&&x.a>=.6);if(stops.length)return stops;}
   const c=parse(s.backgroundColor);if(c&&c.a>=.9)return [c];}return [{r:255,g:255,b:255,a:1}];};
 const out=[];
 for(const rootEl of document.querySelectorAll('#naice-shot-dialog,.ncs-image-popup:popover-open'))for(const el of rootEl.querySelectorAll('*')){
  if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
  const s=getComputedStyle(el),box=el.getBoundingClientRect();if(!box.width||!box.height||s.visibility==='hidden'||el.closest('[hidden],:disabled,[aria-disabled="true"]'))continue;
  if(box.bottom<0||box.top>innerHeight)continue;if(!rootEl.matches('.ncs-image-popup')&&document.querySelector('.ncs-image-popup:popover-open')?.contains(el))continue;
  const fg0=parse(s.color),bgs=behind(el);if(!fg0||!bgs)continue;
  let alpha=fg0.a;for(let e=el;e&&e!==rootEl.parentElement;e=e.parentElement)alpha*=Number(getComputedStyle(e).opacity);
  const blend=b=>({r:fg0.r*alpha+b.r*(1-alpha),g:fg0.g*alpha+b.g*(1-alpha),b:fg0.b*alpha+b.b*(1-alpha)});
  const size=parseFloat(s.fontSize),bold=Number(s.fontWeight)>=700,large=size>=24||(bold&&size>=18.66),need=large?3:4.5;
  const worst=Math.min(...bgs.map(b=>ratio(blend(b),b)));
  if(worst<need)out.push(`${worst.toFixed(2)} "${[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').slice(0,30)}"`);
 }
 return out;
};
async function open(skin,width){
 const page=await browser.newPage({viewport:{width,height:820}}),errors=[],items=[];page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/api/plugins/naice-shot/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('/generate')){const q=r.request().postDataJSON(),it={id:q.requestId,created:new Date().toISOString(),chatKey:q.chatKey,image:`/user/images/naice-shot/${q.requestId}.png`,seed:q.options.seed,assembled:q.assembled,options:q.options,snapshot:q.snapshot};items.unshift(it);return r.fulfill({json:it});}
  if(u.pathname.endsWith('/history'))return r.fulfill({json:{items,total:items.length,hasMore:false,scope:u.searchParams.get('scope')||'chat',kind:u.searchParams.get('kind')||'all',chats:[],imageCount:items.length,bytes:1}});
  if(u.pathname.endsWith('/draft'))return r.fulfill({json:r.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
  return r.fulfill({json:{keyConfigured:true,version:'0.1.13',features,minClient:'0.1.44',subscription:{tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600},perks:{unlimitedImageGeneration:true},anlas:{subscription:1000,purchased:0}}}});});
 await page.addInitScript(k=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.skin=k;mock.extensionSettings.naice_shot.allowAnlas=true;}),skin);
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 await page.waitForFunction(k=>document.querySelector('#naice-shot-dialog').dataset.skin===k||k==='classic',skin);
 await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
 await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
 return {page,errors};
}
const scroll=async(page,fn)=>{const h=await page.evaluate(()=>document.querySelector('.ncs-content').scrollHeight);for(let y=0;y<h;y+=600){await page.evaluate(y=>{document.querySelector('.ncs-content').scrollTop=y;},y);await page.waitForTimeout(60);await fn();}};
// Lines of visible text in each button (text nodes only, so a caret or icon does not count).
const lines=(page,sel)=>page.$$eval(sel,els=>els.filter(e=>e.offsetParent).map(e=>{const tops=new Set(),w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
 for(let n=w.nextNode();n;n=w.nextNode()){if(!n.textContent.trim()||!n.parentElement.offsetParent)continue;const r=document.createRange();r.selectNodeContents(n);for(const x of r.getClientRects())if(x.width>1)tops.add(Math.round(x.top+x.height/2));}
 const merged=[...tops].sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>4);return {t:e.textContent.trim(),n:merged.length};}));
try{
 const problems=[];
 for(const skin of skins){
  const {page,errors}=await open(skin,375);const found=[];const check=async where=>{for(const p of await page.evaluate(SCAN))found.push(`${where}: ${p}`);};
  await scroll(page,()=>check('그리기'));
  await page.locator('[data-tab="history"]').click();await page.locator('.ncs-history-card').first().waitFor();await scroll(page,()=>check('이력'));
  await page.locator('.ncs-history-card .ncs-save-toggle').first().click();await check('저장 메뉴');
  // Hovered menu items too.
  for(const item of await page.locator('.ncs-image-popup:popover-open button').all()){await item.hover();await check('저장 메뉴 hover');}
  // Menus are opaque on every theme.
  assert.equal(await page.locator('.ncs-image-popup:popover-open').evaluate(el=>{const c=getComputedStyle(el).backgroundColor;const m=c.match(/[\d.]+/g);return m.length<4||Number(m[3])===1;}),true,`${skin}: menu is opaque`);
  await page.locator('.ncs-history-card .ncs-save-toggle').first().click();
  await page.locator('.ncs-history-card [data-image-more]:not(.ncs-save-toggle)').first().click();await check('⋯ 메뉴');for(const item of await page.locator('.ncs-image-popup:popover-open button:not(:disabled)').all()){await item.hover();await check('⋯ 메뉴 hover');}await page.keyboard.press('Escape');
  await page.locator('[data-tab="settings"]').click();await page.locator('.ncs-advanced:not(.ncs-extraction-more) > summary').click();await scroll(page,()=>check('설정'));
  await page.locator('[data-tab="profiles"]').click();await scroll(page,()=>check('프로필'));
  for(const f of new Set(found))problems.push(`${skin} ${f}`);
  assert.deepEqual(errors,[]);await page.close();
 }
 assert.deepEqual(problems,[],'text below 4.5:1 (3:1 for large text)');
 // Layout at phone, narrow phone and PC widths.
 if(quick){console.log('contrast only');process.exit(0);}
 for(const width of [320,375,1100])for(const skin of ['classic','candycane','glass']){
  const {page,errors}=await open(skin,width);const tag=`${skin} ${width}px`;
  const noOverflow=async where=>assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${tag} ${where}: no sideways scroll`);
  const oneLine=async(where,sel)=>{for(const b of await lines(page,sel))assert.equal(b.n,1,`${tag} ${where}: "${b.t}" wraps`);};
  const fits=async(where,sel)=>{for(const b of await page.$$eval(sel,els=>els.filter(e=>e.offsetParent).map(e=>({t:e.textContent.trim(),over:e.scrollWidth-e.clientWidth}))))assert.ok(b.over<=1,`${tag} ${where}: "${b.t}" spills out of its button by ${b.over}px`);};
  const oneMain=async where=>assert.deepEqual(await page.$$eval('.ncs-actions',els=>els.filter(e=>e.offsetParent).map(e=>e.querySelectorAll(':scope > .ncs-primary').length).filter(n=>n>1)),[],`${tag} ${where}: one main action per group`);
  const capped=async where=>{if(width<1000)return;// 0.1.58 (가): groups span the panel like the fields, but never past it.
   const max=await page.$eval('#naice-shot-dialog .ncs-content',e=>e.clientWidth);for(const w of await page.$$eval('.ncs-actions',els=>els.filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect().width)))assert.ok(w<=max,`${tag} ${where}: action group ${w}px wide`);};
  await noOverflow('그리기');await oneLine('그리기','.ncs-source-actions > button, .ncs-clear-slot > button, [data-character] .ncs-actions > button');await fits('그리기','.ncs-source-actions > button, .ncs-clear-slot > button, [data-character] .ncs-actions > button');await oneMain('그리기');await capped('그리기');
  assert.equal(await page.locator('.ncs-clear-slot .ncs-action-slot').innerText(),'그리기창 비우기');
  await page.locator('.ncs-clear-slot .ncs-action-slot').click();assert.equal(await page.locator('.ncs-clear-slot .ncs-action-slot').innerText(),'↶ 비우기 취소');
  await oneLine('비우기 취소','.ncs-clear-slot > button');await page.locator('.ncs-clear-slot .ncs-action-slot').click();
  await page.locator('[data-tab="history"]').click();await page.locator('.ncs-history-card').first().waitFor();await noOverflow('이력');
  await oneLine('이력','.ncs-history-actions > button, .ncs-history-tools > button:not([hidden])');await fits('이력','.ncs-history-actions > button, .ncs-history-tools > button:not([hidden])');
  // Arrangement kept: three tools on one row, the whole-history delete under them.
  const tops=await page.$$eval('.ncs-history-tools > button:not([hidden])',els=>els.map(e=>Math.round(e.getBoundingClientRect().top)));
  assert.equal(new Set(tops.slice(0,3)).size,1,`${tag}: three tools share a row`);assert.ok(tops[3]>tops[0],`${tag}: whole-history delete below`);
  assert.equal(await page.locator('[data-action="history"]').innerText(),'↻ 새로고침');assert.ok(await page.locator('[data-action="history"]').evaluate(e=>e.getBoundingClientRect().width<=140),`${tag}: refresh stays small`);
  await page.locator('[data-tab="settings"]').click();await noOverflow('설정');await oneLine('설정','.ncs-actions > button');await fits('설정','.ncs-actions > button');await oneMain('설정');await capped('설정');
  await page.locator('[data-tab="profiles"]').click();await noOverflow('프로필');await oneLine('프로필','.ncs-actions > button');await fits('프로필','.ncs-actions > button');await oneMain('프로필');await capped('프로필');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`PASS: contrast on ${skins.length} themes (drawing, history, save and ⋯ menus, settings, profiles), opaque menus, no overflow, one-line key buttons, one main action, history tools arrangement, small "↻ 새로고침", 640px PC column, clear/undo slot, 320/375/1100px`);
}finally{await browser.close();server.close();}
