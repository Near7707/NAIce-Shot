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
// The 사용 가이드: English reads guide-en.md (guide.md stays as it is). An English group title is looked up back to its
// Korean title, so the icons keyed by the Korean titles (index.js GUIDE_ICONS) stay one table. Korean: both as written.
export const localFile=name=>lang==='en'&&name==='guide.md'?'guide-en.md':name;
export const GUIDE_TITLES_EN={'처음 사용하기':'Getting started','개인정보와 저장되는 내용':'Privacy and what is saved','그리기':'Drawing','인물':'People',
  '그림 다루기':'Working with pictures','비용':'Cost','작업 기억':'Work memory','문제가 생겼을 때':'When something goes wrong'};
export const koOf=title=>lang==='en'?(Object.keys(GUIDE_TITLES_EN).find(k=>GUIDE_TITLES_EN[k]===title)??title):title;

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
// The same held for every key with under 4 fixed letters (spaces aside): "{0}초", "{0} 중…" and "{0} 열기" cut the end
// off server texts not in the dictionary ("서버 응답 제한 시간: 30초" → "…: 30s", "모델 정보 열기" → "Open 모델 정보",
// GPT wip-en P3, tenth review). Such keys are all made by `tr` where they are shown, so none of them is a pattern.
// Two longer keys open at one end are `tr` only too: "#{0} 메시지{1}" made "#3 메시지가 변경됐어요." into "message #3가 변경됐어요."
// and "{0} 본문은 그대로예요." translated only the end of "편집하지 않았어요. 본문은 그대로예요." (GPT wip-en P3, eleventh review).
// Both are made by `tr` where they are shown (the attach notices); the rest of the open keys are a known limit (docs/WIP-EN.md).
// tests/i18n-sweep.test.mjs looks every fixed Korean text of the app and the server up and fails on a half translation.
const TR_ONLY=new Set(['{0} {1}장{2}','#{0} 메시지{1}','{0} 본문은 그대로예요.']),SHORT=4;
// Keys whose value is an ID the AI sent: shown exactly as written, never looked up again even when it ends like an app
// sentence ("미등록 ID 제외: x / 위치 값이 잘못됐어요." kept its end in Korean, GPT wip-en P3, twelfth review).
// The same for the warnings from the shared code that carry a person's name, an alias or a list of names: a name that
// reads like an app sentence ("위치 값이 잘못됐어요.") stayed a name, not "The position value is wrong." (GPT wip-en P3,
// thirteenth review). Warnings made by `tr` in index.js never look their values up, so they need no entry here.
// The 프리샷 card question's lines carry card names the same way (GPT wip-en P3, fourteenth review), and so do the
// errors with a wardrobe item's name, a profile name or a picture tag in them (GPT wip-en P3, fifteenth review).
const AS_IS=new Set(['미등록 ID 제외: {0}',
  '{0}: 자동 연결 없음. 이름·별칭 또는 이 채팅의 연결을 확인해 주세요.','{0}: 자동 연결 없음. 필요하면 유저 프로필을 연결해 주세요.',
  '{0}: 프로필 연결이 겹쳐요. 이 채팅의 프로필을 지정해 주세요.','{0}: @로 고른 같은 이름의 인물이 여러 명이라 누구인지 알 수 없어 비워 뒀어요.',
  '{0}: 프로필을 확정하지 못해 자동 적용하지 않았어요. 장면 정보는 보관했어요.','{0}: {1}와 같은 인물로 보여 한 번만 넣었어요.',
  '{0}: 이름에 맞춰 {1} 프로필로 연결을 바로잡았어요.','{0}: 새 복장 후보가 있지만 잠금을 유지해요.','{0}: AI가 찾은 새 옷이 있지만 잠긴 복장을 입혀요.',
  '미등록 인물은 자동 생성하지 않아요: {0}','임시 인물 {0}의 외형이 비어 있어요. 외형을 채우면 더 잘 그려져요.',
  '장면 설명에 들어간 이름({0})을 빼고 일반 표현으로 정리했어요.',
  '지워져요: {0} (고정 안 함)','체크만 풀려요: {0} (📌 고정)','외형이 새 결과로 다시 채워져요: {0} (고정 안 한 임시 인물)',
  '"{0}" 옷의 태그가 비어 있거나 너무 길어요.','태그는 {0}자까지예요: "{1}…"',
  '"{0}"은(는) 이미 {1}의 옷장에 있어요. 다른 이름을 붙여 주세요.',
  '"{0}"은(는) 이미 {1} 프로필의 이름·별칭이에요. 같은 이름이 두 프로필에 있으면 자동 연결이 안 돼요. 그 프로필을 고르거나, 그쪽 별칭을 먼저 정리해 주세요.']);
const trOnly=k=>TR_ONLY.has(k)||k.replace(/\{\d+\}|\s/g,'').length<SHORT;
let patterns=null;
const escapeRe=s=>s.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/[{}]/g,c=>'\\'+c);
function patternList(){
  if(patterns)return patterns;
  patterns=Object.keys(EN).filter(k=>/\{\d+\}/.test(k)&&!trOnly(k)).sort((a,b)=>b.length-a.length).map(k=>{
    const order=[];const source=escapeRe(k).replace(/\\\{(\d+)\\\}/g,(all,n)=>{order.push(Number(n));return '([\\s\\S]*?)';});
    return {re:new RegExp(`^${source}$`),order,en:EN[k],asIs:AS_IS.has(k)};});
  return patterns;
}
function one(text){
  const exact=EN[text];if(exact!==undefined&&!/\{\d+\}/.test(text))return exact;
  // A captured value may be a finished text itself ("{0} Anlas 사용 허용이 꺼져 있어서…"): one level is looked up too,
  // but only a whole sentence (ends with "."). A name or the AI's words ("세로", "정사각형") stay as they are (GPT wip-en P3).
  for(const p of patternList()){const m=p.re.exec(text);if(!m)continue;const values=[];p.order.forEach((n,i)=>{const v=m[i+1];values[n]=p.asIs?v:v&&/[가-힣]/.test(v)&&/\.\s*$/.test(v)?(EN[v]!==undefined&&!/\{\d+\}/.test(v)?EN[v]:v):v;});return fill(p.en,values);}
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
