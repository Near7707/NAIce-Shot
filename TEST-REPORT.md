# v0.1.112 validation — 2026-11-11 (extension only, server v0.1.25)

- Extension Node suite: **196 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **96 of 96 Chromium browser scripts passed** (4 at a time; `browser-v01106` was slow under load once and passed on its own). New `browser-v01112`, with the history list answered by the test so it can change between two reads (375/1100px, 300 pictures, 120 shown): the newest deleted between the pieces → read again from the start (100+20 twice), the current first 120, 총 299장; one made between the pieces → the new one first, 120 cards; changed during the second read too → that read's first 100 only, 더 보기 still there; unchanged → 100+20 once. With Save-Data the enlarged view fetches nothing ahead (› still works), without it one picture ahead.
- Reverted one at a time (each fails `browser-v01112`): the total comparison, stopping after the second change, the Save-Data check.
- Left as it was: 더 보기 (20 at a time) also continues by offset, so a picture deleted or made in another window in between can make one card repeat or go missing (older than 0.1.111, rare; fixing it means changing the server).
- Not checked: a real SillyTavern in two windows, iPhone Safari, a real Save-Data setting.

---

# v0.1.111 validation — 2026-11-11 (extension only, server v0.1.25)

- Extension Node suite: **196 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **95 of 95 Chromium browser scripts passed** (4 at a time; `browser-v0169` and `browser-v0187` were slow under load once and passed on their own). `browser-v0130` opens the Anlas note before reading its V5 sentence, `browser-v0190` reads it inside the fold, and `browser-v0186`/`v0187` leave the Anlas note out of their "no cost words in folded notes" check (the one exception in DESIGN.md 4-2). New `browser-v01111`: at 320/375/1100px the Anlas note shows its first sentence and a red (theme warning color), boxless **꼭 확인해 주세요 ›**, opens to the full text with **접기 ‹** and closes again, other notes still fold only at 520px or less, and the opener is ≥4.5:1 in all 17 themes; with 300 pictures, 120 shown stay 120 after the enlarged view's panel icon and after another tab (reads of 100 + 20), 240 stay 240 (100 + 100 + 40, no card twice), 30 are read once as before; opened on the 120th card the enlarged view requests the 121st picture's file and not the 122nd, and one more after ›; with a 61%-opaque SillyTavern background the panel is hidden under the guide and comes back with its scroll position and focus; with SillyTavern's `small{opacity:.7}` the guide's small text stays at opacity 1 and topic names are ≥4.5:1 in all 17 themes; Enter on a group focuses ‹ 목차 and Tab reaches 다음 ›, a click keeps focus on the text.
- Reverted one at a time (each fails `browser-v01111`): the all-screens fold CSS, the 꼭 확인해 주세요 label, the warning color, the refresh count, fetching the next picture (caught at the check after ›, since the fetch after a page load also covers the first), hiding the panel, the guide `small` rule, the keyboard focus.
- Not checked: a real SillyTavern with the user's own theme, iPhone Safari, the real speed of › on a phone network.

---

# v0.1.110 validation — 2026-11-10 (extension only, server v0.1.25)

- Extension Node suite: **196 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **94 of 94 Chromium browser scripts passed** (4 at a time). `browser-v01106` now finds the bar above the scrolling text and the contents names by `.ncs-guide-toc-name`. New `browser-v01110`, with SillyTavern's `code` rule added to the page: in all 17 themes guide code has the text's color and font (≥4.5:1), contents names and topic headings are ≥4.5:1, and the guide is opaque; at 320/390/1100px 다음 › stays under the title after scrolling to the end and works, the next group starts at the top, the bar is hidden on the contents and 다음 is gone on the last group; 8 different icons, topic names, step circles and 💡 quotes.
- Reverted one at a time (each fails `browser-v01110`): the code color/font rule, the bar back inside the scrolling text, the glass.css line.
- Not checked: a real SillyTavern with the user's own theme, iPhone Safari.

---

# v0.1.109 validation — 2026-11-10 (extension only, server v0.1.25)

- Extension Node suite: **196 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **93 of 93 Chromium browser scripts passed** (4 at a time; `browser-v0187` was slow under load once and passed on its own). `browser-v0130` and `browser-v0190` check the new 설정-tab V5 sentence. New `browser-v01109`: at the normal text size (320/360/375/1100) 챗샷 and 프리샷 fit their buttons; with every panel font raised to at least 20/24px at 320px, in all 17 themes the pixels of ✕ are the same with 프리샷's text shown or made transparent, and 프리샷 and ✕ each still work.
- Reverted: without `overflow:hidden` on the mode buttons `browser-v01109` fails (프리샷 letters on ✕ in the classic theme at 24px).
- Not checked: a real phone's text-size setting, iPhone Safari, a real SillyTavern, real NovelAI charges.

---

# v0.1.108 validation — 2026-11-10 (extension only, server v0.1.25)

- Extension Node suite: **196 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **92 of 92 Chromium browser scripts passed** (4 at a time). `browser-v0130` and `browser-v0190` check the new 설정-tab V5 sentence. New `browser-v01108`: at the normal text size (320/360/375/1100) the name and guide entry are one line each and nothing overlaps; with every panel font raised to at least 20 or 24px (as a minimum font size does) at 320/360/375 the header does not overflow, 챗샷/프리샷/guide entry/✕ never overlap, and real clicks switch to 프리샷 and back, open and close the guide, and ✕ closes the panel; milk's guide entry is white, other themes keep their accent.
- Reverted one at a time (each fails `browser-v01108`): style.css (프리샷 under ✕ at 320px/20px), only the name area's `flex` line (same), milk.css (blue entry).
- Not checked: a real phone's text-size setting, iPhone Safari, a real SillyTavern.

---

# v0.1.107 validation — 2026-11-09 (extension only, server v0.1.25)

- Extension Node suite: **196 passed, 0 failed** (`guide.test.mjs` now also refuses three `../` GitHub links and keeps the real ones).
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **91 of 91 Chromium browser scripts passed** (4 at a time). `browser-v0167` checked the old rule (subtitle hidden at 340/320px) and now checks that the line stays and the title row still fits. New `browser-v01107` (320, 360, 375px; 그리기, 설정, 이력; 챗샷 and 프리샷): **📖 사용 가이드 ›** is shown under the name, left of 챗샷/프리샷, nothing covers it and the title row does not overflow; a real tap opens the guide and group 2 names what goes to the extraction AI.
- Reverted one at a time: the hiding CSS rule (fails `browser-v01107`: not shown at 320px), the resolved-address check (fails `guide.test.mjs`).
- Not checked: a real 360px Android phone, iPhone Safari, a real SillyTavern.

---

# v0.1.106 validation — 2026-11-09 (extension only, server v0.1.25)

- Extension Node suite: **196 passed, 0 failed** (new `guide.test.mjs`: eight groups in order with privacy second and the summary first; links only to a guide group or the project on GitHub; the reader escapes everything and drops other links; every [button] and quoted notice in `guide.md` is on the real screen; no cost promise).
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **90 of 90 Chromium browser scripts passed** (4 at a time; `browser-v0151` and `browser-v031` failed once under load and passed alone). `browser-v0186` caught the guide link's hover rule outside `@media (hover:hover)`; fixed. New `browser-v01106` (375 and 1100px): a failed read says so and opening again reads again; opened from the history tab it covers the panel, the panel is inert and a tap on the tab row lands on the guide, focus on **✕ 닫기**; 목차 has the eight groups; group 6 → 다음 → 7 starts at the top → 8 has no 다음; ‹ 목차; the summary's link opens group 2 without changing the page address; the PRIVACY.md link opens in a new tab with noopener; ✕ 닫기 returns to the same tab with focus on the entry; reopening starts at 목차; Escape closes the guide but not the panel; closing the panel with the guide open leaves it closed next time.
- Reverted one at a time (each fails `browser-v01106`): the inert panel, forgetting a failed read, Escape closing the guide first, closing it with the panel, keeping in-guide links off the page address, scrolling a new group to the top.
- Not checked: iPhone Safari, a real SillyTavern.

---

# v0.1.105 validation — 2026-11-09 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **89 of 89 Chromium browser scripts passed** (4 at a time; `browser-v0151` failed once under load and passed alone). New `browser-v01105` (375 and 1100px, 챗샷 with two candidates): with **장면 추출** above the strip and **이 요청으로 다시 추출** at the bottom edge or inside the strip, **↓ 생성** hides; just above the strip it shows and does not cover it; the same after the window gets shorter; **장면 추출** in the strip still hides it.
- Reverted: watching only **장면 추출** (the 0.1.104 code) → `browser-v01105` fails (shown over 다시 추출 at the bottom edge).
- Not checked: iPhone Safari, a real SillyTavern.

---

# v0.1.104 validation — 2026-11-09 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **88 of 88 Chromium browser scripts passed** (4 at a time; `browser-v01100` and `browser-v0151` failed once under load and passed alone and again in parallel). New `browser-v01104` (375 and 1100px, 챗샷 and 프리샷): with **장면 추출** mid-screen or just above the bottom strip, **↓ 생성** shows and does not cover it; at the bottom edge, inside the strip and at the generate area it hides; the same after the window gets shorter. `browser-v0187`'s "hidden while 장면 추출 shows" became "never covers 장면 추출".
- Reverted: the 0.1.103 condition (fails: hidden mid-screen); without watching the panel's height (fails: measured before the panel opened, the whole screen counted as the strip).
- Not checked: iPhone Safari (its address bar changes the height while scrolling), a real SillyTavern.

---

# v0.1.103 validation — 2026-11-09 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **87 of 87 Chromium browser scripts passed** (4 at a time). New `browser-v01103` (375 and 1100px): **백업 가져오기**'s question names the emptied scene; cancelled → settings and scene kept and the file field empty; the same file again → asked again, imported, scene emptied, field empty; a bad file → an error and the field empty.
- Reverted one at a time: the question's wording (fails), emptying the file field (fails).
- Not checked: a real NovelAI account, a real SillyTavern (two windows), iPhone Safari's own confirm box and file picker.

---

# v0.1.102 validation — 2026-11-09 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **86 of 86 Chromium browser scripts passed** (4 at a time). `browser-v01100` once saw "연결 다시 확인" before the failed read settled under load; its wait now polls (4 parallel runs pass). New `browser-v01102` (375 and 1100px): while **같은 요청으로 다시 확인** waits, the card's **챗샷으로 보내기**/**프리샷으로 보내기** are off and pressing does not import; the enlarged view's **챗샷으로 보내기** is refused with the notice and the work stays; both are on again after, the picture shows and is remembered; without a chat **챗샷으로 보내기** stays off; opening a chat whose saved work has an import undo while it waits makes an off **↶ 가져오기 취소**, on again after.
- Reverted one at a time: the card lock (fails), the no-chat mark (fails), the new button's lock (fails). The two refusals in the import (on entry, after a mode switch) each cover the other; both reverted together → the enlarged-view case fails. `browser-v01102` fails on the 0.1.101 code.
- Not checked: a real NovelAI account, a real SillyTavern (two windows), iPhone Safari's own confirm box.

---

# v0.1.101 validation — 2026-11-09 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **85 of 85 Chromium browser scripts passed** (4 at a time; `browser-v0193` timed out once under load on its update-notice close button and passed alone). New `browser-v01101` (375 and 1100px): while **같은 요청으로 다시 확인** waits, **그리기창 비우기** is off and pressing it empties nothing; after a clear, **↶ 비우기 취소** is off the same way; the history's **저장 다시 시도** the same; each time the buttons are on again when the answer is in, and the picture shows and is remembered.
- Reverted: turning the buttons off → `browser-v01101` fails. Reverting only the refusal inside the clear itself still passes, as during a generation: the buttons are the guard and the refusal stays as a backup. `browser-v01101` fails on the 0.1.100 code.
- Not checked: a real NovelAI account, a real SillyTavern (two windows), iPhone Safari's own confirm box.

---

# v0.1.100 validation — 2026-11-09 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **84 of 84 Chromium browser scripts passed** (4 at a time). New `browser-v01100` (375 and 1100px; its fake server can hold the answer of **같은 요청으로 다시 확인**): chat B whose first read failed, edited and generating → **다시 시도** reads B's server work, 확인 loads it → the generation ends with no picture on the loaded work and nothing saved ("…결과는 이력에만 남겼어요."); a lost reply, the check waiting, **저장된 작업 모두 지우기** meanwhile → the answer comes, the emptied screen stays empty and nothing is saved back; the same read-in during the check → history only; the ordinary check → the picture shows and is remembered.
- Reverted one at a time: the "still unread / read as it was" part of the work check (the generation and the check cases each fail; the delete-all case still passes because the deletion's `gen` catches it) and the work check in **같은 요청으로 다시 확인** (the delete-all and read-in cases fail). `browser-v01100` fails on the 0.1.99 code.
- Not checked: a real NovelAI account, a real SillyTavern (two windows), iPhone Safari's own confirm box.

---

# v0.1.99 validation — 2026-11-08 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **83 of 83 Chromium browser scripts passed** (4 at a time). New `browser-v0199` (375 and 1100px): generating, deleted elsewhere, the next save refused (409), **서버 작업 다시 불러오기** empties the screen → the generation ends with no picture on screen and nothing saved ("…결과는 이력에만 남겼어요."); A connected and generating → B held → back in A, a connect loads newer work → the old generation ends without touching it; an ordinary edit saved during a generation → the result still shows and is remembered. `browser-v0198` now expects "서버에 저장되지 않았어요" for a refused save.
- Reverted one at a time: the end-of-generation work check (same chat and old chat separately) and the new wording each made a test fail. Reverting only the `gen` part passes: a deletion that resets the same queue entry cannot start during a generation from the panel (deleting refuses while busy, a deletion check locks [이미지 생성]); it stays as a guard. `browser-v0199` fails on the 0.1.98 code.
- Not checked: a real NovelAI account, a real SillyTavern (two windows), iPhone Safari's own confirm box.

---

# v0.1.98 validation — 2026-11-08 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **82 of 82 Chromium browser scripts passed** (4 at a time). New `browser-v0198` (375 and 1100px; its fake server can answer a chat key with a deletion record): saved, deleted elsewhere, the next save refused (409), **서버 작업 다시 불러오기** 확인 → the screen is empty, no second question, nothing written until a new edit (which saves on the record's revision); a connect with an edit on screen and a deletion record → asked, 취소 keeps it and holds with nothing written, the next connect asks again and 확인 empties it; an empty screen → no question; [다시 시도] after a failed read on return → asked the same way; work memory paused from 프리샷, a generation started in chat A, chat B connected while it runs → A's saved work is not written when it ends (connected all along → A still takes the result); a 챗샷 saved before the pause → a chat change in 프리샷 says nothing, an edit made during the pause or refused before it → the dropped-edit notice.
- Fixes reverted one at a time (6): keeping the deletion record in the queue, the deletion check in the load, the question on non-asked loads, the start-connected check of a generation, the saved-copy check of the notice (and the failed-save case) — each made `browser-v0198` fail. `browser-v0198` fails on the 0.1.97 code (the reload saves the edit over the deletion record).
- Not checked: a real NovelAI account, a real SillyTavern (two windows), iPhone Safari's own confirm box.

---

# v0.1.97 validation — 2026-11-08 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **81 of 81 Chromium browser scripts passed** (4 at a time). New `browser-v0197` (375 and 1100px; its fake server can hold a draft save's reply): a 챗샷 saved while connected, then edited while held, work memory connected again in 프리샷 → a chat change writes nothing for the old chat and says the edit was dropped, the new chat loads without a question; connected all along → a chat change in 프리샷 says nothing; a 챗샷 with only an edited final prompt whose read fails on return → kept, an edit meanwhile is not saved, [다시 시도] asks, 취소 keeps it and holds, 확인 later loads; no chat open, 프리샷 held, connect from 챗샷 → back in 프리샷 asked, 취소 keeps it, nothing written; a 챗샷 save waiting for its reply survives 프리샷 and back (no question, no reload) and the next save continues from its revision.
- Fixes reverted one at a time (7): saving the off-screen 챗샷 on a chat change, the dropped-edit notice, the notice's comparison, the compare on a non-connect load (failing each of the three GPT cases), clearing the queue entry on every load — each made `browser-v0197` fail. Reverting only [다시 시도]'s own code still passes, as intended: the protection is in the one load path. `browser-v0197` fails on the 0.1.96 code (the old chat's held edit is written).
- Older script updated: `browser-v0173` measured the history card's buttons right after the first card showed and failed while the list was still redrawing (the same failure on the 0.1.96 code); it now measures once all three buttons are there.
- Not checked: a real NovelAI account, a real SillyTavern, iPhone Safari's own confirm box.

---

# v0.1.96 validation — 2026-11-08 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **80 of 80 Chromium browser scripts passed** (4 at a time). New `browser-v0196` (375 and 1100px; its fake server keeps saved work per chat key): 챗샷 edit held, work memory connected in 프리샷 (nothing saved there), back to 챗샷 → asked, 취소 keeps the edit and holds the tab again, nothing written, 확인 later loads it; the same from 프리샷 (확인 on return loads the saved 프리샷 work); a chat change in 프리샷 drops the old chat's mark (the new chat loads without a question), a chat change in 챗샷 keeps 프리샷's mark (still asked); unregistered-only extraction → asked, the person stays; a place over the save limit → no question, the screen stays, held with the reason when a saved copy exists, the save error when none; [더 보기] in the target list and a valid final JSON with keys in another order → no question, an invalid JSON → asked and kept as typed; presses during a held status check (drawing tab and Settings) → one status check, one question, and a later press asks again.
- Fixes reverted one at a time (9): unregistered in `emptyWork`, the compare on return, the mark on connect, the 프리샷 mark kept on a chat change, keeping the screen when it cannot be compared, `targetShown` out of the comparison, the JSON content comparison, the shared connect run, turning work memory off on a hold — each made `browser-v0196` fail. Dropping the old chat's mark is tidying only (left in place it finds an empty screen and loads without asking).
- Not checked: a real NovelAI account, a real SillyTavern, iPhone Safari's own confirm box.

---

# v0.1.95 validation — 2026-11-08 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **79 of 79 Chromium browser scripts passed** (4 at a time; `browser-v0148` failed once under load and passed alone). New `browser-v0195` (375 and 1100px): the first check failed, the place was edited and the server holds another saved work → [연결 다시 확인] and Settings' 서버·NAI 연결 확인 each ask once; 취소 keeps the edit on screen, shows the paused-memory note and [작업 기억 다시 연결], and writes nothing right away, after the autosave time, or across a chat change and back; pressed again it reads again and asks again, 확인 loads the saved work and autosave works again. Empty screen → no question, the saved work loads; nothing saved → no question, the edit is saved; the same work on both sides → no question; the chat changes while the saved work is being read → read again for the new chat (empty there: no question, connected). A server with 0.1.19's features: the closed update notice stays closed over three V4.5 generations (each makes its own check), a stopped V5 opens it again, and a changed message opens it too.
- Fixes reverted one at a time (7): connecting without reading first, 취소 connecting and saving the screen, no same-work check, no re-decision after a chat change during the read, the paused-memory line in the drawing window, reopening the notice for any server without V5, no V5 flag on check ② — each made `browser-v0195` fail.
- Not checked: a real NovelAI account, a real SillyTavern, iPhone Safari's own confirm box.

---

# v0.1.94 validation — 2026-11-08 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **78 of 78 Chromium browser scripts passed** (4 at a time; `browser-v0151` and `v0176` failed once under load and passed alone, `browser-v0168` was fixed and run again). New `browser-v0194` (375 and 1100px): the first check of the tab failed and the generation's first check fails too → nothing sent for V5 and for V4.5 (the fake server would have taken `/generate`), no mark; pressed again with the server back and one picture not saved → the saving check runs and its notice comes first, 취소 sends nothing. Server 0.1.24 shows the update notice, a V5 press is stopped and shows it again; after switching the fake server to 0.1.25 in the same tab the next V5 generation clears it (also in the settings line).
- Fixes reverted one at a time (2): no stop after a failed first check, the notice refreshed only for an old server — each made `browser-v0194` fail.
- Older scripts updated for the intended change: `browser-v0168` (its quick status no longer fails with the account check, like the real server's `?quick=1`; with it failing, the press now stops before `/generate`).
- Not checked: a real NovelAI account, a real SillyTavern, iPhone Safari's own confirm box.

---

# v0.1.93 validation — 2026-11-08 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **77 of 77 Chromium browser scripts passed** (4 at a time; `browser-v0148` and `v0169` were fixed and run again alone after the full run). New `browser-v0193` (375 and 1100px): one V5 press on a normal connection = one version check (two after a yes, none for V4.5); the server goes back to 0.1.23 during the saving check → nothing sent, no mark; the server goes back or away while "이번만" is open → only the first try, the earlier mark comes back; another check started in the settings tab answering 0.1.25 late does not decide (twice); work memory turning on during the check keeps the unsaved edit and sends it; after a failed first check ① runs, the saving check runs and the request ID is kept at send; the profile removed while the first try waits → stopped, no mark; the final prompt JSON typed again with keys in another order → sent.
- Fixes reverted one at a time (8): loading saved work in the check, reading the shared state instead of the own answer, no check ②, no check ③, ③ without clearing the mark, no check ①, a comparison error counted as "same", plain `JSON.stringify` — each made `browser-v0193` fail. The source-time part (P3-3) has no test of its own; it is covered by building both from `requestParts`.
- Older scripts updated for the intended change: `browser-v0192` (the "이전 요청" question now comes before the server check); `browser-v0148` (its "done" wait also waits for [이미지 생성]: its fake server lacks the saving-check features, so a press asks the server first); `browser-v0169` (answers that quick check apart from its account-check queue).
- Not checked: the moment between the last version answer and the send (a limit), a real NovelAI account, a real SillyTavern, iPhone Safari's own confirm box.

---

# v0.1.92 validation — 2026-11-08 (extension only, server v0.1.25)

- Extension Node suite: **191 passed, 0 failed** (`ui-regression` "edits made in flight" now types once the request has left, as an edit before it stops the press).
- Server Node suite (v0.1.25, unchanged): **42 passed, 0 failed**.
- **76 of 76 Chromium browser scripts passed** (4 at a time). New `browser-v0192` (375 and 1100px): server 0.1.24 with the switch off at 82 % → the update notice and no `/generate` (a banner alone would have let it go), the same with the switch on, V4.5 still sent; a tab left open while the server goes back to 0.1.23 → stopped with the switch on and off; an unreachable server → its own words, nothing sent, no "확인 필요" mark. During the server check and during the saving check: the switch turned off (as a backup import does) or the place edited → nothing sent; the extraction response limit changed → sent as pressed. During the "이번만" first try: the limit changed → asked, the same body again with `confirmUsage`; [서버 작업 다시 불러오기] with another place → not asked, not sent again.
- Fixes reverted one at a time (9): the V5 gate, the version check, the unreachable check, the comparison after the server check (with an earlier unconfirmed request, so no saving check follows), after the saving check, before the question, the switch in the comparison, and the comparison put back to `revision` (the extraction limit then cancels) — each made `browser-v0192` fail. The first comparison revert passed at first (the saving check caught it); a scenario without that check was added. The check after the question is a second guard only (a browser confirm box blocks typing).
- Older scripts updated for the intended change: `browser-v0186`–`v0190` fake server 0.1.25; `browser-v0191` (the old-server words); `browser-v013` keeps its exact old-server answer; `browser-v031` answers `/status` (its catch-all held every request); `browser-v0117` waits for the first press to finish; 25 scripts (`v0155`–`v0180`, `v0164`, `v0167`) whose "done" wait looked only at the progress banner now also wait for [이미지 생성] to come back, as the V5 server check keeps the buttons off without a banner. `tests/fixture.html` also raises an older fake server's version to 0.1.25 (with `usage-confirm` as before), and a catch-all answer with no version becomes 0.1.25 with its update notice hidden (no notice showed for it before); `browser-v0191`/`v0192` keep their answers exact.
- Not checked: a real NovelAI account, a real SillyTavern (a real backup import and server work reload during a generation), iPhone Safari's own confirm box.

---

# v0.1.91 validation — 2026-11-08 (extension + server v0.1.25)

- Extension Node suite: **191 passed, 0 failed** (the cost-guard test adds 1.5 %, −1 % and Infinity as "not checked", and the 0 % words). The UI module test's fake server now lists `usage-confirm` in its status.
- Server Node suite (v0.1.25): **42 passed, 0 failed** (the V5 test now expects 400 `usage-confirm`, adds 1.5 % and −1 % as "not checked", the 0 % words; the status test checks `minClient` 0.1.90).
- **75 of 75 Chromium browser scripts passed** (4 at a time). New `browser-v0191` (375 and 1100px): server 0.1.23 without `usage-confirm`, switch on, 1 % → no request, the server is checked again, the update notice comes back, no "확인 필요" mark; V4.5 is still sent; after the fake server is updated the next V5 press finds it and asks. The first try held while the place is edited → no question, no second send, the edit stays, the message above; the next press asks and sends the new place under the same ID; without an edit the held try and the yes go as one request. 0 % words; 1.5 % and −1 % read as "V5 사용량 확인 못 함". The fake server answers 400 like server 0.1.25 (`browser-v0190` still answers 428 like 0.1.24 and passes).
- Fixes reverted one at a time (8): the old-server block, the second server check, the edit check before the question, whole-number percent, the 0 % verdict words (each made `browser-v0191` fail), and on the server the 400 answer, `minClient` 0.1.90 and whole-number percent (each made the server suite fail). The block first failed by waiting; the check now fails on the notice text. The edit check after the question is a second guard only (a browser confirm box blocks typing) and has no test of its own.
- Older scripts updated for the intended change: `browser-v0190` (0 % words). `tests/fixture.html` adds `usage-confirm` to the fake status of older scripts (their fake servers predate it, and their V5 generation runs with the switch on); `browser-v0191` keeps its lists exact (`window.__ncsExactFeatures`).
- Old UI 0.1.89 + server 0.1.25: checked by reading 0.1.89's code (a 400 answer is treated as "not sent"), not run.
- Not checked: a real NovelAI account (Extra Usage order at 0 %, real `usage.percent` values), a real SillyTavern, iPhone Safari's own confirm box.

---

# v0.1.90 validation — 2026-11-08 (extension + server v0.1.24)

- Extension Node suite: **191 passed, 0 failed** (the cost-guard test now covers the V5 rule: 2 % goes, 1 %/0 %/unusable/unknown ask for one request, extra usage does not count yet).
- Server Node suite (v0.1.24): **42 passed, 0 failed** (the V5 consent test is replaced: 82 % and 2 % sent with the switch off; 1 %, 0 % with and without extra usage, `isNegative`, a wrong-typed and a missing `usage` answer 428 `usage-confirm` with the switch off and on, nothing sent; the same request ID with `confirmUsage:true` is then sent once; Tablet still wants the switch; `usage-confirm` is in the feature list).
- **74 of 74 Chromium browser scripts passed** (4 at a time). New `browser-v0190` (375 and 1100px): 100 % (+100 %) is green with the line in place of the switch and is sent with the switch off without a question; 24-hour time, bold Anlas · V5, "(+N%)" in the number colour, the NovelAI link with V4.5 too; at 1 % the dot is orange and the words and number in the warning colour; the server asks → yes sends the same request (same ID and content) once more with `confirmUsage`, no sends nothing and leaves no "확인 필요" mark, the switch on still asks; 0 % with and without extra usage, unusable and unknown each have their words; 캔디케인 and 딸기우유 numbers are green and plum, 1 % still red; 밀크 keeps its accent colour.
- Fixes reverted one at a time (12): the 2 % rule, `confirmUsage` on the second send, forgetting the request after a no, 24-hour time, the link, the switch not shown for V5, the orange verdict colour, the red-skin number colour, the "(+N%)" colour (each made `browser-v0190` fail), and on the server the one-request check, the switch not answering it, and the switch not asked for V5 with usage (each made the server suite fail). The no-`confirmUsage` revert first failed by a timeout; the test now waits for the panel to settle and fails on the notice.
- Older scripts updated for the intended change: `browser-v0130` (the switch's words), `browser-v0146`, `browser-v0167` (V5 with usage left is sent with the switch off; missing V5 usage is "V5 사용량 확인 못 함", not an account-field problem; link for V4.5), `browser-v0188` (the consent checkbox by the box is checked with a Tablet account). `browser-v0186`–`v0189` fake server now says 0.1.24 with `usage-confirm` (otherwise the update notice covered a button in `v0187`).
- Not checked: a real NovelAI account (especially whether Extra Usage is used before Anlas at 0 %, and the real `usage.percent` rounding), a real SillyTavern, iPhone Safari's own confirm box.

---

# v0.1.89 validation — 2026-11-07 (extension only, server v0.1.23)

- Extension Node suite: **191 passed, 0 failed**.
- Server Node suite (v0.1.23, unchanged): **42 passed, 0 failed**.
- **73 of 73 Chromium browser scripts passed** (4 at a time). New `browser-v0189`: the disk has "off" (read by this window), memory turns "on" and a generation is stopped — deleting a picture then saves the chat and takes it out (375/1100px); after the stop another window saves that "on" and memory moves on — the save stops and "on" stays; this window's own deletion whose messages are saved but whose timed effects are not, with the check afterwards unable to read the chat — a later deletion still stops instead of writing over another window's value; [삭제 결과 다시 확인] pressed twice sends one check, and text typed after it unlocks stays when a second identical answer would arrive; a check started before a successful 작업 전체 삭제 changes nothing when it ends; during 작업 전체 삭제 [챗샷으로 보내기] from the card ⋯ and from the enlarged view is refused with a lock note; ★ held, # fails with 503 — the three cards come back with ☆/# off and "총 3장", and the late ★ answer is dropped; at 320/375/1100px, with 1,200 pictures · 100 waiting (105 MB) · 1 picked and with a short count, the count is above ☆ # ↻ (one row, at the right), the refresh text fits and nothing scrolls sideways.
- Fixes reverted one at a time (8): events setting the base, the base after this window's own save, one check per work, the settled-answer check, the import lock, the last loaded view, the count-line CSS — each made `browser-v0189` fail. The second import-lock check (after switching 챗샷/프리샷) is defensive and not separately tested.
- Older scripts updated for the intended change: `browser-v0187` and `browser-v0188` (B2) now wait for the look at the disk after each event, as SillyTavern's save comes before it. `tests/fixture.html` has `GENERATION_ENDED`/`GENERATION_STOPPED`.
- Not checked: a real SillyTavern (two windows, a real stopped generation and the moment of SillyTavern's save), iPhone Safari or an Android keyboard, real multi-touch, a real NovelAI account.

---

# v0.1.88 validation — 2026-11-07 (extension only, server v0.1.23)

- Extension Node suite: **191 passed, 0 failed** (the timed world info test now checks "the one value last known saved", including another window going back to an older value).
- Server Node suite (v0.1.23, unchanged): **42 passed, 0 failed**.
- **72 of 72 Chromium browser scripts passed** (4 at a time). New `browser-v0188`: the B2 order from the review (off seen, on saved, another window saves off) stops the save and keeps "off"; a deletion held open while switching to chat B keeps the drawing window locked after B's work loads, and what is typed after the deletion stays; a held deletion followed by a successful one unlocks the window and the mode switch and hides the check button; ★ → # held, scope changed to 프리샷, then the old request fails with 503: the 프리샷 # view stays and 전체 삭제 asks about 4 pictures; two touch-saves on [저장] leave no room and do not grow it; a CDP two-finger touch during a drag moves the popup with the first finger and does not zoom, a one-finger tap still zooms; at 320/375/1100px main buttons 38, tabs 36 (375+), small 32, notes 12, headings 16, 프로필 저장 38, 내보내기 36; history tools order and one row, "N장 고름", ☆/# icons, one-line count from 375px; 챗샷/프리샷 same size with a focus ring drawn inside, the dialog has the first focus; the consent checkbox by the note ticks the same setting.
- Fixes reverted one at a time: B2, the lock, the stale check, the second finger, first focus, inside ring, size, icons and the consent checkbox each made `browser-v0188` fail. The touch-room fix has two parts (pointer-only press, cleanup when the form leaves); either alone passes, both reverted fail.
- Older scripts updated for intended changes: `browser-v014`, `v040`, `v0172` (short labels, count in the count line), `v0149` (selection tools share one row), `v0146`, `v0167` (consent checkbox in place of the jump button), `v0186` (# icon).
- One full run had `browser-v0140` and `v0155` fail once under load; both passed alone and three times in parallel since, and the final full run passed.
- Not checked: a real SillyTavern (two windows), iPhone Safari or an Android keyboard, real multi-touch, a real NovelAI account.

---

# v0.1.87 validation — 2026-11-07 (extension only, server v0.1.23)

- Extension Node suite: **191 passed, 0 failed** (+1: timed world info is taken from memory only when the disk value is one this window has had; another window's sticky effect stays as read).
- Server Node suite (v0.1.23, unchanged): **42 passed, 0 failed**.
- **71 of 71 Chromium browser scripts passed** (4 at a time). New `browser-v0187` (375 and 1100px): a sticky effect saved elsewhere stops the chat save and stays on the disk while the picture stays in the chat, and a value this window saw after a reply still lets the save through (B2); with `visualViewport` at 360px, a quick and a slow (0.5s) press on [저장] under the last card saves on the first press and the button does not move under the pointer, the extra room goes after saving, [취소] closes on the first press (B5); a deletion whose reply and check are both lost locks the drawing window ("삭제 결과를 확인할 때까지 작업을 잠갔어요."), checking again while the server is still away keeps it locked, and an answer unlocks it (P3-3); the two saved-data notes are visible at 375px outside every fold and no fold contains 기억해요; at 640×280 and 640×90 the popup's ✕ stays on the screen at the left edge; ★ → # with a 503 keeps the ★ button and card, then # works; the popup has only a ≤24px ✕ with background alpha ≤0.4, a long press without moving does nothing, hold-then-drag moves it without zooming, a short press opens the enlarged view; 프리샷 box ≥90px; one fold for the request field and two in 프리샷; [↓ 생성] hidden while 장면 추출 shows; the recovery buttons never appear during a generation and show as two equal buttons as wide as [이미지 생성]; the status dot colour by state and the numbers in the accent colour; 원문 보관 summary; tag rules in Settings; 팝업 크기 ↔ 위치 처음으로 and 내보내기 ↔ 가져오기 aligned (with SillyTavern's `select{margin-bottom:5px}` added); the empty ★ message spans the grid.
- Eighteen fixes were each reverted once and `browser-v0187` failed every time.
- Older scripts updated for intended changes: `browser-v0186` (popup has only ✕, a tap zooms; # 태그 has no note of its own; three fewer folds). `browser-v0150` waited for the outfit save to reach `saveMetadata` before rebuilding the card — it failed about half the time on 0.1.86 too (a race in the test, not the panel).
- Not checked: a real SillyTavern (two windows with `/wi-set-timed-effect`), iPhone Safari or an Android keyboard (only a simulated `visualViewport`), a long press on a real touch screen, a real NovelAI account.

---

# v0.1.86 validation — 2026-11-07 (extension only, server v0.1.23)

- Extension Node suite: **190 passed, 0 failed** (+2: memory-only chat keys — `lastInContextMessageId`, `chat_id_hash`, `timedWorldInfo` — are taken from memory in the comparison while a real change elsewhere is still seen; `taggedIds` lists only pictures with tags).
- Server Node suite (v0.1.23, unchanged): **42 passed, 0 failed**.
- **70 of 70 Chromium browser scripts passed.** New `browser-v0186` (375 and 1100px, the theme check on all 17 themes at 375px): a picture not in the chat is deleted with no chat read and no "save failed" note, while one on another swipe is still taken out (B1); deleting works when only memory-only keys differ from the disk (B2); the prompt view shows Guidance, CFG Rescale, Sampler and Noise Schedule (B3); the chosen 대상 메시지 row (✓ included) and the highlighted @ row are 4.5:1 or better on every theme (B4); with `visualViewport` shrunk to 360 and then 250px the tag form stays above it (B5); no `:hover` rule outside `@media (hover:hover)` in style.css or any theme; 중간 spacing values and 36px controls (32px switch); the official-preset note under Negative; phone folds open and close, PC shows the full text, and no fold contains costs, privacy, deleting or saved-data words; ☆ on the 선택 line at the right; the # 태그 view (ID filter, ★/# never both, folded help, delete all still asks about every picture, taking the last tags off leaves the view); the tag popup (no frame or text, top centre of the chat, a tap does nothing, drag and per-device place, kept inside the screen, 🔍 opens the enlarged view, sizes 25/50% and 위치 처음으로).
- Sixteen fixes were each reverted once and `browser-v0186` (or the chat unit test) failed every time.
- Older scripts updated for intended changes: `browser-v0140` (☆ first on the card), `browser-v0184` (☆ place checked in v0186; the popup has no [넣기] or "끄기"), `browser-v0168` (privacy answer first in the account list), `browser-smoke` (the 더보기 link has no border by design), `browser-v0155` and `browser-v062` (text behind a fold).
- Not checked: a real SillyTavern (the memory-only keys come from reading SillyTavern `06bde93`: `setInContextMessages`, `getChatIdHash`, world info timed effects), an iPhone or Android keyboard (only a simulated `visualViewport`), touch dragging on a real phone, a real NovelAI account.

---

# v0.1.84 validation — 2026-11-06 (server v0.1.22)

- Extension Node suite: **188 passed, 0 failed** (+9: `image-marks.test.mjs` — tags split and limited, marks kept by picture ID (deleting one never moves another's tag or star), the 3,000-picture ceiling, broken saved marks dropped, owner = card or group (프리샷 none), Korean anywhere / Latin whole words, matches only from the same character, random pick that avoids the last picture).
- Server Node suite (v0.1.22): **39 passed, 0 failed** (+2: delete all reports a lost and a refused request in `cleared` (the lost one also `unconfirmed`, kept in its marker and in the status check) and the picture alone in `deleted`, and the cleared ID still refuses a retry; `POST /history` with `ids` pages only those pictures in the range, keeps `unfilteredCount`, refuses bad lists, and GET ignores `ids`). Each fails with its fix reverted.
- **69 of 69 Chromium browser scripts passed.** New `browser-v0184` (375 and 1100px): ☆ → ★ on the date line, ★ only through the ID filter ("즐겨찾기 1장", delete all still asks about 3), tags from ⋯ with Enter, too many tags refused, 프리샷 cards cannot take tags; deleting names the favorites and forgets marks only for pictures the server deleted (a failed one keeps its star; delete all forgets that chat's marks only); request records counted apart, an unknown one keeps 확인 필요 and its check says it may have been charged; the popup is off by default, on per chat, not for greetings, user messages or while the panel is open, random among the same character's pictures (never another character's), stays until closed, view-only for another chat's picture, [넣기] opens the list with the reply chosen and inserts, [이 채팅에서 팝업 끄기], a picture that does not load gives way, "rain" does not match "train", a chat switch closes it; backups leave marks out and importing keeps them; an older server disables ★ only. Twelve fixes were each reverted once and the script failed every time.
- Older scripts updated for the intended layout change: `browser-v0140` (card buttons now start with ☆; ⋯ menu has 태그 편집) and `browser-v0150` (⋯ menu order). `tests/fixture.html` can now send `CHARACTER_MESSAGE_RENDERED` with arguments.
- Not checked: a real SillyTavern (the render event in group chats and after a stopped stream), iPhone Safari, a phone Hangul keyboard (Enter while composing is ignored by design), a real NovelAI account.

---

# v0.1.81 validation — 2026-11-05

- Extension Node suite: **176 passed, 0 failed** (+1: 168 letters + three `Leo (Main)` chips = 201 seen and refused; brackets, `]` and double spaces keep the name's length; fails with the old rule). One older check now expects only a blank name to become "이름 없음".
- **68 of 68 Chromium browser scripts passed** (`browser-v0112` timed out once while all ran in parallel and passed alone).
- Not checked: a real SillyTavern, iPhone Safari, a phone Hangul keyboard.

---

# v0.1.80 validation — 2026-11-05

- Extension Node suite: **175 passed, 0 failed** (+1: a 70-letter chip name counts in full, 216 seen for three).
- Server Node suite (v0.1.19): **31 passed, 0 failed** (a 150-letter chip name counts as seen; fails with the old 60-letter rule).
- **68 of 68 Chromium browser scripts passed.** New `browser-v0180`: two picked Leos and an id-less "Leo / reading" give two people (not three) and nobody gets the action; the third 70-letter chip is refused in the 200-letter request; link Visitor → Kai, make Robin, undo: the other candidate keeps Robin and drops Kai. Each check was seen to fail with its fix reverted.
- Not checked: a real SillyTavern, iPhone Safari, a phone Hangul keyboard.

---

# v0.1.79 validation — 2026-11-05

- Extension Node suite: **174 passed, 0 failed** (+2: same-name picked people with a chat connection; pictures already there are saved and checked again).
- **67 of 67 Chromium browser scripts passed.** New `browser-v0179`: a long error note stays under 150px, scrolls inside and closes with ×, and the field under it takes taps again; `@Q` that becomes a 120-letter chip stops extraction with no call; a list pick that would not fit puts no chip in; a backup brings back 프리샷's own prompt and Guidance; link undo leaves no card in the other candidate; switching chats during a save still reads the first chat; an unchecked move shows no "옮겼어요"; deleting with a silently failed chat save clears the result and says so. Each fix was reverted once to see its check fail.
- Not checked: a real SillyTavern (chat-read route), iPhone Safari, a phone Hangul keyboard.

---

# v0.1.78 validation — 2026-11-05

- Extension Node suite: **172 passed, 0 failed** (no unit changes).
- **66 of 66 Chromium browser scripts passed.** New `browser-v0178` at 375 and 1100px: no seed in the banner; the content does not move when a notice appears; the profile form reopens on 직접 입력; 챗샷/프리샷 get their own preset back after switching; tapping the chosen mode goes to 그리기; a 프리샷 picture is deleted even when the loaded history does not hold it; a profile made after extraction is in the other candidates with no warning. The candidate, delete and preset checks were confirmed to fail with the fix reverted. Updated for intended changes: `browser-smoke`, `v031`, `v0150`, `v0152`, `v0153`, `v0160`.
- Not checked: the unpainted 챗샷 toggle (3) could not be reproduced here — a fill is now kept while the toggle is disabled, which is the likely cause; the blue frame (8) on a real iPhone; a real SillyTavern.

---

# v0.1.77 validation — 2026-11-05

- Extension Node suite: **172 passed, 0 failed** (+13): `save-verify.test.mjs` (saved / swallowed save / threw but stored / mixed / neither / changed target (text, reroll, date, missing) / failed or odd read-back / partial restore with later changes kept / place / detach / without reader), length ceilings and empty chip names in `mentions.test.mjs`, ambiguous same-name detail in `matching.test.mjs`, visible length in `free-scene.test.mjs`. The save-check cases were broken on purpose once to see them fail.
- Server Node suite (v0.1.18): **31 passed, 0 failed**: too-long situation text refused before NovelAI (no call), 4,000 visible with chips accepted, stored ceiling, a non-text value, and saved work with 180,000-character situation text and 9,000-character request (twice, with undo).
- **65 of 65 Chromium browser scripts passed** (one script, `browser-v0151`, timed out once while all ran in parallel and passed alone). New `browser-v0177` at 375 and 1100px: a 95-character chip name stays inside the field with no sideways scroll; list pick for `@Le|o` leaves no `o`; copy keeps the selected trailing newline; typing stops at 4,000 / 200 seen characters; Hangul composition trims only the part composed now and cuts nothing when it cannot find it (extraction blocked with a message); over-long situation text makes no extraction call; a silent failed save is undone with a message; an unreadable chat is reported as unchecked and kept. Fixed assertions were checked by reverting the fix.
- Not checked: a real SillyTavern (the chat-read route and its answer shape are assumed), a phone Hangul keyboard, iPhone Safari, Firefox.

---

# v0.1.76 validation — 2026-11-05

- Extension Node suite: **159 passed, 0 failed**. `mentions.test.mjs` rewritten for chips: `@[Name](ref:ID)` read back by the full id (also after a rename; a new profile with the same name does not take an old chip; an empty id is broken), two same-name profiles stay two chips, typed names (longest label, up to two particles, Korean and spaced names, `@Leo가방` stops, an email is no reference), old `@Name#short` and malformed `@Ada#a` / `@Ada#a3` / `@Ada#` marks are broken (`@Leo #1 fan` is not one), typed names confirmed into chips with a note, text for the AI, plain names, leftovers stripped, the short look for the list (hair, eyes, usual outfit; the id is never in the suggestions). New in `matching.test.mjs`: a profile picked with `@` beats the chat's name connection, an id that does not carry the written name is not trusted, two picked people with one name both stay (checked to fail without the fix). New in `inline-images.test.mjs`: a failed chat save restores the message and its swipe for one and for several pictures, and a swipe without `extra` stays without (checked to fail without the fix).
- Server Node suite: server unchanged.
- **64 of 64 Chromium browser scripts passed.** `browser-v0175` is replaced by `browser-v0176` at 375 and 1100px: `@` opens the list under the field (names, aliases, a short look, no id, on screen); typing narrows it; Enter during Hangul composition picks nothing; Enter and a click put chips in; Escape closes only the list; Backspace removes a chip in one press (nothing left behind); Ctrl+Z takes a just-picked chip back out; the arrow keys keep the 8th item in view; an email is no reference; chips reach the AI as name + roster id with a REQUIRED block and never reach the final prompt; a required person the AI leaves out is added ticked with a note and a left-over pose from an earlier scene is cleared (fails without the fix); typed names are confirmed into chips with a note; unknown names, stuck particles, old and malformed marks (typed and from saved work), a chip whose profile is gone and same names stop before anything is sent; a broken chip is dashed and turns back when the profile returns; the history snapshot keeps `@[Name](ref:ID)`, sending it back restores the chips and a deleted profile comes back as a broken chip that stops the extraction; copy between the two fields keeps ids, text from another app is a typed name; a line break pasted into the request becomes a space; the request stays within 200; picked twins stay apart in 프리샷 and 챗샷; a person added only to another candidate is named when that candidate is chosen (fails without the fix). The other 63 scripts read the two fields through `value`.
- Visual check: the chip field with chips, a broken chip and the list with two same-name profiles at 375 and 1100px (local screenshots only, none added to the repository).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern with a real extraction AI, a real phone keyboard (Hangul input and caret behaviour around a chip), iPhone Safari and Firefox (the field is a contenteditable box; only Chromium was run).

# v0.1.75 validation — 2026-11-05

- Extension Node suite: **157 passed, 0 failed**. New `mentions.test.mjs`: short ids (4 characters, longer only where two would share them; a full id like "leo" wins over "leon-two"); typed names with Korean and spaced names and up to two particles (`@Leo에게는`, `@미라한테도`, `@Kai Lee가`); `@미라클`, `@Leo가방`, `@Leon`, `@Leo에게는요` stop; `a@b.com` and `me@Leo` are not references; the id form links after a rename, a new "Leo" does not take an old reference, `@Leo#zz99` (gone), `@Leo#a3f2가방` (stuck letters) and an old short id now shared by two all stop; confirming typed names; the text for the AI has no `@` or `#id` and the required list has each person once; leftover marks are stripped; the autocomplete query and suggestions.
- Server Node suite: server unchanged.
- **64 of 64 Chromium browser scripts passed.** New `browser-v0175` at 375 and 1100px: `@` opens the list under the field (names, aliases, short ids, on screen); typing narrows it; Enter during Hangul composition picks nothing; Enter and a click put `@Leo#leo` / `@Mira#mira` in; Escape closes only the list; `a@` opens nothing. With "@Leo#leo랑 @Mira#mira, 레오는 빼고 …" and an AI reply with only Mira, Leo is added ticked with the empty-pose notice; the AI's situation has no `@` or `#id`, carries "Leo (roster id leo)" and a REQUIRED PEOPLE block; the final prompt has no `@`. `@레오랑 @카이가` becomes `@Leo#leo랑 @Kai Lee#kai가` with a notice. `@미라클`, `@Leo가방`, `@Leo#zz99`, `@Leo#leo가방` stop with nothing sent. With two "Leo" profiles a typed `@Leo` stops, the list shows #leo and #leon, and `@Leo#leon` ticks that Leo. On V4.5, Leo twice + 5 others (6) extracts, 7 stops with the limit notice. 챗샷: `@카` → `@Kai Lee#kai`, Kai (not in the message) is required in the prompt and added ticked.
- Visual check: the list under the situation box at 375 and 1100px (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern with a real extraction AI, a real phone keyboard (Hangul input), iPhone Safari.

# v0.1.74 validation — 2026-11-05

- Extension Node suite: **151 passed, 0 failed** (new: a chosen place is stored and the default stores nothing; the group above comes first; putting a picture in again elsewhere moves it, 기본 위치 leaves an own place alone; placeMessageImage sets and clears the place on the message and its swipe copy and refuses a changed message).
- Server Node suite: server unchanged.
- **63 of 63 Chromium browser scripts passed.** New `browser-v0174` at 375 and 1100px: 채팅 속 그림 folded with " · 글 위 · 넘겨보기 · 보통 · 그리기 아이콘 끔" in its title, the global default 글 위, "이 채팅의 기본 위치" and the per-picture note; the 본문에 넣기 box offers 기본 위치 (글 위) (chosen) / 글 위 / 글 아래; a picture put in 글 아래 sits after the text with the notice "#1 메시지 글 아래에 …", a second with the default sits before it; 이 채팅의 기본 위치 = 아래 moves only the default one (one group of two, title "글 아래(이 채팅)"); from the enlarged view (2 / 2, the picture above first) ⋯ shows 글 위로 옮기기 and 기본 위치로 되돌리기 but not 글 아래로, and both work; a picture without its own place offers only the move; putting an attached picture in again with 글 아래 moves it without adding it twice. Older scripts open the fold (v0123, v0125, v0147, v015, v0159, v0163, v0171, v0172, v019), expect the new default (v015, v0147) and count only message rows as chosen (v040, v0151, v0153, v0154).
- Visual check: the 본문에 넣기 box with the place row and the folded settings at 375 and 1100px (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, iPhone Safari.

# v0.1.73 validation — 2026-11-05

- Extension Node suite: **150 passed, 0 failed**.
- Server Node suite: server unchanged.
- **62 of 62 Chromium browser scripts passed.** New `browser-v0173` at 375 and 1100px: 추출 AI shows the connection, the refresh button and the cost note; the response limit, temperature and JSON switch are folded and the "○○로 추출" line is hidden; the 세부 설정 title shows the values and follows changes to temperature, JSON and the limit; a lost connection is still told outside the fold. Saving an edited Leo keeps Leo before Mira in the settings and in the list; a new Kai goes last. History card buttons read ⋯ | 저장 | 삭제 with no overlap; the ⋯ menu opens from ⋯'s left edge and the 저장 menu from 저장, both on screen. `browser-v0171` now checks 넘겨보기 as one picture at a time with no frame background and no swipe strip (‹ › to 2 / 3 and 3 / 3, a tap opens 2 / 3), and 격자 as one 120px row height with no grey cells and the pictures' shapes kept; `browser-v0172` checks there is no swipe marking and that ‹ › runs no chat-wide search. Older scripts follow the fold (v0132, v0141, v0149, v0157, v017) and the new card order (v0138, v0140).
- Visual check: 넘겨보기 and 격자 with 400×600, 600×400 and 500×500 pictures, the history card and 추출 AI at 375 and 1100px (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern with the user's custom theme, iPhone Safari.

# v0.1.72 validation — 2026-11-05

- Extension Node suite: **150 passed, 0 failed** (new: several pictures into one message with one save; a duplicate stays once; going over 20 changes nothing and saves nothing).
- Server Node suite: server unchanged.
- **61 of 61 Chromium browser scripts passed.** New `browser-v0172` at 375 and 1100px: no message dropdowns; 본문에 넣기 under the result opens the list newest first (#2, #1, #0) with #2 marked 만든 메시지 and chosen, "#2에 넣기", the box and button inside the screen; Escape closes only the list; choosing #1 attaches there and the notice says "#1 메시지에 그림을 넣었어요"; opened again, #1 is chosen and marked 이미 넣음. 선택 본문에 넣기 (2) says "선택된 2장을 넣어요", puts both into #1 with one chat save. The enlarged view's ⋯ → 본문에 넣기 closes the view and opens the list over the panel. A picture whose message was removed: nothing chosen, the button disabled. Every element of a 넘겨보기 strip carries `data-swipe-ignore` and touch events on the count, bar, strip and picture never reach a page-level detector; a missing picture's note and 빼기 are marked too. Sliding the strip in eight steps runs no chat-wide search. With the date hidden on #0 only, #0's icon is in the button row and #1's after its date; showing #0's date moves its icon. Older scripts (smoke, v015, v017, v031, v040, v070, v0125, v0140, v0151, v0153, v0154, v0162–v0165, v0170, v0171) now use the list.
- Visual check: the list at 375 and 1100px (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern (its real swipe gestures), iPhone Safari.

# v0.1.71 validation — 2026-11-05

- Extension Node suite: **149 passed, 0 failed**.
- Server Node suite: server unchanged.
- **60 of 60 Chromium browser scripts passed.** New `browser-v0171`: at 320, 360 and 375px ⋯, ‹ n/m › and 저장 · 삭제 do not overlap, idle or while the next picture is held (with "불러오는 중…" showing in the note spot). At 375 and 1100px: 클린 PNG is clickable with 프롬프트 보기 open and its failure note sits on the higher layer; a failed delete (HTTP 500) is told inside the view, which stays open; Leo's look edit does not follow a switch to Mira. Three pictures in one message: 넘겨보기 by default (1 / 3, ‹ disabled, 보통 = 320px frame, `data-swipe-ignore` on the strip), › and a scroll move to 2 / 3 and 3 / 3, a tap opens the view on 2 / 3; 격자 shows 2 per row at 375 and 3 at 1100 with 120px tiles for 작게 and uncropped pictures; 세로 + 크게 caps at 480px; the choices are saved. The storage note has the nine agreed lines. The message icon sits right after the date, visible without a menu, only once, and opens the panel; with dates hidden it moves to the end of the button row; off removes it.
- Visual check: 넘겨보기 and 격자 at 375 and 1100px with the icon on the date line (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern (real date line and swipe gestures), iPhone Safari.

# v0.1.70 validation — 2026-11-05

- Extension Node suite: **149 passed, 0 failed**.
- Server Node suite: server unchanged.
- **59 of 59 Chromium browser scripts passed.** New `browser-v0170` at 375 and 1100px: top row under 46px with 맞춤/원본, the zoom centred (±2px) and the window button; ‹ n/m › centred in row 1 (±2px) with ⋯ left and 저장·삭제 right, no overlap; the date folded away; 프롬프트 보기 leaves the picture area unchanged and stays above row 1, date and time only, seed and prompt copy on one line, the prompt starting with 모델; ⋯ starts with the four history actions and ends with 메시지로 가기, opens upward inside the screen; 프리샷으로 보내기 closes the view and shows 그리기 in 프리샷; two pictures in one message move 1/2 → 2/2, row 2 has 이 메시지에서 빼기, ⋯ ends with 이력에서 보기, which opens the history tab with the ring on that picture's card; the window button opens the panel; the wardrobe name box opens within 24px under its button; a look edit reaches the final prompt without changing the profile and resets; 직접 입력 is pressed for a new profile; ↻ is disabled at once. Older scripts updated: `v031`, `v0140`, `v0148`, `v0151`, `v0163`, `v0164`, `v0165` (viewer), `v016`, `v060`, `v0112` (direct input first), `v0159` (editable look).
- Visual check: enlarged view at 375, 360 and 1100px, ⋯ menu and 프롬프트 보기 open (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, iPhone Safari.

# v0.1.69 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed**.
- Server Node suite (v0.1.17): **30 passed, 0 failed**. New: HTTP 503, no connection, timeout, an HTML reply and a `null` reply in the account check are all `nai-account` (502, or 504 for the timeout) on both `/generate` and `/status`, nothing is sent, and none says "실제 생성·차감"; with consent on, an image timeout keeps its own note.
- **58 of 58 Chromium browser scripts passed.** New `browser-v0169` (fails on 0.1.68 code) at 375 and 1100px: a held ↻ check, then a 428 refusal → a new check starts (inactive, or failing) and wins; releasing the old "free" answer changes nothing and the consent note stays; a later successful check clears it; an account-check timeout just before sending drops the verdict and the notice says nothing was sent.
- Publication diffs (both repositories) screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, iPhone Safari.

# v0.1.68 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed** (cost guard: inactive Tablet, grace-period Scroll, missing or text tier).
- Server Node suite (v0.1.16): **29 passed, 0 failed**. New: the state comes first for every tier; null or text tier is refused as missing; a failed account check answers 502 `nai-account` and sends nothing.
- **57 of 57 Chromium browser scripts passed.** New `browser-v0168` (fails on 0.1.67 code) at 375 and 1100px: line 1 and the details open/close the box, ↻ does not; on V5 the link sits under the V5 row at the right edge and is under 150px wide, and a click beside it opens nothing; a 428 refusal after the account turned inactive removes "무료 조건", keeps the consent note and the re-check shows "구독 비활성"; a 502 `nai-account` shows "계정 확인 실패" with the note kept until a successful re-check clears it; the switch on 설정/이력/프로필, pressing it stays on that tab; the field list after a failed check is marked "이전 조회" and cannot be copied, help text present; three presets keep their order after [변경 저장].
- Publication diffs (both repositories) screened for credentials, personal paths and private character/lore data; none found.
- User check on 0.1.67: an Opus V4.5 image generated with Anlas consent off in a live SillyTavern. Not exercised here: a live SillyTavern, iPhone Safari.

# v0.1.67 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed** (cost guard rewritten for every account case: V4.5 free without the old perk and without usage, grace period first, inactive, missing/odd fields, V5 0% / isNegative / missing usage, lower tiers, unchecked).
- Server Node suite (v0.1.15): **28 passed, 0 failed**. New: an active Opus V4.5 without the old perk is **sent with consent off**; active missing or odd, inactive, grace period (also with inactive), Tablet, Scroll, V5, V5 isNegative and V5 without usage are refused with 428 before NovelAI and sent once consent is on; V4.5 without usage is sent; a failed account check with consent off sends nothing; `/status` forwards active, grace period and usage as they are, missing as null.
- **56 of 56 Chromium browser scripts passed.** New `browser-v0167` at 375 and 1100px: active Opus V4.5 → "Opus · V4.5 무료 조건에 해당해요 ✓", Anlas · V5 · time line, generated with consent off; details unfold; V5 verdict and consent block (nothing sent); V5 0%, can't use, missing usage (V4.5 still free); active missing (settings line too), inactive, grace period, Tablet without a V5 line; a failed check turns the verdict into "계정 확인 실패"; switch right after the title (≤20px), about title + subtitle height, subtitle visible, ✕ at the far right, 그리기 only, waits with the work fields; at 340 and 320px the subtitle gives way and nothing overlaps. `browser-v0146`, `v0155`, `v0165` updated; the other scripts' account fixture is now an active Opus with V5 usage.
- Visual check: title row and account box at 375 and 1100px (local screenshots only).
- Publication diffs (both repositories) screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, a real NovelAI generation with consent off, iPhone Safari.

# v0.1.66 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed**.
- Server Node suite (v0.1.14): **26 passed, 0 failed**. New: `/status?shape=1` lists names and kinds (nested, arrays, unsafe key names hidden) and no value from the reply; plain `/status` sends no list; `account-shape` advertised.
- **55 of 55 Chromium browser scripts passed.** New `browser-v0166` at 375 and 1100px: the box is hidden until [서버·NAI 연결 확인], which asks with `shape=1`; folded list without values, [목록 복사], no sideways scroll; the drawing tab's ↻ never asks for the names and the cost line still reads the account; an older server → "0.1.14 이상으로 업데이트" with copy disabled.
- Publication diffs (both repositories) screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, a real NovelAI account reply, iPhone Safari.

# v0.1.65 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed**.
- Server Node suite: server unchanged.
- **54 of 54 Chromium browser scripts passed.** New `browser-v0165` (fails on 0.1.64 code for UI-064-01), at 375 and 1100px: a slow gallery move locks [메시지로 가기], the view is closed, the result picture opens with [메시지로 가기] and [삭제] usable, and the old move finishing later does not lock them again; a touch tap followed by Escape or ✕ → the first click on the chat picture within 0.7 s opens it and the old timer does not close it; the tap path still swallows its own click and closes; the 챗샷/프리샷 bar is 42px (95px before) with 32px buttons on one line and stays at the top while scrolling.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, iPhone Safari (touch timing simulated with dispatched events).

# v0.1.64 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed**.
- Server Node suite: server unchanged.
- **53 of 53 Chromium browser scripts passed.** New `browser-v0164` (fails on 0.1.63 code): with the next picture's decoding held back, the shown picture, save link and seed stay, 삭제 is locked and sends nothing, then all switch together and 삭제 takes the picture on screen (375/1100px); moving between portrait, landscape and square pictures served uncached shows no empty or mis-sized frame; a touch tap on empty space → its click lands on the viewer, is swallowed, and the viewer closes, three times at 375 and 1100px, and a tap with no click still closes; "연결된 메시지 없음 ⓘ" with its reason for a picture without a message, none over chat pictures, 메시지로 가기 otherwise; 프리샷 card-removal notice stays on 그리기 after moving to 설정 during extraction; 챗샷 English warning stays after 30 s while a plain success folds. `browser-v0148` now waits for each move (a press while the next picture loads is skipped).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, a real extraction model, iPhone Safari (real touch timing was simulated with dispatched events).

# v0.1.63 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed**.
- Server Node suite: server unchanged.
- **52 of 52 Chromium browser scripts passed** (`browser-v031` once timed out on a tap made while the next picture was still loading; it now waits for the picture, and a tap on empty space closes just after its own click so the click never lands on the chat underneath). New `browser-v0163` (fake clock): the incomplete-reply warning stays after 30 s, a plain success folds, nothing but the progress box while working, an error from the drawing tab does not keep the settings notice open; enlarged view shows the date only with [메시지로 가기] in the prompt row, light menu notes, and moving never shows an unfitted picture; chat pictures have no ⋯, store date and seed, older ones look them up, and [삭제] asks and takes the picture out of the message. `browser-v0162` now waits for the fold and runs at 375 and 1100px.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, iPhone Safari.

# v0.1.62 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed**.
- Server Node suite: server unchanged.
- **51 of 51 Chromium browser scripts passed.** New `browser-v0162` at 375px: no 스텝 left in the panel, "28 Steps"; [↓ 생성] leaves the generate button within 40px of the bottom edge; the notice is hidden while the progress box shows and back afterwards; a short success notice folds, an error stays; enlarged view with one top row and one tools row (under 62px each, no sideways overflow), upward save menu; "채팅에서 이 그림 빼기".
- Visual check: drawing tab after [↓ 생성] and the enlarged view at 375px (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, iPhone Safari (the user's own check came from iPhone).

# v0.1.61 validation — 2026-11-04

- Extension Node suite: **149 passed, 0 failed** (migration parts run separately; AI clothes recorded as automatic).
- Server Node suite: server unchanged.
- **50 of 50 Chromium browser scripts passed.** New `browser-v0161` (fails on 0.1.60 code for UI-060-01): a history card saved with only the pin keeps "old coat" after a text without clothes; AI clothes go when the next text has none; cancelling [직접 만들기] then saving the edited profile links no card and no chat binding.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern or extraction model, iPhone Safari.

# v0.1.60 validation — 2026-11-04

- Extension Node suite: **148 passed, 0 failed** (old temporary clothes count as chosen).
- Server Node suite: server unchanged.
- **49 of 49 Chromium browser scripts passed** (`browser-v0150` and `browser-v0158` updated for the new PNG wording and the shared-alias rule: a card already in the work decides). New `browser-v0160`: a cancelled switch from [프로필로 저장] keeps the edited profile (id, name, typed look); an unsaved description is kept; an old history temp keeps "apron" after a text without clothes; a shared alias with a valid AI id stays a temporary person with its look and a notice; an empty chosen outfit survives [프로필로 저장] when the AI returns clothes; PNG guide three lines, the last in its own colour.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern or extraction model, iPhone Safari.

# v0.1.59 validation — 2026-11-04

- Extension Node suite: **147 passed, 0 failed**. New `free-people.test.mjs`: the text decides who stays (pinned unticked, unpinned removed even if unticked), questions only when something is lost, wide name check only keeps cards, ticks follow the AI, pinned temp keeps look and subject, automatic clothes reset, typed clothes kept, inputs untouched (for the undo), migration pins old cards once, 📌 and clothes state survive the shared draft format.
- Server Node suite: server unchanged (`draft-work.mjs` identical; card fields round-trip).
- **48 of 48 Chromium browser scripts passed.** New `browser-v0159`: 프리샷 question lists removed and unticked cards, [취소] sends no request, [↶ 추출 취소] brings cards and typed looks back, a failed extraction keeps work and undo, a re-named pinned card is ticked again and keeps its look, "X는 없다" unticks without a question; clothes: AI → automatic, typed kept, 자동으로 되돌리기 vs 기본 복장 입기 vs 비우기, no 프리샷 lock; [프로필 편집] opens the one editor (cancel saves nothing, unsaved typing kept when another profile is opened); [↓ 생성] at 375px; the message button opens 챗샷 from 프리샷.
- Visual check: 프리샷 card with 📌 and [↓ 생성] at 320/375px (local screenshots only).
- AI responses are fixed test replies; how well a real model follows "visible only" was not measured.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern or extraction model, iPhone Safari.

# v0.1.58 validation — 2026-11-04

- Extension Node suite: **141 passed, 0 failed** (new look-word filter test: "blue hair tied back" dropped, hair ribbon kept).
- Server Node suite: server unchanged.
- **47 of 47 Chromium browser scripts passed** (`browser-v040` timed out once on the first full run and passed on rerun). New `browser-v0158` at 375/1100px: a stale profile form keeps the card's [프로필 업데이트]; the card's undo disappears after a form save and does not wipe a later change; request outfit "blue hair tied back" is not clothing, "red coat with blue hair tied back" → "red coat" matched by alias, no wrong lock note; 프리샷 name beats a wrong roster id, the same alias on two profiles gives a temporary person with its look, a changed situation text discards the old result; empty wardrobe hint; PNG guide one sentence per line; full-width PC page with fields and buttons ending together.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern or extraction model, iPhone Safari.

# v0.1.57 validation — 2026-11-04

- Extension Node suite: **140 passed, 0 failed**.
- Server Node suite: **25 passed** (server code unchanged; README only).
- **46 of 46 Chromium browser scripts passed.** New `browser-v0157` at 320/375/1100px: preset buttons follow the selection and [변경 저장] asks first (취소 keeps the saved values), two-per-row fields, retention wording and fold, 640px PC column with fields and buttons ending together, "이 복장을" row held while saving, folded lock help, fixed look update with confirm and undo, [모두 선택] ↔ [모두 해제], "↻ 새로고침", folded history notes with the storage paths, PNG warning open; chat message menus take the milk theme's colours.
- Visual check: phone and PC person card, settings and history (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, iPhone Safari.

# v0.1.56 validation — 2026-11-04

- Extension Node suite: **140 passed, 0 failed** (`moments.test.mjs` walks the whole moment schema: every object property required, no extra properties).
- Server Node suite: **25 passed** (server unchanged).
- **45 of 45 Chromium browser scripts passed.** New `browser-v0156` (fails on 0.1.55 code): "혼자" leaves a kept temporary person unticked and out of the prompt (drawn again without such a request); requested clothing matched by name after identity matching and cleaned of names and hair words, with the dropped part reported; a request changed mid-extraction drops the old result; the applied line follows its candidate. `browser-v0155` now gives the requested clothing in the scene, as the prompt asks.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a real extraction model, OpenAI strict mode against the live API, iPhone Safari.

# v0.1.55 validation — 2026-11-04

- Extension Node suite: **140 passed, 0 failed** (`moments.test.mjs` checks the 추가 요청 rules: pick, change, both, "alone", fixed appearance, requested clothing).
- Server Node suite: **25 passed** (server unchanged).
- **44 of 44 Chromium browser scripts passed.** New `browser-v0155` at 375 and 1100px: one [장면 추출] (no 글로 채우기), 추출 표현 in both modes, 추가 요청 above 장면 추출 then under the candidates with [이 요청으로 다시 추출], applied/ignored line, requested clothing over a lock, clear slot by the 2 · 장면 편집 heading with per-mode undo, 프리샷 request free of chat messages and chat clothes, the 챗샷/프리샷 switch staying in view, 인물 추가 emphasis and + 인물 칸 추가, and the question before generating without a preset (취소 sends nothing). Older scripts updated for the moved clear button, the single extract button, wording, and the fixture answering the preset question.
- Visual check: phone and PC drawing tab in both modes (local screenshots only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a real extraction model's handling of 추가 요청, a live SillyTavern, iPhone Safari.

# v0.1.54 validation — 2026-11-04

- Extension Node suite: **140 passed, 0 failed** (`message-jump.test.mjs`: same words at the old number, elsewhere and in another message's swipe are not the source; the dated message is chosen over a nearer twin; moved; found through `swipe_info` after a swipe).
- Server Node suite: **25 passed** (server unchanged).
- **43 of 43 Chromium browser scripts passed.** New `browser-v0154` (fails on 0.1.53 code): the three twin cases grey the line and 자동 넣기 attaches nothing; the real message is still found after moving and swiping. `browser-v0151` now restores the drawn message with its own send time in the other-chat case.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: a live SillyTavern, iPhone Safari.

# v0.1.53 validation — 2026-11-04

- Extension Node suite: **140 passed, 0 failed** (`message-jump.test.mjs` now covers: edited only for the same send time, a slid-in message is not the source, no send time is never guessed, edited and moved).
- Server Node suite: **25 passed** (server unchanged).
- **42 of 42 Chromium browser scripts passed.** New `browser-v0153` (fails on 0.1.52 code): another group, refused character selection, a reply being written and a missing chat each stop before anything is opened; a slid-in message is not taken for the source and 자동 넣기 asks; one-off Guidance edited during an outfit save is kept; a temporary person linked to a profile already in the scene merges and undo keeps that profile; 700 messages at 10 per press still reach #0. `browser-v0118` adds other-chat isolation and the group-member refusal.
- SillyTavern 1.19.0 staging source (`selectCharacterById`, `openCharacterChat`, `openGroupChat`, `openGroupById`, `getContext`) read to shape the checks; not run against a live SillyTavern here.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.

# v0.1.52 validation — 2026-11-04

- Extension Node suite: **140 passed, 0 failed**.
- Server Node suite: **25 passed** (server unchanged).
- **41 of 41 Chromium browser scripts passed.** New `browser-v0152`: final prompt edited while an outfit save waits survives the save (fails on 0.1.51 code); a same-name temporary person becomes the profile when made or linked from the card-character box, and link undo restores it; same-name profiles get the box and link through this chat's binding. `browser-v0118` updated: linking the card character to one of several same-name profiles now succeeds through the chat link and still adds no alias.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari.

# v0.1.51 validation — 2026-11-03

- Extension Node suite: **140 passed, 0 failed** (new `message-jump.test.mjs`: made message found unchanged, on another swipe, moved after deletions, edited, missing, hidden; one or two targets).
- Server Node suite: **25 passed** (server unchanged).
- **40 of 40 Chromium browser scripts passed.** New `browser-v0151` at 375 and 1100px: one line (made only / made and attached), two lines when they differ, the viewer's choice menu, panel and viewer close and the message lights up, edited note, deleted greys the line, 프리샷 reason, another chat asks then opens and lands on the message, 본문에 넣기 (자동) asks instead of using the last message. `browser-v040`, `browser-v070` now pick the message explicitly for seeded images without a source.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern chat switching (`openCharacterChat`, `selectCharacterById`, `openGroupChat`), loading older messages with `#show_more_messages`, group chats, iPhone Safari.

# v0.1.50 validation — 2026-11-03

- Extension Node suite: **138 passed, 0 failed** (skins-lint now also checks itself with upper-case property names).
- Server Node suite: **25 passed** (server unchanged).
- **39 of 39 Chromium browser scripts passed.** New `browser-v0150`: failed outfit save keeps a later edit and rolls back only its own value; card rebuild keeps the saving hold; typing shows 자동으로 되돌리기; long preset name keeps 덮어쓰기 on one line at 320/375/1100px; card character without a profile gets the make/link box; ⋯ order; 클린 PNG notes; PNG guide in history; one focus ring. `browser-v0149` now blends opacity and checks hovered menu items: before the fix 7 of 17 themes failed (3.1–3.6:1), after it all pass. Older scripts updated for 클린 PNG names and the new ⋯ order.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari.

# v0.1.49 validation — 2026-11-03

- Extension Node suite: **137 passed, 0 failed, 0 skipped** (new `skins-lint`: themes set colours/decoration only; verified it fails when a layout rule is added).
- Server Node suite: **25 passed** (server unchanged).
- **38 of 38 Chromium browser scripts passed.** New `browser-v0149`: text contrast on all 17 themes across drawing, history, save and ⋯ menus, settings (advanced open) and profiles; opaque menus; at 320/375/1100px for three themes no sideways scroll, key buttons on one line and not spilling, one main action per group, history tools arrangement, small refresh, 560px action groups on PC, 비우기 ⇄ 비우기 취소. The spill check was confirmed to fail on an intermediate layout (선택 저장 overflowing at 375px). Updated older scripts for the new buttons (clear slot, 새 프리셋으로 저장 / 덮어쓰기, 고급 fold, outfit groups, card-only saving hold).
- Visual check: phone (375px) and PC (1100px) screenshots of the drawing source buttons, outfit groups, history top, settings presets and advanced fold, profile buttons (local only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari.

# v0.1.48 validation — 2026-11-03

136 Node tests passed (no skips); 37 Chromium browser scripts passed, including the new 1100/375/320px import/clothing/gallery regressions. Detailed evidence, updated expectations and untested environments are recorded once in [docs/REVIEW.md](docs/REVIEW.md#ui-v0148--서버-v0113-유지--2026-11-03). Server v0.1.13 is unchanged.

# v0.1.47 validation — 2026-11-03

- Extension Node suite: **136 passed, 0 failed, 0 skipped** against server v0.1.13.
- Server Node suite: **25 passed**. New: interleaved chat/free history filtered before pagination; chat counts, storage totals, page boundaries and summaries exclude free shots; full history and free-only queries still work.
- **36 of 36 Chromium browser scripts passed.** New `browser-v0147` at 1100/375/320px: two-column mobile cards; second-tap and scroll dismissal for save/more/selection menus; viewer save toggle; deletion cancellation; profile/wardrobe no autofocus; collapsed wardrobe and removal confirmation; tab-scoped notices; touch message-count ±; per-chat placement without changing the global default; four history scopes, paging and persistent scope across drawing-mode changes; disabled attach reasons; PNG explanation at save controls; all 17 skins' active mode fill and horizontal fit.
- Existing browser expectations updated for deliberate behavior changes: no preset/profile autofocus, explicit history scopes, collapsed wardrobe editors, compact generation title, corrected supported-size/Anlas notes, persistent attach action and new empty/legacy-server wording. History mocks now filter by owner; chat-switch tests use chat images, not free images.
- Manually inspected mock mobile screenshots with Korean fonts: history two columns, save menu placement/caret, compact generation and Anlas controls.
- Destructive-action audit: profile/wardrobe/preset/image/work deletes have confirmations; reversible clear retains undo; detaching preserves originals. Publication files and diff checked for secrets/private paths/private chat or screenshot data; none found beyond an intentional old fake-path privacy test.
- Not exercised: real SillyTavern, iPhone Safari/WebKit, actual extraction/NovelAI calls, real lower-tier accounts or cross-device races. See `docs/REVIEW.md` for linked findings and limits.

# v0.1.46 validation — 2026-11-03

- Extension Node suite: **136 passed, 0 failed, 0 skipped**. `costGuard` wording per account: Opus V4.5 free, Opus V5 may, Tablet/Scroll uses (V4.5 and V5), unknown account, over the free limits.
- Server Node suite: **24 passed**. New: Tablet and Scroll (tier 1, 2) blocked without consent with `anlas-consent`/428 and no NovelAI call, sent with consent, balance fields forwarded; NovelAI failures classified only from the reply (401 key; 402 with an Anlas note vs 402 "Payment required" → rejected; 403 permission vs empty; 403 "Insufficient permissions" is not an Anlas error; 429; 5xx; 400), note trimmed to 120 characters with tokens removed; the handler passes the code and never the key.
- **35 of 35 Chromium browser scripts passed.** New `browser-v0146` at 1100/375px: Tablet balance and cost line, consent block not sending and the button only showing the switch, consent on → image → balance re-checked with a difference since the last check, Settings showing the same check, a failed balance check after a finished image, NovelAI Anlas error re-checking the balance without the consent button, the server's consent refusal for an unchecked account, Opus V5 link and Opus V4.5 free line, width fit. `browser-v0130` follows the new switch description.
- Not exercised: real Tablet/Scroll accounts, NovelAI's actual error bodies for shortage/permission, free-trial API tokens, real SillyTavern, iPhone Safari.

# v0.1.45 validation — 2026-11-03

- Extension Node suite: **136 passed, 0 failed, 0 skipped**. Queue tests: nothing leaves while paused and held edits keep their data; resume sends them; resume terminates even when the state callback touches entries (a hang found and fixed during this work).
- Server Node suite: **22 passed** (server unchanged apart from the shared `draft-work.mjs` copy).
- **34 of 34 Chromium browser scripts passed.** `browser-v0141` adds: delete-all failing with an unsaved edit → notice, edit saved afterwards; chat-history deletion failing → same; refresh keeps the edit; a chat with images but no saved work → history deletion empties the window and nothing is saved. Both new checks fail on the v0.1.44 code. `browser-v014` checks the new separate-save wording.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, two real browsers, iPhone Safari.

# v0.1.44 validation — 2026-11-03

- Extension Node suite: **135 passed, 0 failed, 0 skipped**. The queue test now checks that after a deletion nothing is saved until the marker is read, and the next save uses the marker's revision.
- Server Node suite: **22 passed**. The deletion test now checks markers: no work to read, a save prepared before the deletion (`expectedRevision:null` or an old revision) gets 409, a save on the marker revision succeeds, delete-all counts only real work and gives every marker a new revision, a chat that never had work still accepts a first save, deleting single images keeps the work.
- **34 of 34 Chromium browser scripts passed.** `browser-v0141`'s mock follows the server's markers and enforces revisions, so the saves after deletion prove the extension reads the marker first. `browser-v040` (real server handlers) ran 3 more times after its wait fix.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, two real browsers at once, iPhone Safari.

# v0.1.43 validation — 2026-11-03

- Extension Node suite: **135 passed, 0 failed, 0 skipped**. New DraftQueue test: `quiesce` waits for a save in flight and drops unsent ones; a late write reply or late read after `forget` changes nothing.
- Server Node suite: **22 passed** (server unchanged apart from the shared `draft-work.mjs` copy).
- **34 of 34 Chromium browser scripts passed.** `browser-v0141` adds the two reported cases: (1) first save held before the server processes it → delete-all waits, order is save → delete, nothing returns after refresh; (2) save processed but its reply held → after deletion the next edit saves without a conflict; (3) 프리샷 work, switch to 챗샷, delete 프리샷 history from the all-chats view, switch back → empty, and no work is saved back. Both new checks fail on the 0.1.42 code (checked by running them against it). `browser-v014` checks the ZIP-off note and the shorter notice.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari, two real windows saving at once.

# v0.1.42 validation — 2026-11-03

- Extension Node suite: **134 passed, 0 failed, 0 skipped** (server repository alongside). New: deleted work starts a fresh file and an unchanged screen is not saved back.
- Server Node suite: **22 passed**. New: 프리샷 snapshots keep `mode`/`freeText` (≤4000 chars) and other snapshots never gain one; saved work deleted per chat, all at once and with a chat's whole history, while deleting single images keeps it.
- **34 of 34 Chromium browser scripts passed.** Updated scripts open ⋯ / 저장 ▾ through `tests/menu-helper.mjs`. `browser-v0140`: card buttons 저장/삭제/⋯, no seed or seconds on the card, ⋯ contents, save menu fold/outside click. `browser-v014`: one image has no ZIP option, PC default is separate files, ZIP toggle keeps the menu open and is remembered, separate saves skip a missing file. `browser-v0141`: viewer menu with two choices only, Escape/outside click/button fold it, shared and original downloads with no extra warning, restored notice with target number, delete-all and chat-history deletion forgetting work without re-saving. `browser-v031`: seed copy button, date without seconds. `browser-v0125` ran 5 more times without failing.
- Hover check with SillyTavern's own `a:hover{filter:brightness(1.25)}` added to the fixture: no filter on either save choice on all 17 skins. Phone-width screenshots of the save menu on classic/cream/matcha (local QA only).
- Publication diffs screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari multi-file downloads (ZIP is the touch default for that reason), real NovelAI calls.

# v0.1.41 validation — 2026-11-03

- Extension Node suite: **133 passed, 0 failed, 0 skipped**. Draft tests cover source-text/raw/payload omission, explicit raw consent, candidates/direct-input people/unfinished final JSON/one undo round trips, reference semantics for restored finals, queued saves during in-flight writes and failed-save retry.
- Server Node suite: **20 passed**. New endpoint tests exercise user/chat isolation, hashed filenames, revision-conflict refusal, raw consent/reasoning removal and preservation of previous work after a failed atomic replacement. No NAI request is needed for drafts.
- **34 of 34 Chromium browser scripts passed** across this update. New `browser-v0141` at 1100/375px covers chat/free separation, refresh restore without AI, persistent clear undo, changed-source reminder, save failure/retry, concurrent-writer refusal and explicit reload, stale delayed reads, cancellation while switching into a previously loaded chat, one-off settings after failure/success and completion after a chat change, raw-consent cancellation, and original/shared/cancel/session download-warning paths. Existing download regressions explicitly approve the original warning and still compare PNG bytes/ZIP contents. Real server-handler fixtures include the new draft route.
- Visual check: metadata confirmation at phone width; narrow action layout uses a full row for the shared choice at 360px and below. Screenshots and Korean fonts are local QA only.
- Saving is debounced; no polling, whole-chat-file saves or extra AI calls were added. Background/unload writes are best effort and unsaved work can be lost if the browser is forcibly terminated before saving completes.
- Publication files/diffs screened for credentials, personal paths and private character/lore data. No new private data identified. Historical metadata was not rewritten; external copies and nonlocal branches/releases were not audited.
- Not exercised: real SillyTavern, real extraction/NovelAI accounts, iPhone Safari background termination or native popovers.

# v0.1.40 validation — 2026-11-03

- Extension Node suite: **130 passed, 0 failed, 0 skipped**, with the server repository cloned alongside it. New regressions check message-scoped removal, preservation of another message's same image/native media/text, swipe cleanup, stale targets and save-failure rollback.
- **33 of 33 browser scripts passed** in headless Chromium. The new `browser-v0140` runs at 1100, 375 and 320px and checks compact history/attachment menus, viewport bounds, Escape/focus, horizontal preset actions, raw response and viewer prompt copying, blocked-copy feedback, per-message removal and stale-source refusal. Existing browser flows were adapted to the new menus and terminology.
- The existing `browser-v040` and `browser-v070` exercise the real server handlers with mocked NovelAI transport. No paid requests were sent.
- Visual inspection: history actions, enlarged prompt view and attachment menu at phone width. Korean fonts used for local screenshots are test-only and are not shipped.
- Menus use delegated events and create no polling loop. Opening a prompt from an attachment reads paged history on demand; no history request is made merely by scrolling chat.
- Current files and the publication diff were screened for credential patterns, personal paths, private character/lore data and accidentally included runtime files. No new private data was identified. Existing historical author metadata was not rewritten.
- Not exercised: real SillyTavern, iPhone Safari, actual extraction AI or NovelAI calls. Native popover behavior on iOS still needs device confirmation.

# v0.1.39 validation — 2026-11-03

- Extension Node suite **128 passed**, including the new `free-scene.test.mjs`:
  - prompt rules for one instant, selected people and no invented traits
  - saved appearances never sent to the text AI
  - empty and too-long text refused
  - roster people never carry an appearance, unknown ids become temporary people, and bad fields fall back
- **32 of 32 browser scripts passed**, including the new `browser-v0139` at 1280px and 375px:
  - clearing keeps the common prompt; undo survives a tab switch and restores people, candidate, wish, target, final edit, one-off options and preview together; an edit ends it; clearing is disabled while extracting
  - 프리샷 has its own work and the other mode's work is kept
  - 글로 채우기 with a selected profile and a described stranger, with no doubling and an English retry
  - no chat clothes; works after the chat closes and goes to its own history bucket with no attach controls
  - clearing is per mode, and history restore brings the text back
  - 프리샷으로 보내기 loads one moment, and the old 프리샷 work comes back with 되돌리기
- Checked 프리샷 and the undo bar by eye at 375px (cream).
- Not exercised: a real text model for 글로 채우기, real SillyTavern, iPhone Safari.

# v0.1.38 validation — 2026-11-03

- Extension Node suite **126 passed**. **31 of 31 browser scripts passed**, including the new `browser-v0138` at 1280px and 375px:
  - an empty scene asks first, and cancelling sends nothing
  - the box is folded with its scope and summary, edits the settings values (steps capped at 28), and the settings tab follows
  - a new preset is saved from the box; the overwrite button names its target; "수정됨" shows and clears after overwriting
  - history options show "이력 설정 · 이번 생성에만", edits stay one-off and are used, and it returns to normal after success or via 기본 설정으로 돌아가기
  - 설정을 프리셋으로 refuses empty or duplicate names and saves options with a new seed, the recovered common Positive and the image's Negative, with no scene or people, leaving current settings and the chosen preset unchanged
- Checked the box by eye at 375px in both modes.

# v0.1.37 validation — 2026-11-03

- Extension Node suite **126 passed**. **30 of 30 browser scripts passed**, including the new `browser-v0137` at 1280px and 375px:
  - from the no-profile list with extracted fields
  - the name stays out of the prompt, and the subject counts (2boys)
  - kept after generating and restored from history
  - re-extraction without them asks for a check; found again, fresh fields and the appearance kept
  - candidates carry them with a check
  - a blank add follows its name and can be removed
  - 프로필로 저장 fills the form and swaps the slot in every candidate without doubling
  - works with no profiles
- `browser-v060` now expects the add row to show only 임시 인물 추가 when there are no profiles.
- Checked the card by eye at 375px.

# v0.1.36 validation — 2026-11-03

- Extension Node suite **126 passed**; **29 of 29 browser scripts passed**. `browser-v0133` now checks:
  - the new names and the chat-default note
  - pressing "✓ 채팅 기본 복장" clears the default while keeping the lock
  - "정하지 않음" clears too
  - unlocking with no default removes the entry, and locking alone sets no default
  - the button turns off as soon as 이번 그림 복장 is edited

# v0.1.35 validation — 2026-11-03

- Extension Node suite **126 passed** (new: English-only rule in the prompt; Korean found in action/location but not in titles or names).
- **29 of 29 browser scripts passed**:
  - `browser-v0132` now covers a Korean reply followed by an English one: the retry asks for English, keeps structured output, and the English fields are used. A reply still Korean after the retry is used with a note.
  - `browser-v0133` checks the badges, the lit picker and the pressed "✓ 이 채팅 기본 옷" button, which turns off for a one-off outfit.
- Checked the card by eye at 375px in classic and cream; badges use the tab colours, which are contrast-tested per theme.

# v0.1.34 validation — 2026-11-03

- Extension Node suite **125 passed**; **29 of 29 browser scripts passed**. `browser-v0133` also checks the "nothing saved yet" line and the "✓ 이 채팅에 저장된 옷: hoodie · 평생 박제" confirmation.
- Read SillyTavern's code for chat metadata: `chatMetadata` is the open chat's metadata and `saveMetadata` saves the chat file, so 당분간 이 복장 and 평생 박제 are stored per chat. A real restart was not exercised here.

# v0.1.33 validation — 2026-11-03

- Extension Node suite **125 passed, 0 failed, 0 skipped** with server 0.1.8 present; the shared core matches apart from the version line. Server suite 18 passed.
- **29 of 29 browser scripts passed**, including the new `browser-v0133` at 1280px and 375px:
  - wardrobe edited in the profile form, default outfit untouched
  - 당분간 이 복장 saves for the chat and applies to this image over an AI-found outfit
  - 평생 박제 keeps it through re-extraction
  - 옷장에서 꺼내 입기 changes only this image
  - 옷장으로 refuses empty and repeated names, updates the profile and the open form, and survives a later form save
  - editing a wardrobe item does not rewrite the chat's saved clothes
  - 되돌리기 and 이 옷 당분간 입기 work
  - 프롬프트 보기 is built only when opened and copies
  - a backup round-trip keeps the wardrobe
- Checked the card and the profile wardrobe by eye at 375px (cream).
- Not exercised: real SillyTavern, iPhone Safari.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.

# v0.1.32 validation — 2026-11-03

- Extension Node suite **124 passed, 0 failed, 0 skipped**, including prompt checks for the beat rules, brief-moment priority and placement rules, cut-off detection (complete, fenced, cut, reasoning prefix, no JSON), and "one unreadable candidate in a complete reply is not cut off".
- **28 of 28 browser scripts passed**, including the new `browser-v0132`:
  - a new user starts at 8192 / one message
  - an existing user keeps 4096 / 3 until "권장값 적용", which leaves the message count alone
  - temperature is sent only with a separate connection and only when set; never on the main connection; structured output still sent
  - a cut-off reply shows two candidates without "마지막 순간" and with the 불완전 + main-preset hint
  - a reply cut before any candidate fails with the same hint
  - a complete two-candidate reply is not flagged
  - a hand-picked left position survives re-extraction on every candidate
- Read SillyTavern's current connection-manager code: the per-request payload is applied after the profile's preset, so the temperature reaches the request. Whether a model honours it was not tested.
- Not exercised: a real extraction model, real SillyTavern, iPhone Safari.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.

# v0.1.31 validation — 2026-11-03

- Extension Node suite **123 passed, 0 failed, 0 skipped**, including seven new `moments.test.mjs` cases: three moments with their own actions, the final one as default; older single-scene replies; a reply cut off mid-way keeps complete candidates; out-of-range default and extra moments; a requested moment not found; one unreadable candidate dropped; prompt rules and the wished moment passed as quoted data.
- **27 of 27 browser scripts passed**, including the new `browser-v0131` at 1280px and 375px: three candidates with the last checked; switching changes people, actions, place and missing-profile hints with no extra AI call; edits kept per candidate; a hand-edited final prompt asks before switching; the generation snapshot carries every candidate while the image prompt holds only the chosen one; history restore brings candidates back; the wished moment reaches the prompt, reports "not found" and clears on target change; a single scene hides the picker. `browser-v0120` now reads the extraction schema under `moments`.
- Checked the picker by eye at 375px in classic and cream.
- Not exercised: a real extraction model. Whether moments mix less depends on the model; UPDATE-CHECKLIST has three invented messages for a before/after check. Real SillyTavern and iPhone Safari were not exercised either.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.

# v0.1.30 validation — 2026-11-02

- Extension Node suite **116 passed, 0 failed, 0 skipped** (one fewer because the removed 코코아 theme no longer has a contrast test).
- **26 of 26 browser scripts passed**, including the new `browser-v0130` (saved 1536×1024 / 40 steps come back as 832×1216 / 28; no custom size entry; steps max 28; both notes shown) and an updated `browser-v0123` (icon sized like a font icon; crowded row wraps so no button is cut). `browser-skins` checks the swatch-only card, that it comes first in Settings, and that a saved 코코아 falls back to the default.
- Rebuilt a message from SillyTavern's own message template and stylesheet with a shared community chat theme applied, at a narrow width: before, the first buttons of the row were cut off; after, the row wraps and every button shows, with our icon level with the others.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- Not exercised: a real SillyTavern instance, iPhone Safari, a live NovelAI generation.

# v0.1.29 validation — 2026-11-02

- Extension Node suite **117 passed, 0 failed, 0 skipped**; the contrast check caught two 커피우유 colors on the darker latte body (warning text and checkbox outline), both darkened.
- **25 of 25 browser scripts passed**. `browser-v0123` adds a chat theme that clears every message-button background and clips a narrow row: the icon is still drawn at 20×20, the button is last in the extra menu and inside the row. The same check fails on 0.1.28 ("icon still drawn").
- Also loaded a real community chat theme's custom CSS into the test page: the icon was drawn.
- Checked the four redesigned themes by eye at 375px.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- Not exercised: a real SillyTavern instance and its mobile … menu, iPhone Safari.

# v0.1.28 validation — 2026-11-01

- Extension Node suite **117 passed, 0 failed, 0 skipped**, including contrast and no-layout-change checks for the two new themes and the redesigned 크리스마스.
- **25 of 25 browser scripts passed** in headless Chromium. `browser-skins` now checks the folded theme list (closed by default, current name in the title, opens on press) and all eighteen themes at 1280px and 375px; `browser-v060` confirms identical layout geometry on the three Christmas themes; `browser-v019` checks field readability on them under hostile input themes.
- Checked by eye at 375px: the garland and string lights stay below the header subtitle.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- Not exercised: a real SillyTavern instance, iPhone Safari.

# v0.1.27 validation — 2026-10-31

- Extension Node suite: **115 passed, 0 failed, 0 skipped**, with server 0.1.7 available. Existing skin checks include Christmas text/control contrast, scoped selectors and unchanged layout rules. All fifteen previous skin files remain byte-identical to v0.1.26.
- Two Chromium scripts passed: `browser-skins` and `browser-v016`. The skin test now covers sixteen choices, Christmas switching/saving, its berry-red viewer accent, mobile fit for every tab of every skin, one active skin stylesheet and deleted-file fallback. The second script verifies the unchanged page backdrop and existing profile-form/generation behavior.
- Inspected actual desktop (1100px) and mobile (390px) panel screenshots using an external test-only Korean font, including scene and Settings screens. No fonts, screenshots or browser runtime dependencies were added to the extension. Header decoration is static and hidden on viewports at or below 360px to avoid crowding the title.
- Pre-edit privacy scan covered 86 tracked files and 24 reachable commits. The only path match was a synthetic error fixture; the previously disclosed historical author email remains. New changes were checked separately. Remote issues, release attachments and external copies were outside this scan.
- Real SillyTavern, iPhone Safari and live AI providers were not exercised. No server changes.

# v0.1.26 validation — 2026-10-30

- Reproduced on the unchanged v0.1.25 parent: after scrolling the target list to 250px, collapse/reopen returned it to about 1px. The new browser regression passes after fixing.
- Extension Node suite: **114 passed, 0 failed, 0 skipped**, with server 0.1.7 available.
- Five targeted Chromium scripts passed: `browser-v0126`, `browser-v0125`, `browser-v0123`, `browser-v0122`, and `browser-v0121`.
- New 1280px/375px coverage checks collapse/reopen (including rapid toggling), retained loaded rows, tab round trips, close/Escape/reopen, message edits/new messages, browsing after selection, one-time direct-message target reveal, explicit latest/chat reset and horizontal fit.
- Pre-edit privacy scan covered 85 tracked files and 23 reachable commits. Only the known synthetic error path and previously disclosed historical author email matched; new changes were checked separately. Remote issues, release attachments and external copies were outside this scan.
- Scroll positions are page-session state. Real SillyTavern, iPhone Safari and live AI providers were not exercised. No server changes.

# v0.1.25 validation — 2026-10-29

- Extension Node suite: **114 passed, 0 failed, 0 skipped**, with server 0.1.7 available. Five new tests cover hidden/system classification, selected hidden context and original indices, immutable chat/main-chat input, default exclusion, user/reference filters, source validity, hidden attachment/removal and retained media/hide flags. The attachment case failed before fixing.
- Seven targeted Chromium scripts passed: `browser-v0125`, `browser-v0123`, `browser-v0122`, `browser-v0121`, `browser-v0120`, `browser-v0118`, and `browser-smoke`.
- New browser coverage at 1280px and 375px checks hidden character/user icons and labels, typed system notices excluded, manual extraction only, correct hidden reference range, no later text/reasoning sent, unchanged chat/hide fields, generation target guard, hidden-target generation/attachment, saved hide state, compact history fingerprints, default visible latest, live hide/unhide DOM updates, disabling icons and mobile fit.
- Updated old system-notice fixtures to include `extra.type`, matching SillyTavern's system-message constructor; untyped `is_system` alone also describes hidden RP. Checked the upstream hide function, system-message metadata and CSS at SillyTavern release `06bde939fb1e9c4c8d8641d810f0a916b5bce127`.
- Pre-edit privacy scan: 82 tracked files and 22 reachable commits; the path match was a synthetic error-test fixture, and the previously disclosed personal author email remains in old history. New changes were checked separately. Remote issues/release attachments/external copies were not inspected; history was not rewritten.
- Real SillyTavern, real group sessions, iPhone Safari and live AI providers were not exercised. The known system-type/UI metadata distinguishes notices; legacy records lacking that metadata remain available as hidden text for explicit selection. Server core is unchanged except the extension's version line.

# v0.1.24 validation — 2026-10-29

- Extension Node suite **109 passed, 0 failed, 0 skipped**; **23 of 23 browser scripts passed** in headless Chromium.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- `browser-v0122` (1280px and 375px): chevron visible when closed; opens by keyboard; latest row first; list scrolls inside its own box; grows by ten until all 55 eligible messages are reachable and the more button hides; choosing the oldest message closes the picker and extraction uses it; on reopen the chosen row is checked and in view; new messages keep the choice; latest mode follows the newest; a 5,000-message chat builds only ten rows; chat switch resets; empty chat; names escaped; no horizontal overflow.
- Checked by eye at 390px in classic and cream.
- Not exercised: a real SillyTavern instance, iPhone Safari.

# v0.1.23 validation — 2026-10-29

- Extension Node suite **109 passed, 0 failed, 0 skipped**.
- **23 of 23 browser scripts passed** in headless Chromium, including the new `browser-v0123`: brand icon without gradient ids in drawer, menu and panel header; message button off by default and absent after re-renders; when on, present on AI and user messages only (not system or whitespace-only), inside the extra message menu, added to new messages without duplicates; click and Enter open the scene tab with that target and no automatic extraction; during an extraction the target is kept with the "진행 중인 작업이 끝난 뒤" notice; turning it off removes all buttons and they stay gone; saved "on" adds them at startup; 미니멀 shows the icon without a filter.
- Long-chat measurement (1,000 messages, 300 streamed text updates, two runs each): median frame 16.7 ms and p95 ≈ 17–18 ms both off and on. Full chat rebuild: about 63–96 ms off and 66–80 ms on, after switching the button to a shared background image (an inline vector icon per message had cost about 200 ms extra).
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- Not exercised: a real SillyTavern instance (its own message-menu behavior and mobile … menu), iPhone Safari.

# v0.1.22 validation — 2026-10-29

- Extension Node suite: **109 passed, 0 failed, 0 skipped**, with server 0.1.7 available.
- Four Chromium scripts passed: `browser-v0122`, `browser-v0121`, `browser-v0118`, and `browser-smoke`.
- New browser coverage at 1280px and 375px opens the actual HTML picker by keyboard, scrolls its ordinary content, reaches every eligible message across six pages, extracts the oldest selected message, preserves selection during page browsing/new messages, returns to latest mode, resets across chats and handles empty chats. A synthetic 5,000-message chat still renders at most ten preview buttons. This is a DOM-size check, not a performance benchmark.
- Checked desktop/mobile screenshots for layout; the test Chromium lacks Korean fonts, so Korean glyph appearance was not verified visually. Real SillyTavern, the user's native-menu failure, iPhone Safari and live AI providers were not exercised. The replacement removes reliance on the native menu rather than claiming its underlying browser issue was reproduced.
- Pre-publication privacy scan covered 80 current tracked files and 19 reachable commits before edits, and the final diff afterward. No new private data was found. The previously disclosed personal author email remains in old history; history was not rewritten. Remote issues, release attachments and external copies were outside this scan.

# v0.1.21 validation — 2026-10-29

- Extension Node suite: **109 passed, 0 failed, 0 skipped**, with server 0.1.7 available; shared core differs only in its version line.
- Five Chromium scripts passed: `browser-v0121`, `browser-v0118`, `browser-v0119`, `browser-v0120`, and `browser-smoke`.
- New browser coverage at 1280px and 375px checks newest-first targets, original message IDs/current selection, unchanged conversation order, four independent tab positions, delayed history refresh/images, explicit history reload, viewer return, close/Escape/reopen, rapid tab switches and horizontal fit. The order assertion failed on the unchanged parent before fixing.
- Scroll memory lasts for the current page session; reloading the browser page resets it. Real SillyTavern, iPhone Safari and live AI providers were not exercised.

# v0.1.20 validation — 2026-10-27

- Before fixing, reproduced three regressions in `matching.test.mjs`: an existing saved alias left in `unregistered`, a manually added person absent from the next roster, and name separator/Korean-spacing mismatches.
- Extension Node suite **109 passed, 0 failed, 0 skipped**, including six new scene-extraction tests for unresolved visual fields, later attachment, exact matching across the full local profile directory, ambiguity, linked card names and no invented pose/presence. The shared core still matches server 0.1.7 except its version line.
- Seven targeted Chromium browser scripts passed: `browser-v0120`, `browser-v0117`, `browser-v0118`, `browser-v0119`, `browser-v060`, `browser-v031`, and `browser-smoke`. The new script covers three visible people, a different card/chat, legacy name-only responses, late manual addition/re-extraction, creating and linking profiles with cached actions/outfits, undo, no extra AI call for cached restoration, request privacy and 375px fit.
- Updated the v0.1.18 collision fixture to use two alias owners: a unique saved alias now correctly auto-resolves before the warning. Kept the conflict rejection assertions. The smoke script also failed on the unchanged v0.1.19 parent because it expected historical prompts to survive a successful generation; it now asserts one-generation consumption and explicitly restores history again before testing dimension edits.
- Remaining browser scripts, real SillyTavern sessions, real group chats, iPhone Safari and live extraction/image providers were not exercised. Extraction and generation were mocked; the new prompt cannot guarantee that an external model notices every visible person. Old records with only names require a new extraction to obtain missing visual fields.

# v0.1.18 validation — 2026-10-27

Fixes for an outside review of 0.1.17 (all eight findings reproduced in code before fixing).

- Extension Node suite **93 passed, 0 failed, 0 skipped** (+2: stricter name matching — exact beats short, first-name and Korean given-name only, ambiguity stays a side character, Korean spacing; `{{char}}`/`{{user}}` filling).
- **18 of 18 browser scripts passed** in headless Chromium, including the new `browser-v0118`: Tab never reaches panel controls behind the warning and Escape closes only the warning; switching chats and closing the panel close it without generating or saving "don't ask again" in the other chat; 취소 with the box ticked saves nothing; 그래도 그리기 saves it and 경고창 다시 켜기 turns it back on; a profile started in chat A does not link to chat B's user; a failed save then a fixed save keeps the card link; linking adds the exact alias even when a partial name matches, refuses a name another profile owns, and 연결 되돌리기 restores alias, chat link and scene; in a group chat the member warning, card link and filled macros in the description sent. The same script fails (timeout) against 0.1.17.
- The new test also caught a missing refresh: after 그래도 그리기 with the box ticked, the "다시 켜기" line did not appear until the next render. Fixed.
- Pre-push privacy check: no keys, personal paths or emails; a screenshot-derived example name used in a comment and a unit test was replaced with an invented one before committing.
- Not exercised: a real SillyTavern instance or group chat, iPhone Safari, a live extraction provider.

# v0.1.17 validation — 2026-10-27

- Extension Node suite **91 passed, 0 failed, 0 skipped** (+4 in `missing.test.mjs`: name matching, main people for single and group chats, classification, card/persona description reading with the 4,000-character cap).
- **17 of 17 browser scripts passed** in headless Chromium, including the new `browser-v0117` (invented names only): warning box for the open card with three actions and the API-cost note; side character stays a chip; left-out line; generate dialog cancel / proceed / don't-ask-again (box and line remain); card description → tag conversion → save links the card and adds the person; link to an existing profile adds the alias and sets the chat link; empty card description disables the card button; user persona via 직접 만들기 sets the user link, and via 페르소나에서 만들기 sends the persona text; 375px fit.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names; commit identity Near7707 with the GitHub noreply address.
- Not exercised: a real SillyTavern instance (card/persona fields come from SillyTavern's `getCharacterCardFields` with fallbacks), group chats in a real instance, iPhone Safari, a live NovelAI account or extraction provider.

# v0.1.16 validation — 2026-10-26

- Extension Node suite **87 passed, 0 failed, 0 skipped**, including cocoa text/button/tab/checkbox contrast and companion-server compatibility.
- Four targeted browser scripts passed: `browser-skins`, `browser-v019`, `browser-v060`, and `browser-v0112`. All fifteen skins were exercised for selection/persistence, phone-width layout and readable fields under forced white/dark input themes; existing loader race regressions also passed.
- Inspected actual cocoa-panel captures at desktop and 375px widths. Korean glyph rendering was not visually verified because this headless browser lacks Korean fonts.
- All pre-existing skin CSS files are byte-for-byte unchanged; cocoa is an additional registry entry and CSS file. No skin was removed or replaced.
- The remaining browser scripts, a real SillyTavern installation, iPhone Safari and live NovelAI generation were not run for this skin-only release. The server plugin is unchanged.

# v0.1.15 validation — 2026-10-25

- Extension Node suite **86 passed, 0 failed, 0 skipped**, including the apple skin's text, active-tab, button, checkbox and arrow contrast checks and compatibility with the companion server.
- Four targeted browser scripts passed in headless Chromium: `browser-skins`, `browser-v019`, `browser-v060`, and `browser-v0112`. Coverage includes selecting and saving the apple skin, all four tabs at 375px, fourteen skins under forced white/dark input themes, and the existing quick-pick race regression.
- Captured the actual panel at desktop and 375px widths to inspect the cream/red/green palette and layout. The browser image lacks Korean fonts in this environment; Korean glyph rendering was not visually verified.
- This was a skin-only change. The other browser scripts, a real SillyTavern installation, iPhone Safari and live NovelAI generation were not run for this release.

# v0.1.14 validation — 2026-10-25

- Extension Node suite **85 passed, 0 failed** (five more per-skin contrast tests; 딸기우유 and 바나나우유 checkbox outlines were darkened to meet the 3:1 outline rule).
- **16 of 16 browser scripts passed** in headless Chromium with all thirteen skins: switching, saving, 375px fit, deleted-skin fallback, quick-pick race, and ≥4.5:1 field text under forced white/dark input themes.
- Visual check of all five milk skins in the scene tab (screenshots, not shipped).
- Not exercised: a real SillyTavern instance, iPhone Safari, a live NovelAI account.

# v0.1.13 validation — 2026-10-25

- Extension Node suite **80 passed, 0 failed** (two more per-skin contrast tests); server suite unchanged.
- **16 of 16 browser scripts passed** in headless Chromium with the skin lists updated to eight skins: switching, saving, 375px fit, deleted-skin fallback, quick-pick race, and ≥4.5:1 field text under forced white/dark input themes on every skin.
- Visual check of both new skins in the scene tab (screenshots, not shipped).
- Not exercised: a real SillyTavern instance, iPhone Safari, a live NovelAI account.

# v0.1.12 validation — 2026-10-24

Bug-fix release for three issues found in a separate usage review of 0.1.11.

- Extension Node suite **78 passed**, server Node suite **18 passed** (96 total), 0 failed, 0 skipped.
- **16 of 16 browser scripts passed** in headless Chromium, including the new `browser-v0112`:
  - A deferred profile conversion followed by 모든 칸 비우기, and again by + 새 프로필 만들기, leaves name/appearance/outfit/description empty after the late result arrives, and releases the busy state. An uninterrupted conversion still fills the form.
  - With the 이력 tab open, closing the panel, switching to another chat and reopening loads that chat's history without clicking the tab.
  - With `glass.css` delayed by 900ms, picking 글래스 then 파스텔 ends on 파스텔 (attribute, saved setting, selected card, a single skin stylesheet). Picking 글래스 then 기본 ends on 기본 with no skin stylesheet.
  - The same script run against the 0.1.11 `index.js` fails (timeout in the conversion step); with only the skin fix reverted it fails the skin assertion.
- `browser-v040` missing-PNG step: now disables the browser cache (CDP `Network.setCacheDisabled`) before re-rendering, because Chromium could reuse the already-decoded image despite `no-store`. 29 of 30 repeated runs passed after the change; the one failure did not reproduce in 22 further captured runs and left no trace of where it stopped, so it is recorded here rather than claimed fixed.
- Not exercised: a real SillyTavern instance, iPhone Safari, a live NovelAI account.

# v0.1.11 validation — 2026-10-24

- Node suite (with NAIce-Shot-Server alongside): **78 passed, 0 failed, 0 skipped**.
- **15 of 15 browser scripts passed** in headless Chromium, including the new `browser-v0111`: with nothing selected 프리셋 저장 creates and selects a preset; with one selected it overwrites it; 새 프리셋으로 저장 adds a second preset and leaves the first unchanged, and refuses a duplicate name; + 새 프리셋 만들기 asks first, then empties both prompts, resets generation settings to defaults, deselects, empties and focuses the name field, and keeps saved presets; it does not ask when everything is already blank; an empty name is refused; 375px fit. `browser-smoke` now uses 프리셋 저장 for the overwrite step.
- Not exercised: a real SillyTavern instance, iPhone Safari, a live NovelAI account.

# v0.1.10 validation — 2026-10-24

- Node suite (with NAIce-Shot-Server alongside): **78 passed, 0 failed, 0 skipped** — contrast/visibility checks now cover six skins (new 파스텔, 크림 노트, 말차 라떼 all pass 4.5:1 text and checkmark thresholds).
- **14 of 14 browser scripts passed** in headless Chromium, including the new `browser-v0110`: with SillyTavern's menu rules applied, the NAIce Shot entry's icon box is 20×20 at the same x as a normal entry, the name starts at the same x, and icon/text centers are within 1.5px; the skin picker is the last settings section; the file input is opacity 0 and exactly covers the "백업 가져오기" label even when a theme forces inputs visible, nothing overlaps the row below, and clicking the label still opens the file chooser (390px).
- Also measured against SillyTavern's real `style.css` in a probe page: icon x 27 / text x 57 for both NAIce Shot and a Font Awesome entry; centers within 0.5px.
- Not exercised: iPhone Safari itself (the overlap is reproduced and fixed in Chromium with forced input visibility), a real SillyTavern instance, a live NovelAI account.

# v0.1.9 validation — 2026-10-24

- Node suite (with NAIce-Shot-Server cloned alongside): **76 passed, 0 failed, 0 skipped** (one fewer per-skin contrast test after removing 네온).
- **13 of 13 browser scripts passed** in headless Chromium, including the new `browser-v019`: the settings drawer uses SillyTavern's `inline-drawer` markup, is attached while `panel.html` is still loading and stays ahead of an extension that mounts afterwards, and 열기 pressed during loading opens the panel when ready; on all four skins, under injected themes that force every input white (or dark) with `!important`, select/textarea/number fields keep at least 4.5:1 text contrast.
- `browser-skins` now also checks that a saved 네온 choice falls back to 기본.
- Visual check (screenshots, not shipped): 글래스 over a colorful page shows the blurred page through the panel; 기본 under a light theme with forced-white inputs is readable.
- Not exercised: a real SillyTavern instance (drawer styling there comes from SillyTavern's own CSS), Termux on a phone, a live NovelAI account.

# v0.1.8 validation — 2026-10-24

- Layout change only for the extension (files moved to the repository root) plus the phone viewer toolbar fix; server code unchanged and moved to NAIce-Shot-Server.
- Extension repository, with NAIce-Shot-Server cloned next to it: Node suite **77 passed, 0 failed, 0 skipped** (server tests moved to the server repository). **12 of 12 browser scripts passed** in headless Chromium, including the two that drive the real server handlers (`browser-v040`, `browser-v070`).
- Before the fixes in this update, three browser scripts also failed on the uploaded 0.1.7 commit itself: `browser-v013` (its stubbed "matching" server lacked 0.1.7's new `privacy-controls` flag), `browser-v031` (inline captions gained a 공유용 PNG button; and a real regression: the phone viewer toolbar had grown to four rows) and `browser-v040` (reworded backup-import notice). The tests were updated and the toolbar fixed.
- Viewer toolbar measured at 375px: two rows (103px), no overflow; at 320px: three rows, no overflow.
- Server repository: Node suite **18 passed, 0 failed**, including loading the plugin from a mock SillyTavern `plugins/` folder.
- Not exercised: a real SillyTavern URL install or git-based plugin auto-update, a live NovelAI account.

# v0.1.7 validation — 2026-10-24

- Full Node suite: **95 passed, 0 failed**. Added coverage for raw response omission/opt-in, persisted reasoning removal, filesystem and secret-reader error redaction, and both extraction-provider error paths.
- **4 browser scripts passed** in headless Chromium: `browser-smoke`, `browser-v014`, `browser-v016`, `browser-v017`. The new privacy regression checks original PNG byte preservation; shared-copy PNG text removal and fully opaque alpha; result/viewer/inline downloads; shared selection ZIP contents; 375px layout; raw-response consent and settings-import reset; unsafe URLs and broken PNG rejection. The other 8 older browser scripts were not rerun in this pass.
- No live NovelAI/text-provider calls. Browser checks use synthetic PNGs and mocked provider responses. Older records are deliberately left intact.

Earlier validation records follow.

---

# NAIce Shot v0.1.6 validation

Date: 2026-10-24 (Asia/Seoul).

## Executed for this update

- Full Node suite: **89 passed, 0 failed** (+1 skins: no skin may restyle the backdrop; +1 presets: an old preset's Noise Schedule is neither applied nor counted as a change).
- Browser regression suite in headless Chromium: **11 of 11 passed**, including the new `browser-v016`: the dim layer behind the panel is identical (`rgba(0,0,0,.6)`) on all five skins; no display-name field and an old saved name is ignored; no Noise Schedule control and generation sends `karras` even when an old value was saved; "모든 칸 비우기" and "+ 새 프로필 만들기" clear every profile field, switch to a new profile, focus the name and leave the saved profile unchanged; 375px fit.
- `browser-smoke` updated for the removed settings.
- `browser-v040` failed once in one full-suite run and then passed 9 consecutive reruns; the failure did not reproduce, so it is recorded as an intermittent timing issue in that test, not a product change in this update.
- Not exercised: a live NovelAI account, a real user installation.

---

# (previous) NAIce Shot v0.1.5 validation

Date: 2026-10-24 (Asia/Seoul).

## Executed for this update

- Full Node suite: **87 passed, 0 failed**.
- Browser regression suite in headless Chromium: **10 of 10 passed**, including the new `browser-v015`: an attached image is below the message text by default; switching the setting to 위 moves it above at once (and back), the choice is saved, the message text is byte-identical, a re-render keeps the side and no duplicate holder appears.
- Not exercised: a live NovelAI account, a real user installation.

---

# (previous) NAIce Shot v0.1.4 validation

Date: 2026-10-23 (Asia/Seoul).

## Executed for this update

- Full Node suite: **87 passed, 0 failed** (+2 in `zip.test.mjs`: CRC-32 check value; ZIP read back by Python's `zipfile` with intact bytes, renamed duplicates, sanitized names and timestamps; +1 in `compat.test.mjs`: UI and server core identical apart from the version line).
- Browser regression suite in headless Chromium: **9 of 9 passed**, including the new `browser-v014`:
  - 선택 저장 with one image downloads `naice-shot-<id>.png`; with four selected (one file missing) it downloads one ZIP holding the other three PNGs byte for byte, oldest first, shows the skipped count and keeps the selection.
  - Under an injected theme stylesheet that forces every checkbox and tick to white with `!important`, the ticked checkbox keeps a ≥4.5:1 tick on all five skins, 20px size, no theme filter or `::after` decoration. The same test run against the 0.1.3 CSS fails (white tick on white box, 1:1), reproducing the reported invisible checkmark.
  - History toolbar with the new button fits at 375px.
- Not exercised: a live NovelAI account, a real user installation, iOS Safari download handling.

---

# (previous) NAIce Shot v0.1.3 validation

Date: 2026-10-23 (Asia/Seoul).

## Executed for this update

- Full Node suite: **84 passed, 0 failed** (81 existing + 3 in `compat.test.mjs`: numeric version compare; none/error/warn/info/ok levels including old server, missing feature and old UI; this release's real `status?quick=1` handler returns a compatible reply without calling NovelAI).
- Browser regression suite in headless Chromium (Playwright): **8 of 8 passed** — the 7 previous scripts plus `browser-v013` (old-server banner and close, not re-shown on reopening, one check per page load; missing-plugin banner at 375px with no sideways overflow; matching versions show no banner and list both versions in Settings).
- Not exercised: a live NovelAI account, a real user installation, real extraction providers.

---

# (previous) NAIce Shot v0.1.2 validation

Date: 2026-10-23 (Asia/Seoul).

## Executed for this update

- Full Node suite: **81 passed, 0 failed**.
- Browser regression suite run in headless Chromium (Playwright) against this exact build: **7 of 7 passed** — `browser-smoke`, `browser-v031`, `browser-v040`, `browser-skins`, `browser-v060`, `browser-v062`, `browser-v070`.
  - `browser-v040` and `browser-v070` drive the real server plugin handlers on a temporary user folder (paged history, single/selected/whole-chat delete, all-chats view, attachment cleanup, old-server message).
  - Before the fix, `browser-v070` failed only because it still expected the earlier private build's version number in the "update the server plugin" message; the product message (`v0.1.0`) was already correct.
- Installer checked on a mock SillyTavern tree: UI (including `skins/`) and server plugin land in `extensions/naice-shot/` and `plugins/naice-shot-server/`.
- Package scanned for credentials, earlier private names and personal character data: none found.
- Not exercised: a live NovelAI account, a real user installation, real extraction providers.

---

# (previous) NAIce Shot v0.1.1 validation

Date: 2026-10-23 (Asia/Seoul).

## Executed for this update

- Full Node suite: **81 passed, 0 failed** (79 existing tests and 2 UI-controller regressions).
- Reproduced the history-settings carry-over on the previous code before fixing it.
- Executed actual UI code with DOM doubles: history seed/size/steps survive failed/cancelled extraction, then reset after a successful extraction; generation sends current settings afterward.
- Verified both preset pickers render saved choices and synchronize selection, modified-state text and newly saved/deleted presets. Applying a preset clears history overrides and sends the selected prompt/options on generation.
- UI/server core parity, JavaScript syntax, manifest/package versions and panel ID references checked.
- Credential/private-data scan and final ZIP integrity checked.

## Existing coverage retained

The 79 existing tests include payload assembly, profiles, outfits, extraction, per-user records/history/deletion, credential exclusion, image-path validation, presets, skins and viewer math. The installer behavior was checked in the previous 0.1.0 naming pass; its code is unchanged in this update.

## Limits

DOM doubles test application logic and emitted markup, not native browser layout or interaction rendering. Playwright scripts remain included but were not rerun because Chromium is unavailable.

No live NovelAI or text-provider call was sent. A real SillyTavern installation, Windows/mobile browsers and themes require local confirmation. GitHub publication remains deferred.

The previously identified history-settings carry-over after new extraction is fixed in this build.
