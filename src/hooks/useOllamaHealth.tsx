import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OllamaHealth {
  provider: 'ollama_cloud' | 'ollama_local';
  status: 'online' | 'offline' | 'degraded';
  response_time_ms: number | null;
  available_models: string[];
  last_check: string;
}

export const useOllamaHealth = () => {
  return useQuery({
    queryKey: ['ollama-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_provider_health')
        .select('*')
        .eq('provider', 'ollama');

      if (error) throw error;

      // Transformer le résultat unique en tableau avec les deux modes (cloud/local)
      if (!data || data.length === 0) {
        return [] as OllamaHealth[];
      }

      const ollamaData = data[0];
      
      // Safe type guard for error_details
      const errorDetails = ollamaData.error_details as Record<string, any> | null;
      const mode = (errorDetails && typeof errorDetails === 'object' && 'mode' in errorDetails) 
        ? String(errorDetails.mode) 
        : 'local';

      // Créer deux entrées virtuelles pour la compatibilité UI
      return [
        {
          provider: 'ollama_cloud',
          status: mode === 'cloud' ? ollamaData.status : 'offline',
          response_time_ms: mode === 'cloud' ? ollamaData.response_time_ms : null,
          available_models: mode === 'cloud' ? ollamaData.available_models : [],
          last_check: ollamaData.last_check
        },
        {
          provider: 'ollama_local',
          status: mode === 'local' ? ollamaData.status : 'offline',
          response_time_ms: mode === 'local' ? ollamaData.response_time_ms : null,
          available_models: mode === 'local' ? ollamaData.available_models : [],
          last_check: ollamaData.last_check
        }
      ] as OllamaHealth[];
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });
};
