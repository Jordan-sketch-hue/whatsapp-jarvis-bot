/**
 * Lead scraper — finds businesses WITHOUT websites via Overpass API (OpenStreetMap).
 * 100% free, no API key required.
 * Usage: ts-node src/scraper.ts --query "nail salon" --location "Kingston Jamaica" --limit 50
 *    OR: ts-node src/scraper.ts --run-all   (runs all scraper-targets.json categories)
 */

import "dotenv/config";
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

// OSM tag → our category mapping
const OSM_CATEGORY_MAP: Record<string, { tags: string[]; product: string; tier: number }> = {
  nail_salon:        { tags: ["amenity=beauty_salon", "shop=beauty", "shop=nail_salon"], product: "Website + Booking (J$25K)", tier: 1 },
  hair_salon:        { tags: ["amenity=hairdresser", "shop=hairdresser"], product: "Website + Gallery + Booking (J$25K)", tier: 1 },
  barbershop:        { tags: ["amenity=barber", "shop=barber"], product: "Website + Booking (J$20K)", tier: 1 },
  spa:               { tags: ["leisure=spa", "amenity=spa"], product: "Spa Site + Booking (J$30K)", tier: 1 },
  restaurant:        { tags: ["amenity=restaurant", "amenity=fast_food"], product: "Website + Menu + Order (J$30K)", tier: 1 },
  bakery:            { tags: ["shop=bakery"], product: "Website + Pre-Order (J$20K)", tier: 1 },
  catering:          { tags: ["amenity=catering"], product: "Website + Quote Form (J$35K)", tier: 1 },
  clothing_boutique: { tags: ["shop=clothes", "shop=fashion"], product: "E-commerce Website (J$35K)", tier: 1 },
  auto_repair:       { tags: ["shop=car_repair", "amenity=car_repair"], product: "Website + Booking (J$25K)", tier: 1 },
  car_detailing:     { tags: ["amenity=car_wash", "shop=car_wash"], product: "Website + Gallery (J$20K)", tier: 1 },
  plumber:           { tags: ["shop=plumber"], product: "Website + Emergency Form (J$20K)", tier: 1 },
  electrician:       { tags: ["shop=electrician"], product: "Website + Lead Capture (J$20K)", tier: 1 },
  pharmacy:          { tags: ["amenity=pharmacy"], product: "Website + Refill Form (J$30K)", tier: 1 },
  dentist:           { tags: ["amenity=dentist"], product: "Website + Patient Booking (J$50K)", tier: 2 },
  real_estate_agent: { tags: ["office=estate_agent", "amenity=real_estate_agent"], product: "Property Site + CRM + AI Caller (J$50K)", tier: 2 },
  accountant:        { tags: ["office=accountant"], product: "Client Portal + Website (J$40K)", tier: 2 },
  lawyer:            { tags: ["office=lawyer", "office=notary"], product: "Case Intake + Client Portal (J$60K)", tier: 2 },
  gym:               { tags: ["leisure=fitness_centre", "amenity=gym"], product: "Website + Class Booking (J$40K)", tier: 2 },
  tour_operator:     { tags: ["tourism=information", "office=travel_agent"], product: "Direct Booking Site (J$50K)", tier: 2 },
  guest_house:       { tags: ["tourism=guest_house", "tourism=hostel"], product: "Direct Booking (J$50K)", tier: 2 },
  car_dealership:    { tags: ["shop=car", "shop=car_dealer"], product: "Inventory Site + AI Caller (US$400+/mo)", tier: 3 },
};

// Jamaica bounding box — covers the whole island
const JAMAICA_BBOX = "17.7,-78.4,18.6,-76.2";

// City bboxes for targeted queries
const CITY_BBOX: Record<string, string> = {
  "Kingston":      "17.87,-76.87,18.05,-76.70",
  "Montego Bay":   "18.44,-77.97,18.52,-77.88",
  "Spanish Town":  "17.97,-77.00,18.04,-76.93",
  "Portmore":      "17.93,-76.94,18.00,-76.85",
  "Ocho Rios":     "18.38,-77.14,18.42,-77.09",
  "Negril":        "18.25,-78.38,18.35,-78.30",
};

interface OsmElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function queryOverpass(osmTag: string, bbox: string): Promise<OsmElement[]> {
  const [key, val] = osmTag.split("=");
  const query = `[out:json][timeout:25];(node["${key}"="${val}"](${bbox});way["${key}"="${val}"](${bbox}););out center tags;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const data = await res.json() as { elements: OsmElement[] };
  return data.elements ?? [];
}

function buildPhone(tags: Record<string, string>): string {
  return tags.phone || tags["contact:phone"] || tags.mobile || tags["contact:mobile"] || "";
}

function hasWebsite(tags: Record<string, string>): boolean {
  return !!(tags.website || tags["contact:website"] || tags.url);
}

async function scrapeCategory(category: string, location: string, limit: number) {
  const config = OSM_CATEGORY_MAP[category];
  if (!config) { console.error(`Unknown category: ${category}`); return 0; }

  const bbox = CITY_BBOX[location] ?? JAMAICA_BBOX;
  let inserted = 0;

  for (const osmTag of config.tags) {
    let elements: OsmElement[] = [];
    try {
      elements = await queryOverpass(osmTag, bbox);
      await new Promise(r => setTimeout(r, 1200)); // be polite to Overpass
    } catch (e: any) {
      console.error(`  Overpass error [${osmTag}]:`, e.message);
      continue;
    }

    for (const el of elements) {
      if (inserted >= limit) break;
      const tags = el.tags ?? {};
      const phone = buildPhone(tags);
      if (!phone) continue; // skip if no phone — bot can't call them

      const name = tags.name || tags["name:en"] || `[${category} #${el.id}]`;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"] || location].filter(Boolean).join(" ") || location;
      const placeId = `osm:${el.id}`;

      try {
        await pool.query(
          `INSERT INTO sales_leads (place_id, business_name, phone, address, category, recommended_product, has_website, status, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8)
           ON CONFLICT (place_id) DO NOTHING`,
          [
            placeId,
            name,
            phone,
            address,
            category,
            config.product,
            hasWebsite(tags),
            `TIER:${config.tier} | OSM:${osmTag} | LOC:${location}${hasWebsite(tags) ? " | HAS_WEBSITE" : ""}`,
          ]
        );
        inserted++;
        console.log(`  + ${name} | ${phone} | ${address}`);
      } catch (e: any) {
        if (!e.message.includes("duplicate")) console.error(`  DB error:`, e.message);
      }
    }
  }

  return inserted;
}

async function runAll(limit = 30) {
  const targetsPath = join(__dirname, "../leads/scraper-targets.json");
  const targets = JSON.parse(readFileSync(targetsPath, "utf8")) as Array<{
    category: string;
    queries: Array<{ q: string; location: string }>;
    limit_per_query: number;
  }>;

  let total = 0;
  for (const t of targets) {
    for (const q of t.queries) {
      const city = q.location.replace(" Jamaica", "").trim();
      console.log(`\n[${t.category}] ${city}`);
      const count = await scrapeCategory(t.category, city, t.limit_per_query ?? limit);
      total += count;
      console.log(`  -> ${count} leads inserted`);
    }
  }

  console.log(`\nDone. Total: ${total} leads inserted.`);
  await pool.end();
}

// CLI
const args = process.argv.slice(2);
if (args.includes("--run-all")) {
  runAll().catch(console.error);
} else {
  const queryArg = args.find(a => a.startsWith("--query="))?.split("=")[1] ?? args.find(a => a.startsWith("--query"))?.replace("--query ", "") ?? "";
  const locationArg = args.find(a => a.startsWith("--location="))?.split("=")[1] ?? "Kingston";
  const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "50");
  const category = Object.keys(OSM_CATEGORY_MAP).find(k => k.includes(queryArg.toLowerCase().replace(/ /g, "_"))) ?? queryArg;

  if (!category) {
    console.log("Available categories:", Object.keys(OSM_CATEGORY_MAP).join(", "));
    process.exit(1);
  }

  console.log(`Scraping: ${category} in ${locationArg} (limit: ${limitArg})`);
  scrapeCategory(category, locationArg, limitArg)
    .then(n => { console.log(`\nInserted: ${n}`); pool.end(); })
    .catch(console.error);
}

export { scrapeCategory, runAll, OSM_CATEGORY_MAP };
