import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MCPChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  provider?: string;
}

export const useMCPChat = (selectedPlatforms: string[]) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<MCPChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Ajouter le message utilisateur
    const userMessage: MCPChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      console.log('[useMCPChat] Sending message with platforms:', selectedPlatforms);
      
      // Appeler l'edge function ai-chat avec le contexte MCP
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: content,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          mcpContext: selectedPlatforms // Array de platform types
        }
      });

      if (error) {
        console.error('[useMCPChat] Error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.message || 'Erreur lors de la communication avec l\'IA');
      }

      // Ajouter la réponse de l'assistant
      const assistantMessage: MCPChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
        provider: data.provider
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Afficher un toast si des outils MCP ont été utilisés
      if (data.toolsUsed && data.toolsUsed.length > 0) {
        toast({
          title: "🔌 Outils MCP utilisés",
          description: data.toolsUsed.join(', '),
        });
      }

    } catch (error) {
      console.error('[useMCPChat] Error:', error);
      toast({
        title: "❌ Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
      
      // Retirer le message utilisateur en cas d'erreur
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages
  };
};
