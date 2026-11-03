// Stage one: compact actions, shared prompt viewer and message-scoped attachment removal.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (~c)>>>0;};
const chunk=(t,data)=>{const name=Buffer.from(t),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,data])),out.length-4);return out;};
const w=400,h=300,ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
const pixels=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;pixels[o]=70;pixels[o+1]=110+x%100;pixels[o+2]=170;}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
const fontRoot=process.env.NAICE_TEST_FONTS;
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/naice-shot/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 if(fontRoot&&rel.startsWith('/test-font/')){const f=path.join(fontRoot,rel.slice(11));if(!f.startsWith(fontRoot+'/'))throw Error();res.setHeader('Content-Type',f.endsWith('.css')?'text/css':'font/woff2');res.end(await fs.readFile(f));return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/'))throw Error();
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
try{
 for(const width of [1100,375,320]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],items=[],requests=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copied=text;}}});});
  await page.route('**/api/plugins/naice-shot/**',async route=>{
   const url=new URL(route.request().url());requests.push(url.pathname);
   if(url.pathname.endsWith('/status'))return route.fulfill({json:{keyConfigured:true,version:'0.1.8',features:['paged-history','delete','private-records','all-history','privacy-controls'],subscription:{tier:3,perks:{unlimitedImageGeneration:true}}}});
   if(url.pathname.endsWith('/generate')){const b=route.request().postDataJSON(),item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,assembled:b.assembled,options:b.options,snapshot:b.snapshot};items.unshift(item);return route.fulfill({json:item});}
   if(url.pathname.endsWith('/history')){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||20);return route.fulfill({json:{items:items.slice(offset,offset+limit),total:items.length,hasMore:offset+limit<items.length}});}
   throw Error(`Unexpected request: ${url.pathname}`);
  });
  await fs.mkdir('/tmp/naice-stage1',{recursive:true});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  if(fontRoot){await page.addStyleTag({content:'@import url("/test-font/400.css"); @import url("/test-font/700.css"); body {font-family:"Noto Sans KR",sans-serif} .ncsv-prompt-text {font-family:"Noto Sans KR",sans-serif!important}'});await page.evaluate(()=>document.fonts.ready);}
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
  await page.locator('#ncs-gen-box > summary').click();await page.locator('[data-gen="model"]').selectOption('nai-diffusion-4-5-full');
  assert.match(await page.locator('#ncs-character-help').innerText(),/최대 6명/);
  await page.locator('[data-gen="model"]').selectOption('nai-diffusion-5-full');
  assert.match(await page.locator('#ncs-character-help').innerText(),/최대 22명/);
  await page.locator('[data-gen="model"]').selectOption('nai-diffusion-4-5-full');
  await page.locator('details').filter({has:page.locator('#ncs-raw')}).locator('summary').click();await page.locator('#ncs-raw-copy').click();
  assert.match(await page.evaluate(()=>window.copied),/characters/);
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();
  await page.locator('[data-tab="history"]').click();const card=page.locator('.ncs-history-card').first();await card.waitFor();
  assert.equal(await card.locator('[data-prompt-view]').count(),0);
  assert.deepEqual(await card.locator('button:visible').allTextContents(),['','저장','삭제','⋯']);
  assert.doesNotMatch(await card.innerText(),/seed|:\d\d:\d\d/,'card shows the date to the minute, no seed');
  await card.scrollIntoViewIfNeeded();
  if(fontRoot)await page.screenshot({path:`/tmp/naice-stage1/history-${width}.png`});
  const more=card.locator('[data-image-more]:not(.ncs-save-toggle)');await more.click();const popup=card.locator('.ncs-image-popup:not(.ncs-save-popup)');
  assert.deepEqual((await popup.locator('button').allInnerTexts()).map(t=>t.split('\n')[0]),['챗샷으로 보내기','프리샷으로 보내기','설정을 프리셋으로','본문에 넣기','메시지로 가기']);await page.keyboard.press('Escape');
  const saveToggle=card.locator('.ncs-save-toggle'),savePopup=card.locator('.ncs-save-popup');await saveToggle.click();assert.equal(await saveToggle.getAttribute('aria-expanded'),'true');
  assert.deepEqual((await savePopup.locator('button,a').allInnerTexts()).map(t=>t.split('\n')[0]),['클린 PNG','원본 PNG']);await saveToggle.click();assert.equal(await savePopup.isHidden(),true,'the button folds it again');
  await saveToggle.click();await page.mouse.click(2,2);assert.equal(await savePopup.isHidden(),true,'a click elsewhere closes it');
  await more.click();await popup.waitFor({state:'visible'});
  let bounds=await popup.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0);
  await page.keyboard.press('Escape');assert.equal(await popup.isHidden(),true);assert.equal(await page.locator('#naice-shot-dialog').evaluate(el=>el.open),true);
  assert.equal(await more.evaluate(el=>el===document.activeElement),true);
  await more.click();await card.locator('[data-history-preset]').click();
  const save=card.locator('[data-history-preset-save]'),cancel=card.locator('[data-history-preset-cancel]');
  const a=await save.boundingBox(),b=await cancel.boundingBox();assert.ok(Math.abs(a.y-b.y)<1&&a.x<b.x,'save/cancel share a row');
  assert.ok(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'naming form fits');await cancel.click();
  await card.locator('.ncs-image-open').click();await page.locator('#ncs-viewer[open]').waitFor();
  await page.locator('.ncsv-prompt > summary').click();const copy=page.locator('#ncs-viewer [data-v="copy"]');await copy.waitFor();await page.waitForFunction(()=>!document.querySelector('[data-v="copy"]').disabled);
  assert.equal(await copy.innerText(),'프롬프트 복사');await copy.click();assert.equal(await copy.innerText(),'복사됨');assert.match(await page.evaluate(()=>window.copied),/\[공통 Positive\]/);
  if(fontRoot){await fs.mkdir('/tmp/naice-stage1',{recursive:true});await page.screenshot({path:`/tmp/naice-stage1/prompt-${width}.png`});}
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('blocked');};document.execCommand=()=>false;});
  await copy.click();assert.equal(await copy.innerText(),'프롬프트 복사');assert.match(await page.locator('.ncsv-copy-status').innerText(),/복사하지 못/);
  await page.locator('#ncs-viewer [data-v="close"]').click();await page.locator('[data-tab="scene"]').click();
  const target=page.locator('#ncs-result [data-image-target]');await target.selectOption('0');await page.locator('[data-action="attach"]').click();await page.locator('#chat .mes[mesid="0"] .ncs-inline-open').waitFor();
  await target.selectOption('1');await page.locator('[data-action="attach"]').click();await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').waitFor();
  await page.locator('[data-action="close"]').click();
  const first=page.locator('#chat .mes[mesid="0"]');assert.equal(await first.locator('[data-ncs-inline-remove]').isVisible(),false);
  await first.locator('.ncs-inline-more').click();await first.locator('.ncs-image-popup').waitFor({state:'visible'});
  assert.equal(await first.locator('[data-ncs-inline-remove]').innerText(),'이 메시지에서 빼기');
  if(fontRoot)await page.screenshot({path:`/tmp/naice-stage1/inline-${width}.png`});
  await page.keyboard.press('Escape');await first.locator('.ncs-inline-open').click();
  assert.equal(await page.locator('#ncs-viewer [data-v="detach"]').isVisible(),true);assert.equal(await page.locator('#ncs-viewer [data-v="delete"]').isVisible(),false);
  await page.locator('#ncs-viewer [data-v="detach"]').click();await page.locator('#ncs-viewer').waitFor({state:'hidden'});
  assert.equal(await first.locator('.ncs-inline-open').count(),0);assert.equal(await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').count(),1);assert.ok(!requests.some(x=>x.endsWith('/delete')));
  // A stale viewer must not remove the edited message's attachment.
  await page.locator('#chat .mes[mesid="1"] .ncs-inline-open').click();await page.evaluate(()=>mock.chat[1].mes+=' changed');await page.locator('#ncs-viewer [data-v="detach"]').click();
  await page.waitForFunction(()=>/メッセージ|메시지나 리롤/.test(document.querySelector('.ncsv-meta').textContent));
  assert.equal(await page.evaluate(()=>mock.chat[1].extra.naice_shot_images.length),1);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: stage-one labels and model limits, compact history/inline menus and Escape, horizontal preset form, raw/final prompt copying in the viewer, same-image attachments removed from one message only, stale-source guard, 1100/375/320px');
}finally{await browser.close();server.close();}
