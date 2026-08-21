import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_ROLES = ["school_admin", "super_admin", "master_super_admin", "reseller_super_admin"];
const GLOBAL_ROLES = ["super_admin", "master_super_admin", "reseller_super_admin"];

type Contact = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
};

type ParentAccount = {
  id: string;
  created: boolean;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || "Parent", last_name: parts.slice(1).join(" ") || "" };
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => normalizeEmail(user.email) === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function resolveParentAccount(
  adminClient: ReturnType<typeof createClient>,
  contact: Contact,
  schoolId: string,
): Promise<ParentAccount | null> {
  const email = normalizeEmail(contact.email);
  if (!email) return null;
  if (!validEmail(email)) throw new Error(`Invalid parent email: ${email}`);

  const name = clean(contact.name) || "Parent";
  const phone = clean(contact.phone) || null;
  const names = splitName(name);

  const { data: existingProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, school_id")
    .eq("email", email)
    .maybeSingle();
  if (profileError) throw profileError;

  let userId = existingProfile?.id || null;
  let created = false;
  if (existingProfile && existingProfile.role !== "parent") {
    throw new Error(`The email ${email} is already used by a ${existingProfile.role} account.`);
  }
  if (existingProfile?.school_id && existingProfile.school_id !== schoolId && !GLOBAL_ROLES.includes(existingProfile.role)) {
    throw new Error(`The parent email ${email} belongs to another school.`);
  }

  if (!userId) {
    const existingAuthUser = await findAuthUserByEmail(adminClient, email);
    userId = existingAuthUser?.id || null;
  }

  if (!userId) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: "Parent@2025",
      email_confirm: true,
      user_metadata: {
        first_name: names.first_name,
        last_name: names.last_name,
        role: "parent",
        school_id: schoolId,
        phone,
      },
    });
    if (error) throw error;
    userId = data.user?.id || null;
    created = true;
  }

  if (!userId) throw new Error(`Could not resolve the parent account for ${email}`);

  const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
    id: userId,
    email,
    role: "parent",
    first_name: names.first_name,
    last_name: names.last_name,
    school_id: schoolId,
    phone,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (profileUpsertError) throw profileUpsertError;

  return { id: userId, created };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json(500, { error: "Server authentication is not configured" });

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json(401, { error: "Invalid token" });
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (!callerProfile || !ADMIN_ROLES.includes(callerProfile.role)) return json(403, { error: "Only an authorized administrator can synchronize parent accounts" });

    const body = await req.json() as {
      student_id?: string;
      primary?: Contact;
      secondary?: Contact;
    };
    if (!body.student_id) return json(400, { error: "student_id is required" });

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, school_id")
      .eq("id", body.student_id)
      .maybeSingle();
    if (studentError || !student) return json(404, { error: "Learner record not found" });
    if (!GLOBAL_ROLES.includes(callerProfile.role) && callerProfile.school_id !== student.school_id) {
      return json(403, { error: "You can only manage learners from your own school" });
    }

    const primary = body.primary || {};
    const secondary = body.secondary || {};
    const primaryAccount = await resolveParentAccount(adminClient, primary, student.school_id);
    const secondaryAccount = await resolveParentAccount(adminClient, secondary, student.school_id);
    const parentIds = [primaryAccount?.id, secondaryAccount?.id].filter((id): id is string => Boolean(id));
    const uniqueParentIds = [...new Set(parentIds)];

    const { error: clearLinksError } = await adminClient
      .from("parent_student_links")
      .delete()
      .eq("student_id", student.id);
    if (clearLinksError) throw clearLinksError;

    if (uniqueParentIds.length > 0) {
      const linkRows = uniqueParentIds.map((parentId) => ({
        parent_id: parentId,
        student_id: student.id,
        relationship: parentId === primaryAccount?.id ? "primary" : "secondary",
        is_primary: parentId === primaryAccount?.id,
      }));
      const { error: linkError } = await adminClient
        .from("parent_student_links")
        .upsert(linkRows, { onConflict: "parent_id,student_id" });
      if (linkError) throw linkError;
    }

    const { error: studentUpdateError } = await adminClient.from("students").update({
      parent_id: primaryAccount?.id || null,
      parent_name: clean(primary.name) || null,
      parent_phone: clean(primary.phone) || null,
      parent_email: normalizeEmail(primary.email) || null,
      parent2_name: clean(secondary.name) || null,
      parent2_phone: clean(secondary.phone) || null,
      parent2_email: normalizeEmail(secondary.email) || null,
      updated_at: new Date().toISOString(),
    }).eq("id", student.id).eq("school_id", student.school_id);
    if (studentUpdateError) throw studentUpdateError;

    return json(200, {
      success: true,
      primary_parent_id: primaryAccount?.id || null,
      secondary_parent_id: secondaryAccount?.id || null,
      created_parent_accounts: Number(Boolean(primaryAccount?.created)) + Number(Boolean(secondaryAccount?.created)),
      linked_parent_accounts: uniqueParentIds.length,
    });
  } catch (error) {
    console.error("sync-parent-account error", error);
    return json(500, { error: error instanceof Error ? error.message : "Internal server error" });
  }
});
