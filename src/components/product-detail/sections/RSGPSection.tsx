import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FileText, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useEnrichment } from "@/hooks/useEnrichment";

interface RSGPSectionProps {
  analysis: any;
  onEnrich?: () => void;
}

export const RSGPSection = ({ analysis, onEnrich }: RSGPSectionProps) => {
  const enrichMutation = useEnrichment(analysis.id, onEnrich);
  const rsgpData = analysis?.rsgp_data;
  const rsgpGeneratedAt = analysis?.rsgp_generated_at;

  if (!rsgpData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Conformité RSGP
          </CardTitle>
          <CardDescription>
            Analyse de conformité non disponible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full gap-2"
            onClick={() => enrichMutation.mutate({ enrichmentType: ['rsgp'] })}
            disabled={enrichMutation.isPending}
          >
            {enrichMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Analyser la conformité
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isCompliant = rsgpData.status === 'compliant';
  const checks = rsgpData.checks || [];
  const warnings = rsgpData.warnings || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Conformité RSGP (Sécurité Produits)
        </CardTitle>
        <CardDescription>
          Réglementation Générale sur la Sécurité des Produits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statut global */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Statut</div>
            {rsgpGeneratedAt && (
              <div className="text-xs text-muted-foreground">
                • Analysé {formatDistanceToNow(new Date(rsgpGeneratedAt), {
                  addSuffix: true,
                  locale: fr
                })}
              </div>
            )}
          </div>
          <Badge variant={isCompliant ? "default" : "destructive"} className="gap-1">
            {isCompliant ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Conforme
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                Non conforme
              </>
            )}
          </Badge>
        </div>

        {/* Points de conformité */}
        {checks.length > 0 && (
          <div className="space-y-2">
            {checks.map((check: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{check.description || check}</span>
              </div>
            ))}
          </div>
        )}

        {/* Avertissements */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span>{warning.description || warning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" className="gap-2">
            <FileText className="h-3 w-3" />
            Télécharger rapport
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <RefreshCw className="h-3 w-3" />
            Ré-analyser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
