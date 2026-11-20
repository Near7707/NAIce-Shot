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
