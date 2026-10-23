// Native vector: crisp at menu size, no external asset or request.
export const CAMERA_ICON = `<svg class="ncs-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M10 9l2-4h8l2 4" fill="#eee4fa" stroke="#415b64" stroke-width="1.6" stroke-linejoin="round"/><rect x="3" y="9" width="26" height="19" rx="6" fill="#a8dfe0" stroke="#415b64" stroke-width="1.6"/><rect x="23" y="12" width="3.5" height="3" rx="1" fill="#fff0bd"/><circle cx="15" cy="18.5" r="6.5" fill="#fffaf1" stroke="#415b64" stroke-width="1.4"/><circle cx="12.8" cy="17.5" r=".95" fill="#415b64"/><circle cx="17.2" cy="17.5" r=".95" fill="#415b64"/><path d="M12.5 20c1.3 1.6 3.7 1.6 5 0" fill="none" stroke="#415b64" stroke-width="1.3" stroke-linecap="round"/><circle cx="10.7" cy="19.3" r="1" fill="#f0b3bd"/><circle cx="19.3" cy="19.3" r="1" fill="#f0b3bd"/><path d="M27 3v4m-2-2h4" stroke="#d3a957" stroke-width="1.5" stroke-linecap="round"/></svg>`;

// Tab icons: one stroke style, colored by the current text color so every skin can tint them.
const stroke = body => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const TAB_ICONS = {
  scene: stroke('<rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8.5 8.5"/>'),
  profiles: stroke('<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>'),
  settings: stroke('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
  history: stroke('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4h4"/><path d="M12 7.5V12l3 2"/>'),
};
