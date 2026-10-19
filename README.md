# Automotive Invoice Generator

Internal tool for building repair and maintenance invoices from a catalog of parts, labor operations and fees, with a live preview and a server-rendered PDF that follows the shop's reference invoice layout.

- **Add Items**: customer and vehicle details (with saved-customer lookup), catalog search ("motor", "oil filter"…), quantities, authorized price changes, shop supplies, hazmat and other fees, live totals.
- **Create Invoice**: validation checklist, payments, notes, finalize (server-assigned number, locked pricing snapshot), PDF download, record later payments, void and reissue.
- **Invoices / Catalog / Settings**: history with PDF re-download, catalog and tax-category management, business identity, numbering, paper size and document text.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · MongoDB (official driver) · zod · Puppeteer (Chromium PDF engine) · Vitest · Playwright.

## Requirements

- Node.js 20.11+
- A MongoDB deployment (standalone or replica set; transactions are not required)
- Chrome/Chromium for PDFs: `npm install` downloads one for Puppeteer, or set `PUPPETEER_EXECUTABLE_PATH`

## Setup

```bash
npm install
cp .env.example .env          # set MONGODB_URI (and MONGODB_DB if you want a different database name)
npm run db:setup              # creates indexes and the invoice counter (also done automatically on first request)
npm run db:seed               # optional: demonstration catalog, settings and one demo draft
npm run dev                   # http://localhost:3000
```

### Login

The app has its own sign-in page (`/login`). Create the credentials once:

```bash
npm run auth:hash-password        # prompts for a password (12+ characters)
```

Copy the printed `AUTH_PASSWORD_HASH` and `AUTH_SECRET` into `.env` and set `AUTH_USERNAME`. Only the scrypt hash is stored, never the password. Sessions are signed HttpOnly cookies valid for 12 hours; changing `AUTH_SECRET` signs everyone out. Failed sign-ins are rate-limited (5 per 15 minutes per IP and username).

Without these variables the app runs open in development; in production it refuses to serve unless they are set or `ALLOW_UNAUTHENTICATED=true`.

Production: `npm run build && npm start`.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | Connection string for your MongoDB deployment |
| `MONGODB_DB` | no (`auto_invoice`) | Database used by this app |
| `AUTH_USERNAME` | in production | Sign-in username |
| `AUTH_PASSWORD_HASH` | in production | scrypt hash from `npm run auth:hash-password` |
| `AUTH_SECRET` | in production | 32+ character key that signs session cookies |
| `ALLOW_UNAUTHENTICATED` | no | `true` disables the production login requirement (only behind another auth layer) |
| `PUPPETEER_EXECUTABLE_PATH` | no | Use an installed Chrome/Chromium |
| `PDF_MAX_CONCURRENCY` | no (`2`) | Parallel PDF renders per server process (excess requests queue, max 20, then 503) |
| `PDF_RENDER_TIMEOUT_MS` | no (`20000`) | Per-render timeout |
| `PDF_SERVICE_URL`, `PDF_SERVICE_TOKEN` | no | Use the standalone PDF service instead of local Chrome (see `docs/deployment.md`) |

## Deployment

Production runs as two pieces: the Next.js app on **Vercel** and the PDF renderer (`services/pdf-server.ts`, Chrome in Docker) on **Render**. Step-by-step instructions, environment variables and DNS records are in [`docs/deployment.md`](docs/deployment.md).

## Configure your shop

Open **Settings** and enter your business name, address, phone/fax, website, email and optional logo, invoice number prefix/digits/next number, paper size (Letter or A4), time zone, and the authorization and warranty wording exactly as your business uses it. Nothing legal is pre-filled.

Under **Settings → Tax categories**, set your real rates. The seeded `PARTS` 8% rate only reproduces the reference invoice ($10.73 on $134.15) and is labeled as demo.

## Catalog management

**Catalog** lists every part, labor operation, shop-supplies, hazmat and other fee item. Each item has type, name, printed description, optional SKU, category, unit, default quantity, unit sale price, tax category, keywords, active flag, whether quantity/price may be changed on invoices, and an optional associated labor operation. The association is only suggested when the part is added; it is never added automatically.

Items are deactivated, not deleted, so history stays intact. Seeded items carry a **demo** badge: their prices come from the reference invoice and are not verified supplier prices.

## How pricing works

All arithmetic lives in `src/modules/pricing` and is shared by the live preview and the server:

- Money is integer cents; quantities are integer thousandths; tax rates are parts-per-million.
- Line total = quantity × unit price, rounded half-up once per line.
- Tax is computed per tax category on the summed taxable amount and rounded once.
- Subtotal = parts + labor + shop supplies + hazmat + other fees. Total = subtotal + tax. Balance = total − payments.
- With "Show shop supplies in the parts table" enabled (default, as in the reference), shop supplies print in the parts table and count in Parts. Hazardous materials always print in the labor column and count separately. Each is counted exactly once.

On save and on finalize the server re-resolves every line from the catalog. Kind, unit, SKU and tax come from the catalog, never from the browser. It rejects price changes on items that don't allow them, requires a reason for allowed changes (recorded in the invoice history), and rejects stale catalog prices and overpayment.

## Invoice lifecycle

`DRAFT` → (`FINALIZING`) → `FINALIZED` → optionally `VOID` → reissue as a new linked draft.

- Drafts autosave with optimistic versioning; two tabs cannot silently overwrite each other.
- Finalize locks the draft atomically, reserves the next number with an atomic counter, upserts the customer and vehicle records, then commits the snapshot (lines, totals, tax rates, business details) in one conditional update. Unique indexes guarantee no duplicate numbers. Repeated or concurrent finalize requests return the same invoice.
- Finalized invoices are immutable except for appended payments; their PDFs are rendered only from the stored snapshot, so catalog or settings changes never alter them.
- Downloading a draft PDF never finalizes it (draft PDFs are watermarked).

## Tests

```bash
npm test                 # unit: money, pricing, tax, search, VIN, catalog rules, document model
npm run test:integration # MongoDB (in-memory mongod) + real PDF rendering and PDF text/layout checks
npm run test:e2e         # builds required first (npm run build); Playwright drives the full workflow in installed Chrome
npm run typecheck && npm run lint
```

Integration and E2E tests start a throwaway in-memory MongoDB and never touch your database. Generated PDFs from the tests are written to `artifacts/pdf/` for inspection.

## Project layout

```
src/app/                 pages (/invoice, /invoices, /catalog, /settings) and API route handlers
src/components/          invoice workspace, editor, preview, review; catalog; settings; ui controls
src/modules/pricing/     pricing + tax (single source of truth for arithmetic)
src/modules/invoices/    types, validation, compute (catalog rules), repository, service (lifecycle)
src/modules/catalog/     types, validation, search, repository, service
src/modules/pdf/         document model, React document template, print CSS, HTML + Puppeteer renderer
src/modules/customers/   customer/vehicle search and upsert
src/modules/settings/    shop settings
src/lib/                 money, db, http, errors, logging, config
scripts/                 db-setup, seed, e2e-server
tests/                   unit, integration, e2e
docs/                    architecture and invoice layout notes
```
