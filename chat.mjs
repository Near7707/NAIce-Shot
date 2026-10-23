// Uses ST 1.19's native media shape. Display-only system messages are excluded
// by ST's coreChat filter, before text and multimodal prompt construction.
export function buildImageMessage(item,displayName='NAIce Shot',now=new Date()) {
  if(!item || !/^[0-9a-f-]{36}$/i.test(item.id??'') ||
    item.image!==`/user/images/naice-shot/${item.id}.png`)throw new Error('첨부할 이미지 경로가 잘못됐어요.');
  return {name:displayName,is_user:false,is_system:true,send_date:now.toISOString(),
    mes:'생성 이미지',extra:{
      media:[{type:'image',url:item.image,title:'생성 이미지',source:'generated',append_title:false}],
      media_display:'gallery',media_index:0,inline_image:false,
      naice_shot:{kind:'image',imageId:item.id},
    }};
}
export function hasAttachedImage(chat,item) {
  return chat.some(m=>m.extra?.naice_shot?.kind==='image'&&m.extra.naice_shot.imageId===item.id);
}
export async function attachImage(context,item,{displayName='NAIce Shot',isCurrent=()=>true}={}) {
  if(!Array.isArray(context.chat) || typeof context.addOneMessage!=='function' || typeof context.saveChat!=='function')throw new Error('현재 실리태번에서 채팅 첨부 기능을 찾지 못했어요.');
  if(!isCurrent())throw new Error('채팅이 바뀌었어요. 현재 채팅의 이력에서 다시 선택해 주세요.');
  if(hasAttachedImage(context.chat,item)){await context.saveChat();return {duplicate:true};}
  const message=buildImageMessage(item,displayName);
  context.chat.push(message);
  try{context.addOneMessage(message);}catch(e){context.chat.splice(context.chat.indexOf(message),1);throw e;}
  // Deliberately do not emit MESSAGE_RECEIVED: this is not an RP response.
  // Use ST's normal save pipeline rather than rewriting its chat file directly.
  await context.saveChat();
  if(isCurrent())context.scrollOnMediaLoad?.();
  return {duplicate:false};
}
