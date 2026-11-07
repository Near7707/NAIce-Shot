import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,clone,blankScene,assemble,buildPayload,parseExtraction,chooseMessages,sourceValid,extractionPrompt,resolveOutfit,usageOf,textSignature,costGuard,V5_ASK_AT,V5_EXTRA_COUNTS,validateProfiles,SIZE_PRESETS,sizePresetOf} from '../core.mjs';

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
test('cost guard (0.1.67, V5 rule 0.1.90): V4.5 free for an active Opus without the old perk; V5 by its usage, asked at 1 % or below',()=>{
  const opus={tier:3,active:true,isGracePeriod:false,usage:{percent:82,purchasedPercent:100,isNegative:false,timeUntilNextPercent:60}};
  const v45={...DEFAULTS.options,model:'nai-diffusion-4-5-full'},v5=DEFAULTS.options;
  assert.ok(v5.model.startsWith('nai-diffusion-5'),'DEFAULTS use V5');
  // V4.5: free with no perks at all (the field NovelAI no longer sends), within the usual conditions only.
  assert.deepEqual(costGuard(v45,opus),{free:true,kind:'free',consent:'none',message:'Opus 무료 조건(기본 크기·28스텝 이하·1장)에 해당해요.'});
  assert.equal(costGuard(v45,{...opus,perks:{unlimitedImageGeneration:false}}).free,true,'the old perk is not read');
  assert.equal(costGuard({...v45,steps:29},opus).kind,'uses');assert.equal(costGuard({...v45,width:1216,height:1216},opus).kind,'uses');
  assert.equal(costGuard(v45,{...opus,usage:undefined}).free,true,'V4.5 never needs usage');
  // Grace period first (our conservative choice), even with active:false; inactive is its own kind; missing is never false.
  assert.equal(costGuard(v45,{...opus,isGracePeriod:true}).kind,'unknown');assert.equal(costGuard(v45,{...opus,active:false,isGracePeriod:true}).kind,'unknown');
  assert.deepEqual([costGuard(v45,{...opus,active:false}).kind,costGuard(v45,{...opus,active:false}).free],['inactive',false]);
  for(const bad of [{active:undefined},{active:'true'},{isGracePeriod:undefined},{active:null}]){const g=costGuard(v45,{...opus,...bad});assert.equal(g.kind,'unknown');assert.equal(g.missing,true);assert.equal(g.free,false);}
  // V5 (0.1.90): never free. Above V5_ASK_AT % of base usage it goes without the switch; at or below it, when it cannot
  // be used, or when usage is missing, it asks for this one request. The extra usage does not count yet.
  assert.equal(V5_ASK_AT,1);assert.equal(V5_EXTRA_COUNTS,false);
  assert.deepEqual([costGuard(v5,opus).kind,costGuard(v5,opus).consent,costGuard(v5,opus).free],['usage','none',false]);
  assert.equal(costGuard(v5,{...opus,usage:{percent:2,isNegative:false}}).kind,'usage');
  const ask=usage=>{const g=costGuard(v5,{...opus,usage});assert.equal(g.kind,'ask');assert.equal(g.consent,'once');assert.equal(g.free,false);return [g.reason,g.message];};
  assert.deepEqual(ask({percent:1,purchasedPercent:100,isNegative:false}),['low','V5 사용량이 1% 남았어요. 이번 생성에서 Anlas가 차감될 수 있어요.']);
  assert.deepEqual(ask({percent:0,purchasedPercent:100,isNegative:false}),['empty','V5 기본 사용량을 다 썼어요 (추가 구매 100%). 이번 생성에서 Anlas가 차감될 수 있어요.'],'0% is a real value; extra usage alone does not count yet');
  assert.deepEqual(ask({percent:0,isNegative:false}),['empty','V5 기본 사용량을 다 썼어요. 이번 생성에서 Anlas가 차감될 수 있어요.']);
  assert.equal(ask({percent:80,isNegative:true})[0],'negative');
  for(const usage of [undefined,null,{},{percent:'82',isNegative:false},{percent:82}]){assert.equal(ask(usage)[0],'unknown');assert.equal(costGuard(v5,{...opus,usage}).missing,undefined,'not an account field problem');}
  assert.equal(costGuard({...v5,steps:29},opus).kind,'uses');
  // Lower tiers and an unchecked account.
  for(const tier of [0,1,2]){for(const o of [v45,v5]){const g=costGuard(o,{tier,active:true,isGracePeriod:false});assert.deepEqual([g.free,g.kind,g.message],[false,'uses','이 생성은 Anlas를 사용해요.']);}}
  assert.deepEqual([costGuard(v45,null).kind,costGuard(v45,null).message,costGuard(v45,null).missing],['unknown','비용 조건을 확인하지 못했어요.',undefined]);
  // 0.1.68: the state comes first for every tier (UI-067-02); a reply without a usable tier is "missing" (UI-067-03).
  assert.equal(costGuard(v45,{tier:1,active:false,isGracePeriod:false}).kind,'inactive');assert.equal(costGuard(v45,{tier:2,active:true,isGracePeriod:true}).kind,'unknown');
  assert.equal(costGuard(v45,{tier:2,active:false,isGracePeriod:true}).message,'구독 유예 기간이라 무료 생성 여부를 확인할 수 없어요.');
  for(const tier of [null,undefined,'3']){const g=costGuard(v45,{...opus,tier});assert.deepEqual([g.free,g.kind,g.missing],[false,'unknown',true]);}
  assert.equal(costGuard(v45,{tier:1}).missing,true,'a lower tier without its state is missing too, never free');
  assert.deepEqual(usageOf({usage:{percent:82,purchasedPercent:'x',isNegative:false}}),{percent:82,purchasedPercent:null,isNegative:false,timeUntilNextPercent:null});
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


test('reasoning removal handles known tags, case differences and unterminated blocks',async()=>{
 const {stripReasoningBlocks}=await import('../core.mjs');
 assert.equal(stripReasoningBlocks('<THINK data-x="1">private</THINK> {"ok":true} <analysis>secret</analysis>'),'{"ok":true}');
 assert.equal(stripReasoningBlocks('{"ok":true}<reasoning>unfinished secret'),'{"ok":true}');
 assert.equal(stripReasoningBlocks('<thinking>unfinished secret'),'');
});
test('wardrobe: missing is empty, items are trimmed and checked, the default outfit is untouched',async()=>{
 const {validateProfiles,validateWardrobe,WARDROBE_LIMIT}=await import('../core.mjs');
 const base={id:'p1',name:'Mira',aliases:[],subject:'girl',appearance:'',defaultOutfit:'grey coat',positive:'',negative:''};
 assert.deepEqual(validateProfiles([base])[0].wardrobe,[]);
 const [p]=validateProfiles([{...base,wardrobe:[{id:'w1',name:' 잠옷 ',outfit:' pajamas '}]}]);
 assert.deepEqual(p.wardrobe,[{id:'w1',name:'잠옷',outfit:'pajamas'}]);assert.equal(p.defaultOutfit,'grey coat');
 assert.throws(()=>validateWardrobe([{id:'w1',name:'a',outfit:'x'},{id:'w1',name:'b',outfit:'y'}]),/중복/);
 assert.throws(()=>validateWardrobe([{id:'w1',name:'',outfit:'x'}]),/이름/);
 assert.throws(()=>validateWardrobe([{id:'w1',name:'a',outfit:'  '}]),/비어/);
 assert.throws(()=>validateWardrobe(Array.from({length:WARDROBE_LIMIT+1},(_,i)=>({id:`w${i}`,name:'a',outfit:'x'}))),/최대/);
});
