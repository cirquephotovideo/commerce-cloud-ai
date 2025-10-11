import { Badge } from "@/components/ui/badge";
import { Loader2, ImageIcon, Video, Package, FileText, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnrichmentData {
  status: 'available' | 'pending' | 'missing';
  count?: number;
}

interface EnrichmentBadgesProps {
  enrichmentStatus: {
    images?: EnrichmentData;
    video?: EnrichmentData;
    amazon?: EnrichmentData;
    description?: EnrichmentData;
    rsgp?: EnrichmentData;
    specs?: EnrichmentData;
  };
  onBadgeClick?: (type: string) => void;
  compact?: boolean;
}

export const EnrichmentBadges = ({ 
  enrichmentStatus, 
  onBadgeClick,
  compact = false 
}: EnrichmentBadgesProps) => {
  const badges = [
    {
      key: 'images',
      icon: ImageIcon,
      label: 'Images',
      data: enrichmentStatus.images
    },
    {
      key: 'video',
      icon: Video,
      label: 'Vidéo',
      data: enrichmentStatus.video
    },
    {
      key: 'amazon',
      icon: Package,
      label: 'Amazon',
      data: enrichmentStatus.amazon
    },
    {
      key: 'description',
      icon: FileText,
      label: 'Description',
      data: enrichmentStatus.description
    },
    {
      key: 'rsgp',
      icon: ShieldCheck,
      label: 'RSGP',
      data: enrichmentStatus.rsgp
    },
    {
      key: 'specs',
      icon: Wrench,
      label: 'Specs',
      data: enrichmentStatus.specs
    }
  ];

  const getVariant = (status?: string) => {
    switch (status) {
      case 'available':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'missing':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getIcon = (status?: string) => {
    switch (status) {
      case 'available':
        return '✅';
      case 'pending':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'missing':
        return '❌';
      default:
        return '⚪';
    }
  };

  return (
    <div className={cn(
      "flex flex-wrap gap-2",
      compact ? "gap-1" : "gap-2"
    )}>
      {badges.map((badge) => {
        const Icon = badge.icon;
        const status = badge.data?.status || 'missing';
        const count = badge.data?.count;
        
        return (
          <Badge
            key={badge.key}
            variant={getVariant(status)}
            className={cn(
              "cursor-pointer transition-all hover:scale-105",
              compact ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
            )}
            onClick={() => onBadgeClick?.(badge.key)}
          >
            {!compact && <Icon className="h-4 w-4 mr-1" />}
            {getIcon(status)}
            {!compact && <span className="ml-1">{badge.label}</span>}
            {count !== undefined && (
              <span className="ml-1 font-bold">({count})</span>
            )}
          </Badge>
        );
      })}
    </div>
  );
};
