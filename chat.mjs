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

// Compare the JSON that SillyTavern saves, independent of the order of object keys.
export function stableChatJson(state){
 return JSON.stringify(state,(_key,value)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]]));
 });
}

export const MEMORY_ONLY_METADATA=['lastInContextMessageId','chat_id_hash','timedWorldInfo'];
// ST assigns these values when loading a chat. Ignore an absent disk key only
// when memory contains the same value ST would initialize.
export function comparableSavedMetadata(saved,local,note={}){
 const metadata={...saved};
 if(!Object.hasOwn(metadata,'integrity')&&local.integrity)metadata.integrity=local.integrity;
 const defaults={note_prompt:note.default??'',note_interval:note.defaultInterval??1,
  note_position:note.defaultPosition??1,note_depth:note.defaultDepth??4,note_role:note.defaultRole??0};
 for(const [key,value] of Object.entries(defaults)){
  if(!Object.hasOwn(metadata,key)&&local[key]===value)metadata[key]=value;
 }
 // 0.1.86 (B2): ST changes these in memory only and writes them with its next save, whatever the disk held:
 // lastInContextMessageId (setInContextMessages, "No metadata save on purpose"), chat_id_hash (made on first
 // macro use) and timedWorldInfo (world info sticky/cooldown, created and updated by world info scans).
 // A difference here is not someone else's edit, so the memory value is taken for the comparison.
 for(const key of MEMORY_ONLY_METADATA){
  if(Object.hasOwn(local,key))metadata[key]=local[key];else delete metadata[key];
 }
 return metadata;
}

export function splitSavedChat(data,{inGroup=false}={}){
 if(!Array.isArray(data)||!data.length)throw new Error('missing chat');
 const [header,...messages]=data;
 if(!header||typeof header!=='object'||Array.isArray(header))throw new Error('missing chat header');
 if(!('mes' in header)){
  if(Object.hasOwn(header,'chat_metadata')){
   const metadata=header.chat_metadata;
   if(metadata&&typeof metadata==='object'&&!Array.isArray(metadata))return {messages,metadata};
   throw new Error('invalid chat metadata');
  }
  if(typeof header.user_name==='string'&&typeof header.character_name==='string')return {messages,metadata:{}};
 }
 // Older group files may start directly with a message.
 if(inGroup&&data.every(row=>typeof row?.mes==='string'))return {messages:data,metadata:{}};
 throw new Error('missing chat header');
}
