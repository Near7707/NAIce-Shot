// Skin registry and loader. A skin is one CSS file in ui/skins/ that overrides the --ncs-* tokens.
// Only the selected skin's file is loaded. Deleting a skin file hides it from the picker, and a
// selected skin whose file is missing falls back to the built-in classic look.
export const SKINS = [
  { id: 'classic', name: '기본', note: '실리태번 테마 색을 따라가요', swatch: ['var(--SmartThemeBlurTintColor,#1b2029)', 'var(--SmartThemeBodyColor,#e8ebf0)', '#75c6cc', '#35969b'] },
  { id: 'glass', name: '글래스', note: '어두운 반투명 유리', file: 'glass.css', swatch: ['#16222f', '#eaf1f6', '#8be4df', '#ffb38a'] },
  { id: 'minimal', name: '미니멀', note: '밝은 바탕과 얇은 선', file: 'minimal.css', swatch: ['#ffffff', '#1d1f24', '#2747d6', '#d3d6dc'] },
  { id: 'pastel', name: '파스텔', note: '둥글고 부드러운 색', file: 'pastel.css', swatch: ['#fbf8ff', '#a8e6d3', '#ffd9c7', '#c9bceb'] },
  { id: 'neon', name: '네온', note: '어두운 바탕에 빛나는 선', file: 'neon.css', swatch: ['#100d24', '#2ef2ee', '#ff4fd8', '#ece9ff'] },
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
