import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const otpStore = new Map<string, { code: string; exp: number }>();

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function norm(s: unknown) {
  return String(s || "").trim();
}
function normEmail(s: unknown) {
  return norm(s).toLowerCase();
}
function normPhone(s: unknown) {
  return norm(s).replace(/[^\d+]/g, "");
}
function contactKey(email: string, phone: string) {
  return `${normEmail(email)}|${normPhone(phone)}`;
}
function makeCode(name: string, knec: string) {
  if (knec) return knec.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "SCHOOL";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`.slice(0, 16);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const action = norm(body.action) || "register";

    if (action === "search_schools") {
      const q = norm(body.query);
      if (q.length < 2) return json(200, { schools: [] });
      const fb = await admin
        .from("schools")
        .select("id, name, code, knec_centre_code, county, sub_county, school_level, status")
        .or(`name.ilike.%${q}%,code.ilike.%${q}%,knec_centre_code.ilike.%${q}%`)
        .limit(25);
      if (fb.error) return json(400, { error: fb.error.message });
      return json(200, { schools: fb.data || [] });
    }

    if (action === "check_availability") {
      const name = norm(body.name);
      const email = normEmail(body.email);
      const phone = normPhone(body.phone);
      const knec = norm(body.knec_centre_code).toUpperCase();
      const conflicts: string[] = [];

      if (name) {
        const { data } = await admin.from("schools").select("id").ilike("name", name).limit(1);
        if (data?.length) conflicts.push("School name is already registered");
      }
      if (email) {
        const { data } = await admin.from("schools").select("id").ilike("email", email).limit(1);
        if (data?.length) conflicts.push("Official email is already used by another school");
        const { data: p } = await admin.from("profiles").select("id").ilike("email", email).limit(1);
        if (p?.length) conflicts.push("Email already has a Zamifu account");
      }
      if (phone) {
        const { data } = await admin.from("schools").select("id, phone").not("phone", "is", null).limit(8000);
        if ((data || []).some((r: any) => normPhone(r.phone) === phone)) {
          conflicts.push("Phone number is already used by another school");
        }
      }
      if (knec) {
        const { data } = await admin.from("schools").select("id").ilike("knec_centre_code", knec).limit(1);
        if (data?.length) conflicts.push("KNEC centre code is already registered");
        const { data: c } = await admin.from("schools").select("id").ilike("code", knec).limit(1);
        if (c?.length) conflicts.push("School/centre code is already registered");
      }
      return json(200, { available: conflicts.length === 0, conflicts });
    }

    if (action === "send_otp") {
      const email = normEmail(body.email);
      const phone = normPhone(body.phone);
      if (!email || !phone) return json(400, { error: "Email and phone required" });
      const code = String(Math.floor(100000 + Math.random() * 900000));
      otpStore.set(contactKey(email, phone), { code, exp: Date.now() + 10 * 60 * 1000 });
      return json(200, {
        sent: true,
        channel: "demo",
        demo_code: code,
        message: "Verification code generated",
      });
    }

    if (action === "verify_otp") {
      const email = normEmail(body.email);
      const phone = normPhone(body.phone);
      const code = norm(body.code);
      const row = otpStore.get(contactKey(email, phone));
      if (!row || row.exp < Date.now()) return json(400, { error: "Code expired. Request a new one.", verified: false });
      if (row.code !== code) return json(400, { error: "Invalid verification code", verified: false });
      otpStore.set(contactKey(email, phone), { code: "VERIFIED", exp: Date.now() + 30 * 60 * 1000 });
      return json(200, { verified: true });
    }

    const school_name = norm(body.school_name);
    const school_level = norm(body.school_level);
    const county = norm(body.county);
    const sub_county = norm(body.sub_county);
    const email = normEmail(body.email);
    const phone = normPhone(body.phone || body.admin_phone);
    const knec_centre_code = norm(body.knec_centre_code).toUpperCase();
    const admin_first_name = norm(body.admin_first_name) || "School";
    const admin_last_name = norm(body.admin_last_name) || "Admin";
    const otp_verified = Boolean(body.otp_verified);
    const password = norm(body.password);
    const selected_existing_id = norm(body.selected_existing_id);

    if (!school_name || !school_level || !county || !email || !phone) {
      return json(400, { error: "Missing required fields: school_name, school_level, county, email, phone" });
    }
    if (!otp_verified) return json(400, { error: "Contact must be OTP verified before registration completes" });
    const otpRow = otpStore.get(contactKey(email, phone));
    if (!otpRow || otpRow.code !== "VERIFIED" || otpRow.exp < Date.now()) {
      return json(400, { error: "Please verify your contact with OTP first" });
    }
    if (!password || password.length < 8) return json(400, { error: "Password must be at least 8 characters" });

    const conflicts: string[] = [];
    {
      const { data } = await admin.from("schools").select("id").ilike("name", school_name).limit(1);
      if (data?.length && data[0].id !== selected_existing_id) conflicts.push("School name is already registered");
    }
    {
      const { data } = await admin.from("schools").select("id").ilike("email", email).limit(1);
      if (data?.length && data[0].id !== selected_existing_id) conflicts.push("Official email is already used by another school");
    }
    {
      const { data } = await admin.from("profiles").select("id").ilike("email", email).limit(1);
      if (data?.length) conflicts.push("Email already has a Zamifu user account");
    }
    if (knec_centre_code) {
      const { data } = await admin.from("schools").select("id").ilike("knec_centre_code", knec_centre_code).limit(1);
      if (data?.length && data[0].id !== selected_existing_id) conflicts.push("KNEC centre code is already registered");
    }
    {
      const { data } = await admin.from("schools").select("id, phone").not("phone", "is", null).limit(8000);
      if ((data || []).some((r: any) => normPhone(r.phone) === phone && r.id !== selected_existing_id)) {
        conflicts.push("Phone number is already used by another school");
      }
    }
    if (conflicts.length) return json(409, { error: conflicts.join(". "), conflicts });

    let reseller_id: string | null = body.reseller_id || null;
    if (!reseller_id) {
      const { data: resellers } = await admin
        .from("resellers")
        .select("id")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1);
      reseller_id = resellers?.[0]?.id || null;
      if (!reseller_id) {
        const { data: anyR } = await admin.from("resellers").select("id").limit(1);
        reseller_id = anyR?.[0]?.id || null;
      }
    }

    const code = makeCode(school_name, knec_centre_code);
    const trialExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const schoolPayload: Record<string, unknown> = {
      name: school_name,
      code,
      knec_centre_code: knec_centre_code || null,
      school_level,
      county,
      sub_county: sub_county || null,
      email,
      phone,
      admin_phone: phone,
      principal_name: `${admin_first_name} ${admin_last_name}`.trim(),
      principal_phone: phone,
      curriculum: "CBE",
      status: "active",
      subscription_plan: "trial",
      subscription_status: "trial",
      trial_started_at: new Date().toISOString(),
      trial_expires_at: trialExpires,
      subscription_expires_at: trialExpires,
      reseller_id,
      registration_source: "self_register",
      verified_contact: email,
      onboarding_completed: false,
      admin_portal_locked: false,
      dos_portal_locked: false,
      fee_per_learner_per_term: 50,
    };

    let schoolId = selected_existing_id || null;
    if (schoolId) {
      const { error } = await admin.from("schools").update(schoolPayload).eq("id", schoolId);
      if (error) return json(400, { error: error.message });
    } else {
      const { data: created, error } = await admin.from("schools").insert(schoolPayload).select("id, name, code").single();
      if (error) return json(400, { error: error.message });
      schoolId = created.id;
    }

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: admin_first_name,
        last_name: admin_last_name,
        role: "school_admin",
        school_id: schoolId,
        phone,
      },
    });
    if (createError) {
      if (!selected_existing_id && schoolId) await admin.from("schools").delete().eq("id", schoolId);
      return json(400, { error: createError.message });
    }

    const userId = newUser.user?.id;
    if (userId) {
      await admin.from("profiles").upsert({
        id: userId,
        email,
        first_name: admin_first_name,
        last_name: admin_last_name,
        role: "school_admin",
        school_id: schoolId,
        phone,
      }, { onConflict: "id" });
      await admin.from("schools").update({ owner_id: userId }).eq("id", schoolId);
    }

    if (reseller_id) {
      try {
        const { data: r } = await admin.from("resellers").select("total_schools").eq("id", reseller_id).maybeSingle();
        if (r && typeof r.total_schools === "number") {
          await admin.from("resellers").update({ total_schools: (r.total_schools || 0) + 1 }).eq("id", reseller_id);
        }
      } catch (_) {}
    }

    otpStore.delete(contactKey(email, phone));

    return json(200, {
      success: true,
      school: { id: schoolId, name: school_name, code, county, sub_county, school_level, reseller_id },
      admin: { id: userId, email, role: "school_admin" },
      message: "School registered successfully. School admin can log in now.",
      next_steps: [
        "Log in at /auth/login with the admin email and password",
        "Add teachers and assign learning areas",
        "Add learners / classes",
        "Complete school branding and timetable setup",
      ],
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Internal server error" });
  }
});
