# Changelog

## 0.1.69 — 2026-11-04 (extension + server v0.1.17)

GPT's review of 0.1.68.

- A ↻ check that started before the server refused a generation can no longer bring back the old "free" verdict or clear the consent note when its answer arrives late; only a check started after the refusal decides again (UI-068-01, P2).
- Every failure of the server's account check — no connection, a timeout, a reply that cannot be read, as well as an HTTP error — is reported as `nai-account`, so the old verdict is dropped. A timeout at this step says "생성 요청은 보내지 않았어요" instead of the image-timeout note (UI-068-02, P2).
- The extension now asks for server 0.1.17.
- Tests: new `browser-v0169` (375 and 1100px); server tests for offline, timeout and unreadable replies.

## 0.1.68 — 2026-11-04 (extension + server v0.1.16)

GPT's review of 0.1.67, and polish from the user's check (the user confirmed V4.5 generates with Anlas consent off).

- When the server refuses a generation (consent needed) or cannot check the account just before sending, the box drops its old verdict at once and checks again; the consent note stays until a fresh check succeeds (UI-067-01, P2). The server answers a failed account check with `code:'nai-account'`.
- The subscription state comes first for every tier: an inactive or grace-period Tablet/Scroll says so instead of "uses Anlas" (UI-067-02). A reply without a usable tier gets the "필요한 항목을 확인하지 못했어요" wording (UI-067-03).
- [서버·NAI 연결 확인] failing after a successful field list marks the list as the earlier result and stops [목록 복사] (UI-066-01). The folded box now explains what the list is for and that it carries no values.
- **챗샷 / 프리샷 switch on every tab**; pressing it on another tab changes the mode and stays there.
- **Account box:** a tap anywhere on it unfolds or folds it (not ↻ or the link). "NovelAI에서 확인" sits under the V5 row at the right; only its words are a link.
- **Image presets keep their order** after [변경 저장] (it used to move the preset to the end).
- The extension now asks for server 0.1.16.
- Tests: new `browser-v0168` (375 and 1100px); `browser-v0146` and `v0167` updated.

## 0.1.67 — 2026-11-04 (extension + server v0.1.15)

Fixes "Opus 무료 생성 특전을 확인하지 못했어요" on V4.5 and the block that came with it; shows V5 usage; moves 챗샷/프리샷 into the title row.

- **Free check (shared with the server, which checks again just before sending):** the old `perks.unlimitedImageGeneration` is no longer read — the user's account reply had no such field and the current schema does not declare it. An **active Opus** gets V4.5 free within the default size, 28 steps or fewer and one image (text-to-image only), so it is sent with Anlas consent off. A grace period is "can't tell" (our cautious choice, checked first), `active:false` is "구독 비활성 · 무료 생성 대상 아님", and a missing or odd field is "계정 정보에서 필요한 항목을 확인하지 못했어요", never read as false or 0. V4.5 never needs the usage fields. **V5** shows its usage and always needs consent; 0%, "can't use now" (`isNegative`) and missing usage read differently.
- **Account box (mockup D):** line 1 "tier · this generation" + ↻; line 2 "Anlas · V5 N% (+N%) · checked at" (V5 for Opus); tap for subscription state, the full cost line and V5 details. The settings check line shows the same.
- **챗샷 / 프리샷** sits in the title row right after the title, as tall as title + subtitle, on 그리기 only; the bar that followed the page is gone. Below 360px the subtitle makes room.
- The extension now asks for server 0.1.15 (an older server keeps blocking V4.5).
- Tests: new `browser-v0167` (every account case, consent off, title row at 375/1100/340/320); older scripts use an active Opus with V5 usage; server tests for each account case.

## 0.1.66 — 2026-11-04 (extension + server v0.1.14)

A first step to fix the "Opus 무료 생성 특전을 확인하지 못했어요" warning: see which fields NovelAI really sends.

- Settings → [서버·NAI 연결 확인] now also shows a folded **"계정 응답 항목 이름 보기 (값 없이)"** with [목록 복사]: the names and kinds of the fields in NovelAI's account reply (e.g. `perks.unlimitedImageGeneration: boolean`), never their values. Only that button asks for it; opening the panel and ↻ do not.
- With an older server the box says to update the server to 0.1.14.
- The free check, the cost line and the server's consent block are unchanged in this release.
- Tests: new `browser-v0166` (375 and 1100px); server test for names without values.

## 0.1.65 — 2026-11-04 (extension only; server v0.1.13 unchanged)

GPT's review of 0.1.64, and a thinner 챗샷/프리샷 switch (the user's choice (가)).

- After a slow move in the history gallery, closing the enlarged view and opening another picture on its own (e.g. the result) no longer leaves [메시지로 가기] locked (UI-064-01, P2). The lock follows the shown picture every time, gallery or not.
- A tap on empty space that is followed by closing the view another way (Escape, ✕) no longer swallows the next click elsewhere; the waiting tap-close is dropped when the view closes or shows another picture, and it only ever takes a click on the view itself (UI-064-02).
- **챗샷 / 프리샷 switch:** one thin joined switch that stays at the top: 42px instead of 95px (buttons 32px, 13px text).
- Tests: new `browser-v0165` (375 and 1100px).

## 0.1.64 — 2026-11-04 (extension only; server v0.1.13 unchanged)

GPT's review of 0.1.63, and a note for pictures with no message to go to (the user's iPhone check).

- **Enlarged view, moving to the next picture:** the shown picture keeps its date, seed, save link and delete target until the next one is ready; then everything switches at once. If it takes longer than a moment, "불러오는 중…" shows and 삭제 · 빼기 · 메시지로 가기 wait (UI-063-01, P1). The next picture is decoded off screen and put in place in one step, so there is no empty frame between pictures of different shapes (UI-063-05).
- A tap on empty space closes the enlarged view only after that tap's own click has come (and is swallowed), so it can never open a chat picture underneath again (UI-063-02). If no click comes, it closes anyway.
- The 프리샷 result notice (removed or unticked cards) stays on 그리기 even if you moved to another tab while it ran (UI-063-03). The 챗샷 "영어로 바뀌지 않은 칸이 있어요" warning no longer folds (UI-063-04).
- **"연결된 메시지 없음 ⓘ"** in the enlarged view for a picture with no recorded message (made without 장면 추출, e.g. from the last saved prompt; older pictures; 프리샷). Tap it for the reason; the history ⋯ menu gives the same reason.
- Tests: new `browser-v0164` (375 and 1100px); `browser-v0148` waits for each move.

## 0.1.63 — 2026-11-04 (extension only; server v0.1.13 unchanged)

GPT's review of 0.1.62, and enlarged-view / chat-picture polish from the user's iPhone check.

- A warning to act on stays: an incomplete extraction reply ("응답이 불완전해요…"), a request that could not be matched, and 프리샷 results that removed or unticked cards (UI-062-01).
- While anything runs, every notice of the tab waits (errors too) and shows again afterwards (UI-062-02). Each notice folds on its own timer, so one tab's notice no longer stops another's from folding (UI-062-03).
- "(N곳)" counts messages the same way removal does (a picture on another swipe counts; swipes of one message count once) (UI-062-04).
- `browser-v0162` waits for the fold instead of a fixed time and runs at 1100px too (UI-062-05).
- **Enlarged view:** no picture size; the date shows at once (no "불러오는 중…" swap); [메시지로 가기] sits at the right of "프롬프트 보기", so the bottom line is always "date · [seed 복사]". Moving to another picture decodes it first and swaps in one go — no flash or overlap. The save menu notes have fixed light colours (themes were colouring them dark).
- **Chat pictures:** no ⋯ over the picture; tap it for the enlarged view with 저장 · 이 메시지에서 빼기 · **삭제** (asks first; the picture and record are deleted and taken out of every message). A picture whose file is gone keeps a plain [이 메시지에서 빼기] under its note. Pictures attached from now on keep their date and seed; older ones look them up from history when opened.
- A tap on empty space closes the enlarged view just after its own click, so the click never lands on the chat underneath.
- Tests: new `browser-v0163`; older scripts updated (no ⋯, no size line, delete from the chat).

## 0.1.62 — 2026-11-04 (extension only; server v0.1.13 unchanged)

Phone polish from the user's iPhone check of 0.1.60.

- **Steps** instead of 스텝 everywhere in the panel (labels, the 생성 설정 line, Anlas notes, preset and history text), like Guidance and Seed. The shared core (also on the server) still words two messages with 스텝; the panel shows them as Steps until the next server release.
- **[↓ 생성]** now stops with the real [이미지 생성] button at the bottom edge of the screen (Anlas and warnings right above it).
- **One banner at a time:** while extraction or generation runs, only the progress box shows. A success notice folds away after a few seconds (longer ones stay longer); errors stay.
- **Enlarged view:** one row on top (화면 맞춤 · 원본 크기 · − % + · ✕); moving and saving share one row under the picture (‹ n/m › … 저장 ▾ · 삭제), the save menu opens upward; the prompt fold and info line are slimmer.
- History ⋯: **"채팅에서 이 그림 빼기"** (with "(N곳)" when the picture is in several messages) instead of "이 채팅의 첨부 모두 빼기", which read as if every picture would go.
- Tests: new `browser-v0162`; `browser-v0138` reads "28 Steps".

## 0.1.61 — 2026-11-04 (extension only; server v0.1.13 unchanged)

Fixes from GPT's re-check of 0.1.60.

- The two conversions for older 프리샷 cards now run separately on every load: a temporary person saved by 0.1.59 (pinned, but with no record of where its clothes came from) keeps its clothes as chosen. Clothes the AI fills in are recorded as automatic, so they are told apart (UI-059-03, rest).
- Cancelling the "작성 중인 프로필 내용" question from [직접 만들기] for a left-out person no longer plans a card link that would be attached to the profile being edited (UI-060-01).
- Tests: new `browser-v0161`; two migration cases in `free-people.test.mjs`.

## 0.1.60 — 2026-11-04 (extension only; server v0.1.13 unchanged)

Fixes from GPT's review of 0.1.59, and a shorter PNG guide.

- Cancelling the "작성 중인 프로필 내용" question from a temporary person's [프로필로 저장] now leaves the profile being edited untouched (it was filled with the temporary person's look, and saving overwrote the profile) (UI-059-01).
- A description typed in "외형·복장 설명" but not turned into tags yet counts as unsaved typing and is protected (UI-059-02).
- Old work and history: a temporary person's clothes count as chosen, so a new text without clothes no longer empties them (UI-059-03).
- A temporary person's chosen empty outfit stays chosen after [프로필로 저장] (UI-059-04).
- 프리샷: when several profiles share a name or alias, the AI's id no longer decides; only a card already in the work does, otherwise a temporary person keeps the look, with a notice (UI-059-05).
- Profile switch on a card resets the clothes to the new profile (as the card says); ROADMAP updated to match (UI-059-06). ROADMAP also states that generating ends [↶ 추출 취소], like the other undos.
- PNG guide: three lines — 클린 PNG (EXIF included, transparency), 원본 PNG, and "공유하기 전에 다시 한번 확인하세요." in the warning colour.
- Tests: new `browser-v0160`; a migration case in `free-people.test.mjs`.

## 0.1.59 — 2026-11-04 (extension only; server v0.1.13 unchanged)

프리샷 인물 처리 개편 (docs/ROADMAP.md 0.1.59, reviewed with GPT before building).

- **📌 고정** on 프리샷 person cards (beside [제거]). [장면 추출] now follows the written text: a card whose name or alias is not in the text is removed, or kept and unticked when pinned. A pinned temporary person keeps its look and 인원 태그.
- Before anything is lost (a card removed, or a ticked pinned card unticked) the app asks first, and also lists temporary people whose look will be filled again. [취소] sends nothing and changes nothing; cards are only removed once the response is valid.
- The inclusion tick follows each successful extraction (named and visible → ticked; named but not shown, e.g. "X는 없다" → unticked, kept). The AI is told to include existing people only when the text shows them visible. New temporary people are named with the text's own words.
- **[↶ 추출 취소]** (beside 그리기창 비우기, like 가져오기 취소) puts the 프리샷 work back as it was before the extraction. A failed or stopped extraction keeps the work and the previous undo. Editing, generating, clearing or importing ends it.
- 프리샷 clothes: what the AI found is automatic, what you choose wins (an empty choice too). [자동으로 되돌리기] → the AI's clothes (or the default); [기본 복장 입기] → the profile default as your choice; [비우기] stays empty. No 프리샷 lock. Typed clothes of a temporary person are kept.
- Work and history from before 0.1.59: cards without the new mark start pinned, so nothing is deleted unasked.
- **One profile editor (챗샷·프리샷):** the card shows 고정 외형 · 전용 태그 and **[프로필 편집]** opens the same editor as the profile tab in the drawing tab (asks before saving, as the profile is shared). The in-card editing, [프로필 업데이트] and [↶ 업데이트 취소] are gone. Typing that is not saved is never dropped silently when another profile is opened.
- **[↓ 생성]:** a small button at the bottom right of the drawing tab, shown while "3 · 생성" is out of sight; it takes you to the real generate area (warnings and Anlas stay visible there).
- The message's NAIce Shot button now opens 챗샷 even when 프리샷 was in use (the 프리샷 work waits as it was).
- Tests: new `free-people.test.mjs` and `browser-v0159`; older scripts updated (no in-card look editing, new prompt wording).

## 0.1.58 — 2026-11-04 (extension only; server v0.1.13 unchanged)

Fixes from GPT's reviews of 0.1.54, 0.1.56 and 0.1.57, plus two small requests.

- A profile form opened before a card's [프로필 업데이트] no longer overwrites it: on save, a field the form did not change keeps what was saved meanwhile (UI-057-01).
- [↶ 업데이트 취소] puts back only fields still exactly as the update left them; a later change is kept (with a notice), and saving the profile in the form removes the undo (UI-057-02).
- Requested clothing: phrases are split into pieces (comma, semicolon, "and", "with") and pieces about hair, eyes or skin are dropped, natural ones like "blue hair tied back" included; hair accessories (ribbon, clip, band, tie…) stay. When nothing is left, the raw phrase is not used again. The "잠긴 복장을 입혀요" note no longer appears when this picture's own clothes are drawn (UI-056-01).
- The person a requested outfit belongs to is found by the profile's name and aliases too (UI-056-02).
- 프리샷: the returned id is checked against names and aliases; a unique name match wins (with a notice), several profiles with the same name or alias give a temporary person that keeps its look, and the look is dropped only after the profile is confirmed (UI-054-02).
- 프리샷: if the situation text changes while extracting, the old result is not applied (UI-054-04).
- 프리샷 with an empty wardrobe shows: "옷장이 비어 있어요. 챗샷에서 [옷장에 저장]하면 프리샷에서도 꺼내 입을 수 있어요."
- The PNG guide has one sentence per line. PC: the page uses the whole panel width again; button groups are as wide as the fields.
- Tests: new `browser-v0158`, a unit test for the look-word filter; older scripts updated for the full-width PC layout.

## 0.1.57 — 2026-11-04 (extension only; server v0.1.13 unchanged, its README updated)

다듬기 (from the mock-ups).

- **Settings → 공통 이미지 프리셋:** [불러오기] and [+ 새 프리셋 만들기] stay on top; the name and save buttons moved to a **"프리셋으로 저장" box at the end of NAI 생성 설정**. Buttons follow the selection: a chosen preset → **[변경 저장 · 이름]** is the main button and asks before overwriting, with [새 프리셋으로 저장] and [선택 프리셋 삭제]; none → only [새 프리셋으로 저장]. Short fields sit two per row on phones too (모델·크기, 스텝·Guidance, Seed·CFG Rescale).
- **Person card clothes:** the box is called **이번 그림 복장**; a **"이 복장을"** row holds [이 채팅 기본으로] / [옷장에 저장] (moved out of "이 채팅에서", which keeps the default outfit choice and the lock). The lock explanation is folded under **"ⓘ 잠금이 뭐예요?"** with the agreed wording. Saving holds both places.
- **고정 외형 · 전용 태그** can be edited in the card; a small **[프로필 업데이트]** asks first ("…다른 채팅에서 만드는 그림에도 바뀐 외형이 적용돼요") and offers one **[↶ 업데이트 취소]**.
- **「추출 AI 응답 원문 추가 보관」** replaces "추출 AI 응답 저장", with the agreed text: generation records (JSON) are saved either way; the option only adds the raw response; privacy note; a "자세히" fold (no chat message text is copied, but what the AI quoted can remain).
- **PC:** everything sits in one 640px column in the middle, so fields and button groups end together.
- **History:** [모두 선택] ↔ **[모두 해제]** (clears whenever anything is picked); **"↻ 새로고침"** with words; the scope explanation folded under "ⓘ 이 보기 설명"; a folded **"ⓘ 그림과 기록은 어디에 저장되나요?"** with the checked paths and what deleting does. The PNG warning stays open.
- **Chat message ⋯ menus** use the theme's colours (they were always the default dark).
- Server README: what the JSON record holds and what deleting removes.
- Tests: new `browser-v0157`; older scripts updated for the new preset buttons, 모두 해제, ↻ 새로고침, the 640px column and the moved outfit buttons.

## 0.1.56 — 2026-11-04 (extension only; server v0.1.13 unchanged)

Fixes from GPT's review of 0.1.55.

- The moment schema lists every property as required, as strict structured output (OpenAI) demands; with no request the new fields are empty (UI-055-01).
- "혼자" / "X만" (the request decides who is visible): a temporary person kept from before is left out of this picture; the card stays, unticked. Without such a request it is drawn again (UI-055-02).
- Requested clothing now comes from the matched and cleaned scene: the person is found by name after identity matching, names are removed, and hair/eye/skin words are dropped (fixed appearance follows the profile, said in the "반영하지 않음" line). Clothing that cannot be placed is reported instead of claimed (UI-055-03).
- If 추가 요청 is changed while extraction runs, the old result is not applied (UI-055-04).
- The "추가 요청 반영" line belongs to the candidate it was applied to and follows candidate switches (UI-055-05).
- A leftover "글로 채우기" in the empty-scene cancel message now says "장면 추출" (UI-055-06).
- Tests: `moments.test.mjs` checks the whole schema for strict rules; new `browser-v0156`.

## 0.1.55 — 2026-11-04 (extension only; server v0.1.13 unchanged)

그리기 탭 정리 (draft reviewed with mock-ups).

- **One screen for 챗샷 and 프리샷.** Shared parts are built once and only the mode-specific parts change: 추출 표현 (tags / natural) now also shows in 프리샷, where it was hidden although used. 챗샷 only: target message, messages sent, include user, profile links, candidates, 추가 요청. 프리샷 only: the situation box. Each mode still keeps its own work, undo and scroll position.
- **One [장면 추출] button for both modes** (프리샷's 글로 채우기 is gone; the same button sends the written situation).
- **추가 요청 · 선택** replaces "그리고 싶은 순간". It can pick an instant ("밥 먹는 순간"), change the chosen one ("비 오는 밤으로", "혼자", "앉은 자세", "코트 입혀줘"), or both. What you state wins for this picture; everything else follows the message; fixed appearance follows the profile; the chat, profiles and chat clothes are not changed. "혼자" also removes the others' actions and interaction. Requested clothing counts as this picture's own choice, so it shows even with a clothes lock. After extraction a line says what was applied and what was not ("추가 요청 반영: 밤 · 앉은 자세 / 반영하지 않음: 머리색 · 프로필 고정 외형"). The box sits above [장면 추출], and under the candidates once there are some, with [이 요청으로 다시 추출].
- **그리기창 비우기** moved next to the "2 · 장면 편집" heading (one slot for both modes; ↶ 비우기 취소 / ↶ 가져오기 취소 as before).
- The **챗샷/프리샷 switch stays at the top** of the drawing tab while it scrolls.
- **프리샷 guide** explains that names or aliases of saved profiles are recognised without adding the person first, and others become temporary people.
- **[인물 추가]** uses the accent style; **[+ 캐릭터 프롬프트] → [+ 인물 칸 추가]** ("프로필 없이 이번 그림에만 쓰는 인물 칸이에요"); "캐릭터 프롬프트로 추가" → "인물 칸으로 추가".
- **Generating without a 공통 이미지 프리셋 asks first** (unless history settings are in use); 취소 sends nothing.
- Tests: new `browser-v0155` (both modes); the test fixture answers the new preset question 'yes' for older scripts.

## 0.1.54 — 2026-11-04 (extension only; server v0.1.13 unchanged)

- **The same words in another message are no longer taken for an image's source (UI-053-01, rest of UI-052-03).** When the drawn message's send time is recorded, only the message with that time counts — at its old number, moved, or with another swipe showing (SillyTavern moves `send_date` with the shown swipe, so each swipe's own time also counts). A repeated greeting or short reply elsewhere, at the old number or in another message's swipe, is reported as not found, and 본문에 넣기 (자동) asks. Images without a recorded time keep matching by text and swipe.
- Tests: `message-jump.test.mjs` cases for twins and swipes; new `tests/browser-v0154.mjs`.

## 0.1.53 — 2026-11-04 (extension only; server v0.1.13 unchanged)

Fixes from GPT's review of 0.1.52 (checked against SillyTavern 1.19.0 staging).

- **메시지로 가기 to another chat checks each step before the next (UI-052-01/02).** SillyTavern's `openCharacterChat` renames the *selected* character's chat and `openGroupChat` does not select a group, so:
  - while SillyTavern is writing a reply, nothing moves;
  - the chat must be in that character's chat list first (a missing chat is never created);
  - after `selectCharacterById` the selected character is checked again; if SillyTavern refused (saving, replying), it stops with a message;
  - another group's chat is not opened (SillyTavern offers no way to select a group); chats of the group already open still work.
- **A message that slid into the old number is no longer taken for the source (UI-052-03).** New images remember the drawn message's send time (taken at extraction, or at generation when the message still matches); "edited" is claimed only for that same message. Without it (older images, restored drafts) a changed number is reported as not found, and 본문에 넣기 (자동) asks.
- One-off generation options edited while an outfit save waits are kept (compared by value, UI-052-04).
- Linking a temporary person to a profile already in the scene merges them instead of making a second card; undoing a link removes only the cards that link added (UI-052-05).
- Older messages keep loading while each press of SillyTavern's "show more" adds some; no fixed limit, with a progress toast (UI-052-06).
- Tests: `browser-v0153`; `browser-v0151` mocks the chat list; `browser-v0118` also checks that the chat link does not follow to another chat and that group members still cannot take a shared name.

## 0.1.52 — 2026-11-04 (extension only; server v0.1.13 unchanged)

Fixes from GPT's review of 0.1.50, applied on top of 0.1.51.

- A chat-outfit save that succeeds no longer throws away a final prompt (or one-off options) you edited while it was saving (UI-050-03). Without such an edit the prompt is rebuilt from the new clothes as before.
- Making or linking a profile from the card-character box turns a temporary person with the same name into that profile instead of adding a second one (UI-050-04). Undoing the link brings the temporary person back.
- When several profiles share the card character's name, the box appears too ("이름이 같은 프로필이 여러 개라 연결하지 못했어요") and 기존 프로필 연결하기 sets this chat's link without the alias error (UI-050-05).
- New `tests/browser-v0152.mjs`.

## 0.1.51 — 2026-11-03 (extension only; server v0.1.13 unchanged)

- **메시지로 가기** at the bottom of each history card's ⋯ menu (under a divider) and in the enlarged viewer.
  - One line when the image was made from and attached to the same message ("#12 · 이 그림을 만들고 넣은 메시지"), or when only one is known. Two lines when they differ: **넣은 메시지로 가기** / **만든 메시지로 가기**. In the viewer, two targets open a small menu.
  - In the open chat the panel closes, the chat scrolls to the message (older messages are loaded as needed) and it lights up for two seconds.
  - An image from another chat asks once ("… 채팅으로 이동할까요?"), opens that chat with SillyTavern's own chat switch and then goes to the message.
  - A message that was edited, is on another swipe, or moved after earlier deletions is still found, with a short note. A deleted one greys the line with the reason. 프리샷 images and images without a source say they have no message.
- **본문에 넣기** with the automatic target no longer falls back to the last message when the made message cannot be found: it asks you to pick one in "그림을 넣을 메시지". The automatic option now reads "자동 · 넣은 메시지나 만든 메시지".
- New `message-jump.mjs` (pure locating functions) with `tests/message-jump.test.mjs`, and `tests/browser-v0151.mjs`. The test fixture gained `openCharacterChat`.

## 0.1.50 — 2026-11-03 (extension only; server v0.1.13 unchanged)

- **Clothes saving (GPT review):** a failed chat-outfit save no longer wipes what you typed in the meantime (UI-049-03); a card rebuilt while saving keeps its "저장 중…" hold (UI-049-04); typing in the outfit box shows **자동으로 되돌리기** and the "지금" line at once (UI-049-05).
- **Card character without a profile:** the notice named them but no buttons appeared when the extraction did not list them. The drawing tab now shows the make/link box ("연결된 프로필이 없어요 · 이번 장면에서는 AI가 찾지 못했어요") with 직접 만들기 / 카드에서 만들기 / 연결. They are not counted as left out of the picture.
- **클린 PNG** replaces "공유용 PNG" everywhere (also 클린 ZIP, `-clean.png`, `naice-shot-clean-….zip`). Notes: 클린 "프롬프트·seed 등 메타데이터를 제거한 사본이에요." / 원본 "프롬프트·seed 등 메타데이터를 제거하지 않고 그대로 저장해요."
- **PNG 저장 안내** moved from Settings to the history tab, always shown in the 개인정보 주의 style, and explains that EXIF is one kind of metadata.
- **⋯ menu order:** 챗샷으로 보내기 · 프리샷으로 보내기 · 설정을 프리셋으로 · 본문에 넣기.
- A focused menu item keeps one ring (the save menu sometimes showed a double border). Menu notes use the theme's muted colour instead of transparency, so they stay readable on light themes.
- **덮어쓰기 · 이름** stays on one line; long names end with "…" and show whole on hover (UI-049-06).
- History: "채팅으로 좁히기" → **채팅방 선택**.
- Checks: the contrast scan blends text alpha and element opacity and checks hovered menu items (UI-049-07); the theme check reads property names in any letter case (UI-049-08). New `tests/browser-v0150.mjs`. New `docs/ROADMAP.md` (decisions and hand-off rules for the next versions).

## 0.1.49 — 2026-11-03 (extension only; server v0.1.13 unchanged)

- **Drawing:** [장면 추출] / [글로 채우기] span the row; [그리기창 비우기] sits small below and turns into **[↶ 비우기 취소]** right after clearing (no separate banner). After importing from history, a small **[↶ 가져오기 취소]** appears beside it instead.
- **Clothes on a person card** in two groups. **이번 그림:** outfit box, 옷장에서 꺼내 입기, **기본 복장 입기**, new **비우기** (no clothing tags), and **자동으로 되돌리기** only after a manual edit. These replace 이번 편집 취소 and 이번 그림 복장 초기화. **이 채팅에서:** chat default, **지금 옷을 기본으로** / ✓ 채팅 기본 복장, 옷장에 저장, 복장 잠금; 해제 취소 now appears inside this group. Saving holds only that card's controls with "저장 중…", never the whole drawing window (also fixes UI-048-06).
- **History:** 보기 범위 and 저장 ▾ use the accent style (edge-coloured border, light tint); refresh is a small ↻ beside the count; tools keep their arrangement (모두 선택 · 선택 저장 · 선택 삭제 / 이력 전체 삭제), with "표시된 항목" hidden on phones so nothing spills.
- **Save menus:** the long "PNG 저장 안내" moved out of every menu into Settings → PNG 저장 안내. "공유용 PNG" uses the same accent style on every theme and its note is readable. Menus are opaque on every theme (the glass theme let text behind show through).
- **Settings:** 새 프리셋으로 저장 is the main button; **덮어쓰기 · 이름** (disabled until a preset is chosen) and 선택 프리셋 삭제 share the next row. AI response retention moved into **고급 → 추출 AI 응답 저장** with new wording.
- **Profile:** 프로필 저장 across the row; 카드 연결 · 모든 칸 비우기; a small 프로필 삭제 apart.
- Button groups are capped at 560px on wide screens. Contrast fixes: matcha/milk primary hover, milk header subtitle.
- **Design rules and checks:** `docs/DESIGN.md`; `tests/skins-lint.test.mjs` (themes may set colours and decoration only); `tests/browser-v0149.mjs` (17-theme contrast with menus open, opaque menus, 320/375/1100px overflow, one-line and non-spilling buttons, one main action per group, history tools arrangement, PC width cap, clear/undo slot). `browser-v0148` falls back to the installed Playwright (UI-048-05).

## 0.1.48 — 2026-11-03 (extension only; server v0.1.13 unchanged)

- History destination imports and paged gallery navigation; distinct clothing undo/reset; compact history scope selector, message-count controls and review reminder. Findings, fixes, validation and limits: [shared review log](docs/REVIEW.md#ui-v0148--서버-v0113-유지--2026-11-03).

## 0.1.47 — 2026-11-03 (extension + server v0.1.13)

- History no longer follows the drawing mode: **이 채팅 / 모든 채팅 / 프리샷 / 전체 보기**. The server filters chat images before pagination and summaries. Restoring a free image opens 프리샷. The attach action stays in every menu, disabled with a reason for free or other-chat images.
- Restore two-column mobile history; compact Anlas balance and generation summary; give selected drawing modes a filled background in all skins; add touch minus/plus controls for the reference-message count. Explain the supported three sizes / 28-step limit and both V5 (22) / V4.5 (6) character limits.
- Save/⋯ menus toggle closed on a second tap and close when their anchor scrolls. Space the caret, keep menus on the available side of the button, and include the full PNG metadata/opaque-copy explanation at each save surface. Viewer delete is **삭제**; remove dialog-container focus outlines while preserving control keyboard focus rings.
- Wardrobe outfits are compact expandable buttons, with **제거** and a confirmation. Add/reset actions no longer focus or scroll to text inputs. Notices are more visible and stay with their originating tab, including asynchronous results.
- Rename retention settings to **AI 응답 보관**; show **개인정보 주의** for extraction responses and settings backups. Separate the last-work deletion section. Keep existing destructive confirmations and add wardrobe-removal confirmation.
- Chat image placement gains a per-chat override of the global default, stored in chat metadata.
- Update order: server → restart SillyTavern → extension → refresh. Tests and review notes: `TEST-REPORT.md`, `docs/REVIEW.md`. No guide screen added.

## 0.1.46 — 2026-11-03

**Update: extension + server 0.1.12.** Update the server, restart SillyTavern, then update and refresh the extension.

- **Anlas balance in the drawing tab**, right above 이미지 생성: `Anlas 1,234 · 12:00 확인` with **↻**. The same check feeds Settings → 서버·NAI 연결 확인 and is refreshed after each image. Differences are shown as **이전 조회보다 −N** (since the last check), never as the price of one image. A failed check shows **잔액 확인 실패 · 다시 확인**; an image that was made stays a success even if the balance check after it fails.
- **Cost line worded for the account:** Tablet·Scroll "이 생성은 Anlas를 사용해요."; Opus V5 "무료 사용량에 따라 Anlas가 차감될 수 있어요." with **NovelAI에서 확인**; Opus V4.5 within limits "Opus 무료 조건…"; account not checked "비용 조건을 확인하지 못했어요."
- **Consent switch kept as is (one switch).** With it off, a known cost-bearing generation is not sent, with a note and **Anlas 허용 설정으로 이동**, which scrolls to and highlights the switch without turning it on. If the account is not checked, the server decides and its refusal (`anlas-consent`, HTTP 428) shows the same note.
- **NovelAI errors named only when clear** (server 0.1.12): `nai-auth` "NAI 키를 확인해 주세요.", `nai-anlas` "Anlas가 부족해요.", `nai-permission` "이 모델의 사용 권한을 확인해 주세요.", `nai-busy`, `nai-down`; otherwise `nai-rejected` "NovelAI가 요청을 거절했어요. 계정 상태와 생성 설정을 확인해 주세요." A status number alone never means "not enough Anlas". NovelAI's short note is added in brackets (≤120 characters, credentials removed). Anlas or key errors re-check the balance.
- README: any subscription can use the extension; free-trial API use is unverified.

## 0.1.45 — 2026-11-03

**Update: extension only.** Server 0.1.11 is unchanged.

- **A failed deletion loses nothing (UI-043-01, P1).** Before deleting saved work, saves are now held instead of dropped. If the deletion succeeds, the deleted chats' held edits are discarded as before; if it fails, the held edits are sent again and the notice says "삭제하지 못했어요. 작업은 그대로예요." Applies to 저장된 작업 모두 지우기 and 이 채팅 이력 전체 삭제.
- **History deletion always empties the drawing window (UI-043-02, P2),** even when the chat had no saved work file yet (an edit typed just before deleting).
- Saving several images one at a time now says "N장 저장을 시작했어요. 다운로드 목록에서 확인해 주세요." — the browser does not report finished downloads.
- docs/REVIEW.md now includes the GPT re-check from the review branch.

## 0.1.44 — 2026-11-03

**Update: extension + server 0.1.11.** Update the server, restart SillyTavern, then update and refresh the extension.

- **Deleted work stays deleted, even with another window open.** Deleting saved work now leaves a small marker on the server with a new revision and no content. A save prepared before the deletion — in another window or on another device, including that window's first save — is refused with the usual conflict notice instead of bringing the work back. This closes the limit noted in 0.1.43.
- After deleting, the extension reads the marker for the open work and saves on top of it; other chats read theirs when opened again. Deletion markers hold no prompts or descriptions.
- The server asks for extension 0.1.44 or newer, and the extension asks for server 0.1.11 (`draft-tombstone`).
- Test fix: `browser-v040` waited for an image that was already on screen and could read the previous NovelAI request; it now waits for the new request.

## 0.1.43 — 2026-11-03

**Update: extension only.** Server 0.1.10 is unchanged.

- **Deleted work no longer comes back (UI-042-02, P1).** Deleting saved work (설정 → 저장된 작업 모두 지우기, or a chat's whole history) now locks the drawing window, drops saves that have not been sent, waits for saves already on their way, and only then deletes. Saved-work bookkeeping has a generation per chat: replies to reads or saves sent before a deletion are ignored, so a late reply cannot restore an old revision and the next edit saves without a conflict.
- **프리샷 work waiting off screen is emptied too (UI-042-03, P2).** Deleting 프리샷 history from 챗샷 (all-chats view) also empties the 프리샷 work kept in memory, so switching back shows an empty window and nothing is saved back.
- An empty drawing window is not saved as a new empty work file when the chat has none.
- **Separate files note:** with several images selected and ZIP off, the save menu says "여러 파일 다운로드 허용이 필요할 수 있어요. 일부가 저장되지 않으면 ZIP으로 받아 주세요." The note disappears with ZIP on or one image. The finished-saving notice is shorter and suggests ZIP only when a file could not be read.
- Known limit: another window or device whose *first* save for that chat arrives after the deletion can still create a new work file. Windows that saved before are refused with the usual conflict notice.

## 0.1.42 — 2026-11-03

**Update: extension + server 0.1.10.** Update the server, restart SillyTavern, then update and refresh the extension.

- **History cards:** the date (to the minute) and **저장 ▾ / 삭제 / ⋯**. 불러오기 and 본문에 넣기 move into ⋯; 삭제 asks before deleting. The seed leaves the card and appears in the enlarged viewer with **seed N 복사**; it is still stored for restoring and same-seed drawing.
- **One save menu everywhere** (result, history card, selection, viewer, attached image): **공유용 PNG** "프롬프트·생성 설정 메타데이터를 제거한 사본" first and highlighted, then **원본 PNG** "프롬프트·seed 등 생성 메타데이터가 포함될 수 있어요." No title, no cancel button, no extra warning after choosing 원본 and no "다시 묻지 않기". A chevron on the button shows it opens a menu; a click elsewhere, Escape or the button itself folds it. Menus open below their button, or above it near the bottom of the screen.
- **Several images:** **ZIP 파일 하나로 묶기** — on: **공유용 ZIP / 원본 ZIP**; off: one PNG at a time, missing files skipped and counted. First default: separate files on a computer, ZIP on touch devices; the last choice is remembered.
- **Hover fix:** SillyTavern brightens links on hover, which washed out 원본 PNG on light skins. NAIce Shot links no longer inherit that filter (checked on all 17 skins).
- **프리샷 history keeps its situation text** (server 0.1.10). Restoring a 프리샷 image or sending it to 프리샷 brings the text back. Images saved by older servers have no text to restore.
- **Restored-work notice** names the target message: "이 채팅에서 작업하던 장면을 불러왔어요 · 대상 메시지 #N" (or 최신).
- **Deleting saved work:** 설정 → 개인정보 보관 → **저장된 작업 모두 지우기**; **이 채팅 이력 전체 삭제** also deletes that chat's saved work. The drawing window is emptied without undo, and nothing is saved straight back.
- The server version check now asks for server 0.1.10 (`draft-delete`, `free-text`).
- Tests: a shared browser helper opens menus the way a person would; `browser-v0125` waits for the asynchronously opened panel instead of reading the target too early.

## 0.1.41 — 2026-11-03

**Update: extension + server 0.1.9.** Restart SillyTavern after updating the server, then refresh the extension.

- **Last work per chat** is stored server-side and restored after returning or refreshing, without another AI request. It includes candidates, direct-input people, wished moment, target, manual prompt edits, one-off options and preview. 프리샷 uses a separate work bucket.
- Clearing stores an empty work plus **one undo**. Undo survives chat changes and refresh; editing, extracting or generating ends it. Source signatures are kept instead of a second copy of chat text; changed source/swipes trigger a visible reminder.
- Debounced saves show pending/error status and retry. Writes are serialized per work key with revision checks: a different window/device's save is never silently overwritten. Failed work stays on screen. Clean chat caches are bounded; failed/unsaved work stays in memory.
- Successful generation consumes submitted final/option overrides in the stored work too, including a generation that completes after leaving the chat. Failed generation preserves them. Older partial history scene snapshots receive missing empty fields when restored.
- **장면 → 그리기** tab. **문제 제보용 추출 응답 보관** stays off by default, gains a short explanation, confirmation on enable and an on/off status. Off also omits raw responses from work drafts; existing image history is unchanged.
- Original PNG and selection ZIP downloads ask about metadata, with **공유용 저장 / 원본 저장 / 취소** and **새로고침 전까지 다시 묻지 않기**. Shared downloads do not warn. Menu notes distinguish metadata inclusion/removal; visible text in a picture is not removed.
- Stage three (message badges, per-image placement and navigation) and the in-panel guide are not included.

## 0.1.40 — 2026-11-03

**Update: extension only.** Server 0.1.8 is unchanged.

- History cards show **불러오기 / 본문에 넣기 / ⋯** in one row. Downloads, presets and 프리샷 are in ⋯; **그림 삭제** is last, below a separator. All-chats cards retain their existing read-only actions.
- **프롬프트 보기** moves into the enlarged image viewer with a clear **프롬프트 복사** button and copy feedback. Attachment prompts load from history only when expanded. **추출 응답 확인** gains **응답 복사**. Blocked copying no longer reports success.
- New-preset forms put **저장 / 취소** side by side. History preset guidance is shorter and still identifies when common Positive comes from current settings.
- Attached images show one corner **⋯** instead of three buttons. Both its menu and the enlarged attachment viewer offer **이 메시지에서 빼기**. This removes that message's copy, including its swipe copies, while preserving other messages, the original PNG and history. Changed messages/swipes/chats are refused; failed saves restore the attachment.
- Scene labels use **+ 캐릭터 프롬프트**, **프로필 / 직접 입력**, and **AI 선택**. The character-limit hint follows the selected model, including one-off history options.
- This is stage one of the screen cleanup. Per-chat work persistence and message/image navigation are not included yet.

## 0.1.39 — 2026-11-03

**Update: extension only.** Server 0.1.8 is unchanged; 프리샷 images use their own history bucket, which the server already accepts.

- **챗샷 / 프리샷** switch at the top of the scene tab. Each mode keeps its own work (people, scene, candidates, final prompt, one-off options, preview, text) while the other is in use. Switching is off during extraction or generation.
- **프리샷**: draw with no chat at all.
  - Write a situation, Korean is fine, and press **글로 채우기**. One request fills the scene fields.
  - Profiles already added are "selected" and keep their saved look; the text AI never sees saved appearances. A roster name in the text also uses that profile.
  - Anyone else becomes or updates a **temporary person** with the appearance the text gives. The same person is never doubled.
  - Several actions collapse into one instant. Fields come back in English, with one retry if not.
  - Clothes start from the profile's default outfit; chat clothes are never read or changed. Cards show 이번 그림 복장, 옷장에서 꺼내 입기, 옷장에 저장 and 되돌리기 only.
  - Images go to a separate 프리샷 history ("프리샷" in the history tab and the all-chats view) with nothing to attach to a message. Restoring one brings its text back.
  - A chat change leaves 프리샷 alone.
- **이력 → 프리샷으로 보내기** (chat and all-chats history) loads the image's chosen moment, final prompt and generation options into 프리샷. The previous 프리샷 work is one 되돌리기 away.
- **그리기창 비우기** replaces 직접 입력 in both modes.
  - It empties the people, scene, candidates, wished moment, target message (back to latest), final-prompt edits, one-off history options, preview and extraction response, or the 프리샷 text.
  - It keeps profiles, wardrobes, chat clothes, settings, presets, common prompts and history.
  - It is off while extracting or generating.
- **되돌리기** stays until the next edit, extraction, generation or chat change, and survives tab switches. It restores everything together.
- Added `tests/browser-v0139.mjs` and `tests/free-scene.test.mjs`; older tests point at the 챗샷 clear button.

## 0.1.38 — 2026-11-03

**Update: extension only.** Server 0.1.8 is unchanged.

- Generation settings box in the scene tab (생성), folded by default. The summary shows its scope and the values (model, size, steps, Guidance, seed). Inside: model, size, steps (max 28), Guidance and seed, with CFG Rescale and Sampler under 더 보기.
  - Normally it reads **기본 생성 설정 · 다음 생성에도 유지**. These are the settings tab's own values, edited in place, and the settings tab follows.
  - While history options are in use it reads **이력 설정 · 이번 생성에만**. Edits go to that one-off copy only, and **기본 설정으로 돌아가기** leaves it.
  - Presets from the box: "수정됨" when values differ from the chosen preset, **‘이름’에 덮어쓰기** naming its target and asking first, and **새 프리셋으로 저장** with a name. Hidden while history options are in use.
- History cards: **설정을 프리셋으로** saves a new preset without generating and without changing current work or the chosen preset.
  - It takes model, size, steps, Guidance, CFG and Sampler from the image, with seed set to a new seed.
  - The common Negative comes from the image too.
  - The common Positive comes from the image when it separates cleanly from the scene part; otherwise it uses the settings tab's current value, and the notice says which.
  - People and scene prompts are never included.
- Generating a scene that was never extracted or entered now asks first: "인물·장소 없이 공통 프롬프트만으로 그릴까요?" Cancelling sends nothing.
- Added `tests/browser-v0138.mjs`. `browser-v0119` accepts the new confirm, and `browser-v0117` matches the reworded no-profile note.

## 0.1.37 — 2026-11-03

**Update: extension only.** Server 0.1.8 is unchanged.

- Temporary people (임시 인물): draw someone without making a profile.
  - **임시로 그리기** next to a name in the "no profile" list brings along the expression, action, position and clothes the extraction found.
  - **임시 인물 추가** in the add row starts a blank one. It also works with no profiles at all.
  - Each card has a name (display only, never in the image prompt), a subject tag, appearance, clothes, expression, action and position.
  - The person counts toward the boy/girl/other tags and gets their own character slot.
  - A note appears when appearance is empty.
- Lifetime:
  - kept through regeneration and saved in history (restoring brings them back)
  - removed with **빼기**, by a chat change or by 직접 입력
  - on re-extraction and on switching candidates they stay, but the card asks "지금 장면에도 있는지 확인해 주세요" unless the AI found that name again, in which case its fresh expression, action and clothes are used and the appearance is kept
- **프로필로 저장** opens the profile form filled with the name, subject, appearance and clothes, but not this scene's expression or action. Saving turns the temporary slot into the new profile's slot in every candidate, so nobody is doubled.
- Added `tests/browser-v0137.mjs`.

## 0.1.36 — 2026-11-03

**Update: extension only.** Server 0.1.8 is unchanged.

- Plain names on the scene card:
  - **채팅 기본 복장**: button "기본 복장 지정", which turns into "✓ 채팅 기본 복장"
  - **복장 잠금** (🔒)
  - **이번 그림 복장**
  - **옷장에 저장**
- One-line notes. The chat default reads "메시지에 복장 설명이 없으면 이 채팅에서 기본으로 입는 옷이에요."
- Fixed: a chat default could not be cleared. Pressing "✓ 채팅 기본 복장" again clears it, and so does "정하지 않음 · 프로필 기본 복장" in the picker. The chat then follows the profile's default outfit, and a lock stays on if it was on.
- Locking alone no longer sets a chat default outfit.
- The button's state follows typing in 이번 그림 복장 immediately, so a stale "✓" can never clear a default by mistake.

## 0.1.35 — 2026-11-03

**Update: extension only.** Server 0.1.8 is unchanged.

- Fixed: extracting from a Korean chat could return Korean descriptive fields. The prompt now requires English for expression, action, outfit, interaction, location, lighting and camera; titles and names may stay in another language. If Korean, Japanese or Chinese still appears in those fields, the extension asks once more for English, keeping structured output. If the second reply is still not English, it is used with a note naming the fields.
- "당분간 이 복장" is now **이 채팅 기본 복장**, and its button is **이 채팅 기본으로**. The note explains that a message can still change clothes for one image, and that 평생 박제 stops that.
- Clothes state is visible at a glance:
  - badges under the name: 👕 이 채팅 기본 옷 · 📌 평생 박제
  - a lit picker when this chat has its own outfit
  - the button turns into "✓ 이 채팅 기본 옷" while the image wears that outfit
  - a lit lock

## 0.1.34 — 2026-11-03

**Update: extension only.** Server 0.1.8 is unchanged.

- Leftover clothing wording now uses the scene card's terms:
  - the past-message and earlier-moment warnings
  - the history help and restore notice
  - the backup note, which now also lists the wardrobe
  - the locked-outfit warning
- The card shows what this chat has saved under 당분간 이 복장 ("✓ 이 채팅에 저장된 옷: … · 평생 박제"), or that nothing is saved yet. The line flashes once after "이 옷 당분간 입기" or a pick, so the save is visible where it happened.
- "지금 옷" for an AI-found outfit says it is used instead of the saved one for this image.

## 0.1.33 — 2026-11-03

**Update: UI + server.** Update NAIce Shot, then restart SillyTavern so the server plugin updates to 0.1.8 (only its shared core changed: profiles now carry a wardrobe).

- Wardrobe (옷장): each profile keeps named outfits to pick from, edited in the profile form. Adding to the wardrobe never changes the default outfit. A missing wardrobe is empty, and backups include it.
- Clothes on a scene card, each with a one-line note:
  - **당분간 이 복장**: pick the default outfit or a wardrobe item to keep wearing in this chat. It also goes on this image, even over a locked or AI-found outfit.
  - **평생 박제**: the extraction AI cannot change clothes in this chat. Clothes the user picks still apply.
  - **입고 버림 · 이번 그림의 옷**: this image only. "옷장에서 꺼내 입기" fills it from the wardrobe without touching the chat.
  - **이 옷 당분간 입기**: keeps what is in that field for this chat.
  - **옷장으로**: stores it in the profile's wardrobe under a name; empty or repeated names are refused. An open profile form gets the new item too.
  - **되돌리기**
- Picked clothes are stored as a copy, so later wardrobe edits or deletions never rewrite clothes already saved in a chat or used in history.
- "지금 옷" now reads as a sentence (프로필 기본 복장 / 당분간 입는 옷 / 평생 박제된 옷 / AI가 찾은 새 옷 · 확인해 주세요 / 직접 고르거나 고친 옷).
- History cards have **프롬프트 보기**: model, size, steps, seed, common Positive/Negative and each person's prompt as sent, with a copy button. It is built only when opened, from data the list already has.
- Added `tests/browser-v0133.mjs` and a wardrobe test in `core.test.mjs`.

## 0.1.32 — 2026-11-03

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Moment splitting rules are concrete. A new beat starts when an object starts or stops being held or used, the main action or pose changes, the place or doorway changes, or someone arrives or leaves. Head turns, glances, hand gestures and facial changes alone do not count. Brief but distinctive actions and objects (taking out a phone to type) are kept on purpose. With more than three beats, the final beat is always kept, plus the two most different, preferring brief distinctive ones.
- Cut-off replies are told apart from short ones. When the reply's JSON never closes, the notice says "응답이 불완전해요" and explains where the response length comes from: the main connection's preset, or the separate connection's limit. Candidates salvaged from a cut-off reply are not labelled "마지막 순간", and the notice warns that the final moment may be missing. A complete reply with fewer candidates is not flagged. The API's finish reason is not available to the extension, so the JSON's shape is the signal.
- 추출 AI settings:
  - New guidance: use a separate connection, start at 8192, and the limit is only a ceiling.
  - New "권장값 적용 · 8192" button.
  - New optional "추출 온도", sent with a separate extraction connection's request only. Empty keeps the connection's own value, and the main connection is never changed. It has an effect only on models that honour temperature.
- New users start with an 8192 response limit and one message. Existing users keep their values.
- "참고 메시지 수" is now "보낼 메시지 수 · 대상 포함", with a note that earlier messages explain the current state and candidates come only from the target.
- Positions: the AI no longer picks a side to make a composition. A placement stated in the text is followed and may stay in the action wording. Relations such as facing each other or across the table are always kept. A position chosen by hand survives re-extracting the same message, on every candidate.
- Added `tests/browser-v0132.mjs`; `moments.test.mjs` covers the new rules and cut-off detection.

## 0.1.31 — 2026-11-03

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Scene candidates: one extraction now returns up to three visually distinct moments of the target message (for example eating at the table, standing up, walking out), in story order. The final moment is chosen by default. Only the target message supplies moments; earlier messages are context.
- Each candidate is a complete picture of one instant with its own people, actions, expressions, outfits, place and camera. The prompt tells the AI to keep what still holds (clothing, objects still held, the place) and to leave out what happens before or after.
- Picking another candidate needs no AI call and replaces every scene field, including the missing-profile hints. Edits stay with their own candidate. A hand-edited final prompt asks before it is replaced. The picker is hidden when the message has one scene.
- New optional field "그리고 싶은 순간". Use it when the wanted moment is not among the candidates. It is sent as data, matched to the default candidate, and reported when not found. It is kept for regeneration and cleared when the target message or chat changes.
- A reply cut off mid-way keeps the candidates that arrived complete instead of failing.
- History keeps every candidate, the choice and the edits, so a restored image can switch to another moment without re-extracting.
- Choosing an earlier moment shows a note that clothing may have changed by the end of the message. "현재 복장으로 저장" is best used on the final moment.
- Older single-scene replies still work.
- Added `tests/moments.test.mjs` and `tests/browser-v0131.mjs`.

## 0.1.30 — 2026-11-02

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Message draw button: the icon now takes the size of the font icons beside it, so it lines up with them. SillyTavern cuts a crowded extra-menu row from the start (some chat themes make the row narrow), which hid other extensions' buttons; while our button is in a row, that row wraps to a second line instead, so no button disappears.
- Image size: only the three free sizes remain (세로 832×1216, 정사각형 1024×1024, 가로 1216×832), with the note "세 크기 모두 Opus 무료 범위예요." Custom width/height are gone and steps are capped at 28, so no one is charged Anlas for a size or step count by accident. Saved custom sizes, imported backups and history drafts fall back to 세로 and 28 steps. The V5 note under "Anlas 사용 가능성 허용" now says V5 needs that box and that the remaining free usage is only visible on the NovelAI site.
- 테마 is now a card at the top of Settings. Folded, it shows only the current theme's colors (the name is read out to screen readers and shown as a tooltip); pressing it opens the list.
- Removed the 코코아 theme; anyone who had it gets the default look. 초코우유's background is lighter again.
- Added `tests/browser-v0130.mjs` (free-size fallback and notes); `browser-v0123` now checks the icon size and that no button in a crowded row is cut.

## 0.1.29 — 2026-11-02

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Fixed: the message draw button's icon disappeared under chat themes that clear every message button's background, and was cut off when a crowded button row was clipped from the start. The icon now sits on its own inner box that themes do not restyle, and the button is added at the end of the extra message menu.
- Four look-alike light themes now differ at a glance. 우유: milk-carton blue header with a milky wave and a blue selected tab. 크림 노트: faintly lined note paper and a caramel index tab. 커피우유: deep latte body, milk-foam header, coffee tab. 초코우유: pink cocoa milk with chocolate dripping from the top and a dark chocolate tab. 미니멀 stays the plain one.
- `browser-v0123` now loads a hostile chat theme (all button backgrounds cleared, narrow clipped row); it fails on 0.1.28 and passes now.

## 0.1.28 — 2026-11-01

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- "스킨" is now called **테마** in Settings. The theme list is folded by default; the title row shows the theme in use and opens the list. Saved choices carry over unchanged.
- 크리스마스 redesigned: a snow-dusted tree with a gold star, a fir garland with snow, berries and baubles under the header, snow on the selected tab and main buttons, and a snowdrift along the bottom.
- New 눈 오는 밤: navy night sky with soft falling snow, a string of colored lights, a crescent moon, and berry-red buttons with a gold rim.
- New 캔디케인: cream paper with a red-and-white candy stripe, holly with berries, green selected tabs and striped red buttons.
- Decorations are background pictures only, so the layout stays identical on every theme; they shrink on phones so they never cross the header text. Snow behind text is kept faint for readability.
- Tests updated for eighteen themes and the folded list; `browser-v019` (stale count since 0.1.27) passes again.

## 0.1.27 — 2026-10-31

**Update: extension only.** Update NAIce Shot and refresh. The server plugin is unchanged (0.1.7).

- Add 크리스마스 as the sixteenth skin: evergreen background, berry-red primary buttons/selected tabs, vanilla-cream secondary buttons, gold accents and a small static tree in the header. Includes matching viewer accents.
- Keep all fifteen existing skins and their palettes. The new skin uses one optional CSS file, with its small vector decoration embedded locally; no animation, external image/font requests or extra runtime dependencies.

## 0.1.26 — 2026-10-30

**Update: extension only.** Update NAIce Shot and refresh. The server plugin is unchanged (0.1.7).

- Remember the target-message list's own scroll position and loaded rows when collapsing/reopening, switching tabs, closing/reopening the panel and refreshing messages. Reopening no longer forces the list back to the selected row.
- A direct message draw icon reveals its newly chosen target once; subsequent browsing is remembered. Choosing latest or switching chats starts at the top. Position memory lasts for the current page session.

## 0.1.25 — 2026-10-29

**Update: extension only.** Update NAIce Shot and refresh. The server plugin is unchanged (0.1.7).

- Hidden RP messages now appear in the target picker with a 숨김 label and keep the optional message draw icon. Existing dropdown styling and the scrolling list that grows ten at a time are retained. Live hide/unhide changes refresh the label without removing the icon.
- Explicitly selecting a hidden target permits hidden RP within its preceding reference-message range for scene extraction. Latest mode and visible targets still exclude hidden history. The request is built from a temporary view; no message is unhidden or rewritten. Added an on-screen explanation of which hidden text is sent to the extraction AI.
- Allow image attachment/display on a hidden RP message while preserving its hide flag, text, native media and swipe data. Explicitly typed system notices and system UI messages stay excluded.
- SillyTavern stores hide and system status in the same flag. Records without system-type/UI metadata are treated as potentially hidden RP and appear for manual selection; latest mode still excludes them. No name-based guesses are used.

## 0.1.24 — 2026-10-29

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- 대상 메시지 now looks like a dropdown: a bordered box with a chevron that turns when open, so it is clearly pressable.
- Opening it shows one scrolling list instead of pages: "가장 최근 메시지" first, then messages newest first. "이전 메시지 N개 더 보기" at the bottom adds ten more each time. Rows look like buttons and the chosen one has a ✓.
- Reopening scrolls straight to the chosen message. Still builds nothing while closed and only ten rows at first, even for very long chats.
- Removed the 더 이전 / 더 최근 page buttons. `browser-v0122` rewritten for the new picker; `browser-v0121` counts message rows only.

## 0.1.23 — 2026-10-29

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- New brand icon everywhere (extensions menu, settings drawer, panel header and the new message button): a viewfinder frame around a prism star — yellow with pink, sky, mint and lavender tips. Drawn with plain shapes (no gradient ids), so it stays correct when it appears many times or inside a hidden panel. The 미니멀 skin now shows it in color too.
- Settings → 채팅 속 그림 위치 → **메시지에 그리기 버튼 표시** (off by default). When on, every AI and user message (not system or empty ones) gets the icon in its extra message menu (…). Pressing it opens the scene tab with that message as the target; 장면 추출 and 생성 are still pressed by hand. While an extraction or generation is running it does not switch the target and says "진행 중인 작업이 끝난 뒤 선택해 주세요".
- Off means fully idle: no chat listener and no message scan. Turning it off removes every button at once; turning it on adds them to the messages already on screen.
- Light on long chats: one delegated listener for all buttons, already-decorated messages are skipped, and each button is an empty box showing one shared icon image. Measured on 1,000 messages: streaming frame times unchanged (≈16.7 ms) and a full chat rebuild costs the same with the setting on or off.
- Added `tests/browser-v0123.mjs`; the test fixture's messages now carry SillyTavern-style message buttons.

## 0.1.22 — 2026-10-29

**Update: extension only.** Update NAIce Shot and refresh. Server 0.1.7 is unchanged.

- Replace the browser-native target-message dropdown with an expandable HTML picker. Show ten messages per page, newest first, with explicit newer/older buttons so reaching old messages does not depend on native popup scrolling.
- Build at most ten preview buttons while open and none while closed. Keep the selected target while browsing pages or receiving a new message; reset it when switching chats. The latest-message shortcut continues to follow the newest message.

## 0.1.21 — 2026-10-29

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- List target messages newest first while preserving their original message IDs and the current selection.
- Remember separate scroll positions for Scene, Profiles, Settings and History while navigating tabs and closing/reopening the panel. History refreshes preserve the visible position too. Positions live only in the current page session and reset on a browser refresh.

## 0.1.20 — 2026-10-27

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Recover saved profiles by name, alias and linked card name across character chats, including people the extraction AI incorrectly lists as unregistered. Identity checks remain exact and ambiguous aliases are never guessed. Name separators and Korean spacing are normalized consistently.
- Extract visible expressions, actions, positions and explicitly described clothing for every visible person, including unregistered side characters. Keep unresolved visual fields with the scene; later profile creation, manual addition or linking restores them without another AI call. Side characters can now link to an existing profile too; undo preserves their extracted fields.
- Include manually added scene profiles in the next extraction roster. Candidate profiles are never forced into a scene when not actually visible.
- Existing name-only extraction/history data remains readable, but missing actions from older records require a new scene extraction. The new extraction schema/prompt is browser-only; no server update is needed.

## 0.1.19 — 2026-10-27

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. No server update is needed.

- The final prompt edit and history generation options now apply to one successful generation, then return to the assembled scene and current Settings values. Failed requests keep the draft for retry; a new edit made during a request is preserved.
- Switching chats now refreshes the final prompt fields even when an editor still has keyboard focus, so the previous chat’s prompt cannot remain visible.
- **조립 결과로 되돌리기** clears both the edited prompt and history generation options, including the old seed.
- Added state/handler and browser regression tests for generation, reset and chat changes.

## 0.1.18 — 2026-10-27

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

Fixes from an outside review of 0.1.17's missing-profile warning:

- **Chat switching:** the generate warning belongs to the chat and scene it was opened for. Switching chats or closing the panel closes it; 그래도 그리기 refuses to generate if the chat or scene changed. A profile started from the warning only links to the card/user of the chat it was started in.
- **Failed saves:** if saving that profile fails (for example an over-long alias), fixing the error and saving again still links it to the card/user.
- **Name matching:** an exact name always wins over a shorter one. A short name counts only when it is the first name ("Ana" for "Ana Reyes") or, in Korean, the given name without the family name ("민수" for "김민수"), and only when it fits exactly one person. Surnames alone, reordered names and descriptions that contain a name no longer match. Korean names ignore spacing (김 민수 = 김민수).
- **기존 프로필 연결하기:** adds the exact name as an alias whenever it is missing (before, a partial match could skip it); refuses a name another profile already uses and says which one; group members also get their card linked. A **연결 되돌리기** button right after linking restores the alias, the chat link and the scene.
- **Warning dialog:** now a real modal — Tab stays inside, Escape closes only the warning. "이 채팅에서 다시 묻지 않기" is saved only by 그래도 그리기 (no longer by 취소 or by the create button), and a **경고창 다시 켜기** button appears while it is off.
- **Clearer notes:** both the warning box and the dialog say that the card/persona description text (first 4,000 characters) goes to the extraction AI, usually once and up to twice if the reply can't be read.
- **Group members:** `{{char}}` and `{{user}}` in a member's card description are filled in before sending.
- Added `tests/browser-v0118.mjs`; more cases in `tests/missing.test.mjs`.

## 0.1.17 — 2026-10-27

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- People without a profile are left out of the image; NAIce Shot now says so clearly.
  - **The chat's own people** — the open character card, group members and the user (persona) — get a strong warning box in the scene editor: "⚠ … 프로필이 없어서 이번 그림에 안 그려져요." with three fixes:
    - **직접 만들기**: opens the new-profile form with the name filled in.
    - **캐릭터 카드에서 만들기** / **페르소나에서 만들기**: sends the card (or persona) description to the extraction AI and fills fixed appearance, default outfit, Negative and the person tag for review (one extraction call; a note under the buttons says so). Descriptions over 4,000 characters are cut, and an empty result says to fill the appearance by hand. Disabled when the description is empty.
    - **기존 프로필 연결하기**: pick a saved profile; "이 이름을 별칭에도 추가" (on by default) makes it match automatically next time. For the open card or the user, this chat's profile link is set too.
    - Saving a profile started from the warning links it to the open card (or to the user for this chat).
  - **Side characters** keep the small "프로필 만들기" chips, with gentler wording.
  - A line above 이미지 생성 lists everyone left out of this image.
  - Pressing 이미지 생성 while one of the chat's own people would be left out opens a dialog: create from card/persona, **그래도 그리기**, or **취소**, with **이 채팅에서 다시 묻지 않기**. The warning box and the line stay visible either way.
- Added `missing.mjs`, `tests/missing.test.mjs` and `tests/browser-v0117.mjs`.

## 0.1.16 — 2026-10-26

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Added **코코아** as a separate skin: warm milk-cocoa brown, ivory text, softly rounded cocoa fields and gently raised vanilla-cream buttons. The image viewer uses the matching cream accent. All fourteen existing skins remain available and unchanged, including 초코우유, 커피우유 and 크림 노트.

## 0.1.15 — 2026-10-25

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Added **애플 크림**: a warm cream background, red apple buttons and active tabs, green leaf checkboxes and accents. Available in Settings → 스킨; fourteen skins in total. The image viewer uses the same red and green palette.

## 0.1.14 — 2026-10-25

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Five milk skins: **우유** (creamy white, milk-carton blue), **딸기우유** (strawberry pink), **바나나우유** (banana yellow, brown ink), **초코우유** (cocoa milk, dark chocolate buttons) and **커피우유** (latte beige, coffee-brown buttons). All rounded, with pill tabs. Thirteen skins in total; all pass the text, checkbox and field contrast checks.

## 0.1.13 — 2026-10-25

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- New skins: **딥 블루** (deep indigo panel, sky-blue pill tabs with a soft glow, blue gradient main buttons) and **라벤더** (milky lavender panel, purple-pink-peach gradient main buttons and progress line, round pill tabs). Eight skins in total; both pass the same text, checkbox and field contrast checks as the others.

## 0.1.12 — 2026-10-24

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Fixed: starting a profile tag conversion and then pressing 모든 칸 비우기 or + 새 프로필 만들기 let the late result fill the emptied form. Clearing the form now cancels the conversion, and any result that still arrives is ignored if the form was reset in the meantime.
- Fixed: leaving the panel on the 이력 tab, switching chats and reopening showed "아직 생성 이력이 없어요" until the tab was clicked again. Reopening now loads the current chat's history.
- Fixed: picking skins quickly could end on an earlier skin whose file loaded later, and saved that earlier choice. Only the latest pick can apply now; slower, superseded skin files are dropped.
- Tests: `browser-v040`'s missing-PNG step now bypasses the browser's in-memory image cache, which could keep showing a deleted image and made the step fail intermittently. Added `tests/browser-v0112.mjs`.

## 0.1.11 — 2026-10-24

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Image preset buttons reorganized:
  - **+ 새 프리셋 만들기** clears the common positive/negative prompts, resets NAI generation settings to the defaults, deselects the preset and empties the name field (asks first when there is anything to lose; saved presets are untouched).
  - **프리셋 저장** overwrites the selected preset with the current values, or creates a new preset when none is selected.
  - **새 프리셋으로 저장** (was "현재 값 새로 저장") always saves the current values as an additional preset.
  - "선택 프리셋 덮어쓰기" is gone (프리셋 저장 does that). A hint under the buttons says what 프리셋 저장 will do right now. An empty name is refused with a clear message.
- Added `tests/browser-v0111.mjs`.

## 0.1.10 — 2026-10-24

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Skins: 파스텔 is now sky blue and butter yellow (yellow main buttons, sky tabs with a yellow underline, a sunny halo behind the camera). New skins **크림 노트** (warm paper and caramel) and **말차 라떼** (soft green tea). Six skins in total.
- The skin picker moved to the bottom of the settings tab.
- Fixed the settings backup row on iPhone Safari: since 0.1.9 the hidden file picker behind "백업 가져오기" was drawn as a second "파일 선택" button overlapping the text below. The picker now stays invisible and exactly covers its button.
- Extensions menu: the color camera now sits in SillyTavern's standard 20px icon box, so the icon and the name line up with the other extensions.
- Added `tests/browser-v0110.mjs`.

## 0.1.9 — 2026-10-24

**Update: extension only.** Update NAIce Shot from Manage extensions and refresh. The server plugin is unchanged (0.1.7).

- Settings panel entry: now uses SillyTavern's own drawer (same bordered header and chevron as other extensions) and is attached immediately instead of after the panel file loads, so it no longer always lands at the bottom of the extension list. Clicking 열기 while the panel is still loading opens it once ready.
- Text fields and dropdowns keep the panel's colors even when a SillyTavern theme forces every input to white (or dark) with `!important`; before, a light theme could leave light text on a white box.
- Removed the 네온 skin. Anyone who had it selected gets the built-in 기본 look.
- 글래스 rebuilt as frosted glass: a lighter translucent pane with a strong blur so the page shows through, a diagonal sheen, bright hairline edges and see-through cards and fields, with solid dropdown lists.
- README: step-by-step install for phones running SillyTavern in Termux.
- Added `tests/browser-v019.mjs`.

## 0.1.8 — 2026-10-24

**Install change: the extension is now installable by URL; the server plugin moved to [NAIce-Shot-Server](https://github.com/Near7707/NAIce-Shot-Server).** Coming from a manual install, delete the old `extensions/naice-shot/` and `plugins/naice-shot-server/` folders first (see README). Server code is unchanged (still 0.1.7).

- Repository split: the extension files now sit at this repository's root (`manifest.json` at the top), so SillyTavern's **Install extension** accepts `https://github.com/Near7707/NAIce-Shot` and **Manage extensions** can update it. The server plugin and its tests live in NAIce-Shot-Server; cloned with git into `plugins/`, SillyTavern auto-updates it on start.
- Removed `install.sh` (it copied the old `ui/` and `server/` folders).
- Version-mismatch banner and the all-chats notice now describe the git-based update instead of ZIP folders.
- Image viewer on phones: the toolbar is back to two rows at 375px (0.1.7's shared-copy button had pushed it to four); very narrow screens (≤360px) use three rows without overflow.
- Tests: paths updated for the new layout; server-driven tests find NAIce-Shot-Server next to this repository and skip otherwise. Fixed three tests left stale by 0.1.7 (new feature flag, extra inline button, reworded import notice).

## 0.1.7 — 2026-10-24

**Update: UI + server. Replace both components, restart SillyTavern and refresh.**

- Added `공유용 PNG` to result, history, viewer and chat attachments, plus `선택 공유용 저장` for a ZIP of selected shared copies. Browser-side opaque PNG re-encoding removes text metadata and alpha-channel stealth data. Originals remain byte-identical. Failed conversions never fall back to the original.
- Raw extraction response retention is now explicit opt-in, off by default, and reset to off when importing settings. Known reasoning tags, including unterminated blocks, are removed before sending/storing an opted-in response. The server enforces the setting. Existing records are not automatically deleted or rewritten.
- Filesystem and unexpected internal/provider errors no longer return arbitrary error text or local paths. Safe application errors remain useful.
- UI requires server 0.1.7 and the `privacy-controls` feature. Added privacy/backup guidance and narrow-screen viewer wrapping.

## 0.1.6 — 2026-10-24

**Update: UI only.** Replace the `ui/` folder and refresh. The 0.1.3 server plugin is unchanged.

- Skins no longer tint the SillyTavern page behind the open panel. Every skin uses the same neutral dim layer; skins restyle the panel only. A test now forbids skins from changing the backdrop.
- Removed the "확장 표시 이름" (display name) setting. The panel is always called NAIce Shot; a name saved by an earlier version is ignored.
- Removed the Noise Schedule control. New generations always use the default (karras). Presets saved with another Noise Schedule still load; that one value is ignored and does not mark the preset as changed. Restoring an image from history still reproduces its exact original settings.
- Profiles: the button is now "+ 새 프로필 만들기", and the profile form has a new "모든 칸 비우기" button. Both clear every field (name, aliases, appearance, outfit, prompts, description, card link) and switch to writing a new profile; saved profiles are not changed.
- Added `tests/browser-v016.mjs`.

## 0.1.5 — 2026-10-24

**Update: UI only.** Replace the `ui/` folder and refresh. The 0.1.3 server plugin is unchanged.

- Settings → **채팅 속 그림 위치**: show images attached to a message above or below the message text (default: below, as before). Changing it moves already attached images at once.
- Display only: the message text, the AI prompt, summaries and scene extraction are unaffected. The choice is saved in settings and included in settings backups.
- Added `tests/browser-v015.mjs`.

## 0.1.4 — 2026-10-23

**Update: UI only.** Replace the `ui/` folder and refresh. The 0.1.3 server plugin is unchanged (the ZIP's `server/` folder is the same 0.1.3 copy).

- History: new **선택 저장** button next to 선택 삭제. One selected image downloads as its PNG; several download as a single ZIP (`naice-shot-YYYYMMDD-HHMM-N.zip`, oldest first, no recompression). Images whose file is gone are skipped and counted in the notice. The selection stays after saving. Works in both the per-chat and all-chats views.
- Checkboxes: the checkmark stayed invisible (white on white) when a SillyTavern theme's custom CSS restyled every checkbox with `!important`. The panel's checkbox now protects its box, tick and size against such rules, and draws the tick without relying on `box-shadow`.
- Pastel and classic: darker checked-box color so the white tick reaches at least 4.5:1 contrast. The skin contrast test now requires 4.5:1 for the tick on every skin.
- Added `ui/zip.mjs`, `tests/zip.test.mjs` and `tests/browser-v014.mjs`.

## 0.1.3 — 2026-10-23

**Update: UI + server.** Replacing the server folder is recommended but optional: the 0.1.0–0.1.2 server plugins still work with this UI.

- When the panel opens, NAIce Shot now checks the server plugin's version once (`GET /status?quick=1`, which never calls NovelAI). If the server plugin is missing, older than the UI needs, or missing a required feature, a banner at the top of the panel explains which folder to replace. The banner can be closed.
- If the server plugin is newer than the UI supports (server-declared `minClient`), the banner asks you to update the UI folder instead.
- Settings → "서버·NAI 연결 확인" re-runs the check and shows both versions under the button.
- Network failures stay quiet; different but compatible versions are shown only in Settings.
- Added `tests/compat.test.mjs` and `tests/browser-v013.mjs`.

## 0.1.2 — 2026-10-23

- Added the GNU AGPL-3.0 `LICENSE` file and an unofficial-project disclaimer (English and Korean) to the README.
- Corrected the all-chats browser test, which still expected the earlier private build's server version in the update message. No product code change.
- Ran the full browser regression suite in Chromium for this build and recorded the results in `TEST-REPORT.md` and `SECURITY-REVIEW.md`.

## 0.1.1 — 2026-10-23

- Fixed restored history seed/size/steps remaining active after successful extraction of a new scene. Failed and cancelled extraction retain the prior edit.
- Added a common image preset picker in the scene tab's generation section, synchronized with the Settings picker and its modified state. Saving/deleting presets updates both lists.
- Applying a preset replaces temporary history settings and reassembles the current prompt.
- Importing settings also clears temporary history generation settings.
- Added two UI-controller regression tests using DOM doubles; all 81 Node tests pass.
- Existing 0.1.0 server plugin remains compatible. No credential flow or storage paths changed.

## 0.1.0 — 2026-10-23

- First NAIce Shot ZIP preview, based on the previously reviewed private implementation.
- Renamed display text, manifest, packages, plugin ID, API routes, settings and chat metadata keys, image paths, record paths, downloads, DOM/CSS identifiers and test fixtures.
- Retained the existing UI/server ZIP structure and Korean interface.
- Added an English usage/install/update guide and a scoped security review.
- Existing private-build settings and image history are not automatically migrated.
- No GitHub upload, publication or GitHub installation restructuring was performed.
- No generation or extraction behavior changes were included in this naming/security pass.

Future releases will record fixes, compatibility changes and any required migration steps here.
