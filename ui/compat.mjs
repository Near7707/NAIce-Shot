// UI ↔ server plugin compatibility. When a release changes the server plugin, raise MIN_SERVER_VERSION
// (and add any new feature flag to REQUIRED_SERVER_FEATURES) so people who forget to replace the
// server folder see a clear notice as soon as they open the panel.
export const MIN_SERVER_VERSION = '0.1.0';
export const REQUIRED_SERVER_FEATURES = ['paged-history', 'delete', 'private-records', 'all-history'];

export function compareVersions(a, b) {
  const parts = v => String(v ?? '').split('.').map(x => Number.parseInt(x, 10) || 0);
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length, 3); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return Math.sign(d); }
  return 0;
}

// status: HTTP status of GET /status?quick=1 (-1 when the request itself failed); data: parsed JSON or null.
// level: none (nothing to say), ok, info (different but compatible), warn (update needed), error (plugin missing).
export function checkCompat({ uiVersion, status, data, minServer = MIN_SERVER_VERSION, required = REQUIRED_SERVER_FEATURES }) {
  if (status === -1) return { level: 'none', message: '' };
  if (!data || typeof data !== 'object')
    return { level: 'error', message: '서버 플러그인을 찾지 못했어요. plugins/naice-shot-server 폴더가 있는지, config.yaml에 enableServerPlugins: true가 있는지 확인하고 실리태번을 재시작해 주세요.' };
  if (typeof data.version !== 'string') return { level: 'none', message: '' }; // e.g. an old server that failed its NovelAI check: nothing reliable to compare
  const server = data.version, features = Array.isArray(data.features) ? data.features : [];
  const missing = required.filter(f => !features.includes(f));
  if (compareVersions(server, minServer) < 0 || missing.length)
    return { level: 'warn', server, message: `서버 플러그인이 이전 버전(v${server})이에요. 확장 v${uiVersion}과 맞추려면 ZIP의 server 폴더 파일로 plugins/naice-shot-server를 바꾸고 실리태번을 재시작해 주세요.` };
  if (typeof data.minClient === 'string' && compareVersions(uiVersion, data.minClient) < 0)
    return { level: 'warn', server, message: `확장(UI) 파일이 서버 플러그인(v${server})보다 오래됐어요. ZIP의 ui 폴더 파일로 확장 폴더를 바꾸고 새로고침해 주세요.` };
  if (compareVersions(server, uiVersion) !== 0) return { level: 'info', server, message: `서버 플러그인 v${server} · 확장 v${uiVersion} · 함께 쓸 수 있어요.` };
  return { level: 'ok', server, message: `서버 플러그인 v${server} · 확장 v${uiVersion}` };
}
