import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  role: 'user' | 'moderator' | 'admin' | 'super_admin';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // SERVER-SIDE authentication - verify the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // SERVER-SIDE role check using secure SECURITY DEFINER function
    const { data: isSuperAdmin, error: roleError } = await supabase
      .rpc('has_role', {
        _user_id: user.id,
        _role: 'super_admin'
      });

    if (roleError) {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la vérification des permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isSuperAdmin) {
      console.warn('User', user.id, 'attempted to create user without super_admin role');
      return new Response(
        JSON.stringify({ error: 'Accès refusé. Seuls les super administrateurs peuvent créer des utilisateurs.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Super admin verified:', user.id);

    // Parse request body
    const { email, password, fullName, role }: CreateUserRequest = await req.json();

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email et mot de passe requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user:', email, 'with role:', role);

    // Create the user with auto-confirm
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { 
        full_name: fullName || '' 
      }
    });

    if (createError) {
      console.error('User creation failed:', createError);
      return new Response(
        JSON.stringify({ 
          error: createError.message || 'Erreur lors de la création de l\'utilisateur' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      console.error('User created but no user object returned');
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de l\'utilisateur' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', newUser.user.id);

    // Assign role if not default
    if (role && role !== 'user') {
      console.log('Assigning role:', role, 'to user:', newUser.user.id);
      
      const { error: roleInsertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: role
        });

      if (roleInsertError) {
        console.error('Failed to assign role:', roleInsertError);
        // Log but don't fail - user was created successfully
        console.warn('User created but role assignment failed. Manual intervention may be required.');
      } else {
        console.log('Role assigned successfully');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role: role || 'user'
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in admin-create-user:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur interne du serveur' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
