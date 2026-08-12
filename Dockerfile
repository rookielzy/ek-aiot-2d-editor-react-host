FROM node:22.23.1-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

ARG UMI_APP_AGENT_BASE_URL=/api/agent
ARG UMI_APP_LOGIN_ENDPOINT=/api/auth/login
ARG UMI_APP_LOGIN_URL=/login
ARG UMI_APP_LOGOUT_METHOD=GET
ARG UMI_APP_LOGOUT_URL=/api/auth/logout
ARG UMI_APP_USER_INFO_URL=/api/auth/userinfo
ENV UMI_APP_AGENT_BASE_URL=$UMI_APP_AGENT_BASE_URL \
    UMI_APP_LOGIN_ENDPOINT=$UMI_APP_LOGIN_ENDPOINT \
    UMI_APP_LOGIN_URL=$UMI_APP_LOGIN_URL \
    UMI_APP_LOGOUT_METHOD=$UMI_APP_LOGOUT_METHOD \
    UMI_APP_LOGOUT_URL=$UMI_APP_LOGOUT_URL \
    UMI_APP_USER_INFO_URL=$UMI_APP_USER_INFO_URL

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY config ./config
COPY src ./src
COPY tests ./tests
COPY tsconfig.json vitest.config.ts ./
RUN pnpm build

FROM nginx:1.27.4-alpine

COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
