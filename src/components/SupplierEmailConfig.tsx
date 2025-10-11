import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DedicatedEmailConfig } from "./supplier-email-modes/DedicatedEmailConfig";
import { IMAPConfig } from "./supplier-email-modes/IMAPConfig";
import { POP3Config } from "./supplier-email-modes/POP3Config";
import { WebhookConfig } from "./supplier-email-modes/WebhookConfig";

interface SupplierEmailConfigProps {
  supplierId?: string | null;
  config: any;
  onConfigChange: (config: any) => void;
}

export function SupplierEmailConfig({ supplierId, config, onConfigChange }: SupplierEmailConfigProps) {
  const [emailMode, setEmailMode] = useState(config.email_mode || 'dedicated');
  
  const handleModeChange = (mode: string) => {
    setEmailMode(mode);
    onConfigChange({ ...config, email_mode: mode });
  };

  return (
    <div className="space-y-4">
      {/* Sélecteur de mode */}
      <Card>
        <CardHeader>
          <CardTitle>Mode de réception des emails</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Choisissez comment recevoir les emails de ce fournisseur</Label>
            <Select value={emailMode} onValueChange={handleModeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dedicated">
                  📧 Email dédié (Recommandé) - Resend webhook
                </SelectItem>
                <SelectItem value="imap">
                  📥 IMAP - Connexion à boîte mail existante
                </SelectItem>
                <SelectItem value="pop3">
                  📬 POP3 - Récupération périodique
                </SelectItem>
                <SelectItem value="webhook">
                  🔗 Webhook personnalisé - SendGrid, Mailgun, etc.
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Affichage conditionnel selon le mode */}
      {emailMode === 'dedicated' && <DedicatedEmailConfig supplierId={supplierId} />}
      {emailMode === 'imap' && <IMAPConfig config={config} onConfigChange={onConfigChange} />}
      {emailMode === 'pop3' && <POP3Config config={config} onConfigChange={onConfigChange} />}
      {emailMode === 'webhook' && <WebhookConfig supplierId={supplierId} config={config} onConfigChange={onConfigChange} />}
    </div>
  );
}