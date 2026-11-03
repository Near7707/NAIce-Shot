import { DEFAULTS, MODELS, clone, PROFILE_SCHEMA, profileDraftPrompt, parseProfileDraft, blankScene, validateProfiles, sourceValid,
  assemble, resolveOutfit, buildPayload, costGuard, textSignature,
  BRAND, SIZE_PRESETS, sizePresetOf, VERSION, stripReasoningBlocks } from './core.mjs';
import { CAMERA_ICON, BRAND_ICON, TAB_ICONS } from './icons.mjs';
import { SKINS, DEFAULT_SKIN, detectSkins, applySkin, skinById, currentSkin } from './skins.mjs';
import { attachInlineImage, detachInlineImage, detachInlineImages, detachMessageImage, countInlineImages, hasInlineImage, imageDownload, renderInlineImages, SAVE_NOTES } from './inline-images.mjs';
import { matchChatProfiles, reconcileCharacters, attachSceneProfile, identityKey } from './matching.mjs';
import { freeScenePrompt, freeSceneSchema, parseFreeScene } from './free-scene.mjs';
import { momentExtractionPrompt, momentExtractionSchema, parseMoments, looksCut, foreignFields } from './scene-extraction.mjs';
import { isSceneMessage, isHiddenSceneMessage, chooseSceneMessages } from './scene-messages.mjs';
import { captureImagePreset, applyImagePreset, imagePresetModified, validateImagePresets } from './presets.mjs';
import { listExtractionProfiles, requestExtraction } from './extractor.mjs';
import { openImageViewer } from './viewer.mjs';
import { copyText } from './clipboard.mjs';
import {DraftQueue,packWork,unpackWork} from './draft-work.mjs';
import {saveMenu,downloadOriginal} from './download-choice.mjs';
import { genericizeScene } from './tags.mjs';
import { checkCompat } from './compat.mjs';
import { makeZip } from './zip.mjs';
import { mainPeopleOf, classifyMissing, descriptionFor, roleLabel, sourceLabel, exactName } from './missing.mjs';
import { cleanImageFile, saveCleanImage } from './downloads.mjs';

const KEY='naice_shot',API='/api/plugins/naice-shot';
// 챗샷 draws from the open chat; 프리샷 draws from free text with no chat at all. Each mode keeps its own work.
const FREE_KEY=JSON.stringify({free:true});
let mode='chat';
const isFree=()=>mode==='free';
// The key the current work belongs to: the open chat, or the shared 프리샷 bucket.
const workKey=()=>isFree()?FREE_KEY:keyOf();
let dialog,scene=blankScene(),raw='',finalOverride=null,revision=0,busy=false,task=0,subscription=null,historyItems=[],chatKey='',result=null,attaching=false;
let profileContext='profiles',busyOwner=0,extraction=null,progress=null,optionsOverride=null,historyTotal=0,historyHasMore=false,historyLoading=false;
const selectedIds=new Set(),HISTORY_PAGE=20;
let historyScope='chat',historyFilter='',historyChats=[],historyBytes=0,historyImageCount=0,historyRequest=0;
let availableSkins=SKINS.filter(s=>!s.file),skinsDetected=false;
let serverFeatures=[],draftsEnabled=false,draftLoading=false,pauseDraftCapture=false,draftLoadToken=0,draftSource=null,draftNote='';
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
  const c=ctx();
  // New users start with the recommended extraction values; existing users keep theirs (see "권장값 적용").
  if(!c.extensionSettings[KEY])c.extensionSettings[KEY]={...clone(DEFAULTS),extractionMaxTokens:RECOMMENDED_MAX_TOKENS,recent:1};
  const s=c.extensionSettings[KEY];for(const [k,v] of Object.entries(DEFAULTS))if(s[k]===undefined)s[k]=clone(v);
  // Noise Schedule is no longer offered: new generations always use the default (karras).
  s.options=freeOptions({...DEFAULTS.options,...s.options,scheduler:DEFAULTS.options.scheduler});s.version=VERSION;return s;
}
// Only NovelAI's free-sized choices: one of the three sizes and at most 28 steps. Anything else (old custom sizes,
// imported backups, history drafts) falls back to portrait / 28, so no one is charged Anlas for a size by accident.
const FREE_STEPS=28,RECOMMENDED_MAX_TOKENS=8192;
// Optional temperature for a separate extraction connection only; empty keeps the connection's own value.
const extractionTemperature=()=>{const t=settings().extractionTemperature;return typeof t==='number'&&Number.isFinite(t)&&t>=0&&t<=2?t:null;};
function freeOptions(o){
  const out={...o};if(sizePresetOf(out)==='custom'){out.width=SIZE_PRESETS.portrait.width;out.height=SIZE_PRESETS.portrait.height;}
  const steps=Number(out.steps);out.steps=Number.isFinite(steps)?Math.min(FREE_STEPS,Math.max(1,Math.round(steps))):DEFAULTS.options.steps;return out;
}
const imagePlacement=()=>settings().imagePlacement==='above'?'above':'below';
function renderChatImages(){renderInlineImages(ctx(),document.getElementById('chat'),keyOf(),{placement:imagePlacement()});if(messageButtonsOn())decorateMessages();}
// --- Message draw button: "메시지에 그리기 버튼 표시" (off by default) -------------------------------
// Off: no listener, no scan — the only cost is the boolean check above. On: one delegated listener on
// the chat and a pass that skips messages already decorated.
const messageButtonsOn=()=>settings().messageButton===true;
let messageClickBound=false;
function onMessageButton(event){
  const button=event.target.closest?.('.ncs-mes-draw');if(!button)return;
  if(event.type==='keydown'&&event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();event.stopPropagation();
  drawFromMessage(Number(button.closest('.mes')?.getAttribute('mesid'))).catch(e=>notice(e.message,true));
}
// Built once and cloned for every message.
let messageButtonNode=null;
function messageButtonTemplate(){
  if(messageButtonNode)return messageButtonNode;
  const button=document.createElement('div');button.className='mes_button ncs-mes-draw';button.title='NAIce Shot으로 그리기';
  button.setAttribute('role','button');button.setAttribute('aria-label','이 메시지로 NAIce Shot 그림 그리기');button.tabIndex=0;
  // The icon is one shared image (CSS background) on an inner box, so a long chat holds empty boxes, not a thousand
  // vector drawings, and themes that clear every .mes_button background cannot erase it.
  const icon=document.createElement('span');icon.className='ncs-mes-draw-icon';icon.setAttribute('aria-hidden','true');button.append(icon);
  document.documentElement.style.setProperty('--ncs-brand-icon-url',`url("data:image/svg+xml,${encodeURIComponent(BRAND_ICON)}")`);
  return messageButtonNode=button;
}
function decorateMessages(){
  const root=document.getElementById('chat');if(!root)return;const chat=ctx().chat??[];
  for(const el of root.querySelectorAll('.mes[mesid]')){
    const m=chat[Number(el.getAttribute('mesid'))],ok=isSceneMessage(m);
    const existing=el.querySelector('.ncs-mes-draw');
    if(!ok){existing?.remove();continue;}
    if(existing)continue;
    const holder=el.querySelector('.extraMesButtons');if(!holder)continue;
    holder.append(messageButtonTemplate().cloneNode(true)); // last in the row: themes that clip a crowded row cut from the start
  }
}
function setMessageButtons(on){
  const root=document.getElementById('chat');
  if(on){if(root&&!messageClickBound){root.addEventListener('click',onMessageButton,true);root.addEventListener('keydown',onMessageButton,true);messageClickBound=true;}decorateMessages();return;}
  if(root&&messageClickBound){root.removeEventListener('click',onMessageButton,true);root.removeEventListener('keydown',onMessageButton,true);}
  messageClickBound=false;for(const b of document.querySelectorAll('.ncs-mes-draw'))b.remove();
}
async function drawFromMessage(index){
  await (panelReady??Promise.resolve());
  if(busy||attaching||draftLoading){await open();notice('진행 중인 작업이 끝난 뒤 선택해 주세요.',true);return;}
  await open();showTab('scene');
  const m=ctx().chat?.[index];
  if(!Number.isInteger(index)||!isSceneMessage(m)){notice('이 메시지는 그림 대상으로 고를 수 없어요.',true);return;}
  chooseTarget(String(index),{reveal:true});
  notice(`#${index} 메시지를 대상으로 골랐어요. "장면 추출"을 눌러 진행해 주세요.`);
}
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
function outfitState() {return isFree()?{}:ctx().chatMetadata?.[KEY]?.outfits??{};} // 프리샷 never reads or changes chat clothes
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
const BUTTON_LABELS={extract:['extract','장면 추출'],generate:['generate','이미지 생성'],profile:['convert-profile','태그로 변환'],free:['free-fill','글로 채우기']};
function renderProgress() {
  if(!dialog)return;
  const box=$('ncs-progress');box.hidden=!progress;
  for(const [kind,[action,label]] of Object.entries(BUTTON_LABELS)){const b=dialog.querySelector(`[data-action="${action}"]`);if(b)b.textContent=progress?.kind===kind?`${label} 중…`:label;}
  if(!progress)return;
  const sec=Math.max(0,Math.floor((Date.now()-progress.started)/1000)),time=sec<60?`${sec}초`:`${Math.floor(sec/60)}분 ${sec%60}초`;
  box.dataset.kind=progress.kind;
  const retry=progress.attempt>1?' · 다시 요청 (2/2)':'';
  $('ncs-progress-title').textContent=progress.kind==='extract'?`장면 추출 중${retry}`:progress.kind==='free'?`글로 채우는 중${retry}`:progress.kind==='profile'?`프로필 태그 변환 중${retry}`:'NAI 이미지 생성 중';
  $('ncs-progress-detail').textContent=progress.kind==='generate'?`${time} 경과 · 이미 보낸 생성 요청은 중단할 수 없어요. 창을 닫거나 채팅을 바꿔도 서버가 결과를 저장해요.`:`${time} 경과 · 추출 AI 응답을 기다리고 있어요.`;
  $('ncs-progress-cancel').hidden=progress.kind==='generate';$('ncs-progress-cancel').textContent=progress.kind==='profile'?'변환 중단':progress.kind==='free'?'채우기 중단':'추출 중단';
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
async function promptForImage(item) {
  const cached=item.assembled?item:result?.id===item.id?result:historyItems.find(x=>x.id===item.id&&x.assembled);
  if(cached?.assembled)return promptText(cached);
  if(!item.chatKey)throw new Error('이 그림의 프롬프트를 찾을 수 없어요. 이력에서 다시 열어 주세요.');
  // Attachments store no prompt text. Read history only when the user opens the prompt disclosure.
  for(let offset=0;;){
    const page=await api(`/history?chatKey=${encodeURIComponent(item.chatKey)}&offset=${offset}&limit=100`);
    const records=page.items??[],found=records.find(x=>x.id===item.id);
    if(found?.assembled)return promptText(found);
    offset+=records.length;
    if(!records.length||page.hasMore===false||offset>=(page.total??offset))break;
  }
  throw new Error('이 그림의 프롬프트 기록을 찾을 수 없어요.');
}
// 2026. 10. 27. 오후 12:27 — minutes, no seconds.
function shortDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('ko-KR',{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});}
function viewImage(item,{attachment=null}={}) {
  if(!item)return;
  const caption=item.created?shortDate(item.created):'';
  openImageViewer(item,{caption,seed:item.seed,loadPrompt:()=>promptForImage(item),
    onDetach:attachment?()=>removeMessageImage(item,attachment):null,
    onDelete:attachment?null:()=>deleteImages({ids:[item.id],owners:item.chatKey?{[item.id]:item.chatKey}:null}).then(r=>!!r?.deleted?.includes(item.id),e=>{say(e.message,true);return false;})});
}
// Shared compact menus: top-layer popovers stay visible inside dialogs and near the chat viewport edge.
let imageMenu=null;
function closeImageMenu({focus=false}={}){
  if(!imageMenu)return;const {menu,button}=imageMenu;imageMenu=null;
  if(typeof menu.hidePopover==='function'&&menu.matches(':popover-open'))menu.hidePopover();menu.hidden=true;button.setAttribute('aria-expanded','false');
  if(focus&&button.isConnected)button.focus({preventScroll:true});
}
function toggleImageMenu(button){
  if(imageMenu?.button===button){closeImageMenu({focus:true});return;}
  closeImageMenu();const menu=document.getElementById(button.dataset.imageMore);if(!menu)return;
  menu.hidden=false;if(typeof menu.showPopover==='function')menu.showPopover();else menu.removeAttribute('popover');
  imageMenu={menu,button};button.setAttribute('aria-expanded','true');
  positionImageMenu();
  menu.querySelector('button:not(:disabled),a')?.focus({preventScroll:true});
}
function positionImageMenu(){
  if(!imageMenu)return;const {menu,button}=imageMenu;
  if(!button.isConnected){closeImageMenu();return;}
  const r=button.getBoundingClientRect(),m=menu.getBoundingClientRect(),pad=8;
  const start=button.classList.contains('ncs-save-toggle')?r.left:r.right-m.width; // 저장 opens under itself, ⋯ toward the left
  menu.style.left=`${Math.max(pad,Math.min(start,innerWidth-m.width-pad))}px`;
  // Below the button when it fits, otherwise above it, so the menu never covers its own button.
  const below=r.bottom+4,above=r.top-4-m.height,top=below+m.height<=innerHeight-pad||above<pad?below:above;
  menu.style.top=`${Math.max(pad,Math.min(top,innerHeight-m.height-pad))}px`;
}
function bindImageMenus(){
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-image-more]');
    if(button){event.preventDefault();event.stopPropagation();toggleImageMenu(button);return;}
    if(imageMenu&&(!imageMenu.menu.contains(event.target)||event.target.closest('button,a')))closeImageMenu();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&imageMenu){event.preventDefault();event.stopPropagation();closeImageMenu({focus:true});}
  },true);
  document.addEventListener('focusin',event=>{if(imageMenu&&!imageMenu.menu.contains(event.target)&&!imageMenu.button.contains(event.target))closeImageMenu();});
  document.addEventListener('scroll',event=>{if(imageMenu&&!imageMenu.menu.contains(event.target))positionImageMenu();},true);
  window.addEventListener('resize',()=>closeImageMenu());
}
function attachmentOf(element){
  const index=Number(element.closest('.mes')?.getAttribute('mesid')),message=ctx().chat?.[index];
  return {message,swipeId:message?.swipe_id??0,signature:textSignature(message?.mes??''),chatKey:keyOf()};
}
async function removeMessageImage(item,attachment){
  if(busy||attaching)throw new Error('진행 중인 작업이 끝난 뒤 그림을 빼 주세요.');
  if(ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 그림을 빼 주세요.');
  const context=ctx(),startKey=attachment.chatKey;
  attaching=true;updateAttachButtons();
  try{
    await detachMessageImage(context,item,{...attachment,isCurrent:()=>keyOf()===startKey});
    if(keyOf()===startKey){renderChatImages();renderResult();renderHistory();}
    say('이 메시지에서 그림을 뺐어요. 원본과 생성 이력은 그대로예요.');return true;
  }finally{attaching=false;updateAttachButtons();}
}
function say(message,error=false) {
  // The panel may be closed when deleting from the chat viewer; fall back to ST's toast.
  if(dialog?.open||!globalThis.toastr)notice(message,error);
  else globalThis.toastr[error?'error':'success'](message,brand());
}
function changed(){revision++;finalOverride=null;optionsOverride=null;dropUndo();updateFinal({force:true});scheduleDraft();}
// History restore uses the stored options for the next generation only; the settings tab keeps the user's own values.
function effectiveOptions(){return optionsOverride?freeOptions(optionsOverride):settings().options;}
function setBusy(value,owner=0) {busy=value;busyOwner=value?owner:0;for(const b of dialog.querySelectorAll('[data-action="extract"],[data-action="free-fill"],[data-mode],[data-history-free],[data-action="generate"],[data-action="blank"],[data-action="same-seed"],[data-action="new-seed"],[data-action="convert-profile"]'))b.disabled=value;updateAttachButtons();if(!value)rememberDraft();}
async function api(route,{method='GET',body,keepalive=false,signal}={}) {
  const response=await fetch(`${API}${route}`,{method,headers:ctx().getRequestHeaders(),body:body?JSON.stringify(body):undefined,keepalive,signal});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`서버 플러그인을 확인해 주세요 (${response.status}).`);}
  if(!response.ok||data.error){const error=new Error(data.error??`요청 실패 (${response.status})`);error.status=response.status;throw error;}return data;
}
const draftSignal=()=>globalThis.AbortSignal?.timeout?.(15000);
const drafts=new DraftQueue({read:key=>api(`/draft?chatKey=${encodeURIComponent(key)}`,{signal:draftSignal()}),
  write:(key,body)=>{const value={...body,chatKey:key,retainRawExtraction:settings().retainRawExtraction===true};return api('/draft',{method:'POST',body:value,keepalive:new Blob([JSON.stringify(value)]).size<60000,signal:draftSignal()});},onState:()=>renderDraftState()});
let captureTimer=null;
function scheduleDraft(){clearTimeout(captureTimer);captureTimer=null;if(draftsEnabled){captureTimer=setTimeout(()=>rememberDraft(),450);renderDraftState();}}
function renderRawRetention(){if(dialog)$('ncs-retain-state').textContent=settings().retainRawExtraction===true?'켜짐 · 추출 응답 보관 중':'꺼짐 · 추출 응답은 보관하지 않아요.';}
function renderDraftState(){
  if(!dialog)return;const e=drafts.entry(workKey()),box=$('ncs-draft-status');
  if(!draftsEnabled){box.hidden=!compatChecked;box.textContent='작업 기억을 사용할 수 없어요. 서버 연결·업데이트를 확인해 주세요.';$('ncs-draft-retry').hidden=!compatChecked;$('ncs-draft-retry').textContent='연결 다시 확인';return;}
  box.hidden=!draftsEnabled;box.textContent=draftLoading?'마지막 작업을 불러오는 중…':e.error?`작업 저장을 확인해 주세요: ${e.error.message}`:e.saving||e.dirty||captureTimer?'마지막 작업 저장 중…':draftNote||'마지막 작업을 서버에 기억해요.';
  $('ncs-draft-retry').hidden=!draftsEnabled||!e.error;
  $('ncs-draft-retry').textContent=e.error?.status===409?'서버 작업 다시 불러오기':'다시 시도';
}
const emptyWork=w=>!w.scene.characters?.length&&!w.scene.moments?.length&&!['location','lighting','camera','interaction'].some(k=>w.scene[k])&&
  !w.finalOverride&&!w.optionsOverride&&!w.result&&!w.undoClear&&!w.raw&&!w.target&&!w.wish&&!w.freeText;
function rememberDraft(key=workKey(),work=null,{flush=false}={}){
  clearTimeout(captureTimer);captureTimer=null;
  if(!draftsEnabled||!key||draftLoading||pauseDraftCapture)return;
  try{const packed=packWork(work??captureWork(),{retainRaw:settings().retainRawExtraction===true}),e=drafts.entry(key);
    if(e.loaded&&e.data===null&&emptyWork(packed))return; // nothing saved and nothing to save: no empty file
    drafts.put(key,packed);if(flush)drafts.flush(key);}
  catch(e){drafts.entry(key).error=e;}finally{renderDraftState();}
}
async function recallDraft(key=workKey()){
  if(!draftsEnabled||!key)return;
  const token=++draftLoadToken;draftLoading=true;draftNote='';$('ncs-work-fields').disabled=true;renderDraftState();
  try{
    const data=await drafts.ensure(key);if(token!==draftLoadToken||key!==workKey())return;
    if(data){loadWork(unpackWork(packWork(data,{retainRaw:settings().retainRawExtraction===true})));
      const stale=!isFree()&&(!sourceValid(scene.source,ctx().chat)||!sourceValid(draftSource,ctx().chat));
      if(stale){$('ncs-target').value='';$('ncs-moment-wish').value='';}
      const target=isFree()?'':$('ncs-target').value,where=isFree()?'':target===''?' · 대상 메시지: 최신':` · 대상 메시지 #${target}`;
      draftNote=stale?'이 채팅에서 작업하던 장면을 불러왔어요. 원문이나 리롤이 바뀌었으니 대상과 프롬프트를 다시 확인해 주세요.':isFree()?'프리샷에서 작업하던 장면을 불러왔어요. AI를 다시 호출하지 않았어요.':`이 채팅에서 작업하던 장면을 불러왔어요${where}`;
    }
    renderTargets();renderScene({forceFinal:true});renderResult();renderUndo();
  }catch(e){if(token===draftLoadToken)draftNote='작업을 불러오지 못했어요. 다시 시도해 주세요.';}
  finally{if(token===draftLoadToken){draftLoading=false;$('ncs-work-fields').disabled=false;renderDraftState();}}
}
async function retryDraft(){
  if(!draftsEnabled){await checkServer({force:true});return;}
  const key=workKey(),e=drafts.entry(key);
  if(e.error?.status===409){if(!confirm('서버에 저장된 작업을 다시 불러올까요? 현재 화면의 저장되지 않은 편집은 바뀌어요.'))return;drafts.entries.delete(key);await recallDraft(key);}
  else if(!e.loaded){if((scene.characters.length||['location','lighting','camera','interaction'].some(k=>scene[k])||$('ncs-free-text').value)&&!confirm('서버 작업을 다시 불러오면 현재 화면의 편집이 바뀔 수 있어요. 불러올까요?'))return;await recallDraft(key);}else await drafts.flush(key);
}
// Each tab owns its last position for this page session. Never record the zero
// geometry of a closed dialog; showModal's focus step may also move the viewport.
const tabScroll=new Map();
function rememberScroll() {
  rememberTargetScroll();
  if(dialog?.open)tabScroll.set(activeTab(),dialog.querySelector('.ncs-content').scrollTop);
}
function restoreScroll() {
  if(dialog?.open)dialog.querySelector('.ncs-content').scrollTop=tabScroll.get(activeTab())??0;
  restoreTargetScroll();
}
function showTab(tab) {
  rememberScroll();
  if(tab==='profiles'&&profileContext==='scene')placeProfileForm('profiles'); // keep what was typed, show it in the profile tab
  for(const el of dialog.querySelectorAll('[data-page]'))el.hidden=el.dataset.page!==tab;
  for(const el of dialog.querySelectorAll('[data-tab]'))el.classList.toggle('ncs-active',el.dataset.tab===tab);
  for(const el of dialog.querySelectorAll('[data-tab]'))el.setAttribute('aria-selected',String(el.dataset.tab===tab));
  restoreScroll();
  if(tab==='history')loadHistory().catch(e=>notice(e.message,true));
}
// Target picker: looks like a dropdown, opens into a short scrolling list (newest first) that grows
// ten messages at a time. Nothing is built while it is closed.
const TARGET_STEP=10;
let targetShown=TARGET_STEP,targetScroll=0,targetReveal=false,targetListRendered=false;
const targetVisible=()=>dialog?.open&&activeTab()==='scene'&&$('ncs-target-picker').open;
function rememberTargetScroll() {
  // Collapsing details or closing the panel exposes zero geometry, not a new position.
  if(targetVisible()&&targetListRendered)targetScroll=$('ncs-target-scroll').scrollTop;
}
function restoreTargetScroll() {
  if(!targetVisible()||!targetListRendered)return;
  const box=$('ncs-target-scroll');
  if(targetReveal){const on=box.querySelector('[aria-pressed="true"]');if(on)targetScroll=Math.max(0,on.offsetTop-box.offsetTop-8);targetReveal=false;}
  box.scrollTop=targetScroll;targetScroll=box.scrollTop;
}
function renderTargets() {
  rememberTargetScroll();
  const chat=ctx().chat??[],select=$('ncs-target'),rows=[];
  // Keep only indices here: format previews for the rows actually shown, never every message.
  for(let i=chat.length-1;i>=0;i--)if(isSceneMessage(chat[i]))rows.push(i);
  if(select.value!==''&&!rows.includes(Number(select.value)))select.value='';
  const text=i=>chat[i].mes.replace(/\s+/g,' ').trim(),hidden=i=>isHiddenSceneMessage(chat[i])?' · 숨김':'';
  $('ncs-target-label').textContent=select.value===''?'가장 최근 메시지':`#${select.value} · ${chat[select.value].name??''}${hidden(Number(select.value))} · ${text(Number(select.value)).slice(0,55)}`;
  // Make sure the chosen message is among the shown rows, so its check mark is visible when the list opens.
  const at=select.value===''?-1:rows.indexOf(Number(select.value));
  targetShown=Math.max(TARGET_STEP,targetShown,at>=0?Math.ceil((at+1)/TARGET_STEP)*TARGET_STEP:0);
  const shown=rows.slice(0,targetShown),left=rows.length-shown.length;
  $('ncs-target-page').textContent=rows.length?`최신순 · ${rows.length}개 중 ${shown.length}개 표시`:'선택할 메시지가 없어요';
  const more=dialog.querySelector('[data-action="target-more"]');more.hidden=left<=0;more.textContent=`이전 메시지 ${Math.min(TARGET_STEP,left)}개 더 보기`;
  if(!$('ncs-target-picker').open){targetListRendered=false;$('ncs-target-list').innerHTML='';return;}
  const latest=`<button type="button" class="ncs-target-item" data-action="target-latest" aria-pressed="${select.value===''}"><span class="ncs-target-meta">가장 최근 메시지</span><span class="ncs-target-preview">숨기지 않은 최근 메시지를 따라가요</span></button>`;
  $('ncs-target-list').innerHTML=latest+shown.map(i=>`<button type="button" class="ncs-target-item" data-action="target-message" data-message-index="${i}" aria-pressed="${select.value===String(i)}"><span class="ncs-target-meta">#${i} · ${esc(chat[i].name??'')}${hidden(i)}</span><span class="ncs-target-preview">${esc(text(i).slice(0,90))}</span></button>`).join('');
  targetListRendered=true;restoreTargetScroll();
}
function chooseTarget(value,{reveal=false}={}) {
  dropUndo();
  rememberTargetScroll();targetReveal=reveal;if(value==='')targetScroll=0;
  if($('ncs-target').value!==value)$('ncs-moment-wish').value=''; // a wished moment belongs to the message it was written for
  $('ncs-target').value=value;$('ncs-target-picker').open=false;renderTargets();$('ncs-target-label').focus({preventScroll:true});
  const m=ctx().chat?.[Number(value)];draftSource=value!==''&&m?{fingerprints:[{index:Number(value),swipeId:m.swipe_id??0,signature:textSignature(m.mes)}]}:null;
  rememberDraft();
}
// --- Work per mode (챗샷 / 프리샷), clearing and undo --------------------------------------------------
// The active mode's work lives in the usual variables; the other mode's work waits in `spare`.
const spare={};
let undoClear=null;
const blankWork=()=>({scene:blankScene(),raw:'',finalOverride:null,optionsOverride:null,restoredFinal:null,result:null,undoClear:null,target:'',wish:'',freeText:''});
function captureWork(){return {scene,raw,finalOverride,optionsOverride,restoredFinal,result,undoClear,target:$('ncs-target').value,wish:$('ncs-moment-wish').value,freeText:$('ncs-free-text').value,targetSource:draftSource,targetShown,finalText:$('ncs-final').value};}
function loadWork(w){
  ({scene,raw,finalOverride,optionsOverride,restoredFinal,result,undoClear}=w);
  $('ncs-target').value=w.target??'';$('ncs-moment-wish').value=w.wish??'';$('ncs-free-text').value=w.freeText??'';
  draftSource=w.targetSource??null;targetShown=w.targetShown??TARGET_STEP;if(w.finalOverride?.invalid)$('ncs-final').value=w.finalText??'';
  lastLink=null;linkTarget=null;wardrobeTarget=null;pendingTempConvert=null;
}
function renderModeUI(){
  if(!dialog)return;const free=isFree();
  for(const b of dialog.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  $('ncs-chat-source').hidden=free;$('ncs-free-source').hidden=!free;
  $('ncs-source-title').textContent=free?'1 · 그릴 장면':'1 · 그릴 순간';
  dialog.querySelector('[data-history-scope="chat"]').textContent=free?'프리샷':'이 채팅';
  dialog.dataset.workMode=mode;renderUndo();
}
async function setMode(next){
  if(next===mode)return;if(busy||attaching||draftLoading)throw new Error('진행 중인 작업이 끝난 뒤 바꿔 주세요.');
  rememberDraft(workKey(),null,{flush:true});rememberScroll();spare[mode]=captureWork();mode=next;loadWork(spare[mode]??blankWork());delete spare[mode];
  historyItems=[];historyTotal=0;historyHasMore=false;selectedIds.clear();historyPresetTarget=null;
  revision++;renderModeUI();renderTargets();renderScene({forceFinal:true});renderResult();if(activeTab()==='history')loadHistory().catch(e=>notice(e.message,true));
  notice(isFree()?'프리샷이에요. 채팅과 상관없이 자유롭게 그려요.':'챗샷이에요. 열린 채팅의 장면을 그려요.');
  await recallDraft();
}
function renderUndo(){
  if(!dialog)return;const box=$('ncs-undo-clear');box.hidden=!undoClear;
  if(undoClear)box.innerHTML=`<span>${esc(undoClear.label??'이번 작업을 비웠어요. 공통 프롬프트와 기본 설정은 유지돼요.')}</span><button type="button" data-action="undo-clear">되돌리기</button>`;
}
// One undo belongs to the saved work; edits, extraction and generation end it, while chat/tab switches keep it.
function dropUndo(){if(undoClear){undoClear=null;renderUndo();}}
function clearWork(){
  if(busy||attaching)throw new Error('진행 중인 작업이 끝난 뒤 비워 주세요.');
  const before={...captureWork(),targetShown,undoClear:null};
  scene=blankScene();draftSource=null;raw='';finalOverride=null;optionsOverride=null;restoredFinal=null;result=null;lastLink=null;linkTarget=null;wardrobeTarget=null;pendingTempConvert=null;
  if(isFree())$('ncs-free-text').value='';else{$('ncs-moment-wish').value='';$('ncs-target').value='';$('ncs-target-picker').open=false;targetScroll=0;targetShown=TARGET_STEP;renderTargets();}
  revision++;undoClear=before;renderScene({forceFinal:true});renderResult();renderUndo();
  rememberDraft();
  notice('이번 작업을 비웠어요. 공통 프롬프트와 기본 설정은 유지돼요.');
}
// Everything comes back together: people, scene, candidates, target, final prompt, one-off options, preview.
function undoClearWork(){
  const w=undoClear;if(!w)return;if(busy||attaching)throw new Error('진행 중인 작업이 끝난 뒤 되돌려 주세요.');
  loadWork({...w,undoClear:null});targetShown=w.targetShown??TARGET_STEP;
  revision++;renderTargets();renderScene({forceFinal:true});renderResult();renderUndo();notice('비우기 전으로 되돌렸어요.');
  rememberDraft();
}
// After saved work was deleted on the server: empty the drawing window (no undo) and remember that as saved.
async function forgetWork(keys){
  const here=keys.includes(workKey());
  // Work waiting off screen (the other mode) is emptied too, so switching back cannot bring it back.
  if(isFree()&&keys.includes(chatKey))delete spare.chat;
  if(!isFree()&&keys.includes(FREE_KEY))delete spare.free;
  if(here){loadWork(blankWork());targetShown=TARGET_STEP;targetScroll=0;draftSource=null;revision++;
    renderTargets();renderScene({forceFinal:true});renderResult();renderUndo();}
  for(const key of keys)drafts.reset(key);
  // The open work reads the server's deletion marker now; other chats read it when they are opened again.
  if(here)await drafts.ensure(workKey()).catch(()=>{});
}
// Deleting saved work: lock the drawing window, let saves already sent finish (later ones are dropped), delete,
// then forget. Server requests of one user run in order, so nothing sent before can recreate the work.
async function whileDeletingWork(keys,remove,forgetKeys=()=>keys){
  pauseDraftCapture=true;clearTimeout(captureTimer);captureTimer=null;const fields=$('ncs-work-fields'),wasDisabled=fields.disabled;fields.disabled=true;
  try{
    await drafts.quiesce(keys);
    const response=await remove();
    const gone=forgetKeys(response);if(gone?.length)await forgetWork(gone);
    return response;
  }finally{pauseDraftCapture=false;fields.disabled=wasDisabled;renderDraftState();}
}
async function deleteAllWork(){
  if(busy||attaching||draftLoading)throw new Error('진행 중인 작업이 끝난 뒤 지워 주세요.');
  if(!confirm('저장된 작업을 모두 지울까요?\n채팅별·프리샷의 마지막 작업 기억이 서버에서 지워지고 되돌릴 수 없어요. 지금 그리기창도 비워져요.\n그림 이력·프로필·설정은 그대로예요.'))return;
  const r=await whileDeletingWork(null,()=>api('/draft',{method:'POST',body:{delete:true,all:true}}),()=>{
    for(const k of Object.keys(spare))delete spare[k];
    return [...new Set([...drafts.entries.keys(),workKey(),chatKey,FREE_KEY].filter(Boolean))];});
  notice(`저장된 작업 ${r.deleted??0}개를 지웠어요. 그림 이력은 그대로예요.`);
}
const skinTargets=()=>[dialog,document.getElementById('ncs-viewer')];
function renderSkins() {
  if(!dialog)return;const chosen=settings().skin;
  $('ncs-skins').innerHTML=availableSkins.map(s=>`<label class="ncs-skin${s.id===chosen?' ncs-selected':''}"><input type="radio" name="ncs-skin" value="${esc(s.id)}" ${s.id===chosen?'checked':''}><span class="ncs-skin-swatch" aria-hidden="true">${s.swatch.map(c=>`<span style="background:${esc(c)}"></span>`).join('')}</span><strong>${esc(s.name)}</strong><small>${esc(s.note)}</small></label>`).join('');
}
async function useSkin(id,{save=false}={}) {
  const base=new URL('./',import.meta.url).href,wanted=availableSkins.some(s=>s.id===id)?id:DEFAULT_SKIN;
  const applied=await applySkin(wanted,base,{targets:skinTargets});
  if(applied.stale)return currentSkin(); // a newer choice replaced this one while it loaded
  const s=settings();
  if(save||(skinsDetected&&applied.id!==s.skin)){s.skin=applied.id;ctx().saveSettingsDebounced();}
  renderSkins();
  const missing=skinsDetected&&id!==applied.id;
  // The folded card shows only the current theme's colors; its name is for screen readers and the tooltip.
  const now=skinById(applied.id),cur=$('ncs-theme-current');cur.innerHTML=(now?.swatch??[]).map(c=>`<span style="background:${esc(c)}"></span>`).join('');
  cur.setAttribute('aria-label',`지금 테마: ${now?.name??''}`);cur.title=now?.name??'';
  $('ncs-skin-state').textContent=missing?`${skinById(id)?.name??id} 테마 파일을 찾지 못해 기본으로 바꿨어요.`:'';
  if(missing&&save)notice($('ncs-skin-state').textContent,true);
  return applied.id;
}
function renderSettings() {
  const s=settings();
  $('ncs-model').innerHTML=Object.entries(MODELS).map(([id,m])=>`<option value="${id}">${m.label}</option>`).join('');
  for(const [id,k] of [['positive','positive'],['negative','negative'],['recent','recent'],['format','format']])$(`ncs-${id}`).value=s[k];
  for(const [id,k] of [['model','model'],['steps','steps'],['scale','scale'],['seed','seed'],['cfg','cfgRescale'],['sampler','sampler']])$(`ncs-${id}`).value=s.options[k];
  renderRawRetention();
  $('ncs-include-user').checked=s.includeUser;$('ncs-schema').checked=s.structuredOutput;$('ncs-retain-raw').checked=s.retainRawExtraction===true;$('ncs-allow-anlas').checked=s.allowAnlas;
  $('ncs-image-placement').value=imagePlacement();$('ncs-message-button').checked=messageButtonsOn();$('ncs-size-preset').value=sizePresetOf(s.options);renderBrand();
  renderImagePresets();renderExtractionProfiles();$('ncs-extraction-max-tokens').value=s.extractionMaxTokens;$('ncs-extraction-temperature').value=extractionTemperature()??'';
}
// --- Generation settings box in the scene tab: the same values as the settings tab, edited in place.
// While options restored from history are in use, edits go to that one-off copy instead.
const GEN_FIELDS=['model','steps','scale','seed','cfgRescale','sampler'];
let genNaming=false;
function renderGenBox() {
  if(!dialog)return;const o=effectiveOptions(),history=!!optionsOverride,s=settings();
  const model=dialog.querySelector('[data-gen="model"]');if(!model.options.length)model.innerHTML=Object.entries(MODELS).map(([id,m])=>`<option value="${id}">${m.label}</option>`).join('');
  for(const k of GEN_FIELDS){const el=dialog.querySelector(`[data-gen="${k}"]`);if(el&&document.activeElement!==el)el.value=o[k];}
  const size=sizePresetOf(o);dialog.querySelector('[data-gen="size"]').value=size==='custom'?'portrait':size;
  $('ncs-gen-scope').textContent=history?'이력 설정 · 이번 생성에만':'기본 생성 설정 · 다음 생성에도 유지';
  $('ncs-gen-scope').classList.toggle('ncs-gen-history',history);$('ncs-gen-override').hidden=!history;$('ncs-gen-note').hidden=history;
  $('ncs-gen-line').textContent=` · ${MODELS[o.model]?.label??o.model} · ${SIZE_PRESETS[size]?.label.split(' · ')[0]??'세로'} ${o.width}×${o.height} · ${o.steps}스텝 · Guidance ${o.scale} · ${o.seed===-1?'새 seed':`seed ${o.seed}`}`;
  const p=s.imagePresets.find(p=>p.id===s.imagePresetId),over=dialog.querySelector('[data-action="gen-preset-overwrite"]');
  $('ncs-gen-presets').hidden=history;
  over.hidden=!p;if(p)over.textContent=`‘${p.name}’에 덮어쓰기`;
  $('ncs-gen-preset-state').textContent=p?(imagePresetModified(s)?`프리셋 ‘${p.name}’에서 수정됨 · 저장본은 그대로예요.`:`프리셋 ‘${p.name}’ 그대로예요.`):'프리셋을 고르지 않았어요. 지금 값을 새 프리셋으로 저장할 수 있어요.';
  $('ncs-gen-preset-namebox').hidden=!genNaming;
}
function editGenField(el) {
  dropUndo();
  const key=el.dataset.gen,target=optionsOverride??settings().options;
  if(key==='size'){const p=SIZE_PRESETS[el.value];if(!p)return;target.width=p.width;target.height=p.height;}
  else{let v=el.type==='number'?Number(el.value):el.value;if(el.type==='number'&&(el.value===''||!Number.isFinite(v)))return;if(key==='steps'&&v>FREE_STEPS){v=FREE_STEPS;el.value=FREE_STEPS;}target[key]=v;}
  revision++;
  if(!optionsOverride){ctx().saveSettingsDebounced();
    // Keep the settings tab showing the same values.
    $('ncs-size-preset').value=sizePresetOf(settings().options);for(const [id,k] of [['model','model'],['steps','steps'],['scale','scale'],['seed','seed'],['cfg','cfgRescale'],['sampler','sampler']])$(`ncs-${id}`).value=settings().options[k];}
  updateFinal();renderGenBox();
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
  $('ncs-preset-save-hint').textContent=p?`프리셋 저장: 선택한 "${p.name}"에 지금 값을 덮어써요. 새 프리셋으로 저장: 지금 값을 이름을 붙여 따로 저장해요.`:'프리셋 저장: 지금 값을 입력한 이름으로 새로 저장해요.';
  dialog.querySelector('[data-action="delete-preset"]').disabled=!p;
  renderGenBox();
}
function saveImagePreset(overwrite=false,typedName=null) {
  const s=settings(),name=(typedName??$('ncs-common-preset-name').value).trim(),old=overwrite?s.imagePresets.find(p=>p.id===s.imagePresetId):null;
  if(!name)throw new Error('저장할 이름을 입력해 주세요.');
  if(overwrite&&!old)throw new Error('덮어쓸 프리셋을 먼저 선택해 주세요.');
  if(s.imagePresets.some(p=>p.id!==old?.id&&p.name.toLowerCase()===name.toLowerCase()))throw new Error('같은 이름의 프리셋이 있어요. 다른 이름으로 저장하거나 해당 프리셋을 선택해 덮어써 주세요.');
  const id=old?.id??uuid(),p=captureImagePreset(s,id,name);
  s.imagePresets=validateImagePresets([...s.imagePresets.filter(p=>p.id!==id),p]);s.imagePresetId=id;
  ctx().saveSettingsDebounced();renderImagePresets();notice(overwrite?`"${name}" 프리셋에 지금 값을 저장했어요.`:`지금 값을 새 프리셋 "${name}"(으)로 저장했어요.`);
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
let profileFormSession=0,quickProfileName='';
function editProfile(id='') {
  profileFormSession++;quickProfileName='';
  const p=settings().profiles.find(p=>p.id===id)??{id:'',name:'',aliases:[],subject:'boy',appearance:'',defaultOutfit:'',positive:'',negative:'',cardKey:''};
  for(const [key,field] of [['id','id'],['name','name'],['subject','subject'],['appearance','appearance'],['outfit','defaultOutfit'],['positive','positive'],['negative','negative']])$(`ncs-profile-${key}`).value=p[field];
  $('ncs-profile-aliases').value=p.aliases.join(', ');$('ncs-binding').textContent=p.cardKey?`연결된 카드: ${p.cardKey}`:'연결된 카드 없음';$('ncs-binding').dataset.cardKey=p.cardKey;
  $('ncs-profile-editing').textContent=p.id?`${p.name} 프로필 편집 중`:'새 프로필 작성 중';$('ncs-profile-describe').value='';
  renderWardrobeForm(p.wardrobe??[]);
  for(const el of dialog.querySelectorAll('[data-profile]')){const active=el.dataset.profile===p.id;el.classList.toggle('ncs-selected',active);el.setAttribute('aria-pressed',String(active));}
}
// --- Wardrobe (옷장) in the profile form ------------------------------------------------------------
function wardrobeRow(w){return `<div class="ncs-wardrobe-item" data-wardrobe-id="${esc(w.id)}"><div class="ncs-wardrobe-head"><input data-w="name" maxlength="80" placeholder="옷 이름 · 예: 잠옷" value="${esc(w.name)}" aria-label="옷 이름"><button type="button" data-action="wardrobe-remove">빼기</button></div><textarea data-w="outfit" rows="2" placeholder="예: pajamas, slippers" aria-label="옷 태그">${esc(w.outfit)}</textarea></div>`;}
function renderWardrobeForm(list){$('ncs-wardrobe-list').innerHTML=list.length?list.map(wardrobeRow).join(''):'<small class="ncs-wardrobe-empty">아직 옷장이 비어 있어요.</small>';}
function addWardrobeRow(w={id:uuid(),name:'',outfit:''}){
  const box=$('ncs-wardrobe-list');box.querySelector('.ncs-wardrobe-empty')?.remove();box.insertAdjacentHTML('beforeend',wardrobeRow(w));return box.lastElementChild;
}
// Empty rows are dropped silently; a row with only a name or only tags is an error the user should see.
function readWardrobeForm(){
  return [...$('ncs-wardrobe-list').querySelectorAll('.ncs-wardrobe-item')].map(row=>({id:row.dataset.wardrobeId,name:row.querySelector('[data-w="name"]').value,outfit:row.querySelector('[data-w="outfit"]').value}))
    .filter(w=>w.name.trim()||w.outfit.trim());
}
function saveProfile() {
  const s=settings(),id=$('ncs-profile-id').value||uuid(),draftName=quickProfileName;
  const p={id,name:$('ncs-profile-name').value,aliases:$('ncs-profile-aliases').value.split(',').map(x=>x.trim()).filter(Boolean),
    subject:$('ncs-profile-subject').value,appearance:$('ncs-profile-appearance').value,defaultOutfit:$('ncs-profile-outfit').value,
    positive:$('ncs-profile-positive').value,negative:$('ncs-profile-negative').value,cardKey:$('ncs-binding').dataset.cardKey??'',wardrobe:readWardrobeForm()};
  const bind=pendingBind&&pendingBind.session===profileFormSession&&pendingBind.chatKey===keyOf()?pendingBind:null;
  const fromTemp=pendingTempConvert&&pendingTempConvert.session===profileFormSession&&pendingTempConvert.chatKey===keyOf();
  if(bind&&(bind.role==='character'||bind.role==='member')&&bind.avatar&&!p.cardKey&&!s.profiles.some(x=>x.id!==id&&x.cardKey===bind.avatar))p.cardKey=bind.avatar;
  const next=s.profiles.filter(p=>p.id!==id);next.push(p);s.profiles=validateProfiles(next);ctx().saveSettingsDebounced();
  pendingBind=null; // only after the profile was accepted, so fixing a validation error keeps the planned link
  if(bind?.role==='user')setChatBinding('userProfileId',id);
  editProfile(id);renderProfiles();renderScene();changed();
  if(profileContext==='scene'){
    if(fromTemp)convertTemp(s.profiles.find(x=>x.id===id));
    const saved=s.profiles.find(x=>x.id===id),{restored}=attachSceneProfile(scene,saved,[draftName,...profileSceneNames(saved)]);
    placeProfileForm('profiles');changed();renderScene();notice(`${saved.name} 프로필을 저장하고 장면에 넣었어요.${restored?' 추출해 둔 표정·행동·복장도 채웠어요.':' 장면 정보가 비어 있으면 장면 추출을 다시 눌러 확인할 수 있어요.'}`);
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
  editProfile();quickProfileName=name;if(name)$('ncs-profile-name').value=name;
  placeProfileForm('scene');if(dialog.querySelector('[data-tab="scene"]').getAttribute('aria-selected')!=='true')showTab('scene');
  $('ncs-scene-profile-slot').scrollIntoView({block:'nearest'});
  (settings().profileInputMode==='direct'||!name?$('ncs-profile-name'):$('ncs-profile-describe')).focus({preventScroll:true});
}
// --- People left out of the image (no profile) -------------------------------------------------
let pendingBind=null,linkTarget=null,missingPrompt=null,lastLink=null;
const SOURCE_NOTE=source=>`${source}에서 만들기: ${source} 설명 원문 앞부분(최대 4,000자)을 추출 AI로 보내 외형·복장 태그로 바꿔요. 보통 1회, 응답을 읽지 못하면 한 번 더(최대 2회) 호출해요. 결과를 확인한 뒤 저장해 주세요.`;
function missingState(){return classifyMissing(scene.unregistered??[],keyOf()&&!isFree()?mainPeopleOf(ctx()):[]);}
function chatBinding(field){return chatBindings()[field]??'';}
function setChatBinding(field,id){
  const context=ctx();if(!keyOf())return;context.chatMetadata[KEY]??={};context.chatMetadata[KEY].bindings??={};
  if(id)context.chatMetadata[KEY].bindings[field]=id;else delete context.chatMetadata[KEY].bindings[field];
  revision++;context.saveMetadata().catch(e=>notice(e.message,true));
}
const skipMissingWarning=()=>ctx().chatMetadata?.[KEY]?.skipMissingWarning===true;
function setSkipMissingWarning(value){
  const c=ctx();if(!keyOf())return;c.chatMetadata[KEY]??={};
  if(value)c.chatMetadata[KEY].skipMissingWarning=true;else delete c.chatMetadata[KEY].skipMissingWarning;
  c.saveMetadata().catch(e=>notice(e.message,true));
}
// Profiles other than `except` that already use this name or alias; linking would make matching ambiguous.
const nameOwners=(name,except='')=>settings().profiles.filter(p=>p.id!==except&&[p.name,...p.aliases].some(x=>exactName(x,name)));
function renderMissingLink(name,person,profiles){
  if(linkTarget!==name)return '';
  const n=esc(name),help=person.role==='member'?'그룹 멤버는 이 카드와 프로필도 함께 연결해요.':person.role==='other'?'이번 장면에 연결해요. 별칭을 추가하면 다른 채팅에서도 같은 이름으로 알아봐요.':'이 채팅의 프로필 연결도 함께 바꿔요.';
  return `<div class="ncs-link-picker"><label>연결할 프로필<select id="ncs-link-profile">${profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><label class="ncs-check"><input id="ncs-link-alias" type="checkbox" checked>"${n}"을(를) 별칭에도 추가 · 다음부터 자동으로 알아봐요</label><small>${help} 잘못 골랐다면 바로 "연결 되돌리기"로 원래대로 돌릴 수 있어요.</small><div class="ncs-row"><button type="button" class="ncs-primary" data-missing-do="link-confirm" data-missing-name="${n}">연결</button><button type="button" data-missing-do="link-cancel" data-missing-name="${n}">취소</button></div></div>`;
}
function renderMissingMain(main){
  const profiles=settings().profiles,undo=lastLink&&lastLink.chatKey===keyOf()?lastLink:null;
  $('ncs-missing-main').innerHTML=(undo?`<div class="ncs-link-done">"${esc(undo.name)}"을(를) ${esc(undo.profileName)} 프로필에 연결했어요. 잘못 연결했다면 <button type="button" data-missing-do="link-undo" data-missing-name="${esc(undo.name)}">연결 되돌리기</button></div>`:'')+main.map(({name,person})=>{
    const n=esc(name),source=sourceLabel(person.role),hasText=!!descriptionFor(ctx(),person).text,linking=linkTarget===name;
    const reason=nameOwners(name).length?'프로필 연결을 확정하지 못해서':'프로필이 없어서';
    return `<div class="ncs-missing-main"><strong>⚠ ${esc(roleLabel(person.role))} "${n}"의 ${reason} 이번 그림에 안 그려져요.</strong>
<p>프로필을 만들거나 이미 만든 프로필에 연결하면 바로 장면에 들어가요.</p>
<div class="ncs-row"><button type="button" data-missing-do="direct" data-missing-name="${n}">직접 만들기</button><button type="button" class="ncs-primary" data-missing-do="source" data-missing-name="${n}" ${hasText?'':'disabled'}>${esc(source)}에서 만들기</button>${profiles.length?`<button type="button" data-missing-do="link" data-missing-name="${n}" aria-expanded="${linking}">기존 프로필 연결하기</button>`:''}</div>
<small>${hasText?esc(SOURCE_NOTE(source)):`${esc(source)} 설명이 비어 있어서 ${esc(source)}에서 만들 수 없어요. 직접 만들어 주세요.`}</small>
${renderMissingLink(name,person,profiles)}</div>`;
  }).join('');
}
function renderLeftOut(main,others){
  const list=[...main.map(m=>`${m.name}(${roleLabel(m.person.role)})`),...others],skip=skipMissingWarning();
  const line=$('ncs-left-out');line.hidden=!list.length&&!skip;
  line.innerHTML=(list.length?`이번 그림에서 빠지는 인물: ${esc(list.join(', '))}`:'')+(skip?`<span class="ncs-left-out-skip">${list.length?' · ':''}이 채팅에서는 생성 전 경고창을 띄우지 않아요. <button type="button" data-action="missing-reenable">경고창 다시 켜기</button></span>`:'');
}
function linkMissing(name,person){
  const s=settings(),p=s.profiles.find(x=>x.id===$('ncs-link-profile').value);if(!p)throw new Error('연결할 프로필을 골라 주세요.');
  const owners=nameOwners(name,p.id);
  if(owners.length)throw new Error(`"${name}"은(는) 이미 ${owners.map(o=>o.name).join(', ')} 프로필의 이름·별칭이에요. 같은 이름이 두 프로필에 있으면 자동 연결이 안 돼요. 그 프로필을 고르거나, 그쪽 별칭을 먼저 정리해 주세요.`);
  const addAlias=$('ncs-link-alias').checked&&![p.name,...p.aliases].some(x=>exactName(x,name));
  const setCard=person.role==='member'&&person.avatar&&!p.cardKey&&!s.profiles.some(x=>x.cardKey===person.avatar);
  const field=person.role==='character'?'characterProfileId':person.role==='user'?'userProfileId':'';
  const undo={chatKey:keyOf(),name,profileId:p.id,profileName:p.name,aliasAdded:addAlias,cardKeySet:setCard?person.avatar:'',field,previousBinding:field?chatBinding(field):'',addedToScene:!scene.characters.some(c=>c.id===p.id),sceneRef:scene};
  if(addAlias||setCard){
    s.profiles=validateProfiles(s.profiles.map(x=>x.id===p.id?{...x,aliases:addAlias?[...x.aliases,name]:x.aliases,cardKey:setCard?person.avatar:x.cardKey}:x));ctx().saveSettingsDebounced();
  }
  if(field)setChatBinding(field,p.id);
  const beforeNames=[...(scene.unregistered??[])],beforeDetails=clone(scene.unregisteredDetails??[]);
  const {restored}=attachSceneProfile(scene,p,[name,...profileSceneNames(p)]);
  undo.removedNames=beforeNames.filter(n=>!scene.unregistered.includes(n));
  undo.removedDetails=beforeDetails.filter(c=>!scene.unregisteredDetails.some(d=>identityKey(d.entityName)===identityKey(c.entityName)));
  lastLink=undo;linkTarget=null;changed();renderScene();renderProfiles();renderMatching();
  notice(`"${name}"을(를) ${p.name} 프로필로 연결하고 장면에 넣었어요.${addAlias?' 별칭에도 추가해서 다음부터 자동으로 알아봐요.':' 별칭은 추가하지 않아서 다음 추출에서는 다시 확인이 필요할 수 있어요.'}${restored?' 추출해 둔 표정·행동·복장도 채웠어요.':' 장면 정보가 비어 있으면 장면 추출을 다시 눌러 확인할 수 있어요.'}`);
}
function undoLink(){
  const u=lastLink;if(!u||u.chatKey!==keyOf()){lastLink=null;renderSceneExtras();return;}
  const s=settings();
  if(u.aliasAdded||u.cardKeySet){
    s.profiles=validateProfiles(s.profiles.map(x=>x.id!==u.profileId?x:{...x,aliases:u.aliasAdded?x.aliases.filter(a=>!exactName(a,u.name)):x.aliases,cardKey:u.cardKeySet&&x.cardKey===u.cardKeySet?'':x.cardKey}));ctx().saveSettingsDebounced();
  }
  if(u.field)setChatBinding(u.field,u.previousBinding);
  if(scene===u.sceneRef){
    if(u.addedToScene)scene.characters=scene.characters.filter(c=>c.id!==u.profileId);
    scene.unregistered=[...new Set([...(scene.unregistered??[]),...(u.removedNames??[u.name])])];
    scene.unregisteredDetails??=[];
    for(const detail of u.removedDetails??[])if(!scene.unregisteredDetails.some(c=>identityKey(c.entityName)===identityKey(detail.entityName)))scene.unregisteredDetails.push(clone(detail));
  }
  lastLink=null;changed();renderScene();renderProfiles();renderMatching();
  notice(`"${u.name}" 연결을 되돌렸어요.${u.aliasAdded?' 추가했던 별칭도 지웠어요.':''}`);
}
async function missingAction(kind,name){
  if(kind==='dialog-source'){closeMissingDialog();kind='source';}
  if(kind==='link-undo'){undoLink();return;}
  if(kind==='link-cancel'){linkTarget=null;renderSceneExtras();return;}
  const missing=missingState(),entry=missing.main.find(m=>m.name===name)??(missing.others.includes(name)?{name,person:{role:'other',avatar:''}}:null);
  if(!entry){renderSceneExtras();return;}
  const {person}=entry;
  if(kind==='link'){linkTarget=linkTarget===name?null:name;renderSceneExtras();return;}
  if(kind==='link-confirm'){linkMissing(name,person);return;}
  openQuickProfile(name);
  pendingBind={chatKey:keyOf(),role:person.role,avatar:person.avatar,session:profileFormSession};
  if(kind==='direct'){setProfileMode('direct',{save:false});$('ncs-profile-name').focus({preventScroll:true});notice(`"${name}" 프로필을 만들어 주세요. 저장하면 바로 장면에 들어가요.`);return;}
  const {text,truncated}=descriptionFor(ctx(),person);
  if(!text){setProfileMode('direct',{save:false});notice(`${sourceLabel(person.role)} 설명이 비어 있어요. 직접 입력해 주세요.`,true);return;}
  setProfileMode('describe',{save:false});$('ncs-profile-describe').value=text;
  await convertProfile({source:sourceLabel(person.role),truncated});
}
// A real nested modal: Tab stays inside, Escape closes only this box. It belongs to the chat and
// scene it was opened for; switching chats or closing the panel closes it without generating.
function openMissingDialog(main,seedMode){
  const box=$('ncs-missing-dialog'),sources=main.filter(m=>descriptionFor(ctx(),m.person).text);
  missingPrompt={chatKey:keyOf(),sceneRef:scene,seedMode};
  box.querySelector('.ncs-overlay-card').innerHTML=`<strong id="ncs-missing-title">⚠ 프로필이 없어서 이번 그림에 안 그려지는 인물이 있어요.</strong>
<ul>${main.map(({name,person})=>`<li><b>${esc(name)}</b> · ${esc(roleLabel(person.role))}${descriptionFor(ctx(),person).text?` <button type="button" data-missing-do="dialog-source" data-missing-name="${esc(name)}">${esc(sourceLabel(person.role))}에서 프로필 만들기</button>`:''}</li>`).join('')}</ul>
${sources.length?`<small>${esc(SOURCE_NOTE(sourceLabel(sources[0].person.role)))}</small>`:''}
<label class="ncs-check"><input id="ncs-missing-skip" type="checkbox">이 채팅에서 다시 묻지 않기 · "그래도 그리기"를 누를 때 적용돼요</label>
<div class="ncs-row"><button type="button" data-action="missing-proceed">그래도 그리기</button><button type="button" data-action="missing-cancel">취소</button></div>`;
  if(!box.open)box.showModal();box.querySelector('[data-action="missing-cancel"]').focus({preventScroll:true});
}
function closeMissingDialog(){const box=$('ncs-missing-dialog');missingPrompt=null;if(box?.open)box.close();}
async function proceedMissingDialog(){
  const prompt=missingPrompt,skip=$('ncs-missing-skip')?.checked;closeMissingDialog();
  if(!prompt||prompt.chatKey!==keyOf()||prompt.sceneRef!==scene){notice('채팅이나 장면이 바뀌어서 생성하지 않았어요. 다시 눌러 주세요.',true);return;}
  if(skip){setSkipMissingWarning(true);renderSceneExtras();}
  await generate(prompt.seedMode,{skipMissingCheck:true});
}
function renderSceneExtras() {
  const none=!settings().profiles.length;
  $('ncs-no-profiles').hidden=!none||profileContext==='scene';
  // Without profiles only "임시 인물 추가" is offered here; the empty-state box above handles the first profile.
  for(const el of [$('ncs-add-profile'),dialog.querySelector('[data-action="add-character"]'),$('ncs-add-row')?.querySelector?.('[data-action="quick-profile"]')])if(el)el.hidden=none;
  const {main,others}=missingState(),names=others;
  renderMissingMain(main);renderLeftOut(main,others);
  const profiles=settings().profiles;
  $('ncs-unregistered').innerHTML=names.length?`<small>장면에 보이지만 프로필이 없는 인물이에요. 그냥 두면 그림에서 빠져요. 이번 장면에만 그리려면 캐릭터 프롬프트로 추가하고, 다음에도 쓰려면 프로필을 만들거나 연결하세요. 추출해 둔 표정·행동·복장을 함께 불러와요.</small>${names.map(n=>`<div class="ncs-unregistered-person"><div class="ncs-row"><button type="button" class="ncs-chip-add" data-quick-profile-name="${esc(n)}">＋ ${esc(n)} 프로필 만들기</button><button type="button" data-temp-from="${esc(n)}">${esc(n)} · 캐릭터 프롬프트로 추가</button>${profiles.length?`<button type="button" data-missing-do="link" data-missing-name="${esc(n)}" aria-expanded="${linkTarget===n}">${esc(n)} · 기존 프로필 연결</button>`:''}</div>${renderMissingLink(n,{role:'other'},profiles)}</div>`).join('')}`:'';
}
async function convertProfile({source='',truncated=false}={}) {
  if(busy)return;
  const s=settings(),prompt=profileDraftPrompt($('ncs-profile-describe').value.trim(),{name:$('ncs-profile-name').value.trim(),format:s.format});
  const editing=$('ncs-profile-id').value,session=profileFormSession,ticket=++task,controller=new AbortController();extraction={ticket,controller,kind:'profile'};
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
    if($('ncs-profile-id').value!==editing||session!==profileFormSession){notice('프로필 칸이 바뀌어서 변환 결과를 적용하지 않았어요.');return;}
    const filled=['appearance','outfit','positive','negative'].some(k=>$(`ncs-profile-${k}`).value.trim());
    if(filled&&!confirm('지금 입력된 외형·기본 복장·Positive·Negative를 변환 결과로 바꿀까요?')){notice('변환 결과를 적용하지 않았어요. 입력한 내용은 그대로예요.');return;}
    if(!$('ncs-profile-name').value.trim()&&draft.name)$('ncs-profile-name').value=draft.name;
    if(!$('ncs-profile-aliases').value.trim()&&draft.aliases.length)$('ncs-profile-aliases').value=draft.aliases.join(', ');
    $('ncs-profile-subject').value=draft.subject;
    for(const [id,key] of [['appearance','appearance'],['outfit','defaultOutfit'],['positive','positive'],['negative','negative']])$(`ncs-profile-${id}`).value=draft[key];
    if(source&&!draft.appearance.trim())notice(`${source}에서 외형을 찾지 못했어요. 외형 칸을 직접 입력해 주세요.`,true);
    else notice(source?`${source}에서 외형·복장을 가져왔어요.${truncated?' 설명이 길어서 앞 4,000자만 보냈어요.':''} 확인하고 고친 뒤 저장해 주세요.`:'태그로 바꿨어요. 인원 태그·외형·복장을 확인하고 고친 뒤 저장해 주세요.');
  }finally{
    if(extraction?.ticket===ticket)extraction=null;
    stopProgress(ticket);if(busyOwner===ticket)setBusy(false);
  }
}
// --- Moment candidates --------------------------------------------------------------------------
// The active candidate lives in scene's own fields; scene.moments keeps every candidate's (edited) copy.
const MOMENT_FIELDS=['characters','unregistered','unregisteredDetails','interaction','location','lighting','camera'];
function momentPart(from){const part={};for(const k of MOMENT_FIELDS)part[k]=clone(from[k]??(k==='interaction'||k==='location'||k==='lighting'||k==='camera'?'':[]));return part;}
function syncMoment(){if(scene.moments?.length>1&&scene.moments[scene.momentIndex])scene.moments[scene.momentIndex].scene=momentPart(scene);}
let restoredFinal=null;
function switchMoment(index){
  const list=scene.moments??[];if(!list[index]||index===scene.momentIndex)return;
  // A prompt restored from history is not the user's own edit; only a hand edit asks first.
  if(finalOverride&&finalOverride!==restoredFinal&&!confirm('직접 고친 최종 프롬프트가 있어요. 다른 순간으로 바꾸면 고른 순간의 조립 결과로 돌아가요. 바꿀까요?'))return;
  const temps=scene.characters.filter(c=>c.temp);
  syncMoment();Object.assign(scene,clone(list[index].scene));scene.momentIndex=index;carryTemps(temps,scene);
  lastLink=null;linkTarget=null;changed();renderScene({forceFinal:true});
  notice(`"${list[index].title||`후보 ${index+1}`}" 순간으로 바꿨어요. 후보마다 고친 내용은 따로 남아 있어요.`);
}
function renderMoments(){
  const list=scene.moments??[],box=$('ncs-moments');box.hidden=list.length<2;if(list.length<2){box.innerHTML='';return;}
  box.innerHTML=`<strong class="ncs-moments-title">장면 후보 · 그릴 순간을 골라 주세요</strong><div class="ncs-moment-list" role="group" aria-label="장면 후보">${list.map((m,i)=>`<button type="button" class="ncs-moment" data-moment="${i}" aria-pressed="${i===scene.momentIndex}"><span class="ncs-moment-step">${i+1}</span><span class="ncs-moment-name">${esc(m.title||`후보 ${i+1}`)}</span>${i===list.length-1&&!scene.momentsPartial?'<small>마지막 순간</small>':''}</button>`).join('')}</div>`;
}
// --- Clothes on a scene card: 채팅 기본 복장 (this chat) · 복장 잠금 (lock) · 이번 그림 복장 (this image) · 옷장 -------
let wardrobeTarget=null;
const ORIGIN_TEXT={'이번 편집':'직접 고르거나 고친 옷','잠금':'잠긴 복장','AI 후보':'AI가 찾은 새 옷 · 이번 그림에만 입혀요. 확인해 주세요','채팅 복장':'채팅 기본 복장','기본 복장':'프로필 기본 복장'};
function chatOutfitChoice(p,state){
  const value=state?.value;if(value===undefined)return 'default';
  const w=(p.wardrobe??[]).find(w=>w.outfit===value);return w?`w:${w.id}`:'custom';
}
// Shows what this chat has saved, so pressing a save button visibly does something; just-saved cards flash once.
let justSavedOutfit=null;
function savedNote(c,state){
  const fresh=justSavedOutfit===c.id;if(fresh)justSavedOutfit=null;
  if(state?.value===undefined)return `<small class="ncs-saved-note ncs-saved-none${fresh?' ncs-just-saved':''}">채팅 기본 복장이 없어서 프로필 기본 복장을 기준으로 해요.</small>`;
  const text=state.value.length>60?`${state.value.slice(0,60)}…`:state.value;
  return `<small class="ncs-saved-note${fresh?' ncs-just-saved':''}" role="status">✓ 채팅 기본 복장: ${esc(text)}${state.locked?' · 잠금':''}</small>`;
}
// Badges under the name: visible at a glance that this chat has its own clothes or a lock.
const clothesBadges=state=>`<div class="ncs-clothes-badges"><span class="ncs-clothes-badge">프로필</span>${state?.value!==undefined?'<span class="ncs-clothes-badge">👕 채팅 기본 복장</span>':''}${state?.locked?'<span class="ncs-clothes-badge ncs-lock-badge">🔒 복장 잠금</span>':''}</div>`;
function outfitControls(c,p,o,state,stale){
  const id=esc(c.id),wardrobe=p.wardrobe??[],choice=chatOutfitChoice(p,state),isDefault=state?.value!==undefined&&o.value===state.value;
  const chatSelect=`<label>채팅 기본 복장<select data-chat-outfit${state?.value!==undefined?' class="ncs-on"':''}><option value="default" ${choice==='default'?'selected':''}>정하지 않음 · 프로필 기본 복장</option>${wardrobe.map(w=>`<option value="w:${esc(w.id)}" ${choice===`w:${w.id}`?'selected':''}>${esc(w.name)}</option>`).join('')}${choice==='custom'?'<option value="custom" selected>지정한 복장 · 옷장에 없음</option>':''}</select></label><small>메시지에 복장 설명이 없으면 이 채팅에서 기본으로 입는 옷이에요.</small>${savedNote(c,state)}`;
  const lock=`<label class="ncs-check${state?.locked?' ncs-on':''}"><input type="checkbox" data-lock ${state?.locked?'checked':''}>🔒 복장 잠금</label><small>AI가 이 채팅에서 복장을 바꾸지 못하게 해요. 직접 고른 옷은 적용돼요.</small>${state?.locked&&c.outfitMode==='replace'?`<small>AI가 찾은 새 옷: ${esc(c.outfit)} · 잠긴 복장을 유지해요.</small>`:''}`;
  const once=`<label>이번 그림 복장<textarea data-field="manualOutfit" rows="3">${esc(o.value)}</textarea></label><small>이번 그림에만 적용돼요. 지금: ${esc(ORIGIN_TEXT[o.origin]??o.origin)}${stale?' · 근거 메시지가 바뀌었어요. 옷을 확인해 주세요.':''}</small>`;
  const tools=`<div class="ncs-row">${wardrobe.length?`<select data-wear-once aria-label="옷장에서 이번 그림에만 꺼내 입기"><option value="">옷장에서 꺼내 입기</option>${wardrobe.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select>`:''}${isDefault?`<button data-save-outfit="${id}" class="ncs-on" aria-pressed="true" title="다시 누르면 채팅 기본 복장을 해제해요">✓ 채팅 기본 복장</button>`:`<button data-save-outfit="${id}" aria-pressed="false">기본 복장 지정</button>`}<button data-to-wardrobe="${id}">옷장에 저장</button><button data-reset-outfit="${id}">되돌리기</button></div><small>✓ 채팅 기본 복장을 다시 누르면 해제돼요. 옷장에 저장한 옷은 다른 채팅에서도 꺼내 입을 수 있어요.</small>`;
  const naming=wardrobeTarget===c.id?`<div class="ncs-wardrobe-save"><label>옷장에 저장할 이름<input id="ncs-wardrobe-name" maxlength="80" placeholder="예: 비 오는 날 외출복"></label><div class="ncs-row"><button type="button" class="ncs-primary" data-wardrobe-confirm="${id}">저장</button><button type="button" data-wardrobe-cancel>취소</button></div></div>`:'';
  if(isFree()){
    // 프리샷 has no chat: only this image's clothes and the wardrobe.
    const freeTools=`<div class="ncs-row">${wardrobe.length?`<select data-wear-once aria-label="옷장에서 꺼내 입기"><option value="">옷장에서 꺼내 입기</option>${wardrobe.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select>`:''}<button data-to-wardrobe="${id}">옷장에 저장</button><button data-reset-outfit="${id}">되돌리기</button></div>`;
    return `<label>이번 그림 복장<textarea data-field="manualOutfit" rows="3">${esc(o.value)}</textarea></label><small>프리샷은 프로필 기본 복장에서 시작해요. 채팅에 저장된 옷은 쓰지도 바꾸지도 않아요.</small>`+freeTools+naming;
  }
  return chatSelect+lock+once+tools+naming;
}
async function setChatOutfit(id,value,{note}={}){
  assertChat();const startKey=keyOf(),context=ctx();context.chatMetadata[KEY]??={outfits:{}};context.chatMetadata[KEY].outfits??={};
  const old=context.chatMetadata[KEY].outfits[id];
  context.chatMetadata[KEY].outfits[id]={value,locked:old?.locked??false,source:scene.source?compactSource(scene.source):null,updated:new Date().toISOString()};justSavedOutfit=id;
  // The picked clothes also go on this image, even over a locked or AI-found outfit: the user chose them.
  const c=scene.characters.find(c=>c.id===id);if(c)c.manualOutfit=value;
  await context.saveMetadata();if(keyOf()!==startKey)return;changed();renderScene();if(note)notice(note);
}
// Back to "not set": the chat follows the profile's default outfit again. A lock stays on if it was on.
// True when this image wears exactly the chat's default outfit (the button shows "✓ 채팅 기본 복장").
function isChatDefaultNow(id){
  const c=scene.characters.find(c=>c.id===id),p=settings().profiles.find(p=>p.id===id),state=outfitState()[id];
  return !!c&&!!p&&state?.value!==undefined&&resolveOutfit(c,p,state).value===state.value;
}
// Typing in 이번 그림 복장 updates the button right away, without rebuilding the card.
function refreshDefaultButton(card,id){
  const b=card?.querySelector('[data-save-outfit]');if(!b)return;const on=isChatDefaultNow(id);
  b.setAttribute('aria-pressed',String(on));b.classList.toggle('ncs-on',on);b.textContent=on?'✓ 채팅 기본 복장':'기본 복장 지정';
}
async function clearChatOutfit(id){
  assertChat();const startKey=keyOf(),context=ctx(),outfits=context.chatMetadata[KEY]?.outfits;if(!outfits?.[id])return;
  if(outfits[id].locked)outfits[id]={locked:true,source:outfits[id].source??null,updated:new Date().toISOString()};else delete outfits[id];
  const c=scene.characters.find(c=>c.id===id);if(c)c.manualOutfit=null;justSavedOutfit=id;
  await context.saveMetadata();if(keyOf()!==startKey)return;changed();renderScene();
  notice(`채팅 기본 복장을 해제했어요. 프로필 기본 복장을 기준으로 해요.${outfits[id]?.locked?' 복장 잠금은 켜져 있어요.':''}`);
}
function wearOnce(id,wardrobeId){
  const c=scene.characters.find(c=>c.id===id),p=settings().profiles.find(p=>p.id===id),w=p?.wardrobe?.find(w=>w.id===wardrobeId);if(!c||!w)return;
  c.manualOutfit=w.outfit;changed();renderScene();notice(`이번 그림에만 "${w.name}"을(를) 입혀요. 채팅에 저장된 옷은 그대로예요.`);
}
function saveToWardrobe(id){
  const s=settings(),p=s.profiles.find(p=>p.id===id),c=scene.characters.find(c=>c.id===id);if(!p||!c)return;
  const name=($('ncs-wardrobe-name')?.value??'').trim();if(!name)throw new Error('옷장에 넣을 이름을 적어 주세요.');
  if((p.wardrobe??[]).some(w=>w.name.toLowerCase()===name.toLowerCase()))throw new Error(`"${name}"은(는) 이미 ${p.name}의 옷장에 있어요. 다른 이름을 붙여 주세요.`);
  const outfit=resolveOutfit(c,p,outfitState()[id]).value,item={id:uuid(),name,outfit};
  s.profiles=validateProfiles(s.profiles.map(x=>x.id===id?{...x,wardrobe:[...(x.wardrobe??[]),item]}:x));ctx().saveSettingsDebounced();
  // Keep an open profile form in step, so saving it later does not drop the new item.
  if($('ncs-profile-id').value===id)addWardrobeRow(item);
  wardrobeTarget=null;renderScene();notice(`"${name}"을(를) ${p.name}의 옷장에 넣었어요. 다른 채팅에서도 골라 입을 수 있어요.`);
}
const tempPerson=(name='',detail=null)=>({id:`tmp-${uuid()}`,temp:true,name,subject:'other',appearance:'',outfit:detail?.outfit??'',
  entityName:name,expression:detail?.expression??'',action:detail?.action??'',position:detail?.position??'auto',included:true,needsCheck:false,manualOutfit:null,outfitMode:'unchanged'});
function tempCard(c){
  const id=esc(c.id),sel=(v,l)=>`<option value="${v}" ${c.subject===v?'selected':''}>${l}</option>`;
  return `<article class="ncs-character ncs-temp" data-character="${id}"><div class="ncs-character-head"><label class="ncs-check"><input type="checkbox" data-field="included" ${c.included!==false?'checked':''}><strong>${esc(c.name||'이름 없는 인물')}</strong></label><button data-remove="${id}" aria-label="직접 입력한 인물 빼기">빼기</button></div>
    <div class="ncs-clothes-badges"><span class="ncs-clothes-badge ncs-temp-badge">직접 입력</span></div>
    ${c.needsCheck?`<div class="ncs-temp-check" role="status">⚠ 장면이 바뀌었어요. 이 인물이 지금 장면에도 있는지, 표정·행동이 맞는지 확인해 주세요. <button type="button" data-temp-confirm="${id}">확인했어요</button></div>`:''}
    <small>프로필로 저장하지 않고 이 장면에만 그려요. 이름은 화면 표시용이라 그림 프롬프트엔 들어가지 않아요.</small>
    <div class="ncs-grid"><label>이름<input data-temp="name" maxlength="80" value="${esc(c.name)}" placeholder="예: 길거리 상인"></label><label>인원 태그<select data-temp="subject">${sel('girl','girl')}${sel('boy','boy')}${sel('other','other')}</select></label></div>
    <label>외형<textarea data-temp="appearance" rows="2" placeholder="예: middle-aged man, short grey hair, beard">${esc(c.appearance)}</textarea></label>
    <label>복장<textarea data-temp="outfit" rows="2" placeholder="예: apron, white shirt">${esc(c.outfit)}</textarea></label>
    <div class="ncs-grid"><label>표정<textarea data-field="expression" rows="2">${esc(c.expression)}</textarea></label><label>행동·포즈<textarea data-field="action" rows="2">${esc(c.action)}</textarea></label></div>
    <label>위치<select data-field="position">${['auto','left','center','right'].map((x,i)=>`<option value="${x}" ${c.position===x?'selected':''}>${['AI 선택','왼쪽','가운데','오른쪽'][i]}</option>`).join('')}</select></label>
    <div class="ncs-row"><button type="button" data-temp-save="${id}">프로필로 저장</button></div><small>프로필로 저장하면 다음부터 다른 장면·채팅에서도 알아봐요. 이번 장면의 표정·행동은 프로필에 넣지 않아요.</small>
  </article>`;
}
// From the "no profile" list or the add row. A name the extraction already saw brings its expression, action and clothes.
function addTemp(name=''){
  const detail=name?(scene.unregisteredDetails??[]).find(d=>identityKey(d.entityName)===identityKey(name)):null;
  const t=tempPerson(name,detail);scene.characters.push(t);
  if(name){scene.unregistered=(scene.unregistered??[]).filter(n=>identityKey(n)!==identityKey(name));scene.unregisteredDetails=(scene.unregisteredDetails??[]).filter(d=>identityKey(d.entityName)!==identityKey(name));}
  changed();renderScene();
  notice(name?`"${name}"을(를) 임시 인물로 넣었어요. 외형을 채워 주세요.${detail?' 추출해 둔 표정·행동·복장은 채웠어요.':''}`:'임시 인물을 넣었어요. 외형·복장·행동을 채워 주세요.');
  $('ncs-characters').querySelector(`[data-character="${t.id}"] [data-temp="${name?'appearance':'name'}"]`)?.focus({preventScroll:true});
}
// A new extraction or another candidate keeps temporary people, but never assumes they are still there:
// a name the AI found again takes its fresh fields; otherwise the card asks for a check.
function carryTemps(temps,part){
  for(const t of temps){
    if(part.characters.some(c=>c.id===t.id))continue;
    const detail=t.name?(part.unregisteredDetails??[]).find(d=>identityKey(d.entityName)===identityKey(t.name)):null;
    const copy={...clone(t),needsCheck:!detail};
    if(detail){copy.expression=detail.expression??'';copy.action=detail.action??'';if(detail.position&&detail.position!=='auto')copy.position=detail.position;if(detail.outfitMode==='replace'&&detail.outfit)copy.outfit=detail.outfit;
      part.unregistered=(part.unregistered??[]).filter(n=>identityKey(n)!==identityKey(t.name));part.unregisteredDetails=part.unregisteredDetails.filter(d=>d!==detail);}
    part.characters.push(copy);
  }
}
let pendingTempConvert=null;
function tempToProfile(id){
  const t=scene.characters.find(c=>c.id===id&&c.temp);if(!t)return;
  openQuickProfile(t.name);setProfileMode('direct',{save:false});
  $('ncs-profile-name').value=t.name;$('ncs-profile-subject').value=['boy','girl','other'].includes(t.subject)?t.subject:'other';
  $('ncs-profile-appearance').value=t.appearance??'';$('ncs-profile-outfit').value=t.outfit??'';
  pendingTempConvert={id,session:profileFormSession,chatKey:keyOf()};
  notice('임시 인물의 이름·외형·복장으로 프로필 칸을 채웠어요. 확인하고 "저장하고 장면에 추가"를 눌러 주세요.');
}
// After the profile is saved, the temporary slot becomes that profile's slot (in every candidate), so nobody is doubled.
function convertTemp(profile){
  const convert=c=>c.id===pendingTempConvert.id&&c.temp?{id:profile.id,entityName:c.name||profile.name,included:c.included!==false,expression:c.expression,action:c.action,position:c.position,positionManual:c.positionManual,outfitMode:'unchanged',outfit:'',manualOutfit:c.outfit?c.outfit:null}:c;
  scene.characters=scene.characters.map(convert);
  for(const m of scene.moments??[])m.scene.characters=m.scene.characters.map(convert);
  pendingTempConvert=null;
}
function renderScene({forceFinal=false}={}) {
  renderMoments();
  for(const k of ['location','lighting','camera','interaction'])$(`ncs-${k}`).value=scene[k];
  renderSceneExtras();
  const profiles=settings().profiles,states=outfitState();
  $('ncs-character-help').textContent=`인물 카드 하나가 NAI의 캐릭터 프롬프트 하나에 해당해요. (${MODELS[effectiveOptions().model]?.label??''} 최대 ${MODELS[effectiveOptions().model]?.limit??6}명)`;
  $('ncs-characters').innerHTML=scene.characters.map(c=>{
    if(c.temp)return tempCard(c);
    const p=profiles.find(p=>p.id===c.id);if(!p)return '';
    const o=resolveOutfit(c,p,states[c.id]);
    const stale=states[c.id]?.source && !sourceValid(states[c.id].source,ctx().chat);
    return `<article class="ncs-character" data-character="${esc(c.id)}"><div class="ncs-character-head"><label class="ncs-check"><input type="checkbox" data-field="included" ${c.included!==false?'checked':''}><strong>${esc(p.name)}</strong></label><button data-remove="${esc(c.id)}" aria-label="${esc(p.name)} 장면에서 제거">제거</button></div>${clothesBadges(states[c.id])}
      <label>연결된 이미지 프로필<select data-profile-switch>${profiles.map(profile=>`<option value="${esc(profile.id)}" ${profile.id===c.id?'selected':''}>${esc(profile.name)}</option>`).join('')}</select></label><small>${c.entityName?'추출 인물: '+esc(c.entityName):'직접 추가한 인물'} · 변경하면 새 프로필의 복장을 사용해요.</small>
      <div class="ncs-grid"><label>표정<textarea data-field="expression" rows="2">${esc(c.expression)}</textarea></label><label>행동·포즈<textarea data-field="action" rows="2">${esc(c.action)}</textarea></label></div>
      <label>위치<select data-field="position">${['auto','left','center','right'].map((x,i)=>`<option value="${x}" ${c.position===x?'selected':''}>${['AI 선택','왼쪽','가운데','오른쪽'][i]}</option>`).join('')}</select></label>
      ${outfitControls(c,p,o,states[c.id],stale)}
      <details><summary>고정 외형 · 전용 태그</summary><small>${esc(p.appearance)}</small><small>Positive: ${esc(p.positive)}</small><small>Negative: ${esc(p.negative)}</small></details>
    </article>`;
  }).join('');
  $('ncs-raw').value=raw;$('ncs-raw-copy').disabled=!raw;$('ncs-raw-copy').textContent='응답 복사';updateFinal({force:forceFinal});
}
// --- Temporary people (임시 인물): drawn in this scene only, never saved as a profile -----------------
// For assembly each one becomes a throwaway profile whose outfit is its own field.
function assembleScene(){
  const temps=scene.characters.filter(c=>c.temp),s=settings();
  if(!temps.length)return assemble(s,scene,outfitState());
  const virtual=temps.map(t=>({id:t.id,name:t.name||'임시 인물',aliases:[],subject:['boy','girl','other'].includes(t.subject)?t.subject:'other',appearance:t.appearance??'',defaultOutfit:'',positive:'',negative:'',cardKey:''}));
  return assemble({...s,profiles:[...s.profiles,...virtual]},{...scene,characters:scene.characters.map(c=>c.temp?{...c,manualOutfit:c.outfit??''}:c)},outfitState());
}
function finalData(){return finalOverride??assembleScene();}
function updateFinal({force=false}={}) {
  if(!dialog)return;
  const help=$('ncs-character-help');if(help)help.textContent=`인물 카드 하나가 NAI의 캐릭터 프롬프트 하나에 해당해요. (${MODELS[effectiveOptions().model]?.label??''} 최대 ${MODELS[effectiveOptions().model]?.limit??6}명)`;
  try {
    if(finalOverride?.invalid){$('ncs-warnings').textContent=`최종 프롬프트 JSON을 확인해 주세요: ${finalOverride.message}`;return;} // keep the user's in-progress text
    const a=finalData();if(force||!(finalOverride&&document.activeElement===$('ncs-final')))$('ncs-final').value=JSON.stringify(a,null,2);
    renderFinalForm(a,{force});$('ncs-final-badge').hidden=!finalOverride;
    const lengths=[`공통 ${a.base.length}자`,...a.characters.map(c=>`${c.name}: ${c.prompt.length}자`)];
    $('ncs-length').textContent=`${lengths.join(' · ')} · 글자 수예요. NAI 토큰 수와 달라요.`;
    // The shared core still words this one the old way; show it in the clothes vocabulary of the scene card.
    const warnings=[...(a.warnings??[])].filter(w=>!w.startsWith('미등록 인물은 자동 생성하지 않아요')).map(w=>w.replace(/: 새 복장 후보가 있지만 잠금을 유지해요\.$/,': AI가 찾은 새 옷이 있지만 잠긴 복장을 입혀요.'));
    for(const t of scene.characters.filter(c=>c.temp&&c.included!==false&&!(c.appearance??'').trim()))warnings.push(`임시 인물 ${t.name||'(이름 없음)'}의 외형이 비어 있어요. 외형을 채우면 더 잘 그려져요.`);
    if(scene.source?.historical)warnings.push('지난 메시지를 그리고 있어요. 여기서 고른 옷은 "채팅 기본 복장"을 자동으로 바꾸지 않아요.');
    if(scene.moments?.length>1&&scene.momentIndex<scene.moments.length-1)warnings.push('앞쪽 순간을 골랐어요. 메시지 끝에서는 옷이 달라졌을 수 있어요. "기본 복장 지정"은 마지막 순간에서 누르는 걸 추천해요.');
    if(scene.source&&!sourceValid(scene.source,ctx().chat))warnings.push('대상 메시지가 수정·삭제·리롤됐어요. 다시 추출하거나 내용을 확인해 주세요.');
    if(a.base.length+a.characters.reduce((n,c)=>n+c.prompt.length,0)>2000)warnings.push('프롬프트가 길어요. 특히 V4.5는 전체 토큰 한도를 확인해 주세요.');
    if(finalOverride)warnings.push('직접 고친 최종 프롬프트를 이번 생성에 써요. 되돌리려면 "조립 결과로 되돌리기"를 눌러 주세요.');
    if(optionsOverride)warnings.push(`이력에서 불러온 생성 설정(seed ${optionsOverride.seed})을 이번 생성에만 써요. 생성 성공·조립 결과로 되돌리기 시 현재 설정으로 돌아가요. 이 채팅의 마지막 작업에 함께 기억해요.`);
    $('ncs-warnings').textContent=warnings.join('\n');
    const guard=costGuard(effectiveOptions(),subscription);$('ncs-cost').textContent=guard.message;
    updatePresetState();
  }catch(e){$('ncs-warnings').textContent=e.message;}
}
// Field-by-field editor for the final prompt; the JSON box stays as an advanced view of the same data.
function renderFinalForm(a,{force=false}={}) {
  const box=$('ncs-final-form');if(!force&&box.contains(document.activeElement))return; // preserve typing except when the draft is reset or replaced
  const area=(label,attrs,value,rows)=>`<label>${label}<textarea ${attrs} rows="${rows}" spellcheck="false">${esc(value)}</textarea></label>`;
  box.innerHTML=area('공통 Positive','data-final="base"',a.base,3)+area('공통 Negative','data-final="negative"',a.negative,2)+
    (a.characters.length?a.characters.map((c,i)=>`<fieldset class="ncs-final-slot"><legend>${esc(c.name||`인물 ${i+1}`)}</legend>${area('Positive',`data-final="prompt" data-slot="${i}"`,c.prompt,3)}${area('Negative',`data-final="negative" data-slot="${i}"`,c.negative,2)}<label>위치<select data-final="position" data-slot="${i}">${['auto','left','center','right'].map((x,k)=>`<option value="${x}" ${c.position===x?'selected':''}>${['AI 선택','왼쪽','가운데','오른쪽'][k]}</option>`).join('')}</select></label></fieldset>`).join('')
    :'<small>장면에 인물이 없어요. 공통 프롬프트만 보내요.</small>');
}
function editFinalField(el) {
  const base=finalOverride&&!finalOverride.invalid?finalOverride:assembleScene();
  const next=clone(base),slot=el.dataset.slot;
  if(slot===undefined)next[el.dataset.final]=el.value;else next.characters[Number(slot)][el.dataset.final]=el.value;
  revision++;buildPayload(next,{...effectiveOptions(),seed:0});finalOverride=next;updateFinal();
}
function profileSceneNames(profile){
  const card=ctx().characters?.find(c=>c.avatar===profile.cardKey);
  return card?.name?[card.name]:[];
}
function addCharacter(id) {
  if(!id){openQuickProfile();return;}
  if(scene.characters.some(c=>c.id===id))throw new Error('이미 장면에 있는 인물이에요.');
  const profile=settings().profiles.find(p=>p.id===id);if(!profile)throw new Error('추가할 프로필을 선택해 주세요.');
  const {restored}=attachSceneProfile(scene,profile,profileSceneNames(profile));changed();renderScene();
  notice(restored?`${profile.name}을(를) 추가하고 추출해 둔 표정·행동·복장을 채웠어요.`:`${profile.name}을(를) 추가했어요. 장면 추출을 다시 누르면 이 인물도 후보에 넣어 표정·행동·복장을 확인해요. 실제 장면에 없으면 자동으로 넣지 않아요.`);
}
function assertChat(){if(!keyOf())throw new Error('먼저 캐릭터 채팅을 열어 주세요.');}
// Where the response length comes from depends on the connection used for extraction.
function limitHint(){
  return settings().extractionProfileId?`설정 → 추출 AI의 "독립 추출 응답 한도"(지금 ${settings().extractionMaxTokens})를 올려 주세요.`
    :'본편 연결로 추출하면 본편 프리셋의 응답 길이가 그대로 적용돼요. 설정 → 추출 AI에서 별도 연결 프로필을 고르고 응답 한도를 넉넉히(8192부터) 잡아 주세요.';
}
// --- 프리샷: 글로 채우기 -------------------------------------------------------------------------------
const FOREIGN_TEXT=/[\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u9FFF\uAC00-\uD7A3]/;
async function freeFill() {
  if(busy||!isFree())return;
  const s=settings(),selected=scene.characters.filter(c=>!c.temp&&c.included!==false).map(c=>s.profiles.find(p=>p.id===c.id)).filter(Boolean);
  const prompt=freeScenePrompt($('ncs-free-text').value,s.profiles,selected,s.format);
  const ticket=++task,rev=revision,controller=new AbortController();extraction={ticket,controller,kind:'free'};
  dropUndo();setBusy(true,ticket);startProgress('free',ticket);notice('적은 상황으로 장면 칸을 채우고 있어요.');
  let response='',failure,retryForLanguage=false;
  try {
    for(let attempt=0;attempt<2;attempt++) {
      if(ticket!==task||!isFree()||controller.signal.aborted)return;
      if(progress?.owner===ticket){progress.attempt=attempt+1;renderProgress();}
      let received=false;
      try {
        response=await requestExtraction(ctx(),prompt+(attempt?(retryForLanguage?'\nYour previous reply wrote descriptive fields in a language other than English. Return the complete JSON again with every descriptive field in English.':'\nThe previous response could not be parsed. Return ONLY the complete JSON object.'):''),
          {profileId:s.extractionProfileId,structured:(attempt===0||retryForLanguage)&&s.structuredOutput,maxTokens:s.extractionMaxTokens,temperature:extractionTemperature(),schemaValue:freeSceneSchema(s.profiles),schemaName:'naice_shot_free',
           systemPrompt:'You turn a described situation into an image scene as JSON. Do not roleplay.',signal:controller.signal});
        received=true;
        const parsed=parseFreeScene(response,s.profiles);
        const foreign=[...['interaction','location','lighting','camera'].filter(k=>FOREIGN_TEXT.test(parsed[k])),...new Set(parsed.characters.flatMap(c=>['appearance','outfit','expression','action'].filter(k=>FOREIGN_TEXT.test(c[k]))))];
        if(foreign.length&&attempt===0){retryForLanguage=true;notice('결과가 영어가 아니어서 영어로 다시 요청하고 있어요.');continue;}
        if(ticket!==task||!isFree()||revision!==rev){notice('작업 내용이 바뀌어서 채운 결과를 적용하지 않았어요.');return;}
        raw=response;applyFree(parsed,foreign);return;
      }catch(e){if(controller.signal.aborted)return;failure=e;if(!received)break;}
    }
    if(ticket===task&&isFree()){raw=response;renderScene();notice(`글로 채우기 실패: ${failure?.message}.${looksCut(response)?` 응답이 불완전해요. ${limitHint()}`:''} 기존 편집 내용은 유지했어요.`,true);}
  }finally{
    if(extraction?.ticket===ticket)extraction=null;
    stopProgress(ticket);if(busyOwner===ticket)setBusy(false);
  }
}
// Fills the scene from the text: saved profiles keep their stored look; anyone else becomes (or updates) a temporary person.
function applyFree(parsed,foreign=[]){
  const s=settings(),names=[...s.profiles.flatMap(p=>[p.name,...p.aliases]),...parsed.characters.map(c=>c.name)];
  const generic=genericizeScene({...parsed,unregistered:[],characters:parsed.characters.map(c=>({...c,outfitMode:c.outfit?'replace':'unchanged'}))},names,s.format).scene;
  for(const k of ['location','lighting','camera','interaction'])scene[k]=generic[k]??'';
  let profilesUsed=0,temps=0,emptyLooks=0;
  generic.characters.forEach((c,i)=>{
    const appearance=parsed.characters[i]?.appearance??'';
    if(c.id){
      const p=s.profiles.find(p=>p.id===c.id);if(!p)return;profilesUsed++;
      let card=scene.characters.find(x=>x.id===c.id&&!x.temp);
      if(!card){card={id:c.id,entityName:c.name||p.name,included:true,expression:'',action:'',position:'auto',outfitMode:'unchanged',outfit:'',manualOutfit:null};scene.characters.push(card);}
      card.expression=c.expression;card.action=c.action;if(!card.positionManual)card.position=c.position;if(c.outfitMode==='replace'&&c.outfit)card.manualOutfit=c.outfit;
    }else{
      temps++;
      let t=c.name?scene.characters.find(x=>x.temp&&identityKey(x.name)===identityKey(c.name)):null;
      if(!t){t=tempPerson(c.name);t.subject=c.subject;scene.characters.push(t);}
      if(!(t.appearance??'').trim())t.appearance=appearance;if(c.outfitMode==='replace'&&c.outfit)t.outfit=c.outfit;
      t.expression=c.expression;t.action=c.action;if(!t.positionManual)t.position=c.position;t.needsCheck=false;
      if(!(t.appearance??'').trim())emptyLooks++;
    }
  });
  scene.unregistered=[];scene.unregisteredDetails=[];scene.source=null;
  finalOverride=null;optionsOverride=null;restoredFinal=null;revision++;renderScene({forceFinal:true});
  notice(`장면 칸을 채웠어요. 프로필 인물 ${profilesUsed}명${temps?`, 임시 인물 ${temps}명`:''}. 확인한 뒤 생성해 주세요.${emptyLooks?' 외형이 비어 있는 임시 인물은 직접 채워 주세요.':''}${foreign.length?` 영어로 바뀌지 않은 칸이 있어요(${foreign.join(', ')}).`:''}`);
}
async function extract() {
  if(busy)return;assertChat();
  const s=settings();if(!s.profiles.length){openQuickProfile();notice('등록된 프로필이 없어요. 아래에서 첫 프로필을 만들면 바로 추출할 수 있어요.');return;}
  if(ctx().streamingProcessor && !ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 추출해 주세요.');
  const selection=chooseSceneMessages(ctx().chat,{target:$('ncs-target').value===''?null:Number($('ncs-target').value),recent:Number($('ncs-recent').value),includeUser:$('ncs-include-user').checked});
  const startKey=keyOf(),rev=revision,ticket=++task,profiles=clone(s.profiles),outfits=clone(outfitState());
  const matching=matchChatProfiles(ctx(),profiles,selection.messages,chatBindings(),scene.characters.filter(c=>c.included!==false).map(c=>c.id));
  const wish=$('ncs-moment-wish').value.trim();
  // Positions the user chose by hand survive a re-extraction of the same message.
  // Temporary people survive a new extraction (marked for a check unless the AI found them again).
  const keptTemps=[...new Map([scene,...(scene.moments??[]).map(m=>m.scene)].flatMap(part=>(part.characters??[]).filter(c=>c.temp)).map(t=>[t.id,t])).values()];
  const manualPositions=new Map();
  if(scene.source?.target===selection.source.target)for(const part of [scene,...(scene.moments??[]).map(m=>m.scene)])for(const c of part.characters??[])if(c.positionManual&&c.id)manualPositions.set(c.id,c.position);
  const prompt=momentExtractionPrompt(selection.messages,matching.profiles,outfits,s.format,matching.mappings,wish);
  const controller=new AbortController();extraction={ticket,controller};
  dropUndo();setBusy(true,ticket);startProgress('extract',ticket);notice('장면 추출을 시작했어요.');
  let response='',failure;
  try {
    let retryForLanguage=false;
    for(let attempt=0;attempt<2;attempt++) {
      if(ticket!==task||keyOf()!==startKey||revision!==rev||controller.signal.aborted)return;
      if(progress?.owner===ticket){progress.attempt=attempt+1;renderProgress();}
      let received=false;
      try {
        response=await requestExtraction(ctx(),prompt+(attempt?(retryForLanguage?'\nYour previous reply wrote descriptive fields in a language other than English. Return the complete JSON again with every descriptive field in English; keep title in Korean.':'\nThe previous response could not be parsed. Return ONLY the complete JSON object.'):''),
          {profileId:s.extractionProfileId,structured:(attempt===0||retryForLanguage)&&s.structuredOutput,maxTokens:s.extractionMaxTokens,temperature:extractionTemperature(),schemaValue:momentExtractionSchema(matching.profiles),signal:controller.signal});
        received=true;
        const parsed=parseMoments(response,profiles);
        // Fields in the chat's language instead of English: ask once more, then accept with a note.
        const foreign=foreignFields(parsed.moments);
        if(foreign.length&&attempt===0){retryForLanguage=true;notice('추출 결과가 영어가 아니어서 영어로 다시 요청하고 있어요.');continue;}
        if(foreign.length)parsed.warnings.push(`영어로 바뀌지 않은 칸이 있어요(${foreign.join(', ')}). 직접 고치거나 다시 추출해 주세요.`);
        if(ticket!==task||keyOf()!==startKey||revision!==rev||!sourceValid(selection.source,ctx().chat)){notice('채팅·장면 또는 원문이 바뀌어서 추출 결과를 적용하지 않았어요.');return;}
        // Each candidate is reconciled and cleaned on its own, so one moment's people and poses never leak into another.
        const c=ctx(),baseNames=[...s.profiles.flatMap(p=>[p.name,...p.aliases]),...matching.profiles.flatMap(p=>[p.name,...p.aliases]),...matching.mappings.map(m=>m.name),
          matching.userName,matching.characterName,c.name1,c.name2];
        const warnings=[...matching.warnings,...parsed.warnings],removed=new Set();
        const moments=parsed.moments.map(m=>{
          const reconciled=reconcileCharacters(m.scene,matching);
          const generic=genericizeScene(reconciled.scene,[...baseNames,...reconciled.scene.unregistered,...reconciled.scene.characters.map(x=>x.entityName)],s.format);
          for(const w of [...m.warnings,...reconciled.warnings])if(!warnings.includes(w))warnings.push(w);
          generic.removed.forEach(x=>removed.add(x));
          for(const ch of generic.scene.characters)if(manualPositions.has(ch.id)){ch.position=manualPositions.get(ch.id);ch.positionManual=true;}
          const part=momentPart(generic.scene);carryTemps(keptTemps,part);
          return {title:m.title,scene:part};
        });
        raw=response;
        scene={...blankScene(),...clone(moments[parsed.defaultIndex].scene),source:selection.source,moments:moments.length>1?moments:[],momentIndex:moments.length>1?parsed.defaultIndex:0,momentWish:wish,momentsPartial:parsed.partial};
        finalOverride=null;optionsOverride=null;lastLink=null;linkTarget=null;revision++;renderScene();
        if(removed.size)warnings.push(`장면 설명에 들어간 이름(${[...removed].join(', ')})을 빼고 일반 표현으로 정리했어요.`);
        const lead=parsed.partial?`응답이 불완전해요. 온전히 받은 후보 ${moments.length}개만 보여줘요. 메시지의 마지막 순간이 빠졌을 수 있어요. ${limitHint()} `:wish&&!parsed.requestMatched?'적어 주신 순간을 이 메시지에서 찾지 못해서 마지막 순간을 골랐어요. ':moments.length>1?`장면 후보 ${moments.length}개를 찾았어요. 위에서 그릴 순간을 고를 수 있어요. `:'';
        notice(lead+(warnings.length?warnings.join(' / '):'추출했어요. 복장과 행동을 확인한 뒤 생성해 주세요.'));return;
      }catch(e){if(controller.signal.aborted)return;failure=e;if(!received)break;}
    }
    if(ticket===task&&keyOf()===startKey){raw=response;renderScene();notice(`추출 실패: ${failure?.message}.${looksCut(response)?` 응답이 불완전해요. ${limitHint()}`:''} 기존 편집 내용은 유지했어요.`,true);}
  }finally{
    if(extraction?.ticket===ticket)extraction=null;
    stopProgress(ticket);if(busyOwner===ticket)setBusy(false);
  }
}
async function saveOutfit(id,lockOnly=null) {
  assertChat();const startKey=keyOf(),c=scene.characters.find(c=>c.id===id),p=settings().profiles.find(p=>p.id===id);
  const context=ctx();context.chatMetadata[KEY]??={outfits:{}};context.chatMetadata[KEY].outfits??={};
  const old=context.chatMetadata[KEY].outfits[id];
  // Locking alone never sets a chat default outfit; it only freezes what is there (or the profile default).
  const value=lockOnly!==null?old?.value:resolveOutfit(c,p,old).value;
  // Store compact hashes instead of RP text in persisted clothing provenance.
  const source=lockOnly!==null?old?.source:(scene.source?compactSource(scene.source):null);
  if(keyOf()!==startKey)return;
  const entry={locked:lockOnly??old?.locked??false,source,updated:new Date().toISOString()};if(value!==undefined)entry.value=value;
  if(entry.value===undefined&&!entry.locked)delete ctx().chatMetadata[KEY].outfits[id];else ctx().chatMetadata[KEY].outfits[id]=entry;justSavedOutfit=id;
  await ctx().saveMetadata();changed();renderScene();notice(lockOnly!==null?(lockOnly?'복장을 잠갔어요. AI가 이 채팅에서 복장을 바꾸지 못해요.':'복장 잠금을 풀었어요. AI가 장면 속 복장 변경을 반영할 수 있어요.'):'채팅 기본 복장으로 지정했어요. 다음 그림에도 이어져요.');
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
  serverFeatures=Array.isArray(data?.features)?data.features:[];if(dialog)$('ncs-delete-work-box').hidden=!serverFeatures.includes('draft-delete');
  if(data?.features?.includes('draft-work')&&!draftsEnabled){draftsEnabled=true;await recallDraft();}
  if(force)compatDismissed=false;
  renderCompat();renderDraftState();return compatResult;
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
async function generate(seedMode=null,{skipMissingCheck=false}={}) {
  if(busy)return;if(!isFree())assertChat();
  // Nothing extracted or entered yet: the image would be the common prompt alone. Ask first.
  const emptyScene=!scene.characters.some(c=>c.included!==false)&&!['location','lighting','camera','interaction'].some(k=>(scene[k]??'').trim());
  if(!skipMissingCheck&&emptyScene&&!finalOverride&&!confirm(isFree()?'장면 칸이 비어 있어요. 인물·장소 없이 공통 프롬프트만으로 그릴까요?\n\n확인: 그대로 그리기 · 취소: 돌아가서 "글로 채우기"나 인물 추가하기':'장면을 아직 추출하지 않았어요. 인물·장소 없이 공통 프롬프트만으로 그릴까요?\n\n확인: 그대로 그리기 · 취소: 돌아가서 "장면 추출" 누르기')){notice(isFree()?'생성하지 않았어요. 상황을 적고 "글로 채우기"를 누르거나 인물을 추가해 주세요.':'생성하지 않았어요. "장면 추출"을 먼저 눌러 주세요.');return;}
  if(!skipMissingCheck){const {main}=missingState();if(main.length&&!skipMissingWarning()){openMissingDialog(main,seedMode);return;}}
  const s=settings(),startKey=workKey(),ticket=++task;
  if(finalOverride?.invalid)throw new Error('최종 프롬프트 JSON이 올바르지 않아요. 고치거나 "조립 결과로 되돌리기"를 눌러 주세요.');
  const a=clone(finalData()),submittedFinal=finalOverride,submittedOptions=optionsOverride;
  const options=clone(effectiveOptions());
  options.seed=seedMode==='same'&&result?result.seed:seedMode==='new'||options.seed===-1?crypto.getRandomValues(new Uint32Array(1))[0]:options.seed;
  buildPayload(a,options); // Local validation before network or billing.
  if(!a.base.trim()&&!a.characters.length)throw new Error('장면이나 프롬프트를 먼저 입력해 주세요.');
  syncMoment();
  const snapshot={scene:clone(scene),...(isFree()?{mode:'free',freeText:$('ncs-free-text').value}:{}),...(s.retainRawExtraction===true?{rawExtraction:stripReasoningBlocks(raw)}:{})};snapshot.scene.source=scene.source?compactSource(scene.source):null;
  if(workKey()!==startKey)return;
  dropUndo();setBusy(true,ticket);startProgress('generate',ticket);notice('NAI에 생성 요청을 보내고 있어요. 창을 닫거나 채팅을 바꿔도 서버는 결과를 저장해요.');
  rememberDraft(startKey,null,{flush:true});const generationDraft=drafts.entry(startKey);generationDraft.pinned=true;const savedDraftVersion=generationDraft.version;
  try {
    const item=await api('/generate',{method:'POST',body:{requestId:uuid(),chatKey:startKey,assembled:a,options,allowAnlas:s.allowAnlas,retainRawExtraction:s.retainRawExtraction===true,snapshot}});
    if(ticket!==task||workKey()!==startKey){
      // A successful old-chat request must consume its old one-off options as well, never the new chat's.
      const e=drafts.entry(startKey),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
      if(draftsEnabled&&e.loaded&&e.data){const w={...e.data};
        if(same(w.finalOverride,submittedFinal)){w.finalOverride=null;w.isRestored=false;}
        if(same(w.optionsOverride,submittedOptions))w.optionsOverride=null;
        if(e.version===savedDraftVersion)w.result=item;
        drafts.put(startKey,packWork(w,{retainRaw:s.retainRawExtraction===true}));drafts.flush(startKey);
        if(workKey()===startKey){if(same(finalOverride,submittedFinal))finalOverride=null;if(same(optionsOverride,submittedOptions))optionsOverride=null;result=w.result;renderScene({forceFinal:true});renderResult();}
      }
      notice('생성이 끝났어요. 시작한 곳의 이력에서 확인할 수 있어요.');return;
    }
    // Consume only the submitted overrides; keep a newer edit made while awaiting the response.
    const resetFinal=finalOverride===submittedFinal;
    if(resetFinal)finalOverride=null;
    if(optionsOverride===submittedOptions)optionsOverride=null;
    revision++;updateFinal({force:resetFinal});
    result=item;renderResult();notice(`생성했어요 · seed ${item.seed} · 그림을 누르면 크게 볼 수 있어요.`);loadHistory().catch(()=>{});
  }finally{generationDraft.pinned=false;stopProgress(ticket);if(busyOwner===ticket)setBusy(false);}
}
const chatRows=()=>ctx().chat.map((m,i)=>({m,i})).filter(({m})=>isSceneMessage(m));
const rowOption=({m,i},selected=false)=>`<option value="${i}" ${selected?'selected':''}>#${i} · ${esc(m.name)}${isHiddenSceneMessage(m)?' · 숨김':''} · ${esc(m.mes.replace(/\s+/g,' ').slice(0,35))}</option>`;
// Where an image goes by default: where it is already attached, else the message it was generated for, else the latest.
function preferredTarget(item) {
  const chat=ctx().chat,existing=chat.findIndex(m=>m.extra?.naice_shot_images?.some(x=>x.id===item.id));
  const source=item.snapshot?.scene?.source;
  return existing>=0?existing:source&&sourceValid(source,chat)?source.target:chatRows().filter(({m})=>!m.is_system).at(-1)?.i;
}
function imageControls(item) {
  const save=saveMenu(item,`ncs-result-save-${item.id}`);
  if(isFree())return `<div class="ncs-row">${save.button}<button type="button" data-action="delete-result" class="ncs-danger-outline">삭제</button></div>${save.menu}`;
  const attached=hasInlineImage(ctx().chat,item),preferred=preferredTarget(item);
  return `<label>그림을 넣을 메시지<select data-image-target="${esc(item.id)}">${chatRows().map(row=>rowOption(row,row.i===preferred)).join('')}</select></label><div class="ncs-row"><button data-action="attach" class="ncs-primary">본문에 넣기</button>${attached?'<button data-action="detach">이미지 빼기</button>':''}${save.button}<button type="button" data-action="delete-result" class="ncs-danger-outline">삭제</button></div>${save.menu}`;
}
function renderResult() {
  $('ncs-result').innerHTML=result?`<button type="button" class="ncs-image-open" data-view-result aria-label="생성된 장면 크게 보기"><img src="${esc(result.image)}" alt="생성된 장면"></button>${imageControls(result)}<div class="ncs-row"><button data-action="same-seed">같은 seed로 생성</button><button data-action="new-seed">새 seed로 생성</button><button type="button" data-view-result>크게 보기</button></div><small>seed ${result.seed} · ${esc(MODELS[result.options.model]?.label)} · 메시지 본문은 유지되고, 첨부 그림은 본편 AI 입력에 포함되지 않아요.</small>`:'';
  updateAttachButtons();
}
function updateAttachButtons() {
  const locked=busy||attaching;
  for(const el of dialog.querySelectorAll('[data-action="attach"],[data-action="detach"],[data-history-free],[data-history-attach],[data-history-detach],[data-image-target],#ncs-history-target,[data-history-delete],[data-action="delete-result"],[data-history-pick]'))el.disabled=locked;
  for(const el of document.querySelectorAll('[data-ncs-inline-remove]'))el.disabled=locked;
  updateHistoryTools();
}
let savingSelection=false;
const downloadFile=downloadOriginal;
// Saves the selected history images, either as one ZIP (one download prompt, reliable on phones)
// or one file at a time with a short gap so browsers do not drop any.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function zipChosen(){const v=settings().saveAsZip;return typeof v==='boolean'?v:!!globalThis.matchMedia?.('(pointer:coarse)').matches;}
async function saveSelected(clean=false) {
  const items=historyItems.filter(x=>selectedIds.has(x.id)).sort((a,b)=>String(a.created).localeCompare(String(b.created)));
  if(!items.length||savingSelection)return;
  savingSelection=true;updateHistoryTools();
  try{
    if(items.length===1){if(clean){await saveCleanImage(items[0]);notice('메타데이터를 뺀 공유용 PNG를 저장했어요.');}else{const file=imageDownload(items[0]);downloadFile(file.url,file.filename);notice('선택한 그림 1장을 원본 PNG로 저장했어요.');}return;}
    if(!zipChosen()){
      let saved=0,missing=0;
      for(const [i,item] of items.entries()){
        notice(`선택한 그림을 하나씩 저장하고 있어요… ${i+1}/${items.length}`);
        try{if(clean)await saveCleanImage(item);else{const file=imageDownload(item),check=await fetch(file.url,{method:'HEAD',cache:'no-store'});if(!check.ok)throw new Error(String(check.status));downloadFile(file.url,file.filename);}saved++;}catch{missing++;}
        if(i<items.length-1)await wait(400);
      }
      notice(`${clean?'공유용':'원본'} PNG ${saved}장을 하나씩 저장했어요.${missing?` ${missing}장은 불러오지 못했어요. ZIP으로 받아 보세요.`:''}`);
      return;
    }
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
    notice(`${clean?"메타데이터를 뺀 공유용 그림":"선택한 원본 그림"} ${files.length}장을 ZIP 파일 하나로 저장했어요.${missing?` 불러오기·변환에 실패한 ${missing}장은 빠졌어요.`:''}`);
  }finally{savingSelection=false;updateHistoryTools();}
}
// The selection save menu: two choices, plus "ZIP 하나로 묶기" when several images are selected.
function renderSelectionSave(){
  const n=selectedIds.size,zip=zipChosen(),many=n>1,box=$('ncs-selection-save');if(!box?.querySelector)return;
  const kind=many?(zip?'ZIP':`PNG · ${n}장 따로`):'PNG';
  box.querySelector('[data-action="save-selected-clean"]').innerHTML=`공유용 ${kind}<small>${SAVE_NOTES.shared}</small>`;
  box.querySelector('[data-action="save-selected"]').innerHTML=`원본 ${kind}<small>${SAVE_NOTES.original}</small>`;
  const zipRow=box.querySelector('.ncs-zip-choice');zipRow.hidden=!many;$('ncs-save-zip').checked=zip;
  box.querySelector('.ncs-zip-note').hidden=!many||zip; // separate files: the browser may ask once
}
function updateHistoryTools() {
  if(!dialog)return;const locked=busy||attaching;
  for(const id of [...selectedIds])if(!historyItems.some(x=>x.id===id))selectedIds.delete(id);
  const save=dialog.querySelector('[data-image-more="ncs-selection-save"]');const saveLabel=save.querySelector?.('.ncs-save-label');if(saveLabel)saveLabel.textContent=savingSelection?'저장 준비 중…':selectedIds.size?`선택 저장 (${selectedIds.size})`:'선택 저장';save.disabled=savingSelection||!selectedIds.size;
  if(!save.disabled)renderSelectionSave();
  const del=dialog.querySelector('[data-action="delete-selected"]');del.textContent=selectedIds.size?`선택 삭제 (${selectedIds.size})`:'선택 삭제';del.disabled=locked||!selectedIds.size;
  const all=dialog.querySelector('[data-action="select-all-history"]'),every=historyItems.length>0&&historyItems.every(x=>selectedIds.has(x.id));
  all.textContent=every?'선택 해제':'표시된 항목 모두 선택';all.disabled=locked||!historyItems.length;
  const allScope=historyScope==='all';
  dialog.querySelector('[data-action="delete-chat-history"]').disabled=locked||!historyTotal;dialog.querySelector('[data-action="delete-chat-history"]').hidden=allScope;
  const filterDelete=dialog.querySelector('[data-action="delete-filter-chat"]');filterDelete.hidden=!allScope||!historyFilter;filterDelete.disabled=locked||!historyTotal;
  $('ncs-history-target-row').hidden=allScope||isFree();$('ncs-history-all-tools').hidden=!allScope;
  $('ncs-history-help').textContent=allScope?'모든 채팅에서 만든 그림을 모아 봐요. 지운 채팅이나 이름이 바뀐 카드의 그림도 여기서 정리할 수 있어요.':'편집으로 불러오면 당시 최종 프롬프트와 생성 설정을 이번 생성에 써요. "채팅 기본 복장"과 설정 탭 값은 바뀌지 않아요.';
  for(const b of dialog.querySelectorAll('[data-history-scope]'))b.setAttribute('aria-pressed',String(b.dataset.historyScope===historyScope));
  $('ncs-history-storage').textContent=allScope?`저장된 그림 전체 ${historyImageCount}장 · ${formatBytes(historyBytes)}`:'';
  const more=dialog.querySelector('[data-action="history-more"]');more.hidden=!historyHasMore;more.disabled=historyLoading;
  more.textContent=historyLoading?'불러오는 중…':`더 보기 (${historyItems.length} / ${historyTotal})`;
  $('ncs-history-count').textContent=historyTotal?`총 ${historyTotal}장 · ${historyItems.length}장 표시 중`:'';
}
const formatBytes=n=>n>=1073741824?`${(n/1073741824).toFixed(2)} GB`:n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.max(0,Math.round(n/1024))} KB`;
// Readable name for a chat key: the chat file name (which usually starts with the character name).
function chatLabel(key) {
  try{const o=JSON.parse(key);if(o.free)return '프리샷';const name=String(o.chat??o.card??'').trim()||'알 수 없는 채팅';return o.group?`그룹 · ${name}`:name;}catch{return '알 수 없는 채팅';}
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
  if(!confirm(`${what} 삭제할까요?\n원본 PNG와 생성 기록이 서버에서 지워지며 되돌릴 수 없어요.${attached?`\n지금 채팅 본문 아래에 붙인 그림 ${attached}장도 함께 빠져요.`:''}${elsewhere?'\n다른 채팅에 붙여 둔 그림이 있었다면 그 채팅에서는 "찾을 수 없는 그림" 안내로 바뀌어요.':''}${all&&serverFeatures.includes('draft-delete')?'\n이 채팅의 마지막 작업 기억(그리기창 작업)도 함께 지워져요.':''}`))return null;
  attaching=true;updateAttachButtons();
  try {
    const deleted=new Set(),skipped=[];
    for(const [key,list] of groups){
      let response;
      try{response=list==='all'&&serverFeatures.includes('draft-delete')
        ?await whileDeletingWork([key],()=>api('/delete',{method:'POST',body:{chatKey:key,all:true}}),r=>r.workDeleted?[key]:[])
        :await api('/delete',{method:'POST',body:list==='all'?{chatKey:key,all:true}:{chatKey:key,ids:list}});}
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
    notice(added.duplicate?'이 메시지에 이미 넣은 이미지예요.':'선택한 RP 메시지의 설정된 위치에 그림을 넣었어요. 본문은 그대로 유지돼요.');
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
// --- History → preset: saves this image's generation options as a new preset without touching current work.
let historyPresetTarget=null;
const historyPresetControls=item=>item.options?(historyPresetTarget===item.id?`<div class="ncs-wardrobe-save ncs-preset-form"><label>새 프리셋 이름<input id="ncs-history-preset-name" maxlength="80" placeholder="예: 이 그림 설정"></label><small>이 그림의 생성 설정·공통 태그를 저장해요. 인물·장면은 제외하고 seed는 새로 뽑아요.</small>${commonPositiveOf(item)===null?'<small>공통 Positive는 현재 설정값을 사용해요.</small>':''}<div class="ncs-row ncs-form-actions"><button type="button" class="ncs-primary" data-history-preset-save="${esc(item.id)}">저장</button><button type="button" data-history-preset-cancel>취소</button></div></div>`:''):'';
function historyActions(item,{editable=false,attached=false}={}){
  const id=esc(item.id),menu=`ncs-history-menu-${id}`,save=saveMenu(item,`ncs-history-save-${item.id}`);
  const more=[editable?`<button type="button" data-history-id="${id}">불러오기<small>이 그림의 작업을 그리기창으로 가져와요.</small></button>`:'',editable&&!isFree()?`<button type="button" data-history-attach="${id}">본문에 넣기</button>`:'',
    item.options?`<button type="button" data-history-preset="${id}">설정을 프리셋으로</button>`:'',`<button type="button" data-history-free="${id}">프리샷으로 보내기</button>`,
    editable&&attached?`<button type="button" data-history-detach="${id}">이 채팅의 첨부 모두 빼기</button>`:''].join('');
  return `<div class="ncs-history-actions">${save.button}<button type="button" data-history-delete="${id}" class="ncs-danger-outline">삭제</button><button type="button" data-image-more="${menu}" aria-controls="${menu}" aria-expanded="false" aria-haspopup="true" aria-label="이력 그림 더 보기">⋯</button></div>${save.menu}<div id="${menu}" class="ncs-image-popup" popover="manual" hidden role="group" aria-label="이력 그림 작업">${more}</div>${historyPresetControls(item)}`;
}
// The common Positive is merged into the base prompt. It can be recovered only when the rest of the base is
// exactly what the scene contributed; otherwise the settings tab's current value is used (and said so).
function commonPositiveOf(item){
  const a=item.assembled,sc=item.snapshot?.scene;if(!a||!sc)return null;
  const count={boy:0,girl:0,other:0};
  for(const c of a.characters??[]){const sub=(c.prompt??'').split(',')[0].trim();if(count[sub]!==undefined)count[sub]++;}
  const tags=Object.entries(count).filter(([,n])=>n).map(([k,n])=>`${n}${k}${n===1?'':'s'}`);
  const tail=[...tags,sc.location,sc.lighting,sc.camera,sc.interaction].filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()).join(', ');
  const base=String(a.base??'');
  if(!tail)return base;if(base===tail)return '';if(base.endsWith(`, ${tail}`))return base.slice(0,-(tail.length+2));
  return null;
}
function saveHistoryPreset(id){
  const item=historyItems.find(x=>x.id===id);if(!item?.options)return;
  const s=settings(),name=($('ncs-history-preset-name')?.value??'').trim();if(!name)throw new Error('새 프리셋 이름을 적어 주세요.');
  if(s.imagePresets.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new Error('같은 이름의 프리셋이 있어요. 다른 이름을 적어 주세요.');
  const recovered=commonPositiveOf(item),options={...freeOptions({...DEFAULTS.options,...item.options}),seed:-1,scheduler:DEFAULTS.options.scheduler};
  const preset=captureImagePreset({positive:recovered??s.positive,negative:typeof item.assembled?.negative==='string'?item.assembled.negative:s.negative,options},uuid(),name);
  s.imagePresets=validateImagePresets([...s.imagePresets,preset]);ctx().saveSettingsDebounced();
  historyPresetTarget=null;renderImagePresets();renderHistory();
  notice(`새 프리셋 ‘${name}’로 저장했어요. 공통 Positive는 ${recovered===null?'지금 설정 탭 값':'이 그림'}에서 가져왔어요. 지금 작업 중인 설정은 그대로예요. 쓰려면 프리셋에서 골라 주세요.`);
}
// What was actually sent for a history image. Built only when opened, from data the list already has.

function promptText(item){
  const a=item.assembled??{},o=item.options??{},lines=[`모델: ${MODELS[o.model]?.label??o.model??''} · ${o.width??'?'}×${o.height??'?'} · 스텝 ${o.steps??'?'} · seed ${item.seed??o.seed??''}`,'',`[공통 Positive]\n${a.base??''}`,`[공통 Negative]\n${a.negative??''}`];
  (a.characters??[]).forEach((c,i)=>lines.push(`[인물 ${i+1}${c.name?` · ${c.name}`:''}${c.position&&c.position!=='auto'?` · ${c.position}`:''}]\n${c.prompt??''}${c.negative?`\nNegative: ${c.negative}`:''}`));
  return lines.join('\n\n');
}
async function copyRaw(){
  if(!raw){notice('복사할 추출 응답이 없어요.');return;}
  $('ncs-raw-copy').textContent='응답 복사';
  await copyText(raw,dialog);$('ncs-raw-copy').textContent='복사됨';notice('추출 응답을 복사했어요.');
}
function renderHistory() {
  closeImageMenu();
  // A refresh replaces cards (including images); keep the visible tab's offset.
  rememberScroll();
  renderHistoryTarget();
  const chat=ctx().chat??[],current=keyOf();
  if(historyScope==='all'){
    renderHistoryFilter();
    $('ncs-history').innerHTML=historyItems.length?historyItems.map(item=>{
      const id=esc(item.id),file=imageDownload(item),here=item.chatKey===current;
      return `<article class="ncs-history-card${selectedIds.has(item.id)?' ncs-picked':''}"><label class="ncs-check ncs-pick"><input type="checkbox" data-history-pick="${id}" ${selectedIds.has(item.id)?'checked':''}>선택</label><button type="button" class="ncs-image-open" data-view-history="${id}" aria-label="생성 이력 크게 보기"><img loading="lazy" src="${esc(item.image)}" alt="생성 이력"></button><small class="ncs-chat-name${here?' ncs-here':''}">${esc(chatLabel(item.chatKey))}${here?' · 지금 채팅':''}</small><small class="ncs-history-date">${esc(shortDate(item.created))}</small>${historyActions(item)}</article>`;
    }).join(''):'<p>저장된 그림이 없어요.</p>';
    updateAttachButtons();restoreScroll();return;
  }
  $('ncs-history').innerHTML=historyItems.length?historyItems.map(item=>{
    const id=esc(item.id),file=imageDownload(item),attached=hasInlineImage(chat,item);
    return `<article class="ncs-history-card${selectedIds.has(item.id)?' ncs-picked':''}"><label class="ncs-check ncs-pick"><input type="checkbox" data-history-pick="${id}" ${selectedIds.has(item.id)?'checked':''}>선택</label><button type="button" class="ncs-image-open" data-view-history="${id}" aria-label="생성 이력 크게 보기"><img loading="lazy" src="${esc(item.image)}" alt="생성 이력"></button><small class="ncs-history-date">${esc(shortDate(item.created))}</small>${historyActions(item,{editable:true,attached})}</article>`;
  }).join(''):'<p>아직 생성 이력이 없어요.</p>';
  updateAttachButtons();restoreScroll();
}
async function loadHistory({append=false}={}) {
  const startKey=workKey(),allScope=historyScope==='all';
  if(!startKey&&!allScope){$('ncs-history').innerHTML='<p>채팅을 먼저 열어 주세요. 모든 채팅 보기에서는 채팅을 열지 않아도 그림을 정리할 수 있어요.</p>';updateHistoryTools();return;}
  if(append&&historyLoading)return;
  const offset=append?historyItems.length:0,limit=append?HISTORY_PAGE:Math.min(100,Math.max(HISTORY_PAGE,historyItems.length)); // a refresh keeps what was already shown
  const request=++historyRequest;historyLoading=true;updateHistoryTools();
  try {
    const query=allScope?`scope=all${historyFilter?`&chatKey=${encodeURIComponent(historyFilter)}`:''}`:`chatKey=${encodeURIComponent(startKey)}`;
    const data=await api(`/history?${query}&offset=${offset}&limit=${limit}`);
    if(request!==historyRequest||(!allScope&&workKey()!==startKey)||historyScope!==(allScope?'all':'chat'))return;
    if(allScope&&data.scope!=='all'){historyItems=[];historyTotal=0;historyHasMore=false;$('ncs-history').innerHTML='<p>모든 채팅 보기는 서버 플러그인 v0.1.0이 필요해요. 서버 플러그인을 업데이트하고 실리태번을 재시작해 주세요.</p>';return;}
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
  if(busy||draftLoading)throw new Error('진행 중인 작업이 끝난 뒤 불러와 주세요.');
  const item=historyItems.find(x=>x.id===id);if(!item)return;
  scene={...blankScene(),...clone(item.snapshot?.scene??{})};scene.source=null;
  const known=c=>c.temp||settings().profiles.some(p=>p.id===c.id);
  scene.characters=scene.characters.filter(known);
  if(Array.isArray(scene.moments)&&scene.moments.length>1){for(const m of scene.moments)m.scene.characters=(m.scene.characters??[]).filter(known);scene.momentIndex=Math.min(Math.max(0,Number(scene.momentIndex)||0),scene.moments.length-1);}
  else{scene.moments=[];scene.momentIndex=0;}
  $('ncs-moment-wish').value=typeof scene.momentWish==='string'?scene.momentWish:'';lastLink=null;linkTarget=null;
  if(isFree())$('ncs-free-text').value=typeof item.snapshot?.freeText==='string'?item.snapshot.freeText:'';
  dropUndo();
  raw=item.snapshot?.rawExtraction??'';finalOverride=restoredFinal=clone(item.assembled);optionsOverride=clone(item.options);
  result=item;revision++;renderScene({forceFinal:true});renderResult();showTab('scene');
  rememberDraft();
  notice('당시 최종 프롬프트와 생성 설정(seed 포함)을 불러왔어요. 설정 탭 값과 "채팅 기본 복장"은 바뀌지 않아요.');
}
// 이력 → 프리샷: the image's scene (the chosen candidate only), final prompt and one-off options land in 프리샷.
// What was in 프리샷 before can come back with 되돌리기.
async function sendToFree(id){
  if(busy||attaching||draftLoading)throw new Error('진행 중인 작업이 끝난 뒤 보내 주세요.');
  const item=historyItems.find(x=>x.id===id);if(!item)return;
  if(!isFree())await setMode('free');
  const before={...captureWork(),undoClear:null,targetShown,label:'이력에서 가져왔어요. 원래 프리샷 작업은 되돌리기로 돌아와요.'};
  const known=c=>c.temp||settings().profiles.some(p=>p.id===c.id),snap=clone(item.snapshot?.scene??blankScene());
  scene={...blankScene(),...momentPart(snap),source:null};scene.characters=scene.characters.filter(known);
  raw='';finalOverride=restoredFinal=clone(item.assembled);optionsOverride=clone(item.options);result=item;
  $('ncs-free-text').value=typeof item.snapshot?.freeText==='string'?item.snapshot.freeText:'';
  undoClear=before;revision++;renderScene({forceFinal:true});renderResult();renderUndo();showTab('scene');
  rememberDraft();
  notice('이력의 장면·프롬프트·생성 설정을 프리샷으로 가져왔어요. 채팅과 상관없이 고쳐서 다시 그릴 수 있어요. 원래 프리샷 작업은 되돌리기로 돌아와요.');
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
  clean.messageButton=next.messageButton===true;
  if(typeof next.extractionTemperature==='number'&&next.extractionTemperature>=0&&next.extractionTemperature<=2)clean.extractionTemperature=next.extractionTemperature;
  clean.retainRawExtraction=false; // importing a backup must not enable raw response retention
  clean.allowAnlas=false; // a shared backup must never switch on paid generation by itself
  if(typeof clean.skin!=='string'||!skinById(clean.skin))clean.skin=DEFAULT_SKIN;
  if(!['describe','direct'].includes(clean.profileInputMode))clean.profileInputMode=DEFAULTS.profileInputMode;
  if(!confirm('현재 프로필과 공통 설정을 이 백업으로 바꿀까요? 현재 설정을 내보낸 뒤 진행할 수 있어요.'))return;
  ctx().extensionSettings[KEY]=clean;ctx().saveSettingsDebounced();renderChatImages();scene=blankScene();finalOverride=null;optionsOverride=null;revision++;renderSettings();renderProfiles();editProfile();renderScene();useSkin(clean.skin).catch(()=>{});notice('백업을 가져왔어요. Anlas 사용 가능성 허용과 추출 원문 보관은 꺼진 상태로 가져왔어요.');
}
async function onAction(action,el) {
  switch(action) {
    case 'close':rememberScroll();dialog.close();break;
    case 'dismiss-compat':compatDismissed=true;renderCompat();break;
    case 'cancel-extract':if(!cancelExtraction())notice('진행 중인 추출이 없어요.');break;
    case 'target-more':targetShown+=TARGET_STEP;renderTargets();break;
    case 'target-latest':targetShown=TARGET_STEP;chooseTarget('');break;
    case 'target-message':chooseTarget(el.dataset.messageIndex);break;
    case 'extract':await extract();break;
    case 'blank':clearWork();break;
    case 'undo-clear':undoClearWork();break;
    case 'free-fill':await freeFill();break;
    case 'add-character':addCharacter($('ncs-add-profile').value);break;
    case 'add-temp':addTemp();break;
    case 'generate':await generate();break;
    case 'missing-proceed':await proceedMissingDialog();break;
    case 'missing-cancel':closeMissingDialog();notice('생성하지 않았어요. 위 경고 상자에서 프로필을 만들거나 연결할 수 있어요.');break;
    case 'missing-reenable':setSkipMissingWarning(false);renderSceneExtras();notice('이 채팅에서 생성 전 경고창을 다시 띄워요.');break;
    case 'same-seed':await generate('same');break;
    case 'new-seed':await generate('new');break;
    case 'attach':await putImageInChat(result,Number($('ncs-result').querySelector('[data-image-target]')?.value));break;
    case 'detach':await removeImageFromChat(result);break;
    case 'new-profile':case 'clear-profile-form':{
      if(extraction?.kind==='profile')cancelExtraction(''); // a late conversion result must not fill the emptied form
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
    case 'reset-final':changed();break;
    case 'status':await refreshStatus();break;
    // 프리셋 저장: overwrite the selected preset, or create one when none is selected.
    case 'save-preset':saveImagePreset(!!settings().imagePresets.find(p=>p.id===settings().imagePresetId));break;
    case 'save-preset-as':saveImagePreset(false);break;
    case 'new-preset':{
      const s=settings(),blank=!s.positive&&!s.negative&&JSON.stringify(s.options)===JSON.stringify({...DEFAULTS.options,scheduler:s.options.scheduler});
      if(!blank&&!confirm('공통 포지·네거를 비우고 NAI 생성 설정을 기본값으로 바꿔서 새 프리셋을 시작할까요? 저장해 둔 프리셋은 그대로예요.'))break;
      s.imagePresetId='';s.positive='';s.negative='';s.options=clone(DEFAULTS.options);optionsOverride=null;
      ctx().saveSettingsDebounced();changed();renderSettings();
      $('ncs-common-preset-name').value='';$('ncs-common-preset-name').focus({preventScroll:true});$('ncs-common-preset-name').scrollIntoView({block:'center',behavior:'smooth'});
      notice('새 프리셋을 시작했어요. 포지·네거와 생성 설정을 정한 뒤 이름을 넣고 프리셋 저장을 눌러 주세요.');break;
    }
    case 'delete-preset':{
      const s=settings(),id=s.imagePresetId;if(!id)return;
      if(!confirm('선택한 이미지 프리셋을 삭제할까요? 현재 입력된 프롬프트와 생성 설정은 유지돼요.'))return;
      s.imagePresets=s.imagePresets.filter(p=>p.id!==id);s.imagePresetId='';ctx().saveSettingsDebounced();renderImagePresets();notice('이미지 프리셋을 삭제했어요. 현재 값은 유지돼요.');break;
    }
    case 'refresh-extraction-profiles':renderExtractionProfiles();break;
    case 'gen-restore-default':optionsOverride=null;revision++;updateFinal();renderGenBox();notice('기본 생성 설정으로 돌아왔어요. 최종 프롬프트는 그대로예요.');break;
    case 'gen-preset-overwrite':{const s=settings(),p=s.imagePresets.find(p=>p.id===s.imagePresetId);if(!p)break;if(!confirm(`‘${p.name}’ 프리셋을 지금 값으로 덮어쓸까요?`))break;saveImagePreset(true,p.name);break;}
    case 'gen-preset-new':genNaming=true;renderGenBox();$('ncs-gen-preset-name').focus({preventScroll:true});break;
    case 'gen-preset-new-cancel':genNaming=false;renderGenBox();break;
    case 'gen-preset-new-confirm':saveImagePreset(false,$('ncs-gen-preset-name').value);genNaming=false;$('ncs-gen-preset-name').value='';renderGenBox();break;
    case 'wardrobe-add':addWardrobeRow().querySelector('[data-w="name"]').focus({preventScroll:true});break;
    case 'wardrobe-remove':{el.closest('.ncs-wardrobe-item')?.remove();if(!$('ncs-wardrobe-list').children.length)renderWardrobeForm([]);notice('옷을 뺐어요. 프로필 저장을 눌러야 반영돼요.');break;}
    case 'extraction-recommended':settings().extractionMaxTokens=RECOMMENDED_MAX_TOKENS;$('ncs-extraction-max-tokens').value=RECOMMENDED_MAX_TOKENS;revision++;ctx().saveSettingsDebounced();notice(`독립 추출 응답 한도를 권장값 ${RECOMMENDED_MAX_TOKENS}로 바꿨어요. 실제로 쓰는 양은 응답 길이만큼이에요.`);break;
    case 'copy-raw':await copyRaw();break;
    case 'draft-retry':await retryDraft();break;
    case 'delete-all-work':await deleteAllWork();break;
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
    case 'delete-chat-history':await deleteImages({all:true,chatKey:workKey()});break;
    case 'delete-filter-chat':if(historyFilter)await deleteImages({all:true,chatKey:historyFilter});break;
    case 'delete-result':if(result)await deleteImages({ids:[result.id]});break;
    case 'export':exportSettings();break;
  }
}
function bindEvents() {
  $('ncs-target-label').addEventListener('click',()=>{rememberTargetScroll();targetListRendered=false;}); // before the native details toggle
  $('ncs-target-scroll').addEventListener('scroll',rememberTargetScroll,{passive:true});
  $('ncs-target-picker').addEventListener('toggle',()=>renderTargets());
  dialog.addEventListener('click',event=>{
    const el=event.target.closest('button,a');if(!el)return;
    Promise.resolve().then(async()=>{
      if(el.dataset.cleanSave){const id=el.dataset.cleanSave;await saveCleanImage({id,image:`/user/images/naice-shot/${id}.png`});notice('메타데이터를 뺀 공유용 PNG를 저장했어요.');}
      else if(el.dataset.tab)showTab(el.dataset.tab);
      else if(el.dataset.action)await onAction(el.dataset.action,el);
      else if(el.dataset.historyScope)setHistoryScope(el.dataset.historyScope);
      else if(el.dataset.profileMode)setProfileMode(el.dataset.profileMode);
      else if(el.dataset.mode)await setMode(el.dataset.mode);
      else if(el.dataset.historyFree)await sendToFree(el.dataset.historyFree);
      else if(el.dataset.moment!==undefined)switchMoment(Number(el.dataset.moment));
      else if(el.dataset.tempFrom!==undefined)addTemp(el.dataset.tempFrom);
      else if(el.dataset.tempSave)tempToProfile(el.dataset.tempSave);
      else if(el.dataset.tempConfirm){const t=scene.characters.find(c=>c.id===el.dataset.tempConfirm);if(t){t.needsCheck=false;changed();renderScene();}}
      else if(el.dataset.missingDo)await missingAction(el.dataset.missingDo,el.dataset.missingName);
      else if(el.dataset.quickProfileName!==undefined)openQuickProfile(el.dataset.quickProfileName);
      else if(el.dataset.profile)editProfile(el.dataset.profile);
      else if(el.dataset.remove){scene.characters=scene.characters.filter(c=>c.id!==el.dataset.remove);changed();renderScene();}
      else if(el.dataset.saveOutfit){if(isChatDefaultNow(el.dataset.saveOutfit))await clearChatOutfit(el.dataset.saveOutfit);else await saveOutfit(el.dataset.saveOutfit);}
      else if(el.dataset.toWardrobe){wardrobeTarget=wardrobeTarget===el.dataset.toWardrobe?null:el.dataset.toWardrobe;renderScene();$('ncs-wardrobe-name')?.focus({preventScroll:true});}
      else if(el.dataset.wardrobeConfirm)saveToWardrobe(el.dataset.wardrobeConfirm);
      else if(el.dataset.wardrobeCancel!==undefined){wardrobeTarget=null;renderScene();}
      else if(el.dataset.resetOutfit){scene.characters.find(c=>c.id===el.dataset.resetOutfit).manualOutfit=null;changed();renderScene();}
      else if(el.dataset.historyId)restoreHistory(el.dataset.historyId);
      else if(el.dataset.historyPreset){historyPresetTarget=el.dataset.historyPreset;renderHistory();$('ncs-history-preset-name')?.focus({preventScroll:true});}
      else if(el.dataset.historyPresetSave)saveHistoryPreset(el.dataset.historyPresetSave);
      else if(el.dataset.historyPresetCancel!==undefined){historyPresetTarget=null;renderHistory();}
      else if(el.dataset.viewResult!==undefined)viewImage(result);
      else if(el.dataset.viewHistory)viewImage(historyItems.find(x=>x.id===el.dataset.viewHistory));
      else if(el.dataset.historyAttach){const item=historyItems.find(x=>x.id===el.dataset.historyAttach),chosen=$('ncs-history-target').value;await putImageInChat(item,chosen===''?preferredTarget(item):Number(chosen));}
      else if(el.dataset.historyDelete)await deleteImages({ids:[el.dataset.historyDelete]});
      else if(el.dataset.historyDetach)await removeImageFromChat(historyItems.find(x=>x.id===el.dataset.historyDetach));
    }).catch(e=>notice(e.message,true)).finally(()=>rememberDraft());
  });
  // Thumbnails whose PNG was removed by hand show a short note instead of a broken image.
  dialog.addEventListener('error',event=>{const img=event.target;if(img?.tagName==='IMG')img.closest('.ncs-image-open')?.classList.add('ncs-missing');},true);
  $('ncs-profile-form').addEventListener('submit',event=>{event.preventDefault();try{saveProfile();}catch(e){notice(e.message,true);}});
  dialog.addEventListener('input',event=>{
    const el=event.target;
    if(el.closest('#ncs-profile-form')||el.id==='ncs-import'||el.id==='ncs-raw')return;
    try {
      if(el.closest('#ncs-work-fields'))dropUndo();
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
      if(el.id==='ncs-extraction-temperature'){const v=el.value.trim(),n=Number(v);if(v===''){delete settings().extractionTemperature;}else if(Number.isFinite(n)&&n>=0&&n<=2)settings().extractionTemperature=n;else throw new Error('추출 온도는 0~2 사이로 입력하거나 비워 두세요.');ctx().saveSettingsDebounced();return;}
      if(el.id==='ncs-size-preset'){
        const preset=SIZE_PRESETS[el.value];if(preset){optionsOverride=null;const o=settings().options;o.width=preset.width;o.height=preset.height;/* set together: a half-changed size would read as custom */ctx().saveSettingsDebounced();revision++;updateFinal();updatePresetState();}return;
      }
      if(el.id==='ncs-free-text'){dropUndo();return;}
      if(el.dataset.gen){editGenField(el);return;}
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
      if(el.dataset.field){const c=scene.characters.find(c=>c.id===el.closest('[data-character]').dataset.character);c[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;if(el.dataset.field==='position')c.positionManual=true;changed();if(el.dataset.field==='manualOutfit')refreshDefaultButton(el.closest('[data-character]'),c.id);return;}
      if(el.hasAttribute('data-chat-outfit')){
        const id=el.closest('[data-character]').dataset.character,p=settings().profiles.find(p=>p.id===id);if(!p||el.value==='custom')return;
        if(el.value==='default'){clearChatOutfit(id).catch(e=>notice(e.message,true));return;}
        const w=(p.wardrobe??[]).find(w=>`w:${w.id}`===el.value);if(!w)return;const value=w.outfit;
        setChatOutfit(id,value,{note:`${p.name}의 채팅 기본 복장을 "${w.name}"(으)로 지정했어요. 이번 그림에도 적용했어요.`}).catch(e=>notice(e.message,true));return;
      }
      if(el.dataset.temp){const t=scene.characters.find(c=>c.id===el.closest('[data-character]').dataset.character&&c.temp);if(!t)return;t[el.dataset.temp]=el.value;if(el.dataset.temp==='name'){t.entityName=el.value;el.closest('[data-character]').querySelector('strong').textContent=el.value||'이름 없는 인물';}changed();return;}
      if(el.hasAttribute('data-wear-once')){if(el.value)wearOnce(el.closest('[data-character]').dataset.character,el.value);return;}
      if(el.hasAttribute('data-lock')){const id=el.closest('[data-character]').dataset.character;saveOutfit(id,el.checked).catch(e=>notice(e.message,true));return;}
      for(const field of ['location','lighting','camera','interaction'])if(el.id===`ncs-${field}`){scene[field]=el.value;changed();return;}
      if(el.id==='ncs-message-button'){settings().messageButton=el.checked;ctx().saveSettingsDebounced();setMessageButtons(el.checked);notice(el.checked?'메시지의 추가 메뉴(…)에 그리기 버튼을 넣었어요.':'메시지의 그리기 버튼을 뺐어요.');return;}
      if(el.id==='ncs-image-placement'){settings().imagePlacement=el.value==='above'?'above':'below';ctx().saveSettingsDebounced();renderChatImages();notice(el.value==='above'?'채팅 속 그림을 메시지 글 위에 보여줘요.':'채팅 속 그림을 메시지 글 아래에 보여줘요.');return;}
      if(el.id==='ncs-save-zip'){settings().saveAsZip=el.checked;ctx().saveSettingsDebounced();renderSelectionSave();return;}
      if(el.id==='ncs-retain-raw'){
        if(el.checked&&!confirm('추출 응답을 이력에 보관할까요?\n응답에는 대화 인용이나 인물·장면 정보가 포함될 수 있어요. 앞으로 생성하는 그림의 이력과 마지막 작업에 저장되며, PNG에는 추가되지 않아요. 문제 확인·제보가 필요할 때만 켜 주세요.'))el.checked=false;
        settings().retainRawExtraction=el.checked;ctx().saveSettingsDebounced();renderRawRetention();return;
      }
      const settingMap={'ncs-positive':'positive','ncs-negative':'negative','ncs-format':'format','ncs-recent':'recent','ncs-include-user':'includeUser','ncs-schema':'structuredOutput','ncs-allow-anlas':'allowAnlas'};
      const optionMap={'ncs-model':'model','ncs-steps':'steps','ncs-scale':'scale','ncs-seed':'seed','ncs-cfg':'cfgRescale','ncs-sampler':'sampler'};
      if(settingMap[el.id])settings()[settingMap[el.id]]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
      if(optionMap[el.id]){optionsOverride=null;settings().options[optionMap[el.id]]=el.type==='number'?Number(el.value):el.value;if(el.id==='ncs-steps'&&Number(el.value)>FREE_STEPS){settings().options.steps=FREE_STEPS;el.value=FREE_STEPS;}}
      if(settingMap[el.id]||optionMap[el.id]){
        ctx().saveSettingsDebounced();
        // Only the common prompts change the assembled prompt; other settings must not discard a manual edit.
        if(el.id==='ncs-positive'||el.id==='ncs-negative')changed();
        else{revision++;if(optionMap[el.id])$('ncs-size-preset').value=sizePresetOf(settings().options);updateFinal();}
        updatePresetState();
      }
    }catch(e){notice(e.message,true);}finally{scheduleDraft();}
  });
  $('ncs-import').addEventListener('change',event=>importSettings(event.target.files[0]).catch(e=>notice(e.message,true)));
}
function chatChanged() {
  closeImageMenu();
  const key=keyOf();if(key===chatKey)return;
  const oldKey=chatKey;if(oldKey){const oldWork=isFree()?spare.chat:captureWork();if(oldWork)rememberDraft(oldKey,oldWork,{flush:true});}
  if(!isFree()){draftLoadToken++;draftLoading=false;$('ncs-work-fields').disabled=false;}
  closeMissingDialog();pendingBind=null;quickProfileName='';chatKey=key;
  if(isFree()){
    // 프리샷 work has nothing to do with the chat: keep it, and start the chat's work fresh for when 챗샷 returns.
    spare.chat=blankWork();
    if(dialog){renderTargets();renderMatching();$('ncs-chat-label').textContent=ctx().getCurrentChatId?.()??'열린 채팅 없음';}
    renderChatImages();return;
  }
  pauseDraftCapture=true;try{cancelExtraction('');}finally{pauseDraftCapture=false;}
  wardrobeTarget=null;pendingTempConvert=null;lastLink=null;linkTarget=null;task++;revision++;scene=blankScene();draftSource=null;raw='';finalOverride=null;optionsOverride=null;restoredFinal=null;result=null;undoClear=null;historyItems=[];historyTotal=0;historyHasMore=false;selectedIds.clear();
  if(dialog){targetScroll=0;targetReveal=false;targetListRendered=false;targetShown=TARGET_STEP;$('ncs-target').value='';$('ncs-moment-wish').value='';$('ncs-target-picker').open=false;renderTargets();renderMatching();renderScene({forceFinal:true});renderResult();renderUndo();renderHistory();$('ncs-chat-label').textContent=ctx().getCurrentChatId?.()??'열린 채팅 없음';notice('채팅이 바뀌었어요. 이 채팅의 연결·복장과 이력을 사용해요.');}
  renderChatImages();
  recallDraft().catch(e=>notice(e.message,true));
}
const activeTab=()=>dialog?.querySelector('[data-tab][aria-selected="true"]')?.dataset.tab??'scene';
async function open() {
  rememberScroll();
  chatChanged();renderTargets();renderProfiles();renderScene();renderExtractionProfiles();
  if(!dialog.open)dialog.showModal();
  restoreScroll();
  // The chat may have changed while the panel was closed: reload the visible history instead of showing it empty.
  if(activeTab()==='history')loadHistory().catch(e=>notice(e.message,true));
  const checking=!compatChecked;if(checking)$('ncs-work-fields').disabled=true;
  try{await checkServer();}finally{if(checking&&!draftLoading)$('ncs-work-fields').disabled=false;}
}
// The settings-panel entry uses SillyTavern's own drawer markup (same border and toggle as other
// extensions) and is attached immediately, before the panel file loads, so it keeps its place in the list.
let panelReady=null;
function mountSettingsDrawer() {
  if(document.getElementById('ncs-extension-settings'))return;
  const holder=document.getElementById('extensions_settings2')??document.getElementById('extensions_settings');if(!holder)return;
  const box=document.createElement('div');box.id='ncs-extension-settings';box.className='ncs-extension-settings';
  box.innerHTML=`<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b class="ncs-drawer-title">${CAMERA_ICON}<span data-brand>${esc(brand())}</span></b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><div class="ncs-extension-body"><p>프로필 · 장면 편집 · 이미지 생성</p><button type="button" class="menu_button ncs-launch-button">${CAMERA_ICON}<span>${esc(brand())} 열기</span></button></div></div></div>`;
  box.querySelector('.ncs-launch-button').addEventListener('click',()=>(panelReady??Promise.resolve()).then(open).catch(e=>notice(e.message,true)));
  holder.append(box);
}
async function initialize() {
  if(document.getElementById('naice-shot-dialog'))return;
  mountSettingsDrawer();
  settings();dialog=document.createElement('dialog');dialog.id='naice-shot-dialog';
  const template=await fetch(new URL('panel.html',import.meta.url));if(!template.ok)throw new Error('NAIce Shot 패널 파일을 읽지 못했어요.');
  dialog.innerHTML=await template.text();document.body.append(dialog);
  dialog.addEventListener('close',()=>{closeMissingDialog();rememberDraft(workKey(),null,{flush:true});});
  dialog.addEventListener('cancel',event=>{if(event.target===dialog)rememberScroll();});
  dialog.querySelector('.ncs-content').addEventListener('scroll',rememberScroll,{passive:true});
  $('ncs-missing-dialog').addEventListener('cancel',()=>{missingPrompt=null;}); // Escape closes only this box
  for(const tab of dialog.querySelectorAll('[data-tab]')){const icon=document.createElement('span');icon.className='ncs-tab-icon';icon.innerHTML=TAB_ICONS[tab.dataset.tab]??'';tab.prepend(icon);}
  $('ncs-version').textContent=`v${VERSION}`;setProfileMode(settings().profileInputMode,{save:false});renderSettings();renderProfiles();editProfile();renderTargets();bindEvents();chatKey=keyOf();renderProgress();renderModeUI();renderScene();$('ncs-chat-label').textContent=ctx().getCurrentChatId?.()??'열린 채팅 없음';
  const menu=document.getElementById('extensionsMenu');if(menu){const button=document.createElement('div');button.className='list-group-item flex-container flexGap5 ncs-menu-item';button.innerHTML=`<div class="extensionsMenuExtensionButton ncs-menu-icon">${CAMERA_ICON}</div><span data-brand>${esc(brand())}</span>`;button.tabIndex=0;button.setAttribute('role','button');button.addEventListener('click',()=>open().catch(e=>notice(e.message,true)));button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open().catch(e=>notice(e.message,true));}});menu.append(button);}
  renderBrand();
  // Apply the saved skin right away when it is the built-in one; file skins wait for detection.
  renderSkins();useSkin(skinById(settings().skin)?.file?DEFAULT_SKIN:settings().skin).catch(()=>{});
  detectSkins(new URL('./',import.meta.url).href).then(list=>{availableSkins=list;skinsDetected=true;return useSkin(settings().skin);}).catch(e=>console.warn('[NAIce Shot] skin detection failed',e?.message));
  bindImageMenus();
  window.addEventListener('beforeunload',event=>{if(!draftsEnabled)return;rememberDraft(workKey(),null,{flush:true});if([...drafts.entries.values()].some(e=>e.dirty||e.saving)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>rememberDraft(workKey(),null,{flush:true}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')rememberDraft(workKey(),null,{flush:true});});
  const c=ctx(),events=c.eventTypes??c.event_types;c.eventSource.on(events.CHAT_CHANGED,chatChanged);
  const refreshChatImages=()=>renderChatImages();
  for(const type of ['MESSAGE_RECEIVED','MESSAGE_SENT','MESSAGE_SWIPED','MESSAGE_DELETED','MESSAGE_EDITED'])if(events[type])c.eventSource.on(events[type],()=>{refreshChatImages();if(dialog.open){renderTargets();renderMatching();renderResult();renderHistory();updateFinal();}});
  document.getElementById('chat')?.addEventListener('click',event=>{
    const clean=event.target.closest('[data-ncs-inline-clean]');
    if(clean){event.preventDefault();const id=clean.dataset.ncsInlineClean;clean.disabled=true;saveCleanImage({id,image:`/user/images/naice-shot/${id}.png`}).then(()=>say('메타데이터를 뺀 공유용 PNG를 저장했어요.'),()=>say('공유용 PNG를 저장하지 못했어요. 원본으로 대체 저장하지 않았어요.',true)).finally(()=>{clean.disabled=false;});return;}
    const open=event.target.closest('[data-ncs-inline-view]');
    if(open){event.preventDefault();event.stopPropagation();try{const attachment=attachmentOf(open);viewImage({id:open.dataset.ncsInlineView,image:`/user/images/naice-shot/${open.dataset.ncsInlineView}.png`,chatKey:attachment.chatKey},{attachment});}catch(e){console.error('[NAIce Shot]',e.message);}return;}
    const button=event.target.closest('[data-ncs-inline-remove]');if(!button)return;
    event.preventDefault();const id=button.dataset.ncsInlineRemove,attachment=attachmentOf(button);
    removeMessageImage({id,image:`/user/images/naice-shot/${id}.png`,chatKey:attachment.chatKey},attachment).catch(e=>say(e.message,true));
  });
  const chatRoot=document.getElementById('chat');
  if(messageButtonsOn())setMessageButtons(true);
  if(chatRoot){let queued=false,hiddenChanged=false;new MutationObserver(records=>{
    hiddenChanged ||= records.some(r=>r.type==='attributes'&&r.attributeName==='is_system');
    if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refreshChatImages();if(hiddenChanged&&dialog.open)renderTargets();hiddenChanged=false;});
  }).observe(chatRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['mesid','is_system']});refreshChatImages();}
  for(const type of ['CONNECTION_PROFILE_CREATED','CONNECTION_PROFILE_UPDATED','CONNECTION_PROFILE_DELETED'])if(events[type])c.eventSource.on(events[type],()=>renderExtractionProfiles());
}
const start=()=>{panelReady=initialize();panelReady.catch(e=>console.error('[NAIce Shot]',e.message));};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
