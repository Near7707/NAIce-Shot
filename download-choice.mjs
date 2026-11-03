import {imageDownload} from './inline-images.mjs';
import {saveCleanImage} from './downloads.mjs';

let skipOriginalWarning=false,pending=false;
export async function choosePngDownload(){
  if(skipOriginalWarning)return 'original';if(pending)return null;
  pending=true;
  const box=document.createElement('dialog');box.id='ncs-privacy-dialog';box.setAttribute('aria-labelledby','ncs-privacy-title');
  box.innerHTML='<h3 id="ncs-privacy-title">원본에는 메타데이터가 남을 수 있어요</h3><p>프롬프트(인물·장면 묘사)와 생성 설정이 파일 안에 포함될 수 있어요. 다른 사람에게 보낼 그림이라면 공유용 PNG를 추천해요.</p><label><input type="checkbox"> 새로고침 전까지 다시 묻지 않기</label><div class="ncs-privacy-actions"><button type="button" data-choice="shared">공유용 저장</button><button type="button" data-choice="original">원본 저장</button><button type="button" data-choice="cancel">취소</button></div>';
  document.body.append(box);
  return new Promise(resolve=>{
    const finish=choice=>{if(choice)skipOriginalWarning=box.querySelector('input').checked;box.close();box.remove();pending=false;resolve(choice);};
    box.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    box.addEventListener('click',event=>{const choice=event.target.closest('[data-choice]')?.dataset.choice;if(choice)finish(choice==='cancel'?null:choice);});
    box.showModal();box.querySelector('[data-choice="shared"]').focus();
  });
}
export function downloadOriginal(url,filename){
  const a=document.createElement('a');a.href=url;a.download=filename;a.dataset.ncsApproved='true';a.rel='noopener';document.body.append(a);a.click();a.remove();
}
export function bindPngDownloads(notify){
  document.addEventListener('click',event=>{
    const a=event.target.closest?.('a[download]');if(!a||a.dataset.ncsApproved||!a.getAttribute('href')?.startsWith('/user/images/naice-shot/'))return;
    if(!a.closest('#naice-shot-dialog,#ncs-viewer,#chat .ncs-inline-images'))return;
    event.preventDefault();event.stopImmediatePropagation();
    const id=a.getAttribute('href').split('/').at(-1).replace(/\.png$/,''),item={id,image:a.getAttribute('href')};
    Promise.resolve().then(async()=>{const file=imageDownload(item),choice=await choosePngDownload();
      if(choice==='original')downloadOriginal(file.url,file.filename);
      if(choice==='shared'){await saveCleanImage(item);notify('메타데이터를 제거한 공유용 사본을 저장했어요.');}
    }).catch(()=>notify('그림을 저장하지 못했어요. 원본으로 대체 저장하지 않았어요.',true));
  },true);
}
