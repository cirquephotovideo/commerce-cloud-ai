export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RETRY] ${context}: Attempt ${attempt + 1}/${maxRetries + 1}`);
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (
        lastError.message.includes('401') ||
        lastError.message.includes('403') ||
        lastError.message.includes('404')
      ) {
        console.error(`[RETRY] ${context}: Non-retryable error, aborting`);
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        // ✅ Add jitter ±20% to prevent thundering herd
        const jitter = delay * 0.2 * (Math.random() - 0.5);
        const delayWithJitter = Math.floor(delay + jitter);
        console.warn(`[RETRY] ${context}: Failed, retrying in ${delayWithJitter}ms (base: ${delay}ms)...`);
        await new Promise(resolve => setTimeout(resolve, delayWithJitter));
      }
    }
  }
  
  console.error(`[RETRY] ${context}: All ${maxRetries + 1} attempts failed`);
  throw lastError;
}
