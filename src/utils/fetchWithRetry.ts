export async function fetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000,
    onRetry?: (attempt: number, error: any) => void
): Promise<T> {
    let attempts = 0;
    let lastError: any = null;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            return await fetchFn();
        } catch (err: any) {
            lastError = err;
            if (onRetry) onRetry(attempts, err);
            
            if (attempts < maxAttempts) {
                await new Promise(res => setTimeout(res, delayMs));
            }
        }
    }

    throw lastError;
}
