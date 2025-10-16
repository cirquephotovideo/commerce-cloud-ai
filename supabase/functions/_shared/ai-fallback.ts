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
  { provider: 'ollama', priority: 1, isActive: true },
  { provider: 'lovable_ai', priority: 2, isActive: true },
  { provider: 'openai', priority: 3, isActive: true },
  { provider: 'openrouter', priority: 4, isActive: true },
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
    let apiKey: string | undefined;
    let apiUrl: string;

    // Special handling for Ollama - try DB config first
    if (providerConfig.provider === 'ollama') {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          const { data: ollamaConfig } = await supabase
            .from('ollama_configurations')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (ollamaConfig) {
            apiUrl = `${ollamaConfig.ollama_url}/v1/chat/completions`;
            apiKey = ollamaConfig.api_key_encrypted || '';
            console.log(`[AI-FALLBACK] Using Ollama from DB: ${ollamaConfig.ollama_url}`);
          } else {
            // Fallback to env variables
            const OLLAMA_URL = Deno.env.get('OLLAMA_URL');
            if (!OLLAMA_URL) {
              console.log('[AI-FALLBACK] Skipping Ollama (no URL configured)');
              continue;
            }
            apiUrl = `${OLLAMA_URL}/v1/chat/completions`;
            apiKey = Deno.env.get('OLLAMA_API_KEY') || '';
          }
        } else {
          console.log('[AI-FALLBACK] Skipping Ollama (no Supabase config)');
          continue;
        }
      } catch (err) {
        console.error('[AI-FALLBACK] Error loading Ollama config:', err);
        continue;
      }
    } else {
      apiKey = Deno.env.get(
        providerConfig.provider === 'lovable_ai' ? 'LOVABLE_API_KEY' :
        providerConfig.provider === 'openai' ? 'OPENAI_API_KEY' :
        'OPENROUTER_API_KEY'
      );

      if (!apiKey) {
        console.log(`[AI-FALLBACK] Skipping ${providerConfig.provider} (no API key)`);
        continue;
      }

      apiUrl = 
        providerConfig.provider === 'lovable_ai' ? 'https://ai.gateway.lovable.dev/v1/chat/completions' :
        providerConfig.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' :
        'https://openrouter.ai/api/v1/chat/completions';
    }

    try {
      console.log(`[AI-FALLBACK] Trying provider: ${providerConfig.provider}`);

      const endpoint = apiUrl;

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