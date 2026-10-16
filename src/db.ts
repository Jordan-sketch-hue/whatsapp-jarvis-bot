import { Pool } from "pg";
import type { CallScores } from "./conversation";

if (!process.env.DATABASE_URL) {
  console.warn("[DB] DATABASE_URL not set â€” call logging will fail. Set it in Railway env vars.");
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
  contact_method?: string;
  contact_detail?: string;
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
      contact_method TEXT,
      contact_detail TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS contact_method TEXT;
    ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS contact_detail TEXT;
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
    CREATE TABLE IF NOT EXISTS call_sessions (
      call_sid TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
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
         mockup_requested, mockup_wa_number, mockup_colors, mockup_style, next_action,
         contact_method, contact_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
         next_action = EXCLUDED.next_action,
         contact_method = EXCLUDED.contact_method,
         contact_detail = EXCLUDED.contact_detail`,
      [
        data.call_sid, data.to_number, data.company_name, data.industry,
        data.duration_seconds ?? 0, data.outcome,
        data.transcript, data.booked_followup, data.stage_reached,
        data.scores ? JSON.stringify(data.scores) : null,
        data.mockup_requested ?? false, data.mockup_wa_number,
        data.mockup_colors, data.mockup_style, data.next_action,
        data.contact_method, data.contact_detail,
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
  has_website?: boolean;
  notes?: string;
}

export interface LeadFilters {
  market?: string | null; // null = Jamaica local (market IS NULL); string = intl market code
  category?: string;
  tier?: 1 | 2 | 3;
}

export async function getNewLeads(limit = 20, filters: LeadFilters = {}): Promise<SalesLead[]> {
  try {
    const params: any[] = [limit];
    const clauses: string[] = [
      "sl.status = 'new'",
      "sl.phone IS NOT NULL",
      "sl.phone <> ''",
      "sl.phone NOT LIKE '000-%'",
      "(p.phone IS NULL OR (p.dnc = FALSE AND COALESCE(p.attempt_count, 0) < 3))",
    ];

    if (filters.market === null) {
      clauses.push(`sl.market IS NULL`);
    } else if (filters.market) {
      params.push(filters.market);
      clauses.push(`sl.market = $${params.length}`);
    }
    if (filters.category) {
      params.push(filters.category);
      clauses.push(`sl.category = $${params.length}`);
    }
    if (filters.tier) {
      params.push(`%TIER:${filters.tier}%`);
      clauses.push(`sl.notes ILIKE $${params.length}`);
    }

    const res = await pool.query(
      `SELECT sl.id, sl.phone, sl.business_name, sl.category, sl.recommended_product, sl.has_website, sl.notes, sl.market
       FROM sales_leads sl
       LEFT JOIN prospects p ON p.phone = sl.phone
       WHERE ${clauses.join(" AND ")}
       ORDER BY
         -- Category conversion likelihood: owner-operated service businesses close fastest
         CASE sl.category
           WHEN 'barbershop'        THEN 0
           WHEN 'hair_salon'        THEN 0
           WHEN 'nail_salon'        THEN 0
           WHEN 'car_detailing'     THEN 0
           WHEN 'spa'               THEN 1
           WHEN 'restaurant'        THEN 1
           WHEN 'bakery'            THEN 1
           WHEN 'catering'          THEN 1
           WHEN 'clothing_boutique' THEN 2
           WHEN 'plumber'           THEN 2
           WHEN 'electrician'       THEN 2
           WHEN 'pharmacy'          THEN 2
           WHEN 'auto_repair'       THEN 2
           WHEN 'gym'               THEN 3
           WHEN 'dentist'           THEN 3
           WHEN 'guest_house'       THEN 3
           WHEN 'accountant'        THEN 3
           WHEN 'lawyer'            THEN 3
           WHEN 'real_estate_agent' THEN 3
           WHEN 'tour_operator'     THEN 4
           WHEN 'car_dealership'    THEN 5
           ELSE 6
         END,
         -- Within same category: no-website leads first (cleaner pitch)
         CASE WHEN sl.has_website = FALSE THEN 0 ELSE 1 END,
         sl.created_at ASC
       LIMIT $1`,
      params
    );
    return res.rows;
  } catch (e: any) {
    console.error("[DB] getNewLeads error:", e.message);
    return [];
  }
}

export interface SiblingLead {
  business_name: string;
  category: string;
  has_website: boolean;
  recommended_product: string;
}

export async function getSiblingLeads(phone: string, excludeId: number): Promise<SiblingLead[]> {
  try {
    const res = await pool.query(
      `SELECT business_name, category, has_website, recommended_product
       FROM sales_leads
       WHERE phone = $1 AND id != $2
       LIMIT 5`,
      [phone, excludeId]
    );
    return res.rows;
  } catch { return []; }
}

export async function markLeadCalled(id: number) {
  try {
    await pool.query("UPDATE sales_leads SET status='called', called_at=NOW() WHERE id=$1", [id]);
  } catch { /* non-fatal */ }
}

export async function saveCallSession(callSid: string, state: object): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO call_sessions (call_sid, state, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (call_sid) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
      [callSid, JSON.stringify(state)]
    );
  } catch (e: any) {
    console.error("[DB] saveCallSession error:", e.message);
  }
}

export async function loadCallSession(callSid: string): Promise<object | null> {
  try {
    const res = await pool.query("SELECT state FROM call_sessions WHERE call_sid = $1", [callSid]);
    return res.rows[0]?.state ?? null;
  } catch {
    return null;
  }
}

export async function deleteCallSession(callSid: string): Promise<void> {
  try {
    await pool.query("DELETE FROM call_sessions WHERE call_sid = $1", [callSid]);
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

// Look up the last call context for a phone number (inbound callbacks)
export async function getLastCallContext(phone: string): Promise<{
  company_name?: string;
  industry?: string;
  has_website?: boolean;
  recommended_product?: string;
  stage_reached?: string;
  mockup_requested?: boolean;
} | null> {
  try {
    const normalized = phone.replace(/[\s\-\(\)]/g, "");
    const leadRes = await pool.query(
      `SELECT business_name, category, has_website, recommended_product
       FROM sales_leads WHERE replace(replace(replace(phone,' ',''),'-',''),'(','') ILIKE $1 LIMIT 1`,
      [`%${normalized.slice(-7)}`]
    );
    const callRes = await pool.query(
      `SELECT stage_reached, mockup_requested
       FROM sales_calls WHERE replace(replace(replace(to_number,' ',''),'-',''),'(','') ILIKE $1
       ORDER BY created_at DESC LIMIT 1`,
      [`%${normalized.slice(-7)}`]
    );
    if (!leadRes.rows[0] && !callRes.rows[0]) return null;
    const lead = leadRes.rows[0] ?? {};
    const call = callRes.rows[0] ?? {};
    return {
      company_name: lead.business_name,
      industry: lead.category,
      has_website: lead.has_website,
      recommended_product: lead.recommended_product,
      stage_reached: call.stage_reached,
      mockup_requested: call.mockup_requested,
    };
  } catch (e: any) {
    console.error("[DB] getLastCallContext error:", e.message);
    return null;
  }
}

export interface MarketingLead {
  phone: string;
  business_name?: string;
  industry?: string;
  has_website?: boolean;
  has_social?: boolean;
  interest_level?: "hot" | "warm" | "cold";
  interested_tier?: "starter" | "plus" | "elite";
  interested_services?: string[];
  contact_method?: string;
  contact_detail?: string;
  notes?: string;
  sales_call_id?: number;
}

export async function logMarketingLead(data: MarketingLead): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO marketing_leads
        (phone, business_name, industry, has_website, has_social,
         interest_level, interested_tier, interested_services,
         contact_method, contact_detail, notes, sales_call_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING`,
      [
        data.phone, data.business_name, data.industry,
        data.has_website, data.has_social,
        data.interest_level ?? "warm",
        data.interested_tier,
        data.interested_services ? `{${data.interested_services.join(",")}}` : null,
        data.contact_method, data.contact_detail,
        data.notes, data.sales_call_id ?? null,
      ]
    );
    console.log("[DB] Marketing lead logged:", data.phone);
  } catch (e: any) {
    console.error("[DB] logMarketingLead error:", e.message);
  }
}



