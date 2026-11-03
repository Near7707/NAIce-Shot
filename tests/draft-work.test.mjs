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
test('after a deletion the queue reads the marker again and saves on its revision',async()=>{
 const sent=[];let stored={revision:'old',work:{value:1}};
 const q=new DraftQueue({delay:100000,read:async()=>stored,write:async(key,b)=>{sent.push(b);return {revision:'next'};}});
 await q.ensure('A');stored={revision:'marker',work:null};q.reset('A');
 q.put('A',{value:2});assert.equal(q.entry('A').dirty,false,'nothing is saved before the marker is read');
 assert.equal(await q.ensure('A'),null);q.put('A',{value:3});await q.flush('A');
 assert.deepEqual(sent.map(b=>[b.work.value,b.expectedRevision]),[[3,'marker']]);
});
test('replies sent before a deletion never change the state after it; pause waits for saves in flight',async()=>{
 let releaseWrite,releaseRead;const gate=new Promise(r=>releaseWrite=r),readGate=new Promise(r=>releaseRead=r);const sent=[];
 const q=new DraftQueue({delay:100000,read:async key=>{if(key==='B'){await readGate;return {revision:'old',work:{value:'old'}};}return {revision:null,work:null};},write:async(key,b)=>{sent.push(b);if(sent.length===1)await gate;return {revision:`r${sent.length}`};}});
 await q.ensure('A');q.put('A',{value:1});const first=q.flush('A');
 let settled=false;const quiet=q.pause().then(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false,'waits for the save in flight');
 releaseWrite();await first;await quiet;assert.equal(settled,true);
 q.put('A',{value:2});const pending=q.entry('A');assert.equal(pending.dirty,true);await q.flush('A');assert.equal(sent.length,1,'nothing leaves while paused');assert.equal(pending.dirty,true,'held edits keep their data');
 q.resume();q.resume();await q.flush('A');assert.equal(sent.length,2,'a failed deletion sends the held edit');assert.equal(sent[1].work.value,2);assert.equal(pending.dirty,false);
 // A late reply after reset: ignored.
 let late;const q2=new DraftQueue({delay:100000,read:async()=>({revision:null,work:null}),write:async()=>{await new Promise(r=>late=r);return {revision:'stale'};}});
 await q2.ensure('A');q2.put('A',{value:1});const flying=q2.flush('A');q2.reset('A');late();await flying;
 assert.equal(q2.entry('A').revision,null,'the old revision is not restored');assert.equal(q2.entry('A').dirty,false);assert.equal(q2.entry('A').loaded,false);
 // A late read after reset: ignored too.
 const reading=q.ensure('B');q.reset('B');releaseRead();await reading;assert.equal(q.entry('B').data,null);assert.equal(q.entry('B').revision,null);assert.equal(q.entry('B').loaded,false);
});
test('resume survives an onState callback that touches entries (no endless loop)',async()=>{
 let q;q=new DraftQueue({delay:100000,read:async()=>({revision:null,work:null}),write:async()=>({revision:'r'}),onState:()=>{q.entry('A');}});
 await q.ensure('A');await q.ensure('B');await q.pause();q.put('A',{value:1});q.put('B',{value:2});q.resume();
 assert.equal(q.entry('A').dirty,true);assert.equal(q.entry('B').dirty,true);await q.flush('A');await q.flush('B');assert.equal(q.entry('A').dirty,false);
});
