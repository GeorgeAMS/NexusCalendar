import { toast } from "sonner";

import { ApiError } from "./api/client";

export function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : "UNKNOWN";
}

export function errorMessage(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Toast for the generic codes: VALIDATION_ERROR, FORBIDDEN, NOT_FOUND, UNAUTHORIZED... */
export function toastApiError(error: unknown, fallback?: string) {
  const code = errorCode(error);
  const message = errorMessage(error, fallback);
  if (code === "UNAUTHORIZED") {
    toast.error("Tu sesión expiró", { description: "Inicia sesión nuevamente." });
    return;
  }
  if (code === "FORBIDDEN") {
    toast.error("Sin permiso", { description: message });
    return;
  }
  toast.error(message);
}

export function isCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
