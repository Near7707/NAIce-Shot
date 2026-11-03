# Installation and update checklist

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
