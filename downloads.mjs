import { imageDownload } from './inline-images.mjs';

// Re-encode pixels, rather than just dropping text chunks: NovelAI also uses
// the alpha channel for stealth PNG metadata. Originals on disk are untouched.
export async function cleanPng(blob) {
  if(blob.size>30*1024*1024)throw new Error('공유용으로 저장하기에는 파일이 너무 커요.');
  const url=URL.createObjectURL(blob),img=new Image();
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('그림을 읽는 시간이 초과됐어요.')),20000);
      img.onload=()=>{clearTimeout(timer);resolve();};
      img.onerror=()=>{clearTimeout(timer);reject(new Error('그림을 읽지 못했어요. 원본으로 대체 저장하지 않았어요.'));};
      img.src=url;
    });
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>4194304)throw new Error('공유용 PNG의 이미지 크기를 확인해 주세요.');
    const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('이 브라우저에서 공유용 PNG를 만들 수 없어요.');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0);
    return await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('공유용 PNG를 만들지 못했어요. 원본으로 대체 저장하지 않았어요.')),'image/png'));
  } finally {img.onload=null;img.onerror=null;img.src='';URL.revokeObjectURL(url);}
}

export async function cleanImageFile(item) {
  const file=imageDownload(item),response=await fetch(file.url,{cache:'no-store'});
  if(!response.ok)throw new Error('저장할 그림 파일을 찾지 못했어요.');
  const blob=await cleanPng(await response.blob());
  return {blob,filename:file.filename.replace(/\.png$/,'-shared.png')};
}

export async function saveCleanImage(item) {
  const {blob,filename}=await cleanImageFile(item),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
