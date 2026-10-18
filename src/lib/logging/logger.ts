type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

// Callers pass identifiers and counts only; customer data must never be logged.
function write(level: Level, message: string, fields: Fields = {}) {
  const entry = JSON.stringify({ level, time: new Date().toISOString(), message, ...fields });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else if (process.env.NODE_ENV !== "test") console.log(entry);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
