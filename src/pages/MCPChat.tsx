import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Plug, Sparkles } from "lucide-react";
import { useMCPContext } from "@/contexts/MCPContext";
import { useToast } from "@/hooks/use-toast";

interface MCPMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const MCPChat = () => {
  const { toast } = useToast();
  const { mcpPackages, getMCPSuggestions } = useMCPContext();
  const [messages, setMessages] = useState<MCPMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const activePlatforms = mcpPackages.filter(pkg => pkg.isConfigured);
  const suggestions = getMCPSuggestions();

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const sendMessage = async (question: string) => {
    if (!question.trim()) return;

    if (selectedPlatforms.length === 0 && activePlatforms.length > 0) {
      toast({
        title: "⚠️ Aucune plateforme sélectionnée",
        description: "Veuillez sélectionner au moins une plateforme MCP",
        variant: "destructive",
      });
      return;
    }

    const userMessage: MCPMessage = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Simuler une réponse pour Phase 1
      // Dans Phase 3, on appellera l'edge function ai-chat avec mcpContext
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const assistantMessage: MCPMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `🔌 Réponse MCP simulée pour la question : "${question}"\n\nLes plateformes sélectionnées sont : ${selectedPlatforms.map(id => mcpPackages.find(p => p.id === id)?.name).join(", ") || "aucune"}.\n\n⚠️ L'intégration complète avec les plateformes MCP sera disponible en Phase 3.`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: "❌ Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8 text-primary" />
          MCP Chat
        </h1>
        <p className="text-muted-foreground mt-1">
          Interrogez vos plateformes connectées en langage naturel
        </p>
      </div>

      {/* Sélection des plateformes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Plateformes actives
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activePlatforms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune plateforme MCP configurée. 
              <a href="/mcp-dashboard" className="text-primary hover:underline ml-1">
                Configurez-en une maintenant
              </a>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activePlatforms.map(pkg => (
                <Badge
                  key={pkg.id}
                  variant={selectedPlatforms.includes(pkg.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => togglePlatform(pkg.id)}
                >
                  {pkg.icon} {pkg.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zone de messages */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 gap-4">
          <ScrollArea className="flex-1 pr-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Posez une question sur vos plateformes connectées
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {msg.timestamp.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Suggestions */}
          {messages.length === 0 && suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Suggestions :</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 4).map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isLoading}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Posez une question sur vos plateformes MCP..."
              className="min-h-[60px] resize-none"
              disabled={isLoading || activePlatforms.length === 0}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim() || activePlatforms.length === 0}
              size="icon"
              className="h-[60px] w-[60px] shrink-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MCPChat;
