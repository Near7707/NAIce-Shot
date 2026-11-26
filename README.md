# NAIce Shot

**English** · [한국어](README.ko.md)

An unofficial SillyTavern extension that picks a scene from your roleplay and draws it with NovelAI. It keeps character appearance profiles, lets you edit the scene and outfits, and has generation presets, an image history and pictures in the chat.

The screen is in Korean or English. A new install starts in SillyTavern's language (Korean if SillyTavern is Korean, English for any other language). You can change it any time in the panel's Settings tab → **화면 언어 · Language** (applied after a reload).

> **Unofficial project.** NAIce Shot is an independent, community-made add-on. It is not made, endorsed or supported by NovelAI (Anlatan) or the SillyTavern team. Image generation uses your own NovelAI account and follows NovelAI's terms and pricing.

## Install

NAIce Shot has two parts: **the extension (this repository)** and **the server plugin ([NAIce-Shot-Server](https://github.com/Near7707/NAIce-Shot-Server))**. You need both to make pictures.

### 1. Install the extension (from its address)

1. Open SillyTavern's Extensions menu (the blocks icon) → **Install extension**.
2. Paste this address and install.
   ```
   https://github.com/Near7707/NAIce-Shot
   ```
3. To update, press NAIce Shot's update button in **Manage extensions**.

### 2. Install the server plugin (once)

1. In SillyTavern's `config.yaml`, set `enableServerPlugins` to `true`.
2. Open a terminal (command prompt) in the `plugins` folder inside your SillyTavern folder and run this line.
   ```
   git clone https://github.com/Near7707/NAIce-Shot-Server naice-shot-server
   ```
3. Restart SillyTavern completely and reload the browser.
4. Save your NAI key in SillyTavern's API connection screen, then press **NAIce Shot → Settings → Check server · NAI connection**.

A server plugin installed with git like this **updates itself to the latest version each time SillyTavern starts** (`enableServerPluginsAutoUpdate: true` in `config.yaml` is the default).

### On a phone (Termux)

The steps are the same if you run SillyTavern in Termux. Type the commands in Termux.

1. **Extension:** open SillyTavern in your phone's browser and paste the address into **Install extension**, as in step 1 above.
2. **Server plugin:** if SillyTavern is running in Termux, stop it first with `Ctrl+C` (hold CTRL on the row above the Termux keyboard and press C). Then type these lines one at a time. If your SillyTavern folder is not `~/SillyTavern`, change the path on the first line.
   ```
   cd ~/SillyTavern/plugins
   git clone https://github.com/Near7707/NAIce-Shot-Server naice-shot-server
   ```
   If you see `git: command not found`, run `pkg install git` first.
3. **Turn the setting on:** open the settings file.
   ```
   nano ~/SillyTavern/config.yaml
   ```
   Find `enableServerPlugins: false` and change it to `true`, save with `Ctrl+O` → Enter, and leave with `Ctrl+X`. If it is already `true`, leave it.
4. **Start again:** start SillyTavern as usual (for example `cd ~/SillyTavern && ./start.sh`). `[NAIce Shot] server ready` in the log means it worked.

The server plugin updates itself each time SillyTavern starts, the same as on a PC.

It cannot be used on hosting that does not allow server plugins. It needs Node.js 20 or later and is developed against SillyTavern 1.19.0 staging.

Press **📖 Guide ›** under the panel's name to read how to use it, topic by topic (the text is [guide-en.md](guide-en.md)).

## First use

Make an image profile for your character and for yourself (the user) first, then go **Extract scene → check and edit → Generate image**. You can pick a separate AI connection for extraction; extraction requests may also use that AI's usage or cost.

Opus's V5 generation is sent only with server plugin 0.1.25 or later. On an active Opus subscription (not in a grace period), when the basic V5 usage is 2% or more and usable now, it generates without asking. When it is 1% or less, when the account answer has no V5 usage, or when the usage cannot be used now, it asks "Generate this one anyway?" every time. If the subscription check itself fails, it follows the Anlas permission setting as before. If usage is spent somewhere else between the check and the actual generation, Anlas may be used.

**You can use it without Opus too.** Tablet and Scroll subscriptions use Anlas for each picture, so **Allow possible Anlas use** must be on to generate. Above the generate button you see your Anlas balance (↻ checks again) and the cost conditions of this generation. Whether a free trial account can make pictures through this extension (an outside API) has not been confirmed.

## Privacy and what is saved

- **API key:** the server reads the NAI key saved in SillyTavern and uses it for NovelAI sign-in. This extension's settings backup and image history do not contain the NAI sign-in header.
- **What is sent to the extraction AI:** for Chat Shot, the message text in the chosen range, the speakers' names, the character card file name, how the chat's people are linked to profiles, the names, aliases, IDs and outfits of the profiles matched to those messages, and your extra request. For Free Shot, the situation you wrote, the names, aliases and IDs of all saved profiles, and the names of existing people in the situation (temporary people included). When turning a description into a profile, it sends the description you entered (or the card's or persona's description) and the name field. Also consider what your SillyTavern connection and preset settings add.
- **What is sent to NovelAI:** the final image prompt, the per-character prompts and the generation settings. The whole extraction answer is not added to the generation request.
- **Settings backup JSON:** contains character profiles, names, aliases and card links, common prompts, presets, generation options, the extraction connection profile ID, preferences and so on. Check what is inside before you share a backup with others. Picture tags, favorites (★) and the tag suggestion popup switches contain chat names, so they are not put in the backup (importing keeps your current ones). Importing a backup clears the scene you are editing.
- **Image history:** prompts, generation request data and scene information are saved in your user data folder. The extraction AI's raw answer is not kept by default. If you turn on Settings → Advanced → **Also keep the Extraction AI's raw reply**, the answer minus the content inside thinking tags such as `<think>` is saved with the history of pictures you make from then on (thoughts written in the body without tags may remain). Raw answers already saved by earlier versions are not deleted automatically. The drawing screen's last work (including prompts and person descriptions you typed) is saved on the server in the `naice-shot-work/` folder, and you can delete it with Settings → Delete all saved work or Delete all history of this chat. The chat file stores outfits, links and attached pictures. If you back up or share your whole user data folder, this information may be included.
- **Sharing PNGs:** **Save ▾** lets you choose a clean PNG or the original PNG. The original PNG may contain metadata. The clean PNG is re-encoded in the browser and saved as a copy without PNG metadata (EXIF included) or information hidden in the alpha channel. A picture with a transparent background stays transparent (only the hidden lowest bit of each transparency value is rounded away); other pictures are merged onto white. It works from the result, the history, the large view and chat pictures, and several pictures picked in the history can be saved at once, as one ZIP or one by one. The original and the image history stay as they are. Names or text visible in the picture itself are not removed.
- **Access:** PNGs are served through SillyTavern's image path so they can show in the chat. Sign-in and access limits follow your SillyTavern settings; the extension does not add a login of its own.
- **Sharing error screens:** file errors and unexpected internal errors are shown as tidied messages that do not reveal local paths. Raw error text returned by the chosen extraction connection is not shown as is either.

The code has no separate statistics collection or telemetry for the developer. Why the server plugin is needed, and its permissions and security risks, are in [docs/PRIVACY.md](docs/PRIVACY.md). For exact storage locations and the review scope, see [Details](#details) below and [SECURITY-REVIEW.md](SECURITY-REVIEW.md).

## Uninstall

1. To remove the pictures too, first delete them in the extension's history. A picture and its generation record are deleted together.
2. Delete the NAIce Shot extension in SillyTavern's Manage extensions.
3. Stop SillyTavern and delete the whole `plugins/naice-shot-server` folder. On a phone (Termux): `rm -rf ~/SillyTavern/plugins/naice-shot-server`.
4. Start SillyTavern again.

If other server plugins need it, leave `enableServerPlugins` in `config.yaml` as it is.

These are not deleted automatically and stay in your user data folder (usually `data/default-user/`). Delete them yourself to remove everything:

- Generated pictures: `user/images/naice-shot/`
- Generation records: `naice-shot-records/`
- The drawing sheet's last work: `naice-shot-work/`

The extension's settings and the attachment information in chats also stay, but nothing uses them without the extension.

## Details

The sections below go deeper: every feature, where things are saved, cost rules and troubleshooting. Button names are written as they appear on the English screen.

### Features

- Save character profiles: names, aliases, fixed appearance, default outfit, positive and negative prompts.
- Create profile tag drafts from a written description using your chosen extraction AI.
- Extract the final visible scene from selected RP messages, including expressions, actions, clothing, setting, light and composition.
- Match story participants to profiles by name, alias, card binding or explicit chat binding.
- Keep outfits per chat, with manual editing and outfit locks.
- Edit assembled prompts through individual fields or advanced JSON.
- **Transparent BG · V5 only** (above **Extract scene**): adds `transparent background` to the final prompt, leaves the location out and tells the extraction AI to extract without a background. Chat Shot and Free Shot each keep their own setting. It only adds a tag, so a note above **Generate image** asks you to check the final prompt for background words. Save as **Original PNG** to keep the transparency.
- When a message holds several scenes, one extraction offers up to three moments to choose from (the last one by default), each with its own people, poses and place; an optional **Extra request** field picks a moment and/or changes it for this picture (time, weather, camera, who is visible, a pose or clothing); fixed appearance stays with the profile, and the chat, profiles and chat clothes are not changed. What was applied is shown after extraction.
- Keep a wardrobe per profile and dress people per scene: **Chat default outfit** (this chat's default), **🔒 Outfit lock** (the AI cannot change it), **Outfit for this picture** (this image only) and **Save to wardrobe** (keep it for later). History cards show the prompt that was sent.
- Adjust model, size, steps, Guidance and seed right in the **Draw** tab (**Generation settings**), save or overwrite presets there, and turn a history image's settings into a new preset.
- **Free Shot:** draw with no chat at all — write a situation and the same **Extract scene** button fills the scene (names or aliases of saved profiles are recognised without adding them first and keep their look; anyone else becomes a temporary person); history images can be sent to Free Shot. **Clear the canvas** (next to the **2 · Edit scene** heading) empties the current work with a lasting **↶ Undo clear**. Generating without an **Image preset** asks first.
- Save shared prompt and generation presets, including model, size, steps, Guidance, seed, CFG Rescale and sampler. (Noise Schedule is fixed to the default, karras.)
- Image size is one of three free sizes (832×1216, 1024×1024, 1216×832) and steps are capped at 28, so generations stay inside NovelAI's Opus free conditions for size and steps. Opus V5 goes by its own usage: no switch needed at 2 % or more, a question for each generation at 1 % or below.
- Generate one image at a time, inspect it in a zoomable viewer and download the original PNG.
- Attach images below existing messages without adding them to the RP message text or native media fields.
- Browse current-chat or all-chat history, filter by chat and delete individual or selected images.
- Optional draw icon on each message (Settings → **Show a draw button on messages**, off by default): a small icon right after the message date, always visible (at the end of the message button row when a theme hides the date). It opens the **Draw** tab with that message selected.
- Choose from seventeen visual themes with the **Theme** card at the top of Settings (folded by default; it shows the current theme's colors): Default (follows the SillyTavern theme), Glass, Minimal, Pastel (sky blue and butter yellow), Cream Note (lined note paper), Matcha Latte, Deep Blue (indigo night with sky-blue accents), Lavender (lavender with a purple-pink-peach glow), **Apple Cream** (cream paper, red apple buttons and green leaf accents), three Christmas themes — **Christmas** (evergreen with a snow-dusted tree, a fir garland and snow-capped buttons), **Snowy Night** (navy night, falling snow, string lights and a crescent moon) and **Candy Cane** (cream with candy stripes, holly and green tabs) — and five milk skins: Milk (milk-carton blue header), Strawberry Milk, Banana Milk, Choco Milk (chocolate drips), Coffee Milk (latte with a foam header).

The model menu currently includes V5 Full/Curated and V4.5 Full/Curated. External model availability and account eligibility are not validated by this review.

### Requirements

- A SillyTavern installation where you can install and enable server plugins.
- Node.js 20 or newer, as declared by the server package.
- A NovelAI image API key saved through SillyTavern's existing key management.
- A working text-generation connection for AI extraction and description-to-profile conversion. Manual prompt generation does not require extraction.
- The source implementation targets SillyTavern 1.19.0 staging. Automated checks use fixtures and mocked providers; other versions and actual provider calls require local verification.

### Repository layout

NAIce Shot is split into two repositories so each part can be installed and updated with git:

| Repository | What it is | Where it goes |
|---|---|---|
| [NAIce-Shot](https://github.com/Near7707/NAIce-Shot) (this one) | Browser extension: `manifest.json`, scripts, styles, `skins/` | Installed by SillyTavern's extension installer |
| [NAIce-Shot-Server](https://github.com/Near7707/NAIce-Shot-Server) | Companion server plugin (`index.mjs`) | `<SillyTavern>/plugins/naice-shot-server/` |

`tests/` and the review notes are included for development; SillyTavern ignores them.

The server plugin imports SillyTavern's secrets module by relative path, so it must sit directly under `plugins/` (one folder deep). Per-version notes (extension only, or extension + server) are in `CHANGELOG.md`.

### Step by step

The panel has a guide: **📖 Guide ›** under the name opens it over the panel (written in [guide-en.md](guide-en.md), Korean in [guide.md](guide.md); privacy and server-plugin notes in [docs/PRIVACY.md](docs/PRIVACY.md)).

1. Save your NovelAI key in SillyTavern. NAIce Shot reuses that key on the server.
2. Open a character chat, then NAIce Shot.
3. Create profiles in **Profiles**, or use **New profile** on the **Draw** tab. Register the user's RP persona separately if it should appear in the image.
4. Keep fixed appearance and clothing in their respective fields. Use **From a description** to generate a draft, or **Manual** to enter tags yourself. Review and save the result.
5. Enter shared positive and negative prompts in **Settings**. Quality tags are not automatically added.
6. Start with a manually assembled scene to check image generation.
7. Select the target message and reference-message count, then choose **Extract scene**. Review the people, outfits, actions and background.
8. Expand **Final prompt** if you want to edit exactly what will be sent.
9. In section **3 · Generate**, choose a saved **Image preset** without leaving the **Draw** tab, then select **Generate image**. Generation is manual. The scene and Settings pickers share the same selection; presets can be saved or overwritten in the generation settings box too.
10. Click the result to zoom and open **View prompt → Copy prompt**, save it with **Save ▾** (**Clean PNG** or **Original PNG**), or attach it with **Insert**: a list of the chat's messages opens, newest first, with the message the picture was made for marked and already chosen; pick another if you like and press **Put in #N**. In **History**, tick several pictures and use **Insert** in the selection bar to put them into one message at once.

History cards show the date (to the minute) and **Save ▾ / Delete / ⋯**. **Go to message** (bottom of ⋯, and in the enlarged viewer) scrolls to the message the image was attached to or made from; when they differ you choose. An image from another chat asks before switching. **Save ▾** opens two choices with a one-line note each: **Clean PNG** (metadata removed) and **Original PNG** (may contain prompt/seed metadata); a click elsewhere, the button again, or scrolling the containing view folds it. The explanation of metadata (EXIF included) removal, opaque copies and visible text that is not removed is shown in the History tab as **About saving PNGs** (not in the menus). **⋯** holds **Send to Chat Shot**, **Send to Free Shot**, **Settings as a preset**, **Insert** and, when attached, removing the chat's attachments. The seed is shown and copyable in the enlarged viewer and is still stored for restoring and same-seed drawing. Attached images also have a corner **⋯**; **Take out of this message** there or in the enlarged viewer removes only that message's attachment, keeping other copies, the original PNG and history.

History has four independent scopes: **This chat** (the open chat), **All chats** (all chat images, excluding Free Shot), **Free Shot** (Free Shot only), and **Everything**. Changing the drawing mode does not change this filter. Mobile history uses two columns. **Insert** stays in each image menu: it is enabled for the open chat's images in every scope; other chat images and Free Shot images show a disabled action with an explanation. Free Shot history restores into Free Shot.

Profiles are shared across character chats. Scene extraction checks visible people against saved names, aliases and linked card names, including side characters. Unregistered people retain their extracted expression, action, position and clothing in the scene; creating or linking their profile restores those fields. Side characters also offer **Link an existing profile**. Manually adding a profile makes it a candidate in the next **Extract scene**, without forcing an absent person into the image. Old records that stored only a missing name need a fresh extraction to obtain the missing visual fields.

The expandable target-message picker lists newest messages first in a scrolling box. **Show N earlier messages** adds ten more rows. Hidden RP messages are marked **hidden** and can also use the optional draw icon. Selecting a hidden target explicitly sends it and the preceding reference range (including hidden RP) to the extraction AI, without changing chat hide flags. Latest mode and visible targets exclude hidden history. Images can be attached to hidden RP too. Explicit system-type/UI notices are excluded; legacy untyped `is_system` records cannot be distinguished reliably from hidden RP and are available for manual selection. The target-message list also remembers its browsing position and loaded rows when reopened. Each panel tab remembers its own scroll position when switching tabs or closing and reopening the panel, until the browser page is refreshed.

In **Settings → Pictures in chat** (folded; its title shows the current choices), choose a global default (**Above the message text** unless you pick **Below the message text**) and an optional **Default placement in this chat**. The chat setting is saved with the chat; selecting **Use the overall default** removes it. Existing attachments move immediately without changing message text. Each picture can also have its own place: choose **Default (above/below the text)**, **Above the text** or **Below the text** in the **Insert** list, or open a chat picture and use ⋯ → **Move above the text / Move below the text / Back to the default place**. A picture with its own place stays there when the defaults change.

Several pictures in one message show as **Slides** (default: one picture at a time, in the same place and size as a single picture, with ‹ n/m › buttons under it — there is no swipe, so a sideways swipe stays SillyTavern's own), **Grid** (pictures side by side at one height, wrapping to the next line) or **Vertical**, in **Small · Medium · Large** (about 200 / 320 / 480px; in Grid the row height is about 120 / 180 / 260px). No frame or background is added; pictures keep their shape and are never cropped.

The wardrobe shows compact outfit-name buttons; expand one to edit it, then save the profile. Removing an outfit requires confirmation. Adding and resetting forms do not focus text inputs or open the mobile keyboard. Status notices belong to the tab where the action started.

The **Draw** tab remembers one last work per chat on the server: people (including direct-input slots), scene candidates, chosen moment, target, manual final prompt, one-off generation options and preview. Free Shot has its own separate work bucket. Returning or refreshing restores saved work without another AI request. Clearing saves an empty work with one undo; the undo survives chat changes and refresh until another edit, extraction or generation. Saved source signatures warn when chat text or swipes changed.

Work files live privately under the signed-in user's `naice-shot-work/`, separate from chat files and image history. Edits are debounced; the status line shows loading, saving or an error with retry. A concurrent edit from another window/device is refused instead of overwritten. Wait for saving to finish before force-closing the browser; background/unload saves are best effort. Profiles, wardrobes and shared settings are not part of the work draft.

**Settings → Advanced → Also keep the Extraction AI's raw reply** is off by default and asks before enabling. Generation records (JSON: prompts, settings, seed, scene, time, chat) are saved either way; this only adds the raw response. It controls raw extraction responses in both new image history and work drafts, with reasoning blocks removed. The current response is still viewable/copyable while retention is off. It does not add the response to PNG metadata or send it to NovelAI. Existing image history is unchanged.

Every save point (result, history card, history selection, enlarged viewer, attached image) offers the same two choices with their notes, Clean first; choosing Original shows no further warning. Visible names/text in the picture are not removed. Selecting several history images adds **Bundle into one ZIP file**: on, one ZIP (**Clean ZIP / Original ZIP**); off, one PNG at a time with a short gap. The first default is one file at a time on a computer and ZIP on a touch device; your last choice is remembered. With ZIP off the menu notes that browsers may ask to allow several downloads; if some files are missing, use ZIP.

Saved work can be removed: **Settings → Last work memory → Delete all saved work** deletes every chat's and Free Shot's saved work (image history, profiles and settings stay) and empties the drawing window. **Delete all history of this chat** also deletes that chat's saved work (and **Delete all Free Shot history** empties Free Shot's work, even while Chat Shot is open). Deleting waits for saves already on their way, and the server keeps a content-free deletion marker, so a save prepared earlier in another window is refused instead of bringing the work back. A restored chat work names its target message (**Chat scene loaded · Target message #N**). Renaming a chat file starts a new work and a new history bucket, because SillyTavern identifies chats by file name. A picture deleted here never comes back with saved work or **↶ Undo clear**, and another tab of this browser does not save it again: this browser keeps the ids of the last 500 deleted pictures (ids only) and leaves them out; work saved in another browser or device may still point at one, and then only the picture fails to show.

If the server could not be reached when the panel opened, work memory connects later (**Check again** in the drawing window or **Check server · NAI connection** in Settings). It reads the saved work first and never replaces the screen silently: only when both the screen and the server hold different work does it ask. **Cancel** keeps the edit on screen and the saved work on the server and pauses work memory in this tab (the edit is not saved and is lost when the chat changes); **Reconnect** asks again. Every load of saved work (connecting, switching Chat Shot ⇄ Free Shot, the retry button) asks the same way whenever the screen holds other work, so work kept during the pause is never replaced silently. In Free Shot, a chat change does not save the old chat's Chat Shot work waiting off screen; if it held unsaved edits, the panel says they were dropped. When the server keeps a deletion record for the work (deleted in another window) and the screen still holds edits, a load asks "The server has a record that this work was deleted. Clear the edits left on screen too?" (**Cancel** keeps the edit and pauses work memory); **Reload work** after a refused save empties the screen without a second question. A generation started while work memory was paused does not change the starting chat's saved work when it ends in another chat, and a generation whose work was emptied or loaded again while it ran puts its picture in the history only.

Extraction can be cancelled. Image generation has no cancellation button once submitted. If you switch chats while generation runs, the server saves the result under the originating chat.

### @ profile references

In the Free Shot situation and the Chat Shot **Extra request** field, type `@` to open a list of your profiles (name, aliases and a short look — hair, eyes, usual outfit — so people with the same name can be told apart). Picking one puts `@Leo` into the text, and the box remembers which exact profile (by its full id) that `@Leo` stands for, so the link survives renames, sorting and reordering, and two profiles with the same name stay apart. Text typed right after it keeps the link; editing inside `@Leo` or deleting part of it ends the link (the letters left are an ordinary typed name), and so does pasting or typing over a selected `@Leo`, even with the same-looking name. Undo and redo bring a link back together with its letters. A name typed by hand (`@Leo`, or with a Korean particle such as `@레오랑`) or pasted from another app is linked just before extraction when it fits exactly one profile, and the notice says so. (Up to 0.1.116 these were pill-shaped chips; since 0.1.117 both boxes are plain text boxes, because iPhone Safari would not type into the chip box inside SillyTavern.)

- A profile picked with `@` is always in the extracted people and wins over a request to leave it out. Deleting that `@name` only removes that requirement; check the people ticks before generating.
- In Chat Shot this can add someone who is not in the message.
- Copying between the two fields keeps the links; copying to another app gives `@Leo` as plain text. Saved work and history keep the full id, and sending a history picture back to the drawing panel brings the links back. A link to a profile deleted in the meantime stops the extraction until you remove that `@name` and pick again. The old 0.1.75 form `@Name#id` counts as such a broken link too.
- Nothing is linked by guessing: an unknown name, a name shared by several profiles, letters stuck to a typed name (`@Leo가방`), a broken link or a malformed `@Name#…` mark all stop the extraction with a note. Up to two Korean particles may follow a typed name (`@Leo에게는`). An `@` inside a word (an email address) is not a reference.
- More required people than the model allows (V4.5: 6, V5: 22; the same profile counts once) stops the extraction.
- The extraction AI receives each reference as the profile's current name with its full id; no `@` or id reaches NovelAI. When the AI leaves a required person out, the card is added anyway (with the old expression and action cleared) and the notice says its expression and action are empty.

### Extraction connection

Use either the current SillyTavern connection or a saved connection profile selected inside NAIce Shot. A separate profile does not switch the active RP connection.

A missing selected profile causes an error instead of silently using another connection. If structured JSON output is unsupported, turn off **Use JSON structured output when the connection supports it** in Settings. The independent extraction response limit applies to the separate-profile path.

Only selected message bodies, participant identities and relevant clothing data are sent for scene extraction; fixed appearance is assembled locally. Description conversion sends the description you provide. These operations can consume provider usage or incur API charges.

### Cost controls

**Allow possible Anlas use** defaults to off and is reset to off when a settings backup is imported.

The code does not calculate V5 allowance or guarantee a free request. Enabling the switch permits a potentially billable request; the actual charge depends on NovelAI's account rules.

Opus V5 (since 0.1.92 server 0.1.25 is required): within the free conditions it is sent without the switch while the base V5 usage shows 2 % or more. At 1 % or 0 %, when NovelAI says the usage cannot be used, or when the account reply has no usable V5 usage (missing, or not a whole number from 0), the server checks just before sending, stops, and the panel asks "…Generate this one anyway?" for that one request (also with the switch on). If the account check itself fails, the old rule applies: nothing is sent with the switch off, and with the switch on it is sent without that question. Opus V5 is sent only to server 0.1.25 or later: the panel asks the server for its version right before each V5 generation (no NovelAI call) and, with an older or unreachable server, sends nothing and says so — with the switch on or off. Extra (purchased) usage is shown but not counted yet. NovelAI has no request option that keeps Anlas untouched, so usage spent elsewhere between the check and the image can still cost Anlas.

Any subscription can use the extension. Opus gets free V4.5 images within the default sizes and 28 steps; Tablet and Scroll use Anlas for every image, so they need the switch on. Free-trial accounts with the external API are unverified.

Above **Generate image** the **Draw** tab shows the account box: line 1 is the tier and this generation's cost, e.g. "Opus · V4.5 free conditions met ✓" (an active Opus, V4.5, default size, 28 steps or fewer), "Opus · Generates with remaining V5 usage" (green, 2 % or more), "Opus · V5 usage nearly gone · asks when generating" / "V5 base usage 0% · asks when generating" (orange, asked for each generation), "V5 usage unknown" (red), "This generation uses Anlas" (Tablet/Scroll, or over the free limits), "Subscription inactive · not free", or "A needed field is missing from the account info" when a field the check needs is missing (never read as "no"). Line 2 is the Anlas balance, the V5 usage (Opus) and when it was checked; tap it for the details. **↻** checks again. A failed check shows "Balance check failed · check again" instead of an old number. After an image the balance is checked again and shown as **−N since last check** — a difference since the last check, not the price of that image. Settings → **Check server · NAI connection** shows the same check.

With the switch off and a cost-bearing generation, the request is not sent: the **Draw** tab says **Anlas use is not allowed.** and shows an **Allow Anlas use** box right there, which you tick yourself (it is never turned on for you). NovelAI's own errors are named only when its reply says why: NAI key, not enough Anlas, model permission, too many requests, NovelAI trouble; otherwise "NovelAI refused the request" with NovelAI's short note in brackets (at most 120 characters, credentials removed).

Generation errors are not automatically retried. A timeout does not establish whether NovelAI completed or charged the request. Extraction may retry once after receiving an unparseable response.

### Preset and history settings

The **Draw** tab and the Settings tab both offer the saved image preset list. Applying a preset loads its shared positive/negative prompts and saved generation options, reassembles the current scene and clears any manually edited final prompt or history settings override. The saved preset itself is not overwritten. Clearing the picker keeps the current values.

Restoring history uses that record's prompt, seed and options without changing persistent Settings values. A successful image generation consumes those temporary overrides once and returns to your current settings. Resetting the final prompt or switching chats also clears both overrides and refreshes the editor even if it has focus. A successful new scene extraction clears those temporary overrides as well. A failed or cancelled extraction leaves the previous edit intact. Editing the scene, applying a preset or changing generation settings also clears the history options override. The scene preset helper indicates when history settings take priority.

### History, attachments and storage

- Profiles, preferences and shared presets use SillyTavern extension settings under `naice_shot`.
- Chat bindings and outfits use chat metadata under `naice_shot`.
- Tags and favorites (★) of history pictures use the same extension settings (`imageMarks`, keyed by the picture's ID, with its chat key), and so does the per-chat switch of the tag pop-up (`tagPopupChats`). Neither goes into a settings backup. The pop-up reads a character reply after it is rendered and never writes the chat; tap its picture to view it large.
- Inline image attachment metadata uses `extra.naice_shot_images`. Images are drawn above or below the message text (per picture `placement`, else Settings → **Pictures in chat**); the message text itself is never changed, so prompts, summaries and extraction do not see the images.
- PNG files use the `naice-shot/` subfolder of SillyTavern's user-images directory.
- Generation records use `<user data root>/naice-shot-records/`, outside the web-served image folder.
- Records include submitted prompts, exact payload and extracted scene. Raw extraction responses are omitted by default; explicit opt-in retains a copy with known reasoning tags removed. Older records are not automatically scrubbed. They do not include the NovelAI request authorization header.
- All-chat history is scoped to the authenticated SillyTavern user's data directory.
- **Save ▾** in the History selection bar downloads the selected history images as Clean or Original, either one ZIP or one file at a time.
- **Clean PNG** exports a re-encoded copy without PNG text metadata or alpha-channel stealth data. Transparency is kept for pictures that have it (alpha values are rounded so 0 and 255 stay, edges move by at most 1/255); other pictures are merged onto white. **Original PNG** preserves original bytes, transparency included.
- Saved drawing work uses `<user data root>/naice-shot-work/` and can be deleted from Settings or with a chat's whole history.
- Image deletion removes PNGs and generation records. Attachments in the open chat are cleaned up; other chats can show a missing-image notice.

Generated PNGs are served through SillyTavern so they can appear in chat. Protect access to your SillyTavern instance. This extension does not add its own authentication layer.

### Earlier private installations

This renamed preview uses independent identifiers and storage paths. It does not automatically copy, rename or delete data from earlier private builds.

To transfer profiles and common settings, export a settings backup in the earlier build and import it into NAIce Shot. Chat outfits, bindings, attachments and image history are not migrated by settings import.

### Updates and versioning

This preview starts a new version sequence at **0.1.0**.

- Patch versions (`0.1.1`): compatible fixes.
- Minor versions (`0.2.0`): added functionality; any migration steps will be documented.
- Major versions (`1.0.0` and later): stable milestones or explicitly documented incompatible changes.

Keep a backup of your user data. Update the extension from SillyTavern's **Manage extensions**; a git-installed server plugin updates itself when SillyTavern restarts. Settings and image data are stored outside these code folders.

### Troubleshooting

- **Yellow banner at the top of the panel:** the extension and server plugin versions do not match. Restart SillyTavern (a git-installed server updates itself) or update the extension from Manage extensions, then refresh. The banner can be closed; Settings → **Check server · NAI connection** checks again.
- **Server plugin error / 404:** check that the server repository is cloned directly under `plugins/`, `enableServerPlugins` and a full server restart. The log should include `[NAIce Shot] server ready`.
- **No key configured:** save your NovelAI key in SillyTavern.
- **No matched profiles:** review profile names, aliases, card bindings and explicit per-chat bindings.
- **New appearance or outfit looks wrong:** inspect the final prompt and verify that clothing is not mixed into fixed appearance.
- **History prompt restored:** its settings temporarily override the Settings tab. Extract a new scene successfully or select a preset to use current settings again.

### Development and review records

Development notes, UI/server review findings, fixes and test references are maintained in [docs/REVIEW.md](docs/REVIEW.md).

### License

NAIce Shot is released under the **GNU Affero General Public License v3.0** (see `LICENSE`), the same license family as SillyTavern, whose server modules the companion plugin imports. You may use, modify and share it; if you distribute a modified version, you must share its source under the same license. This summary is not legal advice.
