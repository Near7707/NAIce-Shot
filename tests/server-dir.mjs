// The server plugin lives in its own repository (NAIce-Shot-Server). Tests that drive the real
// server handlers look for a clone next to this one, or at NAICE_SERVER_DIR, and skip otherwise.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const candidates=[process.env.NAICE_SERVER_DIR,path.join(here,'..','..','NAIce-Shot-Server'),path.join(here,'..','..','naice-shot-server')].filter(Boolean);
export const SERVER_DIR=candidates.find(dir=>fs.existsSync(path.join(dir,'handlers.mjs')))??null;
export const hasServer=!!SERVER_DIR;
export const serverModule=name=>import(pathToFileURL(path.join(SERVER_DIR,name)).href);
export const SKIP_NOTE='SKIP: NAIce-Shot-Server not found next to this repository (or set NAICE_SERVER_DIR).';
