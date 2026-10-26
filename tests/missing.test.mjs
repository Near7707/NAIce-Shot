import test from 'node:test';
import assert from 'node:assert/strict';
import {sameName,exactName,shortName,mainPeopleOf,classifyMissing,descriptionFor,CARD_TEXT_LIMIT} from '../missing.mjs';
test('sameName: normalized match and whole-word parts only',()=>{
  assert.ok(sameName('Ana Reyes','ana  reyes'));assert.ok(sameName('Ana','Ana Reyes'));assert.ok(sameName('ana_reyes','Ana-Reyes'));
  assert.ok(!sameName('An','Anabel'));assert.ok(!sameName('A','A B'));assert.ok(!sameName('','Ana'));assert.ok(!sameName('Ana Reyes','Ben Reyes Cole'));
});
test('main people: single card + user, or every group member + user',()=>{
  const cards=[{name:'Ana Reyes',avatar:'ana.png'},{name:'Ben Cole',avatar:'ben.png'},{name:'Cy',avatar:'cy.png'}];
  assert.deepEqual(mainPeopleOf({characters:cards,characterId:1,groupId:null,name1:'Dee'}).map(p=>[p.name,p.role,p.avatar]),[['Ben Cole','character','ben.png'],['Dee','user','']]);
  const group={characters:cards,groupId:'g1',groups:[{id:'g1',members:['ana.png','cy.png']}],name1:'Dee'};
  assert.deepEqual(mainPeopleOf(group).map(p=>[p.name,p.role]),[['Ana Reyes','member'],['Cy','member'],['Dee','user']]);
});
test('classify: main people get their role, others stay side characters',()=>{
  const people=[{name:'Ana Reyes',role:'character'},{name:'Dee',role:'user'}];
  const r=classifyMissing(['Ana','street vendor','dee','Ana Reyes'],people);
  assert.deepEqual(r.main.map(m=>[m.name,m.person.role]),[['Ana','character'],['dee','user']],'one entry per person');
  assert.deepEqual(r.others,['street vendor']);
});
test('descriptionFor: card or persona text, SillyTavern reader first, capped',()=>{
  const ctx={characters:[{name:'Ana',description:'raw card'}],getCharacterCardFields:({chid}={})=>({description:chid===0?'filled card':'',persona:'filled persona'})};
  assert.equal(descriptionFor(ctx,{role:'character',chid:0}).text,'filled card');
  assert.equal(descriptionFor(ctx,{role:'user'}).text,'filled persona');
  assert.equal(descriptionFor({characters:[{data:{description:'v2 card'}}]},{role:'member',chid:0}).text,'v2 card');
  assert.equal(descriptionFor({powerUserSettings:{persona_description:' p '}},{role:'user'}).text,'p');
  const long=descriptionFor({characters:[{description:'x'.repeat(CARD_TEXT_LIMIT+5)}]},{role:'character',chid:0});
  assert.equal(long.text.length,CARD_TEXT_LIMIT);assert.equal(long.truncated,true);
  assert.equal(descriptionFor({getCharacterCardFields(){throw new Error('x');}},{role:'user'}).text,'');
});
test('stricter matching: exact first, first name or Korean given name only',()=>{
  assert.ok(exactName('김 민수','김민수'),'Korean spacing ignored');assert.ok(!exactName('Ana Reyes','Reyes Ana'),'word order matters');
  assert.ok(shortName('Ana','Ana Reyes'));assert.ok(!shortName('Reyes','Ana Reyes'),'surname alone is not enough');
  assert.ok(shortName('민수','김민수'));assert.ok(!shortName('김','김민수'));assert.ok(!shortName('crow-masked courier','Crow'),'a description containing a name is not that person');
  const people=[{name:'Crow',role:'character'},{name:'Ana',role:'character'},{name:'Ana Reyes',role:'user'}];
  const r=classifyMissing(['crow-masked courier','Ana Reyes','Reyes'],people);
  assert.deepEqual(r.main.map(m=>[m.name,m.person.role]),[['Ana Reyes','user']],'exact match beats the shorter card name');
  assert.deepEqual(r.others,['crow-masked courier','Reyes']);
  const two=[{name:'Ana Reyes',role:'member'},{name:'Ana Park',role:'member'}];
  assert.deepEqual(classifyMissing(['Ana'],two),{main:[],others:['Ana']},'ambiguous short name stays a side character');
  assert.deepEqual(classifyMissing(['민수'],[{name:'김민수',role:'user'}]).main.map(m=>m.person.role),['user']);
});
test('descriptions get {{char}}/{{user}} filled when SillyTavern did not',()=>{
  const ctx={name1:'Dee',characters:[{name:'Cy',description:'{{char}} smiles at {{ user }}.'}]};
  assert.equal(descriptionFor(ctx,{role:'member',chid:0}).text,'Cy smiles at Dee.');
  assert.equal(descriptionFor({...ctx,substituteParams:(t,u,c)=>t.replaceAll('{{char}}',`[${c}]`)},{role:'member',chid:0}).text,'[Cy] smiles at Dee.');
  assert.equal(descriptionFor({name1:'Dee',powerUserSettings:{persona_description:'I am {{user}}.'}},{role:'user'}).text,'I am Dee.');
});
