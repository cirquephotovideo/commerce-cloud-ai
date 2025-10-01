import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, Send, Globe, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatSection = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const saveConversation = async () => {
    if (!user || messages.length === 0) {
      toast.error("Connectez-vous pour sauvegarder vos conversations");
      return;
    }

    try {
      let conversationId = currentConversationId;

      if (!conversationId) {
        const firstMessage = messages[0]?.content || "Nouvelle conversation";
        const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "");

        const { data: convData, error: convError } = await supabase
          .from("conversations")
          .insert({
            user_id: user.id,
            title,
          })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = convData.id;
        setCurrentConversationId(conversationId);
      }

      for (const message of messages) {
        const { error: msgError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            role: message.role,
            content: message.content,
          });

        if (msgError) throw msgError;
      }

      toast.success("Conversation sauvegardée avec succès");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { message: userMessage, messages }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);

      // Auto-save if user is logged in
      if (user) {
        setTimeout(() => {
          saveConversation();
        }, 1000);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error("Erreur lors de la communication avec l'IA");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="chat" className="py-12 sm:py-16 md:py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-8 sm:mb-12 space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 border border-primary/20">
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">Chat IA Intelligent</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-4">
            Analyse de Produits avec Recherche Web
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Posez des questions sur n'importe quel produit et obtenez des analyses détaillées 
            avec des informations à jour provenant d'Internet.
          </p>
        </div>

        <Card className="bg-card border-border backdrop-blur-sm shadow-card overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b border-border bg-gradient-card gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-secondary flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium">Recherche web temps réel activée</span>
            </div>
            {user && messages.length > 0 && (
              <Button onClick={saveConversation} variant="outline" size="sm">
                <Save className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Sauvegarder</span>
              </Button>
            )}
          </div>

          <ScrollArea className="h-[400px] sm:h-[500px] md:h-[600px] p-4 sm:p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
                <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/30" />
                <div className="space-y-2">
                  <p className="text-base sm:text-lg font-medium">Commencez une conversation</p>
                  <p className="text-sm text-muted-foreground">
                    Posez une question sur un produit pour obtenir une analyse complète
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base ${
                        message.role === 'user'
                          ? 'bg-gradient-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2 text-sm sm:text-base">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyse en cours...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 sm:p-4 border-t border-border bg-gradient-card">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Posez une question..."
                disabled={isLoading}
                className="bg-background border-border text-sm sm:text-base"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !input.trim()}
                className="shadow-glow flex-shrink-0"
                size="default"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};
