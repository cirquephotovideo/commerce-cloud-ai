import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AIProvider = 'lovable' | 'ollama';

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

        const { data, error } = await supabase
          .from("user_ai_preferences")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setProvider(data.preferred_provider as AIProvider);
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

      const { error } = await supabase
        .from("user_ai_preferences")
        .upsert({
          user_id: session.user.id,
          preferred_provider: newProvider,
          fallback_enabled: fallbackEnabled,
        });

      if (error) throw error;

      setProvider(newProvider);
      toast.success(`Provider IA changé vers ${newProvider === 'lovable' ? 'Lovable AI' : 'Ollama Cloud'}`);
    } catch (error) {
      console.error("Error updating AI provider:", error);
      toast.error("Erreur lors du changement de provider");
    }
  };

  const updateFallback = async (enabled: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from("user_ai_preferences")
        .upsert({
          user_id: session.user.id,
          preferred_provider: provider,
          fallback_enabled: enabled,
        });

      if (error) throw error;

      setFallbackEnabled(enabled);
      toast.success(`Fallback ${enabled ? 'activé' : 'désactivé'}`);
    } catch (error) {
      console.error("Error updating fallback:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  return {
    provider,
    fallbackEnabled,
    isLoading,
    updateProvider,
    updateFallback,
  };
};