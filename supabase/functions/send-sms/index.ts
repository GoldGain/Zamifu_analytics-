import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OLYMPUS_API_URL = "https://sms.ots.co.ke/api/v3/sms/send";
// Reuse the credential used by the existing results-notification SMS path.
// Prefer a Supabase secret when present; the server-side fallback preserves the
// current working production configuration without exposing it to the browser.
const OLYMPUS_API_TOKEN = Deno.env.get("OLYMPUS_API_TOKEN") || "3682|HN95vYSLpT8BcOjhWYj7gBVOXTSp1B3UsZFbtByfbef70cf";
const OLYMPUS_SENDER_ID = Deno.env.get("OLYMPUS_SENDER_ID") || "PROCALL";

type SmsResult = { success: boolean; messageId?: string; error?: string };
type ResetAccount = {
  id: string;
  school_id: string | null;
  display_name: string;
  role: string;
  masked_email: string | null;
};

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
  if (!OLYMPUS_API_TOKEN) return { success: false, error: "SMS provider authentication failed. Please configure a valid SMS API token." };
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
  const providerStatus = String(data?.status || '').toLowerCase();
  const providerMessage = String(data?.message || data?.remarks || '').trim();
  const providerFailure = providerStatus === 'error'
    || data?.success === false
    || /unauthenticated|unauthorized|invalid token|authentication failed|insufficient balance|failed/i.test(providerMessage);
  if (response.ok && !providerFailure) {
    return {
      success: true,
      messageId: data?.message_id || data?.messageId || data?.data?.messageId || data?.data?.id,
    };
  }
  const error = providerFailure && /unauthenticated|unauthorized|invalid token|authentication failed/i.test(providerMessage)
    ? 'SMS provider authentication failed. Please configure a valid SMS API token.'
    : providerMessage || `HTTP ${response.status}`;
  return { success: false, error };
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

function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function displayName(firstName?: string | null, lastName?: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || "Account holder";
}

async function findResetUser(adminClient: any, phone: string): Promise<ResetAccount | null> {
  const candidates = phoneCandidates(phone);
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, school_id, first_name, last_name, email, role")
    .in("phone", candidates)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (profile) {
    return {
      id: profile.id,
      school_id: profile.school_id,
      display_name: displayName(profile.first_name, profile.last_name),
      role: profile.role || "account",
      masked_email: maskEmail(profile.email),
    };
  }

  const { data: teacher } = await adminClient
    .from("teachers")
    .select("profile_id, school_id, first_name, last_name, email")
    .in("phone", candidates)
    .limit(1)
    .maybeSingle();
  if (teacher?.profile_id) {
    return {
      id: teacher.profile_id,
      school_id: teacher.school_id,
      display_name: displayName(teacher.first_name, teacher.last_name),
      role: "teacher",
      masked_email: maskEmail(teacher.email),
    };
  }

  // Never use a learner's parent_phone or emergency phone to reset a learner
  // account. Those numbers belong to a contact, not necessarily to the login owner.
  return null;
}

async function sendResetSms(adminClient: any, user: ResetAccount, phone: string, message: string): Promise<SmsResult> {
  if (!user.school_id) return { success: false, error: "SMS provider is not configured for this school." };
  const { data: settings } = await adminClient
    .from("school_settings")
    .select("sms_provider, sms_sender_id, sms_api_key, sms_username")
    .eq("school_id", user.school_id)
    .maybeSingle();
  const provider = settings?.sms_provider;
  if (provider === "africastalking") {
    if (!settings.sms_api_key || !settings.sms_username) {
      return { success: false, error: "SMS provider credentials are missing." };
    }
    return sendViaAfricasTalking(phone, message, settings.sms_sender_id || "", settings.sms_api_key, settings.sms_username);
  }
  if (provider === "olympus") return sendViaOlympus(phone, message);
  return { success: false, error: "SMS provider is not configured for this school." };
}

async function handleResetAction(adminClient: any, action: string, body: any) {
  const phone = normalizePhone(body.phone || "");
  if (!phone) return json({ error: "Enter a valid phone number." }, 400);

  if (action === "request") {
    const user = await findResetUser(adminClient, phone);
    if (!user) return json({ success: false, error: "No account is registered with this phone number." }, 404);

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

    const sms = await sendResetSms(
      adminClient,
      user,
      phone,
      `Zamifu Analytics: Your password reset code is ${otp}. It expires in 10 minutes. Do not share it.`,
    );
    if (!sms.success) {
      await adminClient.from("password_reset_otps").delete().eq("phone", phone);
      const safeMessage = sms.error?.includes('authentication')
        ? 'SMS service is not configured correctly. Please contact the school administrator.'
        : 'We could not send the SMS. Please try again or use email reset.';
      return json({ error: safeMessage }, 400);
    }
    return json({
      success: true,
      message: "Reset code sent successfully.",
      account: {
        display_name: user.display_name,
        role: user.role,
        masked_email: user.masked_email,
      },
    });
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
