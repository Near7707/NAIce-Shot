import { DEFAULTS, MODELS, clone, PROFILE_SCHEMA, profileDraftPrompt, parseProfileDraft, blankScene, validateProfiles, sourceValid,
  assemble, resolveOutfit, buildPayload, costGuard, usageOf, V5_ASK_AT, textSignature,
  BRAND, SIZE_PRESETS, sizePresetOf, VERSION, stripReasoningBlocks } from './core.mjs';
import { CAMERA_ICON, BRAND_ICON, TAB_ICONS, CLOSE_ICON } from './icons.mjs';
import { SKINS, DEFAULT_SKIN, detectSkins, applySkin, skinById, currentSkin } from './skins.mjs';
import { attachInlineImages, detachInlineImage, detachInlineImages, detachMessageImage, placeMessageImage, orderedInlineImages, placementOf, countInlineImages, hasInlineImage, imageDownload, renderInlineImages, visibleInlineImages, SAVE_NOTES, INLINE_LAYOUTS, INLINE_SIZES } from './inline-images.mjs';
import { matchChatProfiles, reconcileCharacters, attachSceneProfile, identityKey } from './matching.mjs';
import { freeScenePrompt, freeSceneSchema, parseFreeScene } from './free-scene.mjs';
import { confirmRefs, refsForExtraction, plainNames, stripRefMarks, suggestions, displayLength, displayText, lengthProblem, LENGTH_LIMITS } from './mentions.mjs';
import { setupChipField } from './chipfield.mjs';
import { planFreePeople, confirmText, applyFreePeople, migratePins } from './free-people.mjs';
import { momentExtractionPrompt, momentExtractionSchema, parseMoments, looksCut, foreignFields, dropLookWords } from './scene-extraction.mjs';
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
import { jumpTargets, locateSource, locateAttached } from './message-jump.mjs';
import {stableChatJson,comparableSavedMetadata,splitSavedChat,timedState} from './chat.mjs';
import {parseTags,cleanMarks,cleanPopupChats,setMark,forgetIds,forgetChat,starredIds,taggedIds,ownerOf,tagMatches,pickMatch,taggedFor} from './image-marks.mjs';

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
let historyScope='chat',historyFilter='',historyChats=[],historyPending=[],historyPendingBytes=0,historyBytes=0,historyImageCount=0,historyRequest=0;
// 0.1.84: ★ only (the history view lists favorites through the server's ID filter); the unfiltered count is kept for
// "delete all" questions. historyTagEdit: the card whose tag editor is open.
let historyMarkFilter=null,historyUnfiltered=null,historyTagEdit=null; // historyMarkFilter: null, 'star' (★ only) or 'tag' (# 태그, 0.1.86) — never both
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
const imagePlacement=()=>{const local=ctx().chatMetadata?.[KEY]?.imagePlacement;return ['above','below'].includes(local)?local:settings().imagePlacement==='below'?'below':'above';}; // 0.1.74: above unless 'below' was chosen
function renderPlacement(){const local=$('ncs-chat-image-placement');local.disabled=!keyOf();local.value=ctx().chatMetadata?.[KEY]?.imagePlacement??'';renderChatImageSummary();}
const inlineLayout=()=>INLINE_LAYOUTS.includes(settings().inlineLayout)?settings().inlineLayout:'slide';
const inlineSize=()=>INLINE_SIZES.includes(settings().inlineSize)?settings().inlineSize:'medium';
function renderChatImages(){renderInlineImages(ctx(),document.getElementById('chat'),keyOf(),{placement:imagePlacement(),layout:inlineLayout(),size:inlineSize()});if(messageButtonsOn())decorateMessages();}
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
// Whether a message shows its date is read for each message (UI-071-02: a theme may hide some dates only).
// All reads happen first and all changes after, so the page is laid out once per pass.
const stampVisible=stamp=>stamp.checkVisibility?stamp.checkVisibility({visibilityProperty:true}):stamp.offsetParent!==null;
function decorateMessages(){
  const root=document.getElementById('chat');if(!root)return;const chat=ctx().chat??[],plan=[];
  for(const el of root.querySelectorAll('.mes[mesid]')){
    const m=chat[Number(el.getAttribute('mesid'))],existing=el.querySelector('.ncs-mes-draw');
    if(!isSceneMessage(m)){if(existing)plan.push({existing});continue;}
    // 0.1.71: always visible, right after the message's date. Where the date is hidden, it goes to the end of the
    // extra button row instead (the 0.1.48 place). Checked again when the date shows or hides.
    const stamp=el.querySelector('.timestamp'),onDate=!!stamp&&stampVisible(stamp);
    if(existing&&(onDate?existing.previousElementSibling===stamp:!existing.classList.contains('ncs-mes-inline')))continue;
    plan.push({el,existing,stamp,onDate,add:true});
  }
  for(const {el,existing,stamp,onDate,add} of plan){
    existing?.remove();if(!add)continue;
    const button=messageButtonTemplate().cloneNode(true);
    if(onDate){button.classList.add('ncs-mes-inline');button.classList.remove('mes_button');stamp.after(button);continue;}
    el.querySelector('.extraMesButtons')?.append(button); // last in the row: themes that clip a crowded row cut from the start
  }
}
function setMessageButtons(on){
  const root=document.getElementById('chat');
  if(on){if(root&&!messageClickBound){root.addEventListener('click',onMessageButton,true);root.addEventListener('keydown',onMessageButton,true);messageClickBound=true;}decorateMessages();return;}
  if(root&&messageClickBound){root.removeEventListener('click',onMessageButton,true);root.removeEventListener('keydown',onMessageButton,true);}
  messageClickBound=false;for(const b of document.querySelectorAll('.ncs-mes-draw'))b.remove();
}
// 0.1.78: closing the panel or the enlarged view hands focus back to the message icon that opened it; on a phone that
// showed a blue frame until the next tap. The icon is released again (the keyboard keeps working: Tab starts anew).
document.addEventListener('close',event=>{
  if(event.target?.id!=='naice-shot-dialog'&&event.target?.id!=='ncs-viewer')return;
  requestAnimationFrame(()=>{const a=document.activeElement;if(a?.classList?.contains('ncs-mes-draw')||a?.closest?.('.ncs-inline-images'))a.blur();});
},true);
async function drawFromMessage(index){
  await (panelReady??Promise.resolve());
  if(busy||attaching||draftLoading){await open();notice('진행 중인 작업이 끝난 뒤 선택해 주세요.',true);return;}
  await open();
  if(isFree())await setMode('chat'); // the message button always draws in 챗샷; 프리샷 work waits as it was
  showTab('scene');
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
const tabNotices=new Map();
// 0.1.62: while something runs, its progress box says it (no second banner); a success notice folds away after a while
// (longer messages stay longer); errors stay until the next notice.
// While anything runs, every notice of the tab waits (errors too) and comes back when it ends (UI-062-02).
// Each notice folds on its own timer, so one tab's notice never cancels another tab's folding (UI-062-03).
// A warning the user must act on (keep) stays like an error (UI-062-01).
function renderNotice(){if(!dialog)return;const n=tabNotices.get(activeTab()),box=$('ncs-notice');
  box.hidden=!n?.message||!!progress||(!!n.until&&Date.now()>=n.until);
  // 0.1.79 (UI-078-03): the text sits in its own part next to a × button, and a long note scrolls inside a short box.
  if(typeof box.querySelector!=='function'){box.textContent=n?.message??'';box.classList?.toggle?.('ncs-error',n?.error===true);return;} // minimal test pages
  let text=box.querySelector(':scope > .ncs-notice-text');
  if(!text){box.textContent='';text=document.createElement('span');text.className='ncs-notice-text';
    const close=document.createElement('button');close.type='button';close.className='ncs-notice-close';close.setAttribute('aria-label','알림 닫기');close.title='알림 닫기';
    close.addEventListener('click',()=>{tabNotices.delete(activeTab());renderNotice();});box.append(text,close);}
  text.textContent=n?.message??'';box.scrollTop=0;box.classList.toggle('ncs-error',n?.error===true);}
// The shared core (also on the server) still says 스텝; the panel calls it Steps like Guidance and Seed (0.1.62).
const stepsWord=text=>String(text??'').replace(/(\d+)스텝/g,'$1 Steps').replace(/스텝은/g,'Steps는').replace(/스텝/g,'Steps');
function notice(message,error=false,tab=activeTab(),{keep=false}={}){
  const text=stepsWord(message),until=error||keep?0:Date.now()+Math.min(15000,5000+text.length*60);
  tabNotices.set(tab,{message:text,error,until});renderNotice();
  if(until)setTimeout(renderNotice,until-Date.now()+50);
}
// One main button per action; 장면 추출 serves both modes (챗샷 reads the chat, 프리샷 the written situation).
const BUTTON_LABELS={extract:['extract','장면 추출',['extract','free']],generate:['generate','이미지 생성',['generate']],profile:['convert-profile','태그로 변환',['profile']]};
function renderProgress() {
  if(!dialog)return;
  const box=$('ncs-progress');box.hidden=!progress;renderNotice();
  for(const [action,label,kinds] of Object.values(BUTTON_LABELS)){const b=dialog.querySelector(`[data-action="${action}"].ncs-action-main`)??dialog.querySelector(`[data-action="${action}"]`);if(b)b.textContent=kinds.includes(progress?.kind)?`${label} 중…`:label;}
  if(!progress)return;
  const sec=Math.max(0,Math.floor((Date.now()-progress.started)/1000)),time=sec<60?`${sec}초`:`${Math.floor(sec/60)}분 ${sec%60}초`;
  box.dataset.kind=progress.kind;
  const retry=progress.attempt>1?' · 다시 요청 (2/2)':'';
  $('ncs-progress-title').textContent=progress.kind==='extract'?`장면 추출 중${retry}`:progress.kind==='free'?`장면 추출 중${retry}`:progress.kind==='profile'?`프로필 태그 변환 중${retry}`:'NAI 이미지 생성 중';
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
// The history record of a picture (attachments store no prompt text). Read only when needed; one lookup per picture.
const recordLookups=new Map();
function findRecord(item){
  const cached=item.assembled?item:result?.id===item.id?result:historyItems.find(x=>x.id===item.id&&x.assembled);
  if(cached?.assembled)return Promise.resolve(cached);
  if(!item.chatKey)return Promise.resolve(null);
  const key=`${item.chatKey}\n${item.id}`;
  if(!recordLookups.has(key))recordLookups.set(key,(async()=>{
    for(let offset=0;;){
      const page=await api(`/history?chatKey=${encodeURIComponent(item.chatKey)}&offset=${offset}&limit=100`);
      const records=page.items??[],found=records.find(x=>x.id===item.id);
      if(found)return found;
      offset+=records.length;
      if(!records.length||page.hasMore===false||offset>=(page.total??offset))return null;
    }
  })().catch(e=>{recordLookups.delete(key);throw e;}));
  return recordLookups.get(key);
}
async function promptForImage(item) {
  if(!item.assembled&&!item.chatKey)throw new Error('이 그림의 프롬프트를 찾을 수 없어요. 이력에서 다시 열어 주세요.');
  const found=await findRecord(item);
  if(found?.assembled)return promptText(found);
  throw new Error('이 그림의 프롬프트 기록을 찾을 수 없어요.');
}
// 2026. 10. 27. 오후 12:27 — minutes, no seconds.
function shortDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('ko-KR',{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});}
// One history page for a range. With ★ only, the favorites' IDs go to the server, which keeps its own range rules.
function marks(){const s=settings();if(!s.imageMarks||typeof s.imageMarks!=='object')s.imageMarks={};return s.imageMarks;}
function historyPage({scope,filter,key,offset,limit,markFilter}){
  const all=['chats','all'].includes(scope);
  if(markFilter)return api('/history',{method:'POST',body:{...(all?{scope:'all',...(scope==='chats'?{kind:'chat'}:{}),...(filter?{chatKey:filter}:{})}:{chatKey:key}),ids:markFilter==='tag'?taggedIds(marks()):starredIds(marks()),offset,limit}});
  const query=all?`scope=all${scope==='chats'?'&kind=chat':''}${filter?`&chatKey=${encodeURIComponent(filter)}`:''}`:`chatKey=${encodeURIComponent(key)}`;
  return api(`/history?${query}&offset=${offset}&limit=${limit}`);
}
// A viewer owns its range and page cursor; background refreshes cannot mix in another range.
function historyGallery(){
  const scope=historyScope,filter=historyFilter,key=scope==='free'?FREE_KEY:keyOf(),all=['chats','all'].includes(scope),markFilter=historyMarkFilter;
  let offset=historyItems.length,pending=null;
  const gallery={items:[...historyItems],total:historyTotal,hasMore:historyHasMore,
    describe:item=>imageViewerOptions(item),
    waitForPage:()=>pending??Promise.resolve(),
    loadMore(){
      if(pending)return pending;if(!gallery.hasMore)return Promise.resolve();
      pending=(async()=>{
        const data=await historyPage({scope,filter,key,offset,limit:HISTORY_PAGE,markFilter});
        if(all&&(data.scope!=='all'||scope==='chats'&&data.kind!=='chat'))throw new Error('이력 범위를 확인하지 못했어요. 다시 열어 주세요.');
        const items=Array.isArray(data.items)?data.items:[];offset+=items.length;
        gallery.items.push(...items.filter(x=>!gallery.items.some(y=>y.id===x.id)));
        gallery.total=Number.isInteger(data.total)?data.total:gallery.total;gallery.hasMore=data.hasMore===true&&items.length>0;
      })().finally(()=>pending=null);return pending;
    },
    removed(id){const at=gallery.items.findIndex(x=>x.id===id);if(at>=0){gallery.items.splice(at,1);gallery.total=Math.max(0,gallery.total-1);offset=Math.max(0,offset-1);}}
  };return gallery;
}
// 0.1.70: the enlarged view's ⋯ matches the history card's ⋯ — 챗샷/프리샷으로 보내기, 설정을 프리셋으로, 본문에 넣기,
// 채팅에서 이 그림 빼기 — and ends with 메시지로 가기, or 이력에서 보기 for a picture opened from its message.
async function recordOf(item){const rec=await findRecord(item);if(!rec?.assembled)throw new Error('이 그림의 기록을 찾지 못했어요. 지워졌을 수 있어요.');return rec;}
function viewerActions(item,{attachment=null}={}){
  const here=item.chatKey===keyOf(),free=item.chatKey===FREE_KEY;
  // Leaving the enlarged view: errors go to the panel notice and a toast, since the view is closed.
  const away=fn=>()=>Promise.resolve().then(fn).catch(e=>{toast(e.message,true);notice(e.message,true);});
  const send=nextMode=>away(async()=>{const rec=await recordOf(item);await showPanel('scene');await importHistory(rec.id,nextMode,rec);});
  const actions=[
    {label:'챗샷으로 보내기',note:keyOf()?'지금 열린 채팅의 그리기창으로 가져와요.':'채팅을 먼저 열어 주세요.',disabled:!keyOf(),leave:true,run:send('chat')},
    {label:'프리샷으로 보내기',leave:true,run:send('free')},
    {label:'설정을 프리셋으로',note:'이력 카드에서 이름을 적어 저장해요.',leave:true,run:away(async()=>{const rec=await recordOf(item);if(!rec.options)throw new Error('이 그림에는 저장된 생성 설정이 없어요.');historyPresetTarget=rec.id;await goToHistoryCard(rec);})},
    {label:'본문에 넣기',note:here?'':free?'프리샷 그림은 채팅에 연결되어 있지 않아요.':'지금 열린 채팅에서 만든 그림만 넣을 수 있어요.',disabled:!here,leave:true,run:away(async()=>{const rec=await recordOf(item);await showPanel();openAttachPicker([rec]);})}];
  const count=here&&!attachment?attachedCount(item.id):0;
  if(count)actions.push({label:`채팅에서 이 그림 빼기${count>1?` (${count}곳)`:''}`,run:async()=>removeImageFromChat(await recordOf(item))});
  // 0.1.74: a chat picture can move above or below the text on its own, or go back to the default place.
  if(attachment){const entry=visibleInlineImages(attachment.message).find(x=>x.id===item.id),fallback=imagePlacement(),now=placementOf(entry,fallback),other=now==='above'?'below':'above';
    const move=(placement,done)=>away(async()=>{const r=await placeChatImage(item,attachment,placement);if(!r?.unverified)toast(done);}); // UI-072-01: no success note when the save could not be checked
    actions.push({label:other==='above'?'글 위로 옮기기':'글 아래로 옮기기',note:'이 그림만 옮겨요.',divider:true,leave:true,run:move(other,other==='above'?'그림을 글 위로 옮겼어요.':'그림을 글 아래로 옮겼어요.')});
    if(entry?.placement)actions.push({label:'기본 위치로 되돌리기',note:`지금 기본: 글 ${fallback==='above'?'위':'아래'}`,leave:true,run:move(null,'그림을 기본 위치로 되돌렸어요.')});}
  if(attachment)actions.push({label:'이력에서 보기',note:'이력 탭에서 이 그림 카드로 가요.',divider:true,leave:true,run:away(()=>goToHistoryCard(item))});
  else{const jumps=jumpChoices(item);
    if(Array.isArray(jumps))jumps.forEach((j,i)=>actions.push({label:j.label,note:j.note,divider:i===0,leave:true,run:away(()=>goToMessage(item,j.index,j.kind))}));
    else actions.push({label:'메시지로 가기',note:jumps?.disabled??'',disabled:true,divider:true,run:()=>{}});}
  return actions;
}
function imageViewerOptions(item,{attachment=null}={}){
  return {caption:item.created?shortDate(item.created):'',seed:item.seed,loadPrompt:()=>promptForImage(item),
    // A picture opened from the chat may not know its date or seed (attached before 0.1.63): the record tells.
    loadInfo:()=>findRecord(item).then(r=>r?{caption:r.created?shortDate(r.created):'',seed:r.seed}:null),
    actions:viewerActions(item,{attachment}),onPanel:()=>showPanel(),
    onDetach:attachment?()=>removeMessageImage(item,attachment):null,
    // Also from the chat (0.1.63): deleteImages asks first and takes the picture out of every message it is in.
    // UI-070-04: a failure is thrown to the enlarged view, which shows it where the person is looking.
    onDelete:async()=>{
      const reply=await deleteImages({ids:[item.id],owners:typeof item.chatKey==='string'?{[item.id]:item.chatKey}:null});
      if(reply?.deleted.includes(item.id))return true;
      if(reply?.issue)throw new Error(reply.issue);
      return false;
    }};
}
// Opens the panel (the tab it was on, or the one asked for).
async function showPanel(tab=null){await (panelReady??Promise.resolve());await open();if(tab&&activeTab()!==tab)showTab(tab);}
// 이력에서 보기 / 설정을 프리셋으로: the panel's history tab, scrolled to that picture's card with a short ring.
async function goToHistoryCard(item){
  await showPanel('history');
  const scope=item.chatKey===FREE_KEY?'free':item.chatKey&&item.chatKey===keyOf()?'chat':'all';
  // ★ only (or # 태그) would hide a picture without a star (or tags): the card is looked for in the full range.
  const hiddenByMarks=historyMarkFilter==='star'&&!marks()[item.id]?.star||historyMarkFilter==='tag'&&!marks()[item.id]?.tags?.length;
  if(historyScope!==scope||historyFilter||hiddenByMarks){closeImageMenu();historyScope=scope;historyFilter='';historyMarkFilter=null;historyItems=[];historyPending=[];historyPendingBytes=0;historyTotal=0;historyHasMore=false;selectedIds.clear();}
  await loadHistory();
  for(let i=0;i<60&&!historyItems.some(x=>x.id===item.id)&&historyHasMore;i++){if(historyLoading)await new Promise(r=>setTimeout(r,60));else await loadHistory({append:true});}
  const card=dialog.querySelector(`[data-view-history="${CSS.escape(item.id)}"]`)?.closest('.ncs-history-card');
  if(!card){historyPresetTarget=null;notice('이력에서 이 그림을 찾지 못했어요. 기록이 지워졌을 수 있어요.',true,'history');return;}
  card.scrollIntoView({block:'center'});card.classList.remove('ncs-card-found');void card.offsetWidth;card.classList.add('ncs-card-found');setTimeout(()=>card.classList.remove('ncs-card-found'),2200);
  card.querySelector('#ncs-history-preset-name')?.focus({preventScroll:true});
}
// A picture opened from its message moves between that message's pictures (0.1.70).
function messageGallery(attachment,items){
  const gallery={items:[...items],total:items.length,hasMore:false,loadMore:async()=>{},waitForPage:async()=>{},
    describe:x=>imageViewerOptions(x,{attachment}),removed(id){const at=gallery.items.findIndex(x=>x.id===id);if(at>=0){gallery.items.splice(at,1);gallery.total=gallery.items.length;}}};
  return gallery;
}
function viewImage(item,{attachment=null,gallery=false,siblings=null}={}) {
  if(!item)return;
  const group=gallery?historyGallery():siblings&&siblings.length>1?messageGallery(attachment,siblings):null;
  openImageViewer(item,{...imageViewerOptions(item,{attachment}),gallery:group,index:group?group.items.findIndex(x=>x.id===item.id):0});
}
// Shared compact menus: top-layer popovers stay visible inside dialogs and near the chat viewport edge.
let imageMenu=null;
function closeImageMenu({focus=false}={}){
  if(!imageMenu)return;const {menu,button}=imageMenu;imageMenu=null;
  if(typeof menu.hidePopover==='function'&&menu.matches(':popover-open'))menu.hidePopover();menu.hidden=true;button.setAttribute('aria-expanded','false');
  if(focus&&button.isConnected)button.focus({preventScroll:true});
}
// A menu attached to a chat message lives outside the panel, where the theme's colours are not defined: copy them
// from the panel (or from a short-lived hidden probe when the panel is not built yet) onto the menu.
const THEME_VARS=['--ncs-bg','--ncs-fg','--ncs-menu-bg','--ncs-edge','--ncs-border','--ncs-hover','--ncs-muted','--ncs-rule','--ncs-focus','--ncs-surface','--ncs-accent-text'];
function themeMenu(menu){
  if(!menu.closest('#chat'))return;
  let from=document.getElementById('naice-shot-dialog'),probe=null;
  if(!from){probe=document.createElement('div');probe.id='naice-shot-dialog';probe.dataset.skin=currentSkin();probe.style.cssText='display:none';document.body.append(probe);from=probe;}
  const cs=getComputedStyle(from);for(const v of THEME_VARS){const x=cs.getPropertyValue(v).trim();if(x)menu.style.setProperty(v,x);}
  probe?.remove();
}
function toggleImageMenu(button){
  if(imageMenu?.button===button){closeImageMenu({focus:true});return;}
  closeImageMenu();const menu=document.getElementById(button.dataset.imageMore);if(!menu)return;
  fillJumpSlot(menu);themeMenu(menu);
  menu.hidden=false;if(typeof menu.showPopover==='function')menu.showPopover();else menu.removeAttribute('popover');
  imageMenu={menu,button,anchor:button.getBoundingClientRect()};button.setAttribute('aria-expanded','true');
  positionImageMenu();
  menu.querySelector('button:not(:disabled),a')?.focus({preventScroll:true});
}
function positionImageMenu(){
  if(!imageMenu)return;const {menu,button}=imageMenu;
  if(!button.isConnected){closeImageMenu();return;}
  const r=button.getBoundingClientRect(),pad=8,belowSpace=innerHeight-pad-r.bottom-4,aboveSpace=r.top-pad-4;
  menu.style.maxHeight=`${Math.max(32,Math.max(belowSpace,aboveSpace))}px`;
  const m=menu.getBoundingClientRect(),start=button.classList.contains('ncs-save-toggle')||button.closest('.ncs-history-actions')?r.left:r.right-m.width; // menus open toward the card
  menu.style.left=`${Math.max(pad,Math.min(start,innerWidth-m.width-pad))}px`;
  const below=m.height<=belowSpace||belowSpace>=aboveSpace;
  const top=below?r.bottom+4:r.top-4-m.height;
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
  // Pointer focus arrives before click on iOS. Closing here would make a second tap reopen the menu.
  document.addEventListener('keydown',event=>{if(event.key==='Tab')closeImageMenu();},true);
  document.addEventListener('scroll',event=>{
    if(!imageMenu||imageMenu.menu.contains(event.target))return;
    // A queued scroll from bringing the button into view may arrive after click.
    // Close only if the anchor has moved since opening, not for that old event.
    const r=imageMenu.button.getBoundingClientRect(),a=imageMenu.anchor;
    if(r.top!==a.top||r.left!==a.left||!imageMenu.button.isConnected)closeImageMenu();
  },true);
  document.addEventListener('toggle',event=>{if(imageMenu?.menu.contains(event.target))positionImageMenu();},true);
  window.addEventListener('resize',()=>closeImageMenu());
}
// Reads the chat file back from SillyTavern to check that a save really happened (0.1.77). The route is SillyTavern's own
// chat-read route; if its answer is not what is expected, the result is "cannot tell", never "saved".
// 0.1.79 (UI-072-01): the chat is fixed when the change starts, so moving to another chat meanwhile never reads that one.
function savedReader(){
  const c=ctx(),inGroup=c.groupId!==null&&c.groupId!==undefined,id=c.getCurrentChatId?.() ?? c.chatId,card=c.characters?.[c.characterId];
  const fixed={inGroup,id,card:card?{name:card.name,avatar:card.avatar}:null,groupId:c.groupId};
  return ()=>readSavedChat(fixed);
}
async function readSavedChat({inGroup,id,card}){
  const c=ctx();
  if(!id)throw new Error('no chat');
  const request={method:'POST',headers:c.getRequestHeaders(),cache:'no-store',signal:draftSignal()};
  const response=inGroup
    ?await fetch('/api/chats/group/get',{...request,body:JSON.stringify({id})})
    :await fetch('/api/chats/get',{...request,body:JSON.stringify({ch_name:card?.name,file_name:String(id).replace(/\.jsonl$/,''),avatar_url:card?.avatar})});
  if(!response.ok)throw new Error(`read ${response.status}`);
  return splitSavedChat(await response.json(),{inGroup});
}
const CHAT_NOT_CURRENT='서버의 채팅과 화면이 같은지 확인하지 못했어요. 채팅을 다시 열고 시도해 주세요.';
let chatWritePending=false,chatLoadEpoch=0,hostChatModule;
// 0.1.88 (GPT P2 B2): the world info timed effects this window last knew to be on the disk: the value at chat load,
// the value SillyTavern saves after a reply or a message change, a disk value this window read and confirmed, and its
// own saves. Only that one value — never an older one — lets the memory value replace the disk value.
let timedSaved=null,timedEpoch=-1;
function noteTimed(metadata=ctx().chatMetadata){
  if(timedEpoch!==chatLoadEpoch){timedSaved=null;timedEpoch=chatLoadEpoch;}
  if(metadata&&typeof metadata==='object')timedSaved=timedState(metadata);
}
// 0.1.89 (GPT P2-1): a message or generation event does not say that SillyTavern saved anything (a stopped generation
// saves nothing). The event only asks for a look at the disk: when the disk holds the same timed effects as memory,
// that disk value is the new base. A value never read from the disk never becomes the base.
const TIMED_CHECK_DELAY=1200;let timedCheckTimer=0,timedCheckRun=0;
function checkTimedSoon(){clearTimeout(timedCheckTimer);timedCheckRun++;timedCheckTimer=setTimeout(()=>confirmTimed().catch(()=>{}),TIMED_CHECK_DELAY);}
async function confirmTimed(){
  const c=ctx(),key=keyOf(c),epoch=chatLoadEpoch,meta=c.chatMetadata,run=timedCheckRun;
  if(!key||!meta||typeof meta!=='object')return;
  if(timedEpoch===epoch&&timedState(meta)===timedSaved)return; // nothing new to learn
  const host=await (hostChatModule??=import('/script.js').catch(()=>null));
  if(host?.isChatSaving){checkTimedSoon();return;} // look again after SillyTavern's save
  let saved;try{saved=await savedReader()();}catch{return;}
  const now=ctx();
  if(run!==timedCheckRun||keyOf(now)!==key||chatLoadEpoch!==epoch||now.chatMetadata!==meta)return;
  if(timedState(saved.metadata)===timedState(now.chatMetadata))noteTimed(saved.metadata);
}
const chatState=(messages,metadata)=>stableChatJson({messages,metadata});
async function withChatWrite(key,apply){
  if(!key||keyOf()!==key)throw new Error(CHAT_NOT_CURRENT);
  if(chatWritePending)throw new Error('진행 중인 채팅 저장이 끝난 뒤 다시 시도해 주세요.');
  chatWritePending=true;
  try{
    const context=ctx(),{chat,chatMetadata}=context,epoch=chatLoadEpoch,read=savedReader();
    const current=()=>{const c=ctx();return keyOf(c)===key&&c.chatMetadata===chatMetadata&&c.chat===chat&&chatLoadEpoch===epoch;};
    const snapshot=chatState(context.chat,context.chatMetadata);
    const host=await (hostChatModule??=import('/script.js').catch(()=>null));
    const assertReady=()=>{
      if(!current())throw new Error(CHAT_NOT_CURRENT);
      if(host?.isChatSaving||ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)
        throw new Error('실리태번이 채팅을 저장 중이거나 본편을 생성 중이에요. 잠시 뒤 다시 시도해 주세요.');
    };
    assertReady();
    const readState=async()=>{
      const saved=await read();
      saved.messages.forEach(message=>host?.ensureMessageMediaIsArray?.(message));
      return saved;
    };
    let saved;
    try{saved=await readState();}catch{throw new Error(CHAT_NOT_CURRENT);}
    assertReady();
    if(snapshot!==chatState(ctx().chat,ctx().chatMetadata))throw new Error('채팅 내용이 바뀌는 중이에요. 잠시 뒤 다시 시도해 주세요.');
    const diskMetadata=comparableSavedMetadata(saved.metadata,chatMetadata,context.extensionSettings?.note??{},{timedSaved:timedEpoch===chatLoadEpoch?timedSaved:null});
    if(snapshot!==chatState(saved.messages,diskMetadata))throw new Error('서버의 채팅과 화면이 달라요. 다른 곳에서 수정했다면 채팅을 다시 열고, 방금 편집했다면 저장이 끝난 뒤 시도해 주세요.');
    noteTimed(saved.metadata);
    const done=await apply(ctx(),{readSaved:async()=>(await readState()).messages,isCurrent:current},readState);
    // 0.1.89 (GPT P2-1): even a save that went through only becomes the base after reading it back from the disk;
    // an unverified result keeps the old base.
    // (Read only when there is something to learn: memory has timed effects the base does not have.)
    if(current()&&timedEpoch===chatLoadEpoch&&timedState(ctx().chatMetadata)!==timedSaved){
      try{const after=await readState();if(current()&&timedState(after.metadata)===timedState(ctx().chatMetadata))noteTimed(after.metadata);}catch{}
    }
    return done;
  }finally{chatWritePending=false;}
}
async function changeChatSetting(key,update){
  return withChatWrite(key,async(context,_guard,readState)=>{
    const meta=context.chatMetadata,before=meta[KEY],next=clone(before??{});
    update(next);meta[KEY]=next;
    const rollback=()=>{if(meta[KEY]===next){if(before===undefined)delete meta[KEY];else meta[KEY]=before;}};
    try{await context.saveMetadata();}
    catch{rollback();throw new Error('채팅 설정을 저장하지 못했어요. 바꾸기 전 상태를 유지했어요.');}
    let saved;
    try{saved=(await readState()).metadata[KEY];}
    catch{throw new Error('채팅 설정이 저장됐는지 확인하지 못했어요. 채팅을 다시 열어 확인해 주세요.');}
    if(stableChatJson(saved)===stableChatJson(next))return;
    if(stableChatJson(saved)===stableChatJson(before)){
      rollback();throw new Error('채팅 설정을 저장하지 못했어요. 바꾸기 전 상태를 유지했어요.');
    }
    throw new Error('채팅 설정이 저장됐는지 확인하지 못했어요. 채팅을 다시 열어 확인해 주세요.');
  });
}

const UNVERIFIED='채팅 파일에 저장됐는지 확인하지 못했어요. 화면은 그대로 두었어요. 채팅을 다시 열어 확인해 주세요.';
function attachmentOf(element){
  const index=Number(element.closest('.mes')?.getAttribute('mesid')),message=ctx().chat?.[index];
  return {message,swipeId:message?.swipe_id??0,signature:textSignature(message?.mes??''),chatKey:keyOf()};
}
async function placeChatImage(item,attachment,placement){
  if(busy||attaching)throw new Error('진행 중인 작업이 끝난 뒤 옮겨 주세요.');
  if(ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 옮겨 주세요.');
  const startKey=attachment.chatKey;attaching=true;updateAttachButtons();
  try{const done=await withChatWrite(startKey,(context,guard)=>placeMessageImage(context,item,{...attachment,placement,...guard}));if(keyOf()===startKey)renderChatImages();if(done?.unverified)say(UNVERIFIED,true);return done;}
  finally{attaching=false;updateAttachButtons();}
}
async function removeMessageImage(item,attachment){
  if(busy||attaching)throw new Error('진행 중인 작업이 끝난 뒤 그림을 빼 주세요.');
  if(ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 그림을 빼 주세요.');
  const startKey=attachment.chatKey;
  attaching=true;updateAttachButtons();
  try{
    const done=await withChatWrite(startKey,(context,guard)=>detachMessageImage(context,item,{...attachment,...guard}));
    if(keyOf()===startKey){renderChatImages();renderResult();renderHistory();}
    if(done?.unverified)say(`그림을 뺐지만 ${UNVERIFIED}`,true);
    else say('이 메시지에서 그림을 뺐어요. 원본과 생성 이력은 그대로예요.');return true;
  }finally{attaching=false;updateAttachButtons();}
}
function say(message,error=false,tab=activeTab()) {
  // The panel may be closed when deleting from the chat viewer; fall back to ST's toast.
  if(dialog?.open||!globalThis.toastr)notice(message,error,tab);
  else globalThis.toastr[error?'error':'success'](message,brand());
}
function changed(){undoChatOutfit=null;dialog?.querySelectorAll('.ncs-outfit-undo').forEach(e=>e.remove());revision++;finalOverride=null;optionsOverride=null;dropUndo();updateFinal({force:true});scheduleDraft();}
// History restore uses the stored options for the next generation only; the settings tab keeps the user's own values.
function effectiveOptions(){return optionsOverride?freeOptions(optionsOverride):settings().options;}
function setBusy(value,owner=0) {busy=value;busyOwner=value?owner:0;for(const b of dialog.querySelectorAll('[data-action="extract"],[data-action="extract-again"],[data-action="free-fill"],[data-mode],[data-history-free],[data-action="generate"],[data-action="blank"],[data-action="undo-clear"],[data-action="same-seed"],[data-action="new-seed"],[data-action="convert-profile"]'))b.disabled=value;updateAttachButtons();if(!value)rememberDraft();}
async function api(route,{method='GET',body,keepalive=false,signal}={}) {
  const response=await fetch(`${API}${route}`,{method,headers:ctx().getRequestHeaders(),body:body?JSON.stringify(body):undefined,keepalive,signal});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw Object.assign(new Error(`서버 플러그인을 확인해 주세요 (${response.status}).`),{status:response.status});}
  if(!response.ok||data.error){const error=new Error(data.error??`요청 실패 (${response.status})`);error.status=response.status;error.code=data.code??'';throw error;}return data;
}
const draftSignal=()=>globalThis.AbortSignal?.timeout?.(15000);
const ambiguousDelete=error=>!(error.status>=400&&error.status<500&&error.status!==408);
const draftDeletionChecks=new Map();
const drafts=new DraftQueue({read:key=>api(`/draft?chatKey=${encodeURIComponent(key)}`,{signal:draftSignal()}),
  write:(key,body)=>{const value={...body,chatKey:key,retainRawExtraction:settings().retainRawExtraction===true};return api('/draft',{method:'POST',body:value,keepalive:new Blob([JSON.stringify(value)]).size<60000,signal:draftSignal()});},onState:()=>renderDraftState()});
let captureTimer=null;
function scheduleDraft(){clearTimeout(captureTimer);captureTimer=null;if(draftsEnabled){captureTimer=setTimeout(()=>rememberDraft(),450);renderDraftState();}}
function renderRawRetention(){if(!dialog)return;const sum=$('ncs-retain-summary');if(sum)sum.textContent=settings().retainRawExtraction===true?' · 켜짐':' · 꺼짐';$('ncs-retain-state').textContent=settings().retainRawExtraction===true?'켜짐 · 새로 만드는 그림의 이력과 마지막 작업에 응답 원문도 보관해요.':'꺼짐 · 응답 원문은 보관하지 않아요(생성 기록은 저장돼요).';}
// 0.1.88 (GPT P2 P3-3): one place decides whether the drawing window is locked, from everything that can lock it:
// the work is loading, a work deletion is running, the result of a deletion of this work is unknown (anything typed
// meanwhile could be emptied by it), or the first server check of the panel is running. Nothing sets it directly.
let deletingWork=false,compatChecking=false;
function syncWorkLock(){
  if(!dialog)return;
  const held=draftsEnabled&&draftDeletionChecks.has(workKey());
  $('ncs-work-fields').disabled=draftLoading||deletingWork||compatChecking||held;
}
function renderDraftState(){
  if(!dialog)return;syncWorkLock();const e=drafts.entry(workKey()),box=$('ncs-draft-status');
  if(!draftsEnabled){box.hidden=!compatChecked;box.textContent='작업 기억을 사용할 수 없어요. 서버 연결·업데이트를 확인해 주세요.';$('ncs-draft-retry').hidden=!compatChecked;$('ncs-draft-retry').textContent='연결 다시 확인';return;}
  const held=draftDeletionChecks.has(workKey());
  box.hidden=!draftsEnabled;box.textContent=held?'삭제 결과를 확인할 때까지 작업을 잠갔어요.':draftLoading?'마지막 작업을 불러오는 중…':e.error?`작업 저장을 확인해 주세요: ${e.error.message}`:e.saving||e.dirty||captureTimer?'마지막 작업 저장 중…':draftNote||'마지막 작업을 서버에 기억해요.';
  $('ncs-draft-retry').hidden=!draftsEnabled||!held&&!e.error;
  $('ncs-draft-retry').textContent=held?draftDeletionRuns.has(workKey())?'삭제 결과 확인 중…':'삭제 결과 다시 확인':e.error?.status===409?'서버 작업 다시 불러오기':'다시 시도';
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
  const token=++draftLoadToken;draftLoading=true;draftNote='';renderDraftState();
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
  finally{if(token===draftLoadToken){draftLoading=false;renderDraftState();}}
}
async function retryDraft(){
  if(!draftsEnabled){await checkServer({force:true});return;}
  const key=workKey(),e=drafts.entry(key);
  if(draftDeletionChecks.has(key)){
    const outcome=await reconcileDraftDeletion(key);
    if(outcome==='settled')return; // the other press's answer already said it
    if(outcome==='unknown')notice('아직 삭제 결과를 확인하지 못했어요. 확인할 때까지 작업을 잠가 둘게요.',true);
    else if(outcome==='deleted')notice('서버에서 작업이 삭제된 것을 확인했어요.');
    else notice('서버 작업을 확인했어요. 자동 저장을 다시 시작해요.');
    return;
  }
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
  closeImageMenu();rememberScroll();
  if(tab==='profiles'&&(profileContext==='scene'||profileContext==='scene-edit'))placeProfileForm('profiles'); // keep what was typed, show it in the profile tab
  for(const el of dialog.querySelectorAll('[data-page]'))el.hidden=el.dataset.page!==tab;
  for(const el of dialog.querySelectorAll('[data-tab]'))el.classList.toggle('ncs-active',el.dataset.tab===tab);
  for(const el of dialog.querySelectorAll('[data-tab]'))el.setAttribute('aria-selected',String(el.dataset.tab===tab));
  renderNotice();restoreScroll();
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
  undoChatOutfit=null;
  ({scene,raw,finalOverride,optionsOverride,restoredFinal,result,undoClear}=w);
  if(isFree())migratePins(scene.characters); // 0.1.59: cards from before 📌 existed are kept (pinned), never deleted unasked
  $('ncs-target').value=w.target??'';$('ncs-moment-wish').value=w.wish??'';$('ncs-free-text').value=w.freeText??'';
  draftSource=w.targetSource??null;targetShown=w.targetShown??TARGET_STEP;if(w.finalOverride?.invalid)$('ncs-final').value=w.finalText??'';
  lastLink=null;linkTarget=null;wardrobeTarget=null;pendingTempConvert=null;
}
function renderModeUI(){
  if(!dialog)return;const free=isFree();
  for(const b of dialog.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  $('ncs-chat-source').hidden=free;$('ncs-free-source').hidden=!free;$('ncs-request').hidden=free; // 프리샷: the situation itself is the request
  $('ncs-source-title').textContent=free?'1 · 그릴 장면':'1 · 그릴 순간';
  placeRequest();
  dialog.dataset.workMode=mode;renderUndo();
}
// 0.1.78 (item 9): 챗샷 and 프리샷 each remember their own image preset, common positive/negative and generation settings.
// The live values (imagePresetId, positive, negative, options) always belong to settings.genActive; the other mode's are kept aside.
function syncGen(next){
  const s=settings();s.genByMode??={};const from=s.genActive??next;
  if(from!==next){
    s.genByMode[from]={imagePresetId:s.imagePresetId,positive:s.positive,negative:s.negative,options:clone(s.options)};
    const t=s.genByMode[next];
    if(t){s.imagePresetId=s.imagePresets.some(p=>p.id===t.imagePresetId)?t.imagePresetId:'';s.positive=t.positive;s.negative=t.negative;s.options=clone(t.options);}
  }
  s.genActive=next;ctx().saveSettingsDebounced();
}
async function setMode(next){
  if(next===mode)return;if(busy||attaching||draftLoading||outfitSaving)throw new Error('진행 중인 작업이 끝난 뒤 바꿔 주세요.');
  rememberDraft(workKey(),null,{flush:true});rememberScroll();spare[mode]=captureWork();mode=next;syncGen(next);loadWork(spare[mode]??blankWork());delete spare[mode];
  historyPresetTarget=null;
  revision++;renderSettings();renderModeUI();renderTargets();renderScene({forceFinal:true});renderResult();renderPlacement();if(activeTab()==='history')loadHistory().catch(e=>notice(e.message,true));
  notice(isFree()?'프리샷이에요. 채팅과 상관없이 자유롭게 그려요.':'챗샷이에요. 열린 채팅의 장면을 그려요.');
  await recallDraft();
}
// The clear button's own place turns into its undo: [그리기창 비우기] ⇄ [↶ 비우기 취소]. After an import from history
// the clear button stays, and a second small [↶ 가져오기 취소] appears beside it (both are useful then).
function renderUndo(){
  if(!dialog)return;$('ncs-undo-clear').hidden=true;
  const row=dialog.querySelector('.ncs-clear-slot');if(typeof row?.querySelector!=='function')return; // one slot for both modes (each mode keeps its own undo)
  const clearUndo=!!undoClear&&!undoClear.label,importUndo=!!undoClear&&!!undoClear.label,b=row.querySelector('.ncs-action-slot');if(!b)return;
  b.dataset.action=clearUndo?'undo-clear':'blank';b.classList.toggle('ncs-undoing',clearUndo);
  b.textContent=clearUndo?'↶ 비우기 취소':'그리기창 비우기';
  b.title=clearUndo?'비우기 전으로 되돌려요. 다음에 고치거나 추출·생성하면 사라져요.':'인물·장면·후보·최종 프롬프트를 비워요. 공통 프롬프트와 설정은 그대로예요.';
  let u=row.querySelector('.ncs-import-undo');
  if(importUndo&&!u){u=document.createElement('button');u.type='button';u.className='ncs-import-undo';u.dataset.action='undo-clear';b.before(u);}
  if(u){u.hidden=!importUndo;u.title=undoClear?.label??'';u.textContent=undoKind(undoClear)==='extract'?'↶ 추출 취소':'↶ 가져오기 취소';u.classList.toggle('ncs-extract-undo',undoKind(undoClear)==='extract');if(!importUndo)u.remove();}
}
// 추가 요청 sits under the candidates once there are some (it re-picks or changes them), else above 장면 추출.
function placeRequest(){
  if(!dialog)return;const box=$('ncs-request'),near=!isFree()&&(scene.moments?.length??0)>1;
  const home=near?$('ncs-request-near'):$('ncs-request-home');if(!box||typeof home?.append!=='function')return;
  if(box.parentElement!==home)home.append(box);
  const again=box.querySelector?.('.ncs-request-again');if(again)again.hidden=!near;box.classList?.toggle?.('ncs-request-near',near);
  const applied=$('ncs-request-applied'),r=scene.request;if(!applied)return;applied.hidden=!r||(!r.applied?.length&&!r.ignored?.length);
  applied.textContent=r?[r.applied?.length?`추가 요청 반영: ${r.applied.join(' · ')}`:'',r.ignored?.length?`반영하지 않음: ${r.ignored.join(' · ')}`:''].filter(Boolean).join(' / '):'';
}
// One undo belongs to the saved work; edits, extraction and generation end it, while chat/tab switches keep it.
// Saved work keeps only the label (the shared draft format), so the kind is read back from it.
const undoKind=u=>!u?null:u.kind??(String(u.label??'').startsWith('추출 전')?'extract':u.label?'import':'clear');
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
  revision++;renderTargets();renderScene({forceFinal:true});renderResult();renderUndo();notice(undoKind(w)==='extract'?'추출 전으로 되돌렸어요.':w.label?'가져오기 전으로 되돌렸어요.':'비우기 전으로 되돌렸어요.');
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
  for(const key of keys){draftDeletionChecks.delete(key);drafts.release(key);drafts.reset(key);}
  // The open work reads the server's deletion marker now; other chats read it when they are opened again.
  if(here)await drafts.ensure(workKey()).catch(()=>{});
}
// 0.1.89 (GPT P2-2): each unknown deletion is its own hold object. A check works on the hold it started with: an
// answer that comes back after that hold was settled (by an earlier answer) changes nothing, so it can never empty
// what was typed after the lock opened. One check per work at a time; a second press waits for the same answer.
function holdDraftDeletion(key){
  if(!draftDeletionChecks.has(key))draftDeletionChecks.set(key,{revision:drafts.entry(key).revision});
  drafts.hold(key);
}
const draftDeletionRuns=new Map();
function reconcileDraftDeletion(key,state=null){
  const hold=draftDeletionChecks.get(key);
  if(!hold)return Promise.resolve('settled');
  const running=draftDeletionRuns.get(key);
  if(running?.hold===hold&&!state)return running.promise;
  const promise=settleDraftDeletion(key,hold,state).finally(()=>{if(draftDeletionRuns.get(key)?.promise===promise){draftDeletionRuns.delete(key);renderDraftState();}});
  if(!state)draftDeletionRuns.set(key,{hold,promise});
  renderDraftState();
  return promise;
}
async function settleDraftDeletion(key,hold,state){
  try{
    const saved=state??await api(`/draft?chatKey=${encodeURIComponent(key)}`,{signal:draftSignal()});
    if(draftDeletionChecks.get(key)!==hold)return 'settled'; // an earlier answer already settled this deletion
    if(!saved||!Object.hasOwn(saved,'revision'))return 'unknown';
    const before=hold.revision;
    if(saved.deleted===true&&saved.revision!==before){await forgetWork([key]);return 'deleted';}
    draftDeletionChecks.delete(key);drafts.release(key);
    if(saved.revision!==before){
      drafts.entry(key).error=Object.assign(new Error('다른 곳에서 작업이 바뀌었어요.'),{status:409});
    }else if(!drafts.paused)await drafts.flush(key);
    return 'kept';
  }catch{return 'unknown';}
  finally{renderDraftState();}
}
// Deleting saved work: lock the drawing window, let saves already sent finish (later ones are dropped), delete,
// then forget. Server requests of one user run in order, so nothing sent before can recreate the work.
async function whileDeletingWork(keys,remove,forgetKeys=()=>keys){
  if(drafts.paused)throw new Error('진행 중인 작업 삭제가 끝난 뒤 시도해 주세요.');
  pauseDraftCapture=true;clearTimeout(captureTimer);captureTimer=null;deletingWork=true;syncWorkLock();
  try{
    await drafts.pause(keys);
    const response=await remove();
    const gone=forgetKeys(response);if(gone?.length)await forgetWork(gone);
    return response;
  }finally{pauseDraftCapture=false;deletingWork=false;drafts.resume();renderDraftState();}
}
async function deleteAllWork(){
  const originTab=activeTab(),report=(message,error=false)=>notice(message,error,originTab);
  if(busy||attaching||draftLoading)throw new Error('진행 중인 작업이 끝난 뒤 지워 주세요.');
  if(!confirm('저장된 작업을 모두 지울까요?\n채팅별·프리샷의 마지막 작업 기억이 서버에서 지워지고 되돌릴 수 없어요. 지금 그리기창도 비워져요.\n그림 이력·프로필·설정은 그대로예요.'))return;
  report('저장된 작업을 지우고 있어요…');
  const keys=[...new Set([...drafts.entries.keys(),workKey(),chatKey,FREE_KEY].filter(Boolean))];
  const r=await whileDeletingWork(null,async()=>{
    try{return await api('/draft',{method:'POST',body:{delete:true,all:true},signal:draftSignal()});}
    catch(e){
      if(!ambiguousDelete(e))throw e;
      for(const key of keys)holdDraftDeletion(key);
      const confirmed=await Promise.all(keys.map(key=>reconcileDraftDeletion(key)));
      return {unverified:true,held:confirmed.includes('unknown'),deleted:confirmed.filter(state=>state==='deleted').length};
    }
  },reply=>{
    if(reply.unverified)return [];
    for(const k of Object.keys(spare))delete spare[k];
    return keys;
  });
  if(r.unverified){report(`전체 삭제 응답을 받지 못했어요. 작업 ${r.deleted}개의 삭제를 확인했어요.${r.held?' 확인하지 못한 작업은 확인할 때까지 잠갔어요.':''}`,true);return;}
  report(`저장된 작업 ${r.deleted??0}개를 지웠어요. 그림 이력은 그대로예요.`);
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
  const s=settings();renderTagPopupSetting();
  $('ncs-model').innerHTML=Object.entries(MODELS).map(([id,m])=>`<option value="${id}">${m.label}</option>`).join('');
  for(const [id,k] of [['positive','positive'],['negative','negative'],['recent','recent'],['format','format']])$(`ncs-${id}`).value=s[k];
  for(const [id,k] of [['model','model'],['steps','steps'],['scale','scale'],['seed','seed'],['cfg','cfgRescale'],['sampler','sampler']])$(`ncs-${id}`).value=s.options[k];
  renderRawRetention();
  $('ncs-include-user').checked=s.includeUser;$('ncs-schema').checked=s.structuredOutput;$('ncs-retain-raw').checked=s.retainRawExtraction===true;$('ncs-allow-anlas').checked=s.allowAnlas;
  $('ncs-image-placement').value=s.imagePlacement==='below'?'below':'above';renderPlacement();$('ncs-message-button').checked=messageButtonsOn();$('ncs-inline-layout').value=inlineLayout();$('ncs-inline-size').value=inlineSize();$('ncs-size-preset').value=sizePresetOf(s.options);renderBrand();
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
  $('ncs-gen-scope').textContent=history?'이력 설정 · 이번 생성에만':'생성 설정';
  $('ncs-gen-scope').classList.toggle('ncs-gen-history',history);$('ncs-gen-override').hidden=!history;($('ncs-gen-note').closest('.ncs-help')??$('ncs-gen-note')).hidden=history;
  const parts=[MODELS[o.model]?.label??o.model,`${SIZE_PRESETS[size]?.label.split(' · ')[0]??'세로'} ${o.width}×${o.height}`,`${o.steps} Steps`,`Guidance ${o.scale}`,o.seed===-1?'새 seed':`seed ${o.seed}`];
  $('ncs-gen-line').innerHTML=parts.map(part=>`<span>${esc(part)}</span>`).join(' · ');
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
  // Buttons follow the selection (docs/DESIGN.md): a chosen preset → [변경 저장 · 이름] is the main button (asks
  // first) with [새 프리셋으로 저장] and [선택 프리셋 삭제]; none → only [새 프리셋으로 저장].
  $('ncs-preset-save-hint').textContent=p?`변경 저장: 고른 "${p.name}"에 지금 값을 덮어써요(확인 창이 떠요). 새 프리셋으로 저장: 이름을 바꿔 따로 저장해요.`:'입력한 이름으로 새 프리셋을 저장해요. 기존 프리셋은 덮어쓰지 않아요.';
  const over=dialog.querySelector('[data-action="save-preset"]'),as=dialog.querySelector('[data-action="save-preset-as"]'),del=dialog.querySelector('[data-action="delete-preset"]');
  over.hidden=!p;over.disabled=!p;over.classList.toggle('ncs-primary',!!p);over.classList.toggle('ncs-action-main',!!p);over.textContent=p?`변경 저장 · ${p.name}`:'변경 저장';over.title=p?`"${p.name}"에 지금 값을 덮어써요`:'';
  as.classList.toggle('ncs-primary',!p);as.classList.toggle('ncs-action-main',!p);del.hidden=!p;del.disabled=!p;
  renderGenBox();
}
function saveImagePreset(overwrite=false,typedName=null) {
  const s=settings(),name=(typedName??$('ncs-common-preset-name').value).trim(),old=overwrite?s.imagePresets.find(p=>p.id===s.imagePresetId):null;
  if(!name)throw new Error('저장할 이름을 입력해 주세요.');
  if(overwrite&&!old)throw new Error('덮어쓸 프리셋을 먼저 선택해 주세요.');
  if(s.imagePresets.some(p=>p.id!==old?.id&&p.name.toLowerCase()===name.toLowerCase()))throw new Error('같은 이름의 프리셋이 있어요. 다른 이름으로 저장하거나 해당 프리셋을 선택해 덮어써 주세요.');
  const id=old?.id??uuid(),p=captureImagePreset(s,id,name);
  // 0.1.68: [변경 저장] keeps the preset where it was; only a new preset goes to the end.
  s.imagePresets=validateImagePresets(old?s.imagePresets.map(x=>x.id===id?p:x):[...s.imagePresets,p]);s.imagePresetId=id;
  ctx().saveSettingsDebounced();renderImagePresets();notice(overwrite?`"${name}" 프리셋에 지금 값을 저장했어요.`:`지금 값을 새 프리셋 "${name}"(으)로 저장했어요.`);
}
// 0.1.74: 채팅 속 그림 is folded too; its title shows where pictures go in this chat and how they show.
function renderChatImageSummary(){
  const el=$('ncs-chat-image-summary');if(!el)return;const local=ctx().chatMetadata?.[KEY]?.imagePlacement;
  el.textContent=` · 글 ${imagePlacement()==='above'?'위':'아래'}${['above','below'].includes(local)?'(이 채팅)':''} · ${{slide:'넘겨보기',grid:'격자',stack:'세로'}[inlineLayout()]} · ${{small:'작게',medium:'보통',large:'크게'}[inlineSize()]} · 그리기 아이콘 ${messageButtonsOn()?'켬':'끔'}`;
}
// 0.1.73: 세부 설정 is folded; its title shows the current values.
function renderExtractionSummary(){
  const s=settings(),t=extractionTemperature();
  $('ncs-extraction-summary').textContent=` · 응답 한도 ${s.extractionMaxTokens} · 온도 ${t===null?'연결 값':t} · JSON ${s.structuredOutput?'켬':'끔'}`;
}
function renderExtractionProfiles() {
  const s=settings(),profiles=listExtractionProfiles(ctx());
  $('ncs-extraction-profile').innerHTML='<option value="">본편에서 현재 사용하는 연결</option>'+profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.model||p.api)}</option>`).join('');
  if(s.extractionProfileId&&!profiles.some(p=>p.id===s.extractionProfileId)){
    const missing=document.createElement('option');missing.value=s.extractionProfileId;missing.textContent='선택한 프로필 없음 · 다시 선택해 주세요';$('ncs-extraction-profile').append(missing);
  }
  $('ncs-extraction-profile').value=s.extractionProfileId;
  const selected=profiles.find(p=>p.id===s.extractionProfileId);
  // 0.1.73: the choice speaks for itself; the line under it shows up only when the chosen connection is gone.
  const lost=!selected&&!!s.extractionProfileId;$('ncs-extraction-state').hidden=!lost;$('ncs-extraction-state').textContent=lost?'이 연결을 찾지 못했어요. 자동으로 본편 연결로 바꾸지 않아요.':'';
  renderExtractionSummary();
}
function renderProfiles() {
  const s=settings();
  const selected=$('ncs-profile-id').value;
  $('ncs-profile-list').innerHTML=s.profiles.map(p=>`<button data-profile="${esc(p.id)}" class="ncs-profile-chip ${p.id===selected?'ncs-selected':''}" aria-pressed="${p.id===selected}">${esc(p.name)}</button>`).join('');
  $('ncs-add-profile').innerHTML=s.profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  renderMatching();
}
let profileFormSession=0,quickProfileName='';
// The stored profile as the form was filled, so saving can tell what changed elsewhere meanwhile (UI-057-01).
let profileFormBase=null;
const PROFILE_KEYS=['name','aliases','subject','appearance','defaultOutfit','positive','negative','cardKey','wardrobe'];
function editProfile(id='') {
  profileFormSession++;quickProfileName='';
  const p=settings().profiles.find(p=>p.id===id)??{id:'',name:'',aliases:[],subject:'boy',appearance:'',defaultOutfit:'',positive:'',negative:'',cardKey:''};
  profileFormBase=p.id?clone(p):null;
  if(dialog)setProfileMode('direct'); // every profile form opens on 직접 입력 (new or existing); 설명으로 만들기 is one tap away
  for(const [key,field] of [['id','id'],['name','name'],['subject','subject'],['appearance','appearance'],['outfit','defaultOutfit'],['positive','positive'],['negative','negative']])$(`ncs-profile-${key}`).value=p[field];
  $('ncs-profile-aliases').value=p.aliases.join(', ');$('ncs-binding').textContent=p.cardKey?`연결된 카드: ${p.cardKey}`:'연결된 카드 없음';$('ncs-binding').dataset.cardKey=p.cardKey;
  $('ncs-profile-editing').textContent=p.id?`${p.name} 프로필 편집 중`:'새 프로필 작성 중';$('ncs-profile-describe').value='';
  renderWardrobeForm(p.wardrobe??[]);
  for(const el of dialog.querySelectorAll('[data-profile]')){const active=el.dataset.profile===p.id;el.classList.toggle('ncs-selected',active);el.setAttribute('aria-pressed',String(active));}
}
// --- Wardrobe (옷장) in the profile form ------------------------------------------------------------
function wardrobeRow(w){return `<details class="ncs-wardrobe-item" data-wardrobe-id="${esc(w.id)}"><summary>${esc(w.name||'새 옷')}</summary><div class="ncs-wardrobe-editor"><label>옷 이름<input data-w="name" maxlength="80" placeholder="예: 잠옷" value="${esc(w.name)}"></label><label>옷 태그<textarea data-w="outfit" rows="2" placeholder="예: pajamas, slippers">${esc(w.outfit)}</textarea></label><button type="button" data-action="wardrobe-remove" class="ncs-danger-outline">제거</button></div></details>`;}
function renderWardrobeForm(list){$('ncs-wardrobe-list').innerHTML=list.length?list.map(wardrobeRow).join(''):'<small class="ncs-wardrobe-empty">아직 옷장이 비어 있어요.</small>';}
function addWardrobeRow(w={id:uuid(),name:'',outfit:''}){
  const box=$('ncs-wardrobe-list');box.querySelector('.ncs-wardrobe-empty')?.remove();box.insertAdjacentHTML('beforeend',wardrobeRow(w));return box.lastElementChild;
}
// Empty rows are dropped silently; a row with only a name or only tags is an error the user should see.
function readWardrobeForm(){
  return [...$('ncs-wardrobe-list').querySelectorAll('.ncs-wardrobe-item')].map(row=>({id:row.dataset.wardrobeId,name:row.querySelector('[data-w="name"]').value,outfit:row.querySelector('[data-w="outfit"]').value}))
    .filter(w=>w.name.trim()||w.outfit.trim());
}
// 0.1.78: every other 장면 후보 carries its own copy of the scene. A profile made or linked for a person who is still
// "without a profile" in those copies is attached there too, so switching candidates no longer warns about a card that exists now.
function attachToOtherMoments(profile,names){
  const keys=new Set([profile.name,...(profile.aliases??[]),...names].map(identityKey).filter(Boolean)),touched=[];
  (scene.moments??[]).forEach((m,k)=>{
    if(k===scene.momentIndex||!m?.scene)return;
    const has=(m.scene.unregistered??[]).some(n=>keys.has(identityKey(n)))||(m.scene.unregisteredDetails??[]).some(c=>keys.has(identityKey(c.entityName)));
    if(!has)return;
    // 0.1.80 (UI-078-02): only what this link changes is remembered — the card it adds and the "no profile" marks it
    // takes away — so an undo puts back exactly that and leaves later changes (another profile made since) alone.
    const cards=new Set(m.scene.characters),names0=[...(m.scene.unregistered??[])],details0=[...(m.scene.unregisteredDetails??[])];
    attachSceneProfile(m.scene,profile,names);
    touched.push({k,scene:m.scene,addedCards:m.scene.characters.filter(c=>!cards.has(c)),
      removedNames:names0.filter(n=>!(m.scene.unregistered??[]).includes(n)),removedDetails:details0.filter(d=>!(m.scene.unregisteredDetails??[]).includes(d))});
  });
  return touched;
}
// Brings the person's new card into view (the card list sits far below the profile form) and flashes it once.
function showCard(id){
  requestAnimationFrame(()=>{const el=dialog?.querySelector(`[data-character="${CSS.escape(id)}"]`);if(!el)return;
    el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.remove('ncs-card-flash');void el.offsetWidth;el.classList.add('ncs-card-flash');});
}
async function saveProfile() {
  if(profileContext==='scene-edit'&&!confirm(`"${$('ncs-profile-name').value}" 프로필을 지금 내용으로 바꿔요.\n이 프로필은 모든 채팅에서 함께 쓰여서, 다른 채팅에서 만드는 그림에도 바뀐 외형이 적용돼요.\n\n계속할까요?`))return;
  const s=settings(),id=$('ncs-profile-id').value||uuid(),draftName=quickProfileName;
  const p={id,name:$('ncs-profile-name').value,aliases:$('ncs-profile-aliases').value.split(',').map(x=>x.trim()).filter(Boolean),
    subject:$('ncs-profile-subject').value,appearance:$('ncs-profile-appearance').value,defaultOutfit:$('ncs-profile-outfit').value,
    positive:$('ncs-profile-positive').value,negative:$('ncs-profile-negative').value,cardKey:$('ncs-binding').dataset.cardKey??'',wardrobe:readWardrobeForm()};
  // A field the form did not touch keeps what was saved elsewhere since the form opened (e.g. 프로필 업데이트 from a card).
  const stored=s.profiles.find(x=>x.id===id),merged=[];
  if(stored&&profileFormBase?.id===id)for(const k of PROFILE_KEYS){const was=JSON.stringify(profileFormBase[k]??null),now=JSON.stringify(stored[k]??null),form=JSON.stringify(p[k]??null);
    if(now!==was&&form===was){p[k]=clone(stored[k]);merged.push(k);}}
  const bind=pendingBind&&pendingBind.session===profileFormSession&&pendingBind.chatKey===keyOf()?pendingBind:null;
  const fromTemp=pendingTempConvert&&pendingTempConvert.session===profileFormSession&&pendingTempConvert.chatKey===keyOf();
  if(bind&&(bind.role==='character'||bind.role==='member')&&bind.avatar&&!p.cardKey&&!s.profiles.some(x=>x.id!==id&&x.cardKey===bind.avatar))p.cardKey=bind.avatar;
  // An edited profile keeps its place in the list; only a new one goes to the end (0.1.73, like presets in 0.1.68).
  const next=s.profiles.some(x=>x.id===id)?s.profiles.map(x=>x.id===id?p:x):[...s.profiles,p];const validated=validateProfiles(next);
  s.profiles=validated;ctx().saveSettingsDebounced();
  let linkError='';
  if(bind?.role==='user')try{await setChatBinding('userProfileId',id);}catch(e){linkError=e.message;}
  if(bind?.role==='user'&&(bind.session!==profileFormSession||bind.chatKey!==keyOf()))return;
  pendingBind=null; // only after the profile was accepted, so fixing a validation error keeps the planned link
  editProfile(id);renderProfiles();renderScene();changed();
  if(profileContext==='scene'){
    if(fromTemp)convertTemp(s.profiles.find(x=>x.id===id));
    const saved=s.profiles.find(x=>x.id===id),{restored}=attachSceneProfile(scene,saved,[draftName,...profileSceneNames(saved)]);
    attachToOtherMoments(saved,[draftName,...profileSceneNames(saved)]);
    placeProfileForm('profiles');changed();renderScene();showCard(saved.id);notice(`${saved.name} 프로필을 저장하고 장면에 넣었어요.${restored?' 추출해 둔 표정·행동·복장도 채웠어요.':' 장면 정보가 비어 있으면 장면 추출을 다시 눌러 확인할 수 있어요.'}`);
  }else if(profileContext==='scene-edit'){placeProfileForm('profiles');renderScene();notice(`"${p.name}" 프로필을 저장했어요. 모든 채팅의 그림에 함께 적용돼요.`);}
  else notice('프로필을 저장했어요.');
  if(linkError)notice(`프로필은 저장했지만 현재 채팅에 연결하지 못했어요. ${linkError}`,true);
}
// 0.1.70: a new profile always starts on 직접 입력 (user's choice); 설명으로 만들기 is one tap away and is not remembered.
function setProfileMode(mode) {
  mode=mode==='direct'?'direct':'describe';
  $('ncs-describe-box').hidden=mode!=='describe';
  for(const b of dialog.querySelectorAll('[data-profile-mode]'))b.setAttribute('aria-pressed',String(b.dataset.profileMode===mode));
}
// The one profile form moves between the profile tab and the scene tab, so both share the same fields and logic.
function placeProfileForm(where) {
  const form=$('ncs-profile-form'),slot=where==='scene'||where==='scene-edit'?$('ncs-scene-profile-slot'):$('ncs-profile-slot');
  if(form.parentElement!==slot)slot.append(form);
  const inScene=where==='scene'||where==='scene-edit';
  profileContext=where;$('ncs-scene-profile-slot').hidden=!inScene;
  $('ncs-profile-submit').textContent=where==='scene'?'저장하고 장면에 추가':'프로필 저장';
  const head=$('ncs-scene-profile-slot').querySelector('.ncs-quick-head strong');if(head)head.textContent=where==='scene-edit'?'프로필 편집':'새 프로필';
  form.querySelector('[data-action="delete-profile"]').hidden=inScene;
  renderSceneExtras();
}
// Something typed in the profile form that is not saved yet (compared with the profile as it was opened).
function profileFormDirty(){
  const b=profileFormBase??{name:'',aliases:[],subject:'boy',appearance:'',defaultOutfit:'',positive:'',negative:'',wardrobe:[]};
  const form={name:$('ncs-profile-name').value,aliases:$('ncs-profile-aliases').value.split(',').map(x=>x.trim()).filter(Boolean).join(','),subject:$('ncs-profile-subject').value,
    appearance:$('ncs-profile-appearance').value,defaultOutfit:$('ncs-profile-outfit').value,positive:$('ncs-profile-positive').value,negative:$('ncs-profile-negative').value,
    wardrobe:JSON.stringify(readWardrobeForm().map(w=>({name:w.name,outfit:w.outfit})))};
  const base={name:b.name??'',aliases:(b.aliases??[]).join(','),subject:b.subject??'boy',appearance:b.appearance??'',defaultOutfit:b.defaultOutfit??'',positive:b.positive??'',negative:b.negative??'',
    wardrobe:JSON.stringify((b.wardrobe??[]).filter(w=>w.name.trim()||w.outfit.trim()).map(w=>({name:w.name,outfit:w.outfit})))};
  // A description not turned into tags yet is typing too (UI-059-02).
  return Object.keys(form).some(k=>form[k]!==base[k])||!!$('ncs-profile-describe').value.trim();
}
// Opening another profile never silently drops what is being typed; the same profile keeps its typing.
function leaveProfileForm(nextName){
  return !profileFormDirty()||confirm(`작성 중인 프로필 내용이 아직 저장되지 않았어요.\n저장하지 않고 ${nextName}(으)로 바꿀까요?`);
}
function openProfileEditor(id,where){
  const p=settings().profiles.find(p=>p.id===id);if(!p)return;
  const same=$('ncs-profile-id').value===id;
  if(!same&&!leaveProfileForm(`"${p.name}" 편집`))return;
  if(!same||!profileFormDirty())editProfile(id);
  if(where==='scene'){placeProfileForm('scene-edit');$('ncs-scene-profile-slot').scrollIntoView?.({block:'start',behavior:'smooth'});}
  else if(profileContext!=='profiles')placeProfileForm('profiles');
}
function openQuickProfile(name='') {
  if(!leaveProfileForm('새 프로필 만들기'))return false; // the caller stops too (UI-059-01)
  editProfile();quickProfileName=name;if(name)$('ncs-profile-name').value=name;
  placeProfileForm('scene');if(dialog.querySelector('[data-tab="scene"]').getAttribute('aria-selected')!=='true')showTab('scene');
  requestAnimationFrame(()=>$('ncs-scene-profile-slot').scrollIntoView({block:'start',behavior:'smooth'})); // the form sits below the cards: bring it into view
  return true;
}
// --- People left out of the image (no profile) -------------------------------------------------
let pendingBind=null,linkTarget=null,missingPrompt=null,lastLink=null;
const SOURCE_NOTE=source=>`${source}에서 만들기: ${source} 설명 원문 앞부분(최대 4,000자)을 추출 AI로 보내 외형·복장 태그로 바꿔요. 보통 1회, 응답을 읽지 못하면 한 번 더(최대 2회) 호출해요. 결과를 확인한 뒤 저장해 주세요.`;
function missingState(){
  const people=keyOf()&&!isFree()?mainPeopleOf(ctx()):[],state=classifyMissing(scene.unregistered??[],people);state.absent=[];
  // The card character has no profile, but the extraction did not list them among the visible people: the notice
  // still names them, so offer the same make/link buttons (they are not counted as left out of this picture).
  const card=people.find(p=>p.role==='character');
  if(card&&scene.source&&!state.main.some(m=>m.person===card)){
    const m=matchChatProfiles(ctx(),settings().profiles,[],chatBindings());
    if(m.characterName&&!m.characterProfileId&&!scene.characters.some(c=>c.id&&c.id===chatBindings().characterProfileId))state.absent.push({name:m.characterName,person:card});
  }
  // The same for the user (0.1.78): no profile and not listed among the visible people → offer to make or link one too.
  const user=people.find(p=>p.role==='user');
  if(user&&scene.source&&!state.main.some(m=>m.person===user)){
    const m=matchChatProfiles(ctx(),settings().profiles,[],chatBindings());
    if(m.userName&&!m.userProfileId&&!scene.characters.some(c=>c.id&&c.id===chatBindings().userProfileId))state.absent.push({name:m.userName,person:user});
  }
  return state;
}
function chatBinding(field){return chatBindings()[field]??'';}
async function setChatBinding(field,id){
  await changeChatSetting(keyOf(),meta=>{meta.bindings??={};if(id)meta.bindings[field]=id;else delete meta.bindings[field];});
  revision++;
}
const skipMissingWarning=()=>ctx().chatMetadata?.[KEY]?.skipMissingWarning===true;
function setSkipMissingWarning(value){
  return changeChatSetting(keyOf(),meta=>{if(value)meta.skipMissingWarning=true;else delete meta.skipMissingWarning;});
}
// Profiles other than `except` that already use this name or alias; linking would make matching ambiguous.
const nameOwners=(name,except='')=>settings().profiles.filter(p=>p.id!==except&&[p.name,...p.aliases].some(x=>exactName(x,name)));
function renderMissingLink(name,person,profiles){
  if(linkTarget!==name)return '';
  const n=esc(name),help=person.role==='member'?'그룹 멤버는 이 카드와 프로필도 함께 연결해요.':person.role==='other'?'이번 장면에 연결해요. 별칭을 추가하면 다른 채팅에서도 같은 이름으로 알아봐요.':'이 채팅의 프로필 연결도 함께 바꿔요.';
  return `<div class="ncs-link-picker"><label>연결할 프로필<select id="ncs-link-profile">${profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><label class="ncs-check"><input id="ncs-link-alias" type="checkbox" checked>"${n}"을(를) 별칭에도 추가 · 다음부터 자동으로 알아봐요</label><small>${help} 잘못 골랐다면 바로 "연결 되돌리기"로 원래대로 돌릴 수 있어요.</small><div class="ncs-row"><button type="button" class="ncs-primary" data-missing-do="link-confirm" data-missing-name="${n}">연결</button><button type="button" data-missing-do="link-cancel" data-missing-name="${n}">취소</button></div></div>`;
}
function renderMissingMain(main,absent=[]){
  const profiles=settings().profiles,undo=lastLink&&lastLink.chatKey===keyOf()?lastLink:null;
  $('ncs-missing-main').innerHTML=(undo?`<div class="ncs-link-done">"${esc(undo.name)}"을(를) ${esc(undo.profileName)} 프로필에 연결했어요. 잘못 연결했다면 <button type="button" data-missing-do="link-undo" data-missing-name="${esc(undo.name)}">연결 되돌리기</button></div>`:'')+[...main,...absent].map(({name,person})=>{
    const n=esc(name),source=sourceLabel(person.role),hasText=!!descriptionFor(ctx(),person).text,linking=linkTarget===name;
    const reason=nameOwners(name).length?'프로필 연결을 확정하지 못해서':'프로필이 없어서',away=absent.some(a=>a.name===name),many=nameOwners(name).length>1;
    return `<div class="ncs-missing-main"><strong>⚠ ${away?`${esc(roleLabel(person.role))} "${n}"${many?'과(와) 이름이 같은 프로필이 여러 개라 연결하지 못했어요.':'에 연결된 프로필이 없어요.'}`:`${esc(roleLabel(person.role))} "${n}"의 ${reason} 이번 그림에 안 그려져요.`}</strong>
<p>${away&&many?'이번 장면에서는 AI가 찾지 못했어요. "기존 프로필 연결하기"로 하나를 고르면 이 채팅에서는 그 프로필을 써요.':away?'이번 장면에서는 AI가 찾지 못했어요. 프로필을 만들거나 연결하면 장면에 넣을 수 있고, 다음 추출부터 알아봐요.':'프로필을 만들거나 이미 만든 프로필에 연결하면 바로 장면에 들어가요.'}</p>
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
// A temporary person already in the scene under this name (so making or linking a profile replaces it).
const sameNameTemp=name=>scene.characters.find(c=>c.temp&&c.name&&identityKey(c.name)===identityKey(name))??null;
async function linkMissing(name,person){
  const s=settings(),p=s.profiles.find(x=>x.id===$('ncs-link-profile').value);if(!p)throw new Error('연결할 프로필을 골라 주세요.');
  const field0=person.role==='character'?'characterProfileId':person.role==='user'?'userProfileId':'',owners=nameOwners(name,p.id);
  if(owners.length&&!field0)throw new Error(`"${name}"은(는) 이미 ${owners.map(o=>o.name).join(', ')} 프로필의 이름·별칭이에요. 같은 이름이 두 프로필에 있으면 자동 연결이 안 돼요. 그 프로필을 고르거나, 그쪽 별칭을 먼저 정리해 주세요.`);
  const addAlias=$('ncs-link-alias').checked&&!owners.length&&![p.name,...p.aliases].some(x=>exactName(x,name));
  const setCard=person.role==='member'&&person.avatar&&!p.cardKey&&!s.profiles.some(x=>x.cardKey===person.avatar);
  const field=person.role==='character'?'characterProfileId':person.role==='user'?'userProfileId':'';
  const undo={chatKey:keyOf(),name,profileId:p.id,profileName:p.name,aliasAdded:addAlias,cardKeySet:setCard?person.avatar:'',field,previousBinding:field?chatBinding(field):'',addedToScene:!scene.characters.some(c=>c.id===p.id),sceneRef:scene};
  if(field)await setChatBinding(field,p.id);
  if(keyOf()!==undo.chatKey||scene!==undo.sceneRef)return;
  if(addAlias||setCard){
    s.profiles=validateProfiles(s.profiles.map(x=>x.id===p.id?{...x,aliases:addAlias?[...x.aliases,name]:x.aliases,cardKey:setCard?person.avatar:x.cardKey}:x));ctx().saveSettingsDebounced();
  }
  const beforeNames=[...(scene.unregistered??[])],beforeDetails=clone(scene.unregisteredDetails??[]);
  const temp=sameNameTemp(name),before=new Set(scene.characters);
  if(temp){
    undo.temp={card:clone(temp),at:scene.characters.indexOf(temp)};
    // The profile is already drawn here: the temporary card was the same person, so it goes (no second card).
    if(scene.characters.some(c=>!c.temp&&c.id===p.id))scene.characters=scene.characters.filter(c=>c!==temp);
    else{pendingTempConvert={id:temp.id,session:profileFormSession,chatKey:keyOf()};convertTemp(p);}
  }
  const {restored}=attachSceneProfile(scene,p,[name,...profileSceneNames(p)]);
  undo.otherMoments=attachToOtherMoments(p,[name,...profileSceneNames(p)]);undo.momentsRef=scene.moments;
  undo.addedCards=scene.characters.filter(c=>!before.has(c));undo.addedToScene=undo.addedCards.length>0;
  undo.removedNames=beforeNames.filter(n=>!scene.unregistered.includes(n));
  undo.removedDetails=beforeDetails.filter(c=>!scene.unregisteredDetails.some(d=>identityKey(d.entityName)===identityKey(c.entityName)));
  lastLink=undo;linkTarget=null;changed();renderScene();renderProfiles();renderMatching();showCard(p.id);
  notice(`"${name}"을(를) ${p.name} 프로필로 연결하고 장면에 넣었어요.${addAlias?' 별칭에도 추가해서 다음부터 자동으로 알아봐요.':' 별칭은 추가하지 않아서 다음 추출에서는 다시 확인이 필요할 수 있어요.'}${restored?' 추출해 둔 표정·행동·복장도 채웠어요.':' 장면 정보가 비어 있으면 장면 추출을 다시 눌러 확인할 수 있어요.'}`);
}
async function undoLink(){
  const u=lastLink;if(!u||u.chatKey!==keyOf()){lastLink=null;renderSceneExtras();return;}
  const s=settings();
  if(u.field)await setChatBinding(u.field,u.previousBinding);
  if(keyOf()!==u.chatKey)return;
  if(u.aliasAdded||u.cardKeySet){
    s.profiles=validateProfiles(s.profiles.map(x=>x.id!==u.profileId?x:{...x,aliases:u.aliasAdded?x.aliases.filter(a=>!exactName(a,u.name)):x.aliases,cardKey:u.cardKeySet&&x.cardKey===u.cardKeySet?'':x.cardKey}));ctx().saveSettingsDebounced();
  }
  if(scene===u.sceneRef){
    if(u.addedToScene)scene.characters=scene.characters.filter(c=>u.addedCards?!u.addedCards.includes(c):c.id!==u.profileId); // only cards this link added
    if(u.temp)scene.characters.splice(Math.min(u.temp.at,scene.characters.length),0,clone(u.temp.card));
    scene.unregistered=[...new Set([...(scene.unregistered??[]),...(u.removedNames??[u.name])])];
    scene.unregisteredDetails??=[];
    for(const detail of u.removedDetails??[])if(!scene.unregisteredDetails.some(c=>identityKey(c.entityName)===identityKey(detail.entityName)))scene.unregisteredDetails.push(clone(detail));
    // UI-078-02: the other 장면 후보 the link reached go back as well (switching candidates clears the undo, so they are untouched since).
    if(scene.moments&&scene.moments===u.momentsRef)for(const t of u.otherMoments??[]){
      const part=scene.moments[t.k]?.scene;if(!part||part!==t.scene)continue;
      part.characters=part.characters.filter(c=>!t.addedCards.includes(c));
      part.unregistered=[...new Set([...(part.unregistered??[]),...t.removedNames])];
      part.unregisteredDetails??=[];
      for(const d of t.removedDetails)if(!part.unregisteredDetails.some(c=>identityKey(c.entityName)===identityKey(d.entityName)))part.unregisteredDetails.push(d);
    }
  }
  lastLink=null;changed();renderScene();renderProfiles();renderMatching();
  notice(`"${u.name}" 연결을 되돌렸어요.${u.aliasAdded?' 추가했던 별칭도 지웠어요.':''}`);
}
async function missingAction(kind,name){
  if(kind==='dialog-source'){closeMissingDialog();kind='source';}
  if(kind==='link-undo'){await undoLink();return;}
  if(kind==='link-cancel'){linkTarget=null;renderSceneExtras();return;}
  const missing=missingState(),entry=[...missing.main,...missing.absent].find(m=>m.name===name)??(missing.others.includes(name)?{name,person:{role:'other',avatar:''}}:null);
  if(!entry){renderSceneExtras();return;}
  const {person}=entry;
  if(kind==='link'){linkTarget=linkTarget===name?null:name;renderSceneExtras();return;}
  if(kind==='link-confirm'){await linkMissing(name,person);return;}
  if(!openQuickProfile(name))return; // cancelled: no card link is planned for the profile being edited (UI-060-01)
  pendingBind={chatKey:keyOf(),role:person.role,avatar:person.avatar,session:profileFormSession};
  const temp=sameNameTemp(name);if(temp)pendingTempConvert={id:temp.id,session:profileFormSession,chatKey:keyOf()}; // UI-050-04: becomes that card
  if(kind==='direct'){setProfileMode('direct');notice(`"${name}" 프로필을 만들어 주세요. 저장하면 바로 장면에 들어가요.`);return;}
  const {text,truncated}=descriptionFor(ctx(),person);
  if(!text){setProfileMode('direct');notice(`${sourceLabel(person.role)} 설명이 비어 있어요. 직접 입력해 주세요.`,true);return;}
  setProfileMode('describe');$('ncs-profile-describe').value=text;
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
  if(skip){await setSkipMissingWarning(true);if(prompt.chatKey!==keyOf()||prompt.sceneRef!==scene)return;renderSceneExtras();}
  await generate(prompt.seedMode,{skipMissingCheck:true});
}
function renderSceneExtras() {
  const none=!settings().profiles.length;
  $('ncs-no-profiles').hidden=!none||profileContext==='scene';
  // Without profiles only "임시 인물 추가" is offered here; the empty-state box above handles the first profile.
  for(const el of [$('ncs-add-profile'),dialog.querySelector('[data-action="add-character"]'),$('ncs-add-row')?.querySelector?.('[data-action="quick-profile"]')])if(el)el.hidden=none;
  const {main,others,absent}=missingState(),names=others;
  renderMissingMain(main,absent);renderLeftOut(main,others);
  const profiles=settings().profiles;
  $('ncs-unregistered').innerHTML=names.length?`<small>장면에 보이지만 프로필이 없는 인물이에요. 그냥 두면 그림에서 빠져요. 이번 장면에만 그리려면 인물 칸으로 추가하고, 다음에도 쓰려면 프로필을 만들거나 연결하세요. 추출해 둔 표정·행동·복장을 함께 불러와요.</small>${names.map(n=>`<div class="ncs-unregistered-person"><div class="ncs-row"><button type="button" class="ncs-chip-add" data-quick-profile-name="${esc(n)}">＋ ${esc(n)} 프로필 만들기</button><button type="button" data-temp-from="${esc(n)}">${esc(n)} · 인물 칸으로 추가</button>${profiles.length?`<button type="button" data-missing-do="link" data-missing-name="${esc(n)}" aria-expanded="${linkTarget===n}">${esc(n)} · 기존 프로필 연결</button>`:''}</div>${renderMissingLink(n,{role:'other'},profiles)}</div>`).join('')}`:'';
}
async function convertProfile({source='',truncated=false}={}) {
  const originTab=profileContext,report=(message,error=false)=>notice(message,error,originTab);
  if(busy)return;
  const s=settings(),prompt=profileDraftPrompt($('ncs-profile-describe').value.trim(),{name:$('ncs-profile-name').value.trim(),format:s.format});
  const editing=$('ncs-profile-id').value,session=profileFormSession,ticket=++task,controller=new AbortController();extraction={ticket,controller,kind:'profile'};
  setBusy(true,ticket);startProgress('profile',ticket);report('설명을 이미지용 태그로 바꾸고 있어요.');
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
    if($('ncs-profile-id').value!==editing||session!==profileFormSession){report('프로필 칸이 바뀌어서 변환 결과를 적용하지 않았어요.');return;}
    const filled=['appearance','outfit','positive','negative'].some(k=>$(`ncs-profile-${k}`).value.trim());
    if(filled&&!confirm('지금 입력된 외형·기본 복장·Positive·Negative를 변환 결과로 바꿀까요?')){report('변환 결과를 적용하지 않았어요. 입력한 내용은 그대로예요.');return;}
    if(!$('ncs-profile-name').value.trim()&&draft.name)$('ncs-profile-name').value=draft.name;
    if(!$('ncs-profile-aliases').value.trim()&&draft.aliases.length)$('ncs-profile-aliases').value=draft.aliases.join(', ');
    $('ncs-profile-subject').value=draft.subject;
    for(const [id,key] of [['appearance','appearance'],['outfit','defaultOutfit'],['positive','positive'],['negative','negative']])$(`ncs-profile-${id}`).value=draft[key];
    if(source&&!draft.appearance.trim())report(`${source}에서 외형을 찾지 못했어요. 외형 칸을 직접 입력해 주세요.`,true);
    else report(source?`${source}에서 외형·복장을 가져왔어요.${truncated?' 설명이 길어서 앞 4,000자만 보냈어요.':''} 확인하고 고친 뒤 저장해 주세요.`:'태그로 바꿨어요. 인원 태그·외형·복장을 확인하고 고친 뒤 저장해 주세요.');
  }finally{
    if(extraction?.ticket===ticket)extraction=null;
    stopProgress(ticket);if(busyOwner===ticket)setBusy(false);
  }
}
// --- Moment candidates --------------------------------------------------------------------------
// The active candidate lives in scene's own fields; scene.moments keeps every candidate's (edited) copy.
// request: what 추가 요청 changed in this candidate (only the candidate it was applied to has one, UI-055-05).
const MOMENT_FIELDS=['characters','unregistered','unregisteredDetails','interaction','location','lighting','camera','request'];
function momentPart(from){const part={};for(const k of MOMENT_FIELDS)part[k]=clone(from[k]??(k==='request'?null:k==='interaction'||k==='location'||k==='lighting'||k==='camera'?'':[]));return part;}
function syncMoment(){if(scene.moments?.length>1&&scene.moments[scene.momentIndex])scene.moments[scene.momentIndex].scene=momentPart(scene);}
let restoredFinal=null;
function switchMoment(index){
  const list=scene.moments??[];if(!list[index]||index===scene.momentIndex)return;
  // A prompt restored from history is not the user's own edit; only a hand edit asks first.
  if(finalOverride&&finalOverride!==restoredFinal&&!confirm('직접 고친 최종 프롬프트가 있어요. 다른 순간으로 바꾸면 고른 순간의 조립 결과로 돌아가요. 바꿀까요?'))return;
  const temps=scene.characters.filter(c=>c.temp);
  syncMoment();Object.assign(scene,{request:null},clone(list[index].scene));scene.momentIndex=index;carryTemps(temps,scene);
  lastLink=null;linkTarget=null;changed();renderScene({forceFinal:true});
  // UI-075-08: people picked with @ who were only added to this candidate (still without a pose) are named again.
  const bare=(list[index].filled??[]).filter(name=>scene.characters.some(c=>!c.temp&&settings().profiles.find(p=>p.id===c.id)?.name===name&&!c.expression&&!c.action));
  notice(`"${list[index].title||`후보 ${index+1}`}" 순간으로 바꿨어요. 후보마다 고친 내용은 따로 남아 있어요.${bare.length?` ${emptyNote(bare)}`:''}`,false,'scene',{keep:bare.length>0});
}
function renderMoments(){
  const list=scene.moments??[],box=$('ncs-moments');box.hidden=list.length<2;placeRequest();if(list.length<2){box.innerHTML='';return;}
  box.innerHTML=`<strong class="ncs-moments-title">장면 후보 · 그릴 순간을 골라 주세요</strong><div class="ncs-moment-list" role="group" aria-label="장면 후보">${list.map((m,i)=>`<button type="button" class="ncs-moment" data-moment="${i}" aria-pressed="${i===scene.momentIndex}"><span class="ncs-moment-step">${i+1}</span><span class="ncs-moment-name">${esc(m.title||`후보 ${i+1}`)}</span>${i===list.length-1&&!scene.momentsPartial?'<small>마지막 순간</small>':''}</button>`).join('')}</div>`;
}
// --- Clothes on a scene card: 채팅 기본 복장 (this chat) · 복장 잠금 (lock) · 이번 그림 복장 (this image) · 옷장 -------
let wardrobeTarget=null,undoChatOutfit=null,outfitSaving=false,outfitSavingId=null;
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
// "지금: …" line under 이번 그림 복장; rebuilt while typing so 자동으로 되돌리기 appears at once.
function outfitNow(c,o,stale){
  const id=esc(c.id),edited=o.origin==='이번 편집';
  return `<small class="ncs-outfit-now">지금: ${esc(ORIGIN_TEXT[o.origin]??o.origin)}${o.value===''?' · 옷 태그 없이 그려요':''}${stale?' · 근거 메시지가 바뀌었어요. 옷을 확인해 주세요.':''}${edited?` <button type="button" class="ncs-chip-button" data-reset-outfit="${id}" title="직접 고친 옷을 버리고 잠금·AI 후보·기본 복장 규칙으로 다시 골라요">자동으로 되돌리기</button>`:''}</small>`;
}
// Two groups (docs/DESIGN.md): 이번 그림 (this image only) and 이 채팅에서 (carries on to later images).
function outfitControls(c,p,o,state,stale){
  const id=esc(c.id),wardrobe=p.wardrobe??[],choice=chatOutfitChoice(p,state),isDefault=state?.value!==undefined&&o.value===state.value,edited=o.origin==='이번 편집';
  const wear=wardrobe.length?`<select data-wear-once aria-label="옷장에서 이번 그림에만 꺼내 입기"><option value="">옷장에서 꺼내 입기</option>${wardrobe.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select>`
    :isFree()?'<small class="ncs-wardrobe-empty">옷장이 비어 있어요. 챗샷에서 [옷장에 저장]하면 프리샷에서도 꺼내 입을 수 있어요.</small>':'';
  const now=outfitNow(c,o,stale);
  const defaultTitle=isFree()?'프로필 기본 복장을 이번 그림에 입혀요':'채팅 기본 복장(없으면 프로필 기본 복장)을 이번 그림에 입혀요. AI가 찾은 옷 대신 쓸 때 눌러요';
  const naming=wardrobeTarget===c.id?`<div class="ncs-wardrobe-save"><label>옷장에 저장할 이름<input id="ncs-wardrobe-name" maxlength="80" placeholder="예: 비 오는 날 외출복"></label><div class="ncs-row ncs-form-actions"><button type="button" class="ncs-primary" data-wardrobe-confirm="${id}">저장</button><button type="button" data-wardrobe-cancel>취소</button></div></div>`:'';
  // "이 복장을": what to do with the clothes in 이번 그림 복장 (save as this chat's default / into the wardrobe).
  const keep=isFree()?`<div class="ncs-outfit-to"><small>이 복장을</small><div class="ncs-actions"><button type="button" data-to-wardrobe="${id}">옷장에 저장</button></div></div>`
    :`<div class="ncs-outfit-to" data-outfit-hold="${id}"><small>이 복장을</small><div class="ncs-actions">${isDefault?`<button type="button" data-save-outfit="${id}" class="ncs-on" aria-pressed="true" title="다시 누르면 채팅 기본 복장을 해제해요">✓ 이 채팅 기본 복장</button>`:`<button type="button" data-save-outfit="${id}" aria-pressed="false" title="이번 그림 복장을 이 채팅의 기본 복장으로 정해요">이 채팅 기본으로</button>`}<button type="button" data-to-wardrobe="${id}">옷장에 저장</button></div></div>`;
  const image=`<div class="ncs-outfit-group ncs-outfit-image"><div class="ncs-outfit-head">이번 그림 <small>이 그림에만 적용돼요</small></div><label>이번 그림 복장<textarea data-field="manualOutfit" rows="3">${esc(o.value)}</textarea></label>${now}${wear}<div class="ncs-actions"><button type="button" data-default-outfit="${id}" title="${defaultTitle}">기본 복장 입기</button><button type="button" data-empty-outfit="${id}" title="이 인물의 옷 태그를 빼고 그려요">비우기</button></div>${keep}${naming}${isFree()?'<small>프리샷은 프로필 기본 복장에서 시작해요. 채팅에 저장된 옷은 쓰지도 바꾸지도 않아요.</small>':''}</div>`; // 0.1.70: the name box sits right under [옷장에 저장]
  if(isFree())return image;
  const undo=undoChatOutfit?.key===keyOf()&&undoChatOutfit.scene===scene&&undoChatOutfit.id===c.id?`<div class="ncs-outfit-undo" role="status"><span>채팅 기본 복장을 해제했어요.</span><button type="button" data-undo-chat-outfit="${id}">해제 취소</button></div>`:'';
  const select=`<label>채팅 기본 복장<select data-chat-outfit${state?.value!==undefined?' class="ncs-on"':''}><option value="default" ${choice==='default'?'selected':''}>정하지 않음 · 프로필 기본 복장</option>${wardrobe.map(w=>`<option value="w:${esc(w.id)}" ${choice===`w:${w.id}`?'selected':''}>${esc(w.name)}</option>`).join('')}${choice==='custom'?'<option value="custom" selected>지정한 복장 · 옷장에 없음</option>':''}</select></label>`;
  const lock=`<label class="ncs-check${state?.locked?' ncs-on':''}"><input type="checkbox" data-lock ${state?.locked?'checked':''}>🔒 복장 잠금</label><details class="ncs-lock-help"><summary>ⓘ 잠금이 뭐예요?</summary><small>켜면 AI가 메시지에서 새 옷을 찾아도 그림에 적용하지 않아요. 채팅 기본 복장을 계속 입고, 채팅 기본 복장이 없으면 프로필 기본 복장을 입어요. '이번 그림 복장'에서 직접 고친 옷은 그대로 적용돼요.</small></details>${state?.locked&&c.outfitMode==='replace'?`<small>AI가 찾은 새 옷: ${esc(c.outfit)} · 잠긴 복장을 유지해요.</small>`:''}`;
  const chat=`<div class="ncs-outfit-group ncs-outfit-chat" data-outfit-chat="${id}" data-outfit-hold="${id}"><div class="ncs-outfit-head">이 채팅에서 <small>다음 그림에도 이어져요</small></div>${select}${undo||`<small>메시지에 복장 설명이 없으면 이 채팅에서 기본으로 입는 옷이에요.</small>${savedNote(c,state)}`}${lock}</div>`;
  return image+chat;
}
// Saving clothes holds only that card's chat controls (with a short "저장 중…"), never the whole drawing window.
function holdOutfitCard(id,on){
  const key=globalThis.CSS?.escape?.(id)??id,box=dialog?.querySelector(`[data-outfit-chat="${key}"]`);if(!box)return;
  for(const part of dialog.querySelectorAll(`[data-outfit-hold="${key}"]`))for(const el of part.querySelectorAll('button,select,input'))el.disabled=on;
  box.querySelector('.ncs-outfit-saving')?.remove();
  if(on)box.querySelector('.ncs-outfit-head')?.insertAdjacentHTML('beforeend','<small class="ncs-outfit-saving" role="status">저장 중…</small>');
}
// Metadata changes are serialized. Failure rolls back the captured chat, never the current chat.
async function writeChatOutfit(id,entry,manual){
  assertChat();if(isFree()||outfitSaving)throw new Error('복장 저장이 끝난 뒤 다시 선택해 주세요.');
  const key=keyOf(),startScene=scene,startFinal=JSON.stringify(finalOverride),startOptions=JSON.stringify(optionsOverride);
  const c=scene.characters.find(c=>c.id===id),oldManual=c?.manualOutfit;
  outfitSaving=true;outfitSavingId=id;holdOutfitCard(id,true);
  try{await changeChatSetting(key,meta=>{
    if(scene!==startScene||isFree()||c?.manualOutfit!==oldManual)throw new Error('장면이 바뀌었어요. 복장을 다시 선택해 주세요.');
    meta.outfits??={};
    if(entry===undefined)delete meta.outfits[id];else meta.outfits[id]=entry;
  });}
  catch(e){if(keyOf()===key&&scene===startScene)renderScene();throw e;}
  finally{outfitSaving=false;outfitSavingId=null;holdOutfitCard(id,false);}
  if(c&&c.manualOutfit===oldManual)c.manualOutfit=manual;
  if(keyOf()!==key||scene!==startScene||isFree())return false;
  // changed() rebuilds the final prompt from the new clothes; a final prompt or options edited while the save
  // was waiting are the user's newer work and stay (UI-050-03).
  const keptFinal=JSON.stringify(finalOverride)!==startFinal?finalOverride:null,keptOptions=JSON.stringify(optionsOverride)!==startOptions?optionsOverride:null; // values, not references (UI-052-04)
  justSavedOutfit=id;changed();
  if(keptFinal||keptOptions){if(keptFinal)finalOverride=keptFinal;if(keptOptions)optionsOverride=keptOptions;updateFinal({force:true});scheduleDraft();}
  return true;
}
async function setChatOutfit(id,value,{note}={}){
  const old=outfitState()[id],entry={value,locked:old?.locked??false,source:scene.source?compactSource(scene.source):null,updated:new Date().toISOString()};
  if(!await writeChatOutfit(id,entry,value))return;
  renderScene();if(note)notice(note);
}
// Back to "not set": the chat follows the profile's default outfit again. A lock stays on if it was on.
// True when this image wears exactly the chat's default outfit (the button shows "✓ 이 채팅 기본 복장").
function isChatDefaultNow(id){
  const c=scene.characters.find(c=>c.id===id),p=settings().profiles.find(p=>p.id===id),state=outfitState()[id];
  return !!c&&!!p&&state?.value!==undefined&&resolveOutfit(c,p,state).value===state.value;
}
// Typing in 이번 그림 복장 updates the button right away, without rebuilding the card.
function refreshDefaultButton(card,id){
  const b=card?.querySelector('[data-save-outfit]');if(!b)return;const on=isChatDefaultNow(id);
  b.setAttribute('aria-pressed',String(on));b.classList.toggle('ncs-on',on);b.textContent=on?'✓ 이 채팅 기본 복장':'이 채팅 기본으로';
}
function refreshOutfitTyping(card,c){
  refreshDefaultButton(card,c.id);
  const p=settings().profiles.find(p=>p.id===c.id),line=card?.querySelector('.ncs-outfit-now');if(!p||!line)return;
  const state=outfitState()[c.id],stale=state?.source&&!sourceValid(state.source,ctx().chat);
  line.outerHTML=outfitNow(c,resolveOutfit(c,p,state),stale);
}
async function clearChatOutfit(id){
  assertChat();const old=outfitState()[id];if(old?.value===undefined)return;
  const before={id,key:keyOf(),scene,entry:clone(old),manual:scene.characters.find(c=>c.id===id)?.manualOutfit};
  const entry=old.locked?{locked:true,source:old.source??null,updated:new Date().toISOString()}:undefined;
  if(!await writeChatOutfit(id,entry,null))return;
  undoChatOutfit={...before,after:JSON.stringify(entry)};renderScene();
  notice(`채팅 기본 복장을 해제했어요. 되돌리려면 인물 카드의 "해제 취소"를 눌러 주세요.${entry?.locked?' 복장 잠금은 켜져 있어요.':''}`);
}
async function undoChatOutfitClear(id){
  const u=undoChatOutfit;
  if(!u||u.id!==id||u.key!==keyOf()||u.scene!==scene||isFree()||JSON.stringify(outfitState()[id])!==u.after)throw new Error('복장 상태가 바뀌어서 해제 취소를 적용하지 않았어요.');
  if(!await writeChatOutfit(id,clone(u.entry),u.manual))return;
  renderScene();notice('채팅 기본 복장과 잠금·이번 그림 편집을 해제 전으로 되돌렸어요.');
}
function resetImageOutfit(id,{defaultOnly=false}={}){
  const c=scene.characters.find(c=>c.id===id),p=settings().profiles.find(p=>p.id===id);if(!c||!p)return;
  c.manualOutfit=defaultOnly?(outfitState()[id]?.value??p.defaultOutfit??''):null;
  changed();renderScene();notice(defaultOnly?'이번 그림에 기본 복장을 입혔어요. 채팅·프로필에 저장한 복장은 그대로예요.':(isFree()?'직접 고른 옷을 풀고 자동으로 되돌렸어요(AI가 찾은 옷 → 없으면 프로필 기본 복장).':'직접 고친 옷을 버리고 자동으로 다시 골랐어요(잠금 → AI 후보 → 채팅 기본 → 프로필 기본).'));
}
// 비우기: this person is drawn without clothing tags (an explicit empty edit, not "automatic").
function emptyImageOutfit(id){
  const c=scene.characters.find(c=>c.id===id);if(!c)return;
  c.manualOutfit='';changed();renderScene();notice('이번 그림은 이 인물의 옷 태그 없이 그려요. 되돌리려면 "자동으로 되돌리기"를 눌러 주세요.');
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
// 📌 고정 (프리샷): the card is kept even when the next text does not name it (and a temporary person keeps its look).
const pinButton=c=>`<button type="button" class="ncs-pin${c.pinned?' ncs-on':''}" data-pin="${esc(c.id)}" aria-pressed="${!!c.pinned}" title="${c.pinned?'고정을 풀어요. 다음 추출 때 글에 없으면 카드가 지워져요.':'글에 이 인물이 없어도 카드를 남겨요(체크만 풀려요). 임시 인물은 외형도 그대로 지켜요.'}">${c.pinned?'📌 고정됨':'📌 고정'}</button>`;
function tempCard(c){
  const id=esc(c.id),sel=(v,l)=>`<option value="${v}" ${c.subject===v?'selected':''}>${l}</option>`;
  return `<article class="ncs-character ncs-temp" data-character="${id}"><div class="ncs-character-head"><label class="ncs-check"><input type="checkbox" data-field="included" ${c.included!==false?'checked':''}><strong>${esc(c.name||'이름 없는 인물')}</strong></label><div class="ncs-head-buttons">${isFree()?pinButton(c):''}<button data-remove="${id}" aria-label="직접 입력한 인물 빼기">빼기</button></div></div>
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
function addTemp(name=''){dismissKeyboard();
  const detail=name?(scene.unregisteredDetails??[]).find(d=>identityKey(d.entityName)===identityKey(name)):null;
  const t=tempPerson(name,detail);scene.characters.push(t);
  if(name){scene.unregistered=(scene.unregistered??[]).filter(n=>identityKey(n)!==identityKey(name));scene.unregisteredDetails=(scene.unregisteredDetails??[]).filter(d=>identityKey(d.entityName)!==identityKey(name));}
  changed();renderScene();
  notice(name?`"${name}"을(를) 임시 인물로 넣었어요. 외형을 채워 주세요.${detail?' 추출해 둔 표정·행동·복장은 채웠어요.':''}`:'임시 인물을 넣었어요. 외형·복장·행동을 채워 주세요.');
}
// A new extraction or another candidate keeps temporary people, but never assumes they are still there:
// a name the AI found again takes its fresh fields; otherwise the card asks for a check.
function carryTemps(temps,part){
  const only=part.request?.visibleOnly===true; // "혼자"/"X만": the request decided who is visible (UI-055-02)
  for(const t of temps){
    if(part.characters.some(c=>c.id===t.id))continue;
    const detail=t.name?(part.unregisteredDetails??[]).find(d=>identityKey(d.entityName)===identityKey(t.name)):null;
    const copy={...clone(t),needsCheck:!detail&&!only};
    if(only&&!detail){copy.included=false;copy.requestExcluded=true;}
    else if(copy.requestExcluded){copy.included=true;delete copy.requestExcluded;}
    if(detail){copy.expression=detail.expression??'';copy.action=detail.action??'';if(detail.position&&detail.position!=='auto')copy.position=detail.position;if(detail.outfitMode==='replace'&&detail.outfit)copy.outfit=detail.outfit;
      part.unregistered=(part.unregistered??[]).filter(n=>identityKey(n)!==identityKey(t.name));part.unregisteredDetails=part.unregisteredDetails.filter(d=>d!==detail);}
    part.characters.push(copy);
  }
}
let pendingTempConvert=null;
function tempToProfile(id){
  const t=scene.characters.find(c=>c.id===id&&c.temp);if(!t)return;
  if(!openQuickProfile(t.name))return; // kept the typing: nothing else is filled in (UI-059-01)
  setProfileMode('direct');
  $('ncs-profile-name').value=t.name;$('ncs-profile-subject').value=['boy','girl','other'].includes(t.subject)?t.subject:'other';
  $('ncs-profile-appearance').value=t.appearance??'';$('ncs-profile-outfit').value=t.outfit??'';
  pendingTempConvert={id,session:profileFormSession,chatKey:keyOf()};
  notice('임시 인물의 이름·외형·복장으로 프로필 칸을 채웠어요. 확인하고 "저장하고 장면에 추가"를 눌러 주세요.');
}
// After the profile is saved, the temporary slot becomes that profile's slot (in every candidate), so nobody is doubled.
function convertTemp(profile){
  // 0.1.59: 📌 carries over; clothes the user typed stay their choice, clothes the AI found stay automatic.
  const convert=c=>c.id===pendingTempConvert.id&&c.temp?{id:profile.id,entityName:c.name||profile.name,included:c.included!==false,expression:c.expression,action:c.action,position:c.position,positionManual:c.positionManual,
    ...(c.pinned!==undefined?{pinned:c.pinned}:{}),...(c.outfitManual?{outfitMode:'unchanged',outfit:'',manualOutfit:c.outfit??''} // a chosen outfit stays chosen, empty too (UI-059-04)
      :c.outfit&&isFree()?{outfitMode:'replace',outfit:c.outfit,manualOutfit:null}:{outfitMode:'unchanged',outfit:'',manualOutfit:c.outfit?c.outfit:null})}:c;
  scene.characters=scene.characters.map(convert);
  for(const m of scene.moments??[])m.scene.characters=m.scene.characters.map(convert);
  pendingTempConvert=null;
}
function renderScene({forceFinal=false}={}) {
  if(isFree())for(const c of scene.characters)c.pinned??=false; // cards made in this session start unpinned
  renderMoments();
  for(const k of ['location','lighting','camera','interaction'])$(`ncs-${k}`).value=scene[k];
  renderSceneExtras();
  const profiles=settings().profiles,states=outfitState();
  $('ncs-character-help').textContent=`인물 카드 하나가 NAI의 캐릭터 프롬프트 하나에 해당해요. V5 최대 22명 · V4.5 최대 6명. (${MODELS[effectiveOptions().model]?.label??''} 최대 ${MODELS[effectiveOptions().model]?.limit??6}명)`;
  $('ncs-characters').innerHTML=scene.characters.map(c=>{
    if(c.temp)return tempCard(c);
    const p=profiles.find(p=>p.id===c.id);if(!p)return '';
    const o=resolveOutfit(c,p,states[c.id]);
    const stale=states[c.id]?.source && !sourceValid(states[c.id].source,ctx().chat);
    return `<article class="ncs-character" data-character="${esc(c.id)}"><div class="ncs-character-head"><label class="ncs-check"><input type="checkbox" data-field="included" ${c.included!==false?'checked':''}><strong>${esc(p.name)}</strong></label><div class="ncs-head-buttons">${isFree()?pinButton(c):''}<button data-remove="${esc(c.id)}" aria-label="${esc(p.name)} 장면에서 제거">제거</button></div></div>${clothesBadges(states[c.id])}
      <label>연결된 이미지 프로필<select data-profile-switch>${profiles.map(profile=>`<option value="${esc(profile.id)}" ${profile.id===c.id?'selected':''}>${esc(profile.name)}</option>`).join('')}</select></label><small>${c.entityName?'추출 인물: '+esc(c.entityName):'직접 추가한 인물'} · 변경하면 새 프로필의 복장을 사용해요.</small>
      <div class="ncs-grid"><label>표정<textarea data-field="expression" rows="2">${esc(c.expression)}</textarea></label><label>행동·포즈<textarea data-field="action" rows="2">${esc(c.action)}</textarea></label></div>
      <label>위치<select data-field="position">${['auto','left','center','right'].map((x,i)=>`<option value="${x}" ${c.position===x?'selected':''}>${['AI 선택','왼쪽','가운데','오른쪽'][i]}</option>`).join('')}</select></label>
      ${outfitControls(c,p,o,states[c.id],stale)}
      ${fixedLook(c,p)}
    </article>`;
  }).join('');
  if(outfitSavingId)holdOutfitCard(outfitSavingId,true);
  $('ncs-raw').value=raw;$('ncs-raw-copy').disabled=!raw;$('ncs-raw-copy').textContent='응답 복사';updateFinal({force:forceFinal});
}
// --- 고정 외형 · 전용 태그 (0.1.70): edited right on the card for this picture only (c.look); the profile stays as it is.
// [프로필 값으로 되돌리기] drops the edit; [프로필 편집] still opens the one profile editor to change the profile itself.
const lookOpen=new Set();
const LOOK_FIELDS=[['appearance','고정 외형'],['positive','전용 Positive'],['negative','전용 Negative']];
const lookOf=(c,p)=>Object.fromEntries(LOOK_FIELDS.map(([k])=>[k,typeof c.look?.[k]==='string'?c.look[k]:p?.[k]??'']));
function fixedLook(c,p){
  const id=esc(c.id),v=lookOf(c,p),edited=!!c.look&&Object.keys(c.look).length>0;
  return `<details class="ncs-fixed-look" data-look-box="${id}"${lookOpen.has(c.id)?' open':''}><summary>고정 외형 · 전용 태그 <small class="ncs-look-edited"${edited?'':' hidden'}>이번 그림만 고침</small></summary>${LOOK_FIELDS.map(([k,label])=>`<label class="ncs-look-field">${label}<textarea data-look-field="${k}" rows="${k==='appearance'?3:2}">${esc(v[k])}</textarea></label>`).join('')}<small>여기서 고친 내용은 이번 그림에만 쓰여요. 프로필은 바뀌지 않아요.</small><div class="ncs-look-actions"><button type="button" data-look-reset="${id}"${edited?'':' hidden'}>프로필 값으로 되돌리기</button><button type="button" data-edit-profile="${id}">프로필 편집</button></div></details>`;
}
// --- Temporary people (임시 인물): drawn in this scene only, never saved as a profile -----------------
// For assembly each one becomes a throwaway profile whose outfit is its own field.
function assembleScene(){
  const temps=scene.characters.filter(c=>c.temp),base=settings();
  // A card's look edited for this picture replaces that profile's look in this assembly only (0.1.70).
  const looked=scene.characters.filter(c=>!c.temp&&c.look&&Object.keys(c.look).length);
  const s=looked.length?{...base,profiles:base.profiles.map(p=>{const c=looked.find(c=>c.id===p.id);return c?{...p,...lookOf(c,p)}:p;})}:base;
  if(!temps.length)return assemble(s,scene,outfitState());
  const virtual=temps.map(t=>({id:t.id,name:t.name||'임시 인물',aliases:[],subject:['boy','girl','other'].includes(t.subject)?t.subject:'other',appearance:t.appearance??'',defaultOutfit:'',positive:'',negative:'',cardKey:''}));
  return assemble({...s,profiles:[...s.profiles,...virtual]},{...scene,characters:scene.characters.map(c=>c.temp?{...c,manualOutfit:c.outfit??''}:c)},outfitState());
}
function finalData(){return finalOverride??assembleScene();}
function updateFinal({force=false}={}) {
  if(!dialog)return;
  const help=$('ncs-character-help');if(help)help.textContent=`인물 카드 하나가 NAI의 캐릭터 프롬프트 하나에 해당해요. V5 최대 22명 · V4.5 최대 6명. (${MODELS[effectiveOptions().model]?.label??''} 최대 ${MODELS[effectiveOptions().model]?.limit??6}명)`;
  try {
    if(finalOverride?.invalid){$('ncs-warnings').textContent=`최종 프롬프트 JSON을 확인해 주세요: ${finalOverride.message}`;return;} // keep the user's in-progress text
    const a=finalData();if(force||!(finalOverride&&document.activeElement===$('ncs-final')))$('ncs-final').value=JSON.stringify(a,null,2);
    renderFinalForm(a,{force});$('ncs-final-badge').hidden=!finalOverride;
    const lengths=[`공통 ${a.base.length}자`,...a.characters.map(c=>`${c.name}: ${c.prompt.length}자`)];
    $('ncs-length').textContent=`${lengths.join(' · ')} · 글자 수예요. NAI 토큰 수와 달라요.`;
    // The shared core still words this one the old way; show it in the clothes vocabulary of the scene card.
    // The core's lock note is wrong when this picture's own clothes win (이번 편집, 추가 요청): those are drawn, not the lock (UI-056-01).
    const ownClothes=new Set(scene.characters.filter(c=>c.included!==false&&c.manualOutfit!==null&&c.manualOutfit!==undefined).map(c=>settings().profiles.find(p=>p.id===c.id)?.name).filter(Boolean));
    const warnings=[...(a.warnings??[])].filter(w=>!w.startsWith('미등록 인물은 자동 생성하지 않아요')&&![...ownClothes].some(n=>w===`${n}: 새 복장 후보가 있지만 잠금을 유지해요.`)).map(w=>w.replace(/: 새 복장 후보가 있지만 잠금을 유지해요\.$/,': AI가 찾은 새 옷이 있지만 잠긴 복장을 입혀요.'));
    for(const t of scene.characters.filter(c=>c.temp&&c.included!==false&&!(c.appearance??'').trim()))warnings.push(`임시 인물 ${t.name||'(이름 없음)'}의 외형이 비어 있어요. 외형을 채우면 더 잘 그려져요.`);
    if(scene.source?.historical)warnings.push('지난 메시지를 그리고 있어요. 여기서 고른 옷은 "채팅 기본 복장"을 자동으로 바꾸지 않아요.');
    if(scene.moments?.length>1&&scene.momentIndex<scene.moments.length-1)warnings.push('앞쪽 순간을 골랐어요. 메시지 끝에서는 옷이 달라졌을 수 있어요. "기본 복장 지정"은 마지막 순간에서 누르는 걸 추천해요.');
    if(scene.source&&!sourceValid(scene.source,ctx().chat))warnings.push('대상 메시지가 수정·삭제·리롤됐어요. 다시 추출하거나 내용을 확인해 주세요.');
    if(a.base.length+a.characters.reduce((n,c)=>n+c.prompt.length,0)>2000)warnings.push('프롬프트가 길어요. 특히 V4.5는 전체 토큰 한도를 확인해 주세요.');
    if(finalOverride)warnings.push('직접 고친 최종 프롬프트를 이번 생성에 써요. 되돌리려면 "조립 결과로 되돌리기"를 눌러 주세요.');
    if(optionsOverride)warnings.push(`이력에서 불러온 생성 설정(seed ${optionsOverride.seed})을 이번 생성에만 써요. 생성 성공·조립 결과로 되돌리기 시 현재 설정으로 돌아가요. 이 채팅의 마지막 작업에 함께 기억해요.`);
    $('ncs-warnings').textContent=warnings.join('\n');
    renderCost();
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
// --- @프로필 참조 (0.1.75) ----------------------------------------------------------------------------------------
// Before an extraction: references typed by hand are confirmed into @Name#id (the text changes, and the note says so);
// any reference that cannot be tied to exactly one profile stops it. Returns the text for the AI and the required people.
function prepareRefs(el,label){
  const tooLong=lengthProblem(el.value,el.id==='ncs-free-text'?'free':'wish');if(tooLong)throw new Error(tooLong);
  const profiles=settings().profiles,c=confirmRefs(el.value,profiles);
  if(c.problems.length)throw new Error(`${label}의 @참조를 확인해 주세요. ${c.problems.map(p=>p.message).join(' ')}`);
  // 0.1.79 (UI-076-02): a typed short alias can become a chip with a longer name — the result is checked again.
  {const after=lengthProblem(c.text,el.id==='ncs-free-text'?'free':'wish');if(after)throw new Error(`@이름을 칩으로 바꾸면 ${after}`);}
  if(c.confirmed.length){el.value=c.text;el.dispatchEvent(new Event('input',{bubbles:true}));}
  const x=refsForExtraction(c.text,profiles),limit=MODELS[effectiveOptions().model]?.limit??6;
  if(x.required.length>limit)throw new Error(`@로 지정한 필수 인물이 ${x.required.length}명이라 지금 모델의 한도(${limit}명)를 넘어요. 일부의 @를 지워 주세요.`);
  return {text:x.text,required:x.required,note:c.confirmed.length?`${c.confirmed.map(x=>x.from).join(', ')}을(를) 칩으로 확정했어요. `:''};
}
// Leftover reference marks never reach a card or NovelAI.
const unmark=value=>JSON.parse(JSON.stringify(value),(k,v)=>typeof v==='string'?stripRefMarks(v):v);
// A required person missing from the result gets a card anyway (ticked). present: ids of the profiles this response really
// returned (UI-075-04): a card that was only left over from an earlier scene is ticked but loses its old expression and action.
// Returns the names whose pose is empty now.
function ensureRequired(part,required,present=null){
  const empty=[];
  for(const p of required){
    let c=part.characters.find(c=>!c.temp&&c.id===p.id);
    // Another profile with the same name or alias: the AI gave no id, so whose action it is cannot be known. Leave it empty.
    const twin=settings().profiles.some(o=>o.id!==p.id&&[o.name,...(o.aliases??[])].some(n=>[p.name,...(p.aliases??[])].some(m=>identityKey(n)===identityKey(m))));
    if(!c){c=attachSceneProfile(part,p,[p.name],{ambiguous:twin}).character;c.pinned??=false;if(!c.expression&&!c.action)empty.push(p.name);}
    else if(present&&!present.has(p.id)){c.expression='';c.action='';empty.push(p.name);}
    c.included=true;
  }
  return empty;
}
const emptyNote=names=>names.length?`결과에 없던 필수 인물을 넣었어요: ${names.join(', ')}. 표정·행동이 비어 있어요. 직접 채우거나 다시 추출해 주세요.`:'';
// The list under the field while typing "@…": names with aliases and a short look (hair, eyes, usual outfit) to tell
// people with the same name apart. The id is never shown. Picking puts a chip in.
let refList=null; // {field,q,items,active}
function closeRefList(){refList=null;const box=$('ncs-ref-list');if(box)box.hidden=true;}
function updateRefList(field){
  const box=$('ncs-ref-list');if(!box)return;
  const q=field.caretQuery?.();
  if(!q||document.activeElement!==field){closeRefList();return;}
  const items=suggestions(settings().profiles,q.query);
  if(!items.length){closeRefList();return;}
  const same=refList&&refList.field===field&&refList.q.node===q.node&&refList.q.start===q.start;
  const active=same?Math.min(refList.active,items.length-1):0;
  refList={field,q,items,active};
  box.innerHTML=items.map((it,i)=>`<button type="button" role="option" class="ncs-ref-item" data-ref-pick="${i}" aria-selected="${i===active}"><b>${esc(it.name)}</b>${it.aliases.length?`<span class="ncs-ref-aliases">${esc(it.aliases.join(', '))}</span>`:''}${it.look?`<span class="ncs-ref-look">${esc(it.look)}</span>`:''}</button>`).join('');
  const r=field.getBoundingClientRect(),width=Math.min(Math.max(r.width,220),360);
  box.style.width=`${width}px`;box.style.left=`${Math.max(8,Math.min(r.left,innerWidth-width-8))}px`;
  box.hidden=false;const h=box.offsetHeight;
  box.style.top=`${r.bottom+4+h<=innerHeight-8?r.bottom+4:Math.max(8,r.top-4-h)}px`;
  // UI-075-06: the chosen item stays inside the list when the arrow keys go past what fits.
  const row=box.querySelector('[aria-selected="true"]');
  if(row){if(row.offsetTop<box.scrollTop)box.scrollTop=row.offsetTop-4;else if(row.offsetTop+row.offsetHeight>box.scrollTop+box.clientHeight)box.scrollTop=row.offsetTop+row.offsetHeight-box.clientHeight+4;}
}
function pickRef(i){
  if(!refList)return;const {field,q,items}=refList,it=items[i];if(!it)return;
  const p=settings().profiles.find(x=>x.id===it.id);if(!p)return;
  closeRefList();if(field.insertChip(q,p)===false)return;field.dispatchEvent(new Event('input',{bubbles:true}));
}
function bindRefFields(){
  const lengths={'ncs-free-text':{limit:LENGTH_LIMITS.free.visible,measure:displayLength},'ncs-moment-wish':{limit:LENGTH_LIMITS.wish.visible,measure:displayLength,singleLine:true}};
  for(const id of ['ncs-free-text','ncs-moment-wish']){
    const field=$(id);if(!field)continue;
    setupChipField(field,{getProfiles:()=>settings().profiles,...lengths[id]});
    const refresh=()=>updateRefList(field);
    field.addEventListener('input',refresh);field.addEventListener('compositionend',refresh);field.addEventListener('click',refresh);
    field.addEventListener('keyup',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key))refresh();});
    field.addEventListener('blur',()=>setTimeout(()=>{if(refList?.field===field&&document.activeElement!==field)closeRefList();},150));
    field.addEventListener('ncs-field-full',event=>notice(`${id==='ncs-free-text'?'상황 글':'추가 요청'}이 너무 길어서 ${event.detail?.chip?'칩을 넣지':'붙여 넣지'} 못했어요.`,true,'scene'));
    field.addEventListener('ncs-field-over',()=>notice(`${id==='ncs-free-text'?'상황 글':'추가 요청'}이 글자 수 한도를 넘었어요. 줄이기 전에는 추출하거나 생성할 수 없어요.`,true,'scene'));
    field.addEventListener('keydown',event=>{
      if(!refList||refList.field!==field||event.isComposing||event.keyCode===229)return;
      const n=refList.items.length;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();refList.active=(refList.active+(event.key==='ArrowDown'?1:n-1))%n;updateRefList(field);}
      else if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();pickRef(refList.active);}
      else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeRefList();}
    });
  }
  const box=$('ncs-ref-list');
  box.addEventListener('mousedown',event=>event.preventDefault()); // keeps the caret in the field
  box.addEventListener('click',event=>{const b=event.target.closest('[data-ref-pick]');if(b)pickRef(Number(b.dataset.refPick));});
  // Scrolling (also the field scrolling itself into view while typing) moves the list along instead of closing it.
  const follow=()=>{if(refList)updateRefList(refList.field);};
  dialog.querySelector('.ncs-content')?.addEventListener('scroll',follow,{passive:true});addEventListener('resize',follow);
}
// --- 프리샷: 적은 상황으로 장면 추출 -------------------------------------------------------------------------------
const FOREIGN_TEXT=/[\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u9FFF\uAC00-\uD7A3]/;
async function freeFill() {
  const originTab='scene',report=(message,error=false)=>notice(message,error,originTab);
  if(busy||!isFree())return;
  const s=settings(),refs=prepareRefs($('ncs-free-text'),'상황 글'),asked=$('ncs-free-text').value;
  // 0.1.59: the text decides who stays. Nothing changes before the response is valid; a cancelled question changes nothing.
  const plan=planFreePeople(scene.characters,plainNames(asked,s.profiles),s.profiles);
  const existing=plan.present.map(c=>c.temp?{id:'',name:c.name}:{id:c.id,name:s.profiles.find(p=>p.id===c.id)?.name??''}).filter(p=>p.name);
  const prompt=freeScenePrompt(refs.text,s.profiles,existing,s.format,refs.required,displayText(asked));
  if(plan.ask&&!confirm(confirmText(plan,s.profiles))){report('추출하지 않았어요. 글을 고치거나 남길 카드를 📌 고정해 주세요.');return;}
  const before={...captureWork(),scene:clone(scene),undoClear:null,targetShown,kind:'extract',label:'추출 전으로 되돌려요. 다시 고치거나 생성·비우기·가져오기를 하면 사라져요.'};
  const ticket=++task,rev=revision,controller=new AbortController();extraction={ticket,controller,kind:'free'};
  setBusy(true,ticket);startProgress('free',ticket);report('적은 상황으로 장면 칸을 채우고 있어요.');
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
        const parsed=unmark(parseFreeScene(response,s.profiles));
        const foreign=[...['interaction','location','lighting','camera'].filter(k=>FOREIGN_TEXT.test(parsed[k])),...new Set(parsed.characters.flatMap(c=>['appearance','outfit','expression','action'].filter(k=>FOREIGN_TEXT.test(c[k]))))];
        if(foreign.length&&attempt===0){retryForLanguage=true;report('결과가 영어가 아니어서 영어로 다시 요청하고 있어요.');continue;}
        if(ticket!==task||!isFree()||revision!==rev){report('작업 내용이 바뀌어서 채운 결과를 적용하지 않았어요.');return;}
        if($('ncs-free-text').value!==asked){report('추출하는 동안 상황 글이 바뀌어서 결과를 적용하지 않았어요. 바꾼 글로 다시 눌러 주세요.');return;} // UI-054-04
        raw=response;applyFree(parsed,foreign,plan,before,refs);return;
      }catch(e){if(controller.signal.aborted)return;failure=e;if(!received)break;}
    }
    if(ticket===task&&isFree()){raw=response;renderScene();report(`장면 추출 실패: ${failure?.message}.${looksCut(response)?` 응답이 불완전해요. ${limitHint()}`:''} 기존 편집 내용은 유지했어요.`,true);}
  }finally{
    if(extraction?.ticket===ticket)extraction=null;
    stopProgress(ticket);if(busyOwner===ticket)setBusy(false);
  }
}
// Fills the scene from the text: saved profiles keep their stored look; anyone else becomes (or updates) a temporary person.
// Who a 프리샷 person is. A unique name/alias match wins over the returned id; a shared one stays a temporary person
// (look kept) rather than guessing. An id whose profile does not carry that name is trusted only for a person the
// user already put in the picture and described without a new look (e.g. "the girl" for a chosen profile).
function freeIdentity(c,appearance,profiles,selectedIds,requiredIds=new Set()){
  const key=identityKey(c.name??''),byName=key?profiles.filter(p=>[p.name,...(p.aliases??[])].some(n=>identityKey(n)===key)):[];
  // 0.1.75: a person picked with @ is told apart by the id the AI was given, when that profile carries the name.
  if(byName.length>1&&c.id&&requiredIds.has(c.id)&&byName.some(p=>p.id===c.id))return {profile:byName.find(p=>p.id===c.id)};
  if(byName.length===1)return {profile:byName[0],corrected:!!c.id&&c.id!==byName[0].id};
  // Several profiles answer to this name: the AI's id is not proof. Only a card the user already has in this work decides (UI-059-05).
  // 0.1.79 (UI-076-01): two picked people share this name and the id is not checked: nobody gets it, even with a card already there.
  if(byName.filter(p=>requiredIds.has(p.id)).length>1)return {ambiguous:true,twinRequired:true};
  if(byName.length>1){const mine=byName.filter(p=>selectedIds.has(p.id));return mine.length===1?{profile:mine[0]}:{ambiguous:true};}
  const p=c.id?profiles.find(p=>p.id===c.id):null;if(!p)return {};
  if(!key)return {profile:p};
  if(selectedIds.has(p.id)&&!String(appearance??'').trim())return {profile:p};
  return {};
}
function applyFree(parsed,foreign=[],plan=planFreePeople(scene.characters,plainNames($('ncs-free-text').value,settings().profiles),settings().profiles),before=null,refs={required:[],note:''}){
  const s=settings(),names=[...s.profiles.flatMap(p=>[p.name,...p.aliases]),...parsed.characters.map(c=>c.name)];
  const generic=genericizeScene({...parsed,unregistered:[],characters:parsed.characters.map(c=>({...c,outfitMode:c.outfit?'replace':'unchanged'}))},names,s.format).scene;
  const fixed=[],unsure=[],unknownTwins=[],selectedIds=new Set(plan.present.filter(x=>!x.temp).map(x=>x.id));
  const people=generic.characters.map((c,i)=>{
    const appearance=parsed.characters[i]?.appearance??'';
    // UI-054-02: the returned id is checked against the name (names and aliases of saved profiles).
    const who=freeIdentity(c,appearance,s.profiles,selectedIds,new Set(refs.required.map(p=>p.id)));
    if(who.corrected)fixed.push(c.name);
    // 0.1.80 (UI-076-01): one of two or more picked people with this name, but which one is unknown. It is not a new
    // person either, so no temporary card is made for it (the picked people keep their own, empty, cards).
    if(who.twinRequired){unknownTwins.push(c.name);return null;}
    if(who.ambiguous)unsure.push(c.name);
    return {profile:who.profile??null,name:c.name,subject:c.subject,appearance,outfit:c.outfitMode==='replace'?c.outfit:'',expression:c.expression,action:c.action,position:c.position};
  });
  const out=applyFreePeople(scene.characters,plan,people.filter(Boolean),{makeTemp:tempPerson});
  const emptyRequired=ensureRequired({characters:out.cards},refs.required,new Set(people.filter(x=>x?.profile).map(x=>x.profile.id)));out.notShown=out.notShown.filter(c=>!refs.required.some(p=>p.id===c.id));
  for(const k of ['location','lighting','camera','interaction'])scene[k]=generic[k]??'';
  scene.characters=out.cards;scene.unregistered=[];scene.unregisteredDetails=[];scene.source=null;
  finalOverride=null;optionsOverride=null;restoredFinal=null;revision++;
  if(before){undoClear=before;renderUndo();} // replaces the previous undo only now that this extraction is applied
  renderScene({forceFinal:true});rememberDraft();
  const label=c=>c.temp?(c.name||'이름 없는 인물'):(s.profiles.find(p=>p.id===c.id)?.name??'인물');
  const drawn=out.cards.filter(c=>c.included);
  const emptyLooks=drawn.filter(c=>c.temp&&!(c.appearance??'').trim()).length;
  const parts=[refs.note,`장면 칸을 채웠어요. 그릴 인물 ${drawn.length}명. 확인한 뒤 생성해 주세요.`,emptyNote(emptyRequired),
    plan.removed.length?`글에 없는 카드를 지웠어요: ${plan.removed.map(label).join(', ')}.`:'',
    plan.pinnedOut.length?`📌 고정 카드는 남기고 체크를 풀었어요: ${plan.pinnedOut.map(label).join(', ')}.`:'',
    out.notShown.length?`글에 이름은 있지만 이번 장면엔 보이지 않아 체크를 풀었어요: ${out.notShown.map(label).join(', ')}.`:'',
    out.refreshed.length?`임시 인물 외형을 새 결과로 바꿨어요: ${out.refreshed.map(label).join(', ')}.`:'',
    fixed.length?`이름에 맞는 프로필로 바로잡았어요: ${fixed.join(', ')}.`:'',
    unknownTwins.length?`@로 고른 같은 이름의 인물이 여러 명이라 누구인지 알 수 없어 비워 뒀어요: ${[...new Set(unknownTwins)].join(', ')}. 표정·행동을 직접 채워 주세요.`:'',
    unsure.length?`같은 이름·별칭의 프로필이 여러 개라 임시 인물로 넣었어요: ${unsure.join(', ')}. 맞는 프로필로 바꿔 주세요.`:'',
    emptyLooks?'외형이 비어 있는 임시 인물은 직접 채워 주세요.':'',
    foreign.length?`영어로 바뀌지 않은 칸이 있어요(${foreign.join(', ')}).`:'',
    before&&(plan.removed.length||plan.pinnedOut.length||out.refreshed.length)?'잘못됐다면 [↶ 추출 취소]를 눌러 주세요.':''];
  notice(parts.filter(Boolean).join(' '),false,'scene',{keep:!!(plan.removed.length||plan.pinnedOut.length||out.notShown.length||out.refreshed.length||unsure.length||foreign.length||emptyRequired.length||refs.note)});
}
async function extract() {
  const originTab='scene',report=(message,error=false)=>notice(message,error,originTab);
  if(busy)return;assertChat();
  const s=settings();if(!s.profiles.length){openQuickProfile();report('등록된 프로필이 없어요. 아래에서 첫 프로필을 만들면 바로 추출할 수 있어요.');return;}
  if(ctx().streamingProcessor && !ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 추출해 주세요.');
  const refs=prepareRefs($('ncs-moment-wish'),'추가 요청'),requiredIds=refs.required.map(p=>p.id);
  const selection=chooseSceneMessages(ctx().chat,{target:$('ncs-target').value===''?null:Number($('ncs-target').value),recent:Number($('ncs-recent').value),includeUser:$('ncs-include-user').checked});
  stampSource(selection.source,ctx().chat);
  const startKey=keyOf(),rev=revision,ticket=++task,profiles=clone(s.profiles),outfits=clone(outfitState());
  const matching=matchChatProfiles(ctx(),profiles,selection.messages,chatBindings(),[...scene.characters.filter(c=>c.included!==false).map(c=>c.id),...requiredIds]);
  matching.required=new Set(requiredIds); // 0.1.75: people picked with @ (may not be in the message)
  const wish=$('ncs-moment-wish').value.trim();
  // Positions the user chose by hand survive a re-extraction of the same message.
  // Temporary people survive a new extraction (marked for a check unless the AI found them again).
  const keptTemps=[...new Map([scene,...(scene.moments??[]).map(m=>m.scene)].flatMap(part=>(part.characters??[]).filter(c=>c.temp)).map(t=>[t.id,t])).values()];
  const manualPositions=new Map();
  if(scene.source?.target===selection.source.target)for(const part of [scene,...(scene.moments??[]).map(m=>m.scene)])for(const c of part.characters??[])if(c.positionManual&&c.id)manualPositions.set(c.id,c.position);
  const prompt=momentExtractionPrompt(selection.messages,matching.profiles,outfits,s.format,matching.mappings,refs.text.trim(),refs.required);
  const controller=new AbortController();extraction={ticket,controller};
  dropUndo();setBusy(true,ticket);startProgress('extract',ticket);report('장면 추출을 시작했어요.');
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
        const parsed=unmark(parseMoments(response,profiles));
        // Fields in the chat's language instead of English: ask once more, then accept with a note.
        const foreign=foreignFields(parsed.moments);
        if(foreign.length&&attempt===0){retryForLanguage=true;report('추출 결과가 영어가 아니어서 영어로 다시 요청하고 있어요.');continue;}
        if(foreign.length)parsed.warnings.push(`영어로 바뀌지 않은 칸이 있어요(${foreign.join(', ')}). 직접 고치거나 다시 추출해 주세요.`);
        if(ticket!==task||keyOf()!==startKey||revision!==rev||!sourceValid(selection.source,ctx().chat)){report('채팅·장면 또는 원문이 바뀌어서 추출 결과를 적용하지 않았어요.');return;}
        if($('ncs-moment-wish').value.trim()!==wish){report('추출하는 동안 추가 요청이 바뀌어서 결과를 적용하지 않았어요. 바꾼 요청으로 다시 눌러 주세요.');return;} // UI-055-04
        // Each candidate is reconciled and cleaned on its own, so one moment's people and poses never leak into another.
        const c=ctx(),baseNames=[...s.profiles.flatMap(p=>[p.name,...p.aliases]),...matching.profiles.flatMap(p=>[p.name,...p.aliases]),...matching.mappings.map(m=>m.name),
          matching.userName,matching.characterName,c.name1,c.name2];
        const warnings=[...matching.warnings,...parsed.warnings],removed=new Set();
        // 추가 요청 belongs to the candidate it was applied to; its clothing goes through the same matching and cleaning.
        const request=wish&&parsed.request?{applied:[...parsed.request.applied],ignored:[...parsed.request.ignored],visibleOnly:parsed.request.visibleOnly===true}:null;
        let emptyRequired=[];
        const moments=parsed.moments.map((m,i)=>{
          const reconciled=reconcileCharacters(m.scene,matching);
          const generic=genericizeScene(reconciled.scene,[...baseNames,...reconciled.scene.unregistered,...reconciled.scene.characters.map(x=>x.entityName)],s.format);
          for(const w of [...m.warnings,...reconciled.warnings])if(!warnings.includes(w))warnings.push(w);
          generic.removed.forEach(x=>removed.add(x));
          for(const ch of generic.scene.characters)if(manualPositions.has(ch.id)){ch.position=manualPositions.get(ch.id);ch.positionManual=true;}
          const part=momentPart(generic.scene);
          if(request&&i===parsed.defaultIndex){part.request=request;applyRequestOutfits(part,parsed.request.outfits,request);}
          const empty=ensureRequired(part,refs.required);if(i===parsed.defaultIndex)emptyRequired=empty;
          carryTemps(keptTemps,part);
          return {title:m.title,scene:part,...(empty.length?{filled:empty}:{})}; // UI-075-08: who was added to which candidate
        });
        raw=response;
        scene={...blankScene(),...clone(moments[parsed.defaultIndex].scene),source:selection.source,moments:moments.length>1?moments:[],momentIndex:moments.length>1?parsed.defaultIndex:0,momentWish:wish,momentsPartial:parsed.partial};
        finalOverride=null;optionsOverride=null;lastLink=null;linkTarget=null;revision++;renderScene();
        if(removed.size)warnings.push(`장면 설명에 들어간 이름(${[...removed].join(', ')})을 빼고 일반 표현으로 정리했어요.`);
        const lead=parsed.partial?`응답이 불완전해요. 온전히 받은 후보 ${moments.length}개만 보여줘요. 메시지의 마지막 순간이 빠졌을 수 있어요. ${limitHint()} `:wish&&!parsed.requestMatched?'요청한 순간을 이 메시지에서 찾지 못해서 마지막 순간으로 골랐어요. ':moments.length>1?`장면 후보 ${moments.length}개를 찾았어요. 위에서 그릴 순간을 고를 수 있어요. `:'';
        const asked=request?[request.applied.length?`추가 요청 반영: ${request.applied.join(' · ')}.`:'',request.ignored.length?`반영하지 않음: ${request.ignored.join(' · ')}.`:''].filter(Boolean).join(' ')+' ':'';
        const must=emptyNote(emptyRequired);
        notice(refs.note+lead+asked+(must?must+' ':'')+(warnings.length?warnings.join(' / '):'추출했어요. 복장과 행동을 확인한 뒤 생성해 주세요.'),false,originTab,{keep:!!must||!!refs.note||parsed.partial||!!(wish&&!parsed.requestMatched)||foreign.length>0});return;
      }catch(e){if(controller.signal.aborted)return;failure=e;if(!received)break;}
    }
    if(ticket===task&&keyOf()===startKey){raw=response;renderScene();report(`추출 실패: ${failure?.message}.${looksCut(response)?` 응답이 불완전해요. ${limitHint()}`:''} 기존 편집 내용은 유지했어요.`,true);}
  }finally{
    if(extraction?.ticket===ticket)extraction=null;
    stopProgress(ticket);if(busyOwner===ticket)setBusy(false);
  }
}
// Clothing asked for in 추가 요청 is this picture's own choice (like 이번 그림 복장, so a lock does not hide it). It is
// taken from the matched and cleaned scene, never from the raw list (UI-055-03): the person is found by name after
// identity matching, and hair/eye/skin words are dropped because fixed appearance follows the profile.
// A clothing phrase is split into pieces (comma, semicolon, "and", "with"), and a piece that talks about hair, eyes or
// skin is dropped, natural phrases like "blue hair tied back" included; hair accessories (ribbon, clip, band…) stay (UI-056-01).
function requestPerson(part,o){
  // Matched like the rest of the app: the scene name, or the profile's name and aliases (UI-056-02).
  const key=identityKey(o.name??''),profiles=settings().profiles;
  return (part.characters??[]).find(c=>{
    if(!o.name)return c.id===o.id;
    if(identityKey(c.entityName??'')===key||identityKey(c.name??'')===key)return true;
    const p=profiles.find(p=>p.id===c.id);return !!p&&[p.name,...(p.aliases??[])].some(n=>identityKey(n)===key);
  });
}
function applyRequestOutfits(part,outfits,request){
  let lookDropped=false;
  for(const o of outfits??[]){
    const c=requestPerson(part,o);
    if(!c||c.outfitMode!=='replace'||!String(c.outfit??'').trim()){request.ignored.push(`${o.name||'인물'} 복장 · 장면에서 찾지 못함`);continue;}
    const {kept,dropped}=dropLookWords(c.outfit);if(dropped)lookDropped=true;
    if(!kept.length){
      // Nothing left but looks: the cleaned scene must not quietly fall back to the raw phrase.
      c.outfit='';c.outfitMode='unchanged';request.ignored.push(`${o.name||'인물'} 복장 · 장면에서 찾지 못함`);continue;
    }
    c.outfit=kept.join(', ');c.manualOutfit=c.outfit;
  }
  if(lookDropped)request.ignored.push('복장 속 머리·눈 등 · 프로필 고정 외형');
  request.ignored=[...new Set(request.ignored)];
}
async function saveOutfit(id,lockOnly=null) {
  assertChat();const c=scene.characters.find(c=>c.id===id),p=settings().profiles.find(p=>p.id===id),old=outfitState()[id];
  const value=lockOnly!==null?old?.value:resolveOutfit(c,p,old).value;
  const source=lockOnly!==null?old?.source:(scene.source?compactSource(scene.source):null);
  const entry={locked:lockOnly??old?.locked??false,source,updated:new Date().toISOString()};if(value!==undefined)entry.value=value;
  if(!await writeChatOutfit(id,entry.value===undefined&&!entry.locked?undefined:entry,c?.manualOutfit))return;
  renderScene();notice(lockOnly!==null?(lockOnly?'복장을 잠갔어요. AI가 이 채팅에서 복장을 바꾸지 못해요.':'복장 잠금을 풀었어요. AI가 장면 속 복장 변경을 반영할 수 있어요.'):'채팅 기본 복장으로 지정했어요. 다음 그림에도 이어져요.');
}
function compactSource(source) {
  return {...source,fingerprints:source.fingerprints.map(f=>({index:f.index,swipeId:f.swipeId,signature:f.signature??textSignature(f.text),...(f.sendDate?{sendDate:f.sendDate}:{})}))};
}
// The drawn message's send time: with it 메시지로 가기 can tell "this message, edited" from "another message
// that moved into its place" (UI-052-03). Older images and restored drafts have none and are never guessed.
// At generation the work may come from a restored draft (which keeps no send time): stamp it only when the
// message at that number still matches the drawn text and swipe.
function stampSource(source,chat,{check=false}={}){
  for(const f of source?.fingerprints??[]){
    const m=chat[f.index];if(f.index!==source.target||f.sendDate||typeof m?.send_date!=='string'||!m.send_date)continue;
    if(check&&!(sourceValid({fingerprints:[f]},chat)))continue;
    f.sendDate=m.send_date;
  }
  return source;
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
// --- Account and Anlas ------------------------------------------------------------------------------
// One account check feeds both the drawing tab (balance + ↻) and Settings (NAI 연결 확인). A failed check
// never leaves an old balance looking current. The difference shown is "since the last check", not a cost.
let account={sub:null,at:0,failed:false,message:'',previous:null,checking:null,keyConfigured:null};
const anlasTotal=sub=>{const a=sub?.anlas;if(!a||(a.subscription==null&&a.purchased==null))return null;return (Number(a.subscription)||0)+(Number(a.purchased)||0);};
// [NAI 연결 확인] also asks for the account reply's field names (no values; server 0.1.14 'account-shape').
let accountShape=null,shapeUnsupported=false,shapeAt=0,shapeStale=false;
// UI-068-01: each check has a number; a refusal (dropAccount) moves the number on, so a check that started before the
// refusal can neither restore the old verdict nor clear the refusal note when its answer comes in late.
let accountEpoch=0;
function refreshAccount({shape=false}={}){
  if(account.checking)return account.checking;
  const epoch=accountEpoch;let mine=null;
  mine=account.checking=(async()=>{
    await null; // UI-069-01: let account.checking be set first, so ↻ shows as locked at once
    renderAccount();
    try{
      const data=await api(shape?'/status?shape=1':'/status'),before=anlasTotal(account.sub)??account.previous;
      if(epoch!==accountEpoch)return data; // outdated: a refusal came in meanwhile
      if(shape){accountShape=data.keyConfigured&&Array.isArray(data.subscription?.shape)?data.subscription.shape.filter(x=>typeof x==='string'):null;shapeAt=Date.now();shapeStale=false;
        shapeUnsupported=!!data.keyConfigured&&!accountShape&&!(data.features??[]).includes('account-shape');renderShape();}
      const {shape:_names,...sub}=data.subscription??{};
      subscription=data.keyConfigured&&data.subscription?sub:null;consentRefused=false; // a fresh check decides again
      account={...account,sub:subscription,at:Date.now(),failed:!data.keyConfigured,keyConfigured:!!data.keyConfigured,
        message:data.keyConfigured?'':'NAI 키가 없어요. 실리태번 API 연결 화면에서 저장해 주세요.',previous:before};
      return data;
    }catch(e){if(epoch!==accountEpoch)throw e;subscription=null;account={...account,sub:null,failed:true,message:e.message};if(shape&&accountShape){shapeStale=true;renderShape();}throw e;}
    finally{if(account.checking===mine)account.checking=null;renderAccount();if(dialog)updateFinal();}
  })();
  return account.checking;
}
// --- Account box D (0.1.67): line 1 "tier · this generation", line 2 "Anlas · V5 · checked at", details on tap.
const TIER_NAMES={0:'Paper',1:'Tablet',2:'Scroll',3:'Opus'};
const tierName=sub=>typeof sub?.tier==='number'?TIER_NAMES[sub.tier]??`구독 등급 ${sub.tier}`:'';
const modelShort=model=>String(model).includes('diffusion-5')?'V5':String(model).includes('4-5')?'V4.5':MODELS[model]?.label??'';
// GPT 0.1.67 wording: we cannot tell the reply changed, only that a needed field is missing.
const missingText=()=>'계정 정보에서 필요한 항목을 확인하지 못했어요. 무료 생성 여부를 확인할 수 없어, '+(settings().allowAnlas===true?'현재 Anlas 사용이 허용되어 있어요. 생성하면 Anlas가 차감될 수 있어요.':'생성하려면 Anlas 사용 허용이 필요해요.');
function v5Short(sub){
  if(sub?.tier!==3)return '';const u=usageOf(sub);
  if(!u||u.percent===null||u.isNegative===null)return '<span class="ncs-v5-warn">V5 확인 못 함</span>';
  if(u.isNegative)return '<span class="ncs-v5-warn">V5 쓸 수 없음</span>';
  // 0.1.90: labels bold, the extra usage in the number colour, the base number in the warning colour once V5 asks.
  return `<span class="ncs-anlas-label">V5</span> <b${u.percent<=V5_ASK_AT?' class="ncs-low"':''}>${esc(String(u.percent))}%</b>${u.purchasedPercent?` <span class="ncs-v5-extra">(+${esc(String(u.purchasedPercent))}%)</span>`:''}`;
}
function v5Detail(sub){
  const u=usageOf(sub);if(!u||u.percent===null||u.isNegative===null)return '확인하지 못했어요';
  return `${u.isNegative?'지금 쓸 수 없어요 · ':''}${u.percent}%${u.purchasedPercent!==null?` · 추가 구매 ${u.purchasedPercent}%`:''}`;
}
function verdictOf(guard,model){
  const sub=account.sub,tier=tierName(sub),m=modelShort(model),pre=tier?`${tier} · `:'';
  if(!sub){if(account.checking&&!account.at)return {text:'계정 확인 중…',state:'neutral'};
    if(account.failed)return {text:account.keyConfigured===false?'NAI 키가 없어요 · 설정에서 확인':'계정 확인 실패 · 다시 확인',state:'warn'};
    return {text:'계정 확인 전',state:'neutral'};}
  switch(guard.kind){
    case 'free':return {text:`${pre}${m} 무료 조건에 해당해요 ✓`,state:'ok'};
    // 0.1.90: green = Anlas is not expected by what was checked; orange "ask" = this generation is confirmed first.
    case 'usage':return {text:`${pre}V5 남은 사용량으로 생성`,state:'ok'};
    case 'ask':return guard.reason==='low'?{text:`${pre}V5 사용량 거의 소진 · 생성 때 확인`,state:'ask'}
      :guard.reason==='empty'?{text:`${pre}V5 기본 사용량 없음 · 생성 때 확인`,state:'ask'}
      :{text:guard.reason==='negative'?`${pre}V5 사용량을 지금 쓸 수 없어요`:`${pre}V5 사용량 확인 못 함`,state:'warn'};
    case 'inactive':return {text:`${pre}구독 비활성 · 무료 생성 대상 아님`,state:'warn'};
    case 'uses':return {text:`${pre}${sub.tier===3?'기본 조건을 넘어 Anlas를 사용해요':'이 생성은 Anlas를 사용해요'}`,state:'spend'};
    default:return {text:guard.missing?'계정 정보에서 필요한 항목을 확인하지 못했어요':`${pre}무료 여부를 확인할 수 없어요`,state:'warn'};
  }
}
function renderAccount(){
  if(!dialog)return;const box=$('ncs-anlas-balance'),total=anlasTotal(account.sub),button=dialog.querySelector('[data-action="refresh-anlas"]');
  button.disabled=!!account.checking;
  const v5=v5Short(account.sub),time=account.at?new Date(account.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):''; // 24-hour (0.1.90)
  if(account.checking&&!account.at&&!account.failed)box.textContent='Anlas 확인 중…';
  else if(account.failed)box.textContent=account.keyConfigured===false?'NAI 키가 없어요 · 설정에서 확인':'잔액 확인 실패 · 다시 확인';
  else if(total===null)box.innerHTML=account.at?`Anlas 잔액을 알 수 없어요${v5?` · ${v5}`:''} · ${esc(time)} 확인`:'Anlas 확인 전';
  else{const diff=account.previous!=null?total-account.previous:0;
    box.innerHTML=`<span class="ncs-anlas-label">Anlas</span> <b${total<=0?' class="ncs-low"':''}>${total.toLocaleString()}</b>${v5?` · ${v5}`:''} · ${esc(time)} 확인${diff?` · 이전 조회보다 ${diff>0?'+':'−'}${Math.abs(diff).toLocaleString()}`:''}`;}
  const sub=account.sub,tier=tierName(sub),s=sub?.anlas;
  $('ncs-account-tier').textContent=sub?`${tier} · ${sub.active===true?'활성':sub.active===false?'비활성':'활성 여부 확인 못 함'}${sub.isGracePeriod===true?' · 유예 기간':''}`:'—';
  $('ncs-v5-row').hidden=sub?.tier!==3;if(sub?.tier===3)$('ncs-v5-detail').textContent=v5Detail(sub);
  const guard=costGuard(effectiveOptions(),sub);
  $('ncs-status').textContent=account.failed?(account.message||'연결을 확인하지 못했어요.'):sub?
    `서버 연결됨 · ${tier} · Anlas ${total===null?'?':total.toLocaleString()} (구독 ${s?.subscription??'?'} + 구매 ${s?.purchased??'?'})${sub.tier===3?` · V5 ${v5Detail(sub)}`:''}${guard.missing?' · 계정 정보에서 필요한 항목을 확인하지 못했어요.':''}`:$('ncs-status').textContent;
}
// A refusal from the server means the shown verdict may be old: forget it until the next check comes back.
function dropAccount(){accountEpoch++;subscription=null;account={...account,sub:null,at:0,failed:false,message:'',checking:null};if(dialog)renderAccount();}
function toggleAccount(){
  const more=dialog.querySelector('[data-action="toggle-account"]'),open=more.getAttribute('aria-expanded')!=='true';
  more.setAttribute('aria-expanded',String(open));$('ncs-account-details').hidden=!open;more.querySelector('.ncs-anlas-caret').textContent=open?'▴':'▾';
}
// The cost line, worded for the account; with consent off, a non-free generation is not sent.
function renderCost(){
  // Blocked here once the account is known (a missing field too); an unchecked account is left to the server, which
  // checks it itself just before sending and answers anlas-consent if needed (then consentRefused shows the same note).
  const guard=costGuard(effectiveOptions(),subscription),off=settings().allowAnlas!==true,blocked=off&&guard.consent==='setting'&&!!subscription;
  if(!off)consentRefused=false; // only consent or a fresh successful check (refreshAccount) clears a server refusal
  const v=verdictOf(guard,effectiveOptions().model);$('ncs-verdict').textContent=v.text;$('ncs-anlas-box').dataset.state=v.state;
  $('ncs-cost').textContent=guard.missing?missingText():stepsWord(guard.message);$('ncs-cost-link').hidden=false; // every model (0.1.90)
  renderUsageNote(guard);
  const show=blocked||(off&&consentRefused);$('ncs-consent-note').hidden=!show;const here=dialog.querySelector('.ncs-consent-check');here.hidden=!show;$('ncs-allow-anlas-here').checked=settings().allowAnlas===true;
  return {guard,blocked};
}
// 0.1.90: one line under the Opus V5 verdict, in place of the switch (V5 no longer uses the saved switch).
function renderUsageNote(guard){
  const note=$('ncs-usage-note'),may='<b>Anlas가 차감될 수 있어서</b> 생성할 때마다 한 번씩 물어봐요.';
  const text=guard.kind==='usage'?'확인한 사용량 기준으로 <b>V5 사용량으로 생성해요.</b>'
    :guard.kind!=='ask'?''
    :guard.reason==='low'?`V5 사용량이 ${esc(String(guard.percent))}% 남았어요. 이제부터 ${may}`
    :guard.reason==='empty'?(guard.purchasedPercent>0?'기본 사용량을 다 썼어요. 추가 구매 사용량이 먼저 쓰일 수도 있지만 <b>Anlas가 차감될 수도 있어서</b> 생성할 때마다 물어봐요.':`V5 사용량을 다 썼어요. ${may}`)
    :guard.reason==='negative'?`V5 사용량을 지금 쓸 수 없어요. ${may}`
    :'사용량을 확인하지 못했어요. ↻로 다시 확인해 주세요. 그대로 생성하면 <b>Anlas가 차감될 수 있다고</b> 한 번 물어봐요.';
  note.innerHTML=text;note.hidden=!text;note.classList.toggle('ncs-usage-alert',guard.kind==='ask');
}
// The server's usage-confirm question, one sentence per line.
const usageQuestion=message=>`${String(message).replace(/\. /g,'.\n')}\n이번만 생성할까요?`;
let consentRefused=false;
// Shows the switch; turning it on is left to the person.
function gotoAnlasSetting(){
  const box=$('ncs-allow-anlas'),label=box?.closest?.('label');if(!label)return;label.scrollIntoView({block:'center',behavior:'smooth'});
  box.focus({preventScroll:true});label.classList.remove('ncs-attention');void label.offsetWidth;label.classList.add('ncs-attention');
}
async function refreshStatus() {
  checkServer({force:true}).catch(()=>{});
  await account.checking?.catch(()=>{}); // a check already running did not ask for the field names
  return refreshAccount({shape:true});
}
function renderShape(){
  if(!dialog)return;const box=$('ncs-account-shape');box.hidden=!accountShape&&!shapeUnsupported;
  $('ncs-shape-list').textContent=accountShape?accountShape.join('\n'):'서버 플러그인을 0.1.14 이상으로 업데이트하면 보여요.';
  dialog.querySelector('[data-action="copy-shape"]').disabled=!accountShape||shapeStale;
  // UI-066-01: after a failed check the old list stays readable but is marked and cannot be copied as current.
  $('ncs-shape-status').textContent=shapeStale?`이전 조회(${new Date(shapeAt).toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'})}) 결과예요. 이번 확인은 실패해서 복사할 수 없어요.`:'';
}
async function copyShape(){
  if(!accountShape)return;try{await copyText(accountShape.join('\n'),dialog);$('ncs-shape-status').textContent='복사했어요.';}catch(e){$('ncs-shape-status').textContent=e.message;}
}
const GENERATION_REQUESTS='naice-shot-pending-generation';
const pendingGenerations=new Map();
try{
  const saved=JSON.parse(sessionStorage.getItem(GENERATION_REQUESTS)??'[]');
  if(Array.isArray(saved))for(const [key,id] of saved){if(typeof key==='string'&&typeof id==='string')pendingGenerations.set(key,id);}
}catch{}
let checkingGeneration=false;
function rememberGeneration(key,id){
  pendingGenerations.delete(key);
  if(id)pendingGenerations.set(key,id);
  try{sessionStorage.setItem(GENERATION_REQUESTS,JSON.stringify([...pendingGenerations]));}catch{}
  renderGenerationCheck();
}
function renderGenerationCheck(){
  const button=dialog?.querySelector('[data-action="generation-check"]');if(!button)return;
  // 0.1.87: the request is remembered as soon as it is sent (so a lost reply can be checked again), but the two
  // buttons only appear once nothing is running: during the generation itself they flashed up for a moment.
  button.hidden=!pendingGenerations.has(workKey())||busy&&!checkingGeneration;
  button.disabled=checkingGeneration||busy||attaching;
  const forget=dialog.querySelector('[data-action="generation-forget"]');
  forget.hidden=button.hidden;forget.disabled=button.disabled;$('ncs-generation-recover').hidden=button.hidden;
}
async function checkGeneration(entry=null){
  const key=entry?.chatKey??workKey(),requestId=entry?.id??pendingGenerations.get(key);
  if(!requestId||busy||attaching||checkingGeneration)return;
  checkingGeneration=true;updateAttachButtons();
  const current=()=>entry?historyPending.some(x=>x.id===requestId):workKey()===key&&pendingGenerations.get(key)===requestId;
  try{
    let reply=await api(`/generation?requestId=${encodeURIComponent(requestId)}`,{signal:draftSignal()});
    if(!current())return;
    if(reply.state==='save-failed'&&(entry||confirm('그림은 이미 받았어요. 같은 그림을 서버에 다시 저장할까요?'))){
      reply=await api('/generation',{method:'POST',body:{requestId},signal:draftSignal()});
      if(!current())return;
    }
    if(reply.state==='complete'){
      if(reply.item?.id!==requestId||reply.item.chatKey!==key)throw new Error('현재 작업의 생성 결과를 확인하지 못했어요.');
      imageDownload(reply.item);
      if(pendingGenerations.get(key)===requestId)rememberGeneration(key,null);
      if(workKey()===key){result=reply.item;renderResult();rememberDraft();}
      loadHistory().catch(()=>{});
      refreshAccount().catch(()=>{});notice(entry?'그림을 생성 이력에 저장했어요.':'같은 요청의 그림을 불러왔어요.',false,entry?'history':'scene');return;
    }
    const tab=entry?'history':'scene';
    // 0.1.22 server (P3-2): cleared by "delete all" before its result was known — the 확인 필요 mark stays.
    if(reply.state==='discarded'&&reply.unconfirmed===true){notice('이 요청 기록은 이력 전체 삭제 때 정리됐지만, 생성·차감 여부는 확인하지 못했어요. NovelAI에서 확인한 뒤 [확인 표시 지우기]를 눌러 주세요. 새 생성 요청은 보내지 않았어요.',true,tab);return;}
    if(['rejected','discarded'].includes(reply.state)){
      if(pendingGenerations.get(key)===requestId)rememberGeneration(key,null);
      notice(reply.state==='rejected'?'NovelAI가 이 요청을 거절했어요.':'이 그림의 복구 기록을 지웠어요.',false,tab);
      if(entry)loadHistory().catch(()=>{});
      return;
    }
    if(reply.state==='missing'){notice('서버에서 이 요청 기록을 찾지 못했어요. 생성·차감 여부는 NovelAI에서 확인해 주세요.',true,tab);return;}
    if(reply.state==='processing'){notice('이 요청은 아직 처리 중이에요. 잠시 뒤 다시 확인해 주세요.',false,tab);return;}
    if(reply.state==='save-failed'){notice('그림은 받았지만 아직 저장하지 못했어요. 같은 요청으로 다시 확인해 주세요.',true,tab);return;}
    notice('이 요청의 생성·차감 여부를 확인하지 못했어요. NovelAI에서 확인해 주세요. 새 생성 요청은 보내지 않았어요.',true,tab);
  }catch(e){if(current())notice(e.message,true,entry?'history':'scene');}
  finally{checkingGeneration=false;updateAttachButtons();}
}
async function generate(seedMode=null,{skipMissingCheck=false}={}) {
  const originTab='scene',report=(message,error=false)=>notice(message,error,originTab);
  if(busy||checkingGeneration)return;if(!isFree())assertChat();
  // Nothing extracted or entered yet: the image would be the common prompt alone. Ask first.
  const emptyScene=!scene.characters.some(c=>c.included!==false)&&!['location','lighting','camera','interaction'].some(k=>(scene[k]??'').trim());
  if(!skipMissingCheck&&emptyScene&&!finalOverride&&!confirm(isFree()?'장면 칸이 비어 있어요. 인물·장소 없이 공통 프롬프트만으로 그릴까요?\n\n확인: 그대로 그리기 · 취소: 돌아가서 상황을 적고 "장면 추출"을 누르거나 인물 추가하기':'장면을 아직 추출하지 않았어요. 인물·장소 없이 공통 프롬프트만으로 그릴까요?\n\n확인: 그대로 그리기 · 취소: 돌아가서 "장면 추출" 누르기')){report(isFree()?'생성하지 않았어요. 상황을 적고 "장면 추출"을 누르거나 인물을 추가해 주세요.':'생성하지 않았어요. "장면 추출"을 먼저 눌러 주세요.');return;}
  // No 공통 이미지 프리셋 chosen (and no history settings in use): say which settings will be used, every time.
  if(!skipMissingCheck&&!settings().imagePresetId&&!optionsOverride&&!confirm('공통 이미지 프리셋을 고르지 않았어요.\n설정 탭의 기본 생성 설정(모델·크기·Steps 등)과 공통 프롬프트로 그릴까요?\n\n확인: 그대로 그리기 · 취소: 돌아가서 "3 · 생성"에서 프리셋 고르기')){report('생성하지 않았어요. "3 · 생성"에서 공통 이미지 프리셋을 고를 수 있어요.');return;}
  if(!skipMissingCheck){const {main}=missingState();if(main.length&&!skipMissingWarning()){openMissingDialog(main,seedMode);return;}}
  const s=settings(),startKey=workKey(),ticket=++task;
  if(isFree()){const tooLong=lengthProblem($('ncs-free-text').value,'free');if(tooLong)throw new Error(tooLong);} // before anything is sent
  if(finalOverride?.invalid)throw new Error('최종 프롬프트 JSON이 올바르지 않아요. 고치거나 "조립 결과로 되돌리기"를 눌러 주세요.');
  const a=clone(finalData()),submittedFinal=finalOverride,submittedOptions=optionsOverride;
  const options=clone(effectiveOptions());
  if(renderCost().blocked){gotoAnlasSetting();throw new Error(`${costGuard(options,subscription).message} Anlas 사용 허용이 꺼져 있어서 보내지 않았어요.`);}
  options.seed=seedMode==='same'&&result?result.seed:seedMode==='new'||options.seed===-1?crypto.getRandomValues(new Uint32Array(1))[0]:options.seed;
  buildPayload(a,options); // Local validation before network or billing.
  if(!a.base.trim()&&!a.characters.length)throw new Error('장면이나 프롬프트를 먼저 입력해 주세요.');
  syncMoment();
  const snapshot={scene:clone(scene),...(isFree()?{mode:'free',freeText:$('ncs-free-text').value}:{}),...(s.retainRawExtraction===true?{rawExtraction:stripReasoningBlocks(raw)}:{})};snapshot.scene.source=scene.source?compactSource(stampSource(clone(scene.source),ctx().chat,{check:true})):null;
  if(workKey()!==startKey)return;
  const priorRequest=pendingGenerations.get(startKey);
  if(!priorRequest&&serverFeatures.includes('pending-history')){
    const before=revision,{pending}=await api(`/generation?chatKey=${encodeURIComponent(startKey)}`,{signal:draftSignal()});
    if(ticket!==task||workKey()!==startKey||before!==revision||busy||attaching||checkingGeneration)return;
    if(pending?.length&&!confirm('이 작업에 저장을 마치지 못한 그림이 있어요. 이력에서 저장을 다시 시도할 수 있어요. 새 그림을 생성할까요?')){
      showTab('history');return;
    }
  }
  if(priorRequest&&!confirm('이전 요청의 결과가 아직 확인되지 않았어요. 새로 생성하면 Anlas가 다시 차감될 수 있어요. 새 요청을 보낼까요?'))return;
  const requestId=uuid(),canRecover=serverFeatures.includes('generation-recovery');
  if(canRecover)rememberGeneration(startKey,requestId);
  dropUndo();setBusy(true,ticket);startProgress('generate',ticket);report('NAI에 생성 요청을 보내고 있어요. 창을 닫거나 채팅을 바꿔도 서버는 결과를 저장해요.');
  rememberDraft(startKey,null,{flush:true});const generationDraft=drafts.entry(startKey);generationDraft.pinned=true;const savedDraftVersion=generationDraft.version;
  try {
    let item,confirmUsage=false;
    for(;;){
      try{item=await api('/generate',{method:'POST',body:{requestId,chatKey:startKey,assembled:a,options,allowAnlas:s.allowAnlas,retainRawExtraction:s.retainRawExtraction===true,snapshot,...(confirmUsage?{confirmUsage:true}:{})}});break;}
      catch(e){
        // 0.1.90: Opus V5 with little or unknown usage. The server sent nothing to NovelAI and wrote no request record,
        // so after a yes the same request (same ID and content) goes once more; a no or a changed work stops here.
        if(e.code!=='usage-confirm'||confirmUsage)throw e;
        refreshAccount().catch(()=>{});
        const stop=()=>{if(pendingGenerations.get(startKey)===requestId)rememberGeneration(startKey,priorRequest);};
        if(ticket!==task||workKey()!==startKey||!confirm(usageQuestion(e.message))){stop();report('생성 요청을 보내지 않았어요.');return;}
        if(ticket!==task||workKey()!==startKey){stop();report('작업이 바뀌어서 생성 요청을 보내지 않았어요.');return;}
        confirmUsage=true;
      }
    }
    if(pendingGenerations.get(startKey)===requestId)rememberGeneration(startKey,null);
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
      report('생성이 끝났어요. 시작한 곳의 이력에서 확인할 수 있어요.');return;
    }
    // Consume only the submitted overrides; keep a newer edit made while awaiting the response.
    const resetFinal=finalOverride===submittedFinal;
    if(resetFinal)finalOverride=null;
    if(optionsOverride===submittedOptions)optionsOverride=null;
    revision++;updateFinal({force:resetFinal});
    result=item;renderResult();report('생성했어요 · 그림을 누르면 크게 볼 수 있어요.');loadHistory().catch(()=>{});
    refreshAccount().catch(()=>{}); // a failed balance check never turns a finished image into a failure
  }catch(e){
    const refused=['anlas-consent','usage-confirm','nai-account','nai-auth','nai-anlas','nai-permission','nai-busy','nai-rejected','generation-not-sent'];
    if(pendingGenerations.get(startKey)===requestId&&(refused.includes(e.code)||e.status===400||e.status===409&&!e.code))rememberGeneration(startKey,priorRequest);
    if(pendingGenerations.get(startKey)===requestId&&!e.code)throw new Error('생성 결과를 받지 못했어요. [같은 요청으로 다시 확인]을 먼저 눌러 주세요.');
    // The server's own consent block shows the switch; NovelAI's Anlas or key errors re-check the balance.
    // UI-067-01: the server refused (consent) or could not check the account just before sending: the last "free"
    // verdict is dropped at once and checked again; the refusal note stays until a fresh check succeeds.
    if(e.code==='anlas-consent'||e.code==='nai-account'){consentRefused=true;dropAccount();renderCost();if(e.code==='anlas-consent')gotoAnlasSetting();refreshAccount().catch(()=>{});}
    else if(e.code==='nai-anlas'||e.code==='nai-auth')refreshAccount().catch(()=>{});
    throw e;
  }finally{generationDraft.pinned=false;stopProgress(ticket);if(busyOwner===ticket)setBusy(false);}
}
const chatRows=()=>ctx().chat.map((m,i)=>({m,i})).filter(({m})=>isSceneMessage(m));
// Where an image goes by default: where it is already attached, else the message it was generated for, else the latest.
function preferredTarget(item,{fallback=true}={}) {
  const chat=ctx().chat,existing=chat.findIndex(m=>m.extra?.naice_shot_images?.some(x=>x.id===item.id));
  if(existing>=0)return existing;
  const made=locateSource(item.snapshot?.scene?.source,chat);if(made.index!==null)return made.index;
  return fallback?chatRows().filter(({m})=>!m.is_system).at(-1)?.i:null;
}
function imageControls(item) {
  const save=saveMenu(item,`ncs-result-save-${item.id}`);
  if(isFree())return `<div class="ncs-row">${save.button}<button type="button" data-action="delete-result" class="ncs-danger-outline">삭제</button></div>${save.menu}`;
  const attached=hasInlineImage(ctx().chat,item);
  return `<div class="ncs-row"><button data-action="attach" class="ncs-primary">본문에 넣기</button>${attached?'<button data-action="detach">이미지 빼기</button>':''}${save.button}<button type="button" data-action="delete-result" class="ncs-danger-outline">삭제</button></div>${save.menu}`;
}
function renderResult() {
  renderGenerationCheck();
  $('ncs-result').innerHTML=result?`<button type="button" class="ncs-image-open" data-view-result aria-label="생성된 장면 크게 보기"><img src="${esc(result.image)}" alt="생성된 장면"></button>${imageControls(result)}<div class="ncs-row"><button data-action="same-seed">같은 seed로 생성</button><button data-action="new-seed">새 seed로 생성</button><button type="button" data-view-result>크게 보기</button></div><small>seed ${esc(result.seed)} · ${esc(MODELS[result.options?.model]?.label)} · 메시지 본문은 유지되고, 첨부 그림은 본편 AI 입력에 포함되지 않아요.</small>`:'';
  updateAttachButtons();
}
function updateAttachButtons() {
  const locked=busy||attaching||checkingGeneration;
  for(const el of dialog.querySelectorAll('[data-action="attach"],[data-action="detach"],[data-history-free],[data-history-attach],[data-history-detach],[data-history-delete],[data-pending-save],[data-pending-discard],[data-action="delete-result"],[data-history-pick],[data-history-star],[data-history-tag-save]'))el.disabled=locked||el.dataset.unavailable==='true';
  for(const el of document.querySelectorAll('[data-ncs-inline-remove]'))el.disabled=locked;
  updateHistoryTools();renderGenerationCheck();
}
let savingSelection=false;
const downloadFile=downloadOriginal;
// Saves the selected history images, either as one ZIP (one download prompt, reliable on phones)
// or one file at a time with a short gap so browsers do not drop any.
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function zipChosen(){const v=settings().saveAsZip;return typeof v==='boolean'?v:!!globalThis.matchMedia?.('(pointer:coarse)').matches;}
async function saveSelected(clean=false) {
  const originTab=activeTab(),report=(message,error=false)=>notice(message,error,originTab);
  const items=historyItems.filter(x=>selectedIds.has(x.id)).sort((a,b)=>String(a.created).localeCompare(String(b.created)));
  if(!items.length||savingSelection)return;
  savingSelection=true;updateHistoryTools();
  try{
    if(items.length===1){if(clean){await saveCleanImage(items[0]);report('클린 PNG(메타데이터 제거)를 저장했어요.');}else{const file=imageDownload(items[0]);downloadFile(file.url,file.filename);report('선택한 그림 1장을 원본 PNG로 저장했어요.');}return;}
    if(!zipChosen()){
      let saved=0,missing=0;
      for(const [i,item] of items.entries()){
        report(`선택한 그림을 하나씩 저장하고 있어요… ${i+1}/${items.length}`);
        try{if(clean)await saveCleanImage(item);else{const file=imageDownload(item),check=await fetch(file.url,{method:'HEAD',cache:'no-store'});if(!check.ok)throw new Error(String(check.status));downloadFile(file.url,file.filename);}saved++;}catch{missing++;}
        if(i<items.length-1)await wait(400);
      }
      // The browser does not report finished downloads, so this says what was started.
      report(`${clean?'클린':'원본'} PNG ${saved}장 저장을 시작했어요. 다운로드 목록에서 확인해 주세요.${missing?` ${missing}장은 불러오지 못했어요. ZIP으로 받아 보세요.`:''}`);
      return;
    }
    const files=[];let missing=0;
    for(const [i,item] of items.entries()){
      report(`선택한 그림을 모으고 있어요… ${i+1}/${items.length}`);
      try{
        if(clean){const file=await cleanImageFile(item);files.push({name:file.filename,data:new Uint8Array(await file.blob.arrayBuffer()),date:new Date(item.created)});}
        else{const file=imageDownload(item),response=await fetch(file.url,{cache:'no-store'});if(!response.ok)throw new Error(String(response.status));
        files.push({name:file.filename,data:new Uint8Array(await response.arrayBuffer()),date:new Date(item.created)});}}catch{missing++;}
    }
    if(!files.length)throw new Error('저장할 그림 파일을 찾지 못했어요. 서버 폴더에서 지워졌을 수 있어요.');
    const d=new Date(),pad=n=>String(n).padStart(2,'0'),stamp=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const url=URL.createObjectURL(new Blob([makeZip(files)],{type:'application/zip'}));
    downloadFile(url,`naice-shot-${clean?"clean-":""}${stamp}-${files.length}.zip`);setTimeout(()=>URL.revokeObjectURL(url),60000);
    report(`${clean?"클린 PNG(메타데이터 제거)":"선택한 원본 그림"} ${files.length}장을 ZIP 파일 하나로 저장했어요.${missing?` 불러오기·변환에 실패한 ${missing}장은 빠졌어요.`:''}`);
  }finally{savingSelection=false;updateHistoryTools();}
}
// The selection save menu: two choices, plus "ZIP 하나로 묶기" when several images are selected.
function renderSelectionSave(){
  const n=selectedIds.size,zip=zipChosen(),many=n>1,box=$('ncs-selection-save');if(!box?.querySelector)return;
  const kind=many?(zip?'ZIP':`PNG · ${n}장 따로`):'PNG';
  box.querySelector('[data-action="save-selected-clean"]').innerHTML=`클린 ${kind}<small>${SAVE_NOTES.shared}</small>`;
  box.querySelector('[data-action="save-selected"]').innerHTML=`원본 ${kind}<small>${SAVE_NOTES.original}</small>`;
  const zipRow=box.querySelector('.ncs-zip-choice');zipRow.hidden=!many;$('ncs-save-zip').checked=zip;
  box.querySelector('.ncs-zip-note').hidden=!many||zip; // separate files: the browser may ask once
}
// 0.1.88 (user's choice): the selection buttons are short ([모두 선택] [본문에 넣기] [저장] [삭제]); how many are
// picked is said once, in the count line.
function renderHistoryCount(){
  $('ncs-history-count').innerHTML=[historyTotal?`${historyMarkFilter==='star'?'즐겨찾기':historyMarkFilter==='tag'?'태그':'총'} ${historyTotal}장${historyItems.length<historyTotal?` · ${historyItems.length}장 표시`:''}`:'', // 0.1.88: shorter, so the line has room for "N장 고름"
    
    historyPending.length?`저장 대기 ${historyPending.length}장 · ${formatBytes(historyPendingBytes)}`:'',selectedIds.size?`${selectedIds.size}장 고름`:''].filter(Boolean).map(t=>`<span class="ncs-nowrap">${esc(t)}</span>`).join(' · ');
}
function updateHistoryTools() {
  if(!dialog)return;const locked=busy||attaching||checkingGeneration;
  for(const id of [...selectedIds])if(!historyItems.some(x=>x.id===id))selectedIds.delete(id);
  const save=dialog.querySelector('[data-image-more="ncs-selection-save"]');const saveLabel=save.querySelector?.('.ncs-save-label');if(saveLabel)saveLabel.textContent=savingSelection?'준비 중…':'저장';save.title=selectedIds.size?`고른 ${selectedIds.size}장 저장`:'저장할 그림을 골라 주세요.';save.disabled=savingSelection||!selectedIds.size;
  if(!save.disabled)renderSelectionSave();
  const del=dialog.querySelector('[data-action="delete-selected"]');del.textContent='삭제';del.title=selectedIds.size?`고른 ${selectedIds.size}장 삭제`:'';del.disabled=locked||!selectedIds.size;
  const all=dialog.querySelector('[data-action="select-all-history"]'),every=historyItems.length>0&&historyItems.every(x=>selectedIds.has(x.id));
  const any=selectedIds.size>0;all.textContent=any?'모두 해제':'모두 선택';all.title=any?`고른 ${selectedIds.size}장의 선택을 모두 풀어요`:'표시된 항목 모두 선택';all.disabled=locked||!historyItems.length;
  const allScope=['chats','all'].includes(historyScope),singleKey=historyScope==='free'?FREE_KEY:keyOf();
  const scopeCount=historyUnfiltered??historyTotal+historyPending.length; // ★ only lists fewer, but "delete all" means all
  const star=dialog.querySelector('[data-action="history-star-only"]'),tagView=dialog.querySelector('[data-action="history-tag-only"]'),canStar=serverFeatures.includes('history-ids');
  star.setAttribute('aria-pressed',String(historyMarkFilter==='star'));star.textContent=historyMarkFilter==='star'?'★':'☆'; // 0.1.88: icons only, the names are in aria-label/title
  star.disabled=locked||!canStar;star.title=canStar?(historyMarkFilter==='star'?'모든 그림 보기로 돌아가요':'즐겨찾기(★)한 그림만 보여줘요'):'서버 플러그인 v0.1.22 이상이 필요해요';
  // 0.1.86: [# 태그] lists every picture with a tag, through the same ID filter. Only one of ★ and # is on.
  tagView.setAttribute('aria-pressed',String(historyMarkFilter==='tag'));tagView.disabled=locked||!canStar;
  tagView.title=canStar?(historyMarkFilter==='tag'?'모든 그림 보기로 돌아가요':'태그를 붙인 그림만 보여줘요'):'서버 플러그인 v0.1.22 이상이 필요해요';
  const clear=dialog.querySelector('[data-action="delete-chat-history"]');clear.disabled=locked||!scopeCount||!singleKey;clear.hidden=allScope;clear.textContent=historyScope==='free'?'프리샷 이력 전체 삭제':'이 채팅 이력 전체 삭제';
  const filterDelete=dialog.querySelector('[data-action="delete-filter-chat"]');filterDelete.hidden=!allScope||!historyFilter;filterDelete.disabled=locked||!scopeCount;
  $('ncs-history-all-tools').hidden=!allScope;
  const attachSel=dialog.querySelector('[data-action="attach-selected"]'),mine=historyItems.filter(x=>selectedIds.has(x.id)&&x.chatKey&&x.chatKey===keyOf()).length;
  attachSel.textContent='본문에 넣기';attachSel.disabled=locked||!mine;attachSel.hidden=historyScope==='free';
  attachSel.title=mine?`고른 그림 중 ${mine}장을 본문에 넣어요`:'지금 열린 채팅에서 만든 그림을 골라 주세요.';
  renderHistoryCount();
  const help={chat:'지금 열린 채팅에서 만든 그림이에요.',chats:'모든 채팅에서 만든 그림이에요. 프리샷은 제외해요.',free:'채팅과 상관없이 프리샷에서 만든 그림이에요.',all:'모든 채팅과 프리샷의 그림을 함께 봐요.'};
  $('ncs-history-help').textContent=help[historyScope]+' 본문에 넣기는 지금 열린 채팅에서 만든 그림에만 사용할 수 있어요.';
  $('ncs-history-scope').value=historyScope;
  $('ncs-history-storage').textContent=allScope?`이 범위의 그림 ${historyImageCount}장 · ${formatBytes(historyBytes)}`:'';
  const more=dialog.querySelector('[data-action="history-more"]');more.hidden=!historyHasMore;more.disabled=historyLoading;
  more.textContent=historyLoading?'불러오는 중…':`더 보기 (${historyItems.length} / ${historyTotal})`;
  renderHistoryCount();
}
const formatBytes=n=>n>=1073741824?`${(n/1073741824).toFixed(2)} GB`:n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.max(0,Math.round(n/1024))} KB`;
// Readable name for a chat key: the chat file name (which usually starts with the character name).
function chatLabel(key) {
  try{const o=JSON.parse(key);if(o.free)return '프리샷';const name=String(o.chat??o.card??'').trim()||'알 수 없는 채팅';return o.group?`그룹 · ${name}`:name;}catch{return '알 수 없는 채팅';}
}
function setHistoryScope(scope) {
  closeImageMenu();historyScope=['chat','chats','free','all'].includes(scope)?scope:'chat';historyFilter='';historyTagEdit=null;historyItems=[];historyPending=[];historyPendingBytes=0;$('ncs-history-pending').hidden=true;historyTotal=0;historyHasMore=false;selectedIds.clear();
  loadHistory().catch(e=>notice(e.message,true));
}
async function requestImageDeletion(key,list,knownIds){
  const all=list==='all';
  try{return await api('/delete',{method:'POST',body:all?{chatKey:key,all:true}:{chatKey:key,ids:list},signal:draftSignal()});}
  catch(e){
    if(!ambiguousDelete(e))throw e;
    if(all)holdDraftDeletion(key);
    knownIds=knownIds.filter(id=>typeof id==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id));
    const deleted=[],unconfirmed=[];let draftState=null,allGone=false;
    if(serverFeatures.includes('delete-check')){
      try{
        for(let i=0;i<Math.max(1,knownIds.length);i+=500){
          const checked=await api('/delete-check',{method:'POST',body:{chatKey:key,all,ids:knownIds.slice(i,i+500)},signal:draftSignal()});
          deleted.push(...(checked.absent??[]));
          unconfirmed.push(...(checked.unconfirmed??[]));
          if(all)allGone=checked.remaining===false;
          if(typeof checked.draftDeleted==='boolean')draftState={revision:checked.draftRevision,deleted:checked.draftDeleted};
        }
      }catch{/* The already verified IDs are still safe to detach. */}
    }
    const draftHeld=all&&await reconcileDraftDeletion(key,draftState)==='unknown';
    return {deleted,unconfirmed,unverified:true,draftHeld,allGone};
  }
}
// Deletes images, possibly from several chats: one server request per owning chat.
// all=true deletes every image of one chat (chatKey, or the current chat).
async function deleteImages({ids=[],all=false,chatKey:allOf=null,owners=null}) {
  const originTab=activeTab(),report=(message,error=false)=>notice(message,error,originTab);
  if(busy||attaching||checkingGeneration)throw new Error('진행 중인 작업이 끝난 뒤 삭제해 주세요.');
  const current=keyOf(),chat=current?ctx().chat:[];
  if(current&&ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 삭제해 주세요.');
  const target=all?(allOf??current):null;
  if(all&&!target)throw new Error('먼저 캐릭터 채팅을 열어 주세요.');
  if(!all&&!ids.length)return null;
  const ownerOf=id=>owners?.[id]??historyItems.find(x=>x.id===id)?.chatKey??historyPending.find(x=>x.id===id)?.chatKey??(isFree()?FREE_KEY:current||null); // a 프리샷 picture belongs to the 프리샷 key, not to the open chat
  const groups=new Map();
  if(all)groups.set(target,'all');else for(const id of ids){const key=ownerOf(id);if(key===null)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);}
  const here=all?target===current:false,localIds=all?[]:ids.filter(id=>ownerOf(id)===current);
  const attached=here?countInlineImages(chat):localIds.filter(id=>hasInlineImage(chat,{id})).length;
  const elsewhere=all?target!==current:ids.some(id=>ownerOf(id)!==current);
  const scopeCount=historyUnfiltered??historyTotal+historyPending.length;
  const allCount=['chats','all'].includes(historyScope)?historyChats.find(c=>c.chatKey===target)?.count??scopeCount:scopeCount;
  // 0.1.84: favorites go too; the question says how many.
  const starred=all?Object.values(marks()).filter(m=>m.star&&m.chatKey===target).length:[...new Set(ids)].filter(id=>marks()[id]?.star).length;
  const what=all?(here?`이 채팅에서 만든 그림 ${allCount}장을 모두`:`"${chatLabel(target)}" 채팅의 그림 ${allCount}장을 모두`):ids.length===1?'이 그림을':`선택한 그림 ${ids.length}장을`;
  if(!confirm(`${what} 삭제할까요?\n원본 PNG와 생성 기록이 서버에서 지워지며 되돌릴 수 없어요.${starred?`\n즐겨찾기한 그림 ${starred}장도 함께 삭제돼요.`:''}${attached?`\n지금 채팅 본문 아래에 붙인 그림 ${attached}장도 함께 빠져요.`:''}${elsewhere?'\n다른 채팅에 붙여 둔 그림이 있었다면 그 채팅에서는 "찾을 수 없는 그림" 안내로 바뀌어요.':''}${all&&serverFeatures.includes('draft-delete')?'\n이 채팅의 마지막 작업 기억(그리기창 작업)도 함께 지워져요.':''}`))return null;
  report('그림을 삭제하고 있어요…');
  attaching=true;updateAttachButtons();
  try {
    const deleted=new Set(),skipped=[],failed=[],cleared=[],unconfirmed=new Set();let unverifiedDetach=false,workDeleteFailed=false,requestUnverified=false,draftHeld=false,allGone=false,unsent=groups.size,deleteError='';
    for(const [key,list] of groups){
      unsent--;
      const knownIds=list==='all'?[...new Set([
        ...[...historyItems,...historyPending].filter(x=>x.chatKey===key).map(x=>x.id),
        ...(result?.chatKey===key?[result.id]:[]),
        ...(key===current?chat.flatMap(m=>[m?.extra,...(Array.isArray(m?.swipe_info)?m.swipe_info.map(s=>s?.extra):[])]
          .flatMap(extra=>Array.isArray(extra?.naice_shot_images)?extra.naice_shot_images.map(x=>x.id):[])):[])
      ])]:list;
      let response;
      try{response=list==='all'
        ?await whileDeletingWork([key],()=>requestImageDeletion(key,list,knownIds),reply=>
          serverFeatures.includes('draft-delete')&&!reply.unverified&&!reply.failed?.length&&!reply.workDeleteFailed?[key]:[])
        :await requestImageDeletion(key,list,knownIds);}
      catch(e){
        deleteError=/\(404\)|\(405\)/.test(e.message)?'서버 플러그인을 업데이트하고 실리태번을 재시작해 주세요.':e.message;
        break;
      }
      for(const id of response.deleted??[])deleted.add(id);skipped.push(...(response.skipped??[]));
      // 0.1.22 server (P3-2): request records with no picture are counted apart; unknown results stay to be checked.
      cleared.push(...(response.cleared??[]));for(const id of response.unconfirmed??[])unconfirmed.add(id);
      failed.push(...(response.failed??[]));workDeleteFailed||=response.workDeleteFailed===true;
      if(response.unverified){requestUnverified=true;draftHeld=response.draftHeld===true;allGone=response.allGone===true;break;}
    }
    // Clean attachments of the open chat in one save; other chats keep a "missing image" note.
    // 0.1.79 (UI-078-04): the originals are gone at this point. If taking them out of the chat is not saved, the rest
    // (result, selection, history) is still cleaned up and the note says exactly what happened.
    let detachFailed=false;
    // 0.1.86 (B1): skip the save when none of the deleted pictures is in this chat (swipes included). The pre-save
    // comparison can refuse for reasons unrelated to these pictures, which used to show a false "save failed" note.
    if(deleted.size&&current&&keyOf()===current&&[...deleted].some(id=>attachedCount(id)>0)){
      try{unverifiedDetach=!!(await withChatWrite(current,(context,guard)=>detachInlineImages(context,deleted,guard))).unverified;}
      catch{detachFailed=true;}
    }
    if(result&&deleted.has(result.id))result=null;
    for(const id of deleted){selectedIds.delete(id);for(const [key,pending] of pendingGenerations)if(pending===id&&!unconfirmed.has(id))rememberGeneration(key,null);}
    for(const id of cleared)if(!unconfirmed.has(id))for(const [key,pending] of pendingGenerations)if(pending===id)rememberGeneration(key,null);
    // 0.1.84: tags and stars of pictures the server confirmed gone. A whole chat confirmed empty forgets all of its marks.
    {let next=forgetIds(marks(),deleted),changedMarks=next.changed;
      if(all&&(allGone||!requestUnverified&&!failed.length&&!deleteError)){const chatGone=forgetChat(next.marks,target);next=chatGone;changedMarks||=chatGone.changed;}
      if(changedMarks){storeMarks(next.marks);renderTagPopupSetting();}}
    if(current&&keyOf()===current){renderChatImages();renderResult();}
    const skippedText=(skipped.length?` 찾지 못한 ${skipped.length}장은 지우지 않았어요.`:'')+
      (failed.length?` ${failed.length}장은 삭제가 끝나지 않았어요. 이력에서 다시 삭제해 주세요.`:'')+
      (workDeleteFailed?' 마지막 작업 기억은 지우지 못했어요.':'')+
      (cleared.length?` 그림이 없는 생성 요청 기록 ${cleared.length}건도 정리했어요.`:'')+
      (unconfirmed.size?` 결과를 끝내 확인하지 못한 생성 요청 ${unconfirmed.size}건은 Anlas가 차감됐을 수 있어요. NovelAI에서 확인해 주세요.`:'')+
      (requestUnverified?(allGone?' 삭제 응답을 받지 못했지만 이 채팅 이력에 남은 그림이 없는 것을 확인했어요.':' 삭제 응답을 받지 못했어요. 확인된 그림만 반영했으니 이력을 다시 확인해 주세요.'):'')+
      (draftHeld?' 작업 기억을 확인할 때까지 그리기창을 잠갔어요.':'')+
      (deleteError?` 삭제 요청 실패. ${deleteError}`:'')+
      (unsent?` 나머지 ${unsent}개 채팅에는 삭제 요청을 보내지 않았어요.`:'');
    say(deleted.size?`그림 ${deleted.size}장을 삭제했어요.${skippedText}${detachFailed?' 다만 채팅에서 그림을 빼는 저장은 실패해서, 채팅에는 \'찾을 수 없는 그림\' 표시가 남아요. 그 표시의 [이 메시지에서 빼기]로 정리할 수 있어요.':unverifiedDetach?` 다만 채팅에서 그림을 뺀 것이 ${UNVERIFIED}`:''}` :`${requestUnverified?(allGone?'이력 확인을 마쳤어요.':'삭제 결과를 전부 확인하지 못했어요.'):'삭제한 그림이 없어요.'}${skippedText}`,!deleted.size||unverifiedDetach||detachFailed||failed.length>0||workDeleteFailed||requestUnverified||!!deleteError||unconfirmed.size>0,originTab);
    return {deleted:[...deleted],skipped,issue:skippedText.trim()};
  }finally{attaching=false;updateAttachButtons();loadHistory().catch(e=>report(e.message,true));}
}
// --- 본문에 넣기 (0.1.72): pressing it opens the message list, newest first, with the message the picture was made
// for marked and already chosen. 선택 본문에 넣기 uses the same list for several pictures.
const ATTACH_STEP=20;
let attachPick=null; // {items, skipped, target, shown}
function openAttachPicker(list,{prefer=null}={}){
  assertChat();const all=list.filter(Boolean),items=all.filter(x=>x.chatKey&&x.chatKey===keyOf());
  if(!items.length)throw new Error('지금 열린 채팅에서 만든 그림만 넣을 수 있어요.');
  if(!chatRows().length)throw new Error('그림을 넣을 RP 메시지가 없어요.');
  items.sort((a,b)=>String(a.created??'').localeCompare(String(b.created??'')));
  // Chosen beforehand: where the picture already is, else the message it was made for (for several pictures, only
  // when they all share one). Otherwise nothing is chosen, so a quick 넣기 never lands on a guess (v0.1.51).
  const made=[...new Set(items.map(x=>preferredTarget(x,{fallback:false})))];
  let target=made.length===1&&Number.isInteger(made[0])?made[0]:null;
  // 0.1.84: from the tag popup, the reply that showed it — only while that message is unchanged and still listed.
  if(prefer&&ctx().chat[prefer.index]===prefer.message&&textSignature(prefer.message?.mes??'')===prefer.signature&&chatRows().some(r=>r.i===prefer.index))target=prefer.index;
  attachPick={items,skipped:all.length-items.length,target,message:target===null?null:ctx().chat[target],signature:target===null?null:textSignature(ctx().chat[target].mes),shown:ATTACH_STEP,placement:''};
  renderAttachPicker();const box=$('ncs-attach-dialog');if(!box.open)box.showModal();
  const row=target===null?null:box.querySelector(`[data-attach-target="${target}"]`);row?.scrollIntoView({block:'nearest'});
  (target===null?box.querySelector('[data-attach-target]'):box.querySelector('[data-action="attach-confirm"]'))?.focus({preventScroll:true});
}
function closeAttachPicker(){attachPick=null;const box=$('ncs-attach-dialog');if(box?.open)box.close();}
function renderAttachPicker(){
  if(!attachPick)return;const chat=ctx().chat??[],{items,skipped}=attachPick,ids=new Set(items.map(x=>x.id));
  const rows=chatRows().map(r=>r.i).reverse();if(!rows.includes(attachPick.target))attachPick.target=null;
  const at=rows.indexOf(attachPick.target);attachPick.shown=Math.max(attachPick.shown,Math.ceil((at+1)/ATTACH_STEP)*ATTACH_STEP);
  const chosen=attachPick.target!==null;
  const shown=rows.slice(0,attachPick.shown),left=rows.length-shown.length;
  const madeFor=new Set(items.map(x=>locateSource(x.snapshot?.scene?.source,chat).index).filter(Number.isInteger));
  const text=i=>chat[i].mes.replace(/\s+/g,' ').trim().slice(0,90);
  const tags=i=>[madeFor.has(i)?'만든 메시지':'',chat[i].extra?.naice_shot_images?.some(x=>ids.has(x.id))?'이미 넣음':''].filter(Boolean).map(t=>`<span class="ncs-attach-tag">${t}</span>`).join('');
  const n=items.length,lead=n>1?`선택된 ${n}장을 넣어요.`:'고른 메시지에 그림을 넣어요.';
  $('ncs-attach-dialog').querySelector('.ncs-attach-card').innerHTML=`<strong id="ncs-attach-title">그림을 넣을 메시지</strong>
    <small>${lead} 본문 글은 바뀌지 않아요.${skipped?` 다른 채팅·프리샷 그림 ${skipped}장은 넣지 않아요.`:''}</small>
    <p class="ncs-target-count">최신순 · ${rows.length}개 중 ${shown.length}개 표시</p>
    <div class="ncs-target-list" role="group" aria-label="그림을 넣을 메시지 · 최신순">${shown.map(i=>`<button type="button" class="ncs-target-item" data-attach-target="${i}" aria-pressed="${i===attachPick.target}"><span class="ncs-target-meta">#${i} · ${esc(chat[i].name??'')}${isHiddenSceneMessage(chat[i])?' · 숨김':''}${tags(i)}</span><span class="ncs-target-preview">${esc(text(i))}</span></button>`).join('')}</div>
    ${left>0?`<button type="button" class="ncs-target-more" data-action="attach-more">이전 메시지 ${Math.min(ATTACH_STEP,left)}개 더 보기</button>`:''}
    <span class="ncs-attach-place-note">이미 위치를 정한 그림은 '기본 위치'를 골라도 그 자리에 있어요.</span><div class="ncs-row ncs-attach-actions"><div class="ncs-attach-place" role="group" aria-label="넣을 위치"><span>넣을 위치</span>${[['',`기본 위치 (글 ${imagePlacement()==='above'?'위':'아래'})`],['above','글 위'],['below','글 아래']].map(([v,l])=>`<button type="button" data-attach-place="${v}" aria-pressed="${attachPick.placement===v}">${l}</button>`).join('')}</div><button type="button" class="ncs-primary" data-action="attach-confirm" ${chosen?'':'disabled'}>${chosen?`#${attachPick.target}에 넣기`:'넣을 메시지를 골라 주세요'}</button><button type="button" data-action="attach-cancel">취소</button></div>`;
}
async function putImagesInChat(items,targetIndex,placement=null,expected=null) {
  if(!items?.length||attaching||busy)return;assertChat();const startKey=keyOf();
  if(items.some(x=>x.chatKey!==startKey))throw new Error('현재 채팅의 이미지만 첨부할 수 있어요.');
  if(ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 첨부해 주세요.');
  attaching=true;updateAttachButtons();
  try {
    const done=await withChatWrite(startKey,(context,guard)=>{
      const target=context.chat[targetIndex];
      if(expected&&(target!==expected.message||textSignature(target?.mes??'')!==expected.signature))throw new Error('선택한 메시지가 바뀌었어요. 그림을 넣을 메시지를 다시 골라 주세요.');
      return attachInlineImages(context,items,{targetIndex,placement,...guard});
    });
    if(keyOf()!==startKey)return;
    renderChatImages();renderResult();renderHistory();
    const where=`#${targetIndex} 메시지${placement?` 글 ${placement==='above'?'위':'아래'}`:''}`,moved=done.moved?` 이미 있던 ${done.moved}장은 글 ${placement==='above'?'위':'아래'}로 옮겼어요.`:'';
    if(done.unverified)notice(`${where}에 그림을 넣었지만 ${UNVERIFIED}`,true);
    else notice(!done.added&&!done.moved?`${where}에 이미 넣은 그림이에요.`:!done.added?`${moved.trim()} 본문은 그대로예요.`:`${where}에 ${items.length>1?`${done.added}장을 `:'그림을 '}넣었어요.${moved}${done.duplicates?` 이미 있던 ${done.duplicates}장은 그대로 뒀어요.`:''} 본문은 그대로예요.`);
  }finally{attaching=false;updateAttachButtons();}
}
async function removeImageFromChat(item) {
  if(!item||attaching||busy)return;assertChat();const startKey=keyOf();
  if(item.chatKey!==startKey)throw new Error('현재 채팅의 이미지만 뺄 수 있어요.');
  if(ctx().streamingProcessor&&!ctx().streamingProcessor.isFinished)throw new Error('본편 생성이 끝난 뒤 이미지를 빼 주세요.');
  attaching=true;updateAttachButtons();
  try{
    const removed=await withChatWrite(startKey,(context,guard)=>detachInlineImage(context,item,guard));
    if(keyOf()!==startKey)return;
    renderChatImages();renderResult();renderHistory();
    if(removed.unverified)notice(`채팅의 이미지 첨부를 뺐지만 ${UNVERIFIED}`,true);
    else notice(removed.removed?'채팅의 이미지 첨부만 뺐어요. 원본과 생성 이력은 남아 있어요.':'이 이미지는 현재 채팅에 첨부되어 있지 않아요.');
  }finally{attaching=false;updateAttachButtons();}
}
function renderHistoryFilter() {
  const select=$('ncs-history-filter'),current=keyOf();
  select.innerHTML=`<option value="">${historyScope==='all'?'전체 보기':'모든 채팅'} · ${historyImageCount}장</option>`+historyChats.map(c=>`<option value="${esc(c.chatKey)}">${esc(chatLabel(c.chatKey))}${c.chatKey===current?' · 지금 채팅':''} · ${c.count}장</option>`).join('');
  select.value=historyChats.some(c=>c.chatKey===historyFilter)?historyFilter:'';
}
// --- History → preset: saves this image's generation options as a new preset without touching current work.
let historyPresetTarget=null;
const historyPresetControls=item=>item.options?(historyPresetTarget===item.id?`<div class="ncs-wardrobe-save ncs-preset-form"><label>새 프리셋 이름<input id="ncs-history-preset-name" maxlength="80" placeholder="예: 이 그림 설정"></label><small>이 그림의 생성 설정·공통 태그를 저장해요. 인물·장면은 제외하고 seed는 새로 뽑아요.</small>${commonPositiveOf(item)===null?'<small>공통 Positive는 현재 설정값을 사용해요.</small>':''}<div class="ncs-row ncs-form-actions"><button type="button" class="ncs-primary" data-history-preset-save="${esc(item.id)}">저장</button><button type="button" data-history-preset-cancel>취소</button></div></div>`:''):'';
// 0.1.86: the ☆/★ toggle sits at the card's top right, on the 선택 line, sized like the checkbox.
function historyStar(item){
  const star=marks()[item.id]?.star===true;
  return `<button type="button" class="ncs-star" data-history-star="${esc(item.id)}" aria-pressed="${star}" aria-label="${star?'즐겨찾기 해제':'즐겨찾기'}" title="${star?'즐겨찾기 해제':'즐겨찾기'}">${star?'★':'☆'}</button>`;
}
// The date line; tags show under it as small #chips.
function historyMarks(item){
  const tags=marks()[item.id]?.tags??[];
  return `<div class="ncs-history-meta"><small class="ncs-history-date">${esc(shortDate(item.created))}</small></div>${tags.length?`<div class="ncs-history-tags" aria-label="태그">${tags.map(t=>`<span class="ncs-tag-chip">#${esc(t)}</span>`).join('')}</div>`:''}`;
}
// 0.1.86: on a phone a long explanation shows as one short line + "더보기 ›"; opened, the whole text + "접기 ‹".
// Markup: <div class="ncs-help" data-short="한 줄 요약">…the original lines…</div>. PC shows the full text only
// (CSS hides the short line and the buttons above 520px). Costs, privacy, deleting and saved data are never wrapped.
function setupHelpFolds(root){
  for(const box of root.querySelectorAll('.ncs-help[data-short]:not(.ncs-help-ready)')){
    const first=box.firstElementChild,short=document.createElement(first?.tagName==='P'?'p':'small');
    short.className=`ncs-help-short${first?.classList.contains('ncs-small')?' ncs-small':''}`;
    short.append(box.dataset.short,' ');
    const more=document.createElement('button');more.type='button';more.className='ncs-help-toggle';more.dataset.helpToggle='open';more.setAttribute('aria-expanded','false');more.textContent='더보기 ›';
    short.append(more);
    const less=document.createElement('button');less.type='button';less.className='ncs-help-toggle ncs-help-less';less.dataset.helpToggle='close';less.setAttribute('aria-expanded','true');less.textContent='접기 ‹';
    box.prepend(short);box.append(less);box.classList.add('ncs-help-ready');
  }
}
// Scrolls the nearest scrolling box so that `box` sits inside the visible screen (above an on-screen keyboard).
// The keyboard covers the bottom of the panel, so the scrolling box gets extra room at its end while `focus` keeps
// focus; otherwise the last card's form could never scroll above it. Runs now, on the next frame, and whenever the
// visible area changes.
// 0.1.88 (GPT P3): one keyboard guard at a time for the whole panel (editing another card ends the last one), and
// the room it added is always given back: when focus leaves the form, and when the form leaves the page.
let keyboardGuardStop=null;
function keepAboveKeyboard(box,focus=box){
  keyboardGuardStop?.(); // focusing a field again starts over instead of adding a second set of listeners
  const scroller=(el=>{for(let p=el?.parentElement;p;p=p.parentElement){const y=getComputedStyle(p).overflowY;if(y==='auto'||y==='scroll')return p;}return null;})(box);
  if(scroller)scroller.style.paddingBottom=''; // read the panel's own bottom padding, never a room left over
  const base=scroller?parseFloat(getComputedStyle(scroller).paddingBottom)||0:0;
  const fit=()=>{
    if(!box.isConnected){stop();return;}
    const vv=window.visualViewport,top=(vv?.offsetTop??0)+8,bottom=(vv?vv.offsetTop+vv.height:innerHeight)-8;
    if(scroller){const covered=Math.max(0,scroller.getBoundingClientRect().bottom-bottom);scroller.style.paddingBottom=covered?`${base+covered}px`:'';}
    const r=box.getBoundingClientRect();
    let d=r.bottom>bottom?r.bottom-bottom:0;if(r.top-d<top)d=r.top-top;
    if(Math.abs(d)<1)return;if(scroller)scroller.scrollTop+=d;else box.scrollIntoView({block:'nearest'});
  };
  fit();requestAnimationFrame(()=>{if(keyboardGuardStop===stop)fit();});
  const vv=window.visualViewport;
  // 0.1.87 (GPT P2 B5): pressing 저장·취소 must not drop the extra room first, or the button moves away from the
  // finger before the click. A press on a button in the form keeps focus in the field (so the keyboard stays), and
  // the room is only given back once focus has really left the form and no press is still going on.
  // 0.1.88 (GPT P3): "pressing" follows pointer events only. A touch sends a compatibility mousedown after its
  // pointerup; that mousedown only keeps the focus and no longer starts a press nothing would end.
  let pressing=null,timer=0;
  const hold=event=>{if(event.target.closest?.('button'))pressing=event.pointerId;};
  const keepFocus=event=>{if(event.target.closest?.('button'))event.preventDefault();};
  const release=event=>{if(pressing!==null&&event.pointerId===pressing){pressing=null;later();}};
  const later=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(pressing!==null)return;if(!box.isConnected||!box.contains(document.activeElement))stop();},350);};
  const left=event=>{if(!box.contains(event.relatedTarget))later();};
  const gone=new MutationObserver(()=>{if(!box.isConnected)stop();});
  if(scroller)gone.observe(scroller,{childList:true,subtree:true});
  const stop=()=>{clearTimeout(timer);gone.disconnect();vv?.removeEventListener?.('resize',fit);vv?.removeEventListener?.('scroll',fit);box.removeEventListener('focusout',left);
    box.removeEventListener('pointerdown',hold);box.removeEventListener('mousedown',keepFocus);document.removeEventListener('pointerup',release,true);document.removeEventListener('pointercancel',release,true);
    if(keyboardGuardStop===stop){keyboardGuardStop=null;if(scroller)scroller.style.paddingBottom='';}};
  keyboardGuardStop=stop;
  vv?.addEventListener?.('resize',fit);vv?.addEventListener?.('scroll',fit);box.addEventListener('focusout',left);
  box.addEventListener('pointerdown',hold);box.addEventListener('mousedown',keepFocus);document.addEventListener('pointerup',release,true);document.addEventListener('pointercancel',release,true);
  if(focus!==box&&!box.contains(focus))focus.addEventListener('blur',later,{once:true});
}
const historyTagControls=item=>historyTagEdit===item.id?`<div class="ncs-wardrobe-save ncs-tag-form"><label>태그 · 쉼표로 구분<input id="ncs-history-tag-input" maxlength="400" value="${esc((marks()[item.id]?.tags??[]).join(', '))}" placeholder="웃음, 비, rain"></label><div class="ncs-row ncs-form-actions"><button type="button" class="ncs-primary" data-history-tag-save="${esc(item.id)}">저장</button><button type="button" data-history-tag-cancel>취소</button></div></div>`:'';
function historyActions(item,{editable=false,attached=false}={}){
  const id=esc(item.id),menu=`ncs-history-menu-${id}`,save=saveMenu(item,`ncs-history-save-${item.id}`);
  // Order (docs/DESIGN.md): 챗샷으로 보내기 · 프리샷으로 보내기 · 설정을 프리셋으로 · 본문에 넣기.
  const more=[`<button type="button" data-history-id="${id}" ${keyOf()?'':'disabled'}>챗샷으로 보내기<small>${keyOf()?'지금 열린 채팅의 그리기창으로 가져와요.':'채팅을 먼저 열어 주세요.'}</small></button>`,`<button type="button" data-history-free="${id}">프리샷으로 보내기</button>`,
    item.options?`<button type="button" data-history-preset="${id}">설정을 프리셋으로</button>`:'',`<button type="button" data-history-attach="${id}" ${item.chatKey===keyOf()?'':'disabled data-unavailable="true"'}>본문에 넣기${item.chatKey===keyOf()?'':`<small>${item.chatKey===FREE_KEY?'프리샷 그림은 채팅에 연결되어 있지 않아요.':'지금 열린 채팅에서 만든 그림만 넣을 수 있어요.'}</small>`}</button>`,
    editable&&attached?`<button type="button" data-history-detach="${id}">채팅에서 이 그림 빼기${attachedCount(item.id)>1?` (${attachedCount(item.id)}곳)`:''}</button>`:'',
    // 0.1.84: 태그 편집 — 프리샷 pictures have no character, so tag suggestions never show them.
    item.chatKey&&item.chatKey!==FREE_KEY?`<button type="button" data-history-tags="${id}">태그 편집</button>`:`<button type="button" data-history-tags="${id}" disabled data-unavailable="true">태그 편집<small>프리샷 그림은 캐릭터가 없어서 태그 추천에 쓰이지 않아요.</small></button>`,
    `<hr><div class="ncs-jump-slot" data-jump-slot="${id}"></div>`].join('');
  // 0.1.73: ⋯ first, like the enlarged view's row 1 (⋯ | … | 저장 · 삭제).
  return `<div class="ncs-history-actions"><button type="button" data-image-more="${menu}" aria-controls="${menu}" aria-expanded="false" aria-haspopup="true" aria-label="이력 그림 더 보기">⋯</button>${save.button}<button type="button" data-history-delete="${id}" class="ncs-danger-outline">삭제</button></div>${save.menu}<div id="${menu}" class="ncs-image-popup" popover="manual" hidden role="group" aria-label="이력 그림 작업">${more}</div>${historyPresetControls(item)}${historyTagControls(item)}`;
}
// --- 메시지로 가기: the attached message and the message the image was made from (docs/ROADMAP.md 0.1.51).
const JUMP_STATE={swipe:' · 다른 스와이프에서 만들었어요',edited:' · 그림을 만든 뒤 내용이 바뀌었어요',moved:''};
// Choices for one image: [{label,note,index,kind}] to go to, or {disabled:reason}.
// Made without 장면 추출 (e.g. from the last saved prompt) or before 0.1.51: no message was recorded.
const NO_SOURCE='장면 추출 없이 만들었거나 예전 그림이라 연결된 메시지가 없어요.';
function jumpChoices(item){
  if(!item||item.chatKey===FREE_KEY)return {disabled:'프리샷 그림은 연결된 메시지가 없어요.'};
  const source=item.snapshot?.scene?.source;
  if(item.chatKey!==keyOf()){
    if(!item.chatKey)return {disabled:NO_SOURCE};
    if(!source)return {disabled:NO_SOURCE};
    return [{label:'메시지로 가기',note:'다른 채팅이에요. 이동 전에 물어봐요.',index:null,kind:'other'}];
  }
  const {targets,both,made}=jumpTargets(item,ctx().chat);
  if(!targets.length)return {disabled:source?'그림을 만든 메시지를 찾지 못했어요. 지워졌을 수 있어요.':NO_SOURCE};
  const note=t=>JUMP_STATE[t.state]??'';
  if(targets.length===1){const t=targets[0];
    return [{label:'메시지로 가기',note:`#${t.index} · ${both?'이 그림을 만들고 넣은 메시지':t.kind==='attached'?'이 그림을 넣은 메시지':'이 그림을 만든 메시지'}${note(t)}`,index:t.index,kind:t.kind,state:t.state}];}
  return targets.map(t=>t.kind==='attached'?{label:'넣은 메시지로 가기',note:`#${t.index} · 지금 그림이 들어 있는 곳`,index:t.index,kind:'attached',state:'same'}
    :{label:'만든 메시지로 가기',note:`#${t.index} · 이 그림을 만든 메시지${note(t)}`,index:t.index,kind:'made',state:t.state});
}
// The ⋯ menu computes its jump lines only when it opens, so long chats are not scanned for every card.
function fillJumpSlot(menu){
  const slot=menu.querySelector('[data-jump-slot]');if(!slot)return;
  const item=historyItems.find(x=>x.id===slot.dataset.jumpSlot),c=jumpChoices(item);
  slot.innerHTML=Array.isArray(c)?c.map(j=>`<button type="button" data-history-jump="${esc(item.id)}"${j.index===null?'':` data-jump-index="${j.index}"`} data-jump-kind="${j.kind}">${esc(j.label)}<small>${esc(j.note)}</small></button>`).join('')
    :`<button type="button" disabled data-unavailable="true">메시지로 가기<small>${esc(c.disabled)}</small></button>`;
}
// True while SillyTavern is writing a reply (its stop button shows) or streaming one.
function mainGenerating(){
  const stop=document.getElementById('mes_stop'),c=ctx();
  return !!(stop&&getComputedStyle(stop).display!=='none')||!!(c.streamingProcessor&&!c.streamingProcessor.isFinished);
}
// Opens the chat a history key points to with SillyTavern's own chat switching, checking every step before the
// next one (UI-052-01/02): openCharacterChat renames the *selected* character's chat, and openGroupChat does not
// select a group, so a refused or skipped selection must stop here rather than open the chat on the wrong card.
async function openChatByKey(key){
  let o;try{o=JSON.parse(key);}catch{throw new Error('이 그림의 채팅을 알 수 없어요.');}
  const c=ctx(),unable='이 실리태번 버전에서는 다른 채팅으로 이동할 수 없어요. 그 채팅을 직접 연 뒤 다시 눌러 주세요.';
  if(mainGenerating())throw new Error('본편 답변을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.');
  const inGroup=c.groupId!==null&&c.groupId!==undefined;
  if(o.group){
    // SillyTavern exposes no way to select another group, so only chats of the group already open are reachable.
    if(!inGroup||String(c.groupId)!==String(o.group))throw new Error('다른 그룹의 채팅으로는 바로 이동할 수 없어요. 그 그룹을 먼저 연 뒤 다시 눌러 주세요.');
    const group=(c.groups??[]).find(g=>String(g.id)===String(o.group));
    if(!group?.chats?.includes?.(o.chat))throw new Error('그 그룹 채팅을 찾지 못했어요. 지워졌거나 이름이 바뀌었을 수 있어요.');
    if(typeof c.openGroupChat!=='function')throw new Error(unable);
    await c.openGroupChat(o.group,o.chat);
  }else{
    const chid=(c.characters??[]).findIndex(x=>x.avatar===o.card);if(chid<0)throw new Error('그 채팅의 캐릭터 카드를 찾지 못했어요. 지워졌거나 이름이 바뀌었을 수 있어요.');
    if(typeof c.openCharacterChat!=='function'||typeof c.selectCharacterById!=='function')throw new Error(unable);
    // The chat must exist: openCharacterChat would otherwise start an empty chat under that name.
    let names=null;
    try{const r=await fetch('/api/characters/chats',{method:'POST',headers:c.getRequestHeaders(),body:JSON.stringify({avatar_url:o.card})});
      const data=r.ok?await r.json():null;if(data&&typeof data==='object'&&data.error!==true)names=Object.values(data).map(x=>String(x?.file_name??'').replace(/\.jsonl$/,''));}catch{}
    if(!names)throw new Error('그 캐릭터의 채팅 목록을 확인하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    if(!names.includes(String(o.chat)))throw new Error('그 채팅을 찾지 못했어요. 지워졌거나 이름이 바뀌었을 수 있어요.');
    const right=()=>{const n=ctx();return (n.groupId===null||n.groupId===undefined)&&String(n.characterId)===String(chid)&&n.characters?.[chid]?.avatar===o.card;};
    if(!right()){
      await c.selectCharacterById(String(chid));
      if(!right())throw new Error('캐릭터를 바꾸지 못했어요. 채팅 저장이나 본편 답변이 끝난 뒤 다시 눌러 주세요.');
    }
    if(mainGenerating())throw new Error('본편 답변을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.');
    if(!right())throw new Error('캐릭터가 바뀌어서 이동을 멈췄어요. 다시 눌러 주세요.');
    if(keyOf()!==key)await ctx().openCharacterChat(o.chat);
  }
  for(let i=0;i<150&&keyOf()!==key;i++)await new Promise(r=>setTimeout(r,100));
  if(keyOf()!==key)throw new Error('채팅을 열지 못했어요. 그 채팅을 직접 연 뒤 다시 눌러 주세요.');
}
// Scrolls the chat to one message, loading older messages while each press still adds some (no fixed count,
// UI-052-06), and lights it for 2 s. Stops when the chat changes or nothing more loads.
async function scrollToMessage(index){
  const key=keyOf(),find=()=>document.querySelector(`#chat .mes[mesid="${index}"]`),count=()=>document.querySelectorAll('#chat .mes').length;
  let shown=0;
  while(!find()&&keyOf()===key){
    const more=document.getElementById('show_more_messages');if(!more)break;
    const before=count();more.click();
    let grew=false;for(let t=0;t<40&&keyOf()===key;t++){await new Promise(r=>setTimeout(r,100));if(count()>before||find()){grew=true;break;}}
    if(!grew)break;
    if(++shown%10===0)toast(`이전 메시지를 불러오는 중이에요… (${count()}개)`);
  }
  const el=find();if(!el||keyOf()!==key)return false;
  el.scrollIntoView({block:'center',behavior:'smooth'});
  el.classList.remove('ncs-jump-flash');void el.offsetWidth;el.classList.add('ncs-jump-flash');
  setTimeout(()=>el.classList.remove('ncs-jump-flash'),2000);return true;
}
const toast=(text,error=false)=>{const t=globalThis.toastr;if(t)(error?t.warning:t.info).call(t,text,'NAIce Shot');};
async function goToMessage(item,index,kind){
  if(!item)return;if(busy||attaching||draftLoading||outfitSaving)throw new Error('진행 중인 작업이 끝난 뒤 눌러 주세요.');
  if(item.chatKey!==keyOf()){
    if(!confirm(`${chatLabel(item.chatKey)} 채팅으로 이동할까요?\n지금 채팅을 벗어나요. 그리기창 작업은 저장돼 있어요.`))return;
    await openChatByKey(item.chatKey);
    const {targets}=jumpTargets(item,ctx().chat);const t=targets[0];
    if(!t){toast('채팅은 열었지만 그림을 만든 메시지를 찾지 못했어요. 지워졌을 수 있어요.',true);return;}
    index=t.index;kind=t.kind;
    if(targets.length>1)toast(`그림이 들어 있는 #${t.index}로 왔어요. 그림을 만든 메시지는 #${targets[1].index}예요.`);
    else if(JUMP_STATE[t.state])toast(`#${t.index}${JUMP_STATE[t.state]}.`);
  }else{
    // Re-check now: the chat may have changed since the menu opened.
    const now=Array.isArray(jumpChoices(item))?jumpChoices(item).find(j=>j.kind===kind)??jumpChoices(item)[0]:null;
    if(!now)throw new Error('그림을 만든 메시지를 찾지 못했어요. 지워졌거나 채팅이 바뀌었을 수 있어요.');
    index=now.index;if(JUMP_STATE[now.state])toast(`#${index}${JUMP_STATE[now.state]}.`);
  }
  closeImageMenu();document.getElementById('ncs-viewer')?.open&&document.getElementById('ncs-viewer').close();
  if(dialog?.open){rememberScroll();dialog.close();}
  if(!await scrollToMessage(index))toast(`#${index} 메시지를 화면에서 찾지 못했어요. 위로 스크롤해 이전 메시지를 불러와 주세요.`,true);
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
// 0.1.84: ☆/★ and tags live in the extension settings, keyed by the picture's own ID.
function storeMarks(next){settings().imageMarks=next;ctx().saveSettingsDebounced();}
function toggleStar(id){
  const item=historyItems.find(x=>x.id===id);if(!item)return;
  const on=!marks()[id]?.star;storeMarks(setMark(marks(),item,{star:on}));
  if(historyMarkFilter==='star'&&!on){loadHistory().catch(e=>notice(e.message,true));return;}
  const button=dialog.querySelector(`[data-history-star="${CSS.escape(id)}"]`);
  if(button){const label=on?'즐겨찾기 해제':'즐겨찾기';button.textContent=on?'★':'☆';button.setAttribute('aria-pressed',String(on));button.title=label;button.setAttribute('aria-label',label);}
}
function saveTags(id){
  const item=historyItems.find(x=>x.id===id);if(!item)return;
  const tags=parseTags($('ncs-history-tag-input')?.value??'');
  storeMarks(setMark(marks(),item,{tags}));historyTagEdit=null;renderHistory();renderTagPopupSetting();
  if(historyMarkFilter==='tag'&&!tags.length)loadHistory().catch(e=>notice(e.message,true)); // no tags left: it leaves the # view
  notice(tags.length?`태그 ${tags.length}개를 저장했어요: ${tags.map(t=>'#'+t).join(' ')}`:'이 그림의 태그를 모두 지웠어요.',false,'history');
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
  // 0.1.86 (B3): the rest of the generation settings, under the names the preset editor uses.
  const a=item.assembled??{},o=item.options??{},has=v=>v!==undefined&&v!==null&&v!=='',
    more=[has(o.scale)&&`Guidance ${o.scale}`,has(o.cfgRescale)&&`CFG Rescale ${o.cfgRescale}`,has(o.sampler)&&`Sampler ${o.sampler}`,has(o.scheduler)&&`Noise Schedule ${o.scheduler}`].filter(Boolean),
    lines=[`모델: ${MODELS[o.model]?.label??o.model??''} · ${o.width??'?'}×${o.height??'?'} · Steps ${o.steps??'?'} · seed ${item.seed??o.seed??''}${more.length?`\n${more.join(' · ')}`:''}`,'',`[공통 Positive]\n${a.base??''}`,`[공통 Negative]\n${a.negative??''}`];
  (a.characters??[]).forEach((c,i)=>lines.push(`[인물 ${i+1}${c.name?` · ${c.name}`:''}${c.position&&c.position!=='auto'?` · ${c.position}`:''}]\n${c.prompt??''}${c.negative?`\nNegative: ${c.negative}`:''}`));
  return lines.join('\n\n');
}
async function copyRaw(){
  if(!raw){notice('복사할 추출 응답이 없어요.');return;}
  $('ncs-raw-copy').textContent='응답 복사';
  await copyText(raw,dialog);$('ncs-raw-copy').textContent='복사됨';notice('추출 응답을 복사했어요.');
}
// How many messages of the open chat hold this picture.
// Counted like removal does: a message counts once if the picture is on any of its swipes (UI-062-04).
const attachedCount=id=>(ctx().chat??[]).filter(m=>[m?.extra,...(Array.isArray(m?.swipe_info)?m.swipe_info.map(x=>x?.extra):[])].some(e=>e?.naice_shot_images?.some?.(x=>x.id===id))).length;
function renderHistory() {
  closeImageMenu();rememberScroll();
  const chat=ctx().chat??[],current=keyOf(),multi=['chats','all'].includes(historyScope);
  if(multi)renderHistoryFilter();
  const pending=$('ncs-history-pending');
  pending.hidden=!historyPending.length;
  pending.innerHTML=historyPending.length?`<h4>저장 대기 중인 그림</h4>${historyPending.map(entry=>
    `<div class="ncs-row"><small>${esc(chatLabel(entry.chatKey))} · ${esc(shortDate(entry.created))}</small>
    ${entry.orphaned===true?'<small>저장에 실패해 서버에 파일이 남아 있어요.</small>':`<button type="button" data-pending-save="${esc(entry.id)}">저장 다시 시도</button>`}
    <button type="button" data-pending-discard="${esc(entry.id)}" class="ncs-danger-outline">버리기</button></div>`).join('')}`:'';
  $('ncs-history').innerHTML=historyItems.length?historyItems.map(item=>{
    const id=esc(item.id),here=item.chatKey===current,editable=here||item.chatKey===FREE_KEY;
    return `<article class="ncs-history-card${selectedIds.has(item.id)?' ncs-picked':''}"><div class="ncs-history-top"><label class="ncs-check ncs-pick"><input type="checkbox" data-history-pick="${id}" ${selectedIds.has(item.id)?'checked':''}>선택</label>${historyStar(item)}</div><button type="button" class="ncs-image-open" data-view-history="${id}" aria-label="생성 이력 크게 보기"><img loading="lazy" src="${esc(item.image)}" alt="생성 이력"></button>${multi?`<small class="ncs-chat-name${here?' ncs-here':''}">${esc(chatLabel(item.chatKey))}${here?' · 지금 채팅':''}</small>`:''}${historyMarks(item)}${historyActions(item,{editable,attached:here&&hasInlineImage(chat,item)})}</article>`;
  }).join(''):historyMarkFilter==='star'?'<p>이 범위에 즐겨찾기(★)한 그림이 없어요. 이력 카드의 ☆를 눌러 표시해요.</p>':historyMarkFilter==='tag'?'<p>이 범위에 태그를 붙인 그림이 없어요. 이력 카드 ⋯ → 태그 편집에서 붙여요.</p>':'<p>이 범위에 저장된 그림이 없어요.</p>';
  updateAttachButtons();restoreScroll();
}
async function loadHistory({append=false}={}) {
  const scope=historyScope,startKey=scope==='free'?FREE_KEY:keyOf(),allScope=['chats','all'].includes(scope),filter=historyFilter,markFilter=historyMarkFilter;
  if(!startKey&&!allScope){historyItems=[];historyPending=[];historyPendingBytes=0;$('ncs-history-pending').hidden=true;historyTotal=0;historyHasMore=false;$('ncs-history').innerHTML='<p>채팅을 먼저 열어 주세요. 다른 보기에서는 채팅 없이도 이력을 볼 수 있어요.</p>';updateHistoryTools();return;}
  if(append&&historyLoading)return;
  const offset=append?historyItems.length:0,limit=append?HISTORY_PAGE:Math.min(100,Math.max(HISTORY_PAGE,historyItems.length));
  const request=++historyRequest;historyLoading=true;updateHistoryTools();
  try {
    const data=await historyPage({scope,filter,key:startKey,offset,limit,markFilter});
    if(request!==historyRequest||historyScope!==scope||historyFilter!==filter||historyMarkFilter!==markFilter||(!allScope&&scope!=='free'&&keyOf()!==startKey))return;
    if(markFilter&&data.filtered!==true){historyItems=[];historyTotal=0;historyHasMore=false;historyUnfiltered=null;$('ncs-history').innerHTML='<p>즐겨찾기·태그 보기는 서버 플러그인 v0.1.22 이상이 필요해요. 서버를 업데이트하고 실리태번을 재시작해 주세요.</p>';return;}
    historyUnfiltered=markFilter&&Number.isInteger(data.unfilteredCount)?data.unfilteredCount:null;
    if(allScope&&(data.scope!=='all'||scope==='chats'&&data.kind!=='chat')){historyItems=[];historyTotal=0;historyHasMore=false;$('ncs-history').innerHTML='<p>이 보기는 서버 플러그인 v0.1.13 이상이 필요해요. 서버를 업데이트하고 실리태번을 재시작해 주세요.</p>';return;}
    if(allScope){historyChats=Array.isArray(data.chats)?data.chats:[];historyBytes=Number(data.bytes)||0;historyImageCount=Number(data.imageCount)||0;
      if(historyFilter&&!historyChats.some(c=>c.chatKey===historyFilter)){historyFilter='';historyItems=[];historyLoading=false;return loadHistory();}}
    historyPending=Array.isArray(data.pending)?data.pending:[];historyPendingBytes=Number(data.pendingBytes)||0;
    const items=Array.isArray(data.items)?data.items:[];
    historyItems=append?[...historyItems,...items.filter(x=>!historyItems.some(y=>y.id===x.id))]:items;
    historyTotal=Number.isInteger(data.total)?data.total:historyItems.length;historyHasMore=data.hasMore===true;
    lastHistoryView={scope,filter,key:startKey,markFilter,items:historyItems,pending:historyPending,bytes:historyPendingBytes,total:historyTotal,more:historyHasMore,unfiltered:historyUnfiltered};
  }finally{if(request===historyRequest){historyLoading=false;updateHistoryTools();}}
  if(request===historyRequest)renderHistory();
}
let historyImportToken=0;
// 0.1.89 (GPT P3-1): the last view that loaded completely. While another list is still loading, a failed ★/# switch
// goes back to this one, never to the half-loaded (empty) list.
let lastHistoryView=null;
async function restoreHistory(id){return importHistory(id,'chat');}
async function sendToFree(id){return importHistory(id,'free');}
// 0.1.89 (GPT P2-2): the history is outside the locked drawing window, so sending a picture to it checks the same
// lock: no import while work is being deleted or while the result of a deletion of the target work is unknown.
const workLockedFor=key=>deletingWork||drafts.paused||draftsEnabled&&!!key&&draftDeletionChecks.has(key);
const WORK_LOCKED='작업 삭제를 확인하는 중이라 그리기창을 잠가 두었어요. 끝난 뒤 다시 보내 주세요.';
async function importHistory(id,nextMode,record=null){
  if(busy||attaching||draftLoading||outfitSaving)throw new Error('진행 중인 작업이 끝난 뒤 보내 주세요.');
  if(workLockedFor(nextMode==='free'?FREE_KEY:keyOf()))throw new Error(WORK_LOCKED);
  const item=record??historyItems.find(x=>x.id===id);if(!item)return;
  const startChat=keyOf(),startTask=task,startRevision=revision,switched=mode!==nextMode,token=++historyImportToken;
  if(nextMode==='chat'&&!startChat)throw new Error('채팅을 먼저 열어 주세요.');
  if(switched)await setMode(nextMode);
  if(token!==historyImportToken||mode!==nextMode||keyOf()!==startChat||task!==startTask||revision!==startRevision+(switched?1:0))throw new Error('채팅이나 작업이 바뀌어서 가져오지 않았어요. 다시 선택해 주세요.');
  if(workLockedFor(workKey())||draftLoading)throw new Error(WORK_LOCKED);
  const name=nextMode==='free'?'프리샷':'챗샷';
  const before={...captureWork(),undoClear:null,targetShown,label:`이력에서 가져왔어요. 원래 ${name} 작업은 되돌리기로 돌아와요.`};
  const sameChat=nextMode==='chat'&&item.chatKey===startChat,known=c=>c.temp||settings().profiles.some(p=>p.id===c.id);
  const snap=clone(item.snapshot?.scene??blankScene());
  scene={...blankScene(),...(sameChat?snap:momentPart(snap)),source:null};
  scene.characters=scene.characters.filter(known);
  if(nextMode==='free')migratePins(scene.characters); // 0.1.59: cards from older pictures start pinned, so the next text never deletes them unasked
  // Source messages from another chat must never be interpreted as messages in this chat.
  for(const m of scene.moments??[]){m.scene.source=null;m.scene.characters=(m.scene.characters??[]).filter(known);}
  if(!sameChat){scene.moments=[];scene.momentIndex=0;scene.momentWish='';$('ncs-target').value='';draftSource=null;targetShown=TARGET_STEP;targetScroll=0;$('ncs-target-picker').open=false;}
  else if(!Array.isArray(scene.moments)||scene.moments.length<2){scene.moments=[];scene.momentIndex=0;}
  else scene.momentIndex=Math.min(Math.max(0,Number(scene.momentIndex)||0),scene.moments.length-1);
  $('ncs-moment-wish').value=sameChat&&typeof scene.momentWish==='string'?scene.momentWish:'';
  $('ncs-free-text').value=nextMode==='free'&&typeof item.snapshot?.freeText==='string'?item.snapshot.freeText:'';
  raw=item.snapshot?.rawExtraction??'';finalOverride=restoredFinal=clone(item.assembled??null);optionsOverride=item.options?freeOptions({...DEFAULTS.options,...clone(item.options)}):null;result=item;
  undoChatOutfit=null;undoClear=before;revision++;renderTargets();renderScene({forceFinal:true});renderResult();renderUndo();showTab('scene');rememberDraft();
  const foreign=item.chatKey!==FREE_KEY&&item.chatKey!==startChat;
  notice(`${foreign?'다른 채팅의 그림이에요. ':''}장면·최종 프롬프트·생성 설정(seed 포함)을 ${name}으로 가져왔어요.${!sameChat&&nextMode==='chat'?' 대상 메시지는 최신 메시지로 초기화했어요. 생성 전에 다시 확인해 주세요.':''} 원본 출처·채팅 기본 복장·설정 탭 값은 유지돼요. 원래 작업은 되돌리기로 돌아와요.`);
}
function exportSettings() {
  // 0.1.84: tags/★ and the popup switches stay out — they point at this server's pictures and chat names.
  const {imageMarks:_marks,tagPopupChats:_popup,...shared}=settings();
  const blob=new Blob([JSON.stringify(shared,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
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
  clean.imagePlacement=next.imagePlacement==='below'?'below':'above';
  clean.messageButton=next.messageButton===true;
  clean.inlineLayout=INLINE_LAYOUTS.includes(next.inlineLayout)?next.inlineLayout:'slide';
  clean.inlineSize=INLINE_SIZES.includes(next.inlineSize)?next.inlineSize:'medium';
  if(typeof next.extractionTemperature==='number'&&next.extractionTemperature>=0&&next.extractionTemperature<=2)clean.extractionTemperature=next.extractionTemperature;
  clean.retainRawExtraction=false; // importing a backup must not enable raw response retention
  clean.allowAnlas=false; // a shared backup must never switch on paid generation by itself
  if(typeof clean.skin!=='string'||!skinById(clean.skin))clean.skin=DEFAULT_SKIN;
  if(!['describe','direct'].includes(clean.profileInputMode))clean.profileInputMode=DEFAULTS.profileInputMode;
  // 0.1.79 (UI-078-01): each mode's own generation settings come back too. Checked like the main ones; a bad entry is dropped.
  if(['chat','free'].includes(next.genActive))clean.genActive=next.genActive;
  if(next.genByMode&&typeof next.genByMode==='object'){
    clean.genByMode={};
    for(const m of ['chat','free']){const g=next.genByMode[m];if(!g||typeof g!=='object'||typeof g.positive!=='string'||typeof g.negative!=='string'||typeof g.imagePresetId!=='string')continue;
      try{const options=freeOptions({...DEFAULTS.options,...g.options,scheduler:DEFAULTS.options.scheduler});buildPayload({base:'test',negative:'',characters:[]},{...options,seed:options.seed===-1?0:options.seed});
        clean.genByMode[m]={imagePresetId:clean.imagePresets.some(p=>p.id===g.imagePresetId)?g.imagePresetId:'',positive:g.positive,negative:g.negative,options};}catch{}}
  }
  if(!confirm('현재 프로필과 공통 설정을 이 백업으로 바꿀까요? 현재 설정을 내보낸 뒤 진행할 수 있어요.'))return;
  clean.imageMarks=cleanMarks(settings().imageMarks);clean.tagPopupChats=cleanPopupChats(settings().tagPopupChats); // 0.1.84: kept, never taken from a backup
  ctx().extensionSettings[KEY]=clean;syncGen(mode);ctx().saveSettingsDebounced();renderChatImages();scene=blankScene();finalOverride=null;optionsOverride=null;revision++;renderSettings();renderProfiles();editProfile();renderScene();useSkin(clean.skin).catch(()=>{});notice('백업을 가져왔어요. Anlas 사용 가능성 허용과 추출 원문 보관은 꺼진 상태로 가져왔어요.');
}
function dismissKeyboard(){if(document.activeElement?.matches?.('input,textarea'))document.activeElement.blur();}
async function onAction(action,el) {
  if(['new-profile','clear-profile-form','quick-profile','close-quick-profile','new-preset','gen-preset-new','wardrobe-add','blank','add-temp','add-character'].includes(action))dismissKeyboard();
  switch(action) {
    case 'close':rememberScroll();dialog.close();break;
    case 'dismiss-compat':compatDismissed=true;renderCompat();break;
    case 'cancel-extract':if(!cancelExtraction())notice('진행 중인 추출이 없어요.');break;
    case 'target-more':targetShown+=TARGET_STEP;renderTargets();break;
    case 'target-latest':targetShown=TARGET_STEP;chooseTarget('');break;
    case 'target-message':chooseTarget(el.dataset.messageIndex);break;
    case 'extract':if(isFree())await freeFill();else await extract();break; // one button for both modes
    case 'extract-again':await extract();break; // 추가 요청 box under the candidates (챗샷 only)
    case 'blank':clearWork();break;
    case 'jump-generate':{ // the real [이미지 생성] lands at the bottom edge, with its warnings and Anlas right above it
      const box=dialog.querySelector('.ncs-content'),go=dialog.querySelector('[data-action="generate"].ncs-action-main')??dialog.querySelector('[data-action="generate"]');
      if(box&&go)box.scrollBy({top:go.getBoundingClientRect().bottom-box.getBoundingClientRect().bottom+12,behavior:'smooth'});break;}
    case 'recent-less':case 'recent-more':{const input=$('ncs-recent');input.value=Math.max(1,Math.min(30,(Number(input.value)||1)+(action==='recent-more'?1:-1)));input.dispatchEvent(new Event('input',{bubbles:true}));break;}
    case 'undo-clear':undoClearWork();break;
    case 'free-fill':await freeFill();break;
    case 'add-character':addCharacter($('ncs-add-profile').value);break;
    case 'add-temp':addTemp();break;
    case 'generate':await generate();break;
    case 'generation-check':await checkGeneration();break;
    case 'generation-forget':rememberGeneration(workKey(),null);notice('이 탭의 확인 표시를 지웠어요. 서버에 남은 그림은 이력에서 확인할 수 있어요.');break;
    case 'missing-proceed':await proceedMissingDialog();break;
    case 'missing-cancel':closeMissingDialog();notice('생성하지 않았어요. 위 경고 상자에서 프로필을 만들거나 연결할 수 있어요.');break;
    case 'missing-reenable':await setSkipMissingWarning(false);renderSceneExtras();notice('이 채팅에서 생성 전 경고창을 다시 띄워요.');break;
    case 'same-seed':await generate('same');break;
    case 'new-seed':await generate('new');break;
    case 'attach':openAttachPicker([result]);break;
    case 'attach-selected':openAttachPicker(historyItems.filter(x=>selectedIds.has(x.id)));break;
    case 'attach-more':attachPick.shown+=ATTACH_STEP;renderAttachPicker();break;
    case 'attach-cancel':closeAttachPicker();break;
    case 'attach-confirm':{if(!attachPick||attachPick.target===null)break;const {items,target,placement,message,signature}=attachPick;closeAttachPicker();await putImagesInChat(items,target,placement||null,{message,signature});break;}
    case 'detach':await removeImageFromChat(result);break;
    case 'new-profile':case 'clear-profile-form':{
      if(extraction?.kind==='profile')cancelExtraction(''); // a late conversion result must not fill the emptied form
      const wasEditing=$('ncs-profile-id').value;editProfile();

      notice(wasEditing?'모든 칸을 비우고 새 프로필 작성으로 바꿨어요. 저장해 둔 프로필은 그대로예요.':'모든 칸을 비웠어요. 새 프로필을 작성해 주세요.');break;
    }
    case 'quick-profile':openQuickProfile();break;
    case 'close-quick-profile':if(profileContext==='scene-edit'){const kept=profileFormDirty();placeProfileForm('profiles');notice(kept?'프로필 편집을 닫았어요. 저장하지 않은 내용은 프로필 탭에 남아 있어요.':'프로필 편집을 닫았어요.');break;}placeProfileForm('profiles');editProfile();notice('새 프로필 만들기를 닫았어요.');break;
    case 'convert-profile':await convertProfile();break;
    case 'delete-profile':{
      const id=$('ncs-profile-id').value;if(!id)return;
      if(!confirm('이 프로필과 옷장을 삭제할까요? 되돌릴 수 없어요. 생성 이력은 유지돼요.'))return;
      settings().profiles=settings().profiles.filter(p=>p.id!==id);scene.characters=scene.characters.filter(c=>c.id!==id);ctx().saveSettingsDebounced();changed();renderProfiles();editProfile();renderScene();break;
    }
    case 'bind-card':{
      const card=ctx().characters?.[ctx().characterId];if(!card?.avatar)throw new Error('개별 캐릭터 채팅에서 카드를 연결해 주세요.');
      $('ncs-binding').dataset.cardKey=card.avatar;$('ncs-binding').textContent=`연결할 카드: ${card.avatar} · 프로필 저장을 눌러 주세요.`;break;
    }
    case 'reset-final':changed();break;
    case 'status':await refreshStatus();break;
    case 'copy-shape':await copyShape();break;
    case 'toggle-account':toggleAccount();break;
    case 'refresh-anlas':await refreshAccount().catch(()=>{});break;
    // 프리셋 저장: overwrite the selected preset, or create one when none is selected.
    case 'save-preset':{const p=settings().imagePresets.find(p=>p.id===settings().imagePresetId);if(!p)break;
      if(!confirm(`"${p.name}" 프리셋에 지금 값을 덮어쓸까요?\n이전에 저장한 값은 사라져요.`))break;saveImagePreset(true);break;}
    case 'save-preset-as':saveImagePreset(false);break;
    case 'new-preset':{
      const s=settings(),blank=!s.positive&&!s.negative&&JSON.stringify(s.options)===JSON.stringify({...DEFAULTS.options,scheduler:s.options.scheduler});
      if(!blank&&!confirm('공통 포지·네거를 비우고 NAI 생성 설정을 기본값으로 바꿔서 새 프리셋을 시작할까요? 저장해 둔 프리셋은 그대로예요.'))break;
      s.imagePresetId='';s.positive='';s.negative='';s.options=clone(DEFAULTS.options);optionsOverride=null;
      ctx().saveSettingsDebounced();changed();renderSettings();
      $('ncs-common-preset-name').value='';
      notice('새 프리셋을 시작했어요. 포지·네거와 생성 설정을 정한 뒤 아래 "프리셋으로 저장"에 이름을 넣고 저장해 주세요.');break;
    }
    case 'delete-preset':{
      const s=settings(),id=s.imagePresetId;if(!id)return;
      if(!confirm('선택한 이미지 프리셋을 삭제할까요? 현재 입력된 프롬프트와 생성 설정은 유지돼요.'))return;
      s.imagePresets=s.imagePresets.filter(p=>p.id!==id);s.imagePresetId='';ctx().saveSettingsDebounced();renderImagePresets();notice('이미지 프리셋을 삭제했어요. 현재 값은 유지돼요.');break;
    }
    case 'refresh-extraction-profiles':renderExtractionProfiles();break;
    case 'gen-restore-default':optionsOverride=null;revision++;updateFinal();renderGenBox();notice('기본 생성 설정으로 돌아왔어요. 최종 프롬프트는 그대로예요.');break;
    case 'gen-preset-overwrite':{const s=settings(),p=s.imagePresets.find(p=>p.id===s.imagePresetId);if(!p)break;if(!confirm(`‘${p.name}’ 프리셋을 지금 값으로 덮어쓸까요?`))break;saveImagePreset(true,p.name);break;}
    case 'gen-preset-new':genNaming=true;renderGenBox();break;
    case 'gen-preset-new-cancel':genNaming=false;renderGenBox();break;
    case 'gen-preset-new-confirm':saveImagePreset(false,$('ncs-gen-preset-name').value);genNaming=false;$('ncs-gen-preset-name').value='';renderGenBox();break;
    case 'wardrobe-add':addWardrobeRow();notice('새 옷 버튼을 추가했어요. 눌러서 이름과 태그를 입력한 뒤 프로필을 저장해 주세요.');break;
    case 'wardrobe-remove':{if(!confirm('이 옷을 옷장에서 제거할까요? 프로필 저장을 눌러야 반영돼요.'))break;el.closest('.ncs-wardrobe-item')?.remove();if(!$('ncs-wardrobe-list').children.length)renderWardrobeForm([]);notice('옷을 제거했어요. 프로필 저장을 눌러야 반영돼요.');break;}
    case 'extraction-recommended':settings().extractionMaxTokens=RECOMMENDED_MAX_TOKENS;$('ncs-extraction-max-tokens').value=RECOMMENDED_MAX_TOKENS;renderExtractionSummary();revision++;ctx().saveSettingsDebounced();notice(`독립 추출 응답 한도를 권장값 ${RECOMMENDED_MAX_TOKENS}로 바꿨어요. 실제로 쓰는 양은 응답 길이만큼이에요.`);break;
    case 'copy-raw':await copyRaw();break;
    case 'draft-retry':await retryDraft();break;
    case 'delete-all-work':await deleteAllWork();break;
    case 'history':await loadHistory();break;
    case 'history-more':await loadHistory({append:true});break;
    case 'tag-popup-home':{tagPopStore('place',null);const pop=document.getElementById('ncs-tag-pop');if(pop){delete pop.dataset.moved;homeTagPop(pop);}renderTagPopupSetting();notice('태그 추천 팝업을 처음 자리(채팅 가운데 위)로 돌렸어요.');break;}
    case 'history-star-only':case 'history-tag-only':{
      // 0.1.87 (GPT P3): if the new list cannot be read, the old view comes back whole (its filter with its cards),
      // so the buttons never show one view while the cards are from another.
      const want=action==='history-tag-only'?'tag':'star',next=historyMarkFilter===want?null:want;
      const scope=historyScope,filter=historyFilter,key=keyOf(),viewKey=scope==='free'?FREE_KEY:key,last=lastHistoryView;
      const before=historyLoading&&last&&last.scope===scope&&last.filter===filter&&(['chats','all'].includes(scope)||last.key===viewKey)
        ?{...last,picked:[]} // 0.1.89: the list on screen is still loading: go back to the last one that loaded
        :{markFilter:historyMarkFilter,items:historyItems,pending:historyPending,bytes:historyPendingBytes,total:historyTotal,more:historyHasMore,unfiltered:historyUnfiltered,picked:[...selectedIds]};
      historyMarkFilter=next;closeImageMenu();historyItems=[];historyPending=[];historyPendingBytes=0;historyTotal=0;historyHasMore=false;historyUnfiltered=null;selectedIds.clear();
      const loading=loadHistory(),request=historyRequest; // loadHistory numbers its request before its first wait
      try{await loading;}
      catch(e){
        // 0.1.88 (GPT P2): only this request's failure, with the view still the one it was made for, brings the old
        // view back. A late failure after the scope, chat or filter changed leaves the current view alone, silently.
        if(request!==historyRequest||historyScope!==scope||historyFilter!==filter||keyOf()!==key||historyMarkFilter!==next)break;
        {historyMarkFilter=before.markFilter;historyItems=before.items;historyPending=before.pending;historyPendingBytes=before.bytes;historyTotal=before.total;historyHasMore=before.more;historyUnfiltered=before.unfiltered;
          for(const id of before.picked)selectedIds.add(id);renderHistory();}
        throw e;
      }
      break;}
    case 'select-all-history':{
      // [모두 선택] ↔ [모두 해제]: once anything is picked, the button clears the picks.
      if(selectedIds.size)selectedIds.clear();else for(const x of historyItems)selectedIds.add(x.id);
      renderHistory();break;
    }
    case 'save-selected':await saveSelected();break;
    case 'save-selected-clean':await saveSelected(true);break;
    case 'delete-selected':await deleteImages({ids:[...selectedIds]});break;
    case 'delete-chat-history':await deleteImages({all:true,chatKey:historyScope==='free'?FREE_KEY:keyOf()});break;
    case 'delete-filter-chat':if(historyFilter)await deleteImages({all:true,chatKey:historyFilter});break;
    case 'delete-result':if(result)await deleteImages({ids:[result.id],owners:typeof result.chatKey==='string'?{[result.id]:result.chatKey}:null});break;
    case 'export':exportSettings();break;
  }
}
// [↓ 생성] shows while the generate area is out of sight on the drawing tab.
function watchGenerateArea(){
  const target=$('ncs-generate-section'),button=$('ncs-jump-generate'),root=dialog.querySelector('.ncs-content');if(!target||!button||typeof IntersectionObserver!=='function')return;
  // 0.1.87: also hidden while [장면 추출] is on the screen, which it used to cover near the bottom edge.
  const extract=dialog.querySelector('[data-action="extract"]'),seen=new Map();
  const io=new IntersectionObserver(entries=>{for(const e of entries)seen.set(e.target,e.isIntersecting);button.hidden=[...seen.values()].some(Boolean);},{root,threshold:0});
  io.observe(target);if(extract)io.observe(extract);
}
function bindEvents() {
  $('ncs-target-label').addEventListener('click',()=>{rememberTargetScroll();targetListRendered=false;}); // before the native details toggle
  $('ncs-target-scroll').addEventListener('scroll',rememberTargetScroll,{passive:true});
  $('ncs-target-picker').addEventListener('toggle',()=>renderTargets());
  // 0.1.68: a tap anywhere on the account box unfolds it, except ↻, the NovelAI link and the consent row.
  $('ncs-anlas-box').addEventListener('click',event=>{if(!event.target.closest('a,button,input,label,.ncs-consent-row'))toggleAccount();});
  // 0.1.84: Enter in the tag field saves (not while a Korean syllable is still being composed).
  // 0.1.86 (B5): the tag editor opens under its card, often behind a phone keyboard. While its field has focus, keep
  // the whole form (field + buttons) inside the visible part of the screen, measured with visualViewport.
  dialog.addEventListener('focusin',event=>{if(event.target?.id==='ncs-history-tag-input')keepAboveKeyboard(event.target.closest('.ncs-tag-form')??event.target,event.target);});
  dialog.addEventListener('keydown',event=>{if(event.target?.id!=='ncs-history-tag-input'||event.key!=='Enter'||event.isComposing)return;
    event.preventDefault();const save=dialog.querySelector('[data-history-tag-save]');if(save&&!save.disabled)save.click();});
  dialog.addEventListener('click',event=>{
    const el=event.target.closest('button,a');if(!el)return;
    const originTab=activeTab();
    Promise.resolve().then(async()=>{
      if(el.dataset.cleanSave){const id=el.dataset.cleanSave;await saveCleanImage({id,image:`/user/images/naice-shot/${id}.png`});notice('클린 PNG(메타데이터 제거)를 저장했어요.',false,originTab);}
      else if(el.dataset.tab)showTab(el.dataset.tab);
      else if(el.dataset.action)await onAction(el.dataset.action,el);
      else if(el.dataset.historyScope)setHistoryScope(el.dataset.historyScope);
      else if(el.dataset.profileMode)setProfileMode(el.dataset.profileMode);
      else if(el.dataset.mode){if(el.dataset.mode===mode)showTab('scene'); // the chosen 챗샷/프리샷 tapped again goes to 그리기
        else await setMode(el.dataset.mode);}
      else if(el.dataset.historyFree)await sendToFree(el.dataset.historyFree);
      else if(el.dataset.moment!==undefined)switchMoment(Number(el.dataset.moment));
      else if(el.dataset.tempFrom!==undefined)addTemp(el.dataset.tempFrom);
      else if(el.dataset.tempSave)tempToProfile(el.dataset.tempSave);
      else if(el.dataset.tempConfirm){const t=scene.characters.find(c=>c.id===el.dataset.tempConfirm);if(t){t.needsCheck=false;changed();renderScene();}}
      else if(el.dataset.missingDo)await missingAction(el.dataset.missingDo,el.dataset.missingName);
      else if(el.dataset.quickProfileName!==undefined)openQuickProfile(el.dataset.quickProfileName);
      else if(el.dataset.profile)openProfileEditor(el.dataset.profile,'profiles');
      else if(el.dataset.remove){scene.characters=scene.characters.filter(c=>c.id!==el.dataset.remove);changed();renderScene();}
      else if(el.dataset.saveOutfit){if(isChatDefaultNow(el.dataset.saveOutfit))await clearChatOutfit(el.dataset.saveOutfit);else await saveOutfit(el.dataset.saveOutfit);}
      else if(el.dataset.toWardrobe){wardrobeTarget=wardrobeTarget===el.dataset.toWardrobe?null:el.dataset.toWardrobe;renderScene();}
      else if(el.dataset.wardrobeConfirm)saveToWardrobe(el.dataset.wardrobeConfirm);
      else if(el.dataset.wardrobeCancel!==undefined){wardrobeTarget=null;renderScene();}
      else if(el.dataset.resetOutfit)resetImageOutfit(el.dataset.resetOutfit);
      else if(el.dataset.defaultOutfit)resetImageOutfit(el.dataset.defaultOutfit,{defaultOnly:true});
      else if(el.dataset.emptyOutfit)emptyImageOutfit(el.dataset.emptyOutfit);
      else if(el.dataset.editProfile)openProfileEditor(el.dataset.editProfile,'scene');
      else if(el.dataset.lookReset){const c=scene.characters.find(c=>c.id===el.dataset.lookReset);if(c){delete c.look;changed();renderScene();notice('고정 외형·전용 태그를 프로필 값으로 되돌렸어요.',false,'scene');}}
      else if(el.dataset.pin){const c=scene.characters.find(c=>c.id===el.dataset.pin);if(c){c.pinned=!c.pinned;revision++;dropUndo();renderScene();scheduleDraft();notice(c.pinned?'📌 고정했어요. 다음 추출 때 글에 없어도 카드를 남겨요.':'고정을 풀었어요. 다음 추출 때 글에 없으면 이 카드는 지워져요.');}}
      else if(el.dataset.undoChatOutfit)await undoChatOutfitClear(el.dataset.undoChatOutfit);
      else if(el.dataset.historyId)await restoreHistory(el.dataset.historyId);
      else if(el.dataset.historyPreset){historyPresetTarget=el.dataset.historyPreset;renderHistory();}
      else if(el.dataset.historyPresetSave)saveHistoryPreset(el.dataset.historyPresetSave);
      else if(el.dataset.historyPresetCancel!==undefined){historyPresetTarget=null;renderHistory();}
      else if(el.dataset.helpToggle){const box=el.closest('.ncs-help');const open=el.dataset.helpToggle==='open';box?.classList.toggle('ncs-open',open);box?.querySelector(open?'.ncs-help-less':'[data-help-toggle="open"]')?.focus({preventScroll:true});}
      else if(el.dataset.historyStar)toggleStar(el.dataset.historyStar);
      else if(el.dataset.historyTags){closeImageMenu();historyTagEdit=el.dataset.historyTags;renderHistory();$('ncs-history-tag-input')?.focus({preventScroll:true});}
      else if(el.dataset.historyTagSave)saveTags(el.dataset.historyTagSave);
      else if(el.dataset.historyTagCancel!==undefined){historyTagEdit=null;renderHistory();}
      else if(el.dataset.viewResult!==undefined)viewImage(result);
      else if(el.dataset.viewHistory)viewImage(historyItems.find(x=>x.id===el.dataset.viewHistory),{gallery:true});
      else if(el.dataset.historyAttach){closeImageMenu();openAttachPicker([historyItems.find(x=>x.id===el.dataset.historyAttach)]);}
      else if(el.dataset.attachTarget!==undefined){
        attachPick.target=Number(el.dataset.attachTarget);attachPick.message=ctx().chat[attachPick.target];
        attachPick.signature=textSignature(attachPick.message?.mes??'');renderAttachPicker();
      }
      else if(el.dataset.attachPlace!==undefined){attachPick.placement=el.dataset.attachPlace;renderAttachPicker();}
      else if(el.dataset.historyJump){const item=historyItems.find(x=>x.id===el.dataset.historyJump);await goToMessage(item,el.dataset.jumpIndex===undefined?null:Number(el.dataset.jumpIndex),el.dataset.jumpKind);}
      else if(el.dataset.pendingSave){const entry=historyPending.find(x=>x.id===el.dataset.pendingSave);if(entry)await checkGeneration(entry);}
      else if(el.dataset.pendingDiscard&&historyPending.some(x=>x.id===el.dataset.pendingDiscard))await deleteImages({ids:[el.dataset.pendingDiscard]});
      else if(el.dataset.historyDelete)await deleteImages({ids:[el.dataset.historyDelete]});
      else if(el.dataset.historyDetach)await removeImageFromChat(historyItems.find(x=>x.id===el.dataset.historyDetach));
    }).catch(e=>notice(e.message,true,originTab)).finally(()=>rememberDraft());
  });
  // Thumbnails whose PNG was removed by hand show a short note instead of a broken image.
  dialog.addEventListener('error',event=>{const img=event.target;if(img?.tagName==='IMG')img.closest('.ncs-image-open')?.classList.add('ncs-missing');},true);
  $('ncs-profile-form').addEventListener('submit',event=>{event.preventDefault();saveProfile().catch(e=>notice(e.message,true));});
  // Which 고정 외형 boxes are open survives re-rendering the cards.
  dialog.addEventListener('toggle',event=>{const box=event.target;if(!box?.matches?.('.ncs-fixed-look'))return;const id=box.closest('[data-character]')?.dataset.character;if(!id)return;if(box.open)lookOpen.add(id);else lookOpen.delete(id);},true);
  dialog.addEventListener('input',event=>{
    const el=event.target;
    if(el.matches?.('[data-w="name"]'))el.closest('.ncs-wardrobe-item').querySelector('summary').textContent=el.value.trim()||'새 옷';
    if(el.closest('#ncs-profile-form')||el.id==='ncs-import'||el.id==='ncs-raw')return;
    try {
      if(el.closest('#ncs-work-fields'))dropUndo();
      if(el.dataset.historyPick){if(el.checked)selectedIds.add(el.dataset.historyPick);else selectedIds.delete(el.dataset.historyPick);el.closest('.ncs-history-card')?.classList.toggle('ncs-picked',el.checked);updateHistoryTools();return;}
      if(el.id==='ncs-history-scope'){setHistoryScope(el.value);return;}
      if(el.id==='ncs-history-filter'){historyFilter=el.value;historyItems=[];historyPending=[];historyPendingBytes=0;$('ncs-history-pending').hidden=true;historyTotal=0;historyHasMore=false;selectedIds.clear();loadHistory().catch(e=>notice(e.message,true));return;}
      if(el.name==='ncs-skin'){useSkin(el.value,{save:true}).catch(e=>notice(e.message,true));return;}
      if(el.id==='ncs-character-binding'||el.id==='ncs-user-binding'){
        const field=el.id==='ncs-character-binding'?'characterProfileId':'userProfileId';
        setChatBinding(field,el.value).catch(e=>notice(e.message,true)).finally(renderMatching);return;
      }
      if(el.id==='ncs-common-preset'||el.id==='ncs-scene-preset'){
        const s=settings();s.imagePresetId=el.value;
        if(el.value){const p=applyImagePreset(s,el.value);changed();renderSettings();notice(p.options?'공통 포지·네거와 NAI 생성 설정을 불러왔어요.':'이전 프리셋의 포지·네거·모델을 불러왔어요. 생성 설정은 현재 값을 유지해요.');}
        else renderImagePresets();ctx().saveSettingsDebounced();return;
      }
      if(el.id==='ncs-extraction-profile'){settings().extractionProfileId=el.value;revision++;ctx().saveSettingsDebounced();renderExtractionProfiles();return;}
      if(el.id==='ncs-extraction-max-tokens'){settings().extractionMaxTokens=Number(el.value);revision++;ctx().saveSettingsDebounced();renderExtractionSummary();return;}
      if(el.id==='ncs-extraction-temperature'){const v=el.value.trim(),n=Number(v);if(v===''){delete settings().extractionTemperature;}else if(Number.isFinite(n)&&n>=0&&n<=2)settings().extractionTemperature=n;else throw new Error('추출 온도는 0~2 사이로 입력하거나 비워 두세요.');ctx().saveSettingsDebounced();renderExtractionSummary();return;}
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
        c.manualOutfit=null;c.outfitMode='unchanged';c.outfit='';delete c.look;changed();renderScene();return; // UI-070-03: the old person's look edit does not follow
      }
      if(el.dataset.lookField){const box=el.closest('[data-character]'),c=scene.characters.find(c=>c.id===box.dataset.character),p=settings().profiles.find(p=>p.id===c?.id);if(!c)return;
        const k=el.dataset.lookField;c.look={...(c.look??{})};if(el.value===(p?.[k]??''))delete c.look[k];else c.look[k]=el.value;if(!Object.keys(c.look).length)delete c.look;
        const edited=!!c.look;box.querySelector('.ncs-look-edited').hidden=!edited;box.querySelector('[data-look-reset]').hidden=!edited;changed();return;}
      if(el.dataset.field){const c=scene.characters.find(c=>c.id===el.closest('[data-character]').dataset.character);c[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;if(el.dataset.field==='position')c.positionManual=true;changed();if(el.dataset.field==='manualOutfit')refreshOutfitTyping(el.closest('[data-character]'),c);return;}
      if(el.hasAttribute('data-chat-outfit')){
        const id=el.closest('[data-character]').dataset.character,p=settings().profiles.find(p=>p.id===id);if(!p||el.value==='custom')return;
        if(el.value==='default'){clearChatOutfit(id).catch(e=>notice(e.message,true));return;}
        const w=(p.wardrobe??[]).find(w=>`w:${w.id}`===el.value);if(!w)return;const value=w.outfit;
        setChatOutfit(id,value,{note:`${p.name}의 채팅 기본 복장을 "${w.name}"(으)로 지정했어요. 이번 그림에도 적용했어요.`}).catch(e=>notice(e.message,true));return;
      }
      if(el.dataset.temp){const t=scene.characters.find(c=>c.id===el.closest('[data-character]').dataset.character&&c.temp);if(!t)return;t[el.dataset.temp]=el.value;if(el.dataset.temp==='outfit')t.outfitManual=true;if(el.dataset.temp==='name'){t.entityName=el.value;el.closest('[data-character]').querySelector('strong').textContent=el.value||'이름 없는 인물';}changed();return;}
      if(el.hasAttribute('data-wear-once')){if(el.value)wearOnce(el.closest('[data-character]').dataset.character,el.value);return;}
      if(el.hasAttribute('data-lock')){const id=el.closest('[data-character]').dataset.character;saveOutfit(id,el.checked).catch(e=>notice(e.message,true));return;}
      for(const field of ['location','lighting','camera','interaction'])if(el.id===`ncs-${field}`){scene[field]=el.value;changed();return;}
      if(el.id==='ncs-tag-popup'){
        const s=settings(),key=keyOf();if(!key){el.checked=false;return;}
        const next=cleanPopupChats(s.tagPopupChats);if(el.checked)next[key]=true;else delete next[key];
        s.tagPopupChats=next;ctx().saveSettingsDebounced();if(!el.checked)closeTagPopup();renderTagPopupSetting();
        notice(el.checked?'이 채팅에서 태그 추천 팝업을 켰어요.':'이 채팅에서 태그 추천 팝업을 껐어요.');return;}
      if(el.id==='ncs-tag-popup-size'){
        if(!Object.hasOwn(TAG_POP_SIZES,el.value))return;tagPopStore('size',el.value);
        const pop=document.getElementById('ncs-tag-pop');if(pop){pop.dataset.size=el.value;pop.style.setProperty('--ncs-tag-pop-h',`${TAG_POP_SIZES[el.value]}vh`);fitTagPop();}
        notice(`태그 추천 팝업 크기: ${el.selectedOptions[0]?.textContent??el.value} (이 기기)`);return;}
      if(el.id==='ncs-message-button'){settings().messageButton=el.checked;ctx().saveSettingsDebounced();setMessageButtons(el.checked);renderChatImageSummary();notice(el.checked?'메시지 날짜 옆에 그리기 아이콘을 넣었어요.':'메시지의 그리기 아이콘을 뺐어요.');return;}
      if(el.id==='ncs-inline-layout'||el.id==='ncs-inline-size'){settings()[el.id==='ncs-inline-layout'?'inlineLayout':'inlineSize']=el.value;ctx().saveSettingsDebounced();renderChatImages();renderChatImageSummary();return;}
      if(el.id==='ncs-chat-image-placement'){
        const value=el.value,key=keyOf();
        changeChatSetting(key,meta=>{if(value)meta.imagePlacement=value;else delete meta.imagePlacement;})
          .then(()=>{if(keyOf()===key){renderChatImages();notice('이 채팅의 기본 위치를 바꿨어요. 따로 정한 그림은 그대로예요.');}})
          .catch(e=>notice(e.message,true,'settings')).finally(renderPlacement);return;
      }
      if(el.id==='ncs-image-placement'){settings().imagePlacement=el.value==='above'?'above':'below';ctx().saveSettingsDebounced();renderChatImages();renderChatImageSummary();notice(el.value==='above'?'채팅 속 그림을 메시지 글 위에 보여줘요.':'채팅 속 그림을 메시지 글 아래에 보여줘요.');return;}
      if(el.id==='ncs-save-zip'){settings().saveAsZip=el.checked;ctx().saveSettingsDebounced();renderSelectionSave();return;}
      if(el.id==='ncs-retain-raw'){
        if(el.checked&&!confirm('추출 AI 응답 원문을 추가로 보관할까요?\n개인정보 주의: 응답에 이름·대화 인용 등이 포함될 수 있어요. 앞으로 만드는 그림의 이력과 마지막 작업에 보관되고, PNG에는 들어가지 않아요.'))el.checked=false;
        settings().retainRawExtraction=el.checked;ctx().saveSettingsDebounced();renderRawRetention();return;
      }
      // 0.1.88 (user's choice): the same consent as a second checkbox where the "Anlas 허용이 꺼져 있어요" note is,
      // so it can be ticked right there. It is still a checkbox the user ticks (0.1.46: nothing turns it on by itself).
      if(el.id==='ncs-allow-anlas-here'){const main=$('ncs-allow-anlas');main.checked=el.checked;main.dispatchEvent(new Event('input',{bubbles:true}));return;}
      const settingMap={'ncs-positive':'positive','ncs-negative':'negative','ncs-format':'format','ncs-recent':'recent','ncs-include-user':'includeUser','ncs-schema':'structuredOutput','ncs-allow-anlas':'allowAnlas'};
      const optionMap={'ncs-model':'model','ncs-steps':'steps','ncs-scale':'scale','ncs-seed':'seed','ncs-cfg':'cfgRescale','ncs-sampler':'sampler'};
      if(settingMap[el.id])settings()[settingMap[el.id]]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
      if(el.id==='ncs-schema')renderExtractionSummary();
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
// --- 0.1.84 태그 추천 팝업: a character reply that contains a tag shows one tagged picture of the same character (or
// group), picked at random. It never writes the chat.
// 0.1.86: just the picture, no frame or tag text. It first shows at the top centre of the chat, can be dragged by the
// picture (mouse or finger), and remembers where it was left on this device (PC and phone apart). Two see-through round
// buttons on the picture: 🔍 opens the usual enlarged view (its ⋯ can put the picture in the chat) and ✕ closes.
// Tapping the picture does nothing. Size: 작게 · 보통 · 크게, per device.
let tagPop=null,lastTagPop=null;
const popupOn=key=>!!key&&settings().tagPopupChats?.[key]===true;
const TAG_POP_SIZES={small:25,medium:36,large:50}; // share of the screen height
const tagPopDevice=()=>globalThis.matchMedia?.('(max-width:520px)').matches?'phone':'pc';
function tagPopStore(name,value){
  const key=`naice-shot-tag-pop-${name}-${tagPopDevice()}`;
  try{if(value===undefined)return localStorage.getItem(key);if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}
  return null;
}
const tagPopSize=()=>{const v=tagPopStore('size');return Object.hasOwn(TAG_POP_SIZES,v)?v:'medium';};
function tagPopSaved(){try{const p=JSON.parse(tagPopStore('place')??'null');return Number.isFinite(p?.x)&&Number.isFinite(p?.y)?p:null;}catch{return null;}}
// Keeps the box inside the screen (a place saved on a wider window, a rotated phone).
function placeTagPop(box,x,y){
  // 0.1.87 (GPT P3): the limits use the picture and its buttons together, so the ✕ never ends up off the screen
  // even when a small picture is narrower or lower than the buttons that sit on it.
  const r=box.getBoundingClientRect(),w=r.width||box.offsetWidth,h=r.height||box.offsetHeight;
  let L=r.left,T=r.top,R=r.left+w,B=r.top+h;
  for(const el of box.querySelectorAll('button')){const b=el.getBoundingClientRect();if(!b.width&&!b.height)continue;L=Math.min(L,b.left);T=Math.min(T,b.top);R=Math.max(R,b.right);B=Math.max(B,b.bottom);}
  const left=r.left-L,top=r.top-T,right=R-(r.left+w),bottom=B-(r.top+h);
  const nx=Math.min(Math.max(4+left,x),Math.max(4+left,innerWidth-w-right-4)),ny=Math.min(Math.max(4+top,y),Math.max(4+top,innerHeight-h-bottom-4));
  box.style.left=`${Math.round(nx)}px`;box.style.top=`${Math.round(ny)}px`;return {x:nx,y:ny};
}
function homeTagPop(box){
  const chat=document.getElementById('chat')?.getBoundingClientRect(),w=box.offsetWidth;
  const centre=chat&&chat.width?chat.left+chat.width/2:innerWidth/2,top=Math.max(chat&&chat.height?chat.top+8:0,56);
  return placeTagPop(box,centre-w/2,top);
}
function fitTagPop(){
  const box=document.getElementById('ncs-tag-pop');if(!box)return;
  const saved=tagPopSaved();if(saved)placeTagPop(box,saved.x,saved.y);else homeTagPop(box);
}
function renderTagPopupSetting(){
  if(!dialog)return;const box=$('ncs-tag-popup');if(!box)return;const key=keyOf(),owner=key?ownerOf(key):null;
  box.checked=popupOn(key);box.disabled=!owner;
  $('ncs-tag-popup-state').textContent=!key?'채팅을 열면 켤 수 있어요.':!owner?'이 채팅의 캐릭터를 확인하지 못해서 켤 수 없어요.':
    `${owner.startsWith('group:')?'이 그룹':'이 캐릭터'}의 태그 붙은 그림 ${taggedFor(marks(),key)}장${popupOn(key)?' · 켜짐':''}`;
  const size=$('ncs-tag-popup-size');if(size)size.value=tagPopSize();
  const reset=dialog.querySelector('[data-action="tag-popup-home"]');if(reset)reset.disabled=!tagPopSaved();
}
function closeTagPopup(){document.getElementById('ncs-tag-pop')?.remove();tagPop=null;}
function suggestTaggedImage(index,type){
  if(['first_message','impersonate'].includes(type)||!Number.isInteger(index))return;
  const key=keyOf();if(!popupOn(key))return;
  const message=ctx().chat?.[index];if(!message||message.is_user||message.is_system)return;
  // The panel and the enlarged view are modal: a popup would sit behind them, so none shows while they are open.
  if(dialog?.open||document.getElementById('ncs-viewer')?.open)return;
  showTagPopup(tagMatches(marks(),key,message.mes),{key,index,message,signature:textSignature(message.mes??'')});
}
function showTagPopup(list,where){
  const choice=pickMatch(list,{avoid:lastTagPop});
  if(!choice){return;}
  // A popup already on the screen keeps its place when the next picture replaces it.
  const old=document.getElementById('ncs-tag-pop'),kept=old?{x:old.offsetLeft,y:old.offsetTop}:null;
  closeTagPopup();lastTagPop=choice.id;
  const box=document.createElement('div');
  tagPop={...choice,...where};
  box.id='ncs-tag-pop';box.className='ncs-tag-pop';box.dataset.size=tagPopSize();box.setAttribute('role','dialog');box.setAttribute('aria-label','태그 추천 그림');
  box.style.setProperty('--ncs-tag-pop-h',`${TAG_POP_SIZES[tagPopSize()]}vh`);
  box.innerHTML=`<img alt="태그 추천 그림" draggable="false" src="/user/images/naice-shot/${esc(choice.id)}.png"><div class="ncs-tag-pop-tools"><button type="button" data-tag-pop="close" aria-label="닫기" title="닫기">${CLOSE_ICON}</button></div>`;
  box.tabIndex=0;box.title='눌러서 크게 보기 · 길게 눌러 옮기기';
  const img=box.querySelector('img');
  // A picture that no longer loads (deleted elsewhere) gives way to another match, or the popup closes.
  img.addEventListener('error',()=>{if(tagPop?.id!==choice.id)return;closeTagPopup();showTagPopup(list.filter(x=>x.id!==choice.id),where);},{once:true});
  img.addEventListener('load',()=>{if(box.isConnected&&!box.dataset.moved)fitTagPop();});
  box.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();closeTagPopup();}
    else if((event.key==='Enter'||event.key===' ')&&event.target===box){event.preventDefault();zoomTagPopup().catch(e=>say(e.message,true));}
  });
  box.addEventListener('click',event=>{if(event.target.closest('[data-tag-pop="close"]'))closeTagPopup();});
  dragTagPop(box);
  document.body.append(box);
  if(kept)placeTagPop(box,kept.x,kept.y);else fitTagPop();
}
// 0.1.87 (user's choice): the picture itself does both, by how long it is pressed. A short press opens the enlarged
// view; holding it (TAG_POP_HOLD) picks it up so it follows the finger. Moving right away drags as well. A long press
// let go without moving does nothing. The ✕ never starts either.
const TAG_POP_HOLD=350;
function dragTagPop(box){
  let start=null;
  const lift=()=>{if(start){start.held=true;box.classList.add('ncs-dragging');}};
  box.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button'))return;
    // 0.1.88 (GPT P3): one finger at a time. A second finger never takes over, and it turns the press into "not a tap".
    if(start){start.multi=true;event.preventDefault();return;}
    start={id:event.pointerId,multi:false,x:event.clientX,y:event.clientY,left:box.offsetLeft,top:box.offsetTop,moved:false,held:false,timer:setTimeout(lift,TAG_POP_HOLD)};
    box.setPointerCapture?.(event.pointerId);event.preventDefault();
  });
  box.addEventListener('pointermove',event=>{
    if(!start||event.pointerId!==start.id)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(!start.moved&&Math.hypot(dx,dy)<6)return;
    if(!start.moved){start.moved=true;clearTimeout(start.timer);}
    box.classList.add('ncs-dragging');placeTagPop(box,start.left+dx,start.top+dy);
  });
  const end=event=>{
    if(!start||event.pointerId!==start.id)return;
    const {moved,held,timer,multi}=start;clearTimeout(timer);start=null;box.classList.remove('ncs-dragging');
    if(moved){box.dataset.moved='1';tagPopStore('place',JSON.stringify({x:box.offsetLeft,y:box.offsetTop}));renderTagPopupSetting();}
    else if(!held&&!multi&&event.type==='pointerup')zoomTagPopup().catch(e=>say(e.message,true));
  };
  box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
  box.addEventListener('touchmove',event=>{if(start)event.preventDefault();},{passive:false}); // the chat must not scroll while dragging
  box.addEventListener('contextmenu',event=>event.preventDefault()); // a long press picks the picture up, no menu
}
async function zoomTagPopup(){
  const pop=tagPop;if(!pop)return;
  const rec=await recordOf({id:pop.id,chatKey:pop.chatKey});
  if(tagPop?.id!==pop.id)return;
  viewImage(rec);
}
function chatChanged() {
  closeImageMenu();closeAttachPicker();closeTagPopup();renderTagPopupSetting();
  const key=keyOf();if(key===chatKey)return;undoChatOutfit=null;historyImportToken++;
  const oldKey=chatKey;if(oldKey){const oldWork=isFree()?spare.chat:captureWork();if(oldWork)rememberDraft(oldKey,oldWork,{flush:true});}
  if(!isFree()){draftLoadToken++;draftLoading=false;syncWorkLock();}
  closeMissingDialog();pendingBind=null;quickProfileName='';chatKey=key;renderPlacement();
  tabNotices.delete('scene');renderNotice();
  if(isFree()){
    // 프리샷 work has nothing to do with the chat: keep it, and start the chat's work fresh for when 챗샷 returns.
    spare.chat=blankWork();
    if(dialog){renderTargets();renderMatching();$('ncs-chat-label').textContent=ctx().getCurrentChatId?.()??'열린 채팅 없음';}
    renderChatImages();renderHistory();if(activeTab()==='history')loadHistory().catch(e=>notice(e.message,true,'history'));return;
  }
  pauseDraftCapture=true;try{cancelExtraction('');}finally{pauseDraftCapture=false;}
  wardrobeTarget=null;pendingTempConvert=null;lastLink=null;linkTarget=null;task++;revision++;scene=blankScene();draftSource=null;raw='';finalOverride=null;optionsOverride=null;restoredFinal=null;result=null;undoClear=null;historyItems=[];historyPending=[];historyPendingBytes=0;$('ncs-history-pending').hidden=true;historyTotal=0;historyHasMore=false;selectedIds.clear();
  if(dialog){targetScroll=0;targetReveal=false;targetListRendered=false;targetShown=TARGET_STEP;$('ncs-target').value='';$('ncs-moment-wish').value='';$('ncs-target-picker').open=false;renderTargets();renderMatching();renderScene({forceFinal:true});renderResult();renderUndo();renderHistory();$('ncs-chat-label').textContent=ctx().getCurrentChatId?.()??'열린 채팅 없음';notice('채팅이 바뀌었어요. 이 채팅의 연결·복장과 이력을 사용해요.',false,'scene');}
  renderChatImages();
  recallDraft().catch(e=>notice(e.message,true,'scene'));if(activeTab()==='history')loadHistory().catch(e=>notice(e.message,true,'history'));
}
const activeTab=()=>dialog?.querySelector('[data-tab][aria-selected="true"]')?.dataset.tab??'scene';
async function open() {
  rememberScroll();
  chatChanged();renderTargets();renderProfiles();renderScene();renderExtractionProfiles();
  if(!dialog.open){dialog.showModal();dialog.focus({preventScroll:true});} // 0.1.88: the dialog itself takes the first focus, so no button opens with a focus ring
  restoreScroll();
  // The chat may have changed while the panel was closed: reload the visible history instead of showing it empty.
  renderPlacement();renderGenerationCheck();if(activeTab()==='history')loadHistory().catch(e=>notice(e.message,true));
  const checking=!compatChecked;if(checking){compatChecking=true;syncWorkLock();}
  try{await checkServer();}finally{if(checking){compatChecking=false;syncWorkLock();}}
  if(!account.at&&!account.checking&&!account.failed)refreshAccount().catch(()=>{});
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
  {const s=settings();s.imageMarks=cleanMarks(s.imageMarks);s.tagPopupChats=cleanPopupChats(s.tagPopupChats);} // 0.1.84: read once, broken entries dropped
  dialog=document.createElement('dialog');dialog.id='naice-shot-dialog';dialog.tabIndex=-1;
  const template=await fetch(new URL('panel.html',import.meta.url));if(!template.ok)throw new Error('NAIce Shot 패널 파일을 읽지 못했어요.');
  dialog.innerHTML=await template.text();document.body.append(dialog);
  // The 챗샷/프리샷 switch sits in the title row now, outside the work fields; it waits with them (draft loading, server check).
  {const work=$('ncs-work-fields'),sync=()=>{$('ncs-mode-fields').disabled=work.disabled;};new MutationObserver(sync).observe(work,{attributes:true,attributeFilter:['disabled']});sync();}
  dialog.addEventListener('close',()=>{closeMissingDialog();closeAttachPicker();rememberDraft(workKey(),null,{flush:true});});
  dialog.addEventListener('cancel',event=>{if(event.target===dialog)rememberScroll();});
  dialog.querySelector('.ncs-content').addEventListener('scroll',rememberScroll,{passive:true});
  $('ncs-missing-dialog').addEventListener('cancel',()=>{missingPrompt=null;}); // Escape closes only this box
  $('ncs-attach-dialog').addEventListener('close',()=>{attachPick=null;});
  setupHelpFolds(dialog);
  for(const tab of dialog.querySelectorAll('[data-tab]')){const icon=document.createElement('span');icon.className='ncs-tab-icon';icon.innerHTML=TAB_ICONS[tab.dataset.tab]??'';tab.prepend(icon);}
  $('ncs-version').textContent=`v${VERSION}`;setProfileMode('direct');syncGen(mode);renderSettings();renderProfiles();editProfile();renderTargets();bindEvents();bindRefFields();watchGenerateArea();chatKey=keyOf();renderProgress();renderModeUI();renderScene();$('ncs-chat-label').textContent=ctx().getCurrentChatId?.()??'열린 채팅 없음';
  const menu=document.getElementById('extensionsMenu');if(menu){const button=document.createElement('div');button.className='list-group-item flex-container flexGap5 ncs-menu-item';button.innerHTML=`<div class="extensionsMenuExtensionButton ncs-menu-icon">${CAMERA_ICON}</div><span data-brand>${esc(brand())}</span>`;button.tabIndex=0;button.setAttribute('role','button');button.addEventListener('click',()=>open().catch(e=>notice(e.message,true)));button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open().catch(e=>notice(e.message,true));}});menu.append(button);}
  renderBrand();
  // Apply the saved skin right away when it is the built-in one; file skins wait for detection.
  renderSkins();useSkin(skinById(settings().skin)?.file?DEFAULT_SKIN:settings().skin).catch(()=>{});
  detectSkins(new URL('./',import.meta.url).href).then(list=>{availableSkins=list;skinsDetected=true;return useSkin(settings().skin);}).catch(e=>console.warn('[NAIce Shot] skin detection failed',e?.message));
  bindImageMenus();
  window.addEventListener('beforeunload',event=>{if(!draftsEnabled)return;rememberDraft(workKey(),null,{flush:true});if([...drafts.entries.values()].some(e=>e.dirty||e.saving)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('resize',()=>fitTagPop()); // the tag popup stays on the screen after a resize or rotation
  window.addEventListener('pagehide',()=>rememberDraft(workKey(),null,{flush:true}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')rememberDraft(workKey(),null,{flush:true});});
  const c=ctx(),events=c.eventTypes??c.event_types;c.eventSource.on(events.CHAT_CHANGED,()=>{chatLoadEpoch++;noteTimed();chatChanged();});noteTimed();
  // ST usually saves the chat after these (not after a stopped generation): look at the disk once it has (0.1.89).
  for(const type of ['GENERATION_ENDED','GENERATION_STOPPED'])if(events[type])c.eventSource.on(events[type],()=>checkTimedSoon());
  const refreshChatImages=()=>renderChatImages();
  // 0.1.84: tag suggestions read a character reply after it is rendered (after streaming ends). Never a greeting.
  if(events.CHARACTER_MESSAGE_RENDERED)c.eventSource.on(events.CHARACTER_MESSAGE_RENDERED,(id,type)=>{try{suggestTaggedImage(Number(id),type);}catch(e){console.error('[NAIce Shot]',e.message);}});
  for(const type of ['MESSAGE_RECEIVED','MESSAGE_SENT','MESSAGE_SWIPED','MESSAGE_DELETED','MESSAGE_EDITED'])if(events[type])c.eventSource.on(events[type],()=>{checkTimedSoon();refreshChatImages();if(dialog.open){renderTargets();renderMatching();renderResult();renderHistory();updateFinal();}});
  document.getElementById('chat')?.addEventListener('click',event=>{
    const clean=event.target.closest('[data-ncs-inline-clean]');
    if(clean){event.preventDefault();const id=clean.dataset.ncsInlineClean;clean.disabled=true;saveCleanImage({id,image:`/user/images/naice-shot/${id}.png`}).then(()=>say('클린 PNG(메타데이터 제거)를 저장했어요.'),()=>say('클린 PNG를 저장하지 못했어요. 원본으로 대체 저장하지 않았어요.',true)).finally(()=>{clean.disabled=false;});return;}
    const open=event.target.closest('[data-ncs-inline-view]');
    if(open){event.preventDefault();event.stopPropagation();try{const attachment=attachmentOf(open);const id=open.dataset.ncsInlineView;
      const asItem=entry=>({id:entry.id,image:`/user/images/naice-shot/${entry.id}.png`,chatKey:attachment.chatKey,...(entry.created?{created:entry.created}:{}),...(Number.isInteger(entry.seed)?{seed:entry.seed}:{})});
      const siblings=orderedInlineImages(attachment.message,imagePlacement()).map(asItem),item=siblings.find(x=>x.id===id)??asItem({id});viewImage(item,{attachment,siblings});}catch(e){console.error('[NAIce Shot]',e.message);}return;}
    const button=event.target.closest('[data-ncs-inline-remove]');if(!button)return;
    event.preventDefault();const id=button.dataset.ncsInlineRemove,attachment=attachmentOf(button);
    removeMessageImage({id,image:`/user/images/naice-shot/${id}.png`,chatKey:attachment.chatKey},attachment).catch(e=>say(e.message,true));
  });
  const chatRoot=document.getElementById('chat');
  if(messageButtonsOn())setMessageButtons(true);
  // Changes NAIce Shot makes itself in the chat (its picture strips and icons) do not start another pass (UI-071-03).
  const ownNode=n=>n.nodeType===1&&(n.classList.contains('ncs-inline-images')||n.classList.contains('ncs-mes-draw'));
  // A removal of NAIce Shot's own parts still counts: something else may have cleared them and they need to come back.
  const ownChange=r=>r.type==='childList'&&(!!r.target.closest?.('.ncs-inline-images,.ncs-mes-draw')||(r.addedNodes.length>0&&!r.removedNodes.length&&[...r.addedNodes].every(ownNode)));
  if(chatRoot){let queued=false,hiddenChanged=false;new MutationObserver(records=>{
    if(records.every(ownChange))return;
    hiddenChanged ||= records.some(r=>r.type==='attributes'&&r.attributeName==='is_system');
    if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refreshChatImages();if(hiddenChanged&&dialog.open)renderTargets();hiddenChanged=false;});
  }).observe(chatRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['mesid','is_system']});refreshChatImages();}
  for(const type of ['CONNECTION_PROFILE_CREATED','CONNECTION_PROFILE_UPDATED','CONNECTION_PROFILE_DELETED'])if(events[type])c.eventSource.on(events[type],()=>renderExtractionProfiles());
}
const start=()=>{panelReady=initialize();panelReady.catch(e=>console.error('[NAIce Shot]',e.message));};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
