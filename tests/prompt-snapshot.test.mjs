// wip-en: the AI prompts are kept exactly as 0.1.162 wrote them (prompt-snapshot.json was written from main 47f690d).
// The screen language must not change a single character. When a prompt is changed on purpose, write the file again:
// NCS_WRITE_SNAPSHOT=1 node --test tests/prompt-snapshot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {momentExtractionPrompt} from '../scene-extraction.mjs';
import {freeScenePrompt} from '../free-scene.mjs';
import {profileDraftPrompt} from '../core.mjs';

const file=new URL('./prompt-snapshot.json',import.meta.url);
const profiles=[{id:'mira',name:'Mira',aliases:['M'],subject:'girl',appearance:'long black hair',defaultOutfit:'grey coat',positive:'',negative:'',wardrobe:[]},
 {id:'leo',name:'Leo',aliases:[],subject:'boy',appearance:'short brown hair',defaultOutfit:'hoodie',positive:'',negative:'',wardrobe:[]}];
const messages=[{index:0,speaker:'Mira',text:'Mira walks into the cafe.'},{index:1,speaker:'Leo',text:'레오가 창가에 앉아 웃는다. Then he stands up.'}];
const prompts=()=>({
 moments:momentExtractionPrompt(messages,profiles,{leo:{value:'hoodie'}},'tags',[],''),
 momentsNatural:momentExtractionPrompt(messages,profiles,{},'natural',[],''),
 momentsWish:momentExtractionPrompt(messages,profiles,{},'tags',[],'밤에 혼자 @[Leo](ref:leo)',[profiles[1]]),
 free:freeScenePrompt('레오와 바텐더가 웃는다',profiles,[profiles[1]],'tags'),
 freeRequired:freeScenePrompt('Leo smiles at Mira',profiles,[],'natural',[profiles[0]]),
 profile:profileDraftPrompt('긴 검은 머리, 회색 코트',{name:'Mira',format:'tags'}),
 profileNatural:profileDraftPrompt('short brown hair, hoodie',{name:'Leo',format:'natural'}),
});
test('AI prompts are exactly as saved',()=>{
 const now=prompts();
 if(process.env.NCS_WRITE_SNAPSHOT){fs.writeFileSync(file,JSON.stringify(now,null,1)+'\n');return;}
 const saved=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.deepEqual(Object.keys(now),Object.keys(saved));
 for(const k of Object.keys(saved))assert.equal(now[k],saved[k],`${k} prompt changed`);
});
