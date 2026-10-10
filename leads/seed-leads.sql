-- JST AI Sales Bot — Initial Lead Seeds
-- Run against: Supabase ibtadbwtrxglujkzqofs (sales_leads table)
-- These are placeholder records. Replace phone/name once scraper runs.
-- Status: 'new' = ready to call | Filter by TIER:1 for first batch

INSERT INTO sales_leads (business_name, phone, category, recommended_product, has_website, status, notes, address) VALUES

-- TIER 1: BEAUTY & PERSONAL CARE
('[SCRAPE] Nail Salon - Kingston', '000-PENDING', 'nail_salon', 'Website + Online Booking (J$25K)', false, 'new', 'TIER:1 | SCRAPE: nail salon Kingston Jamaica | Pitch: clients book at 2AM when they think of it | Script: nail_salon', 'Kingston, Jamaica'),
('[SCRAPE] Nail Salon - Montego Bay', '000-PENDING', 'nail_salon', 'Website + Online Booking (J$25K)', false, 'new', 'TIER:1 | SCRAPE: nail salon Montego Bay Jamaica | Script: nail_salon', 'Montego Bay, Jamaica'),
('[SCRAPE] Nail Salon - Portmore', '000-PENDING', 'nail_salon', 'Website + Online Booking (J$25K)', false, 'new', 'TIER:1 | SCRAPE: nail salon Portmore Jamaica | Script: nail_salon', 'Portmore, Jamaica'),
('[SCRAPE] Hair Salon - Kingston', '000-PENDING', 'hair_salon', 'Website + Gallery + Booking (J$25K)', false, 'new', 'TIER:1 | SCRAPE: hair salon Kingston Jamaica | Script: hair_salon', 'Kingston, Jamaica'),
('[SCRAPE] Hair Salon - Montego Bay', '000-PENDING', 'hair_salon', 'Website + Gallery + Booking (J$25K)', false, 'new', 'TIER:1 | SCRAPE: beauty salon Montego Bay Jamaica | Script: hair_salon', 'Montego Bay, Jamaica'),
('[SCRAPE] Barbershop - Kingston', '000-PENDING', 'barbershop', 'Website + Booking (J$20K)', false, 'new', 'TIER:1 | SCRAPE: barbershop Kingston Jamaica | Script: barbershop', 'Kingston, Jamaica'),
('[SCRAPE] Barbershop - Spanish Town', '000-PENDING', 'barbershop', 'Website + Booking (J$20K)', false, 'new', 'TIER:1 | SCRAPE: barber Spanish Town Jamaica | Script: barbershop', 'Spanish Town, Jamaica'),
('[SCRAPE] Lash/Brow Studio - Kingston', '000-PENDING', 'lash_studio', 'Website + Booking (J$20K)', false, 'new', 'TIER:1 | SCRAPE: lash studio Jamaica | Pitch: Instagram leads waste without booking page | Script: hair_salon', 'Kingston, Jamaica'),
('[SCRAPE] Spa/Massage - Kingston', '000-PENDING', 'spa', 'Spa Site + Booking (J$30K)', false, 'new', 'TIER:1 | SCRAPE: spa massage Kingston Jamaica | Script: hair_salon', 'Kingston, Jamaica'),
('[SCRAPE] Spa/Massage - Montego Bay', '000-PENDING', 'spa', 'Spa Site + Booking (J$30K)', false, 'new', 'TIER:1 | SCRAPE: spa Montego Bay Jamaica | Script: hair_salon', 'Montego Bay, Jamaica'),
('[SCRAPE] Tattoo Studio - Kingston', '000-PENDING', 'tattoo', 'Portfolio + Booking (J$25K)', false, 'new', 'TIER:1 | SCRAPE: tattoo Kingston Jamaica | Script: hair_salon', 'Kingston, Jamaica'),
('[SCRAPE] Makeup Artist - Kingston', '000-PENDING', 'makeup_artist', 'Portfolio + Bridal Booking (J$20K)', false, 'new', 'TIER:1 | SCRAPE: makeup artist Jamaica | Pitch: bride season bookings captured automatically | Script: hair_salon', 'Kingston, Jamaica'),

-- TIER 1: FOOD & BEVERAGE
('[SCRAPE] Restaurant - Kingston', '000-PENDING', 'restaurant', 'Website + Online Menu + Order Link (J$30K)', false, 'new', 'TIER:1 | SCRAPE: restaurant Kingston Jamaica | Script: restaurant', 'Kingston, Jamaica'),
('[SCRAPE] Restaurant - Montego Bay', '000-PENDING', 'restaurant', 'Website + Online Menu + Order Link (J$30K)', false, 'new', 'TIER:1 | SCRAPE: restaurant Montego Bay Jamaica | Script: restaurant', 'Montego Bay, Jamaica'),
('[SCRAPE] Restaurant - Ocho Rios', '000-PENDING', 'restaurant', 'Website + Online Menu + Order Link (J$30K)', false, 'new', 'TIER:1 | SCRAPE: local restaurant Ocho Rios Jamaica | Script: restaurant', 'Ocho Rios, Jamaica'),
('[SCRAPE] Bakery - Kingston', '000-PENDING', 'bakery', 'Website + Pre-Order System (J$20K)', false, 'new', 'TIER:1 | SCRAPE: bakery Kingston Jamaica | Pitch: pre-order system = know what to bake daily | Script: bakery', 'Kingston, Jamaica'),
('[SCRAPE] Catering Company - Kingston', '000-PENDING', 'catering', 'Website + Quote Form + Portfolio (J$35K)', false, 'new', 'TIER:1 | SCRAPE: catering company Kingston Jamaica | Script: catering', 'Kingston, Jamaica'),
('[SCRAPE] Catering Company - Montego Bay', '000-PENDING', 'catering', 'Website + Quote Form + Portfolio (J$35K)', false, 'new', 'TIER:1 | SCRAPE: catering Montego Bay Jamaica | Script: catering', 'Montego Bay, Jamaica'),
('[SCRAPE] Jerk/BBQ Spot - Kingston', '000-PENDING', 'jerk_restaurant', 'Website + Menu + Order (J$20K)', false, 'new', 'TIER:1 | SCRAPE: jerk chicken Kingston Jamaica | Pitch: tourist season needs a website | Script: restaurant', 'Kingston, Jamaica'),
('[SCRAPE] Jerk/BBQ Spot - Montego Bay', '000-PENDING', 'jerk_restaurant', 'Website + Menu + Order (J$20K)', false, 'new', 'TIER:1 | SCRAPE: jerk chicken Montego Bay Jamaica | Script: restaurant', 'Montego Bay, Jamaica'),

-- TIER 1: AUTO & TRADES
('[SCRAPE] Auto Repair - Kingston', '000-PENDING', 'auto_repair', 'Website + Booking + Google Listing (J$25K)', false, 'new', 'TIER:1 | SCRAPE: auto repair garage Kingston Jamaica | Pitch: booking system = no more full voicemail | Script: mechanic', 'Kingston, Jamaica'),
('[SCRAPE] Auto Repair - Montego Bay', '000-PENDING', 'auto_repair', 'Website + Booking + Google Listing (J$25K)', false, 'new', 'TIER:1 | SCRAPE: car mechanic Montego Bay Jamaica | Script: mechanic', 'Montego Bay, Jamaica'),
('[SCRAPE] Car Detailing - Kingston', '000-PENDING', 'car_detailing', 'Website + Gallery + Booking (J$20K)', false, 'new', 'TIER:1 | SCRAPE: car detailing Kingston Jamaica | Script: car_detailing', 'Kingston, Jamaica'),
('[SCRAPE] Tires/Rims Shop - Kingston', '000-PENDING', 'tires_rims', 'Website + Price List + Appointment (J$20K)', false, 'new', 'TIER:1 | SCRAPE: tires rims Kingston Jamaica | Script: mechanic', 'Kingston, Jamaica'),
('[SCRAPE] Panel Beater - Kingston', '000-PENDING', 'panel_beater', 'Website + Insurance Referral Page (J$25K)', false, 'new', 'TIER:1 | SCRAPE: panel beater Kingston Jamaica | Script: mechanic', 'Kingston, Jamaica'),
('[SCRAPE] Plumber - Kingston', '000-PENDING', 'plumber', 'Website + Emergency Call Form (J$20K)', false, 'new', 'TIER:1 | SCRAPE: plumber Kingston Jamaica | Script: trades', 'Kingston, Jamaica'),
('[SCRAPE] Electrician - Kingston', '000-PENDING', 'electrician', 'Website + Lead Capture + Reviews (J$20K)', false, 'new', 'TIER:1 | SCRAPE: electrician Kingston Jamaica | Script: trades', 'Kingston, Jamaica'),
('[SCRAPE] A/C Technician - Kingston', '000-PENDING', 'ac_tech', 'Website + Service Contract Page (J$25K)', false, 'new', 'TIER:1 | SCRAPE: AC technician Kingston Jamaica | Script: trades', 'Kingston, Jamaica'),
('[SCRAPE] Contractor - Kingston', '000-PENDING', 'contractor', 'Project Portfolio Site (J$35K)', false, 'new', 'TIER:1 | SCRAPE: contractor construction Kingston Jamaica | Pitch: portfolio = bigger jobs less lowballers | Script: trades', 'Kingston, Jamaica'),

-- TIER 1: RETAIL
('[SCRAPE] Clothing Boutique - Kingston', '000-PENDING', 'clothing_boutique', 'E-commerce Website (J$35K)', false, 'new', 'TIER:1 | SCRAPE: clothing boutique Kingston Jamaica | Pitch: Instagram store → real e-commerce = 3x orders | Script: clothing_boutique', 'Kingston, Jamaica'),
('[SCRAPE] Clothing Boutique - Montego Bay', '000-PENDING', 'clothing_boutique', 'E-commerce Website (J$35K)', false, 'new', 'TIER:1 | SCRAPE: fashion store Montego Bay Jamaica | Script: clothing_boutique', 'Montego Bay, Jamaica'),
('[SCRAPE] Beauty Supply - Kingston', '000-PENDING', 'beauty_supply', 'Product Catalog + WhatsApp Order (J$25K)', false, 'new', 'TIER:1 | SCRAPE: beauty supply Kingston Jamaica | Script: clothing_boutique', 'Kingston, Jamaica'),
('[SCRAPE] Phone Repair Shop - Kingston', '000-PENDING', 'phone_repair', 'Website + Price List + Wait Time (J$20K)', false, 'new', 'TIER:1 | SCRAPE: phone repair Kingston Jamaica | Script: trades', 'Kingston, Jamaica'),
('[SCRAPE] Pharmacy - Kingston', '000-PENDING', 'pharmacy', 'Website + Refill Form + Delivery (J$30K)', false, 'new', 'TIER:1 | SCRAPE: pharmacy Kingston Jamaica | Script: healthcare', 'Kingston, Jamaica'),
('[SCRAPE] Furniture Store - Kingston', '000-PENDING', 'furniture', 'Gallery + Quote Form (J$35K)', false, 'new', 'TIER:1 | SCRAPE: furniture store Kingston Jamaica | Script: clothing_boutique', 'Kingston, Jamaica'),

-- TIER 2: PROFESSIONAL SERVICES
('[SCRAPE] Real Estate Agent - Kingston', '000-PENDING', 'real_estate_agent', 'Property Site + CRM + AI Caller (J$50K)', false, 'new', 'TIER:2 | SCRAPE: real estate agent Kingston Jamaica | HIGH CONVERSION | Script: real_estate', 'Kingston, Jamaica'),
('[SCRAPE] Real Estate Agent - Montego Bay', '000-PENDING', 'real_estate_agent', 'Property Site + CRM + AI Caller (J$50K)', false, 'new', 'TIER:2 | SCRAPE: real estate broker Montego Bay Jamaica | Script: real_estate', 'Montego Bay, Jamaica'),
('[SCRAPE] Insurance Agent - Kingston', '000-PENDING', 'insurance_agent', 'Website + AI Sales Caller (J$45K)', false, 'new', 'TIER:2 | SCRAPE: insurance agent Kingston Jamaica | Script: insurance_sales', 'Kingston, Jamaica'),
('[SCRAPE] Accountant - Kingston', '000-PENDING', 'accountant', 'Client Portal + Website (J$40K)', false, 'new', 'TIER:2 | SCRAPE: accountant Kingston Jamaica | Seasonal pitch Jan-Apr | Script: professional_services', 'Kingston, Jamaica'),
('[SCRAPE] Dentist - Kingston', '000-PENDING', 'dentist', 'Website + Patient Booking (J$50K-J$80K)', false, 'new', 'TIER:2 | SCRAPE: dentist Kingston Jamaica | Ask about patient count | Script: healthcare', 'Kingston, Jamaica'),
('[SCRAPE] Dentist - Montego Bay', '000-PENDING', 'dentist', 'Website + Patient Booking (J$50K-J$80K)', false, 'new', 'TIER:2 | SCRAPE: dental clinic Montego Bay Jamaica | Script: healthcare', 'Montego Bay, Jamaica'),
('[SCRAPE] Lawyer/Attorney - Kingston', '000-PENDING', 'lawyer', 'Case Intake + Client Portal (J$60K)', false, 'new', 'TIER:2 | SCRAPE: lawyer attorney Kingston Jamaica | Ferguson Law = proof point | Script: professional_services', 'Kingston, Jamaica'),
('[SCRAPE] Financial Advisor - Kingston', '000-PENDING', 'financial_advisor', 'Client Portal + Portfolio Tracker (J$60K)', false, 'new', 'TIER:2 | SCRAPE: financial advisor Kingston Jamaica | Script: professional_services', 'Kingston, Jamaica'),

-- TIER 2: EDUCATION
('[SCRAPE] Tutoring Center - Kingston', '000-PENDING', 'tutoring', 'Student Enrollment + Scheduling (J$35K)', false, 'new', 'TIER:2 | SCRAPE: tutoring center Kingston Jamaica | Script: education', 'Kingston, Jamaica'),
('[SCRAPE] Music School - Kingston', '000-PENDING', 'music_school', 'Lesson Booking + Student Tracking (J$30K)', false, 'new', 'TIER:2 | SCRAPE: music school Jamaica | Script: education', 'Kingston, Jamaica'),
('[SCRAPE] Dance Studio - Kingston', '000-PENDING', 'dance_studio', 'Class Schedule + Registration (J$30K)', false, 'new', 'TIER:2 | SCRAPE: dance studio Kingston Jamaica | Script: education', 'Kingston, Jamaica'),
('[SCRAPE] Driving School - Kingston', '000-PENDING', 'driving_school', 'Slot Booking + Theory Test (J$25K)', false, 'new', 'TIER:2 | SCRAPE: driving school Kingston Jamaica | Script: education', 'Kingston, Jamaica'),

-- TIER 2: HEALTH & WELLNESS
('[SCRAPE] Gym - Kingston', '000-PENDING', 'gym', 'Website + Class Booking + Member Portal (J$40K)', false, 'new', 'TIER:2 | SCRAPE: gym Kingston Jamaica | Script: fitness', 'Kingston, Jamaica'),
('[SCRAPE] Personal Trainer - Kingston', '000-PENDING', 'personal_trainer', 'Packages + Booking + Progress Tracking (J$25K)', false, 'new', 'TIER:2 | SCRAPE: personal trainer Jamaica | Script: fitness', 'Kingston, Jamaica'),
('[SCRAPE] Optician - Kingston', '000-PENDING', 'optician', 'Eye Test Booking + Frame Gallery (J$35K)', false, 'new', 'TIER:2 | SCRAPE: optician Kingston Jamaica | Script: healthcare', 'Kingston, Jamaica'),

-- TIER 2: TOURISM (HIGH VALUE)
('[SCRAPE] Tour Operator - Montego Bay', '000-PENDING', 'tour_operator', 'Direct Booking Site (J$50K)', false, 'new', 'TIER:2 | SCRAPE: tour operator Montego Bay Jamaica | Pitch: direct booking = 0 commission | Script: tour_operator', 'Montego Bay, Jamaica'),
('[SCRAPE] Tour Operator - Ocho Rios', '000-PENDING', 'tour_operator', 'Direct Booking Site (J$50K)', false, 'new', 'TIER:2 | SCRAPE: tours activities Ocho Rios Jamaica | Script: tour_operator', 'Ocho Rios, Jamaica'),
('[SCRAPE] Tour Operator - Negril', '000-PENDING', 'tour_operator', 'Direct Booking Site (J$50K)', false, 'new', 'TIER:2 | SCRAPE: tour company Negril Jamaica | Script: tour_operator', 'Negril, Jamaica'),
('[SCRAPE] Airport Transfer - Montego Bay', '000-PENDING', 'transfer', 'Airport Transfer Booking Site (J$40K)', false, 'new', 'TIER:2 | SCRAPE: airport transfer Montego Bay Jamaica | Script: transfer', 'Montego Bay, Jamaica'),
('[SCRAPE] Guest House - Negril', '000-PENDING', 'guest_house', 'Direct Booking = 0% OTA Fees (J$50K)', false, 'new', 'TIER:2 | SCRAPE: guest house Negril Jamaica | Script: tour_operator', 'Negril, Jamaica'),
('[SCRAPE] Guest House - Port Antonio', '000-PENDING', 'guest_house', 'Direct Booking = 0% OTA Fees (J$50K)', false, 'new', 'TIER:2 | SCRAPE: guest house Port Antonio Jamaica | Script: tour_operator', 'Port Antonio, Jamaica'),
('[SCRAPE] Fishing Charter - Montego Bay', '000-PENDING', 'fishing_charter', 'Trip Booking + Gallery (J$40K)', false, 'new', 'TIER:2 | SCRAPE: fishing charter Montego Bay Jamaica | Script: tour_operator', 'Montego Bay, Jamaica'),

-- TIER 3: AI SALES BOT READY
('[SCRAPE] Insurance Company - Kingston', '000-PENDING', 'insurance_company', 'AI Sales Caller Bot (US$200-500/mo)', false, 'new', 'TIER:3 | SCRAPE: insurance company Kingston Jamaica | Pitch: bot handles 200 follow-ups/day | Script: insurance_sales', 'Kingston, Jamaica'),
('[SCRAPE] Solar Company - Kingston', '000-PENDING', 'solar', 'AI Residential Outreach Bot (US$300-500/mo)', false, 'new', 'TIER:3 | SCRAPE: solar energy company Jamaica | Pitch: AI books appointments humans close | Script: solar_sales', 'Kingston, Jamaica'),
('[SCRAPE] Car Dealership - Kingston', '000-PENDING', 'car_dealership', 'Inventory Site + AI Follow-up Caller (US$400+/mo)', false, 'new', 'TIER:3 | SCRAPE: car dealership Kingston Jamaica | Pitch: never miss a hot lead | Script: car_dealership', 'Kingston, Jamaica'),
('[SCRAPE] Car Dealership - Montego Bay', '000-PENDING', 'car_dealership', 'Inventory Site + AI Follow-up Caller (US$400+/mo)', false, 'new', 'TIER:3 | SCRAPE: used cars Montego Bay Jamaica | Script: car_dealership', 'Montego Bay, Jamaica'),
('[SCRAPE] Real Estate Firm - Kingston', '000-PENDING', 'real_estate_firm', 'AI Lead Follow-up Caller (US$300+/mo)', false, 'new', 'TIER:3 | SCRAPE: real estate firm Kingston Jamaica | Pitch: AI calls every lead within 5 min | Script: real_estate', 'Kingston, Jamaica'),
('[SCRAPE] Staffing Agency - Kingston', '000-PENDING', 'staffing', 'AI Candidate Screening Caller (US$200+/mo)', false, 'new', 'TIER:3 | SCRAPE: staffing agency Jamaica | Pitch: AI pre-screens before human interview | Script: insurance_sales', 'Kingston, Jamaica'),

-- TIER 4: SUPREME SUITE / SAAS
('[SCRAPE] Digital Marketing Agency - Kingston', '000-PENDING', 'digital_agency', 'Supreme Suite White-label (US$55/mo)', false, 'new', 'TIER:4 | SCRAPE: digital marketing agency Kingston Jamaica | Pitch: white-label entire JST stack for your clients | Script: saas_pitch', 'Kingston, Jamaica'),
('[SCRAPE] Web Design Company - Kingston', '000-PENDING', 'web_design', 'Supreme Suite White-label (US$55/mo)', false, 'new', 'TIER:4 | SCRAPE: web design company Jamaica | Script: saas_pitch', 'Kingston, Jamaica'),
('[SCRAPE] IT Consultant - Kingston', '000-PENDING', 'it_consultant', 'Supreme Suite Reseller (US$55/mo x clients)', false, 'new', 'TIER:4 | SCRAPE: IT consultant Kingston Jamaica | Pitch: suite for your client base | Script: saas_pitch', 'Kingston, Jamaica'),

-- INTERNATIONAL: CARIBBEAN
('[INTL] [SCRAPE] Nail Salon - Trinidad', '000-PENDING', 'nail_salon', 'Website + Booking (USD pricing)', false, 'new', 'TIER:1 | INTL:TT | SCRAPE: nail salon Trinidad Tobago | Script: nail_salon', 'Port of Spain, Trinidad'),
('[INTL] [SCRAPE] Restaurant - Barbados', '000-PENDING', 'restaurant', 'Website + Online Menu (USD pricing)', false, 'new', 'TIER:1 | INTL:BB | SCRAPE: restaurant Barbados | Script: restaurant', 'Bridgetown, Barbados'),
('[INTL] [SCRAPE] Tour Operator - Antigua', '000-PENDING', 'tour_operator', 'Direct Booking Site (USD pricing)', false, 'new', 'TIER:2 | INTL:AG | SCRAPE: tour company Antigua | Script: tour_operator', 'St. John''s, Antigua'),
('[INTL] [SCRAPE] Tour Operator - St Lucia', '000-PENDING', 'tour_operator', 'Direct Booking Site (USD pricing)', false, 'new', 'TIER:2 | INTL:LC | SCRAPE: tour company St Lucia | Script: tour_operator', 'Castries, St Lucia'),
('[INTL] [SCRAPE] Real Estate - Guyana', '000-PENDING', 'real_estate_agent', 'Property Site + AI Caller (USD pricing)', false, 'new', 'TIER:2 | INTL:GY | Booming oil economy | SCRAPE: real estate Guyana | Script: real_estate', 'Georgetown, Guyana'),
('[INTL] [SCRAPE] Service Business - Cayman', '000-PENDING', 'professional_services', 'Premium Site + CRM (USD pricing)', false, 'new', 'TIER:2 | INTL:KY | Premium market, high spend | SCRAPE: small business Cayman Islands', 'George Town, Cayman Islands'),

-- INTERNATIONAL: DIASPORA (USA)
('[INTL] [SCRAPE] Caribbean Restaurant - Miami', '000-PENDING', 'restaurant', 'Website + Online Ordering (USD pricing)', false, 'new', 'TIER:1 | INTL:US-FL | SCRAPE: Jamaican restaurant Miami Florida | Pitch: direct ordering reduces DoorDash fees | Script: restaurant', 'Miami, FL, USA'),
('[INTL] [SCRAPE] Caribbean Restaurant - New York', '000-PENDING', 'restaurant', 'Website + Online Ordering (USD pricing)', false, 'new', 'TIER:1 | INTL:US-NY | SCRAPE: Jamaican restaurant Brooklyn New York | Script: restaurant', 'Brooklyn, NY, USA'),
('[INTL] [SCRAPE] Caribbean Restaurant - Atlanta', '000-PENDING', 'restaurant', 'Website + Online Ordering (USD pricing)', false, 'new', 'TIER:1 | INTL:US-GA | SCRAPE: Caribbean restaurant Atlanta Georgia | Script: restaurant', 'Atlanta, GA, USA'),
('[INTL] [SCRAPE] Beauty Salon - Miami', '000-PENDING', 'hair_salon', 'Website + Booking (USD pricing)', false, 'new', 'TIER:1 | INTL:US-FL | SCRAPE: Caribbean beauty salon Miami Florida | Script: hair_salon', 'Miami, FL, USA'),
('[INTL] [SCRAPE] Insurance Agent - Florida', '000-PENDING', 'insurance_agent', 'Website + AI Caller (USD pricing)', false, 'new', 'TIER:2 | INTL:US-FL | SCRAPE: insurance agent Miami Florida | Script: insurance_sales', 'Miami, FL, USA'),

-- INTERNATIONAL: UK / CANADA
('[INTL] [SCRAPE] Caribbean Restaurant - Toronto', '000-PENDING', 'restaurant', 'Website + Online Ordering (CAD pricing)', false, 'new', 'TIER:1 | INTL:CA-ON | SCRAPE: Jamaican restaurant Toronto Canada | Script: restaurant', 'Toronto, ON, Canada'),
('[INTL] [SCRAPE] Caribbean Business - London', '000-PENDING', 'retail', 'Website + E-commerce (GBP pricing)', false, 'new', 'TIER:1 | INTL:UK | SCRAPE: Caribbean business London UK | Script: clothing_boutique', 'London, UK');
