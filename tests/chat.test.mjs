import test from 'node:test';
import assert from 'node:assert/strict';
import {attachImage,buildImageMessage,comparableSavedMetadata,splitSavedChat,timedState} from '../chat.mjs';
import {chooseMessages} from '../core.mjs';
const id='78c72e1e-e533-4188-9c93-a776da821ce3';
const item={id,image:`/user/images/naice-shot/${id}.png`};
test('image attachment is native generated media, excluded from both RP and extraction',()=>{
 const message=buildImageMessage(item);assert.equal(message.is_system,true);assert.equal(message.is_user,false);
 assert.equal(message.extra.media[0].type,'image');assert.equal(message.extra.media[0].source,'generated');
 assert.equal(message.extra.media[0].append_title,false);assert.equal(message.extra.tool_invocations,undefined);
 const chat=[{mes:'RP story',is_system:false},message];
 // ST bc81b9f7e's exact coreChat exclusion predicate, with tool mode enabled too.
 const core=chat.filter(x=>!x.is_system || (true && Array.isArray(x.extra?.tool_invocations)));
 assert.deepEqual(core,[chat[0]]);assert.deepEqual(chooseMessages(chat).messages.map(m=>m.text),['RP story']);
 assert.doesNotMatch(JSON.stringify(message),/base_caption|brown hair|negative_prompt/);
});
test('adding an image preserves original RP objects and saves without RP events or duplicate messages',async()=>{
 const original={mes:'original story',extra:{foo:'bar'}};let shown=0,saved=0;
 const ctx={chat:[original],addOneMessage:()=>shown++,saveChat:async()=>saved++};
 const added=await attachImage(ctx,item);assert.equal(added.duplicate,false);assert.equal(ctx.chat.length,2);
 assert.equal(ctx.chat[0],original);assert.deepEqual(original,{mes:'original story',extra:{foo:'bar'}});
 const duplicate=await attachImage(ctx,item);assert.equal(duplicate.duplicate,true);assert.equal(ctx.chat.length,2);assert.equal(shown,1);assert.equal(saved,2);
});
test('wrong chat and unsafe image paths cannot be attached',async()=>{
 assert.throws(()=>buildImageMessage({...item,image:'https://other.example/secret'}));
 const ctx={chat:[],addOneMessage:()=>{},saveChat:async()=>{}};
 await assert.rejects(attachImage(ctx,item,{isCurrent:()=>false}),/채팅이 바뀌/);assert.equal(ctx.chat.length,0);
});
test('a render failure rolls back the new display message only',async()=>{
 const original={mes:'RP'};const ctx={chat:[original],addOneMessage:()=>{throw new Error('render failed');},saveChat:async()=>{}};
 await assert.rejects(attachImage(ctx,item),/render failed/);assert.deepEqual(ctx.chat,[original]);
});

test('an absent author note default is normalized without ignoring real metadata changes',()=>{
 const local={note_prompt:'default',note_depth:4,note_position:1,note_role:0,note_interval:1,integrity:'host-id'};
 const config={default:'default'};
 assert.deepEqual(comparableSavedMetadata({},local,config),local);
 assert.equal(comparableSavedMetadata({note_prompt:'saved elsewhere'},local,config).note_prompt,'saved elsewhere');
 assert.equal(Object.hasOwn(comparableSavedMetadata({}, {...local,note_depth:9},config),'note_depth'),false);
});

test('0.1.86 B2: keys SillyTavern changes in memory only do not count as a disk change',()=>{
 const local={lastInContextMessageId:12,chat_id_hash:991,variables:{x:1}};
 const stable=x=>JSON.stringify(x,Object.keys(x).sort());
 // the disk is older (or never had them): still the same chat
 assert.equal(stable(comparableSavedMetadata({lastInContextMessageId:3,variables:{x:1}},local)),stable(local));
 // memory dropped one that the disk still has: still the same
 assert.equal(Object.hasOwn(comparableSavedMetadata({chat_id_hash:5,variables:{x:1}},{variables:{x:1}}),'chat_id_hash'),false);
 // a real change elsewhere is still seen
 assert.deepEqual(comparableSavedMetadata({lastInContextMessageId:3,variables:{x:2}},local).variables,{x:2});
});

test('0.1.87 GPT P2 B2: timed world info from another window is not taken for this window\'s value',()=>{
 const loaded={sticky:{},cooldown:{}},scanned={sticky:{a:{end:5}},cooldown:{}},elsewhere={sticky:{b:{end:9}},cooldown:{}};
 const local={timedWorldInfo:scanned,variables:{x:1}};
 const known=new Set([timedState({timedWorldInfo:loaded})]);
 // the disk still has the value this window loaded: the scan result in memory is this window's own
 assert.deepEqual(comparableSavedMetadata({timedWorldInfo:loaded,variables:{x:1}},local,{},{timedKnown:known}).timedWorldInfo,scanned);
 // the disk never had it, and this window started without it: also its own
 assert.deepEqual(comparableSavedMetadata({variables:{x:1}},local,{},{timedKnown:new Set([timedState({})])}).timedWorldInfo,scanned);
 // another window saved a sticky effect this window never had: the disk value stays, so the write stops
 assert.deepEqual(comparableSavedMetadata({timedWorldInfo:elsewhere,variables:{x:1}},local,{},{timedKnown:known}).timedWorldInfo,elsewhere);
 // without a known set nothing is assumed
 assert.deepEqual(comparableSavedMetadata({timedWorldInfo:loaded},local).timedWorldInfo,loaded);
 // key order does not matter
 assert.equal(timedState({timedWorldInfo:{cooldown:{},sticky:{}}}),timedState({timedWorldInfo:loaded}));
});

test('recognizes legacy chat and group formats without accepting an empty or invalid reply',()=>{
 const message={mes:'hi'};
 assert.deepEqual(splitSavedChat([{user_name:'u',character_name:'c'},message]),{messages:[message],metadata:{}});
 assert.deepEqual(splitSavedChat([message],{inGroup:true}),{messages:[message],metadata:{}});
 assert.throws(()=>splitSavedChat([],{inGroup:true}));
 assert.throws(()=>splitSavedChat([{chat_metadata:[]},message]));
 assert.throws(()=>splitSavedChat([message]));
});
