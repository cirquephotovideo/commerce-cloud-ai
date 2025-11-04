import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ImageOptimization } from "./ImageOptimization";
import { DeepResearchButton } from "./DeepResearchButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Search, 
  TrendingUp, 
  DollarSign, 
  Target, 
  BarChart3, 
  FileText,
  Tag,
  MessageSquare,
  Star,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle
} from "lucide-react";

interface AnalysisResultsProps {
  analysis: any;
  productInput: string;
  inputType: string;
  analysisId?: string | null;
}

export const AnalysisResults = ({ analysis, productInput, inputType, analysisId }: AnalysisResultsProps) => {
  if (!analysis || analysis.error || analysis.raw_analysis) {
    return (
      <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
        <h3 className="text-2xl font-bold mb-4">Résultats de l'Analyse</h3>
        <p className="text-muted-foreground">
          {analysis?.error || "L'analyse n'a pas pu être structurée correctement."}
        </p>
        {analysis?.raw_analysis && (
          <pre className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap max-h-96 overflow-auto">
            {analysis.raw_analysis}
          </pre>
        )}
      </Card>
    );
  }

  const getTrendIcon = (trend: string) => {
    if (trend?.toLowerCase().includes('croissance')) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend?.toLowerCase().includes('déclin')) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-yellow-500" />;
  };

  const handleReanalyze = async () => {
    if (!analysisId) {
      toast.error("ID d'analyse manquant");
      return;
    }
    
    try {
      toast.info("Ré-analyse en cours...");
      const { data, error } = await supabase.functions.invoke('complete-analysis', {
        body: { analysisId }
      });
      
      if (error) throw error;
      
      toast.success("Ré-analyse terminée avec succès");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error('Reanalysis error:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-primary border-border backdrop-blur-sm shadow-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {inputType === 'url' ? 'URL' : inputType === 'barcode' ? 'Code-barres' : 'Nom de produit'}
              </Badge>
              
              {/* Incomplete Analysis Badge */}
              {(analysis.parsing_error || analysis._incomplete) && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Analyse partielle
                </Badge>
              )}
            </div>
            
            <h2 className="text-3xl font-bold">{analysis.product_name || productInput}</h2>
            <p className="text-muted-foreground">{productInput}</p>
            
            {/* Missing Fields Warning */}
            {analysis._missing_fields && analysis._missing_fields.length > 0 && (
              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive font-medium mb-1">
                  ⚠️ Certaines données sont manquantes :
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {analysis._missing_fields.map((field: string) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              {analysisId && (
                <DeepResearchButton
                  analysisId={analysisId}
                  productData={{
                    name: analysis.product_name || productInput,
                    brand: analysis.brand,
                    supplier_reference: analysis.supplier_reference,
                    ean: analysis.ean || analysis.barcode,
                  }}
                  purchasePrice={analysis.pricing?.estimated_price ? 
                    parseFloat(analysis.pricing.estimated_price.replace(/[^0-9.]/g, '')) : 
                    undefined
                  }
                />
              )}
              
              {/* Reanalyze Button */}
              {analysis._needs_reanalysis && analysisId && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleReanalyze}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Compléter l'analyse
                </Button>
              )}
            </div>
          </div>
          {analysis.global_report?.overall_score && (
            <div className="text-center">
              <div className="text-5xl font-bold text-primary">{analysis.global_report.overall_score}</div>
              <div className="text-sm text-muted-foreground">Score Global</div>
            </div>
          )}
        </div>
      </Card>

      {/* Global Report */}
      {analysis.global_report && (
        <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold">Rapport Global</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 text-green-500">Forces</h4>
              <ul className="space-y-2">
                {analysis.global_report.strengths?.map((strength: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-red-500">Points d'amélioration</h4>
              <ul className="space-y-2">
                {analysis.global_report.weaknesses?.map((weakness: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {analysis.global_report.priority_actions && (
            <div className="mt-6 p-4 bg-primary/10 rounded-lg">
              <h4 className="font-semibold mb-3">Actions Prioritaires</h4>
              <ol className="space-y-2 list-decimal list-inside">
                {analysis.global_report.priority_actions.map((action: string, idx: number) => (
                  <li key={idx} className="text-sm">{action}</li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* SEO Analysis */}
        {analysis.seo && (
          <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Search className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">Analyse SEO</h3>
                {analysis.seo.score && (
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={analysis.seo.score} className="h-2" />
                    <span className="text-sm font-semibold">{analysis.seo.score}%</span>
                  </div>
                )}
              </div>
            </div>
            
            {analysis.seo.keywords && (
              <div className="mb-3">
                <p className="text-sm font-semibold mb-2">Mots-clés suggérés:</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.seo.keywords.map((keyword: string, idx: number) => (
                    <Badge key={idx} variant="secondary">{keyword}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.seo.recommendations && (
              <div>
                <p className="text-sm font-semibold mb-2">Recommandations:</p>
                <ul className="space-y-1">
                  {analysis.seo.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {/* Pricing Analysis */}
        {analysis.pricing && (
          <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold">Analyse de Prix</h3>
            </div>
            
            <div className="space-y-3">
              {analysis.pricing.estimated_price && (
                <div>
                  <p className="text-sm text-muted-foreground">Prix estimé</p>
                  <p className="text-2xl font-bold text-primary">{analysis.pricing.estimated_price}</p>
                </div>
              )}
              
              {analysis.pricing.market_position && (
                <div>
                  <p className="text-sm text-muted-foreground">Position marché</p>
                  <Badge>{analysis.pricing.market_position}</Badge>
                </div>
              )}
              
              {analysis.pricing.competitive_analysis && (
                <p className="text-sm">{analysis.pricing.competitive_analysis}</p>
              )}
            </div>
          </Card>
        )}

        {/* Competition */}
        {analysis.competition && (
          <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Target className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold">Concurrence</h3>
            </div>
            
            {analysis.competition.main_competitors && (
              <div className="mb-3">
                <p className="text-sm font-semibold mb-2">Principaux concurrents:</p>
                <div className="space-y-1">
                  {analysis.competition.main_competitors.map((competitor: string, idx: number) => (
                    <div key={idx} className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {competitor}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {analysis.competition.differentiation && (
              <p className="text-sm text-muted-foreground">{analysis.competition.differentiation}</p>
            )}
          </Card>
        )}

        {/* Trends */}
        {analysis.trends && (
          <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold">Tendances</h3>
            </div>
            
            <div className="space-y-3">
              {analysis.trends.market_trend && (
                <div className="flex items-center gap-2">
                  {getTrendIcon(analysis.trends.market_trend)}
                  <span className="font-semibold">{analysis.trends.market_trend}</span>
                </div>
              )}
              
              {analysis.trends.popularity_score && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Score de popularité</p>
                  <div className="flex items-center gap-2">
                    <Progress value={analysis.trends.popularity_score} className="h-2" />
                    <span className="text-sm font-semibold">{analysis.trends.popularity_score}%</span>
                  </div>
                </div>
              )}
              
              {analysis.trends.future_outlook && (
                <p className="text-sm">{analysis.trends.future_outlook}</p>
              )}
            </div>
          </Card>
        )}

        {/* Tags & Categories */}
        {analysis.tags_categories && (
          <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Tag className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold">Tags & Catégories</h3>
            </div>
            
            <div className="space-y-3">
              {analysis.tags_categories.primary_category && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Catégorie principale</p>
                  <Badge variant="default">{analysis.tags_categories.primary_category}</Badge>
                </div>
              )}
              
              {analysis.tags_categories.suggested_tags && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tags suggérés</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.tags_categories.suggested_tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Customer Reviews */}
        {analysis.customer_reviews && (
          <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">Avis Clients</h3>
                {analysis.customer_reviews.sentiment_score && (
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(analysis.customer_reviews.sentiment_score)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="text-sm ml-1">{analysis.customer_reviews.sentiment_score}/5</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {analysis.customer_reviews.common_praises && (
                <div>
                  <p className="text-sm font-semibold text-green-500 mb-2">Points forts</p>
                  <ul className="space-y-1">
                    {analysis.customer_reviews.common_praises.map((praise: string, idx: number) => (
                      <li key={idx} className="text-xs">• {praise}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {analysis.customer_reviews.common_complaints && (
                <div>
                  <p className="text-sm font-semibold text-red-500 mb-2">Points faibles</p>
                  <ul className="space-y-1">
                    {analysis.customer_reviews.common_complaints.map((complaint: string, idx: number) => (
                      <li key={idx} className="text-xs">• {complaint}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Description (Full Width) */}
      {analysis.description && (
        <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-bold">Description Optimisée</h3>
          </div>
          
          {analysis.description.suggested_description && (
            <div className="mb-4 p-4 bg-secondary/10 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{analysis.description.suggested_description}</p>
            </div>
          )}
          
          {analysis.description.key_features && (
            <div>
              <p className="text-sm font-semibold mb-2">Caractéristiques clés:</p>
              <div className="grid md:grid-cols-3 gap-2">
                {analysis.description.key_features.map((feature: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Repairability & Environmental Impact */}
      <div className="grid md:grid-cols-2 gap-6">
        {analysis.repairability && (
          <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                ♻️
              </div>
              <h3 className="text-lg font-bold">Indice de Réparabilité</h3>
            </div>
            
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-4xl font-bold text-green-600">
                  {analysis.repairability.repairability_index || `${analysis.repairability.score}/10`}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Score de réparabilité</div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Facilité</div>
                  <Badge variant="outline">{analysis.repairability.ease_of_repair}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Durabilité</div>
                  <div className="font-semibold">{analysis.repairability.durability_score}/10</div>
                </div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">Disponibilité pièces</div>
                <div className="text-sm">{analysis.repairability.spare_parts_availability}</div>
              </div>
            </div>
          </Card>
        )}

        {analysis.environmental_impact && (
          <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                🌱
              </div>
              <h3 className="text-lg font-bold">Impact Environnemental</h3>
            </div>
            
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-4xl font-bold text-green-600">{analysis.environmental_impact.eco_score}/10</div>
                <div className="text-sm text-muted-foreground mt-1">Score écologique</div>
              </div>
              
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Empreinte carbone</div>
                  <div className="text-sm">{analysis.environmental_impact.carbon_footprint}</div>
                </div>
                
                {analysis.environmental_impact.energy_efficiency && (
                  <div>
                    <div className="text-xs text-muted-foreground">Efficacité énergétique</div>
                    <Badge>{analysis.environmental_impact.energy_efficiency}</Badge>
                  </div>
                )}
                
                {analysis.environmental_impact.eco_certifications?.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Certifications</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.environmental_impact.eco_certifications.slice(0, 3).map((cert: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{cert}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* HS Code */}
      {analysis.hs_code && (
        <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              📦
            </div>
            <h3 className="text-lg font-bold">Code Douanier (HS Code)</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-xl px-4 py-2">{analysis.hs_code.code}</Badge>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{analysis.hs_code.description}</p>
              </div>
            </div>
            
            {analysis.hs_code.tariff_info && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">{analysis.hs_code.tariff_info}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Image Optimization */}
      {analysis.image_optimization && (
        <ImageOptimization data={analysis.image_optimization} />
      )}
    </div>
  );
};