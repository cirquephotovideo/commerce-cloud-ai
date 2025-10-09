import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface SupplierConnectionConfigProps {
  supplierType: string;
  config: any;
  onConfigChange: (config: any) => void;
}

export function SupplierConnectionConfig({ supplierType, config, onConfigChange }: SupplierConnectionConfigProps) {
  const updateConfig = (key: string, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  if (supplierType === 'ftp' || supplierType === 'sftp') {
    return (
      <div className="space-y-4 border rounded-lg p-4">
        <h3 className="font-medium">Configuration {supplierType.toUpperCase()}</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="host">Hôte</Label>
            <Input
              id="host"
              value={config.host || ''}
              onChange={(e) => updateConfig('host', e.target.value)}
              placeholder="ftp.example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              value={config.port || (supplierType === 'sftp' ? 22 : 21)}
              onChange={(e) => updateConfig('port', parseInt(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Nom d'utilisateur</Label>
            <Input
              id="username"
              value={config.username || ''}
              onChange={(e) => updateConfig('username', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={config.password || ''}
              onChange={(e) => updateConfig('password', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="remote_path">Chemin du fichier</Label>
          <Input
            id="remote_path"
            value={config.remote_path || '/products.csv'}
            onChange={(e) => updateConfig('remote_path', e.target.value)}
            placeholder="/path/to/products.csv"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="delimiter">Délimiteur CSV</Label>
            <Input
              id="delimiter"
              value={config.delimiter || ';'}
              onChange={(e) => updateConfig('delimiter', e.target.value)}
              maxLength={1}
            />
          </div>

          <div className="flex items-center space-x-2 pt-8">
            <input
              type="checkbox"
              id="skip_first_row"
              checked={config.skip_first_row !== false}
              onChange={(e) => updateConfig('skip_first_row', e.target.checked)}
            />
            <Label htmlFor="skip_first_row">Ignorer première ligne</Label>
          </div>
        </div>
      </div>
    );
  }

  if (supplierType === 'api') {
    return (
      <div className="space-y-4 border rounded-lg p-4">
        <h3 className="font-medium">Configuration API</h3>
        
        <div className="space-y-2">
          <Label htmlFor="api_url">URL de l'API</Label>
          <Input
            id="api_url"
            value={config.api_url || ''}
            onChange={(e) => updateConfig('api_url', e.target.value)}
            placeholder="https://api.supplier.com/products"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="method">Méthode HTTP</Label>
            <Select
              value={config.method || 'GET'}
              onValueChange={(value) => updateConfig('method', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth_type">Type d'authentification</Label>
            <Select
              value={config.auth_type || 'none'}
              onValueChange={(value) => updateConfig('auth_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="apikey">API Key</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {config.auth_type === 'bearer' && (
          <div className="space-y-2">
            <Label htmlFor="api_key">Token Bearer</Label>
            <Input
              id="api_key"
              type="password"
              value={config.api_key || ''}
              onChange={(e) => updateConfig('api_key', e.target.value)}
            />
          </div>
        )}

        {config.auth_type === 'basic' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api_username">Nom d'utilisateur</Label>
              <Input
                id="api_username"
                value={config.username || ''}
                onChange={(e) => updateConfig('username', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_password">Mot de passe</Label>
              <Input
                id="api_password"
                type="password"
                value={config.password || ''}
                onChange={(e) => updateConfig('password', e.target.value)}
              />
            </div>
          </div>
        )}

        {config.auth_type === 'apikey' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api_key_header">Nom du header</Label>
              <Input
                id="api_key_header"
                value={config.api_key_header || 'X-API-Key'}
                onChange={(e) => updateConfig('api_key_header', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_key">Clé API</Label>
              <Input
                id="api_key"
                type="password"
                value={config.api_key || ''}
                onChange={(e) => updateConfig('api_key', e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="data_path">Chemin des données (optionnel)</Label>
          <Input
            id="data_path"
            value={config.data_path || 'products'}
            onChange={(e) => updateConfig('data_path', e.target.value)}
            placeholder="products ou data.items"
          />
          <p className="text-xs text-muted-foreground">
            Si la réponse est {"{"}"products": [...]{"}"}, entrez "products"
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Devise</Label>
          <Input
            id="currency"
            value={config.currency || 'EUR'}
            onChange={(e) => updateConfig('currency', e.target.value)}
            maxLength={3}
          />
        </div>
      </div>
    );
  }

  if (supplierType === 'email') {
    return (
      <div className="space-y-4 border rounded-lg p-4">
        <h3 className="font-medium">Configuration Email</h3>
        <p className="text-sm text-muted-foreground">
          Les catalogues reçus par email doivent être importés manuellement via l'assistant d'import CSV.
        </p>
        <div className="space-y-2">
          <Label htmlFor="email_address">Adresse email du contact</Label>
          <Input
            id="email_address"
            type="email"
            value={config.email_address || ''}
            onChange={(e) => updateConfig('email_address', e.target.value)}
            placeholder="contact@supplier.com"
          />
        </div>
      </div>
    );
  }

  return null;
}
