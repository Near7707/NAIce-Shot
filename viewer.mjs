// Full-screen image viewer: fit / original size / zoom / pan / pinch / PNG save.
// Pure view math is exported separately so it can be unit tested without a DOM.
import { imageDownload, SAVE_NOTES } from './inline-images.mjs';
import { saveCleanImage } from './downloads.mjs';
import { currentSkin } from './skins.mjs';
import { copyText } from './clipboard.mjs';

export const ZOOM_MIN = 0.05, ZOOM_MAX = 8, ZOOM_STEP = 1.25;

export function clampScale(scale) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(scale) ? scale : 1));
}
export function fitScale(nat, stage) {
  if (!nat.w || !nat.h || !stage.w || !stage.h) return 1;
  return clampScale(Math.min(stage.w / nat.w, stage.h / nat.h));
}
// Smaller than the stage on an axis → centred; larger → edges may not move inside the stage.
export function clampPan(view, nat, stage) {
  const w = nat.w * view.scale, h = nat.h * view.scale;
  const x = w <= stage.w ? (stage.w - w) / 2 : Math.min(0, Math.max(stage.w - w, view.x));
  const y = h <= stage.h ? (stage.h - h) / 2 : Math.min(0, Math.max(stage.h - h, view.y));
  return { scale: view.scale, x, y };
}
// Zoom so the image point under `point` stays under it.
export function zoomAt(view, nextScale, point, nat, stage) {
  const scale = clampScale(nextScale), k = scale / view.scale;
  return clampPan({ scale, x: point.x - (point.x - view.x) * k, y: point.y - (point.y - view.y) * k }, nat, stage);
}
export function fitView(nat, stage) {
  return clampPan({ scale: fitScale(nat, stage), x: 0, y: 0 }, nat, stage);
}
export function originalView(view, nat, stage, point = { x: stage.w / 2, y: stage.h / 2 }) {
  return zoomAt(view, 1, point, nat, stage);
}

let viewer = null;

function build() {
  const dialog = document.createElement('dialog');
  dialog.id = 'ncs-viewer';
  dialog.setAttribute('aria-label', '이미지 크게 보기');
  dialog.innerHTML = `<div class="ncsv-bar">
    <div class="ncsv-group ncsv-modes"><button type="button" data-v="fit" aria-pressed="true">화면 맞춤</button><button type="button" data-v="original" aria-pressed="false">원본 크기</button></div>
    <div class="ncsv-group ncsv-zooms"><button type="button" data-v="out" aria-label="축소" title="축소 (-)">−</button><output class="ncsv-zoom" aria-live="polite">100%</output><button type="button" data-v="in" aria-label="확대" title="확대 (+)">+</button></div>
    <div class="ncsv-group ncsv-save-group"><div class="ncsv-save-wrap"><button type="button" class="ncs-save-toggle" data-v="save-menu" aria-expanded="false" aria-haspopup="true">저장<span class="ncs-caret" aria-hidden="true"></span></button><div class="ncsv-save-menu" role="group" aria-label="저장 방식" hidden><button type="button" class="ncs-popup-primary" data-v="clean">공유용 PNG<small>${SAVE_NOTES.shared}</small></button><a class="ncsv-save" download>원본 PNG<small>${SAVE_NOTES.original}</small></a></div></div><button type="button" data-v="detach" hidden>이 메시지에서 빼기</button><button type="button" data-v="delete" class="ncsv-delete" hidden>삭제</button></div>
    <div class="ncsv-group ncsv-close-group"><button type="button" data-v="close" aria-label="닫기" title="닫기 (Esc)">✕</button></div>
  </div>
  <div class="ncsv-navigation" hidden aria-label="이력 그림 이동"><button type="button" data-v="previous" aria-label="이전 그림">‹ 이전</button><output class="ncsv-position" aria-live="polite"></output><button type="button" data-v="next" aria-label="다음 그림">다음 ›</button></div>
  <div class="ncsv-stage"><img alt="생성된 장면 크게 보기" draggable="false"></div>
  <details class="ncsv-prompt" hidden><summary>프롬프트 보기</summary><div class="ncsv-prompt-body"><button type="button" class="ncsv-copy" data-v="copy" disabled>프롬프트 복사</button><span class="ncsv-copy-status" role="status"></span><pre class="ncsv-prompt-text"></pre></div></details><div class="ncsv-info"><span class="ncsv-meta"></span><button type="button" class="ncsv-seed" data-v="seed" hidden></button></div>`;
  document.body.append(dialog);

  const stage = dialog.querySelector('.ncsv-stage'), img = stage.querySelector('img');
  const zoomLabel = dialog.querySelector('.ncsv-zoom'), meta = dialog.querySelector('.ncsv-meta'), save = dialog.querySelector('.ncsv-save');
  const state = { nat: { w: 0, h: 0 }, view: { scale: 1, x: 0, y: 0 }, mode: 'fit', caption: '', seed: null, onDelete: null, onDetach:null, loadPrompt:null, promptText:'', epoch:0, item: null, gallery:null, index:0, navBusy:false, actionBusy:false };
  const saveToggle=dialog.querySelector('[data-v="save-menu"]'),saveMenu=dialog.querySelector('.ncsv-save-menu'),seedButton=dialog.querySelector('[data-v="seed"]');
  const showSaveMenu=open=>{saveMenu.hidden=!open;saveToggle.setAttribute('aria-expanded',String(open));if(open)saveMenu.querySelector('button')?.focus({preventScroll:true});};
  // The menu closes on its own button, on a choice, on Escape and on any click outside it.
  dialog.addEventListener('click',event=>{if(!saveMenu.hidden&&!event.target.closest('.ncsv-save-wrap'))showSaveMenu(false);},true);
  saveMenu.addEventListener('click',event=>{if(event.target.closest('button,a'))showSaveMenu(false);});
  dialog.addEventListener('scroll',event=>{if(!saveMenu.hidden&&!saveMenu.contains(event.target))showSaveMenu(false);},true);
  dialog.addEventListener('cancel',event=>{if(!saveMenu.hidden){event.preventDefault();showSaveMenu(false);saveToggle.focus({preventScroll:true});}});
  const seedLabel=()=>`seed ${state.seed} 복사`;
  async function copySeed(){const epoch=state.epoch;try{await copyText(String(state.seed),dialog);if(epoch===state.epoch)seedButton.textContent='seed 복사됨';}catch(e){if(epoch===state.epoch)meta.textContent=e.message;}}
  const deleteButton = dialog.querySelector('[data-v="delete"]'), detachButton=dialog.querySelector('[data-v="detach"]');
  const promptBox=dialog.querySelector('.ncsv-prompt'),promptContent=dialog.querySelector('.ncsv-prompt-text'),copyButton=dialog.querySelector('[data-v="copy"]'),copyStatus=dialog.querySelector('.ncsv-copy-status');
  promptBox.addEventListener('toggle',async()=>{
    if(!promptBox.open||promptBox.dataset.loaded||!state.loadPrompt)return;
    const epoch=state.epoch;promptBox.dataset.loaded='1';promptContent.textContent='프롬프트를 불러오는 중…';
    try{const text=await state.loadPrompt();if(epoch!==state.epoch)return;state.promptText=text;promptContent.textContent=text;copyButton.disabled=false;}
    catch(e){if(epoch===state.epoch){delete promptBox.dataset.loaded;promptContent.textContent=e.message;}}
  });
  async function copyPrompt(){
    if(!state.promptText)return;const epoch=state.epoch;copyButton.textContent='프롬프트 복사';copyStatus.textContent='';
    try{await copyText(state.promptText,dialog);if(epoch===state.epoch){copyButton.textContent='복사됨';copyStatus.textContent='프롬프트를 복사했어요.';}}
    catch(e){if(epoch===state.epoch)copyStatus.textContent=e.message;}
  }
  async function detach(){
    if(!state.onDetach)return;const epoch=state.epoch;detachButton.disabled=true;
    try{if(await state.onDetach()&&epoch===state.epoch)dialog.close();}
    catch(e){if(epoch===state.epoch)meta.textContent=e.message;}
    finally{if(epoch===state.epoch)detachButton.disabled=false;}
  }
  async function cleanSave(){
    const epoch=state.epoch,item=state.item,button=dialog.querySelector('[data-v="clean"]');button.disabled=true;
    try{await saveCleanImage(item);if(epoch===state.epoch)meta.textContent='메타데이터를 뺀 공유용 PNG를 저장했어요.';}
    catch{if(epoch===state.epoch)meta.textContent='공유용 PNG를 저장하지 못했어요. 원본으로 대체 저장하지 않았어요.';}
    finally{if(epoch===state.epoch)button.disabled=false;}
  }
  const navigation=dialog.querySelector('.ncsv-navigation'),position=dialog.querySelector('.ncsv-position');
  function updateNavigation(){
    const g=state.gallery;navigation.hidden=!g;if(!g)return;
    position.textContent=`${state.index+1} / ${g.total}${state.navBusy?' · 불러오는 중…':''}`;
    dialog.querySelector('[data-v="previous"]').disabled=state.navBusy||state.actionBusy||state.index<=0;
    dialog.querySelector('[data-v="next"]').disabled=state.navBusy||state.actionBusy||(!g.hasMore&&state.index>=g.items.length-1);
    if(dialog.open&&!dialog.contains(document.activeElement))dialog.querySelector('[data-v="close"]').focus({preventScroll:true});
  }
  function prefetch(){
    const g=state.gallery,epoch=state.epoch;
    if(!g?.hasMore||state.index<g.items.length-2)return;
    g.loadMore().then(()=>{if(epoch===state.epoch)updateNavigation();}).catch(()=>{}); // explicit Next can retry
  }
  async function navigate(delta){
    const g=state.gallery;if(!g||state.navBusy||state.actionBusy)return;
    const epoch=state.epoch,next=state.index+delta;if(next<0)return;
    state.navBusy=true;updateNavigation();
    try{
      while(next>=g.items.length&&g.hasMore)await g.loadMore();
      if(epoch!==state.epoch||!dialog.open)return;
      if(g.items[next])show(g.items[next],{...g.describe(g.items[next]),gallery:g,index:next,focus:false});
    }catch(e){if(epoch===state.epoch)meta.textContent=e.message;}
    finally{if(epoch===state.epoch){state.navBusy=false;updateNavigation();}}
  }
  async function remove() {
    if(!state.onDelete||state.actionBusy||state.navBusy)return;
    const epoch=state.epoch,id=state.item.id,g=state.gallery,index=state.index;
    state.actionBusy=true;deleteButton.disabled=true;updateNavigation();
    try{
      if(g)await g.waitForPage().catch(()=>{});
      if(epoch!==state.epoch||!dialog.open)return;
      if(!await state.onDelete()||epoch!==state.epoch||!dialog.open)return;
      if(!g){dialog.close();return;}
      g.removed(id);
      if(index>=g.items.length&&g.hasMore)await g.loadMore();
      if(epoch!==state.epoch||!dialog.open)return;
      const next=Math.min(index,g.items.length-1);
      if(next<0)dialog.close();else show(g.items[next],{...g.describe(g.items[next]),gallery:g,index:next,focus:false});
    }catch(e){if(epoch===state.epoch)meta.textContent=e.message;}
    finally{if(epoch===state.epoch){state.actionBusy=false;deleteButton.disabled=false;updateNavigation();}}
  }
  const stageSize = () => { const r = stage.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  const local = event => { const r = stage.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };

  function apply() {
    const { scale, x, y } = state.view;
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    zoomLabel.value = zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    dialog.querySelector('[data-v="fit"]').setAttribute('aria-pressed', String(state.mode === 'fit'));
    dialog.querySelector('[data-v="original"]').setAttribute('aria-pressed', String(Math.abs(scale - 1) < 0.001));
    dialog.querySelector('[data-v="out"]').disabled = scale <= ZOOM_MIN + 1e-6;
    dialog.querySelector('[data-v="in"]').disabled = scale >= ZOOM_MAX - 1e-6;
  }
  function set(view, mode = 'free') { if (!state.nat.w) return; state.view = view; state.mode = mode; apply(); }
  const fit = () => set(fitView(state.nat, stageSize()), 'fit');
  const original = point => set(originalView(state.view, state.nat, stageSize(), point));
  const zoomBy = (factor, point) => { const s = stageSize(); set(zoomAt(state.view, state.view.scale * factor, point ?? { x: s.w / 2, y: s.h / 2 }, state.nat, s)); };
  const toggle = point => { if (state.mode === 'fit' && Math.abs(state.view.scale - 1) > 0.001) original(point); else fit(); };

  img.addEventListener('load', () => {
    state.nat = { w: img.naturalWidth, h: img.naturalHeight };
    img.style.width = `${state.nat.w}px`; img.style.height = `${state.nat.h}px`;
    meta.textContent = [`${state.nat.w} × ${state.nat.h}`, state.caption].filter(Boolean).join(' · ');
    fit();
  });
  img.addEventListener('error', () => { meta.textContent = '이미지를 불러오지 못했어요. PNG 저장은 계속 시도할 수 있어요.'; });

  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-v]'); if (!button) return;
    ({ previous:()=>navigate(-1),next:()=>navigate(1),fit, original: () => original(), in: () => zoomBy(ZOOM_STEP), out: () => zoomBy(1 / ZOOM_STEP), close: () => dialog.close(), delete: remove, detach, copy:copyPrompt, clean: cleanSave, 'save-menu':()=>showSaveMenu(saveMenu.hidden), seed:copySeed })[button.dataset.v]?.();
  });
  dialog.addEventListener('keydown', event => {
    if (event.target.closest?.('a,button') && (event.key === 'Enter' || event.key === ' ')) return;
    if(event.target.closest?.('input,textarea,select,[contenteditable=true]'))return;
    if(state.gallery&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();navigate(event.key==='ArrowRight'?1:-1);return;}
    const action = { '+': () => zoomBy(ZOOM_STEP), '=': () => zoomBy(ZOOM_STEP), '-': () => zoomBy(1 / ZOOM_STEP), '0': fit, '1': () => original() }[event.key];
    if (action) { event.preventDefault(); action(); }
  });
  stage.addEventListener('wheel', event => { event.preventDefault(); zoomBy(Math.exp(-event.deltaY * 0.0015), local(event)); }, { passive: false });

  // One pointer pans, two pointers pinch. A short tap on empty space closes; a double tap toggles fit/100%.
  const pointers = new Map(); let gesture = null, lastTap = null;
  stage.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button > 0) return;
    try { stage.setPointerCapture?.(event.pointerId); } catch { /* capture is optional; some browsers reject it */ }
    pointers.set(event.pointerId, local(event));
    const points = [...pointers.values()];
    if (points.length === 1) gesture = { type: 'pan', start: points[0], view: { ...state.view }, moved: false, onImage: event.target === img, pointerType: event.pointerType, swipe: state.mode==='fit'&&!!state.gallery };
    else if (points.length === 2) {
      const [a, b] = points;
      gesture = { type: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, view: { ...state.view }, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, moved: true };
    }
  });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, local(event));
    const points = [...pointers.values()], s = stageSize();
    if (gesture.type === 'pan' && points.length === 1) {
      const dx = points[0].x - gesture.start.x, dy = points[0].y - gesture.start.y;
      if (Math.hypot(dx, dy) > 4) { gesture.moved = true; stage.classList.add('ncsv-dragging'); }
      if (gesture.moved) set(clampPan({ scale: gesture.view.scale, x: gesture.view.x + dx, y: gesture.view.y + dy }, state.nat, s), state.mode === 'fit' ? 'fit' : 'free');
    } else if (gesture.type === 'pinch' && points.length >= 2) {
      const [a, b] = points, distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const zoomed = zoomAt(gesture.view, gesture.view.scale * distance / gesture.distance, gesture.mid, state.nat, s);
      set(clampPan({ scale: zoomed.scale, x: zoomed.x + mid.x - gesture.mid.x, y: zoomed.y + mid.y - gesture.mid.y }, state.nat, s));
    }
  });
  const end = event => {
    if (!pointers.has(event.pointerId)) return;
    const point = pointers.get(event.pointerId); pointers.delete(event.pointerId);
    stage.classList.remove('ncsv-dragging');
    if(event.type==='pointerup'&&gesture?.type==='pan'&&gesture.swipe&&gesture.pointerType!=='mouse'){
      const dx=local(event).x-gesture.start.x,dy=local(event).y-gesture.start.y;
      if(Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.5){lastTap=null;gesture=null;navigate(dx<0?1:-1);}
    }
    if (event.type === 'pointerup' && gesture?.type === 'pan' && !gesture.moved) {
      const now = Date.now();
      if (gesture.pointerType !== 'mouse' && lastTap && now - lastTap.time < 320 && Math.hypot(point.x - lastTap.point.x, point.y - lastTap.point.y) < 30) { lastTap = null; toggle(point); }
      else { lastTap = { time: now, point }; if (!gesture.onImage) dialog.close(); }
    }
    if (pointers.size === 1) { const [rest] = pointers.values(); gesture = { type: 'pan', start: rest, view: { ...state.view }, moved: true }; }
    else if (!pointers.size) gesture = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('dblclick', event => { if (event.target === img) toggle(local(event)); });

  new ResizeObserver(() => { if (!dialog.open || !state.nat.w) return; if (state.mode === 'fit') fit(); else set(clampPan(state.view, state.nat, stageSize())); }).observe(stage);
  dialog.addEventListener('close', () => { state.epoch++;state.gallery=null;state.navBusy=false;pointers.clear();gesture=null;lastTap=null; });

  function show(item,{caption='',seed=null,onDelete=null,onDetach=null,loadPrompt=null,gallery=null,index=0,focus=true}={}){
      const file = imageDownload(item); // validates the same-origin generated PNG path
      state.epoch++;pointers.clear();gesture=null;lastTap=null;state.gallery=gallery;state.index=index;state.navBusy=false;state.actionBusy=false;state.item = item;state.caption = caption;showSaveMenu(false);
      state.seed=seed===null||seed===undefined||seed===''?null:seed;seedButton.hidden=state.seed===null;if(state.seed!==null)seedButton.textContent=seedLabel();
      state.loadPrompt=typeof loadPrompt==='function'?loadPrompt:null;state.promptText='';
      promptBox.open=false;promptBox.hidden=!state.loadPrompt;delete promptBox.dataset.loaded;promptContent.textContent='';copyButton.disabled=true;copyButton.textContent='프롬프트 복사';copyStatus.textContent='';
      state.onDetach=typeof onDetach==='function'?onDetach:null;detachButton.hidden=!state.onDetach;detachButton.disabled=false; state.nat = { w: 0, h: 0 }; state.mode = 'fit';
      state.onDelete = typeof onDelete === 'function' ? onDelete : null; deleteButton.hidden = !state.onDelete; deleteButton.disabled = false;
      dialog.querySelector('[data-v="clean"]').disabled=false;updateNavigation();
      save.href = file.url; save.download = file.filename;
      meta.textContent = '불러오는 중…'; img.style.transform = ''; img.removeAttribute('style');
      dialog.dataset.skin = currentSkin();
      if (!dialog.open) dialog.showModal();
      if (img.getAttribute('src') === file.url && img.complete && img.naturalWidth) img.dispatchEvent(new Event('load'));
      else img.src = file.url;
      if(focus||!dialog.contains(document.activeElement))dialog.querySelector('[data-v="close"]').focus({ preventScroll: true });
      prefetch();
  }
  return {dialog,open:show};
}

export function openImageViewer(item, options) {
  viewer ??= build();
  viewer.open(item, options);
  return viewer.dialog;
}
