import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { InvoiceDocument } from "./invoice-document";
import type { InvoiceDocumentModel } from "./invoice-document-model";
import { INVOICE_DOCUMENT_CSS, PAPER_DIMENSIONS } from "./invoice-document.css";

let fontCss: string | undefined;

function embeddedFontCss(): string {
  if (fontCss === undefined) {
    const dir = join(process.cwd(), "node_modules", "@fontsource", "arimo", "files");
    fontCss = ([400, 700] as const)
      .map((weight) => {
        const data = readFileSync(join(dir, `arimo-latin-${weight}-normal.woff2`)).toString("base64");
        return `@font-face{font-family:Arimo;font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${data}) format("woff2")}`;
      })
      .join("");
  }
  return fontCss;
}

// Imported lazily because Next.js forbids a static react-dom/server import in App Router bundles.
export async function renderInvoiceHtml(model: InvoiceDocumentModel): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(createElement(InvoiceDocument, { model }));
  const paper = PAPER_DIMENSIONS[model.paperSize];
  return [
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">",
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:\">",
    "<style>",
    embeddedFontCss(),
    `@page{size:${paper.width} ${paper.height}}html,body{margin:0;padding:0;background:#fff}`,
    INVOICE_DOCUMENT_CSS,
    "</style></head><body>",
    markup,
    "</body></html>",
  ].join("");
}
