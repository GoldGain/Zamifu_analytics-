import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-zamifu-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const text = (value: unknown) => String(value ?? "").trim();
const normalizePhone = (value: string) => { let phone = value.replace(/\s+/g, ""); if (phone.startsWith("0")) phone = "+254" + phone.slice(1); else if (phone.startsWith("254")) phone = "+" + phone; else if (/^[17]/.test(phone)) phone = "+254" + phone; else if (!phone.startsWith("+")) phone = "+" + phone; return phone; };
const unique = (values: unknown[]) => Array.from(new Set(values.map((value) => text(value)).filter(Boolean)));
const cleanSms = (value: string) => value.replace(/[^\w\s.,;:!?@#$%&*()\-+=/\[\]{}|<>~^`\n]/g, "");

async function sendEmail(to: string[], schoolName: string, trialEnd: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "Zamifu Analytics <notifications@zamifu.company>";
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY is not configured" };
  if (!to.length) return { sent: false, error: "No school administrator email address is available" };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject: `Zamifu Analytics trial ended — ${schoolName}`, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><h2>Your Zamifu Analytics free trial has ended</h2><p>The 60-day free trial for <strong>${schoolName}</strong> ended on <strong>${new Date(trialEnd).toLocaleDateString()}</strong>.</p><p>Please sign in to choose a subscription plan and continue using the school portal.</p><p><a href="https://zamifu.company/school-admin/subscription-receipts" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">View subscription plans</a></p></div>` })) });
  const data = await response.json().catch(() => ({}));
  return response.ok ? { sent: true } : { sent: false, error: text(data?.message) || `Resend HTTP ${response.status}` };
}

async function sendSms(phone: string, message: string, settings: Record<string, unknown> | null) {
  const provider = text(settings?.sms_provider) || "olympus";
  if (provider === "africastalking") {
    const apiKey = text(settings?.sms_api_key); const username = text(settings?.sms_username); if (!apiKey || !username) return { sent: false, error: "Africa's Talking credentials are missing" };
    const body = new URLSearchParams({ username, to: normalizePhone(phone), message: cleanSms(message), from: text(settings?.sms_sender_id) });
    const response = await fetch("https://api.africastalking.com/version1/messaging", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey }, body: body.toString() });
    const data = await response.json().catch(() => ({})); const recipient = data?.SMSMessageData?.Recipients?.[0]; return recipient?.status === "Success" || recipient?.statusCode === 101 ? { sent: true } : { sent: false, error: text(recipient?.status) || `SMS HTTP ${response.status}` };
  }
  const token = Deno.env.get("OLYMPUS_API_TOKEN") || ""; if (!token) return { sent: false, error: "OLYMPUS_API_TOKEN is not configured" };
  const response = await fetch("https://sms.ots.co.ke/api/v3/sms/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ recipient: normalizePhone(phone).replace(/^\+/, ""), sender_id: Deno.env.get("OLYMPUS_SENDER_ID") || "ZAMIFU", type: "plain", message: cleanSms(message) }) });
  const data = await response.json().catch(() => ({})); const providerMessage = text(data?.message || data?.remarks); return response.ok && data?.success !== false && String(data?.status || "").toLowerCase() !== "error" ? { sent: true } : { sent: false, error: providerMessage || `SMS HTTP ${response.status}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const cronSecret = Deno.env.get("TRIAL_NOTIFICATION_CRON_SECRET") || "";
  if (!serviceRoleKey || text(req.headers.get("Authorization")) !== `Bearer ${serviceRoleKey}` || !cronSecret || req.headers.get("x-zamifu-cron-secret") !== cronSecret) return json({ error: "Unauthorized" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""; const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: schools, error } = await admin.from("schools").select("id,name,email,phone,admin_phone,principal_phone,trial_expires_at,created_at,subscription_status,subscription_expires_at").neq("subscription_status", "active").limit(500);
  if (error) return json({ error: error.message }, 500);
  const now = Date.now(); let processed = 0; let emailed = 0; let smsSent = 0; const failures: unknown[] = [];
  for (const school of schools || []) {
    const trialEnd = school.trial_expires_at || (school.created_at ? new Date(new Date(school.created_at).getTime() + 60 * 86400000).toISOString() : null);
    if (!trialEnd || new Date(trialEnd).getTime() > now || (school.subscription_expires_at && new Date(school.subscription_expires_at).getTime() > now)) continue;
    const { data: admins } = await admin.from("profiles").select("id,email,phone,first_name,last_name").eq("school_id", school.id).eq("role", "school_admin").limit(50);
    const emails = unique([...(admins || []).map((profile) => profile.email), school.email]);
    const phones = unique([...(admins || []).map((profile) => profile.phone), school.phone, school.admin_phone, school.principal_phone]);
    const { data: settings } = await admin.from("school_settings").select("sms_provider,sms_sender_id,sms_api_key,sms_username").eq("school_id", school.id).maybeSingle();
    const { data: existing } = await admin.from("trial_expiry_notification_deliveries").select("school_id,email_sent_at,sms_sent_at").eq("school_id", school.id).maybeSingle();
    const delivery = existing || { email_sent_at: null, sms_sent_at: null };
    let emailResult = delivery.email_sent_at ? { sent: true } : await sendEmail(emails, school.name, trialEnd);
    if (emailResult.sent) emailed++;
    const smsMessage = `Zamifu Analytics: The free trial for ${school.name} ended on ${new Date(trialEnd).toLocaleDateString()}. Sign in to choose a subscription plan.`;
    let smsResult = delivery.sms_sent_at ? { sent: true } : { sent: false, error: "No phone number available" };
    for (const phone of phones) { if (delivery.sms_sent_at) break; const result = await sendSms(phone, smsMessage, settings); if (result.sent) { smsResult = result; break; } smsResult = result; }
    if (smsResult.sent) smsSent++;
    const nowIso = new Date().toISOString();
    await admin.from("trial_expiry_notification_deliveries").upsert({ school_id: school.id, trial_expires_at: trialEnd, email_sent_at: emailResult.sent ? (delivery.email_sent_at || nowIso) : null, sms_sent_at: smsResult.sent ? (delivery.sms_sent_at || nowIso) : null, email_error: emailResult.sent ? null : emailResult.error, sms_error: smsResult.sent ? null : smsResult.error, last_attempted_at: nowIso, updated_at: nowIso }, { onConflict: "school_id" });
    for (const profile of admins || []) await admin.from("notifications").insert({ user_id: profile.id, school_id: school.id, title: "Free trial ended", message: `Your school’s Zamifu Analytics free trial ended on ${new Date(trialEnd).toLocaleDateString()}. Choose a subscription plan to continue.`, type: "billing", action_url: "/school-admin/subscription-receipts" });
    processed++; if (!emailResult.sent || !smsResult.sent) failures.push({ school_id: school.id, email: emailResult.error, sms: smsResult.error });
  }
  return json({ ok: true, processed, emailed, smsSent, failures });
});
