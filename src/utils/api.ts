import type { AbortContext, RequestOptions } from "@/types-and-constants/api";

/**
 * Represents an unsuccessful HTTP response.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly body: unknown;

  constructor(message: string, response: Response, body: unknown) {
    super(message);

    this.name = "HttpError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
    this.body = body;
  }
}

/**
 * Determines whether a value is an object record.
 *
 * @param value - Value to inspect.
 * @returns Whether the value is a non-null object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Reads an unsuccessful response body.
 *
 * JSON responses are parsed as JSON. Other responses are returned as
 * text.
 *
 * @param response - Unsuccessful HTTP response.
 * @returns Parsed error body, text, or `null`.
 */
const readErrorBody = async (response: Response): Promise<unknown> => {
  let text: string;

  try {
    text = await response.text();
  } catch {
    return null;
  }

  if (!text.trim()) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (
    contentType.includes("application/json") ||
    contentType.includes("+json")
  ) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
};

/**
 * Creates a readable message for an unsuccessful response.
 *
 * @param response - Unsuccessful HTTP response.
 * @param body - Parsed response body.
 * @returns Human-readable error message.
 */
const getErrorMessage = (response: Response, body: unknown): string => {
  if (
    isRecord(body) &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }

  if (typeof body === "string" && body.trim()) {
    return body.trim().slice(0, 500);
  }

  return (
    `Request failed with ${response.status}` +
    (response.statusText ? ` ${response.statusText}` : "")
  );
};

/**
 * Combines an external abort signal with an optional timeout.
 *
 * @param externalSignal - Signal supplied by the caller.
 * @param timeoutMs - Optional request timeout.
 * @returns The effective signal and a cleanup function.
 */
const createAbortContext = (
  externalSignal?: AbortSignal,
  timeoutMs?: number,
): AbortContext => {
  if (timeoutMs === undefined) {
    return {
      signal: externalSignal,
      cleanup: () => undefined,
    };
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive number");
  }

  const controller = new AbortController();

  /**
   * Propagates cancellation from the caller.
   */
  const handleExternalAbort = (): void => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal?.aborted) {
    handleExternalAbort();
  } else {
    externalSignal?.addEventListener("abort", handleExternalAbort, {
      once: true,
    });
  }

  const timeoutId = setTimeout(() => {
    controller.abort(
      new DOMException(
        `Request timed out after ${timeoutMs}ms`,
        "TimeoutError",
      ),
    );
  }, timeoutMs);

  /**
   * Releases the event listener and timeout.
   */
  const cleanup = (): void => {
    clearTimeout(timeoutId);

    externalSignal?.removeEventListener("abort", handleExternalAbort);
  };

  return {
    signal: controller.signal,
    cleanup,
  };
};

/**
 * Sends an HTTP request and parses its response.
 *
 * The URL can be relative, such as a Vite proxy path, or absolute for
 * other data sources. The caller controls response parsing.
 *
 * @param input - Relative URL, absolute URL, URL object, or Request.
 * @param options - Fetch options, response parser, signal, and timeout.
 * @returns The parsed response value.
 * @throws {HttpError} When the server returns an unsuccessful status.
 */
export const request = async <T>(
  input: RequestInfo | URL,
  options: RequestOptions<T>,
): Promise<T> => {
  const {
    parse,
    signal: externalSignal,
    timeoutMs,
    headers: initialHeaders,
    ...requestInit
  } = options;

  const abortContext = createAbortContext(externalSignal, timeoutMs);

  try {
    const response = await fetch(input, {
      ...requestInit,
      headers: new Headers(initialHeaders),
      signal: abortContext.signal,
    });

    if (!response.ok) {
      const body = await readErrorBody(response);

      throw new HttpError(getErrorMessage(response, body), response, body);
    }

    return await parse(response);
  } finally {
    abortContext.cleanup();
  }
};
