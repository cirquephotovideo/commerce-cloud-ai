import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UseProductChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (productId: string | null, message: string) => Promise<void>;
  clearHistory: () => void;
}

export function useProductChat(productId?: string): UseProductChatReturn {
  const storageKey = productId ? `chat-${productId}` : 'chat-general';
  
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    }
    return [];
  });
  
  const [isLoading, setIsLoading] = useState(false);

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (error) {
      console.error('Erreur sauvegarde historique:', error);
    }
  }, [messages, storageKey]);

  const sendMessage = useCallback(async (targetProductId: string | null, userMessage: string) => {
    if (!userMessage.trim()) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('product-chat', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          message: userMessage.trim(),
          productId: targetProductId
        }
      });

      if (error) {
        console.error('Erreur product-chat:', error);
        
        // Si c'est une erreur structurée du serveur (success:false)
        if (data?.success === false) {
          const errorMsg = data.code === 'RATE_LIMIT'
            ? '⏱️ Trop de requêtes. Attendez quelques instants.'
            : data.code === 'PAYMENT_REQUIRED'
            ? '💳 Crédits insuffisants. Rechargez votre compte.'
            : data.code === 'PROVIDER_DOWN'
            ? '🔌 Tous les providers IA sont indisponibles. Réessayez plus tard.'
            : 'Erreur lors de l\'envoi du message';
          
          toast.error(errorMsg);
          console.log('Provider utilisé:', data.provider);
        } 
        // Sinon, erreur générique
        else {
          toast.error('Erreur lors de l\'envoi du message');
        }
        
        setMessages(prev => prev.slice(0, -1));
        setIsLoading(false);
        return;
      }

      // Vérifier si c'est un payload d'erreur structuré (200 + success:false)
      if (data?.success === false) {
        const errorMsg = data.code === 'RATE_LIMIT'
          ? '⏱️ Trop de requêtes. Attendez quelques instants.'
          : data.code === 'PAYMENT_REQUIRED'
          ? '💳 Crédits insuffisants. Rechargez votre compte.'
          : data.code === 'PROVIDER_DOWN'
          ? '🔌 Tous les providers IA sont indisponibles. Réessayez plus tard.'
          : 'Erreur lors de l\'envoi du message';
        
        toast.error(errorMsg);
        console.log('Provider utilisé:', data.provider);
        setMessages(prev => prev.slice(0, -1));
        setIsLoading(false);
        return;
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      // Log du provider utilisé pour debug
      if (data.provider) {
        console.log('✅ Réponse reçue depuis provider:', data.provider);
      }
    } catch (error) {
      console.error('Erreur sendMessage:', error);
      toast.error('Erreur de connexion');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
      toast.success('Historique effacé');
    } catch (error) {
      console.error('Erreur clear:', error);
    }
  }, [storageKey]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory
  };
}
