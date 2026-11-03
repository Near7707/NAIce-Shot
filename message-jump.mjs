// Where a history image belongs in its chat: the message it was made from (snapshot source) and the message(s)
// it is attached to. Pure functions over SillyTavern's chat array, so they can be tested without a browser.
import { textSignature } from './core.mjs';

const sameText = (fingerprint, text) => typeof text === 'string' &&
  (fingerprint.signature ? textSignature(text) === fingerprint.signature : text === fingerprint.text);

// The fingerprint of the drawn (last) message of a source, or null for images without one.
export function targetFingerprint(source) {
  if (!source || !Number.isInteger(source.target) || !Array.isArray(source.fingerprints)) return null;
  return source.fingerprints.find(f => f.index === source.target) ?? null;
}

// Finds the message an image was made from.
// state: 'same' (found unchanged), 'swipe' (another swipe is showing; the drawn one still exists),
// 'moved' (the same message at another position, e.g. after earlier messages were deleted),
// 'edited' (the same message, with changed text), 'missing' (cannot be confirmed: never guessed).
// With a recorded send time, only the message with that time can be the source: the same words elsewhere
// (a repeated greeting, a short reply) are another message (UI-053-01). Older images without one fall back to
// the drawn text and swipe.
export function locateSource(source, chat) {
  const f = targetFingerprint(source);
  if (!f || !Array.isArray(chat)) return { index: null, state: 'missing' };
  const order = chat.map((_, i) => i).filter(i => chat[i]).sort((a, b) => Math.abs(a - f.index) - Math.abs(b - f.index)); // nearest first
  const drawnOn = m => sameText(f, m.mes) && (m.swipe_id ?? 0) === f.swipeId;
  const drawnSwipe = m => Array.isArray(m.swipes) && sameText(f, m.swipes[f.swipeId]);
  const where = i => i === f.index ? 'same' : 'moved';
  if (f.sendDate) {
    // SillyTavern moves send_date with the shown swipe, so a swipe's own time counts too.
    const sameMessage = m => m.send_date === f.sendDate || (Array.isArray(m.swipe_info) && m.swipe_info.some(x => x?.send_date === f.sendDate));
    const i = order.find(i => sameMessage(chat[i]));
    if (i === undefined) return { index: null, state: 'missing' };
    const m = chat[i];
    if (drawnOn(m)) return { index: i, state: where(i) };
    if (drawnSwipe(m)) return { index: i, state: 'swipe' };
    return { index: i, state: 'edited' };
  }
  for (const i of order) {
    const m = chat[i];
    if (drawnOn(m)) return { index: i, state: where(i) };
    if (drawnSwipe(m)) return { index: i, state: 'swipe' };
  }
  return { index: null, state: 'missing' };
}

// The last message the image is attached to (the one a reader most likely sees), or null.
export function locateAttached(id, chat) {
  if (!Array.isArray(chat)) return null;
  for (let i = chat.length - 1; i >= 0; i--) if (chat[i]?.extra?.naice_shot_images?.some?.(x => x.id === id)) return i;
  return null;
}

// What 메시지로 가기 offers for one image in the open chat:
// one target when made and attached messages are the same (or only one is known), two when they differ.
export function jumpTargets(item, chat) {
  const made = locateSource(item?.snapshot?.scene?.source, chat), attached = locateAttached(item?.id, chat);
  const targets = [];
  if (attached !== null) targets.push({ kind: 'attached', index: attached, state: 'same' });
  if (made.index !== null && made.index !== attached) targets.push({ kind: 'made', index: made.index, state: made.state });
  if (made.index !== null && made.index === attached && made.state !== 'same') targets[0].state = made.state;
  return { targets, both: attached !== null && made.index === attached, made };
}
