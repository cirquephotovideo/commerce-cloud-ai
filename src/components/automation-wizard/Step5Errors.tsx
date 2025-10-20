import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface Step5ErrorsProps {
  errorConfig: any;
  onErrorConfigChange: (config: any) => void;
}

export const Step5Errors = ({ errorConfig, onErrorConfigChange }: Step5ErrorsProps) => {
  const handleStrategyChange = (strategy: string) => {
    onErrorConfigChange({ ...errorConfig, strategy });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Gestion des erreurs & Nettoyage</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Définissez comment gérer les erreurs et le nettoyage automatique
        </p>
      </div>

      {/* Stratégie d'erreur */}
      <div className="space-y-4">
        <Label>En cas d'erreur :</Label>
        <RadioGroup value={errorConfig.strategy} onValueChange={handleStrategyChange}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="retry" id="retry" />
            <Label htmlFor="retry" className="cursor-pointer font-normal">
              🔄 Réessayer automatiquement
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="alert" id="alert" />
            <Label htmlFor="alert" className="cursor-pointer font-normal">
              📧 M'alerter par email
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="stop" id="stop" />
            <Label htmlFor="stop" className="cursor-pointer font-normal">
              ⛔ Arrêter la règle
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="continue" id="continue" />
            <Label htmlFor="continue" className="cursor-pointer font-normal">
              ➡️ Continuer et logger l'erreur
            </Label>
          </div>
        </RadioGroup>
      </div>

      {errorConfig.strategy === 'retry' && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label>Nombre de tentatives</Label>
              <Select
                value={(errorConfig.retryCount || 3).toString()}
                onValueChange={(v) => onErrorConfigChange({ ...errorConfig, retryCount: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} tentative(s)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Délai entre tentatives (minutes)</Label>
              <Select
                value={(errorConfig.retryDelay || 5).toString()}
                onValueChange={(v) => onErrorConfigChange({ ...errorConfig, retryDelay: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 5, 10, 15, 30, 60].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} minute(s)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {errorConfig.strategy === 'alert' && (
        <Card>
          <CardContent className="pt-4">
            <div>
              <Label>Email de notification</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={errorConfig.notificationEmail || ''}
                onChange={(e) =>
                  onErrorConfigChange({ ...errorConfig, notificationEmail: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Nettoyage automatique */}
      <div className="space-y-4">
        <Label className="text-base">Nettoyage automatique</Label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="clean-emails"
                checked={errorConfig.cleanEmails !== false}
                onCheckedChange={(checked) =>
                  onErrorConfigChange({ ...errorConfig, cleanEmails: checked })
                }
              />
              <Label htmlFor="clean-emails" className="cursor-pointer font-normal">
                Supprimer les emails après
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-20"
                value={errorConfig.emailRetentionDays || 30}
                onChange={(e) =>
                  onErrorConfigChange({ ...errorConfig, emailRetentionDays: Number(e.target.value) })
                }
              />
              <span className="text-sm">jours</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="clean-files"
                checked={errorConfig.cleanFiles !== false}
                onCheckedChange={(checked) =>
                  onErrorConfigChange({ ...errorConfig, cleanFiles: checked })
                }
              />
              <Label htmlFor="clean-files" className="cursor-pointer font-normal">
                Supprimer les fichiers temporaires après
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-20"
                value={errorConfig.fileRetentionDays || 7}
                onChange={(e) =>
                  onErrorConfigChange({ ...errorConfig, fileRetentionDays: Number(e.target.value) })
                }
              />
              <span className="text-sm">jours</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="clean-logs"
                checked={errorConfig.cleanLogs !== false}
                onCheckedChange={(checked) =>
                  onErrorConfigChange({ ...errorConfig, cleanLogs: checked })
                }
              />
              <Label htmlFor="clean-logs" className="cursor-pointer font-normal">
                Archiver les logs d'import après
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-20"
                value={errorConfig.logRetentionDays || 90}
                onChange={(e) =>
                  onErrorConfigChange({ ...errorConfig, logRetentionDays: Number(e.target.value) })
                }
              />
              <span className="text-sm">jours</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="keep-errors"
              checked={errorConfig.keepErrors}
              onCheckedChange={(checked) =>
                onErrorConfigChange({ ...errorConfig, keepErrors: checked })
              }
            />
            <Label htmlFor="keep-errors" className="cursor-pointer font-normal">
              Conserver les imports en erreur indéfiniment
            </Label>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Le nettoyage automatique s'appliquera uniquement aux éléments créés par cette règle d'automatisation.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};
