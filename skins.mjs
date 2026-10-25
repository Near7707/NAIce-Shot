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
  { id: 'deepblue', name: '딥 블루', note: '남색 밤에 하늘빛 포인트', file: 'deepblue.css', swatch: ['linear-gradient(180deg,#14204a,#0e1530)', '#eaf0ff', '#7cc4ff', '#34457a'] },
  { id: 'lavender', name: '라벤더', note: '보라·분홍·살구빛 파스텔', file: 'lavender.css', swatch: ['#faf6ff', 'linear-gradient(90deg,#dcc4ff,#ffc9e2)', '#ffe0c4', '#7a4fc4'] },
  { id: 'milk', name: '우유', note: '크림빛 흰색과 우유팩 파랑', file: 'milk.css', swatch: ['#fffefb', '#2f3a4f', '#3d6fbf', '#dfe5ee'] },
  { id: 'strawberrymilk', name: '딸기우유', note: '분홍 우유와 딸기빛', file: 'strawberrymilk.css', swatch: ['#fff6f8', '#ff9fba', '#c2305a', '#f6cfda'] },
  { id: 'bananamilk', name: '바나나우유', note: '노란 우유와 갈색 글씨', file: 'bananamilk.css', swatch: ['#fffbea', '#ffd94a', '#7a5d00', '#f1df9c'] },
  { id: 'chocomilk', name: '초코우유', note: '코코아빛 우유와 진한 초콜릿', file: 'chocomilk.css', swatch: ['#f8efe9', '#c99a80', '#5b3222', '#e1c8ba'] },
  { id: 'coffeemilk', name: '커피우유', note: '라테 베이지와 커피색', file: 'coffeemilk.css', swatch: ['#f5eee5', '#c8a27c', '#8a5530', '#dccbb6'] },
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
// Only the most recent request may apply. Picking skins quickly cancels the earlier, still-loading
// file, so a slow file can never land after (and override) the last choice. A superseded request
// resolves with { stale: true } and changes nothing.
let request = 0, pending = null;
export function applySkin(id, base, { targets = [], doc = globalThis.document } = {}) {
  const mine = ++request;
  if (pending) { pending.link.remove(); pending.resolve({ id: pending.id, ok: false, stale: true }); pending = null; }
  const skin = skinById(id);
  const tag = value => { current = value; for (const el of targets()) if (el) el.dataset.skin = value; };
  const old = doc.getElementById('ncs-skin-css');
  if (!skin?.file) { old?.remove(); tag(DEFAULT_SKIN); return Promise.resolve({ id: DEFAULT_SKIN, ok: skin !== undefined }); }
  if (old?.dataset.skin === id) { tag(id); return Promise.resolve({ id, ok: true }); }
  return new Promise(resolve => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet'; link.dataset.skin = id; link.dataset.ncsSkinPending = ''; link.href = fileUrl(skin, base);
    pending = { link, id, resolve };
    const done = () => { if (pending?.link === link) pending = null; };
    link.addEventListener('load', () => {
      if (mine !== request) { link.remove(); return resolve({ id, ok: false, stale: true }); }
      done(); old?.remove(); delete link.dataset.ncsSkinPending; link.id = 'ncs-skin-css'; tag(id); resolve({ id, ok: true });
    }, { once: true });
    link.addEventListener('error', () => {
      link.remove();
      if (mine !== request) return resolve({ id, ok: false, stale: true });
      done(); old?.remove(); tag(DEFAULT_SKIN); resolve({ id: DEFAULT_SKIN, ok: false });
    }, { once: true });
    doc.head.append(link);
  });
}
