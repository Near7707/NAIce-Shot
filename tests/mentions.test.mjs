import test from 'node:test';
import assert from 'node:assert/strict';
import {readRefs,confirmRefs,refsForExtraction,chipToken,tokenize,displayLength,displayText,queryAt,suggestions,lookSummary,stripRefMarks,plainNames,boundaryAfter} from '../mentions.mjs';
const P=[{id:'a3f2c1d0-1111-4111-8111-111111111111',name:'Leo',aliases:['레오'],appearance:'short brown hair, green eyes, tall',defaultOutfit:'white shirt, black jeans, sneakers'},
 {id:'b7e90000-2222-4222-8222-222222222222',name:'미라',aliases:['Mira'],appearance:'long black hair',defaultOutfit:''},
 {id:'c0de0000-3333-4333-8333-333333333333',name:'Kai Lee',aliases:[],appearance:'',defaultOutfit:''}];
const ids=r=>r.refs.map(x=>x.id);
const chip=p=>chipToken(p.name,p.id);
test('a chip is written @[name](ref:FULL-ID) and read back by its id, also after a rename',()=>{
 assert.equal(chip(P[0]),'@[Leo](ref:a3f2c1d0-1111-4111-8111-111111111111)');
 assert.deepEqual(ids(readRefs(`${chip(P[0])}가 앉는다`,P)),[P[0].id]);
 const renamed=[{...P[0],name:'Leon'},P[1],P[2]];assert.deepEqual(ids(readRefs(chip(P[0]),renamed)),[P[0].id],'same person after a rename');
 const reused=[{...P[0],id:'d0000000-0000-4000-8000-000000000000'},P[1]];
 assert.match(readRefs(chip(P[0]),reused).problems[0].message,/찾을 수 없는/,'a new Leo does not take the old chip');
 assert.match(readRefs('@[Leo](ref:)',P).problems[0].message,/찾을 수 없는/,'a chip without an id is broken');
 assert.deepEqual(tokenize(`a ${chip(P[1])}\nb`).map(p=>p.type),['text','chip','text']);
 assert.equal(displayText(`a ${chip(P[1])}!`),'a @미라!');assert.equal(displayLength(`a ${chip(P[1])}!`),6);
});
test('two people with the same name stay two chips (told apart by id)',()=>{
 const twin=[...P,{id:'a3f2ffff-0000-4000-8000-000000000000',name:'Leo',aliases:[],appearance:'blond hair'}];
 assert.deepEqual(ids(readRefs(`${chip(twin[0])} ${chip(twin[3])}`,twin)),[twin[0].id,twin[3].id]);
 assert.match(readRefs('@Leo',twin).problems[0].message,/여러 개/,'a typed name that fits two stops');
});
test('typed names: longest label at a boundary, particles (two at most), Korean and spaced names',()=>{
 for(const t of ['@Leo','@Leo가 웃는다','@레오랑 걷는다','@Leo에게는','@미라한테도 줬다','@Mira, hi','(@Leo)','@Kai Lee가'])assert.equal(readRefs(t,P).refs.length,1,t);
 assert.deepEqual(ids(readRefs('@Kai Lee가',P)),[P[2].id]);
 for(const t of ['@미라클','@Leo가방','@Leon','@Leo에게는요'])assert.equal(readRefs(t,P).refs.length,0,t),assert.equal(readRefs(t,P).problems.length,1,t);
 assert.equal(readRefs('mail a@b.com and me@Leo',P).refs.length+readRefs('mail a@b.com and me@Leo',P).problems.length,0,'@ inside a word is not a reference');
});
test('old 0.1.75 marks and malformed marks are broken, never linked or sent (UI-075-01)',()=>{
 for(const t of ['@Ada#a','@Ada#a3','@Ada#','@Leo#a3f2가 앉는다','@Leo#zz99','@Leo#a3f2가방']){
  const r=readRefs(t,P);assert.equal(r.refs.length,0,t);assert.equal(r.problems.length,1,t);assert.match(r.problems[0].message,/예전 형식|잘못된 형식/,t);
 }
 assert.equal(readRefs('@Leo #1 fan',P).refs.length,1,'a space before # is plain text after a typed name');
 const old=tokenize('@Leo#a3f2').find(p=>p.type==='chip');
 assert.equal(old.legacy,true);assert.equal(old.id,'','an old mark has no id');
});
test('confirming typed names into chips, text for the AI, plain names and leftovers',()=>{
 const c=confirmRefs(`@레오랑 ${chip(P[1])} 산책`,P);
 assert.equal(c.text,`${chip(P[0])}랑 ${chip(P[1])} 산책`);assert.deepEqual(c.confirmed,[{from:'@레오',to:'@Leo'}]);
 assert.equal(confirmRefs('@미라클',P).problems.length,1);
 assert.equal(confirmRefs(`${chip(P[0])} @Nobody`,P).problems.length,1,'one problem stops everything');
 const x=refsForExtraction(`${chip(P[0])}랑 ${chip(P[1])}, 그리고 @레오`,P);
 assert.deepEqual(x.required.map(p=>p.name),['Leo','미라'],'one each, first mention first');
 assert.ok(!/[@\[]/.test(x.text),x.text);assert.match(x.text,/Leo \(roster id a3f2c1d0-1111-4111-8111-111111111111\)랑/);
 assert.equal(plainNames(`${chip(P[0])}랑 놀기`,P),'Leo랑 놀기');
 assert.equal(stripRefMarks(`smiling at ${chip(P[0])} and a@b.com, @Ada#a1`),'smiling at Leo and a@b.com, Ada');
 assert.equal(boundaryAfter('Leo랑방',3),-1);
});
test('autocomplete: the query before the caret, names and aliases, a short look to tell people apart',()=>{
 assert.deepEqual(queryAt('함께 @레',5),{start:3,query:'레'});assert.equal(queryAt('a@b',3),null);
 assert.deepEqual(suggestions(P,'레').map(s=>s.name),['Leo']);assert.deepEqual(suggestions(P,'mi').map(s=>s.name),['미라']);assert.equal(suggestions(P,'').length,3);
 assert.equal(lookSummary(P[0]),'short brown hair, green eyes · white shirt, black jeans');
 assert.equal(lookSummary(P[1]),'long black hair');assert.equal(lookSummary(P[2]),'');
 assert.ok(suggestions(P,'레')[0].look.includes('green eyes'));
});
