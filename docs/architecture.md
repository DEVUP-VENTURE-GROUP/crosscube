# Architecture

## Shape

One Next.js application. Browser components call JSON route handlers under `/api`; route handlers validate input with zod and delegate to services in `src/modules`; services use the MongoDB driver through typed collections (`src/lib/db/collections.ts`).

```
browser ──► /api/* route handlers ──► modules/*/service ──► MongoDB
   │                                        │
   └── shared pure modules (pricing, invoice.compute, pdf document model, document template)
```

Pure modules (no I/O) are imported by both the browser and the server so the preview and the authoritative server result come from the same code:

- `modules/pricing`: line totals, buckets, tax, balance.
- `modules/invoices/invoice.compute.ts`: resolves draft lines against the catalog and produces totals and issues (required fields, VIN, catalog authorization, overpayment).
- `modules/pdf/invoice-document-model.ts` + `invoice-document.tsx` + `invoice-document.css.ts`: the printable document. The preview renders it in the page; the PDF route renders it to static HTML and prints it with Chromium.

## Data (MongoDB collections)

| Collection | Contents | Key indexes |
| --- | --- | --- |
| `settings` | single `shop` document | — |
| `counters` | `{ _id: "invoice", next }` | — |
| `tax_categories` | code, name, ratePpm, active | `code` unique |
| `catalog_items` | catalog entries | `sku` unique (partial), `kind+active` |
| `customers` | contact details, `phoneDigits` | `phoneDigits`, `name` |
| `vehicles` | vehicle details, `customerId` | `vin`, `licensePlate`, `customerId` |
| `invoices` | header snapshots, embedded `lines`, `payments`, `events`, totals | `invoiceNumber`, `sequenceNumber`, `idempotencyKey` unique (partial); `createdAt,_id`; `status,createdAt,_id` |

Indexes are created idempotently on first connection and by `npm run db:setup`.

Invoices embed lines, payments and audit events so every state change is a single-document atomic update.

## Concurrency and integrity

- **Draft saves**: `updateOne({ _id, status: "DRAFT", version })` with `$inc: { version: 1 }`. A stale version or a non-draft returns 409, so concurrent tabs and finalized invoices are protected.
- **Draft creation**: client sends an idempotency key (kept in sessionStorage); the unique index collapses duplicates.
- **Finalization** (no multi-document transaction needed):
  1. validate with `computeInvoice` against current catalog/settings;
  2. atomically flip `DRAFT → FINALIZING` with a lock token, conditioned on the validated version;
  3. reserve a number with `$inc` on the counter and store it on the invoice (`reservedSequence`), reused if a crashed attempt is retried after the lock goes stale (60 s);
  4. upsert customer and vehicle;
  5. commit `FINALIZED` + number + snapshot + audit events conditioned on the lock token.

  Concurrent requests for the same draft wait briefly and return the finalized result. Unique indexes are the final guard against duplicate numbers. A number can be skipped only if the process dies between steps 3 and the reservation write, or if a draft holding a reservation is deleted.
- **Payments after finalization**: version-conditioned `$push`, rejected if it would exceed the total.
- **Void/reissue**: void is a conditional status change; reissue uses idempotency key `reissue:<id>` so it happens once.

## Security

- Server-side validation of all input (zod, strict objects, bounded lengths and array sizes, 1 MB body limit, `application/json` required).
- Kind, unit, SKU, catalog price and tax rate are always taken from the database, never from the client.
- Sign-in page with a scrypt-hashed password, HMAC-signed HttpOnly SameSite=Lax session cookie (12 h, Secure on HTTPS), constant-time comparisons and per-IP/username rate limiting of failed attempts (in-process). Middleware protects every page and API route; expired API sessions return 401 and the client redirects to `/login`.
- Cross-site write protection (Sec-Fetch-Site / Origin checks) on top of SameSite cookies.
- PDF rendering: React-escaped markup, CSP `default-src 'none'` in the print page, all network requests from the page aborted, logos accepted only as PNG/JPEG data URLs, bounded concurrency/queue and timeouts.
- Logs contain identifiers and counts only, never customer data. Unexpected errors return a reference id.
- Security headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`.

## Known limitations

- One configured login (from environment variables); no per-user accounts, roles or per-user audit attribution. Login rate limiting is per server process.
- No discounts or post-tax charges as separate line types; use price changes with reasons or an "other charge" catalog item.
- Tax supports one rate per category (no compound or jurisdiction lookup).
- PDFs are regenerated from the stored snapshot on each download (not archived as files); a future template change would change how old invoices print, though never their numbers or amounts.
- VIN validation checks format and the North American check digit only; there is no VIN-decoding integration.
- Catalog listing is capped at 5,000 items (in-memory search is designed for shop-sized catalogs).
