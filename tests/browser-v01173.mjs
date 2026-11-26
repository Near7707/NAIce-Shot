// 0.1.173 Clean PNG keeps a transparent background (user decision).
// A picture with NovelAI-style stealth data in the lowest alpha bit (the "stealth_pngcomp" magic, read column by column
// as NovelAI's nai_meta.py does) and a real transparent background goes through cleanPng:
// 1. the input really carries the magic (the reader works), the output does not — and every lowest alpha bit now
//    follows its value's top half, so no hidden bit is left;
// 2. fully transparent stays 0, fully opaque (254/255) becomes 255, half-transparent edges move by at most 1/255,
//    opaque colours are unchanged; the PNG text chunk is gone;
// 3. an opaque NovelAI-style picture (alpha 254/255 only) is still merged onto white exactly as before (all 255).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return ~c>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const W=64,H=64,MAGIC='stealth_pngcomp';
// Column-major bit order, as nai_meta.py (alpha.T.reshape(-1)): bit k is pixel (x=floor(k/H), y=k%H).
const bits=[...Buffer.from(MAGIC+'PRIVATE_PROMPT_MARKER')].flatMap(b=>[7,6,5,4,3,2,1,0].map(s=>(b>>s)&1));
function picture(transparent){
  const raw=Buffer.alloc((W*4+1)*H),alpha=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const k=x*H+y,bit=bits[k]??(k%3===0?1:0),inside=x>=16&&x<48&&y>=16&&y<48,edge=!inside&&x>=12&&x<52&&y>=12&&y<52;
    const base=!transparent?254:inside?254:edge?(x%2?100:200):0,a=base+bit,o=y*(W*4+1)+1+x*4;
    raw.set([200,40,90,a],o);alpha.push(a);
  }
  const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('tEXt',Buffer.from('Comment\0PRIVATE_PROMPT_MARKER')),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const server=http.createServer(async(req,res)=>{try{
  const rel=new URL(req.url,'http://localhost').pathname;
  if(rel==='/')return res.setHeader('Content-Type','text/html'),res.end('<!doctype html><title>t</title>');
  const file=path.join(root,rel);if(!file.startsWith(root+path.sep))throw Error();
  res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const tp=picture(true);
  // 1. the reader finds the magic in the input
  const inBytes=Array.from(tp);
  const raw=await page.evaluate(async([bytes,n])=>{const bmp=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);const d=x.getImageData(0,0,bmp.width,bmp.height).data;
    const col=[];for(let X=0;X<bmp.width;X++)for(let Y=0;Y<bmp.height;Y++)col.push(d[(Y*bmp.width+X)*4+3]&1);
    const head=[];for(let b=0;b<n;b++){let v=0;for(let s=0;s<8;s++)v=v<<1|col[b*8+s];head.push(v);}return {magic:String.fromCharCode(...head),alpha:Array.from({length:bmp.width*bmp.height},(_,i)=>d[i*4+3])};},[inBytes,MAGIC.length]);
  assert.equal(raw.magic,MAGIC,'the test picture carries the hidden magic');
  const cleanOf=async bytes=>page.evaluate(async([bytes,n])=>{
    const {cleanPng}=await import('/downloads.mjs');const blob=await cleanPng(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
    const out=new Uint8Array(await blob.arrayBuffer());
    const bmp=await createImageBitmap(blob,{premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d');x.drawImage(bmp,0,0);const d=x.getImageData(0,0,bmp.width,bmp.height).data;
    const col=[];for(let X=0;X<bmp.width;X++)for(let Y=0;Y<bmp.height;Y++)col.push(d[(Y*bmp.width+X)*4+3]&1);
    const head=[];for(let b=0;b<n;b++){let v=0;for(let s=0;s<8;s++)v=v<<1|col[b*8+s];head.push(v);}
    return {w:bmp.width,h:bmp.height,magic:String.fromCharCode(...head),alpha:Array.from({length:bmp.width*bmp.height},(_,i)=>d[i*4+3]),
      rgb:Array.from({length:bmp.width*bmp.height},(_,i)=>[d[i*4],d[i*4+1],d[i*4+2]]),hasText:new TextDecoder('latin1').decode(out).includes('PRIVATE_PROMPT_MARKER')};
  },[bytes,MAGIC.length]);
  const out=await cleanOf(inBytes);
  assert.deepEqual([out.w,out.h],[W,H]);
  assert.notEqual(out.magic,MAGIC,'the hidden magic is gone');assert.equal(out.hasText,false,'the text chunk is gone');
  for(let i=0;i<out.alpha.length;i++){
    const a=raw.alpha[i],b=out.alpha[i];
    assert.equal(b&1,b>=128?1:0,`no hidden bit left (${i})`);
    if(a<=1)assert.equal(b,0,`transparent stays 0 (${i})`);
    else if(a>=254){assert.equal(b,255,`opaque becomes 255 (${i})`);assert.deepEqual(out.rgb[i],[200,40,90],'opaque colour unchanged');}
    else assert.ok(Math.abs(a-b)<=1,`edge moves by at most 1 (${i}: ${a} → ${b})`);
  }
  assert.ok(out.alpha.filter(a=>a===0).length>W*H/3,'the background is still transparent');
  // 3. an opaque NovelAI-style picture: merged onto white as before
  const solid=await cleanOf(Array.from(picture(false)));
  assert.ok(solid.alpha.every(a=>a===255),'opaque picture stays fully opaque');assert.notEqual(solid.magic,MAGIC);assert.equal(solid.hasText,false);
  console.log('PASS browser-v01173');
}finally{await browser.close();server.close();}
