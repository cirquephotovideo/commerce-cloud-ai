import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  referencedProducts?: string[];
}

export interface StoreInfo {
  productCount: number;
  lastSyncAt: string;
  syncStatus: string;
}

export const useProductChatRAG = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const { toast } = useToast();

  const sendMessage = async (question: string) => {
    if (!question.trim()) return;

    setIsLoading(true);

    // Add user message immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const { data, error } = await supabase.functions.invoke('gemini-product-chat', {
        body: { question },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erreur inconnue');
      }

      // Add AI response
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: data.answer,
        referencedProducts: data.referencedProductIds || [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setStoreInfo(data.storeInfo);
    } catch (error) {
      console.error('Error in chat:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de la requête',
        variant: 'destructive',
      });

      // Remove user message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const syncStore = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-product-chat', {
        body: { question: 'Synchronise le store', forceSync: true },
      });

      if (error) throw error;

      toast({
        title: 'Synchronisation réussie',
        description: `${data.storeInfo?.productCount || 0} produits synchronisés`,
      });
      setStoreInfo(data.storeInfo);
    } catch (error) {
      console.error('Error syncing store:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
  };

  return {
    messages,
    isLoading,
    storeInfo,
    sendMessage,
    syncStore,
    clearHistory,
  };
};
