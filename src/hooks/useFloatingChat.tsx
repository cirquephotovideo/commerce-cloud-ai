import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatContext {
  type: 'general' | 'product';
  productId?: string;
  productName?: string;
}

export function useFloatingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<ChatContext>({ type: 'general' });
  const [mcpContext, setMcpContext] = useState<{
    packageId?: string;
    toolName?: string;
  }>({});

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('floatingChatState');
    if (saved) {
      try {
        const { messages: savedMessages, context: savedContext } = JSON.parse(saved);
        if (savedMessages) setMessages(savedMessages);
        if (savedContext) setContext(savedContext);
      } catch (error) {
        console.error('Failed to load chat state:', error);
      }
    }
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('floatingChatState', JSON.stringify({
      messages,
      context
    }));
  }, [messages, context]);

  const sendMessage = async (message: string, productId: string | null = null) => {
    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Detect MCP commands
      let mcpCommand = null;
      if (message.startsWith('/mcp ')) {
        const parts = message.split(' ');
        if (parts.length >= 3) {
          // Format: /mcp <package> <tool> [args]
          mcpCommand = {
            packageId: parts[1],
            toolName: parts[2],
            args: parts.slice(3).join(' ')
          };
        }
      }

      // Handle commands
      if (message.startsWith('/') && !mcpCommand) {
        const parts = message.split(' ');
        let systemResponse = '';
        
        switch (parts[0]) {
          case '/help':
            systemResponse = `Commandes disponibles:
/help - Affiche cette aide
/clear - Efface l'historique
/product [id] - Change de contexte produit
/general - Retour au mode général
/mcp <package> <tool> [args] - Appeler un outil MCP

Vous êtes actuellement en mode ${context.type === 'product' ? `produit: ${context.productName}` : 'général'}.`;
            break;
          default:
            systemResponse = `Commande inconnue: ${parts[0]}. Tapez /help pour voir les commandes disponibles.`;
        }

        const assistantMessage: ChatMessage = {
          role: 'system',
          content: systemResponse,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // Get session and access token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        toast.error("Votre session a expiré. Veuillez vous reconnecter.");
        setIsLoading(false);
        return;
      }

      // If MCP command, call mcp-proxy instead
      if (mcpCommand) {
        const { data, error } = await supabase.functions.invoke('mcp-proxy', {
          body: mcpCommand,
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`
          }
        });

        if (error) throw error;

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: JSON.stringify(data, null, 2),
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // Call edge function with Authorization header
      const { data, error } = await supabase.functions.invoke('product-chat', {
        body: { 
          message,
          productId: productId || context.productId || null,
          mcpContext: mcpContext
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message || "Désolé, je n'ai pas pu générer de réponse.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      
      let errorMessage = "Erreur lors de la communication avec l'IA.";
      
      // More specific error handling
      if (error.message?.includes('401') || error.status === 401) {
        errorMessage = "Votre session a expiré. Veuillez vous reconnecter.";
      } else if (error.message?.includes('404') || error.status === 404) {
        errorMessage = "Produit introuvable.";
      } else if (error.message?.includes('429') || error.status === 429) {
        errorMessage = "Trop de requêtes. Veuillez réessayer dans un instant.";
      } else if (error.message?.includes('402') || error.status === 402) {
        errorMessage = "Crédits insuffisants. Veuillez recharger votre compte.";
      }
      
      toast.error(errorMessage);
      
      // Add error message to chat
      const errorMsg: ChatMessage = {
        role: 'system',
        content: errorMessage,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    toast.success('Historique effacé');
  };

  const switchToProduct = async (productId: string, productName: string) => {
    setContext({ type: 'product', productId, productName });
    
    // Add system message
    const systemMessage: ChatMessage = {
      role: 'system',
      content: `Contexte changé vers le produit: ${productName}`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, systemMessage]);

    // Préchauffer le contexte en arrière-plan (non bloquant)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.functions.invoke('build-product-chat-context', {
          body: { productId },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }).catch(err => console.warn('Context preheating failed:', err));
      }
    } catch (err) {
      console.warn('Context preheating skipped:', err);
    }
  };

  const switchToGeneral = () => {
    setContext({ type: 'general' });
    
    // Add system message
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'Contexte changé vers le mode général',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const getSuggestions = (): string[] => {
    if (context.type === 'product') {
      return [
        "Quel est le meilleur prix de vente ?",
        "Compare avec la concurrence",
        "Quel fournisseur choisir ?",
        "Améliore la description"
      ];
    } else {
      return [
        "📊 Analyse mes produits les plus rentables",
        "🔍 Trouve les produits sans fournisseur",
        "💰 Quels produits augmenter en prix ?",
        "📦 Résume mes stocks faibles"
      ];
    }
  };

  const setMCPContextForChat = (packageId: string, toolName: string) => {
    setMcpContext({ packageId, toolName });
  };

  return {
    messages,
    isLoading,
    context,
    sendMessage,
    clearHistory,
    switchToProduct,
    switchToGeneral,
    getSuggestions,
    setMCPContextForChat
  };
}
