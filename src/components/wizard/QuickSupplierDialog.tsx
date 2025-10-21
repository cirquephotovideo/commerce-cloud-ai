import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type SupplierType = Database['public']['Enums']['supplier_type'];

interface QuickSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSupplierCreated?: (id: string, type: SupplierType) => void;
}

export const QuickSupplierDialog = ({ open, onOpenChange, onSupplierCreated }: QuickSupplierDialogProps) => {
  const [supplierName, setSupplierName] = useState('');
  const [sourceType, setSourceType] = useState<SupplierType>('email');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!supplierName.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data, error } = await supabase
        .from('supplier_configurations')
        .insert({
          supplier_name: supplierName,
          supplier_type: sourceType,
          is_active: true,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`✅ Fournisseur "${supplierName}" créé !`);
      onSupplierCreated?.(data.id, data.supplier_type);
      onOpenChange(false);
      setSupplierName('');
      setSourceType('email');
    } catch (error: any) {
      toast.error(`Erreur : ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un nouveau fournisseur</DialogTitle>
          <DialogDescription>
            Créez rapidement un fournisseur pour continuer votre import
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="supplier-name">Nom du fournisseur *</Label>
            <Input
              id="supplier-name"
              placeholder="Ex: FVS Distribution"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="source-type">Type de source *</Label>
            <Select value={sourceType} onValueChange={(v: SupplierType) => setSourceType(v)}>
              <SelectTrigger id="source-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">📧 Email (IMAP)</SelectItem>
                <SelectItem value="ftp">🌐 FTP</SelectItem>
                <SelectItem value="sftp">🔒 SFTP</SelectItem>
                <SelectItem value="api">⚡ API REST</SelectItem>
                <SelectItem value="file">📁 Fichier CSV/Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Vous pourrez configurer les détails (IMAP, FTP, etc.) à l'étape suivante
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Création...' : 'Créer le fournisseur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
