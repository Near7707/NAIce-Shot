import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,clone,blankScene,assemble,buildPayload,parseExtraction,chooseMessages,sourceValid,extractionPrompt,resolveOutfit,textSignature,costGuard,validateProfiles,SIZE_PRESETS,sizePresetOf} from '../ui/core.mjs';

const profiles=[{id:'leo',name:'Leo',aliases:['레오'],subject:'boy',appearance:'brown hair',defaultOutfit:'white shirt, jeans',positive:'ring',negative:'black hair'},
  {id:'mira',name:'Mira',aliases:['미라'],subject:'girl',appearance:'pink hair',defaultOutfit:'hoodie',positive:'',negative:'brown hair'}];
const character=(id,extra={})=>({id,expression:'smile',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:'',manualOutfit:null,...extra});
test('fixed appearance, negatives and subject counts retain their individual slots',()=>{
  const s={...clone(DEFAULTS),profiles,positive:'watercolor',negative:'bad anatomy'};
  const scene={...blankScene(),characters:[character('leo'),character('mira')],location:'cafe'};
  const a=assemble(s,scene,{});assert.equal(a.base,'watercolor, 1boy, 1girl, cafe');
  assert.match(a.characters[0].prompt,/brown hair/);assert.doesNotMatch(a.characters[0].prompt,/pink hair/);
  const payload=buildPayload(a,{...s.options,seed:123});
  assert.equal(payload.parameters.params_version,4);
  assert.equal(payload.parameters.v4_negative_prompt.caption.base_caption,'bad anatomy');
  assert.equal(payload.parameters.v4_negative_prompt.caption.char_captions[0].char_caption,'black hair');
  assert.equal(payload.parameters.v4_prompt.caption.char_captions[1].char_caption,a.characters[1].prompt);
  assert.equal(payload.parameters.qualityToggle,false);assert.equal(payload.parameters.n_samples,1);
});
test('clothing precedence is edit > lock > replacement > stored > default without mutating state',()=>{
  const c=character('leo',{outfitMode:'replace',outfit:'pajamas'}),p=profiles[0],state={value:'suit',locked:true};
  assert.equal(resolveOutfit(c,p,state).value,'suit');assert.equal(resolveOutfit({...c,manualOutfit:'coat'},p,state).value,'coat');
  assert.equal(resolveOutfit(c,p,{...state,locked:false}).value,'pajamas');
  assert.equal(resolveOutfit({...c,outfitMode:'unknown'},p,state).value,'suit');
  assert.equal(resolveOutfit(character('leo'),p).value,p.defaultOutfit);assert.deepEqual(state,{value:'suit',locked:true});
});
test('extractor receives identities and clothes but no fixed appearance',()=>{
  const prompt=extractionPrompt([{text:'He removes his jacket.'}],profiles,{},'tags');
  assert.doesNotMatch(prompt,/brown hair|pink hair|black hair/);assert.match(prompt,/white shirt/);assert.match(prompt,/COMPLETE current outfit/);
});
test('JSON scanner respects quoted braces and strips closed reasoning blocks',()=>{
  const value={characters:[character('leo',{action:'holding a sign reading "{hello}"'})],unregistered:[],location:'cafe',lighting:'day',camera:'medium shot',interaction:''};
  const {scene}=parseExtraction(`<think>{not JSON}</think>\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``,profiles);
  assert.equal(scene.characters[0].action,value.characters[0].action);
});
test('duplicate IDs and invalid schema are rejected; unknown IDs are reported and excluded',()=>{
  const value={characters:[character('leo'),character('leo')],unregistered:[],location:'',lighting:'',camera:'',interaction:''};
  assert.throws(()=>parseExtraction(JSON.stringify(value),profiles),/중복/);
  value.characters=[character('intruder')];const parsed=parseExtraction(JSON.stringify(value),profiles);assert.equal(parsed.scene.characters.length,0);assert.equal(parsed.warnings.length,1);
  value.characters='invalid';assert.throws(()=>parseExtraction(JSON.stringify(value),profiles));
});
test('message selection uses active swipe text and target, excluding reasoning and system messages',()=>{
  const chat=[{mes:'first',name:'A'},{mes:'ignore',is_system:true},{mes:'user',is_user:true},{mes:'last',swipe_id:1,swipes:['old','last'],extra:{reasoning:'secret'}}];
  const chosen=chooseMessages(chat,{target:3,recent:2,includeUser:false});assert.deepEqual(chosen.messages.map(x=>x.text),['first','last']);
  assert.equal(sourceValid(chosen.source,chat),true);chat[3].swipe_id=0;assert.equal(sourceValid(chosen.source,chat),false);
  assert.throws(()=>chooseMessages(chat,{target:2,includeUser:false}));
  assert.equal(chooseMessages(chat,{target:0}).source.historical,true);
});
test('persisted provenance checks text signatures without storing full message',()=>{
  const source={fingerprints:[{index:0,swipeId:0,signature:textSignature('a long story')}]};
  assert.equal(sourceValid(source,[{mes:'a long story'}]),true);assert.equal(sourceValid(source,[{mes:'another story'}]),false);
});
test('model capacity is enforced; coordinates only when every slot is placed',()=>{
  const a={base:'test',negative:'',characters:[{id:'one',prompt:'boy',negative:'',position:'left'},{id:'two',prompt:'girl',negative:'',position:'auto'}]};
  const mixed=buildPayload(a,{...DEFAULTS.options,seed:0});assert.equal(mixed.parameters.use_coords,false,'partial placement no longer blocks generation');assert.equal(mixed.parameters.v4_prompt.use_coords,false);
  a.characters[1].position='right';const p=buildPayload(a,{...DEFAULTS.options,seed:0});assert.equal(p.parameters.use_coords,true);assert.equal(p.parameters.v4_prompt.caption.char_captions[0].centers[0].x,0.3);
  a.characters=Array.from({length:7},()=>({prompt:'boy',negative:'',position:'auto'}));assert.throws(()=>buildPayload(a,{...DEFAULTS.options,model:'nai-diffusion-4-5-full',seed:0}),/한도/);
});
test('cost guard never promises free V5 without known consumption and allowance',()=>{
  const sub={tier:3,perks:{unlimitedImageGeneration:true}};
  assert.equal(costGuard(DEFAULTS.options,sub).free,false);
  assert.equal(costGuard({...DEFAULTS.options,model:'nai-diffusion-4-5-full'},sub).free,true);
  assert.equal(costGuard({...DEFAULTS.options,steps:29},sub).free,false);
});
test('profile validation preserves stable IDs and rejects duplicates',()=>{
  assert.equal(validateProfiles(profiles)[0].id,'leo');assert.throws(()=>validateProfiles([...profiles,profiles[0]]),/중복/);
});
test('three resolution presets remain valid normal-sized choices and custom dimensions are preserved',()=>{
 for(const [key,p] of Object.entries(SIZE_PRESETS)){
  assert.equal(sizePresetOf(p),key);assert.ok(p.width*p.height<=1048576);
  buildPayload({base:'test',negative:'',characters:[]},{...DEFAULTS.options,...p,seed:1});
 }
 assert.equal(sizePresetOf({width:1024,height:1536}),'custom');
});

test('AI-placed single character next to an automatic one assembles with a warning instead of an error',()=>{
  const settings={...DEFAULTS,profiles:[...profiles,{...profiles[0],id:'two',name:'Two',subject:'girl'}]};
  const a=assemble(settings,{...blankScene(),characters:[character('leo',{position:'center'}),character('two')]});
  assert.match(a.warnings.join(' '),/일부 인물만 위치/);assert.match(a.characters[0].prompt,/on the center/);
  assert.equal(buildPayload(a,{...DEFAULTS.options,seed:1}).parameters.use_coords,false);
});
test('named characters with a wrong or repeated ID survive parsing so the name can correct them',()=>{
  const value={characters:[character('leo',{name:'Leo'}),character('leo',{name:'Mira'}),character('Leo',{name:'Leo'})],unregistered:[],location:'',lighting:'',camera:'',interaction:''};
  const parsed=parseExtraction(JSON.stringify(value),profiles);
  assert.deepEqual(parsed.scene.characters.map(c=>[c.id,c.entityName]),[['leo','Leo'],['leo','Mira'],['Leo','Leo']]);
});
test('a stray opening brace in reasoning prose does not hide the JSON that follows',()=>{
  const value={characters:[character('leo')],unregistered:[],location:'park',lighting:'',camera:'',interaction:''};
  assert.equal(parseExtraction(`I think {maybe she stands\n${JSON.stringify(value)}`,profiles).scene.location,'park');
  assert.equal(parseExtraction(`Plan: { a, { b }\n\n${JSON.stringify(value)} trailing }`,profiles).scene.location,'park');
});
