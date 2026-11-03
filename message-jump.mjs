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
// 'moved' (same text at another position, e.g. after earlier messages were deleted),
// 'edited' (the position still holds a message, but its text changed), 'missing' (nothing to go to).
export function locateSource(source, chat) {
  const f = targetFingerprint(source);
  if (!f || !Array.isArray(chat)) return { index: null, state: 'missing' };
  const usable = i => !!chat[i]; // hidden (system) messages can be drawn too
  const here = chat[f.index];
  if (usable(f.index) && sameText(f, here.mes) && (here.swipe_id ?? 0) === f.swipeId) return { index: f.index, state: 'same' };
  if (usable(f.index) && Array.isArray(here.swipes) && sameText(f, here.swipes[f.swipeId])) return { index: f.index, state: 'swipe' };
  // Deleting earlier messages shifts indexes: look for the same text elsewhere, nearest first.
  const order = chat.map((_, i) => i).filter(i => i !== f.index && usable(i)).sort((a, b) => Math.abs(a - f.index) - Math.abs(b - f.index));
  for (const i of order) {
    const m = chat[i];
    if (sameText(f, m.mes)) return { index: i, state: 'moved' };
    if (Array.isArray(m.swipes) && sameText(f, m.swipes[f.swipeId])) return { index: i, state: 'swipe' };
  }
  if (usable(f.index)) return { index: f.index, state: 'edited' };
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
