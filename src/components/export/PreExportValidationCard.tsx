import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreExportValidationCardProps {
  analysisId: string;
}

export const PreExportValidationCard = ({ analysisId }: PreExportValidationCardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEnriching, setIsEnriching] = useState(false);

  // Récupérer le statut de validation
  const { data: validationData, isLoading } = useQuery({
    queryKey: ['pre-export-validation', analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_analyses')
        .select('pre_export_validation')
        .eq('id', analysisId)
        .single();

      if (error) throw error;
      return data?.pre_export_validation;
    }
  });

  // Revalider
  const revalidate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('validate-pre-export', {
        body: { analysis_id: analysisId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-export-validation', analysisId] });
      toast({
        title: "✅ Validation mise à jour",
        description: "Le statut de validation a été actualisé"
      });
    }
  });

  // Compléter avant export
  const completeBeforeExport = async () => {
    const missingFields = (validationData as any)?.missing_fields;
    if (!missingFields || missingFields.length === 0) return;

    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('post-prod-enrichment', {
        body: {
          analysis_id: analysisId,
          missing_fields: missingFields,
          target_platform: 'odoo'
        }
      });

      if (error) throw error;

      // Revalider après enrichissement
      await revalidate.mutateAsync();

      toast({
        title: "✅ Enrichissement POST-PROD terminé",
        description: `${data.completed_count}/${data.total_tasks} champs complétés`
      });
    } catch (error: any) {
      toast({
        title: "❌ Erreur enrichissement",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsEnriching(false);
    }
  };

  if (isLoading || !validationData) {
    return null;
  }

  const validation = validationData as any;
  const completenessScore = validation.completeness_score || 0;
  const isComplete = completenessScore >= 80;
  const missingFields = validation.missing_fields || [];

  const criteria = [
    { key: 'description_ready', label: 'Description longue', icon: '📝' },
    { key: 'images_ready', label: 'Images produit (min 3)', icon: '📸' },
    { key: 'specifications_ready', label: 'Spécifications techniques', icon: '🔧' },
    { key: 'pricing_ready', label: 'Prix fournisseur', icon: '💰' },
    { key: 'stock_ready', label: 'Stock disponible', icon: '📦' },
    { key: 'hs_code_ready', label: 'Code HS', icon: '🏷️' },
    { key: 'odoo_category_ready', label: 'Catégorie Odoo', icon: '📂' },
    { key: 'amazon_data_ready', label: 'Données Amazon', icon: '🛒' }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-500" />
              )}
              Validation Pré-Export
            </CardTitle>
            <CardDescription>
              Vérification de la complétude du produit avant export
            </CardDescription>
          </div>
          <Button
            onClick={() => revalidate.mutate()}
            disabled={revalidate.isPending}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${revalidate.isPending ? 'animate-spin' : ''}`} />
            Revalider
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Complétude</span>
            <Badge variant={isComplete ? "default" : "secondary"}>
              {completenessScore}%
            </Badge>
          </div>
          <Progress value={completenessScore} className="h-3" />
          {!isComplete && (
            <p className="text-xs text-muted-foreground">
              {missingFields.length} champ(s) manquant(s) pour un export optimal
            </p>
          )}
        </div>

        {/* Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {criteria.map((criterion) => {
            const isValid = validation[criterion.key] === true;
            return (
              <div
                key={criterion.key}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isValid
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-orange-500/50 bg-orange-500/5'
                }`}
              >
                <span className="text-2xl">{criterion.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{criterion.label}</div>
                </div>
                {isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-orange-500" />
                )}
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        {!isComplete && missingFields.length > 0 && (
          <div className="pt-4 border-t">
            <Button
              onClick={completeBeforeExport}
              disabled={isEnriching}
              className="w-full"
              size="lg"
            >
              <Sparkles className={`w-5 h-5 mr-2 ${isEnriching ? 'animate-pulse' : ''}`} />
              {isEnriching
                ? "Enrichissement POST-PROD en cours..."
                : "🔥 Compléter avant Export (Ollama Web Search)"}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Génération automatique des champs manquants via IA
            </p>
          </div>
        )}

        {isComplete && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Produit prêt pour l'export
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tous les critères sont remplis, vous pouvez exporter vers n'importe quelle plateforme
            </p>
          </div>
        )}

        {/* Dernière validation */}
        {validation.last_validated_at && (
          <p className="text-xs text-muted-foreground text-center">
            Dernière validation: {new Date(validation.last_validated_at).toLocaleString('fr-FR')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
