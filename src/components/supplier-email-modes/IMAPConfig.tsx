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
  const [hostWarning, setHostWarning] = useState<string>('');

  // Validation hostname en temps réel
  const handleHostChange = (value: string) => {
    onConfigChange({...config, imap_host: value});
    
    // Vérifier les préfixes non autorisés
    const trimmed = value.trim().toLowerCase();
    if (trimmed.startsWith('imap://') || trimmed.startsWith('imaps://') || 
        trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      setHostWarning('⚠️ Ne pas inclure de préfixe (imap://, https://, etc.)');
    } else if (value.includes('/') || value.includes('\\')) {
      setHostWarning('⚠️ Le hostname ne doit pas contenir de slashes');
    } else {
      setHostWarning('');
    }
  };

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
          host: config.imap_host?.trim(),
          port: parseInt(config.imap_port) || 993,
          email: config.imap_email?.trim(),
          password: config.imap_password,
          ssl: config.imap_ssl !== false,
          folder: config.imap_folder || 'INBOX'
        }
      });

      toast.dismiss(loadingToast);

      if (error) throw error;

      if (data.success) {
        let successMsg = `✅ Connexion réussie! ${data.messageCount} messages dans ${data.selectedFolder}.`;
        if (data.folders?.length > 0) {
          successMsg += ` Dossiers: ${data.folders.slice(0, 5).join(', ')}${data.folders.length > 5 ? '...' : ''}`;
        }
        if (data.warnings?.length > 0) {
          successMsg += `\n\n⚠️ ${data.warnings.join('\n')}`;
        }
        toast.success(successMsg);
      } else {
        // Afficher l'erreur avec hints
        let errorMsg = data.error || "Échec de connexion";
        if (data.hints?.length > 0) {
          errorMsg += '\n\n💡 Conseils:\n' + data.hints.map((h: string) => `• ${h}`).join('\n');
        }
        if (data.statusCode) {
          errorMsg += `\n\n🔍 Détails: HTTP ${data.statusCode}`;
        }
        toast.error(errorMsg, { duration: 8000 });
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
              placeholder="imap.gmail.com (sans préfixe)"
              value={config.imap_host || ''}
              onChange={(e) => handleHostChange(e.target.value)}
              className={hostWarning ? 'border-orange-500' : ''}
            />
            {hostWarning && (
              <p className="text-xs text-orange-600 mt-1">{hostWarning}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Exemple correct: imap.gmail.com
            </p>
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
          <AlertDescription className="space-y-2">
            <p>💡 <strong>Gmail :</strong></p>
            <ul className="text-xs space-y-1 ml-4">
              <li>• Activez IMAP: Paramètres → Voir tous les paramètres → Transfert et POP/IMAP</li>
              <li>• Créez un App Password: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" className="text-primary underline">myaccount.google.com/apppasswords</a></li>
              <li>• N'utilisez PAS votre mot de passe Gmail habituel</li>
            </ul>
            <p className="mt-2">💡 <strong>Outlook :</strong></p>
            <ul className="text-xs space-y-1 ml-4">
              <li>• Créez un App Password sur <a href="https://account.microsoft.com/security" target="_blank" rel="noopener" className="text-primary underline">account.microsoft.com/security</a></li>
              <li>• Serveur: outlook.office365.com, Port: 993</li>
            </ul>
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
