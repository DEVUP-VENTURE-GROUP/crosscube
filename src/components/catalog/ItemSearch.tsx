"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/controls";
import { formatCents, formatQuantity } from "@/lib/money/money";
import { buildSearchIndex, searchCatalog } from "@/modules/catalog/catalog.search";
import type { CatalogItem } from "@/modules/catalog/catalog.types";
import { LINE_KIND_LABELS } from "@/modules/pricing/pricing.types";

export function ItemSearch({ catalog, onSelect, disabled }: { catalog: CatalogItem[]; onSelect: (item: CatalogItem) => void; disabled?: boolean }) {
  const index = useMemo(() => buildSearchIndex(catalog), [catalog]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => cancelClose, []);
  const listId = useId();
  const results = useMemo(() => searchCatalog(index, query, { limit: 10 }), [index, query]);
  const showList = open && query.trim() !== "";

  const choose = (item: CatalogItem | undefined) => {
    if (!item) return;
    onSelect(item);
    setQuery("");
    setActive(0);
    input.current?.focus();
  };

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="mb-1 block text-xs font-medium text-zinc-600">
        Search parts, labor and fees
      </label>
      <input
        id={`${listId}-input`}
        ref={input}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active]!.id}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder='Try "motor" or "oil filter"'
        value={query}
        onChange={(event) => {
          cancelClose();
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          cancelClose();
          setOpen(true);
        }}
        onBlur={() => {
          cancelClose();
          closeTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((value) => Math.min(value + 1, Math.max(results.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((value) => Math.max(value - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            choose(results[active]);
          } else if (event.key === "Escape") {
            setQuery("");
          }
        }}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:bg-zinc-100"
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">No active catalog items match “{query.trim()}”.</li>}
          {results.map((item, i) => (
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-start justify-between gap-3 px-3 py-2 text-sm ${i === active ? "bg-zinc-100" : ""}`}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-900">{item.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  <Badge tone={item.kind === "LABOR" ? "blue" : item.kind === "PART" ? "slate" : "amber"}>{LINE_KIND_LABELS[item.kind]}</Badge>
                  {item.sku && <span>SKU {item.sku}</span>}
                  <span>
                    Default {formatQuantity(item.defaultQuantityMilli)} {item.unit}
                  </span>
                  {item.isDemo && <span className="text-amber-700">demo price</span>}
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                {formatCents(item.unitPriceCents)}
                <div className="text-xs text-zinc-500">/ {item.unit}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
