import test from 'node:test';
import assert from 'node:assert/strict';
import {blankScene,parseExtraction} from '../core.mjs';
import {matchChatProfiles,reconcileCharacters,attachSceneProfile} from '../matching.mjs';
import {sceneExtractionSchema,sceneExtractionPrompt} from '../scene-extraction.mjs';
import {genericizeScene} from '../tags.mjs';

const profile=(id,name,aliases=[])=>({id,name,aliases,cardKey:'',appearance:'private fixed appearance',defaultOutfit:'coat'});
const person=(name,id='',extra={})=>({id,name,expression:'smile',action:'holding cup',position:'left',outfitMode:'replace',outfit:'blue shirt, jeans',...extra});
const reply=(characters,unregistered=[])=>JSON.stringify({characters,unregistered,location:'cafe',lighting:'day',camera:'wide shot',interaction:'conversation'});
const scope=profiles=>({profiles,allProfiles:profiles,mappings:[]});

test('unregistered visual fields survive extraction, name cleaning, history serialization and later profile creation',()=>{
 const parsed=parseExtraction(reply([person('Vendor','',{action:'looking at Mira, holding cup'})],['Vendor']),[]).scene;
 const unresolved=reconcileCharacters(parsed,scope([])).scene;
 const cleaned=genericizeScene(unresolved,['Vendor','Mira'],'tags').scene;
 assert.deepEqual(cleaned.characters,[]);assert.deepEqual(cleaned.unregistered,['Vendor']);
 const restored=JSON.parse(JSON.stringify(cleaned)),p=profile('new','New profile');
 const added=attachSceneProfile(restored,p,['Vendor']);
 assert.equal(added.restored,true);assert.equal(added.character.id,'new');
 assert.equal(added.character.expression,'smile');assert.match(added.character.action,/holding cup/);
 assert.doesNotMatch(added.character.action,/Mira/);assert.equal(added.character.position,'left');
 assert.equal(added.character.outfit,'blue shirt, jeans');assert.equal(added.character.outfitMode,'replace');
 assert.deepEqual(restored.unregistered,[]);assert.deepEqual(restored.unregisteredDetails,[]);
 assert.equal(cleaned.unregisteredDetails.length,1,'attaching after history serialization cannot mutate the previous record');
});

test('an identity-only AI omission is recovered from the full local saved directory even outside the sent roster',()=>{
 const profiles=[profile('one','One'),profile('other','Other',['다른 이름'])];
 const matching=matchChatProfiles({characters:[],groupId:null,name1:'',name2:'One'},profiles,[]);
 assert.deepEqual(matching.profiles.map(p=>p.id),['one']);
 const fixed=reconcileCharacters(parseExtraction(reply([person('다른 이름')]),profiles).scene,matching).scene;
 assert.equal(fixed.characters[0].id,'other');assert.equal(fixed.characters[0].action,'holding cup');
 assert.deepEqual(fixed.unregistered,[]);
});

test('an ambiguous alias stays unresolved with its visual fields intact rather than choosing an arbitrary profile',()=>{
 const profiles=[profile('a','Alpha',['Shared']),profile('b','Beta',['Shared'])];
 const fixed=reconcileCharacters(parseExtraction(reply([person('Shared','a')]),profiles).scene,scope(profiles)).scene;
 assert.deepEqual(fixed.characters,[]);assert.deepEqual(fixed.unregistered,['Shared']);
 assert.equal(fixed.unregisteredDetails[0].action,'holding cup');
 const chosen=attachSceneProfile(fixed,profiles[1],['Shared']);
 assert.equal(chosen.character.id,'b');assert.equal(chosen.character.action,'holding cup');
});

test('a visible person is resolved by a bound card name in a different card chat without exposing the card description',()=>{
 const profiles=[profile('one','One'),{...profile('other','Saved display name'),cardKey:'Other.png'}];
 const context={name1:'',name2:'One',characterId:0,groupId:null,characters:[{name:'One',avatar:'One.png'},{name:'Second Person',avatar:'Other.png',description:'SECRET CARD'}]};
 const matching=matchChatProfiles(context,profiles,[{role:'character',speaker:'One',text:'Second Person waves.'}]);
 const fixed=reconcileCharacters(parseExtraction(reply([person('Second Person','')],['Second Person']),profiles).scene,matching).scene;
 assert.equal(fixed.characters[0].id,'other');assert.deepEqual(fixed.unregistered,[]);
 const prompt=sceneExtractionPrompt([],matching.profiles,{},'tags',matching.mappings);
 assert.match(prompt,/Second Person/);assert.doesNotMatch(prompt,/SECRET CARD|private fixed appearance/);
});

test('the scene request keeps unresolved people in character slots and never forces candidate presence',()=>{
 const profiles=[profile('a','Alpha')],schema=sceneExtractionSchema(profiles);
 assert.deepEqual(schema.properties.characters.items.properties.id.enum,['a','']);
 assert.deepEqual(sceneExtractionSchema([]).properties.characters.items.properties.id.enum,['']);
 const prompt=sceneExtractionPrompt([{text:'An unknown person holds a cup.'}],profiles,{},'tags');
 assert.match(prompt,/EVERY physically visible person/);assert.match(prompt,/empty string for id/);
 assert.match(prompt,/merely mentioned, remembered or remote/);assert.match(prompt,/not a list of people who must appear/);
 assert.match(prompt,/DANBOORU TAG GUIDE/);assert.match(prompt,/GENERIC VISUALS/);
 assert.deepEqual(reconcileCharacters(parseExtraction(reply([]),profiles).scene,scope(profiles)).scene.characters,[]);
});

test('adding a saved profile with no recorded appearance in the scene does not invent a pose',()=>{
 const scene=blankScene(),added=attachSceneProfile(scene,profile('a','Alpha'));
 assert.equal(added.restored,false);assert.equal(added.character.action,'');assert.equal(added.character.expression,'');
 assert.equal(added.character.outfitMode,'unchanged');
});
