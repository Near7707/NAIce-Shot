// Privacy regression: real browser downloads, PNG text/alpha cleanup and raw retention.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {crc32} from '../zip.mjs';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const width=32,height=16,rows=Buffer.alloc(height*(1+width*4));
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const i=y*(1+width*4)+1+x*4;rows.set([60,120,180,254+((x+y)%2)],i);
}
const chunk=(name,data)=>{const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return out;};
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('tEXt',Buffer.from('Comment\0PRIVATE_PROMPT_MARKER')),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
const records=[],sent=[],errors=[];
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']});
const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.route('**/api/plugins/naice-shot/**',route=>{
 const req=route.request(),u=new URL(req.url());
 if(u.pathname.endsWith('/generate')){const b=req.postDataJSON();sent.push(b);const item={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};records.push(item);return route.fulfill({json:item});}
 if(u.pathname.endsWith('/history'))return route.fulfill({json:{items:records,total:records.length,hasMore:false}});
 return route.fulfill({json:{keyConfigured:true,version:'0.1.7',features:['paged-history','delete','private-records','all-history','privacy-controls'],minClient:'0.1.0'}});
});
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
const downloadBy=async locator=>{const [d]=await Promise.all([page.waitForEvent('download'),locator.click()]);return {name:d.suggestedFilename(),bytes:await fs.readFile(await d.path())};};
function checkClean(bytes){
 assert.equal(bytes.subarray(0,8).equals(png.subarray(0,8)),true);assert.equal(bytes.includes(Buffer.from('PRIVATE_PROMPT_MARKER')),false);
 const types=[];for(let i=8;i<bytes.length;){const n=bytes.readUInt32BE(i);types.push(bytes.toString('ascii',i+4,i+8));i+=n+12;}
 for(const tag of ['tEXt','zTXt','iTXt','eXIf'])assert.equal(types.includes(tag),false,tag);
}
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(()=>{const original=mock.generateRaw;mock.generateRaw=async function(options){return '<think>PRIVATE_REASONING</think>'+await original.call(this,options);};});
 await page.locator('#ncs-extension-settings > summary').click();await page.locator('.ncs-launch-button').click();
 await click('extract');await page.locator('[data-character="leo"]').waitFor();await page.locator('#ncs-allow-anlas').check();
 await click('generate');await page.locator('#ncs-result img').waitFor();
 assert.equal('rawExtraction' in sent[0].snapshot,false);assert.equal(sent[0].retainRawExtraction,false);
 const original=await downloadBy(page.locator('#ncs-result a[download]'));assert.deepEqual(original.bytes,png);
 const clean=await downloadBy(page.locator('#ncs-result [data-clean-save]'));assert.match(clean.name,/-shared\.png$/);checkClean(clean.bytes);
 // Decode the actual cleaned PNG again: its alpha channel must be completely opaque.
 const pixels=await page.evaluate(async bytes=>{
  const img=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
  const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
  const data=ctx.getImageData(0,0,img.width,img.height).data;return {w:img.width,h:img.height,opaque:data.every((v,i)=>i%4!==3||v===255)};
 },Array.from(clean.bytes));assert.deepEqual(pixels,{w:width,h:height,opaque:true});
 // Result viewer, including narrow mobile layout.
 await page.locator('#ncs-result [data-view-result]').first().click();await page.setViewportSize({width:375,height:760});
 assert.ok(await page.locator('.ncsv-bar').evaluate(el=>el.scrollWidth<=el.clientWidth));
 checkClean((await downloadBy(page.locator('#ncs-viewer [data-v="clean"]'))).bytes);
 await page.locator('#ncs-viewer [data-v="close"]').click();
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-retain-raw').check();
 await page.locator('[data-tab="scene"]').click();await click('generate');await page.waitForFunction(()=>document.querySelectorAll('#ncs-history .ncs-history-card').length===2);
 assert.equal(sent[1].retainRawExtraction,true);assert.doesNotMatch(sent[1].snapshot.rawExtraction,/PRIVATE_REASONING|<think>/);
 await click('attach');await click('close');
 checkClean((await downloadBy(page.locator('[data-ncs-inline-clean]').first())).bytes);
 await page.locator('.ncs-launch-button').click();await page.locator('[data-tab="history"]').click();await click('select-all-history');
 const zip=await downloadBy(page.locator('[data-action="save-selected-clean"]'));assert.match(zip.name,/shared-.*-2\.zip$/);
 const entries=JSON.parse(execFileSync('python3',['-c','import sys,zipfile,io,json\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nprint(json.dumps([list(z.read(n)) for n in z.namelist()]))'],{input:zip.bytes}).toString());
 assert.equal(entries.length,2);entries.forEach(x=>checkClean(Buffer.from(x)));
 await page.locator('[data-tab="settings"]').click();const backup=await page.evaluate(()=>JSON.stringify(mock.extensionSettings.naice_shot));
 await page.locator('#ncs-import').setInputFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.retainRawExtraction===false);
 assert.equal(await page.locator('#ncs-retain-raw').isChecked(),false);
 assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 const unsafe=await page.evaluate(async()=>{const {cleanImageFile}=await import('/downloads.mjs');try{await cleanImageFile({id:'00000000-0000-4000-8000-000000000001',image:'https://outside.invalid/private.png'});return false;}catch{return true;}});assert.equal(unsafe,true);
 const invalid=await page.evaluate(async()=>{const {cleanPng}=await import('/downloads.mjs');try{await cleanPng(new Blob(['invalid PNG']));return false;}catch{return true;}});assert.equal(invalid,true);
 assert.deepEqual(errors,[]);
 console.log('PASS: original bytes preserved; shared PNG text metadata removed and alpha opaque; result/viewer/inline/selected-ZIP downloads; mobile fit; raw opt-in and backup reset; unsafe/broken inputs rejected');
}finally{await browser.close();server.close();}
