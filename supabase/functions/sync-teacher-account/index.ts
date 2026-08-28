import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_ROLES = ["school_admin", "super_admin", "master_super_admin", "reseller_super_admin"];
const GLOBAL_ROLES = ["super_admin", "master_super_admin", "reseller_super_admin"];
const DEFAULT_TEACHER_PASSWORD = "Teacher@2025";

type Json = Record<string, unknown>;

function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readErrorMessage(error: unknown) {
  return String((error as { message?: string } | null)?.message || "").toLowerCase();
}

function isMissingAuthUser(error: unknown) {
  const message = readErrorMessage(error);
  const status = (error as { status?: number } | null)?.status;
  return status === 404 || message.includes("not found") || message.includes("does not exist");
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
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(500, { error: "Server authentication is not configured" });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json(401, { error: "Invalid token" });

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (callerProfileError || !callerProfile || !ADMIN_ROLES.includes(callerProfile.role)) {
      return json(403, { error: "Only an authorized school administrator can manage teacher accounts" });
    }

    const body = await req.json() as {
      teacher_id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string | null;
      gender?: string | null;
      qualification?: string | null;
      specialization?: string | null;
      tsc_number?: string | null;
    };
    const teacherId = String(body.teacher_id || "").trim();
    const email = normalizeEmail(body.email);
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    if (!teacherId || !email || !firstName || !lastName) {
      return json(400, { error: "teacher_id, first_name, last_name, and email are required" });
    }

    const { data: teacher, error: teacherError } = await adminClient
      .from("teachers")
      .select("id, profile_id, school_id, email, first_name, last_name, phone, gender, qualification, specialization, tsc_number, teacher_number, employee_number, is_active")
      .eq("id", teacherId)
      .maybeSingle();
    if (teacherError || !teacher) return json(404, { error: "Teacher record not found" });

    if (!teacher.school_id) return json(400, { error: "The teacher is not associated with a school" });
    if (!GLOBAL_ROLES.includes(callerProfile.role) && callerProfile.school_id !== teacher.school_id) {
      return json(403, { error: "You can only manage teachers from your own school" });
    }

    const { data: duplicateTeacher } = await adminClient
      .from("teachers")
      .select("id")
      .eq("school_id", teacher.school_id)
      .neq("id", teacher.id)
      .ilike("email", email)
      .maybeSingle();
    if (duplicateTeacher) return json(409, { error: "Another teacher in this school already uses that email" });

    const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) return json(500, { error: "Could not check existing Auth accounts" });

    const existingByEmail = usersPage.users.find((candidate) =>
      normalizeEmail(candidate.email) === email && candidate.id !== teacher.profile_id
    );
    if (existingByEmail) return json(409, { error: "That email is already used by another Auth account" });

    let authUserId = teacher.profile_id as string | null;
    let createdAuthAccount = false;
    let existingAuthUser: { user: { id: string; email?: string | null } | null } | null = null;
    if (authUserId) {
      const result = await adminClient.auth.admin.getUserById(authUserId);
      if (!result.error && result.data.user) existingAuthUser = { user: result.data.user };
      else if (!isMissingAuthUser(result.error)) return json(500, { error: "Could not read the teacher Auth account" });
    }

    if (!existingAuthUser?.user) {
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: DEFAULT_TEACHER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          role: "teacher",
          school_id: teacher.school_id,
          teacher_id: teacher.id,
          teacher_number: teacher.teacher_number,
          employee_number: teacher.employee_number,
        },
      });
      if (createError || !created.user) return json(400, { error: createError?.message || "Teacher Auth account could not be created" });
      authUserId = created.user.id;
      createdAuthAccount = true;
    } else {
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(existingAuthUser.user.id, {
        email,
        email_confirm: true,
        user_metadata: {
          ...(existingAuthUser.user.user_metadata || {}),
          first_name: firstName,
          last_name: lastName,
          role: "teacher",
          school_id: teacher.school_id,
          teacher_id: teacher.id,
          teacher_number: teacher.teacher_number,
          employee_number: teacher.employee_number,
        },
      });
      if (updateAuthError) return json(400, { error: updateAuthError.message });
      authUserId = existingAuthUser.user.id;
    }

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: authUserId,
      school_id: teacher.school_id,
      role: "teacher",
      first_name: firstName,
      last_name: lastName,
      email,
      phone: body.phone?.trim() || null,
      is_active: teacher.is_active !== false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (profileError) return json(500, { error: `Teacher profile could not be synchronized: ${profileError.message}` });

    const { error: updatedTeacherError } = await adminClient.from("teachers").update({
      first_name: firstName,
      last_name: lastName,
      email,
      phone: body.phone?.trim() || null,
      gender: body.gender || null,
      qualification: body.qualification?.trim() || null,
      specialization: body.specialization?.trim() || null,
      tsc_number: body.tsc_number?.trim() || null,
      profile_id: authUserId,
      updated_at: new Date().toISOString(),
    }).eq("id", teacher.id).eq("school_id", teacher.school_id);
    if (updatedTeacherError) return json(500, { error: `Teacher record could not be synchronized: ${updatedTeacherError.message}` });

    if (teacher.profile_id && teacher.profile_id !== authUserId) {
      await adminClient.from("profiles").delete().eq("id", teacher.profile_id).eq("school_id", teacher.school_id);
    }

    return json(200, {
      success: true,
      teacher_id: teacher.id,
      auth_user_id: authUserId,
      created_auth_account: createdAuthAccount,
      email,
      message: createdAuthAccount
        ? "Teacher record synchronized and a new Auth account was created with the default teacher password."
        : "Teacher record and Auth account synchronized successfully.",
    });
  } catch (error) {
    console.error("sync-teacher-account error", error);
    return json(500, { error: "Internal server error" });
  }
});
