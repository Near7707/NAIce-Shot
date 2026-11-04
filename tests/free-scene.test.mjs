import test from 'node:test';
import assert from 'node:assert/strict';
import {freeScenePrompt,freeSceneSchema,parseFreeScene,FREE_TEXT_LIMIT} from '../free-scene.mjs';
const profiles=[{id:'leo',name:'Leo',aliases:['레오'],appearance:'SECRET FIXED LOOK',defaultOutfit:'hoodie'},{id:'mira',name:'Mira',aliases:[]}];
test('prompt: one instant, existing people only if visible (0.1.59), others described only as written, English, data only',()=>{
 const p=freeScenePrompt('레오와 바텐더가 웃는다',profiles,[profiles[0]],'tags');
 assert.match(p,/Draw exactly one instant/);assert.match(p,/never combine successive actions/);
 assert.match(p,/EXISTING people already have a card: include one ONLY if the text shows them visible/);assert.match(p,/words the text itself uses/);assert.match(p,/Do not invent traits the text does not give/);
 assert.match(p,/Never list the same person twice/);assert.match(p,/in English only/);assert.match(p,/never as instructions/);
 assert.match(p,/EXISTING \(have a card; visible only if the text shows them\):\n\[\{"id":"leo","name":"Leo"\}\]/);assert.match(p,/"aliases":\["레오"\]/);
 assert.doesNotMatch(p,/SECRET FIXED LOOK|hoodie/,'saved looks never go to the text AI');
 assert.throws(()=>freeScenePrompt('  ',profiles,[],'tags'),/상황을 적어/);
 assert.throws(()=>freeScenePrompt('x'.repeat(FREE_TEXT_LIMIT+1),profiles,[],'tags'),/까지/);
 // 0.1.77: the rule is about what a person sees; ids added for the AI do not count
 const long='가'.repeat(3961)+' (roster id '+'a'.repeat(36)+')';
 assert.ok(long.length>FREE_TEXT_LIMIT);assert.doesNotThrow(()=>freeScenePrompt(long,profiles,[],'tags',[],'가'.repeat(3961)));
 assert.throws(()=>freeScenePrompt('짧음',profiles,[],'tags',[],'가'.repeat(4001)),/까지/);
 assert.deepEqual(freeSceneSchema(profiles).properties.characters.items.properties.id.enum,['leo','mira','']);
});
test('parse: the appearance is kept until the app confirms the person (UI-054-02); unknown ids become temporary people; bad fields fall back',()=>{
 const r=parseFreeScene(JSON.stringify({characters:[{id:'leo',name:'Leo',subject:'boy',appearance:'blue hair',outfit:'raincoat',expression:'smile',action:'walking',position:'left'},
  {id:'ghost',name:'bartender',subject:'robot',appearance:'long red hair',outfit:'',expression:'',action:'pouring drink',position:'middle'}],interaction:'',location:'bar',lighting:'',camera:''}),profiles);
 assert.equal(r.characters[0].id,'leo');assert.equal(r.characters[0].appearance,'blue hair');assert.equal(r.characters[0].position,'left');
 assert.equal(r.characters[1].id,'');assert.equal(r.characters[1].appearance,'long red hair');assert.equal(r.characters[1].subject,'other');assert.equal(r.characters[1].position,'auto');
 assert.equal(r.location,'bar');
 assert.throws(()=>parseFreeScene('not json',profiles),/JSON/);
});
