// Skin registry and loader. A skin is one CSS file in ui/skins/ that overrides the --ncs-* tokens.
// Only the selected skin's file is loaded. Deleting a skin file hides it from the picker, and a
// selected skin whose file is missing falls back to the built-in classic look.
export const SKINS = [
  { id: 'classic', name: '기본', note: '실리태번 테마 색을 따라가요', swatch: ['var(--SmartThemeBlurTintColor,#1b2029)', 'var(--SmartThemeBodyColor,#e8ebf0)', '#75c6cc', '#35969b'] },
  { id: 'glass', name: '글래스', note: '뒤가 흐릿하게 비치는 유리', file: 'glass.css', swatch: ['linear-gradient(135deg,#6d86a6,#2b3a52)', '#ffffff', '#a6f0ea', '#ffc29e'] },
  { id: 'minimal', name: '미니멀', note: '밝은 바탕과 얇은 선', file: 'minimal.css', swatch: ['#ffffff', '#1d1f24', '#2747d6', '#d3d6dc'] },
  { id: 'pastel', name: '파스텔', note: '하늘색과 버터 노랑', file: 'pastel.css', swatch: ['#f5faff', '#8cc4ea', '#ffe08a', '#cfe8fa'] },
  { id: 'cream', name: '크림 노트', note: '따뜻한 종이와 캐러멜', file: 'cream.css', swatch: ['#fbf6ee', '#3d3029', '#e8b77a', '#dcc9b2'] },
  { id: 'matcha', name: '말차 라떼', note: '부드러운 녹차색', file: 'matcha.css', swatch: ['#f4f7ee', '#4e7a2c', '#a9c98a', '#e3eed6'] },
];
export const DEFAULT_SKIN = 'classic';
let current = DEFAULT_SKIN;
export const currentSkin = () => current;
export const skinById = id => SKINS.find(s => s.id === id);
const fileUrl = (skin, base) => new URL(`skins/${skin.file}`, base).href;

// Lists skins whose CSS file is actually present next to the extension.
export async function detectSkins(base, fetcher = globalThis.fetch) {
  const checks = SKINS.map(async skin => {
    if (!skin.file) return skin;
    try {
      let response = await fetcher(fileUrl(skin, base), { method: 'HEAD', cache: 'no-store' });
      if (response.status === 405) response = await fetcher(fileUrl(skin, base), { cache: 'no-store' });
      return response.ok ? skin : null;
    } catch { return null; }
  });
  return (await Promise.all(checks)).filter(Boolean);
}

// Loads the skin CSS, then tags the targets so tokens never apply before their file is ready.
export function applySkin(id, base, { targets = [], doc = globalThis.document } = {}) {
  const skin = skinById(id);
  const tag = value => { current = value; for (const el of targets()) if (el) el.dataset.skin = value; };
  const old = doc.getElementById('ncs-skin-css');
  if (!skin?.file) { old?.remove(); tag(DEFAULT_SKIN); return Promise.resolve({ id: DEFAULT_SKIN, ok: skin !== undefined }); }
  if (old?.dataset.skin === id) { tag(id); return Promise.resolve({ id, ok: true }); }
  return new Promise(resolve => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet'; link.id = 'ncs-skin-css'; link.dataset.skin = id; link.href = fileUrl(skin, base);
    link.addEventListener('load', () => { old?.remove(); tag(id); resolve({ id, ok: true }); }, { once: true });
    link.addEventListener('error', () => { link.remove(); old?.remove(); tag(DEFAULT_SKIN); resolve({ id: DEFAULT_SKIN, ok: false }); }, { once: true });
    doc.head.append(link);
  });
}
