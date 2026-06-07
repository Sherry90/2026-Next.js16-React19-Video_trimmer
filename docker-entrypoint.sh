#!/bin/sh
# 인증서 폴백: 마운트된 인증서(관례/레거시 경로)가 없으면 self-signed를 생성한다.
# → server.ts가 cert.pem/key.pem을 자동 인식해 HTTPS로 기동(외부망 + FFmpeg.wasm 동작).
set -e

CERT_DIR=/app/certificates
CRT="${TLS_CERT_PATH:-$CERT_DIR/cert.pem}"
KEY="${TLS_KEY_PATH:-$CERT_DIR/key.pem}"

has_legacy() {
  [ -f "$CERT_DIR/trimvideo.net.pem" ] && [ -f "$CERT_DIR/trimvideo.net-key.pem" ]
}

if [ ! -f "$CRT" ] || [ ! -f "$KEY" ]; then
  if has_legacy; then
    echo "[entrypoint] 마운트된 인증서 사용 (legacy)"
  elif [ "${ENABLE_SELF_SIGNED:-true}" = "true" ]; then
    echo "[entrypoint] self-signed 인증서 생성 → $CRT"
    openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
      -keyout "$KEY" -out "$CRT" \
      -subj "/CN=${TLS_CN:-localhost}" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
      || echo "[entrypoint] openssl 실패 → HTTP로 폴백"
  else
    echo "[entrypoint] 인증서 없음, self-signed 비활성 → HTTP로 기동"
  fi
fi

exec "$@"
