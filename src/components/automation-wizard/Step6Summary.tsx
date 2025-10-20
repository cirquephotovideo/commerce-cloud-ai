import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Sparkles } from 'lucide-react';

interface Step6SummaryProps {
  selectedType: string;
  sourceConfig: any;
  triggerConfig: any;
  actionsConfig: any;
  errorConfig: any;
  ruleName: string;
  ruleDescription: string;
  onRuleNameChange: (name: string) => void;
  onRuleDescriptionChange: (description: string) => void;
}

const categoryIcons: Record<string, string> = {
  import: '📥',
  cleanup: '🧹',
  enrichment: '🚀',
  export: '📤',
  sync: '🔄',
  linking: '🔗',
};

const categoryLabels: Record<string, string> = {
  import: 'Import automatique',
  cleanup: 'Nettoyage',
  enrichment: 'Enrichissement',
  export: 'Export automatique',
  sync: 'Synchronisation',
  linking: 'Liaison automatique',
};

export const Step6Summary = ({
  selectedType,
  sourceConfig,
  triggerConfig,
  actionsConfig,
  errorConfig,
  ruleName,
  ruleDescription,
  onRuleNameChange,
  onRuleDescriptionChange,
}: Step6SummaryProps) => {
  const getSourceLabel = () => {
    if (sourceConfig.sourceType === 'email_imap') return '📧 Email IMAP';
    if (sourceConfig.sourceType === 'ftp') return '📁 FTP/SFTP';
    if (sourceConfig.sourceType === 'api') return '🔗 API REST';
    return 'Non configuré';
  };

  const getTriggerLabel = () => {
    if (triggerConfig.type === 'schedule') {
      const freq = triggerConfig.frequency;
      if (freq === 'hourly') return '⏰ Toutes les heures';
      if (freq === 'every_2h') return '⏰ Toutes les 2 heures';
      if (freq === 'every_6h') return '⏰ Toutes les 6 heures';
      if (freq === 'daily') return `⏰ Quotidien à ${triggerConfig.executionTime || '02:00'}`;
      if (freq === 'weekly') return '⏰ Hebdomadaire';
      if (freq === 'monthly') return '⏰ Mensuel';
      return '⏰ Planifié';
    }
    if (triggerConfig.type === 'event') return '⚡ Événement';
    if (triggerConfig.type === 'webhook') return '🔗 Webhook';
    return 'Non configuré';
  };

  const getErrorLabel = () => {
    if (errorConfig.strategy === 'retry') {
      return `🔄 ${errorConfig.retryCount || 3} tentatives (${errorConfig.retryDelay || 5}min)`;
    }
    if (errorConfig.strategy === 'alert') return '📧 Notification email';
    if (errorConfig.strategy === 'stop') return '⛔ Arrêt automatique';
    if (errorConfig.strategy === 'continue') return '➡️ Log et continue';
    return 'Non configuré';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Récapitulatif de votre automatisation</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Vérifiez les paramètres avant de créer l'automatisation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {categoryIcons[selectedType]} {categoryLabels[selectedType]}
          </CardTitle>
          <CardDescription>Configuration complète de votre automatisation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Type :</span>
            <Badge>{categoryLabels[selectedType]}</Badge>
          </div>

          {sourceConfig.supplierId && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Source :</span>
              <span className="font-medium">{getSourceLabel()}</span>
            </div>
          )}

          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Déclencheur :</span>
            <span className="font-medium">{getTriggerLabel()}</span>
          </div>

          {Object.keys(actionsConfig).some((k) => actionsConfig[k]) && (
            <div className="py-2 border-b">
              <span className="text-muted-foreground">Actions activées :</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {actionsConfig.autoEnrich && <Badge variant="secondary">🚀 Enrichissement</Badge>}
                {actionsConfig.autoLink && <Badge variant="secondary">🔗 Liaison</Badge>}
                {actionsConfig.autoAlerts && <Badge variant="secondary">🔔 Alertes</Badge>}
                {actionsConfig.autoExport && <Badge variant="secondary">📤 Export</Badge>}
              </div>
            </div>
          )}

          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">En cas d'erreur :</span>
            <span className="font-medium">{getErrorLabel()}</span>
          </div>

          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Nettoyage :</span>
            <span className="font-medium">
              Emails: {errorConfig.emailRetentionDays || 30}j, Fichiers: {errorConfig.fileRetentionDays || 7}j
            </span>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Prêt à automatiser ! 🚀</AlertTitle>
        <AlertDescription>
          Cette règle sera active immédiatement après création. Vous pourrez la modifier ou la désactiver à tout moment depuis le tableau de bord.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div>
          <Label>Nom de la règle (optionnel)</Label>
          <Input
            placeholder="Ex: Import quotidien FVS avec enrichissement"
            value={ruleName}
            onChange={(e) => onRuleNameChange(e.target.value)}
          />
        </div>

        <div>
          <Label>Description (optionnelle)</Label>
          <Textarea
            placeholder="Décrivez le but de cette automatisation..."
            value={ruleDescription}
            onChange={(e) => onRuleDescriptionChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
