# W3S Cloud Zoho CRM Integration API

An assessment-sized API that connects to Zoho CRM v8 to authenticate and manage Leads. It supports listing, retrieving, and creating Leads, with an email duplicate check before creation.

## Technology stack

- Node.js and Express.js
- JavaScript with CommonJS modules
- Axios for Zoho API requests
- dotenv for environment configuration
- Zoho CRM API v8

## Prerequisites and installation

- Node.js 18 or later and npm
- A Zoho CRM account
- A Zoho OAuth client configured in the Zoho API Console

From the project directory:

```powershell
npm install
Copy-Item .env.example .env
```

## Environment configuration

Set the OAuth client details and matching Zoho data center URLs in `.env`:

```dotenv
PORT=3000
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REDIRECT_URI=http://localhost:3000/auth/zoho/callback
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_API_DOMAIN=https://www.zohoapis.com
```

Use the Accounts URL and API domain for the same Zoho data center. The API uses the `api_domain` returned by Zoho after authorization when available; `ZOHO_API_DOMAIN` is the fallback and is required at startup. Keep `.env` private and out of version control. Never put access or refresh tokens in `.env`.

## Zoho API Console and OAuth setup

1. Create a **Server-based Application** in the Zoho API Console.
2. Set the Homepage URL to `http://localhost:3000` (or the base URL where this app runs).
3. Register the exact **Authorized Redirect URI** `http://localhost:3000/auth/zoho/callback`. It must match `ZOHO_REDIRECT_URI` in `.env` exactly.
4. Authorize these scopes, which the app requests during consent:
   - `ZohoCRM.modules.leads.READ` for listing, searching, and retrieving Leads.
   - `ZohoCRM.modules.leads.CREATE` for creating Leads.
   - `ZohoCRM.settings.fields.READ` as configured by the project.
5. Set `ZOHO_ACCOUNTS_URL` to the OAuth Accounts host for the same data center and `ZOHO_API_DOMAIN` to that data center's Zoho CRM API host. For example, this sample configuration uses `accounts.zoho.com` with `www.zohoapis.com`.

Run the app and visit `http://localhost:3000/auth/zoho` to sign in and grant consent. Zoho redirects to the callback, which exchanges the authorization code and stores the returned tokens in process memory. If Zoho reports `OAUTH_SCOPE_MISMATCH`, verify the scopes and authorize again.

## Run the project

```powershell
npm run dev
```

The API listens on `http://localhost:3000` by default. Set `PORT` in `.env` to change it. `npm start` runs the app without watch mode.

## API endpoints

### `GET /`

Health check response:

```json
{"success":true,"message":"W3S Cloud Zoho CRM Integration API is running"}
```

### `GET /auth/zoho` and `GET /auth/zoho/callback`

The first endpoint redirects to Zoho consent. On successful authorization, the callback returns status 200. It never returns token values:

```json
{
  "success": true,
  "message": "Zoho authentication completed successfully",
  "token_type": "Bearer",
  "api_domain": "https://www.zohoapis.com",
  "expires_in": 3600,
  "access_token_received": true,
  "refresh_token_received": true
}
```

### `GET /api/leads`

Lists up to 20 Leads and returns the requested fields. Example success response (200):

```json
{
  "success": true,
  "data": [
    {"id":"1234567890123456789","full_name":"Avery Example","email":"avery@example.com","company":"Example Co","phone":"+15555550100"}
  ]
}
```

An empty account returns `{"success":true,"data":[]}`.

### `GET /api/leads/:id`

Retrieves one Lead. Example: `GET http://localhost:3000/api/leads/1234567890123456789`. Success response (200):

```json
{
  "success": true,
  "data": {"id":"1234567890123456789","full_name":"Avery Example","email":"avery@example.com","company":"Example Co","phone":"+15555550100"}
}
```

### `POST /api/leads`

Send JSON with `Content-Type: application/json`:

```json
{
  "firstName": "W3S",
  "lastName": "Test Lead",
  "email": "w3stest2026@example.com",
  "company": "W3S Cloud",
  "phone": "+8801700000000"
}
```

`lastName`, `email`, and `company` are required. Email must match a basic email format. The service searches Zoho Leads by email before creating. A new Lead returns status 201:

```json
{"success":true,"created":true,"message":"Lead created successfully","data":{"id":"1234567890123456789","status":"success"}}
```

If the email already exists, no new Lead is created; the existing Lead is returned with status 200:

```json
{"success":true,"created":false,"message":"Lead already exists","data":{"id":"1234567890123456789","full_name":"Avery Example","email":"avery@example.com","company":"Example Co","phone":"+15555550100"}}
```

## Validation, errors, and HTTP status codes

Validation errors return status 400. Examples:

```json
{"success":false,"message":"Last name is required"}
```

```json
{"success":false,"message":"A valid email address is required"}
```

An unauthenticated CRM request returns status 401:

```json
{"success":false,"message":"Zoho authentication is required"}
```

A missing Lead returns status 404:

```json
{"success":false,"message":"Lead not found"}
```

An invalid endpoint also returns status 404 with `{"success":false,"message":"Endpoint not found"}`. Scope mismatch returns 403, for example `{"success":false,"code":"OAUTH_SCOPE_MISMATCH","message":"Zoho authorization is missing a required CRM scope. Reauthorize with the documented scopes."}`. Handled Zoho 400, 401, 403, and 404 responses preserve their status and return a concise JSON message. Network failures return 502; other unexpected Zoho/server errors return 500. Example Zoho validation error:

```json
{"success":false,"code":"INVALID_DATA","message":"Email is invalid"}
```

A network failure response (502) is:

```json
{"success":false,"message":"Unable to reach Zoho CRM. Please try again."}
```

Expected status codes:

| Status | Meaning |
| --- | --- |
| 200 | Successful read, OAuth callback, or duplicate found |
| 201 | Lead created |
| 400 | Invalid request, missing required field, or invalid email |
| 401 | Authentication required or rejected |
| 403 | Required OAuth scope is missing |
| 404 | Lead or endpoint not found |
| 500 | Unexpected Zoho or server error |
| 502 | Zoho network/API service could not be reached |

## Token refresh and security

CRM requests refresh the access token if it is expired or within one minute of expiry. If Zoho returns HTTP 401, the service refreshes the token and retries the original CRM request once; it does not retry indefinitely. The refreshed access token, API domain, and expiry are updated in memory.

In-memory token storage is used for this technical assessment/demo. Tokens are lost when the server process stops and are not shared between server instances. A production system should use secure, persistent, encrypted token storage. Do not log or return client secrets, access tokens, refresh tokens, or authorization codes.

Email duplicate prevention is a check-then-create flow, so concurrent requests can race. Production systems should enforce uniqueness or idempotency in persistent storage/Zoho. The API exposes a small Leads subset, requests at most 20 records per list call, and does not implement pagination or a user session layer.

## Testing

### Real Zoho verification

The following flows were verified against the real Zoho CRM account:

- OAuth authorization and authorization-code exchange.
- Access token and refresh token receipt.
- Real token refresh using the running authenticated server process.
- `GET /api/leads`.
- `POST /api/leads` to create a real Lead.
- Duplicate prevention using a second POST with the same email.
- `GET /api/leads/:id` using the created Zoho Lead ID.

### Real local/API validation

These request validations were verified locally and return HTTP 400 before a Zoho CRM record operation:

- Missing last name.
- Missing company.
- Invalid email format.

### Mocked/local verification

- The one-time 401 refresh-and-retry behavior was verified with a mocked CRM transport, not against the real Zoho API.
- Mocked CRM transport checks covered proactive refresh, Lead creation response handling, email duplicate prevention, and retrieval by ID.
- Other local HTTP checks covered missing email, malformed JSON handling, missing authentication, and 404 responses.

### Suggested API test workflow

Start the app and authorize it before calling CRM endpoints:

```powershell
npm run dev
Start-Process http://localhost:3000/auth/zoho
Invoke-RestMethod http://localhost:3000/
Invoke-RestMethod http://localhost:3000/api/leads
```

After authorization, retrieve a Lead by its Zoho ID and submit a test Lead. POST can create a real CRM record, so use an assessment test address and company. Submit the same email again to confirm the duplicate response, then retrieve the returned ID:

```powershell
$body = @{ firstName='W3S'; lastName='Test Lead'; email='w3stest2026@example.com'; company='W3S Cloud'; phone='+8801700000000' } | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/leads -ContentType 'application/json' -Body $body
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/leads -ContentType 'application/json' -Body $body
Invoke-RestMethod "http://localhost:3000/api/leads/$($created.data.id)"
```

For validation checks, omit `lastName`, omit `email`, use a malformed email, or omit `company`; each should return status 400 before a Zoho CRM request is made.
