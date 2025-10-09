export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_prompts: {
        Row: {
          created_at: string | null
          created_by: string | null
          function_name: string
          id: string
          is_active: boolean | null
          model: string | null
          prompt_content: string
          prompt_key: string
          prompt_type: string
          temperature: number | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          function_name: string
          id?: string
          is_active?: boolean | null
          model?: string | null
          prompt_content: string
          prompt_key: string
          prompt_type: string
          temperature?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          function_name?: string
          id?: string
          is_active?: boolean | null
          model?: string | null
          prompt_content?: string
          prompt_key?: string
          prompt_type?: string
          temperature?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      ai_provider_configs: {
        Row: {
          api_key_encrypted: string | null
          api_url: string | null
          created_at: string | null
          default_model: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_url?: string | null
          created_at?: string | null
          default_model?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_url?: string | null
          created_at?: string | null
          default_model?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_provider_health: {
        Row: {
          available_models: Json | null
          error_details: Json | null
          id: string
          last_check: string | null
          provider: string
          response_time_ms: number | null
          status: string
        }
        Insert: {
          available_models?: Json | null
          error_details?: Json | null
          id?: string
          last_check?: string | null
          provider: string
          response_time_ms?: number | null
          status: string
        }
        Update: {
          available_models?: Json | null
          error_details?: Json | null
          id?: string
          last_check?: string | null
          provider?: string
          response_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      ai_request_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          model: string | null
          prompt_type: string | null
          provider: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_type?: string | null
          provider: string
          success: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_type?: string | null
          provider?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      amazon_access_tokens: {
        Row: {
          access_token: string
          credential_id: string | null
          expires_at: string
          generated_at: string | null
          id: string
        }
        Insert: {
          access_token: string
          credential_id?: string | null
          expires_at: string
          generated_at?: string | null
          id?: string
        }
        Update: {
          access_token?: string
          credential_id?: string | null
          expires_at?: string
          generated_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amazon_access_tokens_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "amazon_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_credentials: {
        Row: {
          client_id: string
          client_secret_encrypted: string
          created_at: string | null
          id: string
          is_active: boolean | null
          marketplace_id: string
          refresh_token_encrypted: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          client_secret_encrypted: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          marketplace_id?: string
          refresh_token_encrypted: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          client_secret_encrypted?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          marketplace_id?: string
          refresh_token_encrypted?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      amazon_edge_logs: {
        Row: {
          created_at: string | null
          event_message: string
          event_type: string
          function_name: string
          id: string
          level: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_message: string
          event_type: string
          function_name: string
          id?: string
          level?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_message?: string
          event_type?: string
          function_name?: string
          id?: string
          level?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      amazon_product_data: {
        Row: {
          amazon_price: number | null
          analysis_id: string | null
          asin: string
          brand: string | null
          browse_nodes: Json | null
          buy_box_price: number | null
          buy_box_seller_id: string | null
          buy_box_seller_name: string | null
          buy_box_ship_country: string | null
          color: string | null
          contributors: Json | null
          created_at: string | null
          ean: string | null
          fba_new_price: number | null
          features: string[] | null
          id: string
          images: Json | null
          import_code: string | null
          is_buy_box_amazon_fulfilled: boolean | null
          is_buy_box_amazon_seller: boolean | null
          is_buy_box_out_of_stock: boolean | null
          is_buy_box_preorder: boolean | null
          is_trade_in_eligible: boolean | null
          item_count: number | null
          item_dimensions: Json | null
          item_weight: number | null
          last_synced_at: string | null
          list_price: number | null
          lowest_collectible_price: number | null
          lowest_new_price: number | null
          lowest_refurbished_price: number | null
          manufacturer: string | null
          marketplace: string | null
          offer_count_collectible: number | null
          offer_count_new: number | null
          offer_count_refurbished: number | null
          package_dimensions: Json | null
          package_quantity: number | null
          package_weight: number | null
          page_count: number | null
          part_number: string | null
          prep_pack_fees: number | null
          product_type: string | null
          publication_date: string | null
          raw_data: Json | null
          referral_fee_percentage: number | null
          release_date: string | null
          sales_rank: Json | null
          size: string | null
          title: string | null
          upc: string | null
          updated_at: string | null
          user_id: string
          variation_count: number | null
        }
        Insert: {
          amazon_price?: number | null
          analysis_id?: string | null
          asin: string
          brand?: string | null
          browse_nodes?: Json | null
          buy_box_price?: number | null
          buy_box_seller_id?: string | null
          buy_box_seller_name?: string | null
          buy_box_ship_country?: string | null
          color?: string | null
          contributors?: Json | null
          created_at?: string | null
          ean?: string | null
          fba_new_price?: number | null
          features?: string[] | null
          id?: string
          images?: Json | null
          import_code?: string | null
          is_buy_box_amazon_fulfilled?: boolean | null
          is_buy_box_amazon_seller?: boolean | null
          is_buy_box_out_of_stock?: boolean | null
          is_buy_box_preorder?: boolean | null
          is_trade_in_eligible?: boolean | null
          item_count?: number | null
          item_dimensions?: Json | null
          item_weight?: number | null
          last_synced_at?: string | null
          list_price?: number | null
          lowest_collectible_price?: number | null
          lowest_new_price?: number | null
          lowest_refurbished_price?: number | null
          manufacturer?: string | null
          marketplace?: string | null
          offer_count_collectible?: number | null
          offer_count_new?: number | null
          offer_count_refurbished?: number | null
          package_dimensions?: Json | null
          package_quantity?: number | null
          package_weight?: number | null
          page_count?: number | null
          part_number?: string | null
          prep_pack_fees?: number | null
          product_type?: string | null
          publication_date?: string | null
          raw_data?: Json | null
          referral_fee_percentage?: number | null
          release_date?: string | null
          sales_rank?: Json | null
          size?: string | null
          title?: string | null
          upc?: string | null
          updated_at?: string | null
          user_id: string
          variation_count?: number | null
        }
        Update: {
          amazon_price?: number | null
          analysis_id?: string | null
          asin?: string
          brand?: string | null
          browse_nodes?: Json | null
          buy_box_price?: number | null
          buy_box_seller_id?: string | null
          buy_box_seller_name?: string | null
          buy_box_ship_country?: string | null
          color?: string | null
          contributors?: Json | null
          created_at?: string | null
          ean?: string | null
          fba_new_price?: number | null
          features?: string[] | null
          id?: string
          images?: Json | null
          import_code?: string | null
          is_buy_box_amazon_fulfilled?: boolean | null
          is_buy_box_amazon_seller?: boolean | null
          is_buy_box_out_of_stock?: boolean | null
          is_buy_box_preorder?: boolean | null
          is_trade_in_eligible?: boolean | null
          item_count?: number | null
          item_dimensions?: Json | null
          item_weight?: number | null
          last_synced_at?: string | null
          list_price?: number | null
          lowest_collectible_price?: number | null
          lowest_new_price?: number | null
          lowest_refurbished_price?: number | null
          manufacturer?: string | null
          marketplace?: string | null
          offer_count_collectible?: number | null
          offer_count_new?: number | null
          offer_count_refurbished?: number | null
          package_dimensions?: Json | null
          package_quantity?: number | null
          package_weight?: number | null
          page_count?: number | null
          part_number?: string | null
          prep_pack_fees?: number | null
          product_type?: string | null
          publication_date?: string | null
          raw_data?: Json | null
          referral_fee_percentage?: number | null
          release_date?: string | null
          sales_rank?: Json | null
          size?: string | null
          title?: string | null
          upc?: string | null
          updated_at?: string | null
          user_id?: string
          variation_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "amazon_product_data_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "product_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      aws_credentials: {
        Row: {
          access_key_id_encrypted: string
          created_at: string | null
          id: string
          is_active: boolean | null
          region: string
          role_arn: string
          secret_access_key_encrypted: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_key_id_encrypted: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          region?: string
          role_arn: string
          secret_access_key_encrypted: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_key_id_encrypted?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          region?: string
          role_arn?: string
          secret_access_key_encrypted?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      billing_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          description: string | null
          id: string
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_statistics: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          recipient_email: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          recipient_email: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          recipient_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_statistics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      compatibility_matrix: {
        Row: {
          compatible_products: Json | null
          created_at: string | null
          id: string
          incompatible_products: Json | null
          product_id: string | null
          regional_restrictions: Json | null
          required_accessories: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          compatible_products?: Json | null
          created_at?: string | null
          id?: string
          incompatible_products?: Json | null
          product_id?: string | null
          regional_restrictions?: Json | null
          required_accessories?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          compatible_products?: Json | null
          created_at?: string | null
          id?: string
          incompatible_products?: Json | null
          product_id?: string | null
          regional_restrictions?: Json | null
          required_accessories?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compatibility_matrix_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_sites: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_scraped_at: string | null
          scraping_frequency: string | null
          site_name: string
          site_type: string
          site_url: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          scraping_frequency?: string | null
          site_name: string
          site_type: string
          site_url: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_scraped_at?: string | null
          scraping_frequency?: string | null
          site_name?: string
          site_type?: string
          site_url?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          message: string
          responded_at: string | null
          sender_email: string
          sender_name: string
          status: string | null
          subject: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          message: string
          responded_at?: string | null
          sender_email: string
          sender_name: string
          status?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          message?: string
          responded_at?: string | null
          sender_email?: string
          sender_name?: string
          status?: string | null
          subject?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          click_count: number | null
          content: string
          created_at: string | null
          id: string
          open_count: number | null
          recipient_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          click_count?: number | null
          content: string
          created_at?: string | null
          id?: string
          open_count?: number | null
          recipient_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          click_count?: number | null
          content?: string
          created_at?: string | null
          id?: string
          open_count?: number | null
          recipient_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      export_logs: {
        Row: {
          created_at: string
          error_count: number
          export_details: Json | null
          id: string
          products_count: number
          success_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          error_count?: number
          export_details?: Json | null
          id?: string
          products_count: number
          success_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          error_count?: number
          export_details?: Json | null
          id?: string
          products_count?: number
          success_count?: number
          user_id?: string
        }
        Relationships: []
      }
      feature_permissions: {
        Row: {
          created_at: string | null
          enabled_for_admins: boolean | null
          enabled_for_users: boolean | null
          feature_description: string | null
          feature_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled_for_admins?: boolean | null
          enabled_for_users?: boolean | null
          feature_description?: string | null
          feature_name: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled_for_admins?: boolean | null
          enabled_for_users?: boolean | null
          feature_description?: string | null
          feature_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      feature_suggestions: {
        Row: {
          category: Database["public"]["Enums"]["feature_category"]
          created_at: string | null
          created_by: string | null
          description: string
          effort: string
          id: string
          impact: string
          lovable_prompt: string
          priority: Database["public"]["Enums"]["issue_severity"]
          status: string | null
          title: string
          updated_at: string | null
          votes: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["feature_category"]
          created_at?: string | null
          created_by?: string | null
          description: string
          effort: string
          id?: string
          impact: string
          lovable_prompt: string
          priority: Database["public"]["Enums"]["issue_severity"]
          status?: string | null
          title: string
          updated_at?: string | null
          votes?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["feature_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string
          effort?: string
          id?: string
          impact?: string
          lovable_prompt?: string
          priority?: Database["public"]["Enums"]["issue_severity"]
          status?: string | null
          title?: string
          updated_at?: string | null
          votes?: number | null
        }
        Relationships: []
      }
      fix_tracking: {
        Row: {
          component_name: string
          created_at: string | null
          created_by: string | null
          description: string
          detected_at: string | null
          fix_applied_at: string | null
          fix_duration_minutes: number | null
          id: string
          issue_id: string
          issue_type: string
          lovable_prompt: string
          retest_result: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: string | null
        }
        Insert: {
          component_name: string
          created_at?: string | null
          created_by?: string | null
          description: string
          detected_at?: string | null
          fix_applied_at?: string | null
          fix_duration_minutes?: number | null
          id?: string
          issue_id: string
          issue_type: string
          lovable_prompt: string
          retest_result?: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status?: string | null
        }
        Update: {
          component_name?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          detected_at?: string | null
          fix_applied_at?: string | null
          fix_duration_minutes?: number | null
          id?: string
          issue_id?: string
          issue_type?: string
          lovable_prompt?: string
          retest_result?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: string | null
        }
        Relationships: []
      }
      google_services_config: {
        Row: {
          api_key_encrypted: string | null
          client_id_encrypted: string | null
          client_secret_encrypted: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          measurement_id: string | null
          merchant_id: string | null
          service_type: Database["public"]["Enums"]["google_service_type"]
          site_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key_encrypted?: string | null
          client_id_encrypted?: string | null
          client_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          measurement_id?: string | null
          merchant_id?: string | null
          service_type: Database["public"]["Enums"]["google_service_type"]
          site_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key_encrypted?: string | null
          client_id_encrypted?: string | null
          client_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          measurement_id?: string | null
          merchant_id?: string | null
          service_type?: Database["public"]["Enums"]["google_service_type"]
          site_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_trends: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          detected_at: string | null
          id: string
          is_read: boolean | null
          product_category: string | null
          trend_data: Json
          trend_type: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          detected_at?: string | null
          id?: string
          is_read?: boolean | null
          product_category?: string | null
          trend_data: Json
          trend_type: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          detected_at?: string | null
          id?: string
          is_read?: boolean | null
          product_category?: string | null
          trend_data?: Json
          trend_type?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          status: string
          subscribed_at: string | null
          tags: Json | null
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          status?: string
          subscribed_at?: string | null
          tags?: Json | null
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          status?: string
          subscribed_at?: string | null
          tags?: Json | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      odoo_categories: {
        Row: {
          category_name: string
          created_at: string | null
          full_path: string
          id: string
          last_synced_at: string | null
          odoo_category_id: number
          parent_id: number | null
          parent_name: string | null
          user_id: string
        }
        Insert: {
          category_name: string
          created_at?: string | null
          full_path: string
          id?: string
          last_synced_at?: string | null
          odoo_category_id: number
          parent_id?: number | null
          parent_name?: string | null
          user_id: string
        }
        Update: {
          category_name?: string
          created_at?: string | null
          full_path?: string
          id?: string
          last_synced_at?: string | null
          odoo_category_id?: number
          parent_id?: number | null
          parent_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      odoo_configurations: {
        Row: {
          created_at: string
          database_name: string
          id: string
          is_active: boolean | null
          odoo_url: string
          password_encrypted: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          database_name: string
          id?: string
          is_active?: boolean | null
          odoo_url: string
          password_encrypted: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          database_name?: string
          id?: string
          is_active?: boolean | null
          odoo_url?: string
          password_encrypted?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      odoo_field_mappings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          odoo_field: string
          odoo_field_label: string
          source_field: string
          source_path: string
          transformation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          odoo_field: string
          odoo_field_label: string
          source_field: string
          source_path: string
          transformation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          odoo_field?: string
          odoo_field_label?: string
          source_field?: string
          source_path?: string
          transformation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ollama_configurations: {
        Row: {
          api_key_encrypted: string | null
          available_models: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          ollama_url: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key_encrypted?: string | null
          available_models?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          ollama_url: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key_encrypted?: string | null
          available_models?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          ollama_url?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_categories: {
        Row: {
          category_name: string
          created_at: string | null
          full_path: string
          id: string
          last_synced_at: string | null
          parent_id: string | null
          parent_name: string | null
          platform_category_id: string
          platform_type: string
          user_id: string
        }
        Insert: {
          category_name: string
          created_at?: string | null
          full_path: string
          id?: string
          last_synced_at?: string | null
          parent_id?: string | null
          parent_name?: string | null
          platform_category_id: string
          platform_type: string
          user_id: string
        }
        Update: {
          category_name?: string
          created_at?: string | null
          full_path?: string
          id?: string
          last_synced_at?: string | null
          parent_id?: string | null
          parent_name?: string | null
          platform_category_id?: string
          platform_type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_configurations: {
        Row: {
          access_token_encrypted: string | null
          additional_config: Json | null
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          created_at: string
          id: string
          is_active: boolean | null
          platform_type: string
          platform_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          additional_config?: Json | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          platform_type: string
          platform_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          additional_config?: Json | null
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          platform_type?: string
          platform_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_export_logs: {
        Row: {
          created_at: string
          error_count: number
          export_details: Json | null
          id: string
          platform_type: string
          products_count: number
          success_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          error_count?: number
          export_details?: Json | null
          id?: string
          platform_type: string
          products_count: number
          success_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          error_count?: number
          export_details?: Json | null
          id?: string
          platform_type?: string
          products_count?: number
          success_count?: number
          user_id?: string
        }
        Relationships: []
      }
      platform_field_mappings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          platform_field: string
          platform_field_label: string
          platform_type: string
          source_field: string
          source_path: string
          transformation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          platform_field: string
          platform_field_label: string
          platform_type: string
          source_field: string
          source_path: string
          transformation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          platform_field?: string
          platform_field_label?: string
          platform_type?: string
          source_field?: string
          source_path?: string
          transformation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_pricing_rules: {
        Row: {
          apply_to_categories: Json | null
          created_at: string
          currency: string
          fixed_amount: number | null
          id: string
          is_active: boolean | null
          markup_percentage: number | null
          platform_type: string
          price_rounding_rule: string | null
          rule_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apply_to_categories?: Json | null
          created_at?: string
          currency?: string
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          markup_percentage?: number | null
          platform_type: string
          price_rounding_rule?: string | null
          rule_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apply_to_categories?: Json | null
          created_at?: string
          currency?: string
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          markup_percentage?: number | null
          platform_type?: string
          price_rounding_rule?: string | null
          rule_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          created_at: string | null
          id: string
          price: number
          price_monitoring_id: string
          scraped_at: string | null
          source: string | null
          stock_status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          price: number
          price_monitoring_id: string
          scraped_at?: string | null
          source?: string | null
          stock_status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          price?: number
          price_monitoring_id?: string
          scraped_at?: string | null
          source?: string | null
          stock_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_price_monitoring_id_fkey"
            columns: ["price_monitoring_id"]
            isOneToOne: false
            referencedRelation: "price_monitoring"
            referencedColumns: ["id"]
          },
        ]
      }
      price_monitoring: {
        Row: {
          availability_history: Json | null
          best_deal_score: number | null
          competitor_site_id: string | null
          confidence_score: number | null
          created_at: string | null
          current_price: number | null
          description: string | null
          id: string
          image_url: string | null
          previous_price: number | null
          price_change_percent: number | null
          price_trend: number | null
          product_name: string
          product_url: string
          rating: number | null
          reviews_count: number | null
          scraped_at: string | null
          search_engine: string | null
          search_metadata: Json | null
          stock_status: string | null
          user_id: string
        }
        Insert: {
          availability_history?: Json | null
          best_deal_score?: number | null
          competitor_site_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          current_price?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          previous_price?: number | null
          price_change_percent?: number | null
          price_trend?: number | null
          product_name: string
          product_url: string
          rating?: number | null
          reviews_count?: number | null
          scraped_at?: string | null
          search_engine?: string | null
          search_metadata?: Json | null
          stock_status?: string | null
          user_id: string
        }
        Update: {
          availability_history?: Json | null
          best_deal_score?: number | null
          competitor_site_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          current_price?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          previous_price?: number | null
          price_change_percent?: number | null
          price_trend?: number | null
          product_name?: string
          product_url?: string
          rating?: number | null
          reviews_count?: number | null
          scraped_at?: string | null
          search_engine?: string | null
          search_metadata?: Json | null
          stock_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_monitoring_competitor_site_id_fkey"
            columns: ["competitor_site_id"]
            isOneToOne: false
            referencedRelation: "competitor_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      product_analyses: {
        Row: {
          amazon_enrichment_status: string | null
          amazon_last_attempt: string | null
          analysis_result: Json
          competitive_cons: Json | null
          competitive_pros: Json | null
          created_at: string | null
          description_long: string | null
          enrichment_status: Json | null
          heygen_video_id: string | null
          id: string
          image_urls: Json | null
          is_favorite: boolean | null
          mapped_category_id: string | null
          mapped_category_name: string | null
          market_position: string | null
          odoo_attributes: Json | null
          product_url: string
          rsgp_compliance_id: string | null
          tags: Json | null
          updated_at: string | null
          use_cases: Json | null
          user_id: string
        }
        Insert: {
          amazon_enrichment_status?: string | null
          amazon_last_attempt?: string | null
          analysis_result: Json
          competitive_cons?: Json | null
          competitive_pros?: Json | null
          created_at?: string | null
          description_long?: string | null
          enrichment_status?: Json | null
          heygen_video_id?: string | null
          id?: string
          image_urls?: Json | null
          is_favorite?: boolean | null
          mapped_category_id?: string | null
          mapped_category_name?: string | null
          market_position?: string | null
          odoo_attributes?: Json | null
          product_url: string
          rsgp_compliance_id?: string | null
          tags?: Json | null
          updated_at?: string | null
          use_cases?: Json | null
          user_id: string
        }
        Update: {
          amazon_enrichment_status?: string | null
          amazon_last_attempt?: string | null
          analysis_result?: Json
          competitive_cons?: Json | null
          competitive_pros?: Json | null
          created_at?: string | null
          description_long?: string | null
          enrichment_status?: Json | null
          heygen_video_id?: string | null
          id?: string
          image_urls?: Json | null
          is_favorite?: boolean | null
          mapped_category_id?: string | null
          mapped_category_name?: string | null
          market_position?: string | null
          odoo_attributes?: Json | null
          product_url?: string
          rsgp_compliance_id?: string | null
          tags?: Json | null
          updated_at?: string | null
          use_cases?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_analyses_heygen_video_id_fkey"
            columns: ["heygen_video_id"]
            isOneToOne: false
            referencedRelation: "product_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_analyses_rsgp_compliance_id_fkey"
            columns: ["rsgp_compliance_id"]
            isOneToOne: false
            referencedRelation: "rsgp_compliance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_taxonomy_mappings: {
        Row: {
          analysis_id: string
          category_id: string
          category_path: string
          confidence_score: number | null
          created_at: string | null
          id: string
          taxonomy_type: string
        }
        Insert: {
          analysis_id: string
          category_id: string
          category_path: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          taxonomy_type: string
        }
        Update: {
          analysis_id?: string
          category_id?: string
          category_path?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          taxonomy_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_taxonomy_mappings_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "product_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_videos: {
        Row: {
          analysis_id: string | null
          avatar_id: string | null
          completed_at: string | null
          created_at: string | null
          duration: number | null
          error_message: string | null
          id: string
          script: string | null
          status: string | null
          template_id: string | null
          thumbnail_url: string | null
          user_id: string
          video_id: string
          video_url: string | null
          voice_id: string | null
        }
        Insert: {
          analysis_id?: string | null
          avatar_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration?: number | null
          error_message?: string | null
          id?: string
          script?: string | null
          status?: string | null
          template_id?: string | null
          thumbnail_url?: string | null
          user_id: string
          video_id: string
          video_url?: string | null
          voice_id?: string | null
        }
        Update: {
          analysis_id?: string | null
          avatar_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration?: number | null
          error_message?: string | null
          id?: string
          script?: string | null
          status?: string | null
          template_id?: string | null
          thumbnail_url?: string | null
          user_id?: string
          video_id?: string
          video_url?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_videos_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "product_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          analysis_id: string | null
          authenticity_score: number | null
          compliance_status: Json | null
          created_at: string | null
          id: string
          return_prediction: Json | null
          risk_level: string | null
          updated_at: string | null
          user_id: string
          warranty_analysis: Json | null
        }
        Insert: {
          analysis_id?: string | null
          authenticity_score?: number | null
          compliance_status?: Json | null
          created_at?: string | null
          id?: string
          return_prediction?: Json | null
          risk_level?: string | null
          updated_at?: string | null
          user_id: string
          warranty_analysis?: Json | null
        }
        Update: {
          analysis_id?: string | null
          authenticity_score?: number | null
          compliance_status?: Json | null
          created_at?: string | null
          id?: string
          return_prediction?: Json | null
          risk_level?: string | null
          updated_at?: string | null
          user_id?: string
          warranty_analysis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "product_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      rsgp_compliance: {
        Row: {
          age_recommande: string | null
          analysis_id: string | null
          avertissements: string[] | null
          categorie_rsgp: string | null
          compatibilites: string[] | null
          date_evaluation: string | null
          date_import_odoo: string | null
          date_mise_conformite: string | null
          documents_archives: Json | null
          documents_conformite: Json | null
          ean: string | null
          entretien: string | null
          evaluation_risque: string | null
          fabricant_adresse: string | null
          fabricant_nom: string | null
          firmware_ou_logiciel: string | null
          fournisseur: string | null
          garantie: string | null
          generated_at: string | null
          generation_metadata: Json | null
          historique_incidents: Json | null
          id: string
          indice_energie: string | null
          indice_reparabilite: number | null
          langues_disponibles: string[] | null
          last_updated: string | null
          nom_produit: string
          normes_ce: string[] | null
          notice_pdf: string | null
          numero_lot: string | null
          numero_modele: string | null
          pays_origine: string | null
          personne_responsable_ue: string | null
          procedure_rappel: string | null
          recyclage: string | null
          reference_interne: string | null
          responsable_conformite: string | null
          rsgp_valide: boolean | null
          service_consommateur: string | null
          user_id: string
          validation_status: string | null
        }
        Insert: {
          age_recommande?: string | null
          analysis_id?: string | null
          avertissements?: string[] | null
          categorie_rsgp?: string | null
          compatibilites?: string[] | null
          date_evaluation?: string | null
          date_import_odoo?: string | null
          date_mise_conformite?: string | null
          documents_archives?: Json | null
          documents_conformite?: Json | null
          ean?: string | null
          entretien?: string | null
          evaluation_risque?: string | null
          fabricant_adresse?: string | null
          fabricant_nom?: string | null
          firmware_ou_logiciel?: string | null
          fournisseur?: string | null
          garantie?: string | null
          generated_at?: string | null
          generation_metadata?: Json | null
          historique_incidents?: Json | null
          id?: string
          indice_energie?: string | null
          indice_reparabilite?: number | null
          langues_disponibles?: string[] | null
          last_updated?: string | null
          nom_produit: string
          normes_ce?: string[] | null
          notice_pdf?: string | null
          numero_lot?: string | null
          numero_modele?: string | null
          pays_origine?: string | null
          personne_responsable_ue?: string | null
          procedure_rappel?: string | null
          recyclage?: string | null
          reference_interne?: string | null
          responsable_conformite?: string | null
          rsgp_valide?: boolean | null
          service_consommateur?: string | null
          user_id: string
          validation_status?: string | null
        }
        Update: {
          age_recommande?: string | null
          analysis_id?: string | null
          avertissements?: string[] | null
          categorie_rsgp?: string | null
          compatibilites?: string[] | null
          date_evaluation?: string | null
          date_import_odoo?: string | null
          date_mise_conformite?: string | null
          documents_archives?: Json | null
          documents_conformite?: Json | null
          ean?: string | null
          entretien?: string | null
          evaluation_risque?: string | null
          fabricant_adresse?: string | null
          fabricant_nom?: string | null
          firmware_ou_logiciel?: string | null
          fournisseur?: string | null
          garantie?: string | null
          generated_at?: string | null
          generation_metadata?: Json | null
          historique_incidents?: Json | null
          id?: string
          indice_energie?: string | null
          indice_reparabilite?: number | null
          langues_disponibles?: string[] | null
          last_updated?: string | null
          nom_produit?: string
          normes_ce?: string[] | null
          notice_pdf?: string | null
          numero_lot?: string | null
          numero_modele?: string | null
          pays_origine?: string | null
          personne_responsable_ue?: string | null
          procedure_rappel?: string | null
          recyclage?: string | null
          reference_interne?: string | null
          responsable_conformite?: string | null
          rsgp_valide?: boolean | null
          service_consommateur?: string | null
          user_id?: string
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rsgp_compliance_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "product_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_accounts: {
        Row: {
          access_token: string | null
          account_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_media_posts: {
        Row: {
          account_id: string | null
          content: string
          created_at: string | null
          engagement_data: Json | null
          id: string
          media_urls: Json | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          content: string
          created_at?: string | null
          engagement_data?: Json | null
          id?: string
          media_urls?: Json | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          content?: string
          created_at?: string | null
          engagement_data?: Json | null
          id?: string
          media_urls?: Json | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_media_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_media_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          currency: string
          description: string | null
          display_order: number | null
          features: Json
          id: string
          is_active: boolean | null
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          description?: string | null
          display_order?: number | null
          features?: Json
          id?: string
          is_active?: boolean | null
          limits?: Json
          name: string
          price_monthly: number
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          description?: string | null
          display_order?: number | null
          features?: Json
          id?: string
          is_active?: boolean | null
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_health_logs: {
        Row: {
          component_name: string
          created_at: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          status: Database["public"]["Enums"]["health_status"]
          test_result: Json | null
          test_type: string
          tested_at: string | null
          tested_by: string | null
        }
        Insert: {
          component_name: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          status: Database["public"]["Enums"]["health_status"]
          test_result?: Json | null
          test_type: string
          tested_at?: string | null
          tested_by?: string | null
        }
        Update: {
          component_name?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          status?: Database["public"]["Enums"]["health_status"]
          test_result?: Json | null
          test_type?: string
          tested_at?: string | null
          tested_by?: string | null
        }
        Relationships: []
      }
      taxonomy_settings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          taxonomy_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          taxonomy_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          taxonomy_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      technical_specs: {
        Row: {
          analysis_id: string | null
          compatibility_data: Json | null
          created_at: string | null
          id: string
          lifecycle_stage: string | null
          obsolescence_score: number | null
          specs_data: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          compatibility_data?: Json | null
          created_at?: string | null
          id?: string
          lifecycle_stage?: string | null
          obsolescence_score?: number | null
          specs_data: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          compatibility_data?: Json | null
          created_at?: string | null
          id?: string
          lifecycle_stage?: string | null
          obsolescence_score?: number | null
          specs_data?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_specs_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "product_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_conversions: {
        Row: {
          billing_interval: string | null
          conversion_date: string | null
          converted: boolean | null
          created_at: string | null
          id: string
          selected_plan_id: string | null
          trial_end: string
          trial_start: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_interval?: string | null
          conversion_date?: string | null
          converted?: boolean | null
          created_at?: string | null
          id?: string
          selected_plan_id?: string | null
          trial_end: string
          trial_start: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_interval?: string | null
          conversion_date?: string | null
          converted?: boolean | null
          created_at?: string | null
          id?: string
          selected_plan_id?: string | null
          trial_end?: string
          trial_start?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_conversions_selected_plan_id_fkey"
            columns: ["selected_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          created_at: string | null
          feature_type: string
          id: string
          period_end: string
          period_start: string
          updated_at: string | null
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feature_type: string
          id?: string
          period_end?: string
          period_start?: string
          updated_at?: string | null
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          feature_type?: string
          id?: string
          period_end?: string
          period_start?: string
          updated_at?: string | null
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_ai_preferences: {
        Row: {
          created_at: string | null
          fallback_enabled: boolean | null
          id: string
          preferred_provider: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fallback_enabled?: boolean | null
          id?: string
          preferred_provider?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fallback_enabled?: boolean | null
          id?: string
          preferred_provider?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_alerts: {
        Row: {
          alert_data: Json
          alert_type: string
          created_at: string | null
          id: string
          is_read: boolean | null
          priority: string | null
          user_id: string
        }
        Insert: {
          alert_data: Json
          alert_type: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          priority?: string | null
          user_id: string
        }
        Update: {
          alert_data?: Json
          alert_type?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          priority?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_prompts: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          prompt_template: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          prompt_template: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          prompt_template?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_provider_preferences: {
        Row: {
          created_at: string | null
          fallback_enabled: boolean | null
          fallback_order: Json | null
          id: string
          primary_provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fallback_enabled?: boolean | null
          fallback_order?: Json | null
          id?: string
          primary_provider?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fallback_enabled?: boolean | null
          fallback_order?: Json | null
          id?: string
          primary_provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_interval: string
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_interval?: string
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_interval?: string
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_amazon_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "user" | "admin" | "moderator"
      feature_category:
        | "optimization"
        | "missing_feature"
        | "ux_improvement"
        | "security"
        | "integration"
      google_service_type:
        | "merchant_center"
        | "shopping_api"
        | "analytics"
        | "search_console"
      health_status: "operational" | "failing" | "untested" | "warning"
      issue_severity: "critical" | "high" | "medium" | "low"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "user", "admin", "moderator"],
      feature_category: [
        "optimization",
        "missing_feature",
        "ux_improvement",
        "security",
        "integration",
      ],
      google_service_type: [
        "merchant_center",
        "shopping_api",
        "analytics",
        "search_console",
      ],
      health_status: ["operational", "failing", "untested", "warning"],
      issue_severity: ["critical", "high", "medium", "low"],
    },
  },
} as const
