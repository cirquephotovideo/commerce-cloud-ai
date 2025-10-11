import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, CheckCircle, ExternalLink, Copy, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function EmailSetupGuide() {
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${projectUrl}/functions/v1/email-inbox-processor`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié dans le presse-papiers`);
  };

  const handleManualPoll = async () => {
    setIsPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-imap-poller");
      
      if (error) throw error;

      setLastPollTime(new Date());
      toast.success(`✅ Vérification terminée`, {
        description: `${data.stats?.emails_found || 0} email(s) trouvé(s), ${data.stats?.processed || 0} traité(s)`,
      });
    } catch (error: any) {
      toast.error("❌ Erreur lors de la vérification", {
        description: error.message,
      });
    } finally {
      setIsPolling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configuration du service Email
          </CardTitle>
          <CardDescription>
            Recevez automatiquement les tarifs fournisseurs par email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Service recommandé: Resend</strong>
              <br />
              Gratuit jusqu'à 3000 emails/mois · Configuration en 5 minutes
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                Étape 1: Créer un compte Resend
                <Badge variant="outline">Gratuit</Badge>
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Créez un compte sur Resend pour gérer vos emails entrants
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://resend.com/signup', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Créer un compte Resend
              </Button>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Étape 2: Configurer votre domaine</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Dans Resend, allez dans <strong>Settings → Domains</strong> et ajoutez votre domaine
              </p>
              <Alert className="mt-2">
                <AlertDescription className="text-xs">
                  💡 Exemple: <code>inbox.votreentreprise.com</code> ou utilisez un sous-domaine existant
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Étape 3: Configurer le Webhook</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Dans Resend, allez dans <strong>Settings → Webhooks</strong> et configurez :
              </p>
              
              <div className="space-y-3 mt-3 bg-muted/50 p-4 rounded-lg">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Webhook URL</label>
                  <div className="flex gap-2 items-center mt-1">
                    <code className="flex-1 text-xs bg-background px-3 py-2 rounded border">
                      {webhookUrl}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(webhookUrl, 'URL du webhook')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Event Type</label>
                  <div className="flex gap-2 items-center mt-1">
                    <code className="flex-1 text-xs bg-background px-3 py-2 rounded border">
                      email.received
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Étape 4: Envoyer des emails de test</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Demandez à vos fournisseurs d'envoyer leurs tarifs à :
              </p>
              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4 mt-2">
                <code className="text-sm font-mono">
                  tarifs@votredomaine.com
                </code>
              </div>
              <Alert className="mt-3">
                <AlertDescription className="text-xs">
                  📎 Formats supportés: CSV, XLSX, PDF
                  <br />
                  📧 Le système détectera automatiquement le fournisseur et importera les données
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alternative: SendGrid</CardTitle>
          <CardDescription>
            Pour les utilisateurs avancés avec des besoins spécifiques
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>SendGrid Parse API offre plus de flexibilité pour :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Gestion de volumes élevés d'emails</li>
              <li>Règles de filtrage avancées</li>
              <li>Intégration avec systèmes existants</li>
            </ul>
            <Button
              variant="link"
              className="pl-0 h-auto"
              onClick={() => window.open('https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook', '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Documentation SendGrid Parse
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section IMAP/POP3 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configuration IMAP/POP3
          </CardTitle>
          <CardDescription>
            Récupération automatique depuis catalogapp@inplt.net
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <div className="space-y-1">
                <div>✅ Connecté à <strong>catalogapp@inplt.net</strong></div>
                <div className="text-xs text-muted-foreground">
                  Vérification automatique toutes les 5 minutes
                </div>
                {lastPollTime && (
                  <div className="text-xs text-muted-foreground">
                    Dernière vérification : {lastPollTime.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleManualPoll} 
            disabled={isPolling}
            className="w-full"
          >
            {isPolling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vérification en cours...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Vérifier maintenant
              </>
            )}
          </Button>

          <Alert>
            <AlertDescription className="text-xs">
              <strong>Configuration détectée automatiquement :</strong>
              <br />
              • Protocole : IMAP
              <br />
              • Serveur : mail.inplt.net:993 (TLS)
              <br />
              • Polling : Actif
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
