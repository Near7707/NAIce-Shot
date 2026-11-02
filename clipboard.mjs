// Keep the fallback inside the active dialog so modal focus cannot block selection.
export async function copyText(text, root = document.body) {
  try { await navigator.clipboard.writeText(text); return; } catch {}
  const previous = document.activeElement, area = document.createElement('textarea');
  area.value = text; area.readOnly = true;
  area.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none';
  root.append(area);
  try {
    area.focus({preventScroll:true}); area.select(); area.setSelectionRange(0, text.length);
    if (!document.execCommand('copy')) throw new Error('복사하지 못했어요. 내용을 직접 선택해 복사해 주세요.');
  } finally { area.remove(); previous?.focus?.({preventScroll:true}); }
}
