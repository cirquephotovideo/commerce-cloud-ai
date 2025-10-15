import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform, order_data, user_id } = await req.json();
    
    if (!platform || !order_data) {
      throw new Error('Platform and order_data are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parser les données selon la plateforme
    let parsedOrder;
    switch (platform.toLowerCase()) {
      case 'shopify':
        parsedOrder = parseShopifyOrder(order_data);
        break;
      case 'woocommerce':
        parsedOrder = parseWooCommerceOrder(order_data);
        break;
      case 'prestashop':
        parsedOrder = parsePrestaShopOrder(order_data);
        break;
      case 'magento':
        parsedOrder = parseMagentoOrder(order_data);
        break;
      default:
        parsedOrder = parseGenericOrder(order_data);
    }

    // Insérer dans la base de données
    const { data, error } = await supabase
      .from('ecommerce_orders')
      .insert({
        user_id: user_id || order_data.user_id,
        order_number: parsedOrder.order_number,
        external_order_id: parsedOrder.external_order_id,
        platform: platform.toLowerCase(),
        customer_email: parsedOrder.customer_email,
        customer_name: parsedOrder.customer_name,
        status: parsedOrder.status,
        total_amount: parsedOrder.total_amount,
        currency: parsedOrder.currency,
        items_count: parsedOrder.items_count,
        order_items: parsedOrder.order_items,
        shipping_address: parsedOrder.shipping_address,
        billing_address: parsedOrder.billing_address,
        order_date: parsedOrder.order_date,
        raw_data: order_data
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[ECOMMERCE-ORDER] Order ${parsedOrder.order_number} received from ${platform}`);

    return new Response(
      JSON.stringify({ success: true, order: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ECOMMERCE-ORDER] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fonctions de parsing pour chaque plateforme
function parseShopifyOrder(data: any) {
  return {
    order_number: data.name || data.order_number,
    external_order_id: data.id.toString(),
    customer_email: data.email,
    customer_name: `${data.customer?.first_name} ${data.customer?.last_name}`,
    status: mapShopifyStatus(data.financial_status),
    total_amount: parseFloat(data.total_price),
    currency: data.currency,
    items_count: data.line_items?.length || 0,
    order_items: data.line_items?.map((item: any) => ({
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price),
      sku: item.sku
    })) || [],
    shipping_address: data.shipping_address,
    billing_address: data.billing_address,
    order_date: data.created_at
  };
}

function parseWooCommerceOrder(data: any) {
  return {
    order_number: data.number,
    external_order_id: data.id.toString(),
    customer_email: data.billing?.email,
    customer_name: `${data.billing?.first_name} ${data.billing?.last_name}`,
    status: data.status,
    total_amount: parseFloat(data.total),
    currency: data.currency,
    items_count: data.line_items?.length || 0,
    order_items: data.line_items?.map((item: any) => ({
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price),
      sku: item.sku
    })) || [],
    shipping_address: data.shipping,
    billing_address: data.billing,
    order_date: data.date_created
  };
}

function parsePrestaShopOrder(data: any) {
  return {
    order_number: data.reference,
    external_order_id: data.id.toString(),
    customer_email: data.customer_email,
    customer_name: `${data.firstname} ${data.lastname}`,
    status: data.current_state,
    total_amount: parseFloat(data.total_paid),
    currency: data.currency,
    items_count: data.associations?.order_rows?.length || 0,
    order_items: data.associations?.order_rows || [],
    shipping_address: data.delivery_address,
    billing_address: data.invoice_address,
    order_date: data.date_add
  };
}

function parseMagentoOrder(data: any) {
  return {
    order_number: data.increment_id,
    external_order_id: data.entity_id.toString(),
    customer_email: data.customer_email,
    customer_name: `${data.customer_firstname} ${data.customer_lastname}`,
    status: data.status,
    total_amount: parseFloat(data.grand_total),
    currency: data.order_currency_code,
    items_count: data.items?.length || 0,
    order_items: data.items?.map((item: any) => ({
      product_id: item.product_id,
      name: item.name,
      quantity: item.qty_ordered,
      price: parseFloat(item.price),
      sku: item.sku
    })) || [],
    shipping_address: data.extension_attributes?.shipping_assignments?.[0]?.shipping?.address,
    billing_address: data.billing_address,
    order_date: data.created_at
  };
}

function parseGenericOrder(data: any) {
  return {
    order_number: data.order_number || data.id,
    external_order_id: data.id?.toString() || data.order_id?.toString(),
    customer_email: data.email || data.customer_email,
    customer_name: data.customer_name || 'Unknown',
    status: data.status || 'pending',
    total_amount: parseFloat(data.total || data.amount || 0),
    currency: data.currency || 'EUR',
    items_count: data.items?.length || 0,
    order_items: data.items || [],
    shipping_address: data.shipping_address,
    billing_address: data.billing_address,
    order_date: data.created_at || data.order_date || new Date().toISOString()
  };
}

function mapShopifyStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': 'pending',
    'paid': 'processing',
    'partially_paid': 'processing',
    'refunded': 'refunded',
    'partially_refunded': 'processing'
  };
  return statusMap[status] || 'pending';
}
