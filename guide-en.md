# Getting started

## Good to know first

> The **server plugin** runs on your own SillyTavern server and can reach files there.
> Your **NovelAI key** is kept by SillyTavern, and pictures and generation records are saved in your SillyTavern folder.
> When you press **[Extract scene]**, the chosen message (in Free Shot, the situation you wrote) and the people's info go to the Extraction AI.

Details are in [2. Privacy and what is saved](#privacy).

## What you need

NAIce Shot is an unofficial extension that turns scenes from your SillyTavern chats into NovelAI pictures. You can pick a moment in the chat, or write a situation yourself and draw it.

You need:

- The NAIce Shot extension
- The NAIce Shot server plugin, **v0.1.25 or later**
- A NovelAI API key saved in SillyTavern
- An Extraction AI connection — only for **[Extract scene]** and **[From a description]**. You can draw without it if you fill in the scene boxes yourself.

After installing, restart SillyTavern, open the panel (see **Opening the panel** below), and press **[Check server · NAI connection]** at the bottom of **Settings tab → NAI generation settings**.

Pictures cannot be made on a SillyTavern setup where the server plugin cannot be installed.

Making pictures may use Anlas, depending on your NovelAI subscription. Please read [6. Cost](#cost).

## Opening the panel

You can open the NAIce Shot panel from three places.

- **Extensions menu (🪄 magic wand):** press **NAIce Shot** in the list.
- **SillyTavern's extension settings:** open the **NAIce Shot** box and press **Open NAIce Shot**. This box is at the **top of the left column** of the extension settings. It only has the open button; the real settings are in the panel's **Settings** tab.
- **Draw button next to a message:** turn on **Show a draw button on messages** in the panel's **Settings tab → Pictures in chat → [Placement and view]**, and the button appears next to each message's date. Pressing it opens the Draw tab with that message chosen as the target. You still press extract and generate yourself.

# Privacy and what is saved {#privacy}

## Where is it saved?

Pictures and generation records are saved in the data folder of the SillyTavern user who is logged in. Nothing is sent to the developer.

- **Pictures:** `user/images/naice-shot/`
- **Generation records:** `naice-shot-records/`
- **Last work:** `naice-shot-work/`
- **Generation request recovery records:** `naice-shot-requests/`

A generation record holds the prompt, the generation settings, the Seed, the scene, the time it was made and the chat info. A Free Shot picture may also keep the situation text you wrote.

The chat messages themselves are not copied into the records as they are. But anything the AI quoted can stay in the scene or the prompt.

## Where does it go?

- **Extraction AI — Chat Shot [Extract scene]:** the chosen message's text and the speaker's name, the character card's file name if it is a character's message, the chat members' names and their links to profiles, the names · aliases · IDs · outfits of the profiles matched to that message, and your extra request.
- **Extraction AI — Free Shot [Extract scene]:** the situation you wrote, the names · aliases · IDs of **every saved profile**, and the names of people already in the scene (temporary people too). This is used to match the people in the situation with profiles.
- **Extraction AI — [From a description]:** the description you wrote and the value in the name box. When a profile is made from a character card or persona, that card's or persona's description is sent.
- **NovelAI:** the final prompt and the generation settings. The whole chat is not attached.

The NovelAI key is used on the server only to sign in, and it is never put in generation records or settings backups.

If you use outside AI services or outside hosting, please check their privacy policies too.

## Keeping the Extraction AI's raw replies

Set this in **Settings → Advanced → Also keep the Extraction AI's raw reply**. It is off by default.

- **Off:** generation records are saved, but the full raw reply from the Extraction AI is not kept.
- **On:** the raw reply is also saved in the history and last work of pictures made from now on. Anything inside `<think>`, `<thinking>`, `<analysis>` or `<reasoning>` tags is left out. Thoughts written in the reply without tags may stay.

A raw reply may quote chat text or names. Turning this off later does not delete raw replies that were already saved.

You can see and copy the current extraction reply with **[Extraction response]** on the Draw tab.

## More details

Why the server plugin is needed, what it can access and what the security risks are is explained in the [privacy and security notes](https://github.com/Near7707/NAIce-Shot/blob/main/docs/PRIVACY.md).

# Drawing

## Chat Shot — drawing a chat scene

Chat Shot makes a picture from a scene in the open chat.

1. In **Target message**, choose the message with the scene you want.
2. In **Messages to send · incl. target**, set how many messages the AI reads.
3. Press **[Extract scene]**.
4. Check and fix the people, expressions, actions, outfits and background that were extracted.
5. Choose the model and generation settings and press **[Generate image]**. **[↓ Generate]** at the bottom right of the screen jumps straight to the generate area.
6. Save the finished picture, or put it in the chat with **[Insert]**.

The earlier messages only help the AI understand what is going on. The moment to draw is taken from the target message.

If the target message is later edited, deleted or rerolled, the target and the extra request stay as they are and **[Extract scene]** stops. Check that the extra request still fits and choose the target message again. **Careful:** choosing the same message again keeps the extra request, but **choosing a different message (including the latest message) clears the extra request box.** To keep your request, copy its text first, choose the message, then paste it back. For people chosen with `@`, check after pasting that their pills are in the **Linked** row; if not, type `@` and choose them again. With **Latest message** as the target, it never stops. If the chosen message is deleted and the extra request is empty, the target switches to the latest message; if there is an extra request, the target stays as "message not found" and you are asked to choose again before extracting.

When a history picture from the same chat comes back with **[Send to Chat Shot]**, its extra request comes back with the target message it was drawn from. For an old picture whose message is not known, the extra request is left empty. If you change the target message while extracting, that extraction's result is not used.

If one message has several moments, up to 3 are shown as candidates, and the last moment is chosen at first.

The extraction can be wrong, so please check it before generating.

## Changing the moment you want

Write in Chat Shot's **Extra request · optional** box to change parts of the original scene.

> Make it evening. Mira is sitting and Leo is standing by the window.

The extra request is used only for this extraction and picture. The chat text, the profiles and the chat default outfits do not change.

Once candidates are shown, use **[Extract again with this request]** under them.

## Free Shot — drawing freely

Free Shot makes a picture without chat messages.

Switch to **Free Shot** at the top and write the scene in the **Situation · any language is fine** box.

> On a rainy day, Mira sits by the window reading a book. Warm indoor light.

Press **[Extract scene]** and the AI reads the situation and fills in the scene boxes. You can also fill the boxes yourself without the AI.

If you write a saved profile's name or alias, that person's look is used. A person without a profile can be added as a temporary person with **[+ Add person slot]**.

Free Shot's work and history are kept apart from Chat Shot's.

## Editing the prompt

The scene boxes are split up to be easy to read. When generating, they are joined like this:

- **Common prompt:** Common Positive + subject tag + location + lighting + camera + interaction between people
- **One prompt for each person:** subject tag + fixed look + outfit + own Positive + expression + action + position

For example, if Mira's look is `silver hair, blue eyes`, her outfit `black coat`, expression `smile` and action `reading a book`, Mira's prompt becomes `girl, silver hair, blue eyes, black coat, smile, reading a book`.

The Common Negative and each person's own Negative go to the negative prompts.

So you don't have to put each tag in the box with exactly the right name. Within one person's boxes, anything you write goes into that person's prompt. Still, it helps to split them like this:

- Things for one person only (`smiling, holding a cup`) → that person's boxes
- Background, lighting, camera, overall mood (`sunset, wide shot, cafe`) → the scene's common boxes

Clothes written in the action box still show in the picture, but they are not saved to the wardrobe or the outfit lock.

The outfit is decided in this order: **this edit → lock → new outfit suggested by the AI → chat outfit → default outfit.**

Open **Final prompt · edit for this generation** to edit exactly what will be sent. You can edit the Common Positive · Negative, each person's Positive · Negative and positions, and there is also **Edit as JSON · advanced**.

- Your edits are remembered with this chat's last work.
- After a successful generation it goes back to the assembled prompt. If generation fails, your edits stay so you can try again.
- **[Back to assembled prompt]** puts it back any time.
- Profiles, wardrobes and default outfits do not change.

**Transparent BG (V5 only):** turn on **Transparent BG · V5 only** above [Extract scene] to add the `transparent background` tag to the final prompt and leave the location field out. The AI is also told to extract without a location or background. Chat Shot and Free Shot each keep their own setting, on until you turn it off.

- It only adds a tag, so a background may remain. If an action (`sitting on a bench`), the lighting (`rain`) or the common Positive has background words, delete them in the final prompt. While it is on, this note shows above the generate button.
- Turned on for a scene already extracted, only the location is left out. Press [Extract scene] again to extract without a background.
- A hand-edited final prompt is not changed. If it lacks the tag, the note says so.
- To keep the transparency, save as **Original PNG**.

## Generation settings and presets

Set the model, size, Steps, Guidance and Seed in **3 · Generate**. More settings are in **More · CFG Rescale · Sampler**.

Put `-1` in Seed to use a new seed every time.

Keep settings you use often with **[Save as new preset]**. An image preset saves the Common Positive · Negative together with the generation settings.

The generation settings on the Settings tab and the Draw tab are linked. But Chat Shot and Free Shot each remember the settings chosen in them.

The quality tags and negative presets of the official NovelAI site are not added automatically. Please add them yourself if you need them.

# People

## Making character profiles

A profile keeps a character's look the same in every picture.

Register a name and look in **Profiles → [+ New profile]**. Write tags with **[Manual]**, or write a description in **[From a description]** and let the AI turn it into tags. You can fix what the AI wrote before saving.

A profile keeps:

- Display name and aliases
- Subject tag
- Fixed look
- Default outfit and wardrobe
- The character's own Positive / Negative

Profiles are shared by all chats. To draw your user character too, make a separate profile for them.

## Profile links and unregistered people

People are linked by the character card name, the user name, and profile names and aliases.

If someone is not linked automatically, choose the profile for this chat in **Profiles linked in this chat · auto-match**.

A person without a profile can still appear in the scene with an expression and action. To draw them, make a new profile or link an existing one.

If several profiles have the same name, none is picked at random. Please choose one yourself.

## Wardrobe and outfits

Save clothes you use often in a profile's **Wardrobe** with a name. For example: Mira's school uniform, going-out clothes, pajamas.

- **Chat default outfit:** what they usually wear in this chat
- **Outfit lock:** keeps the locked outfit even when the AI suggests new clothes
- **Outfit for this picture:** only for the current picture
- **Save to wardrobe:** keeps the current outfit to use again later

Adding new clothes to the wardrobe does not change the profile's default outfit.

## Choosing people with @

Type `@` in Free Shot's situation box or Chat Shot's extra request box and the profile list opens. Choose Mira and `@Mira` goes into the box, and it remembers which profile it is.

- People chosen from the list are always in the extraction, even people who are not in the message.
- Delete `@Mira` and the choice is gone too.
- You can choose exactly the right one even when profiles share a name.
- The **Linked** row under the box shows the people linked now as pills. An `@name` typed by hand is not linked yet, so it is not shown. When two or more profiles share a name, the pill also shows a short look.
- Press a pill and a small menu opens. **View profile** opens that person's profile, and **Pick again** changes it to another profile. **Remove from box** takes that `@name` out of the box (every time it appears for the same person). You can undo after changing or removing. If the new name is too long for the box, nothing changes and you are told.
- On a phone, the keyboard closes after you choose from the list. Tap the box again to keep writing.
- Editing the middle of `@Mira` or deleting part of it unlinks it. Type `@` and choose again.
- An `@name` typed by hand without the list is linked at extraction if exactly one profile matches.
- An `@name` pointing to a deleted profile must be chosen again before extracting. So must an `@name` whose person can no longer be known after an undo. These show in the Linked row as orange dashed **broken** pills. **Press a broken pill and the profile list opens right away**, so you can choose who it is (or use [Remove from box] if you don't need it). You can also type `@` in the box and choose again.

**Careful:** people chosen with `@` come before requests like `leave her out`. Please check the people before generating.

# Working with pictures

## The viewer and putting pictures in the chat

Press a picture to see it large. In the viewer you can zoom, and see and copy the prompt and Seed. At the fit-to-screen size, swipe down with your finger to close it (when zoomed in, the picture moves instead).

Press **[Insert]** to open this chat's message list. Choose a message, choose the default place, above the text or below the text in **Place** below it, and press **[Put in #N]** to add the picture to that message. The message text does not change.

Pictures made in another chat or in Free Shot cannot be put in this chat directly.

Press a picture in the chat to open the viewer. Under **⋯** in the viewer, **[Move above the text]** · **[Move below the text]** move only that picture, and **[Back to the default place]** makes it follow the default place again. A picture moved on its own stays where it is even when the default place changes.

Open **[Placement and view]** in **Settings → Pictures in chat** to set:

- **Default placement:** whether pictures show above or below the message text
- **Default placement in this chat:** when this chat should be different (leave it empty to follow the overall default)
- **Picture view in chat:** how several pictures in one message are shown — Slides, Grid or Stacked
- **Picture size in chat:** Small, Medium or Large
- **Show a draw button on messages:** adds a draw button to every message (see **Opening the panel** above)

To take a picture out of the chat only, use **[Take out of this message]**. The history and the original picture stay.

## Generation history

Pictures you made are gathered in the **History** tab. You can split them with **View**.

- **This chat:** pictures made in the current chat
- **All chats:** every picture made in chats
- **Free Shot:** pictures made in Free Shot
- **Everything:** all pictures

From a picture's **⋯ menu** you can send it to Chat Shot or Free Shot, use **Settings as a preset**, Insert, **Take this picture out of the chat** (when it is in this chat), **Edit tags**, go to the message, and more.

Sending to Chat Shot or Free Shot brings back that picture's final prompt and generation settings. The values on the Settings tab do not change.

## Favorites and tags

Press **☆** on a history card to make it a **★ favorite**. The **☆** filter at the top gathers favorites.

Add tags for finding pictures in **⋯ → Edit tags**. For example: `rain`, `window`. Up to 10 tags per picture, and up to 30 characters per tag.

The **#** filter gathers only pictures that have tags.

## Tag pop-up

When a character says a certain word in the chat, this shows a picture that has that word as a tag.

Turn it on in **Settings → Tag pop-up → Turn on in this chat**.

For example, if Mira's pictures have the tag `rain`, then when `rain` comes up in Mira's reply, one of that character's pictures pops up at random.

- **Short press:** see it large
- **Long press and drag:** move it
- **✕:** close

The pop-up stays until you close it. Its size and position are remembered separately on each device, and **[Reset position]** puts it back.

Free Shot pictures are not used in the pop-up. The pop-up does not change the chat file.

## Saving PNGs

Under a picture's **[Save ▾]**, choose one of two.

- **Clean PNG:** a copy without info like the prompt and Seed. It is made again in the browser. A picture made with a transparent background stays transparent; other pictures get a white base.
- **Original PNG:** the picture as it was made. It may contain the prompt and Seed. A transparent background stays transparent.

Clean PNG is recommended when sending to other people. Names or text visible in the picture itself are not removed.

You can pick several pictures in the history and save them at once; turn on **Bundle into one ZIP file** to get them as one ZIP. Saving several files may work differently depending on the phone browser.

## Deleting pictures

**[Delete]** in the history deletes the original PNG on the server together with its generation record. **This cannot be undone.**

- It is also taken out of this chat. The same picture put in another chat may show as **picture not found** there.
- If favorites are among them, the confirm tells you.
- **[Delete all history of this chat]** deletes this chat's pictures and records, and also this chat's last work memory.

To take a picture out of the chat only, use **[Take out of this message]** instead of deleting.

# Cost {#cost}

## Checking the cost

NAIce Shot makes pictures with your own NovelAI account. What is really used and whether Anlas is spent are decided by your NovelAI account status and NovelAI's policies.

The box above **[Generate image]** shows your account info and the cost conditions of this generation. The dot on the left means:

- **Green:** by the info checked, this is a free condition or uses your remaining V5 usage.
- **Orange:** Anlas is used, or you will be asked once more when generating.
- **Warning color** (differs by theme, dark orange by default): the account, subscription or V5 usage could not be checked, or cannot be used now.

The box also shows your Anlas balance and an Opus account's V5 usage. Check again with **↻**.

The numbers are from the last check. They do not guarantee the real result or cost.

## Opus and V5 usage

V4.5 on an Opus subscription can generate without Anlas when it meets the set free conditions.

V5 checks its base usage separately. The rules below are for an active Opus subscription that is not in a grace period.

- **Base usage 2% or more and usable now:** by the usage checked, it generates with V5 usage. You do not need to allow Anlas.
- **1% or less, 0%, only the V5 usage could not be checked, or not usable now:** every generation asks **"Generate this one anyway?"** It asks even if Anlas is allowed.
- **Subscription in a grace period or not active:** V5 usage is not looked at; the Anlas setting is followed.

Extra V5 usage you bought may show in the box, but for now it is not counted in this decision.

**Important:** if usage is spent elsewhere after the check, the real generation may spend Anlas.

## Allow possible Anlas use

This setting decides whether requests that may cost something can be sent. It is not on the Settings tab: it is the checkbox above **[Generate image]** in **Draw tab → 3 · Generate**. It is off by default.

- Tablet · Scroll subscriptions use Anlas for pictures, so this must be on.
- If the subscription check itself fails, this setting is followed.
- When only an Opus account's V5 usage could not be checked, it asks at every generation as above.

There are three sizes (portrait 832 × 1216, square 1024 × 1024, landscape 1216 × 832), and Steps go up to 28. These limits match the Opus subscription's free generation conditions. With an active subscription (not in a grace period) and within these limits, V4.5 follows the free conditions and V5 follows the V5 usage rules above. Tablet · Scroll subscriptions use Anlas even within these limits.

## Cost of scene extraction

**[Extract scene]** and **[From a description]** use a text AI. Depending on the connection, they may use message allowance or API cost.

In **Extraction AI** in the settings, you can choose the connection your story uses now, or a separately saved connection profile. Using a separate connection does not change your RP connection.

If extraction results keep getting cut off, check the separate connection's **Response limit for separate extraction**. Starting at 8192 is recommended.

# Work memory

## Remembering the scene you are working on

The last scene you worked on in each chat is remembered on the server. Free Shot work is remembered separately.

Even after visiting another chat or reloading, the scene comes back. You don't need to call the AI again. The scene, people, prompt, chosen moment, last result and more are saved.

A status like **Saving the last work…** shows at the top of the Draw tab. If the browser is forced closed before saving finishes, the last change may not be kept.

- **[Clear the canvas]:** clears the current scene. You can bring it back right away with **[↶ Undo clear]**.
- **Settings → Advanced → [Delete all saved work]:** deletes the work of every chat and of Free Shot. This cannot be undone. Generation history, profiles and settings stay.

## When the server connection is slow

If the server cannot be checked when the panel opens, work memory may not start right away. Press **[Check again]** on the Draw tab, or **[Check server · NAI connection]** at the bottom of **Settings tab → NAI generation settings**.

Once connected, the saved work is checked. If the scene on screen and the scene on the server differ, you are asked:

**"Load the last work saved on the server?"**

- **OK:** loads the server's work onto the screen.
- **Cancel:** keeps your edits on screen and pauses work memory.

Cancelling keeps the server's work as it is. But the edits left on screen are not saved on the server, so they may be lost when you change chats.

## When work memory is paused

While paused you can still edit, but nothing is saved on the server.

To continue, press **[Reconnect]**. It checks the server's last work again and asks again if it differs from the screen. Look at which side to keep before pressing OK.

## When the work was deleted somewhere else

If the same work was deleted in another browser or device, you may be asked:

**"The server has a record that this work was deleted. Clear the edits left on screen too?"**

- **OK:** clears the screen too.
- **Cancel:** keeps the edits on screen and pauses work memory. These edits are not saved on the server.

This check stops deleted work from coming back because of an old screen.

## Changing chats in Free Shot

While you use Free Shot, the previous chat's Chat Shot edits may not be saved yet. If you change chats then, you may see:

- **"The Chat Shot edits of the previous chat were cleared without being saved."** — unsaved Chat Shot edits were cleared.
- **"The Chat Shot edits of the previous chat were not saved on the server."** — saving failed or is not confirmed yet.

The Free Shot work itself stays, whatever the chat.

## When the work changed during generation

If you delete the work or load another work from the server while generating, the scene being drawn and the current screen may differ. Then the picture is kept only in the history, and the current screen is not overwritten.

**"Generation finished. The work changed meanwhile, so the result is only in the history."**

The picture is not lost. Please check the **History**.

While waiting for **[Check the same request again]** or the history's **[Retry saving]**, clearing the canvas, sending from the history to your work and similar actions are locked for a moment. They work again once the reply comes.

## Settings backup

In **Settings → Settings backup**, save a JSON file with **[Export profiles · settings]** and load one with **[Import backup]**.

A backup includes: profiles, aliases and wardrobes, common prompts, presets, generation settings, Extraction AI connection settings and more.

It does not include:

- The NovelAI API key
- Pictures you made and the generation history
- The last work saved on the server
- Per-chat outfits and links saved in chat files
- History pictures' tags and favorites, and the per-chat tag pop-up switch (your current values stay after importing)

**Careful:** importing replaces your current profiles and common settings, and **the scene being edited is cleared too.** **Allow possible Anlas use** and **Also keep the Extraction AI's raw reply** come in turned off, for safety.

Exporting your current settings before importing is recommended.

# When something goes wrong

## When saving a picture failed

Sometimes a picture is made but cannot be saved on the server. Then **Pictures waiting to be saved** may show in the history. Check again with **[Retry saving]**.

If the result could not be checked, **[Check the same request again]** may show. It checks the result of the same request; it does not make a new picture.

A timeout does not prove the picture was not made. If you are not sure whether it was made or whether Anlas was spent, please also check your NovelAI account's usage history.

## When a deletion could not be confirmed

If the server's reply is lost while deleting, the result may be unclear. Only confirmed deletions are shown on screen, and remaining pictures can be seen again in the history.

If the last work's deletion could not be confirmed, **Work is locked until the deletion is confirmed.** shows. Press **[Check deletion]**. Once confirmed, you can use it again.

If you took a picture out of a chat and are not sure it was saved, open that chat again to check.

## When a server notice shows

**"The server status could not be checked, so the request was not sent. Press again."**
It was not sent, for safety. Check the connection and press again.

**"The server plugin is too old, so the V5 generation was not sent."**
Update the server plugin to v0.1.25 or later.

**"The content changed while waiting, so the request was not sent."**
The prompt or settings changed while checking, so it stopped instead of making the picture with the old content. Check the current content and press **[Generate image]** again.

## Update order

When updating the server plugin and the extension together, the order matters.

1. Update the server plugin
2. Fully stop SillyTavern and start it again
3. Update the NAIce Shot extension
4. Reload the browser

If the server plugin was installed with Git and auto-update is on, it may update when SillyTavern starts.

If connection errors continue after updating, check where the server plugin is installed and its version.

## Uninstalling

When you no longer use NAIce Shot, remove it in this order.

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
