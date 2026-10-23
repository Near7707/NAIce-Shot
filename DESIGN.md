# NAIce Shot architecture

## Browser extension

The UI obtains the current SillyTavern context. It selects RP messages, matches participants to locally saved profiles and requests a JSON scene from the configured text provider.

The scene contains variable visual information. Fixed appearance and individual positive/negative prompts are assembled from local profiles. Outfit resolution follows: manual edit, locked chat outfit, explicit extraction replacement, stored outfit, default outfit.

The UI validates generation options and sends the assembled prompt and a snapshot to the companion server. The image result can be inserted below an existing RP message using dedicated extension metadata.

## Companion server

The plugin ID is `naice-shot`. It registers status, history, generate and delete routes below `/api/plugins/naice-shot`.

The server resolves the current user's directories and reads the NovelAI secret through SillyTavern. The secret is used only in authorization headers for the fixed NovelAI origin. The server stores PNGs in the user-images subfolder `naice-shot` and request records in the private `naice-shot-records` folder.

Per-user generation locking avoids overlapping requests. Storage updates are serialized per user. Completed request IDs can return their stored result without sending another generation request.

## Independent identifiers

| Purpose | Identifier |
| --- | --- |
| Settings and chat metadata | `naice_shot` |
| Inline image metadata | `naice_shot_images` |
| Plugin/API prefix | `naice-shot` |
| Main panel | `naice-shot-dialog` |
| UI elements, classes and CSS variables | `ncs-` |
| Viewer classes | `ncsv-` |
| Server installation folder | `naice-shot-server` |

All identifiers are separate from earlier private builds. No automatic cross-build migration is included.
