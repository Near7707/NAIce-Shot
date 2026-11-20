# wip-en — English screen experiment

This branch tries one question: can a person who reads English pick a message in Chat Shot, extract the scene,
understand the cost, and generate one picture? It is not merged into main. main (0.1.162) is the stable Korean version.

## How to try it in SillyTavern

1. Export a backup first (Settings → backup), just in case.
2. Extensions → Manage extensions → NAIce Shot → **Switch branch** (branch icon) → `wip-en`. The server plugin stays as it is (0.1.25).
3. Reload SillyTavern. NAIce Shot → Settings → **화면 언어 · Language** → English → reload again.
4. To go back: set the language to 한국어, or switch the branch back to `main`. Settings, profiles, wardrobes,
   history and saved work are the same data on both branches; the only new value is `uiLanguage` in the settings.

## Rules of this branch

- **Korean is the source.** The Korean text in the code stays where it is and is the dictionary key. With Korean
  chosen (or nothing chosen), every function returns the text exactly as written.
- **Nothing translated is saved or compared.** Translation happens only at the moment text goes on screen:
  `tr` on texts written in index.js, `trMsg` on finished texts (thrown errors, the shared core, the server) in
  `notice` and a few display lines, `localize` on fixed words of panel.html and of HTML just put on screen.
  A notice put together in English from `tr` parts and the AI's or a person's own words is passed through
  `doneText(…)` first, so `notice`'s `trMsg` leaves it whole (otherwise its " / " split looked up a word like
  "정사각형" again). `trMsg`'s pattern match looks a captured value up again only when it is a whole sentence (ends
  with "."), so a name ("세로: 자동 연결 없음…") stays as written (GPT wip-en P3). The mark survives `notice`'s
  `스텝 → Steps` (it is kept by a key that reads 스텝 and Steps the same), so the AI's "스텝 / 정사각형" stays as written
  apart from Steps; `localize` puts the English text in as written, so "$$" in a name stays "$$" (GPT wip-en P3, second review).
  The undo label, outfit origins, warnings that are filtered by their words, and the `스텝 → Steps` wording stay Korean
  inside; they are translated after the code has read them.
- **AI prompts are unchanged.** Scene titles and the 추가 요청 words still come back in Korean. Changing the AI output
  language is the next decision, not this one.
- **No server change.** Server texts are translated in the panel when they are known.
- Version numbers, CHANGELOG, REVIEW and ROADMAP are not touched here (they change on main every version).

## What is in English now

Header, tabs, the drawing tab's fixed words, target message list, extraction progress and buttons, extraction
notices, request results frame, scene candidates heading, undo/clear buttons, work-memory line, generation settings
summary, account box, cost verdict and V5 usage notes, generation questions (no preset, V5 usage), generation
notices, the result area and its save menu, and the language switch itself (both languages on the Korean screen).

Step 2 (after the first iPhone try): the rest of the drawing tab — person cards (temporary people, outfits, lock,
wardrobe, fixed look, pin), the "no profile" box with its link picker and the before-generating dialog, the
left-out line, the chat's profile-link options, the final prompt form and counts, Free Shot's own texts and notices.

Step 3: the Profiles tab — the list heading and help, the profile form (also when it opens on the drawing tab as
"새 프로필" / "프로필 편집"), describe mode and tag conversion, wardrobe rows, card link line, save / clear / delete
notices and confirms, and the shared core's profile and wardrobe errors (through `notice`'s `trMsg`). Profile names
(chips) and wardrobe names are drawn after `localize(dialog)` runs, from templates where only the fixed words are `tr`,
so they stay as written. "직접 입력" is "Manual" (the temporary-person badge and the profile form's mode button share it).

Step 4: the Settings tab — every fixed word of panel.html's settings page (themes and their names, pictures in chat,
tag pop-up, presets, common prompt, NAI generation settings, account fields, Extraction AI, advanced, delete all work,
backup), the folded lines' summaries, and the settings notices, confirms and errors (`tr` in index.js; thrown errors
through `notice`'s `trMsg`). Preset names and connection profile names are drawn after `localize(dialog)` and stay as
written. Theme names and notes come from skins.mjs and are shown with `trMsg`. Also in this step: the chat-changed
notice and "열린 채팅 없음" (missed in step 1), and the header switch, which reads "Chat" / "Free" in English because
"Chat Shot" / "Free Shot" were cut on a phone (`initialize` sets the short words after `localize`; the full name stays
as the button's aria-label; Korean is untouched). "세로" is "Vertical" now: the same word is the size (세로 · 832 × 1216
stays "Portrait · …") and the picture view summary (세로로 나열).
After the fourth review: the language box is English on the English screen ("한국어" stays as it is, so a Korean
reader can always find the way back; the Korean screen keeps both languages, so an English reader can find the box);
the server-version line and the update warning box (compat.mjs messages) are shown with `trMsg` (the code still
compares the Korean message). `tr` itself now marks a text it fills with values as finished (`doneText`), so `notice`
never splits a name at " / " and looks a part up again ("밤 / 보통 / 옷" showed as "밤 / Medium / 옷", GPT wip-en P3,
fourth review). Error messages put into such texts go through `trMsg` where they are put in.
After the fifth review: the chat default outfit notice (옷장 → 채팅 기본 복장) goes through `tr` too, Free Shot's
"장면 추출 실패" notice is translated like Chat Shot's, and "JSON을 읽지 못했어요: 빈 응답" (an empty `{}` reply) is a
whole dictionary text, since a value inside a pattern is looked up again only when it is a sentence.

Known limits, left as they are (GPT wip-en P3, second review): a name that is word for word a whole dictionary sentence
(ends with ".") is shown translated inside "＋ {0} 프로필 만들기"; an outfit that itself ends with " · 잠금" is shown as
"· locked" in the card's saved-outfit line even when unlocked (Korean shows the same ambiguous line; the lock checkbox
next to it shows the real state). Both need the person to type an app sentence by hand. The same goes for an outfit
named exactly like an app sentence inside the shared core's wardrobe error (GPT wip-en P3, third review). An outfit name
with 스텝 shows as Steps in that error in both languages: that is main's `stepsWord`, not this branch.

Also left (step 4): the account-fields "earlier check" line shows its time in Korean form (`toLocaleTimeString('ko-KR')`,
a value); the language switch's own notice stays in both languages.

Still Korean: the History tab, the guide, the viewer, and texts the
AI writes (candidate titles, request words).

## Checks

- `node tests/i18n-compare.mjs <main index.js> index.js` — takes `tr`/`trMsg`/`doneText`/`localize` out and compares with main
  statement by statement. Expected differences: the import, `renderSettings`, `importSettings`, `bindEvents`,
  `initialize` (the language switch). Anything else means Korean behaviour may have changed.
- `tests/prompt-snapshot.test.mjs` — the AI prompts must equal `prompt-snapshot.json` (written from main 47f690d).
- `tests/browser-wip-en.mjs` — same AI reply in Korean and English saves the same work and sends the same prompt;
  buttons and progress stay English while redrawn; the V5 usage question is English and cancelling it sends nothing;
  Free Shot work saved on one language and loaded on the other still undoes as an extraction (both ways); every
  answer of [같은 요청으로 다시 확인] is English and says to check on NovelAI (GPT P2); a user named "세로" and the AI's
  words "밤 / 정사각형 / 혼자" and "스텝 / 정사각형 / 밤" stay as written in English notices, 스텝 aside (GPT P3); a name "A $$ B"
  keeps "$$" in its English button; the Profiles tab is English while profile and wardrobe names that are dictionary
  words (옷장, 제거) stay as written, and the same edits save the same profiles in both languages; the switch writes only `uiLanguage`;
  the Settings tab is English while a preset named 보통 (= Medium) stays as written and saves the same in both languages,
  the header switch reads Chat / Free and fits, and the chat-changed notice is English; a preset and an outfit named
  "밤 / 보통 / 옷" stay whole in their English notices (the chat default outfit too); an empty extraction reply
  reads in English in both modes; the language box and the server-version line are English.
- All earlier checks run unchanged (none of their expectations were edited).

## Stop rules

Stop and rethink if: saved work differs between languages for the same AI reply; an earlier check needs its
expectation changed to pass; `i18n-compare` shows a statement outside the expected list; one step needs more than
about 30 changed lines of working code (not text).

## Notes for whoever continues

- The translation function is `tr`, not `t`: index.js already uses `t` as a local variable in many places.
- The language is read once in `initialize` (`setLang(settings().uiLanguage)`), so a change applies after a reload.
  The switch (`#ncs-ui-language-box`) sits just above 설정 백업: earlier checks expect 테마 first and 설정 백업 last.
- Five places decide by Korean words. They keep doing so; translation comes after:
  1. the saved undo label (`undoClear.label`: present or not, and whether it starts with "추출 전") — made and saved in
     Korean, shown with `trMsg`. Wrapping the label in `tr` breaks undo across languages (browser-wip-en step 4 fails).
  2. outfit origin (`origin==='이번 편집'`, character cards — not translated yet; translate `ORIGIN_TEXT` values only).
  3. warnings filtered by their words (`startsWith('미등록 인물은…')`) — filtered first, then `warnings.map(trMsg)`.
  4. `stepsWord` (스텝 → Steps) — runs first, then `trMsg`; dictionary keys use the "28 Steps" wording.
  5. the viewer's "불러오는 중…" text comparison — the viewer is not translated; use its flag instead if it ever is.
- Big HTML blocks that hold a person's or the AI's words are not wrapped in `tr`; their fixed words are translated
  after drawing with `localize(root, skipSelector)`. The target list preview (chat text) is never localized.
  Skip lists in use: cards `textarea,strong,select[data-profile-switch],select[data-wear-once] option:not([value=""]),
  select[data-chat-outfit] option[value^="w:"]` (names, the AI's words, wardrobe names); the no-profile box and list
  `select`; the before-generating dialog `b`; the final prompt form `textarea,legend`. A name inside a sentence
  ("＋ {0} 프로필 만들기") is a pattern value and stays as written. Fixed words put into those sentences (유저,
  페르소나, ORIGIN_TEXT values) go through `trMsg` where they are inserted, so the pattern gets them in English.
  A redraw of one part (the "지금: …" outfit line while typing) uses `tr` inside its own template instead.
- Only Free Shot's extraction leaves an undo; Chat Shot's does not. That is why the undo check uses Free Shot.
- Tools, run by hand with `node_modules` linked: `tests/i18n-wrap.mjs` (wraps the Korean texts of named functions
  with `tr`; `--dry` first), `tests/i18n-keys.mjs` (tr keys missing from the dictionary), `tests/i18n-compare.mjs`.
  The dictionary `i18n-en.mjs` is edited by hand.
- In `tests/browser-wip-en.mjs` the language is put into the settings the moment the extension creates them (an init
  script hooks `window.mock` and `extensionSettings.naice_shot`); setting it on `DOMContentLoaded` is too late.
- Keep this branch level with main: merge main into wip-en whenever main moves. Do not edit version numbers,
  CHANGELOG, REVIEW or ROADMAP here.
- Review notes and test recipes for the whole extension: [DEV-NOTES.md](DEV-NOTES.md) (Korean).
