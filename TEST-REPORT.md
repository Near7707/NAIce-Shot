# v0.1.52 validation — 2026-11-04

- Extension Node suite: **140 passed, 0 failed**.
- Server Node suite: **25 passed** (server unchanged).
- **41 of 41 Chromium browser scripts passed.** New `browser-v0152`: final prompt edited while an outfit save waits survives the save (fails on 0.1.51 code); a same-name temporary person becomes the profile when made or linked from the card-character box, and link undo restores it; same-name profiles get the box and link through this chat's binding. `browser-v0118` updated: linking the card character to one of several same-name profiles now succeeds through the chat link and still adds no alias.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari.

# v0.1.51 validation — 2026-11-03

- Extension Node suite: **140 passed, 0 failed** (new `message-jump.test.mjs`: made message found unchanged, on another swipe, moved after deletions, edited, missing, hidden; one or two targets).
- Server Node suite: **25 passed** (server unchanged).
- **40 of 40 Chromium browser scripts passed.** New `browser-v0151` at 375 and 1100px: one line (made only / made and attached), two lines when they differ, the viewer's choice menu, panel and viewer close and the message lights up, edited note, deleted greys the line, 프리샷 reason, another chat asks then opens and lands on the message, 본문에 넣기 (자동) asks instead of using the last message. `browser-v040`, `browser-v070` now pick the message explicitly for seeded images without a source.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern chat switching (`openCharacterChat`, `selectCharacterById`, `openGroupChat`), loading older messages with `#show_more_messages`, group chats, iPhone Safari.

# v0.1.50 validation — 2026-11-03

- Extension Node suite: **138 passed, 0 failed** (skins-lint now also checks itself with upper-case property names).
- Server Node suite: **25 passed** (server unchanged).
- **39 of 39 Chromium browser scripts passed.** New `browser-v0150`: failed outfit save keeps a later edit and rolls back only its own value; card rebuild keeps the saving hold; typing shows 자동으로 되돌리기; long preset name keeps 덮어쓰기 on one line at 320/375/1100px; card character without a profile gets the make/link box; ⋯ order; 클린 PNG notes; PNG guide in history; one focus ring. `browser-v0149` now blends opacity and checks hovered menu items: before the fix 7 of 17 themes failed (3.1–3.6:1), after it all pass. Older scripts updated for 클린 PNG names and the new ⋯ order.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari.

# v0.1.49 validation — 2026-11-03

- Extension Node suite: **137 passed, 0 failed, 0 skipped** (new `skins-lint`: themes set colours/decoration only; verified it fails when a layout rule is added).
- Server Node suite: **25 passed** (server unchanged).
- **38 of 38 Chromium browser scripts passed.** New `browser-v0149`: text contrast on all 17 themes across drawing, history, save and ⋯ menus, settings (advanced open) and profiles; opaque menus; at 320/375/1100px for three themes no sideways scroll, key buttons on one line and not spilling, one main action per group, history tools arrangement, small refresh, 560px action groups on PC, 비우기 ⇄ 비우기 취소. The spill check was confirmed to fail on an intermediate layout (선택 저장 overflowing at 375px). Updated older scripts for the new buttons (clear slot, 새 프리셋으로 저장 / 덮어쓰기, 고급 fold, outfit groups, card-only saving hold).
- Visual check: phone (375px) and PC (1100px) screenshots of the drawing source buttons, outfit groups, history top, settings presets and advanced fold, profile buttons (local only).
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari.

# v0.1.48 validation — 2026-11-03

136 Node tests passed (no skips); 37 Chromium browser scripts passed, including the new 1100/375/320px import/clothing/gallery regressions. Detailed evidence, updated expectations and untested environments are recorded once in [docs/REVIEW.md](docs/REVIEW.md#ui-v0148--서버-v0113-유지--2026-11-03). Server v0.1.13 is unchanged.

# v0.1.47 validation — 2026-11-03

- Extension Node suite: **136 passed, 0 failed, 0 skipped** against server v0.1.13.
- Server Node suite: **25 passed**. New: interleaved chat/free history filtered before pagination; chat counts, storage totals, page boundaries and summaries exclude free shots; full history and free-only queries still work.
- **36 of 36 Chromium browser scripts passed.** New `browser-v0147` at 1100/375/320px: two-column mobile cards; second-tap and scroll dismissal for save/more/selection menus; viewer save toggle; deletion cancellation; profile/wardrobe no autofocus; collapsed wardrobe and removal confirmation; tab-scoped notices; touch message-count ±; per-chat placement without changing the global default; four history scopes, paging and persistent scope across drawing-mode changes; disabled attach reasons; PNG explanation at save controls; all 17 skins' active mode fill and horizontal fit.
- Existing browser expectations updated for deliberate behavior changes: no preset/profile autofocus, explicit history scopes, collapsed wardrobe editors, compact generation title, corrected supported-size/Anlas notes, persistent attach action and new empty/legacy-server wording. History mocks now filter by owner; chat-switch tests use chat images, not free images.
- Manually inspected mock mobile screenshots with Korean fonts: history two columns, save menu placement/caret, compact generation and Anlas controls.
- Destructive-action audit: profile/wardrobe/preset/image/work deletes have confirmations; reversible clear retains undo; detaching preserves originals. Publication files and diff checked for secrets/private paths/private chat or screenshot data; none found beyond an intentional old fake-path privacy test.
- Not exercised: real SillyTavern, iPhone Safari/WebKit, actual extraction/NovelAI calls, real lower-tier accounts or cross-device races. See `docs/REVIEW.md` for linked findings and limits.

# v0.1.46 validation — 2026-11-03

- Extension Node suite: **136 passed, 0 failed, 0 skipped**. `costGuard` wording per account: Opus V4.5 free, Opus V5 may, Tablet/Scroll uses (V4.5 and V5), unknown account, over the free limits.
- Server Node suite: **24 passed**. New: Tablet and Scroll (tier 1, 2) blocked without consent with `anlas-consent`/428 and no NovelAI call, sent with consent, balance fields forwarded; NovelAI failures classified only from the reply (401 key; 402 with an Anlas note vs 402 "Payment required" → rejected; 403 permission vs empty; 403 "Insufficient permissions" is not an Anlas error; 429; 5xx; 400), note trimmed to 120 characters with tokens removed; the handler passes the code and never the key.
- **35 of 35 Chromium browser scripts passed.** New `browser-v0146` at 1100/375px: Tablet balance and cost line, consent block not sending and the button only showing the switch, consent on → image → balance re-checked with a difference since the last check, Settings showing the same check, a failed balance check after a finished image, NovelAI Anlas error re-checking the balance without the consent button, the server's consent refusal for an unchecked account, Opus V5 link and Opus V4.5 free line, width fit. `browser-v0130` follows the new switch description.
- Not exercised: real Tablet/Scroll accounts, NovelAI's actual error bodies for shortage/permission, free-trial API tokens, real SillyTavern, iPhone Safari.

# v0.1.45 validation — 2026-11-03

- Extension Node suite: **136 passed, 0 failed, 0 skipped**. Queue tests: nothing leaves while paused and held edits keep their data; resume sends them; resume terminates even when the state callback touches entries (a hang found and fixed during this work).
- Server Node suite: **22 passed** (server unchanged apart from the shared `draft-work.mjs` copy).
- **34 of 34 Chromium browser scripts passed.** `browser-v0141` adds: delete-all failing with an unsaved edit → notice, edit saved afterwards; chat-history deletion failing → same; refresh keeps the edit; a chat with images but no saved work → history deletion empties the window and nothing is saved. Both new checks fail on the v0.1.44 code. `browser-v014` checks the new separate-save wording.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, two real browsers, iPhone Safari.

# v0.1.44 validation — 2026-11-03

- Extension Node suite: **135 passed, 0 failed, 0 skipped**. The queue test now checks that after a deletion nothing is saved until the marker is read, and the next save uses the marker's revision.
- Server Node suite: **22 passed**. The deletion test now checks markers: no work to read, a save prepared before the deletion (`expectedRevision:null` or an old revision) gets 409, a save on the marker revision succeeds, delete-all counts only real work and gives every marker a new revision, a chat that never had work still accepts a first save, deleting single images keeps the work.
- **34 of 34 Chromium browser scripts passed.** `browser-v0141`'s mock follows the server's markers and enforces revisions, so the saves after deletion prove the extension reads the marker first. `browser-v040` (real server handlers) ran 3 more times after its wait fix.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, two real browsers at once, iPhone Safari.

# v0.1.43 validation — 2026-11-03

- Extension Node suite: **135 passed, 0 failed, 0 skipped**. New DraftQueue test: `quiesce` waits for a save in flight and drops unsent ones; a late write reply or late read after `forget` changes nothing.
- Server Node suite: **22 passed** (server unchanged apart from the shared `draft-work.mjs` copy).
- **34 of 34 Chromium browser scripts passed.** `browser-v0141` adds the two reported cases: (1) first save held before the server processes it → delete-all waits, order is save → delete, nothing returns after refresh; (2) save processed but its reply held → after deletion the next edit saves without a conflict; (3) 프리샷 work, switch to 챗샷, delete 프리샷 history from the all-chats view, switch back → empty, and no work is saved back. Both new checks fail on the 0.1.42 code (checked by running them against it). `browser-v014` checks the ZIP-off note and the shorter notice.
- Publication diff screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari, two real windows saving at once.

# v0.1.42 validation — 2026-11-03

- Extension Node suite: **134 passed, 0 failed, 0 skipped** (server repository alongside). New: deleted work starts a fresh file and an unchanged screen is not saved back.
- Server Node suite: **22 passed**. New: 프리샷 snapshots keep `mode`/`freeText` (≤4000 chars) and other snapshots never gain one; saved work deleted per chat, all at once and with a chat's whole history, while deleting single images keeps it.
- **34 of 34 Chromium browser scripts passed.** Updated scripts open ⋯ / 저장 ▾ through `tests/menu-helper.mjs`. `browser-v0140`: card buttons 저장/삭제/⋯, no seed or seconds on the card, ⋯ contents, save menu fold/outside click. `browser-v014`: one image has no ZIP option, PC default is separate files, ZIP toggle keeps the menu open and is remembered, separate saves skip a missing file. `browser-v0141`: viewer menu with two choices only, Escape/outside click/button fold it, shared and original downloads with no extra warning, restored notice with target number, delete-all and chat-history deletion forgetting work without re-saving. `browser-v031`: seed copy button, date without seconds. `browser-v0125` ran 5 more times without failing.
- Hover check with SillyTavern's own `a:hover{filter:brightness(1.25)}` added to the fixture: no filter on either save choice on all 17 skins. Phone-width screenshots of the save menu on classic/cream/matcha (local QA only).
- Publication diffs screened for credentials, personal paths and private character/lore data; none found.
- Not exercised: real SillyTavern, iPhone Safari multi-file downloads (ZIP is the touch default for that reason), real NovelAI calls.

# v0.1.41 validation — 2026-11-03

- Extension Node suite: **133 passed, 0 failed, 0 skipped**. Draft tests cover source-text/raw/payload omission, explicit raw consent, candidates/direct-input people/unfinished final JSON/one undo round trips, reference semantics for restored finals, queued saves during in-flight writes and failed-save retry.
- Server Node suite: **20 passed**. New endpoint tests exercise user/chat isolation, hashed filenames, revision-conflict refusal, raw consent/reasoning removal and preservation of previous work after a failed atomic replacement. No NAI request is needed for drafts.
- **34 of 34 Chromium browser scripts passed** across this update. New `browser-v0141` at 1100/375px covers chat/free separation, refresh restore without AI, persistent clear undo, changed-source reminder, save failure/retry, concurrent-writer refusal and explicit reload, stale delayed reads, cancellation while switching into a previously loaded chat, one-off settings after failure/success and completion after a chat change, raw-consent cancellation, and original/shared/cancel/session download-warning paths. Existing download regressions explicitly approve the original warning and still compare PNG bytes/ZIP contents. Real server-handler fixtures include the new draft route.
- Visual check: metadata confirmation at phone width; narrow action layout uses a full row for the shared choice at 360px and below. Screenshots and Korean fonts are local QA only.
- Saving is debounced; no polling, whole-chat-file saves or extra AI calls were added. Background/unload writes are best effort and unsaved work can be lost if the browser is forcibly terminated before saving completes.
- Publication files/diffs screened for credentials, personal paths and private character/lore data. No new private data identified. Historical metadata was not rewritten; external copies and nonlocal branches/releases were not audited.
- Not exercised: real SillyTavern, real extraction/NovelAI accounts, iPhone Safari background termination or native popovers.

# v0.1.40 validation — 2026-11-03

- Extension Node suite: **130 passed, 0 failed, 0 skipped**, with the server repository cloned alongside it. New regressions check message-scoped removal, preservation of another message's same image/native media/text, swipe cleanup, stale targets and save-failure rollback.
- **33 of 33 browser scripts passed** in headless Chromium. The new `browser-v0140` runs at 1100, 375 and 320px and checks compact history/attachment menus, viewport bounds, Escape/focus, horizontal preset actions, raw response and viewer prompt copying, blocked-copy feedback, per-message removal and stale-source refusal. Existing browser flows were adapted to the new menus and terminology.
- The existing `browser-v040` and `browser-v070` exercise the real server handlers with mocked NovelAI transport. No paid requests were sent.
- Visual inspection: history actions, enlarged prompt view and attachment menu at phone width. Korean fonts used for local screenshots are test-only and are not shipped.
- Menus use delegated events and create no polling loop. Opening a prompt from an attachment reads paged history on demand; no history request is made merely by scrolling chat.
- Current files and the publication diff were screened for credential patterns, personal paths, private character/lore data and accidentally included runtime files. No new private data was identified. Existing historical author metadata was not rewritten.
- Not exercised: real SillyTavern, iPhone Safari, actual extraction AI or NovelAI calls. Native popover behavior on iOS still needs device confirmation.

# v0.1.39 validation — 2026-11-03

- Extension Node suite **128 passed**, including the new `free-scene.test.mjs`:
  - prompt rules for one instant, selected people and no invented traits
  - saved appearances never sent to the text AI
  - empty and too-long text refused
  - roster people never carry an appearance, unknown ids become temporary people, and bad fields fall back
- **32 of 32 browser scripts passed**, including the new `browser-v0139` at 1280px and 375px:
  - clearing keeps the common prompt; undo survives a tab switch and restores people, candidate, wish, target, final edit, one-off options and preview together; an edit ends it; clearing is disabled while extracting
  - 프리샷 has its own work and the other mode's work is kept
  - 글로 채우기 with a selected profile and a described stranger, with no doubling and an English retry
  - no chat clothes; works after the chat closes and goes to its own history bucket with no attach controls
  - clearing is per mode, and history restore brings the text back
  - 프리샷으로 보내기 loads one moment, and the old 프리샷 work comes back with 되돌리기
- Checked 프리샷 and the undo bar by eye at 375px (cream).
- Not exercised: a real text model for 글로 채우기, real SillyTavern, iPhone Safari.

# v0.1.38 validation — 2026-11-03

- Extension Node suite **126 passed**. **31 of 31 browser scripts passed**, including the new `browser-v0138` at 1280px and 375px:
  - an empty scene asks first, and cancelling sends nothing
  - the box is folded with its scope and summary, edits the settings values (steps capped at 28), and the settings tab follows
  - a new preset is saved from the box; the overwrite button names its target; "수정됨" shows and clears after overwriting
  - history options show "이력 설정 · 이번 생성에만", edits stay one-off and are used, and it returns to normal after success or via 기본 설정으로 돌아가기
  - 설정을 프리셋으로 refuses empty or duplicate names and saves options with a new seed, the recovered common Positive and the image's Negative, with no scene or people, leaving current settings and the chosen preset unchanged
- Checked the box by eye at 375px in both modes.

# v0.1.37 validation — 2026-11-03

- Extension Node suite **126 passed**. **30 of 30 browser scripts passed**, including the new `browser-v0137` at 1280px and 375px:
  - from the no-profile list with extracted fields
  - the name stays out of the prompt, and the subject counts (2boys)
  - kept after generating and restored from history
  - re-extraction without them asks for a check; found again, fresh fields and the appearance kept
  - candidates carry them with a check
  - a blank add follows its name and can be removed
  - 프로필로 저장 fills the form and swaps the slot in every candidate without doubling
  - works with no profiles
- `browser-v060` now expects the add row to show only 임시 인물 추가 when there are no profiles.
- Checked the card by eye at 375px.

# v0.1.36 validation — 2026-11-03

- Extension Node suite **126 passed**; **29 of 29 browser scripts passed**. `browser-v0133` now checks:
  - the new names and the chat-default note
  - pressing "✓ 채팅 기본 복장" clears the default while keeping the lock
  - "정하지 않음" clears too
  - unlocking with no default removes the entry, and locking alone sets no default
  - the button turns off as soon as 이번 그림 복장 is edited

# v0.1.35 validation — 2026-11-03

- Extension Node suite **126 passed** (new: English-only rule in the prompt; Korean found in action/location but not in titles or names).
- **29 of 29 browser scripts passed**:
  - `browser-v0132` now covers a Korean reply followed by an English one: the retry asks for English, keeps structured output, and the English fields are used. A reply still Korean after the retry is used with a note.
  - `browser-v0133` checks the badges, the lit picker and the pressed "✓ 이 채팅 기본 옷" button, which turns off for a one-off outfit.
- Checked the card by eye at 375px in classic and cream; badges use the tab colours, which are contrast-tested per theme.

# v0.1.34 validation — 2026-11-03

- Extension Node suite **125 passed**; **29 of 29 browser scripts passed**. `browser-v0133` also checks the "nothing saved yet" line and the "✓ 이 채팅에 저장된 옷: hoodie · 평생 박제" confirmation.
- Read SillyTavern's code for chat metadata: `chatMetadata` is the open chat's metadata and `saveMetadata` saves the chat file, so 당분간 이 복장 and 평생 박제 are stored per chat. A real restart was not exercised here.

# v0.1.33 validation — 2026-11-03

- Extension Node suite **125 passed, 0 failed, 0 skipped** with server 0.1.8 present; the shared core matches apart from the version line. Server suite 18 passed.
- **29 of 29 browser scripts passed**, including the new `browser-v0133` at 1280px and 375px:
  - wardrobe edited in the profile form, default outfit untouched
  - 당분간 이 복장 saves for the chat and applies to this image over an AI-found outfit
  - 평생 박제 keeps it through re-extraction
  - 옷장에서 꺼내 입기 changes only this image
  - 옷장으로 refuses empty and repeated names, updates the profile and the open form, and survives a later form save
  - editing a wardrobe item does not rewrite the chat's saved clothes
  - 되돌리기 and 이 옷 당분간 입기 work
  - 프롬프트 보기 is built only when opened and copies
  - a backup round-trip keeps the wardrobe
- Checked the card and the profile wardrobe by eye at 375px (cream).
- Not exercised: real SillyTavern, iPhone Safari.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.

# v0.1.32 validation — 2026-11-03

- Extension Node suite **124 passed, 0 failed, 0 skipped**, including prompt checks for the beat rules, brief-moment priority and placement rules, cut-off detection (complete, fenced, cut, reasoning prefix, no JSON), and "one unreadable candidate in a complete reply is not cut off".
- **28 of 28 browser scripts passed**, including the new `browser-v0132`:
  - a new user starts at 8192 / one message
  - an existing user keeps 4096 / 3 until "권장값 적용", which leaves the message count alone
  - temperature is sent only with a separate connection and only when set; never on the main connection; structured output still sent
  - a cut-off reply shows two candidates without "마지막 순간" and with the 불완전 + main-preset hint
  - a reply cut before any candidate fails with the same hint
  - a complete two-candidate reply is not flagged
  - a hand-picked left position survives re-extraction on every candidate
- Read SillyTavern's current connection-manager code: the per-request payload is applied after the profile's preset, so the temperature reaches the request. Whether a model honours it was not tested.
- Not exercised: a real extraction model, real SillyTavern, iPhone Safari.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.

# v0.1.31 validation — 2026-11-03

- Extension Node suite **123 passed, 0 failed, 0 skipped**, including seven new `moments.test.mjs` cases: three moments with their own actions, the final one as default; older single-scene replies; a reply cut off mid-way keeps complete candidates; out-of-range default and extra moments; a requested moment not found; one unreadable candidate dropped; prompt rules and the wished moment passed as quoted data.
- **27 of 27 browser scripts passed**, including the new `browser-v0131` at 1280px and 375px: three candidates with the last checked; switching changes people, actions, place and missing-profile hints with no extra AI call; edits kept per candidate; a hand-edited final prompt asks before switching; the generation snapshot carries every candidate while the image prompt holds only the chosen one; history restore brings candidates back; the wished moment reaches the prompt, reports "not found" and clears on target change; a single scene hides the picker. `browser-v0120` now reads the extraction schema under `moments`.
- Checked the picker by eye at 375px in classic and cream.
- Not exercised: a real extraction model. Whether moments mix less depends on the model; UPDATE-CHECKLIST has three invented messages for a before/after check. Real SillyTavern and iPhone Safari were not exercised either.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.

# v0.1.30 validation — 2026-11-02

- Extension Node suite **116 passed, 0 failed, 0 skipped** (one fewer because the removed 코코아 theme no longer has a contrast test).
- **26 of 26 browser scripts passed**, including the new `browser-v0130` (saved 1536×1024 / 40 steps come back as 832×1216 / 28; no custom size entry; steps max 28; both notes shown) and an updated `browser-v0123` (icon sized like a font icon; crowded row wraps so no button is cut). `browser-skins` checks the swatch-only card, that it comes first in Settings, and that a saved 코코아 falls back to the default.
- Rebuilt a message from SillyTavern's own message template and stylesheet with a shared community chat theme applied, at a narrow width: before, the first buttons of the row were cut off; after, the row wraps and every button shows, with our icon level with the others.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- Not exercised: a real SillyTavern instance, iPhone Safari, a live NovelAI generation.

# v0.1.29 validation — 2026-11-02

- Extension Node suite **117 passed, 0 failed, 0 skipped**; the contrast check caught two 커피우유 colors on the darker latte body (warning text and checkbox outline), both darkened.
- **25 of 25 browser scripts passed**. `browser-v0123` adds a chat theme that clears every message-button background and clips a narrow row: the icon is still drawn at 20×20, the button is last in the extra menu and inside the row. The same check fails on 0.1.28 ("icon still drawn").
- Also loaded a real community chat theme's custom CSS into the test page: the icon was drawn.
- Checked the four redesigned themes by eye at 375px.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- Not exercised: a real SillyTavern instance and its mobile … menu, iPhone Safari.

# v0.1.28 validation — 2026-11-01

- Extension Node suite **117 passed, 0 failed, 0 skipped**, including contrast and no-layout-change checks for the two new themes and the redesigned 크리스마스.
- **25 of 25 browser scripts passed** in headless Chromium. `browser-skins` now checks the folded theme list (closed by default, current name in the title, opens on press) and all eighteen themes at 1280px and 375px; `browser-v060` confirms identical layout geometry on the three Christmas themes; `browser-v019` checks field readability on them under hostile input themes.
- Checked by eye at 375px: the garland and string lights stay below the header subtitle.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- Not exercised: a real SillyTavern instance, iPhone Safari.

# v0.1.27 validation — 2026-10-31

- Extension Node suite: **115 passed, 0 failed, 0 skipped**, with server 0.1.7 available. Existing skin checks include Christmas text/control contrast, scoped selectors and unchanged layout rules. All fifteen previous skin files remain byte-identical to v0.1.26.
- Two Chromium scripts passed: `browser-skins` and `browser-v016`. The skin test now covers sixteen choices, Christmas switching/saving, its berry-red viewer accent, mobile fit for every tab of every skin, one active skin stylesheet and deleted-file fallback. The second script verifies the unchanged page backdrop and existing profile-form/generation behavior.
- Inspected actual desktop (1100px) and mobile (390px) panel screenshots using an external test-only Korean font, including scene and Settings screens. No fonts, screenshots or browser runtime dependencies were added to the extension. Header decoration is static and hidden on viewports at or below 360px to avoid crowding the title.
- Pre-edit privacy scan covered 86 tracked files and 24 reachable commits. The only path match was a synthetic error fixture; the previously disclosed historical author email remains. New changes were checked separately. Remote issues, release attachments and external copies were outside this scan.
- Real SillyTavern, iPhone Safari and live AI providers were not exercised. No server changes.

# v0.1.26 validation — 2026-10-30

- Reproduced on the unchanged v0.1.25 parent: after scrolling the target list to 250px, collapse/reopen returned it to about 1px. The new browser regression passes after fixing.
- Extension Node suite: **114 passed, 0 failed, 0 skipped**, with server 0.1.7 available.
- Five targeted Chromium scripts passed: `browser-v0126`, `browser-v0125`, `browser-v0123`, `browser-v0122`, and `browser-v0121`.
- New 1280px/375px coverage checks collapse/reopen (including rapid toggling), retained loaded rows, tab round trips, close/Escape/reopen, message edits/new messages, browsing after selection, one-time direct-message target reveal, explicit latest/chat reset and horizontal fit.
- Pre-edit privacy scan covered 85 tracked files and 23 reachable commits. Only the known synthetic error path and previously disclosed historical author email matched; new changes were checked separately. Remote issues, release attachments and external copies were outside this scan.
- Scroll positions are page-session state. Real SillyTavern, iPhone Safari and live AI providers were not exercised. No server changes.

# v0.1.25 validation — 2026-10-29

- Extension Node suite: **114 passed, 0 failed, 0 skipped**, with server 0.1.7 available. Five new tests cover hidden/system classification, selected hidden context and original indices, immutable chat/main-chat input, default exclusion, user/reference filters, source validity, hidden attachment/removal and retained media/hide flags. The attachment case failed before fixing.
- Seven targeted Chromium scripts passed: `browser-v0125`, `browser-v0123`, `browser-v0122`, `browser-v0121`, `browser-v0120`, `browser-v0118`, and `browser-smoke`.
- New browser coverage at 1280px and 375px checks hidden character/user icons and labels, typed system notices excluded, manual extraction only, correct hidden reference range, no later text/reasoning sent, unchanged chat/hide fields, generation target guard, hidden-target generation/attachment, saved hide state, compact history fingerprints, default visible latest, live hide/unhide DOM updates, disabling icons and mobile fit.
- Updated old system-notice fixtures to include `extra.type`, matching SillyTavern's system-message constructor; untyped `is_system` alone also describes hidden RP. Checked the upstream hide function, system-message metadata and CSS at SillyTavern release `06bde939fb1e9c4c8d8641d810f0a916b5bce127`.
- Pre-edit privacy scan: 82 tracked files and 22 reachable commits; the path match was a synthetic error-test fixture, and the previously disclosed personal author email remains in old history. New changes were checked separately. Remote issues/release attachments/external copies were not inspected; history was not rewritten.
- Real SillyTavern, real group sessions, iPhone Safari and live AI providers were not exercised. The known system-type/UI metadata distinguishes notices; legacy records lacking that metadata remain available as hidden text for explicit selection. Server core is unchanged except the extension's version line.

# v0.1.24 validation — 2026-10-29

- Extension Node suite **109 passed, 0 failed, 0 skipped**; **23 of 23 browser scripts passed** in headless Chromium.
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- `browser-v0122` (1280px and 375px): chevron visible when closed; opens by keyboard; latest row first; list scrolls inside its own box; grows by ten until all 55 eligible messages are reachable and the more button hides; choosing the oldest message closes the picker and extraction uses it; on reopen the chosen row is checked and in view; new messages keep the choice; latest mode follows the newest; a 5,000-message chat builds only ten rows; chat switch resets; empty chat; names escaped; no horizontal overflow.
- Checked by eye at 390px in classic and cream.
- Not exercised: a real SillyTavern instance, iPhone Safari.

# v0.1.23 validation — 2026-10-29

- Extension Node suite **109 passed, 0 failed, 0 skipped**.
- **23 of 23 browser scripts passed** in headless Chromium, including the new `browser-v0123`: brand icon without gradient ids in drawer, menu and panel header; message button off by default and absent after re-renders; when on, present on AI and user messages only (not system or whitespace-only), inside the extra message menu, added to new messages without duplicates; click and Enter open the scene tab with that target and no automatic extraction; during an extraction the target is kept with the "진행 중인 작업이 끝난 뒤" notice; turning it off removes all buttons and they stay gone; saved "on" adds them at startup; 미니멀 shows the icon without a filter.
- Long-chat measurement (1,000 messages, 300 streamed text updates, two runs each): median frame 16.7 ms and p95 ≈ 17–18 ms both off and on. Full chat rebuild: about 63–96 ms off and 66–80 ms on, after switching the button to a shared background image (an inline vector icon per message had cost about 200 ms extra).
- Pre-push privacy check of the changes: no keys, personal paths, emails or story names.
- Not exercised: a real SillyTavern instance (its own message-menu behavior and mobile … menu), iPhone Safari.

# v0.1.22 validation — 2026-10-29

- Extension Node suite: **109 passed, 0 failed, 0 skipped**, with server 0.1.7 available.
- Four Chromium scripts passed: `browser-v0122`, `browser-v0121`, `browser-v0118`, and `browser-smoke`.
- New browser coverage at 1280px and 375px opens the actual HTML picker by keyboard, scrolls its ordinary content, reaches every eligible message across six pages, extracts the oldest selected message, preserves selection during page browsing/new messages, returns to latest mode, resets across chats and handles empty chats. A synthetic 5,000-message chat still renders at most ten preview buttons. This is a DOM-size check, not a performance benchmark.
- Checked desktop/mobile screenshots for layout; the test Chromium lacks Korean fonts, so Korean glyph appearance was not verified visually. Real SillyTavern, the user's native-menu failure, iPhone Safari and live AI providers were not exercised. The replacement removes reliance on the native menu rather than claiming its underlying browser issue was reproduced.
- Pre-publication privacy scan covered 80 current tracked files and 19 reachable commits before edits, and the final diff afterward. No new private data was found. The previously disclosed personal author email remains in old history; history was not rewritten. Remote issues, release attachments and external copies were outside this scan.

# v0.1.21 validation — 2026-10-29

- Extension Node suite: **109 passed, 0 failed, 0 skipped**, with server 0.1.7 available; shared core differs only in its version line.
- Five Chromium scripts passed: `browser-v0121`, `browser-v0118`, `browser-v0119`, `browser-v0120`, and `browser-smoke`.
- New browser coverage at 1280px and 375px checks newest-first targets, original message IDs/current selection, unchanged conversation order, four independent tab positions, delayed history refresh/images, explicit history reload, viewer return, close/Escape/reopen, rapid tab switches and horizontal fit. The order assertion failed on the unchanged parent before fixing.
- Scroll memory lasts for the current page session; reloading the browser page resets it. Real SillyTavern, iPhone Safari and live AI providers were not exercised.

# v0.1.20 validation — 2026-10-27

- Before fixing, reproduced three regressions in `matching.test.mjs`: an existing saved alias left in `unregistered`, a manually added person absent from the next roster, and name separator/Korean-spacing mismatches.
- Extension Node suite **109 passed, 0 failed, 0 skipped**, including six new scene-extraction tests for unresolved visual fields, later attachment, exact matching across the full local profile directory, ambiguity, linked card names and no invented pose/presence. The shared core still matches server 0.1.7 except its version line.
- Seven targeted Chromium browser scripts passed: `browser-v0120`, `browser-v0117`, `browser-v0118`, `browser-v0119`, `browser-v060`, `browser-v031`, and `browser-smoke`. The new script covers three visible people, a different card/chat, legacy name-only responses, late manual addition/re-extraction, creating and linking profiles with cached actions/outfits, undo, no extra AI call for cached restoration, request privacy and 375px fit.
- Updated the v0.1.18 collision fixture to use two alias owners: a unique saved alias now correctly auto-resolves before the warning. Kept the conflict rejection assertions. The smoke script also failed on the unchanged v0.1.19 parent because it expected historical prompts to survive a successful generation; it now asserts one-generation consumption and explicitly restores history again before testing dimension edits.
- Remaining browser scripts, real SillyTavern sessions, real group chats, iPhone Safari and live extraction/image providers were not exercised. Extraction and generation were mocked; the new prompt cannot guarantee that an external model notices every visible person. Old records with only names require a new extraction to obtain missing visual fields.

# v0.1.18 validation — 2026-10-27

Fixes for an outside review of 0.1.17 (all eight findings reproduced in code before fixing).

- Extension Node suite **93 passed, 0 failed, 0 skipped** (+2: stricter name matching — exact beats short, first-name and Korean given-name only, ambiguity stays a side character, Korean spacing; `{{char}}`/`{{user}}` filling).
- **18 of 18 browser scripts passed** in headless Chromium, including the new `browser-v0118`: Tab never reaches panel controls behind the warning and Escape closes only the warning; switching chats and closing the panel close it without generating or saving "don't ask again" in the other chat; 취소 with the box ticked saves nothing; 그래도 그리기 saves it and 경고창 다시 켜기 turns it back on; a profile started in chat A does not link to chat B's user; a failed save then a fixed save keeps the card link; linking adds the exact alias even when a partial name matches, refuses a name another profile owns, and 연결 되돌리기 restores alias, chat link and scene; in a group chat the member warning, card link and filled macros in the description sent. The same script fails (timeout) against 0.1.17.
- The new test also caught a missing refresh: after 그래도 그리기 with the box ticked, the "다시 켜기" line did not appear until the next render. Fixed.
- Pre-push privacy check: no keys, personal paths or emails; a screenshot-derived example name used in a comment and a unit test was replaced with an invented one before committing.
- Not exercised: a real SillyTavern instance or group chat, iPhone Safari, a live extraction provider.

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
