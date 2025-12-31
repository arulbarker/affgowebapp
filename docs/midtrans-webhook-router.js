/**
 * ========================================
 * MIDTRANS CENTRALIZED WEBHOOK ROUTER
 * ========================================
 * 
 * Deploy ini ke Cloudflare Workers untuk routing webhook Midtrans
 * ke multiple aplikasi berdasarkan prefix order_id.
 * 
 * SETUP:
 * 1. Buat akun Cloudflare (gratis)
 * 2. Pergi ke Workers & Pages > Create Worker
 * 3. Copy-paste kode ini
 * 4. Deploy dan copy URL worker
 * 5. Set URL worker di Midtrans Dashboard > Settings > Payment Notification URL
 * 
 * MENAMBAH APLIKASI BARU:
 * - Tambahkan entry baru di APP_ROUTES dengan prefix dan webhook URL
 * - Pastikan order_id di aplikasi baru menggunakan prefix yang unik
 */

// ========================================
// KONFIGURASI ROUTING
// ========================================
// Tambahkan aplikasi baru di sini
const APP_ROUTES = {
  // Format: 'PREFIX': 'WEBHOOK_URL'
  
  // ViralGen - AI Video Generator
  'VIRALGEN': 'https://witqictqfghndyjudxoo.supabase.co/functions/v1/midtrans-webhook',
  
  // Contoh aplikasi lain (uncomment dan sesuaikan):
  // 'SAAS2': 'https://your-other-project.supabase.co/functions/v1/midtrans-webhook',
  // 'ECOMMERCE': 'https://your-ecommerce.com/api/midtrans-webhook',
  // 'MEMBERSHIP': 'https://membership-app.vercel.app/api/payment-callback',
};

// Default webhook jika prefix tidak ditemukan (opsional)
const DEFAULT_WEBHOOK = null; // Set ke URL jika ingin ada fallback

// ========================================
// CORS HEADERS
// ========================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ========================================
// MAIN HANDLER
// ========================================
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle GET request untuk health check
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'Midtrans Webhook Router is running',
        supported_apps: Object.keys(APP_ROUTES),
        usage: 'Send POST request with Midtrans notification payload',
        example: {
          method: 'POST',
          body: { order_id: 'VIRALGEN-xxx-123', transaction_status: 'settlement' }
        }
      }, null, 2), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only accept POST requests for webhook
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Use GET for health check or POST for webhook notifications'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      // Parse the Midtrans notification payload
      const text = await request.text();
      
      if (!text || text.trim() === '') {
        return new Response(JSON.stringify({ 
          error: 'Empty body',
          message: 'Request body cannot be empty. Expected Midtrans notification payload.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let payload;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        return new Response(JSON.stringify({ 
          error: 'Invalid JSON',
          message: 'Failed to parse request body as JSON',
          received: text.substring(0, 100)
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Log incoming notification (untuk debugging di Cloudflare dashboard)
      console.log('📥 Received Midtrans notification:', JSON.stringify({
        order_id: payload.order_id,
        transaction_status: payload.transaction_status,
        payment_type: payload.payment_type,
        gross_amount: payload.gross_amount,
        transaction_time: payload.transaction_time,
      }));

      // Extract order_id
      const orderId = payload.order_id;
      
      if (!orderId) {
        console.error('❌ No order_id in payload');
        return new Response(JSON.stringify({ 
          error: 'Invalid payload',
          message: 'order_id is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Find matching app based on order_id prefix
      const targetWebhook = findTargetWebhook(orderId);
      
      if (!targetWebhook) {
        console.error(`❌ No route found for order_id: ${orderId}`);
        return new Response(JSON.stringify({ 
          error: 'Route not found',
          message: `No application configured for order_id prefix: ${orderId.split('-')[0]}`,
          hint: 'Add the prefix to APP_ROUTES configuration'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`🔀 Routing to: ${targetWebhook}`);

      // Forward the notification to the target webhook
      const forwardResponse = await fetch(targetWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-By': 'Midtrans-Router',
          'X-Original-Order-Id': orderId,
        },
        body: JSON.stringify(payload),
      });

      // Get response from target
      const responseBody = await forwardResponse.text();
      
      console.log(`✅ Forward response: ${forwardResponse.status} - ${responseBody.substring(0, 200)}`);

      // Return success to Midtrans
      // Midtrans expects 200 OK to confirm notification received
      return new Response(JSON.stringify({
        status: 'success',
        message: 'Notification forwarded successfully',
        forwarded_to: targetWebhook.replace(/https?:\/\/([^\/]+).*/, '$1'), // Hide full URL
        target_response_status: forwardResponse.status,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ Router error:', error.message);
      
      // Still return 200 to Midtrans to prevent retries
      // Log the error for debugging
      return new Response(JSON.stringify({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 200, // Return 200 to prevent Midtrans retry loops
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Find target webhook URL based on order_id prefix
 * @param {string} orderId - The order ID from Midtrans
 * @returns {string|null} - The target webhook URL or null
 */
function findTargetWebhook(orderId) {
  // Extract prefix (first part before the dash)
  const prefix = orderId.split('-')[0].toUpperCase();
  
  // Check if we have a route for this prefix
  if (APP_ROUTES[prefix]) {
    return APP_ROUTES[prefix];
  }
  
  // Try matching with more flexible patterns
  for (const [routePrefix, webhookUrl] of Object.entries(APP_ROUTES)) {
    if (orderId.toUpperCase().startsWith(routePrefix)) {
      return webhookUrl;
    }
  }
  
  // Return default webhook if configured
  return DEFAULT_WEBHOOK;
}

// ========================================
// PANDUAN PENGGUNAAN
// ========================================
/*

📋 LANGKAH-LANGKAH DEPLOY:

1. BUAT CLOUDFLARE ACCOUNT (GRATIS)
   - Pergi ke https://dash.cloudflare.com/sign-up
   - Verifikasi email

2. BUAT WORKER BARU
   - Klik "Workers & Pages" di sidebar
   - Klik "Create application"
   - Pilih "Create Worker"
   - Beri nama (contoh: "midtrans-router")
   - Klik "Deploy"

3. EDIT KODE WORKER
   - Klik "Edit code"
   - Hapus semua kode default
   - Copy-paste seluruh file ini
   - Klik "Save and Deploy"

4. COPY URL WORKER
   - URL akan seperti: https://midtrans-router.username.workers.dev
   - Copy URL ini

5. SET DI MIDTRANS DASHBOARD
   - Login ke https://dashboard.midtrans.com
   - Pergi ke Settings > Payment Notification URL
   - Paste URL worker
   - Save

📋 MENAMBAH APLIKASI BARU:

1. Di aplikasi baru, gunakan prefix unik untuk order_id:
   ```javascript
   const orderId = `APPNAME-${userId}-${timestamp}`;
   ```

2. Tambahkan di APP_ROUTES di file ini:
   ```javascript
   const APP_ROUTES = {
     'VIRALGEN': 'https://xxx.supabase.co/functions/v1/midtrans-webhook',
     'APPNAME': 'https://yyy.supabase.co/functions/v1/midtrans-webhook', // ← Tambah ini
   };
   ```

3. Re-deploy worker di Cloudflare

📋 PAYMENT TYPES YANG DIDUKUNG:

Router ini mendukung SEMUA payment type Midtrans:
- ✅ Credit Card (credit_card)
- ✅ Bank Transfer (bank_transfer) - BCA, BNI, BRI, Mandiri, Permata
- ✅ E-Wallet - GoPay, ShopeePay, DANA, OVO, LinkAja
- ✅ Convenience Store - Indomaret, Alfamart
- ✅ Cardless Credit - Akulaku, Kredivo
- ✅ Direct Debit - BCA Klikpay, CIMB Clicks, etc.

📋 DEBUGGING:

1. Lihat logs di Cloudflare Dashboard:
   - Workers & Pages > midtrans-router > Logs > Real-time logs

2. Test manual dengan curl:
   ```bash
   curl -X POST https://midtrans-router.username.workers.dev \
     -H "Content-Type: application/json" \
     -d '{"order_id":"VIRALGEN-test-123","transaction_status":"settlement"}'
   ```

📋 BIAYA:

Cloudflare Workers Free Plan:
- 100,000 requests/hari (GRATIS)
- Lebih dari cukup untuk kebanyakan aplikasi

*/
