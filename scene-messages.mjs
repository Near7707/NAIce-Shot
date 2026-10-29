// SillyTavern /hide marks RP messages as is_system. Explicit system-message
// metadata distinguishes help/notices from hidden RP; never change the real chat.
import {chooseMessages} from './core.mjs';
const SYSTEM_TYPES=new Set(['help','welcome','empty','generic','comment','slash_commands','formatting','hotkeys','macros','welcome_prompt','assistant_note','assistant_message']);
export function isSceneMessage(message) {
  return !!message&&typeof message.mes==='string'&&!!message.mes.trim()
    &&!SYSTEM_TYPES.has(message.extra?.type)&&!message.extra?.uses_system_ui&&!message.extra?.isSmallSys;
}
export const isHiddenSceneMessage=message=>isSceneMessage(message)&&!!message.is_system;
export function chooseSceneMessages(chat,options={}) {
  const target=options.target??null,includeHidden=target!==null&&isHiddenSceneMessage(chat[Number(target)]);
  // Latest mode and ordinary visible targets continue to exclude hidden history.
  // Selecting a hidden target explicitly also permits its preceding RP context.
  const view=chat.map(message=>!isSceneMessage(message)?{...message,is_system:true}
    :includeHidden&&message.is_system?{...message,is_system:false}:message);
  return chooseMessages(view,options);
}
