// @프로필 참조 (0.1.76). A reference is a chip in the free-shot situation or the chat-shot request field.
// On screen it is a pill "@Leo"; inside it keeps the profile's full id. As text (saved work, history, copy between our
// fields) a chip is written  @[Leo](ref:FULL-ID)  — Leo is only for the reader, the id decides.
//   @Name   — typed by hand (or pasted from another app); confirmed into a chip just before extraction when it fits
//             exactly one profile.
// A reference is never linked by guessing: an unknown name, a name that fits several profiles, a chip whose profile is
// gone, an old 0.1.75 "@Name#short" mark, or a malformed one all stop the extraction with a note.
// A profile picked with @ must be in the extracted people (it wins over "leave X out").
import {identityKey} from './matching.mjs';

// Particles that may follow a typed name directly. Up to two may follow each other (에게는, 한테도, 으로는).
export const PARTICLES=['이랑','하고','에게','한테','에서','으로','가','이','는','은','를','을','와','과','랑','의','도','만','로','께'].sort((a,b)=>b.length-a.length);
const WORD=/[\p{L}\p{N}_]/u;
// '@' starts a reference only at the start of the text or after something that is not a letter or digit (a@b.com is not one).
const startsRef=(text,i)=>text[i]==='@'&&(i===0||!WORD.test(text[i-1]));

// Where a typed name ends: the end, a space or punctuation, or up to two particles followed by one of those.
export function boundaryAfter(text,at){
  const edge=i=>i>=text.length||!WORD.test(text[i]);
  if(edge(at))return at;
  let i=at;
  for(let n=0;n<2;n++){
    const p=PARTICLES.find(p=>text.startsWith(p,i));if(!p)return -1;
    i+=p.length;if(edge(i))return at;
  }
  return -1;
}

// --- The chip as text -------------------------------------------------------------------------------------------------
export const EMPTY_NAME='이름 없음';
const safeName=name=>String(name??'').replace(/[\[\]()\n]/g,' ').replace(/\s+/g,' ').trim().slice(0,200)||EMPTY_NAME; // 0.1.80: the whole name (a profile name has at most 200), so the length seen is the length checked // a chip name is never empty
export const chipToken=(name,id)=>`@[${safeName(name)}](ref:${String(id??'').replace(/[^A-Za-z0-9_-]/g,'')})`;
const TOKEN=/@\[([^\]\n]{0,200})\]\(ref:([A-Za-z0-9_-]*)\)/gu;
// The 0.1.75 form "@Name#short": it cannot be trusted, so it shows as a broken chip. The name may hold spaces but does not
// end in one, so "@Leo #1 fan" is not an old mark.
const LEGACY=/(^|[^\p{L}\p{N}_])@([^@#\n\[\]]{0,59}[^@#\n\[\]\s])#[A-Za-z0-9_-]*/gu;

// Splits the text into pieces: {type:'text',text} and {type:'chip',name,id,legacy}. A chip with an empty id (or a legacy
// mark) is a broken chip.
export function tokenize(value){
  const text=String(value??''),hits=[];
  for(const m of text.matchAll(TOKEN))hits.push({start:m.index,end:m.index+m[0].length,name:m[1],id:m[2],legacy:false});
  for(const m of text.matchAll(LEGACY)){
    const start=m.index+m[1].length,end=m.index+m[0].length;
    if(hits.some(h=>start<h.end&&end>h.start))continue;
    hits.push({start,end,name:m[2],id:'',legacy:true});
  }
  hits.sort((a,b)=>a.start-b.start);
  const out=[];let at=0;
  for(const h of hits){
    if(h.start<at)continue;
    if(h.start>at)out.push({type:'text',text:text.slice(at,h.start)});
    out.push({type:'chip',name:h.name,id:h.id,legacy:h.legacy});at=h.end;
  }
  if(at<text.length)out.push({type:'text',text:text.slice(at)});
  return out;
}
// How long the text looks on screen: a chip counts as its "@name".
export const displayLength=value=>tokenize(value).reduce((n,p)=>n+(p.type==='text'?p.text.length:(p.name||EMPTY_NAME).length+1),0);

// Length rules (0.1.77): the limit is what a person sees (a chip counts as "@name"). The stored text form of a chip is
// @[name](ref:ID) = 9 + name + ID (ID at most 80), so the longest stored text for a visible limit is reached with 1-letter
// names: visible/2 chips x 90 characters = 45 x visible. No chip-count cap is needed; these are the ceilings.
export const LENGTH_LIMITS={free:{visible:4000,stored:180000,label:'상황 글'},wish:{visible:200,stored:9000,label:'추가 요청'}};
// Returns null when the text fits, otherwise a clear message.
export function lengthProblem(value,kind){
  const rule=LENGTH_LIMITS[kind],text=String(value??''),shown=displayLength(text);
  if(shown>rule.visible)return `${rule.label}이 너무 길어요. 화면에 보이는 글자 기준 ${rule.visible.toLocaleString('en-US')}자까지예요. (지금 ${shown.toLocaleString('en-US')}자)`;
  if(text.length>rule.stored)return `${rule.label}에 칩이 너무 많아요. 줄여 주세요.`;
  return null;
}

const labelsOf=p=>[p.name,...(p.aliases??[])].filter(x=>String(x??'').trim());

// Reads every reference in the text. Returns refs [{start,end,raw,id,typed}] and problems [{start,end,raw,message}].
// Positions are in the text that was given. Chips and old marks are read first; what is left is read for typed names.
export function readRefs(text,profiles){
  const refs=[],problems=[];const value=String(text??'');
  const labels=profiles.flatMap(p=>labelsOf(p).map(label=>({label,id:p.id}))).sort((a,b)=>b.label.length-a.label.length);
  // Chips and old marks claim their ranges first.
  const claimed=[];let at=0;
  for(const piece of tokenize(value)){
    if(piece.type==='text'){at+=piece.text.length;continue;}
    const raw=piece.legacy?`@${piece.name}#…`:chipToken(piece.name,piece.id);
    // Position of the piece in the text: tokenize drops nothing, so searching from the running offset is exact.
    const start=at;let end;
    if(piece.legacy){const m=/^@[^#\n]*#[A-Za-z0-9_-]*/u.exec(value.slice(start));end=start+(m?m[0].length:1);}
    else{const m=/^@\[[^\]\n]{0,200}\]\(ref:[A-Za-z0-9_-]*\)/u.exec(value.slice(start));end=start+(m?m[0].length:1);}
    at=end;claimed.push([start,end]);
    const shown=piece.name||'이름 없음';
    if(piece.legacy){problems.push({start,end,raw,message:`@${shown}: 예전 형식(@이름#ID)이거나 잘못된 형식이에요. 지우고 @를 쳐서 목록에서 다시 골라 주세요.`});continue;}
    const p=profiles.find(p=>String(p.id)===piece.id);
    if(piece.id&&p)refs.push({start,end,raw,id:p.id,typed:false});
    else problems.push({start,end,raw,message:`@${shown}: 지워졌거나 찾을 수 없는 프로필이에요. 칩을 지우고 @를 쳐서 다시 골라 주세요.`});
  }
  const inClaimed=i=>claimed.some(([s,e])=>i>=s&&i<e);
  for(let i=0;i<value.length;i++){
    if(inClaimed(i)||!startsRef(value,i))continue;
    // @Name typed by hand: the longest name or alias that ends at a boundary.
    const rest=value.slice(i+1);let found=null;
    for(const l of labels){
      if(rest.slice(0,l.label.length).toLowerCase()!==l.label.toLowerCase())continue;
      if(boundaryAfter(value,i+1+l.label.length)<0)continue;
      found=l;break;
    }
    if(!found){
      const word=(rest.match(/^[^\s@]{1,30}/)??[''])[0];
      if(word)problems.push({start:i,end:i+1+word.length,raw:`@${word}`,message:`@${word}: 이 이름의 프로필을 찾지 못했어요. @를 쳐서 목록에서 골라 주세요.`});
      continue;
    }
    const end=i+1+found.label.length,raw=value.slice(i,end),key=identityKey(found.label);
    const owners=profiles.filter(p=>labelsOf(p).some(n=>identityKey(n)===key));
    if(owners.length===1)refs.push({start:i,end,raw,id:owners[0].id,typed:true});
    else problems.push({start:i,end,raw,message:`${raw}: 같은 이름·별칭의 프로필이 여러 개예요. @를 쳐서 목록에서 골라 주세요.`});
    i=end-1;
  }
  refs.sort((a,b)=>a.start-b.start);problems.sort((a,b)=>a.start-b.start);
  return {refs,problems};
}

// Turns every reference typed by hand into a chip. Returns the new text and what was confirmed.
export function confirmRefs(text,profiles){
  const {refs,problems}=readRefs(text,profiles);
  if(problems.length)return {text,confirmed:[],problems};
  let out=String(text??'');const confirmed=[];
  for(const r of [...refs].reverse()){
    if(!r.typed)continue;const p=profiles.find(p=>p.id===r.id),next=chipToken(p.name,p.id);
    out=out.slice(0,r.start)+next+out.slice(r.end);confirmed.unshift({from:r.raw,to:`@${p.name}`});
  }
  return {text:out,confirmed,problems:[]};
}

// The required people in order of first mention (one each), and the text for the extraction AI: each reference becomes
// the profile's current name with its full id, so people with the same name stay apart. No chip text remains.
export function refsForExtraction(text,profiles){
  const {refs,problems}=readRefs(text,profiles);
  let out=String(text??'');const ids=[];
  for(const r of [...refs].reverse()){
    const p=profiles.find(p=>p.id===r.id);
    out=out.slice(0,r.start)+`${p.name} (roster id ${p.id})`+out.slice(r.end);
  }
  for(const r of refs)if(!ids.includes(r.id))ids.push(r.id);
  return {text:out,required:ids.map(id=>profiles.find(p=>p.id===id)),problems};
}

// The text with references reduced to plain names (for the local name check of who stays in 프리샷).
export function plainNames(text,profiles){
  const {refs}=readRefs(text,profiles);let out=String(text??'');
  for(const r of [...refs].reverse())out=out.slice(0,r.start)+profiles.find(p=>p.id===r.id).name+out.slice(r.end);
  return out;
}

// What a person sees: every chip as "@name" (also what goes to another app on copy).
export const displayText=value=>tokenize(value).map(p=>p.type==='text'?p.text:`@${p.name}`).join('');

// Leftover reference marks are never sent on: a chip becomes its plain name, an old "@Name#id" mark too.
export const stripRefMarks=value=>String(value??'').replace(TOKEN,(m,name)=>name).replace(LEGACY,(m,lead,name)=>`${lead}${name}`);

// --- Autocomplete: the "@query" right before the caret (in the text node the caret is in), if any.
export function queryAt(text,caret){
  const before=String(text??'').slice(0,caret),at=before.lastIndexOf('@');
  if(at<0||!startsRef(before,at))return null;
  const query=before.slice(at+1);
  if(query.includes('\n')||query.includes('#')||query.length>30)return null;
  return {start:at,query};
}
const tagsOf=text=>String(text??'').split(/[,;，、\n]/).map(s=>s.trim()).filter(Boolean);
// A short look to tell people with the same name apart: hair and eye words from the fixed look, then the usual outfit.
export function lookSummary(profile){
  const tags=tagsOf(profile.appearance);
  const pick=re=>tags.filter(t=>re.test(t)).slice(0,2);
  const parts=[...pick(/\bhair\b|\bbangs\b|\bponytail\b|머리/i),...pick(/\beyes?\b|눈/i)];
  if(!parts.length)parts.push(...tags.slice(0,2));
  const outfit=tagsOf(profile.defaultOutfit).slice(0,2).join(', ');
  const cut=(s,n)=>s.length>n?`${s.slice(0,n-1)}…`:s;
  return [cut(parts.join(', '),44),outfit?cut(outfit,36):''].filter(Boolean).join(' · ');
}
// Profiles for the list: name or an alias contains the query (any case), best first. Each shows its aliases and a short look.
export function suggestions(profiles,query,limit=8){
  const q=String(query??'').trim().toLowerCase();
  const rank=p=>{const ls=labelsOf(p).map(x=>x.toLowerCase());if(!q)return 0;if(ls.some(l=>l.startsWith(q)))return 1;if(ls.some(l=>l.includes(q)))return 2;return 9;};
  return profiles.map(p=>({p,r:rank(p)})).filter(x=>x.r<9).sort((a,b)=>a.r-b.r).slice(0,limit)
    .map(x=>({id:x.p.id,name:x.p.name,aliases:(x.p.aliases??[]).filter(Boolean),look:lookSummary(x.p)}));
}
