# Current privacy changes — v0.1.7

Reviewed 2026-10-24 (Asia/Seoul). Both UI and server must be updated to 0.1.7. Validation: 95 Node tests and four targeted browser scripts passed; no live provider calls were made.

- Shared PNG exports are re-encoded on an opaque browser canvas. This removes copied PNG text/EXIF metadata and the alpha channel used for NovelAI stealth metadata. Transparent pixels are composited on white; originals and stored generation records are untouched. Visible text in an image is not redacted. A failed conversion never downloads the original as a shared copy.
- The NovelAI metadata format reference is the official repository: https://github.com/NovelAI/novelai-image-metadata . This feature addresses PNG metadata and its alpha-channel format, not arbitrary hidden information in visible RGB pixels.
- New generation requests omit raw extraction responses by default. Explicit boolean opt-in is required on the server; known think/thinking/analysis/reasoning tags, including an unterminated trailing block, are removed before persistence. Backup import resets opt-in to false. Existing records are not silently scrubbed or deleted.
- Only intentional application errors are returned verbatim. Filesystem errors, secret-reader failures and other unexpected errors use a generic response; separate text-provider error details are not displayed verbatim.
- No new external endpoint or npm runtime dependency was added. PNG cleanup runs in the user's browser and fetches only validated same-origin generated-image paths.

The earlier review below describes the older v0.1.6 package. Its noted missing privacy controls are superseded by the changes above; its installation and external-provider scope limits still apply.

---

# Package and data-flow review

Build: NAIce Shot v0.1.6 (UI) with server plugin v0.1.3. Reviewed 2026-10-23 (Asia/Seoul).

This review covers the repository's source files and selected runtime data paths. It is a scoped source/package review, not a penetration test or a certification.

## Packaged content

No real NovelAI key, other provider credential, private connection configuration, personal character-profile export, RP chat export or generated image/history record was found.

The package contains source code, generic test fixtures and documentation. Test credentials such as `test-secret-do-not-leak`, `k` and `mock-csrf` are deliberately fake.

Old personal author metadata was replaced with the generic project attribution `NAIce Shot contributors`. The repository excludes uploaded archives, tooling helpers, local logs, browser output, dependencies, runtime data and source-control metadata.

## Credential handling

- The browser extension does not store a NovelAI key.
- The server reads the current user's key with SillyTavern's `readSecret(..., SECRET_KEYS.NOVEL)`.
- It sends that key in an Authorization header to the fixed origin `https://image.novelai.net`, for subscription checking and image generation.
- Generated records store the image payload and snapshot, not that Authorization header.
- The status response returns selected subscription/allowance fields, not the secret or full subscription response.
- Separate extraction connections use SillyTavern's connection manager; only the chosen profile ID is stored by this extension.

The suite checks that the dummy NovelAI credential does not appear in successful generation responses. The same saved record object is written without that header.

## Provider-bound data

Scene extraction sends selected message text, identities and clothing context to the text provider selected by the user. Description-to-profile conversion sends the supplied character description.

NovelAI receives the final image prompt, negative prompt, per-character slots and generation options. There is no added analytics endpoint or telemetry sender in this source.

## Stored data and access assumptions

- Extension settings can contain user-entered profile descriptions and prompts.
- Chat metadata can contain outfits, bindings and attachment information.
- Private generation records contain prompts, extracted scene information and raw extraction responses.
- PNGs remain in SillyTavern's web-served user-image area so they can appear in chats. This is not private-record storage.
- API routes rely on SillyTavern authentication/CSRF handling and authenticated user directories; the extension does not provide a separate login mechanism.
- IDs and image paths are constrained; generation option checks and per-user storage separation have existing unit coverage.
- User-data backups can be sensitive even though this repository does not contain them.

## Scope and limits

0.1.3 adds `GET /status?quick=1`, which returns only `keyConfigured` (boolean), version, feature flags and `minClient`. It makes no NovelAI request, reads no file and returns no key material; it uses the same per-user context and SillyTavern authentication as the other routes.

The source has not been exercised against a live NovelAI account or a real user installation in this pass. 0.1.4 adds browser-side ZIP creation for 선택 저장: it fetches only the already-listed, path-validated `/user/images/naice-shot/<uuid>.png` URLs from the same origin, builds the archive in memory and hands it to the browser as a blob download. No new server route, no upload and no external request. ZIP entry names are sanitized (no folders or reserved characters). 0.1.5 only changes where already-attached images are drawn in the page (no new data, request or stored field beyond the `imagePlacement` setting, which is validated to `above`/`below`). 0.1.6 removes two settings and adds a form-reset button; no new data, request or stored field. For 0.1.6 the full browser regression suite (11 scripts, including two that drive the real server plugin handlers) was run in headless Chromium and passed. Authentication configuration, filesystem permissions, reverse proxies, external-provider behavior and other extensions were not audited.

The original naming/package review is retained here. Version 0.1.1 changes scene/preset UI state and version metadata; credential handling, endpoints and storage paths remain the same. The updated source ZIP was scanned again for credentials and private data. It does not claim to resolve every possible security issue in the host or extension.


## Repository publication review — 2026-10-24 (Asia/Seoul)

The v0.1.6 source was reviewed again before this repository upload. The 89 Node unit tests passed in this pass; browser tests and live provider calls were not rerun. Runtime source is unchanged from the reviewed ZIP. README publication and privacy notices were updated.

Additional checks with mocked upstream responses confirmed these existing behaviors:

- PNG metadata is preserved byte for byte, including any embedded prompt text. PNG sharing can therefore reveal information stored in that metadata; the extension currently has no metadata-stripping download option.
- Raw extraction responses are persisted in private generation records, including reasoning tags if present in the returned text. This is local retention, not a separate developer upload.
- Some filesystem errors are forwarded verbatim and can expose absolute installation paths to the requesting user. Error screenshots or bug reports should be checked before sharing.

These behaviors are disclosed in the README. This publication pass does not claim that they have been changed or that the host authentication configuration has been audited.

## v0.1.8 repository split

The extension now installs from this repository by URL, and the server plugin lives in NAIce-Shot-Server. Code behavior is unchanged apart from the phone viewer layout and update wording. Note for users: SillyTavern auto-updates git-installed server plugins on start, so server code updates arrive without manual review; turn off `enableServerPluginsAutoUpdate` in `config.yaml` if you prefer to update by hand. `tests/` is now inside the installed extension folder and is served as static files by SillyTavern; it contains only synthetic fixtures and no credentials.
