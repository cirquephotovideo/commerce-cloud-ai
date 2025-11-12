import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMCPContext } from "@/contexts/MCPContext";

interface MCPConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformType: string;
  platformName: string;
}

export function MCPConnectionDialog({
  open,
  onOpenChange,
  platformType,
  platformName,
}: MCPConnectionDialogProps) {
  const { toast } = useToast();
  const { connectPlatform } = useMCPContext();
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Credentials fields based on platform
  const [credentials, setCredentials] = useState<Record<string, string>>({
    url: "",
    api_key: "",
    username: "",
    password: "",
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Validation basique
      if (!credentials.url) {
        throw new Error("L'URL est requise");
      }

      await connectPlatform(platformType, credentials);
      
      toast({
        title: "✅ Plateforme connectée",
        description: `${platformName} a été connectée avec succès`,
      });
      
      onOpenChange(false);
      setCredentials({ url: "", api_key: "", username: "", password: "" });
    } catch (error) {
      console.error("Erreur de connexion:", error);
      toast({
        title: "❌ Erreur de connexion",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connecter {platformName}</DialogTitle>
          <DialogDescription>
            Configurez les paramètres de connexion pour {platformName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="url">URL de l'API *</Label>
            <Input
              id="url"
              placeholder="https://example.com/api"
              value={credentials.url}
              onChange={(e) => setCredentials({ ...credentials, url: e.target.value })}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="api_key">Clé API</Label>
            <Input
              id="api_key"
              type="password"
              placeholder="Votre clé API"
              value={credentials.api_key}
              onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
            />
          </div>
          
          {platformType === 'odoo' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="username">Nom d'utilisateur</Label>
                <Input
                  id="username"
                  placeholder="admin"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />
              </div>
            </>
          )}
          
          <p className="text-xs text-muted-foreground mt-2">
            💡 Les credentials sont chiffrés et stockés de manière sécurisée
          </p>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? "Connexion..." : "Connecter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
