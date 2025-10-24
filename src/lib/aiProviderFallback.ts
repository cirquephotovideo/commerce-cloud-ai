import { supabase } from "@/integrations/supabase/client";

export interface AIProviderConfig {
  provider: 'lovable_ai' | 'openai' | 'openrouter' | 'ollama' | 'claude';
  priority: number;
  isActive: boolean;
}

export interface AICallOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  userId?: string;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  provider?: string;
  error?: string;
  errorCode?: 'PAYMENT_REQUIRED' | 'RATE_LIMIT' | 'PROVIDER_DOWN' | 'AUTH_ERROR' | 'UNKNOWN';
}

/**
 * Appelle une IA avec fallback automatique si le provider principal échoue
 * Ordre de priorité: Lovable AI → OpenAI → OpenRouter → Ollama
 */
export async function callAIWithFallback(
  functionName: string,
  body: any,
  options: { skipProviders?: string[] } = {}
): Promise<AIResponse> {
  const providers: AIProviderConfig[] = [
    { provider: 'ollama' as const, priority: 1, isActive: true },
    { provider: 'lovable_ai' as const, priority: 2, isActive: true },
    { provider: 'openai' as const, priority: 3, isActive: false },
    { provider: 'openrouter' as const, priority: 4, isActive: false },
  ].filter(p => p.isActive && !options.skipProviders?.includes(p.provider));

  let lastError: any = null;

  for (const providerConfig of providers) {
    try {
      console.log(`[AI-FALLBACK] Trying provider: ${providerConfig.provider}`);

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          ...body,
          preferredProvider: providerConfig.provider
        }
      });

      if (error) {
        lastError = error;
        
        // Check for specific error codes that should trigger fallback
        const errorMessage = error.message?.toLowerCase() || '';
        const shouldFallback = 
          error.status === 402 || // Payment required
          error.status === 429 || // Rate limit
          error.status === 503 || // Service unavailable
          errorMessage.includes('payment') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('quota') ||
          errorMessage.includes('credits');

        if (shouldFallback) {
          console.warn(`[AI-FALLBACK] Provider ${providerConfig.provider} failed (${error.status}), trying next...`);
          continue;
        }

        // For other errors, throw immediately
        throw error;
      }

      // Success!
      if (data?.success || data?.analysis || data?.categories) {
        console.log(`[AI-FALLBACK] ✅ Success with provider: ${providerConfig.provider}`);
        return {
          success: true,
          content: data,
          provider: providerConfig.provider
        };
      }

      // If data structure is unexpected but no error, try next
      console.warn(`[AI-FALLBACK] Unexpected response from ${providerConfig.provider}, trying next`);
      lastError = new Error('Unexpected response structure');
      
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

/**
 * Détermine le code d'erreur approprié depuis une réponse d'erreur
 */
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

/**
 * Obtient un message d'erreur convivial pour l'utilisateur
 */
export function getUserFriendlyError(errorCode: string, provider?: string): string {
  const providerName = provider || 'le provider IA';
  
  switch (errorCode) {
    case 'TOKEN_EXPIRED':
      return 'Session expirée. Veuillez vous reconnecter.';
    case 'PAYMENT_REQUIRED':
      return `Clé API ou crédits manquants pour ${providerName}. Vérifiez votre configuration.`;
    case 'RATE_LIMIT':
      return `Limite de requêtes atteinte pour ${providerName}. Réessayez dans quelques instants.`;
    case 'PROVIDER_DOWN':
      return `${providerName} est temporairement indisponible. Tentative avec un provider alternatif...`;
    case 'PROVIDER_CONFIG_MISSING':
      return `Configuration manquante pour ${providerName}. Veuillez configurer votre API key.`;
    default:
      return 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
  }
}
