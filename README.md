# NAIce Shot v0.1.7

실리태번의 RP 장면을 추출해 NovelAI 그림을 생성하는 비공식 확장이에요. 캐릭터 외형 프로필, 장면·복장 편집, 생성 프리셋, 이미지 이력과 채팅 첨부를 지원해요.

## 설치 안내

**브라우저 확장과 서버 플러그인을 모두 설치해야 해요. 현재는 수동 설치 방식이며, 실리태번 확장 설치 창에 이 저장소 주소를 붙여 넣는 방식은 지원하지 않아요.**

1. 이 페이지의 **Code → Download ZIP**으로 내려받아 압축을 풀어요.
2. `ui` 폴더 **안의 파일·폴더 전체**를 `<실리태번>/data/default-user/extensions/naice-shot/`에 복사해요. `manifest.json`이 이 경로 바로 아래에 있어야 해요.
3. `server` 폴더 **안의 파일 전체**를 `<실리태번>/plugins/naice-shot-server/`에 복사해요. `index.mjs`가 이 경로 바로 아래에 있어야 해요.
4. 실리태번의 `config.yaml`에서 기존 `enableServerPlugins` 값을 `true`로 바꿔요.
5. 실리태번 서버를 완전히 재시작한 뒤 브라우저를 새로고침해요.
6. 실리태번의 API 연결 화면에 NAI 키를 저장하고, 확장 메뉴의 **NAIce Shot → 설정 → 서버·NAI 연결 확인**을 눌러요.

다른 사용자 계정이나 사용자 지정 데이터 경로를 사용하면 2번 경로를 실제 사용자 데이터 폴더로 바꿔 주세요. 서버 플러그인 설치를 허용하지 않는 호스팅에서는 사용할 수 없어요. Node.js 20 이상을 사용하며, 개발 대상은 SillyTavern 1.19.0 staging이에요. 다른 버전에서는 호환성 확인이 필요해요.

처음 사용할 때는 캐릭터와 유저의 이미지 프로필을 각각 만들고, **장면 추출 → 내용 확인·편집 → 이미지 생성** 순서로 진행해요. 별도 추출 AI 연결을 고를 수 있고, 추출 요청에도 해당 AI의 사용량·비용이 발생할 수 있어요. V5 생성은 무료 사용량을 확정할 수 없어 **Anlas 사용 가능성 허용**을 켜야 요청할 수 있어요.

## 개인정보·저장 데이터 안내

- **API 키:** 실리태번에 저장된 NAI 키를 서버에서 읽어 NovelAI 인증에 사용해요. 이 확장의 설정 백업과 생성 이력에는 NAI 인증 헤더를 넣지 않아요.
- **추출 AI로 보내는 내용:** 선택한 범위의 메시지 본문, 인물 이름·연결 정보, 관련 복장 정보예요. 설명을 프로필로 바꿀 때는 입력한 캐릭터 설명을 보내요. 실리태번의 연결·프리셋 설정에 따른 추가 동작도 고려해 주세요.
- **NovelAI로 보내는 내용:** 최종 이미지 프롬프트, 캐릭터별 프롬프트와 생성 설정이에요. 생성 요청에 추출 응답 원문 전체를 추가로 보내지는 않아요.
- **설정 백업 JSON:** 캐릭터 프로필, 이름·별칭·카드 연결, 공통 프롬프트, 프리셋, 생성 옵션, 추출 연결 프로필 ID와 환경설정 등이 포함돼요. NAIce Shot이 내보내는 설정 백업을 다른 사람에게 공유하기 전에 내용을 확인해 주세요.
- **생성 이력:** 프롬프트·생성 요청 데이터·장면 정보는 사용자 데이터 폴더에 저장해요. 추출 AI 원문은 기본으로 보관하지 않아요. 설정 → 개인정보 보관에서 직접 켜면 사고 태그를 제거한 응답을 앞으로 생성하는 그림의 이력에 저장해요. 이전 버전에서 이미 저장한 원문은 자동 삭제하지 않아요. 채팅 파일에는 복장·연결·이미지 첨부 정보가 저장돼요. 전체 사용자 데이터 폴더를 백업하거나 공유하면 이러한 정보도 포함될 수 있어요.
- **PNG 공유:** `PNG 저장`은 메타데이터를 포함할 수 있는 원본이에요. `공유용 PNG`는 브라우저에서 그림을 다시 인코딩해 PNG 메타데이터와 알파 채널에 숨겨진 정보를 제거한 불투명 사본을 저장해요. 투명한 부분은 흰색 배경으로 합쳐져요. 결과·이력·크게 보기·채팅 첨부에서 사용할 수 있고, 여러 장은 `선택 공유용 저장`으로 ZIP에 모을 수 있어요. 원본과 생성 이력은 그대로 유지돼요. 그림 자체에 보이는 이름·글자는 제거하지 않아요.
- **접근 보호:** PNG는 채팅 표시를 위해 실리태번의 이미지 경로로 제공돼요. 인증과 접근 제한은 실리태번 설정을 사용하며, 확장이 별도의 로그인 기능을 추가하지는 않아요.
- **오류 화면 공유:** 파일 처리나 예상치 못한 내부 오류는 정리한 메시지로 표시해 로컬 경로를 노출하지 않아요. 선택한 추출 연결에서 반환한 임의의 오류 원문도 그대로 표시하지 않아요.

코드에 개발자용 별도 통계 수집·텔레메트리 전송 기능은 없어요. 자세한 저장 위치와 검토 범위는 아래 영문 안내 및 [SECURITY-REVIEW.md](SECURITY-REVIEW.md)를 참고해 주세요.

## Detailed documentation (English)

Generate NovelAI illustrations from SillyTavern roleplay scenes, with saved character appearances, editable scene prompts, and per-character prompt slots.

This repository contains the v0.1.7 preview source. The UI is in Korean. Installation requires both the browser extension and the companion server plugin; follow the manual installation steps below. No separate GitHub Release asset is provided by this source upload.

> **Unofficial project.** NAIce Shot is an independent, community-made add-on. It is not made, endorsed or supported by NovelAI (Anlatan) or the SillyTavern team. "NovelAI" and "SillyTavern" are used only to describe compatibility. Image generation uses your own NovelAI account and follows NovelAI's terms and pricing.
>
> **비공식 확장이에요.** NAIce Shot은 개인이 만든 독립 확장으로, NovelAI(Anlatan)나 SillyTavern 팀이 만들거나 지원하는 도구가 아니에요. 그림 생성은 사용자 본인의 NovelAI 계정으로 이루어지며 NovelAI 이용약관과 요금이 적용돼요.

## Features

- Save character profiles: names, aliases, fixed appearance, default outfit, positive and negative prompts.
- Create profile tag drafts from a written description using your chosen extraction AI.
- Extract the final visible scene from selected RP messages, including expressions, actions, clothing, setting, light and composition.
- Match story participants to profiles by name, alias, card binding or explicit chat binding.
- Keep outfits per chat, with manual editing and outfit locks.
- Edit assembled prompts through individual fields or advanced JSON.
- Save shared prompt and generation presets, including model, size, steps, Guidance, seed, CFG Rescale and sampler. (Noise Schedule is fixed to the default, karras.)
- Generate one image at a time, inspect it in a zoomable viewer and download the original PNG.
- Attach images below existing messages without adding them to the RP message text or native media fields.
- Browse current-chat or all-chat history, filter by chat and delete individual or selected images.
- Choose from five visual skins.

The model menu currently includes V5 Full/Curated and V4.5 Full/Curated. External model availability and account eligibility are not validated by this ZIP review.

## Requirements

- A SillyTavern installation where you can install and enable server plugins.
- Node.js 20 or newer, as declared by the server package.
- A NovelAI image API key saved through SillyTavern's existing key management.
- A working text-generation connection for AI extraction and description-to-profile conversion. Manual prompt generation does not require extraction.
- The source implementation targets SillyTavern 1.19.0 staging. Automated checks use fixtures and mocked providers; other versions and actual provider calls require local verification.

## ZIP contents

The repository contains the full source, including tests and review notes. To download it, choose **Code → Download ZIP** and extract the archive. The `ui/` and `server/` directories contain the installable components; tests and development notes are not copied into SillyTavern.

| Path | Purpose |
| --- | --- |
| `ui/` | Browser extension, manifest and skins |
| `server/` | Companion server plugin |
| `install.sh` | Optional installation script for Bash environments |
| `LICENSE` | GNU AGPL-3.0 license text |
| `tests/` | Unit tests and browser regression scripts (source only) |
| `SECURITY-REVIEW.md` | Package inspection, data flow and review limits |
| `TEST-REPORT.md` | Checks performed on this build (source only) |
| `UPDATE-CHECKLIST.md` | Installation and update checklist |

## Install manually (Windows, Linux or custom data directories)

1. Extract the ZIP.
2. Copy the **contents** of `ui/`, including `skins/`, to:
   `<SillyTavern user data>/extensions/naice-shot/`.
   For a default installation, the user data folder is typically `<SillyTavern>/data/default-user/`.
   The resulting extension folder must contain `manifest.json` directly, rather than another nested `ui/` folder.
3. Copy the **contents** of `server/` to:
   `<SillyTavern>/plugins/naice-shot-server/`.
   That folder must directly contain `index.mjs`, `handlers.mjs`, `core.mjs` and `package.json`.
4. In SillyTavern's root `config.yaml`, locate the existing setting and set:
   ```yaml
   enableServerPlugins: true
   ```
5. Restart the SillyTavern server completely, then refresh the browser.
6. Open NAIce Shot from the extension menu or extension settings. In Settings (`설정`), use `서버·NAI 연결 확인` to check the connection.

The server plugin imports SillyTavern's own secrets module by relative path. Keep the exact `plugins/naice-shot-server/` folder depth. No additional npm dependency installation is required for normal use.

For Docker or custom data roots, use the mounted directories actually used by your running server. A hosting provider that does not permit server plugins cannot run this build's image-generation backend.

**This ZIP is not a GitHub-URL-installable repository layout.** Keep both manual installation steps; installing only the UI is insufficient.

## Optional Bash installer

Run from the extracted `naice-shot/` folder:

```bash
bash install.sh /path/to/SillyTavern
```

For another user handle:

```bash
bash install.sh /path/to/SillyTavern my-user
```

The script supports SillyTavern's default `data/<user-handle>` layout. It backs up existing NAIce Shot extension/plugin files before replacing them. It does not edit `config.yaml`, application source, profiles or chat data. Use manual installation for custom data roots.

## Updating from 0.1.6 / 0.1.6에서 업데이트

**0.1.7은 UI와 서버 플러그인을 모두 바꿔야 해요.** `ui/`의 내용을 확장 폴더에, `server/`의 내용을 `plugins/naice-shot-server/`에 복사한 뒤 실리태번을 완전히 재시작하고 브라우저를 새로고침해 주세요. UI가 서버 0.1.7과 `privacy-controls` 기능을 확인해 이전 서버를 알려 줘요.

원문 보관은 기본 꺼짐이고, 설정 백업을 가져와도 자동으로 켜지지 않아요. 기존 이력과 원본 PNG는 자동으로 고치거나 지우지 않아요. 이전 그림도 `공유용 PNG`로 별도 저장할 수 있어요.

**Update both components:** replace the UI and the companion server plugin with 0.1.7, restart SillyTavern, and refresh the browser. Raw-response retention defaults to off and is reset to off on backup import. Existing records and original PNGs are not modified. The shared-copy export works on existing images too.

## Updating from 0.1.5

0.1.6 is a **UI-only** update. Replace all files in `extensions/naice-shot/` with the ZIP's `ui/` folder and refresh. Keep the 0.1.3 server plugin. The display-name and Noise Schedule settings are gone; values saved by earlier versions are ignored.

## Updating from 0.1.4

0.1.5 is a **UI-only** update. Replace all files in `extensions/naice-shot/` with the ZIP's `ui/` folder and refresh. Keep the 0.1.3 server plugin.

## Updating from 0.1.3

0.1.4 is a **UI-only** update. Replace all files in `extensions/naice-shot/` with the ZIP's `ui/` folder and refresh the browser. Keep the 0.1.3 server plugin; Settings shows "서버 플러그인 v0.1.3 · 확장 v0.1.4 · 함께 쓸 수 있어요" and no banner appears.

## Updating from 0.1.2

0.1.3 is a **UI + server** update. Replace `extensions/naice-shot/` with the ZIP's `ui/` folder and `plugins/naice-shot-server/` with its `server/` folder, then restart SillyTavern and refresh. If you replace only the UI, it still works with the 0.1.0–0.1.2 server plugin; Settings simply shows the older server version.

From this version on, the panel tells you when the two halves do not match, so a forgotten server update is visible as soon as you open the panel.

## Updating from 0.1.1

0.1.2 adds the license and disclaimer and refreshes the validation records. There is no behavior change. Replacing the files is optional; if you do, replace both the UI folder and the server plugin folder, then restart.

## Updating from 0.1.0

0.1.1 is a UI-only behavior update. Replace all files in `extensions/naice-shot/` with the contents of this ZIP's `ui/` folder, including `skins/`, then refresh the browser. The 0.1.0 server plugin remains compatible; the ZIP also includes its version-aligned copy. Profiles, settings and image history stay in the same locations.

## First use

1. Save your NovelAI key in SillyTavern. NAIce Shot reuses that key on the server.
2. Open a character chat, then NAIce Shot.
3. Create profiles in `프로필` (Profiles), or use `새 프로필 만들기` (Create profile) on the scene tab. Register the user's RP persona separately if it should appear in the image.
4. Keep fixed appearance and clothing in their respective fields. Use `설명으로 만들기` (From description) to generate a draft, or `직접 입력` (Direct input) to enter tags yourself. Review and save the result.
5. Enter shared positive and negative prompts in `설정` (Settings). Quality tags are not automatically added.
6. Start with a manually assembled scene to check image generation.
7. Select the target message and reference-message count, then choose `장면 추출` (Extract scene). Review the people, outfits, actions and background.
8. Expand `최종 프롬프트` (Final prompt) if you want to edit exactly what will be sent.
9. In section `3 · 생성` (Generate), choose a saved **common image preset** without leaving the scene tab, then select `이미지 생성` (Generate image). Generation is manual. The scene and Settings pickers share the same selection; saving or overwriting presets remains in Settings.
10. Click the result to zoom, use `PNG 저장` (Save PNG), or attach it with `본문 아래에 넣기` (Insert below message).

Extraction can be cancelled. Image generation has no cancellation button once submitted. If you switch chats while generation runs, the server saves the result under the originating chat.

## Extraction connection

Use either the current SillyTavern connection or a saved connection profile selected inside NAIce Shot. A separate profile does not switch the active RP connection.

A missing selected profile causes an error instead of silently using another connection. If structured JSON output is unsupported, turn off `JSON 구조화 출력` in Settings. The independent extraction response limit applies to the separate-profile path.

Only selected message bodies, participant identities and relevant clothing data are sent for scene extraction; fixed appearance is assembled locally. Description conversion sends the description you provide. These operations can consume provider usage or incur API charges.

## Cost controls

`Anlas 사용 가능성 허용` means **Allow possible Anlas use**. It defaults to off and is reset to off when a settings backup is imported.

The code does not calculate V5 allowance or guarantee a free request. For V5, the switch must be enabled before submission. Enabling it permits a potentially billable request; the actual charge depends on NovelAI's account rules.

Generation errors are not automatically retried. A timeout does not establish whether NovelAI completed or charged the request. Extraction may retry once after receiving an unparseable response.

## Preset and history settings

The scene tab and Settings tab both offer the saved common image preset list. Applying a preset loads its shared positive/negative prompts and saved generation options, reassembles the current scene and clears any manually edited final prompt or history settings override. The saved preset itself is not overwritten. Clearing the picker keeps the current values.

Restoring history uses that record's prompt, seed and options without changing persistent Settings values. A successful new scene extraction clears those temporary overrides and returns to your current settings. A failed or cancelled extraction leaves the previous edit intact. Editing the scene, applying a preset or changing generation settings also clears the history options override. The scene preset helper indicates when history settings take priority.

## History, attachments and storage

- Profiles, preferences and shared presets use SillyTavern extension settings under `naice_shot`.
- Chat bindings and outfits use chat metadata under `naice_shot`.
- Inline image attachment metadata uses `extra.naice_shot_images`. Images are drawn above or below the message text (Settings → 채팅 속 그림 위치); the message text itself is never changed, so prompts, summaries and extraction do not see the images.
- PNG files use the `naice-shot/` subfolder of SillyTavern's user-images directory.
- Generation records use `<user data root>/naice-shot-records/`, outside the web-served image folder.
- Records include submitted prompts, exact payload and extracted scene. Raw extraction responses are omitted by default; explicit opt-in retains a copy with known reasoning tags removed. Older records are not automatically scrubbed. They do not include the NovelAI request authorization header.
- All-chat history is scoped to the authenticated SillyTavern user's data directory.
- **선택 저장** downloads the selected history images: one as its PNG, several as a single ZIP file.
- `공유용 PNG` exports an opaque, re-encoded copy without PNG text metadata or alpha-channel stealth data; `선택 공유용 저장` exports several such copies in one ZIP. The original-save controls preserve original bytes.
- Image deletion removes PNGs and generation records. Attachments in the open chat are cleaned up; other chats can show a missing-image notice.

Generated PNGs are served through SillyTavern so they can appear in chat. Protect access to your SillyTavern instance. This extension does not add its own authentication layer.

## Earlier private installations

This renamed preview uses independent identifiers and storage paths. It does not automatically copy, rename or delete data from earlier private builds.

To transfer profiles and common settings, export a settings backup in the earlier build and import it into NAIce Shot. Chat outfits, bindings, attachments and image history are not migrated by settings import.

## Updates and versioning

This preview starts a new version sequence at **0.1.0**.

- Patch versions (`0.1.1`): compatible fixes.
- Minor versions (`0.2.0`): added functionality; any migration steps will be documented.
- Major versions (`1.0.0` and later): stable milestones or explicitly documented incompatible changes.

Keep a backup of your user data. For ZIP updates, replace UI files in `extensions/naice-shot/` and server files in `plugins/naice-shot-server/`, then restart SillyTavern and refresh the browser. Unless an update explicitly says UI-only, update both halves together. Settings and image data are stored outside these code folders.

For maintainers: when a release changes the server plugin in a way the UI depends on, raise `MIN_SERVER_VERSION` (and add any new feature flag to `REQUIRED_SERVER_FEATURES`) in `ui/compat.mjs`. When a server change needs a newer UI, raise `MIN_CLIENT_VERSION` in `server/handlers.mjs`.

This repository currently uses manual installation and updates. Pasting the repository URL into SillyTavern’s extension installer does not install the two components.

## Troubleshooting

- **Yellow banner at the top of the panel:** the UI and server plugin folders do not match. Follow the banner: replace the named folder from the same ZIP, restart SillyTavern and refresh. The banner can be closed; Settings → "서버·NAI 연결 확인" checks again.
- **Server plugin error / 404:** check folder depth, `enableServerPlugins` and full server restart. The log should include `[NAIce Shot] server ready`.
- **No key configured:** save your NovelAI key in SillyTavern.
- **No matched profiles:** review profile names, aliases, card bindings and explicit per-chat bindings.
- **New appearance or outfit looks wrong:** inspect the final prompt and verify that clothing is not mixed into fixed appearance.
- **History prompt restored:** its settings temporarily override the Settings tab. Extract a new scene successfully or select a preset to use current settings again.

## Development checks

```bash
npm test
```

This runs Node unit tests with mocked providers. Browser scripts are separate and require Playwright plus Chromium. See `TEST-REPORT.md` for what was actually run.

## License

NAIce Shot is released under the **GNU Affero General Public License v3.0** (see `LICENSE`), the same license family as SillyTavern, whose server modules the companion plugin imports. You may use, modify and share it; if you distribute a modified version, you must share its source under the same license. This summary is not legal advice.

## Uninstall

Remove `extensions/naice-shot/` and `plugins/naice-shot-server/`, then restart SillyTavern. Do not disable server plugins if other plugins need them. User settings, chats, generated PNGs and private records are not automatically deleted.
