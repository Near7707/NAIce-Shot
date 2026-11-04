import test from 'node:test';
import assert from 'node:assert/strict';
import {readRefs,confirmRefs,refsForExtraction,shortIds,refText,queryAt,suggestions,stripRefMarks,plainNames,boundaryAfter} from '../mentions.mjs';
const P=[{id:'a3f2c1d0-1111-4111-8111-111111111111',name:'Leo',aliases:['레오']},{id:'b7e90000-2222-4222-8222-222222222222',name:'미라',aliases:['Mira']},
 {id:'c0de0000-3333-4333-8333-333333333333',name:'Kai Lee',aliases:[]}];
const ids=r=>r.refs.map(x=>x.id);
test('short ids are unique starts of the id, at least 4 characters, and grow only where needed',()=>{
 assert.equal(shortIds(P).get(P[0].id),'a3f2');
 const twin=[...P,{id:'a3f2ffff-0000-4000-8000-000000000000',name:'Leo',aliases:[]}],s=shortIds(twin);
 assert.equal(s.get(P[0].id),'a3f2c');assert.equal(s.get(twin[3].id),'a3f2f');
 assert.equal(refText(P[0],P),'@Leo#a3f2');
});
test('typed names: longest label at a boundary, particles (two at most), Korean and spaced names',()=>{
 for(const t of ['@Leo','@Leo가 웃는다','@레오랑 걷는다','@Leo에게는','@미라한테도 줬다','@Mira, hi','(@Leo)','@Kai Lee가'])assert.equal(readRefs(t,P).refs.length,1,t);
 assert.deepEqual(ids(readRefs('@Kai Lee가',P)),[P[2].id]);
 for(const t of ['@미라클','@Leo가방','@Leon','@Leo에게는요'])assert.equal(readRefs(t,P).refs.length,0,t),assert.equal(readRefs(t,P).problems.length,1,t);
 assert.equal(readRefs('mail a@b.com and me@Leo',P).refs.length+readRefs('mail a@b.com and me@Leo',P).problems.length,0,'@ inside a word is not a reference');
});
test('id form: links by id even after a rename, checks the boundary after the id, never falls back to the name',()=>{
 assert.deepEqual(ids(readRefs('@Leo#a3f2가 앉는다',P)),[P[0].id]);
 const renamed=[{...P[0],name:'Leon'},P[1],P[2]];assert.deepEqual(ids(readRefs('@Leo#a3f2',renamed)),[P[0].id],'same person after a rename');
 assert.match(readRefs('@Leo#zz99',P).problems[0].message,/찾을 수 없는/);
 assert.match(readRefs('@Leo#a3f2가방',P).problems[0].message,/붙어 있어요/);
 const twin=[...P,{id:'a3f2ffff-0000-4000-8000-000000000000',name:'Leo',aliases:[]}];
 assert.match(readRefs('@Leo#a3f2',twin).problems[0].message,/겹쳐요/,'an old short id that now fits two stops');
 assert.match(readRefs('@Leo',twin).problems[0].message,/여러 개/,'a typed name that fits two stops');
 const reused=[{...P[0],name:'Leon'},P[1],P[2],{id:'d0000000-0000-4000-8000-000000000000',name:'Leo',aliases:[]}];
 assert.deepEqual(ids(readRefs('@Leo#a3f2',reused)),[P[0].id],'a new Leo does not take the old reference');
});
test('confirming typed names, text for the AI, plain names and leftovers',()=>{
 const c=confirmRefs('@레오랑 @Mira#b7e9 산책',P);assert.equal(c.text,'@Leo#a3f2랑 @Mira#b7e9 산책');assert.deepEqual(c.confirmed,[{from:'@레오',to:'@Leo#a3f2'}]);
 assert.equal(confirmRefs('@미라클',P).problems.length,1);
 const x=refsForExtraction('@Leo#a3f2랑 @미라#b7e9, 그리고 @레오',P);
 assert.deepEqual(x.required.map(p=>p.name),['Leo','미라'],'one each, first mention first');
 assert.ok(!/[@#]/.test(x.text));assert.match(x.text,/Leo \(roster id a3f2c1d0-1111-4111-8111-111111111111\)랑/);
 assert.equal(plainNames('@Leo#a3f2랑 놀기',P),'Leo랑 놀기');
 assert.equal(stripRefMarks('smiling at @Leo#a3f2 and a@b.com'),'smiling at Leo and a@b.com');
 assert.equal(boundaryAfter('Leo랑방',3),-1);
});
test('autocomplete: the query before the caret, names and aliases',()=>{
 assert.deepEqual(queryAt('함께 @레',5),{start:3,query:'레'});assert.equal(queryAt('a@b',3),null);assert.equal(queryAt('@Leo#a3',7),null);
 assert.deepEqual(suggestions(P,'레').map(s=>s.name),['Leo']);assert.deepEqual(suggestions(P,'mi').map(s=>s.name),['미라']);assert.equal(suggestions(P,'').length,3);
});
test('an id written in full wins over a longer id that starts with it',()=>{
 const Q=[{id:'leo',name:'Leo',aliases:[]},{id:'leon-two',name:'Leo',aliases:[]}],s=shortIds(Q);
 assert.deepEqual([s.get('leo'),s.get('leon-two')],['leo','leon']);
 assert.deepEqual(ids(readRefs('@Leo#leo랑 @Leo#leon',Q)),['leo','leon-two']);
});
