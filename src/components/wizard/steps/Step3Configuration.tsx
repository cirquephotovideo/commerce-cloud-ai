import { Button } from '@/components/ui/button';
import { useWizard } from '@/contexts/UniversalWizardContext';

export const Step3Configuration = () => {
  const { goToStep } = useWizard();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Configuration</h2>
        <p className="text-muted-foreground">Paramètres de connexion et configuration</p>
      </div>

      <div className="bg-muted/30 p-8 rounded-lg text-center">
        <p className="text-muted-foreground">Configuration en cours de développement</p>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => goToStep(2)}>Précédent</Button>
        <Button onClick={() => goToStep(4)}>Continuer</Button>
      </div>
    </div>
  );
};
