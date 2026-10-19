# Deployment: Vercel (app) + Render (PDF service)

```
Browser ──HTTPS──► Vercel: Next.js app (pages, API, auth)  ──► MongoDB Atlas
                         │
                         └─HTTPS + bearer token──► Render: PDF service (Chrome, Docker)
```

- **Vercel** runs the whole web app: pages, sign-in, invoice/catalog/settings APIs. It is the only part with database credentials.
- **Render** runs `services/pdf-server.ts` from `Dockerfile`. It receives a finished invoice layout, validates it, renders it with Chrome and returns the PDF. It has no database access and rejects any request without the shared token.

Deploy Render first, because Vercel needs its URL and token.

## 1. PDF service on Render

1. Render dashboard → **New → Blueprint** → connect the GitHub repo `DEVUP-VENTURE-GROUP/crosscube` → Render reads `render.yaml` and proposes the `invoice-pdf-service` web service (Docker, Starter plan) → **Apply**.
2. Render generates `PDF_SERVICE_TOKEN` automatically. Open the service → **Environment** → copy its value.
3. Wait for the first deploy to finish. `https://<service>.onrender.com/healthz` must return `{"ok":true}`.
4. Copy the service URL (e.g. `https://invoice-pdf-service.onrender.com`).

Starter (always-on) is recommended. The free plan sleeps after inactivity, so the first PDF after a pause would wait about a minute.

## 2. Web app on Vercel

1. Vercel dashboard (your Pro team) → **Add New → Project** → import `DEVUP-VENTURE-GROUP/crosscube`. Framework: Next.js (detected). Leave build settings at their defaults.
2. **Environment Variables** (Production, and Preview if you use previews):

| Name | Value |
| --- | --- |
| `MONGODB_URI` | your Atlas connection string |
| `MONGODB_DB` | `auto_invoice` |
| `AUTH_USERNAME` | sign-in username |
| `AUTH_PASSWORD_HASH` | from `npm run auth:hash-password` |
| `AUTH_SECRET` | from `npm run auth:hash-password` (32+ characters) |
| `PDF_SERVICE_URL` | the Render URL from step 1 |
| `PDF_SERVICE_TOKEN` | the Render token from step 1 |

3. **Deploy**. Every push to `main` redeploys both Vercel and Render automatically.
4. Open the `*.vercel.app` URL, sign in, download a PDF to confirm the Render connection.

## 3. MongoDB Atlas network access

Vercel functions do not have fixed IP addresses, so Atlas must allow them: Atlas → **Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0)**. Keep the database user's password long and random. The Render PDF service never connects to the database.

For lower latency, set the Vercel project's **Functions Region** (Settings → Functions) to the region closest to your Atlas cluster.

## 4. Custom domain

Vercel project → **Settings → Domains → Add** your domain, then create the DNS record Vercel shows at your registrar:

| Domain type | Record |
| --- | --- |
| Subdomain, e.g. `invoices.example.com` | `CNAME invoices → cname.vercel-dns.com` |
| Root domain, e.g. `example.com` | `A @ → 76.76.21.21` |

Vercel issues the HTTPS certificate automatically once DNS resolves. The session cookie is marked `Secure` on HTTPS.

The Render service can keep its `onrender.com` address. It is only called by Vercel, never by browsers.

## Updating

- Code: push to `main`. Vercel and Render redeploy; Render only rebuilds when PDF-related files change (`buildFilter` in `render.yaml`).
- Password: run `npm run auth:hash-password`, update `AUTH_PASSWORD_HASH` in Vercel, redeploy.
- PDF token: change `PDF_SERVICE_TOKEN` in both Render and Vercel together, then redeploy both.

## Rollback

- Vercel: **Deployments** → previous deployment → **Promote to Production**.
- Render: service → **Events** → previous deploy → **Rollback**.
- No database migrations run on deploy; rolling back code does not touch data.
