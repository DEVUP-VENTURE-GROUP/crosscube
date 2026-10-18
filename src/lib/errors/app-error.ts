import type { Issue } from "@/modules/invoices/invoice.types";

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "INVOICE_NOT_EDITABLE"
  | "FINALIZATION_IN_PROGRESS"
  | "DUPLICATE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PDF_BUSY"
  | "PDF_RENDER_FAILED"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly issues?: Issue[],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string) => new AppError(404, "NOT_FOUND", `${what} not found.`);
export const conflict = (code: ErrorCode, message: string) => new AppError(409, code, message);
export const validationFailed = (message: string, issues: Issue[]) => new AppError(422, "VALIDATION_FAILED", message, issues);
