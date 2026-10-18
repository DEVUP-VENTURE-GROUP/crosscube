import { describe, expect, it } from "vitest";
import { buildSearchIndex, searchCatalog } from "@/modules/catalog/catalog.search";
import { demoCatalogItems } from "./fixtures";

const index = buildSearchIndex(demoCatalogItems());
const names = (query: string, options?: Parameters<typeof searchCatalog>[2]) => searchCatalog(index, query, options).map((item) => item.name);

describe("catalog search", () => {
  it('finds motor oil when typing "motor"', () => {
    expect(names("motor")).toEqual(["Motor Oil EDGE 0W-20 Euro Car 1QT"]);
  });

  it('ranks the oil filter kit first for "oil filter"', () => {
    const results = names("oil filter");
    expect(results[0]).toBe("Oil Filter Kit");
    expect(results).toContain("ENGINE OIL FILTER - Remove & Replace");
    expect(results).not.toContain("Motor Oil EDGE 0W-20 Euro Car 1QT");
  });

  it("is case-insensitive and matches prefixes", () => {
    expect(names("MOT")).toEqual(["Motor Oil EDGE 0W-20 Euro Car 1QT"]);
    expect(names("0w")).toEqual(["Motor Oil EDGE 0W-20 Euro Car 1QT"]);
  });

  it("matches keywords and categories", () => {
    expect(names("hazmat")).toEqual(["Hazardous Materials"]);
    expect(names("synthetic")).toEqual(["Motor Oil EDGE 0W-20 Euro Car 1QT"]);
  });

  it("matches SKUs exactly with top priority", () => {
    const items = demoCatalogItems().map((item) => (item.name === "Oil Filter Kit" ? { ...item, sku: "OFK-100" } : item));
    expect(searchCatalog(buildSearchIndex(items), "ofk-100")[0]?.name).toBe("Oil Filter Kit");
  });

  it("hides inactive items unless requested", () => {
    const items = demoCatalogItems().map((item) => (item.name === "Oil Filter Kit" ? { ...item, active: false } : item));
    const inactiveIndex = buildSearchIndex(items);
    expect(searchCatalog(inactiveIndex, "filter kit")).toEqual([]);
    expect(searchCatalog(inactiveIndex, "filter kit", { includeInactive: true })).toHaveLength(1);
  });

  it("returns nothing for blank or unmatched queries and respects the limit", () => {
    expect(names("   ")).toEqual([]);
    expect(names("transmission")).toEqual([]);
    expect(names("oil", { limit: 1 })).toHaveLength(1);
  });
});
