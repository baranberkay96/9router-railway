# syntax=docker/dockerfile:1
#
# 9Router on Railway.
#   - 9Router 0.5.116 (decolua/9router, MIT): the upstream multi-arch image,
#     unmodified, pinned by digest. Upstream builds it in CI from git tag
#     v0.5.116 (image label org.opencontainers.image.revision
#     1339107e624d1ab150c6a0c2c2ee22caa7e9db2f). Node.js 22.23.4 on Alpine,
#     about 300 MB compressed.
#   - railway/ (this repository, Node.js standard library only): checks the
#     deploy-form values, starts 9Router's own custom-server.js on [::]:$PORT,
#     keeps the API key from NINEROUTER_API_KEY in sync and logs a
#     remote-access self-check.
# No build step downloads anything: the base image is fetched by digest, so
# every deploy runs the same bytes. No VOLUME instruction: Railway attaches the
# volume at /app/data (template.json).
FROM decolua/9router:0.5.116@sha256:12086f97857f784ab7762e95595f70d71279a7a60c800af0f100183e8da7ea36

# COPY without --chmod: the new directories stay 0755 (STANDARD rule 22).
COPY railway/launcher.mjs /opt/railway/launcher.mjs
COPY railway/lib/ /opt/railway/lib/
COPY railway/railway-start.sh /opt/railway/railway-start.sh
COPY railway/test/ /tmp/railway-test/test/
RUN chmod -R a+rX,go-w /opt/railway \
 && chmod 0755 /opt/railway/railway-start.sh \
 && ln -s /opt/railway/lib /tmp/railway-test/lib \
 && node --test /tmp/railway-test/test/*.test.mjs \
 && rm -rf /tmp/railway-test \
 && node --version | grep -Fx v22.23.4 \
 && test -f /app/custom-server.js -a -f /app/server.js

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/app/data \
    PORT=20128

WORKDIR /app
EXPOSE 20128

# Railway's init is PID 1 and reaps; the launcher forwards SIGTERM to 9Router.
ENTRYPOINT ["/opt/railway/railway-start.sh"]
CMD []
