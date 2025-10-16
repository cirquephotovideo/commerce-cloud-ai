import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FallbackState {
  currentProvider: string | null;
  attempts: Array<{ provider: string; error: string }>;
  isLoading: boolean;
}

/**
 * Hook pour gérer les fallbacks automatiques entre providers IA
 * Usage: const { callWithFallback } = useAIProviderFallback();
 */
export function useAIProviderFallback() {
  const [fallbackState, setFallbackState] = useState<FallbackState>({
    currentProvider: null,
    attempts: [],
    isLoading: false
  });

  const callWithFallback = async (
    functionName: string,
    body: any,
    options: { silent?: boolean; maxRetries?: number } = {}
  ) => {
    const providers = ['lovable_ai', 'openai', 'openrouter', 'ollama'];
    const maxRetries = options.maxRetries || providers.length;
    
    setFallbackState(prev => ({ ...prev, isLoading: true, attempts: [] }));

    for (let i = 0; i < maxRetries && i < providers.length; i++) {
      const provider = providers[i];
      setFallbackState(prev => ({ ...prev, currentProvider: provider }));

      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { ...body, preferredProvider: provider }
        });

        if (error) {
          const shouldFallback = 
            error.status === 402 || 
            error.status === 429 || 
            error.status === 503;

          setFallbackState(prev => ({
            ...prev,
            attempts: [...prev.attempts, { provider, error: error.message }]
          }));

          if (shouldFallback && i < providers.length - 1) {
            if (!options.silent) {
              toast.info(`${provider} indisponible, bascule sur ${providers[i + 1]}...`);
            }
            continue;
          }

          throw error;
        }

        // Success!
        setFallbackState(prev => ({ ...prev, isLoading: false }));
        return { data, provider };

      } catch (err) {
        if (i === maxRetries - 1 || i === providers.length - 1) {
          setFallbackState(prev => ({ ...prev, isLoading: false }));
          throw err;
        }
      }
    }

    setFallbackState(prev => ({ ...prev, isLoading: false }));
    throw new Error('All AI providers failed');
  };

  return {
    callWithFallback,
    fallbackState
  };
}
