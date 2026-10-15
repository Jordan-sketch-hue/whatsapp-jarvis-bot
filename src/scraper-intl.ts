import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const INTL_MARKETS: Record<string, { label: string; country: string; currency: string; bbox: string }> = {
  // ── USA: Tier 1 — South Florida (highest priority: Caribbean diaspora, strong service economy) ──
  US_MIAMI:              { label: "Miami FL",              country: "US", currency: "USD", bbox: "25.70,-80.32,25.88,-80.13" },
  US_MIAMI_BEACH:        { label: "Miami Beach FL",        country: "US", currency: "USD", bbox: "25.76,-80.15,25.87,-80.11" },
  US_MIAMI_NORTHWEST:    { label: "NW Miami FL",           country: "US", currency: "USD", bbox: "25.82,-80.28,25.90,-80.18" },
  US_FORT_LAUDERDALE:    { label: "Fort Lauderdale FL",    country: "US", currency: "USD", bbox: "26.05,-80.22,26.21,-80.09" },
  US_BOCA_RATON:         { label: "Boca Raton FL",         country: "US", currency: "USD", bbox: "26.33,-80.16,26.42,-80.06" },
  US_WEST_PALM_BEACH:    { label: "West Palm Beach FL",    country: "US", currency: "USD", bbox: "26.62,-80.13,26.74,-80.05" },
  US_ORLANDO:            { label: "Orlando FL",            country: "US", currency: "USD", bbox: "28.39,-81.54,28.62,-81.28" },
  US_TAMPA:              { label: "Tampa FL",              country: "US", currency: "USD", bbox: "27.85,-82.57,28.06,-82.38" },

  // ── USA: Tier 2 — Southeast (test niches that already worked in JA/Miami) ──
  US_ATLANTA:            { label: "Atlanta GA",            country: "US", currency: "USD", bbox: "33.65,-84.56,33.89,-84.29" },
  US_CHARLOTTE:          { label: "Charlotte NC",          country: "US", currency: "USD", bbox: "35.10,-80.99,35.35,-80.69" },
  US_RALEIGH:            { label: "Raleigh NC",            country: "US", currency: "USD", bbox: "35.70,-78.78,35.85,-78.60" },
  US_NASHVILLE:          { label: "Nashville TN",          country: "US", currency: "USD", bbox: "36.08,-87.03,36.27,-86.67" },
  US_JACKSONVILLE:       { label: "Jacksonville FL",       country: "US", currency: "USD", bbox: "30.10,-81.81,30.50,-81.43" },

  // ── USA: Tier 3 — Large markets (scale after Southeast proven) ──
  US_NYC_BROOKLYN:       { label: "Brooklyn NY",           country: "US", currency: "USD", bbox: "40.57,-74.04,40.74,-73.83" },
  US_NYC_BRONX:          { label: "The Bronx NY",          country: "US", currency: "USD", bbox: "40.79,-73.94,40.92,-73.75" },
  US_NYC_QUEENS:         { label: "Queens NY",             country: "US", currency: "USD", bbox: "40.54,-73.96,40.80,-73.70" },
  US_HOUSTON:            { label: "Houston TX",            country: "US", currency: "USD", bbox: "29.62,-95.67,29.96,-95.15" },
  US_DALLAS:             { label: "Dallas TX",             country: "US", currency: "USD", bbox: "32.64,-97.00,32.90,-96.63" },
  US_AUSTIN:             { label: "Austin TX",             country: "US", currency: "USD", bbox: "30.17,-97.93,30.50,-97.60" },
  US_CHICAGO:            { label: "Chicago IL",            country: "US", currency: "USD", bbox: "41.64,-87.87,42.02,-87.52" },
  US_WASHINGTON_DC:      { label: "Washington DC",         country: "US", currency: "USD", bbox: "38.79,-77.12,39.00,-76.91" },
  US_LOS_ANGELES:        { label: "Los Angeles CA",        country: "US", currency: "USD", bbox: "33.70,-118.67,34.34,-118.15" },
  US_SAN_DIEGO:          { label: "San Diego CA",          country: "US", currency: "USD", bbox: "32.53,-117.28,32.96,-116.90" },
  US_PHOENIX:            { label: "Phoenix AZ",            country: "US", currency: "USD", bbox: "33.29,-112.32,33.73,-111.93" },
  US_DENVER:             { label: "Denver CO",             country: "US", currency: "USD", bbox: "39.61,-105.13,39.91,-104.75" },
  US_NEW_JERSEY:         { label: "Newark NJ",             country: "US", currency: "USD", bbox: "40.67,-74.25,40.79,-74.10" },
  US_PHILADELPHIA:       { label: "Philadelphia PA",       country: "US", currency: "USD", bbox: "39.87,-75.28,40.14,-74.96" },

  // ── Canada (test Toronto first, expand after conversion proven) ──
  CA_TORONTO:            { label: "Toronto ON",            country: "CA", currency: "CAD", bbox: "43.58,-79.64,43.86,-79.12" },
  CA_MISSISSAUGA:        { label: "Mississauga ON",        country: "CA", currency: "CAD", bbox: "43.44,-79.79,43.63,-79.57" },
  CA_BRAMPTON:           { label: "Brampton ON",           country: "CA", currency: "CAD", bbox: "43.63,-79.85,43.76,-79.67" },
  CA_OTTAWA:             { label: "Ottawa ON",             country: "CA", currency: "CAD", bbox: "45.25,-75.95,45.54,-75.55" },
  CA_CALGARY:            { label: "Calgary AB",            country: "CA", currency: "CAD", bbox: "50.85,-114.27,51.18,-113.90" },
  CA_VANCOUVER:          { label: "Vancouver BC",          country: "CA", currency: "CAD", bbox: "49.19,-123.27,49.31,-123.02" },

  // ── UK (check UK direct-marketing rules before mass outreach) ──
  UK_LONDON:             { label: "London UK",             country: "UK", currency: "GBP", bbox: "51.28,-0.51,51.69,0.33"   },
  UK_BIRMINGHAM:         { label: "Birmingham UK",         country: "UK", currency: "GBP", bbox: "52.38,-2.05,52.57,-1.75"  },
  UK_MANCHESTER:         { label: "Manchester UK",         country: "UK", currency: "GBP", bbox: "53.41,-2.36,53.55,-2.10"  },
  UK_LEEDS:              { label: "Leeds UK",              country: "UK", currency: "GBP", bbox: "53.74,-1.64,53.87,-1.51"  },
  UK_BRISTOL:            { label: "Bristol UK",            country: "UK", currency: "GBP", bbox: "51.41,-2.67,51.54,-2.52"  },

  // ── Caribbean (full sweep — high priority for regional relationships) ──
  TT_PORT_OF_SPAIN:      { label: "Port of Spain TT",     country: "TT", currency: "USD", bbox: "10.58,-61.58,10.72,-61.47" },
  TT_SAN_FERNANDO:       { label: "San Fernando TT",      country: "TT", currency: "USD", bbox: "10.26,-61.47,10.32,-61.44" },
  BB_BRIDGETOWN:         { label: "Bridgetown BB",         country: "BB", currency: "USD", bbox: "13.04,-59.64,13.14,-59.57" },
  BB_WARRENS:            { label: "Warrens Barbados",      country: "BB", currency: "USD", bbox: "13.12,-59.63,13.17,-59.58" },
  BS_NASSAU:             { label: "Nassau Bahamas",        country: "BS", currency: "USD", bbox: "25.03,-77.42,25.10,-77.33" },
  KY_GEORGE_TOWN:        { label: "George Town Cayman",   country: "KY", currency: "USD", bbox: "19.27,-81.41,19.32,-81.36" },
  LC_CASTRIES:           { label: "Castries St Lucia",     country: "LC", currency: "USD", bbox: "13.97,-61.02,14.04,-60.97" },
  VC_KINGSTOWN:          { label: "Kingstown St Vincent",  country: "VC", currency: "USD", bbox: "13.13,-61.24,13.19,-61.19" },
  GD_ST_GEORGE:          { label: "St George Grenada",     country: "GD", currency: "USD", bbox: "12.03,-61.77,12.08,-61.72" },
  AG_ST_JOHN:            { label: "St John Antigua",       country: "AG", currency: "USD", bbox: "17.11,-61.87,17.16,-61.83" },
  DM_ROSEAU:             { label: "Roseau Dominica",       country: "DM", currency: "USD", bbox: "15.28,-61.40,15.32,-61.37" },
  KN_BASSETERRE:         { label: "Basseterre St Kitts",   country: "KN", currency: "USD", bbox: "17.28,-62.73,17.32,-62.70" },
  GY_GEORGETOWN:         { label: "Georgetown Guyana",     country: "GY", currency: "USD", bbox: "6.78,-58.18,6.84,-58.14"   },
  SR_PARAMARIBO:         { label: "Paramaribo Suriname",   country: "SR", currency: "USD", bbox: "5.82,-55.21,5.88,-55.14"   },
  HT_PORT_AU_PRINCE:     { label: "Port-au-Prince Haiti",  country: "HT", currency: "USD", bbox: "18.51,-72.37,18.57,-72.31" },
  DO_SANTO_DOMINGO:      { label: "Santo Domingo DR",      country: "DO", currency: "USD", bbox: "18.45,-69.98,18.53,-69.85" },
  JM_KINGSTON:           { label: "Kingston Jamaica OSM",  country: "JM", currency: "USD", bbox: "17.92,-76.87,18.02,-76.74" },

  // ── Australia (later — timezone + marketing rules; low priority) ──
  AU_SYDNEY:             { label: "Sydney AU",             country: "AU", currency: "AUD", bbox: "-33.92,151.00,-33.79,151.26" },
  AU_MELBOURNE:          { label: "Melbourne AU",          country: "AU", currency: "AUD", bbox: "-37.89,144.89,-37.76,145.03" },
};

// ECD countries: Eastern Caribbean island nations — quote in EC$
// ECD is pegged: EC$2.70 = US$1.00
const ECD_COUNTRIES  = new Set(["LC","VC","GD","AG","DM","KN"]);
// Other Caribbean: quote in USD at local rate (TT, BB, BS, KY, HT, DO, GY, SR, JM)
const CARIB_COUNTRIES = new Set(["TT","BB","BS","KY","HT","DO","GY","SR","JM"]);

// Pricing resolver: ECD for island nations, USD-local for rest of Caribbean, full USD for intl
function price(country: string, ecd: string, carib_usd: string, international: string): string {
  if (ECD_COUNTRIES.has(country))  return ecd;
  if (CARIB_COUNTRIES.has(country)) return carib_usd;
  return international;
}

// product_no_site = pitch when they have NO website (same pattern as local scraper)
// product_has_site = upsell pitched AFTER closing the website build (recurring revenue)
// tier: 1=high-volume low-ticket (beauty/food/trades), 2=professional services, 3=AI-bot ready (RE/dealers)
const INTL_CATEGORIES: Record<string, { tags: string[]; product_no_site: string; product_has_site: string; tier: 1 | 2 | 3 }> = {
  // ── Beauty & Wellness ──────────────────────────────────────────────────────
  hair_salon:         { tags: ["amenity=hairdresser", "shop=hairdresser"],          tier: 1, product_no_site: "Website + Booking from US$650 — gallery, online booking, contact form",                                          product_has_site: "GlowDesk US$35/mo — add online booking + loyalty points to your existing site" },
  nail_salon:         { tags: ["amenity=beauty_salon", "shop=nail_salon"],          tier: 1, product_no_site: "Website + Booking from US$650 — gallery, online booking, contact form",                                          product_has_site: "GlowDesk US$35/mo — add online booking + loyalty points to your existing site" },
  barbershop:         { tags: ["amenity=barber", "shop=barber"],                    tier: 1, product_no_site: "Website + Booking from US$650 — booking, hours, location, mobile-ready",                                         product_has_site: "GlowDesk US$35/mo — add online booking + loyalty to your existing site" },
  spa:                { tags: ["leisure=spa", "amenity=spa"],                       tier: 1, product_no_site: "Website + Booking from US$800 — gallery, services menu, online booking",                                         product_has_site: "Marketing Starter US$300/mo — IG/FB content + ads to fill your bookings every week" },
  tattoo_studio:      { tags: ["shop=tattoo"],                                      tier: 1, product_no_site: "Portfolio Website from US$650 — portfolio, pricing, booking form",                                               product_has_site: "Marketing Starter US$300/mo — IG reels + ads to drive new clients" },
  massage_therapy:    { tags: ["amenity=massage"],                                  tier: 1, product_no_site: "Website + Booking from US$650 — gallery, services, online booking",                                              product_has_site: "GlowDesk US$35/mo — add online booking + loyalty program" },
  cosmetics_store:    { tags: ["shop=cosmetics", "shop=beauty"],                    tier: 1, product_no_site: "E-commerce Website from US$650 — online store, product pages, payment ready",                                    product_has_site: "Marketing Starter US$300/mo — IG/FB product content + ads to drive online sales" },
  tanning_salon:      { tags: ["leisure=tanning_salon"],                            tier: 1, product_no_site: "Website + Booking from US$650 — services, booking, contact form",                                               product_has_site: "GlowDesk US$35/mo — add online booking + loyalty program" },
  eyebrow_threading:  { tags: ["shop=beauty", "amenity=beauty_salon"],              tier: 1, product_no_site: "Website + Booking from US$650 — services, pricing, online booking",                                              product_has_site: "GlowDesk US$35/mo — add online booking + loyalty program" },

  // ── Food & Hospitality ──────────────────────────────────────────────────────
  restaurant:         { tags: ["amenity=restaurant", "amenity=fast_food"],          tier: 1, product_no_site: "Website + Digital Menu from US$650 — digital menu, online orders, contact form",                                 product_has_site: "TableFlow US$69/mo — add online reservations + delivery orders to your existing site" },
  bakery:             { tags: ["shop=bakery"],                                      tier: 1, product_no_site: "Website + Pre-Order from US$650 — pre-order system, product gallery, contact form",                              product_has_site: "Marketing Starter US$300/mo — daily IG content + ads to drive foot traffic" },
  catering:           { tags: ["amenity=catering"],                                 tier: 2, product_no_site: "Website + Quote Form from US$800 — event gallery, quote request form, contact",                                  product_has_site: "AI Sales Bot US$50/mo — follows up every enquiry automatically so you never miss a booking" },
  hotel_guesthouse:   { tags: ["tourism=hotel", "tourism=guest_house"],             tier: 2, product_no_site: "Booking Website from US$800 — room listings, direct booking, no OTA commission fees",                            product_has_site: "Marketing Starter US$300/mo — IG/FB content + Google ads to drive direct bookings and cut commission fees" },
  cafe:               { tags: ["amenity=cafe"],                                     tier: 1, product_no_site: "Website + Menu from US$650 — menu, hours, location, contact form",                                               product_has_site: "Marketing Starter US$300/mo — daily IG content + local ads to drive foot traffic" },
  bar_nightclub:      { tags: ["amenity=bar", "amenity=nightclub"],                 tier: 1, product_no_site: "Website + Events from US$650 — events calendar, gallery, contact form",                                         product_has_site: "Marketing Starter US$300/mo — weekly IG reels + event ads" },
  food_truck:         { tags: ["amenity=food_court", "amenity=fast_food"],          tier: 1, product_no_site: "Website + Menu from US$650 — menu, schedule/location, contact form",                                             product_has_site: "Marketing Starter US$300/mo — IG content + location posts to build daily following" },
  ice_cream:          { tags: ["shop=ice_cream", "amenity=ice_cream"],              tier: 1, product_no_site: "Website + Menu from US$650 — menu, gallery, location, contact",                                                  product_has_site: "Marketing Starter US$300/mo — IG reels + seasonal ads" },
  juice_bar:          { tags: ["amenity=juice_bar", "shop=health_food"],            tier: 1, product_no_site: "Website + Menu from US$650 — menu, health/wellness content, contact",                                            product_has_site: "Marketing Starter US$300/mo — daily IG content + health/wellness ads" },

  // ── Automotive ──────────────────────────────────────────────────────────────
  auto_repair:        { tags: ["shop=car_repair"],                                  tier: 1, product_no_site: "Website + Booking from US$650 — services, booking form, location",                                               product_has_site: "Marketing Starter US$300/mo — Google/FB ads to capture local service searches 24/7" },
  car_detailing:      { tags: ["amenity=car_wash", "shop=car_wash"],                tier: 1, product_no_site: "Website + Gallery from US$650 — before/after gallery, booking form, pricing",                                    product_has_site: "Marketing Starter US$300/mo — before/after IG reels + ads to fill weekly slots" },
  car_dealership:     { tags: ["shop=car", "shop=car_dealer"],                      tier: 3, product_no_site: "Inventory Website from US$1,000 — vehicle inventory, contact form, financing enquiry form",                      product_has_site: "AI Sales Bot US$50/mo — calls your leads, qualifies buyers + Marketing Starter for inventory ads" },
  auto_parts:         { tags: ["shop=car_parts", "shop=tyres"],                     tier: 1, product_no_site: "Website + Parts Search from US$800 — parts catalogue, quote form, contact",                                      product_has_site: "Marketing Starter US$300/mo — Google/FB ads for local parts searches" },
  motorcycle_repair:  { tags: ["shop=motorcycle_repair", "shop=motorcycle"],        tier: 1, product_no_site: "Website + Booking from US$650 — services, booking, location",                                                    product_has_site: "Marketing Starter US$300/mo — IG content + local Google ads" },
  towing_service:     { tags: ["amenity=vehicle_inspection", "craft=car_repair"],   tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency call form, services, location",                                 product_has_site: "Marketing Starter US$300/mo — Google ads to rank for emergency towing searches" },

  // ── Retail & Fashion ────────────────────────────────────────────────────────
  clothing_boutique:  { tags: ["shop=clothes", "shop=fashion"],                     tier: 1, product_no_site: "E-commerce Website from US$1,000 — online store, product pages, payment ready",                                  product_has_site: "Marketing Starter US$300/mo — IG/FB fashion content + ads to drive online and in-store sales" },
  jewellery_store:    { tags: ["shop=jewelry", "shop=jewellery"],                   tier: 1, product_no_site: "E-commerce Website from US$1,000 — product pages, online store, payment ready",                                  product_has_site: "Marketing Starter US$300/mo — IG product shoots + ads for gifting seasons" },
  electronics_store:  { tags: ["shop=electronics", "shop=mobile_phone"],            tier: 1, product_no_site: "E-commerce Website from US$1,000 — product catalogue, online store, payment ready",                              product_has_site: "Marketing Starter US$300/mo — Google/FB ads targeting local buyers" },
  convenience_store:  { tags: ["shop=convenience", "shop=general"],                 tier: 1, product_no_site: "Website + Deals Page from US$650 — weekly deals, location, contact",                                             product_has_site: "Marketing Starter US$300/mo — weekly deals posts + local ads" },
  supermarket:        { tags: ["shop=supermarket"],                                 tier: 1, product_no_site: "Website + Weekly Deals from US$800 — deals page, location, contact form",                                        product_has_site: "Marketing Starter US$300/mo — weekly specials content + local Google/FB ads" },
  pharmacy:           { tags: ["amenity=pharmacy"],                                 tier: 1, product_no_site: "Website + Refill Form from US$650 — hours, location, prescription refill form",                                  product_has_site: "Marketing Starter US$300/mo — Google/FB ads for local health searches" },
  furniture_store:    { tags: ["shop=furniture"],                                   tier: 1, product_no_site: "E-commerce Website from US$1,000 — product catalogue, online store, payment ready",                              product_has_site: "Marketing Starter US$300/mo — IG room styling content + FB ads" },
  sports_store:       { tags: ["shop=sports", "shop=outdoor"],                      tier: 1, product_no_site: "E-commerce Website from US$800 — product catalogue, online store, payment ready",                                product_has_site: "Marketing Starter US$300/mo — IG lifestyle content + seasonal ads" },
  gift_shop:          { tags: ["shop=gift", "shop=souvenir"],                       tier: 1, product_no_site: "E-commerce Website from US$650 — product pages, online store, contact form",                                     product_has_site: "Marketing Starter US$300/mo — IG product content + holiday/gifting ads" },
  bookstore:          { tags: ["shop=books"],                                       tier: 1, product_no_site: "E-commerce Website from US$650 — catalogue, online store, contact form",                                         product_has_site: "Marketing Starter US$300/mo — IG reading content + local community ads" },
  hardware_store:     { tags: ["shop=hardware", "shop=doityourself"],               tier: 1, product_no_site: "Website + Deals Page from US$800 — product catalogue, deals, contact form",                                      product_has_site: "Marketing Starter US$300/mo — Google/FB ads for DIY and trade searches" },
  pet_store:          { tags: ["shop=pet", "shop=agrarian"],                        tier: 1, product_no_site: "E-commerce Website from US$650 — product pages, online store, contact",                                          product_has_site: "Marketing Starter US$300/mo — IG pet content + local ads" },

  // ── Professional Services ────────────────────────────────────────────────────
  lawyer:             { tags: ["office=lawyer", "office=notary"],                   tier: 2, product_no_site: "Website + Client Portal from US$800 — includes a secure login where clients track their case, upload documents, and message you directly", product_has_site: "AI Sales Bot US$50/mo — handles new client intake calls 24/7, books consultations automatically" },
  accountant:         { tags: ["office=accountant"],                                tier: 2, product_no_site: "Website + Client Portal from US$800 — includes a secure login where clients upload documents, view reports, and message you directly",      product_has_site: "Marketing Starter US$300/mo — LinkedIn/Google visibility ads + AI Bot for new client enquiries" },
  dentist:            { tags: ["amenity=dentist"],                                  tier: 2, product_no_site: "Website + Booking from US$800 — patient booking, services, before/after gallery",                                product_has_site: "Marketing Starter US$300/mo — Google ads for new patients + AI Bot to answer appointment questions" },
  doctor_clinic:      { tags: ["amenity=doctors", "amenity=clinic"],                tier: 2, product_no_site: "Website + Booking from US$800 — patient booking, services, contact form",                                        product_has_site: "AI Sales Bot US$50/mo — answers patient enquiries and books appointments automatically" },
  optician:           { tags: ["amenity=optician", "shop=optician"],                tier: 2, product_no_site: "Website + Booking from US$650 — services, booking, gallery",                                                     product_has_site: "Marketing Starter US$300/mo — Google/FB ads for eye exams and eyewear" },
  insurance_office:   { tags: ["office=insurance"],                                 tier: 3, product_no_site: "Website + Quote Form from US$800 — services, quote form, contact",                                               product_has_site: "AI Sales Bot US$50/mo — calls every quote request within 60 seconds, closes before they shop around" },
  mortgage_broker:    { tags: ["office=financial_advisor", "office=mortgage"],      tier: 3, product_no_site: "Website + Calculator from US$800 — mortgage calculator, quote form, contact",                                    product_has_site: "AI Sales Bot US$50/mo — follows up every mortgage enquiry automatically, books consultations" },
  real_estate_agent:  { tags: ["office=estate_agent"],                              tier: 3, product_no_site: "Website + AI Sales Bot from US$800 — property listings, contact form + AI Sales Bot add-on",                    product_has_site: "AI Sales Bot US$50/mo — calls your leads automatically, qualifies buyers and sellers 24/7" },
  property_manager:   { tags: ["office=property_management"],                       tier: 2, product_no_site: "Website + Tenant Portal from US$1,000 — property listings, tenant portal, contact",                              product_has_site: "AI Sales Bot US$50/mo — handles tenant enquiries and maintenance requests automatically" },
  recruitment_agency: { tags: ["office=employment_agency"],                         tier: 2, product_no_site: "Website + Job Board from US$800 — job listings, application form, contact",                                      product_has_site: "AI Sales Bot US$50/mo — screens candidates and books employer calls automatically" },
  tax_preparer:       { tags: ["office=tax_advisor", "office=accountant"],          tier: 2, product_no_site: "Website + Client Portal from US$800 — tax services, client portal, contact",                                     product_has_site: "Marketing Starter US$300/mo — Google/FB ads targeting tax season searches" },
  architect:          { tags: ["office=architect"],                                 tier: 2, product_no_site: "Portfolio Website from US$800 — project portfolio, services, contact form",                                      product_has_site: "Marketing Starter US$300/mo — IG project showcases + LinkedIn/Google ads" },
  marketing_agency:   { tags: ["office=advertising_agency", "office=company"],      tier: 2, product_no_site: "Website + Case Studies from US$800 — case studies, services, contact form",                                      product_has_site: "AI Sales Bot US$50/mo — follows up every inbound lead automatically" },
  it_services:        { tags: ["office=it"],                                        tier: 2, product_no_site: "Website + Client Portal from US$800 — services, client portal, contact form",                                    product_has_site: "AI Sales Bot US$50/mo — handles new client enquiries and books discovery calls 24/7" },

  // ── Health & Fitness ────────────────────────────────────────────────────────
  gym:                { tags: ["leisure=fitness_centre", "amenity=gym"],            tier: 2, product_no_site: "Website + Class Booking from US$800 — class schedule, membership sign-up, online booking",                       product_has_site: "Marketing Starter US$300/mo — IG/FB fitness content + membership ads to fill your floor" },
  physiotherapy:      { tags: ["amenity=physiotherapist"],                          tier: 2, product_no_site: "Website + Booking from US$800 — services, patient booking, gallery",                                             product_has_site: "Marketing Starter US$300/mo — Google/FB ads for injury recovery and physio searches" },
  mental_health:      { tags: ["amenity=counselling", "amenity=psychologist"],      tier: 2, product_no_site: "Website + Booking from US$800 — services, patient booking, contact form",                                        product_has_site: "Marketing Starter US$300/mo — Google/FB ads targeting therapy and counselling searches" },
  veterinary:         { tags: ["amenity=veterinary"],                               tier: 2, product_no_site: "Website + Booking from US$800 — services, pet booking, gallery",                                                 product_has_site: "Marketing Starter US$300/mo — IG pet content + local Google/FB ads for vet searches" },
  yoga_studio:        { tags: ["sport=yoga", "leisure=yoga"],                       tier: 2, product_no_site: "Website + Class Booking from US$800 — class schedule, booking, gallery",                                         product_has_site: "Marketing Starter US$300/mo — IG wellness content + class ads" },
  pilates_studio:     { tags: ["sport=pilates", "leisure=fitness_centre"],          tier: 2, product_no_site: "Website + Class Booking from US$800 — class schedule, booking, gallery",                                         product_has_site: "Marketing Starter US$300/mo — IG content + class ads to fill your schedule" },
  martial_arts:       { tags: ["sport=martial_arts", "leisure=sports_centre"],      tier: 1, product_no_site: "Website + Class Booking from US$650 — class schedule, booking, gallery",                                         product_has_site: "Marketing Starter US$300/mo — IG training content + local ads" },
  nutritionist:       { tags: ["amenity=dietitian", "amenity=nutritionist"],        tier: 2, product_no_site: "Website + Booking from US$800 — services, booking, contact form",                                               product_has_site: "Marketing Starter US$300/mo — IG health content + Google/FB ads" },

  // ── Trades & Home Services ────────────────────────────────────────────────────
  plumber:            { tags: ["craft=plumber", "shop=plumber"],                    tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency call form, services, location",                                 product_has_site: "Marketing Starter US$300/mo — Google ads to rank for emergency plumber searches 24/7" },
  electrician:        { tags: ["craft=electrician", "shop=electrician"],            tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency call form, services, location",                                 product_has_site: "Marketing Starter US$300/mo — Google ads to rank for emergency electrician searches 24/7" },
  construction:       { tags: ["craft=construction", "office=construction"],        tier: 2, product_no_site: "Website + Portfolio from US$800 — project portfolio, services, quote form",                                      product_has_site: "Marketing Starter US$300/mo — IG project portfolio content + Google/FB ads" },
  roofing:            { tags: ["craft=roofer"],                                     tier: 1, product_no_site: "Website + Quote Form from US$650 — services, quote form, location",                                              product_has_site: "Marketing Starter US$300/mo — Google/FB ads for roofing leads + AI Bot follow-up" },
  landscaping:        { tags: ["craft=gardener", "shop=gardener"],                  tier: 1, product_no_site: "Website + Gallery from US$650 — before/after gallery, services, quote form",                                    product_has_site: "Marketing Starter US$300/mo — IG before/after content + seasonal ads" },
  cleaning_service:   { tags: ["craft=cleaning"],                                   tier: 1, product_no_site: "Website + Booking from US$650 — services, booking form, location",                                               product_has_site: "Marketing Starter US$300/mo — Google/FB ads for recurring cleaning contracts" },
  moving_company:     { tags: ["amenity=moving_company"],                           tier: 1, product_no_site: "Website + Quote Form from US$650 — services, quote form, contact",                                               product_has_site: "AI Sales Bot US$50/mo — calls every quote request same day, books jobs before they go elsewhere" },
  pest_control:       { tags: ["craft=pest_control"],                               tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency form, services, location",                                      product_has_site: "Marketing Starter US$300/mo — Google ads for emergency pest control searches" },
  hvac_service:       { tags: ["craft=hvac"],                                       tier: 1, product_no_site: "Website + Emergency Form from US$650 — emergency form, services, location",                                      product_has_site: "Marketing Starter US$300/mo — Google ads for HVAC emergency + seasonal service searches" },
  solar_installer:    { tags: ["shop=solar_panels", "craft=solar"],                 tier: 3, product_no_site: "Website + Calculator from US$800 — solar calculator, gallery, quote form",                                      product_has_site: "AI Sales Bot US$50/mo — follows up every solar enquiry automatically, qualifies homeowners" },
  pool_service:       { tags: ["sport=swimming", "leisure=swimming_pool"],          tier: 1, product_no_site: "Website + Booking from US$650 — services, booking, gallery",                                                     product_has_site: "Marketing Starter US$300/mo — IG pool content + local ads for maintenance contracts" },
  security_company:   { tags: ["office=security", "craft=security_alarm"],         tier: 2, product_no_site: "Website + Quote Form from US$800 — services, quote form, contact",                                               product_has_site: "AI Sales Bot US$50/mo — calls every security enquiry within 60 seconds" },
  home_renovation:    { tags: ["craft=builder", "craft=renovation"],                tier: 2, product_no_site: "Website + Portfolio from US$800 — project portfolio, services, quote form",                                      product_has_site: "Marketing Starter US$300/mo — IG renovation portfolio content + Google/FB ads" },
  painting_service:   { tags: ["craft=painter"],                                    tier: 1, product_no_site: "Website + Quote Form from US$650 — before/after gallery, quote form, contact",                                   product_has_site: "Marketing Starter US$300/mo — IG before/after content + local ads for painting jobs" },

  // ── Education & Community ──────────────────────────────────────────────────
  school_college:     { tags: ["amenity=school", "amenity=college"],                tier: 2, product_no_site: "School Website + Enrolment from US$800 — enrolment form, staff page, calendar",                                  product_has_site: "Marketing Starter US$300/mo — FB/Google ads for enrolment season" },
  driving_school:     { tags: ["amenity=driving_school"],                           tier: 1, product_no_site: "Website + Booking from US$650 — slot booking, pricing, contact form",                                            product_has_site: "Marketing Starter US$300/mo — Google/FB ads targeting new drivers" },
  tutoring_center:    { tags: ["amenity=tutoring_centre", "office=tutoring"],       tier: 1, product_no_site: "Website + Booking from US$650 — subjects, booking, contact form",                                                product_has_site: "Marketing Starter US$300/mo — FB ads targeting parents + exam season campaigns" },
  church:             { tags: ["amenity=place_of_worship"],                         tier: 1, product_no_site: "Website + Events from US$650 — events calendar, sermons, contact form",                                          product_has_site: "Marketing Starter US$300/mo — weekly IG/FB sermon clips + community event posts" },
  music_school:       { tags: ["amenity=music_school", "shop=musical_instrument"],  tier: 1, product_no_site: "Website + Booking from US$650 — lessons, booking, gallery",                                                      product_has_site: "Marketing Starter US$300/mo — IG student progress content + enrolment ads" },
  dance_studio:       { tags: ["sport=dancing", "leisure=dance"],                   tier: 1, product_no_site: "Website + Class Booking from US$650 — class schedule, booking, gallery",                                         product_has_site: "Marketing Starter US$300/mo — IG performance clips + class enrolment ads" },
  daycare:            { tags: ["amenity=childcare", "amenity=nursery"],             tier: 1, product_no_site: "Website + Enrolment Form from US$650 — services, enrolment form, gallery",                                       product_has_site: "Marketing Starter US$300/mo — FB ads targeting local parents" },
  language_school:    { tags: ["amenity=language_school", "office=language_school"],tier: 2, product_no_site: "Website + Booking from US$650 — courses, booking, gallery",                                                      product_has_site: "Marketing Starter US$300/mo — FB/Google ads targeting language learners" },

  // ── Travel ─────────────────────────────────────────────────────────────────
  tour_operator:      { tags: ["tourism=information", "shop=travel"],               tier: 2, product_no_site: "Tour Site + Booking from US$800 — tour listings, direct booking, itinerary pages",                               product_has_site: "Marketing Starter US$300/mo — IG tour content + Google/FB ads to drive direct bookings" },
  car_rental:         { tags: ["amenity=car_rental"],                               tier: 2, product_no_site: "Website + Booking from US$800 — fleet listing, booking, contact form",                                           product_has_site: "Marketing Starter US$300/mo — Google ads to capture rental searches + AI Bot for enquiries" },
  boat_charter:       { tags: ["amenity=boat_rental", "leisure=marina"],            tier: 2, product_no_site: "Website + Booking from US$800 — charter listings, booking, gallery",                                             product_has_site: "Marketing Starter US$300/mo — IG charter content + seasonal ads" },
  villa_rental:       { tags: ["tourism=chalet", "tourism=apartment"],              tier: 2, product_no_site: "Booking Website from US$1,000 — room listings, direct booking, no Airbnb commission fees",                       product_has_site: "Marketing Starter US$300/mo — IG property content + Google/FB ads to drive direct bookings" },
  travel_agency:      { tags: ["shop=travel_agency"],                               tier: 2, product_no_site: "Website + Booking from US$800 — packages, booking, contact form",                                                product_has_site: "Marketing Starter US$300/mo — IG travel content + destination ads" },

  // ── Other ──────────────────────────────────────────────────────────────────
  funeral_home:       { tags: ["amenity=funeral_hall", "shop=funeral"],             tier: 2, product_no_site: "Professional Website from US$800 — services, gallery, contact form",                                             product_has_site: "Marketing Starter US$300/mo — Google/FB visibility ads for local searches" },
  photography_studio: { tags: ["shop=photography", "craft=photographer"],           tier: 1, product_no_site: "Portfolio Website from US$650 — portfolio, pricing, booking form",                                               product_has_site: "Marketing Starter US$300/mo — IG portfolio content + Google/FB ads for events and portraits" },
  event_venue:        { tags: ["amenity=events_venue", "leisure=event_venue"],      tier: 2, product_no_site: "Website + Events from US$800 — venue gallery, availability, contact form",                                       product_has_site: "Marketing Starter US$300/mo — IG event content + FB/Google ads targeting event planners" },
  printing_shop:      { tags: ["shop=printing", "craft=printmaker"],                tier: 1, product_no_site: "Website + Quote Form from US$650 — services, quote form, contact",                                               product_has_site: "Marketing Starter US$300/mo — Google/FB ads for print and design services" },
  laundry:            { tags: ["shop=laundry", "amenity=laundry"],                  tier: 1, product_no_site: "Website + Booking from US$650 — services, pickup/delivery booking, contact",                                    product_has_site: "Marketing Starter US$300/mo — local Google/FB ads for pickup and delivery service" },
  storage_facility:   { tags: ["shop=storage_rental"],                              tier: 1, product_no_site: "Website + Quote Form from US$650 — unit sizes, pricing, quote form",                                             product_has_site: "Marketing Starter US$300/mo — Google/FB ads for local storage searches" },
  courier_logistics:  { tags: ["amenity=post_depot", "office=logistics"],           tier: 2, product_no_site: "Website + Tracking Portal from US$800 — services, tracking portal, quote form",                                  product_has_site: "AI Sales Bot US$50/mo — handles shipping enquiries and quotes automatically" },
};

interface OsmElement { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string>; }

const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // VK Maps - no rate limit
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function queryOverpass(osmTag: string, bbox: string): Promise<OsmElement[]> {
  const [key, val] = osmTag.split("=");
  const q = `[out:json][timeout:30];(node["${key}"="${val}"](${bbox});way["${key}"="${val}"](${bbox}););out center tags;`;
  for (const mirror of MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "JST-SalesBot/1.0" },
        body: `data=${encodeURIComponent(q)}`,
      });
      if (res.status === 429 || res.status === 406) {
        console.log(`  [${mirror.split("/")[2]}] ${res.status} -- waiting 30s`);
        await sleep(30000);
        // retry same mirror once
        const r2 = await fetch(mirror, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "JST-SalesBot/1.0" }, body: `data=${encodeURIComponent(q)}` });
        if (!r2.ok) { console.log(`  [${mirror.split("/")[2]}] ${r2.status} after retry -- trying next`); continue; }
        const data2 = await r2.json() as { elements: OsmElement[] };
        return data2.elements ?? [];
      }
      if (!res.ok) { console.log(`  [${mirror.split("/")[2]}] ${res.status} -- trying next`); continue; }
      const data = await res.json() as { elements: OsmElement[] };
      return data.elements ?? [];
    } catch { continue; }
  }
  return [];
}

// Major chains that always have corporate websites — not JST prospects
const CHAIN_BLOCKLIST = [
  "mcdonald","subway","kfc","burger king","domino's","pizza hut","wendy's","starbucks",
  "dunkin","tim hortons","popeyes","chick-fil-a","shake shack","five guys","chipotle",
  "häagen-dazs","haagen-dazs","baskin-robbins","dairy queen","cold stone","krispy kreme",
  "burgerfi","salt & straw","salt and straw","taco bell","papa john",
  "walmart","costco","target","home depot","lowe's","cvs","walgreens","rite aid",
  "h&m","zara","gap","banana republic","coach","louis vuitton","gucci","nike","adidas",
  "marriott","hilton","hyatt","holiday inn","best western","sheraton","westin","radisson",
  "hampton inn","courtyard","residence inn","comfort inn","doubletree","ibis",
  "enterprise rent","hertz","avis","budget rent","dollar rent",
  "chase bank","bank of america","wells fargo","td bank","citibank","scotiabank","rbtt",
  "super pharm","boots pharmacy","walgreen",
];
function isKnownChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_BLOCKLIST.some(c => lower.includes(c));
}

function getPhone(tags: Record<string, string>) {
  return tags.phone || tags["contact:phone"] || tags.mobile || tags["contact:mobile"] || "";
}
function getWebsite(tags: Record<string, string>) {
  return !!(tags.website || tags["contact:website"] || tags.url);
}

async function upsertLead(row: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sales_leads`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  return res.ok || res.status === 409;
}

async function scrapeMarket(marketKey: string, limitPerCat = 40) {
  const m = INTL_MARKETS[marketKey];
  if (!m) { console.error("Unknown market:", marketKey); return 0; }
  console.log(`\n=== ${m.label} (${m.country}) ===`);
  let total = 0;
  for (const [cat, cfg] of Object.entries(INTL_CATEGORIES)) {
    let n = 0;
    for (const tag of cfg.tags) {
      if (n >= limitPerCat) break;
      const els = await queryOverpass(tag, m.bbox);
      await sleep(1500);
      for (const el of els) {
        if (n >= limitPerCat) break;
        const t = el.tags ?? {};
        const ph = getPhone(t);
        if (!ph) continue;
        if (getWebsite(t)) continue; // already has a website — not a prospect
        const name = t.name || t["name:en"] || `[${cat}]`;
        if (isKnownChain(name)) continue; // major chain — always has a corporate website
        const addr = [t["addr:housenumber"], t["addr:street"], t["addr:city"] || m.label].filter(Boolean).join(" ") || m.label;
        const hasWebsite = getWebsite(t);
        const ok = await upsertLead({
          place_id: `osm:${el.id}`,
          business_name: name,
          phone: ph,
          address: addr,
          category: cat,
          recommended_product: hasWebsite ? cfg.product_has_site : cfg.product_no_site,
          has_website: hasWebsite,
          status: "new",
          market: marketKey,
          currency: m.currency,
          notes: `TIER:${cfg.tier} | INTL:${m.label} | LOC:${m.country}${hasWebsite ? " | HAS_WEBSITE" : ""}`,
        });
        if (ok) n++;
      }
    }
    if (n > 0) console.log(`  ${cat}: ${n}`);
    total += n;
  }
  console.log(`  TOTAL: ${total}`);
  return total;
}

export async function runAllIntlMarkets(limitPerCat = 40): Promise<number> {
  const markets = Object.keys(INTL_MARKETS);
  console.log(`[INTL] Scraping ${markets.length} markets, ${limitPerCat}/category`);
  let grand = 0;
  for (const m of markets) grand += await scrapeMarket(m, limitPerCat);
  console.log(`[INTL] Done. Total: ${grand} leads added`);
  return grand;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
  const marketArg = process.argv.find(a => a.startsWith("--market="))?.split("=")[1];
  const limitArg  = parseInt(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "40");
  const markets   = marketArg ? [marketArg] : Object.keys(INTL_MARKETS);
  console.log(`Scraping ${markets.length} market(s), limit ${limitArg}/category`);
  let grand = 0;
  for (const m of markets) grand += await scrapeMarket(m, limitArg);
  console.log(`\nDone. Total: ${grand} international leads added`);
}

if (require.main === module) main().catch(console.error);
