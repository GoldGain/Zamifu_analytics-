import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    // Verify the caller is authenticated and is a school_admin or super_admin
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

    // Verify the caller's token
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

    // Check caller role
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", callerUser.id)
      .single();

    if (!callerProfile || !["school_admin", "super_admin", "master_super_admin", "reseller_super_admin"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { email, password, first_name, last_name, role, school_id, metadata, admission_number, assessment_number, class_id } = body;

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, password, role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Learner accounts are keyed by assessment number. Admission numbers remain
    // optional display identifiers and must never become login credentials.
    const effectiveAssessmentNumber = String(assessment_number || metadata?.assessment_number || '').trim();
    console.log(`Creating user: role=${role}, email=${email}, assessment=${effectiveAssessmentNumber}`);

    if (["learner", "student"].includes(role) && !effectiveAssessmentNumber) {
      return new Response(JSON.stringify({ error: "Assessment number is required for learner accounts", code: "ASSESSMENT_NUMBER_REQUIRED" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (["learner", "student"].includes(role) && effectiveAssessmentNumber) {
      const tempAdminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Assessment numbers are unique within a school, independent of class.
      const { data: existingStudent, error: checkError } = await tempAdminClient
        .from("students")
        .select("id, assessment_number")
        .eq("assessment_number", effectiveAssessmentNumber)
        .eq("school_id", school_id || callerProfile.school_id)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Database error checking assessment number:", checkError);
        return new Response(JSON.stringify({ error: "Database error checking assessment number" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingStudent) {
        console.warn(`Duplicate assessment number found: ${effectiveAssessmentNumber}`);
        return new Response(
          JSON.stringify({ 
            error: `Assessment number ${effectiveAssessmentNumber} already exists in this school`,
            code: "DUPLICATE_ASSESSMENT_NUMBER"
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      console.log("Skipping learner assessment duplicate check for a non-learner role");
    }

    // Use service role client to create user (does NOT change current session)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: first_name || "",
        last_name: last_name || "",
        role: role,
        school_id: school_id || callerProfile.school_id,
        admission_number: admission_number || null,
        assessment_number: effectiveAssessmentNumber || null,
        class_id: class_id || null,
        ...metadata,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ 
        user: { id: newUser.user?.id, email: newUser.user?.email },
        message: "User created successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
