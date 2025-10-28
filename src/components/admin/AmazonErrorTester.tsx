import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AmazonErrorTester = () => {
  const { toast } = useToast();
  const [scenario, setScenario] = useState('missing');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const scenarios = [
    { value: 'missing', label: 'Credentials manquantes' },
    { value: 'incomplete', label: 'Credentials incomplètes' },
    { value: 'invalid_client', label: 'Client ID/Secret invalide' },
    { value: 'invalid_grant', label: 'Refresh Token expiré' },
    { value: 'unauthorized_client', label: 'Application non autorisée' },
    { value: 'success', label: '✅ Succès' }
  ];

  const testScenario = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-amazon-errors', {
        body: { scenario }
      });

      if (error) throw error;

      setResult(data);
      
      toast({
        title: data.success ? "✅ Test réussi" : "❌ Erreur simulée",
        description: `Scénario: ${scenarios.find(s => s.value === scenario)?.label}`,
        variant: data.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: "❌ Erreur de test",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>🧪 Testeur d'erreurs Amazon</CardTitle>
        <CardDescription>
          Simulez différents scénarios d'erreur pour valider les messages utilisateur
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Select value={scenario} onValueChange={setScenario}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={testScenario} disabled={testing}>
            {testing ? 'Test en cours...' : 'Tester'}
          </Button>
        </div>
        {result && (
          <pre className="mt-4 p-4 bg-muted rounded-lg text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
};
