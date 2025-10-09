import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw, Shield, Building2, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type RSGPData = Database['public']['Tables']['rsgp_compliance']['Row'];

interface ProductRSGPTabProps {
  analysis: {
    id: string;
    analysis_result?: any;
  };
}

export const ProductRSGPTab = ({ analysis }: ProductRSGPTabProps) => {
  const [rsgpData, setRsgpData] = useState<RSGPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const fetchRSGPData = async () => {
    try {
      setLoading(true);
    const { data, error } = await supabase
      .from("rsgp_compliance")
      .select("*")
      .eq("analysis_id", analysis.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

      if (error) throw error;
      setRsgpData(data);
    } catch (error: any) {
      console.error("Error fetching RSGP data:", error);
      toast.error("Erreur lors du chargement des données RSGP");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRSGPData();
  }, [analysis.id]);

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Vous devez être connecté");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rsgp-compliance-generator`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            analysis_id: analysis.id,
            force_regenerate: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération");
      }

      toast.success("Analyse RSGP régénérée avec succès");
      await fetchRSGPData();
    } catch (error: any) {
      console.error("Error regenerating RSGP:", error);
      toast.error(error.message || "Erreur lors de la régénération");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!rsgpData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Aucune analyse RSGP disponible</p>
          <p className="text-sm text-muted-foreground mb-4">
            Générez une analyse de conformité RSGP pour ce produit
          </p>
          <Button onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Génération en cours...
              </>
            ) : (
              "Générer l'analyse RSGP"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "faible":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "moyen":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "élevé":
      case "eleve":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with regenerate button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Conformité RSGP</h3>
          <p className="text-sm text-muted-foreground">
            Règlement Général sur la Sécurité des Produits
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          {regenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Régénération...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Régénérer
            </>
          )}
        </Button>
      </div>

      {/* Product Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Informations Produit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nom du produit</p>
              <p className="font-medium">{rsgpData.nom_produit}</p>
            </div>
            {rsgpData.categorie_rsgp && (
              <div>
                <p className="text-sm text-muted-foreground">Catégorie RSGP</p>
                <p className="font-medium">{rsgpData.categorie_rsgp}</p>
              </div>
            )}
            {rsgpData.reference_interne && (
              <div>
                <p className="text-sm text-muted-foreground">Référence interne</p>
                <p className="font-medium">{rsgpData.reference_interne}</p>
              </div>
            )}
            {rsgpData.numero_modele && (
              <div>
                <p className="text-sm text-muted-foreground">Numéro de modèle</p>
                <p className="font-medium">{rsgpData.numero_modele}</p>
              </div>
            )}
            {rsgpData.ean && (
              <div>
                <p className="text-sm text-muted-foreground">EAN</p>
                <p className="font-medium">{rsgpData.ean}</p>
              </div>
            )}
            {rsgpData.pays_origine && (
              <div>
                <p className="text-sm text-muted-foreground">Pays d'origine</p>
                <p className="font-medium">{rsgpData.pays_origine}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manufacturer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Fabricant & Responsable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rsgpData.fabricant_nom && (
            <div>
              <p className="text-sm font-medium mb-2">Fabricant</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nom</p>
                  <p className="font-medium">{rsgpData.fabricant_nom}</p>
                </div>
                {rsgpData.fabricant_adresse && (
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground">Adresse</p>
                    <p className="font-medium">{rsgpData.fabricant_adresse}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {rsgpData.fournisseur && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Fournisseur</p>
              <p className="text-sm">{rsgpData.fournisseur}</p>
            </div>
          )}

          {rsgpData.personne_responsable_ue && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Personne responsable UE</p>
              <p className="text-sm">{rsgpData.personne_responsable_ue}</p>
            </div>
          )}

          {rsgpData.service_consommateur && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Service consommateur</p>
              <p className="text-sm">{rsgpData.service_consommateur}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conformity & Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Conformité & Certifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">RSGP Valide</p>
              <Badge variant={rsgpData.rsgp_valide ? "default" : "secondary"}>
                {rsgpData.rsgp_valide ? "✓ Valide" : "En attente"}
              </Badge>
            </div>
            {rsgpData.validation_status && (
              <div>
                <p className="text-sm text-muted-foreground">Statut</p>
                <Badge variant="outline">{rsgpData.validation_status}</Badge>
              </div>
            )}
          </div>

          {rsgpData.normes_ce && rsgpData.normes_ce.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Normes CE</p>
              <div className="flex flex-wrap gap-2">
                {rsgpData.normes_ce.map((norm: string, idx: number) => (
                  <Badge key={idx} variant="outline">{norm}</Badge>
                ))}
              </div>
            </div>
          )}

          {rsgpData.documents_conformite && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Documents de conformité</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(rsgpData.documents_conformite, null, 2)}
              </pre>
            </div>
          )}

          {rsgpData.notice_pdf && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Notice PDF</p>
              <a href={rsgpData.notice_pdf} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                Télécharger la notice
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safety Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Instructions de Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rsgpData.avertissements && rsgpData.avertissements.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Avertissements</p>
              <div className="flex flex-wrap gap-2">
                {rsgpData.avertissements.map((warn: string, idx: number) => (
                  <Badge key={idx} variant="destructive">{warn}</Badge>
                ))}
              </div>
            </div>
          )}

          {rsgpData.age_recommande && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Âge recommandé</p>
              <p className="text-sm">{rsgpData.age_recommande}</p>
            </div>
          )}

          {rsgpData.recyclage && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Recyclage</p>
              <p className="text-sm">{rsgpData.recyclage}</p>
            </div>
          )}

          {rsgpData.entretien && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Entretien</p>
              <p className="text-sm">{rsgpData.entretien}</p>
            </div>
          )}

          {rsgpData.garantie && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Garantie</p>
              <p className="text-sm">{rsgpData.garantie}</p>
            </div>
          )}

          {rsgpData.indice_energie && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Indice énergie</p>
              <Badge variant="outline">{rsgpData.indice_energie}</Badge>
            </div>
          )}

          {rsgpData.indice_reparabilite !== null && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Indice de réparabilité</p>
              <Badge variant="outline">{rsgpData.indice_reparabilite}/10</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Assessment & Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>Évaluation des Risques & Informations Complémentaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rsgpData.evaluation_risque && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Évaluation des risques</p>
              <p className="text-sm">{rsgpData.evaluation_risque}</p>
            </div>
          )}

          {rsgpData.historique_incidents && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Historique des incidents</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(rsgpData.historique_incidents, null, 2)}
              </pre>
            </div>
          )}

          {rsgpData.procedure_rappel && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Procédure de rappel</p>
              <p className="text-sm">{rsgpData.procedure_rappel}</p>
            </div>
          )}

          {rsgpData.compatibilites && rsgpData.compatibilites.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Compatibilités</p>
              <div className="flex flex-wrap gap-2">
                {rsgpData.compatibilites.map((compat: string, idx: number) => (
                  <Badge key={idx} variant="outline">{compat}</Badge>
                ))}
              </div>
            </div>
          )}

          {rsgpData.firmware_ou_logiciel && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Firmware / Logiciel</p>
              <p className="text-sm">{rsgpData.firmware_ou_logiciel}</p>
            </div>
          )}

          {rsgpData.langues_disponibles && rsgpData.langues_disponibles.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Langues disponibles</p>
              <div className="flex flex-wrap gap-2">
                {rsgpData.langues_disponibles.map((lang: string, idx: number) => (
                  <Badge key={idx} variant="outline">{lang}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t text-sm">
            {rsgpData.date_evaluation && (
              <div>
                <p className="text-muted-foreground">Date d'évaluation</p>
                <p className="font-medium">{new Date(rsgpData.date_evaluation).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {rsgpData.responsable_conformite && (
              <div>
                <p className="text-muted-foreground">Responsable conformité</p>
                <p className="font-medium">{rsgpData.responsable_conformite}</p>
              </div>
            )}
            {rsgpData.date_mise_conformite && (
              <div>
                <p className="text-muted-foreground">Date de mise en conformité</p>
                <p className="font-medium">{new Date(rsgpData.date_mise_conformite).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
            {rsgpData.generated_at && (
              <div>
                <p className="text-muted-foreground">Généré le</p>
                <p className="font-medium">{new Date(rsgpData.generated_at).toLocaleDateString('fr-FR')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
