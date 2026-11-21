// wip-en: the work-memory line above the drawing fields swaps its text each time typing stops ("saving" → "kept").
// On an iPhone the long English "The last work is remembered on the server." went to two lines while "Saving the last
// work…" fits in one, so every pause pushed the fields down and up (the user's iPhone, Free Shot). The texts that swap
// while typing stay short in English, no longer than the Korean ones that never wrapped.
import test from 'node:test';
import assert from 'node:assert/strict';
import EN from '../i18n-en.mjs';

test('wip-en: the work-memory texts that swap while typing are short in English',()=>{
 for(const ko of ['마지막 작업 저장 중…','마지막 작업을 서버에 기억해요.','마지막 작업을 불러오는 중…']){
  const en=EN[ko];assert.ok(en,`${ko} has English`);
  assert.ok(en.length<=24,`"${en}" is short enough for one line on a phone (${en.length} characters)`);
 }
});
