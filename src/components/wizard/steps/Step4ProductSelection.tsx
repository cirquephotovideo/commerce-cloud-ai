import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Search, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export const Step4ProductSelection = () => {
  const { state, selectProducts, goToStep, updateConfiguration } = useWizard();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(state.selectedProducts));
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);
  const [bulkSelect, setBulkSelect] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [state.operationType, page, search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Pour import/enrichment/export : charger les produits existants
      if (state.operationType === 'import' || state.operationType === 'enrichment' || state.operationType === 'export') {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from('product_analyses')
          .select('id, analysis_result, image_urls, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        // Filtrer côté serveur si recherche active
        if (search.trim()) {
          const q = search.trim();
          query = query.or(
            `analysis_result->>product_name.ilike.%${q}%,analysis_result->>ean_barcode.ilike.%${q}%,analysis_result->>description.ilike.%${q}%`
          );
        }

        const { data, count, error } = await query;
        
        if (error) throw error;
        setProducts(data || []);
        setTotalCount(count || 0);
      }
      // Pour analysis : pas besoin de sélection (un seul produit analysé)
      else if (state.operationType === 'analysis') {
        setProducts([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
    selectProducts(Array.from(newSelected));
  };

  // Le filtrage se fait côté serveur maintenant, pas besoin de filtrer à nouveau
  const filteredProducts = products;

  const handleSelectAll = () => {
    const newSelected = new Set(selected);
    filteredProducts.forEach(p => newSelected.add(p.id));
    setSelected(newSelected);
    selectProducts(Array.from(newSelected));
  };

  const handleDeselectAll = () => {
    const currentPageIds = new Set(filteredProducts.map(p => p.id));
    const newSelected = new Set(Array.from(selected).filter(id => !currentPageIds.has(id)));
    setSelected(newSelected);
    selectProducts(Array.from(newSelected));
  };

  const handleBulkSelectAll = () => {
    setBulkSelect(true);
    setSelected(new Set());
    selectProducts([]);
    updateConfiguration({
      selectionMode: search ? 'filtered' : 'all',
      selectionFilter: search || null,
      selectionCount: totalCount,
    });
  };

  const handleCancelBulkSelect = () => {
    setBulkSelect(false);
    updateConfiguration({
      selectionMode: 'manual',
      selectionFilter: null,
      selectionCount: selected.size,
    });
  };

  const handleContinue = () => {
    if (bulkSelect) {
      updateConfiguration({
        selectionMode: search ? 'filtered' : 'all',
        selectionFilter: search || null,
        selectionCount: totalCount,
      });
    } else {
      updateConfiguration({
        selectionMode: 'manual',
        selectionFilter: null,
        selectionCount: selected.size,
      });
    }
    goToStep(5);
  };

  // Pour l'analyse, passer directement à l'étape 5
  if (state.operationType === 'analysis') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Sélection Produits</h2>
          <p className="text-muted-foreground">Configuration pour l'analyse d'un produit unique</p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            L'analyse porte sur un seul produit configuré à l'étape 3. 
            Passez directement aux options avancées.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => goToStep(3)}>Précédent</Button>
          <Button onClick={() => goToStep(5)}>Continuer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Sélection Produits</h2>
          <p className="text-muted-foreground">
            {bulkSelect
              ? `Tous les ${totalCount.toLocaleString()} produits sélectionnés`
              : `${selected.size} / ${totalCount.toLocaleString()} produits sélectionnés`}
          </p>
        </div>
        {(bulkSelect || selected.size > 0) && (
          <Badge variant={bulkSelect ? "default" : "secondary"} className="text-base px-4 py-2">
            {bulkSelect ? `Tous (${totalCount.toLocaleString()})` : `${selected.size} sélectionné${selected.size > 1 ? 's' : ''}`}
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Rechercher par nom, EAN ou description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0); // Reset à la page 1 lors d'une recherche
              setBulkSelect(false); // Annuler la sélection globale
            }}
            className="pl-10"
          />
        </div>

        {/* Barre d'actions de sélection */}
        <div className="flex flex-wrap gap-2 items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex flex-wrap gap-2">
            {!bulkSelect ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  Sélectionner la page ({filteredProducts.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeselectAll}
                  disabled={selected.size === 0}
                >
                  Désélectionner la page
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkSelectAll}
                >
                  Sélectionner tous les {totalCount.toLocaleString()} produits
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelBulkSelect}
              >
                Annuler sélection globale
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Affichage {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} sur {totalCount.toLocaleString()}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Aucun produit trouvé. Importez d'abord des produits avant de pouvoir les enrichir ou les exporter.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredProducts.length > 0 && selected.size === filteredProducts.length}
                    onCheckedChange={() => {
                      if (selected.size === filteredProducts.length) {
                        setSelected(new Set());
                        selectProducts([]);
                      } else {
                        const allIds = filteredProducts.map((p) => p.id);
                        setSelected(new Set(allIds));
                        selectProducts(allIds);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>EAN</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucun produit ne correspond à votre recherche
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image_urls?.[0] || product.analysis_result?.imageUrls?.[0] || '/placeholder.svg'}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                        <span className="font-medium">{product.analysis_result?.product_name || 'Sans nom'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.analysis_result?.ean_barcode || 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">Disponible</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Contrôles de pagination */}
      {!loading && totalCount > pageSize && (
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Page précédente
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} sur {Math.ceil(totalCount / pageSize)}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * pageSize >= totalCount}
          >
            Page suivante
          </Button>
        </div>
      )}

      {/* Boutons de navigation */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => goToStep(3)}>Précédent</Button>
        <Button
          onClick={handleContinue}
          disabled={!bulkSelect && selected.size === 0}
        >
          Continuer {bulkSelect ? `(tous: ${totalCount.toLocaleString()})` : (selected.size > 0 ? `(${selected.size})` : '')}
        </Button>
      </div>
    </div>
  );
};
