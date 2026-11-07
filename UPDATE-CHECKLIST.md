# Installation and update checklist

## v0.1.91

**Extension + server.** Update in this order: server plugin (0.1.25) → restart SillyTavern → extension → refresh. (Server 0.1.24 still works with this extension; 0.1.25 makes older extensions show their update notice.)

1. With Opus, V5 at 2 % or more: 이미지 생성 works without a question, as in 0.1.90.
2. When V5 shows 1 % or 0 %: the question "…이번만 생성할까요?" still comes every time. At 0 % the box says "V5 기본 사용량 0% · 생성 때 확인".
3. Nothing else should look different.

## v0.1.90

**Extension + server.** Update in this order: server plugin (0.1.24) → restart SillyTavern → extension → refresh. With the old server the panel shows an update notice.

1. With Opus, V5 and the switch "Anlas 사용 가능성 허용" off: the box is green "Opus · V5 남은 사용량으로 생성" and 이미지 생성 works without a question (while V5 shows 2 % or more).
2. The time reads like "22:35 확인"; "Anlas" and "V5" are bold; "(+N%)" has the number colour. Open the box: "NovelAI에서 확인" is there with V4.5 as well.
3. When V5 shows 1 % or 0 %: the box turns orange with red words, and 이미지 생성 asks "…이번만 생성할까요?" every time (also with the switch on). 취소 sends nothing.
4. Optional check for later: at 0 % with extra usage left, press ↻, make one picture, press ↻ again and compare the extra % and Anlas. Tell Claude/GPT what changed.
5. 캔디케인 / 딸기우유: the numbers are green / plum.

## v0.1.89

**Extension only.** The server plugin stays 0.1.23 — just update the extension and refresh.

1. History: the count is on its own line; ☆ # ↻ 새로고침 sit under it at the right.
2. Press ★ and then # quickly: if # cannot load, the full list comes back (not an empty ★ list).
3. Nothing else should look different; the other fixes are for rare save and deletion timing.

## v0.1.88

**Extension only.** The server plugin stays 0.1.23 — just update the extension and refresh.

1. [장면 추출] and [이미지 생성] are the same height. The tabs are a bit lower.
2. History: one row [모두 선택] [본문에 넣기] [저장] [삭제]; pick a picture — the count line says "1장 고름". ☆ and # are icons.
3. Open the panel a few times: 챗샷/프리샷 stay the same size.
4. With Anlas off and a V5 size, the note in the status box has its own "Anlas 사용 허용" checkbox — ticking it ticks the one above too.

## v0.1.87

**Extension only.** The server plugin stays 0.1.23 — just update the extension and refresh.

1. Tag popup: press the picture briefly — the enlarged view opens. Hold it a moment, then drag — it moves. Only a small ✕ is left.
2. 프리샷: the 상황 box is four lines tall. Above 장면 추출 there is one 더보기.
3. Press 이미지 생성: the two small buttons under it do not flash.
4. Settings: 추출 AI 응답 원문 추가 보관 shows 켜짐/꺼짐 while folded. 팝업 크기 and 위치 처음으로 sit on one line; so do the two backup buttons.
5. History: ★ with no favorites — the message uses the whole width. Edit a tag on a phone with the keyboard open and tap 저장 once — it saves.
6. The NAI status box: the dot is green, orange or red; the numbers are coloured.

## v0.1.86

**The server plugin must be 0.1.23** (it is the current one; no server change in this release). If the panel says the server is older, update the server first, restart SillyTavern, then update the extension and refresh.

1. History: delete a picture you never put in the chat — no "빼는 저장은 실패" note.
2. History card: ☆ is at the top right, on the 선택 line. Tap **# 태그** — only tagged pictures; ★ and # never stay on together.
3. On a phone: explanations show one line with **더보기 ›**; costs and privacy notes stay open. Tapping a button leaves no colour behind.
4. Apple Cream theme: open 대상 메시지 — the chosen row's text is readable.
5. Tag popup: it shows at the top centre of the chat. Drag it, close it, get another match — it comes back where you left it. 🔍 opens the enlarged view. Settings → 팝업 크기 and 위치 처음으로.
6. History ⋯ → 태그 편집 on a phone: the field stays above the keyboard.

## v0.1.84

**Update the server plugin first** (0.1.22), restart SillyTavern, then update the extension and refresh. The extension needs server 0.1.22 or newer.

1. History: tap ☆ on a picture — it turns ★. Tap **☆ 즐겨찾기만** — only that picture is listed. Tap it again to see all.
2. History ⋯ → **태그 편집**: type `웃음, 비` and press Enter — `#웃음 #비` show under the date.
3. Settings → **태그 추천 팝업** → 이 채팅에서 켜기. Close the panel and get an AI reply with one of the tags: a picture pops up at the top right. **넣기** opens the message list with that reply chosen; ✕ closes it.
4. Delete a ★ picture: the question has "즐겨찾기한 그림 1장도 함께 삭제돼요."

## v0.1.81

Update the extension and refresh (server 0.1.19 still needed). Nothing new to try: a length fix for profile names with brackets.

## v0.1.80

**Update the server plugin first** (0.1.19), restart SillyTavern, then update the extension and refresh.

1. A profile with a long name (over 60 letters) as a chip: the request box counts its whole name.

## v0.1.79

Update the extension and refresh (server 0.1.18 still needed).

1. Make an error note appear (e.g. many unknown `@names`): it stays short, scrolls, and × closes it.
2. Settings → backup export, then import: switch to 프리샷 — its own prompt and settings are back.

## v0.1.78

Update the extension and refresh (server 0.1.18 from v0.1.77 is still needed).

1. Generate: the banner says 생성했어요 without the seed and the panel does not jump when it appears.
2. Switch 챗샷 ↔ 프리샷 after choosing different presets: each comes back with its own.
3. In a chat whose card and user have no profile, extract, make a profile from the box, then pick another 장면 후보: no "no card" warning.

## v0.1.77

**Update the server plugin first** (0.1.18), restart SillyTavern, then update the extension and refresh. The extension needs server 0.1.18 or newer.

1. 프리샷: write a very long situation (over 4,000 seen characters): 장면 추출 stops with a clear message; nothing is sent.
2. Type `@Le` in a text that has `@Leo`, pick Leo: no leftover `o`. Copy a selection that ends with a line break and paste it: the line break is kept.
3. 본문에 넣기 / 위치 바꾸기 / 빼기: the normal message appears. If SillyTavern cannot confirm the save, the message says it could not check (nothing is undone).

## v0.1.76

Update the extension and refresh. No server update is needed.

1. 프리샷: type `@` in the situation box → the list shows name, aliases and a short look; pick one → an `@Name` pill goes in. Backspace removes the whole pill.
2. Write a situation with two pills and press 장면 추출: both are ticked in the result. Two profiles with the same name can both be picked.
3. 챗샷: in 추가 요청, pick someone who is not in the message → they are added to the scene.
4. A situation saved before this version with `@Name#…` shows a dashed yellow pill; remove it and pick again.

## v0.1.75

Update the extension and refresh. No server update is needed.

1. 프리샷: type `@` in the situation box → a profile list appears; pick one → `@Name#…` goes in.
2. Write a situation with two `@` people and press 장면 추출: both are ticked in the result.
3. 챗샷: in 추가 요청, `@` someone who is not in the message → they are added to the scene.


## v0.1.74

Update the extension and refresh. No server update is needed.

1. Settings → 채팅 속 그림 is folded; its title says where pictures go. If you never chose a place before, pictures now show above the text.
2. Press 본문에 넣기: under the list, choose 기본 위치 / 글 위 / 글 아래.
3. Tap a picture in the chat → ⋯ → 글 아래로 옮기기 (or 글 위로 옮기기).


## v0.1.73

Update the extension and refresh. No server update is needed.

1. Settings → 추출 AI: only the connection, the refresh button and the cost note show; 세부 설정 opens the rest and its title shows the values.
2. Edit a profile and save: it stays where it was in the list.
3. A message with several pictures: 넘겨보기 shows the picture in its usual place with ‹ 1/3 › under it; 격자 puts them side by side. No grey boxes.
4. History: each card's buttons read ⋯ · 저장 · 삭제.


## v0.1.72

Update the extension and refresh. No server update is needed.

1. Make a picture and press 본문에 넣기: a list of messages opens with the message it was made for already chosen. Press [#N에 넣기].
2. History: tick two pictures → [선택 본문에 넣기 (2)] → choose a message.
3. On a phone, swipe sideways on a message's pictures (also on the ‹ 1/3 › line): the pictures move and the message does not reroll.


## v0.1.71

Update the extension and refresh. No server update is needed.

1. Settings → 채팅 속 그림: pick 넘겨보기 / 격자 / 세로 and a size; a message with several pictures changes at once.
2. Turn on "메시지에 그리기 버튼 표시": a small icon appears right after each message's date.
3. On a phone, open a picture large and move to the next one: ⋯, ‹ n/m › and 저장 · 삭제 stay apart.


## v0.1.70

Update the extension and refresh. No server update is needed.

1. Open any picture large: ⋯ on the left, ‹ n/m › in the middle, 저장 · 삭제 on the right; 프롬프트 보기 opens over the picture.
2. Open a chat picture in a message with two pictures: ‹ 1/2 › moves between them; ⋯ → 이력에서 보기 shows its history card.
3. Drawing tab: [옷장에 저장] opens the name box right under it; open 고정 외형 · 전용 태그 on a card and type — only this picture changes.


## v0.1.69

**Update the server plugin first** (0.1.17), restart SillyTavern, then update the extension and refresh. Nothing new to try: two fixes for rare timing and connection cases in the account box.


## v0.1.68

**Update the server plugin first** (0.1.16), restart SillyTavern, then update the extension and refresh.

1. Tap anywhere on the account box: it unfolds. On V5, "NovelAI에서 확인" is under the V5 line at the right.
2. The 챗샷 / 프리샷 switch shows on every tab and leaves you on the same tab.
3. Change a preset with [변경 저장]: the preset list keeps its order.


## v0.1.67

**Update the server plugin first** (0.1.15), restart SillyTavern, then update the extension and refresh.

1. Drawing tab, V4.5: the box above 이미지 생성 says "Opus · V4.5 무료 조건에 해당해요 ✓"; with Anlas consent **off**, 이미지 생성 works.
2. Line 2 shows Anlas, V5 % and the time; tap it for details. Switch to V5: "V5 사용량으로 생성 (부족하면 Anlas)" and it asks for consent.
3. 챗샷 / 프리샷 is next to the title; no bar follows the page.


## v0.1.66

**Update the server plugin first**, restart SillyTavern, then update the extension and refresh.

1. Settings → [서버·NAI 연결 확인] → open "계정 응답 항목 이름 보기 (값 없이)".
2. Check the list shows names only (no numbers or dates), then [목록 복사] and send it to the next session.


## v0.1.65

Update the extension and refresh. No server update is needed.

1. Drawing tab: the 챗샷 / 프리샷 switch is a thin bar that still stays at the top.
2. Open a chat picture large, close it with ✕, then tap the picture again at once: it opens.


## v0.1.64

Update the extension and refresh. No server update is needed.

1. History → open a picture made without 장면 추출: "연결된 메시지 없음 ⓘ" where 메시지로 가기 would be; tap it for the reason.
2. Open a chat picture large, tap the empty space around it: it closes and does not open again.
3. Move between pictures: the date, seed and 삭제 change together with the picture.


## v0.1.63

Update the extension and refresh. No server update is needed.

1. Chat pictures: no ⋯ on the picture. Tap it → 저장 ▾ · 이 메시지에서 빼기 · 삭제, date and seed at the bottom.
2. Move between pictures in the enlarged view: no flash.
3. The save menu notes are readable.


## v0.1.62

Update the extension and refresh. No server update is needed.

1. Settings: Steps (not 스텝).
2. Drawing tab, scrolled up: [↓ 생성] → the [이미지 생성] button sits at the bottom of the screen.
3. During generation only the progress box shows; a success message folds after a few seconds.
4. Open a picture large: one row on top, ‹ n/m › with 저장 ▾ · 삭제 under the picture.
5. History ⋯ on an attached picture: "채팅에서 이 그림 빼기".


## v0.1.61

Update the extension and refresh. No server update is needed. Nothing new to try: two fixes for older 프리샷 cards and the [직접 만들기] question.


## v0.1.60

Update the extension and refresh. No server update is needed.

1. History tab: the PNG guide is three lines, the last one in the warning colour.
2. 프리샷: a temporary person from an older picture keeps its clothes after a new extraction.


## v0.1.59

Update the extension and refresh. No server update is needed.

1. 프리샷: write a text naming one person and press [장면 추출]. A card not named in the text is removed after a question; press [📌 고정] on a card to keep it (it is only unticked). Try [↶ 추출 취소].
2. 프리샷 clothes: type clothes, extract again → they stay. [자동으로 되돌리기] / [기본 복장 입기] / [비우기].
3. Person card: open "고정 외형 · 전용 태그" → [프로필 편집] opens the profile editor.
4. Scroll up on the drawing tab → [↓ 생성] at the bottom right.
5. In 프리샷, press a chat message's NAIce Shot button → 챗샷 opens with that message.


## v0.1.58

Update the extension and refresh. No server update is needed.

1. Profiles tab: open a profile, then press [프로필 업데이트] on its card, come back and save the form → the card's update is still there.
2. 추가 요청 "파란 머리 묶기" style requests no longer put hair into the clothes.
3. 프리샷: a person with no wardrobe shows the "옷장이 비어 있어요…" line.
4. PC: the panel content is full width; the PNG guide is one sentence per line.


## v0.1.57

Update the extension and refresh. No server update is needed.

1. Settings: choose a preset → [변경 저장 · 이름] asks first; [+ 새 프리셋 만들기] leaves only [새 프리셋으로 저장].
2. Person card: "이 복장을" row; "ⓘ 잠금이 뭐예요?" opens the explanation; edit 고정 외형 and press [프로필 업데이트], then [↶ 업데이트 취소].
3. History: pick one card → the button says 모두 해제; "ⓘ 그림과 기록은 어디에 저장되나요?".
4. A chat message's ⋯ menu matches the theme.


## v0.1.56

Update the extension and refresh. No server update is needed.

1. With a temporary person in the scene, extract with 추가 요청 "혼자": that person's card stays but is unticked.
2. Switch candidates after a request: the "추가 요청 반영" line shows only on the candidate it changed.


## v0.1.55

Update the extension and refresh. No server update is needed.

1. Drawing tab: 챗샷/프리샷 stays at the top while scrolling; 프리샷 shows 추출 표현 and the same [장면 추출].
2. Type "비 오는 밤으로" in 추가 요청 and extract: the line under the box says what was applied.
3. 그리기창 비우기 is next to "2 · 장면 편집" and turns into ↶ 비우기 취소.
4. With no 공통 이미지 프리셋 selected, 이미지 생성 asks first.


## v0.1.54

Update the extension and refresh. No server update is needed.

1. Make an image from a short message, delete that message and leave another with the same words: 메시지로 가기 is greyed and 본문에 넣기 (자동) asks.


## v0.1.53

Update the extension and refresh. No server update is needed.

1. 메시지로 가기 on an image from another character's chat while a reply is being written: it says to wait and stays put.
2. On an image from another group's chat: it asks you to open that group first.
3. Delete the message an image was made from in a chat with later messages: the line is greyed (not the next message).
4. In a long chat (hundreds of messages), 메시지로 가기 on an early image still reaches it.


## v0.1.52

Update the extension and refresh. No server update is needed.

1. Press 지금 옷을 기본으로 and edit the final prompt right away: your edit stays after saving.
2. In a chat whose card character has no profile, add a temporary person with the same name, then 직접 만들기 from the box: one card, not two.
3. With two profiles of the same name as the card character: the box offers 기존 프로필 연결하기.


## v0.1.51

Update the extension and refresh. No server update is needed.

1. History ⋯ → 메시지로 가기: the panel closes and the message lights up.
2. Attach an image to a different message than it was made from: ⋯ shows 넣은 메시지로 가기 / 만든 메시지로 가기; the enlarged viewer's 메시지로 가기 ▾ offers both.
3. 모든 채팅 or 전체 보기 → an image from another chat → 메시지로 가기 asks first, then opens that chat.
4. Delete the message an image was made from: the line is greyed; 본문에 넣기 (자동) asks you to pick a message.


## v0.1.50

Update the extension and refresh. No server update is needed.

1. Save menus say **클린 PNG / 원본 PNG**; the history tab shows **PNG 저장 안내** under the tools.
2. History ⋯: 챗샷으로 보내기 · 프리샷으로 보내기 · 설정을 프리셋으로 · 본문에 넣기.
3. Open a chat whose card character has no profile, extract: the make/link box appears even if the character is not in the scene.
4. Type in a person's outfit box: 자동으로 되돌리기 appears right away.
5. Select a preset with a long name: 덮어쓰기 stays on one line.


## v0.1.49

Update the extension and refresh. No server update is needed.

1. Drawing: [장면 추출] is wide; press [그리기창 비우기] → it becomes [↶ 비우기 취소].
2. A person card shows **이번 그림** and **이 채팅에서**. Try 기본 복장 입기, 비우기, 자동으로 되돌리기, 지금 옷을 기본으로 → press again to clear → 해제 취소 inside the group. The window no longer turns grey while saving.
3. History: accent 보기 범위 and 저장 ▾, small ↻, tools in the same arrangement; 저장 menu has only the two choices.
4. Settings: 새 프리셋으로 저장 / 덮어쓰기 · 이름 / 선택 프리셋 삭제; 고급 → 추출 AI 응답 저장; PNG 저장 안내 section.
5. Profile: 프로필 저장 / 카드 연결 · 모든 칸 비우기 / 프로필 삭제.
6. On a PC, buttons no longer stretch across the whole panel.


## v0.1.46

Update **NAIce-Shot-Server 0.1.12**, restart SillyTavern, then update the extension and refresh.

1. Drawing tab, above 이미지 생성: `Anlas N · 시각 확인` and ↻. Press ↻; Settings → 서버·NAI 연결 확인 shows the same balance.
2. Opus: V4.5 says the free condition; V5 says Anlas may be deducted, with **NovelAI에서 확인**.
3. With **Anlas 사용 가능성 허용** off and a V5 (or non-Opus) generation: nothing is sent; **Anlas 허용 설정으로 이동** highlights the switch without turning it on.
4. After an image, the balance updates as "이전 조회보다 −N".
5. Tablet/Scroll users: please report the exact message if NovelAI refuses a generation (the bracketed NovelAI note helps).


## v0.1.45

Update the extension and refresh. No server update is needed.

1. Type something and, before it saves, try a deletion while SillyTavern is unreachable (or stop it briefly): the notice says the deletion failed, and your edit is saved once the server answers again.
2. In a chat that has images but where you have not drawn since updating, type a place and delete the chat's whole history: the drawing window empties.


## v0.1.44

Update **NAIce-Shot-Server 0.1.11**, restart SillyTavern, then update the extension and refresh.

1. Open the same chat in two browser tabs. In tab 1 use 설정 → **저장된 작업 모두 지우기**. In tab 2 type something: it shows a conflict notice instead of saving; **서버 작업 다시 불러오기** shows the empty work. Refresh tab 1: the old work does not come back.
2. In one tab, delete all work and keep editing: saving works normally.


## v0.1.43

Update the extension and refresh. No server update is needed.

1. Type in the drawing window and, right away, use 설정 → **저장된 작업 모두 지우기**. Refresh: the old work must not come back. Edit again: it saves without a conflict notice.
2. Put something in 프리샷, switch to 챗샷, open 이력 → all chats → 프리샷 and delete its images. Switch back to 프리샷: the window is empty.
3. Select several history images → 선택 저장 ▾ with ZIP off: the note about allowing several downloads appears; with ZIP on it disappears.


## v0.1.42

Update **NAIce-Shot-Server 0.1.10**, restart SillyTavern, then update the extension and refresh.

1. History card: date without seconds, **저장 ▾ / 삭제 / ⋯**. Open 저장 ▾: 공유용 PNG (highlighted) and 원본 PNG with notes. Click elsewhere or the button to fold it. Hover 원본 PNG on a light skin: text stays readable.
2. ⋯ holds 불러오기, 본문에 넣기, 설정을 프리셋으로, 프리샷으로 보내기.
3. Open a picture: seed appears as **seed N 복사**. 저장 ▾ works the same there and on attached images.
4. Select several history images → 선택 저장 ▾: try **ZIP 파일 하나로 묶기** on and off. If the browser asks about several downloads, allow it.
5. 프리샷: draw, then restore that image from history — the situation text comes back (new images only).
6. Leave and return to a chat: the notice names the target message.
7. 설정 → 개인정보 보관 → **저장된 작업 모두 지우기**: the drawing window empties; returning to another chat shows no old work. **이 채팅 이력 전체 삭제** also forgets that chat's work.


## v0.1.41

Update **both extension and NAIce-Shot-Server 0.1.9**, restart SillyTavern, then refresh the browser.

1. In **그리기 → 챗샷**, extract, edit a candidate and add a direct-input character. Wait for saving to finish, visit another chat and return; repeat with a browser refresh. No extraction request should be sent on restore.
2. Keep a different work in **프리샷** and check that chat changes leave it alone.
3. Clear, visit another chat, return and undo. Refresh a cleared work and check its undo again. Editing should end undo.
4. Restore a history image's one-off settings: failed generation keeps them; successful generation consumes them, including after changing chats.
5. Original PNG downloads (result, history, attached image and enlarged viewer) and original ZIP selection show the same metadata warning. Try cancel, shared alternative, original and session suppression. Refresh restores the warning.
6. **문제 제보용 추출 응답 보관** starts off, asks before enabling and shows its state. It does not embed the response in PNGs.
7. If saving fails, keep the page open and use **다시 시도**. For a concurrent-edit conflict, **서버 작업 다시 불러오기** asks before replacing local edits. Wait for saving to finish before force-closing the app.


## v0.1.40

Update the extension and refresh. No server update is needed.

1. Check the history card's **불러오기 / 본문에 넣기 / ⋯** row and open ⋯ on a phone-width screen. Downloads, presets, 프리샷 and 그림 삭제 should remain available.
2. Open a picture, expand **프롬프트 보기** and press **프롬프트 복사**. Copy the extraction response separately with **응답 복사**.
3. Choose **설정을 프리셋으로** in ⋯ and check that 저장 / 취소 share a row.
4. Attach the same picture to two messages. Open one attachment and press **이 메시지에서 빼기**: only that message's attachment should disappear; the other message and history should keep it. The corner ⋯ offers the same action.
5. Switch models and check that the character-limit hint changes (V4.5: 6; V5: 22).

Next stages, not included here: per-chat last-work persistence, then message/image counts, placement and navigation. The in-panel guide comes later.

## v0.1.39

Update the extension and refresh.

1. In 챗샷, extract and then press 그리기창 비우기. Switch tabs, come back, and press 되돌리기: everything should return.
2. Switch to 프리샷, add a profile, write a situation with one extra person and press 글로 채우기. Check that the profile is not doubled and the extra person is a temporary person.
3. Generate, then check the 프리샷 history.
4. From a chat history card, press 프리샷으로 보내기.

No server update is needed.

## v0.1.38

Update the extension and refresh.

1. Open 생성 설정 in the scene tab and change Guidance. The settings tab should show the same value.
2. Restore an image from history and check the "이력 설정 · 이번 생성에만" label and 기본 설정으로 돌아가기.
3. Try 설정을 프리셋으로 on a history card.
4. Press 이미지 생성 before extracting: a confirm should appear.

No server update is needed.

## v0.1.37

Update the extension and refresh.

1. Extract a scene with a side character that has no profile.
2. Press 임시로 그리기, fill the appearance and generate.
3. Re-extract and check that the card asks for a check.
4. Press 프로필로 저장 and confirm the person is not doubled.

No server update is needed.

## v0.1.34 – v0.1.36

Update the extension and refresh.

- On a scene card, press 기본 복장 지정 and check the badge, the lit picker and "✓ 채팅 기본 복장".
- Press "✓ 채팅 기본 복장" again to clear it.
- Extract from a Korean chat and check that the fields come back in English.

## v0.1.33

Update the extension, then restart SillyTavern (server plugin 0.1.8).

1. Add two outfits to a profile's 옷장 and save.
2. In a scene, pick one under 당분간 이 복장, turn on 평생 박제, re-extract, and check that the outfit stays.
3. Try 옷장에서 꺼내 입기, 옷장으로 and 되돌리기.
4. Open 프롬프트 보기 on a history card.

## v0.1.32

Update the extension and refresh.

- Settings → 추출 AI shows the recommendation, the "권장값 적용 · 8192" button and "추출 온도". Existing values are not changed until you press the button.
- Extract the same multi-scene message several times with a separate connection, at 8192 and a low temperature if your model supports it. The titles need not match. Check three things:
  - the brief distinctive moment (the phone) keeps appearing
  - actions do not mix
  - the final moment is always included
- If a notice says "응답이 불완전해요", raise the limit it names.
- No server update is needed.

## v0.1.31

Update the extension and refresh. Extract a message that holds several scenes: up to three candidates appear above 장소, the last one checked. Switch between them and confirm the people, actions and place change with them. Edit one candidate, switch away and back, and confirm the edit is still there. No server update is needed.

### Checking whether moments still mix

The effect depends on the extraction model, so compare with your own extraction connection. Paste each invented message below as the latest character message in a test chat. Use profiles named Mira and Leo, or any two of yours with the names changed.

1. "Mira and Leo sat at the small kitchen table, chopsticks in hand, finishing the last of the noodles. Mira set her bowl down, pushed back her chair and stood, pulling on her grey coat. Without another word she crossed the hall, opened the front door and stepped out into the rain."
2. "Leo leaned on the counter reading a paperback while the kettle hissed. When it clicked off he put the book face down, poured two cups of tea and carried them to the balcony, where Mira was watering the plants."
3. "Mira stood alone at the bus stop, scrolling through her phone." (one scene: no picker should appear)

For each message:

- Check that the candidates are separate instants, with no chopsticks or sitting in the walking-out moment.
- Check that clothing put on partway (the coat) appears only from that moment on.
- Then write "식탁에서 밥 먹는 순간" in 그리고 싶은 순간 for message 1 and extract again. The eating moment should be chosen.

## v0.1.30

Update the extension and refresh. Settings: the 테마 card is first and shows only color chips; press it to open the list. 이미지 크기 offers three sizes only and 스텝 stops at 28. With the message button on, open … on a character message under a theme with a narrow button row: every button, including ours, should be visible (the row may wrap to two lines). No server update is needed.

## v0.1.29

Update the extension and refresh. With 메시지에 그리기 버튼 표시 on, open the … menu of both an AI and a user message under your usual chat theme: the icon should be the last one in the row and fully visible. Then look at 우유, 크림 노트, 커피우유 and 초코우유 — they should be easy to tell apart. No server update is needed.

## v0.1.28

Update the extension and refresh. Settings → 테마 should be folded and show the current theme on the right; press it to open the list. Try 크리스마스, 눈 오는 밤 and 캔디케인 on phone width: the garland and lights must not cross the subtitle. No server update is needed.

## v0.1.27

Update the extension and refresh. Settings → 스킨 → 크리스마스. Check the tree header, red selected tab/primary action, cream secondary buttons and readable fields. Switch to another skin and back; the choice should persist and the viewer should use the holiday accent. All fifteen earlier skins remain available. No server update is needed.

## v0.1.26

Update the extension and refresh. Scroll inside the target-message list, load more rows, then collapse/reopen it. The list should return to the same position and retain loaded rows. Repeat across tab and panel close/reopen, then verify that a direct message icon reveals its target once and latest/chat-switch resets the list to the top. No server update is needed.

## v0.1.25

Update the extension and refresh. Hide an RP message and confirm it appears as 숨김 in the target list. With message draw buttons enabled, its icon should remain. Select it and extract; the preceding reference range may include hidden RP, while typed system notices are excluded. Generate and attach to that message, then confirm it stays hidden after saving/reloading. Latest mode must still select a visible message and exclude hidden text. No server update is needed.

## v0.1.24

Update the extension and refresh. Press 대상 메시지: a list opens with 가장 최근 메시지 on top and a ✓ on the current choice. Scroll, press 이전 메시지 더 보기, pick an old message, then reopen — the list should jump to that message. No server update is needed.

## v0.1.23

Update the extension and refresh. Check the new icon in the extensions menu and settings drawer. Turn on Settings → 메시지에 그리기 버튼 표시, open a message's … menu and press the icon; the scene tab should open with that message selected.

## v0.1.22

Update the extension and refresh. Open 대상 메시지 in a chat longer than ten messages. Browse with 더 이전 / 더 최근, select the oldest message and extract to verify the correct target. Browsing alone must not change the current target; switching chats must reset it. Check keyboard selection and narrow mobile layout. No server update is needed.

## v0.1.21

Update the extension and refresh. Check that target messages run from newest to oldest and selecting an older message still targets that message. Scroll each of the four tabs, switch away and return, then close/reopen with both the close button and Escape. History refreshes and opening/closing the image viewer should keep the prior list position. No server update is needed.

## v0.1.20

Update the extension and refresh. In a scene with three people, confirm profiles saved for other cards also load. For an unregistered side character, use 기존 프로필 연결 and check that expression/action/clothing fill in; undo and reconnect to confirm the fields remain. A manual 인물 추가 followed by 장면 추출 includes that profile among candidates. For old name-only records, extract once again to obtain missing actions. No server update is needed.

## v0.1.19

Update the extension and refresh. Restore an image from history, edit the final prompt and generate: the edit and historical seed/options apply once. Generate again to check that current Settings values are used. Restore again and try 조립 결과로 되돌리기. Switch chats while a final-prompt field has focus and confirm the previous prompt disappears. No server update is needed.

## v0.1.18

Update the extension and refresh. Bug-fix release for the missing-profile warning; try 기존 프로필 연결하기 → 연결 되돌리기 and the warning dialog's Escape/Tab.

## v0.1.17

Update the extension and refresh. Extract a scene where the open character (or you) has no profile: check the warning box, try 캐릭터 카드에서 만들기 and 기존 프로필 연결하기, and press 이미지 생성 to see the dialog.

## v0.1.16

Update the extension and refresh. Choose **코코아** at the bottom of the settings tab. No server update is needed; existing skin choices are preserved.

## v0.1.15

Update the extension and refresh. Choose **애플 크림** at the bottom of the settings tab. No server update is needed.

## v0.1.14

Update the extension and refresh. Five new milk skins at the bottom of the settings tab.

## v0.1.13

Update the extension and refresh. Try the new 딥 블루 and 라벤더 skins at the bottom of the settings tab.

## v0.1.12

Update the extension and refresh. Bug-fix release: no new settings.

## v0.1.11

Update the extension and refresh. In Settings → 공통 이미지 프리셋, try + 새 프리셋 만들기, 프리셋 저장 (overwrites the selected one) and 새 프리셋으로 저장.

## v0.1.10

Update the extension and refresh. Check the extensions menu (camera and name aligned with other entries), the backup buttons on a phone, and the six skins at the bottom of the settings tab.

## v0.1.9

Update the extension from Manage extensions and refresh. Check that the NAIce Shot entry in the extension settings has the same bordered header as other extensions, that fields are readable in every skin, and that 글래스 shows the page blurred behind it.

## First install

1. Install the extension from Extensions → Install extension with `https://github.com/Near7707/NAIce-Shot`.
2. In `plugins/`, run `git clone https://github.com/Near7707/NAIce-Shot-Server naice-shot-server`.
3. Make sure `enableServerPlugins: true` is set, restart SillyTavern fully and refresh the browser.
4. Confirm the panel shows no yellow banner and Settings shows both versions.

## Regular checks after an update

1. Check the server connection in Settings; both versions appear under the button.
2. Create one profile manually, inspect the assembled prompt and verify one generation locally.
3. Verify extraction with the selected text-provider connection.
4. Verify original PNG download, 공유용 PNG, message attachment, image viewer (also on a phone) and chat-history filtering.
5. Attach an image to a message, then switch Settings → 채팅 속 그림 위치 between 위 and 아래.
6. Select two or three history images and use 선택 저장; open the ZIP and check the PNGs.
7. Inspect all-chat history before deliberately testing deletion on a disposable image.
8. Test desktop/mobile layout (ticked checkboxes visible in each skin) in your own theme and browser.

Settings, chats, history and PNGs live outside the code folders and are kept across updates. Per-version notes are in `CHANGELOG.md`.
