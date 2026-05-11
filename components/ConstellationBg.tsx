import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  bgColor: string;
  isDark: boolean;
}

// Star positions as [x, y] in 100×100 viewBox mapped to full screen.
// Constellations spread across full screen height so stars appear behind all content.
const POS: Record<string, [number, number]> = {
  // ── Ursa Major (Big Dipper) — upper screen ───────────────
  alkaid: [85, 7],  mizar: [76,  9],  alioth: [66, 13],
  megrez: [57, 17], phecda:[59, 25],  merak:  [49, 27], dubhe: [47, 18],
  // ── Cassiopeia (W) — upper-left ──────────────────────────
  ec: [4,  9],  rc: [11, 14], gc: [18,  9], sc: [25, 14], cp: [32, 9],
  // ── Polaris — top center ─────────────────────────────────
  polaris: [34, 3],
  // ── Leo — mid-screen ─────────────────────────────────────
  reg: [28, 42], etl: [20, 37], gml: [22, 32],
  ztl: [21, 27], epl: [15, 31], dnb: [42, 40], dll: [35, 36],
  // ── Orion — lower-mid screen ─────────────────────────────
  btg: [62, 57], blt: [75, 59],
  atz: [64, 67], aln: [70, 66], mnt: [76, 65],
  sph: [63, 77], rgl: [77, 76],
};

const RADII: Record<string, number> = {
  btg: 3.0, rgl: 2.8,
  reg: 2.4, alkaid: 2.2, alioth: 2.2, blt: 2.2, dnb: 2.2, aln: 2.1,
  sc: 2.1, dubhe: 2.1, merak: 2.0, mizar: 2.0, atz: 2.0, sph: 2.0,
  gc: 2.0, gml: 2.0, polaris: 2.3,
  phecda: 1.9, mnt: 1.9, cp: 1.8, ec: 1.8, epl: 1.8, dll: 1.8,
  rc: 1.7, etl: 1.7, ztl: 1.7, megrez: 1.6,
};

const LINES: [string, string][] = [
  ['alkaid','mizar'],['mizar','alioth'],['alioth','megrez'],
  ['megrez','phecda'],['phecda','merak'],['merak','dubhe'],['dubhe','megrez'],
  ['ec','rc'],['rc','gc'],['gc','sc'],['sc','cp'],
  ['btg','blt'],['btg','atz'],['blt','mnt'],
  ['atz','aln'],['aln','mnt'],['atz','sph'],['mnt','rgl'],
  ['reg','etl'],['etl','gml'],['gml','ztl'],['ztl','epl'],
  ['reg','dll'],['dll','dnb'],['dll','gml'],
];

// 160 deterministic field stars spread across full screen
const FIELD = Array.from({ length: 160 }, (_, i) => ({
  x: +((i * 37.31 + 13.7) % 100).toFixed(1),
  y: +((i * 53.73 + 7.3)  % 100).toFixed(1),
  r: +(0.2 + (i % 6) * 0.07).toFixed(2),
})).filter(s =>
  !Object.values(POS).some(([sx, sy]) => Math.abs(s.x - sx) < 4 && Math.abs(s.y - sy) < 4)
);

export default function ConstellationBg({ bgColor, isDark }: Props) {
  const lo = isDark ? 0.25 : 0.08;
  const so = isDark ? 0.88 : 0.18;
  const fo = isDark ? 0.48 : 0.12;
  const go = isDark ? 0.12 : 0.04;

  const linesSvg = LINES.map(([a, b]) => {
    const [x1, y1] = POS[a]; const [x2, y2] = POS[b];
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(150,190,255,${lo})" stroke-width="0.35" stroke-linecap="round"/>`;
  }).join('');

  const starsSvg = Object.entries(POS).map(([id, [x, y]]) => {
    const r = RADII[id] ?? 1.5;
    const col = id === 'btg'
      ? `rgba(255,205,145,${so})`
      : id === 'rgl' || id === 'reg'
        ? `rgba(185,215,255,${so})`
        : id === 'polaris'
          ? `rgba(255,245,210,${so})`
          : `rgba(220,235,255,${so})`;
    const glow = r >= 2.0
      ? `<circle cx="${x}" cy="${y}" r="${+(r*2.3).toFixed(1)}" fill="${col}" opacity="${go}"/>`
      : '';
    const tw = r >= 2.5 ? ` class="tw${Math.round(x + y) % 3}"` : '';
    return `${glow}<circle cx="${x}" cy="${y}" r="${r}"${tw} fill="${col}"/>`;
  }).join('');

  const fieldSvg = FIELD.map(({ x, y, r }) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(210,225,255,${fo})"/>`
  ).join('');

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:${bgColor};overflow:hidden}
@keyframes tw0{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes tw1{0%,100%{opacity:0.6}50%{opacity:1}}
@keyframes tw2{0%,100%{opacity:0.85}40%{opacity:0.25}80%{opacity:1}}
.tw0{animation:tw0 2.4s ease-in-out infinite}
.tw1{animation:tw1 3.6s ease-in-out infinite 1s}
.tw2{animation:tw2 1.9s ease-in-out infinite 0.4s}
</style>
</head><body>
<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
  <g opacity="0.9">${fieldSvg}</g>
  ${linesSvg}
  ${starsSvg}
</svg>
</body></html>`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        source={{ html }}
        scrollEnabled={false}
        userInteractionEnabled={false}
        style={{ width: W, height: H, backgroundColor: bgColor }}
      />
    </View>
  );
}
