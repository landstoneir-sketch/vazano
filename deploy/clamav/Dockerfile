FROM clamav/clamav-debian:1.4.3@sha256:1d261f9c83ef2bbeef3915c7792f125e5707500fde0019d53547461747b90374

ENV TZ=Asia/Tehran

EXPOSE 3310

HEALTHCHECK --interval=15s --timeout=15s --start-period=90s --retries=20 \
  CMD printf 'PING\n' | nc -w 10 127.0.0.1 3310 | grep -qx PONG
