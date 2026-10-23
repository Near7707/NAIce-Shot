import {buildImageMessage} from './chat.mjs';
import {textSignature,clone} from './core.mjs';
export const IMAGE_KEY='naice_shot_images';
export function imageDownload(item) {
 buildImageMessage(item);return {url:item.image,filename:`naice-shot-${item.id}.png`};
}
export function countInlineImages(chat) {
 return new Set(chat.flatMap(m=>Array.isArray(m.extra?.[IMAGE_KEY])?m.extra[IMAGE_KEY].map(x=>x.id):[])).size;
}
export function hasInlineImage(chat,item) {
 return chat.some(m=>Array.isArray(m.extra?.[IMAGE_KEY])&&m.extra[IMAGE_KEY].some(x=>x.id===item.id));
}
export function visibleInlineImages(message) {
 if(!message||message.is_system||typeof message.mes!=='string')return [];
 return (Array.isArray(message.extra?.[IMAGE_KEY])?message.extra[IMAGE_KEY]:[]).filter(item=>{
  try{imageDownload(item);return item.swipeId===(message.swipe_id??0)&&item.signature===textSignature(message.mes);}catch{return false;}
 });
}
function syncActiveSwipe(message) {
 const swipe=message.swipe_info?.[message.swipe_id??0];
 if(swipe&&typeof swipe==='object')swipe.extra=clone(message.extra);
}
export async function attachInlineImage(context,item,{targetIndex,isCurrent=()=>true}={}) {
 imageDownload(item);
 if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅에서 다시 선택해 주세요.');
 if(!Array.isArray(context.chat)||typeof context.saveChat!=='function')throw new Error('현재 채팅에 이미지를 저장할 수 없어요.');
 const message=context.chat[targetIndex];
 if(!Number.isInteger(targetIndex)||!message||message.is_system||typeof message.mes!=='string'||!message.mes.trim())throw new Error('그림을 넣을 RP 메시지를 선택해 주세요.');
 const old=Array.isArray(message.extra?.[IMAGE_KEY])?message.extra[IMAGE_KEY]:[];
 const entry={id:item.id,image:item.image,swipeId:message.swipe_id??0,signature:textSignature(message.mes)};
 const duplicate=old.some(x=>x.id===item.id&&x.signature===entry.signature&&x.swipeId===entry.swipeId);
 if(!duplicate){
  if(old.length>=20&&!old.some(x=>x.id===item.id))throw new Error('한 메시지에는 이미지를 최대 20개까지 넣을 수 있어요.');
  message.extra={...message.extra,[IMAGE_KEY]:[...old.filter(x=>x.id!==item.id),entry]};syncActiveSwipe(message);
 }
 // No new messages, text edits, native media fields or RP generation events.
 await context.saveChat();return {duplicate,targetIndex};
}
export async function detachInlineImage(context,item,options={}) {
 imageDownload(item);
 return detachInlineImages(context,new Set([item.id]),options);
}
// Removes every attachment of the given image IDs from the current chat (all messages and swipes), one save.
export async function detachInlineImages(context,ids,{isCurrent=()=>true}={}) {
 if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅에서 다시 선택해 주세요.');
 if(!Array.isArray(context.chat)||typeof context.saveChat!=='function')throw new Error('현재 채팅에서 이미지를 뺄 수 없어요.');
 let removed=0;
 function remove(extra){
  if(!Array.isArray(extra?.[IMAGE_KEY]))return extra;
  const remaining=extra[IMAGE_KEY].filter(x=>!ids.has(x.id));if(remaining.length===extra[IMAGE_KEY].length)return extra;
  removed+=extra[IMAGE_KEY].length-remaining.length;const next={...extra};
  if(remaining.length)next[IMAGE_KEY]=remaining;else delete next[IMAGE_KEY];return next;
 }
 for(const message of context.chat){
  const next=remove(message.extra);if(next!==message.extra)message.extra=next;
  if(Array.isArray(message.swipe_info))for(const swipe of message.swipe_info)if(swipe&&typeof swipe==='object'){const next=remove(swipe.extra);if(next!==swipe.extra)swipe.extra=next;}
 }
 if(removed)await context.saveChat();return {removed};
}

// Independent display metadata keeps generated images out of native media
// prompt processing. Rendering is display-only: placement 'above' or 'below' the RP text never touches message text.
export function renderInlineImages(context,root,chatKey,{placement='below'}={}) {
 const where=placement==='above'?'above':'below';
 if(!root)return;
 for(const element of root.querySelectorAll('.mes[mesid]')){
  const index=Number(element.getAttribute('mesid')),message=context.chat?.[index];
  const items=visibleInlineImages(message),signature=JSON.stringify([where,items]);
  let holder=element.querySelector('.ncs-inline-images');
  if(!items.length){holder?.remove();continue;}
  if(holder?.dataset.signature===signature&&holder.dataset.chatKey===chatKey)continue;
  holder?.remove();holder=document.createElement('div');holder.className='ncs-inline-images';holder.dataset.signature=signature;holder.dataset.chatKey=chatKey;holder.dataset.placement=where;
  for(const item of items){
   const tile=document.createElement('figure');tile.className='ncs-inline-image';
   const img=document.createElement('img');img.src=item.image;img.alt='생성된 장면';img.loading='lazy';
   const open=document.createElement('button');open.type='button';open.className='ncs-inline-open';open.dataset.ncsInlineView=item.id;open.setAttribute('aria-label','생성된 장면 크게 보기');open.append(img);
   const actions=document.createElement('figcaption'),download=document.createElement('a'),remove=document.createElement('button');
   const file=imageDownload(item);download.href=file.url;download.download=file.filename;download.textContent='PNG 저장';
   // A deleted or missing file shows a note instead of a broken image; the remove button stays.
   img.addEventListener('error',()=>{tile.classList.add('ncs-missing');open.disabled=true;download.remove();const note=document.createElement('span');note.className='ncs-missing-note';note.textContent='삭제됐거나 찾을 수 없는 그림이에요.';open.replaceChildren(note);},{once:true});
   remove.type='button';remove.dataset.ncsInlineRemove=item.id;remove.textContent='이미지 빼기';actions.append(download,remove);tile.append(open,actions);holder.append(tile);
  }
  const text=element.querySelector('.mes_text');
  if(text)where==='above'?text.before(holder):text.after(holder);else (element.querySelector('.mes_block')??element)[where==='above'?'prepend':'append'](holder);
 }
}
