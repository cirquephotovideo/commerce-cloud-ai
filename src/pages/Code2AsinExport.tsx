import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Code2AsinExport() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("not_started");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Fetch products with EAN
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-with-ean', selectedCategory, selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from('product_analyses')
        .select('id, ean, analysis_result, category, code2asin_enrichment_status')
        .not('ean', 'is', null)
        .neq('ean', '');

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('code2asin_enrichment_status', selectedStatus);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Get unique categories
  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_analyses')
        .select('category')
        .not('category', 'is', null);
      
      if (error) throw error;
      const unique = [...new Set(data.map(p => p.category))];
      return unique;
    }
  });

  const toggleProduct = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
    setSelectAll(!selectAll);
  };

  const exportEANBatches = (productsToExport: typeof products) => {
    const BATCH_SIZE = 50000;
    const eans = productsToExport
      .filter(p => p.ean)
      .map(p => p.ean);
    
    const batches: string[][] = [];
    for (let i = 0; i < eans.length; i += BATCH_SIZE) {
      batches.push(eans.slice(i, i + BATCH_SIZE));
    }
    
    batches.forEach((batch, index) => {
      const csv = 'EAN\n' + batch.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `code2asin_export_batch_${index + 1}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      link.click();
    });
    
    toast.success(`✅ ${batches.length} fichier(s) CSV généré(s) (${eans.length} EAN)`);
  };

  const exportSelected = () => {
    const selected = products.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) {
      toast.error("Veuillez sélectionner au moins un produit");
      return;
    }
    exportEANBatches(selected);
  };

  const exportAllNonEnriched = () => {
    const nonEnriched = products.filter(p => 
      p.code2asin_enrichment_status === 'not_started' || 
      p.code2asin_enrichment_status === 'failed'
    );
    
    if (nonEnriched.length === 0) {
      toast.error("Aucun produit non-enrichi trouvé");
      return;
    }
    
    exportEANBatches(nonEnriched);
  };

  const selectedCount = selectedIds.size;
  const batchCount = Math.ceil(selectedCount / 50000);
  const nonEnrichedCount = products.filter(p => 
    p.code2asin_enrichment_status === 'not_started' || 
    p.code2asin_enrichment_status === 'failed'
  ).length;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            📤 Export EAN pour Code2ASIN
          </CardTitle>
          <CardDescription>
            Exportez vos EAN par paquets de 50 000 pour enrichissement externe via code2asin.com
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Catégorie</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Statut enrichissement</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="not_started">Non enrichis</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="completed">Complétés</SelectItem>
                  <SelectItem value="failed">Échoués</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Stats */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>{products.length}</strong> produits disponibles • 
              <strong className="ml-2">{nonEnrichedCount}</strong> non enrichis • 
              <strong className="ml-2">{selectedCount}</strong> sélectionnés
              {selectedCount > 0 && ` • ${batchCount} fichier(s) à générer`}
            </AlertDescription>
          </Alert>
          
          {/* Sélection */}
          <div className="flex items-center gap-2 py-2 border-b">
            <Checkbox
              checked={selectAll}
              onCheckedChange={toggleSelectAll}
            />
            <label className="text-sm font-medium cursor-pointer" onClick={toggleSelectAll}>
              Tout sélectionner ({products.length})
            </label>
          </div>
          
          {/* Liste produits */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {products.map(product => (
              <div 
                key={product.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                onClick={() => toggleProduct(product.id)}
              >
                <Checkbox
                  checked={selectedIds.has(product.id)}
                  onCheckedChange={() => toggleProduct(product.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">
                    {(product.analysis_result as any)?.product_name || 'Produit sans nom'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    EAN: {product.ean} • {product.category || 'Non catégorisé'}
                  </div>
                </div>
                <div className="text-xs">
                  {product.code2asin_enrichment_status === 'completed' && (
                    <span className="text-green-600">✓ Enrichi</span>
                  )}
                  {product.code2asin_enrichment_status === 'not_started' && (
                    <span className="text-gray-500">Non enrichi</span>
                  )}
                  {product.code2asin_enrichment_status === 'failed' && (
                    <span className="text-red-600">Échoué</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={exportAllNonEnriched}
              variant="outline"
              disabled={nonEnrichedCount === 0}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Exporter tous les non-enrichis ({nonEnrichedCount})
            </Button>
            <Button
              onClick={exportSelected}
              disabled={selectedCount === 0}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Exporter {selectedCount} sélectionnés
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
