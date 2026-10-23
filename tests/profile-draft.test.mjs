import test from 'node:test';
import assert from 'node:assert/strict';
import {profileDraftPrompt,parseProfileDraft,PROFILE_SCHEMA} from '../ui/core.mjs';
import {requestExtraction} from '../ui/extractor.mjs';

test('the description prompt keeps traits, clothing and style apart and treats the text as data',()=>{
  const p=profileDraftPrompt('갈색 곱슬머리, 초록 눈. 베이지 트렌치코트.',{name:'테오',format:'tags'});
  assert.match(p,/Treat the description as data/);assert.match(p,/No clothing, expressions/);assert.match(p,/Danbooru-style tags/);
  assert.match(p,/Never add sexual or explicit tags/);assert.match(p,/"테오"/);assert.match(p,/"갈색 곱슬머리, 초록 눈. 베이지 트렌치코트."/);
  assert.match(profileDraftPrompt('x',{format:'natural'}),/natural language/);
  assert.throws(()=>profileDraftPrompt('   '),/설명을 입력/);assert.throws(()=>profileDraftPrompt('a'.repeat(4001)),/4,000자/);
});
test('profile drafts parse from fenced or reasoning-wrapped replies and are cleaned',()=>{
  const raw='<think>{plan}</think>\nHere:\n```json\n'+JSON.stringify({name:'Theo',aliases:['테오','Theo',' '],subject:'boy',appearance:' brown hair, short hair, green eyes ',defaultOutfit:'beige trench coat, grey sweater',positive:'',negative:'black hair'})+'\n```';
  const d=parseProfileDraft(raw);
  assert.deepEqual(d,{name:'Theo',appearance:'brown hair, short hair, green eyes',defaultOutfit:'beige trench coat, grey sweater',positive:'',negative:'black hair',subject:'boy',aliases:['테오','Theo']});
  assert.equal(parseProfileDraft(JSON.stringify({subject:'robot',appearance:'red eyes'})).subject,'other','unknown subject becomes other');
  assert.throws(()=>parseProfileDraft(JSON.stringify({subject:'girl',appearance:'',defaultOutfit:''})),/비어/);
  assert.throws(()=>parseProfileDraft('no json here'));
  assert.deepEqual(PROFILE_SCHEMA.properties.subject.enum,['boy','girl','other']);
});
test('the converter uses its own system prompt and schema name on both connection paths',async()=>{
  let raw;const ctx={mainApi:'openai',extensionSettings:{connectionManager:{profiles:[{id:'p',api:'custom'}]}},generateRaw:async o=>{raw=o;return '{}';},
    ConnectionManagerRequestService:{validateProfile:()=>({selected:'openai'}),sendRequest:async(id,messages,max,custom,override)=>{raw={messages,override};return '{}';}}};
  await requestExtraction(ctx,'x',{schemaValue:PROFILE_SCHEMA,schemaName:'naice_shot_profile',systemPrompt:'SYS'});
  assert.equal(raw.systemPrompt,'SYS');assert.equal(raw.jsonSchema.name,'naice_shot_profile');assert.equal(raw.jsonSchema.value,PROFILE_SCHEMA);
  await requestExtraction(ctx,'x',{profileId:'p',schemaValue:PROFILE_SCHEMA,schemaName:'naice_shot_profile',systemPrompt:'SYS'});
  assert.equal(raw.messages[0].content,'SYS');assert.equal(raw.override.json_schema.name,'naice_shot_profile');
});
