// wip-en: the English 사용 가이드 (guide-en.md), read only on the English screen. guide.md (Korean) is not changed;
// the English guide follows it group by group and topic by topic, and names buttons and notices as the English screen does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseGuide} from '../guide.mjs';
import {setLang,trMsg,localFile,koOf,GUIDE_TITLES_EN} from '../i18n.mjs';
import EN from '../i18n-en.mjs';
const read=f=>fs.readFile(new URL(`../${f}`,import.meta.url),'utf8');
const ko=parseGuide(await read('guide.md')),md=await read('guide-en.md'),en=parseGuide(md);

test('guide-en: the same groups (ids too) and the same number of topics as the Korean guide, every topic has text',()=>{
  assert.deepEqual(en.map(g=>g.id),ko.map(g=>g.id));
  assert.deepEqual(en.map(g=>g.title),ko.map(g=>GUIDE_TITLES_EN[g.title]),'each English title is the Korean title\'s English');
  assert.deepEqual(en.map(g=>g.topics.length),ko.map(g=>g.topics.length));
  for(const g of en)for(const t of g.topics)assert.ok(t.html.length>20,`${g.title} · ${t.title}`);
  assert.match(en[0].topics[0].html,/^<blockquote>/,'the 3-line summary opens the guide');
});
test('guide-en: no Korean, links only inside the guide or to the project on GitHub, no cost promise',()=>{
  assert.doesNotMatch(md,/[가-힣]/);
  const html=en.flatMap(g=>g.topics.map(t=>t.html)).join('');
  for(const [,href] of html.matchAll(/href="([^"]+)"/g)){
    if(href.startsWith('#'))assert.ok(en.some(g=>`#${g.id}`===href),href);
    else assert.match(href,/^https:\/\/github\.com\/Near7707\//);
  }
  assert.match(html,/docs\/PRIVACY\.md/);
  assert.doesNotMatch(md,/not (be )?(charged|deducted|spent)|won't (cost|spend)|free of charge|guaranteed free/i);
});
test('guide-en: every [button] and quoted notice is what the English screen shows',async()=>{
  // The English screen: every dictionary English whose Korean (a fixed piece or sentence of it) is in the app's screen files, and the
  // files' own words.
  const src=(await Promise.all(['panel.html','index.js','viewer.mjs','download-choice.mjs','core.mjs'].map(read))).join('\n');
  setLang('en');
  const shown=[src,...Object.entries(EN).filter(([k])=>src.includes(k)||k.split(/\{\d+\}|\n|(?<=[.?]) /).some(p=>p.length>=6&&src.includes(p))).map(([,v])=>v)].join('\n');
  setLang('ko');
  const examples=new Set(['Put in #N','Save ▾']); // "Put in #3" is built from the message number; ▾ is the caret drawn by CSS
  assert.equal(EN['#{0}에 넣기'],'Put in #{0}');assert.equal(EN['저장'],'Save');
  for(const [,x] of md.matchAll(/\[([^\]]+)\](?!\()/g))if(!examples.has(x))assert.ok(shown.includes(x),`[${x}] is not on the English screen`);
  for(const [,x] of md.matchAll(/"([^"]+)"/g))assert.ok(shown.includes(x),`"${x}" is not on the English screen`);
});
test('guide-en: the file and the icons follow the screen language; Korean stays as written',()=>{
  setLang('ko');assert.equal(localFile('guide.md'),'guide.md');assert.equal(koOf('Drawing'),'Drawing');assert.equal(koOf('그리기'),'그리기');
  setLang('en');assert.equal(localFile('guide.md'),'guide-en.md');assert.equal(localFile('panel.html'),'panel.html');
  for(const g of ko)assert.equal(koOf(GUIDE_TITLES_EN[g.title]),g.title);
  assert.equal(koOf('Something else'),'Something else');
  // the guide sheet's own words (bar, error) and the @ pill words named by the guide are English
  for(const t of ['‹ 목차','다음 ›','📖 사용 가이드','✕ 닫기','칸에서 지우기','프로필 보기','다시 고르기','연결됨','끊김'])assert.doesNotMatch(trMsg(t),/[가-힣]/,t);
  setLang('ko');
});
