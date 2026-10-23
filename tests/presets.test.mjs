import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,clone} from '../core.mjs';
import {captureImagePreset,applyImagePreset,imagePresetModified,validateImagePresets} from '../presets.mjs';
test('a common preset captures prompts and every NAI generation option by value',()=>{
 const s={...clone(DEFAULTS),positive:'watercolor',negative:'bad anatomy'};
 const p=captureImagePreset(s,'first','水彩');
 assert.deepEqual(Object.keys(p).sort(),['id','model','name','negative','options','positive']);
 assert.deepEqual(p.options,s.options);assert.equal(p.options.seed,-1);
 assert.equal(p.positive,'watercolor');assert.equal(p.negative,'bad anatomy');assert.equal(p.model,'nai-diffusion-5-full');
 s.positive='edited';s.options.cfgRescale=0.2;assert.equal(p.positive,'watercolor');assert.equal(p.options.cfgRescale,0);
});
test('loading an older preset preserves unsaved generation options and character profiles',()=>{
 const s=clone(DEFAULTS);s.profiles=[{id:'leo'}];s.options.seed=123;s.options.width=1024;s.options.height=1536;
 s.imagePresets=[{id:'test',name:'V4.5',positive:'ink',negative:'photo',model:'nai-diffusion-4-5-full'}];
 applyImagePreset(s,'test');assert.equal(s.positive,'ink');assert.equal(s.negative,'photo');assert.equal(s.options.model,'nai-diffusion-4-5-full');
 assert.equal(s.options.seed,123);assert.equal(s.options.width,1024);assert.deepEqual(s.profiles,[{id:'leo'}]);
 assert.equal(imagePresetModified(s),false);s.negative='edited';assert.equal(imagePresetModified(s),true);assert.equal(s.imagePresets[0].negative,'photo');
});
test('invalid imported models and duplicate IDs are rejected',()=>{
 const p={id:'a',name:'name',positive:'',negative:'',model:'nai-diffusion-5-full'};
 assert.throws(()=>validateImagePresets([p,p]));assert.throws(()=>validateImagePresets([{...p,model:'unsupported'}]));
});
test('saved generation options round-trip through backup and restore without shared references',()=>{
 const s=clone(DEFAULTS);s.positive='ink';s.negative='photo';
 s.options={model:'nai-diffusion-4-5-curated',width:1216,height:832,steps:18,scale:5.5,seed:123,sampler:'k_euler',scheduler:'native',cfgRescale:0.2};
 const p=captureImagePreset(s,'full','설정 포함');
 const loaded=clone(DEFAULTS);loaded.profiles=[{id:'leo'}];loaded.extractionProfileId='separate';loaded.allowAnlas=false;
 loaded.imagePresets=validateImagePresets(JSON.parse(JSON.stringify([p])));
 applyImagePreset(loaded,'full');assert.deepEqual(loaded.options,{...s.options,scheduler:DEFAULTS.options.scheduler},'saved Noise Schedule is ignored');assert.equal(loaded.positive,'ink');assert.equal(loaded.negative,'photo');
 assert.deepEqual(loaded.profiles,[{id:'leo'}]);assert.equal(loaded.extractionProfileId,'separate');assert.equal(loaded.allowAnlas,false);
 assert.equal(imagePresetModified(loaded),false);loaded.options.cfgRescale=0.4;assert.equal(imagePresetModified(loaded),true);
 assert.equal(loaded.imagePresets[0].options.cfgRescale,0.2);
});
test('every saved generation setting marks the selected preset modified',()=>{
 const s=clone(DEFAULTS);s.imagePresets=[captureImagePreset(s,'full','생성')];s.imagePresetId='full';
 const changes={model:'nai-diffusion-4-5-full',width:1024,height:1024,steps:18,scale:6,seed:42,sampler:'k_euler',cfgRescale:0.2};
 for(const [k,v] of Object.entries(changes)){const changed=clone(s);changed.options[k]=v;assert.equal(imagePresetModified(changed),true,k);}
});
test('malformed generation options are rejected in backups and before saving',()=>{
 const s=clone(DEFAULTS),p=captureImagePreset(s,'full','생성');
 for(const patch of [{cfgRescale:2},{seed:-2},{seed:1.5},{width:831},{steps:0},{scale:11},{sampler:'bad'},{scheduler:'bad'}, {height:undefined}]){
  assert.throws(()=>validateImagePresets([{...p,options:{...p.options,...patch}}]));
 }
 assert.throws(()=>validateImagePresets([{...p,options:null}]));
 assert.throws(()=>validateImagePresets([{...p,model:'nai-diffusion-4-5-full'}]));
 s.options.cfgRescale=2;assert.throws(()=>captureImagePreset(s,'bad','오류'));
});
test('overwriting a legacy preset upgrades it with the chosen options',()=>{
 const s=clone(DEFAULTS);s.imagePresets=[{id:'old',name:'이전',positive:'ink',negative:'',model:s.options.model}];
 s.options.cfgRescale=0.2;s.options.steps=18;applyImagePreset(s,'old');
 s.imagePresets=[captureImagePreset(s,'old','이전')];assert.equal(s.imagePresets[0].options.cfgRescale,0.2);
 s.options.cfgRescale=0;s.options.steps=28;applyImagePreset(s,'old');assert.equal(s.options.cfgRescale,0.2);assert.equal(s.options.steps,18);
});
test('a Noise Schedule left in an old preset is neither applied nor counted as a change',()=>{
 const s=clone(DEFAULTS);s.imagePresets=validateImagePresets([{...captureImagePreset(s,'old','옛 프리셋'),options:{...s.options,scheduler:'exponential'}}]);
 applyImagePreset(s,'old');assert.equal(s.options.scheduler,DEFAULTS.options.scheduler);assert.equal(imagePresetModified(s),false);
});
