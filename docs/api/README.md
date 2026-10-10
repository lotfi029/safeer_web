Snapshot of the `safeer_api` contract at **`v1.0.0-rc1`** (`e86b3b5`, 2026-09-27): the same ref as the `SAFEER_API_REF` repo variable. `SNAPSHOT.json` records the exact ref.

- `CONTRACT-NOTES.md`: the contract as the frontend uses it. Start here.
- `API-CHANGES.md`, `ARCHITECTURE.md`: copies of the backend's `docs/backend/` files.
- `openapi.json` types requests only. Response shapes come from `src/**/public-*.ts`, the controllers, DTOs and the few services copied into `src/`.

Refresh this folder whenever the backend contract changes, from a pinned tag or SHA (never a moving branch):

```bash
node scripts/snapshot-api.mjs ../safeer_api v1.0.0-rc1
```

Then update `SAFEER_API_REF` (`gh variable set SAFEER_API_REF --body <ref>`) and `CONTRACT-NOTES.md` together.
