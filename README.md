# NAIce Shot v0.1.41

실리태번의 RP 장면을 추출해 NovelAI 그림을 생성하는 비공식 확장이에요. 캐릭터 외형 프로필, 장면·복장 편집, 생성 프리셋, 이미지 이력과 채팅 첨부를 지원해요.

## 설치 안내

NAIce Shot은 **확장(이 저장소)**과 **서버 플러그인([NAIce-Shot-Server](https://github.com/Near7707/NAIce-Shot-Server))** 두 부분으로 되어 있어요. 둘 다 설치해야 그림을 만들 수 있어요.

### 1. 확장 설치 (주소로 설치)

1. 실리태번 상단의 확장 메뉴(블록 아이콘) → **Install extension**을 눌러요.
2. 아래 주소를 붙여 넣고 설치해요.
   ```
   https://github.com/Near7707/NAIce-Shot
   ```
3. 업데이트는 확장 메뉴의 **Manage extensions**에서 NAIce Shot의 업데이트 버튼을 누르면 돼요.

### 2. 서버 플러그인 설치 (처음 한 번)

1. 실리태번의 `config.yaml`에서 `enableServerPlugins` 값을 `true`로 바꿔요.
2. 실리태번 폴더 안의 `plugins` 폴더에서 터미널(명령 프롬프트)을 열고 아래 한 줄을 실행해요.
   ```
   git clone https://github.com/Near7707/NAIce-Shot-Server naice-shot-server
   ```
3. 실리태번을 완전히 재시작하고 브라우저를 새로고침해요.
4. 실리태번 API 연결 화면에 NAI 키를 저장하고, **NAIce Shot → 설정 → 서버·NAI 연결 확인**을 눌러요.

이렇게 git으로 설치한 서버 플러그인은 **실리태번을 켤 때마다 자동으로 최신 버전으로 업데이트**돼요(`config.yaml`의 `enableServerPluginsAutoUpdate: true`가 기본값이에요).

### 휴대폰(Termux)에서 설치하기

Termux로 실리태번을 쓰는 경우에도 순서는 같아요. 명령은 Termux 화면에 입력해요.

1. **확장:** 휴대폰 브라우저로 실리태번에 들어가서 위 1번처럼 **Install extension**에 주소를 붙여 넣어요.
2. **서버 플러그인:** Termux에서 실리태번이 켜져 있으면 `Ctrl+C`로 먼저 꺼요(Termux 키보드 위 줄의 CTRL을 누른 채 C). 그리고 아래를 한 줄씩 입력해요. 실리태번 폴더가 `~/SillyTavern`이 아니라면 첫 줄의 경로를 바꿔 주세요.
   ```
   cd ~/SillyTavern/plugins
   git clone https://github.com/Near7707/NAIce-Shot-Server naice-shot-server
   ```
   `git: command not found`가 나오면 `pkg install git`을 먼저 실행해요.
3. **설정 켜기:** 아래로 설정 파일을 열어요.
   ```
   nano ~/SillyTavern/config.yaml
   ```
   `enableServerPlugins: false`를 찾아 `true`로 바꾸고, `Ctrl+O` → Enter로 저장, `Ctrl+X`로 나와요. 이미 `true`면 그대로 두면 돼요.
4. **다시 켜기:** 평소처럼 실리태번을 켜요(예: `cd ~/SillyTavern && ./start.sh`). 로그에 `[NAIce Shot] server ready`가 보이면 성공이에요.

서버 플러그인은 PC와 똑같이 실리태번을 켤 때마다 자동으로 업데이트돼요.

서버 플러그인 설치를 허용하지 않는 호스팅에서는 사용할 수 없어요. Node.js 20 이상을 사용하며, 개발 대상은 SillyTavern 1.19.0 staging이에요.

패널 이름 아래 **📖 사용 가이드 ›**를 누르면 쓰는 법을 주제별로 볼 수 있어요(0.1.106, 글은 [guide.md](guide.md)).

처음 사용할 때는 캐릭터와 유저의 이미지 프로필을 각각 만들고, **장면 추출 → 내용 확인·편집 → 이미지 생성** 순서로 진행해요. 별도 추출 AI 연결을 고를 수 있고, 추출 요청에도 해당 AI의 사용량·비용이 발생할 수 있어요. Opus의 V5 생성은 서버 플러그인 0.1.25 이상에서만 보내요(0.1.92). 활성 Opus 구독(유예 기간 아님)에서 기본 V5 사용량이 2% 이상이고 지금 쓸 수 있으면 허용 없이 생성하고, 1% 이하이거나, 계정 응답에 V5 사용량이 없거나, 사용량을 지금 쓸 수 없으면 생성할 때마다 "이번만 생성할까요?"라고 물어봐요. 구독 조회 자체가 실패하면 예전처럼 Anlas 사용 가능성 허용 설정을 따라요. 확인한 뒤 실제 생성 사이에 다른 곳에서 사용량을 쓰면 Anlas가 차감될 수 있어요.

**Opus가 아니어도 쓸 수 있어요.** Tablet·Scroll 구독은 그림마다 Anlas를 써서, **Anlas 사용 가능성 허용**을 켜야 생성돼요. 그리기창의 생성 버튼 위에 Anlas 잔액(↻로 다시 확인)과 이번 생성의 비용 조건이 보여요. 무료 체험 계정이 이 확장(외부 API)으로 그림을 만들 수 있는지는 확인되지 않았어요.

## 개인정보·저장 데이터 안내

- **API 키:** 실리태번에 저장된 NAI 키를 서버에서 읽어 NovelAI 인증에 사용해요. 이 확장의 설정 백업과 생성 이력에는 NAI 인증 헤더를 넣지 않아요.
- **추출 AI로 보내는 내용:** 챗샷은 선택한 범위의 메시지 본문·말한 사람 이름·캐릭터 카드 파일 이름, 채팅 참여자와 프로필의 연결, 그 메시지에 맞춘 프로필의 이름·별칭·ID·복장, 추가 요청 글이에요. 프리샷은 적은 상황 글, 저장된 모든 프로필의 이름·별칭·ID, 상황에 나온 기존 인물(임시 인물 포함) 이름이에요. 설명을 프로필로 바꿀 때는 입력한 설명(카드·페르소나에서 만들면 그 설명)과 이름 칸의 값을 보내요. 실리태번의 연결·프리셋 설정에 따른 추가 동작도 고려해 주세요.
- **NovelAI로 보내는 내용:** 최종 이미지 프롬프트, 캐릭터별 프롬프트와 생성 설정이에요. 생성 요청에 추출 응답 원문 전체를 추가로 보내지는 않아요.
- **설정 백업 JSON:** 캐릭터 프로필, 이름·별칭·카드 연결, 공통 프롬프트, 프리셋, 생성 옵션, 추출 연결 프로필 ID와 환경설정 등이 포함돼요. NAIce Shot이 내보내는 설정 백업을 다른 사람에게 공유하기 전에 내용을 확인해 주세요. 이력 그림의 태그·즐겨찾기(★)와 태그 추천 팝업 켜기는 채팅 이름이 들어 있어서 백업에 넣지 않아요(가져와도 지금 값을 그대로 둬요). 백업을 가져오면 편집 중인 장면은 비워져요.
- **생성 이력:** 프롬프트·생성 요청 데이터·장면 정보는 사용자 데이터 폴더에 저장해요. 추출 AI 원문은 기본으로 보관하지 않아요. 설정 → AI 응답 보관에서 직접 켜면 `<think>` 같은 사고 태그 안의 내용을 뺀 응답을(태그 없이 본문에 쓴 생각은 남을 수 있어요) 앞으로 생성하는 그림의 이력에 저장해요. 이전 버전에서 이미 저장한 원문은 자동 삭제하지 않아요. 그리기창의 마지막 작업(프롬프트·직접 입력한 인물 묘사 포함)은 서버의 `naice-shot-work/` 폴더에 저장되고, `설정 → 저장된 작업 모두 지우기` 또는 `이 채팅 이력 전체 삭제`로 지울 수 있어요. 채팅 파일에는 복장·연결·이미지 첨부 정보가 저장돼요. 전체 사용자 데이터 폴더를 백업하거나 공유하면 이러한 정보도 포함될 수 있어요.
- **PNG 공유:** `저장 ▾`을 누르면 `클린 PNG`와 `원본 PNG` 중에서 골라요. `원본 PNG`는 메타데이터를 포함할 수 있어요. `클린 PNG`는 브라우저에서 그림을 다시 인코딩해 PNG 메타데이터(EXIF 포함)와 알파 채널에 숨겨진 정보를 제거한 불투명 사본을 저장해요. 투명한 부분은 흰색 배경으로 합쳐져요. 결과·이력·크게 보기·채팅 첨부에서 사용할 수 있고, 여러 장은 `선택 저장 ▾`에서 ZIP 하나로 묶거나 한 장씩 받을 수 있어요. 원본과 생성 이력은 그대로 유지돼요. 그림 자체에 보이는 이름·글자는 제거하지 않아요.
- **접근 보호:** PNG는 채팅 표시를 위해 실리태번의 이미지 경로로 제공돼요. 인증과 접근 제한은 실리태번 설정을 사용하며, 확장이 별도의 로그인 기능을 추가하지는 않아요.
- **오류 화면 공유:** 파일 처리나 예상치 못한 내부 오류는 정리한 메시지로 표시해 로컬 경로를 노출하지 않아요. 선택한 추출 연결에서 반환한 임의의 오류 원문도 그대로 표시하지 않아요.

코드에 개발자용 별도 통계 수집·텔레메트리 전송 기능은 없어요. 서버 플러그인이 왜 필요한지, 권한과 보안 위험은 [docs/PRIVACY.md](docs/PRIVACY.md)에 정리했어요. 자세한 저장 위치와 검토 범위는 아래 영문 안내 및 [SECURITY-REVIEW.md](SECURITY-REVIEW.md)를 참고해 주세요.

## Detailed documentation (English)

Generate NovelAI illustrations from SillyTavern roleplay scenes, with saved character appearances, editable scene prompts, and per-character prompt slots.

This repository contains the browser extension. The UI is in Korean. The companion server plugin is in [NAIce-Shot-Server](https://github.com/Near7707/NAIce-Shot-Server); both are required.

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
- When a message holds several scenes, one extraction offers up to three moments to choose from (the last one by default), each with its own people, poses and place; an optional **추가 요청** field picks a moment and/or changes it for this picture (time, weather, camera, who is visible, a pose or clothing); fixed appearance stays with the profile, and the chat, profiles and chat clothes are not changed. What was applied is shown after extraction.
- Keep a wardrobe per profile and dress people per scene: 채팅 기본 복장 (this chat's default), 복장 잠금 (the AI cannot change it), 이번 그림 복장 (this image only) and 옷장에 저장 (keep it for later). History cards show the prompt that was sent.
- Adjust model, size, steps, Guidance and seed right in the drawing tab (그리기) (생성 설정), save or overwrite presets there, and turn a history image's settings into a new preset.
- 프리샷: draw with no chat at all — write a situation and the same **장면 추출** button fills the scene (names or aliases of saved profiles are recognised without adding them first and keep their look; anyone else becomes a temporary person); history images can be sent to 프리샷. 그리기창 비우기 (next to the 2 · 장면 편집 heading) empties the current work with a lasting 되돌리기. Generating without a 공통 이미지 프리셋 asks first.
- Save shared prompt and generation presets, including model, size, steps, Guidance, seed, CFG Rescale and sampler. (Noise Schedule is fixed to the default, karras.)
- Image size is one of three free sizes (832×1216, 1024×1024, 1216×832) and steps are capped at 28, so generations stay inside NovelAI's Opus free conditions for size and steps. Opus V5 goes by its own usage (0.1.90): no switch needed at 2 % or more, a question for each generation at 1 % or below.
- Generate one image at a time, inspect it in a zoomable viewer and download the original PNG.
- Attach images below existing messages without adding them to the RP message text or native media fields.
- Browse current-chat or all-chat history, filter by chat and delete individual or selected images.
- Optional draw icon on each message (Settings → 메시지에 그리기 버튼 표시, off by default): a small icon right after the message date, always visible (at the end of the message button row when a theme hides the date). It opens the drawing tab (그리기) with that message selected.
- Choose from seventeen visual themes with the 테마 card at the top of Settings (folded by default; it shows the current theme's colors): 기본 (follows the SillyTavern theme), 글래스, 미니멀, 파스텔 (sky blue and butter yellow), 크림 노트 (lined note paper), 말차 라떼, 딥 블루 (indigo night with sky-blue accents), 라벤더 (lavender with a purple-pink-peach glow), **애플 크림** (cream paper, red apple buttons and green leaf accents), three Christmas themes — **크리스마스** (evergreen with a snow-dusted tree, a fir garland and snow-capped buttons), **눈 오는 밤** (navy night, falling snow, string lights and a crescent moon) and **캔디케인** (cream with candy stripes, holly and green tabs) — and five milk skins: 우유 (milk-carton blue header), 딸기우유, 바나나우유, 초코우유 (chocolate drips), 커피우유 (latte with a foam header).

The model menu currently includes V5 Full/Curated and V4.5 Full/Curated. External model availability and account eligibility are not validated by this review.

## Requirements

- A SillyTavern installation where you can install and enable server plugins.
- Node.js 20 or newer, as declared by the server package.
- A NovelAI image API key saved through SillyTavern's existing key management.
- A working text-generation connection for AI extraction and description-to-profile conversion. Manual prompt generation does not require extraction.
- The source implementation targets SillyTavern 1.19.0 staging. Automated checks use fixtures and mocked providers; other versions and actual provider calls require local verification.

## Repository layout

NAIce Shot is split into two repositories so each part can be installed and updated with git:

| Repository | What it is | Where it goes |
|---|---|---|
| [NAIce-Shot](https://github.com/Near7707/NAIce-Shot) (this one) | Browser extension: `manifest.json`, scripts, styles, `skins/` | Installed by SillyTavern's extension installer |
| [NAIce-Shot-Server](https://github.com/Near7707/NAIce-Shot-Server) | Companion server plugin (`index.mjs`) | `<SillyTavern>/plugins/naice-shot-server/` |

`tests/` and the review notes are included for development; SillyTavern ignores them.

## Install

1. **Extension:** in SillyTavern open Extensions → **Install extension** and paste `https://github.com/Near7707/NAIce-Shot`. Update it later from **Manage extensions**.
2. **Server plugin:** set `enableServerPlugins: true` in `config.yaml`, then in `<SillyTavern>/plugins/` run:
   ```bash
   git clone https://github.com/Near7707/NAIce-Shot-Server naice-shot-server
   ```
   With `enableServerPluginsAutoUpdate: true` (SillyTavern's default) and git available, SillyTavern pulls plugin updates on every start.
   On Android/Termux the same commands work in Termux (`pkg install git` if git is missing; edit `config.yaml` with `nano`). See the Korean section above for a step-by-step version.
3. Restart SillyTavern fully, refresh the browser, save your NovelAI key in SillyTavern and use **NAIce Shot → 설정 → 서버·NAI 연결 확인**.

The server plugin imports SillyTavern's secrets module by relative path, so it must sit directly under `plugins/` (one folder deep).

Per-version notes (UI-only or UI + server) are in `CHANGELOG.md`.

## First use

The panel has a Korean user guide: **📖 사용 가이드 ›** under the name opens it over the panel (written in [guide.md](guide.md); privacy and server-plugin notes in [docs/PRIVACY.md](docs/PRIVACY.md)).

1. Save your NovelAI key in SillyTavern. NAIce Shot reuses that key on the server.
2. Open a character chat, then NAIce Shot.
3. Create profiles in `프로필` (Profiles), or use `새 프로필 만들기` (Create profile) on the drawing tab (그리기). Register the user's RP persona separately if it should appear in the image.
4. Keep fixed appearance and clothing in their respective fields. Use `설명으로 만들기` (From description) to generate a draft, or `직접 입력` (Direct input) to enter tags yourself. Review and save the result.
5. Enter shared positive and negative prompts in `설정` (Settings). Quality tags are not automatically added.
6. Start with a manually assembled scene to check image generation.
7. Select the target message and reference-message count, then choose `장면 추출` (Extract scene). Review the people, outfits, actions and background.
8. Expand `최종 프롬프트` (Final prompt) if you want to edit exactly what will be sent.
9. In section `3 · 생성` (Generate), choose a saved **common image preset** without leaving the drawing tab (그리기), then select `이미지 생성` (Generate image). Generation is manual. The scene and Settings pickers share the same selection; presets can be saved or overwritten in the generation settings box too.
10. Click the result to zoom and open **프롬프트 보기 → 프롬프트 복사**, save it with **저장 ▾** (클린 PNG or 원본 PNG), or attach it with `본문에 넣기` (Attach to message): a list of the chat's messages opens, newest first, with the message the picture was made for marked and already chosen; pick another if you like and press **#N에 넣기**. In History, tick several pictures and use **선택 본문에 넣기** to put them into one message at once.

History cards show the date (to the minute) and **저장 ▾ / 삭제 / ⋯**. **메시지로 가기** (bottom of ⋯, and in the enlarged viewer) scrolls to the message the image was attached to or made from; when they differ you choose. An image from another chat asks before switching. **저장 ▾** opens two choices with a one-line note each: **클린 PNG** (metadata removed) and **원본 PNG** (may contain prompt/seed metadata); a click elsewhere, the button again, or scrolling the containing view folds it. The explanation of metadata (EXIF included) removal, opaque copies and visible text that is not removed is shown in the history tab as **PNG 저장 안내** (not in the menus). **⋯** holds 챗샷으로 보내기, 프리샷으로 보내기, 설정을 프리셋으로, 본문에 넣기 and, when attached, removing the chat's attachments. The seed is shown and copyable in the enlarged viewer and is still stored for restoring and same-seed drawing. Attached images also have a corner **⋯**; **이 메시지에서 빼기** there or in the enlarged viewer removes only that message's attachment, keeping other copies, the original PNG and history.

History has four independent scopes: **이 채팅** (the open chat), **모든 채팅** (all chat images, excluding free shots), **프리샷** (free shots only), and **전체 보기** (everything). Changing the drawing mode does not change this filter. Mobile history uses two columns. **본문에 넣기** stays in each image menu: it is enabled for the open chat's images in every scope; other chat images and free shots show a disabled action with an explanation. Free history restores into 프리샷.

Profiles are shared across character chats. Scene extraction checks visible people against saved names, aliases and linked card names, including side characters. Unregistered people retain their extracted expression, action, position and clothing in the scene; creating or linking their profile restores those fields. Side characters also offer **기존 프로필 연결**. Manually adding a profile makes it a candidate in the next **장면 추출**, without forcing an absent person into the image. Old records that stored only a missing name need a fresh extraction to obtain the missing visual fields.

The expandable target-message picker lists newest messages first in a scrolling box. **이전 메시지 N개 더 보기** adds ten more rows. Hidden RP messages are marked **숨김** and can also use the optional draw icon. Selecting a hidden target explicitly sends it and the preceding reference range (including hidden RP) to the extraction AI, without changing chat hide flags. Latest mode and visible targets exclude hidden history. Images can be attached to hidden RP too. Explicit system-type/UI notices are excluded; legacy untyped `is_system` records cannot be distinguished reliably from hidden RP and are available for manual selection. The target-message list also remembers its browsing position and loaded rows when reopened. Each panel tab remembers its own scroll position when switching tabs or closing and reopening the panel, until the browser page is refreshed.

In **설정 → 채팅 속 그림** (folded; its title shows the current choices), choose a global default (**메시지 글 위** unless you pick 아래) and an optional **이 채팅의 기본 위치**. The chat setting is saved with the chat; selecting **전체 기본값 따르기** removes it. Existing attachments move immediately without changing message text. Each picture can also have its own place: choose **기본 위치 / 글 위 / 글 아래** in the 본문에 넣기 list, or open a chat picture and use ⋯ → **글 위로 옮기기 / 글 아래로 옮기기 / 기본 위치로 되돌리기**. A picture with its own place stays there when the defaults change.

Several pictures in one message show as **넘겨보기** (default: one picture at a time, in the same place and size as a single picture, with ‹ n/m › buttons under it — there is no swipe, so a sideways swipe stays SillyTavern's own), **격자** (pictures side by side at one height, wrapping to the next line) or **세로**, in **작게 · 보통 · 크게** (about 200 / 320 / 480px; in 격자 the row height is about 120 / 180 / 260px). No frame or background is added; pictures keep their shape and are never cropped.

The wardrobe shows compact outfit-name buttons; expand one to edit it, then save the profile. Removing an outfit requires confirmation. Adding and resetting forms do not focus text inputs or open the mobile keyboard. Status notices belong to the tab where the action started.

The drawing tab remembers one last work per chat on the server: people (including direct-input slots), scene candidates, chosen moment, target, manual final prompt, one-off generation options and preview. 프리샷 has its own separate work bucket. Returning or refreshing restores saved work without another AI request. Clearing saves an empty work with one undo; the undo survives chat changes and refresh until another edit, extraction or generation. Saved source signatures warn when chat text or swipes changed.

Work files live privately under the signed-in user's `naice-shot-work/`, separate from chat files and image history. Edits are debounced; the status line shows loading, saving or an error with retry. A concurrent edit from another window/device is refused instead of overwritten. Wait for saving to finish before force-closing the browser; background/unload saves are best effort. Profiles, wardrobes and shared settings are not part of the work draft.

**고급 → 추출 AI 응답 원문 추가 보관** (Settings) is off by default and asks before enabling. Generation records (JSON: prompts, settings, seed, scene, time, chat) are saved either way; this only adds the raw response. It controls raw extraction responses in both new image history and work drafts, with reasoning blocks removed. The current response is still viewable/copyable while retention is off. It does not add the response to PNG metadata or send it to NovelAI. Existing image history is unchanged.

Every save point (result, history card, history selection, enlarged viewer, attached image) offers the same two choices with their notes, 클린 first; choosing 원본 shows no further warning. Visible names/text in the picture are not removed. Selecting several history images adds **ZIP 파일 하나로 묶기**: on, one ZIP (**클린 ZIP / 원본 ZIP**); off, one PNG at a time with a short gap. The first default is one file at a time on a computer and ZIP on a touch device; your last choice is remembered. With ZIP off the menu notes that browsers may ask to allow several downloads; if some files are missing, use ZIP.

Saved work can be removed: **설정 → 마지막 작업 기억 → 저장된 작업 모두 지우기** deletes every chat's and 프리샷's saved work (image history, profiles and settings stay) and empties the drawing window. **이 채팅 이력 전체 삭제** also deletes that chat's saved work (and 프리샷 history deletion empties 프리샷's work, even while 챗샷 is open). Deleting waits for saves already on their way, and the server keeps a content-free deletion marker, so a save prepared earlier in another window is refused instead of bringing the work back. A restored chat work names its target message (`이 채팅에서 작업하던 장면을 불러왔어요 · 대상 메시지 #N`). Renaming a chat file starts a new work and a new history bucket, because SillyTavern identifies chats by file name.

If the server could not be reached when the panel opened, work memory connects later ([연결 다시 확인] in the drawing window or **서버·NAI 연결 확인** in Settings). It reads the saved work first and never replaces the screen silently: only when both the screen and the server hold different work does it ask. 취소 keeps the edit on screen and the saved work on the server and pauses work memory in this tab (the edit is not saved and is lost when the chat changes); **작업 기억 다시 연결** asks again. Every load of saved work (connecting, switching 챗샷 ⇄ 프리샷, the retry button) asks the same way whenever the screen holds other work, so work kept during the pause is never replaced silently. In 프리샷, a chat change does not save the old chat's 챗샷 work waiting off screen; if it held unsaved edits, the panel says they were dropped. When the server keeps a deletion record for the work (deleted in another window) and the screen still holds edits, a load asks "서버에 이 작업의 삭제 기록이 있어요. 화면에 남은 편집도 비울까요?" (취소 keeps the edit and pauses work memory); **서버 작업 다시 불러오기** after a refused save empties the screen without a second question. A generation started while work memory was paused does not change the starting chat's saved work when it ends in another chat, and a generation whose work was emptied or loaded again while it ran puts its picture in the history only.

Extraction can be cancelled. Image generation has no cancellation button once submitted. If you switch chats while generation runs, the server saves the result under the originating chat.

## @ profile references

In the 프리샷 situation and the 챗샷 추가 요청 field, type `@` to open a list of your profiles (name, aliases and a short look — hair, eyes, usual outfit — so people with the same name can be told apart). Picking one puts a pill-shaped **chip** like `@Leo` into the text. The chip keeps that exact profile's full id inside, so the link survives renames, sorting and reordering. A chip is one block: Backspace removes it whole, and removing it removes the link (nothing is kept outside the text). A name typed by hand (`@Leo`, `@레오랑`) or pasted from another app is confirmed into a chip just before extraction when it fits exactly one profile, and the notice says so.

- A profile picked with `@` is always in the extracted people and wins over a request to leave it out. Deleting the chip only removes that requirement; check the people ticks before generating.
- In 챗샷 this can add someone who is not in the message.
- Copying between the two fields keeps the chips; copying to another app gives `@Leo` as plain text. Saved work and history keep the full id, and sending a history picture back to the drawing panel brings the chips back. A profile deleted in the meantime shows as a dashed yellow **broken chip**; extraction stops until you remove it and pick again. The old 0.1.75 form `@Name#id` is shown as a broken chip too.
- Nothing is linked by guessing: an unknown name, a name shared by several profiles, letters stuck to a typed name (`@Leo가방`), a broken chip or a malformed `@Name#…` mark all stop the extraction with a note. Up to two particles may follow a typed name (`@Leo에게는`). An `@` inside a word (an email address) is not a reference.
- More required people than the model allows (V4.5: 6, V5: 22; the same profile counts once) stops the extraction.
- The extraction AI receives each reference as the profile's current name with its full id; no `@` or id reaches NovelAI. When the AI leaves a required person out, the card is added anyway (with the old expression and action cleared) and the notice says its expression and action are empty.

## Extraction connection

Use either the current SillyTavern connection or a saved connection profile selected inside NAIce Shot. A separate profile does not switch the active RP connection.

A missing selected profile causes an error instead of silently using another connection. If structured JSON output is unsupported, turn off `JSON 구조화 출력` in Settings. The independent extraction response limit applies to the separate-profile path.

Only selected message bodies, participant identities and relevant clothing data are sent for scene extraction; fixed appearance is assembled locally. Description conversion sends the description you provide. These operations can consume provider usage or incur API charges.

## Cost controls

`Anlas 사용 가능성 허용` means **Allow possible Anlas use**. It defaults to off and is reset to off when a settings backup is imported.

The code does not calculate V5 allowance or guarantee a free request. Enabling the switch permits a potentially billable request; the actual charge depends on NovelAI's account rules.

Opus V5 (0.1.90, server 0.1.24; since 0.1.92 server 0.1.25 is required): within the free conditions it is sent without the switch while the base V5 usage shows 2 % or more. At 1 % or 0 %, when NovelAI says the usage cannot be used, or when the account reply has no usable V5 usage (missing, or not a whole number from 0 — 0.1.91), the server checks just before sending, stops, and the panel asks "…이번만 생성할까요?" for that one request (also with the switch on). If the account check itself fails, the old rule applies: nothing is sent with the switch off, and with the switch on it is sent without that question. Opus V5 is sent only to server 0.1.25 or later (0.1.92): the panel asks the server for its version right before each V5 generation (no NovelAI call) and, with an older or unreachable server, sends nothing and says so — with the switch on or off. Extra (purchased) usage is shown but not counted yet. NovelAI has no request option that keeps Anlas untouched, so usage spent elsewhere between the check and the image can still cost Anlas.

Any subscription can use the extension. Opus gets free V4.5 images within the default sizes and 28 steps; Tablet and Scroll use Anlas for every image, so they need the switch on. Free-trial accounts with the external API are unverified.

Above **이미지 생성** the drawing tab shows the account box (0.1.67): line 1 is the tier and this generation's cost, e.g. "Opus · V4.5 무료 조건에 해당해요 ✓" (an active Opus, V4.5, default size, 28 steps or fewer), "Opus · V5 남은 사용량으로 생성" (green, 2 % or more), "Opus · V5 사용량 거의 소진 · 생성 때 확인" / "V5 기본 사용량 0% · 생성 때 확인" (orange, asked for each generation), "V5 사용량 확인 못 함" (red), "이 생성은 Anlas를 사용해요" (Tablet/Scroll, or over the free limits), "구독 비활성 · 무료 생성 대상 아님", or "계정 정보에서 필요한 항목을 확인하지 못했어요" when a field the check needs is missing (never read as "no"). Line 2 is the Anlas balance, the V5 usage (Opus) and when it was checked; tap it for the details. **↻** checks again. A failed check shows "잔액 확인 실패 · 다시 확인" instead of an old number. After an image the balance is checked again and shown as **이전 조회보다 −N** — a difference since the last check, not the price of that image. Settings → 서버·NAI 연결 확인 shows the same check.

With the switch off and a cost-bearing generation, the request is not sent and **Anlas 허용 설정으로 이동** points to the switch (it never turns it on). NovelAI's own errors are named only when its reply says why: NAI key, not enough Anlas, model permission, too many requests, NovelAI trouble; otherwise "NovelAI가 요청을 거절했어요" with NovelAI's short note in brackets (at most 120 characters, credentials removed).

Generation errors are not automatically retried. A timeout does not establish whether NovelAI completed or charged the request. Extraction may retry once after receiving an unparseable response.

## Preset and history settings

The drawing tab (그리기) and Settings tab both offer the saved common image preset list. Applying a preset loads its shared positive/negative prompts and saved generation options, reassembles the current scene and clears any manually edited final prompt or history settings override. The saved preset itself is not overwritten. Clearing the picker keeps the current values.

Restoring history uses that record's prompt, seed and options without changing persistent Settings values. A successful image generation consumes those temporary overrides once and returns to your current settings. Resetting the final prompt or switching chats also clears both overrides and refreshes the editor even if it has focus. A successful new scene extraction clears those temporary overrides as well. A failed or cancelled extraction leaves the previous edit intact. Editing the scene, applying a preset or changing generation settings also clears the history options override. The scene preset helper indicates when history settings take priority.

## History, attachments and storage

- Profiles, preferences and shared presets use SillyTavern extension settings under `naice_shot`.
- Chat bindings and outfits use chat metadata under `naice_shot`.
- Tags and favorites (★) of history pictures (0.1.84) use the same extension settings (`imageMarks`, keyed by the picture's ID, with its chat key), and so does the per-chat switch of the tag-suggestion popup (`tagPopupChats`). Neither goes into a settings backup. The popup reads a character reply after it is rendered and never writes the chat; [넣기] opens the usual 본문에 넣기 list.
- Inline image attachment metadata uses `extra.naice_shot_images`. Images are drawn above or below the message text (per picture `placement`, else Settings → 채팅 속 그림); the message text itself is never changed, so prompts, summaries and extraction do not see the images.
- PNG files use the `naice-shot/` subfolder of SillyTavern's user-images directory.
- Generation records use `<user data root>/naice-shot-records/`, outside the web-served image folder.
- Records include submitted prompts, exact payload and extracted scene. Raw extraction responses are omitted by default; explicit opt-in retains a copy with known reasoning tags removed. Older records are not automatically scrubbed. They do not include the NovelAI request authorization header.
- All-chat history is scoped to the authenticated SillyTavern user's data directory.
- **선택 저장 ▾** downloads the selected history images as 클린 or 원본, either one ZIP or one file at a time.
- `클린 PNG` exports an opaque, re-encoded copy without PNG text metadata or alpha-channel stealth data. `원본 PNG` preserves original bytes.
- Saved drawing work uses `<user data root>/naice-shot-work/` and can be deleted from Settings or with a chat's whole history.
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

Keep a backup of your user data. Update the extension from SillyTavern's **Manage extensions**; a git-installed server plugin updates itself when SillyTavern restarts. Settings and image data are stored outside these code folders.

## Troubleshooting

- **Yellow banner at the top of the panel:** the extension and server plugin versions do not match. Restart SillyTavern (a git-installed server updates itself) or update the extension from Manage extensions, then refresh. The banner can be closed; Settings → "서버·NAI 연결 확인" checks again.
- **Server plugin error / 404:** check that the server repository is cloned directly under `plugins/`, `enableServerPlugins` and a full server restart. The log should include `[NAIce Shot] server ready`.
- **No key configured:** save your NovelAI key in SillyTavern.
- **No matched profiles:** review profile names, aliases, card bindings and explicit per-chat bindings.
- **New appearance or outfit looks wrong:** inspect the final prompt and verify that clothing is not mixed into fixed appearance.
- **History prompt restored:** its settings temporarily override the Settings tab. Extract a new scene successfully or select a preset to use current settings again.

## Development and review records

Development notes, UI/server review findings, fixes and test references are maintained in [docs/REVIEW.md](docs/REVIEW.md). Installation and usage instructions remain in this README.

## License

NAIce Shot is released under the **GNU Affero General Public License v3.0** (see `LICENSE`), the same license family as SillyTavern, whose server modules the companion plugin imports. You may use, modify and share it; if you distribute a modified version, you must share its source under the same license. This summary is not legal advice.

## Uninstall

Delete NAIce Shot in **Manage extensions** and remove `plugins/naice-shot-server/`, then restart SillyTavern. Do not disable server plugins if other plugins need them. User settings, chats, generated PNGs and private records are not automatically deleted.
