import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AIProvider = 'lovable' | 'claude' | 'openai' | 'openrouter' | 'ollama_cloud' | 'ollama_local';

export interface ProviderConfig {
  provider: AIProvider;
  priority: number;
  isActive: boolean;
  hasApiKey: boolean;
  status: 'online' | 'offline' | 'degraded';
}

export const useAIProvider = () => {
  const [provider, setProvider] = useState<AIProvider>('lovable');
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setIsLoading(false);
          return;
        }

      // Fetch from user_provider_preferences
      const { data, error } = await supabase
        .from("user_provider_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching provider preferences:", error);
        throw error;
      }

      if (data) {
        setProvider(data.primary_provider as AIProvider);
        setFallbackEnabled(data.fallback_enabled);
      }
      } catch (error) {
        console.error("Error fetching AI preferences:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const updateProvider = async (newProvider: AIProvider) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Vérifier si un enregistrement existe
      const { data: existing } = await supabase
        .from("user_provider_preferences")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      // UPDATE ou INSERT selon l'existence
      let result;
      if (existing) {
        result = await supabase
          .from("user_provider_preferences")
          .update({
            primary_provider: newProvider,
            fallback_enabled: fallbackEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", session.user.id);
      } else {
        result = await supabase
          .from("user_provider_preferences")
          .insert({
            user_id: session.user.id,
            primary_provider: newProvider,
            fallback_enabled: fallbackEnabled,
          });
      }

      if (result.error) throw result.error;

      setProvider(newProvider);
      
      const providerNames: Record<AIProvider, string> = {
        'lovable': 'Lovable AI',
        'claude': 'Claude',
        'openai': 'OpenAI',
        'openrouter': 'OpenRouter',
        'ollama_cloud': 'Ollama Cloud',
        'ollama_local': 'Ollama Local',
      };
      
      toast.success(`Provider IA changé vers ${providerNames[newProvider]}`);
    } catch (error) {
      console.error("Error updating AI provider:", error);
      toast.error("Erreur lors du changement de provider");
    }
  };

  const updateFallback = async (enabled: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Vérifier si un enregistrement existe
      const { data: existing } = await supabase
        .from("user_provider_preferences")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      // UPDATE ou INSERT selon l'existence
      let result;
      if (existing) {
        result = await supabase
          .from("user_provider_preferences")
          .update({
            primary_provider: provider,
            fallback_enabled: enabled,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", session.user.id);
      } else {
        result = await supabase
          .from("user_provider_preferences")
          .insert({
            user_id: session.user.id,
            primary_provider: provider,
            fallback_enabled: enabled,
          });
      }

      if (result.error) throw result.error;

      setFallbackEnabled(enabled);
      toast.success(`Fallback ${enabled ? 'activé' : 'désactivé'}`);
    } catch (error) {
      console.error("Error updating fallback:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const refreshConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('user_provider_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error refreshing config:", error);
        return;
      }

      if (data) {
        setProvider(data.primary_provider as AIProvider);
        setFallbackEnabled(data.fallback_enabled);
      }
    } catch (error) {
      console.error("Error in refreshConfig:", error);
    }
  };

  return {
    provider,
    fallbackEnabled,
    isLoading,
    updateProvider,
    updateFallback,
    refreshConfig,
  };
};