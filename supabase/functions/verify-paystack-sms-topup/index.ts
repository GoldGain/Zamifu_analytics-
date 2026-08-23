import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CustomField = { variable_name?: string; value?: string | number | null };
type PaystackVerification = {
  status?: boolean;
  message?: string;
  data?: {
    id?: number;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    customer?: { email?: string };
    metadata?: { custom_fields?: CustomField[] } | CustomField[] | null;
  };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const normalize = (value: unknown) => String(value ?? "").trim();

function customFieldValue(metadata: unknown, variableName: string): string {
  const fields = Array.isArray(metadata)
    ? metadata
    : metadata && typeof metadata === "object" && Array.isArray((metadata as { custom_fields?: CustomField[] }).custom_fields)
      ? (metadata as { custom_fields: CustomField[] }).custom_fields
      : [];
  return normalize(fields.find((item) => normalize(item.variable_name) === variableName)?.value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: "Supabase server configuration is incomplete" }, 500);
    if (!paystackSecret) return json({ error: "Paystack server verification is not configured" }, 503);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Invalid authorization token" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("school_id, role, email, first_name, last_name")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError || !profile?.school_id) return json({ error: "Authenticated user is not linked to a school" }, 403);
    if (String(profile.role) !== "school_admin") return json({ error: "Only a school administrator can purchase SMS credits" }, 403);

    const body = await req.json().catch(() => ({}));
    const reference = normalize(body?.reference);
    if (!reference) return json({ error: "Payment reference is required" }, 400);

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name")
      .eq("id", profile.school_id)
      .maybeSingle();
    if (schoolError || !school) return json({ error: "School could not be found" }, 404);

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
    });
    const verification = await response.json() as PaystackVerification;
    const transaction = verification.data;
    if (!response.ok || !verification.status || !transaction) {
      return json({ error: "Paystack could not verify this transaction", detail: verification.message || "Verification failed" }, 402);
    }
    if (String(transaction.status).toLowerCase() !== "success") return json({ error: "Payment is not successful" }, 402);
    if (normalize(transaction.reference) !== reference) return json({ error: "Payment reference mismatch" }, 409);
    if (normalize(transaction.currency).toUpperCase() !== "KES") return json({ error: "Only KES payments are accepted" }, 400);

    const schoolFromMetadata = customFieldValue(transaction.metadata, "school_id");
    const product = customFieldValue(transaction.metadata, "product");
    const credits = Number(customFieldValue(transaction.metadata, "sms_credits"));
    const amountKsh = Number(transaction.amount || 0) / 100;
    if (schoolFromMetadata !== String(school.id)) return json({ error: "Payment is not linked to this school" }, 409);
    if (product !== "sms_credits") return json({ error: "This payment is not an SMS-credit purchase" }, 409);
    if (!Number.isInteger(credits) || credits <= 0 || amountKsh !== credits) {
      return json({ error: "Payment amount does not match the SMS credits requested" }, 409);
    }

    const { data: topup, error: topupError } = await admin.rpc("record_verified_school_sms_topup", {
      p_school_id: school.id,
      p_payment_reference: reference,
      p_paystack_transaction_id: transaction.id ? String(transaction.id) : null,
      p_credits: credits,
      p_amount_ksh: amountKsh,
      p_paid_by_email: profile.email || userData.user.email || null,
      p_paid_by_name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
    });
    if (topupError) {
      console.error("Verified SMS top-up recording failed:", topupError.message);
      return json({ error: "Payment was verified but SMS credits could not be added. Support must review this reference." }, 500);
    }

    return json({
      ok: true,
      reference,
      creditsAdded: Number(topup?.credits_added || 0),
      smsBalance: Number(topup?.sms_balance || 0),
      alreadyProcessed: Boolean(topup?.already_processed),
    });
  } catch (error) {
    console.error("SMS top-up verification error:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "SMS top-up verification failed. Please try again or contact support." }, 500);
  }
});
