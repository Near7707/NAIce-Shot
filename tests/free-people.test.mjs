import test from 'node:test';
import assert from 'node:assert/strict';
import {planFreePeople,applyFreePeople,migratePins,confirmText} from '../free-people.mjs';

const profiles=[{id:'leo',name:'Leo',aliases:['레오']},{id:'mira',name:'Mira',aliases:['미라']}];
const card=(id,extra={})=>({id,included:true,expression:'',action:'',position:'auto',outfitMode:'unchanged',outfit:'',manualOutfit:null,pinned:false,...extra});
const temp=(id,name,extra={})=>card(id,{temp:true,name,subject:'girl',appearance:'red hair',...extra});
let n=0;const makeTemp=name=>temp(`tmp-new-${++n}`,name,{appearance:'',subject:'other'});

test('plan: the text decides who stays; pinned cards stay unticked; unpinned ones go even if unticked',()=>{
 const cards=[card('leo'),card('mira',{included:false}),temp('t1','Kai',{pinned:true}),temp('t2','Robin',{pinned:true,included:false})];
 const plan=planFreePeople(cards,'레오가 다리 위에 서 있다',profiles);
 assert.deepEqual(plan.present.map(c=>c.id),['leo']);assert.deepEqual(plan.removed.map(c=>c.id),['mira'],'unticked unpinned card is still listed');
 assert.deepEqual(plan.pinnedOut.map(c=>c.id),['t1','t2']);assert.equal(plan.ask,true);
 const text=confirmText(plan,profiles);assert.match(text,/지워져요: Mira/);assert.match(text,/체크만 풀려요: Kai \(📌 고정\)/);assert.doesNotMatch(text,/Robin/,'already unticked pinned card is not asked about');
 assert.equal(planFreePeople([card('leo'),temp('t2','Robin',{pinned:true,included:false})],'Leo walks',profiles).ask,false,'nothing lost: no question');
});
test('plan: an unpinned temporary person named again is listed as refilled; name check is wide (keeps, never deletes)',()=>{
 const plan=planFreePeople([temp('t1','금발의 상인'),card('mira')],'금발의 상인이 웃고, 미라클 같은 일',profiles);
 assert.deepEqual(plan.refilled.map(c=>c.id),['t1']);assert.deepEqual(plan.present.map(c=>c.id),['t1','mira'],'over-inclusion only keeps the card');
 assert.equal(planFreePeople([temp('t1','금발의 상인')],'상인이 웃는다',profiles).removed.length,1,'a shorter name is not found: the confirm shows it');
});
test('apply: ticks follow the AI; named but not shown → unticked, kept; pinned temp keeps look and subject; unpinned takes the new look',()=>{
 const cards=[card('leo',{manualOutfit:'pajamas'}),card('mira'),temp('t1','Kai',{pinned:true,appearance:'blue hair',subject:'boy'}),temp('t2','Robin')];
 const plan=planFreePeople(cards,'Leo, Mira, Kai and Robin',profiles);
 const people=[{profile:profiles[0],name:'Leo',outfit:'raincoat',expression:'smile',action:'leaning'},
  {profile:null,name:'Kai',subject:'girl',appearance:'pink hair',outfit:'apron',expression:'calm'},
  {profile:null,name:'Robin',subject:'boy',appearance:'grey beard',outfit:''}];
 const out=applyFreePeople(cards,plan,people,{makeTemp});
 const by=id=>out.cards.find(c=>c.id===id);
 assert.equal(by('leo').included,true);assert.equal(by('leo').manualOutfit,'pajamas','the user choice is untouched');assert.equal(by('leo').outfit,'raincoat');assert.equal(by('leo').outfitMode,'replace');
 assert.equal(by('mira').included,false,'named but not visible: unticked, not deleted');assert.deepEqual(out.notShown.map(c=>c.id),['mira']);
 assert.equal(by('t1').appearance,'blue hair');assert.equal(by('t1').subject,'boy');assert.equal(by('t1').outfit,'apron');
 assert.equal(by('t2').appearance,'grey beard');assert.equal(by('t2').subject,'boy');assert.deepEqual(out.refreshed.map(c=>c.id),['t2']);
});
test('apply: removed cards go, pinned out stay unticked, new people are added unpinned, automatic clothes reset when not mentioned',()=>{
 const cards=[card('leo',{outfitMode:'replace',outfit:'raincoat'}),card('mira'),temp('t1','Kai',{pinned:true}),temp('t3','Sam',{outfit:'coat',outfitManual:true})];
 const plan=planFreePeople(cards,'Leo and Sam at night, a bartender behind them',profiles);
 const out=applyFreePeople(cards,plan,[{profile:profiles[0],name:'Leo',outfit:''},{profile:null,name:'Sam',appearance:'',outfit:'hoodie'},{profile:null,name:'the bartender',subject:'boy',appearance:'bald'}],{makeTemp});
 assert.equal(out.cards.some(c=>c.id==='mira'),false);assert.equal(out.cards.find(c=>c.id==='t1').included,false);
 const leo=out.cards.find(c=>c.id==='leo');assert.equal(leo.outfitMode,'unchanged');assert.equal(leo.outfit,'','automatic clothes go back to the default');
 assert.equal(out.cards.find(c=>c.id==='t3').outfit,'coat','typed temp clothes stay');assert.equal(out.cards.find(c=>c.id==='t3').appearance,'red hair','no new look given: kept');
 const b=out.cards.find(c=>c.name==='the bartender');assert.equal(b.pinned,false);assert.equal(b.appearance,'bald');assert.equal(b.included,true);
 assert.equal(cards.find(c=>c.id==='leo').outfit,'raincoat','the input cards are not changed (undo keeps them)');
});
test('migration: cards without a pin field are pinned once; explicit false stays',()=>{
 const cards=[card('leo',{pinned:undefined}),card('mira',{pinned:false})];delete cards[0].pinned;
 assert.equal(migratePins(cards),true);assert.equal(cards[0].pinned,true);assert.equal(cards[1].pinned,false);assert.equal(migratePins(cards),false);
});
test('saved work keeps 📌 and clothes state inside cards (the shared draft format, no server change)',async()=>{
 const {packWork,unpackWork}=await import('../draft-work.mjs');const {blankScene}=await import('../core.mjs');
 const scene={...blankScene(),characters:[card('leo',{pinned:true,outfitMode:'replace',outfit:'raincoat',manualOutfit:''}),temp('t1','Kai',{pinned:false,outfitManual:true,outfit:'coat'})]};
 const back=unpackWork(JSON.parse(JSON.stringify(packWork({scene,freeText:'레오',undoClear:{scene,label:'추출 전으로 되돌려요.'}}))));
 assert.equal(back.scene.characters[0].pinned,true);assert.equal(back.scene.characters[0].manualOutfit,'');assert.equal(back.scene.characters[0].outfit,'raincoat');
 assert.equal(back.scene.characters[1].pinned,false);assert.equal(back.scene.characters[1].outfitManual,true);
 assert.match(back.undoClear.label,/^추출 전/,'the undo kind is read back from its label');
});
test('migration: an old temporary person\'s clothes count as chosen (UI-059-03)',()=>{
 const old=[{id:'t1',temp:true,name:'Kai',outfit:'apron'},{id:'t2',temp:true,name:'Sam',outfit:''}];
 migratePins(old);assert.equal(old[0].outfitManual,true);assert.equal(old[1].outfitManual,undefined);
 const plan=planFreePeople(old,'Kai',[]);const out=applyFreePeople(old,plan,[{profile:null,name:'Kai',outfit:''}],{makeTemp});
 assert.equal(out.cards.find(c=>c.id==='t1').outfit,'apron');
});
