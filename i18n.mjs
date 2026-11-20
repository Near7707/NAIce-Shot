// Screen language (wip-en experiment). The Korean text in the code stays the source and the key: Korean returns
// every text exactly as written, and nothing translated is ever saved or compared. English looks the Korean text up
// in i18n-en.mjs; a text it does not know stays Korean.
//   tr`장면 추출`, tr`V5 사용량이 ${n}% 남았어요.` — a text written in this file's code (key: '… {0} …').
//   trMsg(text) — a finished text from elsewhere (a thrown error, the shared core, the server): exact or pattern match.
//   localize(root) — the fixed words of panel.html or of HTML just put on screen (text nodes and a few attributes).
import EN from './i18n-en.mjs';

let lang='ko';
export const LANGUAGES=['ko','en'];
export function setLang(value){lang=value==='en'?'en':'ko';}
export const currentLang=()=>lang;
// Dates and times shown on screen (history cards, the viewer's caption, "이전 조회"): Korean keeps 'ko-KR' and the options
// exactly as written; English reads "Nov 14, 2026, 7:27 PM". Display only: the saved value is the ISO time.
export const dateLocale=()=>lang==='en'?'en-US':'ko-KR';
export const dateForm=options=>lang==='en'&&options.month==='numeric'?{...options,month:'short'}:options;

const join=(strings,values)=>{let out=strings[0];for(let i=1;i<strings.length;i++)out+=String(values[i-1])+strings[i];return out;};
const fill=(template,values)=>template.replace(/\{(\d+)\}/g,(all,n)=>Number(n)<values.length?String(values[Number(n)]):all);
export function tr(strings,...values){
  if(lang!=='en')return join(strings,values);
  let key=strings[0];for(let i=1;i<strings.length;i++)key+=`{${i-1}}`+strings[i];
  const en=EN[key];if(en===undefined)return join(strings,values);
  // A text put together with values (a name, the AI's words) is finished English: notice's trMsg must not split it at
  // " / " and look a part of a name up again ("밤 / 보통 / 옷" → "밤 / Medium / 옷", GPT wip-en P3, fourth review).
  const out=fill(en,values);if(values.length)doneText(out);return out;
}

// Keys with {n} as patterns, longest first, built once on the first English lookup.
// A key with almost no fixed text is used by `tr` only (an exact lookup where it is made), never as a pattern: the
// history count "{0} {1}장{2}" matched any text with a space and a "장" and cut it out ("저장" → "저", "장면" → "면"),
// so a Korean error not in the dictionary showed broken on the English screen (GPT wip-en P3, ninth review).
// tests/i18n-sweep.test.mjs looks every fixed Korean text of the app up and fails on a half translation.
const TR_ONLY=new Set(['{0} {1}장{2}']);
let patterns=null;
const escapeRe=s=>s.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/[{}]/g,c=>'\\'+c);
function patternList(){
  if(patterns)return patterns;
  patterns=Object.keys(EN).filter(k=>/\{\d+\}/.test(k)&&!TR_ONLY.has(k)).sort((a,b)=>b.length-a.length).map(k=>{
    const order=[];const source=escapeRe(k).replace(/\\\{(\d+)\\\}/g,(all,n)=>{order.push(Number(n));return '([\\s\\S]*?)';});
    return {re:new RegExp(`^${source}$`),order,en:EN[k]};});
  return patterns;
}
function one(text){
  const exact=EN[text];if(exact!==undefined&&!/\{\d+\}/.test(text))return exact;
  // A captured value may be a finished text itself ("{0} Anlas 사용 허용이 꺼져 있어서…"): one level is looked up too,
  // but only a whole sentence (ends with "."). A name or the AI's words ("세로", "정사각형") stay as they are (GPT wip-en P3).
  for(const p of patternList()){const m=p.re.exec(text);if(!m)continue;const values=[];p.order.forEach((n,i)=>{const v=m[i+1];values[n]=v&&/[가-힣]/.test(v)&&/\.\s*$/.test(v)?(EN[v]!==undefined&&!/\{\d+\}/.test(v)?EN[v]:v):v;});return fill(p.en,values);}
  return null;
}
// doneText(text): a notice already put together in English (tr parts + the AI's or a person's own words). trMsg leaves it
// as it is, so a word inside it ("정사각형", a name) is not looked up again (GPT wip-en P3). Korean: returns text.
// notice turns 스텝 into Steps before trMsg ("28스텝" → "28 Steps", "스텝은" → "Steps는"), so a marked text is kept by a key
// that reads both spellings the same; otherwise the AI's word "스텝" made the notice look unmarked (GPT wip-en P3).
const finished=new Set(),doneKey=s=>s.replace(/ ?(?:스텝|Steps)[은는]?/g,'§');
export function doneText(text){
  if(lang!=='en'||typeof text!=='string'||!text)return text;
  finished.add(doneKey(text));if(finished.size>200)finished.delete(finished.values().next().value);
  return text;
}
export function trMsg(text){
  if(lang!=='en'||typeof text!=='string'||!text||finished.has(doneKey(text)))return text;
  const whole=one(text);if(whole!==null)return whole;
  // A notice put together from several finished texts: each line, then each " / " part, on its own.
  if(text.includes('\n'))return text.split('\n').map(trMsg).join('\n');
  if(text.includes(' / '))return text.split(' / ').map(part=>one(part)??part).join(' / ');
  return text;
}

const ATTRS=['aria-label','title','placeholder','data-short','alt'];
// skip: a selector for parts that hold the person's or the AI's own words (never looked up).
export function localize(root,skip=''){
  if(lang!=='en'||!root)return root;
  const doc=root.ownerDocument??document,walker=doc.createTreeWalker(root,4);
  for(let n=walker.nextNode();n;n=walker.nextNode()){
    const raw=n.nodeValue,text=raw.trim();if(!text||!/[가-힣]/.test(text))continue;
    if(skip&&n.parentElement?.closest(skip))continue;
    const en=one(text);if(en!==null)n.nodeValue=raw.replace(text,()=>en); // as written: "$$" in a name is not a replace pattern (GPT wip-en P3)
  }
  const all=root.querySelectorAll?[...(root.nodeType===1?[root]:[]),...root.querySelectorAll('*')]:[];
  for(const el of all)for(const a of ATTRS){const v=el.getAttribute(a);if(v&&/[가-힣]/.test(v)){const en=one(v.trim());if(en!==null)el.setAttribute(a,en);}}
  return root;
}
