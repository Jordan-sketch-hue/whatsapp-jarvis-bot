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
// product_no_site = what to pitch if they have NO website yet
// product_has_site = what to pitch if they ALREADY have a website (upgrade path)
const OSM_CATEGORY_MAP: Record<string, { tags: string[]; product_no_site: string; product_has_site: string; tier: number }> = {
  nail_salon:        { tags: ["amenity=beauty_salon", "shop=beauty", "shop=nail_salon"], product_no_site: "Website from J$50K — online booking, gallery, contact form", product_has_site: "GlowDesk J$35/mo — add online booking + loyalty points to your existing site", tier: 1 },
  hair_salon:        { tags: ["amenity=hairdresser", "shop=hairdresser"], product_no_site: "Website from J$50K — gallery, online booking, contact form", product_has_site: "GlowDesk J$35/mo — add online booking + loyalty to your existing site", tier: 1 },
  barbershop:        { tags: ["amenity=barber", "shop=barber"], product_no_site: "Website from J$50K — booking, hours, location, mobile-ready", product_has_site: "GlowDesk J$35/mo — add online booking + loyalty to your existing site", tier: 1 },
  spa:               { tags: ["leisure=spa", "amenity=spa"], product_no_site: "Website from J$50K — gallery, services menu, online booking", product_has_site: "Marketing Starter J$30K/mo — IG/FB content, ads + AI Sales Bot to fill your bookings", tier: 1 },
  restaurant:        { tags: ["amenity=restaurant", "amenity=fast_food"], product_no_site: "Website from J$50K — digital menu, online orders, contact form", product_has_site: "TableFlow J$69/mo — add reservations + online orders to your existing site", tier: 1 },
  bakery:            { tags: ["shop=bakery"], product_no_site: "Website from J$50K — pre-order system, product gallery, contact form", product_has_site: "Marketing Starter J$30K/mo — IG content + ads to drive daily foot traffic", tier: 1 },
  catering:          { tags: ["amenity=catering"], product_no_site: "Website from J$50K — event gallery, quote request form, contact", product_has_site: "Marketing Starter J$30K/mo — IG/FB content + event ads + AI Sales Bot for enquiries", tier: 1 },
  clothing_boutique: { tags: ["shop=clothes", "shop=fashion"], product_no_site: "Website from J$50K — online store, product pages, payment ready", product_has_site: "Marketing Starter J$30K/mo — IG/FB fashion content + ads to drive sales", tier: 1 },
  auto_repair:       { tags: ["shop=car_repair", "amenity=car_repair"], product_no_site: "Website from J$50K — services, booking form, location", product_has_site: "Marketing Starter J$30K/mo — Google/FB ads + AI Bot", tier: 1 },
  car_detailing:     { tags: ["amenity=car_wash", "shop=car_wash"], product_no_site: "Website from J$50K — before/after gallery, booking form, pricing", product_has_site: "Marketing Starter J$30K/mo — IG reels + ads + AI Bot to fill weekly bookings", tier: 1 },
  plumber:           { tags: ["shop=plumber"], product_no_site: "Website from J$50K — emergency call form, services, location", product_has_site: "Marketing Starter J$30K/mo — Google/FB visibility + AI Bot to capture emergency leads 24/7", tier: 1 },
  electrician:       { tags: ["shop=electrician"], product_no_site: "Website from J$50K — lead capture, services list, location", product_has_site: "Marketing Starter J$30K/mo — Google/FB visibility + AI Bot to capture service leads 24/7", tier: 1 },
  pharmacy:          { tags: ["amenity=pharmacy"], product_no_site: "Website from J$50K — hours, location, prescription refill form", product_has_site: "Marketing Starter J$30K/mo — local Google/FB ads + AI Bot for prescription enquiries", tier: 1 },
  dentist:           { tags: ["amenity=dentist"], product_no_site: "Website from J$50K — patient booking, services, before/after gallery", product_has_site: "Marketing Plus J$55K/mo — Google ads + IG content + AI Bot to handle new patient enquiries", tier: 2 },
  real_estate_agent: { tags: ["office=estate_agent", "amenity=real_estate_agent"], product_no_site: "Website from J$50K — property listings, contact form + AI Sales Bot add-on", product_has_site: "AI Sales Agent US$50/mo — calls your leads automatically, qualifies buyers/sellers 24/7", tier: 2 },
  accountant:        { tags: ["office=accountant"], product_no_site: "Website from J$50K — includes a secure login where your clients upload documents, view reports, and message you directly", product_has_site: "Marketing Starter J$30K/mo — Google/LinkedIn visibility ads + AI Bot for new client enquiries", tier: 2 },
  lawyer:            { tags: ["office=lawyer", "office=notary"], product_no_site: "Website from J$50K — includes a secure login where clients track their case, upload documents, and message you directly", product_has_site: "Marketing Starter J$30K/mo — Google visibility + AI Bot to handle new client intake 24/7", tier: 2 },
  gym:               { tags: ["leisure=fitness_centre", "amenity=gym"], product_no_site: "Website from J$50K — class schedule, membership sign-up, online booking", product_has_site: "Marketing Starter J$30K/mo — IG/FB fitness content + ads + AI Bot for membership enquiries", tier: 2 },
  tour_operator:     { tags: ["tourism=information", "office=travel_agent"], product_no_site: "Website from J$50K — tour listings, direct booking, itinerary pages", product_has_site: "TourBase J$49/mo — add online booking + payment to your existing site + Marketing Starter", tier: 2 },
  guest_house:       { tags: ["tourism=guest_house", "tourism=hostel"], product_no_site: "Website from J$50K — room listings, direct booking, no Airbnb commission fees", product_has_site: "Marketing Starter J$30K/mo — IG/FB content + Google/FB ads to drive direct bookings", tier: 2 },
  car_dealership:    { tags: ["shop=car", "shop=car_dealer"], product_no_site: "Website from J$50K — vehicle inventory site, contact form, financing enquiry form", product_has_site: "AI Sales Agent US$50/mo — calls your leads, qualifies buyers + Marketing Starter for inventory ads", tier: 3 },
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

const OVERPASS_MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // VK Maps - no rate limit
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function queryOverpass(osmTag: string, bbox: string): Promise<OsmElement[]> {
  const [key, val] = osmTag.split("=");
  const query = `[out:json][timeout:25];(node["${key}"="${val}"](${bbox});way["${key}"="${val}"](${bbox}););out center tags;`;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) { console.warn(`  [${mirror}] ${res.status} -- trying next`); continue; }
      const data = await res.json() as { elements: OsmElement[] };
      return data.elements ?? [];
    } catch (e: any) {
      console.warn(`  [${mirror}] ${e.message} -- trying next`);
    }
  }
  throw new Error(`All Overpass mirrors failed for ${osmTag}`);
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
            hasWebsite(tags) ? config.product_has_site : config.product_no_site,
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
