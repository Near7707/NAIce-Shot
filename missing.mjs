// People who appear in a scene without a profile are left out of the image. The ones the chat is
// actually about — the open character card, group members and the user's persona — get a strong
// warning with ways to fix it; everyone else (side characters, extras) only gets a gentle hint.

export const CARD_TEXT_LIMIT = 4000; // profileDraftPrompt accepts up to 4,000 characters

const HANGUL = /[가-힣]/;
const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s_\-·.]+/g, ' ').trim();
const compact = value => norm(value).replace(/ /g, '');

// Exactly the same name: identical after normalizing; for Korean names spacing is ignored too (김 민수 = 김민수).
export function exactName(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return (HANGUL.test(x) || HANGUL.test(y)) && compact(a) === compact(b);
}

// A short way of calling someone by name: the first name alone ("Ana" for "Ana Reyes"), or a Korean
// given name without the one-syllable family name ("민수" for "김민수"). Surnames alone, reordered
// words and descriptions that merely contain the name ("crow-masked courier" for "Crow") do not count.
export function shortName(short, full) {
  const s = norm(short), f = norm(full);
  if (!s || !f || s.includes(' ')) return false;
  if (HANGUL.test(s)) {
    const c = compact(full);
    return s.length >= 2 && HANGUL.test(c) && c.length >= 3 && c.length <= 4 && c.slice(1) === s;
  }
  const words = f.split(' ');
  return words.length >= 2 && s.length >= 2 && words[0] === s;
}

// Kept for older callers: exact or short-name match.
export const sameName = (a, b) => exactName(a, b) || shortName(a, b) || shortName(b, a);

// The people this chat is about: the open card (or every group member) and the user's persona.
export function mainPeopleOf(context) {
  const people = [], inGroup = context.groupId !== null && context.groupId !== undefined;
  const cards = Array.isArray(context.characters) ? context.characters : [];
  if (!inGroup) {
    const chid = Number(context.characterId), card = cards[chid];
    const name = card?.name || context.name2 || '';
    if (name) people.push({ name, role: 'character', chid: card ? chid : null, avatar: card?.avatar ?? '' });
  } else {
    const group = (context.groups ?? []).find(g => g.id === context.groupId);
    for (const avatar of group?.members ?? []) {
      const chid = cards.findIndex(c => c.avatar === avatar);
      if (chid >= 0 && cards[chid].name) people.push({ name: cards[chid].name, role: 'member', chid, avatar });
    }
  }
  if (context.name1) people.push({ name: context.name1, role: 'user', chid: null, avatar: '' });
  return people;
}

// Splits the scene's unregistered names into main people (with their chat role) and others.
// An exact match always wins over a short name; a short name that fits more than one person is
// ambiguous and stays a side character rather than guessing.
export function classifyMissing(unregistered, people) {
  const main = [], others = [];
  for (const name of unregistered ?? []) {
    if (!name) continue;
    const exact = people.filter(p => exactName(p.name, name));
    const short = exact.length ? [] : people.filter(p => shortName(name, p.name));
    const person = exact[0] ?? (short.length === 1 ? short[0] : null);
    if (!person) { others.push(name); continue; }
    if (!main.some(m => m.person === person)) main.push({ name, person });
  }
  return { main, others };
}

// Description text to turn into a profile: the card's description, or the persona description.
// Uses SillyTavern's own field reader (which fills in {{char}}/{{user}}) when available.
export function descriptionFor(context, person) {
  let text = '', resolved = false;
  const card = person.chid !== null && person.chid !== undefined ? context.characters?.[person.chid] : null;
  try {
    if (person.role === 'user') {
      text = context.getCharacterCardFields?.()?.persona ?? '';
      resolved = !!text;
      if (!text) text = context.powerUserSettings?.persona_description ?? '';
    } else {
      // Only the open card goes through SillyTavern's reader: in group chats it can merge several
      // members' descriptions, so group members use their own card text.
      if (person.role === 'character') { text = context.getCharacterCardFields?.({ chid: person.chid })?.description ?? ''; resolved = !!text; }
      if (!text) text = card?.description ?? card?.data?.description ?? '';
    }
  } catch { text = ''; }
  text = String(text ?? '');
  if (!resolved && text) text = fillNames(context, text, person.role === 'user' ? '' : card?.name ?? '');
  text = text.trim();
  return { text: text.slice(0, CARD_TEXT_LIMIT), truncated: text.length > CARD_TEXT_LIMIT };
}
function fillNames(context, text, charName) {
  const user = context.name1 || 'User', char = charName || context.name2 || 'Character';
  try { if (typeof context.substituteParams === 'function') { const out = context.substituteParams(text, user, char); if (typeof out === 'string') text = out; } } catch { /* fall back below */ }
  return text.replace(/\{\{\s*char\s*\}\}/gi, char).replace(/\{\{\s*user\s*\}\}/gi, user);
}

export const roleLabel = role => role === 'user' ? '유저' : role === 'member' ? '그룹 멤버' : '대화 중인 캐릭터';
export const sourceLabel = role => role === 'user' ? '페르소나' : '캐릭터 카드';
