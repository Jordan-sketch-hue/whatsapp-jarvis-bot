/**
 * findyello.com/jamaica scraper — free, no API key.
 * Uses Puppeteer headless browser to bypass Cloudflare.
 * Pushes leads directly to Supabase sales_leads table.
 *
 * Usage:
 *   ts-node src/scraper-yello.ts --category "nail salon" --limit 50
 *   ts-node src/scraper-yello.ts --run-all
 *
 * URL pattern: https://www.findyello.com/jamaica/{slug}/
 * Pagination:  https://www.findyello.com/jamaica/{slug}/page-2/
 */

import "dotenv/config";
import puppeteer, { Browser } from "puppeteer";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function dbUpsert(row: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sales_leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "apikey": SUPABASE_KEY,
      "Prefer": "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status}: ${txt}`);
  }
  return res.status === 201;
}

// Category slug → product recommendation + tier
const YELLO_CATEGORIES: Array<{
  slug: string;
  category: string;
  product: string;
  tier: number;
}> = [
  // T1 — no website, phone-only
  { slug: "nail-salon",          category: "nail_salon",        product: "Website + Booking (J$25K)",           tier: 1 },
  { slug: "hair-salon",          category: "hair_salon",        product: "Website + Gallery + Booking (J$25K)", tier: 1 },
  { slug: "barber-shop",         category: "barbershop",        product: "Website + Booking (J$20K)",           tier: 1 },
  { slug: "beauty-salon",        category: "hair_salon",        product: "Website + Gallery + Booking (J$25K)", tier: 1 },
  { slug: "spa",                 category: "spa",               product: "Spa Site + Booking (J$30K)",          tier: 1 },
  { slug: "restaurant",          category: "restaurant",        product: "Website + Menu + Order (J$30K)",      tier: 1 },
  { slug: "catering",            category: "catering",          product: "Website + Quote Form (J$35K)",        tier: 1 },
  { slug: "bakery",              category: "bakery",            product: "Website + Pre-Order (J$20K)",         tier: 1 },
  { slug: "clothing",            category: "clothing_boutique", product: "E-commerce Website (J$35K)",          tier: 1 },
  { slug: "auto-repair",         category: "auto_repair",       product: "Website + Booking (J$25K)",           tier: 1 },
  { slug: "car-wash",            category: "car_detailing",     product: "Website + Gallery (J$20K)",           tier: 1 },
  { slug: "plumber",             category: "plumber",           product: "Website + Emergency Form (J$20K)",    tier: 1 },
  { slug: "electrician",         category: "electrician",       product: "Website + Lead Capture (J$20K)",      tier: 1 },
  { slug: "pharmacy",            category: "pharmacy",          product: "Website + Refill Form (J$30K)",       tier: 1 },
  { slug: "furniture",           category: "furniture",         product: "Gallery + Quote Form (J$35K)",        tier: 1 },
  { slug: "phone-repair",        category: "phone_repair",      product: "Price List + Wait Time (J$20K)",      tier: 1 },
  // T2 — bad website / no CRM
  { slug: "dentist",             category: "dentist",           product: "Website + Patient Booking (J$50K)",   tier: 2 },
  { slug: "real-estate",         category: "real_estate_agent", product: "Property Site + CRM + AI (J$50K)",   tier: 2 },
  { slug: "insurance",           category: "insurance_agent",   product: "Website + AI Caller (J$45K)",        tier: 2 },
  { slug: "accounting",          category: "accountant",        product: "Client Portal + Website (J$40K)",     tier: 2 },
  { slug: "lawyer",              category: "lawyer",            product: "Case Intake + Portal (J$60K)",        tier: 2 },
  { slug: "gym",                 category: "gym",               product: "Website + Class Booking (J$40K)",     tier: 2 },
  { slug: "tour-operator",       category: "tour_operator",     product: "Direct Booking Site (J$50K)",         tier: 2 },
  { slug: "guest-house",         category: "guest_house",       product: "Direct Booking (J$50K)",              tier: 2 },
  { slug: "driving-school",      category: "driving_school",    product: "Slot Booking (J$25K)",                tier: 2 },
  // T3 — AI bot ready
  { slug: "car-dealership",      category: "car_dealership",    product: "Inventory + AI Caller (US$400+/mo)",  tier: 3 },
  { slug: "solar-energy",        category: "solar",             product: "AI Outreach Bot (US$300+/mo)",        tier: 3 },
];

interface YelloListing {
  name: string;
  phone: string;
  address: string;
  website: string;
  slug: string;
}

async function scrapeYelloPage(browser: Browser, url: string): Promise<YelloListing[]> {
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const listings = await page.evaluate(() => {
      const results: any[] = [];

      // findyello real DOM: div.listing[data-aid] is each business card
      const cards = document.querySelectorAll("div.listing[data-aid]");

      cards.forEach((card: Element) => {
        // Name: h2 a inside listing-content
        const name = ((card.querySelector("h2 a") || card.querySelector("h2")) as HTMLElement)?.innerText?.trim() ?? "";
        if (!name) return;

        // Phone: text node after phone icon img, or from tel: link in mobile buttons
        let phone = "";
        const phoneLis = card.querySelectorAll(".listing-right li");
        phoneLis.forEach((li: Element) => {
          if ((li as HTMLElement).innerHTML?.includes('alt="Phone Number"')) {
            const text = (li as HTMLElement).innerText?.trim() ?? "";
            if (text) phone = text;
          }
        });
        // fallback: tel: href in mobile-only section
        if (!phone) {
          const telLink = card.querySelector("a[href^='tel:']") as HTMLAnchorElement;
          if (telLink) phone = telLink.href.replace("tel:", "").replace(/-/g, "");
        }

        // Address: <address> tag in listing-right
        const address = (card.querySelector(".listing-right address") as HTMLElement)?.innerText?.replace(/\s+/g, " ").trim() ?? "";

        // Website: external link in listing-right (not findyello, not tel:)
        const websiteEl = card.querySelector(".listing-right a[href^='http']:not([href*='findyello'])") as HTMLAnchorElement;
        const website = websiteEl?.href ?? "";

        results.push({ name, phone, address, website, slug: "" });
      });

      return results;
    }) as YelloListing[];

    return listings;
  } finally {
    await page.close();
  }
}

async function scrapeCategory(
  browser: Browser,
  cat: typeof YELLO_CATEGORIES[0],
  limit: number
): Promise<number> {
  let inserted = 0;
  let pageNum = 1;

  while (inserted < limit) {
    const url = pageNum === 1
      ? `https://www.findyello.com/jamaica/${cat.slug}/`
      : `https://www.findyello.com/jamaica/${cat.slug}/page-${pageNum}/`;

    console.log(`  [${cat.slug}] page ${pageNum}: ${url}`);

    let listings: YelloListing[] = [];
    try {
      listings = await scrapeYelloPage(browser, url);
    } catch (e: any) {
      console.error(`  Error on ${url}:`, e.message);
      break;
    }

    if (listings.length === 0) break; // no more pages

    for (const l of listings) {
      if (inserted >= limit) break;
      if (!l.phone) continue;

      const placeId = `yello:${cat.slug}:${l.name.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;
      const hasWebsite = !!l.website;

      try {
        const inserted_row = await dbUpsert({
          place_id: placeId,
          business_name: l.name,
          phone: l.phone,
          address: l.address || "Jamaica",
          category: cat.category,
          recommended_product: cat.product,
          has_website: hasWebsite,
          status: "new",
          notes: `TIER:${cat.tier} | SRC:findyello | SLUG:${cat.slug}${hasWebsite ? " | HAS_WEBSITE" : ""}`,
        });
        if (inserted_row) {
          inserted++;
          console.log(`    + ${l.name} | ${l.phone}${hasWebsite ? " [has website]" : ""}`);
        }
      } catch (e: any) {
        if (!e.message?.includes("duplicate") && !e.message?.includes("23505")) console.error(`  DB error:`, e.message);
      }
    }

    pageNum++;
    await new Promise(r => setTimeout(r, 1500)); // polite delay
  }

  return inserted;
}

async function runAll(limit = 40) {
  let total = 0;

  for (const cat of YELLO_CATEGORIES) {
    console.log(`\n[${cat.category}] (tier ${cat.tier})`);
    // Fresh browser per category — avoids Cloudflare session fingerprinting
    const browser = await puppeteer.launch({ headless: true });
    try {
      const count = await scrapeCategory(browser, cat, limit);
      total += count;
      console.log(`  -> ${count} leads inserted`);
    } finally {
      await browser.close();
    }
    // Random delay 3–6s between categories
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
  }

  console.log(`\nDone. Total: ${total} leads inserted.`);
}

async function runSingle(categorySlug: string, limit: number) {
  const cat = YELLO_CATEGORIES.find(c => c.slug === categorySlug || c.category === categorySlug);
  if (!cat) {
    console.log("Available slugs:", YELLO_CATEGORIES.map(c => c.slug).join(", "));
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: true });
  try {
    console.log(`Scraping: ${cat.slug} (limit: ${limit})`);
    const count = await scrapeCategory(browser, cat, limit);
    console.log(`\nInserted: ${count}`);
  } finally {
    await browser.close();
  }
}

// CLI
const args = process.argv.slice(2);
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "40");

if (args.includes("--run-all")) {
  runAll(limitArg).catch(console.error);
} else {
  const cat = args.find(a => a.startsWith("--category="))?.split("=")[1]
    ?? args.find(a => !a.startsWith("--"))
    ?? "";
  if (!cat) {
    console.log("Usage: ts-node src/scraper-yello.ts --category nail-salon --limit 50");
    console.log("       ts-node src/scraper-yello.ts --run-all --limit 40");
    process.exit(0);
  }
  runSingle(cat, limitArg).catch(console.error);
}
