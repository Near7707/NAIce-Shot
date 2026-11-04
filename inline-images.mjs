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
// The active swipe keeps its own other keys; only the attachment list follows the message (0.1.77).
function syncActiveSwipe(message) {
 const swipe=message.swipe_info?.[message.swipe_id??0];
 if(!swipe||typeof swipe!=='object')return;
 const next={...swipe.extra},list=message.extra?.[IMAGE_KEY];
 if(Array.isArray(list))next[IMAGE_KEY]=clone(list);else delete next[IMAGE_KEY];
 swipe.extra=next;
}

// --- Verified saving (0.1.77, UI-072-01) --------------------------------------------------------------------------------
// SillyTavern's saveChat() swallows errors, so after a save the chat file is read back (readSaved) and the touched
// attachments are compared. First the target must be the same (message index, send date, reroll, text signature);
// otherwise the answer is "unknown". Then, for the touched items only:
//   all equal the intended state -> saved;  all equal the state before -> not saved, restore those items locally;
//   anything else (mixed, or neither) -> unknown: nothing is reverted and the person is told to check.
const sameState=(a,b)=>a.present===b.present&&a.placement===b.placement;
// The state of one picture in an owner's extra. match: the exact swipe/text the entry belongs to (attach), or null.
function stateOf(extra,id,match=null){
 const list=Array.isArray(extra?.[IMAGE_KEY])?extra[IMAGE_KEY]:[];
 const e=list.find(x=>x?.id===id&&(!match||(x.swipeId===match.swipeId&&x.signature===match.signature)));
 return e?{present:true,placement:PLACEMENTS.includes(e.placement)?e.placement:null}:{present:false,placement:null};
}
const ownerOf=(message,k)=>k==null?message:message?.swipe_info?.[k];
const targetOf=(message,index)=>({index,sendDate:String(message.send_date??''),swipeId:message.swipe_id??0,signature:textSignature(message.mes??'')});
// Call BEFORE changing the owner. k: null for the message itself, otherwise the swipe_info index.
function makeTouch(message,index,k,id,{match=null,intended}) {
 const extra=ownerOf(message,k)?.extra,list=Array.isArray(extra?.[IMAGE_KEY])?extra[IMAGE_KEY]:[];
 const beforeEntries=list.filter(x=>x?.id===id);
 return {message,index,k,id,match,target:targetOf(message,index),before:stateOf(extra,id,match),intended,beforeEntries,beforeAt:list.findIndex(x=>x?.id===id),hadExtra:!!extra};
}
function judge(touches,saved) {
 if(!Array.isArray(saved))return 'unknown';
 let allIntended=true,allBefore=true;
 for(const t of touches){
  const sm=saved[t.index];
  if(!sm||typeof sm!=='object'||String(sm.send_date??'')!==t.target.sendDate||(sm.swipe_id??0)!==t.target.swipeId||textSignature(sm.mes??'')!==t.target.signature)return 'unknown';
  const owner=ownerOf(sm,t.k);if(!owner||typeof owner!=='object')return 'unknown';
  const st=stateOf(owner.extra,t.id,t.match);
  if(!sameState(st,t.intended))allIntended=false;
  if(!sameState(st,t.before))allBefore=false;
 }
 return allIntended?'ok':allBefore?'unsaved':'unknown';
}
// Puts the touched items back locally, one by one. An item changed by the person since (not in the intended state any
// more) is left alone; everything else on the message stays as it is.
function restore(context,touches) {
 for(const t of touches){
  if(!context.chat?.includes(t.message))continue;
  const owner=ownerOf(t.message,t.k);if(!owner||typeof owner!=='object')continue;
  if(!sameState(stateOf(owner.extra,t.id,t.match),t.intended))continue;
  const list=Array.isArray(owner.extra?.[IMAGE_KEY])?owner.extra[IMAGE_KEY]:[];
  const rest=list.filter(x=>x?.id!==t.id),at=t.beforeAt<0?rest.length:Math.min(t.beforeAt,rest.length);
  const back=[...rest.slice(0,at),...t.beforeEntries,...rest.slice(at)],next={...owner.extra};
  if(back.length)next[IMAGE_KEY]=back;else delete next[IMAGE_KEY];
  if(Object.keys(next).length||t.hadExtra)owner.extra=next;else delete owner.extra;
 }
}
// Saves and checks. Returns {unverified:true} when it cannot be told whether the chat was saved (nothing is reverted);
// throws when it was not saved (the touched items are restored). Without readSaved: a thrown save restores, else success.
async function saveChecked(context,touches,readSaved) {
 let thrown=null;
 try{await context.saveChat();}catch(e){thrown=e;}
 if(typeof readSaved!=='function'){if(thrown){restore(context,touches);throw thrown;}return {unverified:false};}
 let verdict;try{verdict=judge(touches,await readSaved());}catch{verdict='unknown';}
 if(verdict==='ok')return {unverified:false};
 if(verdict==='unsaved'){restore(context,touches);throw new Error(thrown?`채팅 저장에 실패해 원래대로 돌려놨어요. (${thrown.message})`:'채팅이 저장되지 않아 원래대로 돌려놨어요.');}
 return {unverified:true};
}
export async function attachInlineImage(context,item,options={}) {
 const {added,duplicates,targetIndex,unverified}=await attachInlineImages(context,[item],options);
 return {duplicate:duplicates>0&&!added,targetIndex,unverified};
}
// 0.1.72: several pictures go into one message with one chat save (선택 본문에 넣기).
export async function attachInlineImages(context,items,{targetIndex,placement=null,isCurrent=()=>true,readSaved=null}={}) {
 const place=PLACEMENTS.includes(placement)?placement:null; // null: follow the chat's or global default
 for(const item of items)imageDownload(item);
 if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅에서 다시 선택해 주세요.');
 if(!Array.isArray(context.chat)||typeof context.saveChat!=='function')throw new Error('현재 채팅에 이미지를 저장할 수 없어요.');
 const message=context.chat[targetIndex];
 if(!Number.isInteger(targetIndex)||!isSceneMessage(message))throw new Error('그림을 넣을 RP 메시지를 선택해 주세요.');
 let list=Array.isArray(message.extra?.[IMAGE_KEY])?message.extra[IMAGE_KEY]:[];
 const swipeId=message.swipe_id??0,signature=textSignature(message.mes);let added=0,duplicates=0,moved=0;
 const touches=[],swipeOwner=message.swipe_info?.[swipeId],swipeIsObject=!!swipeOwner&&typeof swipeOwner==='object';
 for(const item of items){
  const entry={id:item.id,image:item.image,swipeId,signature};
  // When it was made and its seed, so the enlarged view from the chat can show them (0.1.63). Nothing private.
  if(typeof item.created==='string'&&!Number.isNaN(Date.parse(item.created)))entry.created=item.created;
  if(Number.isInteger(item.seed))entry.seed=item.seed;
  if(place)entry.placement=place;
  const same=list.find(x=>x.id===item.id&&x.signature===signature&&x.swipeId===swipeId);
  const intended={present:true,placement:place??(same&&PLACEMENTS.includes(same.placement)?same.placement:null)};
  const match={swipeId,signature};
  // Touches are made before the change: the state before is read from the untouched message and its current swipe copy.
  touches.push(makeTouch(message,targetIndex,null,item.id,{match,intended}));
  if(swipeIsObject)touches.push(makeTouch(message,targetIndex,swipeId,item.id,{match,intended}));
  // Already here: only a different chosen place changes it (moved); otherwise nothing to do.
  if(same){if(place&&same.placement!==place){list=list.map(x=>x===same?{...x,placement:place}:x);moved++;}else duplicates++;continue;}
  if(!list.some(x=>x.id===item.id)&&list.length>=20)throw new Error('한 메시지에는 이미지를 최대 20개까지 넣을 수 있어요.');
  list=[...list.filter(x=>x.id!==item.id),entry];added++;
 }
 if(added||moved)message.extra={...message.extra,[IMAGE_KEY]:list};
 if(added||moved)syncActiveSwipe(message);
 // No new messages, text edits, native media fields or RP generation events.
 // 0.1.77 (UI-072-01): the chat file is read back; see saveChecked for the three outcomes.
 let unverified=false;
 if(added||moved||items.length===1)({unverified}=await saveChecked(context,touches,readSaved));
 return {added,duplicates,moved,targetIndex,unverified};
}
export async function detachInlineImage(context,item,options={}) {
 imageDownload(item);
 return detachInlineImages(context,new Set([item.id]),options);
}
// A viewer opened from an attachment removes this message's copy only, including its swipe copies.
export async function detachMessageImage(context,item,{message,swipeId,signature,isCurrent=()=>true,readSaved=null}={}) {
 imageDownload(item);
 if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅에서 다시 선택해 주세요.');
 if(!context.chat?.includes(message)||
    (message.swipe_id??0)!==swipeId||textSignature(message.mes)!==signature||!visibleInlineImages(message).some(x=>x.id===item.id))
  throw new Error('메시지나 리롤이 바뀌었어요. 해당 그림을 다시 열어 주세요.');
 const index=context.chat.indexOf(message),touches=[],gone={present:false,placement:null};
 for(const [k,owner] of [[null,message],...(message.swipe_info??[]).map((x,k)=>[k,x])]){
  if(!owner||typeof owner!=='object')continue;
  const old=owner.extra,list=old?.[IMAGE_KEY];if(!Array.isArray(list)||!list.some(x=>x.id===item.id))continue;
  touches.push(makeTouch(message,index,k,item.id,{intended:gone}));
  const remaining=list.filter(x=>x.id!==item.id),next={...old};
  if(remaining.length)next[IMAGE_KEY]=remaining;else delete next[IMAGE_KEY];
  owner.extra=next;
 }
 const {unverified}=await saveChecked(context,touches,readSaved);
 return {removed:touches.length,unverified};
}
// 0.1.74: moves this message's copy of a picture above or below the text (null: back to the default place), including
// its swipe copies. Checked like detachMessageImage: the same message, reroll and text as when the view opened.
export async function placeMessageImage(context,item,{message,swipeId,signature,placement=null,isCurrent=()=>true,readSaved=null}={}) {
 imageDownload(item);const place=PLACEMENTS.includes(placement)?placement:null;
 if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅에서 다시 선택해 주세요.');
 if(!context.chat?.includes(message)||
    (message.swipe_id??0)!==swipeId||textSignature(message.mes)!==signature||!visibleInlineImages(message).some(x=>x.id===item.id))
  throw new Error('메시지나 리롤이 바뀌었어요. 해당 그림을 다시 열어 주세요.');
 const index=context.chat.indexOf(message),touches=[],intended={present:true,placement:place};
 for(const [k,owner] of [[null,message],...(message.swipe_info??[]).map((x,k)=>[k,x])]){
  if(!owner||typeof owner!=='object')continue;
  const old=owner.extra,list=old?.[IMAGE_KEY];if(!Array.isArray(list)||!list.some(x=>x.id===item.id))continue;
  touches.push(makeTouch(message,index,k,item.id,{intended}));
  owner.extra={...old,[IMAGE_KEY]:list.map(x=>{if(x.id!==item.id)return x;const y={...x};if(place)y.placement=place;else delete y.placement;return y;})};
 }
 const {unverified}=await saveChecked(context,touches,readSaved);
 return {changed:touches.length,unverified};
}
// Removes every attachment of the given image IDs from the current chat (all messages and swipes), one save.
export async function detachInlineImages(context,ids,{isCurrent=()=>true,readSaved=null}={}) {
 if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅에서 다시 선택해 주세요.');
 if(!Array.isArray(context.chat)||typeof context.saveChat!=='function')throw new Error('현재 채팅에서 이미지를 뺄 수 없어요.');
 let removed=0;const touches=[],gone={present:false,placement:null};
 function remove(message,index,k,owner){
  const extra=owner.extra;
  if(!Array.isArray(extra?.[IMAGE_KEY]))return;
  const remaining=extra[IMAGE_KEY].filter(x=>!ids.has(x.id));if(remaining.length===extra[IMAGE_KEY].length)return;
  for(const id of new Set(extra[IMAGE_KEY].filter(x=>ids.has(x.id)).map(x=>x.id)))touches.push(makeTouch(message,index,k,id,{intended:gone}));
  removed+=extra[IMAGE_KEY].length-remaining.length;const next={...extra};
  if(remaining.length)next[IMAGE_KEY]=remaining;else delete next[IMAGE_KEY];owner.extra=next;
 }
 context.chat.forEach((message,index)=>{
  remove(message,index,null,message);
  if(Array.isArray(message.swipe_info))message.swipe_info.forEach((swipe,k)=>{if(swipe&&typeof swipe==='object')remove(message,index,k,swipe);});
 });
 let unverified=false;
 if(removed)({unverified}=await saveChecked(context,touches,readSaved));
 return {removed,unverified};
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
// 0.1.74: a picture may carry its own place ('above' or 'below' the message text). Pictures without one follow the
// chat's or the global default. Each side is its own group with the chosen layout.
export const PLACEMENTS=['above','below'];
export const placementOf=(item,fallback)=>PLACEMENTS.includes(item?.placement)?item.placement:fallback;
// The message's pictures in the order they show: the group above the text first, then the group below.
export function orderedInlineImages(message,fallback='above'){
 const items=visibleInlineImages(message);
 return [...items.filter(x=>placementOf(x,fallback)==='above'),...items.filter(x=>placementOf(x,fallback)==='below')];
}
export function renderInlineImages(context,root,chatKey,{placement='above',layout='slide',size='medium'}={}) {
 const fallback=placement==='below'?'below':'above';
 const shape=INLINE_LAYOUTS.includes(layout)?layout:'slide',scale=INLINE_SIZES.includes(size)?size:'medium';
 if(!root)return;
 for(const element of root.querySelectorAll('.mes[mesid]')){
  const index=Number(element.getAttribute('mesid')),message=context.chat?.[index],all=visibleInlineImages(message);
  for(const where of PLACEMENTS)renderGroup(element,where,all.filter(x=>placementOf(x,fallback)===where),{shape,scale,chatKey});
  // Holders from before 0.1.74 (no side) or with an unknown side are cleared.
  for(const old of element.querySelectorAll('.ncs-inline-images'))if(!PLACEMENTS.includes(old.dataset.placement))old.remove();
 }
}
function renderGroup(element,where,items,{shape,scale,chatKey}){
  const signature=JSON.stringify([where,shape,scale,items]);
  let holder=element.querySelector(`.ncs-inline-images[data-placement="${where}"]`);
  if(!items.length){holder?.remove();return;}
  if(holder?.dataset.signature===signature&&holder.dataset.chatKey===chatKey)return;
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
