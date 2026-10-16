@echo off
cd /d C:\Users\jader\ai-sales-bot
echo Starting sequential scrape at %time%

echo === Miami ===
npx ts-node src/scraper-intl.ts --market=US_MIAMI --limit=30
timeout /t 10

echo === Fort Lauderdale ===
npx ts-node src/scraper-intl.ts --market=US_FORT_LAUDERDALE --limit=30
timeout /t 10

echo === Toronto ===
npx ts-node src/scraper-intl.ts --market=CA_TORONTO --limit=30
timeout /t 10

echo === Trinidad ===
npx ts-node src/scraper-intl.ts --market=TT_PORT_OF_SPAIN --limit=30
timeout /t 10

echo === Barbados ===
npx ts-node src/scraper-intl.ts --market=BB_BRIDGETOWN --limit=25
timeout /t 10

echo === St Lucia ===
npx ts-node src/scraper-intl.ts --market=LC_CASTRIES --limit=25
timeout /t 10

echo === Grenada ===
npx ts-node src/scraper-intl.ts --market=GD_ST_GEORGE --limit=25
timeout /t 10

echo === Bahamas ===
npx ts-node src/scraper-intl.ts --market=BS_NASSAU --limit=25
timeout /t 10

echo === Antigua ===
npx ts-node src/scraper-intl.ts --market=AG_ST_JOHN --limit=25
timeout /t 10

echo === St Vincent ===
npx ts-node src/scraper-intl.ts --market=VC_KINGSTOWN --limit=25
timeout /t 10

echo === Dominica ===
npx ts-node src/scraper-intl.ts --market=DM_ROSEAU --limit=25
timeout /t 10

echo === St Kitts ===
npx ts-node src/scraper-intl.ts --market=KN_BASSETERRE --limit=25
timeout /t 10

echo === Guyana ===
npx ts-node src/scraper-intl.ts --market=GY_GEORGETOWN --limit=25
timeout /t 10

echo === Suriname ===
npx ts-node src/scraper-intl.ts --market=SR_PARAMARIBO --limit=25
timeout /t 10

echo All done at %time%
