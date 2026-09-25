import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const text = (value: unknown) => String(value ?? "").trim();
const MAX_MINUTES = 60;

async function sendNotification(to: string, targetName: string, masterName: string, schoolName: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!apiKey || !to) return { sent: false, error: apiKey ? "Target has no email" : "RESEND_API_KEY is not configured" };
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "Zamifu Analytics <notifications@zamifu.company>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Zamifu Analytics support access notification",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><h2>Support access was opened</h2><p>Hello ${targetName || "there"},</p><p>Master support administrator <strong>${masterName || "Zamifu Support"}</strong> opened a temporary support session for your <strong>${schoolName || "school"}</strong> account.</p><p>The session is limited to ${MAX_MINUTES} minutes and is recorded in the platform audit log. You do not need to take any action.</p></div>`,
    }),
  });
  const data = await response.json().catch(() => ({}));
  return response.ok ? { sent: true } : { sent: false, error: text(data?.message) || `Resend HTTP ${response.status}` };
}
async function sendEndNotification(to: string, targetName: string, masterName: string, reason: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!apiKey || !to) return { sent: false };
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "Zamifu Analytics <notifications@zamifu.company>";
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: "Zamifu Analytics support access ended", html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><h2>Support access ended</h2><p>The temporary Zamifu support session for <strong>${targetName || "your account"}</strong> has ended.</p><p>Reason: <strong>${reason || "session_end"}</strong>. If you did not expect this, contact support.</p></div>` }) });
  return { sent: response.ok };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Authorization required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);
  const { data: master } = await admin.from("profiles").select("id, first_name, last_name, email, role, is_active").eq("id", authData.user.id).maybeSingle();
  if (!master || master.is_active !== true || master.role !== "master_super_admin" || text(master.email).toLowerCase() !== "martinmakau2005@gmail.com") return json({ error: "Only the master support administrator may use impersonation" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = text(body?.action) || "search";
  if (action === "search") {
    const query = text(body?.query).toLowerCase();
    if (query.length < 2) return json({ targets: [] });
    const [{ data: profiles }, { data: students }, { data: schools }] = await Promise.all([
      admin.from("profiles").select("id, first_name, last_name, email, role, school_id, is_active").neq("role", "master_super_admin").eq("is_active", true).limit(2000),
      admin.from("students").select("profile_id, admission_number, assessment_number, school_id").limit(5000),
      admin.from("schools").select("id, name").limit(2000),
    ]);
    const studentByProfile = new Map((students || []).filter((row) => row.profile_id).map((row) => [row.profile_id, row]));
    const schoolById = new Map((schools || []).map((row) => [row.id, row.name]));
    const targets = (profiles || []).filter((profile) => {
      const student = studentByProfile.get(profile.id);
      const haystack = [profile.first_name, profile.last_name, profile.email, profile.role, student?.admission_number, student?.assessment_number, schoolById.get(profile.school_id)].map(text).join(" ").toLowerCase();
      return haystack.includes(query);
    }).slice(0, 50).map((profile) => {
      const student = studentByProfile.get(profile.id);
      return { id: profile.id, name: `${text(profile.first_name)} ${text(profile.last_name)}`.trim() || "Unnamed user", email: profile.email, role: profile.role, school_id: profile.school_id, school_name: schoolById.get(profile.school_id) || null, admission_number: student?.admission_number || null, assessment_number: student?.assessment_number || null };
    });
    return json({ targets });
  }

  if (action === "start") {
    const targetId = text(body?.target_user_id);
    if (!targetId || targetId === master.id) return json({ error: "A different target account is required" }, 400);
    const { data: target } = await admin.from("profiles").select("id, first_name, last_name, email, role, school_id, is_active").eq("id", targetId).maybeSingle();
    if (!target || target.is_active !== true || target.role === "master_super_admin") return json({ error: "Target account is unavailable" }, 404);
    if (!text(target.email)) return json({ error: "The target account has no email address and cannot receive a secure support session" }, 400);
    const { data: school } = target.school_id ? await admin.from("schools").select("name").eq("id", target.school_id).maybeSingle() : { data: null };
    const expiresAt = new Date(Date.now() + MAX_MINUTES * 60_000).toISOString();
    const { data: audit, error: auditError } = await admin.from("impersonation_audit").insert({ master_user_id: master.id, impersonator_email: master.email, target_user_id: target.id, target_email: target.email, target_role: target.role, target_school_id: target.school_id, expires_at: expiresAt, metadata: { source: "master_admin_support" } }).select("id").single();
    if (auditError) return json({ error: auditError.message }, 500);
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.email });
    if (linkError || !link?.properties?.hashed_token) {
      await admin.from("impersonation_audit").update({ ended_at: new Date().toISOString(), end_reason: "session_generation_failed" }).eq("id", audit.id);
      return json({ error: linkError?.message || "Could not create a temporary session" }, 500);
    }
    const masterName = `${text(master.first_name)} ${text(master.last_name)}`.trim();
    const notification = await sendNotification(target.email, `${text(target.first_name)} ${text(target.last_name)}`.trim(), masterName, text(school?.name));
    await admin.from("impersonation_audit").update({ notified_at: notification.sent ? new Date().toISOString() : null, metadata: { source: "master_admin_support", notification_error: notification.sent ? null : notification.error } }).eq("id", audit.id);
    return json({ audit_id: audit.id, expires_at: expiresAt, token_hash: link.properties.hashed_token, target: { id: target.id, name: `${text(target.first_name)} ${text(target.last_name)}`.trim(), email: target.email, role: target.role, school_name: school?.name || null }, notification });
  }

  if (action === "end") {
    const auditId = text(body?.audit_id);
    if (!auditId) return json({ error: "audit_id is required" }, 400);
    const reason = text(body?.reason) || "manual_exit";
    const { data: audit } = await admin.from("impersonation_audit").select("target_user_id, target_email").eq("id", auditId).eq("master_user_id", master.id).is("ended_at", null).maybeSingle();
    if (!audit) return json({ ok: true });
    const { data: target } = await admin.from("profiles").select("first_name, last_name, email").eq("id", audit.target_user_id).maybeSingle();
    const { error } = await admin.from("impersonation_audit").update({ ended_at: new Date().toISOString(), end_reason: reason }).eq("id", auditId).eq("master_user_id", master.id).is("ended_at", null);
    if (error) return json({ error: error.message }, 500);
    await sendEndNotification(text(audit.target_email || target?.email), `${text(target?.first_name)} ${text(target?.last_name)}`.trim(), `${text(master.first_name)} ${text(master.last_name)}`.trim(), reason);
    return json({ ok: true });
  }
  return json({ error: "Unsupported action" }, 400);
});
