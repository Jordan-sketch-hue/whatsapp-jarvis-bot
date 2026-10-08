import { Pool } from "pg";
import type { CallScores, MockupData } from "./conversation";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
      last_called_at TIMESTAMPTZ,
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
    await pool.query("UPDATE prospects SET last_called_at = NOW() WHERE phone = $1", [phone]);
  } catch { /* non-fatal */ }
}
