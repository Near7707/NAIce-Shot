## v0.1.7 privacy update

Replace **both** the `ui/` files and the `server/` files, restart SillyTavern fully and refresh the browser. Confirm server v0.1.7 in Settings. Check that raw-response retention is off by default. For sharing, use `공유용 PNG` or `선택 공유용 저장`; ordinary PNG save preserves the original metadata. Existing records and PNGs are not rewritten.

# Installation and update checklist

For 0.1.5 → 0.1.6 (UI only), replace the UI folder contents and refresh. Keep the 0.1.3 server plugin.

For 0.1.4 → 0.1.5 (UI only), replace the UI folder contents and refresh. Keep the 0.1.3 server plugin.

For 0.1.3 → 0.1.4 (UI only), replace the UI folder contents and refresh. Keep the 0.1.3 server plugin.

For 0.1.2 → 0.1.3 (UI + server), replace both folders, restart and refresh. The panel now warns automatically if the server plugin is missing or older than the UI needs. Replacing only the UI also works with the 0.1.0–0.1.2 server plugin.

For 0.1.1 → 0.1.2, nothing changes in behavior (license, disclaimer and validation records only); updating is optional.

For 0.1.0 → 0.1.1, replace the UI folder contents and refresh. The existing server plugin is compatible. No data migration is required.

1. Back up SillyTavern user data.
2. Install this preview as a separate extension in `extensions/naice-shot/`.
3. Install the companion plugin in `plugins/naice-shot-server/`.
4. Enable server plugins, restart the server and refresh the browser.
5. Confirm that the panel displays NAIce Shot v0.1.6 and shows no yellow version banner.
6. Check the server connection in Settings; both versions appear under the button.
7. Create one profile manually, inspect the assembled prompt and verify one generation locally.
8. Verify extraction with the selected text-provider connection.
9. Verify original PNG download, message attachment, image viewer and chat-history filtering.
10. Attach an image to a message, then switch Settings → 채팅 속 그림 위치 between 위 and 아래.
10a. Select two or three history images and use 선택 저장; open the ZIP and check the PNGs.
11. Inspect all-chat history before deliberately testing deletion on a disposable image.
12. Test desktop/mobile layout (check that ticked checkboxes are visible in each skin) in your own theme and browser.

Earlier private installations keep separate settings, chat metadata and image history. A settings export/import can transfer profiles and common preferences; it does not migrate chat outfits, bindings or images.

For later ZIP updates, replace both NAIce Shot code folders unless the changelog explicitly states UI-only. Keep data directories intact.

No GitHub publication has occurred. GitHub-URL installation remains a separate future packaging task.
