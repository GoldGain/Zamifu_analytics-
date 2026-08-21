import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CustomField = {
  variable_name?: string;
  value?: string | number | null;
};

type PaystackVerification = {
  status?: boolean;
  message?: string;
  data?: {
    id?: number;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    paid_at?: string;
    customer?: { email?: string };
    metadata?: { custom_fields?: CustomField[] } | CustomField[] | null;
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalize = (value: unknown) => String(value ?? "").trim();

const customFieldValue = (metadata: PaystackVerification["data"] extends infer D
  ? D extends { metadata?: infer M }
    ? M
    : never
  : never, variableName: string): string => {
  const fields = Array.isArray(metadata)
    ? metadata
    : metadata && typeof metadata === "object" && Array.isArray((metadata as { custom_fields?: CustomField[] }).custom_fields)
      ? (metadata as { custom_fields: CustomField[] }).custom_fields
      : [];
  const field = fields.find((item) => normalize(item.variable_name) === variableName);
  return normalize(field?.value);
};

const activeLearnerCount = async (admin: ReturnType<typeof createClient>, schoolId: string) => {
  const { count, error } = await admin
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .eq("status", "active");
  if (error) throw new Error(`Could not count active learners: ${error.message}`);
  return Number(count || 0);
};

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
    if (!['school_admin', 'super_admin', 'master_super_admin', 'reseller_super_admin'].includes(String(profile.role))) {
      return json({ error: "Only an authorized school administrator can activate a school subscription" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const reference = normalize(body?.reference);
    if (!reference) return json({ error: "Payment reference is required" }, 400);

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name, reseller_id, fee_per_learner_per_term, fee_per_learner_per_year")
      .eq("id", profile.school_id)
      .maybeSingle();
    if (schoolError || !school) return json({ error: "School could not be found" }, 404);

    const verificationResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
    });
    const verification = await verificationResponse.json() as PaystackVerification;
    const transaction = verification.data;
    if (!verificationResponse.ok || !verification.status || !transaction) {
      return json({ error: "Paystack could not verify this transaction", detail: verification.message || "Verification failed" }, 402);
    }
    if (String(transaction.status).toLowerCase() !== "success") return json({ error: "Payment is not successful" }, 402);
    if (normalize(transaction.reference) !== reference) return json({ error: "Payment reference mismatch" }, 409);
    if (normalize(transaction.currency).toUpperCase() !== "KES") return json({ error: "Only KES payments are accepted" }, 400);

    const schoolFromMetadata = customFieldValue(transaction.metadata, "school_id");
    if (!schoolFromMetadata || schoolFromMetadata !== String(school.id)) {
      return json({ error: "Payment is not linked to this school" }, 409);
    }

    const period = customFieldValue(transaction.metadata, "period") || "One Term";
    const feeFromMetadata = Number(customFieldValue(transaction.metadata, "fee_per_learner"));
    const learnersFromMetadata = Number(customFieldValue(transaction.metadata, "learners_count"));
    const learnerCount = await activeLearnerCount(admin, String(school.id));
    if (learnerCount <= 0) return json({ error: "No active learners were found for this school" }, 400);
    if (learnersFromMetadata > 0 && learnersFromMetadata !== learnerCount) {
      return json({ error: "The learner count changed before verification. Please restart payment." }, 409);
    }

    const configuredFee = Number(school.fee_per_learner_per_term) || 50;
    const configuredAnnualFee = Number(school.fee_per_learner_per_year) || 60;
    const isAnnual = period.toLowerCase().includes("annual") || period.toLowerCase().includes("year");
    const expectedFee = isAnnual ? configuredAnnualFee : configuredFee;
    const feePerLearner = feeFromMetadata > 0 ? feeFromMetadata : expectedFee;
    if (feePerLearner !== expectedFee) return json({ error: "Payment price does not match the configured school pricing" }, 409);

    const expectedAmountKsh = learnerCount * expectedFee;
    const expectedAmountSubunits = expectedAmountKsh * 100;
    if (Number(transaction.amount) !== expectedAmountSubunits) {
      return json({ error: "Payment amount does not match the current learner count and pricing" }, 409);
    }

    const { data: activation, error: activationError } = await admin.rpc("record_verified_school_payment", {
      p_school_id: school.id,
      p_payment_reference: reference,
      p_paystack_transaction_id: transaction.id ? String(transaction.id) : null,
      p_learners_count: learnerCount,
      p_fee_per_learner: expectedFee,
      p_amount: expectedAmountKsh,
      p_currency: "KES",
      p_term_label: period,
      p_paid_by_email: profile.email || userData.user.email || null,
      p_paid_by_name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
    });
    if (activationError) {
      console.error("Verified Paystack payment activation failed", activationError.message);
      return json({ error: "Payment was verified but subscription activation failed. Support must review this reference." }, 500);
    }

    return json({
      ok: true,
      reference,
      learnerCount,
      amountKsh: expectedAmountKsh,
      billingPeriod: period,
      subscription: activation,
    });
  } catch (error) {
    console.error("Paystack verification error", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Payment verification failed. Please try again or contact support." }, 500);
  }
});
