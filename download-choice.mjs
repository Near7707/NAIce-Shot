import {imageDownload,SAVE_NOTES} from './inline-images.mjs';

// One [저장 ▾] button opens a small menu with the two ways to save. The notes explain the difference,
// so choosing 원본 shows no further warning.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function saveMenu(item,menuId){
  const file=imageDownload(item),id=escape(item.id),menu=escape(menuId);
  return {button:`<button type="button" class="ncs-save-toggle" data-image-more="${menu}" aria-controls="${menu}" aria-expanded="false" aria-haspopup="true">저장<span class="ncs-caret" aria-hidden="true"></span></button>`,
    menu:`<div id="${menu}" class="ncs-image-popup ncs-save-popup" popover="manual" hidden role="group" aria-label="저장 방식"><button type="button" class="ncs-popup-primary" data-clean-save="${id}">공유용 PNG<small>${SAVE_NOTES.shared}</small></button><a href="${escape(file.url)}" download="${file.filename}">원본 PNG<small>${SAVE_NOTES.original}</small></a></div>`};
}
export function downloadOriginal(url,filename){
  const a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';document.body.append(a);a.click();a.remove();
}
