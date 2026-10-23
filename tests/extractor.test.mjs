import test from 'node:test';
import assert from 'node:assert/strict';
import {listExtractionProfiles,requestExtraction} from '../extractor.mjs';
function context(type='openai') {
 const calls=[];
 const ctx={mainApi:'openai',extensionSettings:{connectionManager:{selectedProfile:'main',profiles:[{id:'cheap',api:'custom',name:'Cheap'}]}},
  generateRaw:async options=>{calls.push(['raw',options]);return 'raw text';},
  ConnectionManagerRequestService:{validateProfile:()=>({selected:type}),sendRequest:async(...args)=>{calls.push(['profile',...args]);return {content:{characters:[]},reasoning:'private reasoning'};}}};
 return {ctx,calls};
}
test('current connection retains generateRaw behavior and does not invoke a profile',async()=>{
 const {ctx,calls}=context();const result=await requestExtraction(ctx,'prompt');assert.equal(result,'raw text');assert.equal(calls[0][0],'raw');assert.ok(calls[0][1].jsonSchema);
});
test('independent profile calls the native service without switching the main connection',async()=>{
 const {ctx,calls}=context(),before=JSON.stringify(ctx.extensionSettings);
 const result=await requestExtraction(ctx,'extract here',{profileId:'cheap',maxTokens:4096});
 assert.equal(calls[0][0],'profile');assert.equal(calls[0][1],'cheap');assert.equal(calls[0][3],4096);
 assert.equal(calls[0][2][1].content,'extract here');assert.ok(calls[0][5].json_schema);
 assert.equal(result,'{"characters":[]}');assert.doesNotMatch(result,/reasoning/);
 assert.equal(JSON.stringify(ctx.extensionSettings),before);assert.equal(ctx.mainApi,'openai');
});
test('text-completion profiles omit chat-specific JSON schema overrides',async()=>{
 const {ctx,calls}=context('textgenerationwebui');await requestExtraction(ctx,'test',{profileId:'cheap'});assert.deepEqual(calls[0][5],{});
});
test('missing, unsupported or disabled profiles never silently use the main connection',async()=>{
 const {ctx,calls}=context();await assert.rejects(requestExtraction(ctx,'test',{profileId:'deleted'}),/없거나 지원/);assert.equal(calls.length,0);
 ctx.extensionSettings.disabledExtensions=['connection-manager'];assert.deepEqual(listExtractionProfiles(ctx),[]);
 await assert.rejects(requestExtraction(ctx,'test',{profileId:'cheap'}),/기능을 켜/);assert.equal(calls.length,0);
});

test('cancelling a main-connection extraction rejects at once and asks ST to stop the raw request',async()=>{
  const {requestExtraction}=await import('../extractor.mjs');
  const emitted=[];let release;
  const context={mainApi:'openai',extensionSettings:{},eventTypes:{GENERATION_STOPPED:'generation_stopped'},
    eventSource:{emit:async type=>{emitted.push(type);}},generateRaw:()=>new Promise(r=>{release=r;})};
  const controller=new AbortController();
  const pending=requestExtraction(context,'p',{signal:controller.signal});
  controller.abort();
  await assert.rejects(pending,e=>e.name==='AbortError'&&/중단/.test(e.message));
  assert.deepEqual(emitted,['generation_stopped']);
  release('{"late":true}'); // a late reply after cancel is ignored
  await assert.rejects(requestExtraction(context,'p',{signal:controller.signal}),{name:'AbortError'},'already-aborted signal never sends');
});
test('cancelling a separate connection passes the signal to ST and reports a cancel, not a provider failure',async()=>{
  const {requestExtraction}=await import('../extractor.mjs');
  let seen;
  const context={mainApi:'openai',extensionSettings:{connectionManager:{profiles:[{id:'x',name:'x',api:'custom'}]}},
    ConnectionManagerRequestService:{validateProfile:()=>({selected:'openai'}),
      sendRequest:(id,messages,max,custom)=>{seen=custom.signal;return new Promise((_,reject)=>custom.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));}}};
  const controller=new AbortController();
  const pending=requestExtraction(context,'p',{profileId:'x',signal:controller.signal});
  controller.abort();
  await assert.rejects(pending,e=>e.name==='AbortError'&&!/연결 요청 실패/.test(e.message));
  assert.equal(seen,controller.signal);
});


test('separate extraction provider error details do not reveal credentials or local paths',async()=>{
 const {requestExtraction}=await import('../extractor.mjs');
 const context={extensionSettings:{connectionManager:{profiles:[{id:'x',api:'custom'}]}},ConnectionManagerRequestService:{validateProfile:()=>({selected:'openai'}),sendRequest:async()=>{throw new Error('C:\\Users\\private-person token-PRIVATE');}}};
 await assert.rejects(requestExtraction(context,'p',{profileId:'x'}),e=>!/private-person|PRIVATE/.test(e.message)&&/실패/.test(e.message));
});


test('main extraction provider errors are private and cancellation still uses AbortError',async()=>{
 const {requestExtraction}=await import('../extractor.mjs');
 await assert.rejects(requestExtraction({mainApi:'openai',generateRaw:async()=>{throw new Error('/home/private/token-SECRET');}},'p'),e=>/실패/.test(e.message)&&!/private|SECRET/.test(e.message));
 await assert.rejects(requestExtraction({mainApi:'openai',generateRaw:async()=>{throw new DOMException('secret details','AbortError');}},'p'),e=>e.name==='AbortError'&&!/secret/.test(e.message));
});
