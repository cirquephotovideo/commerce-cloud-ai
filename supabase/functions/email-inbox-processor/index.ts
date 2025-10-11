import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const source = url.searchParams.get('source') || 'dedicated';
    const supplierIdFromUrl = url.searchParams.get('supplier_id');

    const payload = await req.json();
    console.log('[EMAIL-PROCESSOR] Received email from:', payload.from, 'Source:', source);

    const fromEmail = payload.from || payload.from_email;
    const fromName = payload.from_name || '';
    const subject = payload.subject || '';
    const toEmail = payload.to;
    const receivedAt = payload.date || new Date().toISOString();

    // Identifier le fournisseur selon le mode
    let supplier;
    let supplierError;

    if (source === 'webhook' && supplierIdFromUrl) {
      // Mode webhook : lookup direct par supplier_id
      console.log('[EMAIL-PROCESSOR] Webhook mode: looking up supplier by ID');
      const result = await supabase
        .from('supplier_configurations')
        .select('id, supplier_name, user_id, supplier_type, auto_matching_enabled, matching_threshold')
        .eq('id', supplierIdFromUrl)
        .eq('is_active', true)
        .maybeSingle();
      
      supplier = result.data;
      supplierError = result.error;
    } else {
      // Mode dedicated : lookup par dedicated_email (comportement actuel)
      console.log('[EMAIL-PROCESSOR] Dedicated mode: looking up supplier by email');
      const result = await supabase
        .from('supplier_configurations')
        .select('id, supplier_name, user_id, supplier_type, auto_matching_enabled, matching_threshold')
        .eq('dedicated_email', toEmail)
        .eq('is_active', true)
        .maybeSingle();
      
      supplier = result.data;
      supplierError = result.error;
    }

    if (supplierError || !supplier) {
      console.error('[EMAIL-PROCESSOR] Supplier not found:', supplierError);
      return new Response(JSON.stringify({ 
        error: 'Supplier not found',
        mode: source,
        lookup: source === 'webhook' ? supplierIdFromUrl : toEmail,
        hint: 'Vérifiez la configuration de vos fournisseurs.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // ✅ FOURNISSEUR ET USER IDENTIFIÉS AVEC 100% DE CONFIANCE
    const userId = supplier.user_id;
    const supplierId = supplier.id;
    const supplierName = supplier.supplier_name;

    console.log(`[EMAIL-PROCESSOR] ✅ Supplier identified: ${supplierName} (${supplierId}) for user ${userId}`);

    // Vérifier la présence d'une pièce jointe
    const attachment = payload.attachments?.[0];
    if (!attachment) {
      console.log('[EMAIL-PROCESSOR] No attachment found, ignoring email');
      return new Response(JSON.stringify({ 
        message: 'Email reçu mais aucune pièce jointe détectée',
        supplier: supplierName
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const attachmentName = attachment.filename || attachment.name;
    const attachmentType = attachment.content_type || attachment.type;
    const attachmentContent = attachment.content;
    
    // Décoder le contenu base64
    const bytes = Uint8Array.from(atob(attachmentContent), c => c.charCodeAt(0));
    const attachmentSizeKb = Math.round(bytes.length / 1024);

    console.log('[EMAIL-PROCESSOR] Attachment:', attachmentName, attachmentType, attachmentSizeKb, 'KB');

    // Upload vers Supabase Storage
    const fileName = `${userId}/${supplierId}/${Date.now()}-${attachmentName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('email-attachments')
      .upload(fileName, bytes, {
        contentType: attachmentType,
        upsert: false
      });

    if (uploadError) {
      console.error('[EMAIL-PROCESSOR] Upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('email-attachments')
      .getPublicUrl(fileName);

    console.log('[EMAIL-PROCESSOR] File uploaded:', publicUrl);

    // Insertion dans email_inbox avec identification certaine
    const { data: inboxEntry, error: inboxError } = await supabase
      .from('email_inbox')
      .insert({
        user_id: userId,
        supplier_id: supplierId,
        from_email: fromEmail,
        from_name: fromName,
        subject: subject,
        received_at: receivedAt,
        attachment_name: attachmentName,
        attachment_type: attachmentType,
        attachment_url: publicUrl,
        attachment_size_kb: attachmentSizeKb,
        detected_supplier_name: supplierName,
        detection_confidence: 100, // ✅ 100% car identification directe
        detection_method: source === 'webhook' ? 'webhook' : 'dedicated_email',
        status: 'pending',
      })
      .select()
      .single();

    if (inboxError) {
      console.error('[EMAIL-PROCESSOR] Inbox insert error:', inboxError);
      throw inboxError;
    }

    console.log('[EMAIL-PROCESSOR] ✅ Created inbox entry:', inboxEntry.id);

    // Déclencher le traitement en arrière-plan
    const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-email-attachment`;
    fetch(processUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inbox_id: inboxEntry.id,
        user_id: userId,
      }),
    }).catch(err => console.error('[EMAIL-PROCESSOR] Background trigger failed:', err));

    // Si le matching automatique est activé, déclencher après l'import
    if (supplier.auto_matching_enabled) {
      console.log('[EMAIL-PROCESSOR] Auto-matching enabled, will trigger after import completes');
      const autoLinkUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/auto-link-supplier-products`;
      setTimeout(() => {
        fetch(autoLinkUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            supplierId: supplier.id,
            userId: userId,
            threshold: supplier.matching_threshold || 70,
          }),
        }).catch(err => console.error('[EMAIL-PROCESSOR] Auto-link trigger failed:', err));
      }, 5000); // Attendre 5s que l'import soit terminé
    }

    return new Response(JSON.stringify({ 
      success: true, 
      inbox_id: inboxEntry.id,
      supplier: supplierName,
      supplier_id: supplierId,
      confidence: 100,
      method: source === 'webhook' ? 'webhook' : 'dedicated_email'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[EMAIL-PROCESSOR] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});