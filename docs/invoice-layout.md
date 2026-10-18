# Invoice document layout

The printed invoice follows the shop's reference invoice (Mitchell-style repair order). One template (`src/modules/pdf/invoice-document.tsx` + `invoice-document.css.ts`) drives both the live preview and the PDF.

| Area | Content | Source |
| --- | --- | --- |
| Header (centre) | Business name (uppercase, bold), street, city/state/ZIP, `Phone: … Fax: …` | Settings |
| Header (left) | Optional logo | Settings |
| Header (right) | `INVOICE`, boxed invoice number (`DRAFT` until finalized), `Org. Est. # …` | Invoice |
| Title row | `INVOICE` and `Printed Date` (shop time zone) | Settings title, render time |
| Customer (left) | `COMPANY - NAME` (bold, uppercase), address, `<phone type> <phone>`, email | Invoice customer |
| Vehicle (right) | `Year Make - Model Trim - Engine`, `Lic # :` / `Odometer In :`, `VIN # :` with the last 8 characters bold | Invoice vehicle |
| Parts column | Part Description / Qty / Sale / Ext (no currency symbols, quantities like `6.00`); shop supplies indented with Ext only | Lines of type part (and shop supplies when configured) |
| Labor column | Labor Description / Ext; service notes indented beneath; hazardous materials and other fees | Lines of type labor, hazmat, other |
| Bottom left | `Org. Estimate / Revisions / Current Estimate` (when an original estimate is entered), invoice notes, `[ Payments - Method - $amount ]` | Invoice |
| Totals box | Labor, Parts, (Shop Supplies), HazMat, (Other), SubTotal, Tax, Total, (Paid), Bal Due | Totals snapshot |
| Below | `Vehicle Received:` (service date), `Customer Number :` | Invoice |
| Authorization box | Authorization text, warranty text, Signature/Date lines | Settings (only text the operator enters) |
| Footer | `Visit us on the web:` website, `Email Address:` email, footer note | Settings |
| Page footer | `Page X of Y` (PDF only) | Chromium |

Pagination: the parts/labor body stretches to fill a single page so the totals block sits at the bottom, as in the reference. Longer invoices flow onto more pages with repeated column headers, the vertical rule continued on each page, and the totals/authorization block kept together on the last page.

Fonts: Arimo (metric-compatible with Arial) is embedded in the PDF so output is identical on any server.

The third-party software copyright line in the reference belongs to that vendor and is intentionally not reproduced.
