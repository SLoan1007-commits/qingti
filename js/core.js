/* 轻体日志 v2 — shared engine: utilities, move animations, food art, courses, recipes, music.
   Most of this comes from v1; v2 additions are at the end. */
"use strict";

/* ================================================================
   Utils
   ================================================================ */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2,"0");
const ds = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const pd = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const addD = (s,n) => { const d = pd(s); d.setDate(d.getDate()+n); return ds(d); };
const today = () => ds(new Date());
const wdi = s => (pd(s).getDay()+6)%7;
const diffD = (a,b) => Math.round((pd(b)-pd(a))/864e5);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const f1 = n => (Math.round(n*10)/10).toFixed(1);
const clone = o => JSON.parse(JSON.stringify(o));
const courseById = id => COURSES.find(c => c.id === id);
const recipeById = id => RECIPES.find(r => r.id === id);
const pick = a => a[Math.floor(Math.random()*a.length)];
const ICON = {
  check:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 8.5l3 3 7-7"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6v12l8.5-6zM16 6h2.5v12H16z"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/></svg>',
  music:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>'
};
const videoUrl = name => "https://search.bilibili.com/all?keyword=" + encodeURIComponent(name + " 动作教学");
/* ================================================================
   Pose engine — stick-figure demos drawn on canvas.
   Coordinates: 0..100 wide, ground at y=100. Angles in degrees,
   0 = straight down, 90 = forward (right), 180 = up, -90 = back.
   "l" limbs are the far side (lighter), "r" limbs the near side.
   ================================================================ */
const BASE = {x:50,y:66,t:180,h:0,la1:6,la2:6,ra1:-6,ra2:-6,ll1:2,ll2:2,rl1:-2,rl2:-2};
const P = o => Object.assign({}, BASE, o);
const STAND = P({});
const SQ = P({x:44,y:81,t:150,ll1:80,ll2:-12,rl1:80,rl2:-12,la1:90,la2:90,ra1:90,ra2:90});
const PLANK_HI = P({x:53,y:84,t:110,la1:0,la2:0,ra1:0,ra2:0,ll1:-70,ll2:-70,rl1:-70,rl2:-70});
const FOURS = P({x:40,y:83,t:110,la1:0,la2:0,ra1:0,ra2:0,ll1:0,ll2:-90,rl1:0,rl2:-90});
const LIE = P({x:55,y:96,t:-90,la1:90,la2:90,ra1:90,ra2:90,ll1:92,ll2:92,rl1:92,rl2:92});
const ANIMS = {
  stand:{k:[P({la1:6,ra1:-6})]},
  march:{d:420,k:[P({ll1:70,ll2:-5,la1:-25,la2:-10,ra1:40,ra2:80}),P({rl1:70,rl2:-5,ra1:-25,ra2:-10,la1:40,la2:80})]},
  walk:{d:460,k:[P({t:178,y:67,ll1:25,ll2:15,rl1:-25,rl2:-35,la1:-25,la2:-15,ra1:25,ra2:50}),P({t:178,y:67,ll1:-25,ll2:-35,rl1:25,rl2:15,la1:25,la2:50,ra1:-25,ra2:-15})]},
  run:{d:300,k:[P({t:170,y:63,ll1:55,ll2:-15,rl1:-35,rl2:-85,la1:-40,la2:40,ra1:45,ra2:130}),P({t:170,y:63,rl1:55,rl2:-15,ll1:-35,ll2:-85,ra1:-40,ra2:40,la1:45,la2:130})]},
  highknee:{d:260,k:[P({y:64,ll1:92,ll2:0,ra1:70,ra2:150,la1:-30,la2:20}),P({y:64,rl1:92,rl2:0,la1:70,la2:150,ra1:-30,ra2:20})]},
  kneeup:{d:520,k:[P({la1:170,la2:175,ra1:170,ra2:175}),P({rl1:100,rl2:0,ra1:95,ra2:150,la1:95,la2:150,t:172}),P({la1:170,la2:175,ra1:170,ra2:175}),P({ll1:100,ll2:0,ra1:95,ra2:150,la1:95,la2:150,t:172})]},
  jack:{front:true,d:320,k:[P({la1:14,la2:12,ra1:-14,ra2:-12,ll1:5,ll2:5,rl1:-5,rl2:-5}),P({y:63,la1:150,la2:165,ra1:-150,ra2:-165,ll1:22,ll2:22,rl1:-22,rl2:-22})]},
  steptouch:{front:true,d:460,k:[P({x:46,ll1:6,ll2:6,rl1:-22,rl2:-22,la1:40,la2:110,ra1:-40,ra2:-110}),P({x:54,ll1:22,ll2:22,rl1:-6,rl2:-6,la1:40,la2:110,ra1:-40,ra2:-110})]},
  skater:{front:true,d:440,k:[P({x:40,y:70,t:192,ll1:-8,ll2:0,rl1:-40,rl2:-70,la1:-60,la2:-50,ra1:-30,ra2:-20}),P({x:60,y:70,t:168,rl1:8,rl2:0,ll1:40,ll2:70,ra1:60,ra2:50,la1:30,la2:20})]},
  squat:{d:780,k:[P({x:56,la1:8,ra1:-8}),SQ]},
  squatjump:{d:360,k:[P({x:56}),SQ,P({x:56,y:57,la1:172,la2:176,ra1:170,ra2:176,ll1:4,ll2:-4,rl1:-4,rl2:-8}),SQ]},
  wallsit:{props:["wall"],k:[P({x:42,y:82,t:180,ll1:90,ll2:0,rl1:90,rl2:0,la1:20,la2:80,ra1:20,ra2:80})]},
  sumo:{front:true,d:820,k:[P({ll1:13,ll2:13,rl1:-13,rl2:-13,la1:22,la2:-120,ra1:-22,ra2:120}),P({y:74,ll1:55,ll2:10,rl1:-55,rl2:-10,la1:22,la2:-120,ra1:-22,ra2:120})]},
  lunge:{d:820,k:[P({x:48,la1:-30,la2:60,ra1:-30,ra2:60}),P({x:48,y:81,rl1:85,rl2:0,ll1:-20,ll2:-80,la1:-30,la2:60,ra1:-30,ra2:60}),P({x:48,la1:-30,la2:60,ra1:-30,ra2:60}),P({x:48,y:81,ll1:85,ll2:0,rl1:-20,rl2:-80,la1:-30,la2:60,ra1:-30,ra2:60})]},
  calfraise:{d:620,k:[P({}),P({y:61,ll1:4,ll2:-6,rl1:0,rl2:-8})]},
  pushup:{d:780,k:[PLANK_HI,P({x:47,y:93,t:100,la1:-30,la2:90,ra1:-30,ra2:90,ll1:-80,ll2:-80,rl1:-80,rl2:-80})]},
  kneepush:{d:780,k:[P({x:53,y:84,t:110,la1:0,la2:0,ra1:0,ra2:0,ll1:-40,ll2:-120,rl1:-40,rl2:-120}),P({x:47,y:93,t:100,la1:-30,la2:90,ra1:-30,ra2:90,ll1:-70,ll2:-120,rl1:-70,rl2:-120})]},
  plank:{k:[P({x:45,y:91,t:100,la1:0,la2:90,ra1:0,ra2:90,ll1:-80,ll2:-80,rl1:-80,rl2:-80})]},
  sideplank:{k:[P({x:45,y:88,t:106,la1:0,la2:90,ra1:180,ra2:180,ll1:-76,ll2:-76,rl1:-74,rl2:-74})]},
  plankshoulder:{d:420,k:[PLANK_HI,P(Object.assign({},PLANK_HI,{ra1:125,ra2:-110})),PLANK_HI,P(Object.assign({},PLANK_HI,{la1:125,la2:-110}))]},
  climber:{d:250,k:[P(Object.assign({},PLANK_HI,{rl1:40,rl2:-100})),P(Object.assign({},PLANK_HI,{ll1:40,ll2:-100}))]},
  burpee:{d:380,k:[P({x:52}),P({x:50,y:84,t:120,la1:0,la2:0,ra1:0,ra2:0,ll1:90,ll2:-30,rl1:90,rl2:-30}),PLANK_HI,P({x:50,y:84,t:120,la1:0,la2:0,ra1:0,ra2:0,ll1:90,ll2:-30,rl1:90,rl2:-30}),P({x:52,y:57,la1:172,la2:176,ra1:170,ra2:176})]},
  bridge:{d:900,k:[P({x:45,y:95,t:-90,la1:90,la2:90,ra1:90,ra2:90,ll1:120,ll2:30,rl1:120,rl2:30}),P({x:45,y:83,t:-70,la1:90,la2:90,ra1:90,ra2:90,ll1:100,ll2:20,rl1:100,rl2:20})]},
  crunch:{d:720,k:[P(Object.assign({},LIE,{ll1:140,ll2:30,rl1:140,rl2:30,la1:110,la2:110,ra1:110,ra2:110})),P(Object.assign({},LIE,{t:-125,ll1:140,ll2:30,rl1:140,rl2:30,la1:105,la2:100,ra1:105,ra2:100}))]},
  twist:{d:520,k:[P({x:50,y:96,t:-150,ll1:130,ll2:80,rl1:130,rl2:80,la1:130,la2:120,ra1:130,ra2:120}),P({x:50,y:96,t:-146,ll1:130,ll2:80,rl1:130,rl2:80,la1:65,la2:55,ra1:65,ra2:55})]},
  deadbug:{d:700,k:[P(Object.assign({},LIE,{la1:180,la2:180,ra1:180,ra2:180,ll1:180,ll2:90,rl1:180,rl2:90})),P(Object.assign({},LIE,{la1:180,la2:180,ra1:-100,ra2:-100,ll1:100,ll2:100,rl1:180,rl2:90})),P(Object.assign({},LIE,{la1:180,la2:180,ra1:180,ra2:180,ll1:180,ll2:90,rl1:180,rl2:90})),P(Object.assign({},LIE,{la1:-100,la2:-100,ra1:180,ra2:180,ll1:180,ll2:90,rl1:100,rl2:100}))]},
  legraise:{d:900,k:[P(Object.assign({},LIE,{ll1:96,ll2:96,rl1:96,rl2:96})),P(Object.assign({},LIE,{ll1:172,ll2:172,rl1:172,rl2:172}))]},
  sidelegraise:{d:700,k:[P({x:55,y:94,t:-90,la1:-160,la2:-30,ra1:120,ra2:60,ll1:90,ll2:90,rl1:90,rl2:90}),P({x:55,y:94,t:-90,la1:-160,la2:-30,ra1:120,ra2:60,ll1:90,ll2:90,rl1:128,rl2:128})]},
  donkeykick:{d:620,k:[FOURS,P(Object.assign({},FOURS,{rl1:-120,rl2:-150}))]},
  superman:{d:900,k:[P({x:45,y:96,t:90,la1:90,la2:90,ra1:90,ra2:90,ll1:-90,ll2:-90,rl1:-90,rl2:-90}),P({x:45,y:95,t:100,la1:103,la2:103,ra1:103,ra2:103,ll1:-102,ll2:-102,rl1:-102,rl2:-102})]},
  ytw:{d:850,k:[P({x:45,y:95,t:100,la1:120,la2:120,ra1:120,ra2:120,ll1:-90,ll2:-90,rl1:-90,rl2:-90}),P({x:45,y:95,t:100,la1:175,la2:175,ra1:175,ra2:175,ll1:-90,ll2:-90,rl1:-90,rl2:-90}),P({x:45,y:95,t:100,la1:-150,la2:150,ra1:-150,ra2:150,ll1:-90,ll2:-90,rl1:-90,rl2:-90})]},
  dip:{props:["bench"],d:820,k:[P({x:38,y:80,t:180,la1:-15,la2:-15,ra1:-15,ra2:-15,ll1:90,ll2:0,rl1:90,rl2:0}),P({x:38,y:92,t:180,la1:-100,la2:30,ra1:-100,ra2:30,ll1:105,ll2:35,rl1:105,rl2:35})]},
  boxing:{d:300,k:[P({ll1:-12,ll2:-12,rl1:14,rl2:10,ra1:90,ra2:90,la1:40,la2:160}),P({ll1:-12,ll2:-12,rl1:14,rl2:10,ra1:40,ra2:160,la1:90,la2:90})]},
  armcircle:{front:true,d:240,k:[P({la1:88,la2:88,ra1:-88,ra2:-88}),P({la1:96,la2:100,ra1:-96,ra2:-100})]},
  chestopen:{d:700,k:[P({la1:90,la2:90,ra1:90,ra2:90}),P({la1:-55,la2:-30,ra1:-55,ra2:-30})]},
  wallangel:{front:true,d:1000,k:[P({la1:95,la2:175,ra1:-95,ra2:-175}),P({la1:150,la2:160,ra1:-150,ra2:-160})]},
  sidebend:{front:true,d:1300,k:[P({t:162,la1:150,la2:120,ra1:-10,ra2:-10}),P({t:198,ra1:-150,ra2:-120,la1:10,la2:10})]},
  twiststand:{front:true,d:620,k:[P({la1:80,la2:150,ra1:-30,ra2:-150,t:184}),P({ra1:-80,ra2:-150,la1:30,la2:150,t:176})]},
  neck:{front:true,d:1500,k:[P({h:-24}),P({h:24})]},
  shoulderroll:{open:true,d:300,k:[P({ra1:0,ra2:0}),P({ra1:90,ra2:90}),P({ra1:180,ra2:180}),P({ra1:270,ra2:270}),P({ra1:360,ra2:360})]},
  catcow:{d:1400,k:[P(Object.assign({},FOURS,{y:85,t:104,h:30})),P(Object.assign({},FOURS,{y:81,t:116,h:-40}))]},
  downdog:{k:[P({x:45,y:64,t:55,la1:55,la2:55,ra1:55,ra2:55,ll1:-15,ll2:-15,rl1:-15,rl2:-15})]},
  warrior1:{k:[P({x:48,y:77,rl1:80,rl2:0,ll1:-45,ll2:-45,la1:178,la2:178,ra1:180,ra2:180})]},
  warrior2:{front:true,k:[P({y:75,ll1:55,ll2:0,rl1:-35,rl2:-35,la1:90,la2:90,ra1:-90,ra2:-90})]},
  triangle:{front:true,k:[P({y:70,t:112,ll1:30,ll2:30,rl1:-30,rl2:-30,la1:0,la2:0,ra1:180,ra2:180})]},
  child:{k:[P({x:40,y:90,t:95,la1:85,la2:85,ra1:85,ra2:85,ll1:60,ll2:-90,rl1:60,rl2:-90})]},
  fold:{k:[P({x:35,y:96,t:106,la1:82,la2:82,ra1:82,ra2:82,ll1:90,ll2:90,rl1:90,rl2:90})]},
  lyingtwist:{k:[P(Object.assign({},LIE,{la1:-150,la2:-150,ll1:135,ll2:60,rl1:120,rl2:50}))]},
  corpse:{k:[P(Object.assign({},LIE,{y:97}))]},
  hugknees:{d:1300,k:[P(Object.assign({},LIE,{ll1:-150,ll2:120,rl1:-150,rl2:120,la1:140,la2:60,ra1:140,ra2:60})),P(Object.assign({},LIE,{y:95,t:-96,ll1:-145,ll2:125,rl1:-145,rl2:125,la1:140,la2:60,ra1:140,ra2:60}))]},
  butterfly:{front:true,d:1200,k:[P({y:92,ll1:70,ll2:-83,rl1:-70,rl2:83,la1:20,la2:-10,ra1:-20,ra2:10}),P({y:92,ll1:58,ll2:-80,rl1:-58,rl2:80,la1:20,la2:-10,ra1:-20,ra2:10})]},
  pigeon:{k:[P({x:50,y:90,t:176,rl1:88,rl2:-95,ll1:-88,ll2:-90,la1:20,la2:0,ra1:20,ra2:0})]},
  breathe:{front:true,k:[P({y:92,ll1:75,ll2:-80,rl1:-75,rl2:80,la1:28,la2:40,ra1:-28,ra2:-40})]},
  sunsalute:{d:1100,k:[P({}),P({la1:175,la2:178,ra1:173,ra2:178}),P({t:35,la1:-80,la2:-150,ra1:-80,ra2:-150}),P({la1:175,la2:178,ra1:173,ra2:178})]},
  jumprope:{props:["rope"],d:240,k:[P({la1:20,la2:70,ra1:20,ra2:70}),P({y:61,la1:20,la2:70,ra1:20,ra2:70,ll1:6,ll2:-6,rl1:2,rl2:-10})]}
};
const lerp = (a,b,f) => a + (b-a)*f;
const ease = f => f < .5 ? 2*f*f : 1 - Math.pow(-2*f+2, 2)/2;
function poseAt(an, t){
  const k = an.k, n = k.length;
  if (n === 1){ const p = Object.assign({}, k[0]); const s = Math.sin(t/1700*Math.PI*2); p.y += s*.7; p.la1 += s*3; p.ra1 -= s*3; return p; }
  const segs = an.open ? n-1 : n, d = an.d || 600, u = (t % (segs*d))/d, i = Math.floor(u);
  const f = ease(Math.min(1, (u-i)/.78)), a = k[i], b = k[an.open ? i+1 : (i+1)%n], out = {};
  for (const key in a) out[key] = lerp(a[key], b[key], f);
  out._phase = (t % (segs*d))/(segs*d);
  return out;
}
const V = (a, len) => [Math.sin(a*Math.PI/180)*len, Math.cos(a*Math.PI/180)*len];
let FIGC = null, figcAt = 0;
function figColors(){
  const now = performance.now();
  if (!FIGC || now - figcAt > 1500){
    const cs = getComputedStyle(document.documentElement);
    FIGC = {fig:cs.getPropertyValue("--fig").trim(), far:cs.getPropertyValue("--fig-far").trim(), line:cs.getPropertyValue("--line").trim(), soft:cs.getPropertyValue("--soft").trim(), gray:cs.getPropertyValue("--gray").trim()};
    figcAt = now;
  }
  return FIGC;
}
function drawFigure(cv, key, t){
  const an = ANIMS[key] || ANIMS.stand, ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  const c = figColors(), p = poseAt(an, t);
  const s = Math.min(W/120, H/112), ox = (W - 100*s)/2, oy = (H - 104*s)/2;
  const X = v => ox + v*s, Y = v => oy + v*s;
  ctx.clearRect(0,0,W,H);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // ground + shadow
  ctx.strokeStyle = c.line; ctx.lineWidth = 2*s;
  ctx.beginPath(); ctx.moveTo(X(-6), Y(101.5)); ctx.lineTo(X(106), Y(101.5)); ctx.stroke();
  const H0 = [p.x, p.y], N = [H0[0] + V(p.t,30)[0], H0[1] + V(p.t,30)[1]], hd = V(p.t + p.h, 9), HD = [N[0]+hd[0], N[1]+hd[1]];
  const limb = (o, a1, a2, l1, l2) => { const e = [o[0]+V(a1,l1)[0], o[1]+V(a1,l1)[1]]; return [o, e, [e[0]+V(a2,l2)[0], e[1]+V(a2,l2)[1]]]; };
  const seg = (pts, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w*s; ctx.beginPath(); ctx.moveTo(X(pts[0][0]),Y(pts[0][1])); for (const q of pts.slice(1)) ctx.lineTo(X(q[0]),Y(q[1])); ctx.stroke(); };
  (an.props||[]).forEach(pr => {
    ctx.fillStyle = c.soft; ctx.strokeStyle = c.gray; ctx.lineWidth = 1.5*s;
    if (pr === "bench"){ ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X(8),Y(74),26*s,27*s,3*s) : ctx.rect(X(8),Y(74),26*s,27*s); ctx.fill(); ctx.stroke(); }
    if (pr === "wall"){ ctx.fillRect(X(26),Y(20),8*s,82*s); ctx.strokeRect(X(26),Y(20),8*s,82*s); }
  });
  const farA = limb(N, p.la1, p.la2, 14, 13), farL = limb(H0, p.ll1, p.ll2, 17, 17);
  const nearA = limb(N, p.ra1, p.ra2, 14, 13), nearL = limb(H0, p.rl1, p.rl2, 17, 17);
  const farCol = an.front ? c.fig : c.far;
  seg(farL, farCol, 6.5); seg(farA, farCol, 5.5);
  seg([H0, N], c.fig, 9);
  ctx.fillStyle = c.fig; ctx.beginPath(); ctx.arc(X(HD[0]), Y(HD[1]), 7.2*s, 0, Math.PI*2); ctx.fill();
  seg(nearL, c.fig, 6.5); seg(nearA, c.fig, 5.5);
  if ((an.props||[]).includes("rope")){
    const hL = farA[2], hR = nearA[2], ph = p._phase || 0, up = Math.cos(ph*Math.PI*2);
    const midY = up > 0 ? 103 : p.y - 50, midX = (hL[0]+hR[0])/2;
    ctx.strokeStyle = c.gray; ctx.lineWidth = 1.6*s; ctx.beginPath();
    ctx.moveTo(X(hL[0]),Y(hL[1])); ctx.quadraticCurveTo(X(midX - 18), Y(midY), X(hR[0]), Y(hR[1])); ctx.stroke();
  }
}
// One animation loop drives every visible demo canvas.
const LIVE = new Map();
let loopOn = false;
const reduceMotion = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch(e){ return false; } })();
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { const r = LIVE.get(e.target); if (r) r.vis = e.isIntersecting; })) : null;
function sizeCanvas(cv){
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth*dpr), h = Math.round(cv.clientHeight*dpr);
  if (w && h && (cv.width !== w || cv.height !== h)){ cv.width = w; cv.height = h; }
}
function mountDemos(root){
  (root || document).querySelectorAll("canvas[data-anim]").forEach(cv => {
    if (LIVE.has(cv)) return;
    sizeCanvas(cv);
    const rec = {key:cv.dataset.anim, vis:!io, off:Math.random()*4000, always:cv.hasAttribute("data-always")};
    LIVE.set(cv, rec); if (io) io.observe(cv);
    drawFigure(cv, rec.key, rec.off);
  });
  if (!loopOn){ loopOn = true; requestAnimationFrame(loop); }
}
function loop(ts){
  for (const [cv, r] of LIVE){
    if (!cv.isConnected){ LIVE.delete(cv); if (io) io.unobserve(cv); continue; }
    if (!r.vis) continue;
    if (reduceMotion && !r.always) continue;
    sizeCanvas(cv); drawFigure(cv, cv.dataset.anim, ts + r.off);
  }
  if (LIVE.size) requestAnimationFrame(loop); else loopOn = false;
}
const demo = (key, cls="", always=false) => `<canvas data-anim="${key}" class="${cls}" ${always?"data-always":""} aria-label="动作示范动画"></canvas>`;


/* ================================================================
   Food illustrations (SVG, generated per recipe)
   ================================================================ */
const FOOD = {rice:"#F4EFE4",grain:"#E7D3A6",oat:"#DCC49B",milk:"#FBF8F1",yogurt:"#FAF5EE",egg:"#F3C44F",tomato:"#E2655A",greens:"#7FB46E",broccoli:"#5F9A59",cucumber:"#A3CF8F",
  salmon:"#F29D7E",fish:"#F2E6D6",beef:"#9E5D4B",chicken:"#EBCB9F",shrimp:"#F5A48E",tofu:"#F6ECD9",berry:"#6A64B0",banana:"#F4D46A",sweetpotato:"#E8955A",purple:"#8F5E9C",
  corn:"#F1CD4B",mushroom:"#B7977E",noodle:"#EAD5A6",soup:"#F0D7B0",avocado:"#A8C76A",pumpkin:"#EFA24C",carrot:"#EF8B4C",nuts:"#B9855A",apple:"#E25F5F",edamame:"#8EC26C",bread:"#E2B47C",orange:"#F7B25B"};
function rng(seed){ let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
const LIGHT = new Set(["rice","milk","yogurt","tofu","fish","soup"]);
function piece(k, x, y, R, sc=1){
  const c = FOOD[k] || "#ddd", rot = Math.round(R()*360), f = n => n.toFixed(1), st = LIGHT.has(k) ? ` stroke="#E3D5CC" stroke-width=".8"` : "";
  const T = `transform="translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${sc})"`;
  switch (k){
    case "egg": return `<g transform="translate(${f(x)} ${f(y)}) scale(${sc})"><path d="M-10 0 C-10 -7 -3 -8 1 -7 C7 -8 11 -3 10 2 C9 7 2 8 -2 7 C-7 7 -10 4 -10 0Z" fill="#FFFBF2" stroke="#EDE2D3" stroke-width=".8"/><circle cx="0" cy="0" r="4" fill="${c}"/><circle cx="-1.3" cy="-1.3" r="1.1" fill="#fff" opacity=".6"/></g>`;
    case "tomato": return `<g ${T}><circle r="5.6" fill="${c}"/><circle r="4" fill="#EE8A7C"/><circle cx="1.6" cy="-1" r=".8" fill="#F6D7A0"/><circle cx="-1.6" cy=".8" r=".8" fill="#F6D7A0"/><circle cx="0" cy="2" r=".8" fill="#F6D7A0"/></g>`;
    case "greens": case "cucumber": case "avocado": return k === "cucumber" ? `<g ${T}><circle r="4.6" fill="#6FA35F"/><circle r="3.7" fill="${c}"/><circle r="1.3" fill="#D8EBC9"/></g>` : `<g ${T}><path d="M-8 0 Q-2 -6 8 0 Q-2 6 -8 0Z" fill="${c}"/><path d="M-7 0 L7 0" stroke="#5E8F50" stroke-width=".7"/></g>`;
    case "broccoli": return `<g transform="translate(${f(x)} ${f(y)}) scale(${sc})"><rect x="-1.5" y="1" width="3" height="5" rx="1" fill="#9CC27F"/><circle cx="-3" cy="0" r="3.4" fill="${c}"/><circle cx="3" cy="0" r="3.4" fill="${c}"/><circle cx="0" cy="-2.6" r="3.6" fill="#6DAA62"/></g>`;
    case "corn": return `<g ${T}><rect x="-8" y="-3.6" width="16" height="7.2" rx="3.6" fill="${c}"/><path d="M-4 -3.4v6.8M0 -3.6v7.2M4 -3.4v6.8M-7 0h14" stroke="#E0B73A" stroke-width=".6"/></g>`;
    case "shrimp": return `<g ${T}><path d="M-4 3 A5 5 0 1 1 4 3" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/><path d="M-4 3 l-2 2" stroke="#E7826A" stroke-width="2" stroke-linecap="round"/></g>`;
    case "salmon": return `<g ${T}><rect x="-8" y="-5" width="16" height="10" rx="3" fill="${c}"/><path d="M-5 -5 l3 10M0 -5 l3 10M5 -5 l2 7" stroke="#FBD3C2" stroke-width="1"/></g>`;
    case "berry": return `<g transform="translate(${f(x)} ${f(y)}) scale(${sc})"><circle r="2.8" fill="${c}"/><circle cx="-.8" cy="-.8" r=".7" fill="#A9A5DA"/></g>`;
    case "banana": return `<g ${T}><circle r="4.2" fill="#FFF3C9" stroke="${c}" stroke-width="1.4"/><circle r="1" fill="#E5CF86"/></g>`;
    case "nuts": return `<g ${T}><ellipse rx="3.4" ry="2.2" fill="${c}"/><path d="M-2 0 h4" stroke="#8E6440" stroke-width=".6"/></g>`;
    case "edamame": return `<g ${T}><path d="M-8 0 Q-8 -3.6 -4 -3 Q0 -4 4 -3 Q8 -3.6 8 0 Q8 3.6 4 3 Q0 4 -4 3 Q-8 3.6 -8 0Z" fill="${c}"/><circle cx="-4" r="1.6" fill="#A8D58A"/><circle cx="0" r="1.6" fill="#A8D58A"/><circle cx="4" r="1.6" fill="#A8D58A"/></g>`;
    case "mushroom": return `<g ${T}><path d="M-6 0 Q-6 -6 0 -6 Q6 -6 6 0Z" fill="${c}"/><rect x="-2" y="0" width="4" height="4" rx="1" fill="#EBDDCB"/></g>`;
    case "carrot": case "pumpkin": case "sweetpotato": case "purple": return `<g ${T}><rect x="-4.4" y="-4.4" width="8.8" height="8.8" rx="2.2" fill="${c}"/><rect x="-2.8" y="-2.8" width="3" height="3" rx="1" fill="#fff" opacity=".2"/></g>`;
    case "beef": case "chicken": case "fish": case "tofu": return `<g ${T}><rect x="-7" y="-4.4" width="14" height="8.8" rx="${k==="tofu"?1.6:3.4}" fill="${c}"${st}/><path d="M-4 -2 h6" stroke="#fff" stroke-width="1" opacity=".35" stroke-linecap="round"/></g>`;
    default: return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(5*sc)}" ry="${f(3.6*sc)}" transform="rotate(${rot} ${f(x)} ${f(y)})" fill="${c}"${st}/>`;
  }
}
function base(k, cx, cy, rx, ry, R){
  // a mound of rice/grains or a nest of noodles
  const c = FOOD[k];
  let g = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"${LIGHT.has(k)?' stroke="#E8DCD2" stroke-width=".8"':""}/>`;
  if (k === "noodle") for (let i=0;i<7;i++){ const y = cy - ry*.7 + i*ry*.23; g += `<path d="M${cx-rx*.8} ${y.toFixed(1)} q${rx*.2} -2.4 ${rx*.4} 0 t${rx*.4} 0 t${rx*.4} 0 t${rx*.4} 0" fill="none" stroke="#D8BE86" stroke-width=".9"/>`; }
  else if (k === "soup") g += `<ellipse cx="${cx-rx*.3}" cy="${cy-ry*.3}" rx="${rx*.25}" ry="${ry*.18}" fill="#fff" opacity=".35"/>`;
  else for (let i=0;i<22;i++){ const a = R()*Math.PI*2, d = Math.sqrt(R()); g += `<ellipse cx="${(cx+Math.cos(a)*d*rx*.85).toFixed(1)}" cy="${(cy+Math.sin(a)*d*ry*.8).toFixed(1)}" rx="1.6" ry=".9" transform="rotate(${Math.round(R()*180)} ${(cx+Math.cos(a)*d*rx*.85).toFixed(1)} ${(cy+Math.sin(a)*d*ry*.8).toFixed(1)})" fill="#fff" opacity=".7"/>`; }
  return g;
}
const BASES = new Set(["rice","grain","oat","noodle","soup","yogurt","milk"]);
function cluster(R, k, cx, cy, sx, sy, n, sc){
  let g = ""; for (let i=0;i<n;i++){ const a = R()*Math.PI*2, d = Math.sqrt(R()); g += piece(k, cx + Math.cos(a)*d*sx, cy + Math.sin(a)*d*sy, R, sc); } return g;
}
function foodSVG(r){
  const R = rng(r.id), keys = r.colors, cols = keys.map(k => FOOD[k] || "#ddd");
  let g = `<rect width="160" height="100" fill="var(--stage)"/><circle cx="${126+R()*14}" cy="${18+R()*10}" r="${16+R()*8}" fill="var(--rose-soft)" opacity=".9"/>`;
  const hasBase = BASES.has(keys[0]), tops = hasBase ? keys.slice(1) : keys;
  if (r.dish === "bowl" || r.dish === "soup"){
    g += `<ellipse cx="80" cy="89" rx="42" ry="5" fill="#000" opacity=".06"/><path d="M33 50 Q35 89 80 89 Q125 89 127 50 Z" fill="#FFFFFF" stroke="#EBDDE1" stroke-width="1.5"/><path d="M42 71 Q80 80 118 71" stroke="var(--rose)" stroke-width="2" fill="none" opacity=".5"/>`;
    g += `<ellipse cx="80" cy="50" rx="47" ry="13" fill="#FFFFFF" stroke="#EBDDE1" stroke-width="1.5"/>`;
    g += base(hasBase ? keys[0] : (r.dish === "soup" ? "soup" : "grain"), 80, 50, 42, 10, R);
    tops.forEach((k,i) => { const n = tops.length, sx = n === 1 ? 26 : 9, cx = n === 1 ? 80 : 80 + (i - (n-1)/2) * (64/n); g += cluster(R, k, cx, 49, sx, 4.5, n === 1 ? 7 : 3, .8); });
  } else if (r.dish === "glass"){
    g += `<ellipse cx="80" cy="91" rx="26" ry="4" fill="#000" opacity=".06"/><path d="M58 18 L62 88 Q80 93 98 88 L102 18 Z" fill="#FFFFFF" stroke="#EBDDE1" stroke-width="1.5"/>`;
    g += `<path d="M60 36 L63 86 Q80 90 97 86 L100 36 Z" fill="${cols[0]}"/><path d="M60.5 44 L99.5 44" stroke="#fff" stroke-width="1" opacity=".5"/>`;
    keys.slice(1).forEach(k => g += cluster(R, k, 80, 38, 13, 2, 4, .8));
    g += `<rect x="86" y="6" width="3.5" height="34" rx="1.7" transform="rotate(14 88 23)" fill="var(--rose)"/>`;
  } else if (r.dish === "toast" || r.dish === "wrap"){
    g += `<ellipse cx="80" cy="84" rx="56" ry="10" fill="#FFFFFF" stroke="#EBDDE1" stroke-width="1.5"/>`;
    const fill = keys.filter(k => k !== "bread");
    if (r.dish === "toast"){
      [[46,-8],[86,6]].forEach(([x,rot]) => { g += `<g transform="rotate(${rot} ${x+17} 55)"><path d="M${x} 80 L${x} 42 Q${x} 29 ${x+17} 29 Q${x+34} 29 ${x+34} 42 L${x+34} 80 Z" fill="#C98F55"/><path d="M${x+3} 78 L${x+3} 43 Q${x+3} 33 ${x+17} 33 Q${x+31} 33 ${x+31} 43 L${x+31} 78 Z" fill="${FOOD.bread}"/>`;
        fill.forEach((k,i) => g += piece(k, x+17 + (i-(fill.length-1)/2)*6, 52 + i*5, R, .9)); g += `</g>`; });
    } else {
      g += `<path d="M28 76 Q80 46 130 66 L124 82 Q80 68 34 88 Z" fill="${FOOD.bread}" stroke="#C98F55" stroke-width="1.5"/>`;
      fill.forEach((k,i) => g += piece(k, 118 + i*3, 62 + i*3, R, .9));
      g += `<ellipse cx="127" cy="74" rx="6" ry="9" fill="${FOOD.bread}" stroke="#C98F55" stroke-width="1.5"/>`;
    }
  } else if (r.dish === "fruit"){
    g += `<ellipse cx="80" cy="87" rx="48" ry="7" fill="#000" opacity=".05"/>`;
    keys.forEach((k,i) => { const c = FOOD[k], x = 80 + (i - (keys.length-1)/2)*30 + (R()-.5)*6, rr = (k === "berry" ? 9 : k === "nuts" ? 8 : 16) + R()*5, y = 85 - rr;
      if (k === "banana"){ g += `<path d="M${x-22} ${y-4} Q${x} ${y+28} ${x+22} ${y-6} Q${x} ${y+14} ${x-22} ${y-4}Z" fill="${c}" stroke="#D9B44A" stroke-width="1.2"/><path d="M${x+22} ${y-6} l3 -3" stroke="#7A5A3E" stroke-width="2.4" stroke-linecap="round"/>`; return; }
      if (k === "cucumber"){ g += `<rect x="${x-24}" y="${y+4}" width="48" height="11" rx="5.5" fill="#6FA35F"/><path d="M${x-18} ${y+8} h36" stroke="#A3CF8F" stroke-width="1.4" stroke-dasharray="2 4"/>`; return; }
      g += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${c}"/><circle cx="${x - rr*.35}" cy="${y - rr*.35}" r="${rr*.22}" fill="#fff" opacity=".35"/>`;
      if (k !== "nuts" && k !== "sweetpotato") g += `<path d="M${x} ${y-rr} q2 -7 7 -9" stroke="#7A5A3E" stroke-width="2" fill="none"/><ellipse cx="${x+6}" cy="${y-rr-6}" rx="5" ry="2.6" fill="#7FB46E" transform="rotate(-30 ${x+6} ${y-rr-6})"/>`; });
  } else {
    g += `<ellipse cx="80" cy="57" rx="60" ry="35" fill="#FFFFFF" stroke="#EBDDE1" stroke-width="1.5"/><ellipse cx="80" cy="57" rx="49" ry="27" fill="#FBF7F7"/>`;
    const n = keys.length;
    keys.forEach((k,i) => {
      const ang = (i/n)*Math.PI*2 - Math.PI/2 + .4, cx = n === 1 ? 80 : 80 + Math.cos(ang)*24, cy = n === 1 ? 57 : 57 + Math.sin(ang)*12;
      if (BASES.has(k)) g += base(k, cx, cy, 17, 10, R);
      else g += cluster(R, k, cx, cy, n === 1 ? 18 : 9, n === 1 ? 10 : 5, n === 1 ? (k === "egg" ? 2 : 6) : (k === "egg" ? 1 : 4), n === 1 ? 1.1 : .95);
    });
  }
  return `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(r.name)}插图">${g}</svg>`;
}


/* ================================================================
   Built-in courses
   ================================================================ */
const CATS = {burn:"燃脂", str:"塑形", core:"核心", flex:"拉伸瑜伽", aero:"有氧", relax:"放松"};
const C = (id, name, cat, lv, met, desc, extra) => Object.assign({id, name, cat, lv, met, desc}, extra);
const COURSES = [
 C("hiit20","燃脂 HIIT","burn","中级",8,"高强度间歇,短时间大量消耗热量。",{pick:1,rounds:3,work:40,rest:20,rr:60,moves:[["开合跳","jack","落地轻,手臂伸直过头"],["高抬腿","highknee","大腿抬至髋部高度,核心收紧"],["波比跳","burpee","不会跳可改为后撤步"],["登山跑","climber","臀部别翘高,肩在手腕正上方"],["深蹲跳","squatjump","下蹲膝盖对准脚尖,轻落地"],["平板支撑","plank","身体成一条直线,别塌腰"]]}),
 C("tabata","Tabata 4 分钟","burn","进阶",9,"20 秒全力 + 10 秒休息,4 分钟心率拉满。",{rounds:4,work:20,rest:10,rr:0,moves:[["波比跳","burpee","尽全力,保持动作质量"],["深蹲跳","squatjump","双臂摆动助力"]]}),
 C("full30","全身燃脂进阶","burn","进阶",8.5,"力量与有氧结合,全身主要肌群都动起来。",{rounds:4,work:45,rest:15,rr:60,moves:[["俯卧撑","pushup","可跪姿,胸部贴近地面"],["深蹲","squat","臀部向后坐,背部挺直"],["登山跑","climber","快速交替提膝"],["箭步蹲","lunge","前后膝都约 90 度"],["平板肩触","plankshoulder","骨盆保持稳定"],["开合跳","jack","节奏均匀"]]}),
 C("quiet20","低冲击燃脂 · 不跳跃","burn","初级",5.5,"不跳不吵楼下,膝盖友好,大体重也能做。",{pick:1,rounds:3,work:45,rest:15,rr:45,moves:[["侧步触地","steptouch","左右迈步,手臂跟着摆"],["站姿提膝","kneeup","手肘去找对侧膝盖"],["徒手深蹲","squat","慢下快起"],["慢速登山","climber","一步一步提膝,控制住"],["站姿转体","twiststand","转动的是腰,不是手臂"],["原地出拳","boxing","收腹,出拳快收拳也快"]]}),
 C("boxing20","拳击有氧","burn","中级",7.5,"跟着节奏出拳,解压又燃脂。",{rounds:4,work:50,rest:10,rr:40,moves:[["直拳连击","boxing","后脚蹬地转髋发力"],["躲闪深蹲","squat","下蹲时双手护脸"],["高抬腿冲刺","highknee","全力 50 秒"],["左右滑步","skater","重心低,步伐轻"]]}),
 C("standabs15","站姿燃腹 · 不用趴地","burn","初级",5,"全程站着完成,办公室和宿舍都能练。",{rounds:3,work:40,rest:15,rr:40,moves:[["站姿提膝卷腹","kneeup","腹部发力把膝盖拉起"],["站姿体侧屈","sidebend","侧腰拉长再收紧"],["站姿转体","twiststand","骨盆朝前不动"],["侧步触地","steptouch","保持节奏"],["原地高抬腿","highknee","可降速完成"]]}),
 C("legs25","臀腿塑形","str","初中级",5,"翘臀、紧致大腿,下肢力量基础课。",{pick:1,rounds:3,work:45,rest:15,rr:60,moves:[["徒手深蹲","squat","重心在脚跟"],["后撤箭步蹲","lunge","左右交替"],["臀桥","bridge","顶峰夹紧臀部 1 秒"],["相扑深蹲","sumo","双脚宽站,脚尖外开"],["侧卧抬腿","sidelegraise","每组换边"],["跪姿后踢腿","donkeykick","腿向后上方蹬,腰不塌"]]}),
 C("glute20","蜜桃臀专项","str","中级",5,"专攻臀部上沿与侧臀,穿裤子更好看。",{rounds:3,work:45,rest:15,rr:45,moves:[["臀桥","bridge","脚跟踩实发力"],["驴踢","donkeykick","踢到最高点停 1 秒"],["消防栓","donkeykick","膝盖向侧上方打开"],["侧卧蚌式","sidelegraise","脚跟并拢,膝盖打开"],["相扑深蹲","sumo","膝盖往外推"],["靠墙静蹲","wallsit","大腿与地面平行"]]}),
 C("legtone15","腿部紧致","str","初级",4.5,"小腿、大腿线条拉长,适合睡前。",{rounds:3,work:40,rest:20,rr:30,moves:[["靠墙静蹲","wallsit","背部贴墙"],["提踵","calfraise","慢起慢落"],["后撤箭步蹲","lunge","步子大一点"],["侧卧抬腿","sidelegraise","脚尖朝前"]]}),
 C("upper20","上肢与背部","str","初中级",4.5,"改善圆肩,练出好看的手臂线条。",{rounds:3,work:40,rest:20,rr:60,moves:[["跪姿俯卧撑","kneepush","手略宽于肩"],["椅子臂屈伸","dip","肘部向后弯曲"],["超人式","superman","手脚同时抬离地面"],["平板肩触","plankshoulder","慢一点更有效"],["YTW 伸展","ytw","俯卧依次摆出 Y、T、W"]]}),
 C("arms15","告别蝴蝶袖","str","初级",4,"不用器械,专练手臂后侧与肩部。",{rounds:3,work:40,rest:15,rr:30,moves:[["手臂小画圈","armcircle","手臂伸直,小幅快速"],["椅子臂屈伸","dip","手肘指向身后"],["跪姿俯卧撑","kneepush","下放 2 秒"],["靠墙天使","wallangel","肩胛贴墙滑动"],["扩胸运动","chestopen","肩胛骨向中间夹"]]}),
 C("core15","核心雕刻","core","初级",4,"稳定腰腹,马甲线的基础。",{rounds:3,work:40,rest:15,rr:45,moves:[["卷腹","crunch","下背贴地,用腹部发力"],["俄罗斯转体","twist","转动的是躯干"],["死虫式","deadbug","下背始终贴地"],["平板支撑","plank","均匀呼吸"],["仰卧抬腿","legraise","下放慢,不触地"],["侧平板","sideplank","每轮换一边"]]}),
 C("abs20","马甲线进阶","core","进阶",5,"更高强度的腹部训练,适合有基础的你。",{rounds:4,work:40,rest:15,rr:45,moves:[["卷腹","crunch","呼气时卷起"],["仰卧抬腿","legraise","双手压在臀下"],["登山跑","climber","速度快,核心稳"],["俄罗斯转体","twist","双脚可离地"],["平板支撑","plank","坚持住"]]}),
 C("pilates20","普拉提基础","core","初级",3.5,"控制、呼吸与核心,塑造修长线条。",{seq:[["呼吸准备",60,"breathe","鼻吸口呼,肋骨向两侧打开"],["百次拍击",60,"crunch","抬起上背,手臂小幅拍动"],["卷腹上卷",90,"crunch","一节一节卷起脊柱"],["单腿伸展",90,"deadbug","交替伸腿,下背贴地"],["臀桥卷动",90,"bridge","从尾骨开始一节节抬起"],["侧卧抬腿 · 左",60,"sidelegraise",""],["侧卧抬腿 · 右",60,"sidelegraise",""],["天鹅式",60,"superman","胸口向前延伸"],["猫牛式",60,"catcow","跟随呼吸"],["四足后踢",90,"donkeykick","骨盆稳定"],["死虫式",90,"deadbug","慢"],["婴儿式放松",60,"child",""],["仰卧放松",60,"corpse",""]]}),
 C("yoga20","晨间瑜伽流","flex","初级",2.5,"唤醒身体,改善柔韧和体态。",{pick:1,seq:[["山式 · 调整呼吸",60,"stand","双脚并拢,吸气延展脊柱"],["拜日式",180,"sunsalute","跟随呼吸缓慢完成 3 遍"],["猫牛式",90,"catcow","吸气塌腰抬头,呼气拱背低头"],["下犬式",90,"downdog","脚跟尽量向下踩"],["战士一式 · 左",60,"warrior1","前膝不超过脚尖"],["战士一式 · 右",60,"warrior1",""],["战士二式 · 左",60,"warrior2","目视前手指尖"],["战士二式 · 右",60,"warrior2",""],["三角式 · 左",60,"triangle","侧腰延展"],["三角式 · 右",60,"triangle",""],["坐姿前屈",90,"fold","从髋部折叠"],["仰卧扭转",120,"lyingtwist","两侧各 60 秒"],["婴儿式",60,"child","放松肩背"],["摊尸式",120,"corpse","全身放松,自然呼吸"]]}),
 C("stretch10","睡前放松拉伸","flex","入门",2.3,"缓解一天的疲劳,帮助入睡。",{seq:[["颈部侧拉",60,"neck","左右各 30 秒"],["肩部环绕",45,"shoulderroll","前后各 10 次"],["扩胸拉伸",60,"chestopen","双手背后交握"],["坐姿前屈",60,"fold",""],["蝴蝶式",60,"butterfly","膝盖自然下沉"],["鸽子式",90,"pigeon","左右各 45 秒"],["仰卧抱膝",60,"hugknees","轻轻左右滚动按摩腰背"],["婴儿式",60,"child",""],["腹式呼吸",45,"breathe","吸 4 秒,呼 6 秒"]]}),
 C("office10","久坐唤醒","flex","入门",2.3,"工作间隙 10 分钟,肩颈腰背一起放松。",{pick:1,seq:[["原地踏步",60,"march","摆臂"],["颈部侧拉",60,"neck",""],["扩胸运动",60,"chestopen","肩胛骨向中间夹"],["站姿体侧屈",60,"sidebend","左右交替"],["站姿转体",60,"twiststand",""],["靠墙天使",60,"wallangel","手臂贴墙上下滑动"],["站姿提踵",60,"calfraise","促进小腿血液回流"],["弓步拉伸",60,"lunge","左右各 30 秒"],["肩部环绕",60,"shoulderroll",""],["深呼吸",60,"stand",""]]}),
 C("neck10","肩颈舒缓","relax","入门",2,"低头族必备,缓解脖子和肩膀的僵硬。",{seq:[["颈部侧拉",90,"neck","手轻轻带头,不要用力压"],["肩部环绕",60,"shoulderroll","越慢越好"],["扩胸开肩",60,"chestopen",""],["靠墙天使",90,"wallangel",""],["猫牛式",90,"catcow","脊柱一节节活动"],["婴儿式",90,"child","额头放松触地"],["腹式呼吸",60,"breathe",""]]}),
 C("posture15","体态矫正 · 圆肩驼背","relax","初级",2.8,"打开胸口、激活背部,站得更挺拔。",{seq:[["扩胸运动",60,"chestopen",""],["靠墙天使",90,"wallangel","下巴微收"],["YTW 伸展",90,"ytw",""],["超人式",60,"superman","目视地面"],["猫牛式",90,"catcow",""],["下犬式",60,"downdog",""],["平板支撑",45,"plank",""],["臀桥",60,"bridge","改善骨盆前倾"],["婴儿式",60,"child",""],["山式站立",60,"stand","想象头顶被一根线向上提"]]}),
 C("sleep15","晚安助眠瑜伽","relax","入门",2,"在床上也能做,让身体慢慢安静下来。",{seq:[["腹式呼吸",90,"breathe","呼气比吸气长"],["蝴蝶式",90,"butterfly",""],["坐姿前屈",90,"fold",""],["仰卧抱膝",90,"hugknees",""],["仰卧扭转 · 左",75,"lyingtwist",""],["仰卧扭转 · 右",75,"lyingtwist",""],["婴儿式",90,"child",""],["摊尸式",180,"corpse","从脚趾到头顶逐一放松"]]}),
 C("walk30","轻快健走","aero","入门",4.3,"最友好的有氧,适合大体重和恢复期。",{seq:[["热身慢走",300,"walk","步伐放松,活动脚踝"],["快走",1200,"walk","能说话但不能唱歌的强度"],["放松慢走",300,"walk","逐渐降低步速"]]}),
 C("run30","跑步入门 · 跑走交替","aero","初级",7,"从零开始跑步,逐步建立有氧耐力。",{seq:[["热身快走",300,"walk",""]].concat(Array.from({length:7},()=>[["慢跑",60,"run","步频快、步幅小"],["快走",120,"walk",""]]).flat(),[["放松走",240,"walk","调整呼吸"]])}),
 C("jump15","跳绳间歇","aero","中级",10,"高效燃脂,没有绳子也可以模拟跳。",{rounds:8,work:60,rest:30,rr:0,moves:[["跳绳","jumprope","前脚掌着地,手腕发力"]]}),
 C("dance20","有氧操 · 跳舞燃脂","aero","初级",6.5,"跟着音乐动起来,不知不觉出一身汗。",{pick:1,rounds:4,work:60,rest:15,rr:30,moves:[["侧步触地","steptouch","跟着节拍左右点地"],["开合跳","jack","可改为单侧开合"],["滑冰跳","skater","左右跳,手臂摆动"],["拳击出拳","boxing","踩着节拍出拳"],["原地踏步提膝","march","笑一笑,享受音乐"]]})
];
const WD = ["一","二","三","四","五","六","日"];


/* ================================================================
   Built-in recipes
   id, meal, name, kcal, protein, carb, fat, tags, dish, colors, ingredients, steps
   ================================================================ */
const RECIPES = [
 ["b1","b","燕麦牛奶蓝莓杯",330,15,48,9,"快手 素食","bowl","oat berry nuts banana","即食燕麦 40g、牛奶 250ml、蓝莓 50g、坚果 5g","燕麦加牛奶微波 1 分半,放上蓝莓和坚果。前一晚泡好做隔夜燕麦也可以。"],
 ["b2","b","鸡蛋番茄全麦三明治",360,20,40,12,"快手","toast","bread egg tomato greens","全麦吐司 2 片、鸡蛋 1 个、番茄 3 片、生菜","鸡蛋少油煎熟,和番茄、生菜一起夹入烤过的吐司。"],
 ["b3","b","水煮蛋 · 玉米 · 无糖豆浆",380,24,42,13,"高蛋白 快手","plate","corn egg milk","鸡蛋 2 个、玉米 1 根、无糖豆浆 300ml","鸡蛋冷水下锅煮 8 分钟,玉米蒸 15 分钟。"],
 ["b4","b","杂粮粥配茶叶蛋",300,13,48,6,"素食","bowl","grain egg cucumber","杂粮(小米/糙米/红豆)40g、茶叶蛋 1 个、凉拌黄瓜","杂粮提前浸泡,电饭煲煮粥档;黄瓜拍碎加醋和少许盐。"],
 ["b5","b","希腊酸奶香蕉碗",320,18,38,11,"快手 素食 高蛋白","bowl","yogurt banana berry nuts","无糖希腊酸奶 200g、香蕉半根、蓝莓、坚果 10g","酸奶装碗,铺香蕉片、蓝莓和坚果碎。"],
 ["b6","b","番茄鸡蛋荞麦面",400,19,58,10,"","bowl","noodle tomato egg greens","荞麦面 60g、番茄 1 个、鸡蛋 1 个、青菜","番茄炒出汁加水煮开,下面和青菜,淋入蛋液。"],
 ["b7","b","蒸红薯 · 牛奶 · 鸡蛋",350,18,45,10,"快手","plate","sweetpotato egg milk","红薯 150g、牛奶 250ml、鸡蛋 1 个","红薯和鸡蛋一起上锅蒸 20 分钟。"],
 ["b8","b","菠菜鸡蛋全麦饼",340,17,36,13,"素食","plate","bread greens egg","全麦粉 40g、鸡蛋 1 个、菠菜 50g","菠菜焯水切碎,与面粉、蛋、水调成糊,不粘锅少油摊成饼。"],
 ["b9","b","牛油果鸡蛋吐司",390,17,34,20,"快手 素食","toast","bread avocado egg","全麦吐司 2 片、牛油果半个、鸡蛋 1 个","牛油果压泥加黑胡椒抹在吐司上,放上煎蛋或水波蛋。"],
 ["b10","b","鸡胸肉玉米饭团",370,25,50,7,"高蛋白","plate","rice chicken corn greens","米饭 120g、鸡胸肉 60g、玉米粒、海苔","鸡胸煮熟撕碎,与米饭、玉米粒拌匀,捏成饭团包海苔。"],
 ["b11","b","南瓜小米粥 + 鸡蛋",290,12,46,6,"素食 低卡","bowl","pumpkin grain egg","南瓜 100g、小米 30g、鸡蛋 1 个","南瓜切块与小米同煮 25 分钟,压碎更绵密。"],
 ["b12","b","奇亚籽酸奶杯",300,14,32,13,"快手 素食","glass","yogurt berry banana","无糖酸奶 200g、奇亚籽 10g、莓果、香蕉","奇亚籽拌入酸奶冷藏 10 分钟,铺上水果。"],
 ["b13","b","虾仁蒸蛋 + 全麦面包",340,26,30,12,"高蛋白","bowl","egg shrimp","鸡蛋 2 个、虾仁 50g、全麦面包 1 片","蛋液加 1.5 倍温水过筛,放虾仁蒸 10 分钟。"],
 ["b14","b","豆浆 · 全麦馒头 · 卤蛋",360,20,52,9,"快手","plate","bread egg milk","无糖豆浆 300ml、全麦馒头 1 个、卤蛋 1 个","全部加热即可,适合上班族。"],
 ["b15","b","香蕉燕麦松饼",380,16,54,11,"素食","plate","oat banana berry","燕麦粉 40g、香蕉 1 根、鸡蛋 1 个、莓果","香蕉压泥与燕麦粉、蛋混合,不粘锅小火煎成小饼。"],
 ["l1","l","鸡胸藜麦能量碗",520,42,48,16,"高蛋白","bowl","grain chicken avocado purple corn","鸡胸肉 130g、藜麦 50g(干)、牛油果 1/4、紫甘蓝、玉米粒","鸡胸用黑胡椒和少许盐腌 10 分钟后煎熟切片,藜麦煮 15 分钟,所有材料装碗。"],
 ["l2","l","番茄炖牛腩配糙米饭",620,38,62,22,"","plate","rice tomato beef","牛腩 120g、番茄 2 个、洋葱、糙米饭 150g","牛腩焯水,与番茄洋葱一起炖 1 小时,撇去浮油。"],
 ["l3","l","清蒸鲈鱼 · 西兰花 · 米饭",540,40,55,15,"高蛋白","plate","fish broccoli rice","鲈鱼 200g、西兰花 150g、米饭 130g","鲈鱼放姜葱蒸 8 分钟,淋蒸鱼豉油;西兰花焯水。"],
 ["l4","l","香煎三文鱼配芦笋红薯",580,36,45,26,"高蛋白","plate","salmon greens sweetpotato","三文鱼 130g、芦笋 100g、红薯 150g","三文鱼两面各煎 3 分钟,芦笋同锅煎熟,红薯蒸熟。"],
 ["l5","l","黑椒牛柳全麦意面",600,35,70,18,"","plate","noodle beef carrot greens","牛里脊 100g、全麦意面 70g、彩椒、洋葱","意面煮 9 分钟;牛柳快炒变色,加彩椒洋葱和黑椒汁拌面。"],
 ["l6","l","少油宫保鸡丁配杂粮饭",610,38,62,20,"","plate","chicken nuts cucumber rice","鸡腿肉 130g、花生 10g、黄瓜、胡萝卜、杂粮饭 130g","鸡丁用少油滑炒,加入配菜和宫保汁翻匀。"],
 ["l7","l","虾仁滑蛋 · 蒜蓉菜心 · 米饭",530,36,58,14,"快手","plate","shrimp egg greens rice","虾仁 120g、鸡蛋 2 个、菜心 200g、米饭 130g","虾仁炒至变色倒入蛋液轻推成块;菜心蒜蓉清炒。"],
 ["l8","l","鸡丝荞麦冷面",500,33,62,12,"快手","bowl","noodle chicken cucumber carrot","荞麦面 80g、鸡胸肉 100g、黄瓜丝、胡萝卜丝","鸡胸煮熟撕丝,面煮好过凉,加醋、生抽、少许芝麻酱拌匀。"],
 ["l9","l","豆腐虾仁煲配糙米饭",520,34,55,16,"","bowl","tofu shrimp mushroom greens","北豆腐 150g、虾仁 80g、香菇、糙米饭 130g","豆腐切块煎至微黄,加香菇虾仁和少许水焖 5 分钟。"],
 ["l10","l","韩式牛肉拌饭(少油)",590,34,68,18,"","bowl","rice beef carrot greens egg","米饭 150g、牛肉末 80g、菠菜、胡萝卜、豆芽、鸡蛋 1 个","蔬菜分别焯水,牛肉末炒熟,和煎蛋一起铺在饭上,加少量辣酱拌匀。"],
 ["l11","l","咖喱鸡胸蔬菜饭",560,38,66,14,"","plate","rice pumpkin chicken carrot","鸡胸肉 120g、土豆/南瓜、胡萝卜、咖喱块 1 小块、米饭 130g","鸡胸和蔬菜炒香加水煮软,放半块咖喱即可,比平时少放一半。"],
 ["l12","l","照烧鸡腿饭",610,36,64,20,"","plate","rice chicken broccoli","去皮鸡腿 150g、西兰花、米饭 130g","鸡腿煎至金黄,加生抽、味淋、少许蜂蜜收汁。"],
 ["l13","l","金枪鱼蔬菜沙拉 + 全麦面包",480,34,40,18,"快手 高蛋白","bowl","greens fish tomato corn","水浸金枪鱼 100g、生菜、圣女果、玉米粒、全麦面包 1 片","蔬菜洗净沥干,加金枪鱼和油醋汁拌匀。"],
 ["l14","l","少油麻婆豆腐配糙米饭",520,26,60,18,"素食","plate","tofu rice greens","嫩豆腐 200g、香菇末、豆瓣酱 1 勺、糙米饭 130g","香菇末代替肉末,少油炒豆瓣酱后下豆腐煮 3 分钟勾薄芡。"],
 ["l15","l","番茄鸡蛋面",480,22,70,12,"快手 素食","bowl","noodle tomato egg","面条 80g、番茄 2 个、鸡蛋 2 个","番茄炒出沙加水煮开下面,出锅前淋蛋液。"],
 ["l16","l","卤牛肉荞麦面",540,36,64,12,"高蛋白","bowl","noodle beef greens","荞麦面 80g、卤牛肉 80g、青菜","面煮好浇清汤,铺牛肉片和青菜。"],
 ["l17","l","香菇滑鸡蒸饭",550,36,60,15,"","plate","rice chicken mushroom","鸡腿肉 120g、香菇 4 朵、米饭 130g","鸡肉用生抽、淀粉腌 15 分钟,与香菇铺在米饭上同蒸 20 分钟。"],
 ["d1","d","菌菇豆腐汤 · 凉拌鸡丝",430,34,38,14,"高蛋白","soup","soup tofu mushroom greens","嫩豆腐 150g、各类菌菇 150g、鸡胸肉 80g、米饭半碗","菌菇豆腐煮汤调盐胡椒;鸡丝用醋和生抽凉拌。"],
 ["d2","d","白灼虾 · 清炒时蔬 · 玉米",400,30,42,10,"高蛋白 低卡","plate","shrimp greens corn","鲜虾 200g、时令青菜 200g、玉米 1 根","虾冷水下锅煮至变红即捞出,蘸姜醋汁。"],
 ["d3","d","番茄龙利鱼 · 清炒西葫芦",380,32,26,14,"低卡 高蛋白","plate","tomato fish cucumber","龙利鱼 180g、番茄 2 个、西葫芦 200g","番茄炒出汁,放鱼块小火煮 6 分钟。"],
 ["d4","d","鸡胸蔬菜卷饼",450,34,46,13,"快手","wrap","bread chicken greens tomato","全麦卷饼 1 张、鸡胸肉 100g、生菜、黄瓜、番茄","鸡胸煎熟切条,与蔬菜一起卷入饼中,可抹少量酸奶酱。"],
 ["d5","d","萝卜炖牛肉配小份杂粮饭",480,33,44,17,"","bowl","soup beef carrot","牛腱 100g、白萝卜 200g、杂粮饭 80g","牛腱焯水后与萝卜一起炖 1 小时。"],
 ["d6","d","冬瓜排骨汤 · 拌菠菜 · 紫薯",450,26,48,16,"","soup","soup beef greens purple","排骨 100g、冬瓜 200g、菠菜 150g、紫薯 120g","排骨焯水后煲汤,撇净浮油再下冬瓜。"],
 ["d7","d","魔芋荞麦面拌鸡丝",360,30,40,8,"低卡 快手","bowl","noodle chicken cucumber","魔芋丝 150g、荞麦面 40g、鸡胸肉 90g、黄瓜","魔芋丝焯水去碱味,与煮好的荞麦面和鸡丝拌匀。"],
 ["d8","d","蒸蛋羹 · 西兰花虾仁 · 南瓜",390,30,34,13,"低卡","plate","egg broccoli shrimp pumpkin","鸡蛋 2 个、虾仁 80g、西兰花 150g、南瓜 150g","蛋液与 1.5 倍温水混合过筛,盖保鲜膜蒸 10 分钟。"],
 ["d9","d","西兰花炒牛肉 + 小米粥",420,32,36,15,"","plate","broccoli beef grain","牛里脊 100g、西兰花 200g、小米 30g","牛肉用淀粉抓匀快炒,西兰花焯水后同炒。"],
 ["d10","d","鸡胸肉蔬菜汤",340,30,26,10,"低卡 高蛋白","soup","soup chicken carrot greens","鸡胸肉 120g、胡萝卜、卷心菜、番茄","所有材料切块煮 20 分钟,盐和黑胡椒调味。"],
 ["d11","d","凉拌豆腐 · 蒸南瓜 · 青菜",360,20,40,12,"素食 低卡","plate","tofu pumpkin greens","内酯豆腐 1 盒、南瓜 200g、青菜 200g","豆腐淋生抽、葱花;南瓜蒸 15 分钟。"],
 ["d12","d","三文鱼牛油果沙拉",450,30,18,28,"高蛋白","bowl","greens salmon avocado tomato","三文鱼 100g、牛油果半个、芝麻菜、圣女果","三文鱼煎熟切块,与蔬菜和牛油果拌柠檬汁。"],
 ["d13","d","番茄虾仁豆腐汤 + 半碗饭",410,30,40,12,"","soup","tomato shrimp tofu","番茄 2 个、虾仁 100g、嫩豆腐 150g、米饭 80g","番茄炒软加水,下豆腐和虾仁煮 3 分钟。"],
 ["d14","d","香煎鸡胸 + 烤时蔬",420,38,28,15,"高蛋白","plate","chicken carrot pumpkin greens","鸡胸肉 130g、南瓜、彩椒、西葫芦","时蔬刷少许油撒盐烤 20 分钟(200°C),鸡胸煎熟。"],
 ["d15","d","杂菌荞麦面",380,16,60,8,"素食","bowl","noodle mushroom greens","荞麦面 70g、杂菌 150g、青菜","杂菌炒香加水做汤底,下面和青菜。"],
 ["d16","d","蒜蓉粉丝蒸虾 + 清炒芥兰",400,30,38,12,"","plate","shrimp noodle greens","鲜虾 150g、粉丝 20g、芥兰 200g","粉丝泡软铺底,虾开背放蒜蓉蒸 6 分钟。"],
 ["s1","s","苹果 + 杏仁",150,4,22,6,"素食 快手","fruit","apple nuts","苹果 1 个、杏仁 10g",""],
 ["s2","s","无糖酸奶",120,8,10,5,"快手","glass","yogurt berry","无糖酸奶 150g",""],
 ["s3","s","盐水毛豆",130,12,9,5,"高蛋白","bowl","edamame edamame","毛豆 100g","带壳加盐和八角煮 8 分钟。"],
 ["s4","s","黄瓜 + 圣女果",60,2,12,0,"低卡","fruit","cucumber tomato tomato","黄瓜 1 根、圣女果 10 颗",""],
 ["s5","s","香蕉",105,1,27,0,"快手","fruit","banana","香蕉 1 根","运动前 30 分钟吃,补充能量。"],
 ["s6","s","牛奶蛋白奶昔",180,24,14,3,"高蛋白","glass","milk berry","牛奶 250ml、蛋白粉 1 勺","适合力量训练后 1 小时内饮用。"],
 ["s7","s","全麦饼干配牛奶",160,8,20,5,"快手","plate","bread milk","全麦饼干 2 片、牛奶 150ml",""],
 ["s8","s","蓝莓一小盒",85,1,21,0,"低卡","fruit","berry berry berry","蓝莓 125g",""],
 ["s9","s","水煮蛋",75,7,1,5,"高蛋白","plate","egg","鸡蛋 1 个","冷水下锅,水开后煮 7 分钟。"],
 ["s10","s","烤红薯半个",110,2,26,0,"素食","fruit","sweetpotato","红薯 100g",""],
 ["s11","s","原味坚果一小把",170,6,6,14,"素食","bowl","nuts nuts","混合坚果 25g","一天别超过一小把。"],
 ["s12","s","鸡胸肉干",100,18,3,2,"高蛋白","plate","chicken","低脂鸡胸肉干 30g",""],
 ["s13","s","柚子两瓣",80,1,20,0,"低卡","fruit","orange orange","柚子 200g",""]
].map(([id,meal,name,kcal,p,c,f,tags,dish,colors,ing,steps]) => ({id,meal,name,kcal,p,c,f,tags:tags?tags.split(" "):[],dish,colors:colors.split(" "),ing,steps}));
const MEALS = [["b","早餐",.25],["l","午餐",.35],["d","晚餐",.30],["s","加餐",.10]];


/* ================================================================
   Music — upbeat tracks synthesized with Web Audio (no files)
   ================================================================ */
const TRACKS = [
  {id:"pink",name:"粉色心跳",style:"Pop House",bpm:128,key:57,prog:[[0,3,7],[-4,0,3],[3,7,10],[-2,2,5]],kick:"x...x...x...x...",clap:"....x.......x...",hat:"..x...x...x...x.",ohat:"",bass:"..0...0...0...0.",arp:"0.1.2.1.0.1.2.1.",arpOct:12,lead:"square",colors:["#F2C4CE","#D3899B"]},
  {id:"sunset",name:"Sunset Run",style:"Disco",bpm:122,key:53,prog:[[0,4,7],[-3,0,4],[2,5,9],[-5,-1,2]],kick:"x...x...x...x...",clap:"....x.......x...",hat:"x.x.x.x.x.x.x.x.",ohat:"..x...x...x...x.",bass:"0.c.0.c.0.c.0.c.",arp:"",chord:"..x..x....x..x..",lead:"triangle",colors:["#F7D2B6","#D98C7A"]},
  {id:"power",name:"燃脂 Power",style:"Electro",bpm:138,key:52,prog:[[0,3,7],[0,3,7],[-4,0,3],[-2,2,5]],kick:"x...x...x...x...",clap:"....x.......x...",hat:"xxxxxxxxxxxxxxxx",ohat:"",bass:"0000000000000000",arp:"0..2..1.0..2..1.",arpOct:24,lead:"sawtooth",colors:["#E7B6D0","#9A6FB0"]},
  {id:"tabata",name:"Tabata 鼓点",style:"Drum & Bass",bpm:150,key:50,prog:[[0,3,7],[-2,2,5],[-4,0,3],[-5,-2,2]],kick:"x.....x...x.....",clap:"....x.......x...",hat:"x.xxx.x.x.xxx.x.",ohat:"",bass:"0.....0...0...0.",arp:"",lead:"square",colors:["#D9C1C7","#7E6A70"]},
  {id:"morning",name:"Morning Walk",style:"Bright Pop",bpm:112,key:60,prog:[[0,4,7],[7,11,14],[9,12,16],[5,9,12]],kick:"x.......x.......",clap:"....x.......x...",hat:"..x...x...x...x.",ohat:"",bass:"0...0.0.0...0.0.",arp:"0.2.1.2.0.2.1.2.",arpOct:12,bell:true,lead:"sine",colors:["#F8E1C9","#E6A67D"]},
  {id:"lofi",name:"Lo-fi Stretch",style:"Chill · 拉伸用",bpm:80,key:55,prog:[[0,4,7,11],[-3,0,4,7],[2,5,9,12],[-5,-1,2,5]],kick:"x.........x.....",clap:"....x.......x...",hat:"x.x.x.x.x.x.x.x.",ohat:"",bass:"0.......0.....0.",arp:"",chord:"x.......x.......",soft:true,lead:"sine",colors:["#D6CFE4","#8E87B0"]}
];
const Music = (() => {
  let ac = null, master = null, comp = null, noise = null, timer = null, step = 0, nextT = 0, trk = null, vol = .6;
  const m2f = m => 440*Math.pow(2, (m-69)/12);
  function ctx(){
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC(); comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = vol; comp.connect(master); master.connect(ac.destination);
    const len = ac.sampleRate; noise = ac.createBuffer(1, len, ac.sampleRate); const d = noise.getChannelData(0); for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
    return ac;
  }
  const env = (g, t, a, peak, dec, sus=0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t+a); g.gain.exponentialRampToValueAtTime(sus, t+a+dec); };
  function kick(t, soft){ const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(soft?110:150, t); o.frequency.exponentialRampToValueAtTime(42, t+.13); env(g, t, .002, soft?.5:.95, .34); o.connect(g); g.connect(comp); o.start(t); o.stop(t+.4); }
  function nz(t, type, f, peak, dec){ const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; fl.type = type; fl.frequency.value = f; env(g, t, .001, peak, dec); s.connect(fl); fl.connect(g); g.connect(comp); s.start(t, Math.random()*.5); s.stop(t+dec+.05); }
  function clap(t, soft){ if (soft){ nz(t, "bandpass", 1600, .18, .12); return; } [0,.012,.024].forEach(o => nz(t+o, "bandpass", 1500, .32, .09)); nz(t+.03, "bandpass", 1200, .2, .18); }
  function tone(t, midi, dur, type, peak, cutoff, a=.005){
    const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.value = m2f(midi); fl.type = "lowpass"; fl.frequency.setValueAtTime(cutoff*2.2, t); fl.frequency.exponentialRampToValueAtTime(cutoff*.6, t+dur);
    env(g, t, a, peak, dur); o.connect(fl); fl.connect(g); g.connect(comp); o.start(t); o.stop(t+a+dur+.05);
  }
  function bell(t, midi){ [1,2.01,3.98].forEach((h,i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = m2f(midi)*h; env(g, t, .003, [.12,.05,.02][i], .6); o.connect(g); g.connect(comp); o.start(t); o.stop(t+.7); }); }
  function bird(t){
    const n = 2 + Math.floor(Math.random()*3), f0 = 2600 + Math.random()*1400;
    for (let i=0;i<n;i++){ const o = ac.createOscillator(), g = ac.createGain(), s = t + i*0.11;
      o.type = "sine"; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f0*1.45, s+0.06);
      env(g, s, .005, .05, .07); o.connect(g); g.connect(comp); o.start(s); o.stop(s+.12); }
  }
  function wind(t, dur){ const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; s.loop = true; fl.type = "lowpass"; fl.frequency.value = 520;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.09, t+dur*.45); g.gain.linearRampToValueAtTime(0.0001, t+dur); s.connect(fl); fl.connect(g); g.connect(comp); s.start(t); s.stop(t+dur+.05); }
  function schedule(){
    const spb = 60/trk.bpm/4;
    while (nextT < ac.currentTime + .12){
      const s = step % 16, bar = Math.floor(step/16) % 4, ch = trk.prog[bar], root = trk.key + ch[0], t = nextT, soft = !!trk.soft;
      const swing = soft && s % 2 ? spb*.18 : 0, T = t + swing;
      if (trk.kick[s] === "x") kick(t, soft);
      if (trk.clap[s] === "x") clap(t, soft);
      if (trk.hat[s] === "x") nz(T, "highpass", 7500, soft?.06:.11, .04);
      if (trk.ohat && trk.ohat[s] === "x") nz(T, "highpass", 6500, .09, .22);
      const b = trk.bass[s];
      if (b && b !== ".") tone(T, root - 24 + (b === "c" ? 12 : 0), spb*(trk.bass === "0000000000000000" ? .9 : 1.6), soft ? "triangle" : "sawtooth", soft?.3:.34, soft?380:520);
      if (trk.arp && trk.arp[s] !== "."){ const n = ch[+trk.arp[s] % ch.length]; trk.bell ? bell(T, trk.key + n + (trk.arpOct||12)) : tone(T, trk.key + n + (trk.arpOct||12) - 12, spb*1.4, trk.lead, .1, 2600); }
      if (trk.chord && trk.chord[s] === "x") ch.forEach(n => tone(T, trk.key + n, soft ? spb*14 : spb*1.6, soft ? "triangle" : trk.lead, soft ? .07 : .06, soft ? 1400 : 3000, soft ? .08 : .005));
      if (s === 0 && bar === 0 && !soft) nz(t, "highpass", 3000, .08, .9);
      if (trk.nature){ if (s === 0) wind(t, spb*16); if (Math.random() < .07) bird(T + Math.random()*spb); }
      step++; nextT += spb;
    }
  }
  return {
    get playing(){ return !!timer; }, get track(){ return trk; },
    play(id){ if (!ctx()) return false; if (ac.state === "suspended") ac.resume(); trk = TRACKS.find(x => x.id === id) || trk || TRACKS[0]; if (timer) clearInterval(timer); step = 0; nextT = ac.currentTime + .06; timer = setInterval(schedule, 25); schedule(); onMusic(); return true; },
    stop(){ if (timer) clearInterval(timer); timer = null; onMusic(); },
    toggle(){ this.playing ? this.stop() : this.play(trk ? trk.id : (state.profile.track || "pink")); },
    next(){ const i = TRACKS.indexOf(trk); this.play(TRACKS[(i+1) % TRACKS.length].id); },
    setVol(v){ vol = v; if (master) master.gain.setTargetAtTime(v, ac.currentTime, .05); },
    duck(on){ if (master) master.gain.setTargetAtTime(on ? vol*.35 : vol, ac.currentTime, .08); },
    beep(f=880, ms=120){ if (!ctx()) return; if (ac.state === "suspended") ac.resume(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; env(g, ac.currentTime, .005, .25, ms/1000); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + ms/1000 + .05); }
  };
})();
const trackArt = t => `<span class="art" style="background:linear-gradient(135deg,${t.colors[0]},${t.colors[1]})"></span>`;


function seqOf(c){
  if (c.seq) return c.seq.map(([n,s,a,t]) => ({n,s,a,t}));
  const out = [{n:"热身 · 关节活动 + 原地踏步", s:60, a:"march", t:"转动脚踝、膝、髋、肩"}];
  for (let r=0; r<c.rounds; r++){
    c.moves.forEach(([n,a,t],i) => {
      out.push({n, s:c.work, a, t, round:r+1});
      const last = i === c.moves.length-1, nx = last ? c.moves[0] : c.moves[i+1];
      if (!last && c.rest) out.push({n:"休息", s:c.rest, rest:true, a:nx[1]});
      if (last && r < c.rounds-1 && (c.rr || c.rest)) out.push({n:"组间休息", s:c.rr || c.rest, rest:true, a:nx[1]});
    });
  }
  return out;
}
function uniqMoves(c){
  const seen = new Map();
  seqOf(c).forEach(x => { if (x.rest) return; const k = x.n.replace(/ · [左右]$/,""); if (!seen.has(k)) seen.set(k, x); });
  return [...seen.entries()].map(([n,x]) => ({n, a:x.a, t:x.t, s:x.s}));
}
const courseMin = c => Math.round(seqOf(c).reduce((a,x)=>a+x.s,0)/60);
const kcalOf = (met, min, kg) => Math.round(met * kg * min / 60);
const coverAnim = c => c.moves ? c.moves[0][1] : (c.seq.find(x => x[2] !== "stand") || c.seq[0])[2];

/* ================================================================
   v2 additions: chair / wall props, new moves, beginner courses
   ================================================================ */
const SEAT = P({x:42,y:83,t:180,la1:20,la2:60,ra1:20,ra2:60,ll1:90,ll2:0,rl1:90,rl2:0});
const S2 = o => P(Object.assign({}, SEAT, o));
Object.assign(ANIMS, {
  seatedmarch:{props:["chair"],d:450,k:[S2({ll1:118,ll2:15,ra1:40,ra2:95,la1:-20,la2:20}),S2({rl1:118,rl2:15,la1:40,la2:95,ra1:-20,ra2:20})]},
  seatedkick:{props:["chair"],d:700,k:[SEAT,S2({rl2:86}),SEAT,S2({ll2:86})]},
  seatedpress:{props:["chair"],d:750,k:[S2({la1:92,la2:178,ra1:92,ra2:178}),S2({la1:176,la2:178,ra1:174,ra2:178})]},
  chairsquat:{props:["chair"],d:850,k:[P({x:52,la1:90,la2:90,ra1:90,ra2:90}),P(Object.assign({},SQ,{x:44,y:80}))]},
  wallpush:{props:["wallr"],d:850,k:[P({x:40,y:65,t:150,ll1:-12,ll2:-12,rl1:-12,rl2:-12,la1:95,la2:95,ra1:95,ra2:95}),P({x:42,y:64,t:136,ll1:-14,ll2:-14,rl1:-14,rl2:-14,la1:40,la2:123,ra1:40,ra2:123})]},
  slowjog:{d:340,k:[P({t:176,y:64.5,ll1:30,ll2:-25,rl1:-15,rl2:-40,la1:-30,la2:50,ra1:35,ra2:110}),P({t:176,y:64.5,rl1:30,rl2:-25,ll1:-15,ll2:-40,ra1:-30,ra2:50,la1:35,la2:110})]},
  balance:{k:[P({rl1:72,rl2:-12,la1:70,la2:80,ra1:70,ra2:80})]},
  sidekick:{front:true,d:620,k:[P({ll1:4,ll2:4,rl1:-4,rl2:-4,la1:30,la2:-40,ra1:-30,ra2:40}),P({t:177,ll1:4,ll2:4,rl1:-36,rl2:-36,la1:30,la2:-40,ra1:-30,ra2:40})]},
  birddog:{d:900,k:[FOURS,P(Object.assign({},FOURS,{ra1:104,ra2:104,ll1:-100,ll2:-100})),FOURS,P(Object.assign({},FOURS,{la1:104,la2:104,rl1:-100,rl2:-100}))]}
});
// chair and wall props, drawn behind the figure
const _drawFigure = drawFigure;
drawFigure = function(cv, key, t){
  _drawFigure(cv, key, t);
  const an = ANIMS[key]; if (!an || !an.props) return;
  if (!an.props.some(p => p === "chair" || p === "wallr")) return;
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, c = figColors();
  const s = Math.min(W/120, H/112), ox = (W - 100*s)/2, oy = (H - 104*s)/2, X = v => ox + v*s, Y = v => oy + v*s;
  ctx.save(); ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = c.soft; ctx.strokeStyle = c.gray; ctx.lineWidth = 1.6*s; ctx.lineCap = "round";
  if (an.props.includes("chair")){
    ctx.fillRect(X(25), Y(85), 30*s, 4*s); ctx.strokeRect(X(25), Y(85), 30*s, 4*s);
    ctx.fillRect(X(25), Y(54), 4*s, 31*s); ctx.strokeRect(X(25), Y(54), 4*s, 31*s);
    ctx.beginPath(); ctx.moveTo(X(28), Y(89)); ctx.lineTo(X(28), Y(101.5)); ctx.moveTo(X(52), Y(89)); ctx.lineTo(X(52), Y(101.5)); ctx.stroke();
  }
  if (an.props.includes("wallr")){ ctx.fillRect(X(85), Y(14), 9*s, 88*s); ctx.strokeRect(X(85), Y(14), 9*s, 88*s); }
  ctx.restore();
};

COURSES.push(
 C("start7","新手第一课","burn","入门",4.5,"从来不运动也能完成的第一步,每个动作只做 30 秒。",{pick:1,tags:["新手","不出门"],rounds:1,work:30,rest:15,rr:0,moves:[["原地踏步","march","摆臂,保持呼吸"],["扶椅深蹲","chairsquat","坐下前停住,再站起来"],["靠墙俯卧撑","wallpush","身体保持一条直线"],["侧步触地","steptouch","跟着节奏左右点地"],["臀桥","bridge","臀部发力抬起"],["站姿提膝","kneeup","慢慢来"],["单腿站立","balance","扶着墙也可以"],["平板支撑","plank","坚持不了就跪着做"],["深呼吸","breathe","你做到了!"]]}),
 C("warm5","热身 5 分钟","flex","入门",3,"运动前活动关节,让身体慢慢热起来。",{tags:["新手","不出门"],seq:[["原地踏步",60,"march","摆臂"],["肩部环绕",45,"shoulderroll",""],["站姿体侧屈",45,"sidebend",""],["站姿转体",45,"twiststand",""],["弓步拉伸",45,"lunge","左右交替"],["提踵",30,"calfraise",""],["侧步触地",30,"steptouch",""]]}),
 C("cool5","放松拉伸 5 分钟","flex","入门",2.3,"运动后拉伸放松,第二天不那么酸。",{tags:["新手","放松"],seq:[["站姿体侧屈",45,"sidebend",""],["扩胸拉伸",45,"chestopen",""],["弓步拉伸",60,"lunge",""],["坐姿前屈",60,"fold",""],["婴儿式",45,"child",""],["深呼吸",45,"breathe",""]]}),
 C("meal15","餐后控糖散步","aero","入门",3.5,"饭后 15–30 分钟开始散步,帮助平稳餐后血糖。",{pick:1,tags:["控糖","新手"],seq:[["慢走热身",180,"walk","饭后别马上快走"],["稍快步行",540,"walk","微微出汗、还能聊天的速度"],["放松慢走",180,"walk",""]]}),
 C("dogwalk20","和二楞去遛弯","aero","入门",4,"像遛狗一样出门走走,晒晒太阳、呼吸新鲜空气。",{tags:["控糖","新手"],seq:[["出门慢走",300,"walk","二楞已经等不及了"],["快走一段",420,"walk","跟上二楞的步伐"],["停下来闻闻花",60,"stand","深呼吸,看看周围"],["快走一段",300,"walk",""],["慢慢走回家",120,"walk",""]]}),
 C("slowjog20","超慢跑","aero","入门",5.5,"比走路快一点的小碎步跑,不累也燃脂,在家原地也能做。",{pick:1,tags:["控糖","新手","不出门"],seq:[["原地踏步热身",180,"march",""],["超慢跑",420,"slowjog","步子小、前脚掌落地、能边跑边聊天"],["走路休息",60,"walk",""],["超慢跑",420,"slowjog",""],["放松走",120,"walk",""]]}),
 C("chair10","椅子上的运动","str","入门",2.8,"坐着也能练,适合久坐或膝盖不舒服的时候。",{tags:["新手","不出门","控糖"],seq:[["坐姿踏步",90,"seatedmarch","挺直背,交替抬膝"],["坐姿伸膝",90,"seatedkick","大腿发力,脚尖勾起"],["坐姿推举",60,"seatedpress","手臂向上推"],["坐姿踏步",60,"seatedmarch",""],["扶椅深蹲",90,"chairsquat","臀部轻触椅面就站起"],["坐姿伸膝",60,"seatedkick",""],["坐姿推举",60,"seatedpress",""],["深呼吸",90,"breathe",""]]}),
 C("strength15","入门力量","str","入门",3.8,"不用器械的基础力量课,增加肌肉、提高代谢、改善血糖。",{pick:1,tags:["新手","控糖","不出门"],rounds:3,work:40,rest:20,rr:45,moves:[["扶椅深蹲","chairsquat","重心在脚跟"],["靠墙俯卧撑","wallpush","慢下快起"],["臀桥","bridge","顶峰停 1 秒"],["鸟狗式","birddog","对侧手脚同时伸直"],["提踵","calfraise",""]]}),
 C("catyoga12","发财的猫式瑜伽","flex","入门",2.5,"跟发财学伸懒腰,舒展脊柱、放松肩背。",{tags:["新手","放松","不出门"],seq:[["猫式伸展",90,"catcow","像猫一样拱背、塌腰"],["婴儿式",60,"child","像发财趴着一样放松"],["下犬式",60,"downdog",""],["伸个大懒腰",60,"sunsalute",""],["仰卧扭转",90,"lyingtwist",""],["蝴蝶式",60,"butterfly",""],["摊尸式",90,"corpse","像午后晒太阳的猫"]]}),
 C("balance10","平衡与稳定","core","入门",3,"增强核心和下肢稳定,走路更稳当。",{tags:["新手","不出门"],rounds:2,work:40,rest:15,rr:30,moves:[["单腿站立","balance","扶椅子也可以"],["侧抬腿","sidekick","身体不要歪"],["鸟狗式","birddog",""],["提踵","calfraise",""],["臀桥","bridge",""]]}),
 C("dance15","欢乐舞步","aero","入门",5.5,"跟着节奏动起来,15 分钟不知不觉出汗。",{tags:["新手","不出门","控糖"],rounds:3,work:50,rest:10,rr:20,moves:[["侧步触地","steptouch","跟着节拍"],["开合步","jack","可以不跳,一侧一侧打开"],["原地踏步","march",""],["出拳","boxing",""]]}),
 C("bed8","床上唤醒","relax","入门",2,"早上醒来在床上就能做,轻松开启一天。",{tags:["新手","放松","不出门"],seq:[["深呼吸",60,"breathe",""],["仰卧抱膝",60,"hugknees",""],["仰卧扭转",60,"lyingtwist",""],["臀桥",60,"bridge",""],["死虫式",60,"deadbug","慢慢做"],["猫牛式",60,"catcow",""],["婴儿式",60,"child",""],["伸懒腰",60,"sunsalute",""]]}),
 C("hiitlite12","低冲击间歇","burn","初级",6,"不跳也能心跳加速,膝盖友好。",{tags:["不出门","控糖"],rounds:3,work:40,rest:20,rr:30,moves:[["快速踏步","march","手臂用力摆"],["深蹲","squat",""],["滑步","skater","不跳,左右迈大步"],["站姿提膝","kneeup",""]]})
);
// tags for the original library
const _TAGS = {walk30:["控糖","新手"], run30:["控糖"], quiet20:["新手","不出门","控糖"], office10:["新手","不出门"], neck10:["放松","新手"], stretch10:["放松","新手"], sleep15:["放松","新手"], yoga20:["新手"], core15:["不出门"], legs25:["不出门","控糖"], glute20:["不出门"], upper20:["不出门"], arms15:["不出门"], dance20:["控糖","不出门"], posture15:["放松","不出门"], pilates20:["不出门"], standabs15:["不出门","新手"], legtone15:["不出门"]};
COURSES.forEach(c => { if (!c.tags) c.tags = _TAGS[c.id] || []; delete c.pick; });
["start7","meal15","slowjog20","strength15","dogwalk20","catyoga12"].forEach(id => { const c = COURSES.find(x => x.id === id); if (c) c.pick = 1; });
const JUMPY = new Set(["hiit20","tabata","full30","jump15","boxing20"]);

// blood-sugar friendly recipes: whole grains, vegetables first, protein with every meal
const LOWGI = new Set(["b1","b3","b5","b8","b9","b11","b13","l1","l3","l4","l7","l9","l13","l14","l16","d1","d2","d3","d4","d7","d8","d10","d11","d12","d13","d14","d15","s1","s2","s3","s4","s8","s9","s11","s12"]);
RECIPES.forEach(r => { if (LOWGI.has(r.id) && !r.tags.includes("控糖")) r.tags.push("控糖"); });

// nature ambience for stretching and yoga: wind, birdsong and a soft pad
TRACKS.push({id:"forest",name:"森林晨光",style:"自然白噪音 · 拉伸用",bpm:60,key:62,prog:[[0,4,7,11],[5,9,12,16],[2,5,9,12],[7,11,14,17]],kick:"................",clap:"................",hat:"................",ohat:"",bass:"0...............",arp:"",chord:"x...............",soft:true,lead:"sine",nature:true,colors:["#CFE8C2","#5E9E6B"]});
