#!/usr/bin/env node
/**
 * scrapeLounge.js
 * Scrapes Wikipedia pages for major airport lounge brands,
 * extracts IATA codes + lounge names, and writes data/lounges.ts.
 *
 * Run: node scripts/scrapeLounge.js
 * Requires Node 18+ (built-in fetch) or Node 16 with: npm i -g node-fetch
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Lounge brands to scrape ────────────────────────────────────────────────
// Each entry maps a Wikipedia article title to a display brand name.
const LOUNGE_PAGES = [
  { page: 'Centurion_Lounge',          brand: 'Centurion Lounge'         },
  { page: 'Delta_Sky_Club',            brand: 'Delta Sky Club'            },
  { page: 'United_Club',               brand: 'United Club'               },
  { page: 'Admirals_Club',             brand: 'Admirals Club'             },
  { page: 'Alaska_Lounge',             brand: 'Alaska Lounge'             },
  { page: 'British_Airways_Galleries', brand: 'British Airways Galleries Lounge' },
  { page: 'Virgin_Atlantic_Clubhouse', brand: 'Virgin Atlantic Clubhouse' },
  { page: 'Qantas_Club',               brand: 'Qantas Club'               },
  { page: 'Air_France_Lounge',         brand: 'Air France Lounge'         },
  { page: 'Lufthansa_Business_Lounge', brand: 'Lufthansa Business Lounge' },
  { page: 'SilverKris_Lounge',         brand: 'Singapore Airlines SilverKris Lounge' },
  { page: 'Cathay_Pacific_Lounges',    brand: 'Cathay Pacific Lounge'     },
  { page: 'Emirates_Lounge',           brand: 'Emirates Lounge'           },
  { page: 'Plaza_Premium_Lounge',      brand: 'Plaza Premium Lounge'      },
  { page: 'Priority_Pass',             brand: null /* skip — listing page */ },
];

// ── Fetch Wikipedia HTML via REST API ──────────────────────────────────────
function fetchWikipediaHtml(title) {
  return new Promise((resolve, reject) => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
    https.get(url, { headers: { 'User-Agent': 'lounge-scraper/1.0 (educational)' } }, res => {
      if (res.statusCode === 404) { resolve(null); return; }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── Extract IATA codes from HTML ───────────────────────────────────────────
// Strategy: find all 3-letter uppercase words that look like IATA codes
// within ~300 chars of any lounge-related word.
const IATA_RE = /\b([A-Z]{3})\b/g;

// Known non-IATA 3-letter uppercase words to skip
const SKIP = new Set([
  'THE','AND','FOR','NOT','ARE','BUT','ITS','WHO','WAS','HAS','HAD',
  'ONE','TWO','ALL','NEW','OUR','OUT','CAN','GET','HIM','HIS','HOW',
  'ANY','NOW','SHE','MAY','USE','WAY','VIA','CEO','CFO','HUB','INC',
  'LLC','LTD','USA','UK', 'UAE','NYC','LAW','ACT','FLY','AIR','SKY',
  'SPA','BAR','VIP','FAQ','REF','ETA','ETD','ATD','ATA',
]);

// Known good IATA airport codes — anything in this set is definitely valid
// (add more as needed; this helps reduce false positives)
const KNOWN_IATA = new Set([
  'ATL','LAX','ORD','DFW','DEN','JFK','SFO','SEA','LAS','MCO','EWR',
  'CLT','PHX','IAH','MIA','IAD','BOS','MSP','DTW','PHL','LGA','FLL',
  'BWI','SLC','MDW','HNL','SAN','PDX','STL','HOU','AUS','OAK','BNA',
  'RDU','MCI','SMF','SJC','DAL','TPA','IND','PIT','CMH','CVG','MKE',
  'OMA','MSY','JAX','OKC','BUF','BDL','ABQ','TUS','ELP','RNO','ORF',
  'LHR','LGW','LCY','MAN','EDI','GLA','STN','BHX','LBA','LTN',
  'CDG','ORY','NCE','LYS','MRS','BOD','TLS','NTE','SXB','LIL',
  'FRA','MUC','DUS','HAM','BER','TXL','SXF','CGN','STR','NUE','HAJ',
  'AMS','RTM','EIN','MST','GRQ',
  'ZUR','GVA','BSL','BRN',
  'MAD','BCN','VLC','AGP','PMI','SVQ','BIO','ZAZ','LPA','TFN','ACE',
  'FCO','MXP','LIN','NAP','VCE','BGY','CIA','CTA','BRI','PMO',
  'LIS','OPO','FAO','FNC',
  'BRU','CRL','LGG',
  'CPH','ARN','OSL','HEL','GOT','BGO','TRD',
  'VIE','PRG','BUD','WAW','KRK','GDN','WRO','POZ',
  'ATH','SKG','HER','RHO','CFU','KGS',
  'IST','SAW','ADB','ESB','AYT','BJV',
  'DXB','AUH','SHJ','DOH','BAH','KWI','MCT','RUH','JED','DMM',
  'NRT','HND','KIX','NGO','CTS','FUK','OKA',
  'ICN','GMP','PUS','CJU',
  'PEK','PVG','SHA','CAN','SZX','CTU','KMG','XIY',
  'HKG','TPE','TSA','KHH',
  'SIN','KUL','BKK','DMK','CGK','DPS','MNL','SGN','HAN','RGN',
  'SYD','MEL','BNE','PER','ADL','CBR','DRW','HBA','OOL',
  'AKL','CHC','WLG','ZQN',
  'YYZ','YVR','YUL','YYC','YEG','YOW','YHZ',
  'GRU','CGH','BSB','GIG','SSA','FOR','REC','CWB','POA',
  'EZE','AEP','SCL','BOG','LIM','UIO','GYE','MVD','ASU','LPB',
  'JNB','CPT','DUR','HRE','NBO','ADD','DAR','LOS','ABV','ACC',
  'CAI','CMN','ALG','TUN','RAK','AGA','JRO','MBA',
  'BOM','DEL','BLR','HYD','MAA','CCU','AMD','COK','GOI',
  'SVO','DME','LED','OVB','KJA',
  'TLV','AMM','BEY','DXB','MCT','IST',
]);

function extractIataCodes(html) {
  const codes = new Set();
  let m;
  IATA_RE.lastIndex = 0;
  while ((m = IATA_RE.exec(html)) !== null) {
    const code = m[1];
    if (!SKIP.has(code) && (KNOWN_IATA.has(code) || code.length === 3)) {
      // Extra heuristic: only keep if surrounded by lounge/airport context
      const ctx = html.slice(Math.max(0, m.index - 120), m.index + 120);
      if (
        KNOWN_IATA.has(code) ||
        /terminal|lounge|airport|concourse|gate|iata|hub|club/i.test(ctx)
      ) {
        codes.add(code);
      }
    }
  }
  return [...codes];
}

// ── Strip HTML tags ────────────────────────────────────────────────────────
function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#\d+;/g,' ');
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // Map: airportCode → Set of lounge names
  const result = {};

  for (const { page, brand } of LOUNGE_PAGES) {
    if (!brand) continue;
    console.log(`Fetching: ${page}...`);
    const html = await fetchWikipediaHtml(page);
    if (!html) { console.log(`  → 404, skipping`); continue; }

    const text = stripTags(html);
    const codes = extractIataCodes(text);
    console.log(`  → found ${codes.length} codes: ${codes.slice(0,10).join(', ')}${codes.length > 10 ? '...' : ''}`);

    for (const code of codes) {
      if (!result[code]) result[code] = new Set();
      result[code].add(`${brand} ${code}`);
    }

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 800));
  }

  // ── Sort + dedupe ──────────────────────────────────────────────────────
  const sorted = {};
  for (const code of Object.keys(result).sort()) {
    sorted[code] = [...result[code]].sort();
  }

  // ── Write output ───────────────────────────────────────────────────────
  const lines = [
    '// Auto-generated by scripts/scrapeLounge.js — do not edit manually.',
    '// Re-run the script to refresh.',
    '',
    'export const AIRPORT_LOUNGES: Record<string, string[]> = {',
  ];

  for (const [code, lounges] of Object.entries(sorted)) {
    lines.push(`  ${code}: [`);
    for (const l of lounges) {
      lines.push(`    ${JSON.stringify(l)},`);
    }
    lines.push(`  ],`);
  }
  lines.push('};');
  lines.push('');
  lines.push('export function getLoungesForAirport(airportCode: string, query: string): string[] {');
  lines.push('  const all = AIRPORT_LOUNGES[airportCode.toUpperCase()] ?? [];');
  lines.push('  if (!query.trim()) return all.slice(0, 6);');
  lines.push('  const q = query.toLowerCase();');
  lines.push('  return all.filter(name => name.toLowerCase().includes(q)).slice(0, 6);');
  lines.push('}');

  const outPath = path.join(__dirname, '..', 'data', 'lounges.ts');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\nWrote ${Object.keys(sorted).length} airports → ${outPath}`);
  console.log('\nReview the output — IATA extraction is heuristic, so spot-check a few airports.');
}

main().catch(err => { console.error(err); process.exit(1); });
