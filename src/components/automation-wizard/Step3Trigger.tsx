import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Info } from 'lucide-react';

interface Step3TriggerProps {
  triggerConfig: any;
  onTriggerConfigChange: (config: any) => void;
}

export const Step3Trigger = ({ triggerConfig, onTriggerConfigChange }: Step3TriggerProps) => {
  const handleTypeChange = (type: string) => {
    onTriggerConfigChange({ ...triggerConfig, type });
  };

  const handleFrequencyChange = (frequency: string) => {
    onTriggerConfigChange({ ...triggerConfig, frequency });
  };

  const handleTimeChange = (time: string) => {
    onTriggerConfigChange({ ...triggerConfig, executionTime: time });
  };

  const toggleWeekDay = (day: number) => {
    const weekDays = triggerConfig.weekDays || [];
    const newWeekDays = weekDays.includes(day)
      ? weekDays.filter((d: number) => d !== day)
      : [...weekDays, day];
    onTriggerConfigChange({ ...triggerConfig, weekDays: newWeekDays });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Quand lancer cette automatisation ?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Définissez le déclencheur et la fréquence d'exécution
        </p>
      </div>

      <div className="space-y-4">
        <Label>Type de déclencheur</Label>
        <RadioGroup value={triggerConfig.type} onValueChange={handleTypeChange}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="schedule" id="schedule" />
            <Label htmlFor="schedule" className="cursor-pointer font-normal">
              ⏰ Planification automatique (cron)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="event" id="event" />
            <Label htmlFor="event" className="cursor-pointer font-normal">
              ⚡ Déclencheur événement (réception email, nouveau fichier...)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="webhook" id="webhook" />
            <Label htmlFor="webhook" className="cursor-pointer font-normal">
              🔗 Webhook externe (API call)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {triggerConfig.type === 'schedule' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label>Fréquence</Label>
              <Select value={triggerConfig.frequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une fréquence..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">⏱️ Toutes les heures</SelectItem>
                  <SelectItem value="every_2h">⏱️ Toutes les 2 heures</SelectItem>
                  <SelectItem value="every_6h">⏱️ Toutes les 6 heures</SelectItem>
                  <SelectItem value="daily">📅 Quotidien</SelectItem>
                  <SelectItem value="weekly">📅 Hebdomadaire</SelectItem>
                  <SelectItem value="monthly">📅 Mensuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {triggerConfig.frequency === 'daily' && (
              <div>
                <Label>Heure d'exécution</Label>
                <Input
                  type="time"
                  value={triggerConfig.executionTime || '02:00'}
                  onChange={(e) => handleTimeChange(e.target.value)}
                />
              </div>
            )}

            {triggerConfig.frequency === 'weekly' && (
              <>
                <div>
                  <Label>Heure d'exécution</Label>
                  <Input
                    type="time"
                    value={triggerConfig.executionTime || '02:00'}
                    onChange={(e) => handleTimeChange(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Jours de la semaine</Label>
                  <div className="flex gap-2 mt-2">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, i) => (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant={(triggerConfig.weekDays || []).includes(i) ? 'default' : 'outline'}
                        onClick={() => toggleWeekDay(i)}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                {triggerConfig.frequency === 'hourly' && 'L\'automatisation s\'exécutera toutes les heures'}
                {triggerConfig.frequency === 'every_2h' && 'L\'automatisation s\'exécutera toutes les 2 heures'}
                {triggerConfig.frequency === 'every_6h' && 'L\'automatisation s\'exécutera toutes les 6 heures'}
                {triggerConfig.frequency === 'daily' && `L'automatisation s'exécutera chaque jour à ${triggerConfig.executionTime || '02:00'}`}
                {triggerConfig.frequency === 'weekly' && `L'automatisation s'exécutera chaque semaine les jours sélectionnés à ${triggerConfig.executionTime || '02:00'}`}
                {triggerConfig.frequency === 'monthly' && 'L\'automatisation s\'exécutera le 1er de chaque mois à 02:00'}
                {!triggerConfig.frequency && 'Sélectionnez une fréquence ci-dessus'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {triggerConfig.type === 'event' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label>Type d'événement</Label>
              <Select 
                value={triggerConfig.eventType} 
                onValueChange={(v) => onTriggerConfigChange({ ...triggerConfig, eventType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un événement..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_received">📧 Dès réception d'un email</SelectItem>
                  <SelectItem value="file_uploaded">📁 Dès qu'un nouveau fichier FTP apparaît</SelectItem>
                  <SelectItem value="import_completed">✅ Après un import réussi</SelectItem>
                  <SelectItem value="product_created">🆕 Lorsqu'un produit est créé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {triggerConfig.type === 'webhook' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Un webhook unique sera généré après la création. Vous pourrez l'utiliser pour déclencher l'automatisation depuis un système externe.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
