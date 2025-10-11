import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[EMAIL-IMAP-POLLER] ⚠️ IMAP polling is not supported in this environment');
  
  return new Response(JSON.stringify({
    success: false,
    code: 'IMAP_UNSUPPORTED',
    message: 'Le polling IMAP direct n\'est pas supporté dans cet environnement backend.',
    solution: 'Utilisez la configuration par adresse email dédiée :',
    steps: [
      '1. Configurez chaque fournisseur avec son adresse email unique (dans l\'onglet Configuration)',
      '2. Dans Infomaniak, créez une redirection depuis catalogapp@inplt.net vers votre service inbound (Resend)',
      '3. Configurez le webhook Resend pour pointer vers email-inbox-processor',
      '4. Les emails seront automatiquement traités sans polling'
    ],
    documentation: 'Consultez l\'onglet "Configuration Email" dans vos fournisseurs pour voir l\'adresse dédiée'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 501 // Not Implemented
  });
});