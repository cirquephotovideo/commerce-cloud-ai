import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { CheckSquare, Square, Upload, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Separator } from "./ui/separator";
import { ProductImageGallery } from "./ProductImageGallery";

interface BatchResult {
  product: string;
  analysis?: any;
  imageUrls?: string[];
  error?: string;
  success: boolean;
}

interface DetailedBatchResultsProps {
  results: BatchResult[];
  onExport: (selectedProducts: any[]) => void;
}

export const DetailedBatchResults = ({ results, onExport }: DetailedBatchResultsProps) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

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

  const successCount = results.filter(r => r.success).length;
  const selectedCount = selectedIndices.size;

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
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-lg">
                              {result.analysis?.product_name || result.product}
                            </p>
                            {result.success ? (
                              <Badge variant="default">Succès</Badge>
                            ) : (
                              <Badge variant="destructive">Erreur</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.product}
                          </p>
                        </div>
                      </div>

                      {/* Quick Summary */}
                      {result.success && result.analysis && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {result.analysis.pricing?.estimated_price && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-muted-foreground text-xs">Prix</p>
                              <p className="font-semibold">
                                {result.analysis.pricing.estimated_price}
                              </p>
                            </div>
                          )}
                          {result.analysis.tags_categories?.primary_category && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-muted-foreground text-xs">Catégorie</p>
                              <p className="font-semibold">
                                {result.analysis.tags_categories.primary_category}
                              </p>
                            </div>
                          )}
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
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
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

                            {/* Pricing Section */}
                            {result.analysis.pricing && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">💰 Analyse Tarifaire</h4>
                                <div className="space-y-1 text-sm bg-muted p-3 rounded">
                                  <p><strong>Position marché:</strong> {result.analysis.pricing.market_position}</p>
                                  <p><strong>Analyse concurrentielle:</strong> {result.analysis.pricing.competitive_analysis}</p>
                                </div>
                              </div>
                            )}

                            <Separator />

                            {/* Competition Section */}
                            {result.analysis.competition && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">🏆 Concurrence</h4>
                                <div className="space-y-1 text-sm bg-muted p-3 rounded">
                                  <p><strong>Principaux concurrents:</strong> {result.analysis.competition.main_competitors?.join(', ')}</p>
                                  <p><strong>Différenciation:</strong> {result.analysis.competition.differentiation}</p>
                                </div>
                              </div>
                            )}

                            <Separator />

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
                                  <p>{result.analysis.description.suggested_description}</p>
                                  {result.analysis.description.key_features && (
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

                            {/* Global Report */}
                            {result.analysis.global_report && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">📊 Rapport Global</h4>
                                <div className="space-y-2 text-sm bg-muted p-3 rounded">
                                  <div>
                                    <strong>Points forts:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                      {result.analysis.global_report.strengths?.map((strength: string, i: number) => (
                                        <li key={i} className="text-green-600">{strength}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <strong>Points faibles:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                      {result.analysis.global_report.weaknesses?.map((weakness: string, i: number) => (
                                        <li key={i} className="text-orange-600">{weakness}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <strong>Actions prioritaires:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                      {result.analysis.global_report.priority_actions?.map((action: string, i: number) => (
                                        <li key={i}>{action}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
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
