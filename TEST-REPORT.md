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
