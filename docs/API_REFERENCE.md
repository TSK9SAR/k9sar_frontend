# Frontend API Reference

This is a source-derived inventory of HTTP endpoints used by the frontend. It is
not a replacement for an OpenAPI specification: fields and response structures
are documented only where the frontend establishes them. Update this file when
adding or changing a client call.

## Conventions

- `apiJson` and `apiFetch` in `src/lib/api.ts` prepend `VITE_API_BASE_URL` to a
  path and attach `Authorization: Bearer <token>` whenever a token exists.
- `apiJson` resolves to the **parsed JSON body**. Do not call `.json()` on its
  result. `apiFetch` resolves to the raw `Response`.
- The wrapper uses `Content-Type: application/json` unless the body is a
  `FormData` instance. A `401` clears local auth state; `403` responses can
  clear MFA state when the request is MFA-protected.
- Calls written as `/api/...` use the same-origin Vite/proxy path instead of the
  wrapper. Their deployment/proxy configuration must route them to the API.
- `Auth` below means a bearer token is expected by the calling UI. `MFA` means
  an authenticated administrator/supervisor flow; the client may enforce this
  with `mfaRequired: true`.
- Paths with `{id}` are route parameters. Query parameters shown in parentheses
  are used by the frontend.

## Authentication and account recovery

| Method | Path | Access | Purpose / client fields |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Sign in from `AuthForm`. |
| POST | `/auth/token` | Public | Token sign-in (`username`, `password`). |
| POST | `/auth/register` | Public | Register a user. |
| POST | `/auth/logout` | Auth | End the current session. |
| GET | `/auth/me` | Auth | Current user and role/MFA information. |
| GET | `/users/me` | Auth | Legacy current-user lookup used by dashboard/auth helpers. |
| GET | `/users/info` | Auth | Dashboard user information. |
| POST | `/auth/invite/verify` | Public/token | Validate an invitation token. |
| POST | `/auth/invite/accept` | Public/token | Accept an invitation and set credentials. |
| POST | `/auth/forgot` | Public | Begin password-reset flow. |
| POST | `/api/auth/reset/verify` | Public | Validate a password-reset token. |
| POST | `/api/auth/reset/accept` | Public | Complete a password reset. |
| POST | `/api/auth/reauth/password` | Auth | Reauthenticate before a sensitive MFA change. |

## MFA and passkeys

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/2fa/begin` | Auth | Begin TOTP enrollment. |
| POST | `/api/auth/2fa/confirm` | Auth | Confirm TOTP enrollment. |
| POST | `/api/auth/2fa/verify` | Auth | Verify a TOTP challenge. |
| POST | `/api/auth/2fa/disable` | Auth | Disable an enrolled second factor. |
| POST | `/api/auth/2fa/totp/disable` | Auth | Disable TOTP from the MFA settings page. |
| POST | `/auth/passkey/register/start` | Auth | Start WebAuthn/passkey registration. |
| POST | `/auth/passkey/register/finish` | Auth | Finish passkey registration. |
| POST | `/api/auth/passkey/authenticate/start` | Public/auth | Start passkey authentication. |
| POST | `/api/auth/passkey/authenticate/finish` | Public/auth | Finish passkey authentication. |
| POST | `/api/auth/passkey/disable` | Auth | Remove a passkey. |
| GET | `/api/users/info` | Auth | Legacy account/MFA settings lookup. |

## Public content and directory

| Method | Path | Access | Purpose / parameters |
| --- | --- | --- | --- |
| POST | `/public/track` | Public | Record a public-page visit. |
| GET | `/public/matrix` | Public | Public certification matrix. `q`, repeated `discipline`, `affiliation_id`, `lat`, `lng`, and `radius_mi` are supported. |
| GET | `/evaluators/matrix` | Public/Auth | Evaluator search; UI sends text, discipline, and location/radius filters. |
| POST | `/evaluators/matrix/toggle` | Auth | Toggle the current evaluator's directory visibility. |
| GET | `/public/affiliations` | Public | Public affiliation list. |
| GET | `/affiliations/{id}/memberships` | Auth | Memberships for a selected affiliation. |
| GET | `/help` | Public/Auth | Public help sections and items. |
| GET | `/help-videos/{videoKey}/play-url` | Auth | Time-limited/help-video playback URL. |
| GET | `/api/standards/?section=operational` | Public | Operational standards. |
| GET | `/api/standards/?section=generic` | Public | Generic standards. |
| GET | `/api/standards/print/standards-booklet` | Public | Printable standards booklet. |
| GET | `/api/standards/print/standards-summary-booklet` | Public | Printable standards summary booklet. |

## Profile, handlers, teams, dogs, and files

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET, PUT | `/profile/me` | Auth | Read/update the signed-in user's profile. |
| POST | `/handlers/ensure` | Auth | Ensure a handler exists; client expects `{ handler_id }`. |
| GET, POST | `/teams/` | Auth | List/create teams. |
| GET, PUT, DELETE | `/teams/{teamId}` | Auth | Read/update/delete a team. |
| GET | `/teams/mine?include_inactive=true` | Auth | Current user's teams, including inactive records. |
| GET, POST | `/dogs/` | Auth | List/create dogs. |
| GET, PUT | `/dogs/{dogId}` | Auth | Read/update a dog. |
| POST | `/documents/upload` | Auth | Upload a document (`FormData`). |
| POST | `/documents/upload` | MFA | Upload a standards/configuration document (`FormData`). |
| POST | `/handlers/me/affiliation-requests` | Auth | Request an affiliation for the current handler. |
| GET | `/handlers/me/affiliations` | Auth | Current handler's affiliations. |
| GET, POST | `/admin/handlers/{handlerId}/affiliations` | MFA | List/add handler affiliations. |
| POST | `/admin/handlers/{handlerId}/affiliations/{affiliationId}/end` | MFA | End an affiliation. |
| GET | `/api/id-cards/handlers/{handlerId}` | Auth | Printable handler ID card (`layout`, optional `slot` and `affiliation_id`). |
| GET | `/api/id-cards/teams/{teamId}` | Auth | Printable team ID card (`layout`, optional `slot` and `affiliation_id`). |
| GET | `/api/id-headshots/{handlers|dogs}/{id}` | Auth | Handler or dog headshot image. |
| POST | `/api/me/signature` | Auth | Upload/update a signature. |
| GET | `/api/me/signature` | Auth | Current signature asset/data. |
| GET | `/api/me/signature/capabilities` | Auth | Signature upload capabilities. |

## Certifications, disciplines, and standards

| Method | Path | Access | Purpose / parameters |
| --- | --- | --- | --- |
| GET | `/certifications/matrix` | Auth | Certification matrix; caller supplies affiliation and filter parameters. |
| POST | `/certifications/` | Auth | Create a certification. |
| GET, PATCH | `/certifications/{certificationId}` | Auth | Read/update a certification. |
| POST | `/certifications/{certificationId}/co-evaluate` | Auth | Add a co-evaluator. |
| PATCH | `/certifications/{certificationId}/revoke` | Auth | Revoke a certification. |
| PATCH | `/certifications/{certificationId}/suspend` | Auth | Suspend a certification. |
| PATCH | `/certifications/{certificationId}/unsuspend` | Auth | Remove a suspension. |
| PATCH | `/certifications/{certificationId}/correction` | Auth | Record a certification correction. |
| GET | `/certifications/{certificationId}/history` | Auth | Certification history. |
| GET | `/certifications/{certificationId}/events` | Auth | Certification audit/event history. |
| GET | `/certifications/{certificationId}/certificate` | Auth | Printable certificate data. |
| GET, POST | `/disciplines/` | Public/MFA | List or create disciplines. |
| PUT, DELETE | `/disciplines/{disciplineId}` | MFA | Update/delete a discipline. |
| GET, POST | `/discipline-groups/` | Public/MFA | List or create discipline groups. |
| PUT, DELETE | `/discipline-groups/{groupId}` | MFA | Update/delete a discipline group. |
| GET, POST | `/standards/` | Public/MFA | List/create standards; `discipline_id` is used for filtering. |
| GET, PUT, DELETE | `/standards/{standardId}` | Public/MFA | Read/update/delete a standard. |

## Forums and surveys

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/forums/` | Auth | Forum/category home data. |
| GET, POST | `/forums/{categoryId}/topics` | Auth | List/create category topics. |
| GET | `/forums/topics/{topicId}` | Auth | Topic and posts. |
| PATCH | `/forums/topics/{topicId}/lock` | MFA/moderator | Lock or unlock a topic. |
| POST | `/forums/topics/{topicId}/posts` | Auth | Create a post. |
| PATCH | `/forums/posts/{postId}` | Auth | Edit a post. |
| DELETE | `/forums/posts/{postId}` | Auth/moderator | Delete a post. |
| GET | `/forums/topics/{topicId}/ballots` | Auth | Topic ballots/surveys. |
| POST | `/forums/ballots/{ballotId}/vote` | Auth | Cast a ballot vote. |
| POST | `/forums/ballots/{ballotId}/feedback` | Auth | Submit ballot feedback. |
| GET, PUT | `/forums/me/settings` | Auth | Read/update forum notification/settings data. |
| GET | `/forums/activity/summary` | Auth | Nav/dashboard unread activity summary; client reads `unread_count`. |
| POST | `/admin/forum/topics/{topicId}/close-survey` | MFA | Close a survey. |
| POST | `/admin/forum/topics/{topicId}/reopen-survey` | MFA | Reopen a survey. |
| GET | `/admin/forum/categories` | Administrator | List all categories, including hidden ones, with topic counts and edit revisions. |
| POST | `/admin/forum/categories` | Administrator + MFA | Create a category. |
| PUT | `/admin/forum/categories/{categoryId}` | Administrator + MFA | Edit category settings; requires `expected_revision` from the listing. |
| POST | `/admin/forum/categories/{categoryId}/delete-preview` | Administrator + MFA | Preview deletion of an empty category; returns confirmation token/text. |
| POST | `/admin/forum/categories/{categoryId}/delete-confirm` | Administrator + MFA | Delete an empty category using the token and exact confirmation text. |
| GET | `/admin/forum/topics?q=&category_id=&topic_id=&offset=0&limit=25` | Administrator | Search all topics, including hidden categories; filters optional. |
| POST | `/admin/forum/topics/{topicId}/move-preview` | Administrator + MFA | Preview a move with `destination_category_id`; returns access rules, counts and confirmation token. |
| POST | `/admin/forum/topics/{topicId}/move-confirm` | Administrator + MFA | Move using `destination_category_id` and `confirmation_token`; retain all discussion content and IDs. |

Delete/move confirmations expire in five minutes and are bound to the administrator
and reviewed state. Stale edits/previews return 409; refresh and review again.
Category management and moves do not send notifications. Hidden categories reject
normal forum access and inbound email replies. A destination must be visible;
topics can be moved out of hidden categories.

## Supervisor and administrator endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/supervisor/kpis` | Supervisor/Admin | Supervisor KPI summary; nav reads `pending_affiliations`. |
| GET | `/supervisor/affiliation-requests?status_filter={status}` | Supervisor/Admin | List affiliation requests by status. |
| POST | `/supervisor/affiliation-requests/{id}/approve` | Supervisor/Admin | Approve an affiliation request. |
| POST | `/supervisor/affiliation-requests/{id}/reject` | Supervisor/Admin | Reject an affiliation request. |
| GET | `/dashboard/settings` | Supervisor/Admin | Dashboard settings; nav reads `dues_enabled`. |
| GET | `/admin/canary_no_mfa` | Supervisor/Admin | Privilege probe that does not require MFA. |
| GET | `/admin/canary_admin_no_mfa` | Administrator | Administrator-only privilege probe. |
| GET | `/admin/canary` | MFA | MFA-protected administrator capability probe. |
| GET | `/admin/users` | MFA | Search/list users; pages send pagination and filter query parameters. |
| GET, PUT | `/admin/users/{userId}` | MFA | Read/update a user. |
| GET | `/admin/users/{userId}/bundle` | MFA | User plus member/handler bundle. |
| GET | `/admin/users/{userId}/login-history` | MFA | User login history. |
| GET | `/admin/roles` | MFA | Role choices. |
| GET, PUT | `/admin/handlers/{handlerId}` | MFA | Read/update a handler. |
| GET | `/admin/handlers/{handlerId}/neighbors` | MFA | Nearby/related handlers. |
| GET | `/admin/handlers/dues/roster?year={year}` | MFA | Annual dues roster. |
| PUT | `/admin/handlers/{handlerId}/dues` | MFA | Update handler dues data. |
| GET | `/admin/handlers/settings/dues` | MFA | Read dues configuration. |
| PUT | `/admin/handlers/settings/update-dues` | MFA | Update dues configuration. |
| GET, PUT | `/admin/dogs/{dogId}` | MFA | Read/update a dog as an administrator. |
| GET, PUT | `/admin/teams/{teamId}` | MFA | Read/update a team as an administrator. |
| GET, POST | `/admin/affiliations` | MFA | List/create affiliations. |
| PUT, DELETE | `/admin/affiliations/{id}` | MFA | Update/delete an affiliation. |
| GET | `/admin/help` | MFA | Read help content root data. |
| POST | `/admin/help/sections` | MFA | Create a help section. |
| PUT | `/admin/help/sections/{sectionId}` | MFA | Update a help section. |
| POST | `/admin/help/items` | MFA | Create a help item. |
| PUT, DELETE | `/admin/help/items/{helpId}` | MFA | Update/delete a help item. |
| POST | `/admin/help/items/{helpId}/videos/upload` | MFA | Upload an attached help video. |
| POST | `/admin/help/items/{helpId}/videos` | MFA | Attach a video to a help item. |
| PUT, DELETE | `/admin/help/videos/{videoId}` | MFA | Update/delete a help video. |
| POST | `/admin/email-audience/interpret` | MFA | Interpret a recipient/audience expression. |
| POST | `/admin/email-audience/preview` | MFA | Preview the resulting email audience. |
| POST | `/admin/email-audience/send` | MFA | Send a message to the selected audience. |

## Generated and dynamic routes requiring separate verification

The following calls are assembled in code and should be documented with their
backend owner before treating this inventory as a complete contract:

- `/dashboard/summary?window_days={days}` in `src/pages/Dashboard.jsx`.
- The cleanup endpoint returned by `deleteUrl(preview)` in
  `src/pages/admin/AdminCleanupPage.tsx`.
- The affiliate-directory embeds:
  `/api/embed/affiliations/{publicSlug}/directory` and the `?all=true` variant.
- Upload and mutation payload fields in the matrix, dogs, teams, admin help,
  admin affiliations, and email-audience screens. The request bodies are
  defined beside each call site and should be the source of truth until a
  backend OpenAPI document exists.

## Maintaining this reference

1. Add the endpoint and method in the relevant table with every frontend API
   change.
2. When the response is consumed by a typed client, document its stable fields
   in the Purpose column or link to its shared type.
3. For new backend work, prefer publishing OpenAPI and generate this reference
   or a typed client from that contract rather than maintaining parallel specs.
