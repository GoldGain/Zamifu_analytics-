// ─── SMS API Integration ─────────────────────────────────────────────────────
// Supports Olympus SMS (default, no config needed) and Africa's Talking (per-school)

const OLYMPUS_API_URL = 'https://sms.ots.co.ke/api/v3/sms/send';
const OLYMPUS_API_TOKEN = '3682|HN95vYSLpT8BcOjhWYj7gBVOXTSp1B3UsZFbtByfbfef70cf';
const OLYMPUS_SENDER_ID = 'PROCALL';

interface SMSPayload {
  recipient: string;
  sender_id: string;
  type: 'plain';
  message: string;
}

interface SMSResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface SMSConfig {
  provider: 'olympus' | 'africastalking';
  apiKey?: string;
  username?: string;
  senderId?: string;
}

function normalizePhone(phone: string): string {
  let normalizedPhone = phone.trim().replace(/\s/g, '');
  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = '254' + normalizedPhone.slice(1);
  }
  if (normalizedPhone.startsWith('+')) {
    normalizedPhone = normalizedPhone.slice(1);
  }
  return normalizedPhone;
}

function cleanMessage(message: string): string {
  return message.replace(/[^\w\s.,;:!?@#$%&*()\-+=/[\]{}|<>~^`\n]/g, '');
}

/**
 * Send SMS via Olympus API (default, no config needed)
 */
async function sendViaOlympus(phone: string, message: string): Promise<SMSResponse> {
  const payload: SMSPayload = {
    recipient: normalizePhone(phone),
    sender_id: OLYMPUS_SENDER_ID,
    type: 'plain',
    message: cleanMessage(message),
  };

  const response = await fetch(OLYMPUS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OLYMPUS_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (response.ok) {
    return { success: true, message: 'SMS sent successfully', data };
  } else {
    return { success: false, error: data.message || `HTTP ${response.status}` };
  }
}

/**
 * Send SMS via Africa's Talking API (requires API key and username)
 */
async function sendViaAfricasTalking(
  phone: string,
  message: string,
  apiKey: string,
  username: string,
  senderId: string
): Promise<SMSResponse> {
  const url = 'https://api.africastalking.com/version1/messaging';
  const formData = new URLSearchParams({
    username,
    to: `+${normalizePhone(phone)}`,
    message: cleanMessage(message),
    from: senderId || '',
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': apiKey,
      },
      body: formData.toString(),
    });

    const data = await response.json();
    const recipient = data?.SMSMessageData?.Recipients?.[0];

    if (recipient?.status === 'Success' || recipient?.statusCode === 101) {
      return { success: true, message: 'SMS sent successfully', data };
    } else {
      return { success: false, error: recipient?.status || 'SMS send failed', data };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Send a single SMS using the configured provider
 * @param phone - Phone number (any format, will be normalized)
 * @param message - Message text
 * @param config - SMS provider config (defaults to Olympus)
 */
export async function sendSMS(
  phone: string,
  message: string,
  config?: SMSConfig
): Promise<SMSResponse> {
  try {
    if (!phone || phone.trim().length < 10) {
      return { success: false, error: 'Invalid phone number' };
    }

    // Default to Olympus if no config provided
    if (!config || config.provider === 'olympus') {
      return await sendViaOlympus(phone, message);
    }

    // Africa's Talking requires API key and username
    if (config.provider === 'africastalking') {
      if (!config.apiKey || !config.username) {
        // Fall back to Olympus if AT is not configured
        console.warn('Africa\'s Talking not fully configured, falling back to Olympus');
        return await sendViaOlympus(phone, message);
      }
      return await sendViaAfricasTalking(phone, message, config.apiKey, config.username, config.senderId || 'ZAMIFU');
    }

    return await sendViaOlympus(phone, message);
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Send SMS with school-specific config
 * Fetches settings from school_settings table and sends using configured provider
 */
export async function sendSMSWithSchoolConfig(
  phone: string,
  message: string,
  schoolId: string
): Promise<SMSResponse> {
  try {
    const { supabaseUntyped } = await import('@/lib/supabase/client');

    const { data: settings } = await supabaseUntyped
      .from('school_settings')
      .select('sms_provider, sms_api_key, sms_username, sms_sender_id')
      .eq('school_id', schoolId)
      .maybeSingle();

    const config: SMSConfig = {
      provider: (settings?.sms_provider as 'olympus' | 'africastalking') || 'olympus',
      apiKey: settings?.sms_api_key || undefined,
      username: settings?.sms_username || undefined,
      senderId: settings?.sms_sender_id || 'ZAMIFU',
    };

    const result = await sendSMS(phone, message, config);

    // Log the SMS
    try {
      await supabaseUntyped.from('sms_logs').insert({
        school_id: schoolId,
        recipient_phone: normalizePhone(phone),
        message: cleanMessage(message),
        status: result.success ? 'sent' : 'failed',
        error_message: result.error || null,
        sent_at: new Date().toISOString(),
      }).catch(() => {}); // Non-blocking
    } catch {}

    return result;
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Send bulk SMS to multiple recipients
 * @param recipients - Array of phone numbers
 * @param message - Message text
 * @param config - SMS provider config
 */
export async function sendBulkSMS(
  recipients: string[],
  message: string,
  config?: SMSConfig
): Promise<SMSResponse> {
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return { success: false, error: 'No recipients provided' };
  }
  if (!message || message.trim().length === 0) {
    return { success: false, error: 'Message is empty' };
  }

  const results: any[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const phone of recipients) {
    if (!phone || typeof phone !== 'string' || phone.trim().length < 10) {
      failCount++;
      results.push({ phone: phone || 'invalid', success: false, error: 'Invalid phone number' });
      continue;
    }
    const result = await sendSMS(phone, message, config);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    results.push({ phone, ...result });
  }

  return {
    success: failCount === 0,
    message: `Sent: ${successCount}, Failed: ${failCount}`,
    data: results,
  };
}

// ─── Welcome SMS Messages ────────────────────────────────────────────────────

export function generateWelcomeSMS(
  firstName: string,
  role: string,
  email: string,
  password: string,
  schoolName?: string
): string {
  const schoolLine = schoolName ? ` at ${schoolName}` : '';
  return `Welcome to Zamifu Analytics${schoolLine}!\n\nHello ${firstName}, your ${role} account has been created.\n\nLogin: ${email}\nPassword: ${password}\nPortal: https://zamifu.company\n\nPlease change your password after first login.`;
}

export function generateResultsSMS(
  parentName: string,
  studentName: string,
  termName: string,
  average: string,
  position?: string
): string {
  const posLine = position ? `\nPosition: ${position}` : '';
  return `Zamifu Analytics: Results Notification\n\nDear ${parentName},\n${studentName}'s ${termName} results are now available.\nAverage: ${average}%${posLine}\n\nLogin to view full report: https://zamifu.company`;
}

export function generateAnnouncementSMS(
  schoolName: string,
  message: string
): string {
  return `Zamifu Analytics: ${schoolName}\n\n${message}`;
}

export function generatePasswordResetSMS(otp: string): string {
  return `Zamifu Analytics: Password Reset\n\nYour OTP code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore.`;
}

// ─── SMS Templates ───────────────────────────────────────────────────────────

export const SMS_TEMPLATES = {
  welcomeSchoolAdmin: (firstName: string, email: string, password?: string, schoolName?: string) =>
    generateWelcomeSMS(firstName, 'School Admin', email, password || 'SchoolAdmin@2025', schoolName),

  welcomeTeacher: (firstName: string, email: string, password?: string, schoolName?: string) =>
    generateWelcomeSMS(firstName, 'Teacher', email, password || 'Teacher@2025', schoolName),

  welcomeParent: (firstName: string, email: string, password?: string, schoolName?: string) =>
    generateWelcomeSMS(firstName, 'Parent', email, password || 'Parent@2025', schoolName),

  welcomeStudent: (firstName: string, email: string, admissionNumber: string, schoolName?: string) =>
    generateWelcomeSMS(firstName, 'Student', email, `${admissionNumber}@2025`, schoolName),

  passwordResetOTP: (otp: string) =>
    generatePasswordResetSMS(otp),

  passwordResetSuccess: () =>
    'Zamifu Analytics: Your password has been reset successfully. If you did not make this change, contact support.',

  resultsToParent: (studentName: string, className: string, subjects: Array<{ name: string; marks: number; grade: string }>, totalPoints: number, totalPossible: number, rank: number, totalStudents: number, comment: string) => {
    const subjectLines = subjects.slice(0, 5).map(s => `${s.name}: ${s.marks}% - ${s.grade}`).join('\n');
    return `Zamifu Analytics\n\nResults for ${studentName} - ${className}\n\nLearning Areas:\n${subjectLines}\n\nSummary:\nTotal Points: ${totalPoints}/${totalPossible}\nClass Rank: ${rank}/${totalStudents}\n\nView Full Results:\nhttps://zamifu.company`;
  },

  announcement: (schoolName: string, message: string) =>
    generateAnnouncementSMS(schoolName, message),

  customMessage: (message: string) =>
    `Zamifu Analytics\n\n${message}`,
};

/**
 * Get default password for a role
 */
export function getDefaultPassword(role: string, admissionNumber?: string): string {
  switch (role) {
    case 'school_admin': return 'SchoolAdmin@2025';
    case 'teacher': return 'Teacher@2025';
    case 'student': return admissionNumber ? `${admissionNumber}@2025` : 'Student@2025';
    case 'parent': return 'Parent@2025';
    case 'reseller': return '123456789';
    default: return 'Default@2025';
  }
}

/**
 * Request a password reset OTP via SMS
 */
export async function requestPasswordResetOTP(phone: string): Promise<{ success: boolean; message: string }> {
  const { supabase } = await import('@/lib/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action: 'request', phone }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to send OTP');
  return result;
}

/**
 * Verify the OTP for password reset
 */
export async function verifyPasswordResetOTP(
  phone: string,
  otp: string
): Promise<{ success: boolean; user_id: string; message: string }> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: 'verify', phone, otp }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'OTP verification failed');
  return result;
}

/**
 * Reset password after OTP verification
 */
export async function resetPasswordWithOTP(
  phone: string,
  otp: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: 'reset', phone, otp, new_password: newPassword }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Password reset failed');
  return result;
}
