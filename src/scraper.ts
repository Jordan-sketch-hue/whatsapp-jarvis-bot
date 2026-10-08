/**
 * Lead scraper — finds businesses WITHOUT websites via Google Places API.
 * These are prime digital-conversion targets for Supreme Suite.
 *
 * Agent note: This module is WRITE-ONLY to the DB. It never triggers calls.
 * Call trigger lives in index.ts (POST /call). Keep them decoupled.
 *
 * Usage: ts-node src/scraper.ts --location "Kingston, Jamaica" --radius 5000
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Industries mapped to Supreme Suite products */
const TARGET_CATEGORIES = [
  // Beauty → GlowDesk / SlotIQ
  { keyword: "nail salon", product: "GlowDesk" },
  { keyword: "hair salon", product: "GlowDesk" },
  { keyword: "barbershop", product: "GlowDesk" },
  { keyword: "beauty salon", product: "GlowDesk" },
  { keyword: "spa", product: "SlotIQ" },
  // Logistics → FleetRun / HaulBase
  { keyword: "courier service", product: "FleetRun" },
  { keyword: "delivery service", product: "FleetRun" },
  { keyword: "moving company", product: "HaulBase" },
  // Food & Drink → TableFlow
  { keyword: "restaurant", product: "TableFlow" },
  { keyword: "bar", product: "TableFlow" },
  { keyword: "café", product: "TableFlow" },
  // Tourism → TourBase
  { keyword: "tour operator", product: "TourBase" },
  { keyword: "tour guide", product: "TourBase" },
  { keyword: "excursion", product: "TourBase" },
  // Education → EnrollIQ
  { keyword: "tutoring center", product: "EnrollIQ" },
  { keyword: "private school", product: "EnrollIQ" },
  // Property → DwellDesk
  { keyword: "property management", product: "DwellDesk" },
  { keyword: "real estate", product: "DwellDesk" },
  // Retail → StockOps / PunchPro
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
  user_ratings_total?: number;
}

async function fetchPlaces(keyword: string, location: string, radius: number): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not set");

  // Step 1: Text search
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword + " " + location)}&radius=${radius}&key=${apiKey}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json() as { results: { place_id: string }[] };
  const placeIds = searchData.results?.slice(0, 20).map(r => r.place_id) ?? [];

  // Step 2: Get details for each place (we need phone + website)
  const places: PlaceResult[] = [];
  for (const place_id of placeIds) {
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=name,formatted_phone_number,international_phone_number,website,formatted_address,rating,user_ratings_total&key=${apiKey}`;
    const detailRes = await fetch(detailUrl);
    const detail = await detailRes.json() as { result: PlaceResult };
    if (detail.result) places.push({ ...detail.result, place_id });
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }
  return places;
}

async function scrapeLeads(location: string, radius = 5000) {
  console.log(`Scraping leads in: ${location} (radius: ${radius}m)`);
  let totalInserted = 0;

  for (const { keyword, product } of TARGET_CATEGORIES) {
    console.log(`  → ${keyword} (${product})`);
    try {
      const places = await fetchPlaces(keyword, location, radius);

      // Filter: must have phone, must NOT have a website
      const targets = places.filter(p =>
        (p.formatted_phone_number || p.international_phone_number) && !p.website
      );

      console.log(`     Found ${places.length} total, ${targets.length} without website`);

      for (const p of targets) {
        const phone = p.international_phone_number || p.formatted_phone_number || "";
        const { error } = await supabase.from("sales_leads").upsert({
          place_id: p.place_id,
          business_name: p.name,
          phone,
          address: p.formatted_address,
          category: keyword,
          recommended_product: product,
          has_website: false,
          google_rating: p.rating,
          status: "new",
        }, { onConflict: "place_id" });

        if (!error) totalInserted++;
      }
    } catch (e) {
      console.error(`  Error scraping ${keyword}:`, e);
    }
  }

  console.log(`Done. ${totalInserted} leads upserted.`);
}

// CLI entry point
const args = process.argv.slice(2);
const locationArg = args.find(a => a.startsWith("--location="))?.split("=")[1] ?? "Kingston, Jamaica";
const radiusArg = parseInt(args.find(a => a.startsWith("--radius="))?.split("=")[1] ?? "5000");

scrapeLeads(locationArg, radiusArg).catch(console.error);

export { scrapeLeads, TARGET_CATEGORIES };
