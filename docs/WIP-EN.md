# wip-en — English screen experiment

This branch tries one question: can a person who reads English pick a message in Chat Shot, extract the scene,
understand the cost, and generate one picture? It is not merged into main. main (0.1.162) is the stable Korean version.

## How to try it in SillyTavern

1. Export a backup first (Settings → backup), just in case.
2. Extensions → Manage extensions → NAIce Shot → **Switch branch** (branch icon) → `wip-en`. The server plugin stays as it is (0.1.25).
3. Reload SillyTavern. NAIce Shot → Settings → **화면 언어 · Language** → English → reload again.
4. To go back: set the language to 한국어, or switch the branch back to `main`. Settings, profiles, wardrobes,
   history and saved work are the same data on both branches; the only new value is `uiLanguage` in the settings.

## Rules of this branch

- **Korean is the source.** The Korean text in the code stays where it is and is the dictionary key. With Korean
  chosen (or nothing chosen), every function returns the text exactly as written.
- **Nothing translated is saved or compared.** Translation happens only at the moment text goes on screen:
  `tr` on texts written in index.js, `trMsg` on finished texts (thrown errors, the shared core, the server) in
  `notice` and a few display lines, `localize` on fixed words of panel.html and of HTML just put on screen.
  The undo label, outfit origins, warnings that are filtered by their words, and the `스텝 → Steps` wording stay Korean
  inside; they are translated after the code has read them.
- **AI prompts are unchanged.** Scene titles and the 추가 요청 words still come back in Korean. Changing the AI output
  language is the next decision, not this one.
- **No server change.** Server texts are translated in the panel when they are known.
- Version numbers, CHANGELOG, REVIEW and ROADMAP are not touched here (they change on main every version).

## What is in English now

Header, tabs, the drawing tab's fixed words, target message list, extraction progress and buttons, extraction
notices, request results frame, scene candidates heading, undo/clear buttons, work-memory line, generation settings
summary, account box, cost verdict and V5 usage notes, generation questions (no preset, V5 usage), generation
notices, the result area and its save menu, and the language switch itself (always both languages).

Still Korean (by choice for the first try): character cards and the "no profile for this person" box, Free Shot's
own texts, the Profiles / Settings / History tabs, the guide, the viewer, and texts the AI writes.

## Checks

- `node tests/i18n-compare.mjs <main index.js> index.js` — takes `tr`/`trMsg`/`localize` out and compares with main
  statement by statement. Expected differences: the import, `renderSettings`, `importSettings`, `bindEvents`,
  `initialize` (the language switch). Anything else means Korean behaviour may have changed.
- `tests/prompt-snapshot.test.mjs` — the AI prompts must equal `prompt-snapshot.json` (written from main 47f690d).
- `tests/browser-wip-en.mjs` — same AI reply in Korean and English saves the same work and sends the same prompt;
  buttons and progress stay English while redrawn; the V5 usage question is English and cancelling it sends nothing;
  Free Shot work saved on one language and loaded on the other still undoes as an extraction (both ways); the switch
  writes only `uiLanguage`.
- All earlier checks run unchanged (none of their expectations were edited).

## Stop rules

Stop and rethink if: saved work differs between languages for the same AI reply; an earlier check needs its
expectation changed to pass; `i18n-compare` shows a statement outside the expected list; one step needs more than
about 30 changed lines of working code (not text).

## Notes for whoever continues

- The translation function is `tr`, not `t`: index.js already uses `t` as a local variable in many places.
- The language is read once in `initialize` (`setLang(settings().uiLanguage)`), so a change applies after a reload.
  The switch (`#ncs-ui-language-box`) sits just above 설정 백업: earlier checks expect 테마 first and 설정 백업 last.
- Five places decide by Korean words. They keep doing so; translation comes after:
  1. the saved undo label (`undoClear.label`: present or not, and whether it starts with "추출 전") — made and saved in
     Korean, shown with `trMsg`. Wrapping the label in `tr` breaks undo across languages (browser-wip-en step 4 fails).
  2. outfit origin (`origin==='이번 편집'`, character cards — not translated yet; translate `ORIGIN_TEXT` values only).
  3. warnings filtered by their words (`startsWith('미등록 인물은…')`) — filtered first, then `warnings.map(trMsg)`.
  4. `stepsWord` (스텝 → Steps) — runs first, then `trMsg`; dictionary keys use the "28 Steps" wording.
  5. the viewer's "불러오는 중…" text comparison — the viewer is not translated; use its flag instead if it ever is.
- Big HTML blocks that hold a person's or the AI's words are not wrapped in `tr`; their fixed words are translated
  after drawing with `localize(root, skipSelector)`. The target list preview (chat text) is never localized.
- Only Free Shot's extraction leaves an undo; Chat Shot's does not. That is why the undo check uses Free Shot.
- Tools, run by hand with `node_modules` linked: `tests/i18n-wrap.mjs` (wraps the Korean texts of named functions
  with `tr`; `--dry` first), `tests/i18n-keys.mjs` (tr keys missing from the dictionary), `tests/i18n-compare.mjs`.
  The dictionary `i18n-en.mjs` is edited by hand.
- In `tests/browser-wip-en.mjs` the language is put into the settings the moment the extension creates them (an init
  script hooks `window.mock` and `extensionSettings.naice_shot`); setting it on `DOMContentLoaded` is too late.
- Keep this branch level with main: merge main into wip-en whenever main moves. Do not edit version numbers,
  CHANGELOG, REVIEW or ROADMAP here.
- Review notes and test recipes for the whole extension: [DEV-NOTES.md](DEV-NOTES.md) (Korean).
