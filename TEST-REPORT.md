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
