// wip-en: the AI prompts are kept exactly as 0.1.162 wrote them (prompt-snapshot.json was written from main 47f690d).
// The Korean screen must not change a single character (lang 'ko', the default, is the prompt main sends). The English screen
// changes only the lines asking for the words shown to the person: a candidate's title and the 추가 요청 result words.
// When a prompt is changed on purpose, write the file again:
// NCS_WRITE_SNAPSHOT=1 node --test tests/prompt-snapshot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {momentExtractionPrompt,languageRetry} from '../scene-extraction.mjs';
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
 momentsEn:momentExtractionPrompt(messages,profiles,{leo:{value:'hoodie'}},'tags',[],'',[],'en'),
 momentsWishEn:momentExtractionPrompt(messages,profiles,{},'tags',[],'밤에 혼자 @[Leo](ref:leo)',[profiles[1]],'en'),
 retry:languageRetry(),
 retryEn:languageRetry('en'),
});
test('AI prompts are exactly as saved',()=>{
 const now=prompts();
 if(process.env.NCS_WRITE_SNAPSHOT){fs.writeFileSync(file,JSON.stringify(now,null,1)+'\n');return;}
 const saved=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.deepEqual(Object.keys(now),Object.keys(saved));
 for(const k of Object.keys(saved))assert.equal(now[k],saved[k],`${k} prompt changed`);
});
test('English screen: only the title and 추가 요청 word lines differ from the Korean prompt, and they ask for English',()=>{
 const ko=momentExtractionPrompt(messages,profiles,{},'tags',[],'밤에 혼자 @[Leo](ref:leo)',[profiles[1]]).split('\n');
 const en=momentExtractionPrompt(messages,profiles,{},'tags',[],'밤에 혼자 @[Leo](ref:leo)',[profiles[1]],'en').split('\n');
 assert.equal(en.length,ko.length);
 const changed=ko.map((l,i)=>l===en[i]?null:[l,en[i]]).filter(Boolean);
 assert.deepEqual(changed.map(([k])=>k.split(':')[0]),['title','requestApplied','requestIgnored']);
 for(const [k,e] of changed){assert.match(k,/Korean/);assert.match(e,/English/);assert.doesNotMatch(e,/Korean|[가-힣]/);}
 assert.equal(momentExtractionPrompt(messages,profiles,{},'tags',[],'',[],'xx'),momentExtractionPrompt(messages,profiles,{},'tags',[],''),'an unknown language is Korean');
 assert.match(languageRetry('en'),/keep title in English\.$/);assert.match(languageRetry(),/keep title in Korean\.$/);
});
