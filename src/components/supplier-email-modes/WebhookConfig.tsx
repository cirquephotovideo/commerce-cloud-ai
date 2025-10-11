import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface WebhookConfigProps {
  supplierId?: string | null;
  config: any;
  onConfigChange: (config: any) => void;
}

export function WebhookConfig({ supplierId, config, onConfigChange }: WebhookConfigProps) {
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (supplierId) {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-inbox-processor?source=webhook&supplier_id=${supplierId}`;
      setWebhookUrl(url);
    } else {
      setWebhookUrl('[URL générée après création du fournisseur]');
    }
  }, [supplierId]);

  const copyUrl = () => {
    if (supplierId) {
      navigator.clipboard.writeText(webhookUrl);
      toast.success("URL copiée");
    } else {
      toast.error("Créez d'abord le fournisseur");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔗 Configuration Webhook personnalisé</CardTitle>
        <CardDescription>
          Pour SendGrid, Mailgun, Postmark, etc.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Service email</Label>
          <Select 
            value={config.webhook_provider || 'sendgrid'}
            onValueChange={(val) => onConfigChange({...config, webhook_provider: val})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sendgrid">SendGrid Inbound Parse</SelectItem>
              <SelectItem value="mailgun">Mailgun Routes</SelectItem>
              <SelectItem value="postmark">Postmark Inbound</SelectItem>
              <SelectItem value="custom">Autre / Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>URL du webhook (à configurer chez votre fournisseur)</Label>
          <div className="flex gap-2">
            <Input 
              value={webhookUrl} 
              disabled 
              className="font-mono text-sm" 
            />
            <Button 
              size="sm" 
              variant="outline" 
              onClick={copyUrl}
              disabled={!supplierId}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Alert>
          <AlertDescription>
            💡 Configurez cette URL dans votre service email pour recevoir les webhooks entrants.
          </AlertDescription>
        </Alert>

        {config.webhook_provider === 'sendgrid' && (
          <Alert>
            <AlertDescription>
              <strong>SendGrid :</strong> Allez dans Settings → Inbound Parse → Add Host & URL. 
              Utilisez un sous-domaine (ex: mail.votredomaine.com) et collez l'URL ci-dessus.
            </AlertDescription>
          </Alert>
        )}

        {config.webhook_provider === 'mailgun' && (
          <Alert>
            <AlertDescription>
              <strong>Mailgun :</strong> Allez dans Receiving → Routes → Create Route. 
              Choisissez "Match Recipient" avec l'email du fournisseur et "Forward to URL" avec l'URL ci-dessus.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
