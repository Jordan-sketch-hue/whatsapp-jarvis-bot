import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CallLog {
  call_sid: string;
  to_number: string;
  lead_name?: string;
  lead_business?: string;
  duration_seconds?: number;
  outcome: "answered" | "voicemail" | "no_answer" | "error";
  transcript?: string;
  booked_followup: boolean;
  created_at?: string;
}

export async function logCall(data: CallLog) {
  const { error } = await supabase.from("sales_calls").insert(data);
  if (error) console.error("[DB] logCall error:", error.message);
}

export async function updateCall(
  callSid: string,
  updates: Partial<CallLog>
) {
  const { error } = await supabase
    .from("sales_calls")
    .update(updates)
    .eq("call_sid", callSid);
  if (error) console.error("[DB] updateCall error:", error.message);
}
