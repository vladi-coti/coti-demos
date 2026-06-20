export async function retryWithBackoff(fn, maxRetries = 3, initialDelayMs = 1000, errorHandler) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const msg = error?.message?.toLowerCase() || '';
            if (msg.includes('already known')) {
                await sleep(3000);
                continue;
            }
            const retryable =
                msg.includes('timeout') ||
                msg.includes('network') ||
                msg.includes('connection') ||
                msg.includes('econnrefused') ||
                msg.includes('nonce') ||
                error?.code === 'NETWORK_ERROR' ||
                error?.code === 'TIMEOUT' ||
                error?.code === 'SERVER_ERROR' ||
                error?.code === -32000;
            const shouldRetry = errorHandler ? errorHandler(error, attempt) : retryable;
            if (!shouldRetry || attempt === maxRetries) throw error;
            await sleep(initialDelayMs * 2 ** (attempt - 1));
        }
    }
    throw lastError;
}

export async function pollUntilReady(getReady, { pollIntervalMs = 15000, maxWaitMs = 600000, onPoll } = {}) {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
        if (await getReady()) return true;
        onPoll?.();
        await sleep(pollIntervalMs);
    }
    return false;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
