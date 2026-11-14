 * Paystack webhook for Zamifu Analytics school subscriptions.
 *
 * The shared Paystack account delivers every charge.success event to the Zamifu
 * relay, which forwards the original signed payload here and to Zamifu Learn.
 * record_verified_school_payment() is atomic and keyed on the Paystack
 * reference, so duplicate deliveries return already_processed instead of
 * extending a subscription twice.
 *
 * Deliberately dependency-free: it talks to PostgREST with fetch so the function
 * boots from a plain source upload without an import map.
 */

type CustomField = { variable_name?: string; value?: string | number | null };
type Transaction = {
  id?: number;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  customer?: { email?: string };
  metadata?: { custom_fields?: CustomField[] } | CustomField[] | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const trimmed = (value: unknown) => String(value ?? "").trim();

async function hexHmacSha512(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function customField(metadata: Transaction["metadata"], name: string): string {
  const fields = Array.isArray(metadata)
    ? metadata
    : metadata && typeof metadata === "object" && Array.isArray((metadata as { custom_fields?: CustomField[] }).custom_fields)
      ? (metadata as { custom_fields: CustomField[] }).custom_fields
      : [];
  return trimmed(fields.find((field) => trimmed(field.variable_name) === name)?.value);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!supabaseUrl || !serviceRoleKey || !paystackSecret) return json({ error: "Webhook is not configured." }, 503);

  const raw = await request.text();
  const provided = (request.headers.get("x-paystack-signature") ?? "").toLowerCase();
  const expected = await hexHmacSha512(paystackSecret, raw);
  if (!provided || !constantTimeEqual(expected, provided)) return json({ error: "Invalid signature." }, 401);

  let event: { event?: string; data?: Transaction } | null = null;
  try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON." }, 400); }

  if (event?.event !== "charge.success") return json({ ok: true, ignored: event?.event ?? "unknown" });
  const reference = trimmed(event.data?.reference);
  if (!reference) return json({ error: "Missing payment reference." }, 400);

  let transaction: Transaction | undefined;
  try {
    const verification = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const payload = await verification.json() as { status?: boolean; message?: string; data?: Transaction };
    if (!verification.ok || payload?.status !== true || !payload.data) {
      console.error("Paystack webhook verification failed", reference, payload?.message ?? verification.status);
      return json({ error: "Paystack verification failed." }, 502);
    }
    transaction = payload.data;
  } catch (error) {
    console.error("Paystack webhook verification error", reference, error instanceof Error ? error.message : "unknown");
    return json({ error: "Paystack verification failed." }, 502);
  }

  if (trimmed(transaction.status).toLowerCase() !== "success") return json({ ok: true, ignored: "not successful" });
  if (trimmed(transaction.currency).toUpperCase() !== "KES") return json({ ok: true, ignored: "non-KES" });

  const schoolId = customField(transaction.metadata, "school_id");
  const plan = customField(transaction.metadata, "subscription_plan");
  if (!schoolId || !plan) return json({ ok: true, skipped: "not a school subscription payment" });

  const period = customField(transaction.metadata, "period") || "One Term";
  const feePerLearner = Number(customField(transaction.metadata, "fee_per_learner"));
  const learnersCount = Number(customField(transaction.metadata, "learners_count"));
  const amountKsh = Number(transaction.amount) / 100;
  const isAnnual = period.toLowerCase().includes("annual") || period.toLowerCase().includes("year");
  const expectedPlan = isAnnual ? "full_access_50" : "full_access_20";

  const problems: string[] = [];
  if (plan !== expectedPlan) problems.push(`plan ${plan} does not match period ${period}`);
  if (!Number.isSafeInteger(feePerLearner) || feePerLearner <= 0) problems.push("invalid fee_per_learner");
  if (!Number.isSafeInteger(learnersCount) || learnersCount <= 0) problems.push("invalid learners_count");
  if (problems.length === 0 && Math.round(amountKsh) !== learnersCount * feePerLearner) problems.push("amount does not match learners x fee");

  // Never trust the amount alone: compare the quoted price and learner count
  // with the school's own billing configuration, exactly as the in-app
  // verification does, so a crafted checkout cannot buy a term for less.
  if (problems.length === 0) {
    const serviceHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
    const fields = "id,billing_learner_count,fee_per_learner_per_term,fee_per_learner_per_year";
    const schoolResponse = await fetch(`${supabaseUrl}/rest/v1/schools?id=eq.${encodeURIComponent(schoolId)}&select=${fields}`, { headers: serviceHeaders });
    const schools = await schoolResponse.json().catch(() => null);
    const school = Array.isArray(schools) ? schools[0] : null;
    if (!schoolResponse.ok || !school) {
      console.error("Paystack webhook school lookup failed", reference, schoolId);
      return json({ ok: false, reference, manual_review: ["school not found"] });
    }
    const configuredFee = Number(isAnnual ? school.fee_per_learner_per_year : school.fee_per_learner_per_term);
    const expectedFee = Number.isFinite(configuredFee) && configuredFee > 0 ? Math.round(configuredFee) : (isAnnual ? 20 : 10);
    if (feePerLearner !== expectedFee) problems.push(`fee ${feePerLearner} does not match this school's price ${expectedFee}`);

    let billedLearners = Number(school.billing_learner_count) || 0;
    if (billedLearners <= 0) {
      const countResponse = await fetch(
        `${supabaseUrl}/rest/v1/students?school_id=eq.${encodeURIComponent(schoolId)}&is_active=eq.true&status=eq.active&select=id`,
        { headers: { ...serviceHeaders, Prefer: "count=exact", Range: "0-0" } },
      );
      const range = countResponse.headers.get("content-range") || "";
      billedLearners = Number(range.split("/")[1] || 0);
    }
    if (billedLearners <= 0) problems.push("school has no billable learners");
    else if (learnersCount !== billedLearners) problems.push(`learners ${learnersCount} does not match the billed count ${billedLearners}`);
  }
  if (problems.length) {
    // Redelivery cannot fix a mismatched payment, so acknowledge it and surface
    // it for a human instead of letting Paystack retry indefinitely.
    console.error("Paystack webhook cannot activate subscription", reference, problems.join("; "));
    return json({ ok: false, reference, manual_review: problems });
  }

  const activation = await fetch(`${supabaseUrl}/rest/v1/rpc/record_verified_school_payment`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_school_id: schoolId,
      p_payment_reference: reference,
      p_paystack_transaction_id: transaction.id ? String(transaction.id) : null,
      p_learners_count: learnersCount,
      p_fee_per_learner: feePerLearner,
      p_amount: learnersCount * feePerLearner,
      p_currency: "KES",
      p_term_label: period,
      p_paid_by_email: transaction.customer?.email ?? null,
      p_paid_by_name: null,
    }),
  });
  const result = await activation.json().catch(() => null);
  if (!activation.ok) {
    console.error("Paystack webhook activation failed", reference, JSON.stringify(result).slice(0, 300));
    return json({ error: "Subscription activation failed." }, 500);
  }

  console.log("Paystack webhook activated school subscription", reference, schoolId);
  return json({ ok: true, reference, subscription: result });
});
