const DEFAULT_TRANSIENT_RETRY_DELAYS_MS = [150, 400, 900];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isTransientAuthorityFetchError(error: unknown) {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("authority 服务不可达")
    || message.includes("failed to fetch")
    || message.includes("fetch failed")
    || message.includes("networkerror")
    || message.includes("network request failed")
    || message.includes("load failed")
    || message.includes("executor closed during connect")
    || message.includes("executor disconnected")
  );
}

export async function retryTransientAuthorityOperation<T>(input: {
  operation: () => Promise<T>;
  delaysMs?: number[];
  waitForMs?: (ms: number) => Promise<unknown>;
}) {
  const {
    operation,
    delaysMs = DEFAULT_TRANSIENT_RETRY_DELAYS_MS,
    waitForMs = wait,
  } = input;

  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientAuthorityFetchError(error) || attempt === delaysMs.length) {
        throw error;
      }
      await waitForMs(delaysMs[attempt] ?? 0);
    }
  }

  throw new Error("retryTransientAuthorityOperation exhausted without returning or throwing.");
}
