import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface POP3ConfigProps {
  config: any;
  onConfigChange: (config: any) => void;
}

export function POP3Config({ config, onConfigChange }: POP3ConfigProps) {
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
      </CardContent>
    </Card>
  );
}
