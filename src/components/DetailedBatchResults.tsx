import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { CheckSquare, Square, Upload, ChevronDown, ChevronUp, Image as ImageIcon, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Separator } from "./ui/separator";
import { ProductImageGallery } from "./ProductImageGallery";
import { ProductAIChat } from "./ProductAIChat";
import { supabase } from "@/integrations/supabase/client";

interface BatchResult {
  product: string;
  analysis?: any;
  enrichments?: any;
  imageUrls?: string[];
  error?: string;
  success: boolean | 'partial';
  amazonStatus?: string | null;
  warning?: string;
  analysisId?: string;
  provider?: string;
  model?: string;
}

// Helper to get enrichments from either location
const getEnrichments = (result: BatchResult) => {
  if (result.enrichments) {
    return result.enrichments;
  }
  if (result.analysis?.analysis_result?.enrichments) {
    return result.analysis.analysis_result.enrichments;
  }
  return null;
};

interface DetailedBatchResultsProps {
  results: BatchResult[];
  onExport: (selectedProducts: any[]) => void;
}

export const DetailedBatchResults = ({ results, onExport }: DetailedBatchResultsProps) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [taxonomyMappings, setTaxonomyMappings] = useState<Map<string, any[]>>(new Map());
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [showAllData, setShowAllData] = useState<Set<number>>(new Set());
  const [showMissingFields, setShowMissingFields] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadTaxonomies = async () => {
      const analysisIds = results
        .filter(r => r.success && r.analysis?.id)
        .map(r => r.analysis.id);
      
      if (analysisIds.length === 0) return;
      
      const { data } = await supabase
        .from('product_taxonomy_mappings')
        .select('*')
        .in('analysis_id', analysisIds);
      
      const mappings = new Map();
      data?.forEach(mapping => {
        if (!mappings.has(mapping.analysis_id)) {
          mappings.set(mapping.analysis_id, []);
        }
        mappings.get(mapping.analysis_id).push(mapping);
      });
      
      setTaxonomyMappings(mappings);
    };
    
    loadTaxonomies();
  }, [results]);

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedIndices);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedIndices(newExpanded);
  };

  const toggleShowAllData = (index: number) => {
    const newShowAll = new Set(showAllData);
    if (newShowAll.has(index)) {
      newShowAll.delete(index);
    } else {
      newShowAll.add(index);
    }
    setShowAllData(newShowAll);
  };

  const toggleShowMissingFields = (index: number) => {
    const newShow = new Set(showMissingFields);
    if (newShow.has(index)) {
      newShow.delete(index);
    } else {
      newShow.add(index);
    }
    setShowMissingFields(newShow);
  };

  const selectAll = () => {
    const allSuccessIndices = results
      .map((_, i) => i)
      .filter(i => results[i].success);
    setSelectedIndices(new Set(allSuccessIndices));
  };

  const selectNone = () => {
    setSelectedIndices(new Set());
  };

  const handleExport = () => {
    const selectedResults = Array.from(selectedIndices)
      .map(i => results[i])
      .filter(r => r.success);
    onExport(selectedResults);
  };

  const handleEnrichAll = async () => {
    setEnrichingAll(true);
    const toEnrich = results.filter(
      r => r.success && 
      r.analysis?.id && 
      (!r.analysis.amazon_enrichment_status || r.analysis.amazon_enrichment_status === 'error')
    );

    for (const result of toEnrich) {
      const ean = result.analysis?.barcode || result.analysis?.ean || result.analysis?.gtin;
      if (ean) {
        await supabase.functions.invoke('amazon-product-enrichment', {
          body: { 
            analysis_id: result.analysis.id,
            ean: ean
          }
        });
      }
    }
    
    setEnrichingAll(false);
  };

  const successCount = results.filter(r => r.success).length;
  const selectedCount = selectedIndices.size;
  const notEnrichedCount = results.filter(
    r => r.success && (!r.analysis?.amazon_enrichment_status || r.analysis.amazon_enrichment_status === 'error')
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Mes Analyses de Produits</CardTitle>
            <CardDescription>
              {successCount} produits analysés avec succès sur {results.length}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              <CheckSquare className="w-4 h-4 mr-2" />
              Tout sélectionner
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone}>
              <Square className="w-4 h-4 mr-2" />
              Tout désélectionner
            </Button>
            {notEnrichedCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEnrichAll}
                disabled={enrichingAll}
              >
                <Package className="w-4 h-4 mr-2" />
                {enrichingAll ? 'Enrichissement...' : `Enrichir avec Amazon (${notEnrichedCount})`}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[600px] pr-4">
          <Collapsible defaultOpen className="space-y-3">
            <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">📦 Liste des Produits</h3>
                <Badge variant="secondary">{results.length} produits</Badge>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent className="space-y-3">
              {results.map((result, index) => (
              <Card key={index} className={!result.success ? "opacity-50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIndices.has(index)}
                      onCheckedChange={() => toggleSelection(index)}
                      disabled={!result.success}
                    />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-lg">
                              {result.analysis?.product_name || result.product}
                            </p>
                            {result.success && result.success !== 'partial' && (
                              <Badge variant="default">Succès</Badge>
                            )}
                            {result.success === 'partial' && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Analyse partielle
                              </Badge>
                            )}
                            {!result.success && (
                              <Badge variant="destructive">Erreur</Badge>
                            )}
                            {result.success && result.analysis?.amazon_enrichment_status === 'success' && (
                              <Badge variant="secondary" className="text-xs">
                                ✅ Amazon
                              </Badge>
                            )}
                            {result.success && result.analysis?.amazon_enrichment_status === 'pending' && (
                              <Badge variant="outline" className="text-xs">
                                ⏳ Amazon
                              </Badge>
                            )}
                            {result.success && result.analysis?.amazon_enrichment_status === 'not_found' && (
                              <Badge variant="outline" className="text-xs opacity-50">
                                ❌ Introuvable
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.product}
                          </p>
                          {result.warning && (
                            <p className="text-xs text-destructive mt-1">
                              ⚠️ {result.warning}
                            </p>
                          )}
                        </div>
                        
                        {/* Action buttons for partial results */}
                        {result.success === 'partial' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleShowMissingFields(index)}
                            >
                              {showMissingFields.has(index) ? '🔽 Masquer' : '🔍 Voir champs manquants'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleShowAllData(index)}
                            >
                              {showAllData.has(index) ? '📊 Résumé' : '📋 Tous les détails'}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Missing Fields Section */}
                      {result.success === 'partial' && showMissingFields.has(index) && result.analysis?.validation_result?.missingFields && (
                        <Card className="border-destructive/50 bg-destructive/5">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                              Champs manquants ({result.analysis.validation_result.missingFields.length})
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Score de complétude : {result.analysis.validation_result.completeness_score || 0}%
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {result.analysis.validation_result.missingFields.map((field: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                                  <span className="text-destructive">❌</span>
                                  <code className="text-xs">{field}</code>
                                </div>
                              ))}
                            </div>
                            {result.analysis.validation_result.incompleteFields?.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold mb-2">Champs incomplets :</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {result.analysis.validation_result.incompleteFields.map((field: string, i: number) => (
                                    <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                                      <span className="text-yellow-500">⚠️</span>
                                      <code className="text-xs">{field}</code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* All Data Section */}
                      {showAllData.has(index) && result.analysis && (
                        <Card className="border-primary/50 bg-primary/5">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">📊 Données complètes de l'analyse</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* SEO */}
                            {result.analysis.seo && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">🔍 SEO</h4>
                                <div className="grid gap-2 text-xs pl-3">
                                  {result.analysis.seo.title && <p><strong>Titre:</strong> {result.analysis.seo.title}</p>}
                                  {result.analysis.seo.meta_description && <p><strong>Meta:</strong> {result.analysis.seo.meta_description}</p>}
                                  {result.analysis.seo.keywords && <p><strong>Mots-clés:</strong> {result.analysis.seo.keywords.join(', ')}</p>}
                                  {result.analysis.seo.score && <p><strong>Score:</strong> {result.analysis.seo.score}/100</p>}
                                </div>
                              </div>
                            )}

                            {/* Pricing */}
                            {result.analysis.pricing && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">💰 Prix & Marché</h4>
                                <div className="grid gap-2 text-xs pl-3">
                                  {result.analysis.pricing.estimated_price && <p><strong>Prix estimé:</strong> {result.analysis.pricing.estimated_price}</p>}
                                  {result.analysis.pricing.market_position && <p><strong>Position:</strong> {result.analysis.pricing.market_position}</p>}
                                  {result.analysis.pricing.competitive_analysis && (
                                    <p><strong>Analyse concurrence:</strong> {result.analysis.pricing.competitive_analysis.substring(0, 200)}...</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Competition */}
                            {result.analysis.competition && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">🏆 Concurrence</h4>
                                <div className="grid gap-2 text-xs pl-3">
                                  {result.analysis.competition.main_competitors && (
                                    <div>
                                      <strong>Concurrents principaux:</strong>
                                      <ul className="list-disc pl-5 mt-1">
                                        {result.analysis.competition.main_competitors.map((c: any, i: number) => (
                                          <li key={i}>{c.name} - {c.product} ({c.price})</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {result.analysis.competition.differentiation && (
                                    <p><strong>Différenciation:</strong> {result.analysis.competition.differentiation}</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Technical & Specs */}
                            {result.analysis.technical_specifications && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">🔧 Spécifications</h4>
                                <div className="grid gap-2 text-xs pl-3">
                                  <pre className="bg-muted p-2 rounded overflow-x-auto">
                                    {JSON.stringify(result.analysis.technical_specifications, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Use Cases */}
                            {result.analysis.use_cases && result.analysis.use_cases.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">💼 Cas d'usage</h4>
                                <ul className="list-disc pl-5 text-xs space-y-1">
                                  {result.analysis.use_cases.map((uc: string, i: number) => (
                                    <li key={i}>{uc}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Pros & Cons */}
                            <div className="grid grid-cols-2 gap-3">
                              {result.analysis.competitive_pros && result.analysis.competitive_pros.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 text-green-600">✅ Avantages</h4>
                                  <ul className="list-disc pl-5 text-xs space-y-1">
                                    {result.analysis.competitive_pros.map((pro: string, i: number) => (
                                      <li key={i}>{pro}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {result.analysis.competitive_cons && result.analysis.competitive_cons.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 text-red-600">❌ Inconvénients</h4>
                                  <ul className="list-disc pl-5 text-xs space-y-1">
                                    {result.analysis.competitive_cons.map((con: string, i: number) => (
                                      <li key={i}>{con}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Environmental & Repairability */}
                            <div className="grid grid-cols-2 gap-3">
                              {result.analysis.environmental_impact && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">🌱 Impact environnemental</h4>
                                  <div className="text-xs space-y-1">
                                    {result.analysis.environmental_impact.recyclability_score && (
                                      <p>Recyclabilité: {result.analysis.environmental_impact.recyclability_score}/100</p>
                                    )}
                                    {result.analysis.environmental_impact.eco_score && (
                                      <p>Eco-score: {result.analysis.environmental_impact.eco_score}/100</p>
                                    )}
                                  </div>
                                </div>
                              )}
                              {result.analysis.repairability && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">🔧 Réparabilité</h4>
                                  <div className="text-xs space-y-1">
                                    {result.analysis.repairability.score && (
                                      <p>Score: {result.analysis.repairability.score}/10</p>
                                    )}
                                    {result.analysis.repairability.ease_of_repair && (
                                      <p>{result.analysis.repairability.ease_of_repair}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Global Report */}
                            {result.analysis.global_report && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">📊 Rapport global</h4>
                                <div className="grid gap-2 text-xs pl-3">
                                  {result.analysis.global_report.overall_score && (
                                    <p><strong>Score:</strong> {result.analysis.global_report.overall_score}/100</p>
                                  )}
                                  {result.analysis.global_report.strengths && result.analysis.global_report.strengths.length > 0 && (
                                    <div>
                                      <strong>Points forts:</strong>
                                      <ul className="list-disc pl-5 mt-1">
                                        {result.analysis.global_report.strengths.map((s: string, i: number) => (
                                          <li key={i}>{s}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {result.analysis.global_report.priority_actions && result.analysis.global_report.priority_actions.length > 0 && (
                                    <div>
                                      <strong>Actions prioritaires:</strong>
                                      <ul className="list-disc pl-5 mt-1">
                                        {result.analysis.global_report.priority_actions.map((a: string, i: number) => (
                                          <li key={i}>{a}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Web Sources */}
                            {result.analysis.web_sources && result.analysis.web_sources.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">🌐 Sources consultées</h4>
                                <ul className="list-disc pl-5 text-xs space-y-1">
                                  {result.analysis.web_sources.map((source: string, i: number) => (
                                    <li key={i}>
                                      <a href={source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                        {source}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Quick Summary */}
                      {result.success && result.analysis && !showAllData.has(index) && (
                        <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {result.analysis.pricing?.estimated_price && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-muted-foreground text-xs">Prix</p>
                              <p className="font-semibold">
                                {result.analysis.pricing.estimated_price}
                              </p>
                            </div>
                          )}

                          {/* Enrichments Summary */}
                          {(() => {
                            const enrichments = getEnrichments(result);
                            if (!enrichments) return null;
                            
                            return (
                              <>
                                {enrichments?.categories?.success && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-muted-foreground text-xs">Catégories</p>
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      🏷️ {enrichments.categories.google?.name || enrichments.categories.amazon?.name || 'Mappée'}
                                    </Badge>
                                  </div>
                                )}

                                {enrichments?.images?.urls?.length > 0 && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-muted-foreground text-xs">Images</p>
                                    <p className="font-semibold flex items-center gap-1">
                                      <ImageIcon className="w-4 h-4" />
                                      {enrichments.images.urls.length}
                                    </p>
                                  </div>
                                )}

                                {enrichments?.shopping?.competitors > 0 && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-muted-foreground text-xs">Google Shopping</p>
                                    <p className="font-semibold flex items-center gap-1">
                                      <ShoppingCart className="w-4 h-4" />
                                      {enrichments.shopping.competitors}
                                    </p>
                                  </div>
                                )}

                                {enrichments?.advanced && (
                                  <div className="col-span-2 p-3 bg-muted rounded-lg">
                                    <p className="text-muted-foreground text-xs mb-2">Enrichissements Avancés</p>
                                    <div className="flex flex-wrap gap-1">
                                      {enrichments.advanced.specifications && (
                                        <Badge variant="secondary" className="text-xs">📋 Specs</Badge>
                                      )}
                                      {enrichments.advanced.technical_description && (
                                        <Badge variant="secondary" className="text-xs">📝 Tech</Badge>
                                      )}
                                      {enrichments.advanced.cost_analysis && (
                                        <Badge variant="secondary" className="text-xs">💰 Coûts</Badge>
                                      )}
                                      {enrichments.advanced.rsgp_compliance && (
                                        <Badge variant="secondary" className="text-xs">✅ RGPD</Badge>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {enrichments?.odoo?.attributes && Object.keys(enrichments.odoo.attributes).length > 0 && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-muted-foreground text-xs">Attributs Odoo</p>
                                    <p className="font-semibold flex items-center gap-1">
                                      <Package className="w-4 h-4" />
                                      {Object.keys(enrichments.odoo.attributes).length}
                                    </p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          
                          {(() => {
                            const mappings = taxonomyMappings.get(result.analysis.id) || [];
                            const googleTaxonomy = mappings.find(m => m.taxonomy_type === 'google');
                            const amazonTaxonomy = mappings.find(m => m.taxonomy_type === 'amazon');
                            
                            if (googleTaxonomy || amazonTaxonomy) {
                              return (
                                <div className="col-span-2 p-3 bg-muted rounded-lg">
                                  <p className="text-muted-foreground text-xs mb-2">Taxonomies</p>
                                  <div className="flex flex-col gap-2">
                                    {googleTaxonomy && (
                                      <div className="flex items-center gap-1 text-xs">
                                        <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                                          <ShoppingCart className="w-3 h-3" />
                                          <span className="font-mono">[{googleTaxonomy.category_id}]</span>
                                        </Badge>
                                        <span className="font-semibold truncate">
                                          {googleTaxonomy.category_path}
                                        </span>
                                      </div>
                                    )}
                                    {amazonTaxonomy && (
                                      <div className="flex items-center gap-1 text-xs">
                                        <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
                                          <Package className="w-3 h-3" />
                                          <span className="font-mono">[{amazonTaxonomy.category_id}]</span>
                                        </Badge>
                                        <span className="font-semibold truncate">
                                          {amazonTaxonomy.category_path}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {result.analysis.global_report?.overall_score && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-muted-foreground text-xs">Score Global</p>
                              <p className="font-semibold">
                                {result.analysis.global_report.overall_score}/100
                              </p>
                            </div>
                          )}
                          {result.imageUrls && result.imageUrls.length > 0 && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-muted-foreground text-xs">Images</p>
                              <p className="font-semibold flex items-center gap-1">
                                <ImageIcon className="w-4 h-4" />
                                {result.imageUrls.length}
                              </p>
                            </div>
                          )}
                        </div>
                        </>
                      )}

                      {/* Images Gallery */}
                      {result.success && result.imageUrls && result.imageUrls.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Images trouvées:</p>
                            <ProductImageGallery 
                              images={result.imageUrls} 
                              productName={result.analysis?.product_name || result.product}
                            />
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {result.imageUrls.slice(0, 5).map((url, imgIdx) => (
                              <img
                                key={imgIdx}
                                src={url}
                                alt={`Product ${imgIdx + 1}`}
                                className="w-full h-20 object-cover rounded border"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Detailed Analysis - Collapsible */}
                      {result.success && result.analysis && (
                        <Collapsible open={expandedIndices.has(index)}>
                          <div className="flex gap-2">
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => toggleExpanded(index)}
                              >
                                {expandedIndices.has(index) ? (
                                  <>
                                    <ChevronUp className="w-4 h-4 mr-2" />
                                    Masquer les détails
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-4 h-4 mr-2" />
                                    Voir tous les détails
                                  </>
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newShowAll = new Set(showAllData);
                                if (newShowAll.has(index)) {
                                  newShowAll.delete(index);
                                } else {
                                  newShowAll.add(index);
                                }
                                setShowAllData(newShowAll);
                              }}
                            >
                              {showAllData.has(index) ? '📋 Vue normale' : '🔍 Tout afficher'}
                            </Button>
                            {result.analysis?.id && (
                              <div className="flex-1">
                                <ProductAIChat 
                                  analysisId={result.analysis.id}
                                  productName={result.analysis.analysis_result?.product_name || result.analysis.product_name || result.product}
                                />
                              </div>
                            )}
                          </div>
                          <CollapsibleContent className="mt-4 space-y-4">
                            {/* SEO Section */}
                            {result.analysis.seo && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  🎯 Optimisation SEO
                                  <Badge variant="outline">{result.analysis.seo.score}/100</Badge>
                                </h4>
                                <div className="space-y-1 text-sm bg-muted p-3 rounded">
                                  <p><strong>Titre:</strong> {result.analysis.seo.title}</p>
                                  <p><strong>Meta Description:</strong> {result.analysis.seo.meta_description}</p>
                                  <p><strong>Mots-clés:</strong> {result.analysis.seo.keywords?.join(', ')}</p>
                                </div>
                              </div>
                            )}

                            <Separator />

                            {/* PHASE 3: Informations Commerciales Complètes */}
                            {(() => {
                              const enrichments = getEnrichments(result);
                              const costAnalysis = enrichments?.advanced?.cost_analysis;
                              const pricing = result.analysis?.pricing;
                              const competition = result.analysis?.competition;
                              
                              if (costAnalysis || pricing || competition) {
                                return (
                                  <>
                                    <div className="space-y-3">
                                      <h4 className="font-semibold text-sm">💼 Informations Commerciales</h4>
                                      
                                      {/* Pricing de base */}
                                      {pricing && (
                                        <div className="bg-muted p-3 rounded">
                                          <strong className="text-sm">💰 Tarification:</strong>
                                          <div className="mt-2 text-sm space-y-1">
                                            <p><strong>Position marché:</strong> {pricing.market_position}</p>
                                            <p><strong>Analyse concurrentielle:</strong> {pricing.competitive_analysis}</p>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Analyse de coûts enrichie */}
                                      {costAnalysis && (
                                        <Collapsible>
                                          <CollapsibleTrigger asChild>
                                            <Button variant="outline" size="sm" className="w-full justify-between">
                                              💰 Analyse détaillée des coûts
                                              <ChevronDown className="h-4 w-4" />
                                            </Button>
                                          </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-3 bg-muted rounded">
                <pre className="text-xs overflow-auto whitespace-pre-wrap">
                  {typeof costAnalysis === 'string' 
                    ? costAnalysis 
                    : JSON.stringify(costAnalysis, null, 2)}
                </pre>
              </CollapsibleContent>
                                        </Collapsible>
                                      )}
                                      
                                      {/* Concurrence */}
                                      {competition && (
                                        <div className="bg-muted p-3 rounded">
                                          <strong className="text-sm">🏆 Concurrence:</strong>
                                          <div className="mt-2 text-sm space-y-1">
                                            <p><strong>Principaux concurrents:</strong> {competition.main_competitors?.join(', ')}</p>
                                            <p><strong>Différenciation:</strong> {competition.differentiation}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <Separator />
                                  </>
                                );
                              }
                              return null;
                            })()}


                            {/* Trends Section */}
                            {result.analysis.trends && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  📈 Tendances du Marché
                                  <Badge variant="outline">{result.analysis.trends.popularity_score}/100</Badge>
                                </h4>
                                <div className="space-y-1 text-sm bg-muted p-3 rounded">
                                  <p><strong>Tendance:</strong> {result.analysis.trends.market_trend}</p>
                                  <p><strong>Perspectives:</strong> {result.analysis.trends.future_outlook}</p>
                                </div>
                              </div>
                            )}

                            <Separator />

                            {/* Description Section */}
                            {result.analysis.description && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">📝 Description Optimisée</h4>
                                <div className="space-y-1 text-sm bg-muted p-3 rounded">
                                  <div className="whitespace-pre-wrap">
                                    {typeof result.analysis.description.suggested_description === 'string'
                                      ? result.analysis.description.suggested_description
                                      : typeof result.analysis.description.suggested_description === 'object'
                                      ? JSON.stringify(result.analysis.description.suggested_description, null, 2)
                                      : String(result.analysis.description.suggested_description || '')}
                                  </div>
                                  {result.analysis.description.key_features && Array.isArray(result.analysis.description.key_features) && (
                                    <div className="mt-2">
                                      <strong>Caractéristiques clés:</strong>
                                      <ul className="list-disc list-inside mt-1">
                                        {result.analysis.description.key_features.map((feature: string, i: number) => (
                                          <li key={i}>{feature}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* PHASE 1: Description Complète Enrichie */}
                            {(() => {
                              const enrichments = getEnrichments(result);
                              const baseDescription = result.analysis?.analysis_result?.description;
                              const enrichedDescription = enrichments?.advanced?.summary;
                              const technicalDescription = enrichments?.advanced?.technical_description;
                              
                              if (baseDescription || enrichedDescription || technicalDescription) {
                                return (
                                  <>
                                    <Separator />
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-sm">📝 Description Complète</h4>
                                      <div className="space-y-3 text-sm bg-muted p-4 rounded">
                                        {baseDescription && (
                                          <div>
                                            <strong className="text-primary">Description de base:</strong>
                                            <pre className="mt-1 text-muted-foreground whitespace-pre-wrap text-sm">
                                              {typeof baseDescription === 'string'
                                                ? baseDescription
                                                : JSON.stringify(baseDescription, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                        {enrichedDescription && (
                                          <div>
                                            <strong className="text-primary">Description enrichie:</strong>
                                            <pre className="mt-1 text-muted-foreground whitespace-pre-wrap text-sm">
                                              {typeof enrichedDescription === 'string' 
                                                ? enrichedDescription 
                                                : JSON.stringify(enrichedDescription, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                        {technicalDescription && (
                                          <div>
                                            <strong className="text-primary">Description technique:</strong>
                                            <pre className="mt-1 text-muted-foreground whitespace-pre-wrap text-sm">
                                              {typeof technicalDescription === 'string'
                                                ? technicalDescription
                                                : JSON.stringify(technicalDescription, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                );
                              }
                              return null;
                            })()}

                            <Separator />

                            {/* Image Optimization Section */}
                            {result.analysis.image_optimization && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  📸 Optimisation Images
                                  <Badge variant="outline">{result.analysis.image_optimization.quality_score}/100</Badge>
                                </h4>
                                <div className="space-y-2 text-sm bg-muted p-3 rounded">
                                  <p><strong>Angles suggérés:</strong> {result.analysis.image_optimization.suggested_angles?.join(', ')}</p>
                                  <p><strong>Style photographique:</strong> {result.analysis.image_optimization.photography_style}</p>
                                  {result.analysis.image_optimization.recommended_colors && (
                                    <div className="flex gap-2 mt-2">
                                      <strong>Couleurs recommandées:</strong>
                                      {result.analysis.image_optimization.recommended_colors.map((color: string, i: number) => (
                                        <div
                                          key={i}
                                          className="w-6 h-6 rounded border"
                                          style={{ backgroundColor: color }}
                                          title={color}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <Separator />

                            {/* Tags & Categories */}
                            {result.analysis.tags_categories && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">🏷️ Tags & Catégories</h4>
                                <div className="flex flex-wrap gap-2">
                                  {result.analysis.tags_categories.suggested_tags?.map((tag: string, i: number) => (
                                    <Badge key={i} variant="secondary">{tag}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <Separator />

                            {/* PHASE 4: Rapport Global Enrichi */}
                            {(() => {
                              const enrichments = getEnrichments(result);
                              const globalReport = result.analysis?.global_report;
                              const advancedEnrichment = enrichments?.advanced;
                              
                              if (globalReport || advancedEnrichment) {
                                return (
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-sm">📊 Rapport Global & Enrichissements</h4>
                                    
                                    {/* Rapport de base */}
                                    {globalReport && (
                                      <div className="bg-muted p-3 rounded space-y-3">
                                        {globalReport.strengths && (
                                          <div>
                                            <strong className="text-sm">✅ Points forts:</strong>
                                            <ul className="list-disc list-inside mt-1 text-sm">
                                              {globalReport.strengths.map((strength: string, i: number) => (
                                                <li key={i} className="text-green-600">{strength}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        
                                        {globalReport.weaknesses && (
                                          <div>
                                            <strong className="text-sm">⚠️ Points faibles:</strong>
                                            <ul className="list-disc list-inside mt-1 text-sm">
                                              {globalReport.weaknesses.map((weakness: string, i: number) => (
                                                <li key={i} className="text-orange-600">{weakness}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        
                                        {globalReport.priority_actions && (
                                          <div>
                                            <strong className="text-sm">🎯 Actions prioritaires:</strong>
                                            <ul className="list-disc list-inside mt-1 text-sm">
                                              {globalReport.priority_actions.map((action: string, i: number) => (
                                                <li key={i}>{action}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
          {/* Résumé enrichi */}
          {advancedEnrichment?.summary && (
            <div className="bg-muted p-3 rounded">
              <strong className="text-sm">✨ Résumé enrichi IA:</strong>
              <pre className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {typeof advancedEnrichment.summary === 'string'
                  ? advancedEnrichment.summary
                  : JSON.stringify(advancedEnrichment.summary, null, 2)}
              </pre>
            </div>
          )}
                                    
                                    {/* Web enrichment */}
                                    {advancedEnrichment?.web_enrichment && (
                                      <Collapsible>
                                        <CollapsibleTrigger asChild>
                                          <Button variant="outline" size="sm" className="w-full justify-between">
                                            🌐 Enrichissement Web
                                            <ChevronDown className="h-4 w-4" />
                                          </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="mt-2 p-3 bg-muted rounded">
                                          <p className="text-sm whitespace-pre-wrap">
                                            {typeof advancedEnrichment.web_enrichment === 'string' 
                                              ? advancedEnrichment.web_enrichment 
                                              : JSON.stringify(advancedEnrichment.web_enrichment, null, 2)}
                                          </p>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* NOUVELLES SECTIONS D'ENRICHISSEMENTS */}
                            {(() => {
                              const enrichments = getEnrichments(result);
                              if (!enrichments) return null;
                              
                              return (
                                <>
                                  {/* Section Catégories */}
                                  {enrichments.categories?.success && (
                                    <>
                                      <Separator />
                                      <div className="space-y-2">
                                        <h4 className="font-semibold text-sm flex items-center gap-2">
                                          🏷️ Catégorisation automatique
                                        </h4>
                                        <div className="space-y-2 text-sm bg-muted p-3 rounded">
                                          {enrichments.categories.google && (
                                            <div>
                                              <strong>Google:</strong> {enrichments.categories.google.path || enrichments.categories.google.name}
                                              {enrichments.categories.google.id && (
                                                <Badge variant="outline" className="ml-2">
                                                  ID: {enrichments.categories.google.id}
                                                </Badge>
                                              )}
                                            </div>
                                          )}
                                          {enrichments.categories.amazon && (
                                            <div>
                                              <strong>Amazon:</strong> {enrichments.categories.amazon.path || enrichments.categories.amazon.name}
                                              {enrichments.categories.amazon.id && (
                                                <Badge variant="outline" className="ml-2">
                                                  ID: {enrichments.categories.amazon.id}
                                                </Badge>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Section Images trouvées */}
                                  {enrichments.images?.images?.length > 0 && (
                                    <>
                                      <Separator />
                                      <div className="space-y-2">
                                        <h4 className="font-semibold text-sm flex items-center gap-2">
                                          🖼️ Images trouvées ({enrichments.images.images.length})
                                        </h4>
                                        <div className="grid grid-cols-3 gap-2">
                                          {enrichments.images.images.slice(0, 9).map((img: any, idx: number) => (
                                            <div key={idx} className="relative">
                                              <img
                                                src={img.thumbnail || img.url}
                                                alt={img.title || `Image ${idx + 1}`}
                                                className="w-full h-32 object-cover rounded border hover:scale-105 transition-transform cursor-pointer"
                                                onError={(e) => {
                                                  e.currentTarget.style.display = 'none';
                                                }}
                                                onClick={() => window.open(img.url, '_blank')}
                                              />
                                              {img.source && (
                                                <Badge variant="secondary" className="absolute bottom-1 right-1 text-xs">
                                                  {img.source}
                                                </Badge>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Section Google Shopping */}
                                  {enrichments.shopping && enrichments.shopping.success !== false && (
                                    <>
                                      <Separator />
                                      <div className="space-y-2">
                                        <h4 className="font-semibold text-sm flex items-center gap-2">
                                          🛒 Résultats Google Shopping
                                        </h4>
                                        <div className="space-y-2 text-sm bg-muted p-3 rounded">
                                          {enrichments.shopping.competitors && (
                                            <p><strong>Concurrents trouvés:</strong> {enrichments.shopping.competitors}</p>
                                          )}
                                          {enrichments.shopping.price_range && (
                                            <p><strong>Gamme de prix:</strong> {enrichments.shopping.price_range}</p>
                                          )}
                                          {enrichments.shopping.top_sellers && Array.isArray(enrichments.shopping.top_sellers) && (
                                            <p><strong>Top vendeurs:</strong> {enrichments.shopping.top_sellers.join(', ')}</p>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Section Enrichissements Avancés */}
                                  {enrichments.advanced && (
                                    <>
                                      <Separator />
                                      <div className="space-y-3">
                                        <h4 className="font-semibold text-sm flex items-center gap-2">
                                          ✨ Enrichissements Avancés
                                        </h4>
                                        
                                        {/* PHASE 2: Spécifications COMPLÈTES */}
                                        {(() => {
                                          const specs = enrichments.advanced?.specifications || 
                                                        enrichments.advanced?.summary || 
                                                        result.analysis?.analysis_result?.specifications;
                                          
                                          if (specs) {
                                            return (
                                              <Collapsible>
                                                <CollapsibleTrigger asChild>
                                                  <Button variant="outline" size="sm" className="w-full justify-between">
                                                    📋 Spécifications techniques complètes
                                                    <ChevronDown className="h-4 w-4" />
                                                  </Button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2 p-3 bg-muted rounded">
                                                  {typeof specs === 'string' ? (
                                                    <div className="text-sm whitespace-pre-wrap">{specs}</div>
                                                  ) : typeof specs === 'object' ? (
                                                    <div className="space-y-2 text-sm">
                                                      {Object.entries(specs).map(([key, value]) => (
                                                        <div key={key} className="border-b pb-2 last:border-0">
                                                          <strong className="text-primary capitalize">
                                                            {key.replace(/_/g, ' ')}:
                                                          </strong>
                                                          <p className="mt-1 text-muted-foreground">
                                                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                                          </p>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="text-sm">Aucune spécification disponible</p>
                                                  )}
                                                </CollapsibleContent>
                                              </Collapsible>
                                            );
                                          }
                                          return null;
                                        })()}
                                        
                                        {/* Description technique */}
                                        {enrichments.advanced.technical_description && (
                                          <Collapsible>
                                            <CollapsibleTrigger asChild>
                                              <Button variant="outline" size="sm" className="w-full justify-between">
                                                📝 Description technique
                                                <ChevronDown className="h-4 w-4" />
                                              </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="mt-2 p-3 bg-muted rounded text-sm">
                                              {enrichments.advanced.technical_description}
                                            </CollapsibleContent>
                                          </Collapsible>
                                        )}
                                        
                                        {/* Analyse coûts */}
                                        {enrichments.advanced.cost_analysis && (
                                          <Collapsible>
                                            <CollapsibleTrigger asChild>
                                              <Button variant="outline" size="sm" className="w-full justify-between">
                                                💰 Analyse des coûts
                                                <ChevronDown className="h-4 w-4" />
                                              </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="mt-2 p-3 bg-muted rounded">
                                              <pre className="text-xs overflow-auto whitespace-pre-wrap">
                                                {typeof enrichments.advanced.cost_analysis === 'string' 
                                                  ? enrichments.advanced.cost_analysis 
                                                  : JSON.stringify(enrichments.advanced.cost_analysis, null, 2)}
                                              </pre>
                                            </CollapsibleContent>
                                          </Collapsible>
                                        )}
                                        
                                        {/* Conformité RGPD */}
                                        {enrichments.advanced.rsgp_compliance && (
                                          <Collapsible>
                                            <CollapsibleTrigger asChild>
                                              <Button variant="outline" size="sm" className="w-full justify-between">
                                                ✅ Conformité RGPD
                                                <ChevronDown className="h-4 w-4" />
                                              </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="mt-2 p-3 bg-muted rounded">
                                              <div className="space-y-2 text-sm">
                                                {typeof enrichments.advanced.rsgp_compliance === 'object' ? (
                                                  <>
                                                    {enrichments.advanced.rsgp_compliance.status && (
                                                      <p><strong>Statut:</strong> {enrichments.advanced.rsgp_compliance.status}</p>
                                                    )}
                                                    {enrichments.advanced.rsgp_compliance.documents_found && (
                                                      <p><strong>Documents trouvés:</strong> {enrichments.advanced.rsgp_compliance.documents_found}</p>
                                                    )}
                                                    {enrichments.advanced.rsgp_compliance.certifications && Array.isArray(enrichments.advanced.rsgp_compliance.certifications) && (
                                                      <p><strong>Certifications:</strong> {enrichments.advanced.rsgp_compliance.certifications.join(', ')}</p>
                                                    )}
                                                  </>
                                                ) : (
                                                  <p>{String(enrichments.advanced.rsgp_compliance)}</p>
                                                )}
                                              </div>
                                            </CollapsibleContent>
                                          </Collapsible>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* Section Attributs Odoo */}
                                  {enrichments.odoo?.attributes && Object.keys(enrichments.odoo.attributes).length > 0 && (
                                    <>
                                      <Separator />
                                      <div className="space-y-2">
                                        <h4 className="font-semibold text-sm flex items-center gap-2">
                                          📋 Attributs Odoo
                                          <Badge variant="secondary">{Object.keys(enrichments.odoo.attributes).length} attributs</Badge>
                                        </h4>
                                        <ScrollArea className="h-64">
                                          <div className="space-y-1 text-sm bg-muted p-3 rounded">
                                            {Object.entries(enrichments.odoo.attributes).map(([key, value]) => (
                                              <div key={key} className="flex justify-between border-b pb-1 last:border-0">
                                                <span className="font-medium">{key}:</span>
                                                <span className="text-right ml-2">{String(value)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </ScrollArea>
                                      </div>
                                    </>
                                  )}

                                  {/* Section Erreurs d'enrichissement */}
                                  {(enrichments.categories?.success === false || 
                                    enrichments.images?.success === false || 
                                    enrichments.shopping?.success === false ||
                                    enrichments.odoo?.success === false) && (
                                    <>
                                      <Separator />
                                      <div className="space-y-2">
                                        <h4 className="font-semibold text-sm flex items-center gap-2 text-destructive">
                                          ⚠️ Erreurs d'enrichissement
                                        </h4>
                                        <div className="space-y-2 text-sm bg-destructive/10 p-3 rounded">
                                          {enrichments.categories?.success === false && (
                                            <p>
                                              <strong>Catégorisation:</strong> {enrichments.categories.message || 'Erreur inconnue'}
                                            </p>
                                          )}
                                          {enrichments.images?.success === false && (
                                            <p>
                                              <strong>Images:</strong> {enrichments.images.message || 'Erreur inconnue'}
                                            </p>
                                          )}
                                          {enrichments.shopping?.success === false && (
                                            <p>
                                              <strong>Google Shopping:</strong> {enrichments.shopping.message || 'Erreur inconnue'}
                                            </p>
                                          )}
                                          {enrichments.odoo?.success === false && (
                                            <p>
                                              <strong>Attributs Odoo:</strong> {enrichments.odoo.message || 'Erreur inconnue'}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </>
                              );
                            })()}

                            {/* PHASE 5: Vue Complète Debug */}
                            {showAllData.has(index) && (
                              <>
                                <Separator />
                                <div className="mt-4 p-4 bg-muted rounded">
                                  <h4 className="font-semibold mb-2">🔍 Données brutes complètes</h4>
                                  <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                                    {JSON.stringify({
                                      analysis: result.analysis,
                                      enrichments: getEnrichments(result),
                                    }, null, 2)}
                                  </pre>
                                </div>
                              </>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {!result.success && result.error && (
                        <p className="text-sm text-destructive">{result.error}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedCount} produit(s) sélectionné(s)
          </p>
          <Button
            onClick={handleExport}
            disabled={selectedCount === 0}
          >
            <Upload className="w-4 h-4 mr-2" />
            Exporter vers Odoo ({selectedCount})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
