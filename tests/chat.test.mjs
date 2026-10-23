import test from 'node:test';
import assert from 'node:assert/strict';
import {attachImage,buildImageMessage} from '../ui/chat.mjs';
import {chooseMessages} from '../ui/core.mjs';
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
