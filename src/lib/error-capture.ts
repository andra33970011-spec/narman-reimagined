let lastError: unknown = undefined;

if (typeof process !== "undefined" && typeof process.on === "function") {
  try {
    process.on("uncaughtException", (err) => {
      lastError = err;
    });
    process.on("unhandledRejection", (err) => {
      lastError = err;
    });
  } catch {
    // ignore
  }
}

export function consumeLastCapturedError(): unknown {
  const e = lastError;
  lastError = undefined;
  return e;
}
