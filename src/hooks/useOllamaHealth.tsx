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
        .in('provider', ['ollama_cloud', 'ollama_local']);

      if (error) throw error;

      return data as OllamaHealth[];
    },
    refetchInterval: 30000, // Poll toutes les 30 secondes
    staleTime: 20000, // Considérer les données comme fraîches pendant 20 secondes
  });
};
