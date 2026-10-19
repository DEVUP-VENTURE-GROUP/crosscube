import type { Metadata } from "next";
import { CustomerManager } from "@/components/customers/CustomerManager";

export const metadata: Metadata = { title: "Customers · Invoice Generator" };

export default function CustomersPage() {
  return <CustomerManager />;
}
