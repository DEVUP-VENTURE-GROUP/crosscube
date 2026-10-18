import type { Metadata } from "next";
import { InvoiceHistory } from "@/components/invoice/InvoiceHistory";

export const metadata: Metadata = { title: "Invoices · Invoice Generator" };

export default function InvoicesPage() {
  return <InvoiceHistory />;
}
