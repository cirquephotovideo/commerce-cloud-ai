import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";

interface SupplierConnectionConfigProps {
  supplierType: string;
  config: any;
  onConfigChange: (config: any) => void;
}

export function SupplierConnectionConfig({ supplierType, config, onConfigChange }: SupplierConnectionConfigProps) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [availableDirs, setAvailableDirs] = useState<string[]>([]);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');

  // Debug logs for config changes
  useEffect(() => {
    console.log('🔍 [SupplierConnectionConfig] config updated:', {
      host: config?.host || '❌ missing',
      username: config?.username || '❌ missing',
      password: config?.password ? '✅ set' : '❌ missing',
      fullConfig: config
    });
  }, [config]);

  const updateConfig = (key: string, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };
  
  // Validation for FTP/SFTP configuration
  const isValidFTPConfig = config?.host && config?.username && config?.password;

  const handleTestFTPConnection = async (customPath?: string) => {
    if (!config?.host || !config?.username || !config?.password) {
      toast({
        title: "❌ Configuration incomplète",
        description: "Veuillez renseigner host, username et password",
        variant: "destructive",
      });
      return;
    }

    // Robust host and port parsing
    let cleanedHost = '';
    let extractedPort: number | null = null;
    let scheme = '';

    try {
      const hostValue = config.host.trim();
      
      // Detect SFTP (not supported)
      if (hostValue.toLowerCase().startsWith('sftp://') || hostValue.toLowerCase().startsWith('sftp:')) {
        toast({
          title: "❌ SFTP non supporté",
          description: "Ce connecteur supporte FTP/FTPS uniquement. SFTP n'est pas encore supporté.",
          variant: "destructive",
        });
        return;
      }

      // Try parsing as URL if contains ://
      if (hostValue.includes('://')) {
        const url = new URL(hostValue);
        scheme = url.protocol.replace(':', '');
        cleanedHost = url.hostname;
        if (url.port) {
          extractedPort = parseInt(url.port, 10);
        }
      } else {
        // Manual parsing: remove any scheme prefix
        let cleaned = hostValue.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
        // Remove path
        cleaned = cleaned.split('/')[0];
        // Extract port if present (host:port)
        if (cleaned.includes(':')) {
          const [hostPart, portPart] = cleaned.split(':');
          cleanedHost = hostPart.trim();
          extractedPort = parseInt(portPart, 10);
        } else {
          cleanedHost = cleaned.trim();
        }
      }

      // Validate cleaned host
      if (!cleanedHost || cleanedHost.length < 3) {
        toast({
          title: "❌ Hôte invalide",
          description: `Le nom d'hôte "${config.host}" n'est pas valide. Utilisez un domaine comme ftp.secomp.fr`,
          variant: "destructive",
        });
        return;
      }

      // Update port config if extracted from host
      if (extractedPort && extractedPort !== config.port) {
        updateConfig('port', extractedPort);
      }
    } catch (error) {
      toast({
        title: "❌ Format d'hôte invalide",
        description: `Impossible d'analyser "${config.host}". Utilisez un format valide (ex: ftp.secomp.fr)`,
        variant: "destructive",
      });
      return;
    }

    const pathToTest = customPath || currentPath;
    setTesting(true);
    setConnectionSuccess(false);
    
    try {
      const finalPort = extractedPort || config.port || 21;
      
      const { data, error } = await supabase.functions.invoke('test-ftp-connection', {
        body: {
          host: cleanedHost,
          port: finalPort,
          username: config.username,
          password: config.password,
          path: pathToTest,
        },
      });

      if (error) throw error;

      if (data.success) {
        setAvailableFiles(data.files || []);
        setAvailableDirs(data.dirs || []);
        setCurrentPath(pathToTest);
        setConnectionSuccess(true);
        toast({
          title: "✅ Connexion réussie",
          description: data.message || `${data.files?.length || 0} fichiers, ${data.dirs?.length || 0} dossiers`,
        });
      } else {
        setConnectionSuccess(false);
        setAvailableFiles([]);
        setAvailableDirs([]);
        
        // Provide clearer error messages for DNS issues
        let errorMessage = data.message || data.error || "Erreur inconnue";
        if (errorMessage.includes('failed to lookup address') || errorMessage.includes('Name or service not known')) {
          errorMessage = `Impossible de résoudre le nom d'hôte "${cleanedHost}". Vérifiez l'orthographe ou utilisez l'adresse IP directe.`;
        }
        
        toast({
          title: "❌ Échec de connexion",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Test FTP error:', error);
      setConnectionSuccess(false);
      setAvailableFiles([]);
      setAvailableDirs([]);
      toast({
        title: "❌ Erreur",
        description: error instanceof Error ? error.message : "Erreur de connexion",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestPrestaShopConnection = async () => {
    if (!config?.platform_url || !config?.api_key) {
      toast({
        title: "❌ Configuration incomplète",
        description: "Veuillez renseigner l'URL et la clé API",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setConnectionSuccess(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-prestashop-connection', {
        body: {
          url: config.platform_url,
          apiKey: config.api_key,
        },
      });

      if (error) throw error;

      if (data.success) {
        setConnectionSuccess(true);
        toast({
          title: "✅ Connexion réussie",
          description: data.message || "Connexion à PrestaShop établie",
        });
      } else {
        setConnectionSuccess(false);
        toast({
          title: "❌ Échec de connexion",
          description: data.message || data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Test PrestaShop error:', error);
      setConnectionSuccess(false);
      toast({
        title: "❌ Erreur",
        description: error instanceof Error ? error.message : "Erreur de connexion",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
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
              placeholder="ftp.secomp.fr"
            />
            <p className="text-xs text-muted-foreground">
              Entrez un domaine FTP/FTPS (ex: ftp.secomp.fr ou ftp.example.com:2121). SFTP non supporté. Le chemin se configure ci-dessous.
            </p>
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
          <Label htmlFor="ftp_directory">📁 Dossier FTP à parcourir</Label>
          <div className="flex gap-2">
            <Input
              id="ftp_directory"
              value={currentPath}
              onChange={(e) => setCurrentPath(e.target.value)}
              placeholder="/ ou /incoming ou /export"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => handleTestFTPConnection()}
              disabled={testing}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : '🔍 Lister'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Changez le dossier et cliquez sur "Lister" pour explorer. Suggestions: /, /incoming, /export, /data
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={connectionSuccess ? "default" : "outline"}
            onClick={() => handleTestFTPConnection()}
            disabled={testing || !isValidFTPConfig}
            className="flex-1"
          >
            {!isValidFTPConfig ? (
              <>❌ Configuration incomplète ({
                [!config?.host && 'host', !config?.username && 'username', !config?.password && 'password']
                  .filter(Boolean).join(', ')
              })</>
            ) : testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test en cours...
              </>
            ) : connectionSuccess ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                ✅ Connexion OK
              </>
            ) : (
              '🔌 Tester la connexion'
            )}
          </Button>
        </div>

        <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
          <Label>📂 Fichiers et dossiers disponibles</Label>
          
          {availableDirs.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Dossiers ({availableDirs.length}):</p>
              <div className="flex flex-wrap gap-1">
                {availableDirs.map((dir) => (
                  <Button
                    key={dir}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newPath = currentPath === '/' ? `/${dir}` : `${currentPath}/${dir}`;
                      setCurrentPath(newPath);
                      handleTestFTPConnection(newPath);
                    }}
                    className="h-7 text-xs"
                  >
                    📁 {dir}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {availableFiles.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Fichiers CSV/XLSX ({availableFiles.filter(f => f.match(/\.(csv|xlsx)$/i)).length}):</p>
              <Select
                value={config.remote_path || ''}
                onValueChange={(value) => updateConfig('remote_path', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un fichier..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFiles
                    .filter(f => f.match(/\.(csv|xlsx)$/i))
                    .map((file) => {
                      const fullPath = currentPath === '/' ? `/${file}` : `${currentPath}/${file}`;
                      return (
                        <SelectItem key={file} value={fullPath}>
                          📄 {file}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          ) : connectionSuccess ? (
            <p className="text-sm text-muted-foreground">
              Aucun fichier CSV/XLSX trouvé dans <code className="bg-background px-1 rounded">{currentPath}</code>. 
              Essayez un autre dossier ci-dessus.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Testez la connexion pour voir les fichiers disponibles. Suggestions de dossiers courants: 
              <code className="bg-background px-1 rounded mx-1">/</code>
              <code className="bg-background px-1 rounded mx-1">/incoming</code>
              <code className="bg-background px-1 rounded mx-1">/export</code>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="remote_path">Chemin du fichier CSV/XLSX</Label>
          <Input
            id="remote_path"
            value={config.remote_path || ''}
            onChange={(e) => updateConfig('remote_path', e.target.value)}
            placeholder="/edi-excel.csv ou /products.csv"
          />
          <p className="text-xs text-muted-foreground">
            Utilisez le sélecteur ci-dessus ou entrez le chemin manuellement
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="delimiter">Délimiteur CSV</Label>
            <Input
              id="delimiter"
              value={config.csv_delimiter || ';'}
              onChange={(e) => updateConfig('csv_delimiter', e.target.value)}
              maxLength={1}
              placeholder=";"
            />
          </div>

          <div className="flex items-center space-x-2 pt-8">
            <input
              type="checkbox"
              id="skip_first_row"
              checked={config.skip_first_row !== false}
              onChange={(e) => updateConfig('skip_first_row', e.target.checked)}
            />
            <Label htmlFor="skip_first_row">Ignorer première ligne (en-tête)</Label>
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

  if (supplierType === 'prestashop') {
    return (
      <div className="space-y-4 border rounded-lg p-4">
        <h3 className="font-medium">Configuration PrestaShop</h3>
        
        <div className="space-y-2">
          <Label htmlFor="platform_url">URL de la boutique PrestaShop</Label>
          <Input
            id="platform_url"
            value={config.platform_url || ''}
            onChange={(e) => updateConfig('platform_url', e.target.value)}
            placeholder="https://votre-boutique.com"
          />
          <p className="text-xs text-muted-foreground">
            URL complète de votre boutique PrestaShop (sans /api)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_key">Clé API PrestaShop</Label>
          <Input
            id="api_key"
            type="password"
            value={config.api_key || ''}
            onChange={(e) => updateConfig('api_key', e.target.value)}
            placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          />
          <p className="text-xs text-muted-foreground">
            Clé API générée dans PrestaShop → Paramètres avancés → Webservice
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleTestPrestaShopConnection}
          disabled={testing || !config.api_key || !config.platform_url}
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Test en cours...
            </>
          ) : (
            <>
              {connectionSuccess ? (
                <CheckCircle className="w-4 h-4 mr-2" />
              ) : null}
              Tester la connexion
            </>
          )}
        </Button>
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
