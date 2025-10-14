import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Minimize2, Send, Sparkles, Loader2, Bot, User } from "lucide-react";
import { useFloatingChat } from "@/hooks/useFloatingChat";
import { useMCPContext } from "@/hooks/useMCPContext";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';

interface FloatingChatWidgetProps {
  analyses?: any[];
  onProductSelect?: (productId: string) => void;
}

export function FloatingChatWidget({ analyses = [], onProductSelect }: FloatingChatWidgetProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    isLoading,
    context,
    sendMessage,
    clearHistory,
    switchToProduct,
    switchToGeneral,
    getSuggestions
  } = useFloatingChat();

  const { mcpPackages, getMCPSuggestions } = useMCPContext();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage.trim();
    setInputMessage("");

    // Handle commands
    if (message.startsWith('/')) {
      const parts = message.split(' ');
      switch (parts[0]) {
        case '/help':
          // Will be handled by hook
          break;
        case '/clear':
          clearHistory();
          return;
        case '/product':
          if (parts[1]) {
            const product = analyses.find(a => a.id === parts[1]);
            if (product) {
              switchToProduct(parts[1], product.product_name || product.name);
              return;
            }
          }
          break;
        case '/general':
          switchToGeneral();
          return;
      }
    }

    await sendMessage(message, context.type === 'product' ? context.productId : null);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  const baseSuggestions = getSuggestions();
  const mcpSuggestions = getMCPSuggestions();
  const suggestions = [...baseSuggestions, ...mcpSuggestions];

  return (
    <>
      {/* Floating Button */}
      {!isChatOpen && (
        <Button
          className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-xl z-50 
                     bg-gradient-to-r from-blue-500 to-purple-600 
                     hover:scale-110 transition-all"
          onClick={() => setIsChatOpen(true)}
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      )}

      {/* Chat Window */}
      {isChatOpen && (
        <Card className="fixed bottom-4 right-4 w-[380px] h-[600px] shadow-2xl z-50
                         max-sm:inset-4 max-sm:w-auto max-sm:h-auto max-sm:bottom-0 max-sm:right-0
                         flex flex-col animate-in slide-in-from-bottom-4">
          <CardHeader className="border-b py-3 px-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {context.type === 'product' ? (
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[200px]">{context.productName}</span>
                      <Badge variant="outline" className="text-xs">Produit</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Assistant IA</span>
                      <Badge variant="outline" className="text-xs">Général</Badge>
                    </div>
                  )}
                </CardTitle>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setIsChatOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* MCP Packages Badge */}
            {mcpPackages.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Outils MCP:</span>
                {mcpPackages.map(pkg => (
                  <Badge 
                    key={pkg.id} 
                    variant="secondary" 
                    className="text-xs"
                  >
                    {pkg.icon} {pkg.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          
          {/* Messages */}
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full px-4 py-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8 space-y-3">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {context.type === 'product' 
                          ? 'Posez-moi des questions sur ce produit !' 
                          : 'Comment puis-je vous aider ?'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tapez /help pour voir les commandes disponibles
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3",
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2 max-w-[80%]",
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-img:rounded-lg prose-img:border prose-img:my-2 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                          <ReactMarkdown
                            components={{
                              img: ({ node, ...props }) => (
                                <img 
                                  {...props} 
                                  className="max-w-full rounded-lg my-2 border" 
                                  alt={props.alt || 'Image produit'} 
                                  loading="lazy"
                                />
                              ),
                              a: ({ node, ...props }) => (
                                <a 
                                  {...props} 
                                  className="text-primary underline hover:text-primary/80 transition-colors" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                />
                              ),
                              p: ({ node, ...props }) => (
                                <p {...props} className="mb-2 last:mb-0" />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul {...props} className="list-disc list-inside space-y-1" />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol {...props} className="list-decimal list-inside space-y-1" />
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">L'IA réfléchit...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          {/* Suggestions */}
          {!isLoading && messages.length === 0 && suggestions.length > 0 && (
            <div className="px-4 pb-2 shrink-0">
              <p className="text-xs text-muted-foreground mb-2">Suggestions :</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Input Footer */}
          <CardFooter className="border-t p-3 shrink-0">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2 w-full"
            >
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={context.type === 'product' 
                  ? "Posez une question sur ce produit..." 
                  : "Posez une question..."}
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={!inputMessage.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
