import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Countries to highlight (numeric ISO IDs matching world-atlas)
// Japan=392, UK=826, France=250, Australia=36, Brazil=76, India=356, Japan=392
const HIGHLIGHTED_COUNTRIES = ['392', '826', '250', '36', '76', '356'];
// US states to highlight (2-letter codes)
const HIGHLIGHTED_STATES = ['CA', 'NY', 'TX'];

const ACCENT   = '#6C8EF5';  // blue-ish accent
const WATER    = '#0A0F1A';
const LAND     = '#1E2D45';
const BORDER   = '#2E4568';
const GRAT     = '#111C2E';

const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:${WATER};overflow:hidden;width:3840px;height:3840px;display:flex;align-items:center;justify-content:center}
  svg{display:block}
</style>
</head>
<body>
<svg id="g"></svg>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
<script>
const ACCENT="${ACCENT}";
const WATER="${WATER}";
const LAND="${LAND}";
const BORDER="${BORDER}";
const GRAT="${GRAT}";

const vCountries=new Set(${JSON.stringify(HIGHLIGHTED_COUNTRIES)});
const vStates=new Set(${JSON.stringify(HIGHLIGHTED_STATES)});

const FIPS={
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY'
};

const W=3840, H=3840;
const R=Math.min(W,H)*0.42;

const proj=d3.geoOrthographic()
  .scale(R).translate([W/2,H/2])
  .rotate([10,-20]).clipAngle(90);
const path=d3.geoPath().projection(proj);

const svg=d3.select('#g').attr('width',W).attr('height',H);

// Water sphere
svg.append('circle').attr('cx',W/2).attr('cy',H/2).attr('r',R).attr('fill',WATER);

// Graticule
svg.append('path')
  .datum(d3.geoGraticule()())
  .attr('d',path).attr('fill','none')
  .attr('stroke',GRAT).attr('stroke-width',2);

const gCountries=svg.append('g');
const gStates=svg.append('g');

// Day/night overlay
const defs=svg.append('defs');
const clipCircle=defs.append('clipPath').attr('id','globeClip')
  .append('circle').attr('cx',W/2).attr('cy',H/2).attr('r',R);

const blur=Math.round(R*0.06);
const nightFilter=defs.append('filter')
  .attr('id','nightBlur')
  .attr('x','-50%').attr('y','-50%')
  .attr('width','200%').attr('height','200%');
nightFilter.append('feGaussianBlur').attr('in','SourceGraphic').attr('stdDeviation',blur);

const gNight=svg.append('g')
  .attr('pointer-events','none')
  .attr('clip-path','url(#globeClip)');
const nightPath=gNight.append('path')
  .attr('fill','rgba(0,4,18,0.50)')
  .attr('filter','url(#nightBlur)')
  .attr('stroke','none');

function getSolarPoint(){
  const now=new Date();
  const start=new Date(Date.UTC(now.getUTCFullYear(),0,1));
  const doy=Math.floor((now-start)/86400000)+1;
  const decl=-23.45*Math.cos(2*Math.PI*(doy+10)/365);
  const utcH=now.getUTCHours()+now.getUTCMinutes()/60+now.getUTCSeconds()/3600;
  let lon=-(utcH-12)*15;
  lon=((lon+180)%360+360)%360-180;
  return[lon,decl];
}

function cfill(id){return vCountries.has(String(id))?ACCENT:LAND;}
function sfill(fips){
  const k=String(fips).padStart(2,'0');
  const s=FIPS[k];
  return s&&vStates.has(s)?ACCENT:LAND;
}

window._done = false;

Promise.all([
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r=>r.json()),
  fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(r=>r.json()),
]).then(([world,us])=>{
  const countries=topojson.feature(world,world.objects.countries);
  const states=topojson.feature(us,us.objects.states);

  const usFeature=countries.features.find(f=>+f.id===840);
  if(usFeature){
    defs.append('clipPath').attr('id','usLandClip')
      .append('path').datum(usFeature).attr('d',path);
    gStates.attr('clip-path','url(#usLandClip)');
  }

  gCountries.selectAll('.country')
    .data(countries.features.filter(f=>+f.id!==840))
    .enter().append('path').attr('class','country')
    .attr('d',path).attr('fill',d=>cfill(d.id))
    .attr('stroke',BORDER).attr('stroke-width',2.5);

  gStates.selectAll('.state')
    .data(states.features)
    .enter().append('path').attr('class','state')
    .attr('d',path).attr('fill',d=>sfill(d.id))
    .attr('stroke',BORDER).attr('stroke-width',1.2);

  // Night overlay
  const[sLon,sLat]=getSolarPoint();
  const nLon=sLon>=0?sLon-180:sLon+180;
  const nLat=-sLat;
  nightPath.datum(d3.geoCircle().center([nLon,nLat]).radius(90)()).attr('d',path);

  window._done = true;
}).catch(e=>{ window._doneError=String(e); window._done=true; });
</script>
</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 3840, height: 3840, deviceScaleFactor: 1 });

  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Wait for D3 to finish rendering
  await page.waitForFunction('window._done === true', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 300)); // let paint settle

  const outPath = '/Users/kendrick/Desktop/globe.png';
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved to', outPath);

  await browser.close();
})();
