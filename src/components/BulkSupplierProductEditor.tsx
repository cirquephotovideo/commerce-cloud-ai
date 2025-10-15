import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Link2, Sparkles, Download, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkSupplierProductEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: Set<string>;
  onComplete?: () => void;
}

type BulkAction = 'delete' | 'link' | 'update_price' | 'update_stock' | 'export';

export function BulkSupplierProductEditor({
  open,
  onOpenChange,
  selectedProducts,
  onComplete,
}: BulkSupplierProductEditorProps) {
  const [action, setAction] = useState<BulkAction>('link');
  const [priceOperation, setPriceOperation] = useState<'multiply' | 'add'>('multiply');
  const [priceValue, setPriceValue] = useState('1');
  const [stockValue, setStockValue] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCount = selectedProducts.size;

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer définitivement ${selectedCount} produit(s) ?`)) return;

    setIsProcessing(true);
    try {
      const productIds = Array.from(selectedProducts);
      
      // Supprimer les liens
      await supabase
        .from('product_links')
        .delete()
        .in('supplier_product_id', productIds);
      
      // Supprimer les produits
      const { error } = await supabase
        .from('supplier_products')
        .delete()
        .in('id', productIds);
      
      if (error) throw error;
      toast.success(`${selectedCount} produit(s) supprimé(s)`);
      onComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkLink = async () => {
    setIsProcessing(true);
    let linked = 0;
    try {
      const productIds = Array.from(selectedProducts);
      
      for (const productId of productIds) {
        // Récupérer le produit fournisseur
        const { data: supplierProduct } = await supabase
          .from('supplier_products')
          .select('ean')
          .eq('id', productId)
          .single();
        
        if (!supplierProduct?.ean) continue;
        
        // Chercher un produit analysé avec le même EAN
        const { data: analysis } = await supabase
          .from('product_analyses')
          .select('id')
          .ilike('analysis_result->>ean', supplierProduct.ean)
          .maybeSingle();
        
        if (analysis) {
          // Créer le lien
          await supabase.from('product_links').upsert({
            supplier_product_id: productId,
            analysis_id: analysis.id,
            link_type: 'auto',
            confidence_score: 100
          }, {
            onConflict: 'supplier_product_id,analysis_id'
          });
          linked++;
        }
      }
      
      toast.success(`${linked} produit(s) lié(s) automatiquement`);
      onComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de la liaison");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUpdatePrice = async () => {
    setIsProcessing(true);
    try {
      const productIds = Array.from(selectedProducts);
      const value = parseFloat(priceValue);
      
      if (isNaN(value)) {
        toast.error("Valeur invalide");
        return;
      }
      
      // Récupérer tous les produits
      const { data: products } = await supabase
        .from('supplier_products')
        .select('id, purchase_price')
        .in('id', productIds);
      
      if (!products) return;
      
      // Calculer les nouveaux prix
      const updates = products.map(p => {
        let newPrice = p.purchase_price || 0;
        if (priceOperation === 'multiply') {
          newPrice *= value;
        } else {
          newPrice += value;
        }
        return { id: p.id, purchase_price: Math.max(0, newPrice) };
      });
      
      // Mettre à jour en masse
      for (const update of updates) {
        await supabase
          .from('supplier_products')
          .update({ purchase_price: update.purchase_price })
          .eq('id', update.id);
      }
      
      toast.success(`${selectedCount} prix mis à jour`);
      onComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de la mise à jour des prix");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUpdateStock = async () => {
    setIsProcessing(true);
    try {
      const productIds = Array.from(selectedProducts);
      const value = parseInt(stockValue);
      
      if (isNaN(value)) {
        toast.error("Valeur invalide");
        return;
      }
      
      const { error } = await supabase
        .from('supplier_products')
        .update({ stock_quantity: value })
        .in('id', productIds);
      
      if (error) throw error;
      toast.success(`${selectedCount} stocks mis à jour`);
      onComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de la mise à jour des stocks");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    switch (action) {
      case 'delete':
        await handleBulkDelete();
        break;
      case 'link':
        await handleBulkLink();
        break;
      case 'update_price':
        await handleBulkUpdatePrice();
        break;
      case 'update_stock':
        await handleBulkUpdateStock();
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Édition en masse</DialogTitle>
          <DialogDescription>
            {selectedCount} produit{selectedCount > 1 ? "s" : ""} sélectionné{selectedCount > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Action à effectuer</Label>
            <Select value={action} onValueChange={(v: any) => setAction(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="link">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Auto-lier par EAN
                  </div>
                </SelectItem>
                <SelectItem value="update_price">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Modifier les prix
                  </div>
                </SelectItem>
                <SelectItem value="update_stock">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Modifier les stocks
                  </div>
                </SelectItem>
                <SelectItem value="delete">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {action === 'update_price' && (
            <div className="space-y-3">
              <div>
                <Label>Opération</Label>
                <Select value={priceOperation} onValueChange={(v: any) => setPriceOperation(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiply">Multiplier par</SelectItem>
                    <SelectItem value="add">Ajouter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valeur</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  placeholder={priceOperation === 'multiply' ? "1.1" : "5.00"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {priceOperation === 'multiply' 
                    ? "Ex: 1.1 = +10%, 0.9 = -10%"
                    : "Ex: 5.00 = +5€, -5.00 = -5€"
                  }
                </p>
              </div>
            </div>
          )}

          {action === 'update_stock' && (
            <div>
              <Label>Nouveau stock</Label>
              <Input
                type="number"
                value={stockValue}
                onChange={(e) => setStockValue(e.target.value)}
                placeholder="100"
              />
            </div>
          )}

          {action === 'delete' && (
            <div className="p-4 bg-destructive/10 rounded-lg text-sm text-destructive">
              ⚠️ Cette action est irréversible. {selectedCount} produit(s) et leurs liens seront supprimés définitivement.
            </div>
          )}

          {action === 'link' && (
            <div className="p-4 bg-primary/10 rounded-lg text-sm">
              ℹ️ Les produits avec un EAN valide seront automatiquement liés aux analyses correspondantes.
            </div>
          )}

          <Button
            onClick={handleExecute}
            disabled={isProcessing}
            className="w-full"
            variant={action === 'delete' ? 'destructive' : 'default'}
          >
            {isProcessing ? "Traitement..." : "Exécuter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
