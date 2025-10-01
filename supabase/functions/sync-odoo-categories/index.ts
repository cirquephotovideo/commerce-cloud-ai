import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OdooConfig {
  odoo_url: string;
  database_name: string;
  username: string;
  password_encrypted: string;
}

async function authenticateOdoo(config: OdooConfig): Promise<number> {
  const authPayload = `<?xml version="1.0"?>
    <methodCall>
      <methodName>authenticate</methodName>
      <params>
        <param><value><string>${config.database_name}</string></value></param>
        <param><value><string>${config.username}</string></value></param>
        <param><value><string>${config.password_encrypted}</string></value></param>
        <param><value><struct/></value></param>
      </params>
    </methodCall>`;

  const response = await fetch(`${config.odoo_url}/xmlrpc/2/common`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: authPayload,
  });

  const text = await response.text();
  const uidMatch = text.match(/<int>(\d+)<\/int>/);
  if (!uidMatch) throw new Error('Authentication failed');
  return parseInt(uidMatch[1]);
}

async function fetchOdooCategories(config: OdooConfig, uid: number): Promise<any[]> {
  const searchPayload = `<?xml version="1.0"?>
    <methodCall>
      <methodName>execute_kw</methodName>
      <params>
        <param><value><string>${config.database_name}</string></value></param>
        <param><value><int>${uid}</int></value></param>
        <param><value><string>${config.password_encrypted}</string></value></param>
        <param><value><string>product.category</string></value></param>
        <param><value><string>search_read</string></value></param>
        <param><value><array><data>
          <value><array><data></data></array></value>
        </data></array></value></param>
        <param><value><struct>
          <member>
            <name>fields</name>
            <value><array><data>
              <value><string>id</string></value>
              <value><string>name</string></value>
              <value><string>parent_id</string></value>
              <value><string>complete_name</string></value>
            </data></array></value>
          </member>
        </struct></value></param>
      </params>
    </methodCall>`;

  const response = await fetch(`${config.odoo_url}/xmlrpc/2/object`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: searchPayload,
  });

  const text = await response.text();
  
  // Parse XML response to extract categories
  const categories: any[] = [];
  const recordMatches = text.matchAll(/<struct>([\s\S]*?)<\/struct>/g);
  
  for (const match of recordMatches) {
    const structContent = match[1];
    const idMatch = structContent.match(/<name>id<\/name>[\s\S]*?<int>(\d+)<\/int>/);
    const nameMatch = structContent.match(/<name>name<\/name>[\s\S]*?<string>(.*?)<\/string>/);
    const completeNameMatch = structContent.match(/<name>complete_name<\/name>[\s\S]*?<string>(.*?)<\/string>/);
    const parentMatch = structContent.match(/<name>parent_id<\/name>[\s\S]*?<int>(\d+)<\/int>/);
    
    if (idMatch && nameMatch) {
      categories.push({
        id: parseInt(idMatch[1]),
        name: nameMatch[1],
        complete_name: completeNameMatch ? completeNameMatch[1] : nameMatch[1],
        parent_id: parentMatch ? parseInt(parentMatch[1]) : null,
      });
    }
  }

  return categories;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Syncing Odoo categories for user ${user.id}`);

    // Get Odoo configuration
    const { data: configs } = await supabaseClient
      .from('odoo_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active Odoo configuration found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configs[0];

    // Authenticate with Odoo
    const uid = await authenticateOdoo(config);
    console.log(`Authenticated with Odoo, UID: ${uid}`);

    // Fetch all categories from Odoo
    const categories = await fetchOdooCategories(config, uid);
    console.log(`Found ${categories.length} categories in Odoo`);

    // Delete existing categories for this user
    await supabaseClient
      .from('odoo_categories')
      .delete()
      .eq('user_id', user.id);

    // Insert new categories
    const categoriesToInsert = categories.map(cat => ({
      user_id: user.id,
      odoo_category_id: cat.id,
      category_name: cat.name,
      parent_id: cat.parent_id,
      parent_name: null, // Will be populated if needed
      full_path: cat.complete_name,
      last_synced_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseClient
      .from('odoo_categories')
      .insert(categoriesToInsert);

    if (insertError) {
      console.error('Error inserting categories:', insertError);
      throw insertError;
    }

    console.log(`Successfully synced ${categories.length} categories`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        categories_synced: categories.length,
        categories: categoriesToInsert
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-odoo-categories:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
