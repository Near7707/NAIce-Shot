import test from 'node:test';
import assert from 'node:assert/strict';
import {attachInlineImages,placeMessageImage,detachMessageImage,detachInlineImages,hasInlineImage,visibleInlineImages,IMAGE_KEY} from '../inline-images.mjs';
import {textSignature} from '../core.mjs';
// 0.1.77 (UI-072-01): the chat file is read back after a save. saved = what the fake "disk" holds.
const mk=n=>({id:`78c72e1e-e533-4188-9c93-a776da82${String(1000+n)}`.slice(0,36),image:`/user/images/naice-shot/78c72e1e-e533-4188-9c93-a776da82${String(1000+n)}.png`.replace(/(\w{36})\w*\.png/,'$1.png')});
const A=mk(1),B=mk(2),C=mk(3);
for(const x of [A,B,C]){x.image=`/user/images/naice-shot/${x.id}.png`;}
function world({mode='ok'}={}){
 const ctx={chat:[{name:'Mira',is_user:true,mes:'hello',send_date:'d0'},{name:'Leo',mes:'RP text',send_date:'d1',swipe_id:0,swipe_info:[{extra:{keep:true}}],extra:{reasoning:'private'}}],disk:null,mode,saves:0};
 ctx.disk=structuredClone(ctx.chat);
 ctx.saveChat=async function(){this.saves++;if(this.mode==='ok')this.disk=structuredClone(this.chat);else if(this.mode==='throw')throw new Error('disk full');/* 'swallow': nothing stored, no error */};
 ctx.readSaved=async()=>structuredClone(ctx.disk);
 return ctx;
}
const msg=ctx=>ctx.chat[1];
const ids=m=>(m.extra?.[IMAGE_KEY]??[]).map(x=>x.id);
test('saved: every touched item is in the intended state -> success, nothing reverted',async()=>{
 const ctx=world();const r=await attachInlineImages(ctx,[A,B],{targetIndex:1,readSaved:ctx.readSaved});
 assert.equal(r.unverified,false);assert.deepEqual(ids(msg(ctx)),[A.id,B.id]);
});
test('a swallowed save (no error, nothing stored) is caught: touched items go back, nothing else changes',async()=>{
 const ctx=world({mode:'swallow'});
 await assert.rejects(()=>attachInlineImages(ctx,[A],{targetIndex:1,readSaved:ctx.readSaved}),/저장되지 않아/);
 assert.equal(hasInlineImage(ctx.chat,A),false);assert.deepEqual(msg(ctx).swipe_info[0],{extra:{keep:true}});assert.equal(msg(ctx).extra.reasoning,'private');
});
test('a save that threw but really reached the file counts as saved',async()=>{
 const ctx=world();ctx.saveChat=async function(){this.disk=structuredClone(this.chat);throw new Error('late error');};
 const r=await attachInlineImages(ctx,[A],{targetIndex:1,readSaved:ctx.readSaved});assert.equal(r.unverified,false);assert.equal(hasInlineImage(ctx.chat,A),true);
});
test('mixed result (one item saved, one not) -> cannot tell: nothing is reverted',async()=>{
 const ctx=world();ctx.saveChat=async function(){const part=structuredClone(this.chat);part[1].extra[IMAGE_KEY]=part[1].extra[IMAGE_KEY].filter(x=>x.id===A.id);this.disk=part;};
 const r=await attachInlineImages(ctx,[A,B],{targetIndex:1,readSaved:ctx.readSaved});
 assert.equal(r.unverified,true);assert.deepEqual(ids(msg(ctx)),[A.id,B.id],'kept as is');
});
test('neither the intended nor the earlier state (e.g. another place) -> cannot tell, no revert',async()=>{
 const ctx=world();await attachInlineImages(ctx,[A],{targetIndex:1,readSaved:ctx.readSaved});
 ctx.saveChat=async function(){const d=structuredClone(this.chat);d[1].extra[IMAGE_KEY][0].placement='above';this.disk=d;};
 const signature=textSignature(msg(ctx).mes),r=await placeMessageImage(ctx,A,{message:msg(ctx),swipeId:0,signature,placement:'below',readSaved:ctx.readSaved});
 assert.equal(r.unverified,true);assert.equal(msg(ctx).extra[IMAGE_KEY][0].placement,'below');
});
test('the target must be the same: changed text, reroll or date -> cannot tell, no revert',async()=>{
 for(const change of [d=>{d[1].mes='edited'},d=>{d[1].swipe_id=1},d=>{d[1].send_date='other'},d=>{d.pop()}]){
  const ctx=world();ctx.saveChat=async function(){const d=structuredClone(this.chat);change(d);this.disk=d;};
  const r=await attachInlineImages(ctx,[A],{targetIndex:1,readSaved:ctx.readSaved});assert.equal(r.unverified,true);assert.equal(hasInlineImage(ctx.chat,A),true);
 }
});
test('a failed read-back or an odd answer -> cannot tell, no revert (also when the save threw)',async()=>{
 for(const readSaved of [async()=>{throw new Error('offline');},async()=>({not:'an array'}),async()=>null]){
  const ctx=world({mode:'throw'});const r=await attachInlineImages(ctx,[A],{targetIndex:1,readSaved});
  assert.equal(r.unverified,true);assert.equal(hasInlineImage(ctx.chat,A),true);
 }
});
test('restoring touches only the failed items: other changes made meanwhile stay, and an item changed since is skipped',async()=>{
 const ctx=world();await attachInlineImages(ctx,[C],{targetIndex:1,readSaved:ctx.readSaved}); // C is saved and stays
 ctx.mode='swallow';
 const readSaved=async()=>{ // while the check runs, the person puts D in and moves B to the top
  const m=msg(ctx);m.extra={...m.extra,[IMAGE_KEY]:[...m.extra[IMAGE_KEY].map(x=>x.id===B.id?{...x,placement:'above'}:x),{id:'d'.repeat(8)+A.id.slice(8),image:A.image,swipeId:0,signature:textSignature(m.mes)}]};
  return structuredClone(ctx.disk);
 };
 await assert.rejects(()=>attachInlineImages(ctx,[A,B],{targetIndex:1,readSaved}),/저장되지 않아/);
 const list=msg(ctx).extra[IMAGE_KEY];
 assert.ok(list.some(x=>x.id===C.id),'earlier saved picture stays');assert.ok(list.some(x=>x.id.startsWith('dddddddd')),'new local picture stays');
 assert.ok(!list.some(x=>x.id===A.id),'failed item removed');assert.ok(list.some(x=>x.id===B.id&&x.placement==='above'),'B was changed since, so it is left alone');
});
test('place: swallowed save puts the position back; saved position succeeds',async()=>{
 const ctx=world();await attachInlineImages(ctx,[A],{targetIndex:1,readSaved:ctx.readSaved});
 const args=()=>({message:msg(ctx),swipeId:0,signature:textSignature(msg(ctx).mes),readSaved:ctx.readSaved});
 ctx.mode='swallow';await assert.rejects(()=>placeMessageImage(ctx,A,{...args(),placement:'below'}),/저장되지 않아/);
 assert.equal(msg(ctx).extra[IMAGE_KEY][0].placement,undefined);assert.equal(msg(ctx).swipe_info[0].extra[IMAGE_KEY][0].placement,undefined);
 ctx.mode='ok';const r=await placeMessageImage(ctx,A,{...args(),placement:'below'});assert.equal(r.unverified,false);assert.equal(msg(ctx).extra[IMAGE_KEY][0].placement,'below');
 // back to the default = no placement
 await placeMessageImage(ctx,A,{...args(),placement:null});assert.equal(msg(ctx).extra[IMAGE_KEY][0].placement,undefined);
});
test('detach: swallowed save brings the picture back (message and swipe copy); saved removal succeeds',async()=>{
 const ctx=world();await attachInlineImages(ctx,[A,B],{targetIndex:1,readSaved:ctx.readSaved});
 const args=()=>({message:msg(ctx),swipeId:0,signature:textSignature(msg(ctx).mes),readSaved:ctx.readSaved});
 ctx.mode='swallow';await assert.rejects(()=>detachMessageImage(ctx,A,args()),/저장되지 않아/);
 assert.deepEqual(ids(msg(ctx)),[A.id,B.id],'back in place and order');assert.deepEqual(msg(ctx).swipe_info[0].extra[IMAGE_KEY].map(x=>x.id),[A.id,B.id]);assert.equal(msg(ctx).swipe_info[0].extra.keep,true);
 ctx.mode='ok';const r=await detachMessageImage(ctx,A,args());assert.equal(r.unverified,false);assert.deepEqual(ids(msg(ctx)),[B.id]);
 ctx.mode='swallow';await assert.rejects(()=>detachInlineImages(ctx,new Set([B.id]),{readSaved:ctx.readSaved}),/저장되지 않아/);assert.deepEqual(ids(msg(ctx)),[B.id]);
});
test('without a reader the old rule holds: a thrown save restores, a quiet one is success',async()=>{
 const ctx=world({mode:'throw'});await assert.rejects(()=>attachInlineImages(ctx,[A],{targetIndex:1}),/disk full/);assert.equal(hasInlineImage(ctx.chat,A),false);
 ctx.mode='swallow';const r=await attachInlineImages(ctx,[A],{targetIndex:1});assert.equal(r.unverified,false);
});
test('0.1.79: pictures that are already here are saved and checked again (an earlier save may not have been confirmed)',async()=>{
 const ctx=world();ctx.mode='swallow';ctx.readSaved=async()=>{throw new Error('offline');};
 let r=await attachInlineImages(ctx,[A,B],{targetIndex:1,readSaved:ctx.readSaved});assert.equal(r.unverified,true);
 const saves=ctx.saves;ctx.readSaved=async()=>structuredClone(ctx.disk); // the file still has nothing
 r=await attachInlineImages(ctx,[A,B],{targetIndex:1,readSaved:ctx.readSaved});
 assert.equal(ctx.saves,saves+1,'saved again');assert.equal(r.unverified,true,'never reported as saved while the file does not have them');assert.deepEqual(ids(msg(ctx)),[A.id,B.id]);
 ctx.mode='ok';r=await attachInlineImages(ctx,[A,B],{targetIndex:1,readSaved:ctx.readSaved});assert.equal(r.unverified,false);
});
