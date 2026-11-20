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

Step 5-1: the History tab — panel.html's history page (scope, help boxes, PNG and storage notes), the count line, the
selection buttons and save menu, the chat filter, the cards (pick, star, ⋯ menu, its message lines, tag and preset forms),
pictures waiting to be saved, the attach picker (also opened from the drawing tab), and the notices, confirms and errors
of putting in, taking out, deleting, saving, tagging, moving to a message and [챗샷으로 보내기] / [프리샷으로 보내기]
(`tr` in index.js; thrown errors, also those of chat.mjs, inline-images.mjs and image-marks.mjs, through `notice`'s
`trMsg`). Cards, the waiting list, the ⋯ message lines and the attach picker are drawn first and then `localize`d with skip
lists: `.ncs-chat-name,.ncs-history-tags,.ncs-history-date` (cards), the first `small` of a waiting row (chat name · date),
`.ncs-target-meta,.ncs-target-preview` (attach picker). A tag "1에 넣기" shows as "#1에 넣기", which reads like the pattern
"#{0}에 넣기", so the tag skip matters. `chatLabel`'s own words (프리샷, 알 수 없는 채팅, 그룹 · …) are `tr`, the chat name
stays as written. The import's undo label (`이력에서 가져왔어요. 원래 … 작업은…`) is still made and saved in Korean; only the
notice gets `trMsg(name)`.
After the sixth review (GPT wip-en P3 ×3): a missing picture's note on a history card is CSS (`::after`), so
`initialize` puts `ncs-lang-en` on the panel in English and style.css has the English words for it; [Go to message] in
the same chat shows its state toast through `trMsg` (the other-chat path already did); `api`'s two shared errors
("서버 플러그인을 확인해 주세요 (502).", "요청 실패 (503)") are dictionary patterns.

Step 5-2: the enlarged view (viewer.mjs) and the pictures in the chat (inline-images.mjs). viewer.mjs now imports
`tr`/`trMsg`/`localize`: its fixed HTML is `localize`d once when it is built (on the first open, after `initialize` set the
language); its own texts (seed button, prompt loading and copy, [메시지로 가기]) are `tr`; everything it is given or
catches is shown with `trMsg` — the toast (`say`, also for thrown errors), the ⋯ menu's `label`/`note` from index.js's
`viewerActions` (and `jumpChoices`, the same dictionary entries the history ⋯ menu uses), the prompt error and the copy
error. The labels stay Korean inside index.js. `promptText`'s lines ("모델: …", "[공통 Positive]", "[인물 n · …]") are `tr`
(display and copy only; never saved). The viewer actions' toasts in index.js (`away`, the move notes) get `trMsg`.
inline-images.mjs uses `tr` for the chat pictures' buttons, the slide arrows and a missing picture's note; it is drawn by
`renderChatImages`, which runs after `setLang`. The throws "채팅 저장에 실패해 …" / "채팅이 저장되지 않아 …" are in the dictionary.
"불러오는 중…" (place 5 below) is still compared by its words, now as `trMsg('불러오는 중…')` against what `say` showed, so
Korean compares exactly as before.
After the seventh review (GPT wip-en P3, test only): step 11 no longer refreshes the history once more before [Go to
message]: the card stays after the failed refreshes, and the extra refresh's late reply could redraw the card under the
open ⋯ menu.

Known limits, left as they are (GPT wip-en P3, second review): a name that is word for word a whole dictionary sentence
(ends with ".") is shown translated inside "＋ {0} 프로필 만들기"; an outfit that itself ends with " · 잠금" is shown as
"· locked" in the card's saved-outfit line even when unlocked (Korean shows the same ambiguous line; the lock checkbox
next to it shows the real state). Both need the person to type an app sentence by hand. The same goes for an outfit
named exactly like an app sentence inside the shared core's wardrobe error (GPT wip-en P3, third review). An outfit name
with 스텝 shows as Steps in that error in both languages: that is main's `stepsWord`, not this branch.

Also left (step 4): the language switch's own notice stays in both languages. The account box's check time is 24-hour
("14:20") in both languages.

After the user's iPhone try of step 5-1/5-2: the selection button [본문에 넣기] is "Insert" ("Put in message" ran over the
next button: the four buttons share one row in equal boxes), and the two sentences that name the button say [Insert] too.
Dates and times read in the screen language: `shortDate` (history cards, waiting rows, the viewer's caption) and the
"이전 조회(…)" time use `dateLocale()` / `dateForm(…)` from i18n.mjs — Korean gets 'ko-KR' and the options as written
("2026. 11. 14. 오후 7:27"), English gets "Nov 14, 2026, 7:27 PM". Display only; the saved time is not touched.
`tests/i18n-compare.mjs` reads `dateLocale()` as 'ko-KR' and `dateForm(x)` as x, so the Korean comparison stays whole.
After the eighth review (GPT wip-en P3 ×2): clipboard.mjs's "복사하지 못했어요. …" is in the dictionary (the viewer's seed
toast and prompt copy line already go through `trMsg`; the drawing tab's account copy line now does too); `say` passes
`trMsg(message)` to SillyTavern's toast when the panel is closed (`notice` translated inside, the toast did not), so
[이 메시지에서 빼기] in the chat shows its save error in English.

Step 6 (outside the panel and narrow phones, GPT wip-en P3 ×3 of the ninth review): the extension list entry ("프로필 ·
장면 편집 · 이미지 생성", "NAIce Shot 열기") — `initialize` now reads the language *before* `mountSettingsDrawer`, which
draws the entry right away (before the panel file loads); the message draw button's name (title, aria-label; the button
is built once, after `setLang`) and the notices of a press (`tr`, also translated by `notice`'s `trMsg` through the
dictionary); the tag pop-up's label, picture text, ✕ and hint (`tr`, drawn after `setLang`). On narrow phones: "준비 중…"
(the history [저장 ▾] while picked pictures are saved) is "Saving…" (was "Preparing…", only this button uses it), and
`style.css` gives the English screen a little less room up to 360px — tab icon gap and size (`Settings` and the bold
selected `Profiles` ran out of their tab at 320px) and the gap before the save arrow. Korean CSS is untouched.
`tests/i18n-compare.mjs` now reads a template put inside another one (`<span>${tr`${esc(name)} 열기`}</span>`) as the same
text written in place, so the wrapped extension list entry compares equal to main.

After the ninth review (GPT wip-en P3 ×3): the confirms that can drop edits are English — another candidate over a
hand-edited final prompt, reloading the server's work after a save conflict, the two questions when the server's work
differs or was deleted (`recallDraft`), and Free Shot's question about cards not in the text (`trMsg(confirmText(…))`:
line by line, card names as written; its "추출하지 않았어요…" note too). The work memory's status line goes through `trMsg`
where it is put on screen (`renderDraftState`: `draftNote`, `draftHoldNote`), so the notes stay Korean inside; the
[다시 연결] notices are `tr`. The history count key "{0} {1}장{2}" is `tr` only (`TR_ONLY` in i18n.mjs): as a pattern it
matched any text with a space and a "장" and cut it out ("저장" → "저", "장면" → "면"), so 31 Korean texts of the app not
in the dictionary yet would have shown broken on the English screen. `tests/i18n-sweep.test.mjs` looks every quoted
Korean text of the code up in English and fails on a half translation. Step 13's overflow check now looks at the English
screen only (Korean is main's CSS, and Korean fonts differ between machines: "준비 중…" ran 1.2px over at 320px on another
machine). Known: a Free Shot card with no name reads "이름 없는 인물" / "인물" inside the English question.

After the tenth review (GPT wip-en P3 ×2 fixed, one left): every dictionary key with under 4 fixed letters (spaces
aside: "{0}초", "{0} 중…", "{0} 열기", "후보 {0}", "인물 {0}", …) is `tr` only, like the history count: as patterns they
cut the end off server texts not in the dictionary ("서버 응답 제한 시간: 30초" → "…: 30s", "모델 정보 열기" → "Open
모델 정보"). All of them are made by `tr` where they are shown. `tests/i18n-sweep.test.mjs` now also looks up the server
plugin's texts (its folder next to this one) and a few made-up server texts. The work memory says why it did not connect
in English: the server's work could not be read (`connectDraftsOnce`'s notice is `tr`), or the work on screen cannot be
packed (`draftUnreadableNote` is `tr`, its error is looked up with `trMsg` before the "." is cut; the note is shown only,
never saved or compared); draft-work.mjs's five errors are in the dictionary. Left (known): a Free Shot card named word
for word like a whole app sentence ("복사했어요.") is shown translated in the question about cards not in the text.

After the eleventh review (GPT wip-en P3 ×3): two longer keys open at one end are `tr` only too (`TR_ONLY`): "#{0} 메시지{1}"
turned a server text "#3 메시지가 변경됐어요." into "message #3가 변경됐어요.", and "{0} 본문은 그대로예요." translated only the end of
"편집하지 않았어요. 본문은 그대로예요.". Both are made by `tr` in the attach notices. About 100 other keys still start or end with
`{n}`; they are left as patterns on purpose (known limit): telling which of them the screen needs as patterns would risk
turning working English back into Korean, and the worst case is a server text not in the dictionary shown half in English.
If it comes up again, add that key to `TR_ONLY` (check with `tests/i18n-sweep.test.mjs`). The notice after another scene
candidate is `tr` with the AI's title as a value, so a title like "밤 / 닫기 / 정사각형" stays whole (it showed "밤 / Close /
정사각형"); the work memory's own "다른 곳에서 작업이 바뀌었어요." (the server's work changed while a deletion was checked) is in the
dictionary, so the status line reads "Check work saving: The work was changed elsewhere.".

Still Korean: the guide, the console-only error "NAIce Shot 패널 파일을 읽지 못했어요.", server texts the dictionary does
not know, and texts the AI writes (candidate titles, request words).

## Checks

- `node tests/i18n-compare.mjs <main index.js> index.js` — takes `tr`/`trMsg`/`doneText`/`localize` out and compares with main
  statement by statement (`dateLocale()` counts as 'ko-KR', `dateForm(x)` as x). Expected differences: the import, `renderSettings`, `importSettings`, `bindEvents`,
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
  reads in English in both modes; the language box and the server-version line are English. Step 11: the History tab is English
  (count line, ⋯ menu with its message lines, every-chat view, attach picker, delete confirm and notices) while a chat
  named 선택 and a tag 1에 넣기 stay as written; putting in, deleting and [챗샷으로 보내기] send and save the same in both
  languages, and the import's undo label is saved in Korean. Also in step 11: a missing picture's note, ↻ with an
  HTML 502 and an empty JSON 503 reply, and the same-chat [Go to message] toast after the message was edited. Step 12:
  the viewer is English (fixed words, ⋯ menu from the history and from the chat, prompt lines, seed button, the detach
  button); a slow next page that brings nothing still clears "Loading…"; the chat pictures (slide arrows, a missing
  picture's note and its remove button) are English; [글 아래로 옮기기] shows an English toast and saves the same placement
  in both languages. Steps 11 and 12 also check that the selection buttons fit their boxes at both widths and that the
  card's and the viewer's dates read in the screen language (Korean keeps "2026. 11. 14. 오후 7:27").
  Step 12 also makes copying fail in the viewer (seed toast, prompt copy line) and the chat save fail on [이 메시지에서 빼기]
  with the panel closed (English toast, the picture is back). Step 13 (run at 375 only, for 320 and 375px): the extension
  list entry, the message draw button (title, aria-label, the notices of picked / changed meanwhile / cannot be picked) and
  the tag pop-up read in each language; on every tab (Chat Shot, Free Shot, after extraction, Profiles and its form,
  Settings, History, all picked, saving with the picture files held, the viewer), with every folded line open, no button's
  words run outside its box (a text line past its edge by more than 0.5px, or a wider inside unless cut with "…") in either
  language (since the ninth review: English only). Step 14: the confirms for another candidate over a hand-edited final
  prompt and for reloading after a save conflict (both cancelled, nothing changes) and the status line after Chat Shot
  work came back from the server read in each language; so do the notice when the server's work cannot be read on
  connecting and the status line when the edits on screen are too long to compare (both keep the edits); since the eleventh
  review also the notice after another candidate (the AI's title "밤 / 닫기 / 정사각형" as written, with and without the note on a
  required person) and the status line when the work changed elsewhere while a lost deletion was checked (the edit stays).
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
  5. the viewer's "불러오는 중…" text comparison — `say` shows `trMsg(text)`, and the check compares with
     `trMsg('불러오는 중…')` (step 12 fails if the comparison goes back to the Korean words).
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
