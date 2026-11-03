import test from 'node:test';
import assert from 'node:assert/strict';
import {DraftQueue,packWork,unpackWork} from '../draft-work.mjs';
import {blankScene} from '../core.mjs';
const work=()=>({scene:{...blankScene(),source:{target:0,fingerprints:[{index:0,swipeId:0,text:'Example chat text'}]}},raw:'<think>private reasoning</think>{"location":"cafe"}',target:'0',wish:'reading',freeText:'',finalOverride:{base:'manual'},optionsOverride:{seed:7},result:{id:'image',payload:{secret:'never store'},snapshot:{rawExtraction:'never store'}},undoClear:null});
test('drafts omit source text, payload and raw by default, including undo; restore markers preserve reference semantics',()=>{
 const w=work();w.undoClear=work();w.restoredFinal=w.finalOverride;const p=packWork(w);
 assert.doesNotMatch(JSON.stringify(p),/Example chat text|private reasoning|never store/);
 assert.equal(p.raw,'');assert.equal(p.undoClear.raw,'');assert.ok(p.scene.source.fingerprints[0].signature);
 const restored=unpackWork(p);assert.equal(restored.finalOverride,restored.restoredFinal);assert.equal(restored.optionsOverride.seed,7);
 assert.equal(packWork(w,{retainRaw:true}).raw,'{"location":"cafe"}');assert.equal(p.undoClear.undoClear,null);
});
test('per-chat queue serializes edits made during a save and keeps failed data available for retry',async()=>{
 const sent=[];let release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);let fail=false;
 const q=new DraftQueue({delay:100000,read:async()=>({revision:null,work:null}),write:async(key,b)=>{sent.push([key,b]);if(sent.length===1){started();await gate;}if(fail)throw Error('offline');return {revision:String(sent.length)};}});
 await q.ensure('A');await q.ensure('B');q.put('A',{value:1});const saving=q.flush('A');await ready;q.put('A',{value:2});q.put('B',{value:3});release();await saving;await q.flush('B');
 assert.deepEqual(sent.map(([key,b])=>[key,b.work.value,b.expectedRevision]),[['A',1,null],['A',2,'1'],['B',3,null]]);
 fail=true;q.put('A',{value:4});await q.flush('A');assert.equal(q.entry('A').dirty,true);assert.equal(q.entry('A').data.value,4);assert.equal(q.entry('B').dirty,false);
 fail=false;await q.flush('A');assert.equal(q.entry('A').dirty,false);
});
test('drafts round-trip candidates, direct-input people, invalid JSON and one-level undo without settings',()=>{
 const w=work();w.scene.characters=[{id:'tmp-example',temp:true,name:'Visitor',appearance:'grey hair',outfit:'green coat',action:'reading',included:true}];
 w.scene.moments=[{title:'Reading',scene:{...blankScene(),characters:w.scene.characters}},{title:'Leaving',scene:{...blankScene(),location:'door'}}];w.scene.momentIndex=0;
 w.finalOverride={invalid:true,message:'unfinished JSON'};w.finalText='{"base":';w.undoClear=work();w.settings={apiKey:'should not be copied'};
 const out=unpackWork(packWork(w));assert.deepEqual(out.scene.moments,w.scene.moments);assert.equal(out.scene.characters[0].temp,true);assert.equal(out.finalText,'{"base":');assert.equal(out.finalOverride.invalid,true);assert.equal(out.undoClear.wish,'reading');assert.equal(out.settings,undefined);
});
test('forgetting a deleted work starts a fresh file and does not save an unchanged screen back',async()=>{
 const sent=[];const q=new DraftQueue({delay:100000,read:async()=>({revision:'old',work:{value:1}}),write:async(key,b)=>{sent.push(b);return {revision:'new'};}});
 await q.ensure('A');q.forget('A',{value:0});q.put('A',{value:0});assert.equal(q.entry('A').dirty,false,'same as the screen: nothing to save');
 q.put('A',{value:2});await q.flush('A');assert.deepEqual(sent.map(b=>[b.work.value,b.expectedRevision]),[[2,null]]);
 q.forget('B');assert.equal(q.entry('B').loaded,true);assert.equal(q.entry('B').data,null);
});
