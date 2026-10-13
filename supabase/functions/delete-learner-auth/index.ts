import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ADMIN_ROLES = ["school_admin", "super_admin", "master_super_admin"];
const GLOBAL_ROLES = ["super_admin", "master_super_admin"];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingUser(error: { message?: string; status?: number } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 404 || message.includes("not found") || message.includes("user does not exist");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json(401, { error: "Missing authorization header" });

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !publishableKey) return json(500, { error: "Server authentication is not configured" });

    const callerClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(url, serviceKey, {
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
      return json(403, { error: "Only an authorized administrator can remove learner accounts" });
    }

    const body = await req.json() as { target_user_id?: string; school_id?: string };
    const targetUserId = String(body.target_user_id || "");
    const requestedSchoolId = String(body.school_id || "");
    if (!targetUserId || !requestedSchoolId) return json(400, { error: "target_user_id and school_id are required" });
    if (targetUserId === callerData.user.id) return json(400, { error: "You cannot delete your own active account" });

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("id, role, school_id")
      .eq("id", targetUserId)
      .maybeSingle();
    if (targetProfileError) return json(500, { error: "Could not validate the learner Auth account" });
    if (!targetProfile) {
      const { error: lookupError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (isMissingUser(lookupError)) return json(200, { success: true, deleted_auth_account: true });
      if (lookupError) return json(500, { error: "Could not verify the pending Auth cleanup" });
      return json(403, { error: "The Auth account has no verified learner profile" });
    }
    if (targetProfile.role !== "student" || targetProfile.school_id !== requestedSchoolId) {
      return json(403, { error: "The target is not a learner account in the requested school" });
    }
    if (!GLOBAL_ROLES.includes(callerProfile.role) && callerProfile.school_id !== requestedSchoolId) {
      return json(403, { error: "You can only remove learner accounts from your own school" });
    }

    const { data: remainingLearner, error: learnerCheckError } = await adminClient
      .from("students")
      .select("id")
      .eq("profile_id", targetUserId)
      .maybeSingle();
    if (learnerCheckError) return json(500, { error: "Could not verify learner database cleanup before Auth deletion" });
    if (remainingLearner) return json(409, { error: "The learner record still exists; Auth deletion was not attempted" });

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteError && !isMissingUser(deleteError)) {
      console.error("[delete-learner-auth] Auth Admin deletion failed after database cleanup", {
        targetUserId,
        schoolId: requestedSchoolId,
        message: deleteError.message,
      });
      return json(500, { error: "Learner data was deleted, but the linked Auth account could not be removed. Retry Auth cleanup or contact an administrator." });
    }
    return json(200, { success: true, deleted_auth_account: true });
  } catch (error) {
    console.error("delete-learner-auth error", error);
    return json(500, { error: "Internal server error while removing the learner Auth account" });
  }
});
