/**
 * Phase B: Helper de fallback AI automatique entre providers
 * Ordre: lovable_ai → openai → openrouter → ollama
 */

export interface AIProviderConfig {
  provider: 'lovable_ai' | 'openai' | 'openrouter' | 'ollama';
  priority: number;
  isActive: boolean;
}

export interface AICallOptions {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface AIResponse {
  success: boolean;
  content?: any;
  provider?: string;
  error?: string;
  errorCode?: 'PAYMENT_REQUIRED' | 'RATE_LIMIT' | 'PROVIDER_DOWN' | 'AUTH_ERROR' | 'UNKNOWN';
}

const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  { provider: 'lovable_ai', priority: 1, isActive: true },
  { provider: 'openai', priority: 2, isActive: true },
  { provider: 'openrouter', priority: 3, isActive: true },
  { provider: 'ollama', priority: 4, isActive: true },
];

/**
 * Appelle une IA avec fallback automatique
 */
export async function callAIWithFallback(
  options: AICallOptions,
  skipProviders: string[] = []
): Promise<AIResponse> {
  const providers = DEFAULT_PROVIDERS.filter(p => !skipProviders.includes(p.provider));
  let lastError: any = null;

  for (const providerConfig of providers) {
    const apiKey = Deno.env.get(
      providerConfig.provider === 'lovable_ai' ? 'LOVABLE_API_KEY' :
      providerConfig.provider === 'openai' ? 'OPENAI_API_KEY' :
      providerConfig.provider === 'openrouter' ? 'OPENROUTER_API_KEY' :
      'OLLAMA_URL'
    );

    if (!apiKey && providerConfig.provider !== 'ollama') {
      console.log(`[AI-FALLBACK] Skipping ${providerConfig.provider} (no API key)`);
      continue;
    }

    try {
      console.log(`[AI-FALLBACK] Trying provider: ${providerConfig.provider}`);

      const endpoint = 
        providerConfig.provider === 'lovable_ai' ? 'https://ai.gateway.lovable.dev/v1/chat/completions' :
        providerConfig.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
        providerConfig.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
        `${apiKey}/v1/chat/completions`; // Ollama

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || 'google/gemini-2.5-flash',
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens
        }),
      });

      if (!response.ok) {
        lastError = { status: response.status, message: await response.text() };
        
        // Check for specific error codes that should trigger fallback
        const shouldFallback = 
          response.status === 402 || // Payment required
          response.status === 429 || // Rate limit
          response.status === 503;   // Service unavailable

        if (shouldFallback) {
          console.warn(`[AI-FALLBACK] Provider ${providerConfig.provider} failed (${response.status}), trying next...`);
          continue;
        }

        // For other errors (401, 400), throw immediately
        throw lastError;
      }

      // Success!
      const data = await response.json();
      console.log(`[AI-FALLBACK] ✅ Success with provider: ${providerConfig.provider}`);
      
      return {
        success: true,
        content: data,
        provider: providerConfig.provider
      };

    } catch (err) {
      console.error(`[AI-FALLBACK] Error with ${providerConfig.provider}:`, err);
      lastError = err;
      continue;
    }
  }

  // All providers failed
  console.error('[AI-FALLBACK] ❌ All providers failed');
  return {
    success: false,
    error: lastError?.message || 'All AI providers failed',
    errorCode: 'PROVIDER_DOWN'
  };
}

export function getErrorCode(error: any): string {
  if (!error) return 'UNKNOWN';
  
  const status = error.status || error.statusCode;
  const message = (error.message || '').toLowerCase();

  if (status === 401 || message.includes('token') || message.includes('auth')) return 'TOKEN_EXPIRED';
  if (status === 402 || message.includes('payment') || message.includes('credits')) return 'PAYMENT_REQUIRED';
  if (status === 429 || message.includes('rate limit') || message.includes('quota')) return 'RATE_LIMIT';
  if (status === 503 || message.includes('unavailable') || message.includes('down')) return 'PROVIDER_DOWN';
  if (status === 412 || message.includes('config') || message.includes('api key')) return 'PROVIDER_CONFIG_MISSING';

  return 'UNKNOWN';
}