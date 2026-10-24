# MedGraph OAuth and Patient-Isolation Audit

**Audit date:** October 24, 2026  
**Scope:** Google Identity Services login, bearer-token handling, tenant/doctor scoping, patient-facing data, knowledge-upload isolation, and related authorization paths.

## Executive summary

The project had several confirmed high-impact authentication and isolation defects. The most serious were:

1. A hard-coded `mock_google_jwt_token` could mint a real access token whenever `ALLOW_MOCK_AUTH=true`, even if the deployment was not explicitly in test mode.
2. Google ID-token verification did not require a configured audience and did not require `email_verified=true`.
3. An expired frontend session silently logged in as a shared demo doctor or patient.
4. The patient portal rendered Arthur Pendelton's identity and visit history for every patient account.
5. The app had no backend patient-record store or doctor-patient relationship model, so real patient visibility across doctors is not implemented at all.
6. The mock DDI store could skip a second doctor's private copy of the same drug pair because its duplicate check ignored doctor scope.

The first five security issues that were unambiguous were fixed in this pass. The patient-sharing requirement remains a product/data-model gap rather than something that can be safely solved by changing the current `doctor_id` parameter.

## Fixed in this pass

| Priority | Finding | Evidence | Change |
|---|---|---|---|
| P0 | Mock Google login was deployable | `backend/main.py` accepted `mock_google_jwt_token` when `ALLOW_MOCK_AUTH=true`; the checked-out `.env` had that flag enabled. | Mock login now requires both `TESTING=true` and `ALLOW_MOCK_AUTH=true`. The normal frontend no longer sends a fake credential and shows a disabled state when Google is unconfigured. |
| P0 | Google audience was not mandatory | `verify_oauth2_token(..., Config.GOOGLE_CLIENT_ID or None)` allowed the verification call to proceed without a client audience. | Missing/placeholder `GOOGLE_CLIENT_ID` now returns `503`; real tokens are verified against the configured client ID. |
| P0 | Unverified Google email accepted | The old flow used the token email without checking `email_verified`. | Tokens now require `email_verified is True` and a stable `sub`. |
| P0 | Test auth bypass was too broad | `TESTING=true` alone made every authenticated request become the test practitioner. | The bypass now requires explicit `ALLOW_TEST_AUTH=true`; the existing flow test opts into it explicitly. |
| P0 | Expired sessions crossed accounts | `frontend/src/App.jsx` auto-logged in with hard-coded demo credentials after token expiry. | Expired/rejected sessions are cleared and sent back to sign-in; no silent demo-account substitution occurs. |
| P0 | Browser account state was retained across users | Workspace history, results, and patient form state were not cleared on login/logout. | Session changes reset workspace state; the dashboard now also requires `isLoggedIn`. |
| P0 | Patient portal exposed shared demo PHI | `PatientWorkspace.jsx` hard-coded Arthur Pendelton, `PAT-0982`, and three visits for every patient account. | Patient identity/ID are derived from the authenticated user. Demo visits are shown only for the demo patient email; other patient accounts start with no visit history. Hard-coded doctor names in action text were removed. |
| P1 | Public registration could choose a tenant | `RegisterRequest` accepted `tenant_id` from the browser and copied it into the signed token. | Registration no longer accepts a client tenant field; the server assigns `DEFAULT_TENANT_ID`. Practitioner registration also validates password length, 10-digit NPI format, and clinic presence. |
| P1 | Mock private DDI isolation was incorrect | `process_ddi_csv()` considered a drug pair a duplicate without checking scope or `doctor_id`; doctor B could fail to receive a private copy uploaded by doctor A. | Duplicate detection now includes private/global scope and doctor ID. |
| P1 | CORS had two middleware configurations | `backend/main.py` installed a wildcard credentialed CORS middleware and then an explicit allowlist middleware. | The wildcard middleware was removed; only the configured allowlist remains. |
| P1 | Knowledge API leaked internal errors | Knowledge routes returned `str(e)` in HTTP 500 responses. | Routes now log the exception server-side and return generic error messages. |
| P1 | CSV seeder could not compile | `backend/graph/seed_csv.py` used Python keyword syntax `class=d1_class`. | Parameters are passed with a dictionary expansion so the seeder compiles. |
| P1 | Demo password was printed in the login UI | `AuthView.jsx` displayed the demo email and password to every visitor. | The UI now describes password login as local-development-only without publishing credentials. |

## Confirmed open issues

### 1. Patient visibility across doctors is not implemented

There is no backend `Patient`/`PatientRecord` model, no patient identifier in `PatientInput`, no record repository, no doctor-patient relationship table, and no API for listing or reading patient records. `POST /diagnose` only evaluates the submitted payload and returns a result; the frontend stores the resulting history in React state.

Current consequences:

- A case created by doctor A in one browser is not available to doctor B in another browser.
- `doctor_id` is used for diagnosis caching and private knowledge namespaces, not for patient-record sharing.
- The current static doctor history is demo UI data, not a secured patient database.

Before implementing this, the access rule must be explicit:

- **Clinic-wide:** every practitioner in the same tenant can read the patient; or
- **Care-team:** only assigned practitioners can read the patient; or
- **Patient-controlled:** the patient grants/revokes practitioner access.

The safe next implementation is a server-side patient-record store with an immutable `patient_id`, tenant boundary, audit log, and explicit access policy. Do not make patient records visible by simply removing `doctor_id` from the cache or Pinecone namespace; that would mix private clinical knowledge with patient data.

### 2. Google users can self-select the practitioner role

`GoogleLoginRequest.role` comes from the browser. A new Google identity can request `medical_practitioner`, and the current backend only fills a demo NPI/clinic. The regular signup path also has no registry verification. A production deployment needs an invitation/admin approval flow or an external NPI/licensure verification step before granting practitioner privileges.

### 3. Users are stored only in process memory

`backend/auth.py` uses `_users`, an in-memory dictionary. Accounts, Google subject bindings, and role assignments disappear on restart and diverge across multiple workers. This is not suitable for real OAuth identity management or patient access control. Move users and provider identities to a persistent database/IdP before production.

### 4. Google replay/CSRF binding is incomplete

The browser callback sends the Google credential, but the server does not issue and verify a per-login nonce. Add a short-lived, server-issued nonce tied to the browser login attempt and validate it in the ID token before minting the MedGraph token.

### 5. Bearer tokens are stored in `localStorage`

`medgraph_access_token` is readable by any JavaScript running in the origin. An XSS issue would expose the token. Prefer an `HttpOnly`, `Secure`, `SameSite` session cookie with CSRF protection, or a short-lived access token plus a rotated refresh-token flow.

### 6. Tenant enforcement is still only scaffolding

Although client-selected tenant registration was removed, all normal demo/Google users default to one `DEFAULT_TENANT_ID`, and the data paths do not enforce tenant predicates in a database. Tenant ID must be part of every patient, knowledge, cache, and audit query once persistence is added.

## Secret-handling action required

The checked-out local `.env` contains non-placeholder Google OAuth/auth secrets and has `ALLOW_MOCK_AUTH=true`. The file is ignored by Git, but those credentials should still be rotated immediately in Google Cloud and the deployment secret store. Keep `ALLOW_MOCK_AUTH=false` or unset outside automated tests. No secret values are included in this report.

## Checks run

Passed:

- `python3 -m compileall -q backend`
- `npm run lint` from `frontend/`
- `npm run build` from `frontend/`
- `git diff --check` for the files changed in this audit

Not runnable in the current shell:

- `python3 -m pytest backend/tests -q` — `pytest` is not installed.
- Direct backend smoke imports — `fastapi` is not installed in the available Python environment.

The new regression coverage is in `backend/tests/test_auth_security.py`; it should be run after the backend requirements are installed.
