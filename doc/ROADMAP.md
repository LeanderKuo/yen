# Development Roadmap

> Last Updated: 2026-01-03  
> Status: Active  
> Scope: **what/why/status + links only** (no step-by-step, no SQL/commands, no code maps).

For implemented behavior, see [SPEC.md](SPEC.md).

For operational verification (go-live), see [RUNBOOK.md](RUNBOOK.md) → [runbook/go-live.md](runbook/go-live.md).

For actionable steps, see [TASKS.md](TASKS.md) (unblocked) and [BLOCKERS.md](BLOCKERS.md) (blocked / external dependencies).  
For stable technical specs, see [`specs/README.md`](specs/README.md).

---

## Priority Definitions

| Priority | Definition                      |
| -------- | ------------------------------- |
| P0       | Blocking release                |
| P1       | Required for production release |
| P2       | Post-release optimization       |
| P3       | Nice-to-have / tracking         |

---

## P0 - Critical (Blocking Release)

### Production Database Alignment

- **Status**: Pending
- **Why**: avoid schema/RLS/RPC drift in prod
- **Links**: `runbook/database-ops.md`, `../uiux_refactor.md` §3.9

### Pre-Release Guardrails

- **Status**: In Progress
- **Why**: prevent regressions before deploy
- **Links**: `../uiux_refactor.md` §2 (canonical checklist)

### Theme Console Manual Verification

- **Status**: Pending
- **Why**: ensure Owner/Editor flows + no public FOUC
- **Links**: `../uiux_refactor.md` §3.9, `SPEC.md` (Theme System)

---

## P1 - High (Required for Release)

- (No active P1 roadmap items.)

---

## P2 - Medium (Post-Release)

### Local Dev Environment

- **Status**: Deferred
- **Why**: safer iteration without touching prod
- **Links**: `runbook/database-ops.md`

---

## Tracking Items

| Item            | Status   | Notes                       |
| --------------- | -------- | --------------------------- |
| CSS Masonry     | Tracking | Waiting for browser support |
| Tailwind v4     | Tracking | Planned upgrade             |
| Containerization | Deferred | non-Vercel deployment       |

---

## Risk Registry

| Risk                    | Impact                    | Mitigation                       |
| ----------------------- | ------------------------- | -------------------------------- |
| Production DB drift     | Security/feature issues   | follow `runbook/database-ops.md` |

---

## Completed (Archive)

- See [archive/README.md](archive/README.md)

---

## Related Documents

- Docs hub: `README.md`
- Architecture: `../ARCHITECTURE.md`
- Implemented behavior: `SPEC.md`
- Security: `SECURITY.md`
- Ops runbook: `RUNBOOK.md`
