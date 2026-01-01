import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, userId } = await req.json();

    console.log('Creating Midtrans token for amount:', amount, 'userId:', userId);

    if (!amount || !userId) {
      throw new Error('Amount and userId are required');
    }

    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's token to verify they're authenticated
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('User not authenticated');
    }

    // Verify the userId matches the authenticated user
    if (user.id !== userId) {
      throw new Error('User ID mismatch');
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    if (!midtransServerKey) {
      throw new Error('MIDTRANS_SERVER_KEY is not configured');
    }

    // Generate unique order ID with app-specific prefix
    const orderId = `AFFGO-${userId.slice(0, 8)}-${Date.now()}`;

    // Create transaction record
    const { error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: amount,
        status: 'pending',
        order_id: orderId,
      });

    if (insertError) {
      console.error('Error creating transaction:', insertError);
      throw new Error('Failed to create transaction record');
    }

    // Create Midtrans Snap transaction
    // Automatically detect sandbox vs production based on server key prefix
    const isSandbox = midtransServerKey.startsWith('SB-');
    const midtransUrl = isSandbox
      ? 'https://app.sandbox.midtrans.com/snap/v1/transactions'
      : 'https://app.midtrans.com/snap/v1/transactions';

    const authString = btoa(midtransServerKey + ':');

    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        email: user.email,
      },
      callbacks: {
        finish: `${req.headers.get('origin') || 'https://affgowebapp.vercel.app'}/topup?status=success`,
      },
      // Webhook notification URL - works even without dashboard configuration
      // This ensures Midtrans sends payment notifications to our Cloudflare router
      "callbacks.notification_url": "https://viralgen-midtrans-router.mursalinasrul.workers.dev/",
    };

    console.log('Calling Midtrans API with payload:', midtransPayload);

    const midtransResponse = await fetch(midtransUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(midtransPayload),
    });

    const midtransData = await midtransResponse.json();
    console.log('Midtrans response:', midtransData);

    if (!midtransResponse.ok) {
      throw new Error(midtransData.error_messages?.join(', ') || 'Midtrans API error');
    }

    // Update transaction with snap token
    await supabase
      .from('transactions')
      .update({ snap_token: midtransData.token })
      .eq('order_id', orderId);

    return new Response(
      JSON.stringify({
        redirect_url: midtransData.redirect_url,
        token: midtransData.token,
        order_id: orderId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in create-midtrans-token:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
