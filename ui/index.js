import { DEFAULTS, MODELS, clone, PROFILE_SCHEMA, profileDraftPrompt, parseProfileDraft, blankScene, validateProfiles, chooseMessages, sourceValid,
  extractionPrompt, parseExtraction, assemble, resolveOutfit, buildPayload, costGuard, textSignature,
  BRAND, SIZE_PRESETS, sizePresetOf, VERSION, extractionSchema, stripReasoningBlocks } from './core.mjs';
import { CAMERA_ICON, TAB_ICONS } from './icons.mjs';
import { SKINS, DEFAULT_SKIN, detectSkins, applySkin, skinById } from './skins.mjs';
import { attachInlineImage, detachInlineImage, detachInlineImages, countInlineImages, hasInlineImage, imageDownload, renderInlineImages } from './inline-images.mjs';
import { matchChatProfiles, reconcileCharacters } from './matching.mjs';
import { captureImagePreset, applyImagePreset, imagePresetModified, validateImagePresets } from './presets.mjs';
import { listExtractionProfiles, requestExtraction } from './extractor.mjs';
import { openImageViewer } from './viewer.mjs';
import { genericizeScene } from './tags.mjs';
import { checkCompat } from './compat.mjs';
import { makeZip } from './zip.mjs';
import { cleanImageFile, saveCleanImage } from './downloads.mjs';

const KEY='naice_shot',API='/api/plugins/naice-shot';
let dialog,scene=blankScene(),raw='',finalOverride=null,revision=0,busy=false,task=0,subscription=null,historyItems=[],chatKey='',result=null,attaching=false;
let profileContext='profiles',busyOwner=0,extraction=null,progress=null,optionsOverride=null,historyTotal=0,historyHasMore=false,historyLoading=false;
const selectedIds=new Set(),HISTORY_PAGE=20;
let historyScope='chat',historyFilter='',historyChats=[],historyBytes=0,historyImageCount=0,historyRequest=0;
let availableSkins=SKINS.filter(s=>!s.file),skinsDetected=false;
const $=id=>dialog.querySelector(`#${id}`);
const ctx=()=>SillyTavern.getContext();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// crypto.randomUUID exists only on HTTPS/localhost. getRandomValues also works over plain HTTP (e.g. iOS Safari on http://).
function uuid(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
  const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function settings() {
  const c=ctx();if(!c.extensionSettings[KEY])c.extensionSettings[KEY]=clone(DEFAULTS);
  const s=c.extensionSettings[KEY];for(const [k,v] of Object.entries(DEFAULTS))if(s[k]===undefined)s[k]=clone(v);
  // Noise Schedule is no longer offered: new generations always use the default (karras).
  s.options={...DEFAULTS.options,...s.options,scheduler:DEFAULTS.options.scheduler};s.version=VERSION;return s;
}
const imagePlacement=()=>settings().imagePlacement==='above'?'above':'below';
function renderChatImages(){renderInlineImages(ctx(),document.getElementById('chat'),keyOf(),{placement:imagePlacement()});}
function brand(){return BRAND;}
function renderBrand() {
  for(const el of document.querySelectorAll('#naice-shot-dialog [data-brand],#ncs-extension-settings [data-brand],#extensionsMenu .ncs-menu-item [data-brand]'))el.textContent=brand();
  const launch=document.querySelector('#ncs-extension-settings .ncs-launch-button span');if(launch)launch.textContent=`${brand()} 열기`;
  if(dialog)$('ncs-brand-icon').innerHTML=CAMERA_ICON;
}
function keyOf(c=ctx()) {
  const id=c.getCurrentChatId?.() ?? c.chatId;
  if(!id)return '';
  return JSON.stringify({group:c.groupId??null,card:c.characters?.[c.characterId]?.avatar??null,chat:id});
}
function outfitState() {return ctx().chatMetadata?.[KEY]?.outfits??{};}
function chatBindings(){return ctx().chatMetadata?.[KEY]?.bindings??{};}
function renderMatching() {
  const context=ctx(),s=settings(),selection=context.chat.filter(m=>!m.is_system).map(m=>({speaker:m.name,text:m.mes??'',role:m.is_user?'user':'character',avatar:m.original_avatar??''}));
  const matched=matchChatProfiles(context,s.profiles,selection,chatBindings());
  for(const [field,name,id] of [['character',matched.characterName,matched.characterProfileId],['user',matched.userName,matched.userProfileId]]){
    const select=$(`ncs-${field}-binding`);select.innerHTML=`<option value="">자동 · ${esc(name||'이름 없음')}${id?' → '+esc(s.profiles.find(p=>p.id===id)?.name):' · 연결 없음'}</option>`+s.profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    const selected=chatBindings()[`${field}ProfileId`]??'';
    if(selected&&!s.profiles.some(p=>p.id===selected)){const option=document.createElement('option');option.value=selected;option.textContent='삭제된 프로필 · 다시 선택해 주세요';select.append(option);}
    select.value=selected;select.disabled=field==='character'&&context.groupId!==null&&context.groupId!==undefined;
  }
  $('ncs-matching-state').textContent=matched.warnings.length?matched.warnings.join(' / '):'현재 채팅의 이름·카드 연결을 기준으로 자동 대응해요. 프로필 탭의 선택은 편집용이에요.';
}
function notice(message,error=false) {if(!dialog)return;$('ncs-notice').textContent=message;$('ncs-notice').classList.toggle('ncs-error',error);}
const BUTTON_LABELS={extract:['extract','장면 추출'],generate:['generate','이미지 생성'],profile:['convert-profile','태그로 변환']};
function renderProgress() {
  if(!dialog)return;
  const box=$('ncs-progress');box.hidden=!progress;
  for(const [kind,[action,label]] of Object.entries(BUTTON_LABELS)){const b=dialog.querySelector(`[data-action="${action}"]`);if(b)b.textContent=progress?.kind===kind?`${label} 중…`:label;}
  if(!progress)return;
  const sec=Math.max(0,Math.floor((Date.now()-progress.started)/1000)),time=sec<60?`${sec}초`:`${Math.floor(sec/60)}분 ${sec%60}초`;
  box.dataset.kind=progress.kind;
  const retry=progress.attempt>1?' · 다시 요청 (2/2)':'';
  $('ncs-progress-title').textContent=progress.kind==='extract'?`장면 추출 중${retry}`:progress.kind==='profile'?`프로필 태그 변환 중${retry}`:'NAI 이미지 생성 중';
  $('ncs-progress-detail').textContent=progress.kind==='generate'?`${time} 경과 · 이미 보낸 생성 요청은 중단할 수 없어요. 창을 닫거나 채팅을 바꿔도 서버가 결과를 저장해요.`:`${time} 경과 · 추출 AI 응답을 기다리고 있어요.`;
  $('ncs-progress-cancel').hidden=progress.kind==='generate';$('ncs-progress-cancel').textContent=progress.kind==='profile'?'변환 중단':'추출 중단';
}
function startProgress(kind,owner) {
  clearInterval(progress?.timer);progress={kind,owner,started:Date.now(),attempt:1,timer:setInterval(renderProgress,1000)};renderProgress();
}
function stopProgress(owner) {
  if(!progress||(owner!==undefined&&progress.owner!==owner))return;
  clearInterval(progress.timer);progress=null;renderProgress();
}
function cancelExtraction(message) {
  if(!extraction)return false;
  message??=extraction.kind==='profile'?'변환을 중단했어요. 입력한 내용은 그대로예요.':'추출을 중단했어요. 기존 편집 내용은 유지했어요.';
  const current=extraction;extraction=null;task++;current.controller.abort();
  stopProgress(current.ticket);if(busyOwner===current.ticket)setBusy(false);
  if(message)notice(message);return true;
}
function viewImage(item) {
  if(!item)return;
  const caption=[item.seed!==undefined?`seed ${item.seed}`:'',item.created?new Date(item.created).toLocaleString():''].filter(Boolean).join(' · ');
  openImageViewer(item,{caption,onDelete:()=>deleteImages({ids:[item.id],owners:item.chatKey?{[item.id]:item.chatKey}:null}).then(r=>!!r?.deleted?.includes(item.id),e=>{say(e.message,true);return false;})});
}
function say(message,error=false) {
  // The panel may be closed when deleting from the chat viewer; fall back to ST's toast.
  if(dialog?.open||!globalThis.toastr)notice(message,error);
  else globalThis.toastr[error?'error':'success'](message,brand());
}
function changed(){revision++;finalOverride=null;optionsOverride=null;updateFinal();}
// History restore uses the stored options for the next generation only; the settings tab keeps the user's own values.
function effectiveOptions(){return optionsOverride??settings().options;}
function setBusy(value,owner=0) {busy=value;busyOwner=value?owner:0;for(const b of dialog.querySelectorAll('[data-action="extract"],[data-action="generate"],[data-action="blank"],[data-action="same-seed"],[data-action="new-seed"],[data-action="convert-profile"]'))b.disabled=value;updateAttachButtons();}
async function api(route,{method='GET',body}={}) {
  const response=await fetch(`${API}${route}`,{method,headers:ctx().getRequestHeaders(),body:body?JSON.stringify(body):undefined});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`서버 플러그인을 확인해 주세요 (${response.status}).`);}
  if(!response.ok||data.error)throw new Error(data.error??`요청 실패 (${response.status})`);return data;
}
function showTab(tab) {
  if(tab==='profiles'&&profileContext==='scene')placeProfileForm('profiles'); // keep what was typed, show it in the profile tab
  for(const el of dialog.querySelectorAll('[data-page]'))el.hidden=el.dataset.page!==tab;
  for(const el of dialog.querySelectorAll('[data-tab]'))el.classList.toggle('ncs-active',el.dataset.tab===tab);
  for(const el of dialog.querySelectorAll('[data-tab]'))el.setAttribute('aria-selected',String(el.dataset.tab===tab));
  if(tab==='history')loadHistory().catch(e=>notice(e.message,true));
}
function renderTargets() {
  const current=$('ncs-target').value;
  const rows=ctx().chat?.map((m,i)=>({m,i})).filter(({m})=>!m.is_system&&m.mes?.trim())??[];
  $('ncs-target').innerHTML='<option value="">가장 최근 메시지</option>'+rows.map(({m,i})=>`<option value="${i}">#${i} · ${esc(m.name)} · ${esc(m.mes.replace(/\s+/g,' ').slice(0,55))}</option>`).join('');
  if(rows.some(r=>String(r.i)===current))$('ncs-target').value=current;
}
const skinTargets=()=>[dialog,document.getElementById('ncs-viewer')];
function renderSkins() {
  if(!dialog)return;const chosen=settings().skin;
  $('ncs-skins').innerHTML=availableSkins.map(s=>`<label class="ncs-skin${s.id===chosen?' ncs-selected':''}"><input type="radio" name="ncs-skin" value="${esc(s.id)}" ${s.id===chosen?'checked':''}><span class="ncs-skin-swatch" aria-hidden="true">${s.swatch.map(c=>`<span style="background:${esc(c)}"></span>`).join('')}</span><strong>${esc(s.name)}</strong><small>${esc(s.note)}</small></label>`).join('');
}
async function useSkin(id,{save=false}={}) {
  const base=new URL('./',import.meta.url).href,wanted=availableSkins.some(s=>s.id===id)?id:DEFAULT_SKIN;
  const applied=await applySkin(wanted,base,{targets:skinTargets});
  const s=settings();
  if(save||(skinsDetected&&applied.id!==s.skin)){s.skin=applied.id;ctx().saveSettingsDebounced();}
  renderSkins();
  const missing=skinsDetected&&id!==applied.id;
  $('ncs-skin-state').textContent=missing?`${skinById(id)?.name??id} 스킨 파일을 찾지 못해 기본으로 바꿨어요.`:`${skinById(applied.id)?.name} 스킨을 쓰고 있어요.`;
  if(missing&&save)notice($('ncs-skin-state').textContent,true);
  return applied.id;
}
function renderSettings() {
  const s=settings();
  $('ncs-model').innerHTML=Object.entries(MODELS).map(([id,m])=>`<option value="${id}">${m.label}</option>`).join('');
  for(const [id,k] of [['positive','positive'],['negative','negative'],['recent','recent'],['format','format']])$(`ncs-${id}`).value=s[k];
  for(const [id,k] of [['model','model'],['width','width'],['height','height'],['steps','steps'],['scale','scale'],['seed','seed'],['cfg','cfgRescale'],['sampler','sampler']])$(`ncs-${id}`).value=s.options[k];
  $('ncs-include-user').checked=s.includeUser;$('ncs-schema').checked=s.structuredOutput;$('ncs-retain-raw').checked=s.retainRawExtraction===true;$('ncs-allow-anlas').checked=s.allowAnlas;
  $('ncs-image-placement').value=imagePlacement();$('ncs-size-preset').value=sizePresetOf(s.options);renderBrand();
  renderImagePresets();renderExtractionProfiles();$('ncs-extraction-max-tokens').value=s.extractionMaxTokens;
}
function renderImagePresets() {
  const s=settings(),options='<option value="">현재 설정 유지 · 프리셋 선택</option>'+s.imagePresets.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  for(const id of ['ncs-common-preset','ncs-scene-preset']){$(id).innerHTML=options;$(id).value=s.imagePresetId;}
  $('ncs-common-preset-name').value=s.imagePresets.find(p=>p.id===s.imagePresetId)?.name??'';updatePresetState();
}
function updatePresetState() {
  const s=settings(),p=s.imagePresets.find(p=>p.id===s.imagePresetId);
  $('ncs-preset-state').textContent=p?`${p.name} · ${MODELS[p.model].label}${p.options?' · 생성 설정 포함':' · 이전 저장본: 생성 설정은 덮어쓰기 후 저장돼요.'}${imagePresetModified(s)?' · 현재 값이 수정됐어요. 저장본은 유지돼요.':''}`:'현재 포지·네거와 NAI 생성 설정을 이름 붙여 저장할 수 있어요.';
  $('ncs-scene-preset-state').textContent=optionsOverride?'이력에서 불러온 프롬프트·생성 설정을 사용 중이에요. 프리셋을 고르면 선택한 값으로 다시 조립해요.':$('ncs-preset-state').textContent;
  dialog.querySelector('[data-action="update-preset"]').disabled=!p;
  dialog.querySelector('[data-action="delete-preset"]').disabled=!p;
}
function saveImagePreset(overwrite=false) {
  const s=settings(),name=$('ncs-common-preset-name').value.trim(),old=overwrite?s.imagePresets.find(p=>p.id===s.imagePresetId):null;
  if(overwrite&&!old)throw new Error('덮어쓸 프리셋을 먼저 선택해 주세요.');
  if(s.imagePresets.some(p=>p.id!==old?.id&&p.name.toLowerCase()===name.toLowerCase()))throw new Error('같은 이름의 프리셋이 있어요. 다른 이름으로 저장하거나 해당 프리셋을 선택해 덮어써 주세요.');
  const id=old?.id??uuid(),p=captureImagePreset(s,id,name);
  s.imagePresets=validateImagePresets([...s.imagePresets.filter(p=>p.id!==id),p]);s.imagePresetId=id;
  ctx().saveSettingsDebounced();renderImagePresets();notice(overwrite?'선택한 이미지 프리셋을 생성 설정까지 갱신했어요.':'공통 포지·네거와 NAI 생성 설정을 새 프리셋으로 저장했어요.');
}
function renderExtractionProfiles() {
  const s=settings(),profiles=listExtractionProfiles(ctx());
  $('ncs-extraction-profile').innerHTML='<option value="">본편에서 현재 사용하는 연결</option>'+profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.model||p.api)}</option>`).join('');
  if(s.extractionProfileId&&!profiles.some(p=>p.id===s.extractionProfileId)){
    const missing=document.createElement('option');missing.value=s.extractionProfileId;missing.textContent='선택한 프로필 없음 · 다시 선택해 주세요';$('ncs-extraction-profile').append(missing);
  }
  $('ncs-extraction-profile').value=s.extractionProfileId;
  const selected=profiles.find(p=>p.id===s.extractionProfileId);
  $('ncs-extraction-state').textContent=selected?`${selected.name}로 추출 · 본편 연결 유지`:s.extractionProfileId?'이 연결을 찾지 못했어요. 자동으로 본편 연결로 바꾸지 않아요.':'본편과 같은 연결로 추출해요.';
}
function renderProfiles() {
  const s=settings();
  const selected=$('ncs-profile-id').value;
  $('ncs-profile-list').innerHTML=s.profiles.map(p=>`<button data-profile="${esc(p.id)}" class="ncs-profile-chip ${p.id===selected?'ncs-selected':''}" aria-pressed="${p.id===selected}">${esc(p.name)}</button>`).join('');
  $('ncs-add-profile').innerHTML=s.profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  renderMatching();
}
function editProfile(id='') {
  const p=settings().profiles.find(p=>p.id===id)??{id:'',name:'',aliases:[],subject:'boy',appearance:'',defaultOutfit:'',positive:'',negative:'',cardKey:''};
  for(const [key,field] of [['id','id'],['name','name'],['subject','subject'],['appearance','appearance'],['outfit','defaultOutfit'],['positive','positive'],['negative','negative']])$(`ncs-profile-${key}`).value=p[field];
  $('ncs-profile-aliases').value=p.aliases.join(', ');$('ncs-binding').textContent=p.cardKey?`연결된 카드: ${p.cardKey}`:'연결된 카드 없음';$('ncs-binding').dataset.cardKey=p.cardKey;
  $('ncs-profile-editing').textContent=p.id?`${p.name} 프로필 편집 중`:'새 프로필 작성 중';$('ncs-profile-describe').value='';
  for(const el of dialog.querySelectorAll('[data-profile]')){const active=el.dataset.profile===p.id;el.classList.toggle('ncs-selected',active);el.setAttribute('aria-pressed',String(active));}
}
function saveProfile() {
  const s=settings(),id=$('ncs-profile-id').value||uuid();
  const p={id,name:$('ncs-profile-name').value,aliases:$('ncs-profile-aliases').value.split(',').map(x=>x.trim()).filter(Boolean),
    subject:$('ncs-profile-subject').value,appearance:$('ncs-profile-appearance').value,defaultOutfit:$('ncs-profile-outfit').value,
    positive:$('ncs-profile-positive').value,negative:$('ncs-profile-negative').value,cardKey:$('ncs-binding').dataset.cardKey??''};
  const next=s.profiles.filter(p=>p.id!==id);next.push(p);s.profiles=validateProfiles(next);ctx().saveSettingsDebounced();
  editProfile(id);renderProfiles();renderScene();changed();
  if(profileContext==='scene'){
    const saved=s.profiles.find(x=>x.id===id),names=[saved.name,...saved.aliases].map(x=>x.toLowerCase());
    scene.unregistered=scene.unregistered.filter(n=>!names.includes(String(n).toLowerCase()));
    if(!scene.characters.some(c=>c.id===id))scene.characters.push({id,included:true,expression:'',action:'',position:'auto',outfitMode:'unchanged',outfit:'',manualOutfit:null});
    placeProfileForm('profiles');changed();renderScene();notice(`${saved.name} 프로필을 저장하고 장면에 넣었어요. 표정·행동을 채운 뒤 생성해 주세요.`);
  }else notice('프로필을 저장했어요.');
}
function setProfileMode(mode,{save=true}={}) {
  mode=mode==='direct'?'direct':'describe';
  if(save){settings().profileInputMode=mode;ctx().saveSettingsDebounced();}
  $('ncs-describe-box').hidden=mode!=='describe';
  for(const b of dialog.querySelectorAll('[data-profile-mode]'))b.setAttribute('aria-pressed',String(b.dataset.profileMode===mode));
}
// The one profile form moves between the profile tab and the scene tab, so both share the same fields and logic.
function placeProfileForm(where) {
  const form=$('ncs-profile-form'),slot=where==='scene'?$('ncs-scene-profile-slot'):$('ncs-profile-slot');
  if(form.parentElement!==slot)slot.append(form);
  profileContext=where;$('ncs-scene-profile-slot').hidden=where!=='scene';
  $('ncs-profile-submit').textContent=where==='scene'?'저장하고 장면에 추가':'프로필 저장';
  form.querySelector('[data-action="delete-profile"]').hidden=where==='scene';
  renderSceneExtras();
}
function openQuickProfile(name='') {
  editProfile();if(name)$('ncs-profile-name').value=name;
  placeProfileForm('scene');if(dialog.querySelector('[data-tab="scene"]').getAttribute('aria-selected')!=='true')showTab('scene');
  $('ncs-scene-profile-slot').scrollIntoView({block:'nearest'});
  (settings().profileInputMode==='direct'||!name?$('ncs-profile-name'):$('ncs-profile-describe')).focus({preventScroll:true});
}
function renderSceneExtras() {
  const none=!settings().profiles.length;
  $('ncs-no-profiles').hidden=!none||profileContext==='scene';$('ncs-add-row').hidden=none;
  const names=(scene.unregistered??[]).filter(Boolean);
  $('ncs-unregistered').innerHTML=names.length?`<small>장면에 보이지만 프로필이 없는 인물이에요. 만들면 바로 장면에 들어가요.</small><div class="ncs-row">${names.map(n=>`<button type="button" class="ncs-chip-add" data-quick-profile-name="${esc(n)}">＋ ${esc(n)} 프로필 만들기</button>`).join('')}</div>`:'';
}
async function convertProfile() {
  if(busy)return;
  const s=settings(),prompt=profileDraftPrompt($('ncs-profile-describe').value.trim(),{name:$('ncs-profile-name').value.trim(),format:s.format});
  const editing=$('ncs-profile-id').value,ticket=++task,controller=new AbortController();extraction={ticket,controller,kind:'profile'};
  setBusy(true,ticket);startProgress('profile',ticket);notice('설명을 이미지용 태그로 바꾸고 있어요.');
  try {
    let draft=null,failure;
    for(let attempt=0;attempt<2&&!draft;attempt++) {
      if(controller.signal.aborted||ticket!==task)return;
      if(progress?.owner===ticket){progress.attempt=attempt+1;renderProgress();}
      let received=false;
      try {
        const response=await requestExtraction(ctx(),prompt+(attempt?'\nThe previous response could not be parsed. Return ONLY the complete JSON object.':''),
          {profileId:s.extractionProfileId,structured:attempt===0&&s.structuredOutput,maxTokens:s.extractionMaxTokens,schemaValue:PROFILE_SCHEMA,schemaName:'naice_shot_profile',
           systemPrompt:'You convert character descriptions into image-generation fields as JSON. Do not roleplay.',signal:controller.signal});
        received=true;draft=parseProfileDraft(response);
      }catch(e){if(controller.signal.aborted)return;failure=e;if(!received)break;}
    }
    if(ticket!==task)return;
    if(!draft)throw new Error(`태그 변환 실패: ${failure?.message}. 입력한 내용은 그대로예요.`);
    if($('ncs-profile-id').value!==editing){notice('편집 중인 프로필이 바뀌어서 변환 결과를 적용하지 않았어요.');return;}
    const filled=['appearance','outfit','positive','negative'].some(k=>$(`ncs-profile-${k}`).value.trim());
    if(filled&&!confirm('지금 입력된 외형·기본 복장·Positive·Negative를 변환 결과로 바꿀까요?')){notice('변환 결과를 적용하지 않았어요. 입력한 내용은 그대로예요.');return;}
    if(!$('ncs-profile-name').value.trim()&&draft.name)$('ncs-profile-name').value=draft.name;
    if(!$('ncs-profile-aliases').value.trim()&&draft.aliases.length)$('ncs-profile-aliases').value=draft.aliases.join(', ');
    $('ncs-profile-subject').value=draft.subject;
    for(const [id,key] of [['appearance','appearance'],['outfit','defaultOutfit'],['positive','positive'],['negative','negative']])$(`ncs-profile-${id}`).value=draft[key];
    notice('태그로 바꿨어요. 인원 태그·외형·복장을 확인하고 고친 뒤 저장해 주세요.');
  }finally{
    if(extraction?.ticket===ticket)extraction=null;
    stopProgress(ticket);if(busyOwner===ticket)setBusy(false);
  }
}
function renderScene() {
  for(const k of ['location','lighting','camera','interaction'])$(`ncs-${k}`).value=scene[k];
  renderSceneExtras();
  const profiles=settings().profiles,states=outfitState();
  $('ncs-characters').innerHTML=scene.characters.map(c=>{
    const p=profiles.find(p=>p.id===c.id);if(!p)return '';
    const o=resolveOutfit(c,p,states[c.id]);
    const stale=states[c.id]?.source && !sourceValid(states[c.id].source,ctx().chat);
    return `<article class="ncs-character" data-character="${esc(c.id)}"><div class="ncs-character-head"><label class="ncs-check"><input type="checkbox" data-field="included" ${c.included!==false?'checked':''}><strong>${esc(p.name)}</strong></label><button data-remove="${esc(c.id)}" aria-label="${esc(p.name)} 장면에서 제거">제거</button></div>
      <label>연결된 이미지 프로필<select data-profile-switch>${profiles.map(profile=>`<option value="${esc(profile.id)}" ${profile.id===c.id?'selected':''}>${esc(profile.name)}</option>`).join('')}</select></label><small>${c.entityName?'추출 인물: '+esc(c.entityName):'직접 추가한 인물'} · 변경하면 새 프로필의 복장을 사용해요.</small>
      <div class="ncs-grid"><label>표정<textarea data-field="expression" rows="2">${esc(c.expression)}</textarea></label><label>행동·포즈<textarea data-field="action" rows="2">${esc(c.action)}</textarea></label></div>
      <label>위치<select data-field="position">${['auto','left','center','right'].map((x,i)=>`<option value="${x}" ${c.position===x?'selected':''}>${['AI 자동','왼쪽','가운데','오른쪽'][i]}</option>`).join('')}</select></label>
      <label>이번 그림의 복장<textarea data-field="manualOutfit" rows="3">${esc(o.value)}</textarea></label><small>사용 중: ${esc(o.origin)}${stale?' · 근거 메시지가 바뀌었어요. 복장을 확인해 주세요.':''}</small>
      ${states[c.id]?.locked && c.outfitMode==='replace'?`<small>AI 복장 후보: ${esc(c.outfit)} · 잠긴 복장을 유지해요.</small>`:''}
      <label class="ncs-check"><input type="checkbox" data-lock ${states[c.id]?.locked?'checked':''}>채팅에 저장된 복장 잠금</label>
      <div class="ncs-row"><button data-save-outfit="${esc(c.id)}">현재 복장으로 저장</button><button data-reset-outfit="${esc(c.id)}">이번 편집 되돌리기</button></div>
      <details><summary>고정 외형 · 전용 태그</summary><small>${esc(p.appearance)}</small><small>Positive: ${esc(p.positive)}</small><small>Negative: ${esc(p.negative)}</small></details>
    </article>`;
  }).join('');
  $('ncs-raw').value=raw;updateFinal();
}
function finalData(){return finalOverride??assemble(settings(),scene,outfitState());}
function updateFinal() {
  if(!dialog)return;
  try {
    if(finalOverride?.invalid){$('ncs-warnings').textContent=`최종 프롬프트 JSON을 확인해 주세요: ${finalOverride.message}`;return;} // keep the user's in-progress text
    const a=finalData();if(!(finalOverride&&document.activeElement===$('ncs-final')))$('ncs-final').value=JSON.stringify(a,null,2);
    renderFinalForm(a);$('ncs-final-badge').hidden=!finalOverride;
    const lengths=[`공통 ${a.base.length}자`,...a.characters.map(c=>`${c.name}: ${c.prompt.length}자`)];
    $('ncs-length').textContent=`${lengths.join(' · ')} · 글자 수예요. NAI 토큰 수와 달라요.`;
    const warnings=[...(a.warnings??[])];
    if(scene.source?.historical)warnings.push('과거 장면이에요. 현재 복장은 자동으로 바뀌지 않아요.');
    if(scene.source&&!sourceValid(scene.source,ctx().chat))warnings.push('대상 메시지가 수정·삭제·리롤됐어요. 다시 추출하거나 내용을 확인해 주세요.');
    if(a.base.length+a.characters.reduce((n,c)=>n+c.prompt.length,0)>2000)warnings.push('프롬프트가 길어요. 특히 V4.5는 전체 토큰 한도를 확인해 주세요.');
    if(finalOverride)warnings.push('직접 고친 최종 프롬프트를 이번 생성에 써요. 되돌리려면 "조립 결과로 되돌리기"를 눌러 주세요.');
    if(optionsOverride)warnings.push(`이력에서 불러온 생성 설정(seed ${optionsOverride.seed})을 써요. 새 장면 추출·장면 편집·프리셋 적용·생성 설정 변경 시 현재 설정으로 돌아가요.`);
    $('ncs-warnings').textContent=warnings.join('\n');
    const guard=costGuard(effectiveOptions(),subscription);$('ncs-cost').textContent=guard.message;
    updatePresetState();
  }catch(e){$('ncs-warnings').textContent=e.message;}
}
// Field-by-field editor for the final prompt; the JSON box stays as an advanced view of the same data.
function renderFinalForm(a) {
  const box=$('ncs-final-form');if(box.contains(document.activeElement))return; // never rewrite a field while typing
  const area=(label,attrs,value,rows)=>`<label>${label}<textarea ${attrs} rows="${rows}" spellcheck="false">${esc(value)}</textarea></label>`;
  box.innerHTML=area('공통 Positive','data-final="base"',a.base,3)+area('공통 Negative','data-final="negative"',a.negative,2)+
    (a.characters.length?a.characters.map((c,i)=>`<fieldset class="ncs-final-slot"><legend>${esc(c.name||`인물 ${i+1}`)}</legend>${area('Positive',`data-final="prompt" data-slot="${i}"`,c.prompt,3)}${area('Negative',`data-final="negative" data-slot="${i}"`,c.negative,2)}<label>위치<select data-final="position" data-slot="${i}">${['auto','left','center','right'].map((x,k)=>`<option value="${x}" ${c.position===x?'selected':''}>${['AI 자동','왼쪽','가운데','오른쪽'][k]}</option>`).join('')}</select></label></fieldset>`).join('')
    :'<small>장면에 인물이 없어요. 공통 프롬프트만 보내요.</small>');
}
function editFinalField(el) {
  const base=finalOverride&&!finalOverride.invalid?finalOverride:assemble(settings(),scene,outfitState());
  const next=clone(base),slot=el.dataset.slot;
  if(slot===undefined)next[el.dataset.final]=el.value;else next.characters[Number(slot)][el.dataset.final]=el.value;
  revision++;buildPayload(next,{...effectiveOptions(),seed:0});finalOverride=next;updateFinal();
}
function addCharacter(id) {
  if(!id){openQuickProfile();return;}
  if(scene.characters.some(c=>c.id===id))throw new Error('이미 장면에 있는 인물이에요.');
  scene.characters.push({id,included:true,expression:'',action:'',position:'auto',outfitMode:'unchanged',outfit:'',manualOutfit:null});changed();renderScene();
}
function assertChat(){if(!keyOf())throw new Error('먼저 캐릭터 채팅을 열어 주세요.');}
async function extract() {
  if(busy)return;assertChat();
  const s=settings();if(!s.profiles.length){openQuickProfile();notice('등록된 프로필이 없어요. 아래에서 첫 프로필을 만들면 바로 추출할 수 있어요.');return;}
  if(ctx().streamingProcessor && !ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 추출해 주세요.');
  const selection=chooseMessages(ctx().chat,{target:$('ncs-target').value===''?null:Number($('ncs-target').value),recent:Number($('ncs-recent').value),includeUser:$('ncs-include-user').checked});
  const startKey=keyOf(),rev=revision,ticket=++task,profiles=clone(s.profiles),outfits=clone(outfitState());
  const matching=matchChatProfiles(ctx(),profiles,selection.messages,chatBindings());
  if(!matching.profiles.length)throw new Error('이 채팅의 인물과 연결된 프로필이 없어요. 이름·별칭 또는 이 채팅의 프로필 연결을 확인해 주세요.');
  const prompt=extractionPrompt(selection.messages,matching.profiles,outfits,s.format,'',matching.mappings);
  const controller=new AbortController();extraction={ticket,controller};
  setBusy(true,ticket);startProgress('extract',ticket);notice('장면 추출을 시작했어요.');
  let response='',failure;
  try {
    for(let attempt=0;attempt<2;attempt++) {
      if(ticket!==task||keyOf()!==startKey||revision!==rev||controller.signal.aborted)return;
      if(progress?.owner===ticket){progress.attempt=attempt+1;renderProgress();}
      let received=false;
      try {
        response=await requestExtraction(ctx(),prompt+(attempt?'\nThe previous response could not be parsed. Return ONLY the complete JSON object.':''),
          {profileId:s.extractionProfileId,structured:attempt===0&&s.structuredOutput,maxTokens:s.extractionMaxTokens,schemaValue:extractionSchema(matching.profiles),signal:controller.signal});
        received=true;
        const parsed=parseExtraction(response,profiles),reconciled=reconcileCharacters(parsed.scene,matching);
        if(ticket!==task||keyOf()!==startKey||revision!==rev||!sourceValid(selection.source,ctx().chat)){notice('채팅·장면 또는 원문이 바뀌어서 추출 결과를 적용하지 않았어요.');return;}
        // Names, possessives and macros never reach the image model; tag fields get Danbooru formatting.
        const c=ctx(),storyNames=[...s.profiles.flatMap(p=>[p.name,...p.aliases]),...matching.profiles.flatMap(p=>[p.name,...p.aliases]),...matching.mappings.map(m=>m.name),
          matching.userName,matching.characterName,c.name1,c.name2,...reconciled.scene.unregistered,...reconciled.scene.characters.map(x=>x.entityName)];
        const generic=genericizeScene(reconciled.scene,storyNames,s.format);
        raw=response;scene={...generic.scene,source:selection.source};finalOverride=null;optionsOverride=null;revision++;renderScene();
        const warnings=[...matching.warnings,...parsed.warnings,...reconciled.warnings];
        if(generic.removed.length)warnings.push(`장면 설명에 들어간 이름(${generic.removed.join(', ')})을 빼고 일반 표현으로 정리했어요.`);
        notice(warnings.length?warnings.join(' / '):'추출했어요. 복장과 행동을 확인한 뒤 생성해 주세요.');return;
      }catch(e){if(controller.signal.aborted)return;failure=e;if(!received)break;}
    }
    if(ticket===task&&keyOf()===startKey){raw=response;renderScene();notice(`추출 실패: ${failure?.message}. 기존 편집 내용은 유지했어요.`,true);}
  }finally{
    if(extraction?.ticket===ticket)extraction=null;
    stopProgress(ticket);if(busyOwner===ticket)setBusy(false);
  }
}
async function saveOutfit(id,lockOnly=null) {
  assertChat();const startKey=keyOf(),c=scene.characters.find(c=>c.id===id),p=settings().profiles.find(p=>p.id===id);
  const context=ctx();context.chatMetadata[KEY]??={outfits:{}};context.chatMetadata[KEY].outfits??={};
  const old=context.chatMetadata[KEY].outfits[id];
  const value=lockOnly!==null?(old?.value??p.defaultOutfit):resolveOutfit(c,p,old).value;
  // Store compact hashes instead of RP text in persisted clothing provenance.
  const source=lockOnly!==null?old?.source:(scene.source?compactSource(scene.source):null);
  if(keyOf()!==startKey)return;
  ctx().chatMetadata[KEY].outfits[id]={value,locked:lockOnly??old?.locked??false,source,updated:new Date().toISOString()};
  await ctx().saveMetadata();changed();renderScene();notice(lockOnly!==null?'복장 잠금 상태를 저장했어요.':'현재 복장으로 저장했어요.');
}
function compactSource(source) {
  return {...source,fingerprints:source.fingerprints.map(f=>({index:f.index,swipeId:f.swipeId,signature:f.signature??textSignature(f.text)}))};
}
let compatChecked=false,compatDismissed=false,compatResult={level:'none',message:''};
// Asks the server plugin for its version (no NovelAI call) and warns when the UI and server folders do not match.
async function checkServer({force=false}={}) {
  if(compatChecked&&!force)return compatResult;compatChecked=true;
  let status=-1,data=null;
  try{
    const signal=typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(8000):undefined;
    const response=await fetch(`${API}/status?quick=1`,{headers:ctx().getRequestHeaders(),signal});status=response.status;
    try{data=JSON.parse(await response.text());}catch{data=null;}
  }catch{status=-1;}
  compatResult=checkCompat({uiVersion:VERSION,status,data});
  if(force)compatDismissed=false;
  renderCompat();return compatResult;
}
function renderCompat() {
  if(!dialog)return;const show=(compatResult.level==='warn'||compatResult.level==='error')&&!compatDismissed;
  $('ncs-compat').hidden=!show;$('ncs-compat').dataset.level=compatResult.level;$('ncs-compat-text').textContent=compatResult.message;
  $('ncs-server-version').textContent=compatResult.level==='none'?'':compatResult.message;
}
async function refreshStatus() {
  checkServer({force:true}).catch(()=>{});
  const data=await api('/status');subscription=data.subscription??null;
  $('ncs-status').textContent=data.keyConfigured?`서버 연결됨 · ${subscription?.tier===3?'Opus':'구독 등급 '+subscription?.tier} · Anlas: ${subscription?.anlas?.subscription??'?'} + ${subscription?.anlas?.purchased??'?'}`:'NAI 키가 없어요. 실리태번 API 연결 화면에서 저장해 주세요.';
  updateFinal();return data;
}
async function generate(seedMode=null) {
  if(busy)return;assertChat();const s=settings(),startKey=keyOf(),ticket=++task;
  if(finalOverride?.invalid)throw new Error('최종 프롬프트 JSON이 올바르지 않아요. 고치거나 "조립 결과로 되돌리기"를 눌러 주세요.');
  const a=clone(finalData());
  const options=clone(effectiveOptions());
  options.seed=seedMode==='same'&&result?result.seed:seedMode==='new'||options.seed===-1?crypto.getRandomValues(new Uint32Array(1))[0]:options.seed;
  buildPayload(a,options); // Local validation before network or billing.
  if(!a.base.trim()&&!a.characters.length)throw new Error('장면이나 프롬프트를 먼저 입력해 주세요.');
  const snapshot={scene:clone(scene),...(s.retainRawExtraction===true?{rawExtraction:stripReasoningBlocks(raw)}:{})};snapshot.scene.source=scene.source?compactSource(scene.source):null;
  if(keyOf()!==startKey)return;
  setBusy(true,ticket);startProgress('generate',ticket);notice('NAI에 생성 요청을 보내고 있어요. 창을 닫거나 채팅을 바꿔도 서버는 결과를 저장해요.');
  try {
    const item=await api('/generate',{method:'POST',body:{requestId:uuid(),chatKey:startKey,assembled:a,options,allowAnlas:s.allowAnlas,retainRawExtraction:s.retainRawExtraction===true,snapshot}});
    if(ticket!==task||keyOf()!==startKey){notice('생성이 끝났어요. 시작한 채팅의 이력에서 확인할 수 있어요.');return;}
    result=item;renderResult();notice(`생성했어요 · seed ${item.seed} · 그림을 누르면 크게 볼 수 있어요.`);loadHistory().catch(()=>{});
  }finally{stopProgress(ticket);if(busyOwner===ticket)setBusy(false);}
}
const chatRows=()=>ctx().chat.map((m,i)=>({m,i})).filter(({m})=>!m.is_system&&m.mes?.trim());
const rowOption=({m,i},selected=false)=>`<option value="${i}" ${selected?'selected':''}>#${i} · ${esc(m.name)} · ${esc(m.mes.replace(/\s+/g,' ').slice(0,35))}</option>`;
// Where an image goes by default: where it is already attached, else the message it was generated for, else the latest.
function preferredTarget(item) {
  const chat=ctx().chat,existing=chat.findIndex(m=>m.extra?.naice_shot_images?.some(x=>x.id===item.id));
  const source=item.snapshot?.scene?.source;
  return existing>=0?existing:source&&sourceValid(source,chat)?source.target:chatRows().at(-1)?.i;
}
function imageControls(item) {
  const file=imageDownload(item),attached=hasInlineImage(ctx().chat,item),preferred=preferredTarget(item);
  return `<label>그림을 넣을 메시지<select data-image-target="${esc(item.id)}">${chatRows().map(row=>rowOption(row,row.i===preferred)).join('')}</select></label><div class="ncs-row"><button data-action="attach" class="ncs-primary">본문 아래에 넣기</button>${attached?'<button data-action="detach">이미지 빼기</button>':''}<a href="${esc(file.url)}" download="${file.filename}">PNG 저장</a><button type="button" data-clean-save="${esc(item.id)}" title="프롬프트 메타데이터와 알파 채널 정보를 뺀 불투명 PNG 사본">공유용 PNG</button><button type="button" data-action="delete-result" class="ncs-danger-outline">삭제</button></div>`;
}
function renderResult() {
  $('ncs-result').innerHTML=result?`<button type="button" class="ncs-image-open" data-view-result aria-label="생성된 장면 크게 보기"><img src="${esc(result.image)}" alt="생성된 장면"></button>${imageControls(result)}<div class="ncs-row"><button data-action="same-seed">같은 seed로 생성</button><button data-action="new-seed">새 seed로 생성</button><button type="button" data-view-result>크게 보기</button></div><small>seed ${result.seed} · ${esc(MODELS[result.options.model]?.label)} · 메시지 본문은 유지되고, 첨부 그림은 본편 AI 입력에 포함되지 않아요.</small>`:'';
  updateAttachButtons();
}
function updateAttachButtons() {
  const locked=busy||attaching;
  for(const el of dialog.querySelectorAll('[data-action="attach"],[data-action="detach"],[data-history-attach],[data-history-detach],[data-image-target],#ncs-history-target,[data-history-delete],[data-action="delete-result"],[data-history-pick]'))el.disabled=locked;
  for(const el of document.querySelectorAll('[data-ncs-inline-remove]'))el.disabled=locked;
  updateHistoryTools();
}
let savingSelection=false;
function downloadFile(url,filename) {const a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';document.body.append(a);a.click();a.remove();}
// Saves the selected history images: one PNG as-is, several as a single ZIP (one download prompt, works on mobile).
async function saveSelected(clean=false) {
  const items=historyItems.filter(x=>selectedIds.has(x.id)).sort((a,b)=>String(a.created).localeCompare(String(b.created)));
  if(!items.length||savingSelection)return;
  if(items.length===1&&clean){savingSelection=true;updateHistoryTools();try{await saveCleanImage(items[0]);notice('메타데이터를 뺀 공유용 PNG를 저장했어요.');}finally{savingSelection=false;updateHistoryTools();}return;}
  if(items.length===1){const file=imageDownload(items[0]);downloadFile(file.url,file.filename);notice('선택한 그림 1장을 PNG로 저장했어요.');return;}
  savingSelection=true;updateHistoryTools();
  try{
    const files=[];let missing=0;
    for(const [i,item] of items.entries()){
      notice(`선택한 그림을 모으고 있어요… ${i+1}/${items.length}`);
      try{
        if(clean){const file=await cleanImageFile(item);files.push({name:file.filename,data:new Uint8Array(await file.blob.arrayBuffer()),date:new Date(item.created)});}
        else{const file=imageDownload(item),response=await fetch(file.url,{cache:'no-store'});if(!response.ok)throw new Error(String(response.status));
        files.push({name:file.filename,data:new Uint8Array(await response.arrayBuffer()),date:new Date(item.created)});}}catch{missing++;}
    }
    if(!files.length)throw new Error('저장할 그림 파일을 찾지 못했어요. 서버 폴더에서 지워졌을 수 있어요.');
    const d=new Date(),pad=n=>String(n).padStart(2,'0'),stamp=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const url=URL.createObjectURL(new Blob([makeZip(files)],{type:'application/zip'}));
    downloadFile(url,`naice-shot-${clean?"shared-":""}${stamp}-${files.length}.zip`);setTimeout(()=>URL.revokeObjectURL(url),60000);
    notice(`${clean?"메타데이터를 뺀 공유용 그림":"선택한 그림"} ${files.length}장을 ZIP 파일 하나로 저장했어요.${missing?` 불러오기·변환에 실패한 ${missing}장은 빠졌어요.`:''}`);
  }finally{savingSelection=false;updateHistoryTools();}
}
function updateHistoryTools() {
  if(!dialog)return;const locked=busy||attaching;
  for(const id of [...selectedIds])if(!historyItems.some(x=>x.id===id))selectedIds.delete(id);
  const save=dialog.querySelector('[data-action="save-selected"]');save.textContent=savingSelection?'저장 준비 중…':selectedIds.size?`선택 저장 (${selectedIds.size})`:'선택 저장';save.disabled=savingSelection||!selectedIds.size;
  const clean=dialog.querySelector('[data-action="save-selected-clean"]');clean.disabled=savingSelection||!selectedIds.size;
  const del=dialog.querySelector('[data-action="delete-selected"]');del.textContent=selectedIds.size?`선택 삭제 (${selectedIds.size})`:'선택 삭제';del.disabled=locked||!selectedIds.size;
  const all=dialog.querySelector('[data-action="select-all-history"]'),every=historyItems.length>0&&historyItems.every(x=>selectedIds.has(x.id));
  all.textContent=every?'선택 해제':'표시된 항목 모두 선택';all.disabled=locked||!historyItems.length;
  const allScope=historyScope==='all';
  dialog.querySelector('[data-action="delete-chat-history"]').disabled=locked||!historyTotal;dialog.querySelector('[data-action="delete-chat-history"]').hidden=allScope;
  const filterDelete=dialog.querySelector('[data-action="delete-filter-chat"]');filterDelete.hidden=!allScope||!historyFilter;filterDelete.disabled=locked||!historyTotal;
  $('ncs-history-target-row').hidden=allScope;$('ncs-history-all-tools').hidden=!allScope;
  $('ncs-history-help').textContent=allScope?'모든 채팅에서 만든 그림을 모아 봐요. 지운 채팅이나 이름이 바뀐 카드의 그림도 여기서 정리할 수 있어요.':'편집으로 불러오면 당시 최종 프롬프트와 생성 설정을 이번 생성에 써요. 현재 복장과 설정 탭 값은 바뀌지 않아요.';
  for(const b of dialog.querySelectorAll('[data-history-scope]'))b.setAttribute('aria-pressed',String(b.dataset.historyScope===historyScope));
  $('ncs-history-storage').textContent=allScope?`저장된 그림 전체 ${historyImageCount}장 · ${formatBytes(historyBytes)}`:'';
  const more=dialog.querySelector('[data-action="history-more"]');more.hidden=!historyHasMore;more.disabled=historyLoading;
  more.textContent=historyLoading?'불러오는 중…':`더 보기 (${historyItems.length} / ${historyTotal})`;
  $('ncs-history-count').textContent=historyTotal?`총 ${historyTotal}장 · ${historyItems.length}장 표시 중`:'';
}
const formatBytes=n=>n>=1073741824?`${(n/1073741824).toFixed(2)} GB`:n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.max(0,Math.round(n/1024))} KB`;
// Readable name for a chat key: the chat file name (which usually starts with the character name).
function chatLabel(key) {
  try{const o=JSON.parse(key);const name=String(o.chat??o.card??'').trim()||'알 수 없는 채팅';return o.group?`그룹 · ${name}`:name;}catch{return '알 수 없는 채팅';}
}
function setHistoryScope(scope) {
  historyScope=scope==='all'?'all':'chat';historyFilter='';historyItems=[];historyTotal=0;historyHasMore=false;selectedIds.clear();
  loadHistory().catch(e=>notice(e.message,true));
}
// Deletes images, possibly from several chats: one server request per owning chat.
// all=true deletes every image of one chat (chatKey, or the current chat).
async function deleteImages({ids=[],all=false,chatKey:allOf=null,owners=null}) {
  if(busy||attaching)throw new Error('진행 중인 작업이 끝난 뒤 삭제해 주세요.');
  const current=keyOf(),chat=current?ctx().chat:[];
  if(current&&ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 삭제해 주세요.');
  const target=all?(allOf??current):null;
  if(all&&!target)throw new Error('먼저 캐릭터 채팅을 열어 주세요.');
  if(!all&&!ids.length)return null;
  const ownerOf=id=>owners?.[id]??historyItems.find(x=>x.id===id)?.chatKey??current;
  const groups=new Map();
  if(all)groups.set(target,'all');else for(const id of ids){const key=ownerOf(id);if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);}
  const here=all?target===current:false,localIds=all?[]:ids.filter(id=>ownerOf(id)===current);
  const attached=here?countInlineImages(chat):localIds.filter(id=>hasInlineImage(chat,{id})).length;
  const elsewhere=all?target!==current:ids.some(id=>ownerOf(id)!==current);
  const allCount=historyScope==='all'?historyChats.find(c=>c.chatKey===target)?.count??historyTotal:historyTotal;
  const what=all?(here?`이 채팅에서 만든 그림 ${allCount}장을 모두`:`"${chatLabel(target)}" 채팅의 그림 ${allCount}장을 모두`):ids.length===1?'이 그림을':`선택한 그림 ${ids.length}장을`;
  if(!confirm(`${what} 삭제할까요?\n원본 PNG와 생성 기록이 서버에서 지워지며 되돌릴 수 없어요.${attached?`\n지금 채팅 본문 아래에 붙인 그림 ${attached}장도 함께 빠져요.`:''}${elsewhere?'\n다른 채팅에 붙여 둔 그림이 있었다면 그 채팅에서는 "찾을 수 없는 그림" 안내로 바뀌어요.':''}`))return null;
  attaching=true;updateAttachButtons();
  try {
    const deleted=new Set(),skipped=[];
    for(const [key,list] of groups){
      let response;
      try{response=await api('/delete',{method:'POST',body:list==='all'?{chatKey:key,all:true}:{chatKey:key,ids:list}});}
      catch(e){if(/\(404\)|\(405\)/.test(e.message))throw new Error('서버 플러그인이 이전 버전이에요. 최신 server 파일로 바꾸고 실리태번을 재시작해 주세요.');throw e;}
      for(const id of response.deleted??[])deleted.add(id);skipped.push(...(response.skipped??[]));
    }
    // Clean attachments of the open chat in one save; other chats keep a "missing image" note.
    if(deleted.size&&current&&keyOf()===current)await detachInlineImages(ctx(),deleted,{isCurrent:()=>keyOf()===current});
    if(result&&deleted.has(result.id))result=null;
    for(const id of deleted)selectedIds.delete(id);
    if(current&&keyOf()===current){renderChatImages();renderResult();}
    const skippedText=skipped.length?` 찾지 못한 ${skipped.length}장은 지우지 않았어요.`:'';
    say(deleted.size?`그림 ${deleted.size}장을 삭제했어요.${skippedText}`:`삭제한 그림이 없어요.${skippedText}`,!deleted.size);
    return {deleted:[...deleted],skipped};
  }finally{attaching=false;updateAttachButtons();loadHistory().catch(e=>notice(e.message,true));}
}
async function putImageInChat(item,targetIndex) {
  if(!item||attaching||busy)return;assertChat();const startKey=keyOf();
  if(item.chatKey!==startKey)throw new Error('현재 채팅의 이미지만 첨부할 수 있어요.');
  if(ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 첨부해 주세요.');
  attaching=true;updateAttachButtons();
  try {
    const added=await attachInlineImage(ctx(),item,{targetIndex,isCurrent:()=>keyOf()===startKey});
    if(keyOf()!==startKey)return;
    renderChatImages();renderResult();renderHistory();
    notice(added.duplicate?'이 메시지에 이미 넣은 이미지예요.':'선택한 RP 메시지의 본문 아래에 그림을 넣었어요. 본문은 그대로 유지돼요.');
  }finally{attaching=false;updateAttachButtons();}
}
async function removeImageFromChat(item) {
  if(!item||attaching||busy)return;assertChat();const startKey=keyOf();
  if(item.chatKey!==startKey)throw new Error('현재 채팅의 이미지만 뺄 수 있어요.');
  if(ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 이미지를 빼 주세요.');
  attaching=true;updateAttachButtons();
  try{
    const removed=await detachInlineImage(ctx(),item,{isCurrent:()=>keyOf()===startKey});
    if(keyOf()!==startKey)return;
    renderChatImages();renderResult();renderHistory();
    notice(removed.removed?'채팅의 이미지 첨부만 뺐어요. 원본과 생성 이력은 남아 있어요.':'이 이미지는 현재 채팅에 첨부되어 있지 않아요.');
  }finally{attaching=false;updateAttachButtons();}
}
// One shared target selector for all history cards keeps the DOM small in long chats.
function renderHistoryTarget() {
  if(!dialog)return;const select=$('ncs-history-target'),current=select.value;
  select.innerHTML='<option value="">자동 · 생성했던 메시지 (없으면 최근 메시지)</option>'+chatRows().map(row=>rowOption(row)).join('');
  if([...select.options].some(o=>o.value===current))select.value=current;
}
function renderHistoryFilter() {
  const select=$('ncs-history-filter'),current=keyOf();
  select.innerHTML=`<option value="">모든 채팅 · ${historyImageCount}장</option>`+historyChats.map(c=>`<option value="${esc(c.chatKey)}">${esc(chatLabel(c.chatKey))}${c.chatKey===current?' · 지금 채팅':''} · ${c.count}장</option>`).join('');
  select.value=historyChats.some(c=>c.chatKey===historyFilter)?historyFilter:'';
}
function renderHistory() {
  renderHistoryTarget();
  const chat=ctx().chat??[],current=keyOf();
  if(historyScope==='all'){
    renderHistoryFilter();
    $('ncs-history').innerHTML=historyItems.length?historyItems.map(item=>{
      const id=esc(item.id),file=imageDownload(item),here=item.chatKey===current;
      return `<article class="ncs-history-card${selectedIds.has(item.id)?' ncs-picked':''}"><label class="ncs-check ncs-pick"><input type="checkbox" data-history-pick="${id}" ${selectedIds.has(item.id)?'checked':''}>선택</label><button type="button" class="ncs-image-open" data-view-history="${id}" aria-label="생성 이력 크게 보기"><img loading="lazy" src="${esc(item.image)}" alt="생성 이력"></button><small class="ncs-chat-name${here?' ncs-here':''}">${esc(chatLabel(item.chatKey))}${here?' · 지금 채팅':''}</small><small>${esc(new Date(item.created).toLocaleString())} · seed ${esc(item.seed)}</small><a href="${esc(file.url)}" download="${file.filename}">PNG 저장</a><button type="button" data-clean-save="${esc(item.id)}" title="프롬프트 메타데이터와 알파 채널 정보를 뺀 불투명 PNG 사본">공유용 PNG</button><button data-history-delete="${id}" class="ncs-danger-outline">삭제</button></article>`;
    }).join(''):'<p>저장된 그림이 없어요.</p>';
    updateAttachButtons();return;
  }
  $('ncs-history').innerHTML=historyItems.length?historyItems.map(item=>{
    const id=esc(item.id),file=imageDownload(item),attached=hasInlineImage(chat,item);
    return `<article class="ncs-history-card${selectedIds.has(item.id)?' ncs-picked':''}"><label class="ncs-check ncs-pick"><input type="checkbox" data-history-pick="${id}" ${selectedIds.has(item.id)?'checked':''}>선택</label><button type="button" class="ncs-image-open" data-view-history="${id}" aria-label="생성 이력 크게 보기"><img loading="lazy" src="${esc(item.image)}" alt="생성 이력"></button><small>${esc(new Date(item.created).toLocaleString())} · seed ${esc(item.seed)}</small><button data-history-id="${id}">편집으로 불러오기</button><button data-history-attach="${id}" class="ncs-primary">본문 아래에 넣기</button>${attached?`<button data-history-detach="${id}">이미지 빼기</button>`:''}<a href="${esc(file.url)}" download="${file.filename}">PNG 저장</a><button type="button" data-clean-save="${esc(item.id)}" title="프롬프트 메타데이터와 알파 채널 정보를 뺀 불투명 PNG 사본">공유용 PNG</button><button data-history-delete="${id}" class="ncs-danger-outline">삭제</button></article>`;
  }).join(''):'<p>아직 생성 이력이 없어요.</p>';
  updateAttachButtons();
}
async function loadHistory({append=false}={}) {
  const startKey=keyOf(),allScope=historyScope==='all';
  if(!startKey&&!allScope){$('ncs-history').innerHTML='<p>채팅을 먼저 열어 주세요. 모든 채팅 보기에서는 채팅을 열지 않아도 그림을 정리할 수 있어요.</p>';updateHistoryTools();return;}
  if(append&&historyLoading)return;
  const offset=append?historyItems.length:0,limit=append?HISTORY_PAGE:Math.min(100,Math.max(HISTORY_PAGE,historyItems.length)); // a refresh keeps what was already shown
  const request=++historyRequest;historyLoading=true;updateHistoryTools();
  try {
    const query=allScope?`scope=all${historyFilter?`&chatKey=${encodeURIComponent(historyFilter)}`:''}`:`chatKey=${encodeURIComponent(startKey)}`;
    const data=await api(`/history?${query}&offset=${offset}&limit=${limit}`);
    if(request!==historyRequest||(!allScope&&keyOf()!==startKey)||historyScope!==(allScope?'all':'chat'))return;
    if(allScope&&data.scope!=='all'){historyItems=[];historyTotal=0;historyHasMore=false;$('ncs-history').innerHTML='<p>모든 채팅 보기는 서버 플러그인 v0.1.0이 필요해요. server 폴더 파일을 바꾸고 실리태번을 재시작해 주세요.</p>';return;}
    if(allScope){historyChats=Array.isArray(data.chats)?data.chats:[];historyBytes=Number(data.bytes)||0;historyImageCount=Number(data.imageCount)||0;
      // The filtered chat has no images left (e.g. it was just cleared): go back to every chat.
      if(historyFilter&&!historyChats.some(c=>c.chatKey===historyFilter)){historyFilter='';historyItems=[];historyLoading=false;return loadHistory();}}
    const items=Array.isArray(data.items)?data.items:[];
    historyItems=append?[...historyItems,...items.filter(x=>!historyItems.some(y=>y.id===x.id))]:items;
    historyTotal=Number.isInteger(data.total)?data.total:historyItems.length;
    historyHasMore=data.hasMore===true; // a v0.3 server returns everything at once and no hasMore
  }finally{historyLoading=false;updateHistoryTools();}
  if(request===historyRequest)renderHistory();
}
function restoreHistory(id) {
  if(busy)throw new Error('진행 중인 작업이 끝난 뒤 불러와 주세요.');
  const item=historyItems.find(x=>x.id===id);if(!item)return;
  scene=clone(item.snapshot?.scene??blankScene());scene.source=null;
  scene.characters=scene.characters.filter(c=>settings().profiles.some(p=>p.id===c.id));
  raw=item.snapshot?.rawExtraction??'';finalOverride=clone(item.assembled);optionsOverride=clone(item.options);
  result=item;revision++;renderScene();renderResult();showTab('scene');
  notice('당시 최종 프롬프트와 생성 설정(seed 포함)을 불러왔어요. 설정 탭 값과 현재 복장은 바뀌지 않아요.');
}
function exportSettings() {
  const blob=new Blob([JSON.stringify(settings(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='naice-shot-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importSettings(file) {
  if(!file)return;if(file.size>1024*1024)throw new Error('백업 파일이 너무 커요.');
  const value=JSON.parse(await file.text()),profiles=validateProfiles(value.profiles);
  const next={...clone(DEFAULTS),...value,profiles,options:{...DEFAULTS.options,...value.options}};
  if(typeof next.positive!=='string'||typeof next.negative!=='string'||typeof next.displayName!=='string'||next.displayName.length>40||!['tags','natural'].includes(next.format))throw new Error('백업 형식이 잘못됐어요.');
  buildPayload({base:'test',negative:'',characters:[]},{...next.options,seed:next.options.seed===-1?0:next.options.seed});
  next.imagePresets=validateImagePresets(next.imagePresets);
  if(typeof next.imagePresetId!=='string'||typeof next.extractionProfileId!=='string'||next.extractionProfileId.length>80||!Number.isInteger(next.extractionMaxTokens)||next.extractionMaxTokens<256||next.extractionMaxTokens>16384)throw new Error('프리셋·추출 연결 백업 값을 확인해 주세요.');
  // Import only the declared settings fields, never arbitrary payload keys.
  const clean={};for(const k of Object.keys(DEFAULTS))clean[k]=next[k];
  clean.imagePlacement=next.imagePlacement==='above'?'above':'below';
  clean.retainRawExtraction=false; // importing a backup must not enable raw response retention
  clean.allowAnlas=false; // a shared backup must never switch on paid generation by itself
  if(typeof clean.skin!=='string'||!skinById(clean.skin))clean.skin=DEFAULT_SKIN;
  if(!['describe','direct'].includes(clean.profileInputMode))clean.profileInputMode=DEFAULTS.profileInputMode;
  if(!confirm('현재 프로필과 공통 설정을 이 백업으로 바꿀까요? 현재 설정을 내보낸 뒤 진행할 수 있어요.'))return;
  ctx().extensionSettings[KEY]=clean;ctx().saveSettingsDebounced();renderChatImages();scene=blankScene();finalOverride=null;optionsOverride=null;revision++;renderSettings();renderProfiles();editProfile();renderScene();useSkin(clean.skin).catch(()=>{});notice('백업을 가져왔어요. Anlas 사용 가능성 허용과 추출 원문 보관은 꺼진 상태로 가져왔어요.');
}
async function onAction(action,el) {
  switch(action) {
    case 'close':dialog.close();break;
    case 'dismiss-compat':compatDismissed=true;renderCompat();break;
    case 'cancel-extract':if(!cancelExtraction())notice('진행 중인 추출이 없어요.');break;
    case 'extract':await extract();break;
    case 'blank':scene=blankScene();raw='';changed();renderScene();notice('직접 장면을 입력해 주세요.');break;
    case 'add-character':addCharacter($('ncs-add-profile').value);break;
    case 'generate':await generate();break;
    case 'same-seed':await generate('same');break;
    case 'new-seed':await generate('new');break;
    case 'attach':await putImageInChat(result,Number($('ncs-result').querySelector('[data-image-target]')?.value));break;
    case 'detach':await removeImageFromChat(result);break;
    case 'new-profile':case 'clear-profile-form':{
      const wasEditing=$('ncs-profile-id').value;editProfile();
      $('ncs-profile-name').focus({preventScroll:true});$('ncs-profile-name').scrollIntoView({block:'center',behavior:'smooth'});
      notice(wasEditing?'모든 칸을 비우고 새 프로필 작성으로 바꿨어요. 저장해 둔 프로필은 그대로예요.':'모든 칸을 비웠어요. 새 프로필을 작성해 주세요.');break;
    }
    case 'quick-profile':openQuickProfile();break;
    case 'close-quick-profile':placeProfileForm('profiles');editProfile();notice('새 프로필 만들기를 닫았어요.');break;
    case 'convert-profile':await convertProfile();break;
    case 'delete-profile':{
      const id=$('ncs-profile-id').value;if(!id)return;
      if(!confirm('이 프로필을 삭제할까요? 생성 이력은 유지돼요.'))return;
      settings().profiles=settings().profiles.filter(p=>p.id!==id);scene.characters=scene.characters.filter(c=>c.id!==id);ctx().saveSettingsDebounced();changed();renderProfiles();editProfile();renderScene();break;
    }
    case 'bind-card':{
      const card=ctx().characters?.[ctx().characterId];if(!card?.avatar)throw new Error('개별 캐릭터 채팅에서 카드를 연결해 주세요.');
      $('ncs-binding').dataset.cardKey=card.avatar;$('ncs-binding').textContent=`연결할 카드: ${card.avatar} · 프로필 저장을 눌러 주세요.`;break;
    }
    case 'reset-final':finalOverride=null;revision++;updateFinal();break;
    case 'status':await refreshStatus();break;
    case 'save-preset':saveImagePreset();break;
    case 'update-preset':saveImagePreset(true);break;
    case 'delete-preset':{
      const s=settings(),id=s.imagePresetId;if(!id)return;
      if(!confirm('선택한 이미지 프리셋을 삭제할까요? 현재 입력된 프롬프트와 생성 설정은 유지돼요.'))return;
      s.imagePresets=s.imagePresets.filter(p=>p.id!==id);s.imagePresetId='';ctx().saveSettingsDebounced();renderImagePresets();notice('이미지 프리셋을 삭제했어요. 현재 값은 유지돼요.');break;
    }
    case 'refresh-extraction-profiles':renderExtractionProfiles();break;
    case 'history':await loadHistory();break;
    case 'history-more':await loadHistory({append:true});break;
    case 'select-all-history':{
      const every=historyItems.length>0&&historyItems.every(x=>selectedIds.has(x.id));
      if(every)selectedIds.clear();else for(const x of historyItems)selectedIds.add(x.id);
      renderHistory();break;
    }
    case 'save-selected':await saveSelected();break;
    case 'save-selected-clean':await saveSelected(true);break;
    case 'delete-selected':await deleteImages({ids:[...selectedIds]});break;
    case 'delete-chat-history':await deleteImages({all:true});break;
    case 'delete-filter-chat':if(historyFilter)await deleteImages({all:true,chatKey:historyFilter});break;
    case 'delete-result':if(result)await deleteImages({ids:[result.id]});break;
    case 'export':exportSettings();break;
  }
}
function bindEvents() {
  dialog.addEventListener('click',event=>{
    const el=event.target.closest('button,a');if(!el)return;
    Promise.resolve().then(async()=>{
      if(el.dataset.cleanSave){const id=el.dataset.cleanSave;await saveCleanImage({id,image:`/user/images/naice-shot/${id}.png`});notice('메타데이터를 뺀 공유용 PNG를 저장했어요.');}
      else if(el.dataset.tab)showTab(el.dataset.tab);
      else if(el.dataset.action)await onAction(el.dataset.action,el);
      else if(el.dataset.historyScope)setHistoryScope(el.dataset.historyScope);
      else if(el.dataset.profileMode)setProfileMode(el.dataset.profileMode);
      else if(el.dataset.quickProfileName!==undefined)openQuickProfile(el.dataset.quickProfileName);
      else if(el.dataset.profile)editProfile(el.dataset.profile);
      else if(el.dataset.remove){scene.characters=scene.characters.filter(c=>c.id!==el.dataset.remove);changed();renderScene();}
      else if(el.dataset.saveOutfit)await saveOutfit(el.dataset.saveOutfit);
      else if(el.dataset.resetOutfit){scene.characters.find(c=>c.id===el.dataset.resetOutfit).manualOutfit=null;changed();renderScene();}
      else if(el.dataset.historyId)restoreHistory(el.dataset.historyId);
      else if(el.dataset.viewResult!==undefined)viewImage(result);
      else if(el.dataset.viewHistory)viewImage(historyItems.find(x=>x.id===el.dataset.viewHistory));
      else if(el.dataset.historyAttach){const item=historyItems.find(x=>x.id===el.dataset.historyAttach),chosen=$('ncs-history-target').value;await putImageInChat(item,chosen===''?preferredTarget(item):Number(chosen));}
      else if(el.dataset.historyDelete)await deleteImages({ids:[el.dataset.historyDelete]});
      else if(el.dataset.historyDetach)await removeImageFromChat(historyItems.find(x=>x.id===el.dataset.historyDetach));
    }).catch(e=>notice(e.message,true));
  });
  // Thumbnails whose PNG was removed by hand show a short note instead of a broken image.
  dialog.addEventListener('error',event=>{const img=event.target;if(img?.tagName==='IMG')img.closest('.ncs-image-open')?.classList.add('ncs-missing');},true);
  $('ncs-profile-form').addEventListener('submit',event=>{event.preventDefault();try{saveProfile();}catch(e){notice(e.message,true);}});
  dialog.addEventListener('input',event=>{
    const el=event.target;
    if(el.closest('#ncs-profile-form')||el.id==='ncs-import'||el.id==='ncs-raw')return;
    try {
      if(el.dataset.historyPick){if(el.checked)selectedIds.add(el.dataset.historyPick);else selectedIds.delete(el.dataset.historyPick);el.closest('.ncs-history-card')?.classList.toggle('ncs-picked',el.checked);updateHistoryTools();return;}
      if(el.id==='ncs-history-target')return;
      if(el.id==='ncs-history-filter'){historyFilter=el.value;historyItems=[];historyTotal=0;historyHasMore=false;selectedIds.clear();loadHistory().catch(e=>notice(e.message,true));return;}
      if(el.name==='ncs-skin'){useSkin(el.value,{save:true}).catch(e=>notice(e.message,true));return;}
      if(el.id==='ncs-character-binding'||el.id==='ncs-user-binding'){
        assertChat();const context=ctx();context.chatMetadata[KEY]??={};context.chatMetadata[KEY].bindings??={};
        context.chatMetadata[KEY].bindings[el.id==='ncs-character-binding'?'characterProfileId':'userProfileId']=el.value;
        revision++;context.saveMetadata().catch(e=>notice(e.message,true));renderMatching();return;
      }
      if(el.id==='ncs-common-preset'||el.id==='ncs-scene-preset'){
        const s=settings();s.imagePresetId=el.value;
        if(el.value){const p=applyImagePreset(s,el.value);changed();renderSettings();notice(p.options?'공통 포지·네거와 NAI 생성 설정을 불러왔어요.':'이전 프리셋의 포지·네거·모델을 불러왔어요. 생성 설정은 현재 값을 유지해요.');}
        else renderImagePresets();ctx().saveSettingsDebounced();return;
      }
      if(el.id==='ncs-extraction-profile'){settings().extractionProfileId=el.value;revision++;ctx().saveSettingsDebounced();renderExtractionProfiles();return;}
      if(el.id==='ncs-extraction-max-tokens'){settings().extractionMaxTokens=Number(el.value);revision++;ctx().saveSettingsDebounced();return;}
      if(el.id==='ncs-size-preset'){
        const preset=SIZE_PRESETS[el.value];if(preset){optionsOverride=null;settings().options.width=preset.width;settings().options.height=preset.height;$('ncs-width').value=preset.width;$('ncs-height').value=preset.height;ctx().saveSettingsDebounced();revision++;updateFinal();updatePresetState();}return;
      }
      if(el.dataset.final!==undefined){editFinalField(el);return;}
      if(el.id==='ncs-final'){
        revision++;try{const value=JSON.parse(el.value);buildPayload(value,{...effectiveOptions(),seed:0});if(typeof value.base!=='string'||typeof value.negative!=='string'||value.characters.some(c=>typeof c.prompt!=='string'||typeof c.name!=='string'))throw new Error('base·negative·characters[].name·prompt는 문자열이어야 해요.');finalOverride=value;renderFinalForm(value);$('ncs-final-badge').hidden=false;$('ncs-warnings').textContent='직접 수정한 최종 프롬프트를 이번 생성에 사용해요.';}catch(e){finalOverride={invalid:true,message:e.message};$('ncs-warnings').textContent=`최종 프롬프트 JSON을 확인해 주세요: ${e.message}`;}return;
      }
      if(el.hasAttribute('data-profile-switch')){
        const oldId=el.closest('[data-character]').dataset.character;
        if(scene.characters.some(c=>c.id===el.value&&c.id!==oldId)){el.value=oldId;throw new Error('이미 장면에 있는 프로필이에요.');}
        const c=scene.characters.find(c=>c.id===oldId);c.id=el.value;c.entityName=settings().profiles.find(p=>p.id===c.id)?.name??'';
        c.manualOutfit=null;c.outfitMode='unchanged';c.outfit='';changed();renderScene();return;
      }
      if(el.dataset.field){const c=scene.characters.find(c=>c.id===el.closest('[data-character]').dataset.character);c[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;changed();return;}
      if(el.hasAttribute('data-lock')){const id=el.closest('[data-character]').dataset.character;saveOutfit(id,el.checked).catch(e=>notice(e.message,true));return;}
      for(const field of ['location','lighting','camera','interaction'])if(el.id===`ncs-${field}`){scene[field]=el.value;changed();return;}
      if(el.id==='ncs-image-placement'){settings().imagePlacement=el.value==='above'?'above':'below';ctx().saveSettingsDebounced();renderChatImages();notice(el.value==='above'?'채팅 속 그림을 메시지 글 위에 보여줘요.':'채팅 속 그림을 메시지 글 아래에 보여줘요.');return;}
      const settingMap={'ncs-positive':'positive','ncs-negative':'negative','ncs-format':'format','ncs-recent':'recent','ncs-include-user':'includeUser','ncs-schema':'structuredOutput','ncs-retain-raw':'retainRawExtraction','ncs-allow-anlas':'allowAnlas'};
      const optionMap={'ncs-model':'model','ncs-width':'width','ncs-height':'height','ncs-steps':'steps','ncs-scale':'scale','ncs-seed':'seed','ncs-cfg':'cfgRescale','ncs-sampler':'sampler'};
      if(settingMap[el.id])settings()[settingMap[el.id]]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
      if(optionMap[el.id]){optionsOverride=null;settings().options[optionMap[el.id]]=el.type==='number'?Number(el.value):el.value;}
      if(settingMap[el.id]||optionMap[el.id]){
        ctx().saveSettingsDebounced();
        // Only the common prompts change the assembled prompt; other settings must not discard a manual edit.
        if(el.id==='ncs-positive'||el.id==='ncs-negative')changed();
        else{revision++;if(optionMap[el.id])$('ncs-size-preset').value=sizePresetOf(settings().options);updateFinal();}
        updatePresetState();
      }
    }catch(e){notice(e.message,true);}
  });
  $('ncs-import').addEventListener('change',event=>importSettings(event.target.files[0]).catch(e=>notice(e.message,true)));
}
function chatChanged() {
  const key=keyOf();if(key===chatKey)return;
  cancelExtraction('');chatKey=key;task++;revision++;scene=blankScene();raw='';finalOverride=null;optionsOverride=null;result=null;historyItems=[];historyTotal=0;historyHasMore=false;selectedIds.clear();
  if(dialog){renderTargets();renderMatching();renderScene();renderResult();renderHistory();$('ncs-chat-label').textContent=ctx().getCurrentChatId?.()??'열린 채팅 없음';notice('채팅이 바뀌었어요. 이 채팅의 연결·복장과 이력을 사용해요.');}
  renderChatImages();
}
async function open() {
  chatChanged();renderTargets();renderProfiles();renderScene();renderExtractionProfiles();
  if(!dialog.open)dialog.showModal();
  checkServer().catch(()=>{});
}
async function initialize() {
  if(document.getElementById('naice-shot-dialog'))return;
  settings();dialog=document.createElement('dialog');dialog.id='naice-shot-dialog';
  const template=await fetch(new URL('panel.html',import.meta.url));if(!template.ok)throw new Error('NAIce Shot 패널 파일을 읽지 못했어요.');
  dialog.innerHTML=await template.text();document.body.append(dialog);
  for(const tab of dialog.querySelectorAll('[data-tab]')){const icon=document.createElement('span');icon.className='ncs-tab-icon';icon.innerHTML=TAB_ICONS[tab.dataset.tab]??'';tab.prepend(icon);}
  $('ncs-version').textContent=`v${VERSION}`;setProfileMode(settings().profileInputMode,{save:false});renderSettings();renderProfiles();editProfile();renderTargets();bindEvents();chatKey=keyOf();renderProgress();renderScene();$('ncs-chat-label').textContent=ctx().getCurrentChatId?.()??'열린 채팅 없음';
  const holder=document.getElementById('extensions_settings2')??document.getElementById('extensions_settings');
  if(holder){const box=document.createElement('details');box.id='ncs-extension-settings';box.className='extension_container';box.innerHTML=`<summary>${CAMERA_ICON}<strong data-brand>${esc(brand())}</strong></summary><div class="ncs-extension-body"><p>프로필 · 장면 편집 · 이미지 생성</p><button type="button" class="menu_button ncs-launch-button">${CAMERA_ICON}<span>${esc(brand())} 열기</span></button></div>`;box.querySelector('button').addEventListener('click',()=>open().catch(e=>notice(e.message,true)));holder.append(box);}
  const menu=document.getElementById('extensionsMenu');if(menu){const button=document.createElement('div');button.className='list-group-item flex-container flexGap5 ncs-menu-item';button.innerHTML=`${CAMERA_ICON}<span data-brand>${esc(brand())}</span>`;button.tabIndex=0;button.setAttribute('role','button');button.addEventListener('click',()=>open().catch(e=>notice(e.message,true)));button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open().catch(e=>notice(e.message,true));}});menu.append(button);}
  renderBrand();
  // Apply the saved skin right away when it is the built-in one; file skins wait for detection.
  renderSkins();useSkin(skinById(settings().skin)?.file?DEFAULT_SKIN:settings().skin).catch(()=>{});
  detectSkins(new URL('./',import.meta.url).href).then(list=>{availableSkins=list;skinsDetected=true;return useSkin(settings().skin);}).catch(e=>console.warn('[NAIce Shot] skin detection failed',e?.message));
  const c=ctx(),events=c.eventTypes??c.event_types;c.eventSource.on(events.CHAT_CHANGED,chatChanged);
  const refreshChatImages=()=>renderChatImages();
  for(const type of ['MESSAGE_RECEIVED','MESSAGE_SENT','MESSAGE_SWIPED','MESSAGE_DELETED','MESSAGE_EDITED'])if(events[type])c.eventSource.on(events[type],()=>{refreshChatImages();if(dialog.open){renderTargets();renderMatching();renderResult();renderHistory();updateFinal();}});
  document.getElementById('chat')?.addEventListener('click',event=>{
    const clean=event.target.closest('[data-ncs-inline-clean]');
    if(clean){event.preventDefault();const id=clean.dataset.ncsInlineClean;clean.disabled=true;saveCleanImage({id,image:`/user/images/naice-shot/${id}.png`}).then(()=>say('메타데이터를 뺀 공유용 PNG를 저장했어요.'),()=>say('공유용 PNG를 저장하지 못했어요. 원본으로 대체 저장하지 않았어요.',true)).finally(()=>{clean.disabled=false;});return;}
    const open=event.target.closest('[data-ncs-inline-view]');
    if(open){event.preventDefault();event.stopPropagation();try{viewImage({id:open.dataset.ncsInlineView,image:`/user/images/naice-shot/${open.dataset.ncsInlineView}.png`});}catch(e){console.error('[NAIce Shot]',e.message);}return;}
    const button=event.target.closest('[data-ncs-inline-remove]');if(!button)return;
    const id=button.dataset.ncsInlineRemove,holder=button.closest('.ncs-inline-images');
    removeImageFromChat({id,image:`/user/images/naice-shot/${id}.png`,chatKey:holder.dataset.chatKey}).catch(e=>notice(e.message,true));
  });
  const chatRoot=document.getElementById('chat');
  if(chatRoot){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refreshChatImages();});}).observe(chatRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['mesid']});refreshChatImages();}
  for(const type of ['CONNECTION_PROFILE_CREATED','CONNECTION_PROFILE_UPDATED','CONNECTION_PROFILE_DELETED'])if(events[type])c.eventSource.on(events[type],()=>renderExtractionProfiles());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>initialize().catch(e=>console.error('[NAIce Shot]',e.message)),{once:true});
else initialize().catch(e=>console.error('[NAIce Shot]',e.message));
