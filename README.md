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

The identity endpoint paths are placeholders until the existing identity service contract is
provided. Configure the `UMI_APP_*` values before building; Compose forwards them as image build
arguments. Authentication uses same-origin cookies; the host never stores a bearer token.
`UMI_APP_LOGOUT_METHOD` accepts `GET` or `POST` until the identity contract is finalized.

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
