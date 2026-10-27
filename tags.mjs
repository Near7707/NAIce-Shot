// Local clean-up of AI scene text before it reaches the image model: removes story names,
// possessives and template macros, and normalizes Danbooru tag formatting.
// The matching prompt guidance lives in core.mjs (shared with the server plugin).

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hangul = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const filler = new Set(['', 'a', 'an', 'the', 'of', 'in', 'at', 'with', 'for', 'and', 's']);

// Removes names (and their possessives or "of X" phrases) from one text field. Returns [text, removedNames].
export function stripNames(text, names) {
  if (typeof text !== 'string' || !text) return [text ?? '', []];
  let out = text.replace(/(?:\{\{[^}]*\}\}|<\s*(?:user|char|bot)\s*>)(?:'s|’s)?/gi, ' '), removed = [];
  const list = [...new Set(names.map(n => String(n ?? '').trim()).filter(n => n.length >= 2))].sort((a, b) => b.length - a.length);
  for (const name of list) {
    // No lookbehind: older iOS Safari cannot compile it. The leading boundary is captured and put back.
    const re = hangul.test(name)
      ? new RegExp(`()${escapeRe(name)}(?:의|네|씨|님)?`, 'g')
      : new RegExp(`(^|[^\\p{L}\\p{N}_])(?:(?:of|with|for|near|beside)\\s+)?${escapeRe(name)}(?:'s|’s|s'|’)?(?=$|[^\\p{L}\\p{N}_])`, 'giu');
    if (re.test(out)) {
      removed.push(name);
      // "looking at NAME" keeps its meaning as the Danbooru tag "looking at another".
      if (!hangul.test(name)) out = out.replace(new RegExp(`\\b(looking|staring|glancing|smiling|waving|pointing)\\s+at\\s+${escapeRe(name)}(?:'s|’s)?(?=$|[^\\p{L}\\p{N}_])`, 'giu'), (m, verb) => `${verb.toLowerCase()} at another`);
      re.lastIndex = 0; out = out.replace(re, '$1 ');
    }
  }
  return [out, removed];
}

// Danbooru-style formatting: lowercase, spaces for underscores, no weighting brackets, no duplicates.
export function normalizeTags(text) {
  if (typeof text !== 'string') return '';
  const seen = new Set(), tags = [];
  for (let tag of text.split(/[,\n]/)) {
    tag = tag.trim().toLowerCase().replace(/_/g, ' ').replace(/:\s*-?\d+(?:\.\d+)?\s*$/, '').replace(/^-?\d+(?:\.\d+)?\s*::/, '').replace(/::$/, '');
    while (/^[{[(]/.test(tag) && /[}\])]$/.test(tag)) tag = tag.slice(1, -1).trim();
    tag = tag.replace(/^[{[(]+|[}\])]+$/g, '').replace(/[.;!]+$/, '').replace(/\s+/g, ' ').trim();
    while (dangling.test(tag)) tag = tag.replace(dangling, '').trim();
    const words = tag.split(' ').filter(w => !filler.has(w));
    if (!words.length || seen.has(tag)) continue;
    seen.add(tag); tags.push(tag);
  }
  return tags.join(', ');
}
const dangling = /\s+(?:at|to|with|toward|towards|of|for|and|near|beside)$/i;
const tidyText = text => text.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').replace(/^[\s,.]+|[\s,]+$/g, '').replace(/,\s*,/g, ',').trim();

// Cleans the AI's descriptive fields; identity fields (characters[].entityName, unregistered) are kept.
export function genericizeScene(scene, names, format = 'tags') {
  const removed = new Set();
  const clean = value => {
    const [stripped, hits] = stripNames(value, names); hits.forEach(h => removed.add(h));
    return format === 'tags' ? normalizeTags(stripped) : tidyText(stripped);
  };
  const next = { ...scene };
  for (const key of ['location', 'lighting', 'camera', 'interaction']) next[key] = clean(scene[key] ?? '');
  const cleanPeople=people=>(people??[]).map(c => ({ ...c, expression: clean(c.expression ?? ''), action: clean(c.action ?? ''),
    outfit: c.outfitMode === 'replace' ? clean(c.outfit ?? '') : c.outfit }))
    .map(c => c.outfitMode === 'replace' && !c.outfit ? { ...c, outfitMode: 'unchanged' } : c);
  next.characters=cleanPeople(scene.characters);
  if(scene.unregisteredDetails)next.unregisteredDetails=cleanPeople(scene.unregisteredDetails);
  return { scene: next, removed: [...removed] };
}
