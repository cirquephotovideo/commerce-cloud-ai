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

    const payload = await req.json();
    console.log('[EMAIL-PROCESSOR] Received email from:', payload.from);

    const fromEmail = payload.from || payload.from_email;
    const fromName = payload.from_name || '';
    const subject = payload.subject || '';
    const toEmail = payload.to; // ✅ L'adresse email dédiée du fournisseur
    const receivedAt = payload.date || new Date().toISOString();

    // ✅ LOOKUP DIRECT DU FOURNISSEUR PAR SON EMAIL DÉDIÉ
    const { data: supplier, error: supplierError } = await supabase
      .from('supplier_configurations')
      .select('id, supplier_name, user_id, supplier_type')
      .eq('dedicated_email', toEmail)
      .eq('is_active', true)
      .single();

    if (supplierError || !supplier) {
      console.error('[EMAIL-PROCESSOR] Unknown recipient email:', toEmail);
      return new Response(JSON.stringify({ 
        error: 'Unknown recipient email',
        hint: `L'adresse ${toEmail} n'est associée à aucun fournisseur configuré.`,
        suggestion: 'Vérifiez la configuration de vos fournisseurs dans l\'onglet "Fournisseurs".'
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
        detection_method: 'dedicated_email', // ✅ Méthode fiable
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

    return new Response(JSON.stringify({ 
      success: true, 
      inbox_id: inboxEntry.id,
      supplier: supplierName,
      supplier_id: supplierId,
      confidence: 100,
      method: 'dedicated_email'
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