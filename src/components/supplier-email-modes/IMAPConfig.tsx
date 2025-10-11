import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IMAPConfigProps {
  config: any;
  onConfigChange: (config: any) => void;
}

export function IMAPConfig({ config, onConfigChange }: IMAPConfigProps) {
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    if (!config.imap_host || !config.imap_email || !config.imap_password) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setTesting(true);
    const loadingToast = toast.loading("Test de connexion IMAP en cours...");

    try {
      const { data, error } = await supabase.functions.invoke('test-imap-connection', {
        body: {
          host: config.imap_host,
          port: parseInt(config.imap_port) || 993,
          email: config.imap_email,
          password: config.imap_password,
          ssl: config.imap_ssl !== false,
          folder: config.imap_folder || 'INBOX'
        }
      });

      toast.dismiss(loadingToast);

      if (error) throw error;

      if (data.success) {
        toast.success(
          `✅ Connexion réussie! ${data.messageCount} messages dans ${data.selectedFolder}. Dossiers trouvés: ${data.folders.slice(0, 5).join(', ')}${data.folders.length > 5 ? '...' : ''}`
        );
      } else {
        toast.error(data.error || "Échec de connexion");
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('IMAP test error:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>📥 Configuration IMAP</CardTitle>
        <CardDescription>
          Connexion à une boîte mail existante (Gmail, Outlook, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Serveur IMAP</Label>
            <Input 
              placeholder="imap.gmail.com"
              value={config.imap_host || ''}
              onChange={(e) => onConfigChange({...config, imap_host: e.target.value})}
            />
          </div>
          <div>
            <Label>Port</Label>
            <Input 
              type="number"
              placeholder="993"
              value={config.imap_port || 993}
              onChange={(e) => onConfigChange({...config, imap_port: e.target.value})}
            />
          </div>
        </div>

        <div>
          <Label>Email</Label>
          <Input 
            type="email"
            placeholder="votre-email@gmail.com"
            value={config.imap_email || ''}
            onChange={(e) => onConfigChange({...config, imap_email: e.target.value})}
          />
        </div>

        <div>
          <Label>Mot de passe / App Password</Label>
          <Input 
            type="password"
            value={config.imap_password || ''}
            onChange={(e) => onConfigChange({...config, imap_password: e.target.value})}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch 
            checked={config.imap_ssl !== false}
            onCheckedChange={(val) => onConfigChange({...config, imap_ssl: val})}
          />
          <Label>Utiliser SSL/TLS</Label>
        </div>

        <div>
          <Label>Dossier à surveiller</Label>
          <Input 
            placeholder="INBOX"
            value={config.imap_folder || 'INBOX'}
            onChange={(e) => onConfigChange({...config, imap_folder: e.target.value})}
          />
        </div>

        <Alert>
          <AlertDescription>
            💡 <strong>Gmail :</strong> Activez l'accès IMAP et créez un "App Password" dans les paramètres de sécurité.
          </AlertDescription>
        </Alert>

        <Button 
          type="button" 
          variant="outline" 
          onClick={handleTestConnection}
          disabled={testing || !config.imap_host || !config.imap_email || !config.imap_password}
        >
          {testing ? '⏳ Test en cours...' : '🔌 Tester la connexion'}
        </Button>
      </CardContent>
    </Card>
  );
}
