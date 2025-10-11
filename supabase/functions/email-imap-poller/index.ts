import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ImapFlow } from "https://esm.sh/imapflow@1.0.157";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailConfig {
  host: string;
  port: number;
  tls: boolean;
  starttls?: boolean;
  type: "imap" | "pop3";
}

async function detectEmailConfig(email: string, password: string): Promise<EmailConfig> {
  const domain = email.split("@")[1];
  console.log(`🔍 Détection automatique de configuration pour ${email}`);

  const possibleConfigs: EmailConfig[] = [
    // Serveurs Infomaniak (prioritaires)
    { host: "mail.infomaniak.com", port: 993, tls: true, type: "imap" },
    { host: "mail.infomaniak.com", port: 143, tls: false, starttls: true, type: "imap" },
    
    // Serveurs génériques (fallback)
    { host: `imap.${domain}`, port: 993, tls: true, type: "imap" },
    { host: `mail.${domain}`, port: 993, tls: true, type: "imap" },
    { host: domain, port: 993, tls: true, type: "imap" },
  ];

  for (const config of possibleConfigs) {
    try {
      console.log(`🔌 Test connexion ${config.type}://${config.host}:${config.port}`);
      
      // Test basique de connexion TCP
      const conn = await Deno.connect({
        hostname: config.host,
        port: config.port,
      });
      conn.close();
      
      console.log(`✅ Configuration détectée : ${config.type}://${config.host}:${config.port}`);
      return config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ Échec ${config.host}:${config.port} - ${errorMessage}`);
    }
  }

  throw new Error("Impossible de détecter la configuration email automatiquement");
}

async function fetchEmailsViaAPI(email: string, password: string, config: EmailConfig) {
  console.log(`📧 Connexion IMAP à ${config.host}:${config.port}`);
  
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: {
      user: email,
      pass: password,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log("✅ Connexion IMAP établie");

    const lock = await client.getMailboxLock("INBOX");
    
    try {
      const messages = await client.search({ seen: false });
      console.log(`📬 ${messages.length} email(s) non lu(s) trouvés`);

      const emailsWithAttachments = [];

      for (const uid of messages.slice(0, 10)) {
        const message = await client.fetchOne(uid, { 
          envelope: true,
          bodyStructure: true,
          bodyParts: ['TEXT', 'HEADER'],
        });

        // Parse les headers pour extraire les infos
        const fromMatch = message.envelope?.from?.[0];
        const subject = message.envelope?.subject || "";
        const date = message.envelope?.date || new Date();

        // Chercher les pièces jointes dans la structure du message
        const attachments: any[] = [];
        
        const extractAttachments = (part: any, partId = '') => {
          if (part.disposition === 'attachment' || part.disposition === 'inline') {
            const filename = part.dispositionParameters?.filename || part.parameters?.name || 'unknown';
            if (filename.match(/\.(csv|xlsx|xls)$/i)) {
              attachments.push({
                partId: partId || '1',
                filename,
                contentType: part.type + '/' + part.subtype,
                size: part.size || 0,
              });
            }
          }
          
          if (part.childNodes) {
            part.childNodes.forEach((child: any, index: number) => {
              const childId = partId ? `${partId}.${index + 1}` : `${index + 1}`;
              extractAttachments(child, childId);
            });
          }
        };

        if (message.bodyStructure) {
          extractAttachments(message.bodyStructure);
        }

        if (attachments.length > 0) {
          // Télécharger le contenu des pièces jointes
          const attachmentContents = [];
          for (const att of attachments) {
            const { content } = await client.download(uid, att.partId);
            const chunks = [];
            for await (const chunk of content) {
              chunks.push(chunk);
            }
            const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            for (const chunk of chunks) {
              buffer.set(chunk, offset);
              offset += chunk.length;
            }
            
            attachmentContents.push({
              filename: att.filename,
              content: buffer,
              contentType: att.contentType,
              size: att.size,
            });
          }

          emailsWithAttachments.push({
            uid,
            fromAddress: fromMatch?.address || "",
            fromName: fromMatch?.name || "",
            subject,
            date,
            attachments: attachmentContents,
          });

          await client.messageFlagsAdd(uid, ["\\Seen"]);
          console.log(`✅ Email traité: ${subject} (${attachments.length} pièce(s) jointe(s))`);
        }
      }

      return emailsWithAttachments;

    } finally {
      lock.release();
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Erreur IMAP:", errorMessage);
    throw error;
  } finally {
    await client.logout();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const email = "catalogapp@inplt.net";
    const password = Deno.env.get("CATALOG_EMAIL_PASSWORD");

    if (!password) {
      throw new Error("CATALOG_EMAIL_PASSWORD not configured");
    }

    const url = new URL(req.url);
    const isTest = url.searchParams.get("test") === "true";

    console.log("🚀 Début du polling IMAP pour", email);

    // Utiliser directement la config Infomaniak
    const config: EmailConfig = { host: "mail.infomaniak.com", port: 993, tls: true, type: "imap" };
    console.log(`📝 Configuration utilisée : ${config.type}://${config.host}:${config.port}`);

    // Mode test : vérifier uniquement la connexion
    if (isTest) {
      const testClient = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.tls,
        auth: { user: email, pass: password },
        logger: false,
      });
      
      await testClient.connect();
      const mailboxInfo = await testClient.mailboxOpen("INBOX");
      await testClient.logout();
      
      return new Response(JSON.stringify({
        success: true,
        test: true,
        mailbox: {
          exists: mailboxInfo.exists,
          unseen: mailboxInfo.unseen,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Récupérer les emails
    const emails = await fetchEmailsViaAPI(email, password, config);
    console.log(`📬 ${emails.length} email(s) non lu(s) avec pièces jointes`);

    let processedCount = 0;
    let errorCount = 0;

    // Traiter chaque email avec pièces jointes
    for (const emailData of emails) {
      for (const attachment of emailData.attachments) {
        try {
          // 1. Uploader dans Storage
          const fileName = `${Date.now()}-${attachment.filename}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("email-attachments")
            .upload(fileName, attachment.content, {
              contentType: attachment.contentType,
            });

          if (uploadError) {
            console.error("❌ Erreur upload Storage:", uploadError);
            errorCount++;
            continue;
          }

          // 2. Récupérer les fournisseurs configurés
          const { data: suppliers } = await supabase
            .from("supplier_configurations")
            .select("id, name, email_addresses")
            .eq("is_active", true);

          // 3. Détecter le fournisseur avec IA
          let detectedSupplierId = null;
          let detectedUserId = null;
          
          if (suppliers && suppliers.length > 0) {
            const supplierList = suppliers.map(s => `- ${s.name}: ${s.email_addresses?.[0] || "N/A"}`).join("\n");
            
            const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
            if (lovableApiKey) {
              const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${lovableApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [{
                    role: "user",
                    content: `Identifie le fournisseur d'après ces informations:
Email: ${emailData.fromAddress}
Nom: ${emailData.fromName}
Objet: ${emailData.subject}
Fichier: ${attachment.filename}

Fournisseurs configurés:
${supplierList}

Réponds uniquement avec le nom exact du fournisseur détecté ou "INCONNU".`
                  }],
                }),
              });

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const detectedName = aiData.choices[0].message.content.trim();
                const matchedSupplier = suppliers.find(s => s.name === detectedName);
                
                if (matchedSupplier) {
                  detectedSupplierId = matchedSupplier.id;
                  const { data: userData } = await supabase
                    .from("supplier_configurations")
                    .select("user_id")
                    .eq("id", matchedSupplier.id)
                    .single();
                  detectedUserId = userData?.user_id;
                }
              }
            }
          }

          // 4. Insérer dans email_inbox
          const { data: inboxData, error: inboxError } = await supabase
            .from("email_inbox")
            .insert({
              from_email: emailData.fromAddress,
              from_name: emailData.fromName,
              subject: emailData.subject,
              received_at: emailData.date.toISOString(),
              attachment_name: attachment.filename,
              attachment_url: uploadData.path,
              attachment_type: attachment.contentType,
              attachment_size_kb: Math.round(attachment.size / 1024),
              supplier_id: detectedSupplierId,
              detected_supplier_name: detectedSupplierId ? null : "INCONNU",
              detection_method: "imap_polling",
              user_id: detectedUserId || "d319b055-9715-4a8a-97ad-ecfcf32aa387", // Fallback user
              status: "pending",
            })
            .select()
            .single();

          if (inboxError) {
            console.error("❌ Erreur insertion email_inbox:", inboxError);
            errorCount++;
            continue;
          }

          // 5. Déclencher le traitement
          await supabase.functions.invoke("process-email-attachment", {
            body: {
              inbox_id: inboxData.id,
              user_id: detectedUserId || "d319b055-9715-4a8a-97ad-ecfcf32aa387",
            },
          });

          processedCount++;
          console.log(`✅ Email traité : ${attachment.filename}`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`❌ Erreur traitement pièce jointe ${attachment.filename}:`, errorMessage);
          errorCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Polling IMAP terminé`,
        stats: {
          emails_found: emails.length,
          processed: processedCount,
          errors: errorCount,
          config: `${config.type}://${config.host}:${config.port}`,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("❌ Erreur globale:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
