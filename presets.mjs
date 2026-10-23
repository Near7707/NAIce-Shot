import {MODELS,validateOptions} from './core.mjs';
const OPTION_FIELDS=['model','width','height','steps','scale','seed','sampler','scheduler','cfgRescale'];
// Noise Schedule is still validated in saved presets but no longer applied or compared (the UI always uses the default).
const APPLIED_FIELDS=OPTION_FIELDS.filter(k=>k!=='scheduler');
function presetOptions(value) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('프리셋 생성 설정을 확인해 주세요.');
 const options=Object.fromEntries(OPTION_FIELDS.map(k=>[k,value[k]]));
 // -1 means a fresh seed at generation time; retain that choice in the preset.
 validateOptions({...options,seed:options.seed===-1?0:options.seed});
 return options;
}
export function validateImagePresets(value) {
 if(!Array.isArray(value)||value.length>100)throw new Error('이미지 프리셋은 최대 100개까지 저장할 수 있어요.');
 const ids=new Set();
 return value.map(p=>{
  if(!p||typeof p.id!=='string'||!/^[\w-]{1,80}$/.test(p.id)||ids.has(p.id))throw new Error('프리셋 ID를 확인해 주세요.');
  ids.add(p.id);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80||typeof p.positive!=='string'||typeof p.negative!=='string'||p.positive.length>20000||p.negative.length>20000||!MODELS[p.model])throw new Error('프리셋 이름·포지·네거·모델 값을 확인해 주세요.');
  const preset={id:p.id,name:p.name.trim(),positive:p.positive,negative:p.negative,model:p.model};
  if(p.options!==undefined){preset.options=presetOptions(p.options);if(preset.options.model!==p.model)throw new Error('프리셋 모델과 생성 설정의 모델이 달라요.');}
  return preset;
 });
}
export function captureImagePreset(settings,id,name) {
 return validateImagePresets([{id,name,positive:settings.positive,negative:settings.negative,model:settings.options.model,options:settings.options}])[0];
}
export function applyImagePreset(settings,id) {
 const p=settings.imagePresets.find(p=>p.id===id);if(!p)throw new Error('저장된 이미지 프리셋을 찾지 못했어요.');
 const options=p.options===undefined?null:presetOptions(p.options);
 settings.positive=p.positive;settings.negative=p.negative;
 if(options)settings.options={...settings.options,...Object.fromEntries(APPLIED_FIELDS.map(k=>[k,options[k]]))};else settings.options.model=p.model;
 settings.imagePresetId=id;
 return p;
}
export function imagePresetModified(settings) {
 const p=settings.imagePresets.find(p=>p.id===settings.imagePresetId);
 return !!p&&(p.positive!==settings.positive||p.negative!==settings.negative||p.model!==settings.options.model||
  (p.options!==undefined&&APPLIED_FIELDS.some(k=>p.options[k]!==settings.options[k])));
}
