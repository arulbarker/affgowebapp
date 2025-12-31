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
    const payload = await req.json();
    console.log('Midtrans webhook received:', payload);

    const { 
      order_id, 
      transaction_status, 
      fraud_status,
      gross_amount 
    } = payload;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check transaction status
    const isSuccess = 
      (transaction_status === 'capture' && fraud_status === 'accept') ||
      transaction_status === 'settlement';
    
    const isFailed = 
      transaction_status === 'deny' ||
      transaction_status === 'cancel' ||
      transaction_status === 'expire';

    if (isSuccess) {
      console.log('Payment successful for order:', order_id);

      // Get the transaction to find user_id
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select('user_id, amount')
        .eq('order_id', order_id)
        .maybeSingle();

      if (txError || !transaction) {
        console.error('Transaction not found:', txError);
        throw new Error('Transaction not found');
      }

      // Update transaction status
      await supabase
        .from('transactions')
        .update({ status: 'success' })
        .eq('order_id', order_id);

      // Add credits to user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', transaction.user_id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('Profile not found:', profileError);
        throw new Error('Profile not found');
      }

      const newCredits = profile.credits + transaction.amount;
      
      await supabase
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', transaction.user_id);

      console.log('Credits updated for user:', transaction.user_id, 'New balance:', newCredits);

    } else if (isFailed) {
      console.log('Payment failed for order:', order_id);

      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('order_id', order_id);
    }

    return new Response(
      JSON.stringify({ status: 'ok' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in midtrans-webhook:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
