import {buildImageMessage} from './chat.mjs';
import {isSceneMessage} from './scene-messages.mjs';
import {textSignature,clone} from './core.mjs';
// Shown under each save choice wherever a PNG can be saved.
export const SAVE_NOTES={shared:'프롬프트·seed 등 메타데이터를 제거한 사본이에요.',original:'프롬프트·seed 등 메타데이터를 제거하지 않고 그대로 저장해요.'};
export const SAVE_DETAILS=`<details class="ncs-save-info"><summary>PNG 저장 안내</summary><p>PNG 저장은 원본을 유지해요. 클린 PNG는 프롬프트 메타데이터와 알파 채널 정보를 제거한 불투명 사본을 만들어요. 원본과 이력은 그대로예요. 그림 안에 보이는 이름·글자는 제거하지 않아요.</p></details>`;
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
 if(!isSceneMessage(message))return [];
 return (Array.isArray(message.extra?.[IMAGE_KEY])?message.extra[IMAGE_KEY]:[]).filter(item=>{
  try{imageDownload(item);return item.swipeId===(message.swipe_id??0)&&item.signature===textSignature(message.mes);}catch{return false;}
 });
}
function syncActiveSwipe(message) {
 const swipe=message.swipe_info?.[message.swipe_id??0];
 if(swipe&&typeof swipe==='object')swipe.extra=clone(message.extra);
}
export async function attachInlineImage(context,item,options={}) {
 const {added,duplicates,targetIndex}=await attachInlineImages(context,[item],options);
 return {duplicate:duplicates>0&&!added,targetIndex};
}
// 0.1.72: several pictures go into one message with one chat save (선택 본문에 넣기).
export async function attachInlineImages(context,items,{targetIndex,isCurrent=()=>true}={}) {
 for(const item of items)imageDownload(item);
 if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅에서 다시 선택해 주세요.');
 if(!Array.isArray(context.chat)||typeof context.saveChat!=='function')throw new Error('현재 채팅에 이미지를 저장할 수 없어요.');
 const message=context.chat[targetIndex];
 if(!Number.isInteger(targetIndex)||!isSceneMessage(message))throw new Error('그림을 넣을 RP 메시지를 선택해 주세요.');
 let list=Array.isArray(message.extra?.[IMAGE_KEY])?message.extra[IMAGE_KEY]:[];
 const swipeId=message.swipe_id??0,signature=textSignature(message.mes);let added=0,duplicates=0;
 for(const item of items){
  const entry={id:item.id,image:item.image,swipeId,signature};
  // When it was made and its seed, so the enlarged view from the chat can show them (0.1.63). Nothing private.
  if(typeof item.created==='string'&&!Number.isNaN(Date.parse(item.created)))entry.created=item.created;
  if(Number.isInteger(item.seed))entry.seed=item.seed;
  if(list.some(x=>x.id===item.id&&x.signature===signature&&x.swipeId===swipeId)){duplicates++;continue;}
  if(!list.some(x=>x.id===item.id)&&list.length>=20)throw new Error('한 메시지에는 이미지를 최대 20개까지 넣을 수 있어요.');
  list=[...list.filter(x=>x.id!==item.id),entry];added++;
 }
 if(added){message.extra={...message.extra,[IMAGE_KEY]:list};syncActiveSwipe(message);}
 // No new messages, text edits, native media fields or RP generation events.
 if(added||items.length===1)await context.saveChat();
 return {added,duplicates,targetIndex};
}
export async function detachInlineImage(context,item,options={}) {
 imageDownload(item);
 return detachInlineImages(context,new Set([item.id]),options);
}
// A viewer opened from an attachment removes this message's copy only, including its swipe copies.
export async function detachMessageImage(context,item,{message,swipeId,signature,isCurrent=()=>true}={}) {
 imageDownload(item);
 if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅에서 다시 선택해 주세요.');
 if(!context.chat?.includes(message)||
    (message.swipe_id??0)!==swipeId||textSignature(message.mes)!==signature||!visibleInlineImages(message).some(x=>x.id===item.id))
  throw new Error('메시지나 리롤이 바뀌었어요. 해당 그림을 다시 열어 주세요.');
 const edits=[];
 for(const owner of [message,...(message.swipe_info??[]).filter(x=>x&&typeof x==='object')]){
  const old=owner.extra,list=old?.[IMAGE_KEY];if(!Array.isArray(list)||!list.some(x=>x.id===item.id))continue;
  const remaining=list.filter(x=>x.id!==item.id),next={...old};
  if(remaining.length)next[IMAGE_KEY]=remaining;else delete next[IMAGE_KEY];
  edits.push({owner,old,next});owner.extra=next;
 }
 try { await context.saveChat(); }
 catch(e){for(const {owner,old,next} of edits)if(owner.extra===next)owner.extra=old;throw e;}
 return {removed:edits.length};
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
// 0.1.71: several pictures in one message show as 넘겨보기 (one at a time), 격자 or 세로, in three sizes.
export const INLINE_LAYOUTS=['slide','grid','stack'],INLINE_SIZES=['small','medium','large'];
// 0.1.73: 넘겨보기 shows one picture in its usual place and ‹ n/m › under it. Buttons only: no swipe, so nothing here
// competes with SillyTavern's own sideways swipe (reroll).
function slideControls(holder,tiles){
 const count=tiles.length,bar=document.createElement('div');bar.className='ncs-inline-slide-bar';
 const make=(dir,label,text)=>{const b=document.createElement('button');b.type='button';b.className=`ncs-inline-slide-${dir}`;b.setAttribute('aria-label',label);b.textContent=text;return b;};
 const prev=make('prev','이전 그림','‹'),next=make('next','다음 그림','›'),position=document.createElement('span');position.className='ncs-inline-slide-count';
 let shown=0;
 const show=i=>{shown=Math.min(count-1,Math.max(0,i));tiles.forEach((t,k)=>t.classList.toggle('ncs-current',k===shown));position.textContent=`${shown+1} / ${count}`;prev.disabled=shown<=0;next.disabled=shown>=count-1;};
 const go=step=>event=>{event.preventDefault();event.stopPropagation();show(shown+step);};
 prev.addEventListener('click',go(-1));next.addEventListener('click',go(1));
 bar.append(prev,position,next);holder.append(bar);show(0);
}
export function renderInlineImages(context,root,chatKey,{placement='below',layout='slide',size='medium'}={}) {
 const where=placement==='above'?'above':'below';
 const shape=INLINE_LAYOUTS.includes(layout)?layout:'slide',scale=INLINE_SIZES.includes(size)?size:'medium';
 if(!root)return;
 for(const element of root.querySelectorAll('.mes[mesid]')){
  const index=Number(element.getAttribute('mesid')),message=context.chat?.[index];
  const items=visibleInlineImages(message),signature=JSON.stringify([where,shape,scale,items]);
  let holder=element.querySelector('.ncs-inline-images');
  if(!items.length){holder?.remove();continue;}
  if(holder?.dataset.signature===signature&&holder.dataset.chatKey===chatKey)continue;
  holder?.remove();holder=document.createElement('div');holder.className='ncs-inline-images';holder.dataset.signature=signature;holder.dataset.chatKey=chatKey;holder.dataset.placement=where;
  // One picture is simply shown; the layouts only matter for two or more.
  const mode=items.length>1?shape:'stack';holder.dataset.layout=mode;holder.dataset.size=scale;
  const tiles=[];
  for(const item of items){
   const tile=document.createElement('figure');tile.className='ncs-inline-image';
   const img=document.createElement('img');img.src=item.image;img.alt='생성된 장면';img.loading='lazy';
   const open=document.createElement('button');open.type='button';open.className='ncs-inline-open';open.dataset.ncsInlineView=item.id;open.setAttribute('aria-label','생성된 장면 크게 보기');open.append(img);
   const remove=document.createElement('button');
   // A deleted or missing file shows a note instead of a broken image; the remove button stays.
   img.addEventListener('error',()=>{tile.classList.add('ncs-missing');open.disabled=true;remove.hidden=false;const note=document.createElement('span');note.className='ncs-missing-note';note.textContent='삭제됐거나 찾을 수 없는 그림이에요.';open.replaceChildren(note);},{once:true});
   remove.type='button';remove.dataset.ncsInlineRemove=item.id;remove.textContent='이 메시지에서 빼기';
   // 0.1.63: no ⋯ over the picture. Saving, removing and deleting live in the enlarged view (tap the picture);
   // only a picture whose file is gone shows a plain [이 메시지에서 빼기] under its note.
   remove.className='ncs-inline-remove';remove.hidden=true;tile.append(open,remove);holder.append(tile);tiles.push(tile);
  }
  if(mode==='slide')slideControls(holder,tiles);
  const text=element.querySelector('.mes_text');
  if(text)where==='above'?text.before(holder):text.after(holder);else (element.querySelector('.mes_block')??element)[where==='above'?'prepend':'append'](holder);
 }
}
