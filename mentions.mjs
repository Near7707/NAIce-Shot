// @프로필 참조 (0.1.75). A reference is plain text in the free-shot situation or the chat-shot request:
//   @Name#id   — picked from the list (or confirmed): Name is for the reader, #id is the start of the profile's own id.
//   @Name      — typed by hand; confirmed into @Name#id just before extraction when it fits exactly one profile.
// Nothing is kept outside the text, so copying and pasting carries the link. A reference is never linked by guessing:
// an unknown name, a name that fits several profiles, an id that is gone or now fits several profiles all stop the
// extraction with a note. A profile picked with @ must be in the extracted people (it wins over "leave X out").
import {identityKey} from './matching.mjs';

// Particles that may follow a name or an id directly. Up to two may follow each other (에게는, 한테도, 으로는).
export const PARTICLES=['이랑','하고','에게','한테','에서','으로','가','이','는','은','를','을','와','과','랑','의','도','만','로','께'].sort((a,b)=>b.length-a.length);
const WORD=/[\p{L}\p{N}_]/u;
const ID_CHAR=/[A-Za-z0-9_-]/;
const SHORT=4;
// '@' starts a reference only at the start of the text or after something that is not a letter or digit (a@b.com is not one).
const startsRef=(text,i)=>text[i]==='@'&&(i===0||!WORD.test(text[i-1]));

// Where a name or id ends: the end, a space or punctuation, or up to two particles followed by one of those.
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

// The shortest start of each profile's id (at least 4 characters) that no other profile's id starts with.
export function shortIds(profiles){
  const ids=profiles.map(p=>String(p.id));const out=new Map();
  for(const id of ids){
    let n=Math.min(SHORT,id.length);
    while(n<id.length&&ids.some(o=>o!==id&&o.startsWith(id.slice(0,n))))n++;
    out.set(id,id.slice(0,n));
  }
  return out;
}
export const refText=(profile,profiles)=>`@${profile.name}#${shortIds(profiles).get(String(profile.id))}`;

const labelsOf=p=>[p.name,...(p.aliases??[])].filter(x=>String(x??'').trim());

// Reads every reference in the text. Returns refs [{start,end,raw,id,typed}] and problems [{start,end,raw,message}].
export function readRefs(text,profiles){
  const refs=[],problems=[];const value=String(text??'');
  const labels=profiles.flatMap(p=>labelsOf(p).map(label=>({label,id:p.id}))).sort((a,b)=>b.label.length-a.label.length);
  for(let i=0;i<value.length;i++){
    if(!startsRef(value,i))continue;
    // @Name#id: the name runs to the '#' on the same line (spaces allowed), at most 60 characters.
    const hash=value.indexOf('#',i+1),line=value.indexOf('\n',i+1);
    const name=hash>0&&(line<0||hash<line)?value.slice(i+1,hash):null;
    if(name&&name.trim()===name&&name.length>0&&name.length<=60&&!name.includes('@')){
      let e=hash+1;while(e<value.length&&ID_CHAR.test(value[e]))e++;
      const short=value.slice(hash+1,e),raw=value.slice(i,e);
      if(short){
        if(boundaryAfter(value,e)<0){problems.push({start:i,end:e,raw,message:`${raw}: 참조 바로 뒤에 글자가 붙어 있어요. 띄어 쓰거나 목록에서 다시 골라 주세요.`});i=e-1;continue;}
        // An id written in full wins (an id like "leo" may be the start of another, "leon-2").
        const exact=profiles.filter(p=>String(p.id)===short),hits=exact.length?exact:profiles.filter(p=>String(p.id).startsWith(short));
        if(hits.length===1)refs.push({start:i,end:e,raw,id:hits[0].id,typed:false});
        else problems.push({start:i,end:e,raw,message:hits.length?`${raw}: 여러 프로필과 겹쳐요. @를 다시 쳐서 목록에서 골라 주세요.`:`${raw}: 지워졌거나 찾을 수 없는 프로필이에요. 이름으로 대신 연결하지 않아요.`});
        i=e-1;continue;
      }
    }
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
  return {refs,problems};
}

// Turns every reference typed by hand into the @Name#id form. Returns the new text and what was confirmed.
export function confirmRefs(text,profiles){
  const {refs,problems}=readRefs(text,profiles);
  if(problems.length)return {text,confirmed:[],problems};
  let out=String(text??'');const confirmed=[];
  for(const r of [...refs].reverse()){
    if(!r.typed)continue;const p=profiles.find(p=>p.id===r.id),next=refText(p,profiles);
    out=out.slice(0,r.start)+next+out.slice(r.end);confirmed.unshift({from:r.raw,to:next});
  }
  return {text:out,confirmed,problems:[]};
}

// The required people in order of first mention (one each), and the text for the extraction AI: each reference becomes
// the profile's current name with its full id, so people with the same name stay apart. No '@' or '#id' remains.
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

// Leftover reference marks are never sent on: removes "@Name#id" and a bare "#id" that follows a name.
export const stripRefMarks=value=>String(value??'').replace(/(^|[^\p{L}\p{N}_])@([^@#\n]{1,60})#[A-Za-z0-9_-]+/gu,'$1$2');

// --- Autocomplete: the "@query" right before the caret, if any.
export function queryAt(text,caret){
  const before=String(text??'').slice(0,caret),at=before.lastIndexOf('@');
  if(at<0||!startsRef(before,at))return null;
  const query=before.slice(at+1);
  if(query.includes('\n')||query.includes('#')||query.length>30)return null;
  return {start:at,query};
}
// Profiles for the list: name or an alias contains the query (any case), best first. Each shows its aliases.
export function suggestions(profiles,query,limit=8){
  const q=String(query??'').trim().toLowerCase();
  const rank=p=>{const ls=labelsOf(p).map(x=>x.toLowerCase());if(!q)return 0;if(ls.some(l=>l.startsWith(q)))return 1;if(ls.some(l=>l.includes(q)))return 2;return 9;};
  return profiles.map(p=>({p,r:rank(p)})).filter(x=>x.r<9).sort((a,b)=>a.r-b.r).slice(0,limit).map(x=>({id:x.p.id,name:x.p.name,aliases:(x.p.aliases??[]).filter(Boolean)}));
}
