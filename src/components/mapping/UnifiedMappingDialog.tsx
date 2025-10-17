import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UnifiedMappingWizard } from "./UnifiedMappingWizard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UnifiedMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
  sourceType: 'email' | 'ftp' | 'file' | 'api';
}

export function UnifiedMappingDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  sourceType
}: UnifiedMappingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl">
            🗺️ Configuration du mapping - {supplierName}
          </DialogTitle>
          <DialogDescription>
            Configurez le mapping des colonnes pour ce fournisseur de manière visuelle et interactive
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)] px-6 pb-6">
          <UnifiedMappingWizard
            supplierId={supplierId}
            sourceType={sourceType}
            onSave={() => {
              onOpenChange(false);
            }}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
