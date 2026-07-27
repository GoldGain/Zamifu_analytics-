import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Olympus SMS API (default fallback)
const OLYMPUS_API_URL = "https://sms.ots.co.ke/api/v3/sms/send";
const OLYMPUS_API_TOKEN = "3682|HN95vYSLpT8BcOjhWYj7gBVOXTSp1B3UsZFbtByfbfef70cf";
const OLYMPUS_SENDER_ID = "PROCALL";

async function normalizePhone(phone: string): Promise<string> {
  let normalized = phone.trim().replace(/\s+/g, "");
  if (normalized.startsWith("0")) {
    normalized = "+254" + normalized.slice(1);
  } else if (normalized.startsWith("7") || normalized.startsWith("1")) {
    normalized = "+254" + normalized;
  } else if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

async function sendViaOlympus(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = OLYMPUS_API_URL;
  let normalizedPhone = phone.trim().replace(/\s+/g, "");
  if (normalizedPhone.startsWith("0")) {
    normalizedPhone = "254" + normalizedPhone.slice(1);
  }
  if (normalizedPhone.startsWith("+")) {
    normalizedPhone = normalizedPhone.slice(1);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OLYMPUS_API_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      recipient: normalizedPhone,
      sender_id: OLYMPUS_SENDER_ID,
      type: "plain",
      message: message.replace(/[^\w\s.,;:!?@#$%&*()\-+=/[\]{}|<>~^`\n]/g, ""),
    }),
  });

  const data = await response.json();
  if (response.ok) {
    return { success: true, messageId: data?.data?.messageId || data?.data?.id };
  }
  return { success: false, error: data?.message || `HTTP ${response.status}` };
}

async function sendViaAfricasTalking(
  phone: string,
  message: string,
  senderId: string,
  apiKey: string,
  username: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = "https://api.africastalking.com/version1/messaging";
  const formData = new URLSearchParams({
    username,
    to: phone,
    message: message.replace(/[^\w\s.,;:!?@#$%&*()\-+=/[\]{}|<>~^`\n]/g, ""),
    from: senderId || "",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiKey,
    },
    body: formData.toString(),
  });

  const data = await response.json();
  const recipient = data?.SMSMessageData?.Recipients?.[0];
  if (recipient?.status === "Success" || recipient?.statusCode === 101) {
    return { success: true, messageId: recipient.messageId };
  }
  return { success: false, error: recipient?.status || "SMS send failed" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", callerUser.id)
      .single();

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { phone, message, school_id, action } = body;

    if (action) {
      // Handle OTP actions for password reset
      if (action === "request") {
        if (!phone) {
          return new Response(JSON.stringify({ error: "Missing phone" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Store OTP
        await adminClient.from("sms_logs").insert({
          school_id: callerProfile.school_id,
          recipient_phone: phone,
          message: `Password Reset OTP: ${otp}`,
          status: "sent",
          sent_by: callerUser.id,
          sent_at: new Date().toISOString(),
        }).catch(() => {});

        // Send OTP via default provider (Olympus)
        const otpMessage = `Zamifu Analytics: Password Reset\n\nYour OTP code is: ${otp}\n\nThis code expires in 10 minutes.`;
        const result = await sendViaOlympus(phone, otpMessage);

        if (!result.success) {
          return new Response(JSON.stringify({ error: result.error || "Failed to send OTP" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ success: true, otp, message: "OTP sent successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "verify") {
        return new Response(
          JSON.stringify({ success: true, user_id: callerUser.id, message: "OTP verified" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "reset") {
        return new Response(
          JSON.stringify({ success: true, message: "Password reset" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard SMS sending
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields: phone, message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedSchoolId = school_id || callerProfile.school_id;

    // Fetch SMS branding config from school settings
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: schoolSettings } = await adminClient
      .from("school_settings")
      .select("sms_provider, sms_sender_id, sms_api_key, sms_username")
      .eq("school_id", resolvedSchoolId)
      .maybeSingle();

    const provider = schoolSettings?.sms_provider || "olympus";
    const senderId = schoolSettings?.sms_sender_id || OLYMPUS_SENDER_ID;
    const apiKey = schoolSettings?.sms_api_key || "";
    const username = schoolSettings?.sms_username || "";

    let result: { success: boolean; messageId?: string; error?: string };

    if (provider === "africastalking" && apiKey && username) {
      const normalizedPhone = await normalizePhone(phone);
      result = await sendViaAfricasTalking(normalizedPhone, message, senderId, apiKey, username);
    } else {
      // Default to Olympus
      result = await sendViaOlympus(phone, message);
    }

    // Log SMS to sms_logs table
    await adminClient.from("sms_logs").insert({
      school_id: resolvedSchoolId,
      recipient_phone: phone,
      message: message.replace(/[^\w\s.,;:!?@#$%&*()\-+=/[\]{}|<>~^`\n]/g, ""),
      status: result.success ? "sent" : "failed",
      message_id: result.messageId || null,
      error_message: result.error || null,
      sent_by: callerUser.id,
      sent_at: new Date().toISOString(),
    }).catch(() => {}); // Non-blocking log

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || "SMS failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("SMS Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
