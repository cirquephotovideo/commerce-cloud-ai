import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface IMAPConfigProps {
  config: any;
  onConfigChange: (config: any) => void;
}

export function IMAPConfig({ config, onConfigChange }: IMAPConfigProps) {
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

        <Button type="button" variant="outline" disabled>
          🔌 Tester la connexion (bientôt disponible)
        </Button>
      </CardContent>
    </Card>
  );
}
