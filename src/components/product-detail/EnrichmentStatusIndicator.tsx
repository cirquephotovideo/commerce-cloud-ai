import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";

interface EnrichmentStatusIndicatorProps {
  status?: string | null;
  label?: string;
}

export const EnrichmentStatusIndicator = ({ status, label }: EnrichmentStatusIndicatorProps) => {
  if (status === 'completed') {
    return (
      <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1">
        <CheckCircle2 className="w-3 h-3" />
        {label ? `${label} ✓` : 'Complété'}
      </Badge>
    );
  }
  
  if (status === 'processing') {
    return (
      <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        {label ? `${label} ⏳` : 'En cours'}
      </Badge>
    );
  }
  
  if (status === 'failed') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="w-3 h-3" />
        {label ? `${label} ✗` : 'Échec'}
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Clock className="w-3 h-3" />
      {label ? `${label} ⏸` : 'Manquant'}
    </Badge>
  );
};
