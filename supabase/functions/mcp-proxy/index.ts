import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('[mcp-proxy] Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[mcp-proxy] Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    console.log('[mcp-proxy] User auth result:', { hasUser: !!user, error: userError?.message });
    
    if (userError || !user) {
      console.error('[mcp-proxy] Auth failed:', userError?.message);
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        details: userError?.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestBody = await req.json();
    
    // Validate input with strict schema
    const mcpRequestSchema = z.object({
      mcp_url: z.string().url().refine(
        (url) => {
          // Only allow known safe domains
          const allowedDomains = ['ngrok-free.app', 'ngrok.io', 'localhost', '127.0.0.1'];
          try {
            const parsed = new URL(url);
            return allowedDomains.some(domain => parsed.hostname.endsWith(domain) || parsed.hostname === domain);
          } catch {
            return false;
          }
        },
        { message: 'URL must be from an allowed domain (ngrok, localhost)' }
      ),
      endpoint: z.string().regex(/^\/[a-zA-Z0-9\/_-]*$/, 'Invalid endpoint format'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
      body: z.record(z.any()).optional()
    });

    const validationResult = mcpRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      console.error('[mcp-proxy] Validation failed:', validationResult.error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request parameters',
          details: validationResult.error.errors 
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { mcp_url, endpoint, method, body } = validationResult.data;

    console.log(`[mcp-proxy] Proxying ${method} request to ${mcp_url}${endpoint}`);

    const response = await fetch(`${mcp_url}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'MCPClient/1.0'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[mcp-proxy] Error: ${response.status} - ${errorText}`);
      return new Response(JSON.stringify({ error: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[mcp-proxy] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
