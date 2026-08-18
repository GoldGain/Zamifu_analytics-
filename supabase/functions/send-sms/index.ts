import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OLYMPUS_API_URL = "https://sms.ots.co.ke/api/v3/sms/send";
const OLYMPUS_API_TOKEN = "3682|HN95vYSLpT8BcOjhWYj7gBVOXTSp1B3UsZFbtByfbef70cf";
const OLYMPUS_SENDER_ID = "PROCALL";

type SmsResult = { success: boolean; messageId?: string; error?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: string): string {
  let value = String(phone || "").trim().replace(/\s+/g, "");
  if (value.startsWith("0")) value = "+254" + value.slice(1);
  else if (value.startsWith("254")) value = "+" + value;
  else if (value.startsWith("7") || value.startsWith("1")) value = "+254" + value;
  else if (!value.startsWith("+")) value = "+" + value;
  return value;
}

function phoneCandidates(phone: string): string[] {
  const canonical = normalizePhone(phone);
  const digits = canonical.replace(/^\+/, "");
  return Array.from(new Set([canonical, digits, digits.startsWith("254") ? `0${digits.slice(3)}` : canonical]));
}

async function hashOtp(otp: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(otp));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendViaOlympus(phone: string, message: string): Promise<SmsResult> {
  const recipient = normalizePhone(phone).replace(/^\+/, "");
  const response = await fetch(OLYMPUS_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OLYMPUS_API_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      recipient,
      sender_id: OLYMPUS_SENDER_ID,
      type: "plain",
      message: message.replace(/[^\w\s.,;:!?@#$%&*()\-+=/[\]{}|<>~^`\n]/g, ""),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok) return { success: true, messageId: data?.data?.messageId || data?.data?.id };
  return { success: false, error: data?.message || `HTTP ${response.status}` };
}

async function sendViaAfricasTalking(
  phone: string,
  message: string,
  senderId: string,
  apiKey: string,
  username: string,
): Promise<SmsResult> {
  const formData = new URLSearchParams({
    username,
    to: normalizePhone(phone),
    message: message.replace(/[^\w\s.,;:!?@#$%&*()\-+=/[\]{}|<>~^`\n]/g, ""),
    from: senderId || "",
  });
  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey },
    body: formData.toString(),
  });
  const data = await response.json().catch(() => ({}));
  const recipient = data?.SMSMessageData?.Recipients?.[0];
  if (recipient?.status === "Success" || recipient?.statusCode === 101) return { success: true, messageId: recipient.messageId };
  return { success: false, error: recipient?.status || "SMS send failed" };
}

async function findResetUser(adminClient: any, phone: string) {
  const candidates = phoneCandidates(phone);
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, school_id")
    .in("phone", candidates)
    .limit(1)
    .maybeSingle();
  if (profile) return profile;

  const { data: teacher } = await adminClient
    .from("teachers")
    .select("profile_id, school_id")
    .in("phone", candidates)
    .limit(1)
    .maybeSingle();
  if (teacher?.profile_id) return { id: teacher.profile_id, school_id: teacher.school_id };

  // A learner account uses the email/profile link; parent_phone is accepted only
  // when it maps to a profile email, preventing the students.id/profile.id mix-up.
  const { data: student } = await adminClient
    .from("students")
    .select("profile_id, school_id")
    .in("parent_phone", candidates)
    .limit(1)
    .maybeSingle();
  if (student?.profile_id) return { id: student.profile_id, school_id: student.school_id };

  return null;
}

async function handleResetAction(adminClient: any, action: string, body: any) {
  const phone = normalizePhone(body.phone || "");
  if (!phone) return json({ error: "Enter a valid phone number." }, 400);

  if (action === "request") {
    const user = await findResetUser(adminClient, phone);
    // Do not reveal whether a phone number is registered.
    if (!user) return json({ success: true, message: "If an account matches, a reset code has been sent." });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await hashOtp(otp);
    await adminClient.from("password_reset_otps").delete().eq("phone", phone);
    const { error: insertError } = await adminClient.from("password_reset_otps").insert({
      phone,
      user_id: user.id,
      otp_hash: otpHash,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      attempts: 0,
    });
    if (insertError) return json({ error: "We could not start the reset request. Please try again." }, 500);

    const sms = await sendViaOlympus(phone, `Zamifu Analytics: Your password reset code is ${otp}. It expires in 10 minutes. Do not share it.`);
    if (!sms.success) {
      await adminClient.from("password_reset_otps").delete().eq("phone", phone);
      return json({ error: "We could not send the SMS. Please try again or use email reset." }, 400);
    }
    return json({ success: true, message: "Reset code sent successfully." });
  }

  const otp = String(body.otp || "").trim();
  if (!/^\d{6}$/.test(otp)) return json({ error: "Enter the 6-digit reset code." }, 400);
  const { data: record } = await adminClient
    .from("password_reset_otps")
    .select("id, user_id, otp_hash, expires_at, attempts, verified_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!record) return json({ error: "Reset code expired. Request a new code." }, 400);
  if (new Date(record.expires_at).getTime() < Date.now()) {
    await adminClient.from("password_reset_otps").delete().eq("id", record.id);
    return json({ error: "Reset code expired. Request a new code." }, 400);
  }
  if (Number(record.attempts) >= 5) return json({ error: "Too many incorrect attempts. Request a new code." }, 429);

  const valid = (await hashOtp(otp)) === record.otp_hash;
  if (!valid) {
    await adminClient.from("password_reset_otps").update({ attempts: Number(record.attempts) + 1 }).eq("id", record.id);
    return json({ error: "Incorrect reset code. Please try again." }, 400);
  }

  if (action === "verify") {
    await adminClient.from("password_reset_otps").update({ verified_at: new Date().toISOString() }).eq("id", record.id);
    return json({ success: true, user_id: record.user_id, message: "Reset code verified." });
  }

  if (action === "reset") {
    if (!record.verified_at) return json({ error: "Verify the reset code before setting a new password." }, 400);
    const newPassword = String(body.new_password || "");
    if (newPassword.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(record.user_id, { password: newPassword });
    if (updateError) return json({ error: "We could not update the password. Please try again." }, 400);
    await adminClient.from("password_reset_otps").delete().eq("id", record.id);
    return json({ success: true, message: "Password reset successfully." });
  }

  return json({ error: "Unknown reset action." }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { action } = body;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Password reset is intentionally available without an existing session.
    if (action === "request" || action === "verify" || action === "reset") {
      return await handleResetAction(adminClient, action, body);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Please sign in before sending SMS." }, 401);
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) return json({ error: "Your session has expired. Please sign in again." }, 401);
    const { data: callerProfile } = await callerClient.from("profiles").select("role, school_id").eq("id", callerUser.id).single();
    if (!callerProfile) return json({ error: "Your account profile could not be found." }, 403);

    const { phone, message, school_id } = body;
    if (!phone || !message) return json({ error: "Enter a phone number and message." }, 400);
    const resolvedSchoolId = school_id || callerProfile.school_id;
    const { data: schoolSettings } = await adminClient.from("school_settings").select("sms_provider, sms_sender_id, sms_api_key, sms_username").eq("school_id", resolvedSchoolId).maybeSingle();
    const provider = schoolSettings?.sms_provider || "olympus";
    const sms = provider === "africastalking" && schoolSettings?.sms_api_key && schoolSettings?.sms_username
      ? await sendViaAfricasTalking(phone, message, schoolSettings.sms_sender_id || "", schoolSettings.sms_api_key, schoolSettings.sms_username)
      : await sendViaOlympus(phone, message);

    await adminClient.from("sms_logs").insert({
      school_id: resolvedSchoolId,
      recipient_phone: phone,
      message: message.replace(/[^\w\s.,;:!?@#$%&*()\-+=/[\]{}|<>~^`\n]/g, ""),
      status: sms.success ? "sent" : "failed",
      message_id: sms.messageId || null,
      error_message: sms.error || null,
      sent_by: callerUser.id,
      sent_at: new Date().toISOString(),
    }).catch(() => {});

    if (!sms.success) return json({ error: sms.error || "SMS delivery failed. Please try again." }, 400);
    return json({ success: true, messageId: sms.messageId });
  } catch (err) {
    console.error("SMS Error:", err);
    return json({ error: "We could not complete that request. Please try again." }, 500);
  }
});
