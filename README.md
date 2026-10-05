# K9SAR frontend

React/Vite application for Tri-State K9 Search & Rescue membership, certifications,
standards, public verification, forums, and administration.

- Production: [tsk9sar.org](https://tsk9sar.org)
- **Start here:** [Project maintenance and handoff guide](docs/MAINTENANCE_AND_HANDOFF.md)
- [Ownership and access register](docs/K9SAR_System_Status_and_Ownership.md)
- [Frontend API inventory](docs/API_REFERENCE.md)
- [Backend repository](https://github.com/TSK9SAR/k9sar_backend)

## Local commands

Use Node 24.12.0 or a compatible supported version and the committed lockfile.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```

The entry point is `src/main.jsx`. Production uses `VITE_API_BASE_URL=/api`.
The current Vite configuration has no development API proxy; follow the guide
to connect an isolated development backend. Values named `VITE_*` are public
browser configuration, never secrets.

At the 2026-10-05 audit, the build passed and lint reported 16 existing errors
and 5 warnings. There is no frontend automated test script or checked-in CI
workflow. See the guide for release checks and deployment/rollback procedures.
