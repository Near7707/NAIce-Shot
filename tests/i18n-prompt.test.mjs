// English screen: the AI prompt changes only the lines asking for words shown to the person (a candidate's title and
// the 추가 요청 result words). The Korean prompt is the one 0.1.166 sent (checked by i18n-compare and browser-i18n step 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import {momentExtractionPrompt,languageRetry} from '../scene-extraction.mjs';

const profiles=[{id:'mira',name:'Mira',aliases:['M'],subject:'girl',appearance:'long black hair',defaultOutfit:'grey coat',positive:'',negative:'',wardrobe:[]},
 {id:'leo',name:'Leo',aliases:[],subject:'boy',appearance:'short brown hair',defaultOutfit:'hoodie',positive:'',negative:'',wardrobe:[]}];
const messages=[{index:0,speaker:'Mira',text:'Mira walks into the cafe.'},{index:1,speaker:'Leo',text:'레오가 창가에 앉아 웃는다. Then he stands up.'}];
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
