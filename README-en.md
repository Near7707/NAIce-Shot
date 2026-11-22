# NAIce Shot

[한국어](README.md) · **English**

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
- **Sharing PNGs:** **Save ▾** lets you choose a clean PNG or the original PNG. The original PNG may contain metadata. The clean PNG is re-encoded in the browser and saved as an opaque copy without PNG metadata (EXIF included) or information hidden in the alpha channel; transparent parts are merged onto white. It works from the result, the history, the large view and chat pictures, and several pictures picked in the history can be saved at once, as one ZIP or one by one. The original and the image history stay as they are. Names or text visible in the picture itself are not removed.
- **Access:** PNGs are served through SillyTavern's image path so they can show in the chat. Sign-in and access limits follow your SillyTavern settings; the extension does not add a login of its own.
- **Sharing error screens:** file errors and unexpected internal errors are shown as tidied messages that do not reveal local paths. Raw error text returned by the chosen extraction connection is not shown as is either.

The code has no separate statistics collection or telemetry for the developer. Why the server plugin is needed, and its permissions and security risks, are in [docs/PRIVACY.md](docs/PRIVACY.md). For exact storage locations and the review scope, see the [detailed documentation](README.md#detailed-documentation-english) and [SECURITY-REVIEW.md](SECURITY-REVIEW.md).

## More

The [detailed documentation](README.md#detailed-documentation-english) (features, requirements, repository layout, cost controls, history and storage, updates, troubleshooting, uninstalling) is in English in the main README.
