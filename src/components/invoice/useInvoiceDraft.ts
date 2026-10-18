"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/http/client";
import type { Invoice, Issue } from "@/modules/invoices/invoice.types";
import type { DraftInput } from "@/modules/invoices/invoice.validation";

export type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string };

const AUTOSAVE_DELAY_MS = 700;
const RETRY_DELAY_MS = 4000;

export function draftFromInvoice(invoice: Invoice): DraftInput {
  return {
    customerId: invoice.customerId,
    vehicleId: invoice.vehicleId,
    customer: invoice.customer,
    vehicle: invoice.vehicle,
    estimateNumber: invoice.estimateNumber,
    originalEstimateCents: invoice.originalEstimateCents ?? null,
    serviceDate: invoice.serviceDate,
    notes: invoice.notes,
    lines: invoice.lines.map(({ id, catalogItemId, kind, description, notes, quantityMilli, unitPriceCents, priceOverrideReason }) => ({
      id,
      catalogItemId: catalogItemId ?? "",
      kind,
      description,
      notes,
      quantityMilli,
      unitPriceCents,
      priceOverrideReason,
    })),
    payments: invoice.payments,
  };
}

export function useInvoiceDraft(initial: Invoice) {
  const [invoice, setInvoice] = useState(initial);
  const [draft, setDraft] = useState<DraftInput>(() => draftFromInvoice(initial));
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const versionRef = useRef(initial.version);
  const draftRef = useRef(draft);
  const editSeq = useRef(0);
  const savedSeq = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const editable = invoice.status === "DRAFT";

  const runSave = useCallback(async (): Promise<void> => {
    while (!blocked.current && savedSeq.current < editSeq.current) {
      const seq = editSeq.current;
      setSaveState({ kind: "saving" });
      try {
        const result = await api<{ invoice: Invoice; issues: Issue[] }>(`/api/invoices/${invoice.id}`, {
          method: "PUT",
          body: { version: versionRef.current, draft: draftRef.current },
        });
        versionRef.current = result.invoice.version;
        savedSeq.current = seq;
        setInvoice(result.invoice);
      } catch (error) {
        const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN", "Save failed.");
        if (apiError.status === 409) {
          blocked.current = true;
          setSaveState({ kind: "conflict", message: apiError.message });
          return;
        }
        setSaveState({ kind: "error", message: apiError.status === 400 ? `${apiError.message} ${apiError.issues.map((i) => i.message).join(" ")}` : apiError.message });
        timer.current = setTimeout(() => void flushRef.current(), RETRY_DELAY_MS);
        return;
      }
    }
    if (!blocked.current) setSaveState(savedSeq.current >= editSeq.current ? { kind: "saved", at: new Date() } : { kind: "dirty" });
  }, [invoice.id]);

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    while (inFlight.current) await inFlight.current;
    if (savedSeq.current >= editSeq.current || blocked.current) return;
    inFlight.current = runSave().finally(() => {
      inFlight.current = null;
    });
    await inFlight.current;
  }, [runSave]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const update = useCallback(
    (recipe: (current: DraftInput) => DraftInput) => {
      if (!editable || blocked.current) return;
      setDraft((current) => {
        const next = recipe(current);
        draftRef.current = next;
        return next;
      });
      editSeq.current++;
      setSaveState({ kind: "dirty" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [editable, flush],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (savedSeq.current < editSeq.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const replaceInvoice = useCallback((next: Invoice) => {
    versionRef.current = next.version;
    setInvoice(next);
    const nextDraft = draftFromInvoice(next);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, []);

  const finalize = useCallback(async (): Promise<Invoice> => {
    await flush();
    if (blocked.current || savedSeq.current < editSeq.current) {
      throw new ApiError(409, "NOT_SAVED", "Save the latest changes before finalizing.");
    }
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await api<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/finalize`, { method: "POST" });
        replaceInvoice(result.invoice);
        return result.invoice;
      } catch (error) {
        lastError = error;
        if (!(error instanceof ApiError && error.code === "FINALIZATION_IN_PROGRESS")) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw lastError;
  }, [flush, invoice.id, replaceInvoice]);

  return { invoice, draft, saveState, editable, update, flush, finalize, replaceInvoice };
}
