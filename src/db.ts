import { Pool } from "pg";
import type { CallScores } from "./conversation";

if (!process.env.DATABASE_URL) {
  console.warn("[DB] DATABASE_URL not set — call logging will fail. Set it in Railway env vars.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

export interface CallLog {
  call_sid: string;
  to_number: string;
  company_name?: string;
  industry?: string;
  duration_seconds?: number;
  outcome: "answered" | "no_answer" | "busy" | "failed" | "error";
  transcript?: string;
  booked_followup: boolean;
  stage_reached?: string;
  scores?: CallScores;
  mockup_requested?: boolean;
  mockup_wa_number?: string;
  mockup_colors?: string;
  mockup_style?: string;
  next_action?: string;
}

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id SERIAL PRIMARY KEY,
      call_sid TEXT UNIQUE NOT NULL,
      to_number TEXT,
      company_name TEXT,
      industry TEXT,
      duration_seconds INTEGER DEFAULT 0,
      outcome TEXT,
      transcript TEXT,
      booked_followup BOOLEAN DEFAULT FALSE,
      stage_reached TEXT,
      scores JSONB,
      mockup_requested BOOLEAN DEFAULT FALSE,
      mockup_wa_number TEXT,
      mockup_colors TEXT,
      mockup_style TEXT,
      next_action TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS prospects (
      id SERIAL PRIMARY KEY,
      company_name TEXT,
      phone TEXT UNIQUE NOT NULL,
      industry TEXT,
      has_website BOOLEAN DEFAULT FALSE,
      has_social BOOLEAN DEFAULT FALSE,
      gap_analysis TEXT,
      recommended_service TEXT,
      notes TEXT,
      dnc BOOLEAN DEFAULT FALSE,
      attempt_count INTEGER DEFAULT 0,
      last_called_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;
    CREATE TABLE IF NOT EXISTS sales_leads (
      id SERIAL PRIMARY KEY,
      place_id TEXT UNIQUE NOT NULL,
      business_name TEXT,
      phone TEXT,
      address TEXT,
      category TEXT,
      recommended_product TEXT,
      has_website BOOLEAN DEFAULT FALSE,
      google_rating NUMERIC,
      status TEXT DEFAULT 'new',
      called_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function logCall(data: CallLog) {
  try {
    await pool.query(
      `INSERT INTO call_logs
        (call_sid, to_number, company_name, industry, duration_seconds, outcome,
         transcript, booked_followup, stage_reached, scores,
         mockup_requested, mockup_wa_number, mockup_colors, mockup_style, next_action)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (call_sid) DO UPDATE SET
         duration_seconds = EXCLUDED.duration_seconds,
         outcome = EXCLUDED.outcome,
         transcript = EXCLUDED.transcript,
         booked_followup = EXCLUDED.booked_followup,
         stage_reached = EXCLUDED.stage_reached,
         scores = EXCLUDED.scores,
         mockup_requested = EXCLUDED.mockup_requested,
         mockup_wa_number = EXCLUDED.mockup_wa_number,
         mockup_colors = EXCLUDED.mockup_colors,
         mockup_style = EXCLUDED.mockup_style,
         next_action = EXCLUDED.next_action`,
      [
        data.call_sid, data.to_number, data.company_name, data.industry,
        data.duration_seconds ?? 0, data.outcome,
        data.transcript, data.booked_followup, data.stage_reached,
        data.scores ? JSON.stringify(data.scores) : null,
        data.mockup_requested ?? false, data.mockup_wa_number,
        data.mockup_colors, data.mockup_style, data.next_action,
      ]
    );
  } catch (e: any) {
    console.error("[DB] logCall error:", e.message);
  }
}

export async function isDNC(phone: string): Promise<boolean> {
  try {
    const res = await pool.query("SELECT dnc FROM prospects WHERE phone = $1", [phone]);
    return res.rows[0]?.dnc === true;
  } catch {
    return false;
  }
}

export async function markDNC(phone: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO prospects (phone, dnc) VALUES ($1, TRUE)
       ON CONFLICT (phone) DO UPDATE SET dnc = TRUE`,
      [phone]
    );
    console.log("[DB] Marked DNC:", phone);
  } catch (e: any) {
    console.error("[DB] markDNC error:", e.message);
  }
}

export async function getProspect(phone: string) {
  try {
    const res = await pool.query("SELECT * FROM prospects WHERE phone = $1 AND dnc = FALSE LIMIT 1", [phone]);
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function markCalled(phone: string) {
  try {
    await pool.query(
      `INSERT INTO prospects (phone, last_called_at, attempt_count) VALUES ($1, NOW(), 1)
       ON CONFLICT (phone) DO UPDATE SET last_called_at = NOW(), attempt_count = prospects.attempt_count + 1`,
      [phone]
    );
  } catch { /* non-fatal */ }
}

export async function getAttemptCount(phone: string): Promise<number> {
  try {
    const res = await pool.query("SELECT attempt_count FROM prospects WHERE phone = $1", [phone]);
    return res.rows[0]?.attempt_count ?? 0;
  } catch {
    return 0;
  }
}

export interface SalesLead {
  id: number;
  phone: string;
  business_name: string;
  category: string;
  recommended_product: string;
}

export async function getNewLeads(limit = 20): Promise<SalesLead[]> {
  try {
    const res = await pool.query(
      `SELECT sl.id, sl.phone, sl.business_name, sl.category, sl.recommended_product
       FROM sales_leads sl
       LEFT JOIN prospects p ON p.phone = sl.phone
       WHERE sl.status = 'new'
         AND sl.phone IS NOT NULL
         AND sl.phone <> ''
         AND (p.phone IS NULL OR (p.dnc = FALSE AND COALESCE(p.attempt_count, 0) < 3))
       ORDER BY sl.created_at ASC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (e: any) {
    console.error("[DB] getNewLeads error:", e.message);
    return [];
  }
}

export async function markLeadCalled(id: number) {
  try {
    await pool.query("UPDATE sales_leads SET status='called', called_at=NOW() WHERE id=$1", [id]);
  } catch { /* non-fatal */ }
}

// Returns true if phone was called within the last `hours` hours
export async function hasBeenCalledRecently(phone: string, hours = 24): Promise<boolean> {
  try {
    const res = await pool.query(
      `SELECT last_called_at FROM prospects WHERE phone = $1
       AND last_called_at > NOW() - INTERVAL '${hours} hours'`,
      [phone]
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}
