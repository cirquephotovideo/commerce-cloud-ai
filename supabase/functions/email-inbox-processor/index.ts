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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Parse incoming email webhook (format: Resend Inbound Email)
    const payload = await req.json();
    console.log('[EMAIL-PROCESSOR] Received email from:', payload.from);

    const fromEmail = payload.from || payload.from_email;
    const fromName = payload.from_name || '';
    const subject = payload.subject || '';
    const receivedAt = payload.date || new Date().toISOString();
    
    // Extract attachment (assuming first attachment)
    const attachment = payload.attachments?.[0];
    if (!attachment) {
      console.log('[EMAIL-PROCESSOR] No attachment found, ignoring email');
      return new Response(JSON.stringify({ message: 'No attachment' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const attachmentName = attachment.filename || attachment.name;
    const attachmentType = attachment.content_type || attachment.type;
    const attachmentContent = attachment.content; // base64
    
    // Decode base64 in Deno
    const decoder = new TextDecoder();
    const bytes = Uint8Array.from(atob(attachmentContent), c => c.charCodeAt(0));
    const attachmentSizeKb = Math.round(bytes.length / 1024);

    console.log('[EMAIL-PROCESSOR] Attachment:', attachmentName, attachmentType, attachmentSizeKb, 'KB');

    // Find user by email domain or configuration
    // For now, extract user_id from custom header or email routing
    const userId = req.headers.get('x-user-id') || payload.to?.split('@')[0];
    
    if (!userId) {
      console.error('[EMAIL-PROCESSOR] Cannot determine user_id');
      return new Response(JSON.stringify({ error: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Fetch user's suppliers to help AI detection
    const { data: suppliers } = await supabase
      .from('supplier_configurations')
      .select('id, supplier_name, connection_config')
      .eq('user_id', userId)
      .eq('supplier_type', 'email');

    console.log('[EMAIL-PROCESSOR] Found', suppliers?.length || 0, 'email suppliers');

    // AI Detection of supplier using Lovable AI (Gemini)
    const detectionPrompt = `Tu es un expert en identification de fournisseurs.

Email reçu de: ${fromEmail}
Nom expéditeur: ${fromName}
Sujet: ${subject}
Fichier joint: ${attachmentName}

Fournisseurs configurés (type email):
${suppliers?.map(s => {
  const config = s.connection_config as any;
  return `- ${s.supplier_name} (emails autorisés: ${config?.allowed_senders?.join(', ') || 'N/A'})`;
}).join('\n') || 'Aucun fournisseur configuré'}

Tâche:
1. Identifie le fournisseur correspondant en comparant l'email expéditeur avec les emails autorisés
2. Si aucun match exact, propose le nom probable du fournisseur basé sur le domaine email, le nom de l'expéditeur ou le sujet
3. Donne un score de confiance (0-100)

Réponds UNIQUEMENT en JSON valide (sans markdown, sans backticks):
{
  "supplier_id": "uuid-si-trouvé-ou-null",
  "supplier_name": "nom-détecté",
  "confidence": 85,
  "reasoning": "explication courte"
}`;

    let detectedSupplier: any = { supplier_id: null, supplier_name: 'Unknown', confidence: 0, reasoning: 'No AI response' };
    
    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Tu es un assistant qui répond uniquement en JSON valide.' },
            { role: 'user', content: detectionPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '{}';
        // Clean potential markdown formatting
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        detectedSupplier = JSON.parse(cleanContent);
        console.log('[EMAIL-PROCESSOR] AI Detection:', detectedSupplier);
      }
    } catch (aiError) {
      console.error('[EMAIL-PROCESSOR] AI detection failed:', aiError);
    }

    // Upload attachment to Supabase Storage
    const fileName = `${userId}/${Date.now()}-${attachmentName}`;
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

    // Insert into email_inbox
    const { data: inboxEntry, error: inboxError } = await supabase
      .from('email_inbox')
      .insert({
        user_id: userId,
        supplier_id: detectedSupplier.supplier_id,
        from_email: fromEmail,
        from_name: fromName,
        subject: subject,
        received_at: receivedAt,
        attachment_name: attachmentName,
        attachment_type: attachmentType,
        attachment_url: publicUrl,
        attachment_size_kb: attachmentSizeKb,
        detected_supplier_name: detectedSupplier.supplier_name,
        detection_confidence: detectedSupplier.confidence,
        detection_method: detectedSupplier.supplier_id ? 'email' : 'content',
        status: 'pending',
      })
      .select()
      .single();

    if (inboxError) {
      console.error('[EMAIL-PROCESSOR] Inbox insert error:', inboxError);
      throw inboxError;
    }

    console.log('[EMAIL-PROCESSOR] Created inbox entry:', inboxEntry.id);

    // Trigger background processing
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
      detected_supplier: detectedSupplier.supplier_name,
      confidence: detectedSupplier.confidence
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
