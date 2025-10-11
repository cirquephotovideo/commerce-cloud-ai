import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface POP3ConfigProps {
  config: any;
  onConfigChange: (config: any) => void;
}

export function POP3Config({ config, onConfigChange }: POP3ConfigProps) {
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    if (!config.pop3_host || !config.pop3_email || !config.pop3_password) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setTesting(true);
    const loadingToast = toast.loading("Test de connexion POP3 en cours...");

    try {
      const { data, error } = await supabase.functions.invoke('test-pop3-connection', {
        body: {
          host: config.pop3_host,
          port: parseInt(config.pop3_port) || 995,
          email: config.pop3_email,
          password: config.pop3_password,
          ssl: config.pop3_ssl !== false
        }
      });

      toast.dismiss(loadingToast);

      if (error) throw error;

      if (data.success) {
        toast.success(
          `✅ Connexion réussie! ${data.messageCount} messages (${Math.round(data.totalBytes / 1024)} KB)`
        );
      } else {
        toast.error(data.error || "Échec de connexion");
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('POP3 test error:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>📬 Configuration POP3</CardTitle>
        <CardDescription>
          Récupération périodique des emails (supprime les emails du serveur)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            ⚠️ <strong>Attention :</strong> POP3 supprime les emails du serveur après téléchargement. 
            Préférez IMAP pour conserver une copie sur le serveur.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Serveur POP3</Label>
            <Input 
              placeholder="pop.gmail.com"
              value={config.pop3_host || ''}
              onChange={(e) => onConfigChange({...config, pop3_host: e.target.value})}
            />
          </div>
          <div>
            <Label>Port</Label>
            <Input 
              type="number"
              placeholder="995"
              value={config.pop3_port || 995}
              onChange={(e) => onConfigChange({...config, pop3_port: e.target.value})}
            />
          </div>
        </div>

        <div>
          <Label>Email</Label>
          <Input 
            type="email"
            value={config.pop3_email || ''}
            onChange={(e) => onConfigChange({...config, pop3_email: e.target.value})}
          />
        </div>

        <div>
          <Label>Mot de passe</Label>
          <Input 
            type="password"
            value={config.pop3_password || ''}
            onChange={(e) => onConfigChange({...config, pop3_password: e.target.value})}
          />
        </div>

        <div>
          <Label>Fréquence de récupération</Label>
          <Select 
            value={config.pop3_frequency || 'hourly'}
            onValueChange={(val) => onConfigChange({...config, pop3_frequency: val})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15min">Toutes les 15 minutes</SelectItem>
              <SelectItem value="30min">Toutes les 30 minutes</SelectItem>
              <SelectItem value="hourly">Toutes les heures</SelectItem>
              <SelectItem value="daily">Une fois par jour</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          onClick={handleTestConnection}
          disabled={testing || !config.pop3_host || !config.pop3_email || !config.pop3_password}
        >
          {testing ? '⏳ Test en cours...' : '🔌 Tester la connexion'}
        </Button>
      </CardContent>
    </Card>
  );
}
