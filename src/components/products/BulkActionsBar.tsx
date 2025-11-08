import { Button } from "@/components/ui/button";
import { Package, FileText, Video, Download, Edit, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  onRefresh: () => void;
}

export function BulkActionsBar({ selectedIds, onClear, onRefresh }: BulkActionsBarProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBulkEnrichAmazon = async () => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Add all products to enrichment queue
      const promises = selectedIds.map(analysisId =>
        supabase.from('enrichment_queue').insert({
          user_id: user.id,
          analysis_id: analysisId,
          enrichment_type: ['amazon'],
          priority: 'normal',
          status: 'pending'
        })
      );

      await Promise.all(promises);
      
      toast.success(`✨ ${selectedIds.length} produits ajoutés à la file d'enrichissement Amazon`);
      onClear();
      onRefresh();
    } catch (error: any) {
      toast.error(`❌ Erreur: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateRSGP = async () => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const promises = selectedIds.map(analysisId =>
        supabase.from('enrichment_queue').insert({
          user_id: user.id,
          analysis_id: analysisId,
          enrichment_type: ['rsgp'],
          priority: 'normal',
          status: 'pending'
        })
      );

      await Promise.all(promises);
      
      toast.success(`✨ ${selectedIds.length} fiches RSGP en cours de génération`);
      onClear();
      onRefresh();
    } catch (error: any) {
      toast.error(`❌ Erreur: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedIds.length} produits ?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('product_analyses')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      toast.success(`✓ ${selectedIds.length} produits supprimés`);
      onClear();
      onRefresh();
    } catch (error: any) {
      toast.error(`❌ Erreur: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/30 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {selectedIds.length} produit{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleBulkEnrichAmazon}
          disabled={isProcessing}
          className="bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30"
        >
          <Package className="h-4 w-4 mr-1" />
          Enrichir Amazon
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleBulkGenerateRSGP}
          disabled={isProcessing}
          className="bg-green-500/10 hover:bg-green-500/20 border-green-500/30"
        >
          <FileText className="h-4 w-4 mr-1" />
          Générer RSGP
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          disabled={isProcessing}
          className="bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30"
        >
          <Video className="h-4 w-4 mr-1" />
          Générer Vidéos
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          disabled={isProcessing}
        >
          <Download className="h-4 w-4 mr-1" />
          Exporter
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          disabled={isProcessing}
        >
          <Edit className="h-4 w-4 mr-1" />
          Modifier
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleBulkDelete}
          disabled={isProcessing}
          className="bg-destructive/10 hover:bg-destructive/20 border-destructive/30"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Supprimer
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
        >
          <X className="h-4 w-4 mr-1" />
          Annuler
        </Button>
      </div>
    </div>
  );
}
