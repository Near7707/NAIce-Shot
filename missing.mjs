// People who appear in a scene without a profile are left out of the image. The ones the chat is
// actually about — the open character card, group members and the user's persona — get a strong
// warning with ways to fix it; everyone else (side characters, extras) only gets a gentle hint.

export const CARD_TEXT_LIMIT = 4000; // profileDraftPrompt accepts up to 4,000 characters

const words = value => String(value ?? '').toLowerCase().replace(/[\s_\-·.]+/g, ' ').trim().split(' ').filter(Boolean);

// True when two names refer to the same person: identical after normalizing, or one is a whole-word
// part of the other ("Ana" and "Ana Reyes"). Single letters never match.
export function sameName(a, b) {
  const x = words(a), y = words(b);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.join('').length < 2) return false;
  return short.every(w => long.includes(w));
}

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
export function classifyMissing(unregistered, people) {
  const main = [], others = [];
  for (const name of unregistered ?? []) {
    if (!name) continue;
    const person = people.find(p => sameName(p.name, name));
    if (person && !main.some(m => m.person === person)) main.push({ name, person });
    else if (!person) others.push(name);
  }
  return { main, others };
}

// Description text to turn into a profile: the card's description, or the persona description.
// Uses SillyTavern's own field reader (which fills in {{char}}/{{user}}) when available.
export function descriptionFor(context, person) {
  let text = '';
  try {
    if (person.role === 'user') {
      text = context.getCharacterCardFields?.()?.persona ?? '';
      if (!text) text = context.powerUserSettings?.persona_description ?? '';
    } else {
      const card = person.chid !== null && person.chid !== undefined ? context.characters?.[person.chid] : null;
      if (person.role === 'character') text = context.getCharacterCardFields?.({ chid: person.chid })?.description ?? '';
      if (!text) text = card?.description ?? card?.data?.description ?? '';
    }
  } catch { text = ''; }
  text = String(text ?? '').trim();
  return { text: text.slice(0, CARD_TEXT_LIMIT), truncated: text.length > CARD_TEXT_LIMIT };
}

export const roleLabel = role => role === 'user' ? '유저' : role === 'member' ? '그룹 멤버' : '대화 중인 캐릭터';
export const sourceLabel = role => role === 'user' ? '페르소나' : '캐릭터 카드';
