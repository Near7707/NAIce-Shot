# Changelog

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
