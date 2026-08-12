# EK AIoT 2D Editor React Host

Private Ant Design Pro V6 host for the authenticated 2D Editor demonstration. It consumes the
public `@ek-aiot` packages at `0.2.0`; it does not import workspace or Git sources.

## Requirements

- Node.js 22.12 or newer
- Corepack with pnpm 10.30.2
- Docker and Compose for the complete deployment

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Identity integration follows the provided OpenAPI contract: `POST /oauth/login` accepts multipart
mobile/password, `GET /ek/auth/oauth/userinfo` returns the user, and `GET /oauth/logout` signs out.
Configure the origin before building; Compose forwards browser-facing values as image build
arguments.
Local development and Compose default the identity origin to `http://59.36.5.137:1888`; override
`IDENTITY_ORIGIN` when deploying against another environment.

This demonstration stores the returned access token in the JavaScript-readable
`ek_aiot_demo_access_token` Cookie. Nginx converts it into an upstream Bearer header and never
forwards browser-provided `x-user-header` or `X-Authenticated-User-Id`. Do not use this token
storage design for production; production must replace it with a server-issued Secure HttpOnly
session Cookie. The user-info service must return `X-Authenticated-User-Id`, matching its JSON
`userId`.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm format:check
```

`pnpm test:e2e` expects the development server at `http://127.0.0.1:8000` and uses mocked
identity and Agent responses to exercise the browser workflow.

The Demo Document Session is stored in `sessionStorage`. Refreshing the current tab restores its
random `documentRef`, document, revision, last commit, and `toolCallId` receipts. Signing out stops
the active Agent turn, disposes the editor Agent runtime, clears the session, calls the identity
logout endpoint, and returns to sign-in.

## Deployment

```bash
cp .env.example .env
docker compose up --build -d
```

The Compose project pins the synchronized Agent Server image by digest. Nginx authenticates Agent
HTTP and SSE routes with an identity subrequest, removes browser-provided
`X-Authenticated-User-Id`, and forwards only the trusted response header. The Agent Server is not
published on a host port.
