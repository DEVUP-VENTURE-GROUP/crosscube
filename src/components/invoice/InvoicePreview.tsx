"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildInvoiceDocumentModel, type DocumentSource } from "@/modules/pdf/invoice-document-model";
import { InvoiceDocument } from "@/modules/pdf/invoice-document";
import { INVOICE_DOCUMENT_CSS, PAGE_MARGIN, PAPER_DIMENSIONS } from "@/modules/pdf/invoice-document.css";
import type { BusinessSnapshot } from "@/modules/settings/settings.types";

const CSS_PX_PER_IN = 96;
const PAPER_WIDTH_PX = { LETTER: 8.5 * CSS_PX_PER_IN, A4: (210 / 25.4) * CSS_PX_PER_IN } as const;

export function InvoicePreview({ source, business }: { source: DocumentSource; business: BusinessSnapshot }) {
  const model = useMemo(() => buildInvoiceDocumentModel(source, business, new Date()), [source, business]);
  const frame = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);
  const paperWidth = PAPER_WIDTH_PX[model.paperSize];

  useEffect(() => {
    const frameEl = frame.current;
    const paperEl = paper.current;
    if (!frameEl || !paperEl) return;
    const measure = () => {
      const nextScale = Math.min(1, frameEl.clientWidth / paperWidth);
      setScale(nextScale);
      setHeight(paperEl.offsetHeight * nextScale);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frameEl);
    observer.observe(paperEl);
    measure();
    return () => observer.disconnect();
  }, [paperWidth]);

  return (
    <section aria-label="Invoice preview" className="rounded border border-zinc-200 bg-zinc-100 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span className="font-medium text-zinc-700">Live preview</span>
        <span>
          {model.paperSize === "A4" ? "A4" : "US Letter"} · page breaks and page numbers are applied in the PDF
        </span>
      </div>
      <style>{INVOICE_DOCUMENT_CSS}</style>
      <div ref={frame} className="w-full overflow-hidden" style={{ height: height ?? undefined }}>
        <div
          ref={paper}
          className="invoice-paper"
          style={{
            width: paperWidth,
            minHeight: PAPER_DIMENSIONS[model.paperSize].height,
            padding: `${PAGE_MARGIN.top} ${PAGE_MARGIN.right} ${PAGE_MARGIN.bottom} ${PAGE_MARGIN.left}`,
            transform: `scale(${scale})`,
          }}
        >
          <InvoiceDocument model={model} />
        </div>
      </div>
    </section>
  );
}
