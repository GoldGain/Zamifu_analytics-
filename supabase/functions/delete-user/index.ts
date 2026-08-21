import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_ROLES = ["school_admin", "super_admin", "master_super_admin", "reseller_super_admin"];
const GLOBAL_ROLES = ["super_admin", "master_super_admin", "reseller_super_admin"];
const MANAGED_RECORD_TYPES = ["student", "learner", "teacher", "parent", "school_admin"];

type Json = Record<string, unknown>;

type CallerProfile = {
  role: string;
  school_id: string | null;
};

function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isMissingUserError(error: { message?: string; status?: number } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 404 || message.includes("not found") || message.includes("user does not exist");
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

    const { data: callerProfile, error: callerProfileError } = await callerClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (callerProfileError || !callerProfile || !ADMIN_ROLES.includes(callerProfile.role)) {
      return json(403, { error: "Only an authorized school administrator can delete user accounts" });
    }

    const body = await req.json() as {
      record_id?: string;
      target_user_id?: string;
      target_type?: string;
      school_id?: string;
    };
    const targetType = String(body.target_type || "").toLowerCase();
    if (!MANAGED_RECORD_TYPES.includes(targetType)) return json(400, { error: "A valid target_type is required" });
    if (!body.record_id && !body.target_user_id) return json(400, { error: "record_id or target_user_id is required" });
    if (body.target_user_id === callerData.user.id) return json(400, { error: "You cannot delete your own active account" });

    let targetUserId = body.target_user_id || null;
    let recordId = body.record_id || null;
    let targetSchoolId = body.school_id || null;
    let resolvedRole = targetType === "learner" ? "student" : targetType;

    if (recordId && ["student", "learner"].includes(targetType)) {
      const { data: student, error } = await adminClient
        .from("students")
        .select("id, profile_id, school_id")
        .eq("id", recordId)
        .maybeSingle();
      if (error || !student) return json(404, { error: "Learner record not found" });
      targetUserId = student.profile_id || targetUserId;
      targetSchoolId = student.school_id;
      recordId = student.id;
      resolvedRole = "student";
    } else if (recordId && targetType === "teacher") {
      const { data: teacher, error } = await adminClient
        .from("teachers")
        .select("id, profile_id, school_id")
        .eq("id", recordId)
        .maybeSingle();
      if (error || !teacher) return json(404, { error: "Teacher record not found" });
      targetUserId = teacher.profile_id || targetUserId;
      targetSchoolId = teacher.school_id;
      recordId = teacher.id;
      resolvedRole = "teacher";
    } else if (recordId && targetType === "school_admin") {
      const { data: schoolAdmin, error } = await adminClient
        .from("school_admins")
        .select("id, user_id, school_id")
        .eq("id", recordId)
        .maybeSingle();
      if (error || !schoolAdmin) return json(404, { error: "School-admin record not found" });
      targetUserId = schoolAdmin.user_id || targetUserId;
      targetSchoolId = schoolAdmin.school_id;
      recordId = schoolAdmin.id;
      resolvedRole = "school_admin";
    }

    if (targetUserId) {
      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from("profiles")
        .select("id, role, school_id")
        .eq("id", targetUserId)
        .maybeSingle();
      if (targetProfileError) return json(500, { error: "Could not validate the target account" });
      if (targetProfile) {
        resolvedRole = targetProfile.role;
        targetSchoolId = targetProfile.school_id || targetSchoolId;
      }
    }

    if (!targetSchoolId) return json(400, { error: "The target account is not associated with a school" });
    if (!GLOBAL_ROLES.includes(callerProfile.role) && callerProfile.school_id !== targetSchoolId) {
      return json(403, { error: "You can only delete users from your own school" });
    }
    if (resolvedRole === "school_admin" && !GLOBAL_ROLES.includes(callerProfile.role)) {
      return json(403, { error: "Only a higher-level administrator can delete a school-admin account" });
    }
    if (["super_admin", "master_super_admin", "reseller_super_admin"].includes(resolvedRole)) {
      return json(403, { error: "Protected administrator accounts cannot be deleted from this workflow" });
    }

    // Detach references that do not cascade from auth.users before deleting the Auth account.
    if (targetUserId) {
      const { error: learnerParentError } = await adminClient
        .from("students")
        .update({ parent_id: null })
        .eq("parent_id", targetUserId);
      if (learnerParentError) return json(500, { error: "Could not detach parent-child links" });

      const { error: linkError } = await adminClient
        .from("parent_student_links")
        .delete()
        .or(`parent_id.eq.${targetUserId},student_id.eq.${recordId || "00000000-0000-0000-0000-000000000000"}`);
      if (linkError) return json(500, { error: "Could not clean dependent parent links" });

      const { error: paymentError } = await adminClient
        .from("parent_payments")
        .update({ parent_id: null })
        .eq("parent_id", targetUserId);
      if (paymentError) return json(500, { error: "Could not preserve parent payment history while detaching the account" });

      const { error: schoolAdminReferenceError } = await adminClient
        .from("school_admins")
        .update({ user_id: null })
        .eq("user_id", targetUserId);
      if (schoolAdminReferenceError) return json(500, { error: "Could not detach the school-admin record" });

      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (authDeleteError && !isMissingUserError(authDeleteError)) {
        return json(500, { error: "The Auth account could not be deleted. The school record was left intact." });
      }
    }

    let recordDeleted = false;
    if (["student", "learner"].includes(targetType)) {
      const deleteQuery = adminClient.from("students").delete().eq("school_id", targetSchoolId);
      const { error } = recordId
        ? await deleteQuery.eq("id", recordId)
        : await deleteQuery.eq("profile_id", targetUserId);
      if (error) return json(500, { error: `Auth was deleted but the learner record could not be removed: ${error.message}` });
      recordDeleted = true;
    } else if (targetType === "teacher") {
      const deleteQuery = adminClient.from("teachers").delete().eq("school_id", targetSchoolId);
      const { error } = recordId
        ? await deleteQuery.eq("id", recordId)
        : await deleteQuery.eq("profile_id", targetUserId);
      if (error) return json(500, { error: `Auth was deleted but the teacher record could not be removed: ${error.message}` });
      recordDeleted = true;
    } else if (targetType === "school_admin") {
      const deleteQuery = adminClient.from("school_admins").delete().eq("school_id", targetSchoolId);
      const { error } = recordId
        ? await deleteQuery.eq("id", recordId)
        : await deleteQuery.eq("user_id", targetUserId);
      if (error) return json(500, { error: `Auth was deleted but the school-admin record could not be removed: ${error.message}` });
      recordDeleted = true;
    }

    return json(200, {
      success: true,
      target_type: targetType,
      target_role: resolvedRole,
      deleted_auth_account: Boolean(targetUserId),
      deleted_record: recordDeleted,
    });
  } catch (error) {
    console.error("delete-user error", error);
    return json(500, { error: "Internal server error" });
  }
});
