import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseMessages,sourceValid} from '../core.mjs';
import {isSceneMessage,isHiddenSceneMessage,chooseSceneMessages} from '../scene-messages.mjs';
import {attachInlineImage,visibleInlineImages,detachInlineImage} from '../inline-images.mjs';
const conversation=()=>[
 {name:'Character A',is_user:false,is_system:true,mes:'Earlier hidden scene.',swipe_id:1,extra:{reasoning:'not sent'}},
 {name:'User',is_user:true,is_system:true,mes:'A hidden reply.'},
 {name:'System',is_system:true,mes:'Help text.',extra:{type:'help'}},
 {name:'Character A',is_user:false,is_system:true,mes:'Hidden target scene.'},
 {name:'Character A',is_user:false,mes:'Visible latest scene.'},
 {name:'Character A',is_system:true,mes:'A hidden tail.'},
];
test('hidden RP and narrator are selectable, explicit system notices and blank text are excluded',()=>{
 assert.equal(isHiddenSceneMessage(conversation()[0]),true);
 assert.equal(isSceneMessage({is_system:true,mes:'Narrative scene.',extra:{type:'narrator'}}),true);
 for(const type of ['help','generic','comment','welcome','assistant_note','slash_commands'])assert.equal(isSceneMessage({is_system:true,mes:'System text',extra:{type}}),false,type);
 assert.equal(isSceneMessage({mes:'Notice',extra:{uses_system_ui:true}}),false);
 assert.equal(isSceneMessage({mes:'Notice',extra:{isSmallSys:true}}),false);
 assert.equal(isSceneMessage({mes:' '}),false);assert.equal(isSceneMessage(null),false);
 // Untyped legacy is_system records have no reliable hidden/system discriminator.
 assert.equal(isHiddenSceneMessage({is_system:true,mes:'Legacy text.'}),true);
});
test('explicit hidden target includes its preceding hidden RP context without exposing notices or later text',()=>{
 const chat=conversation(),before=structuredClone(chat),baseline=chooseMessages(chat).messages;
 const selected=chooseSceneMessages(chat,{target:3,recent:3});
 assert.deepEqual(selected.messages.map(m=>m.index),[0,1,3]);assert.equal(selected.source.target,3);
 assert.ok(sourceValid(selected.source,chat));assert.ok(!JSON.stringify(selected.messages).includes('not sent'));
 assert.deepEqual(chat,before);assert.deepEqual(chooseMessages(chat).messages,baseline,'main-chat input remains unchanged');
 chat[3].mes='Edited scene';assert.equal(sourceValid(selected.source,chat),false);
});
test('latest and visible targets keep hidden history excluded; all-hidden history requires explicit selection',()=>{
 const chat=conversation();assert.deepEqual(chooseSceneMessages(chat).messages.map(m=>m.index),[4]);
 assert.deepEqual(chooseSceneMessages(chat,{target:4,recent:30}).messages.map(m=>m.index),[4]);
 assert.throws(()=>chooseSceneMessages(chat.slice(0,4)),/메시지/);
 assert.deepEqual(chooseSceneMessages(chat.slice(0,4),{target:0}).messages.map(m=>m.index),[0]);
 assert.throws(()=>chooseSceneMessages(chat,{target:2}),/메시지/);
});
test('user exclusion, reference limit and original indices apply to hidden selections',()=>{
 const chat=conversation();assert.deepEqual(chooseSceneMessages(chat,{target:3,includeUser:false,recent:2}).messages.map(m=>m.index),[0,3]);
 assert.deepEqual(chooseSceneMessages(chat,{target:3,recent:1}).messages.map(m=>m.index),[3]);
 assert.throws(()=>chooseSceneMessages(chat,{target:1,includeUser:false}),/유저/);
});
test('hidden-message attachment and removal preserve hide, text, native media and main-chat selection',async()=>{
 const chat=conversation(),original=structuredClone(chat),item={id:'11111111-1111-4111-8111-111111111111',image:'/user/images/naice-shot/11111111-1111-4111-8111-111111111111.png'};
 chat[3].extra={media:[{url:'/original.png'}]};const before=structuredClone(chat),input=chooseMessages(chat).messages;
 const context={chat,async saveChat(){}};await attachInlineImage(context,item,{targetIndex:3});
 assert.equal(chat[3].is_system,true);assert.equal(visibleInlineImages(chat[3]).length,1);assert.deepEqual(chat[3].extra.media,before[3].extra.media);
 assert.deepEqual(chooseMessages(chat).messages,input);assert.deepEqual(chat.map(m=>m.mes),original.map(m=>m.mes));
 await assert.rejects(attachInlineImage(context,item,{targetIndex:2}),/RP 메시지/);
 await detachInlineImage(context,item);assert.deepEqual(chat,before);
});
