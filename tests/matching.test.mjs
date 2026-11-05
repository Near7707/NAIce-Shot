import test from 'node:test';
import assert from 'node:assert/strict';
import {matchChatProfiles,reconcileCharacters} from '../matching.mjs';
import {chooseMessages,blankScene,extractionPrompt,extractionSchema,parseExtraction} from '../core.mjs';
const profiles=[
 {id:'ash',name:'Ash',aliases:['애쉬'],cardKey:'',appearance:'brown skin',defaultOutfit:'hoodie'},
 {id:'leo',name:'Leo',aliases:['레오','Leonard'],cardKey:'',appearance:'brown hair',defaultOutfit:'jacket'},
 {id:'mira',name:'Mira',aliases:['미라'],cardKey:'',appearance:'pink hair',defaultOutfit:'coat'},
];
const context=(name='Leo')=>({name1:'Mira',name2:name,characterId:0,groupId:null,characters:[{name,avatar:`${name}.png`}],chat:[{is_user:true,name:'Mira',mes:'I stand beside him.'},{name,mes:'He watches the floating shards orbit.'}]});
const matching=(ctx,p=profiles,overrides={})=>matchChatProfiles(ctx,p,chooseMessages(ctx.chat).messages,overrides);
const scene=(name,id)=>({...blankScene(),characters:[{id,entityName:name,action:'standing',expression:'smile',outfitMode:'unchanged',outfit:'',position:'auto',manualOutfit:null}]});
test('Leo chat candidates exclude Ash even when Ash was the first saved profile',()=>{
 const scope=matching(context());assert.deepEqual(scope.profiles.map(p=>p.id),['leo','mira']);
 assert.equal(scope.characterProfileId,'leo');assert.equal(scope.userProfileId,'mira');
 const fixed=reconcileCharacters(scene('Leo','ash'),scope);assert.equal(fixed.scene.characters[0].id,'leo');assert.equal(fixed.scene.characters[0].action,'standing');assert.equal(fixed.warnings.length,1);
});
test('switching to Ash recomputes candidates without carrying Leo from another chat',()=>{
 const scope=matching(context('Ash'));assert.deepEqual(scope.profiles.map(p=>p.id),['ash','mira']);
 assert.equal(reconcileCharacters(scene('Ash','leo'),scope).scene.characters[0].id,'ash');
});
test('card binding identifies a differently named card and does not expose fixed appearance',()=>{
 const ctx=context('Leonard Hart'),p=structuredClone(profiles);p[1].cardKey='Leonard Hart.png';
 const scope=matching(ctx,p);assert.equal(scope.characterProfileId,'leo');
 const prompt=extractionPrompt(chooseMessages(ctx.chat).messages,scope.profiles,{},'tags','',scope.mappings);
 assert.match(prompt,/Leonard Hart/);assert.doesNotMatch(prompt,/brown hair|brown skin|pink hair/);
 assert.deepEqual(extractionSchema(scope.profiles).properties.characters.items.properties.id.enum,['leo','mira']);
});
test('name aliases and explicit per-chat character/persona overrides are supported',()=>{
 assert.equal(matching(context('LEONARD')).characterProfileId,'leo');
 const ctx=context('Unnamed card');ctx.name1='Player';ctx.chat[0].name='Player';
 const scope=matching(ctx,profiles,{characterProfileId:'leo',userProfileId:'mira'});
 assert.equal(reconcileCharacters(scene('Unnamed card','ash'),scope).scene.characters[0].id,'leo');
 assert.equal(reconcileCharacters(scene('Player','leo'),scope).scene.characters[0].id,'mira');
});
test('other explicitly named characters are candidates but substrings are not names',()=>{
 const ctx=context();ctx.chat[1].mes='He stands beside an ashtray, washing a cup.';
 assert.deepEqual(matching(ctx).profiles.map(p=>p.id),['leo','mira']);
 ctx.chat[1].mes='Ash enters the intersection.';assert.deepEqual(matching(ctx).profiles.map(p=>p.id),['ash','leo','mira']);
 ctx.chat[1].mes='애쉬가 옆으로 다가온다.';assert.ok(matching(ctx).profiles.some(p=>p.id==='ash'));
});
test('ambiguous profiles and unknown identities are excluded rather than guessed',()=>{
 const p=structuredClone(profiles);p[0].aliases.push('Leo');const scope=matching(context(),p);
 assert.equal(scope.characterProfileId,'');assert.match(scope.warnings.join(' '),/겹쳐/);
 const ambiguous=reconcileCharacters(scene('Leo','ash'),scope);assert.equal(ambiguous.scene.characters.length,0);assert.ok(ambiguous.scene.unregistered.includes('Leo'));
 const unknown=reconcileCharacters(scene('Stranger','leo'),matching(context()));assert.equal(unknown.scene.characters.length,0);
});
test('matching does not force the chat character to appear and refuses unverifiable ID-only replies',()=>{
 const scope=matching(context());const solo=reconcileCharacters(scene('Mira','leo'),scope);
 assert.deepEqual(solo.scene.characters.map(c=>c.id),['mira']);
 assert.throws(()=>reconcileCharacters(scene('','leo'),scope),/name/);
 const twice=reconcileCharacters({...scene('Leo','leo'),characters:[...scene('Leo','leo').characters,...scene('Leonard','mira').characters]},scope);
 assert.deepEqual(twice.scene.characters.map(c=>c.id),['leo'],'the same person listed twice is kept once');assert.match(twice.warnings.join(' '),/한 번만/);
});
test('group speaker card avatars map profiles without assuming a single main character',()=>{
 const ctx=context();ctx.groupId='group';ctx.characters.push({name:'Unusual display name',avatar:'ash.png'});ctx.chat.push({name:'Unusual display name',original_avatar:'ash.png',mes:'He joins the scene.'});
 const p=structuredClone(profiles);p[0].cardKey='ash.png';
 const scope=matching(ctx,p);assert.equal(scope.characterName,'');assert.ok(scope.profiles.some(p=>p.id==='ash'));
 assert.equal(reconcileCharacters(scene('Unusual display name','leo'),scope).scene.characters[0].id,'ash');
});

test('Korean particles, honorifics and vocatives after a name still make that person a candidate',()=>{
 for(const text of ['애쉬에게서 받았다','애쉬야, 이리 와','애쉬씨가 웃었다','애쉬님이 말했다','애쉬로부터','애쉬에서','애쉬처럼','애쉬께서','Ash에게 건넨다','Ash씨는']){
  const ctx=context();ctx.chat[1].mes=text;assert.ok(matching(ctx).profiles.some(p=>p.id==='ash'),text);
 }
 const ctx=context();ctx.chat[1].mes='He stands beside an ashtray, washing a cup.';assert.ok(!matching(ctx).profiles.some(p=>p.id==='ash'),'English substrings are still not names');
});
test('end to end: wrong and repeated IDs from the AI are corrected by name',()=>{
 const scope=matching(context());
 const raw=JSON.stringify({characters:[
  {id:'leo',name:'Leo',expression:'',action:'',position:'auto',outfitMode:'unchanged',outfit:''},
  {id:'leo',name:'Mira',expression:'',action:'',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'',lighting:'',camera:'',interaction:''});
 const fixed=reconcileCharacters(parseExtraction(raw,profiles).scene,scope);
 assert.deepEqual(fixed.scene.characters.map(c=>c.id).sort(),['leo','mira']);
});

test('a saved profile named in unregistered is recovered by its alias in another card chat',()=>{
 const ctx=context();ctx.chat[1].mes='Leo and 애쉬 sit together.';
 const scope=matching(ctx),input={...scene('Leo','leo'),unregistered:['애쉬']};
 const fixed=reconcileCharacters(input,scope).scene;
 assert.ok(fixed.characters.some(c=>c.id==='ash'));
 assert.deepEqual(fixed.unregistered,[]);
});
test('manually added profiles remain candidates when the prose only uses a pronoun',()=>{
 const ctx=context();ctx.chat[1].mes='The third person sits down beside them.';
 const scope=matchChatProfiles(ctx,profiles,chooseMessages(ctx.chat).messages,{},['ash']);
 assert.ok(scope.profiles.some(p=>p.id==='ash'));
 assert.deepEqual(reconcileCharacters(scene('Leo','leo'),scope).scene.characters.map(c=>c.id),['leo'],'a candidate is not forced into the picture');
});
test('profile identity matching tolerates name separators and Korean spacing without substring guesses',()=>{
 const p=[...profiles,{id:'sun',name:'Sunny',aliases:['Jae-Sun','김 민수'],cardKey:'',defaultOutfit:'coat'}];
 for(const text of ['Jae Sun sits down.','김민수가 들어온다.']){
  const ctx=context();ctx.chat[1].mes=text;assert.ok(matching(ctx,p).profiles.some(p=>p.id==='sun'),text);
 }
});
test('0.1.76: a profile picked with @ beats the chat connection by name; two picked people with one name both stay (UI-075-02/03)',()=>{
 const A={id:'leo-a',name:'Leo',aliases:[],cardKey:'',appearance:'brown hair',defaultOutfit:''},B={id:'leo-b',name:'Leo',aliases:[],cardKey:'',appearance:'blond hair',defaultOutfit:''};
 const chat={allProfiles:[A,B],profiles:[A,B],mappings:[{name:'Leo',profileId:'leo-a',profileName:'Leo',role:'character'}],warnings:[]};
 // Without a pick the chat's connection decides (Leo → A), as before.
 assert.equal(reconcileCharacters(scene('Leo','leo-b'),chat).scene.characters[0].id,'leo-a');
 // Picked B: the action stays on B and is not moved to A.
 const picked=reconcileCharacters(scene('Leo','leo-b'),{...chat,required:new Set(['leo-b'])});
 assert.deepEqual(picked.scene.characters.map(c=>[c.id,c.action]),[['leo-b','standing']]);assert.deepEqual(picked.scene.unregistered,[]);
 // An id that does not carry the written name is not trusted.
 assert.equal(reconcileCharacters(scene('Mira','leo-b'),{...chat,required:new Set(['leo-b'])}).scene.characters.length,0);
 // Both picked: both stay, in the order the AI gave them; the second is not dropped for its name.
 const both={...scene('Leo','leo-a'),characters:[{...scene('Leo','leo-a').characters[0],action:'reading'},{...scene('Leo','leo-b').characters[0],action:'waving'}]};
 const r=reconcileCharacters(both,{...chat,required:new Set(['leo-a','leo-b'])});
 assert.deepEqual(r.scene.characters.map(c=>[c.id,c.action]),[['leo-a','reading'],['leo-b','waving']]);
 // The same name twice without picks is still one person.
 assert.equal(reconcileCharacters(both,chat).scene.characters.length,1);
});

test('0.1.77 (UI-076-01): a required person whose name is shared gets no leftover detail by name',async()=>{
 const {attachSceneProfile}=await import('../matching.mjs');
 const p={id:'a1',name:'Leo',aliases:[]};
 const mk=()=>({characters:[],unregistered:['Leo'],unregisteredDetails:[{entityName:'Leo',expression:'smile',action:'waves',outfit:'',id:''}]});
 const plain=mk(),r1=attachSceneProfile(plain,p,['Leo']);assert.equal(r1.character.action,'waves','a unique name still takes its detail');
 const twin=mk(),r2=attachSceneProfile(twin,p,['Leo'],{ambiguous:true});
 assert.equal(r2.character.action,'');assert.equal(r2.character.expression,'');assert.equal(twin.unregisteredDetails.length,1,'the other person\'s detail is kept');
});
test('0.1.79 (UI-076-01): two picked people with one name and no checked id — nobody gets the action, also with a chat connection',()=>{
 const A={id:'leo-a',name:'Leo',aliases:[],cardKey:'',appearance:'brown hair',defaultOutfit:''},B={id:'leo-b',name:'Leo',aliases:[],cardKey:'',appearance:'blond hair',defaultOutfit:''};
 const chat={allProfiles:[A,B],profiles:[A,B],mappings:[{name:'Leo',profileId:'leo-a',profileName:'Leo',role:'character'}],warnings:[]};
 for(const id of ['','other-id']){
  const r=reconcileCharacters({...scene('Leo',id),characters:[{...scene('Leo',id).characters[0],action:'reading'}]},{...chat,required:new Set(['leo-a','leo-b'])});
  assert.equal(r.scene.characters.length,0,'not given to A through the chat connection');assert.ok(r.scene.unregistered.includes('Leo'));
  assert.match(r.warnings.join(' '),/누구인지 알 수 없어/);
 }
 // only one of them picked: the usual rules still apply
 assert.equal(reconcileCharacters(scene('Leo',''),{...chat,required:new Set(['leo-b'])}).scene.characters[0].id,'leo-a');
});
