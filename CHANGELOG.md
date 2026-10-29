# Changelog

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
