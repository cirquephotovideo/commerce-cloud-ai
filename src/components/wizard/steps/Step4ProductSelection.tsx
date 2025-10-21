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
  const { state, selectProducts, goToStep } = useWizard();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(state.selectedProducts));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, [state.operationType]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Pour import/enrichment/export : charger les produits existants
      if (state.operationType === 'import' || state.operationType === 'enrichment' || state.operationType === 'export') {
        const { data, error } = await supabase
          .from('product_analyses')
          .select('id, analysis_result, image_urls, created_at')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        setProducts(data || []);
      }
      // Pour analysis : pas besoin de sélection (un seul produit analysé)
      else if (state.operationType === 'analysis') {
        setProducts([]);
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

  const filteredProducts = products.filter((p) =>
    p.analysis_result?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.analysis_result?.ean?.includes(search)
  );

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
      <div>
        <h2 className="text-2xl font-bold mb-2">Sélection Produits</h2>
        <p className="text-muted-foreground">
          Choisissez les produits à traiter ({selected.size} sélectionné{selected.size > 1 ? 's' : ''})
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou EAN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
                          src={product.image_urls?.[0] || '/placeholder.svg'}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                        <span className="font-medium">{product.analysis_result?.name || 'Sans nom'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.analysis_result?.ean || 'N/A'}
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

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => goToStep(3)}>Précédent</Button>
        <Button 
          onClick={() => goToStep(5)} 
          disabled={selected.size === 0}
        >
          Continuer {selected.size > 0 && `(${selected.size})`}
        </Button>
      </div>
    </div>
  );
};
