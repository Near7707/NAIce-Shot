import test from 'node:test';
import assert from 'node:assert/strict';
import { textSignature } from '../core.mjs';
import { locateSource, locateAttached, jumpTargets } from '../message-jump.mjs';
const src=(index,text,swipeId=0)=>({target:index,fingerprints:[{index:index-1,swipeId:0,signature:textSignature('before')},{index,swipeId,signature:textSignature(text)}]});
const chat=()=>[{mes:'hello'},{mes:'before'},{mes:'Leo pours tea.',swipe_id:0,swipes:['Leo pours tea.','Leo waves.']},{mes:'after'}];
test('finds the made message unchanged, on another swipe, moved, edited or missing',()=>{
  assert.deepEqual(locateSource(src(2,'Leo pours tea.'),chat()),{index:2,state:'same'});
  const swiped=chat();swiped[2].swipe_id=1;swiped[2].mes='Leo waves.';
  assert.deepEqual(locateSource(src(2,'Leo pours tea.'),swiped),{index:2,state:'swipe'});
  const moved=chat().slice(1);assert.deepEqual(locateSource(src(2,'Leo pours tea.'),moved),{index:1,state:'moved'});
  // Edited is only claimed for the same message (send time); a message that slid into the number is not it.
  const dated=(i,t,d)=>{const x=src(i,t);x.fingerprints[1].sendDate=d;return x;};
  const edited=chat();edited[2]={mes:'Leo pours coffee.',send_date:'d2'};assert.deepEqual(locateSource(dated(2,'Leo pours tea.','d2'),edited),{index:2,state:'edited'});
  const slid=chat();slid[2]={mes:'A later message.',send_date:'d3'};assert.deepEqual(locateSource(dated(2,'Leo pours tea.','d2'),slid),{index:null,state:'missing'});
  assert.deepEqual(locateSource(src(2,'Leo pours tea.'),slid),{index:null,state:'missing'},'no send time: never guessed by number');
  const both=[{mes:'hello'},{mes:'Leo pours coffee.',send_date:'d2'},{mes:'after'}];assert.deepEqual(locateSource(dated(2,'Leo pours tea.','d2'),both),{index:1,state:'edited'},'edited and moved');
  assert.deepEqual(locateSource(src(9,'gone'),chat()),{index:null,state:'missing'});
  assert.deepEqual(locateSource(null,chat()),{index:null,state:'missing'});
  const hidden=chat();hidden[2].is_system=true;assert.deepEqual(locateSource(src(2,'Leo pours tea.'),hidden),{index:2,state:'same'});
});
test('one target when made and attached are the same, two when they differ',()=>{
  const c=chat();c[2].extra={naice_shot_images:[{id:'a'}]};
  assert.equal(locateAttached('a',c),2);assert.equal(locateAttached('b',c),null);
  let r=jumpTargets({id:'a',snapshot:{scene:{source:src(2,'Leo pours tea.')}}},c);assert.equal(r.both,true);assert.deepEqual(r.targets.map(t=>[t.kind,t.index]),[['attached',2]]);
  c[3].extra={naice_shot_images:[{id:'a'}]};r=jumpTargets({id:'a',snapshot:{scene:{source:src(2,'Leo pours tea.')}}},c);
  assert.deepEqual(r.targets.map(t=>[t.kind,t.index]),[['attached',3],['made',2]]);
  r=jumpTargets({id:'z',snapshot:{scene:{source:null}}},c);assert.deepEqual(r.targets,[]);
});
