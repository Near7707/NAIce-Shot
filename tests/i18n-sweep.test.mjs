// wip-en: no fixed Korean text of the app comes out of the English screen's trMsg/localize half translated.
// A dictionary pattern with little fixed text ("{0} {1}장{2}", the history count) once matched any text with a space and
// a "장" and cut it out: "삭제된 프로필이 장면에 있어요." showed as "삭제된 프로필이 면에 있어요." (GPT wip-en P3, ninth
// review; 31 texts of the app). Every quoted Korean text in the code (no `${}` in it) is looked up as English: it must
// come back as it was (not in the dictionary yet) or with no Korean left.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setLang,tr,trMsg,localize} from '../i18n.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=fs.readdirSync(root).filter(f=>/\.(mjs|js)$/.test(f)&&!f.startsWith('i18n'));
const QUOTED=/(['"`])((?:(?!\1)[^\\\n]|\\.)*?[가-힣](?:(?!\1)[^\\\n]|\\.)*?)\1/g;
const unescape=s=>s.replace(/\\n/g,'\n').replace(/\\(['"`\\])/g,'$1');
function texts(){
  const out=new Set();
  for(const f of files)for(const m of fs.readFileSync(path.join(root,f),'utf8').matchAll(QUOTED)){
    if(/\$\{|`/.test(m[2]))continue;out.add(unescape(m[2]));} // a template with values, or a piece cut out of one
  return out;
}

test('every fixed Korean text of the app is either left as it is or fully English (never half translated)',()=>{
  setLang('en');
  try{
    const list=texts();assert.ok(list.size>500,`found the app's texts (${list.size})`);
    const half=[...list].filter(t=>{const out=trMsg(t);return out!==t&&/[가-힣]/.test(out);}).map(t=>`${t} → ${trMsg(t)}`);
    assert.deepEqual(half,[]);
  }finally{setLang('ko');}
});

test('the history count still reads in English where it is made, and is not a pattern for other texts',()=>{
  setLang('en');
  try{
    assert.equal(tr`${tr`총`} ${2}장${tr` · ${1}장 표시`}`,'Total 2 · 1 shown');
    assert.equal(trMsg('삭제된 프로필이 장면에 있어요. 다시 선택해 주세요.'),'삭제된 프로필이 장면에 있어요. 다시 선택해 주세요.');
    assert.equal(trMsg('작업 내용이 너무 커서 저장하지 못했어요.'),'작업 내용이 너무 커서 저장하지 못했어요.');
    // localize reads text nodes with the same lookup
    const node={nodeValue:' 외형이나 복장이 비어 있어요. ',parentElement:null};
    const fake={ownerDocument:{createTreeWalker:()=>{let done=false;return {nextNode:()=>done?null:(done=true,node)};}},querySelectorAll:()=>[],nodeType:11};
    localize(fake);assert.equal(node.nodeValue,' 외형이나 복장이 비어 있어요. ');
  }finally{setLang('ko');}
});

test('프리샷 question about cards not in the text: every line in English, card names as written (GPT wip-en P3, ninth review)',async()=>{
  const {confirmText}=await import('../free-people.mjs');
  const profiles=[{id:'p1',name:'세로'}]; // a name that is also a dictionary word ("Vertical")
  const text=confirmText({removed:[{temp:true,name:'Mira'}],pinnedOut:[{id:'p1',included:true}],refilled:[{temp:true,name:'보통'}]},profiles);
  setLang('en');
  try{
    assert.equal(trMsg(text),['Some character cards are not in the text.','Will be removed: Mira (not pinned)','Will only be unticked: 세로 (📌 pinned)',
      'Look refilled from the new result: 보통 (temporary, not pinned)','','OK: extract as it is · Cancel: go back to edit the text or 📌 pin'].join('\n'));
  }finally{setLang('ko');}
  assert.equal(trMsg(text),text,'Korean: as written');
});
