#!/usr/bin/env bash
set -euo pipefail
bundle_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
st_dir="${1:-}"
user_handle="${2:-default-user}"
if [[ -z "$st_dir" || ! -f "$st_dir/server.js" || ! -f "$st_dir/src/endpoints/secrets.js" ]]; then
  echo '사용법: bash install.sh /실제/SillyTavern/경로 [사용자핸들]'
  echo '실리태번 설치 폴더를 지정해 주세요. 파일을 변경하지 않았어요.'
  exit 1
fi
st_dir="$(cd -- "$st_dir" && pwd)"
if [[ ! "$user_handle" =~ ^[a-zA-Z0-9_-]+$ ]]; then echo '사용자 핸들을 확인해 주세요.'; exit 1; fi
user_root="$st_dir/data/$user_handle"
if [[ ! -d "$user_root" ]]; then
  echo "기본 data 경로에서 사용자를 찾지 못했어요: $user_root"
  echo 'dataRoot를 변경한 설치는 README의 수동 설치 방법을 사용해 주세요.'
  exit 1
fi
ui_dest="$user_root/extensions/naice-shot"
server_dest="$st_dir/plugins/naice-shot-server"
backup_dir="$st_dir/naice-shot-backups/$(date -u +%Y%m%dT%H%M%SZ)-$$"
for existing in "$ui_dest" "$server_dest"; do
  if [[ -e "$existing" ]]; then mkdir -p -- "$backup_dir"; cp -a -- "$existing" "$backup_dir/$(basename -- "$existing")"; fi
done
mkdir -p -- "$ui_dest" "$server_dest"
cp -R -- "$bundle_dir"/ui/. "$ui_dest/"
cp -- "$bundle_dir"/server/* "$server_dest/"
echo 'NAIce Shot 파일 설치 완료.'
echo "UI: $ui_dest"
echo "서버: $server_dest"
echo 'config.yaml의 enableServerPlugins 값을 true로 설정한 뒤 실리태번을 재시작하세요.'
echo 'API 연결 화면에 NAI 키가 저장돼 있다면 다시 입력할 필요가 없어요.'
echo '설치 스크립트는 config.yaml과 실리태번 소스 파일을 변경하지 않았어요.'
