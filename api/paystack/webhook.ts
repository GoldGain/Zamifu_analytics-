import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Paystack webhook for Zamifu Analytics.
 *
 * The single Paystack account now delivers every charge.success event to the
 * Zamifu relay, which forwards the original signed payload to this endpoint and
 * to Zamifu Learn. This handler therefore has to be safe to call more than once:
 * record_verified_school_payment() is atomic and keyed on the Paystack
 * reference, so a duplicate delivery returns already_processed instead of
 * extending the subscription twice.
 */

export const config = { api: { bodyParser: false } };

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  on?: (event: string, listener: (chunk?: unknown) => void) => void;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

type CustomField = { variable_name?: string; value?: string | number | null };

type PaystackTransaction = {
  id?: number;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  customer?: { email?: string };
  metadata?: { custom_fields?: CustomField[] } | CustomField[] | null;
};

const headerOf = (headers: RequestLike["headers"], name: string): string | null => {
  const direct = headers[name];
  const lower = headers[name.toLowerCase()];
  const value = direct ?? lower;
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : null;
};

const readRawBody = (request: RequestLike): Promise<string> => {
  const body = request.body;
  if (typeof body === "string") return Promise.resolve(body);
  if (Buffer.isBuffer(body)) return Promise.resolve(body.toString("utf8"));
  if (body && typeof body === "object") return Promise.resolve(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    if (!request.on) { resolve(""); return; }
    let data = "";
    request.on("data", (chunk) => { data += String(chunk ?? ""); });
    request.on("end", () => resolve(data));
    request.on("error", (error) => reject(error));
  });
};

const signatureMatches = (raw: string, signature: string | null, secret: string): boolean => {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
};

const customField = (metadata: PaystackTransaction["metadata"], name: string): string => {
  const fields = Array.isArray(metadata)
    ? metadata
    : metadata && typeof metadata === "object" && Array.isArray((metadata as { custom_fields?: CustomField[] }).custom_fields)
      ? (metadata as { custom_fields: CustomField[] }).custom_fields
      : [];
  return String(fields.find((field) => String(field.variable_name ?? "").trim() === name)?.value ?? "").trim();
};

export default async function handler(request: RequestLike, response: ResponseLike): Promise<void> {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") { response.setHeader("Allow", "POST, OPTIONS"); response.status(204).end(); return; }
  if (request.method !== "POST") { response.setHeader("Allow", "POST, OPTIONS"); response.status(405).json({ error: "Method not allowed." }); return; }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !serviceRoleKey || !paystackSecret) { response.status(503).json({ error: "Webhook is not configured." }); return; }

  const raw = await readRawBody(request).catch(() => null);
  if (raw === null) { response.status(400).json({ error: "Unreadable webhook body." }); return; }
  if (!signatureMatches(raw, headerOf(request.headers, "x-paystack-signature"), paystackSecret)) {
    response.status(401).json({ error: "Invalid signature." });
    return;
  }

  let event: { event?: string; data?: PaystackTransaction } | null = null;
  try { event = JSON.parse(raw); } catch { response.status(400).json({ error: "Invalid JSON." }); return; }

  if (event?.event !== "charge.success") { response.status(200).json({ ok: true, ignored: event?.event ?? "unknown" }); return; }
  const reference = String(event.data?.reference ?? "").trim();
  if (!reference) { response.status(400).json({ error: "Missing payment reference." }); return; }

  let transaction: PaystackTransaction | undefined;
  try {
    const verification = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
      signal: AbortSignal.timeout(20000),
    });
    const payload = await verification.json() as { status?: boolean; message?: string; data?: PaystackTransaction };
    if (!verification.ok || payload?.status !== true || !payload.data) {
      console.error("Paystack webhook verification failed", reference, payload?.message ?? verification.status);
      response.status(502).json({ error: "Paystack verification failed." });
      return;
    }
    transaction = payload.data;
  } catch (error) {
    console.error("Paystack webhook verification error", reference, error instanceof Error ? error.message : "unknown");
    response.status(502).json({ error: "Paystack verification failed." });
    return;
  }

  if (String(transaction.status ?? "").toLowerCase() !== "success") { response.status(200).json({ ok: true, ignored: "not successful" }); return; }
  if (String(transaction.currency ?? "").toUpperCase() !== "KES") { response.status(200).json({ ok: true, ignored: "non-KES" }); return; }

  const schoolId = customField(transaction.metadata, "school_id");
  const plan = customField(transaction.metadata, "subscription_plan");
  if (!schoolId || !plan) {
    // Any other product on the shared Paystack account (Zamifu Learn plans,
    // exam wallets, lessons) is simply not an Analytics school subscription.
    response.status(200).json({ ok: true, skipped: "not a school subscription payment" });
    return;
  }

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
  if (problems.length === 0 && Math.round(amountKsh) !== learnersCount * feePerLearner) problems.push("amount does not match learners × fee");
  if (problems.length) {
    // Retrying will not fix a mismatched payment, so acknowledge and flag it for
    // a human instead of letting Paystack redeliver indefinitely.
    console.error("Paystack webhook cannot activate subscription", reference, problems.join("; "));
    response.status(200).json({ ok: false, reference, manual_review: problems });
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: activation, error: activationError } = await admin.rpc("record_verified_school_payment", {
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
  });

  if (activationError) {
    console.error("Paystack webhook activation failed", reference, activationError.message);
    response.status(500).json({ error: "Subscription activation failed." });
    return;
  }

  console.log("Paystack webhook activated school subscription", reference, schoolId);
  response.status(200).json({ ok: true, reference, subscription: activation });
}
