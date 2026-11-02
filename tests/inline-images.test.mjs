import test from 'node:test';
import assert from 'node:assert/strict';
import {attachInlineImage,detachInlineImage,visibleInlineImages,hasInlineImage,imageDownload,IMAGE_KEY} from '../inline-images.mjs';
import {chooseMessages} from '../core.mjs';
const id='78c72e1e-e533-4188-9c93-a776da821ce3',item={id,image:`/user/images/naice-shot/${id}.png`};
function context(){return {chat:[{name:'Mira',is_user:true,mes:'hello'},{name:'Leo',mes:'RP text',extra:{reasoning:'private',media:[{type:'image',url:'/existing.png'}]}}],saves:0,async saveChat(){this.saves++;}};}
test('inline attachment keeps message count, text, reasoning, existing native media and extracted RP unchanged',async()=>{
 const ctx=context(),original=structuredClone(ctx.chat),input=chooseMessages(ctx.chat).messages;
 const message=ctx.chat[1];await attachInlineImage(ctx,item,{targetIndex:1});
 assert.equal(ctx.chat.length,2);assert.equal(ctx.chat[1],message);assert.deepEqual(ctx.chat[0],original[0]);assert.equal(message.mes,original[1].mes);
 assert.deepEqual(message.extra.media,original[1].extra.media);assert.equal(message.extra.reasoning,'private');assert.equal(message.is_system,undefined);
 assert.deepEqual(chooseMessages(ctx.chat).messages,input);assert.equal(visibleInlineImages(message).length,1);assert.equal(ctx.saves,1);
});
test('duplicate insertion does not duplicate images and saved metadata survives a chat reload',async()=>{
 const ctx=context();await attachInlineImage(ctx,item,{targetIndex:1});const result=await attachInlineImage(ctx,item,{targetIndex:1});
 assert.equal(result.duplicate,true);assert.equal(ctx.chat[1].extra[IMAGE_KEY].length,1);
 const loaded=JSON.parse(JSON.stringify(ctx.chat));assert.equal(visibleInlineImages(loaded[1])[0].id,id);assert.equal(hasInlineImage(loaded,item),true);
});
test('removal touches only extension image metadata and leaves original text and native media intact',async()=>{
 const ctx=context(),before=structuredClone(ctx.chat);await attachInlineImage(ctx,item,{targetIndex:1});
 const result=await detachInlineImage(ctx,item);assert.ok(result.removed);assert.deepEqual(ctx.chat,before);assert.equal(ctx.saves,2);
 await attachInlineImage(ctx,item,{targetIndex:1});assert.equal(visibleInlineImages(ctx.chat[1]).length,1);
});
test('attachments are hidden on a different swipe or edited text and current swipe metadata is persisted',async()=>{
 const ctx=context(),message=ctx.chat[1];message.swipe_id=0;message.swipe_info=[{extra:{reasoning:'private'}}];
 await attachInlineImage(ctx,item,{targetIndex:1});assert.equal(message.swipe_info[0].extra[IMAGE_KEY][0].id,id);
 message.swipe_id=1;assert.equal(visibleInlineImages(message).length,0);message.swipe_id=0;
 message.mes='edited';assert.equal(visibleInlineImages(message).length,0);message.mes='RP text';assert.equal(visibleInlineImages(message).length,1);
 await detachInlineImage(ctx,item);assert.equal(message.swipe_info[0].extra[IMAGE_KEY],undefined);assert.equal(message.extra.reasoning,'private');
});
test('wrong chat, missing targets, system messages and unsafe download URLs are rejected before mutation',async()=>{
 const ctx=context(),before=JSON.stringify(ctx.chat);
 await assert.rejects(attachInlineImage(ctx,item,{targetIndex:1,isCurrent:()=>false}),/채팅이 바뀌/);
 await assert.rejects(attachInlineImage(ctx,item,{targetIndex:99}));ctx.chat.push({is_system:true,mes:'system',extra:{type:'generic'}});
 await assert.rejects(attachInlineImage(ctx,item,{targetIndex:2}));ctx.chat.pop();assert.equal(JSON.stringify(ctx.chat),before);
 await assert.rejects(detachInlineImage(ctx,item,{isCurrent:()=>false}));
 assert.throws(()=>imageDownload({...item,image:'https://outside.test/image.png'}));assert.throws(()=>imageDownload({...item,image:'/user/images/naice-shot/../secret'}));
 assert.deepEqual(imageDownload(item),{url:item.image,filename:`naice-shot-${id}.png`});assert.equal(ctx.saves,0);
});

test('message-scoped removal keeps another attachment of the same image and all RP text',async()=>{
 const {detachMessageImage}=await import('../inline-images.mjs'),ctx=context();
 ctx.chat[1].swipe_info=[{extra:{reasoning:'private'}}];
 await attachInlineImage(ctx,item,{targetIndex:0});await attachInlineImage(ctx,item,{targetIndex:1});
 const target=ctx.chat[1],entry=visibleInlineImages(target)[0],other=structuredClone(ctx.chat[0]);
 await detachMessageImage(ctx,item,{message:target,swipeId:entry.swipeId,signature:entry.signature});
 assert.deepEqual(ctx.chat[0],other);assert.equal(target.mes,'RP text');assert.equal(target.extra.reasoning,'private');
 assert.equal(visibleInlineImages(target).length,0);assert.equal(target.swipe_info[0].extra[IMAGE_KEY],undefined);
 assert.equal(visibleInlineImages(ctx.chat[0]).length,1);
});
test('message-scoped removal refuses a changed chat or source and rolls back a failed save',async()=>{
 const {detachMessageImage}=await import('../inline-images.mjs'),ctx=context();await attachInlineImage(ctx,item,{targetIndex:1});
 const message=ctx.chat[1],entry=visibleInlineImages(message)[0],options={message,swipeId:entry.swipeId,signature:entry.signature};
 await assert.rejects(detachMessageImage(ctx,item,{...options,isCurrent:()=>false}),/채팅이 바뀌/);
 message.mes='changed';await assert.rejects(detachMessageImage(ctx,item,options),/메시지나 리롤/);message.mes='RP text';
 const before=structuredClone(message);ctx.saveChat=async()=>{throw new Error('save failed');};
 await assert.rejects(detachMessageImage(ctx,item,options),/save failed/);assert.deepEqual(message,before);
});
