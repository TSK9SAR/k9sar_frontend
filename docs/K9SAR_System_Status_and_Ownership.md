# K9SAR ownership and access register

Updated 2026-10-05. Technical procedures and verification evidence are in the
[maintenance and handoff guide](MAINTENANCE_AND_HANDOFF.md).

## Accountable people

These details carry forward the existing project record. Account membership and
recovery access were not independently audited.

| Responsibility | Current record | Handoff status |
| --- | --- | --- |
| Project owner | Beat Marti | Confirm during handoff |
| Primary technical administrator | Beat Marti | Confirm during handoff |
| Primary contact | beatmarti@gmail.com | Existing recorded contact |
| Backup administrator | Unassigned | Name and test access |
| Emergency technical contact | Unassigned | Name and record contact method |
| Backup/restore owner | Unassigned | Assign responsibility and restore-test date |

## Services and access

| Service | Purpose / known location | Owner record | Successor verification |
| --- | --- | --- | --- |
| GitHub organization TSK9SAR | [Frontend](https://github.com/TSK9SAR/k9sar_frontend), [backend](https://github.com/TSK9SAR/k9sar_backend); `main` | Beat Marti | Individual clone/branch/PR access and repository administrators identified |
| AWS Lightsail | Ubuntu production host | Beat Marti | Instance/region, firewall, billing, snapshots and recovery access recorded |
| AWS SES | Outbound mail; SMTP endpoint in `us-east-2` | Beat Marti | Sending identity, permissions, limits, bounces/complaints and billing reviewed |
| AWS S3 | Database backup destination in maintenance guide | Beat Marti | Successor can retrieve a backup; retention and recovery permissions checked |
| Cloudflare | `tsk9sar.org` DNS, Workers, Email Routing | Beat Marti | Individual access, MFA/recovery, DNS/TLS, Worker deployment and routes tested |
| Domain registration | Cloudflare according to prior ownership record | Beat Marti | Confirm registrar, renewal, payment and recovery email in account |
| Linux / Docker / MySQL | Services and persistent application data | Beat Marti | Own SSH key, appropriate sudo/Docker and database recovery access tested |
| Google / Microsoft identity apps | OAuth client configuration exists in backend environment | Unverified | Identify app owners, callbacks, credential expiry and actual usage |

Keep passwords, private keys, MFA recovery codes, and secret values outside this
register. Record protected vault item references privately. Give successors
individual accounts and keys; repository access does not grant access to hosting,
Cloudflare, the database, or production application administration.

## Recovery status

- Database: daily 02:00 UTC dump; local seven-day retention policy and S3 copy
  confirmed on 2026-10-05.
- Uploads: Sunday 03:15 UTC archive; local fourteen-day retention policy.
- Latest database and upload gzip integrity checks passed on 2026-10-05.
- Full isolated restore drill: **not yet verified**.
- Scheduled off-server coverage for uploads, signatures, videos, static assets,
  configuration and encryption keys: **not established by this audit**.
- Recovery objectives, monitoring owner and alert recipients: **unassigned**.

## Handoff acceptance

- [ ] Owner and backup/emergency contacts confirmed.
- [ ] Incoming maintainer has individual service access and recovery credentials.
- [ ] Billing, renewals, snapshots, backup retention and alerts reviewed.
- [ ] Isolated database and file restore completed and recorded.
- [ ] Deployment and rollback rehearsed in an isolated environment.
- [ ] Operational gaps in the maintenance guide assigned to named owners.
- [ ] Outgoing and incoming maintainers sign off with date and repository revisions.
