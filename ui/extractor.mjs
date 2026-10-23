import {SCENE_SCHEMA} from './core.mjs';
export function listExtractionProfiles(context) {
 const manager=context.ConnectionManagerRequestService;
 if(!manager||context.extensionSettings.disabledExtensions?.includes('connection-manager'))return [];
 const profiles=context.extensionSettings.connectionManager?.profiles??[];
 return profiles.filter(p=>{
  try {const type=manager.validateProfile(p);return ['openai','textgenerationwebui'].includes(type.selected);}
  catch{return false;}
 });
}
export function abortError() {
 return Object.assign(new Error('추출을 중단했어요.'),{name:'AbortError'});
}
// Settles as soon as the signal aborts, even if the underlying request ignores it.
export function abortable(promise,signal) {
 if(!signal)return promise;
 return new Promise((resolve,reject)=>{
  const onAbort=()=>reject(abortError());
  if(signal.aborted)return onAbort();
  signal.addEventListener('abort',onAbort,{once:true});
  Promise.resolve(promise).then(v=>{signal.removeEventListener('abort',onAbort);resolve(v);},e=>{signal.removeEventListener('abort',onAbort);reject(e);});
 });
}
export async function requestExtraction(context,prompt,{profileId='',structured=true,maxTokens=4096,schemaValue=SCENE_SCHEMA,signal=null,systemPrompt='You extract visible scenes into JSON. Do not roleplay.',schemaName='naice_shot'}={}) {
 if(signal?.aborted)throw abortError();
 const schema={name:schemaName,strict:true,value:schemaValue,returnInvalid:true};
 if(!profileId){
  // generateRaw has no signal parameter; ST aborts its in-flight raw request on GENERATION_STOPPED.
  const stop=()=>{try{const types=context.eventTypes??context.event_types;Promise.resolve(context.eventSource?.emit?.(types?.GENERATION_STOPPED??'generation_stopped')).catch(()=>{});}catch{}};
  signal?.addEventListener('abort',stop,{once:true});
  try{
   return await abortable(context.generateRaw({prompt,systemPrompt,trimNames:false,
    ...(structured&&context.mainApi==='openai'?{jsonSchema:schema}:{})}),signal);
  }finally{signal?.removeEventListener('abort',stop);}
 }
 const service=context.ConnectionManagerRequestService;
 if(!service||context.extensionSettings.disabledExtensions?.includes('connection-manager'))throw new Error('실리태번의 연결 프로필 기능을 켜 주세요.');
 const profile=listExtractionProfiles(context).find(p=>p.id===profileId);
 if(!profile)throw new Error('선택한 추출 연결 프로필이 없거나 지원하지 않아요. 설정에서 다시 선택해 주세요.');
 if(!Number.isInteger(maxTokens)||maxTokens<256||maxTokens>16384)throw new Error('추출 응답 한도는 256~16384로 입력해 주세요.');
 const type=service.validateProfile(profile).selected;
 const messages=[{role:'system',content:systemPrompt},{role:'user',content:prompt}];
 try {
  const result=await abortable(service.sendRequest(profileId,messages,maxTokens,
   {stream:false,extractData:true,includePreset:true,includeInstruct:true,...(signal?{signal}:{})},
   structured&&type==='openai'?{json_schema:schema}:{}),signal);
  if(typeof result==='string')return result;
  if(typeof result?.content==='string')return result.content;
  if(result?.content&&typeof result.content==='object')return JSON.stringify(result.content);
  throw new Error('추출 연결에서 텍스트 응답을 받지 못했어요.');
 }catch(e){
  if(signal?.aborted||e?.name==='AbortError')throw abortError();
  const detail=e.cause?.message??e.message;
  throw new Error(`추출 연결 요청 실패: ${String(detail).slice(0,300)}. 연결 프로필과 JSON 구조화 출력 설정을 확인해 주세요.`);
 }
}
