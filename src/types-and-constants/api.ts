export type ResponseParser<T> = (response: Response) => T | Promise<T>;

export type RequestOptions<T> = Omit<RequestInit, "signal"> & {
  signal?: AbortSignal;
  timeoutMs?: number;
  parse: ResponseParser<T>;
};

export type AbortContext = {
  signal?: AbortSignal;
  cleanup: () => void;
};
