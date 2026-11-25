Snapshot of the `safeer_api` contract at **`v1.1.0`** (`40e52a1`, 2026-11-25): the ref CI's `e2e-real` job should run (`SAFEER_API_REF`). `SNAPSHOT.json` records the exact ref.

- `CONTRACT-NOTES.md`: the contract as the frontend uses it. Start here.
- `API-CHANGES.md`, `ARCHITECTURE.md`: copies of the backend's `docs/backend/` files.
- `openapi.json` types requests only. Response shapes come from `src/**/public-*.ts`, the controllers, DTOs and the few services copied into `src/`.

Refresh this folder whenever the backend contract changes, from a pinned tag or SHA (never a moving branch):

```bash
node scripts/snapshot-api.mjs ../safeer_api v1.1.0
```

Then update `SAFEER_API_REF` (`gh variable set SAFEER_API_REF --body <ref>`) and `CONTRACT-NOTES.md` together.
