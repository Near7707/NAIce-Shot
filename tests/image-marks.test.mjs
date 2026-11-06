// 0.1.84: tags and favorites (★) for history pictures, and the tag-suggestion match.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTags,cleanMarks,cleanPopupChats,setMark,forgetIds,forgetChat,starredIds,taggedIds,ownerOf,messageWords,tagHits,tagMatches,pickMatch,taggedFor,TAG_LIMIT,TAG_LENGTH,MARK_LIMIT} from '../image-marks.mjs';

const id=n=>`0000000${n}-aaaa-4bbb-8ccc-${String(n).padStart(12,'0')}`;
const chat=(card,chatName='Mira - 1')=>JSON.stringify({group:null,card,chat:chatName});
const group=(g,chatName='party')=>JSON.stringify({group:g,card:null,chat:chatName});
const FREE=JSON.stringify({free:true});

test('tags: commas split (also ，、 and new lines), spaces inside stay, duplicates by case drop, limits are named',()=>{
  assert.deepEqual(parseTags(' 웃음,  비 오는   날 ，Smile、smile\n'),['웃음','비 오는 날','Smile']);
  assert.deepEqual(parseTags(''),[]);assert.deepEqual(parseTags(' , ,'),[]);
  assert.throws(()=>parseTags(Array.from({length:TAG_LIMIT+1},(_,i)=>`t${i}`).join(',')),/10개까지/);
  assert.throws(()=>parseTags('가'.repeat(TAG_LENGTH+1)),/30자까지/);
  assert.deepEqual(parseTags('가'.repeat(TAG_LENGTH)),['가'.repeat(TAG_LENGTH)]);
});

test('marks belong to the picture ID: a star or tags set, cleared, and the entry goes when both are empty',()=>{
  const a={id:id(1),chatKey:chat('mira.png')},b={id:id(2),chatKey:chat('mira.png')};
  let m=setMark({},a,{star:true});m=setMark(m,b,{tags:['웃음']});
  assert.deepEqual(m[a.id],{chatKey:a.chatKey,star:true});assert.deepEqual(m[b.id],{chatKey:b.chatKey,tags:['웃음']});
  m=setMark(m,a,{tags:['비']});assert.deepEqual(m[a.id],{chatKey:a.chatKey,star:true,tags:['비']}); // tags keep the star
  m=setMark(m,a,{star:false});assert.deepEqual(m[a.id],{chatKey:a.chatKey,tags:['비']});
  m=setMark(m,a,{tags:[]});assert.equal(a.id in m,false);
  assert.throws(()=>setMark({},{id:'3',chatKey:'x'},{star:true}),/ID/);
  assert.throws(()=>setMark({},{id:id(3),chatKey:''},{star:true}),/ID/);
  assert.deepEqual(starredIds(setMark(m,a,{star:true})),[a.id]);
});

test('removing one picture never moves its tag or star to a neighbour (no list positions)',()=>{
  const items=[1,2,3].map(n=>({id:id(n),chatKey:chat('mira.png')}));
  let m={};for(const [i,it] of items.entries())m=setMark(m,it,{tags:[`t${i}`],star:i===2});
  const {marks:after,changed}=forgetIds(m,[items[0].id]);
  assert.equal(changed,true);
  assert.deepEqual(Object.keys(after).sort(),[items[1].id,items[2].id].sort());
  assert.deepEqual(after[items[1].id].tags,['t1']);assert.deepEqual(after[items[2].id],{chatKey:items[2].chatKey,star:true,tags:['t2']});
  assert.equal(forgetIds(after,[id(9)]).changed,false);
  const other={id:id(4),chatKey:chat('kai.png')};const mixed=setMark(after,other,{star:true});
  assert.deepEqual(Object.keys(forgetChat(mixed,chat('mira.png')).marks),[other.id]);
});

test('the mark list has a ceiling; an existing picture can still change at the ceiling',()=>{
  const full={};for(let i=0;i<MARK_LIMIT;i++)full[`${String(i).padStart(8,'0')}-aaaa-4bbb-8ccc-000000000000`]={chatKey:'k',star:true};
  assert.throws(()=>setMark(full,{id:id(1),chatKey:'k'},{star:true}),/3000장/);
  const known=Object.keys(full)[0];assert.doesNotThrow(()=>setMark(full,{id:known,chatKey:'k'},{tags:['a']}));
});

test('saved marks are read back clean: broken entries and empty ones drop, the rest stays as it was',()=>{
  const good={chatKey:chat('mira.png'),star:true,tags:['웃음']};
  const out=cleanMarks({[id(1)]:good,'../x':good,[id(2)]:{chatKey:'',star:true},[id(3)]:{chatKey:'k'},[id(4)]:{chatKey:'k',tags:['a'.repeat(31)]},[id(5)]:{chatKey:'k',star:'yes'}});
  assert.deepEqual(out,{[id(1)]:good});
  assert.deepEqual(cleanMarks(null),{});assert.deepEqual(cleanMarks([1]),{});
  assert.deepEqual(cleanPopupChats({a:true,b:false,[FREE]:true,c:'yes'}),{a:true});
});

test('whose picture: the card of a one-on-one chat or the group; 프리샷 and unreadable keys belong to no one',()=>{
  assert.equal(ownerOf(chat('mira.png')),'card:mira.png');
  assert.equal(ownerOf(group('g1')),'group:g1');
  assert.equal(ownerOf(JSON.stringify({group:'g1',card:'mira.png',chat:'x'})),'group:g1');
  assert.equal(ownerOf(FREE),null);assert.equal(ownerOf('not json'),null);assert.equal(ownerOf(JSON.stringify({group:null,card:null,chat:'x'})),null);
});

test('matching: Korean anywhere, Latin as whole words, case ignored, HTML and markdown marks ignored',()=>{
  const w=messageWords('<p>She *laughs* and catches the <b>RAIN</b>.</p> 그녀가 웃었다');
  assert.equal(w,'she laughs and catches the rain . 그녀가 웃었다');
  assert.equal(tagHits(w,'웃'),true);assert.equal(tagHits(w,'웃음'),false);
  assert.equal(tagHits(w,'rain'),true);assert.equal(tagHits(w,'Rain'),true);
  assert.equal(tagHits(w,'cat'),false);assert.equal(tagHits(w,'catches'),true);assert.equal(tagHits(w,'laugh'),false);
  assert.equal(tagHits(messageWords('rain-soaked'),'rain'),true);
  assert.equal(tagHits(messageWords("it's rainy, rain"),'rain'),true);
  assert.equal(tagHits(w,'the rain'),true);
});

test('suggestions come only from the same character or group, never 프리샷, and say which tags matched',()=>{
  let m={};
  m=setMark(m,{id:id(1),chatKey:chat('mira.png','Mira - 1')},{tags:['웃','비']});
  m=setMark(m,{id:id(2),chatKey:chat('mira.png','Mira - 2')},{tags:['비']});
  m=setMark(m,{id:id(3),chatKey:chat('kai.png')},{tags:['비']});
  m=setMark(m,{id:id(4),chatKey:FREE},{star:true});
  m=setMark(m,{id:id(5),chatKey:group('g1')},{tags:['비']});
  m=setMark(m,{id:id(6),chatKey:chat('mira.png')},{star:true}); // a star alone is never suggested
  const here=chat('mira.png','Mira - 1');
  const found=tagMatches(m,here,'비가 내리고 그녀가 웃는다');
  assert.deepEqual(found.map(x=>x.id).sort(),[id(1),id(2)]);
  assert.deepEqual(found.find(x=>x.id===id(1)).tags,['웃','비']);
  assert.deepEqual(tagMatches(m,group('g1'),'비').map(x=>x.id),[id(5)]);
  assert.deepEqual(tagMatches(m,FREE,'비'),[]);assert.deepEqual(tagMatches(m,here,''),[]);assert.deepEqual(tagMatches(m,here,'맑음'),[]);
  assert.equal(taggedFor(m,here),2);assert.equal(taggedFor(m,FREE),0);
});

test('one match at random; the last shown picture comes again only when it is the only one',()=>{
  const list=[{id:'a'},{id:'b'},{id:'c'}];
  assert.equal(pickMatch(list,{random:()=>0}).id,'a');assert.equal(pickMatch(list,{random:()=>0.99}).id,'c');
  assert.equal(pickMatch(list,{avoid:'a',random:()=>0}).id,'b');
  assert.equal(pickMatch([{id:'a'}],{avoid:'a'}).id,'a');assert.equal(pickMatch([]),null);
  const seen=new Set();for(let i=0;i<60;i++)seen.add(pickMatch(list).id);assert.equal(seen.size,3);
});

test('0.1.86: taggedIds lists only pictures that have tags',()=>{
  const m={a:{chatKey:'k',star:true},b:{chatKey:'k',tags:['rain']},c:{chatKey:'k',tags:[]},d:{chatKey:'k',star:true,tags:['웃음']}};
  assert.deepEqual(taggedIds(m).sort(),['b','d']);
  assert.deepEqual(taggedIds({}),[]);
});
