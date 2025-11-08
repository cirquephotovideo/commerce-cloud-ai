import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Settings, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { PlatformImportProgress } from "./PlatformImportProgress";

interface PlatformImportCardProps {
  platform: {
    id: string;
    platform_type: string;
    platform_url: string;
    is_active: boolean;
    last_sync_at?: string;
  };
  onImport: (platformId: string) => void;
  onConfigure: (platformId: string) => void;
  isImporting?: boolean;
  jobId?: string | null;
}

const platformIcons: Record<string, string> = {
  odoo: "🏢",
  prestashop: "🛒",
  woocommerce: "🔷",
  magento: "🔶",
  shopify: "🛍️",
};

const platformNames: Record<string, string> = {
  odoo: "Odoo ERP",
  prestashop: "PrestaShop",
  woocommerce: "WooCommerce",
  magento: "Magento",
  shopify: "Shopify",
};

export const PlatformImportCard = ({
  platform,
  onImport,
  onConfigure,
  isImporting = false,
  jobId = null,
}: PlatformImportCardProps) => {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">
              {platformIcons[platform.platform_type] || "📦"}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {platformNames[platform.platform_type] || platform.platform_type}
              </h3>
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                {platform.platform_url}
              </p>
            </div>
          </div>
          
          {platform.is_active ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Actif
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <XCircle className="w-3 h-3" />
              Inactif
            </Badge>
          )}
        </div>

        {/* Last sync */}
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Dernière synchro :</span>{" "}
          {platform.last_sync_at ? (
            <span>
              {formatDistanceToNow(new Date(platform.last_sync_at), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          ) : (
            <span className="text-warning">Jamais</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => onImport(platform.id)}
            disabled={!platform.is_active || isImporting}
            className="flex-1"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            {isImporting ? "Import en cours..." : "Importer"}
          </Button>
          <Button
            onClick={() => onConfigure(platform.id)}
            variant="outline"
            size="sm"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress section */}
        {isImporting && jobId && (
          <PlatformImportProgress platformId={platform.id} jobId={jobId} />
        )}
      </div>
    </Card>
  );
};
