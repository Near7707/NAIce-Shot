import test from 'node:test';
import assert from 'node:assert/strict';
import {stripNames,normalizeTags,genericizeScene} from '../tags.mjs';
import {extractionPrompt,profileDraftPrompt} from '../core.mjs';

const names=['Mira','Leo','미라','Ash'];
const clean=t=>normalizeTags(stripNames(t,names)[0]);
test('story names, possessives and macros are removed from scene text',()=>{
  assert.equal(clean("Mira's bedroom, night"),'bedroom, night');
  assert.equal(clean('bedroom of Mira'),'bedroom');
  assert.equal(clean("{{user}}'s room"),'room');
  assert.equal(clean('{{char}} sitting, <user>'),'sitting');
  assert.equal(clean('looking at Mira'),'looking at another');
  assert.equal(clean('talking to Leo'),'talking');
  assert.equal(clean('ashtray on table, Ash smiling'),'ashtray on table, smiling','names inside other words stay');
  assert.deepEqual(stripNames('Leo and Mira',names)[1].sort(),['Leo','Mira']);
  assert.equal(stripNames('미라의 방',names)[0].trim(),'방');
});
test('tags follow Danbooru formatting',()=>{
  assert.equal(normalizeTags('Upper_Body, {smile}, [[blush]], 1.2::close-up::, looking_at_viewer:1.1, smile, the, '),'upper body, smile, blush, close-up, looking at viewer');
});
test('genericizeScene cleans descriptive fields only and keeps identity fields',()=>{
  const {scene,removed}=genericizeScene({location:"Mira's apartment, living room",lighting:'Night',camera:'Cowboy_Shot',interaction:'Leo hugs Mira',unregistered:['Yuna'],
    characters:[{id:'leo',entityName:'Leo',expression:'smile',action:'hugging Mira',outfitMode:'replace',outfit:"Mira's"}]},names,'tags');
  assert.equal(scene.location,'apartment, living room');assert.equal(scene.camera,'cowboy shot');assert.equal(scene.interaction,'hugs');
  assert.equal(scene.characters[0].action,'hugging');assert.equal(scene.characters[0].entityName,'Leo');assert.deepEqual(scene.unregistered,['Yuna']);
  assert.equal(scene.characters[0].outfitMode,'unchanged','an outfit emptied by cleanup is not applied');
  assert.deepEqual(removed.sort(),['Leo','Mira']);
  assert.equal(genericizeScene({location:"Mira's cozy room.",lighting:'',camera:'',interaction:'',characters:[]},names,'natural').scene.location,'cozy room.');
});
test('extraction and profile prompts carry the generic-visuals rule and the Danbooru guide in tag mode',()=>{
  const tags=extractionPrompt([],[],{},'tags'),natural=extractionPrompt([],[],{},'natural');
  assert.match(tags,/GENERIC VISUALS/);assert.match(tags,/"Mina's room" -> bedroom/);assert.match(tags,/DANBOORU TAG GUIDE/);assert.match(tags,/cowboy shot/);
  assert.match(natural,/GENERIC VISUALS/);assert.doesNotMatch(natural,/DANBOORU TAG GUIDE/);
  assert.match(profileDraftPrompt('x',{format:'tags'}),/Prefer Danbooru tags/);assert.doesNotMatch(profileDraftPrompt('x',{format:'natural'}),/Prefer Danbooru tags/);
});
