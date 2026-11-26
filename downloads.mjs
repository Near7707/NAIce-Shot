import { imageDownload } from './inline-images.mjs';

// Re-encode pixels, rather than just dropping text chunks: NovelAI also uses
// the alpha channel for stealth PNG metadata (the lowest bit of every alpha value). Originals on disk are untouched.
// 0.1.173 (user decision): a picture with real transparency (Transparent BG) keeps it. Its alpha values are rounded
// to an even/odd bit by their own top half (128 and up → lowest bit 1, below → 0), so the hidden bits are gone while
// fully transparent (0) and fully opaque (255) stay exactly as they were; only half-transparent edges move by 1/255.
// Any other picture is merged onto white exactly as before.
export const SOLID_ALPHA=250; // NovelAI's opaque pictures carry 254/255 in the alpha channel (the hidden bits)
export function scrubAlpha(data){for(let i=3;i<data.length;i+=4)data[i]=data[i]>=128?data[i]|1:data[i]&254;return data;}
export function hasTransparency(data){for(let i=3;i<data.length;i+=4)if(data[i]<SOLID_ALPHA)return true;return false;}
export async function cleanPng(blob) {
  if(blob.size>30*1024*1024)throw new Error('클린 PNG로 저장하기에는 파일이 너무 커요.');
  const url=URL.createObjectURL(blob),img=new Image();
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('그림을 읽는 시간이 초과됐어요.')),20000);
      img.onload=()=>{clearTimeout(timer);resolve();};
      img.onerror=()=>{clearTimeout(timer);reject(new Error('그림을 읽지 못했어요. 원본으로 대체 저장하지 않았어요.'));};
      img.src=url;
    });
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>4194304)throw new Error('클린 PNG의 이미지 크기를 확인해 주세요.');
    const keep=transparentCanvas(img);
    if(keep)return await new Promise((resolve,reject)=>keep.toBlob(value=>value?resolve(value):reject(new Error('클린 PNG를 만들지 못했어요. 원본으로 대체 저장하지 않았어요.')),'image/png'));
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('이 브라우저에서 클린 PNG를 만들 수 없어요.');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0);
    return await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('클린 PNG를 만들지 못했어요. 원본으로 대체 저장하지 않았어요.')),'image/png'));
  } finally {img.onload=null;img.onerror=null;img.src='';URL.revokeObjectURL(url);}
}

// The canvas with the scrubbed pixels when the picture has real transparency, or null (then the white copy is made).
function transparentCanvas(img){
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;
  context.drawImage(img,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  if(!hasTransparency(pixels.data)){canvas.width=canvas.height=0;return null;}
  scrubAlpha(pixels.data);context.putImageData(pixels,0,0);return canvas;
}

export async function cleanImageFile(item) {
  const file=imageDownload(item),response=await fetch(file.url,{cache:'no-store'});
  if(!response.ok)throw new Error('저장할 그림 파일을 찾지 못했어요.');
  const blob=await cleanPng(await response.blob());
  return {blob,filename:file.filename.replace(/\.png$/,'-clean.png')};
}

export async function saveCleanImage(item) {
  const {blob,filename}=await cleanImageFile(item),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
