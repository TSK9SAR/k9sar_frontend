# System Status and Ownership

### Production System

- **System name:** K9SAR / TSK9SAR
- **Production site:** https://tsk9sar.org
- **Primary purpose:** SAR K9 certification, standards, ID cards, public verification, forums, and administration
- **Current production status:** Active / in use

### Primary Owner / Administrator

- **Primary owner:** Beat Marti
- **Primary technical administrator:** Beat Marti
- **Primary contact email:** beatmarti@gmail.com
- **Backup administrator:** TBD
- **Emergency technical contact:** TBD

### Source Code Repositories

- **Frontend repository:** https://github.com/Roamer105/k9sar_frontend
- **Backend repository:** https://github.com/Roamer105/k9sar_backend
- **Primary branch:** main
- **Organization:** TSK9SAR
- **Both repositories:** https://github.com/TSK9SAR
- **Deployment source of truth:** GitHub repositories

### Hosting / Infrastructure

- **Hosting provider:** AWS Lightsail
- **Production server:** Lightsail Linux instance
- **Backend framework:** FastAPI
- **Frontend framework:** React / Vite
- **Database:** MySQL
- **Static assets:** Nginx-served static directory
- **Domain:** tsk9sar.org

### Access Ownership

- **AWS account owner:** Beat Marti
- **AWS administrators:**
  - Beat Marti
  - Additional administrator: TBD
- **GitHub owner/account:** Roamer105
- **GitHub collaborators:** TBD
- **Domain registrar:** Cloudflare
- **DNS provider:** Cloudflare

### Critical Services

- **Web application:** tsk9sar.org
- **API backend:** tsk9sar.org/api
- **Public certificate verification:** QR-code based public verification routes
- **Standards documents:** Stored through backend document/file routes
- **Static images/logos:** Served from static directory
- **Email services:** AWS SES (outbound), Cloudflare Email Routing (inbound)
- **Backup process:** TBD

### Security Requirements

- Root AWS account should not be used for day-to-day work.
- Each administrator should have an individual IAM user.
- MFA should be enabled for all AWS administrator accounts.
- GitHub access should use individual accounts, not shared passwords.
- Production database access should be limited to trusted administrators.
- Delete/cleanup operations should only be performed through preview-confirm routes.

### Backup and Recovery Ownership

- **Database backup owner:** TBD
- **Backup storage location:** TBD
- **Backup frequency:** TBD
- **Restore procedure documented:** No / TBD
- **Last verified restore test:** TBD

### Operational Risks

- Institutional knowledge is currently concentrated with Beat Marti.
- Backup administrator access should be confirmed.
- Database backup and restore procedure should be documented and tested.
- Domain/DNS ownership should be clearly recorded.
- AWS Lightsail access should not depend on the root account only.

---

# Infrastructure Ownership

## AWS

### Purpose

- Application hosting
- Compute resources
- Database hosting
- AWS SES outbound email

### Provider

- AWS Lightsail
- AWS SES

### Account Owner

- Beat Marti

### Administrators

- Beat Marti
- Additional Administrator(s): TBD

### Critical Assets

- Production Lightsail instance
- Production database
- Snapshots and backups
- SES configuration and identities

### Recovery Requirements

- Root account access retained
- MFA enabled
- At least two administrator IAM accounts

---

## Cloudflare

### Purpose

- Domain registrar
- DNS hosting
- SSL/TLS proxying
- DDoS protection
- Domain routing
- Email forwarding

### Account Owner

- Beat Marti

### Administrators

- Beat Marti
- Additional Administrator(s): TBD

### Registered Domains

- tsk9sar.org
- Additional connected domains: TBD

### Critical Assets

- Domain registration
- Nameservers
- DNS records
- SSL/TLS settings
- Proxy status
- Redirect rules
- WAF/security settings
- Email forwarding routes

### Operational Notes

- Cloudflare controls inbound forwarding routes.
- AWS SES controls outgoing application messages.
- DNS records for SES verification, DKIM, SPF, and DMARC are managed in Cloudflare.
- Loss of Cloudflare access may affect both inbound forwarding and outbound email authentication.
- Loss of AWS access may affect outbound application email.

### Recovery Requirements

- MFA enabled
- At least two Cloudflare administrators
- Registrar recovery email documented
- Domain auto-renewal enabled
- Payment method current

---

## Email Services

### Inbound Email

- **Provider:** Cloudflare Email Routing
- **Purpose:** Forward inbound domain email to designated recipient accounts

### Outbound Email

- **Provider:** AWS SES
- **Purpose:** Application-generated outbound email

---

## Backup Administrator Checklist

A successor administrator should have verified access to:

- AWS account (IAM Administrator)
- AWS SES
- Cloudflare
- Domain registration
- GitHub repositories
- Production database
- Backup location and restore procedures
- Email routing and forwarding configuration

---

| Service | Owner | Backup Admin | Notes |
|----------|----------|----------|----------|
| AWS Lightsail | Beat Marti | TBD | Production hosting |
| Cloudflare | Beat Marti | TBD | DNS, SSL, registrar |
| GitHub | Beat Marti | TBD | Source control |
| Domain Registrar | Cloudflare | TBD | Domain ownership |
| Database | Beat Marti | TBD | Production data |
| AWS SES | Beat Marti | TBD | Outbound email |
| Cloudflare Email Routing | Beat Marti | TBD | Inbound email forwarding |
