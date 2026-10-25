# Installation and update checklist

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
