// A text field that can hold @profile chips (0.1.76). Used for the 프리샷 situation and the 챗샷 extra request.
// The field is a contenteditable box. On screen a chip is a pill "@Leo"; inside it keeps the profile's full id.
// field.value reads and writes the text form (mentions.mjs: a chip is @[Leo](ref:FULL-ID)), so the rest of the app can
// treat the box like a normal text field (value, input events, saved work and history).
import {tokenize,chipToken,queryAt,boundaryAfter,EMPTY_NAME} from './mentions.mjs';

const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const isChip=n=>n?.nodeType===1&&n.classList?.contains('ncs-chip');
const BROKEN_TITLE='지워졌거나 찾을 수 없는 프로필이에요. 지우고 @를 쳐서 다시 골라 주세요.';

function chipHtml(name,id,profile){
  const label=(profile?profile.name:name)||EMPTY_NAME,broken=!profile;
  return `<span class="ncs-chip${broken?' ncs-chip-broken':''}" contenteditable="false" data-ref-id="${escapeHtml(id)}" data-ref-name="${escapeHtml(label)}" title="${broken?BROKEN_TITLE:escapeHtml('@'+label)}">@${escapeHtml(label)}</span>`;
}
// The HTML for a text value. chips:false keeps chip-looking text as plain text (a paste from another app).
export function htmlOf(value,profiles,{chips=true,singleLine=false}={}){
  const text=String(value??'');
  const pieces=chips?tokenize(text):[{type:'text',text}];
  let html='';
  for(const [i,p] of pieces.entries()){
    if(p.type==='text'){
      const t=singleLine?p.text.replace(/\s*\n\s*/g,' '):p.text;
      html+=escapeHtml(t).replace(/\n/g,'<br>');
    }else{
      html+=chipHtml(p.name,p.id,p.id?profiles.find(x=>String(x.id)===p.id):null);
      // A chip at the very end needs something after it to put the caret on.
      if(i===pieces.length-1)html+='​';
    }
  }
  if(text.endsWith('\n')&&!singleLine)html+='<br>'; // a trailing empty line needs its own placeholder
  return html;
}

// Reads a node (or a copied fragment) back into text. internal: chips as @[name](ref:id); otherwise as @name.
// live: root is the field itself (its last <br> may be only a placeholder); a copied fragment keeps every newline.
export function serialize(root,internal=true,live=false){
  const out=[];
  const walk=node=>{
    for(const n of node.childNodes){
      if(n.nodeType===3){out.push(n.data.replace(/[​﻿]/g,'').replace(/ /g,' '));continue;}
      if(n.nodeType!==1)continue;
      if(isChip(n)){const name=n.dataset.refName??n.textContent.replace(/^@/,'');out.push(internal?chipToken(name,n.dataset.refId??''):`@${name}`);continue;}
      if(n.tagName==='BR'){out.push('\n');continue;}
      const block=/^(DIV|P|LI)$/.test(n.tagName);
      if(block&&out.length&&!out.join('').endsWith('\n'))out.push('\n');
      walk(n);
    }
  };
  walk(root);
  let text=out.join('');
  // Browsers keep a placeholder <br> at the end of the last line; it is not a newline the person typed.
  if(live&&root.lastChild?.nodeName==='BR'&&text.endsWith('\n'))text=text.slice(0,-1);
  return text;
}

// Makes the box a chip field. options: getProfiles(), limit, measure(text), singleLine.
export function setupChipField(el,{getProfiles,limit=Infinity,measure=v=>v.length,singleLine=false}={}){
  el.setAttribute('contenteditable','true');el.setAttribute('role','textbox');el.setAttribute('spellcheck','false');
  if(!singleLine)el.setAttribute('aria-multiline','true');
  const profiles=()=>getProfiles?.()??[];
  const read=()=>serialize(el,true,true);
  const locked=()=>!!el.closest('fieldset:disabled');
  Object.defineProperty(el,'value',{configurable:true,
    get:read,
    set(v){el.innerHTML=htmlOf(v,profiles(),{singleLine});}});
  // Chip labels follow the profile's current name; a chip whose profile is gone turns into a broken chip.
  el.refreshChips=()=>{
    for(const chip of el.querySelectorAll('.ncs-chip')){
      const id=chip.dataset.refId,p=id?profiles().find(x=>String(x.id)===id):null;
      if(p){chip.textContent=`@${p.name}`;chip.dataset.refName=p.name;chip.classList.remove('ncs-chip-broken');chip.title=`@${p.name}`;}
      else{chip.classList.add('ncs-chip-broken');chip.title=BROKEN_TITLE;}
    }
  };
  // The text before the caret decides the "@…" list. Returns {node,start,end,query} or null.
  el.caretQuery=()=>{
    const sel=getSelection();if(!sel?.rangeCount||!sel.isCollapsed)return null;
    const node=sel.anchorNode;if(!node||node.nodeType!==3||!el.contains(node)||isChip(node.parentNode))return null;
    const q=queryAt(node.data,sel.anchorOffset);if(!q)return null;
    return {node,start:q.start,end:sel.anchorOffset,query:q.query};
  };
  // Puts the chip of a profile where the "@query" is. execCommand keeps the browser's own undo (Ctrl+Z) working.
  el.insertChip=(q,profile)=>{
    el.focus();
    // "@Le|o": the rest of the name after the caret is part of what was typed, so it goes too (0.1.77, UI-075-07).
    // Only when the profile's name or alias really continues with it and ends at a word edge; otherwise nothing extra.
    const data=q.node.data,typed=data.slice(q.start+1,q.end).toLowerCase();let end=q.end,best=0;
    for(const label of [profile.name,...(profile.aliases??[])].filter(Boolean)){
      const l=String(label).toLowerCase();if(!l.startsWith(typed)||l.length===typed.length)continue;
      const rest=l.slice(typed.length);
      if(data.slice(q.end,q.end+rest.length).toLowerCase()===rest&&boundaryAfter(data,q.end+rest.length)>=0)best=Math.max(best,rest.length);
    }
    end+=best;
    // 0.1.79 (UI-076-02): the chip must fit. Measured as seen: the typed "@que" goes, "@name" (and a space) comes.
    const space0=/\s/.test(data[end]??'')?0:1,grow=(profile.name.length+1+space0)-(end-q.start);
    if(grow>0&&room()-grow<0){el.dispatchEvent(new CustomEvent('ncs-field-full',{bubbles:true,detail:{chip:true}}));return false;}
    const range=document.createRange();range.setStart(q.node,q.start);range.setEnd(q.node,end);
    const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
    const next=data[end]??'',space=/\s/.test(next)?'':'&nbsp;';
    document.execCommand('insertHTML',false,chipHtml(profile.name,profile.id,profile)+space);
    return true;
  };
  const room=(extra='')=>{
    const sel=getSelection();let selected='';
    if(sel?.rangeCount&&el.contains(sel.anchorNode)){const h=document.createElement('div');h.append(sel.getRangeAt(0).cloneContents());selected=serialize(h,true);}
    return limit-(measure(read())-measure(selected))-measure(extra);
  };
  const insert=(value,opts)=>document.execCommand('insertHTML',false,htmlOf(value,profiles(),{singleLine,...opts}));
  const blocked=event=>{if(locked()){event.preventDefault();return true;}return false;};
  el.addEventListener('beforeinput',event=>{
    if(blocked(event))return;
    const type=event.inputType;
    if(type==='insertParagraph'||type==='insertLineBreak'){
      event.preventDefault();
      if(!singleLine&&room('\n')>=0)document.execCommand('insertLineBreak');
      return;
    }
    if(type==='insertFromDrop'){event.preventDefault();return;}
    if(['insertText','insertReplacementText'].includes(type)&&event.data&&room(event.data)<0)event.preventDefault();
  });
  el.addEventListener('keydown',event=>{if(locked())event.preventDefault();});
  el.addEventListener('dragover',event=>event.preventDefault());
  el.addEventListener('drop',event=>event.preventDefault());
  el.addEventListener('paste',event=>{
    event.preventDefault();if(locked())return;
    const data=event.clipboardData;if(!data)return;
    const internal=data.getData('text/x-ncs-ref');
    let text=internal||data.getData('text/plain');
    if(singleLine)text=text.replace(/\s*\r?\n\s*/g,' ');
    text=text.replace(/\r\n?/g,'\n');
    if(!text)return;
    if(room(text)<0){el.dispatchEvent(new CustomEvent('ncs-field-full',{bubbles:true}));return;}
    insert(text,{chips:!!internal});
  });
  // Copy and cut: other apps get "@Leo"; our own fields also get the chips (with their ids) back on paste.
  const copyOut=event=>{
    const sel=getSelection();if(!sel?.rangeCount||sel.isCollapsed||!el.contains(sel.anchorNode)||!event.clipboardData)return false;
    const holder=document.createElement('div');holder.append(sel.getRangeAt(0).cloneContents());
    event.clipboardData.setData('text/plain',serialize(holder,false));
    event.clipboardData.setData('text/x-ncs-ref',serialize(holder,true));
    event.preventDefault();return true;
  };
  el.addEventListener('copy',copyOut);
  el.addEventListener('cut',event=>{if(locked()){event.preventDefault();return;}if(copyOut(event))document.execCommand('delete');});
  // Browsers leave a stray <br> when everything is deleted; an empty box must be empty for the placeholder.
  el.addEventListener('input',event=>{
    if(event.isComposing)return;
    if(!el.querySelector('.ncs-chip')&&!el.textContent.replace(/[​﻿]/g,'')&&el.innerHTML)el.innerHTML='';
  });
  // Hangul (IME) text arrives while composing and cannot be refused. When composing ends over the limit, only the part
  // composed this time is trimmed; existing text and chips are never touched. If that part cannot be found, nothing is
  // cut: the field stays over the limit, the person is told, and extraction/generation stay blocked until it fits.
  el.addEventListener('compositionend',event=>{
    if(locked())return;
    const over=measure(read())-limit;if(over<=0)return;
    const data=event.data??'',sel=getSelection(),node=sel?.anchorNode,at=sel?.anchorOffset??0;
    if(sel?.isCollapsed&&node?.nodeType===3&&el.contains(node)&&!isChip(node.parentNode)&&data&&node.data.slice(at-data.length,at)===data){
      const cut=Math.min(over,data.length),from=at-cut;
      const range=document.createRange();range.setStart(node,from);range.setEnd(node,at);
      sel.removeAllRanges();sel.addRange(range);document.execCommand('delete');
      if(measure(read())<=limit){el.dispatchEvent(new CustomEvent('ncs-field-full',{bubbles:true}));return;}
    }
    el.dispatchEvent(new CustomEvent('ncs-field-over',{bubbles:true}));
  });
  el.addEventListener('focus',()=>el.refreshChips());
  return el;
}
