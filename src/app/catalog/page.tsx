import type { Metadata } from "next";
import { CatalogManager } from "@/components/catalog/CatalogManager";

export const metadata: Metadata = { title: "Catalog · Invoice Generator" };

export default function CatalogPage() {
  return <CatalogManager />;
}
