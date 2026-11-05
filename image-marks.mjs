// 0.1.84: tags and favorites (★) for history pictures, kept in the extension settings.
// Keyed by the picture's own ID (the generation request ID), never by its place in a list, so deleting or
// sorting other pictures never moves a tag or a star to the neighbour.
export const MARK_LIMIT = 3000, TAG_LIMIT = 10, TAG_LENGTH = 30;
const ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const validImageId = id => typeof id === 'string' && ID.test(id);
const FREE = JSON.stringify({ free: true });

// "웃음, 비 오는 날" → ['웃음','비 오는 날']. Commas (also the full-width and 、 kinds) split; spaces inside a tag stay.
export function parseTags(text) {
  const seen = new Set(), tags = [];
  for (const raw of String(text ?? '').split(/[,，、\n]/)) {
    const tag = raw.replace(/\s+/g, ' ').trim();
    if (!tag) continue;
    if ([...tag].length > TAG_LENGTH) throw new Error(`태그는 ${TAG_LENGTH}자까지예요: "${[...tag].slice(0, 12).join('')}…"`);
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); tags.push(tag);
  }
  if (tags.length > TAG_LIMIT) throw new Error(`태그는 그림마다 ${TAG_LIMIT}개까지 붙일 수 있어요.`);
  return tags;
}

const goodTags = tags => Array.isArray(tags) && tags.length <= TAG_LIMIT && tags.every(t => typeof t === 'string' && t.trim() && [...t].length <= TAG_LENGTH);
// Saved marks are read back as they are; a broken entry is dropped instead of breaking the panel.
export function cleanMarks(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id, m] of Object.entries(value)) {
    if (!validImageId(id) || !m || typeof m !== 'object' || typeof m.chatKey !== 'string' || !m.chatKey || m.chatKey.length > 1000) continue;
    const star = m.star === true, tags = goodTags(m.tags) ? m.tags : [];
    if (!star && !tags.length) continue;
    out[id] = { chatKey: m.chatKey, ...(star ? { star: true } : {}), ...(tags.length ? { tags: [...tags] } : {}) };
  }
  return out;
}
export const cleanPopupChats = value => {
  const out = {};
  if (value && typeof value === 'object' && !Array.isArray(value))
    for (const [k, v] of Object.entries(value)) if (v === true && k && k.length <= 1000 && k !== FREE) out[k] = true;
  return out;
};

// Returns a new object; an entry with neither a star nor tags is removed.
export function setMark(marks, item, change) {
  if (!validImageId(item?.id) || typeof item.chatKey !== 'string' || !item.chatKey) throw new Error('이 그림의 ID를 확인하지 못했어요.');
  const next = { ...marks }, old = next[item.id] ?? {};
  const star = 'star' in change ? change.star === true : old.star === true;
  const tags = 'tags' in change ? change.tags : (old.tags ?? []);
  if (!goodTags(tags)) throw new Error('태그를 확인해 주세요.');
  if (!star && !tags.length) { delete next[item.id]; return next; }
  if (!next[item.id] && Object.keys(next).length >= MARK_LIMIT) throw new Error(`태그·즐겨찾기는 그림 ${MARK_LIMIT}장까지 기억해요. 쓰지 않는 표시를 지워 주세요.`);
  next[item.id] = { chatKey: item.chatKey, ...(star ? { star: true } : {}), ...(tags.length ? { tags: [...tags] } : {}) };
  return next;
}
// Only after the server said the picture is gone.
export function forgetIds(marks, ids) {
  const gone = new Set(ids), next = {};let changed = false;
  for (const [id, m] of Object.entries(marks)) { if (gone.has(id)) changed = true; else next[id] = m; }
  return { marks: next, changed };
}
export function forgetChat(marks, chatKey) {
  const next = {};let changed = false;
  for (const [id, m] of Object.entries(marks)) { if (m.chatKey === chatKey) changed = true; else next[id] = m; }
  return { marks: next, changed };
}
export const starredIds = (marks, keep = () => true) => Object.entries(marks).filter(([id, m]) => m.star && keep(id, m)).map(([id]) => id);

// Whose picture it is: the character card of a one-on-one chat, or the group. 프리샷 pictures belong to no one.
export function ownerOf(chatKey) {
  try {
    const o = JSON.parse(chatKey);
    if (!o || o.free) return null;
    if (o.group !== null && o.group !== undefined && o.group !== '') return `group:${o.group}`;
    if (typeof o.card === 'string' && o.card) return `card:${o.card}`;
  } catch {}
  return null;
}

// The words of a message as people read them: no HTML tags, no markdown stars.
export function messageWords(mes) {
  return String(mes ?? '').replace(/<[^>]*>/g, ' ').replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
const LATIN = /^[a-z0-9][a-z0-9 '-]*$/i;
// Korean and other tags match anywhere ("웃" in "웃었다"). A Latin tag matches whole words only, so "cat" skips "catch".
export function tagHits(words, tag) {
  const t = tag.toLowerCase();
  if (!t) return false;
  if (!LATIN.test(t)) return words.includes(t);
  const at = (from) => words.indexOf(t, from);
  for (let i = at(0); i >= 0; i = at(i + 1)) {
    const before = words[i - 1], after = words[i + t.length];
    if (!(before && /[a-z0-9]/i.test(before)) && !(after && /[a-z0-9]/i.test(after))) return true;
  }
  return false;
}
// Tagged pictures of the same character (or group) as the open chat whose tags appear in the message.
export function tagMatches(marks, chatKey, mes) {
  const owner = ownerOf(chatKey);
  if (!owner) return [];
  const words = messageWords(mes);
  if (!words) return [];
  const found = [];
  for (const [id, m] of Object.entries(marks)) {
    if (!m.tags?.length || ownerOf(m.chatKey) !== owner) continue;
    const hit = m.tags.filter(t => tagHits(words, t));
    if (hit.length) found.push({ id, chatKey: m.chatKey, tags: hit });
  }
  return found;
}
// One at random; the picture shown last is picked again only when it is the only match.
export function pickMatch(list, { avoid = null, random = Math.random } = {}) {
  if (!list.length) return null;
  const pool = list.length > 1 && avoid ? list.filter(x => x.id !== avoid) : list;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
export const taggedFor = (marks, chatKey) => {
  const owner = ownerOf(chatKey);
  return owner ? Object.values(marks).filter(m => m.tags?.length && ownerOf(m.chatKey) === owner).length : 0;
};
