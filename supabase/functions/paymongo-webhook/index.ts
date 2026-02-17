import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '' 
    )

    const payload = await req.json()
    console.log('Webhook Received:', JSON.stringify(payload))

    // 1. TEST MODE (For CURL)
    if (payload.test_email) {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('subscription_end_date')
        .eq('email', payload.test_email)
        .single();

      let testStart = new Date();
      if (existing?.subscription_end_date && new Date(existing.subscription_end_date) > new Date()) {
        testStart = new Date(existing.subscription_end_date);
      }

      if (payload.plan === 'annual') testStart.setFullYear(testStart.getFullYear() + 1);
      else if (payload.plan === 'lifetime') testStart = new Date('2099-12-31');
      else testStart.setMonth(testStart.getMonth() + 1);

      await supabaseAdmin
        .from('profiles')
        .update({ subscription_status: payload.plan, subscription_end_date: testStart.toISOString() })
        .eq('email', payload.test_email);

      return new Response(JSON.stringify({ success: "Test Stacked" }), { status: 200 });
    }

    // 2. REAL PAYMONGO LOGIC (Link Payments)
    const deepAttributes = payload.data?.attributes?.data?.attributes;
    const customerEmail = deepAttributes?.billing?.email;
    const amount = deepAttributes?.amount; 

    if (!customerEmail) throw new Error("No email in payload");

    // --- PREPAID STACKING LOGIC ---
    // First, check if the user already has active time
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_end_date')
      .eq('email', customerEmail)
      .single();

    let startDate = new Date();
    // If current expiry is in the future, start the new time FROM that expiry
    if (profile?.subscription_end_date && new Date(profile.subscription_end_date) > new Date()) {
      startDate = new Date(profile.subscription_end_date);
    }

    let finalStatus = 'monthly';
    if (amount >= 500000) {
      // Lifetime Logic
      startDate = new Date('2099-12-31');
      finalStatus = 'lifetime';
    } else if (amount >= 300000) {
      // Annual Logic
      startDate.setFullYear(startDate.getFullYear() + 1);
      finalStatus = 'annual';
    } else {
      // MONTHLY LOGIC (This 'else' catches everything below 3000)
      // So 499 (49900 centavos) will correctly fall here!
      startDate.setMonth(startDate.getMonth() + 1);
      finalStatus = 'monthly';
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        subscription_status: finalStatus, 
        subscription_end_date: startDate.toISOString() 
      })
      .eq('email', customerEmail);

    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
})