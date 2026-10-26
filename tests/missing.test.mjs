import test from 'node:test';
import assert from 'node:assert/strict';
import {sameName,mainPeopleOf,classifyMissing,descriptionFor,CARD_TEXT_LIMIT} from '../missing.mjs';
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
