# Installation and update checklist

## v0.1.10

Update the extension and refresh. Check the extensions menu (camera and name aligned with other entries), the backup buttons on a phone, and the six skins at the bottom of the settings tab.

## v0.1.9

Update the extension from Manage extensions and refresh. Check that the NAIce Shot entry in the extension settings has the same bordered header as other extensions, that fields are readable in every skin, and that 글래스 shows the page blurred behind it.

## v0.1.8: moving to the git install

1. Back up SillyTavern user data.
2. Delete the old manual folders: `data/<user>/extensions/naice-shot/` and `plugins/naice-shot-server/`.
3. Install the extension from Extensions → Install extension with `https://github.com/Near7707/NAIce-Shot`.
4. In `plugins/`, run `git clone https://github.com/Near7707/NAIce-Shot-Server naice-shot-server`.
5. Make sure `enableServerPlugins: true` is set, restart SillyTavern fully and refresh the browser.
6. Confirm the panel shows v0.1.8 or later, no yellow banner, and Settings shows server v0.1.7.
7. Confirm the extension menu lists NAIce Shot only once.

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
