import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const handleModeChange = (mode: string) => {
    setEmailMode(mode);
    onConfigChange({ ...config, email_mode: mode });
  };

  const handleEncryptPassword = async () => {
    if (!supplierId) {
      toast({
        title: "Erreur",
        description: "ID du fournisseur manquant",
        variant: "destructive",
      });
      return;
    }

    setIsEncrypting(true);
    try {
      const { error } = await supabase.rpc('encrypt_supplier_password', {
        p_supplier_id: supplierId
      });
      
      if (error) throw error;
      
      toast({
        title: "✅ Succès",
        description: "Mot de passe chiffré avec succès",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleTestPoller = async () => {
    if (!supplierId) {
      toast({
        title: "Erreur",
        description: "ID du fournisseur manquant",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-imap-poller', {
        body: { 
          supplierId,
          sinceDays: 7 // Test sur 7 jours
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "✅ Test terminé",
        description: `${data.emails_processed || 0} email(s) trouvé(s) et traité(s)`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur de test",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
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

      {/* Boutons de chiffrement et test manuel */}
      {(emailMode === 'imap' || emailMode === 'pop3') && supplierId && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestPoller}
            disabled={isTesting}
          >
            <TestTube className="h-4 w-4 mr-2" />
            {isTesting ? "Test en cours..." : "🧪 Tester maintenant (7 jours)"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEncryptPassword}
            disabled={isEncrypting}
          >
            <Lock className="h-4 w-4 mr-2" />
            {isEncrypting ? "Chiffrement..." : "🔒 Chiffrer le mot de passe"}
          </Button>
        </div>
      )}

      {/* Affichage conditionnel selon le mode */}
      {emailMode === 'dedicated' && <DedicatedEmailConfig supplierId={supplierId} />}
      {emailMode === 'imap' && <IMAPConfig config={config} onConfigChange={onConfigChange} />}
      {emailMode === 'pop3' && <POP3Config config={config} onConfigChange={onConfigChange} />}
      {emailMode === 'webhook' && <WebhookConfig supplierId={supplierId} config={config} onConfigChange={onConfigChange} />}
    </div>
  );
}