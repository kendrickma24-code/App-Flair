import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Theme } from '../constants/theme';
import { TrendingRoute } from '../services/messages';
import { AIRPORT_COORDS } from '../data/airportCoords';

const SCREEN_W = Dimensions.get('window').width;

interface Props {
  routes: TrendingRoute[];
  theme: Theme;
  isDark: boolean;
  height?: number;
}

export default function FlightMapView({ routes, theme, isDark, height = 300 }: Props) {
  const html = useMemo(() => buildHtml(routes, theme, isDark, SCREEN_W, height), [routes, isDark]);

  return (
    <View style={[styles.wrap, { height, borderRadius: 20, overflow: 'hidden' }]}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        pointerEvents="none"
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled={false}
      />
    </View>
  );
}

function buildHtml(routes: TrendingRoute[], theme: Theme, isDark: boolean, W: number, H: number): string {
  const routeData = routes
    .filter(r => AIRPORT_COORDS[r.fromCode] && AIRPORT_COORDS[r.toCode])
    .map(r => ({
      fromLon: AIRPORT_COORDS[r.fromCode][0],
      fromLat: AIRPORT_COORDS[r.fromCode][1],
      toLon:   AIRPORT_COORDS[r.toCode][0],
      toLat:   AIRPORT_COORDS[r.toCode][1],
      from:    r.fromCode,
      to:      r.toCode,
    }));

  const routeJson   = JSON.stringify(routeData);
  const bgColor     = isDark ? '#0d1117' : '#dce8fa';
  const landColor   = isDark ? '#1a2738' : '#b8cfe8';
  const borderColor = isDark ? '#243347' : '#94b8d8';
  const arcColor    = theme.accent;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; overflow:hidden; background:${bgColor}; }
  svg { display:block; width:100%; height:100%; }
</style>
</head>
<body>
<svg id="mapsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dotglow" x="-300%" y="-300%" width="700%" height="700%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${bgColor}"/>
  <g id="world"/>
  <g id="arcs"/>
</svg>

<script>
(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var W = ${W}, H = ${H};
  var ROUTES  = ${routeJson};
  var ACCENT  = '${arcColor}';
  var LAND    = '${landColor}';
  var BORDER  = '${borderColor}';

  function loadScript(url, cb) {
    var s = document.createElement('script');
    s.src = url; s.onload = cb; s.onerror = function () {};
    document.head.appendChild(s);
  }

  function drawAll(d3, topojson, world) {
    var proj = d3.geoMercator()
      .scale(W / (2 * Math.PI))
      .translate([W / 2, H / 2]);

    // Countries
    var pathGen = d3.geoPath().projection(proj);
    d3.select('#world')
      .selectAll('path')
      .data(topojson.feature(world, world.objects.countries).features)
      .join('path')
      .attr('d', pathGen)
      .attr('fill', LAND)
      .attr('stroke', BORDER)
      .attr('stroke-width', '0.4');

    // Arcs + animated dots via rAF
    var arcsGrp = document.getElementById('arcs');
    var seen = {};
    var dotData = [];

    ROUTES.forEach(function (r, i) {
      var key = [r.from, r.to].sort().join('-');
      if (seen[key]) return;

      var p1 = proj([r.fromLon, r.fromLat]);
      var p2 = proj([r.toLon,   r.toLat]);
      if (!p1 || !p2) return;

      var x1 = p1[0], y1 = p1[1];
      var x2 = p2[0], y2 = p2[1];

      // Skip date-line wraps
      if (Math.abs(x2 - x1) > W * 0.6) return;

      seen[key] = true;

      var mx   = (x1 + x2) / 2;
      var dist = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
      var qcy  = Math.min(y1, y2) - Math.min(dist * 0.32, H * 0.4);
      var d    = 'M'+x1+','+y1+' Q'+mx+','+qcy+' '+x2+','+y2;

      var arc = document.createElementNS(SVG_NS, 'path');
      arc.setAttribute('d', d);
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', ACCENT);
      arc.setAttribute('stroke-width', '1.5');
      arc.setAttribute('stroke-opacity', '0.8');
      arc.setAttribute('stroke-linecap', 'round');
      arc.setAttribute('filter', 'url(#glow)');
      arcsGrp.appendChild(arc);

      // Endpoint dots
      [[x1,y1],[x2,y2]].forEach(function (pt) {
        var dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', pt[0]); dot.setAttribute('cy', pt[1]);
        dot.setAttribute('r', '2.5');
        dot.setAttribute('fill', ACCENT);
        dot.setAttribute('opacity', '0.9');
        arcsGrp.appendChild(dot);
      });

      // Glowing animated dot (halo + core)
      var halo = document.createElementNS(SVG_NS, 'circle');
      halo.setAttribute('r', '6');
      halo.setAttribute('fill', ACCENT);
      halo.setAttribute('opacity', '0.5');
      halo.setAttribute('filter', 'url(#dotglow)');
      arcsGrp.appendChild(halo);

      var core = document.createElementNS(SVG_NS, 'circle');
      core.setAttribute('r', '2.5');
      core.setAttribute('fill', '#ffffff');
      core.setAttribute('opacity', '0.95');
      arcsGrp.appendChild(core);

      dotData.push({ halo: halo, core: core, x1:x1,y1:y1, mx:mx,qcy:qcy, x2:x2,y2:y2, period: 2800 + i * 430, offset: i * 0.23 });
    });

    // Quadratic bezier point at t
    function bezier(x1,y1,mx,cy,x2,y2,t) {
      var u = 1 - t;
      return { x: u*u*x1 + 2*u*t*mx + t*t*x2, y: u*u*y1 + 2*u*t*cy + t*t*y2 };
    }

    function animate(ts) {
      dotData.forEach(function(o) {
        var t = (((ts / o.period) + o.offset) % 1 + 1) % 1;
        var pt = bezier(o.x1, o.y1, o.mx, o.qcy, o.x2, o.y2, t);
        o.halo.setAttribute('cx', pt.x); o.halo.setAttribute('cy', pt.y);
        o.core.setAttribute('cx', pt.x); o.core.setAttribute('cy', pt.y);
      });
      requestAnimationFrame(animate);
    }
    if (dotData.length > 0) requestAnimationFrame(animate);
  }

  loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js', function () {
    loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js', function () {
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
        .then(function (r) { return r.json(); })
        .then(function (w) { drawAll(window.d3, window.topojson, w); })
        .catch(function () {});
    });
  });
})();
</script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
