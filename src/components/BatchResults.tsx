import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { CheckSquare, Square, Upload, ShoppingCart, Package } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface BatchResult {
  product: string;
  analysis?: any;
  error?: string;
  success: boolean;
}

interface BatchResultsProps {
  results: BatchResult[];
  onExport: (selectedProducts: any[]) => void;
}

export const BatchResults = ({ results, onExport }: BatchResultsProps) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [taxonomyMappings, setTaxonomyMappings] = useState<Map<string, any[]>>(new Map());

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

  // Helper functions for robust data extraction
  const getPrice = (result: any) => {
    if (!result.analysis) return "N/A";
    
    // Try multiple possible paths
    const price = result.analysis?.pricing?.estimated_price ||
                  result.analysis?.price ||
                  result.analysis?.product_price;
                  
    if (!price) return "N/A";
    
    // Extract number from price string
    const match = String(price).match(/[\d,.]+/);
    return match ? `${match[0]}€` : "N/A";
  };

  const getScore = (result: any) => {
    if (!result.analysis) return 0;
    
    return result.analysis?.global_report?.overall_score ||
           result.analysis?.score ||
           result.analysis?.quality_score ||
           0;
  };

  const getCategory = (result: any) => {
    if (!result.analysis) return null;
    
    return result.analysis?.tags_categories?.primary_category ||
           result.analysis?.category ||
           null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Résultats d'Analyse</CardTitle>
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
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {results.map((result, index) => (
              <Card key={index} className={!result.success ? "opacity-50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIndices.has(index)}
                      onCheckedChange={() => toggleSelection(index)}
                      disabled={!result.success}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {result.analysis?.product_name || result.product}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {result.product}
                          </p>
                        </div>
                        {result.success ? (
                          <Badge variant="default">Succès</Badge>
                        ) : (
                          <Badge variant="destructive">Erreur</Badge>
                        )}
                      </div>

                      {result.success && result.analysis && (
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-muted-foreground">Prix: </span>
                              <span className="font-medium">
                                {getPrice(result)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Score: </span>
                              <span className="font-medium">
                                {getScore(result)}/100
                              </span>
                            </div>
                          </div>
                          {(() => {
                            const mappings = taxonomyMappings.get(result.analysis.id) || [];
                            const googleTaxonomy = mappings.find(m => m.taxonomy_type === 'google');
                            const amazonTaxonomy = mappings.find(m => m.taxonomy_type === 'amazon');
                            
                            if (googleTaxonomy || amazonTaxonomy) {
                              return (
                                <div className="flex flex-col gap-1 pt-2">
                                  {googleTaxonomy && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                                        <ShoppingCart className="w-3 h-3" />
                                        <span className="font-mono">[{googleTaxonomy.category_id}]</span>
                                      </Badge>
                                      <span className="font-medium truncate">
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
                                      <span className="font-medium truncate">
                                        {amazonTaxonomy.category_path}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      
                      {result.success && result.analysis?.error && (
                        <p className="text-sm text-orange-600">
                          ⚠️ Analyse partielle: {result.analysis.error}
                        </p>
                      )}

                      {!result.success && result.error && (
                        <p className="text-sm text-destructive">{result.error}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
