import type { Metadata } from "next";
import { Suspense } from "react";
import { InvoiceWorkspace } from "@/components/invoice/InvoiceWorkspace";

export const metadata: Metadata = { title: "Invoice · Invoice Generator" };

export default function InvoicePage() {
  return (
    <Suspense>
      <InvoiceWorkspace />
    </Suspense>
  );
}
