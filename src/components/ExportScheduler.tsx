import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Zap } from "lucide-react";

export const ExportScheduler = () => {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState('shopify');
  const [schedule, setSchedule] = useState('daily');

  const triggerExport = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('auto-export-manager', {
        body: { platform: selectedPlatform }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Export lancé",
        description: `${data.results?.length || 0} règle(s) d'export traitée(s)`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de lancer l'export",
        variant: "destructive",
      });
    },
  });

  const platforms = [
    { value: 'shopify', label: 'Shopify' },
    { value: 'prestashop', label: 'PrestaShop' },
    { value: 'woocommerce', label: 'WooCommerce' },
    { value: 'magento', label: 'Magento' },
    { value: 'odoo', label: 'Odoo' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Planificateur d'Export
        </CardTitle>
        <CardDescription>
          Programmez des exports automatiques vers vos plateformes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plateforme</Label>
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {platforms.map(platform => (
                  <SelectItem key={platform.value} value={platform.value}>
                    {platform.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fréquence</Label>
            <Select value={schedule} onValueChange={setSchedule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Toutes les heures</SelectItem>
                <SelectItem value="daily">Quotidien (2h du matin)</SelectItem>
                <SelectItem value="weekly">Hebdomadaire (Lundi 2h)</SelectItem>
                <SelectItem value="manual">Manuel uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4" />
              Configuration du Planning
            </div>
            <p className="text-sm text-muted-foreground">
              {schedule === 'hourly' && 'Export automatique toutes les heures'}
              {schedule === 'daily' && 'Export automatique tous les jours à 2h du matin'}
              {schedule === 'weekly' && 'Export automatique tous les lundis à 2h du matin'}
              {schedule === 'manual' && 'Exports manuels uniquement'}
            </p>
          </div>

          <Button
            onClick={() => triggerExport.mutate()}
            disabled={triggerExport.isPending}
            className="w-full"
          >
            <Zap className={`w-4 h-4 mr-2 ${triggerExport.isPending ? 'animate-spin' : ''}`} />
            {triggerExport.isPending ? 'Export en cours...' : 'Lancer l\'Export Maintenant'}
          </Button>
        </div>

        <div className="p-4 border rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">💡 Conseil</h4>
          <p className="text-sm text-muted-foreground">
            Les exports automatiques utilisent les règles configurées dans l'onglet "Règles d'Export".
            Assurez-vous d'avoir configuré au moins une règle avant d'activer l'export planifié.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
