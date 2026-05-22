import React, { useRef, useEffect, useState, useMemo } from 'react';
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
  scale?: number;
  onRegionTap?: (name: string, isoId: string, isState: boolean) => void;
  onRouteTap?: (flightId: string) => void;
}

function buildHTML(accentColor: string, _isDark: boolean, verticalOffset: number, scale: number): string {
  const WATER  = '#0A1628';
  const LAND   = '#1A2E4A';
  const BORDER = '#2E4E72';
  const GRAT   = '#162440';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:transparent;overflow:hidden;width:100vw;height:100vh}
  canvas{display:block;position:absolute;top:0;left:0;touch-action:none}
</style>
</head>
<body>
<canvas id="g"></canvas>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
<script>
const ACCENT="${accentColor}";
const WATER="${WATER}";
const LAND="${LAND}";
const BORDER="${BORDER}";
const GRAT="${GRAT}";

function hexToRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
const[AR,AG,AB]=hexToRgb(ACCENT);
const ACCENT_STROKE=\`rgba(\${AR},\${AG},\${AB},0.55)\`;
const ACCENT_GLOW=\`rgba(\${AR},\${AG},\${AB},0.4)\`;

const FIPS={'01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'};
const SNAMES={'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California','CO':'Colorado','CT':'Connecticut','DE':'Delaware','DC':'D.C.','FL':'Florida','GA':'Georgia','HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming'};
const CNAMES={'840':'United States','124':'Canada','484':'Mexico','826':'United Kingdom','250':'France','276':'Germany','380':'Italy','724':'Spain','528':'Netherlands','756':'Switzerland','40':'Austria','56':'Belgium','372':'Ireland','300':'Greece','792':'Turkey','643':'Russia','784':'UAE','634':'Qatar','682':'Saudi Arabia','356':'India','156':'China','392':'Japan','410':'South Korea','344':'Hong Kong','702':'Singapore','764':'Thailand','458':'Malaysia','360':'Indonesia','608':'Philippines','704':'Vietnam','36':'Australia','554':'New Zealand','76':'Brazil','32':'Argentina','170':'Colombia','152':'Chile','604':'Peru','710':'South Africa','404':'Kenya','231':'Ethiopia','566':'Nigeria','504':'Morocco','818':'Egypt','376':'Israel','462':'Maldives'};

// ── Canvas setup ───────────────────────────────────────────────────────
const W=window.innerWidth,H=window.innerHeight;
const DPR=window.devicePixelRatio||1;
const canvas=document.getElementById('g');
canvas.width=W*DPR; canvas.height=H*DPR;
canvas.style.width=W+'px'; canvas.style.height=H+'px';
const ctx=canvas.getContext('2d');
ctx.scale(DPR,DPR);

const R=Math.min(W,H)*${scale};
const OFFSET=${verticalOffset};
const CX=W/2,CY=H/2-OFFSET;

const proj=d3.geoOrthographic().scale(R).translate([CX,CY]).rotate([0,-20]).clipAngle(90);
const geoPath=d3.geoPath().projection(proj).context(ctx);
const gratData=d3.geoGraticule()();

// ── Data ───────────────────────────────────────────────────────────────
let worldFeatures=[],usFeatures=[],usCountryFeature=null;
let cLabelData=[],sLabelData=[];
let vCountries=new Set(),vStates=new Set();
let routeData=[],animDots=[];
let topoReady=false,pendingRoutes=[];

// ── Interaction state ──────────────────────────────────────────────────
let isDragging=false,inertiaActive=false;
let rotVx=0,rotVy=0;
let prevTouchX=0,prevTouchY=0;
let t0=null,r0=null,p0=null,s0=null,tapStart=null;
const FRICTION=0.91,VEL_MIN=0.04;
const AUTO_DELAY_MS=2200,AUTO_SPEED=0.055;
let lastTouchEndTime=-(AUTO_DELAY_MS+1);

function isVisible(ll){return d3.geoDistance(ll,[-proj.rotate()[0],-proj.rotate()[1]])<Math.PI/2;}

// ── Draw ───────────────────────────────────────────────────────────────
function draw(moving){
  const sc=proj.scale();
  ctx.clearRect(0,0,W,H);

  // Water
  ctx.beginPath();
  ctx.arc(CX,CY,sc,0,2*Math.PI);
  ctx.fillStyle=WATER; ctx.fill();

  // Graticule
  ctx.beginPath();
  geoPath(gratData);
  ctx.strokeStyle=GRAT; ctx.lineWidth=0.4; ctx.globalAlpha=1; ctx.stroke();

  // Countries
  worldFeatures.forEach(f=>{
    const vis=vCountries.has(String(f.id));
    ctx.beginPath(); geoPath(f);
    if(vis&&!moving){ctx.shadowBlur=14;ctx.shadowColor=ACCENT_GLOW;}
    ctx.fillStyle=vis?ACCENT:LAND; ctx.globalAlpha=vis?1:0.9; ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle=vis?ACCENT_STROKE:BORDER; ctx.lineWidth=vis?1:0.5;
    ctx.globalAlpha=vis?0.9:0.7; ctx.stroke(); ctx.globalAlpha=1;
  });

  // US States clipped to US boundary
  if(usCountryFeature){
    ctx.save();
    ctx.beginPath(); geoPath(usCountryFeature); ctx.clip();
    usFeatures.forEach(f=>{
      const k=String(f.id).padStart(2,'0'),s=FIPS[k];
      const vis=!!(s&&vStates.has(s));
      ctx.beginPath(); geoPath(f);
      if(vis&&!moving){ctx.shadowBlur=14;ctx.shadowColor=ACCENT_GLOW;}
      ctx.fillStyle=vis?ACCENT:LAND; ctx.globalAlpha=vis?1:0.9; ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle=vis?ACCENT_STROKE:BORDER; ctx.lineWidth=vis?0.9:0.4;
      ctx.globalAlpha=vis?0.9:0.65; ctx.stroke(); ctx.globalAlpha=1;
    });
    ctx.restore();
  }

  // Routes
  routeData.forEach(r=>{
    if(r.fromLon==null)return;
    const feat={type:'Feature',geometry:{type:'LineString',coordinates:[[r.fromLon,r.fromLat],[r.toLon,r.toLat]]}};
    ctx.beginPath(); geoPath(feat);
    ctx.strokeStyle=ACCENT; ctx.lineWidth=1.8; ctx.globalAlpha=0.6; ctx.lineCap='round'; ctx.stroke();
    ctx.globalAlpha=1;
  });

  // Labels (always — canvas text is cheap)
  drawLabels(sc);
}

function drawLabels(sc){
  const C_LO=R*1.3,C_HI=R*2.0,S_LO=R*2.0,S_HI=R*3.0;
  const cOp=Math.max(0,Math.min(0.75,(sc-C_LO)/(C_HI-C_LO)*0.75));
  const sOp=Math.max(0,Math.min(0.80,(sc-S_LO)/(S_HI-S_LO)*0.80));
  const cSz=Math.max(7,Math.min(13,9*(sc/R)));
  const sSz=Math.max(6,Math.min(11,8*(sc/R)));
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if(cOp>0){
    ctx.font=\`600 \${cSz}px system-ui,-apple-system,sans-serif\`;
    cLabelData.forEach(d=>{
      if(!isVisible(d.centroid))return;
      const pt=proj(d.centroid); if(!pt)return;
      ctx.globalAlpha=cOp; ctx.fillStyle='#fff'; ctx.fillText(d.name,pt[0],pt[1]);
    });
  }
  if(sOp>0){
    ctx.font=\`600 \${sSz}px system-ui,-apple-system,sans-serif\`;
    sLabelData.forEach(d=>{
      if(!isVisible(d.centroid))return;
      const pt=proj(d.centroid); if(!pt)return;
      ctx.globalAlpha=sOp; ctx.fillStyle='rgba(255,255,255,0.75)';
      ctx.fillText(sc>=R*3.5?d.name:d.code,pt[0],pt[1]);
    });
  }
  ctx.globalAlpha=1;
}

// ── Animated dots ──────────────────────────────────────────────────────
function drawDots(ts){
  animDots.forEach(o=>{
    const t=(((ts/o.period)+o.offset)%1+1)%1;
    const coord=o.interp(t);
    if(!isVisible(coord))return;
    const pt=proj(coord); if(!pt)return;
    ctx.beginPath(); ctx.arc(pt[0],pt[1],7,0,2*Math.PI);
    ctx.fillStyle=ACCENT; ctx.globalAlpha=0.3;
    ctx.shadowBlur=12; ctx.shadowColor=ACCENT; ctx.fill(); ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(pt[0],pt[1],3,0,2*Math.PI);
    ctx.fillStyle='#fff'; ctx.globalAlpha=1; ctx.fill();
  });
}

function buildRoutes(routes){
  routeData=routes.filter(r=>r.fromLon!=null);
  animDots=routeData.map((r,i)=>({
    interp:d3.geoInterpolate([r.fromLon,r.fromLat],[r.toLon,r.toLat]),
    period:3200+i*430,offset:i*0.23
  }));
}
window.__globeUpdateRoutes=function(routes){buildRoutes(routes);};

// ── Animation loop ─────────────────────────────────────────────────────
function animateLoop(ts){
  let moving=isDragging;
  if(inertiaActive){
    rotVx*=FRICTION; rotVy*=FRICTION;
    if(Math.abs(rotVx)<VEL_MIN&&Math.abs(rotVy)<VEL_MIN){
      inertiaActive=false; rotVx=0; rotVy=0; lastTouchEndTime=ts;
    }else{
      const r=proj.rotate();
      proj.rotate([r[0]+rotVx,Math.max(-90,Math.min(90,r[1]+rotVy))]);
      moving=true;
    }
  }
  if(!isDragging&&!inertiaActive&&ts-lastTouchEndTime>AUTO_DELAY_MS){
    const r=proj.rotate();
    proj.rotate([r[0]+AUTO_SPEED,r[1]]);
    moving=true;
  }
  draw(moving);
  if(animDots.length>0)drawDots(ts);
  requestAnimationFrame(animateLoop);
}
requestAnimationFrame(animateLoop);

// ── Load data ──────────────────────────────────────────────────────────
Promise.all([
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r=>r.json()),
  fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(r=>r.json()),
]).then(([world,us])=>{
  const countries=topojson.feature(world,world.objects.countries);
  const states=topojson.feature(us,us.objects.states);
  usCountryFeature=countries.features.find(f=>+f.id===840)||null;
  worldFeatures=countries.features.filter(f=>+f.id!==840);
  usFeatures=states.features;
  cLabelData=countries.features.filter(f=>+f.id!==840&&CNAMES[String(f.id)])
    .map(f=>({centroid:d3.geoCentroid(f),name:CNAMES[String(f.id)]}));
  sLabelData=states.features.map(f=>{
    const k=String(f.id).padStart(2,'0'),code=FIPS[k]||'';
    return{centroid:d3.geoCentroid(f),code,name:SNAMES[code]||code};
  }).filter(d=>d.code);
  topoReady=true;
  buildRoutes(pendingRoutes);
}).catch(()=>{});

// ── Touch ──────────────────────────────────────────────────────────────
document.addEventListener('touchstart',e=>{
  if(e.touches.length===2)e.preventDefault();
  inertiaActive=false; rotVx=0; rotVy=0; isDragging=false;
  lastTouchEndTime=performance.now();
  tapStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
  if(e.touches.length===1){
    t0={x:e.touches[0].clientX,y:e.touches[0].clientY};
    r0=[...proj.rotate()];
    prevTouchX=e.touches[0].clientX; prevTouchY=e.touches[0].clientY;
    p0=null;
  }else{
    const a=e.touches[0],b=e.touches[1];
    p0=Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
    s0=proj.scale(); t0=null;
  }
},{passive:false});

document.addEventListener('touchmove',e=>{
  e.preventDefault(); lastTouchEndTime=performance.now();
  if(e.touches.length===1&&t0&&r0){
    isDragging=true;
    const cx=e.touches[0].clientX,cy=e.touches[0].clientY;
    const dx=cx-t0.x,dy=cy-t0.y,k=0.35;
    rotVx=rotVx*0.4+(cx-prevTouchX)*k*0.6;
    rotVy=rotVy*0.4-(cy-prevTouchY)*k*0.6;
    prevTouchX=cx; prevTouchY=cy;
    proj.rotate([r0[0]+dx*k,Math.max(-90,Math.min(90,r0[1]-dy*k))]);
  }else if(e.touches.length===2&&p0!==null){
    isDragging=true;
    const a=e.touches[0],b=e.touches[1];
    const d=Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
    proj.scale(Math.max(R*0.8,Math.min(R*6,s0*d/p0)));
  }
},{passive:false});

document.addEventListener('touchend',e=>{
  const wasDragging=isDragging;
  isDragging=false; t0=null; p0=null;
  lastTouchEndTime=performance.now();
  if(Math.abs(rotVx)>VEL_MIN||Math.abs(rotVy)>VEL_MIN)inertiaActive=true;
  // Tap detection
  if(!wasDragging&&tapStart&&topoReady){
    const x=tapStart.x,y=tapStart.y;
    const ll=proj.invert([x,y]);
    if(ll){
      let hit=false;
      for(const r of routeData){
        const interp=d3.geoInterpolate([r.fromLon,r.fromLat],[r.toLon,r.toLat]);
        for(let t=0;t<=1;t+=0.05){
          const pt=proj(interp(t));
          if(pt&&Math.hypot(pt[0]-x,pt[1]-y)<14){
            window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'routeTap',flightId:r.flightId}));
            hit=true; break;
          }
        }
        if(hit)break;
      }
      if(!hit){
        for(const f of usFeatures){
          if(d3.geoContains(f,ll)){
            const k=String(f.id).padStart(2,'0'),s=FIPS[k]||'';
            window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'tap',name:SNAMES[s]||s,id:s,isState:true}));
            hit=true; break;
          }
        }
      }
      if(!hit){
        for(const f of worldFeatures){
          if(d3.geoContains(f,ll)){
            window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'tap',name:CNAMES[String(f.id)]||'Unknown',id:String(f.id),isState:false}));
            break;
          }
        }
      }
    }
  }
  tapStart=null;
});

// ── Messages ───────────────────────────────────────────────────────────
function onMsg(e){
  try{
    const d=JSON.parse(e.data);
    if(d.type==='update'){vCountries=new Set(d.countries.map(String));vStates=new Set(d.states);}
  }catch{}
}
window.addEventListener('message',onMsg);
document.addEventListener('message',onMsg);
window.__globeUpdate=function(c,s){vCountries=new Set(c.map(String));vStates=new Set(s);};
</script>
</body>
</html>`;
}

export default function GlobeView({
  theme, isDark, visitedCountryIds, visitedStateCodes,
  routes, verticalOffset = 0, scale = 0.42, onRegionTap, onRouteTap,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const routeCoords: RouteCoord[] = (routes ?? []).flatMap(r => {
    const from = AIRPORT_COORDS[r.fromCode];
    const to   = AIRPORT_COORDS[r.toCode];
    if (!from || !to) return [];
    return [{ fromLon: from[0], fromLat: from[1], toLon: to[0], toLat: to[1], flightId: r.flightId }];
  });

  // Memoize the HTML source so the WebView never reloads on unrelated parent re-renders
  const htmlSource = useMemo(
    () => ({ html: buildHTML(theme.accent, isDark, verticalOffset, scale) }),
    [theme.accent, isDark, verticalOffset, scale],
  );

  function push() {
    const js = `window.__globeUpdate(${JSON.stringify(visitedCountryIds)},${JSON.stringify(visitedStateCodes)});window.__globeUpdateRoutes(${JSON.stringify(routeCoords)});true;`;
    webViewRef.current?.injectJavaScript(js);
  }

  // Stable string keys so the effect doesn't fire on every render
  const countriesKey  = visitedCountryIds.join(',');
  const statesKey     = visitedStateCodes.join(',');
  const routeCoordsKey = routeCoords.map(r => r.flightId).join(',');

  useEffect(() => {
    if (ready) push();
  }, [countriesKey, statesKey, routeCoordsKey, ready]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={htmlSource}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        cacheEnabled
        originWhitelist={['*']}
        onLoadStart={() => setReady(false)}
        onLoad={() => { setReady(true); push(); }}
        onMessage={e => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.type === 'tap')      onRegionTap?.(d.name, d.id, d.isState);
            if (d.type === 'routeTap') onRouteTap?.(d.flightId);
          } catch {}
        }}
      />
      {!ready && (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
