import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWizard } from '@/contexts/UniversalWizardContext';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const Step4ProductSelection = () => {
  const { state, selectProducts, goToStep } = useWizard();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(state.selectedProducts));

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('product_analyses')
      .select('id, analysis_result, image_urls')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) setProducts(data);
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
    p.analysis_result?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Sélection Produits</h2>
        <p className="text-muted-foreground">Choisissez les produits à traiter ({selected.size} sélectionné{selected.size > 1 ? 's' : ''})</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selected.size === filteredProducts.length}
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
            {filteredProducts.map((product) => (
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
                  <Badge variant="secondary">Enrichi</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => goToStep(3)}>Précédent</Button>
        <Button onClick={() => goToStep(5)} disabled={selected.size === 0}>
          Continuer ({selected.size})
        </Button>
      </div>
    </div>
  );
};
