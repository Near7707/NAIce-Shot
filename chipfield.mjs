// A text field that can hold @profile references (0.1.76). Used for the 프리샷 situation and the 챗샷 extra request.
// 0.1.117: the box is a plain <textarea> again. iPhone Safari would not put a caret in the old contenteditable box inside
// SillyTavern (the 장소 textarea next to it worked), so the pills are gone: the box shows "@Leo" as plain text and keeps
// beside it which profile each "@name" picked from the @ list stands for (by its place in the text).
// field.value still reads and writes the text form (mentions.mjs: a reference is @[Leo](ref:FULL-ID)), so saved work,
// history and extraction see exactly what they saw before.
import {tokenize,chipToken,queryAt,boundaryAfter,EMPTY_NAME} from './mentions.mjs';

const label=name=>String(name??'').replace(/[\r\n]/g,' ')||EMPTY_NAME;

// Text form → what the box shows ("@name") and the links it keeps: {start,label,id}, start = where its "@" is.
// A link to a profile that is gone (or an old "@Name#short" mark) keeps its empty or unknown id, so it stays a broken
// reference and still stops the extraction. Two profiles with the same name stay apart: a link is a place, not a name.
export function showRefs(value,profiles=[],{singleLine=false}={}){
  let text='';const refs=[];
  for(const p of tokenize(value)){
    if(p.type==='text'){text+=singleLine?p.text.replace(/\s*\n\s*/g,' '):p.text;continue;}
    const profile=p.id?profiles.find(x=>String(x.id)===p.id):null;
    const name=label(profile?profile.name:p.name);
    refs.push({start:text.length,label:name,id:p.legacy?'':p.id});text+=`@${name}`;
  }
  return {text,refs};
}

// What the box shows → text form: each link whose "@label" is still where it was becomes @[label](ref:id).
export function linkRefs(text,refs=[]){
  const s=String(text??'');let out='',at=0;
  for(const r of [...refs].sort((a,b)=>a.start-b.start)){
    const end=r.start+1+r.label.length;
    if(r.start<at||s.slice(r.start,end)!==`@${r.label}`)continue;
    out+=s.slice(at,r.start)+chipToken(r.label,r.id);at=end;
  }
  return out+s.slice(at);
}

// After an edit: links before the changed part stay, links after it move along, a link the edit touched is dropped
// (typing inside "@Leo" or deleting part of it ends that link, like deleting a chip did).
// caret (where the caret is after the edit) tells which of two equal places changed, e.g. "@" typed before "@Leo".
export function moveRefs(before,after,refs,caret=null){
  if(before===after)return refs;
  const max=Math.min(before.length,after.length);
  let q=0;while(q<max&&before[before.length-1-q]===after[after.length-1-q])q++;
  if(Number.isInteger(caret)&&caret>=0&&caret<=after.length)q=Math.min(q,after.length-caret);
  let p=0;while(p<max-q&&before[p]===after[p])p++;
  const oldEnd=before.length-q,shift=after.length-before.length,out=[];
  for(const r of refs){
    const end=r.start+1+r.label.length;
    if(end<=p)out.push(r);
    else if(r.start>=oldEnd)out.push({...r,start:r.start+shift});
  }
  return out.filter(r=>after.slice(r.start,r.start+1+r.label.length)===`@${r.label}`);
}

// Makes the textarea a reference field. options: getProfiles(), limit (letters as seen), singleLine.
export function setupChipField(el,{getProfiles,limit=Infinity,singleLine=false}={}){
  const profiles=()=>getProfiles?.()??[];
  let refs=[],last='';
  // The textarea's own value (what is seen). Looked up on the element's class, so small test pages without a DOM work too.
  let proto=Object.getPrototypeOf(el),native=null,plain=String(el.value??'');
  while(proto&&!(native=Object.getOwnPropertyDescriptor(proto,'value')))proto=Object.getPrototypeOf(proto);
  if(!native?.get||!native?.set)native={get(){return plain;},set(v){plain=String(v);}};
  const shown=()=>native.get.call(el);
  // The limit counts what is seen, and a reference is seen as "@name": the box's own length is that count, so the
  // browser keeps typing (Hangul included) inside it. Text loaded over the limit stays and is reported by the caller.
  if(Number.isFinite(limit))el.maxLength=limit;
  el.setAttribute('spellcheck','false');
  // The one-line request grows with its text (it wraps). A hidden box has no size to measure: it starts over when shown.
  const grow=()=>{
    if(!singleLine)return;el.style.height='';
    if(!el.getClientRects?.().length||!shown())return;
    el.style.height=`${el.scrollHeight+el.offsetHeight-el.clientHeight}px`;
  };
  // Keeps the links in step with the text; every read checks first, so a change that sent no input event is caught too.
  const sync=()=>{const now=shown();if(now!==last){refs=moveRefs(last,now,refs,document.activeElement===el?el.selectionEnd:null);last=now;}};
  const add=(at,list)=>{sync();refs=[...refs,...list.map(r=>({...r,start:r.start+at}))].sort((a,b)=>a.start-b.start);};
  Object.defineProperty(el,'value',{configurable:true,
    get:()=>{sync();return linkRefs(last,refs);},
    set(v){const r=showRefs(v,profiles(),{singleLine});native.set.call(el,r.text);refs=r.refs;last=r.text;grow();}});
  el.refs=()=>{sync();return refs.map(r=>({...r}));};
  const room=(extra='')=>limit-(shown().length-(el.selectionEnd-el.selectionStart))-extra.length;
  // Puts text where the selection is. execCommand keeps the browser's own undo; setRangeText is the fallback.
  const put=text=>{
    el.focus();
    if(!document.execCommand?.('insertText',false,text)){el.setRangeText(text,el.selectionStart,el.selectionEnd,'end');el.dispatchEvent(new Event('input',{bubbles:true}));}
  };
  // The text before the caret decides the "@…" list. Returns {node,start,end,query} or null (node: the field itself).
  el.caretQuery=()=>{
    if(el.selectionStart!==el.selectionEnd)return null;
    sync();const at=el.selectionStart,q=queryAt(last,at);if(!q||refs.some(r=>r.start===q.start))return null; // a picked "@name" is done
    return {node:el,start:q.start,end:at,query:q.query};
  };
  // Puts "@name" of a profile where the "@query" is and remembers which profile it is.
  el.insertChip=(q,profile)=>{
    const data=shown(),typed=data.slice(q.start+1,q.end).toLowerCase();let end=q.end,best=0;
    // "@Le|o": the rest of the name after the caret is part of what was typed, so it goes too (0.1.77, UI-075-07).
    for(const l0 of [profile.name,...(profile.aliases??[])].filter(Boolean)){
      const l=String(l0).toLowerCase();if(!l.startsWith(typed)||l.length===typed.length)continue;
      const rest=l.slice(typed.length);
      if(data.slice(q.end,q.end+rest.length).toLowerCase()===rest&&boundaryAfter(data,q.end+rest.length)>=0)best=Math.max(best,rest.length);
    }
    end+=best;
    const name=label(profile.name),space=/\s/.test(data[end]??'')?'':' ',text=`@${name}${space}`;
    // 0.1.79 (UI-076-02): the reference must fit. Measured as seen: the typed "@que" goes, "@name" (and a space) comes.
    if(limit-(data.length-(end-q.start))-text.length<0){el.dispatchEvent(new CustomEvent('ncs-field-full',{bubbles:true,detail:{chip:true}}));return false;}
    el.focus();el.setSelectionRange(q.start,end);put(text);add(q.start,[{start:0,label:name,id:String(profile.id)}]);grow();
    return true;
  };
  el.addEventListener('beforeinput',event=>{
    if(singleLine&&(event.inputType==='insertParagraph'||event.inputType==='insertLineBreak'))event.preventDefault();
    if(event.inputType==='insertFromDrop')event.preventDefault();
  });
  el.addEventListener('drop',event=>event.preventDefault());
  // Pasting: our own fields hand over the links too; other apps give plain text. A paste that does not fit is refused
  // as a whole and said so, instead of being cut short by the browser.
  el.addEventListener('paste',event=>{
    const data=event.clipboardData;if(!data)return;
    event.preventDefault();
    const internal=data.getData('text/x-ncs-ref');
    let text=internal||data.getData('text/plain');
    text=text.replace(/\r\n?/g,'\n');
    let more=[];
    if(internal){const r=showRefs(text,profiles(),{singleLine});text=r.text;more=r.refs;}
    else if(singleLine)text=text.replace(/\s*\n\s*/g,' ');
    if(!text)return;
    if(room(text)<0){el.dispatchEvent(new CustomEvent('ncs-field-full',{bubbles:true}));return;}
    const at=el.selectionStart;put(text);add(at,more);grow();
  });
  // Copy and cut: other apps get "@Leo"; our own fields also get the links (with their ids) back on paste.
  const copyOut=event=>{
    const a=el.selectionStart,b=el.selectionEnd;if(a===b||!event.clipboardData)return false;
    const part=shown().slice(a,b);
    event.clipboardData.setData('text/plain',part);
    sync();event.clipboardData.setData('text/x-ncs-ref',linkRefs(part,refs.map(r=>({...r,start:r.start-a})).filter(r=>r.start>=0)));
    event.preventDefault();return true;
  };
  el.addEventListener('copy',copyOut);
  el.addEventListener('cut',event=>{
    if(!copyOut(event))return;
    if(!document.execCommand?.('delete')){el.setRangeText('',el.selectionStart,el.selectionEnd,'end');el.dispatchEvent(new Event('input',{bubbles:true}));}
    grow();
  });
  el.addEventListener('input',()=>{sync();grow();});el.addEventListener('focus',grow);
  return el;
}
