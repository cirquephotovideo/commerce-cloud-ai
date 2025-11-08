import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, Terminal, Server, CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const MCPInstallationGuide = () => {
  return (
    <div className="space-y-4">
      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertDescription>
          Un serveur MCP vous permet d'utiliser des modèles IA personnalisés hébergés localement ou sur votre infrastructure.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Option 1 : Ollama (Recommandé)</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Ollama est la solution la plus simple pour exécuter des modèles locaux.
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
              <div className="flex items-start gap-2">
                <Terminal className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-1 flex-1">
                  <p className="text-muted-foreground"># Installation (macOS/Linux)</p>
                  <p>curl -fsSL https://ollama.com/install.sh | sh</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <Terminal className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-1 flex-1">
                  <p className="text-muted-foreground"># Démarrer le serveur</p>
                  <p>ollama serve</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <Terminal className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-1 flex-1">
                  <p className="text-muted-foreground"># Télécharger un modèle</p>
                  <p>ollama pull llama2</p>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <p className="text-muted-foreground">
                URL à utiliser : <code className="bg-muted px-1 py-0.5 rounded">http://localhost:11434</code>
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Option 2 : LocalAI</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Alternative avec support de plus de modèles et API compatible OpenAI.
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
              <div className="flex items-start gap-2">
                <Terminal className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="space-y-1 flex-1">
                  <p className="text-muted-foreground"># Docker</p>
                  <p>docker run -p 8080:8080 localai/localai:latest</p>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <p className="text-muted-foreground">
                URL à utiliser : <code className="bg-muted px-1 py-0.5 rounded">http://localhost:8080</code>
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Option 3 : LM Studio</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Interface graphique pour gérer et exécuter des modèles locaux.
            </p>
            <div className="space-y-2">
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Téléchargez LM Studio depuis lmstudio.ai</li>
                <li>Installez et lancez l'application</li>
                <li>Téléchargez un modèle depuis l'onglet "Discover"</li>
                <li>Démarrez le serveur local depuis l'onglet "Local Server"</li>
              </ol>
              <div className="flex items-start gap-2 text-sm mt-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <p className="text-muted-foreground">
                  URL par défaut : <code className="bg-muted px-1 py-0.5 rounded">http://localhost:1234</code>
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-semibold text-sm">🔒 Sécurité et réseau</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Pour un serveur local : utilisez <code className="bg-muted px-1 py-0.5 rounded">http://localhost:PORT</code></li>
              <li>Pour un serveur sur le réseau : utilisez l'IP locale (ex: <code className="bg-muted px-1 py-0.5 rounded">http://192.168.1.100:8080</code>)</li>
              <li>Assurez-vous que le port est accessible depuis votre navigateur</li>
              <li>Pour un accès externe sécurisé, configurez HTTPS et une clé API</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
