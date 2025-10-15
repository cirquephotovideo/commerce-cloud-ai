import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, PlayCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface EdgeFunction {
  name: string;
  category: 'core' | 'export' | 'ai' | 'payment' | 'marketing' | 'amazon' | 'utility';
  status: 'operational' | 'failing' | 'untested' | 'testing';
  testPayload?: any;
  error?: string;
  latency?: number;
  lovablePrompt?: string;
}

const edgeFunctions: EdgeFunction[] = [
  // Core Functions
  { 
    name: 'product-analyzer', 
    category: 'core', 
    status: 'untested',
    testPayload: {
      productInput: "https://www.amazon.fr/dp/B0CX23V2ZK",
      includeImages: true,
      testMode: true
    }
  },
  { name: 'check-subscription', category: 'core', status: 'untested' },
  { 
    name: 'advanced-product-analyzer', 
    category: 'core', 
    status: 'untested',
    testPayload: {
      productInput: "https://www.amazon.fr/dp/B0CX23V2ZK",
      inputType: "url",
      analysisTypes: ["technical", "commercial", "risk"],
      platform: "amazon"
    }
  },
  { 
    name: 'dual-search-engine', 
    category: 'core', 
    status: 'untested',
    testPayload: { 
      productName: 'MacBook Air M2',
      competitorSiteIds: [],
      maxResults: 5,
      testMode: true
    }
  },
  
  // Amazon Functions
  { name: 'amazon-product-search', category: 'amazon', status: 'untested', testPayload: { keywords: 'laptop' } },
  { name: 'amazon-product-enrichment', category: 'amazon', status: 'untested', testPayload: { asin: 'B0CX23V2ZK' } },
  { name: 'amazon-token-manager', category: 'amazon', status: 'untested' },
  
  // AI Functions
  { 
    name: 'ai-chat', 
    category: 'ai', 
    status: 'untested',
    testPayload: {
      message: 'test',
      messages: [],
      skipAICall: true
    }
  },
  { name: 'ai-taxonomy-categorizer', category: 'ai', status: 'untested' },
  { 
    name: 'claude-proxy', 
    category: 'ai', 
    status: 'untested',
    testPayload: {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10,
      testMode: true
    }
  },
  { 
    name: 'openai-proxy', 
    category: 'ai', 
    status: 'untested',
    testPayload: {
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: 'test' }],
      max_completion_tokens: 10,
      testMode: true
    }
  },
  { 
    name: 'openrouter-proxy', 
    category: 'ai', 
    status: 'untested',
    testPayload: {
      action: 'chat',
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Say "test successful" in French' }
      ],
      max_tokens: 50
    }
  },
  { 
    name: 'ollama-proxy', 
    category: 'ai', 
    status: 'untested',
    testPayload: {
      action: 'test'
    }
  },
  
  // Export Functions
  { name: 'export-to-odoo', category: 'export', status: 'untested' },
  { name: 'export-to-shopify', category: 'export', status: 'untested' },
  { name: 'export-to-woocommerce', category: 'export', status: 'untested' },
  { name: 'export-to-prestashop', category: 'export', status: 'untested' },
  { name: 'export-to-magento', category: 'export', status: 'untested' },
  { name: 'export-to-salesforce', category: 'export', status: 'untested' },
  { name: 'export-to-sap', category: 'export', status: 'untested' },
  { name: 'export-single-product', category: 'export', status: 'untested' },
  
  // Payment Functions
  { 
    name: 'create-checkout', 
    category: 'payment', 
    status: 'untested',
    testPayload: { 
      priceId: 'price_1SDUekIhbQ0wttwsmWzWVbMa',
      billingInterval: 'monthly' 
    }
  },
  { name: 'customer-portal', category: 'payment', status: 'untested' },
  { 
    name: 'manage-subscription', 
    category: 'payment', 
    status: 'untested',
    testPayload: { 
      newPlanId: '00000000-0000-0000-0000-000000000002',
      billingInterval: 'monthly' 
    }
  },
  
  // Marketing Functions
  { name: 'send-contact-email', category: 'marketing', status: 'untested' },
  { name: 'send-email-campaign', category: 'marketing', status: 'untested' },
  { 
    name: 'manage-newsletter', 
    category: 'marketing', 
    status: 'untested',
    testPayload: {
      action: 'subscribe',
      email: 'test@example.com',
      full_name: 'Test User'
    }
  },
  
  // Utility Functions
  { 
    name: 'generate-image', 
    category: 'utility', 
    status: 'untested',
    testPayload: {
      prompt: 'A modern laptop on a desk',
      testMode: true
    }
  },
  { 
    name: 'generate-themed-image', 
    category: 'utility', 
    status: 'untested',
    testPayload: {
      prompt: 'Professional product photo of a smartphone',
      productName: 'iPhone 15 Pro',
      testMode: true
    }
  },
  { 
    name: 'search-product-images', 
    category: 'utility', 
    status: 'untested',
    testPayload: {
      productName: 'MacBook Pro M3',
      maxResults: 3,
      testMode: true
    }
  },
  { 
    name: 'google-shopping-scraper', 
    category: 'utility', 
    status: 'untested',
    testPayload: {
      productName: 'iPhone 15 Pro',
      maxResults: 5
    }
  },
  { name: 'market-intelligence', category: 'utility', status: 'untested' },
];

export const EdgeFunctionTester = () => {
  const [functions, setFunctions] = useState<EdgeFunction[]>(edgeFunctions);
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handleSelectAll = () => {
    if (selectedFunctions.size === functions.length) {
      setSelectedFunctions(new Set());
    } else {
      setSelectedFunctions(new Set(functions.map(f => f.name)));
    }
  };

  const handleSelectFunction = (functionName: string) => {
    setSelectedFunctions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(functionName)) {
        newSet.delete(functionName);
      } else {
        newSet.add(functionName);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedFunctions.size === 0) {
      toast({
        title: "⚠️ Aucune sélection",
        description: "Veuillez sélectionner au moins une fonction",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('system_health_logs')
        .delete()
        .eq('test_type', 'edge_function')
        .in('component_name', Array.from(selectedFunctions));
      
      if (error) throw error;

      setFunctions(prev => prev.map(f => 
        selectedFunctions.has(f.name) 
          ? { ...f, status: 'untested' as const, error: undefined, latency: undefined }
          : f
      ));

      setSelectedFunctions(new Set());

      window.dispatchEvent(new CustomEvent('health-metrics-updated'));

      toast({
        title: "🗑️ Tests supprimés",
        description: `${selectedFunctions.size} résultat(s) de test supprimé(s)`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const testFunction = async (functionName: string) => {
    const startTime = Date.now();
    
    setFunctions(prev => prev.map(f => 
      f.name === functionName ? { ...f, status: 'testing' as const } : f
    ));

    try {
      const func = functions.find(f => f.name === functionName);
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: func?.testPayload || {}
      });

      const latency = Date.now() - startTime;

      if (error) throw error;

      // Enregistrer le résultat dans la DB
      await supabase.from('system_health_logs').insert({
        test_type: 'edge_function',
        component_name: functionName,
        status: 'operational',
        test_result: data,
        latency_ms: latency,
        tested_by: (await supabase.auth.getUser()).data.user?.id
      });

      setFunctions(prev => prev.map(f => 
        f.name === functionName ? { ...f, status: 'operational' as const, latency } : f
      ));

      toast({
        title: "✅ Test réussi",
        description: `${functionName} fonctionne (${latency}ms)`,
      });
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      // Générer un prompt Lovable pour corriger l'erreur
      const lovablePrompt = generateFixPrompt(functionName, error.message);

      // Enregistrer l'erreur
      await supabase.from('system_health_logs').insert({
        test_type: 'edge_function',
        component_name: functionName,
        status: 'failing',
        error_message: error.message,
        latency_ms: latency,
        tested_by: (await supabase.auth.getUser()).data.user?.id
      });

      // Créer un issue de fix tracking
      await supabase.from('fix_tracking').insert({
        issue_id: `edge-${functionName}-${Date.now()}`,
        issue_type: 'edge_function',
        component_name: functionName,
        severity: 'high',
        description: error.message,
        lovable_prompt: lovablePrompt,
        created_by: (await supabase.auth.getUser()).data.user?.id
      });

      setFunctions(prev => prev.map(f => 
        f.name === functionName 
          ? { ...f, status: 'failing' as const, error: error.message, lovablePrompt, latency } 
          : f
      ));

      toast({
        title: "❌ Test échoué",
        description: error.message,
        variant: "destructive",
      });
    }
    
    // Émettre événement pour mise à jour du score
    window.dispatchEvent(new CustomEvent('health-metrics-updated'));
  };

  const generateFixPrompt = (functionName: string, errorMessage: string): string => {
    if (functionName === 'dual-search-engine') {
      return `Fix the dual-search-engine edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Support both { productName } and { query } in request
2. ✅ Validate GOOGLE_SEARCH_API_KEY or SERPER_API_KEY is set
3. ✅ Handle empty competitorSiteIds (fetch from database)
4. ✅ Add timeout protection for search API calls (10s)
5. ✅ Log all search results with [DUAL-ENGINE] prefix

Common issues:
- Missing productName → Add query fallback
- No competitor sites → Fetch from database automatically
- Search API timeout → Add fetchWithTimeout wrapper
- Price extraction failing → Improve extractPrice regex`;
    }

    if (functionName === 'product-analyzer') {
      return `Fix the product-analyzer edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Validate request body supports: { url }, { productInput }, { name }, or string
2. ✅ Test with payload: { "url": "https://www.amazon.fr/dp/B0CX23V2ZK" }
3. ✅ Verify LOVABLE_API_KEY is configured
4. ✅ Check AI response has valid JSON structure
5. ✅ Log all validation steps with [PRODUCT-ANALYZER] prefix

Common issues:
- Missing url/productInput → Add body.url validation
- Invalid JSON response → Improve JSON cleanup logic
- Image search failing → Handle search-product-images errors gracefully`;
    }

    if (functionName === 'advanced-product-analyzer') {
      return `Fix the advanced-product-analyzer edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Validate AI response has data.choices[0] before accessing
2. ✅ Handle AI API errors (429, 500, 503) gracefully
3. ✅ Test all analysis types: technical, commercial, market, risk
4. ✅ Verify LOVABLE_API_KEY and GOOGLE_SEARCH_API_KEY are set
5. ✅ Add fallback error objects if AI fails

Common issues:
- TypeError: Cannot read property '0' → Check data.choices exists
- AI timeout → Add timeout protection (30s)
- Invalid JSON → Improve safeParseAIResponse function
- Missing market analysis → Verify Google API keys`;
    }

    if (functionName === 'check-subscription') {
      return `Fix the check-subscription edge function. Error: "${errorMessage}".

This function is working perfectly! If errors occur:
1. ✅ Verify STRIPE_SECRET_KEY is configured
2. ✅ Check user has valid auth token
3. ✅ Verify subscription_plans table has correct data
4. ✅ Test with both admin and regular user accounts

Common issues:
- Stripe API errors → Check API key validity
- No customer found → Normal for new users
- Trial logic → Verify trial_end dates in database`;
    }

    if (functionName === 'ai-chat') {
      return `Fix the ai-chat edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Verify LOVABLE_API_KEY is configured
2. ✅ Handle skipAICall flag for testing
3. ✅ Validate messages array format
4. ✅ Test with: { "message": "test", "messages": [], "skipAICall": true }

Common issues:
- 402 Payment Required → Use skipAICall flag in tests
- Invalid messages format → Check array structure`;
    }

    if (functionName === 'claude-proxy') {
      return `Fix the claude-proxy edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Check user/global Claude API key configuration
2. ✅ Support testMode flag for testing without API calls
3. ✅ Validate messages format
4. ✅ Handle 402/429 errors gracefully

Common issues:
- No API key configured → Check ai_provider_configs table
- 402 errors → Use testMode: true in tests`;
    }

    if (functionName === 'openai-proxy') {
      return `Fix the openai-proxy edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Check user/global OpenAI API key configuration
2. ✅ Support testMode flag for testing
3. ✅ Use max_completion_tokens (not max_tokens for newer models)
4. ✅ Handle 402/429 errors gracefully

Common issues:
- No API key configured → Check ai_provider_configs table
- Invalid parameter → Check model-specific parameters`;
    }

    if (functionName === 'ollama-proxy') {
      return `Fix the ollama-proxy edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Support action: 'test' for connection testing
2. ✅ Check ollama_configurations table for user config
3. ✅ Validate ollama_url is accessible
4. ✅ Handle timeout errors

Common issues:
- Connection refused → Check Ollama is running
- No configuration → User needs to setup Ollama first`;
    }
    
    // Special handling for manage-newsletter
    if (functionName === 'manage-newsletter') {
      return `Fix the manage-newsletter edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Validate action is 'subscribe' or 'unsubscribe'
2. ✅ Validate email format with regex
3. ✅ Normalize email (trim + lowercase)
4. ✅ Add proper error codes (INVALID_ACTION, INVALID_EMAIL)
5. ✅ Log successful operations

Common issues:
- Invalid email format → Use EMAIL_REGEX validation
- Invalid action → Check against ['subscribe', 'unsubscribe']
- Database errors → Wrap in try/catch with detailed logs`;
    }
    
    // Special handling for google-shopping-scraper
    if (functionName === 'google-shopping-scraper') {
      return `Fix the google-shopping-scraper edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Validate at least one of productName OR productUrl provided
2. ✅ Check API keys before making requests
3. ✅ Add timeout protection (10s) on all fetch calls
4. ✅ Add proper error codes (MISSING_INPUT, NO_API_KEYS, API_TIMEOUT)
5. ✅ Log with provider name and timestamps

Common issues:
- Neither productName nor productUrl → Return 400 with hint
- Missing API keys → Check LOVABLE_API_KEY, GOOGLE_SEARCH_API_KEY, SERPER_API_KEY
- Timeout → Use fetchWithTimeout wrapper`;
    }
    
    // Special handling for openrouter-proxy
    if (functionName === 'openrouter-proxy') {
      return `Fix the openrouter-proxy edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Verify OPENROUTER_API_KEY is configured in ai_provider_configs table
2. ✅ Validate request body has: action, model, messages[]
3. ✅ Check OpenRouter API response format (should be JSON)
4. ✅ Test with payload: { action: 'chat', model: 'openai/gpt-3.5-turbo', messages: [...] }
5. ✅ Log all errors with full details for debugging

Common issues:
- Missing API key → Check ai_provider_configs table for provider='openrouter'
- Invalid model name → Use 'openai/gpt-3.5-turbo' for testing
- Malformed messages → Must be array of {role, content}
- Rate limiting → OpenRouter API has usage limits
- 400 errors → Check request validation (model and messages required)`;
    }
    
    return `Fix the ${functionName} edge function. The error is: "${errorMessage}".

Please:
1. Check if all required environment variables are set
2. Add proper error handling and validation
3. Test the function with appropriate test data
4. Log detailed errors for debugging
5. Return graceful error messages to the client

Make sure to handle edge cases and add proper TypeScript types.`;
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "📋 Prompt copié",
      description: "Collez-le dans l'éditeur Lovable",
    });
  };

  const getStatusIcon = (status: EdgeFunction['status']) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failing':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'testing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      core: 'default',
      export: 'secondary',
      ai: 'outline',
      payment: 'destructive',
      marketing: 'default',
      amazon: 'secondary',
      utility: 'outline'
    };
    return colors[category] || 'default';
  };

  const groupedFunctions = functions.reduce((acc, func) => {
    if (!acc[func.category]) acc[func.category] = [];
    acc[func.category].push(func);
    return acc;
  }, {} as Record<string, EdgeFunction[]>);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          onClick={handleSelectAll}
          variant="outline"
          className="flex-1"
        >
          {selectedFunctions.size === functions.length ? "❌ Tout désélectionner" : "✅ Tout sélectionner"}
        </Button>
        <Button
          onClick={handleDeleteSelected}
          variant="destructive"
          disabled={selectedFunctions.size === 0}
          className="flex-1"
        >
          🗑️ Effacer sélection ({selectedFunctions.size})
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {Object.entries(groupedFunctions).map(([category, funcs]) => (
          <AccordionItem key={category} value={category}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Badge variant={getCategoryBadgeColor(category) as any}>
                  {category.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {funcs.length} fonctions
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-2">
                {funcs.map((func) => (
                  <div key={func.name} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3 flex-1">
                      <input 
                        type="checkbox"
                        checked={selectedFunctions.has(func.name)}
                        onChange={() => handleSelectFunction(func.name)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      {getStatusIcon(func.status)}
                      <div className="flex-1">
                        <div className="font-mono text-sm">{func.name}</div>
                        {func.testPayload && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Payload: <code className="text-xs">{JSON.stringify(func.testPayload)}</code>
                          </div>
                        )}
                      </div>
                      {func.latency && (
                        <Badge variant="outline" className="text-xs">
                          {func.latency}ms
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testFunction(func.name)}
                        disabled={func.status === 'testing'}
                      >
                        <PlayCircle className="h-3 w-3 mr-1" />
                        Test
                      </Button>

                      {func.status === 'failing' && func.lovablePrompt && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => copyPrompt(func.lovablePrompt!)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Fix Prompt
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};