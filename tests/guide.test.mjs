// v0.1.106: the 사용 가이드 (guide.md) and its small Markdown reader (guide.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseGuide,guideInline} from '../guide.mjs';
const read=f=>fs.readFile(new URL(`../${f}`,import.meta.url),'utf8');
const md=await read('guide.md');
const groups=parseGuide(md);

test('guide: eight groups in the agreed order, privacy second, every topic has text',()=>{
  assert.deepEqual(groups.map(g=>g.title),['처음 사용하기','개인정보와 저장되는 내용','그리기','인물','그림 다루기','비용','작업 기억','문제가 생겼을 때']);
  assert.equal(groups[1].id,'privacy');assert.equal(groups[5].id,'cost');
  for(const g of groups){assert.ok(g.topics.length);for(const t of g.topics)assert.ok(t.html.length>20,`${g.title} · ${t.title}`);}
  assert.match(groups[0].topics[0].html,/^<blockquote>/,'the 3-line summary opens the guide');
});
test('guide: links go only to a group of the guide or to the project on GitHub',()=>{
  const html=groups.flatMap(g=>g.topics.map(t=>t.html)).join('');
  for(const [,href] of html.matchAll(/href="([^"]+)"/g)){
    if(href.startsWith('#'))assert.ok(groups.some(g=>`#${g.id}`===href),href);
    else assert.match(href,/^https:\/\/github\.com\/Near7707\//);
  }
  assert.match(html,/docs\/PRIVACY\.md/);
});
test('guide reader: everything is escaped, unsafe links become plain text',()=>{
  assert.equal(guideInline('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(guideInline('[a](javascript:alert(1))'),'a)');
  assert.equal(guideInline('[a](https://example.com)'),'a');
  assert.equal(guideInline('**`<b>`**'),'<b><code>&lt;b&gt;</code></b>');
  assert.equal(guideInline('[x](#cost)'),'<a href="#cost" data-guide-link="cost">x</a>');
  // 0.1.107 (GPT P3-3): "../" would leave the account once the address is resolved
  for(const bad of ['https://github.com/Near7707/../other/repo','https://github.com/Near7707/./../other','https://github.com/Near7707/x/../../other/repo'])
    assert.equal(guideInline(`[a](${bad})`),'a',bad);
  assert.match(guideInline('[a](https://github.com/Near7707/NAIce-Shot/blob/main/docs/PRIVACY.md)'),/^<a href="https:\/\/github\.com\/Near7707\/NAIce-Shot\/blob\/main\/docs\/PRIVACY\.md"/);
  assert.match(guideInline('[a](https://github.com/Near7707/x/../NAIce-Shot)'),/^<a /,'resolving inside the account is fine');
  assert.equal(parseGuide('# A\n## B\n<script>x</script>')[0].topics[0].html,'<p>&lt;script&gt;x&lt;/script&gt;</p>');
});
test('guide: every [button] and quoted notice is on the real screen',async()=>{
  const src=(await Promise.all(['panel.html','index.js','viewer.mjs','download-choice.mjs'].map(read))).join('\n');
  const examples=new Set(['#N에 넣기','빼 줘']); // "#3에 넣기" is built from the message number; "빼 줘" is a request example
  for(const [,x] of md.matchAll(/\[([^\]]+)\](?!\()/g))if(!examples.has(x))assert.ok(src.includes(x),`[${x}] is not on the screen`);
  for(const [,x] of md.matchAll(/"([^"]+)"/g))if(!examples.has(x))assert.ok(src.includes(x),`"${x}" is not on the screen`);
  assert.match(src,/#\$\{[^}]+\}에 넣기/);
});
test('guide: no cost promise ("차감되지 않아요")',()=>{
  assert.doesNotMatch(md,/차감되지 않|Anlas가 나가지 않|무료가 보장/);
});
