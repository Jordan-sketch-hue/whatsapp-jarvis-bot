/**
 * One-time migration: update existing intl leads to use new product_no_site/product_has_site
 * and TIER:X notes format, matching the local scraper workflow.
 */
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const INTL_CATEGORIES: Record<string, { product_no_site: string; product_has_site: string; tier: 1 | 2 | 3 }> = {
  hair_salon:         { tier: 1, product_no_site: "Website + Booking from US$650 — gallery, online booking, contact form",                                          product_has_site: "GlowDesk US$35/mo — add online booking + loyalty points to your existing site" },
  nail_salon:         { tier: 1, product_no_site: "Website + Booking from US$650 — gallery, online booking, contact form",                                          product_has_site: "GlowDesk US$35/mo — add online booking + loyalty points to your existing site" },
  barbershop:         { tier: 1, product_no_site: "Website + Booking from US$650 — booking, hours, location, mobile-ready",                                         product_has_site: "GlowDesk US$35/mo — add online booking + loyalty to your existing site" },
  spa:                { tier: 1, product_no_site: "Website + Booking from US$800 — gallery, services menu, online booking",                                         product_has_site: "Marketing Starter US$300/mo — IG/FB content + ads to fill your bookings every week" },
  tattoo_studio:      { tier: 1, product_no_site: "Portfolio Website from US$650 — portfolio, pricing, booking form",                                               product_has_site: "Marketing Starter US$300/mo — IG reels + ads to drive new clients" },
  massage_therapy:    { tier: 1, product_no_site: "Website + Booking from US$650 — gallery, services, online booking",                                              product_has_site: "GlowDesk US$35/mo — add online booking + loyalty program" },
  cosmetics_store:    { tier: 1, product_no_site: "E-commerce Website from US$650 — online store, product pages, payment ready",                                    product_has_site: "Marketing Starter US$300/mo — IG/FB product content + ads to drive online sales" },
  tanning_salon:      { tier: 1, product_no_site: "Website + Booking from US$650 — services, booking, contact form",                                               product_has_site: "GlowDesk US$35/mo — add online booking + loyalty program" },
  eyebrow_threading:  { tier: 1, product_no_site: "Website + Booking from US$650 — services, pricing, online booking",                                              product_has_site: "GlowDesk US$35/mo — add online booking + loyalty program" },
  restaurant:         { tier: 1, product_no_site: "Website + Digital Menu from US$650 — digital menu, online orders, contact form",                                 product_has_site: "TableFlow US$69/mo — add online reservations + delivery orders to your existing site" },
  bakery:             { tier: 1, product_no_site: "Website + Pre-Order from US$650 — pre-order system, product gallery, contact form",                              product_has_site: "Marketing Starter US$300/mo — daily IG content + ads to drive foot traffic" },
  catering:           { tier: 2, product_no_site: "Website + Quote Form from US$800 — event gallery, quote request form, contact",                                  product_has_site: "AI Sales Bot US$50/mo — follows up every enquiry automatically so you never miss a booking" },
  hotel_guesthouse:   { tier: 2, product_no_site: "Booking Website from US$800 — room listings, direct booking, no OTA commission fees",                            product_has_site: "Marketing Starter US$300/mo — IG/FB content + Google ads to drive direct bookings and cut commission fees" },
  cafe:               { tier: 1, product_no_site: "Website + Menu from US$650 — menu, hours, location, contact form",                                               product_has_site: "Marketing Starter US$300/mo — daily IG content + local ads to drive foot traffic" },
  bar_nightclub:      { tier: 1, product_no_site: "Website + Events from US$650 — events calendar, gallery, contact form",                                         product_has_site: "Marketing Starter US$300/mo — weekly IG reels + event ads" },
  food_truck:         { tier: 1, product_no_site: "Website + Menu from US$650 — menu, schedule/location, contact form",                                             product_has_site: "Marketing Starter US$300/mo — IG content + location posts to build daily following" },
  ice_cream:          { tier: 1, product_no_site: "Website + Menu from US$650 — menu, gallery, location, contact",                                                  product_has_site: "Marketing Starter US$300/mo — IG reels + seasonal ads" },
  juice_bar:          { tier: 1, product_no_site: "Website + Menu from US$650 — menu, health/wellness content, contact",                                            product_has_site: "Marketing Starter US$300/mo — daily IG content + health/wellness ads" },
  auto_repair:        { tier: 1, product_no_site: "Website + Booking from US$650 — services, booking form, location",                                               product_has_site: "Marketing Starter US$300/mo — Google/FB ads to capture local service searches 24/7" },
  car_detailing:      { tier: 1, product_no_site: "Website + Gallery from US$650 — before/after gallery, booking form, pricing",                                    product_has_site: "Marketing Starter US$300/mo — before/after IG reels + ads to fill weekly slots" },
  car_dealership:     { tier: 3, product_no_site: "Inventory Website from US$1,000 — vehicle inventory, contact form, financing enquiry form",                      product_has_site: "AI Sales Bot US$50/mo — calls your leads, qualifies buyers + Marketing Starter for inventory ads" },
  auto_parts:         { tier: 1, product_no_site: "Website + Parts Search from US$800 — parts catalogue, quote form, contact",                                      product_has_site: "Marketing Starter US$300/mo — Google/FB ads for local parts searches" },
  motorcycle_repair:  { tier: 1, product_no_site: "Website + Booking from US$650 — services, booking, location",                                                    product_has_site: "Marketing Starter US$300/mo — IG content + local Google ads" },
  towing_service:     { tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency call form, services, location",                                 product_has_site: "Marketing Starter US$300/mo — Google ads to rank for emergency towing searches" },
  clothing_boutique:  { tier: 1, product_no_site: "E-commerce Website from US$1,000 — online store, product pages, payment ready",                                  product_has_site: "Marketing Starter US$300/mo — IG/FB fashion content + ads to drive online and in-store sales" },
  jewellery_store:    { tier: 1, product_no_site: "E-commerce Website from US$1,000 — product pages, online store, payment ready",                                  product_has_site: "Marketing Starter US$300/mo — IG product shoots + ads for gifting seasons" },
  electronics_store:  { tier: 1, product_no_site: "E-commerce Website from US$1,000 — product catalogue, online store, payment ready",                              product_has_site: "Marketing Starter US$300/mo — Google/FB ads targeting local buyers" },
  convenience_store:  { tier: 1, product_no_site: "Website + Deals Page from US$650 — weekly deals, location, contact",                                             product_has_site: "Marketing Starter US$300/mo — weekly deals posts + local ads" },
  supermarket:        { tier: 1, product_no_site: "Website + Weekly Deals from US$800 — deals page, location, contact form",                                        product_has_site: "Marketing Starter US$300/mo — weekly specials content + local Google/FB ads" },
  pharmacy:           { tier: 1, product_no_site: "Website + Refill Form from US$650 — hours, location, prescription refill form",                                  product_has_site: "Marketing Starter US$300/mo — Google/FB ads for local health searches" },
  furniture_store:    { tier: 1, product_no_site: "E-commerce Website from US$1,000 — product catalogue, online store, payment ready",                              product_has_site: "Marketing Starter US$300/mo — IG room styling content + FB ads" },
  sports_store:       { tier: 1, product_no_site: "E-commerce Website from US$800 — product catalogue, online store, payment ready",                                product_has_site: "Marketing Starter US$300/mo — IG lifestyle content + seasonal ads" },
  gift_shop:          { tier: 1, product_no_site: "E-commerce Website from US$650 — product pages, online store, contact form",                                     product_has_site: "Marketing Starter US$300/mo — IG product content + holiday/gifting ads" },
  bookstore:          { tier: 1, product_no_site: "E-commerce Website from US$650 — catalogue, online store, contact form",                                         product_has_site: "Marketing Starter US$300/mo — IG reading content + local community ads" },
  hardware_store:     { tier: 1, product_no_site: "Website + Deals Page from US$800 — product catalogue, deals, contact form",                                      product_has_site: "Marketing Starter US$300/mo — Google/FB ads for DIY and trade searches" },
  pet_store:          { tier: 1, product_no_site: "E-commerce Website from US$650 — product pages, online store, contact",                                          product_has_site: "Marketing Starter US$300/mo — IG pet content + local ads" },
  lawyer:             { tier: 2, product_no_site: "Website + Client Portal from US$800 — includes a secure login where clients track their case, upload documents, and message you directly", product_has_site: "AI Sales Bot US$50/mo — handles new client intake calls 24/7, books consultations automatically" },
  accountant:         { tier: 2, product_no_site: "Website + Client Portal from US$800 — includes a secure login where clients upload documents, view reports, and message you directly",      product_has_site: "Marketing Starter US$300/mo — LinkedIn/Google visibility ads + AI Bot for new client enquiries" },
  dentist:            { tier: 2, product_no_site: "Website + Booking from US$800 — patient booking, services, before/after gallery",                                product_has_site: "Marketing Starter US$300/mo — Google ads for new patients + AI Bot to answer appointment questions" },
  doctor_clinic:      { tier: 2, product_no_site: "Website + Booking from US$800 — patient booking, services, contact form",                                        product_has_site: "AI Sales Bot US$50/mo — answers patient enquiries and books appointments automatically" },
  optician:           { tier: 2, product_no_site: "Website + Booking from US$650 — services, booking, gallery",                                                     product_has_site: "Marketing Starter US$300/mo — Google/FB ads for eye exams and eyewear" },
  insurance_office:   { tier: 3, product_no_site: "Website + Quote Form from US$800 — services, quote form, contact",                                               product_has_site: "AI Sales Bot US$50/mo — calls every quote request within 60 seconds, closes before they shop around" },
  mortgage_broker:    { tier: 3, product_no_site: "Website + Calculator from US$800 — mortgage calculator, quote form, contact",                                    product_has_site: "AI Sales Bot US$50/mo — follows up every mortgage enquiry automatically, books consultations" },
  real_estate_agent:  { tier: 3, product_no_site: "Website + AI Sales Bot from US$800 — property listings, contact form + AI Sales Bot add-on",                    product_has_site: "AI Sales Bot US$50/mo — calls your leads automatically, qualifies buyers and sellers 24/7" },
  property_manager:   { tier: 2, product_no_site: "Website + Tenant Portal from US$1,000 — property listings, tenant portal, contact",                              product_has_site: "AI Sales Bot US$50/mo — handles tenant enquiries and maintenance requests automatically" },
  recruitment_agency: { tier: 2, product_no_site: "Website + Job Board from US$800 — job listings, application form, contact",                                      product_has_site: "AI Sales Bot US$50/mo — screens candidates and books employer calls automatically" },
  tax_preparer:       { tier: 2, product_no_site: "Website + Client Portal from US$800 — tax services, client portal, contact",                                     product_has_site: "Marketing Starter US$300/mo — Google/FB ads targeting tax season searches" },
  architect:          { tier: 2, product_no_site: "Portfolio Website from US$800 — project portfolio, services, contact form",                                      product_has_site: "Marketing Starter US$300/mo — IG project showcases + LinkedIn/Google ads" },
  marketing_agency:   { tier: 2, product_no_site: "Website + Case Studies from US$800 — case studies, services, contact form",                                      product_has_site: "AI Sales Bot US$50/mo — follows up every inbound lead automatically" },
  it_services:        { tier: 2, product_no_site: "Website + Client Portal from US$800 — services, client portal, contact form",                                    product_has_site: "AI Sales Bot US$50/mo — handles new client enquiries and books discovery calls 24/7" },
  gym:                { tier: 2, product_no_site: "Website + Class Booking from US$800 — class schedule, membership sign-up, online booking",                       product_has_site: "Marketing Starter US$300/mo — IG/FB fitness content + membership ads to fill your floor" },
  physiotherapy:      { tier: 2, product_no_site: "Website + Booking from US$800 — services, patient booking, gallery",                                             product_has_site: "Marketing Starter US$300/mo — Google/FB ads for injury recovery and physio searches" },
  mental_health:      { tier: 2, product_no_site: "Website + Booking from US$800 — services, patient booking, contact form",                                        product_has_site: "Marketing Starter US$300/mo — Google/FB ads targeting therapy and counselling searches" },
  veterinary:         { tier: 2, product_no_site: "Website + Booking from US$800 — services, pet booking, gallery",                                                 product_has_site: "Marketing Starter US$300/mo — IG pet content + local Google/FB ads for vet searches" },
  yoga_studio:        { tier: 2, product_no_site: "Website + Class Booking from US$800 — class schedule, booking, gallery",                                         product_has_site: "Marketing Starter US$300/mo — IG wellness content + class ads" },
  pilates_studio:     { tier: 2, product_no_site: "Website + Class Booking from US$800 — class schedule, booking, gallery",                                         product_has_site: "Marketing Starter US$300/mo — IG content + class ads to fill your schedule" },
  martial_arts:       { tier: 1, product_no_site: "Website + Class Booking from US$650 — class schedule, booking, gallery",                                         product_has_site: "Marketing Starter US$300/mo — IG training content + local ads" },
  nutritionist:       { tier: 2, product_no_site: "Website + Booking from US$800 — services, booking, contact form",                                               product_has_site: "Marketing Starter US$300/mo — IG health content + Google/FB ads" },
  plumber:            { tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency call form, services, location",                                 product_has_site: "Marketing Starter US$300/mo — Google ads to rank for emergency plumber searches 24/7" },
  electrician:        { tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency call form, services, location",                                 product_has_site: "Marketing Starter US$300/mo — Google ads to rank for emergency electrician searches 24/7" },
  construction:       { tier: 2, product_no_site: "Website + Portfolio from US$800 — project portfolio, services, quote form",                                      product_has_site: "Marketing Starter US$300/mo — IG project portfolio content + Google/FB ads" },
  roofing:            { tier: 1, product_no_site: "Website + Quote Form from US$650 — services, quote form, location",                                              product_has_site: "Marketing Starter US$300/mo — Google/FB ads for roofing leads + AI Bot follow-up" },
  landscaping:        { tier: 1, product_no_site: "Website + Gallery from US$650 — before/after gallery, services, quote form",                                    product_has_site: "Marketing Starter US$300/mo — IG before/after content + seasonal ads" },
  cleaning_service:   { tier: 1, product_no_site: "Website + Booking from US$650 — services, booking form, location",                                               product_has_site: "Marketing Starter US$300/mo — Google/FB ads for recurring cleaning contracts" },
  moving_company:     { tier: 1, product_no_site: "Website + Quote Form from US$650 — services, quote form, contact",                                               product_has_site: "AI Sales Bot US$50/mo — calls every quote request same day, books jobs before they go elsewhere" },
  pest_control:       { tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency form, services, location",                                      product_has_site: "Marketing Starter US$300/mo — Google ads for emergency pest control searches" },
  hvac_service:       { tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency form, services, location",                                      product_has_site: "Marketing Starter US$300/mo — Google ads for HVAC emergency + seasonal service searches" },
  solar_installer:    { tier: 3, product_no_site: "Website + Calculator from US$800 — solar calculator, gallery, quote form",                                      product_has_site: "AI Sales Bot US$50/mo — follows up every solar enquiry automatically, qualifies homeowners" },
  pool_service:       { tier: 1, product_no_site: "Website + Booking from US$650 — services, booking, gallery",                                                     product_has_site: "Marketing Starter US$300/mo — IG pool content + local ads for maintenance contracts" },
  security_company:   { tier: 2, product_no_site: "Website + Quote Form from US$800 — services, quote form, contact",                                               product_has_site: "AI Sales Bot US$50/mo — calls every security enquiry within 60 seconds" },
  home_renovation:    { tier: 2, product_no_site: "Website + Portfolio from US$800 — project portfolio, services, quote form",                                      product_has_site: "Marketing Starter US$300/mo — IG renovation portfolio content + Google/FB ads" },
  painting_service:   { tier: 1, product_no_site: "Website + Quote Form from US$650 — before/after gallery, quote form, contact",                                   product_has_site: "Marketing Starter US$300/mo — IG before/after content + local ads for painting jobs" },
  school_college:     { tier: 2, product_no_site: "School Website + Enrolment from US$800 — enrolment form, staff page, calendar",                                  product_has_site: "Marketing Starter US$300/mo — FB/Google ads for enrolment season" },
  driving_school:     { tier: 1, product_no_site: "Website + Booking from US$650 — slot booking, pricing, contact form",                                            product_has_site: "Marketing Starter US$300/mo — Google/FB ads targeting new drivers" },
  tutoring_center:    { tier: 1, product_no_site: "Website + Booking from US$650 — subjects, booking, contact form",                                                product_has_site: "Marketing Starter US$300/mo — FB ads targeting parents + exam season campaigns" },
  church:             { tier: 1, product_no_site: "Website + Events from US$650 — events calendar, sermons, contact form",                                          product_has_site: "Marketing Starter US$300/mo — weekly IG/FB sermon clips + community event posts" },
  music_school:       { tier: 1, product_no_site: "Website + Booking from US$650 — lessons, booking, gallery",                                                      product_has_site: "Marketing Starter US$300/mo — IG student progress content + enrolment ads" },
  dance_studio:       { tier: 1, product_no_site: "Website + Class Booking from US$650 — class schedule, booking, gallery",                                         product_has_site: "Marketing Starter US$300/mo — IG performance clips + class enrolment ads" },
  daycare:            { tier: 1, product_no_site: "Website + Enrolment Form from US$650 — services, enrolment form, gallery",                                       product_has_site: "Marketing Starter US$300/mo — FB ads targeting local parents" },
  language_school:    { tier: 2, product_no_site: "Website + Booking from US$650 — courses, booking, gallery",                                                      product_has_site: "Marketing Starter US$300/mo — FB/Google ads targeting language learners" },
  tour_operator:      { tier: 2, product_no_site: "Tour Site + Booking from US$800 — tour listings, direct booking, itinerary pages",                               product_has_site: "Marketing Starter US$300/mo — IG tour content + Google/FB ads to drive direct bookings" },
  car_rental:         { tier: 2, product_no_site: "Website + Booking from US$800 — fleet listing, booking, contact form",                                           product_has_site: "Marketing Starter US$300/mo — Google ads to capture rental searches + AI Bot for enquiries" },
  boat_charter:       { tier: 2, product_no_site: "Website + Booking from US$800 — charter listings, booking, gallery",                                             product_has_site: "Marketing Starter US$300/mo — IG charter content + seasonal ads" },
  villa_rental:       { tier: 2, product_no_site: "Booking Website from US$1,000 — room listings, direct booking, no Airbnb commission fees",                       product_has_site: "Marketing Starter US$300/mo — IG property content + Google/FB ads to drive direct bookings" },
  travel_agency:      { tier: 2, product_no_site: "Website + Booking from US$800 — packages, booking, contact form",                                                product_has_site: "Marketing Starter US$300/mo — IG travel content + destination ads" },
  funeral_home:       { tier: 2, product_no_site: "Professional Website from US$800 — services, gallery, contact form",                                             product_has_site: "Marketing Starter US$300/mo — Google/FB visibility ads for local searches" },
  photography_studio: { tier: 1, product_no_site: "Portfolio Website from US$650 — portfolio, pricing, booking form",                                               product_has_site: "Marketing Starter US$300/mo — IG portfolio content + Google/FB ads for events and portraits" },
  event_venue:        { tier: 2, product_no_site: "Website + Events from US$800 — venue gallery, availability, contact form",                                       product_has_site: "Marketing Starter US$300/mo — IG event content + FB/Google ads targeting event planners" },
  printing_shop:      { tier: 1, product_no_site: "Website + Quote Form from US$650 — services, quote form, contact",                                               product_has_site: "Marketing Starter US$300/mo — Google/FB ads for print and design services" },
  laundry:            { tier: 1, product_no_site: "Website + Booking from US$650 — services, pickup/delivery booking, contact",                                    product_has_site: "Marketing Starter US$300/mo — local Google/FB ads for pickup and delivery service" },
  storage_facility:   { tier: 1, product_no_site: "Website + Quote Form from US$650 — unit sizes, pricing, quote form",                                             product_has_site: "Marketing Starter US$300/mo — Google/FB ads for local storage searches" },
  courier_logistics:  { tier: 2, product_no_site: "Website + Tracking Portal from US$800 — services, tracking portal, quote form",                                  product_has_site: "AI Sales Bot US$50/mo — handles shipping enquiries and quotes automatically" },
};

async function fetchLeads(offset: number, limit: number) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sales_leads?market=not.is.null&select=id,category,has_website,notes,market&offset=${offset}&limit=${limit}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return res.json() as Promise<Array<{ id: number; category: string; has_website: boolean; notes: string; market: string }>>;
}

async function updateLead(id: number, recommended_product: string, notes: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sales_leads?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ recommended_product, notes }),
  });
  return res.ok;
}

async function main() {
  let offset = 0;
  const limit = 200;
  let updated = 0;
  let skipped = 0;

  console.log("Migrating intl leads...");

  while (true) {
    const leads = await fetchLeads(offset, limit);
    if (leads.length === 0) break;

    for (const lead of leads) {
      const cfg = INTL_CATEGORIES[lead.category];
      if (!cfg) { skipped++; continue; }

      // Skip if already migrated (notes already has TIER: prefix)
      if (lead.notes?.startsWith("TIER:")) { skipped++; continue; }

      const product = lead.has_website ? cfg.product_has_site : cfg.product_no_site;
      // Parse old notes to extract market label and country
      // Old format: "INTL|Barbados|Barbados|UPSELL:..." or similar
      const parts = lead.notes?.split("|") ?? [];
      const marketLabel = parts[1]?.trim() || lead.market;
      const country = parts[2]?.trim() || lead.market;
      const hasWebsite = lead.has_website || lead.notes?.includes("HAS_WEBSITE");
      const newNotes = `TIER:${cfg.tier} | INTL:${marketLabel} | LOC:${country}${hasWebsite ? " | HAS_WEBSITE" : ""}`;

      const ok = await updateLead(lead.id, product, newNotes);
      if (ok) { updated++; } else { skipped++; }
    }

    console.log(`  Processed ${offset + leads.length} | Updated: ${updated} | Skipped: ${skipped}`);
    offset += limit;
    if (leads.length < limit) break;
  }

  console.log(`\nDone. Updated: ${updated} | Skipped: ${skipped}`);
}

main().catch(console.error);
