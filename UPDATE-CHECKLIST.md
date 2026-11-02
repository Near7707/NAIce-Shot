# Installation and update checklist

## Planned updates (not implemented)

- [ ] Add a temporary character slot for manual drawing without saving a reusable profile. Keep it available while editing or regenerating the current scene.

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
