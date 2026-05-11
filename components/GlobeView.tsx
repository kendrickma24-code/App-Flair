import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Theme } from '../constants/theme';
import { AIRPORT_COORDS } from '../data/airportCoords';

interface RouteCoord {
  fromLon: number; fromLat: number;
  toLon: number;   toLat: number;
  flightId: string;
}

interface Props {
  theme: Theme;
  isDark: boolean;
  visitedCountryIds: string[];
  visitedStateCodes: string[];
  routes?: { fromCode: string; toCode: string; flightId: string }[];
  verticalOffset?: number;
  onRegionTap?: (name: string, isoId: string, isState: boolean) => void;
  onRouteTap?: (flightId: string) => void;
}

function buildHTML(accentColor: string, isDark: boolean, verticalOffset: number): string {
  const routeJson = '[]'; // always start empty; routes are injected via __globeUpdateRoutes after load
  const WATER   = '#060C18';
  const LAND    = '#0D1828';   // very dark — unvisited lands recede into the globe
  const BORDER  = '#1A2E48';
  const GRAT    = '#0A1220';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:transparent;overflow:hidden;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center}
  svg{display:block;touch-action:none}
  .country,.state{transition:fill .25s}
</style>
</head>
<body>
<svg id="g"></svg>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
<script>
const ACCENT="${accentColor}";
const WATER="${WATER}";
const LAND="${LAND}";
const BORDER="${BORDER}";
const GRAT="${GRAT}";

// Derived from accent — used for visited borders and glow
function hexToRgb(h){
  const r=parseInt(h.slice(1,3),16);
  const g=parseInt(h.slice(3,5),16);
  const b=parseInt(h.slice(5,7),16);
  return [r,g,b];
}
const [AR,AG,AB]=hexToRgb(ACCENT);
const ACCENT_STROKE=\`rgba(\${AR},\${AG},\${AB},0.55)\`;
const ACCENT_GLOW=\`rgba(\${AR},\${AG},\${AB},0.45)\`;
const ROUTES=${routeJson};

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
const SNAMES={
  'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California',
  'CO':'Colorado','CT':'Connecticut','DE':'Delaware','DC':'D.C.','FL':'Florida',
  'GA':'Georgia','HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana',
  'IA':'Iowa','KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine',
  'MD':'Maryland','MA':'Massachusetts','MI':'Michigan','MN':'Minnesota',
  'MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada',
  'NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York',
  'NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma',
  'OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina',
  'SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont',
  'VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming'
};
const CNAMES={
  '840':'United States','124':'Canada','484':'Mexico','826':'United Kingdom',
  '250':'France','276':'Germany','380':'Italy','724':'Spain','528':'Netherlands',
  '756':'Switzerland','40':'Austria','56':'Belgium','372':'Ireland','300':'Greece',
  '792':'Turkey','643':'Russia','784':'UAE','634':'Qatar','682':'Saudi Arabia',
  '356':'India','156':'China','392':'Japan','410':'South Korea','344':'Hong Kong',
  '702':'Singapore','764':'Thailand','458':'Malaysia','360':'Indonesia','608':'Philippines',
  '704':'Vietnam','36':'Australia','554':'New Zealand','124':'Canada','76':'Brazil',
  '32':'Argentina','170':'Colombia','152':'Chile','604':'Peru','710':'South Africa',
  '404':'Kenya','231':'Ethiopia','566':'Nigeria','504':'Morocco','818':'Egypt',
  '376':'Israel','462':'Maldives',
};

let vCountries=new Set();
let vStates=new Set();
let dots=[];
let rafRunning=false;
let topoReady=false;
let pendingRoutes=ROUTES;

function animateDots(ts){
  if(dots.length===0){rafRunning=false;return;}
  dots.forEach(function(o){
    const t=(((ts/o.period)+o.offset)%1+1)%1;
    const coord=o.interp(t);
    const pt=proj(coord);
    if(pt&&isVisible(coord)){
      o.dot.attr('cx',pt[0]).attr('cy',pt[1]).attr('opacity',1);
      o.halo.attr('cx',pt[0]).attr('cy',pt[1]).attr('opacity',0.55);
    }else{
      o.dot.attr('opacity',0);o.halo.attr('opacity',0);
    }
  });
  requestAnimationFrame(animateDots);
}

function drawRoutes(routes){
  if(!topoReady){pendingRoutes=routes;return;}
  gRoutes.selectAll('*').remove();
  dots=[];
  routes.forEach(function(r,i){
    if(r.fromLon==null||r.toLon==null)return;
    const feature={type:'Feature',geometry:{type:'LineString',coordinates:[[r.fromLon,r.fromLat],[r.toLon,r.toLat]]}};
    gRoutes.append('path').attr('class','route-hit').datum(feature).attr('d',path)
      .attr('fill','none').attr('stroke','transparent').attr('stroke-width',18)
      .style('cursor','pointer')
      .on('click',function(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'routeTap',flightId:r.flightId}));});
    gRoutes.append('path').attr('class','route').datum(feature).attr('d',path)
      .attr('fill','none').attr('stroke',ACCENT).attr('stroke-width',1.8)
      .attr('stroke-opacity',0.6).attr('stroke-linecap','round').style('pointer-events','none');
    const halo=gRoutes.append('circle').attr('r',7).attr('fill',ACCENT).attr('opacity',0)
      .attr('filter','url(#dotGlow)').attr('pointer-events','none');
    const dot=gRoutes.append('circle').attr('r',3).attr('fill','#fff').attr('opacity',0)
      .attr('pointer-events','none');
    const interp=d3.geoInterpolate([r.fromLon,r.fromLat],[r.toLon,r.toLat]);
    dots.push({dot,halo,interp,period:3200+i*430,offset:i*0.23});
  });
  if(dots.length>0&&!rafRunning){rafRunning=true;requestAnimationFrame(animateDots);}
}

window.__globeUpdateRoutes=function(routes){drawRoutes(routes);};

const W=window.innerWidth;
const H=window.innerHeight;
const R=Math.min(W,H)*0.52;
const OFFSET=${verticalOffset};

const proj=d3.geoOrthographic()
  .scale(R).translate([W/2,H/2-OFFSET])
  .rotate([0,-20]).clipAngle(90);
const path=d3.geoPath().projection(proj);

const svg=d3.select('#g').attr('width',W).attr('height',H);

// Water sphere
const sphere=svg.append('circle')
  .attr('cx',W/2).attr('cy',H/2-OFFSET).attr('r',R)
  .attr('fill',WATER);

// Graticule
const grat=svg.append('path')
  .datum(d3.geoGraticule()())
  .attr('d',path).attr('fill','none')
  .attr('stroke',GRAT).attr('stroke-width',0.4);

const gCountries=svg.append('g');
const gStates=svg.append('g');
const gRoutes=svg.append('g');
const gLabels=svg.append('g').attr('pointer-events','none');

// ── Day/Night overlay ────────────────────────────────────────────────
// Gaussian blur on the path eliminates the hard geometric edge entirely —
// the boundary dissolves into a smooth atmospheric glow with no visible line.
const defs=svg.append('defs');

// Clip night overlay to the globe sphere so blur can't bleed into the background
const clipCircle=defs.append('clipPath').attr('id','globeClip')
  .append('circle').attr('cx',W/2).attr('cy',H/2-OFFSET).attr('r',R);

// Dot glow filter
const dotGlow=defs.append('filter')
  .attr('id','dotGlow')
  .attr('x','-200%').attr('y','-200%')
  .attr('width','500%').attr('height','500%');
dotGlow.append('feGaussianBlur')
  .attr('in','SourceGraphic')
  .attr('stdDeviation',4)
  .attr('result','blur');
const dotMerge=dotGlow.append('feMerge');
dotMerge.append('feMergeNode').attr('in','blur');
dotMerge.append('feMergeNode').attr('in','blur');
dotMerge.append('feMergeNode').attr('in','SourceGraphic');

// Glow filter for visited countries/states
const visitedGlow=defs.append('filter')
  .attr('id','visitedGlow')
  .attr('x','-40%').attr('y','-40%')
  .attr('width','180%').attr('height','180%');
visitedGlow.append('feDropShadow')
  .attr('dx',0).attr('dy',0)
  .attr('stdDeviation',5)
  .attr('flood-color',ACCENT_GLOW)
  .attr('flood-opacity',1);

const blur=Math.round(R*0.06);
const nightFilter=defs.append('filter')
  .attr('id','nightBlur')
  .attr('x','-50%').attr('y','-50%')
  .attr('width','200%').attr('height','200%');
nightFilter.append('feGaussianBlur')
  .attr('in','SourceGraphic')
  .attr('stdDeviation',blur);

const gNight=svg.append('g')
  .attr('pointer-events','none')
  .attr('clip-path','url(#globeClip)');
const nightPath=gNight.append('path')
  .attr('fill','rgba(0,4,18,0.50)')
  .attr('filter','url(#nightBlur)')
  .attr('stroke','none');

// ── Day/Night terminator ─────────────────────────────────────────────
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

function updateNight(){
  const[sLon,sLat]=getSolarPoint();
  const nLon=sLon>=0?sLon-180:sLon+180;
  const nLat=-sLat;
  const circle=d3.geoCircle().center([nLon,nLat]).radius(90)();
  nightPath.datum(circle).attr('d',path);
}

// Returns true if [lon,lat] is on the visible hemisphere
function isVisible(lonLat){
  const r=proj.rotate();
  const toRad=Math.PI/180;
  const lon=(lonLat[0]+r[0])*toRad;
  const lat=(lonLat[1]+r[1])*toRad;
  return Math.cos(lat)*Math.cos(lon)>0;
}

function cfill(id){return vCountries.has(String(id))?ACCENT:LAND;}
function sfill(fips){
  const k=String(fips).padStart(2,'0');
  const s=FIPS[k];
  return s&&vStates.has(s)?ACCENT:LAND;
}

// No-op until features load; replaced in the Promise.all then()
let updateLabels=function(){};

function isVisitedCountry(d){return vCountries.has(String(d.id));}
function isVisitedState(d){
  const k=String(d.id).padStart(2,'0');
  const s=FIPS[k];
  return !!(s&&vStates.has(s));
}

function recolor(){
  gCountries.selectAll('.country')
    .attr('fill',d=>cfill(d.id))
    .attr('fill-opacity',d=>isVisitedCountry(d)?1:0.70)
    .attr('stroke',d=>isVisitedCountry(d)?ACCENT_STROKE:BORDER)
    .attr('stroke-width',d=>isVisitedCountry(d)?1:0.35)
    .attr('stroke-opacity',d=>isVisitedCountry(d)?0.8:0.45)
    .attr('filter',d=>isVisitedCountry(d)?'url(#visitedGlow)':null);
  gStates.selectAll('.state')
    .attr('fill',d=>sfill(d.id))
    .attr('fill-opacity',d=>isVisitedState(d)?1:0.70)
    .attr('stroke',d=>isVisitedState(d)?ACCENT_STROKE:BORDER)
    .attr('stroke-width',d=>isVisitedState(d)?0.9:0.25)
    .attr('stroke-opacity',d=>isVisitedState(d)?0.8:0.40)
    .attr('filter',d=>isVisitedState(d)?'url(#visitedGlow)':null);
}
let usLandClipPath=null;
function reproject(){
  gCountries.selectAll('.country').attr('d',path);
  gStates.selectAll('.state').attr('d',path);
  if(usLandClipPath) usLandClipPath.attr('d',path);
  gRoutes.selectAll('.route,.route-hit').attr('d',path);
  grat.attr('d',path);
  nightPath.attr('d',path);
  updateLabels();
}

// Load world + US atlas
Promise.all([
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r=>r.json()),
  fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(r=>r.json()),
]).then(([world,us])=>{
  const countries=topojson.feature(world,world.objects.countries);
  const states=topojson.feature(us,us.objects.states);

  // Clip states to the US land boundary from countries-110m so that
  // legal state borders extending into the Great Lakes don't get colored.
  const usFeature=countries.features.find(f=>+f.id===840);
  if(usFeature){
    usLandClipPath=defs.append('clipPath').attr('id','usLandClip')
      .append('path').datum(usFeature).attr('d',path);
    gStates.attr('clip-path','url(#usLandClip)');
  }

  // Non-US countries
  gCountries.selectAll('.country')
    .data(countries.features.filter(f=>+f.id!==840))
    .enter().append('path').attr('class','country')
    .attr('d',path)
    .attr('fill',LAND).attr('fill-opacity',0.70)
    .attr('stroke',BORDER).attr('stroke-width',0.35).attr('stroke-opacity',0.45)
    .on('click',(ev,d)=>{
      const name=CNAMES[String(d.id)]||'Unknown';
      window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(
        JSON.stringify({type:'tap',name,id:String(d.id),isState:false}));
    });

  // US states
  gStates.selectAll('.state')
    .data(states.features)
    .enter().append('path').attr('class','state')
    .attr('d',path)
    .attr('fill',LAND).attr('fill-opacity',0.70)
    .attr('stroke',BORDER).attr('stroke-width',0.25).attr('stroke-opacity',0.40)
    .on('click',(ev,d)=>{
      const k=String(d.id).padStart(2,'0');
      const s=FIPS[k]||'';
      const name=SNAMES[s]||s;
      window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(
        JSON.stringify({type:'tap',name,id:s,isState:true}));
    });

  recolor();

  // ── Labels ───────────────────────────────────────────────────────────
  // Country centroids (skip US — shown as states when zoomed)
  const cData=countries.features
    .filter(f=>+f.id!==840&&CNAMES[String(f.id)])
    .map(f=>({centroid:d3.geoCentroid(f),name:CNAMES[String(f.id)],id:f.id}));

  // State centroids
  const sData=states.features.map(f=>{
    const k=String(f.id).padStart(2,'0');
    const code=FIPS[k]||'';
    return{centroid:d3.geoCentroid(f),code,name:SNAMES[code]||code};
  }).filter(d=>d.code);

  // Country label elements
  gLabels.selectAll('.clabel')
    .data(cData).enter().append('text').attr('class','clabel')
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('fill','#fff').attr('opacity',0)
    .attr('font-family','system-ui,-apple-system,sans-serif')
    .attr('font-weight','600').attr('letter-spacing','0.3')
    .text(d=>d.name);

  // State label elements (show abbreviated code when moderately zoomed, full name when very zoomed)
  gLabels.selectAll('.slabel')
    .data(sData).enter().append('text').attr('class','slabel')
    .attr('text-anchor','middle').attr('dominant-baseline','middle')
    .attr('fill','rgba(255,255,255,0.75)').attr('opacity',0)
    .attr('font-family','system-ui,-apple-system,sans-serif')
    .attr('font-weight','600')
    .text(d=>d.code);

  // Thresholds: country labels fade in between 1.3x–2x zoom; state labels 2x–3x
  const C_LO=R*1.3, C_HI=R*2.0;
  const S_LO=R*2.0, S_HI=R*3.0;

  updateLabels=function(){
    const sc=proj.scale();
    const cOpacity=Math.max(0,Math.min(0.75,(sc-C_LO)/(C_HI-C_LO)*0.75));
    const sOpacity=Math.max(0,Math.min(0.80,(sc-S_LO)/(S_HI-S_LO)*0.80));
    const cSize=Math.max(7,Math.min(13,9*(sc/R)));
    const sSize=Math.max(6,Math.min(11,8*(sc/R)));

    gLabels.selectAll('.clabel').each(function(d){
      const pt=proj(d.centroid);
      const vis=pt&&isVisible(d.centroid);
      d3.select(this)
        .attr('x',pt?pt[0]:0).attr('y',pt?pt[1]:0)
        .attr('font-size',cSize)
        .attr('opacity',vis?cOpacity:0);
    });
    gLabels.selectAll('.slabel').each(function(d){
      const pt=proj(d.centroid);
      const vis=pt&&isVisible(d.centroid);
      // At very high zoom, switch from abbr. to full name
      const label=sc>=R*3.5?d.name:d.code;
      d3.select(this).text(label)
        .attr('x',pt?pt[0]:0).attr('y',pt?pt[1]:0)
        .attr('font-size',sSize)
        .attr('opacity',vis?sOpacity:0);
    });
  };

  updateLabels();

  topoReady=true;
  drawRoutes(pendingRoutes);

  updateNight();
  // Refresh terminator every 60 seconds as the Earth rotates
  setInterval(updateNight, 60000);
}).catch(()=>{});

// ── Touch rotation + pinch zoom ─────────────────────────────────────
let t0=null,r0=null,p0=null,s0=null;

document.addEventListener('touchstart',e=>{
  if(e.touches.length===2) e.preventDefault();
  if(e.touches.length===1){
    t0={x:e.touches[0].clientX,y:e.touches[0].clientY};
    r0=[...proj.rotate()];
    p0=null;
  } else if(e.touches.length===2){
    const a=e.touches[0],b=e.touches[1];
    p0=Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
    s0=proj.scale();
    t0=null;
  }
},{passive:false});

document.addEventListener('touchmove',e=>{
  e.preventDefault();
  if(e.touches.length===1&&t0&&r0){
    const dx=e.touches[0].clientX-t0.x;
    const dy=e.touches[0].clientY-t0.y;
    const k=0.35;
    proj.rotate([r0[0]+dx*k,Math.max(-90,Math.min(90,r0[1]-dy*k))]);
    reproject();
  } else if(e.touches.length===2&&p0!==null){
    const a=e.touches[0],b=e.touches[1];
    const d=Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
    const ns=Math.max(R*0.8,Math.min(R*5,s0*d/p0));
    proj.scale(ns);
    sphere.attr('r',ns);
    clipCircle.attr('r',ns);
    reproject();
  }
},{passive:false});

document.addEventListener('touchend',()=>{t0=null;p0=null;});

// ── Messages from React Native ──────────────────────────────────────
function onMsg(e){
  try{
    const d=JSON.parse(e.data);
    if(d.type==='update'){
      vCountries=new Set(d.countries.map(String));
      vStates=new Set(d.states);
      recolor();
    }
  }catch(err){}
}
window.addEventListener('message',onMsg);
document.addEventListener('message',onMsg);
window.__globeUpdate=function(countries,states){
  vCountries=new Set(countries.map(String));
  vStates=new Set(states);
  recolor();
};
</script>
</body>
</html>`;
}

export default function GlobeView({ theme, isDark, visitedCountryIds, visitedStateCodes, routes, verticalOffset = 0, onRegionTap, onRouteTap }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const routeCoords: RouteCoord[] = (routes ?? []).flatMap(r => {
    const from = AIRPORT_COORDS[r.fromCode];
    const to = AIRPORT_COORDS[r.toCode];
    if (!from || !to) return [];
    return [{ fromLon: from[0], fromLat: from[1], toLon: to[0], toLat: to[1], flightId: r.flightId }];
  });

  function push() {
    const js = `window.__globeUpdate(${JSON.stringify(visitedCountryIds)},${JSON.stringify(visitedStateCodes)});window.__globeUpdateRoutes(${JSON.stringify(routeCoords)});true;`;
    webViewRef.current?.injectJavaScript(js);
  }

  const routeCoordsKey = routeCoords.map(r => r.flightId).join(',');
  useEffect(() => {
    if (ready) push();
  }, [visitedCountryIds, visitedStateCodes, routeCoordsKey, ready]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: buildHTML(theme.accent, isDark, verticalOffset) }}
        style={[styles.webview, { backgroundColor: 'transparent' }]}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        originWhitelist={['*']}
        onLoadStart={() => setReady(false)}
        onLoad={() => { setReady(true); push(); }}
        onMessage={e => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.type === 'tap') onRegionTap?.(d.name, d.id, d.isState);
            if (d.type === 'routeTap') onRouteTap?.(d.flightId);
          } catch {}
        }}
      />
      {!ready && (
        <View style={[styles.loader, { backgroundColor: 'transparent' }]}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
