/**
 * Lead scraper — finds businesses WITHOUT websites via Google Places API.
 * Agent note: WRITE-ONLY to DB. Call trigger lives in index.ts (POST /call).
 * Usage: ts-node src/scraper.ts --location="Kingston, Jamaica" --radius=5000
 */

import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

const TARGET_CATEGORIES = [
  { keyword: "nail salon", product: "GlowDesk" },
  { keyword: "hair salon", product: "GlowDesk" },
  { keyword: "barbershop", product: "GlowDesk" },
  { keyword: "beauty salon", product: "GlowDesk" },
  { keyword: "spa", product: "SlotIQ" },
  { keyword: "courier service", product: "FleetRun" },
  { keyword: "delivery service", product: "FleetRun" },
  { keyword: "moving company", product: "HaulBase" },
  { keyword: "restaurant", product: "TableFlow" },
  { keyword: "bar", product: "TableFlow" },
  { keyword: "café", product: "TableFlow" },
  { keyword: "tour operator", product: "TourBase" },
  { keyword: "tour guide", product: "TourBase" },
  { keyword: "excursion", product: "TourBase" },
  { keyword: "tutoring center", product: "EnrollIQ" },
  { keyword: "private school", product: "EnrollIQ" },
  { keyword: "property management", product: "DwellDesk" },
  { keyword: "real estate", product: "DwellDesk" },
  { keyword: "wholesale", product: "StockOps" },
  { keyword: "car wash", product: "PunchPro" },
];

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  formatted_address?: string;
  rating?: number;
}

async function fetchPlaces(keyword: string, location: string, radius: number): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not set");

  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword + " " + location)}&radius=${radius}&key=${apiKey}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json() as { results: { place_id: string }[] };
  const placeIds = searchData.results?.slice(0, 20).map((r: any) => r.place_id) ?? [];

  const places: PlaceResult[] = [];
  for (const place_id of placeIds) {
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=name,formatted_phone_number,international_phone_number,website,formatted_address,rating&key=${apiKey}`;
    const detailRes = await fetch(detailUrl);
    const detail = await detailRes.json() as { result: PlaceResult };
    if (detail.result) places.push({ ...detail.result, place_id });
    await new Promise(r => setTimeout(r, 100));
  }
  return places;
}

async function scrapeLeads(location: string, radius = 5000) {
  console.log(`Scraping leads in: ${location} (radius: ${radius}m)`);
  let totalInserted = 0;

  for (const { keyword, product } of TARGET_CATEGORIES) {
    console.log(`  -> ${keyword} (${product})`);
    try {
      const places = await fetchPlaces(keyword, location, radius);
      const targets = places.filter(p =>
        (p.formatted_phone_number || p.international_phone_number) && !p.website
      );
      console.log(`     Found ${places.length} total, ${targets.length} without website`);

      for (const p of targets) {
        const phone = p.international_phone_number || p.formatted_phone_number || "";
        try {
          await pool.query(
            `INSERT INTO sales_leads (place_id, business_name, phone, address, category, recommended_product, has_website, google_rating, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new')
             ON CONFLICT (place_id) DO NOTHING`,
            [p.place_id, p.name, phone, p.formatted_address, keyword, product, false, p.rating ?? null]
          );
          totalInserted++;
        } catch (e: any) {
          console.error(`  DB error for ${p.name}:`, e.message);
        }
      }
    } catch (e) {
      console.error(`  Error scraping ${keyword}:`, e);
    }
  }

  console.log(`Done. ${totalInserted} leads upserted.`);
  await pool.end();
}

const args = process.argv.slice(2);
const locationArg = args.find(a => a.startsWith("--location="))?.split("=")[1] ?? "Kingston, Jamaica";
const radiusArg = parseInt(args.find(a => a.startsWith("--radius="))?.split("=")[1] ?? "5000");

scrapeLeads(locationArg, radiusArg).catch(console.error);

export { scrapeLeads, TARGET_CATEGORIES };