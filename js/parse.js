/* Screenshot text → health records.
   Works on Tesseract output (noisy, spaced-out characters) and on text copied
   with iPhone Live Text. Every parser returns only the fields it is sure about;
   the review form lets the user fill in or fix the rest. */
(function (root) {
  "use strict";
  const pad = n => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  function normalize(text) {
    let t = String(text || "")
      .replace(/[：]/g, ":").replace(/[（]/g, "(").replace(/[）]/g, ")").replace(/[％]/g, "%")
      .replace(/[～〜]/g, "~").replace(/[，]/g, ",").replace(/[。]/g, ".").replace(/[／]/g, "/")
      .replace(/[－—–]/g, "-").replace(/[≤]/g, "<=").replace(/[≥]/g, ">=");
    // Tesseract puts spaces between CJK characters and splits numbers like "3 4 2"
    t = t.replace(/([一-鿿])[ \t]+(?=[一-鿿])/g, "$1");
    // common misreads
    t = t.replace(/有和氧/g, "有氧").replace(/(\d)\s*[xX](?![a-zA-Z])/g, "$1%").replace(/(\d)k[o0]\b/g, "$1kg").replace(/keat|kcat|kca1/g, "kcal");
    return t;
  }
  const flatten = t => t.replace(/[ \t\r\n]+/g, "");
  const num = s => { const v = parseFloat(s); return isFinite(v) ? v : null; };

  // first number after a label (within `span` chars), optionally filtered
  function after(flat, label, opts = {}) {
    const re = label instanceof RegExp ? new RegExp(label.source, "g") : new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    let m;
    while ((m = re.exec(flat))) {
      const seg = flat.slice(m.index + m[0].length, m.index + m[0].length + (opts.span || 24));
      const nre = opts.pct ? /(\d+(?:\.\d)?)%/g : /(\d+(?:\.\d)?)/g;
      let n;
      while ((n = nre.exec(seg))) {
        const v = num(n[1]);
        if (opts.min != null && v < opts.min) continue;
        if (opts.max != null && v > opts.max) continue;
        if (opts.notBefore && opts.notBefore.test(seg.slice(Math.max(0, n.index - 3), n.index))) continue;
        return v;
      }
    }
    return null;
  }
  function findDate(flat, today) {
    const y0 = +today.slice(0, 4);
    let m = flat.match(/(20\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
    if (m) return ymd(m[1], +m[2], +m[3]);
    m = flat.match(/(\d{1,2})月(\d{1,2})日/);
    if (m) return ymd(y0, +m[1], +m[2]);
    return null;
  }
  const hm = (h, m) => (+h) * 60 + (+m || 0);
  function duration(flat, label) {
    // the label also appears in chart legends without a value; take the first one that has a time
    const re = new RegExp(label + "(?:(\\d{1,2})小时)?(?:(\\d{1,2})分)?", "g");
    for (const m of flat.matchAll(re)) if (m[1] || m[2]) return hm(m[1] || 0, m[2] || 0);
    return null;
  }

  function detect(flat) {
    if (/TIR|变异系数|血糖曲线|葡萄糖|血糖事件/.test(flat)) return /血糖曲线|今日血糖|关键指标/.test(flat) && !/TIR日历|TIR日/.test(flat) ? "glucoseDay" : "glucoseWeek";
    if (/体脂率|肌肉率|基础代谢|内脏脂肪|骨量/.test(flat)) return "body";
    if (/深睡|浅睡|夜间睡眠|快速眼动/.test(flat)) return "sleep";
    if (/平均心率|运动时间|总消耗|训练负荷|心率区间|有氧耐力/.test(flat)) return "workout";
    return null;
  }

  function parseGlucoseWeek(text, flat, today) {
    const r = {};
    const range = flat.match(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})~/);
    let start = range ? ymd(range[1], +range[2], +range[3]) : null;
    // daily TIR row: tokens between "TIR日历" and "核心指标"
    const i0 = flat.search(/TIR日历|TIR日/), i1 = flat.search(/核心指标|目标范围/);
    // use the spaced text so that "98.1 906 971" stay separate tokens
    const lines = text.split(/\n/);
    let inCal = false, toks = [];
    for (const line of lines) {
      const f = flatten(line);
      if (/TIR日历|TIR日/.test(f)) { inCal = true; continue; }
      if (inCal && /核心指标|目标范围/.test(f)) break;
      if (!inCal) continue;
      const ts = line.trim().split(/\s+/).filter(x => /^(\d{2,4}(?:\.\d)?|--)$/.test(x));
      if (ts.length >= 3) toks = toks.concat(ts);   // skip the weekday header row
    }
    if (!toks.length && i0 >= 0) { // Live Text may glue everything
      const s = flat.slice(i0, i1 > i0 ? i1 : i0 + 120);
      toks = (s.match(/\d{2,3}\.\d|100|--/g) || []);
    }
    const daily = toks.slice(0, 7).map(x => {
      if (/^-+$/.test(x)) return null;
      let v = parseFloat(x);
      if (!/\./.test(x) && v > 100) v = v / 10;   // "906" was 90.6
      return v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : null;
    });
    if (daily.length) r.daily = daily;
    // core metrics
    let tir = after(flat, "目标范围TIR", { pct: true, max: 100, span: 40 });
    if (tir == null) tir = after(flat, /TIR(?!日)/, { pct: true, max: 100, span: 40 });
    let cv = null;
    const icv = flat.indexOf("CV");
    if (icv >= 0) {
      const nums = (flat.slice(icv + 2, icv + 40).match(/\d+(?:\.\d+)?(?=%)/g) || []).map(Number);
      cv = nums.length ? (tir != null && nums[0] === tir && nums.length > 1 ? nums[1] : nums[0]) : null;
    }
    if (tir != null) r.tir = tir;
    if (cv != null && cv < 100) r.cv = cv;
    // event counts
    const ih = flat.indexOf("高血糖事件"), il = flat.indexOf("低血糖事件");
    if (ih >= 0) {
      const seg2 = flat.slice(ih, ih + 60), counts = (seg2.match(/(\d+)次/g) || []).map(x => parseInt(x));
      if (il > ih && il < ih + 20 && counts.length >= 2) { r.high = counts[0]; r.low = counts[1]; }
      else { if (counts.length) r.high = counts[0]; if (il >= 0) { const c = flat.slice(il, il + 30).match(/(\d+)次/); if (c) r.low = +c[1]; } }
    }
    if (start) r.start = start;
    else if (/今天/.test(flat)) { const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); r.start = ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
    return r;
  }

  function parseGlucoseDay(text, flat, today) {
    const r = {};
    const d = findDate(flat, today);
    r.date = d || today;
    const tir = after(flat, /TIR/, { pct: true, max: 100 }); if (tir != null) r.tir = tir;
    const tar = after(flat, /TAR/, { pct: true, max: 100 }); if (tar != null) r.tar = tar;
    const tbr = after(flat, /TBR/, { pct: true, max: 100 }); if (tbr != null) r.tbr = tbr;
    const nums = (flat.match(/\d\.\d/g) || []).map(Number).filter(v => v > 2 && v < 15);
    if (nums.includes(7.8) && nums.includes(3.9)) { r.bandHi = 7.8; r.bandLo = 3.9; }
    else if (nums.includes(10) || /10\.0/.test(flat)) { r.bandHi = 10; r.bandLo = 3.9; }
    return r;
  }

  function parseBody(text, flat, today) {
    const r = {};
    const d = findDate(flat, today); if (d) r.date = d;
    const tm = flat.match(/(\d{1,2})月(\d{1,2})日(\d{1,2}:\d{2})/); if (tm) r.time = tm[3].padStart(5, "0");
    r.weight = after(flat, "体重", { min: 25, max: 250, span: 30 });
    r.fat = after(flat, /体脂率|脂肪率/, { pct: true, min: 3, max: 65, span: 30 });
    r.muscle = after(flat, "肌肉率", { pct: true, min: 20, max: 95, span: 20 });
    r.bone = after(flat, "骨量", { min: 0.5, max: 6, span: 12 });
    r.muscleLevel = after(flat, "储肌能力等级", { min: 1, max: 10, span: 6 });
    r.visceral = after(flat, "内脏脂肪", { min: 1, max: 30, span: 10 });
    r.bmr = after(flat, "基础代谢", { min: 600, max: 4000, span: 12 });
    r.protein = after(flat, "蛋白质", { pct: true, min: 5, max: 30, span: 12 });
    r.water = after(flat, "水分", { pct: true, min: 30, max: 80, span: 12 });
    r.vo2max = after(flat, "最大摄氧量", { min: 10, max: 80, span: 10 });
    r.bmi = after(flat, "BMI", { min: 12, max: 50, span: 10 });
    r.score = after(flat, "身体得分", { min: 10, max: 100, span: 8 });
    r.bodyAge = after(flat, "身体年龄", { min: 10, max: 100, span: 6 });
    const bt = flat.match(/身体类型([\u4e00-\u9fff]{2,4}?)(?=[^\u4e00-\u9fff]|身体|腰|$)/);
    if (bt) r.bodyType = bt[1];
    if (r.weight == null) { const m = flat.match(/(\d{2,3}\.\d)kg/); if (m) r.weight = +m[1]; }
    Object.keys(r).forEach(k => r[k] == null && delete r[k]);
    return r;
  }

  function parseSleep(text, flat, today) {
    const r = {};
    const d = findDate(flat, today); if (d) r.date = d;
    // "夜间睡眠" appears twice: the header (often misread) and the analysis tile; keep the plausible one
    const nights = [...flat.matchAll(/夜间睡眠(\d{1,2})小时(\d{1,2})分/g)].map(m => hm(m[1], m[2])).filter(v => v > 60 && v < 900);
    if (nights.length) r.night = nights[nights.length - 1];
    const deep = duration(flat, "深睡"), light = duration(flat, "浅睡"), rem = duration(flat, "快速眼动");
    if (deep != null) r.deep = deep; if (light != null) r.light = light; if (rem != null) r.rem = rem;
    if (r.deep != null && r.light != null) { const sum = r.deep + r.light + (r.rem || 0); if (r.night == null || Math.abs(sum - r.night) > 20) r.night = sum; }
    const total = flat.match(/总睡眠(\d{1,2})小时(\d{1,2})分/);
    if (total && r.night != null) { const nap = hm(total[1], total[2]) - r.night; if (nap > 0 && nap < 240) r.nap = nap; }
    const wc = flat.match(/清醒次数.{0,12}?(\d{1,2})次/); if (wc) r.wakeCount = +wc[1];
    const sc = flat.match(/(\d{2,3})分超过/) || flat.match(/睡眠得分(\d{2,3})/); if (sc && +sc[1] <= 100) r.score = +sc[1];
    const hr = flat.match(/睡眠心率(\d{2,3})-(\d{2,3})/); if (hr) { r.hrMin = +hr[1]; r.hrMax = +hr[2]; }
    const bt = flat.match(/入睡(\d{1,2}:\d{2})/); if (bt) r.bedtime = bt[1].padStart(5, "0");
    const wk = flat.match(/醒来(\d{1,2}:\d{2})/); if (wk) r.wake = wk[1].padStart(5, "0");
    return r;
  }

  function parseWorkout(text, flat, today) {
    const r = {};
    const dt = text.match(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:\s+(\d{1,2}:\d{2}))?/);
    if (dt) { r.date = ymd(dt[1], +dt[2], +dt[3]); if (dt[4]) r.time = dt[4].padStart(5, "0"); }
    const name = flat.match(/(自由训练|户外跑步|室内跑步|户外步行|室内步行|健走|骑行|游泳|跳绳|瑜伽|椭圆机|划船机|登山|徒步|力量训练|HIIT)/);
    if (name) r.name = name[1];
    const dur = flat.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (dur) r.minutes = Math.round((+dur[1] * 60 + +dur[2] + +dur[3] / 60) * 100) / 100;
    else { const m = flat.match(/(?:运动时长|时长达?|用时)(\d{1,3})分钟?(\d{1,2})?秒?/); if (m) r.minutes = +m[1] + (+m[2] || 0) / 60; }
    const tk = flat.match(/(\d{2,4})总消耗/) || flat.match(/总消耗热量?(?:\(千卡\))?(\d{2,4})/); if (tk) r.kcal = +tk[1];
    // active kcal sits right before the hh:mm:ss duration; OCR may glue it to the time before it
    const ak = flat.match(/(\d{2,9})\D{0,4}\d{2}:\d{2}:\d{2}/);
    if (ak) for (const n of [4, 3, 2]) { const v = +ak[1].slice(-n); if (ak[1].length >= n && v >= 10 && (!r.kcal || (v <= r.kcal && v >= r.kcal * 0.4))) { r.activeKcal = v; break; } }
    if (r.activeKcal == null) { const m = flat.match(/活动热量(\d{2,4})/); if (m) r.activeKcal = +m[1]; }
    const hrs = [...flat.matchAll(/(?<![-\d])(\d{2,3})次\/分钟?/g)].map(m => +m[1]).filter(v => v >= 50 && v <= 220);
    if (hrs.length) { r.avgHr = hrs[0]; const mx = Math.max(...hrs.slice(0, 4)); if (mx > r.avgHr) r.maxHr = mx; }
    const ld = after(flat, "训练负荷", { min: 1, max: 999, span: 6 }); if (ld != null) r.load = ld;
    const z = k => { const m = flat.match(new RegExp(k + "\\(?\\d{2,3}-\\d{2,3}次?\\/?分?钟?\\)?(\\d{1,3})分")); return m ? +m[1] : null; };
    const zones = { extreme: z("极限"), anaerobic: z("无氧耐力"), aerobic: z("有氧耐力"), fatburn: z("燃脂"), warmup: z("热身") };
    Object.entries(zones).forEach(([k, v]) => { if (v != null) r["z_" + k] = v; });
    const te = flat.match(/有氧训练压力(\d(?:\.\d)?)/); if (te) r.aerobicTE = +te[1];
    const rec = flat.match(/恢复时间(?:为)?(\d{1,3})小时/); if (rec) r.recovery = +rec[1];
    return r;
  }

  function parse(text, today) {
    const t = normalize(text), flat = flatten(t);
    const type = detect(flat);
    if (!type) return { type: null, data: {}, found: 0 };
    const fn = { glucoseWeek: parseGlucoseWeek, glucoseDay: parseGlucoseDay, body: parseBody, sleep: parseSleep, workout: parseWorkout }[type];
    const data = fn(t, flat, today);
    const found = Object.keys(data).filter(k => !["date", "time", "start"].includes(k)).length;
    return { type, data, found };
  }

  /* Trace a glucose curve out of a chart screenshot.
     Finds the shaded target band (uniform light gray with white on both sides),
     uses its top/bottom as the band limits and its width as 00:00–24:00,
     drops thin full-width gridlines, and reads the darker curve column by column. */
  function traceCurve(img, bandHi, bandLo) {
    const W = img.width, H = img.height, d = img.data;
    const L = (x, y) => { const i = (y * W + x) * 4; return (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; };
    const C = (x, y) => { const i = (y * W + x) * 4; return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; };
    const groups = [];
    for (let y = 0; y < H; y++) {
      // longest non-white run in this row that does not touch the screen edges
      let best = null, x = 0;
      while (x < W) {
        if (L(x, y) < 253) { const s = x; while (x < W && L(x, y) < 253) x++; if (s > 2 && x - 1 < W - 3 && x - s > W * 0.3 && (!best || x - s > best[1] - best[0])) best = [s, x - 1]; }
        x++;
      }
      if (!best) continue;
      const counts = new Map();
      for (let xx = best[0]; xx < best[1]; xx += 4) { const c = C(xx, y); counts.set(c, (counts.get(c) || 0) + 1); }
      let mc = 0, mn = 0; counts.forEach((n, c) => { if (n > mn) { mn = n; mc = c; } });
      const lum = (((mc >> 16) & 255) * 299 + ((mc >> 8) & 255) * 587 + (mc & 255) * 114) / 1000;
      if (mn < ((best[1] - best[0]) / 4) * 0.7 || lum < 228 || lum > 252) continue;
      const g = groups.slice().reverse().find(g => y - g.b <= 8 && Math.abs(best[0] - g.l) < 4 && Math.abs(((mc >> 16) & 255) - ((g.c >> 16) & 255)) < 4);
      if (g) { g.b = y; g.rs.push(best[1]); }
      else groups.push({ t: y, b: y, l: best[0], c: mc, lum, rs: [best[1]] });
    }
    const cands = groups.filter(g => g.b - g.t >= 30);
    if (!cands.length) return null;
    const g = cands.reduce((a, b) => (b.b - b.t > a.b - a.t ? b : a));
    g.rs.sort((a, b) => a - b);
    const top = g.t, bot = g.b, left = g.l, right = g.rs[Math.floor(g.rs.length / 2)];
    const ppm = (bot - top) / (bandHi - bandLo), val = y => bandLo + (bot - y) / ppm, yOf = v => bot - (v - bandLo) * ppm;
    // gridlines: thin rows that are one uniform non-white color across the plot
    const raw = [];
    for (let y = Math.max(0, Math.floor(yOf(16))); y < Math.min(H, Math.ceil(yOf(-1))); y++) {
      const counts = new Map(); let n = 0;
      for (let x = left; x < right; x += 4) { const c = C(x, y); counts.set(c, (counts.get(c) || 0) + 1); n++; }
      let mc = 0, mn = 0; counts.forEach((k, c) => { if (k > mn) { mn = k; mc = c; } });
      const lum = (((mc >> 16) & 255) * 299 + ((mc >> 8) & 255) * 587 + (mc & 255) * 114) / 1000;
      if (mn > n * 0.85 && lum < 252 && mc !== g.c) raw.push(y);
    }
    const grid = new Set(); let run = [];
    raw.concat([1e9]).forEach(y => { if (run.length && y === run[run.length - 1] + 1) { run.push(y); return; } if (run.length && run.length <= 3) run.forEach(v => grid.add(v)); run = [y]; });
    const gs = [...grid];
    const ytop = Math.min(top, ...gs), ybot = Math.max(bot, ...gs);
    const thr = Math.min(g.lum, 240) - 10;
    const pts = []; let prev = null, dark = 0;
    for (let x = left + 2; x < right - 1; x++) {
      const ys = [];
      for (let y = ytop - 2; y <= ybot; y++) { if (grid.has(y) || grid.has(y - 1) || grid.has(y + 1)) continue; const l = L(x, y); if (l < thr) { ys.push(y); if (l < 120) dark++; } }
      if (!ys.length) continue;
      const t = (x - left) / (right - left) * 1440;
      const hiY = ys[0], loY = ys[ys.length - 1];
      if (loY - hiY > 6 && prev != null) {
        // a spike: keep both ends, nearest first
        const a = val(hiY), b = val(loY);
        if (Math.abs(a - prev) < Math.abs(b - prev)) { pts.push([t, a], [t, b]); prev = b; } else { pts.push([t, b], [t, a]); prev = a; }
      } else { const v = val(ys[Math.floor(ys.length / 2)]); pts.push([t, v]); prev = v; }
    }
    if (pts.length < 10) return null;
    // thin to one point per ~5 minutes, keeping local extremes
    const out = []; let bucket = [];
    const flush = () => { if (!bucket.length) return; const mx = bucket.reduce((a, b) => (b[1] > a[1] ? b : a)), mn = bucket.reduce((a, b) => (b[1] < a[1] ? b : a)); const pair = mx[0] <= mn[0] ? [mx, mn] : [mn, mx]; (Math.abs(mx[1] - mn[1]) > 0.6 ? pair : [bucket[Math.floor(bucket.length / 2)]]).forEach(p => out.push([Math.round(p[0]), Math.round(p[1] * 10) / 10])); bucket = []; };
    pts.forEach(p => { if (bucket.length && Math.floor(p[0] / 5) !== Math.floor(bucket[0][0] / 5)) flush(); bucket.push(p); });
    flush();
    return { points: out, darkLine: dark > pts.length * 0.5, band: { top, bot, left, right } };
  }

  const API = { parse, traceCurve, normalize };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.HealthParse = API;
})(typeof window !== "undefined" ? window : globalThis);
