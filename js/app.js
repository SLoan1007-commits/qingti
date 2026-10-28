/* 轻体日志 v2 — app logic and views */
"use strict";

/* ================================================================
   State & storage — everything stays on this phone (localStorage)
   ================================================================ */
const DOCS = ["profile","weights","plan","workouts","meals","health","glucose","pets"];
const DEF = {
  profile:{name:"Amber", sex:"f", age:30, height:160, goalWeight:null, activity:1.375, goal:"keep", set:false,
    level:"none", mins:15, days:4, likes:[], lowImpact:false, gLo:3.9, gHi:7.8, preCheck:true,
    track:"forest", autoMusic:true, vol:.6, bg:{}},
  weights:{entries:{}},
  plan:{week:{}, meta:null},
  workouts:{log:{}},
  meals:{week:null, days:{}},
  health:{body:[], sleep:[], ext:[]},
  glucose:{days:{}, weeks:[], curves:{}, logs:[]},
  pets:{bones:0, fish:0, pats:0}
};
const LS = "amber2:";
let state = clone(DEF), storageOK = true;
function lsGet(k){ try { return JSON.parse(localStorage.getItem(LS+k)); } catch(e){ return null; } }
function lsSet(k,v){ try { localStorage.setItem(LS+k, JSON.stringify(v)); return true; } catch(e){ storageOK = false; return false; } }
try { localStorage.setItem(LS+"probe","1"); localStorage.removeItem(LS+"probe"); } catch(e){ storageOK = false; }
for (const n of DOCS){ const v = lsGet(n); if (v) state[n] = Object.assign(clone(DEF[n]), v); }
function save(name){ if (!lsSet(name, state[name])) toast("保存失败:手机存储空间不足或处于无痕模式"); }
const NAME = () => (state.profile.name || "Amber").trim() || "Amber";
const W = () => state.weights.entries;
const LOG = () => state.workouts.log;
const MDAYS = () => state.meals.days;
const goalW = () => state.profile.goalWeight || null;
const isDemo = () => false;
const demoBanner = () => "";
function dayMin(d){ return (LOG()[d] || []).reduce((a,x)=>a+x.min,0); }
function dayKcal(d){ return (LOG()[d] || []).reduce((a,x)=>a+(x.kcal||0),0); }
function streak(){ const has = d => W()[d] != null || (LOG()[d] || []).length; let d = today(); if (!has(d)) d = addD(d,-1); let n = 0; while (has(d)){ n++; d = addD(d,-1); } return n; }
function weekStats(){ const ws = weekStart(today()); let min = 0, kcal = 0, n = 0, days = 0; for (let i=0;i<7;i++){ const d = addD(ws,i), m = dayMin(d); min += m; kcal += dayKcal(d); n += (LOG()[d]||[]).length; if (m) days++; } return {min, kcal, n, days}; }
function totals(){ const all = Object.values(LOG()).flat(); return {n:all.length, min:all.reduce((a,x)=>a+x.min,0), kcal:all.reduce((a,x)=>a+(x.kcal||0),0)}; }
function lastWorkoutGap(){ const ks = Object.keys(LOG()).filter(d => d <= today() && LOG()[d].length).sort(); return ks.length ? diffD(ks[ks.length-1], today()) : null; }
function targets(){
  const p = state.profile, w = latestW() || 58, B = latestBody(60);
  const formula = 10*w + 6.25*p.height - 5*p.age + (p.sex === "m" ? 5 : -161);
  const measured = B && B.bmr > 600 && B.bmr < 3500, bmr = measured ? B.bmr : formula, tdee = bmr * p.activity;
  let kcal = p.goal === "lose" ? tdee - 500 : p.goal === "gain" ? tdee + 300 : p.goal === "recomp" ? tdee - 250 : tdee;
  kcal = Math.round(Math.max(kcal, p.sex === "m" ? 1500 : 1200, Math.round(bmr))/10)*10;
  const prot = Math.round(w * (p.goal === "keep" ? 1.4 : 1.8)), fat = Math.round(kcal*.27/9), carb = Math.max(0, Math.round((kcal - prot*4 - fat*9)/4));
  return {bmr:Math.round(bmr), measured, tdee:Math.round(tdee), kcal, prot, fat, carb};
}
function saveHealth(kind, r){
  const h = state.health, arr = kind === "body" ? h.body : kind === "sleep" ? h.sleep : h.ext;
  r.id = r.id || (kind[0] + (r.date||today()).replace(/-/g,"") + (r.time ? r.time.replace(":","") : "-" + Math.random().toString(36).slice(2,6)));
  const key = x => kind === "sleep" ? x.date : x.time ? x.date + "|" + x.time : x.id;
  const i = arr.findIndex(x => x.id === r.id || key(x) === key(r));
  if (i >= 0) arr[i] = Object.assign({}, arr[i], r); else arr.push(r);
  arr.sort(byDate); while (arr.length > 500) arr.shift();
  if (kind === "body" && r.weight > 25 && r.weight < 300){ state.weights.entries[r.date] = Math.round(r.weight*10)/10; save("weights"); }
  if (kind === "workout" && r.minutes > 0){
    const d = r.date, list = state.workouts.log[d] = state.workouts.log[d] || [], j = list.findIndex(x => x.ext === r.id);
    const entry = {c:null, name:(r.name||"运动") + (r.src === "手动录入" ? "" : " · 手环"), min:Math.max(1, Math.round(r.minutes)), kcal:Math.round(r.activeKcal || r.kcal || 0), ext:r.id, at:r.time || null};
    if (j >= 0) list[j] = entry; else list.push(entry);
    save("workouts");
  }
  save("health");
}

/* ================================================================
   Blood glucose
   ================================================================ */
const GLU_TAGS = ["空腹","餐前","餐后2小时","运动前","运动后","睡前","随机"];
const gRange = () => [state.profile.gLo || 3.9, state.profile.gHi || 7.8];
function curveStats(pts){
  if (!pts || pts.length < 3) return null;
  const [lo, hi] = gRange(), vs = pts.map(p => p[1]), n = vs.length;
  const mean = vs.reduce((a,v)=>a+v,0)/n, sd = Math.sqrt(vs.reduce((a,v)=>a+(v-mean)**2,0)/n);
  const inR = vs.filter(v => v >= lo && v <= hi).length, above = vs.filter(v => v > hi).length, below = vs.filter(v => v < lo).length;
  const peaks = []; let cur = null;
  pts.forEach(([t,v]) => { if (v > hi){ if (!cur) cur = {start:t, end:t, max:v}; cur.end = t; cur.max = Math.max(cur.max, v); } else if (cur){ peaks.push(cur); cur = null; } });
  if (cur) peaks.push(cur);
  const dips = []; cur = null;
  pts.forEach(([t,v]) => { if (v < lo){ if (!cur) cur = {start:t, end:t, min:v}; cur.end = t; cur.min = Math.min(cur.min, v); } else if (cur){ dips.push(cur); cur = null; } });
  if (cur) dips.push(cur);
  return {n, mean, sd, cv: mean ? sd/mean*100 : 0, tir: inR/n*100, tar: above/n*100, tbr: below/n*100, min: Math.min(...vs), max: Math.max(...vs), peaks, dips, from: pts[0][0], to: pts[pts.length-1][0]};
}
function gDay(date){
  const G = state.glucose, rec = G.days[date] || {}, curve = G.curves[date], st = curveStats(curve);
  const logs = G.logs.filter(l => l.date === date);
  const tir = rec.tir != null ? rec.tir : st ? st.tir : null;
  return {date, tir, tar: rec.tar != null ? rec.tar : st && st.tar, tbr: rec.tbr != null ? rec.tbr : st && st.tbr, st, curve, logs, src: rec.src || (st ? "曲线估算" : null)};
}
function gDates(){ const G = state.glucose; return [...new Set(Object.keys(G.days).concat(Object.keys(G.curves), G.logs.map(l => l.date)))].sort(); }
const hasGlucose = () => gDates().length > 0 || state.glucose.weeks.length > 0;
function gSummary(){
  // latest imported weekly report if it is recent, otherwise computed from the last 7 days
  const G = state.glucose, wk = G.weeks.slice().sort((a,b)=>a.start<b.start?-1:1).pop(), t = today();
  if (wk && diffD(wk.start, t) <= 13) return Object.assign({src:"周报告", from:wk.start, to:addD(wk.start,6)}, wk);
  const days = []; for (let i=6;i>=0;i--){ const d = gDay(addD(t,-i)); if (d.tir != null) days.push(d); }
  if (!days.length) return wk ? Object.assign({src:"周报告", from:wk.start, to:addD(wk.start,6)}, wk) : null;
  const allPts = days.flatMap(d => d.curve || []), st = curveStats(allPts);
  return {src:"最近 7 天", from:days[0].date, to:days[days.length-1].date, tir: days.reduce((a,d)=>a+d.tir,0)/days.length, cv: st ? st.cv : null,
    high: days.reduce((a,d)=>a+(d.st ? d.st.peaks.length : 0),0), low: days.reduce((a,d)=>a+(d.st ? d.st.dips.length : 0),0), mean: st ? st.mean : null};
}
// mean glucose in the hour before vs the hour after a workout that has a start time
function exerciseEffects(){
  const out = [];
  Object.entries(LOG()).forEach(([d, list]) => {
    const c = state.glucose.curves[d]; if (!c) return;
    list.forEach(w => {
      if (!w.at) return;
      const [h,m] = w.at.split(":").map(Number), s = h*60+m, e = s + w.min;
      const before = c.filter(p => p[0] >= s-60 && p[0] < s).map(p=>p[1]), after = c.filter(p => p[0] > e && p[0] <= e+60).map(p=>p[1]);
      if (before.length >= 3 && after.length >= 3){ const a = before.reduce((x,y)=>x+y,0)/before.length, b = after.reduce((x,y)=>x+y,0)/after.length; out.push({date:d, at:w.at, name: w.name || (courseById(w.c)||{}).name || "运动", before:a, after:b}); }
    });
  });
  return out;
}
function gInsights(){
  const S = gSummary(), [lo, hi] = gRange(), out = [], t = today();
  if (!S) return out;
  if (S.tir != null) out.push(S.tir >= 70 ? {lv:"good", title:`目标范围内时间 ${f1(S.tir)}%`, text:`高于 70% 的建议目标,血糖控制得很好。继续保持规律饮食和运动。`} : {lv:"warn", title:`目标范围内时间 ${f1(S.tir)}%,低于 70%`, text:"可以从两件小事开始:每餐先吃蔬菜和蛋白质、主食放最后;饭后 15–30 分钟散步 10–15 分钟。", act:["meal15","饭后散步 15 分钟"]});
  if (S.cv != null) out.push(S.cv <= 36 ? {lv:"good", title:`血糖波动小(变异系数 ${f1(S.cv)}%)`, text:"变异系数 ≤36% 说明血糖平稳。"} : {lv:"warn", title:`血糖波动偏大(变异系数 ${f1(S.cv)}%)`, text:"波动大多和精制碳水、进餐时间不规律有关。主食换成粗粮杂豆,三餐定时定量。"});
  // when do the highs happen?
  const peaks = []; for (let i=0;i<14;i++){ const d = gDay(addD(t,-i)); if (d.st) peaks.push(...d.st.peaks); }
  if (peaks.length){
    const meal = peaks.filter(p => { const h = p.start/60; return (h>=7&&h<10.5)||(h>=11.5&&h<15)||(h>=18&&h<21.5); }).length;
    out.push({lv:"warn", title:`最近 ${peaks.length} 次血糖超过 ${hi}`, text: meal >= peaks.length/2 ? "大多发生在餐后。饭后散步 10–15 分钟能明显压低餐后血糖峰值,这是最简单有效的办法。" : "注意记录当时吃了什么、睡得怎样,找出规律。", act:["meal15","饭后散步 15 分钟"]});
  } else if (S.high){ out.push({lv:"warn", title:`本周有 ${S.high} 次高血糖`, text:"多数高血糖出现在餐后,试试饭后散步 10–15 分钟。", act:["meal15","饭后散步 15 分钟"]}); }
  if (S.low) out.push({lv:"bad", title:`有 ${S.low} 次低血糖`, text:"留意低血糖发生的时间,运动前别空腹,随身带一点糖果。", act:["sheet:hypo","低血糖安全须知"]});
  const fx = exerciseEffects();
  if (fx.length){ const avg = fx.reduce((a,x)=>a+(x.after-x.before),0)/fx.length; if (avg < 0) out.push({lv:"good", title:`运动后血糖平均下降 ${f1(-avg)}`, text:`对比了 ${fx.length} 次运动前后 1 小时的平均血糖。运动是天然的降糖药!`}); }
  out.push({lv:"good", title:"力量训练也能帮助控糖", text:"肌肉是消耗血糖的大户。每周 2 次力量训练,能提高身体对胰岛素的敏感性。", act:["strength15","入门力量"]});
  return out;
}
function addGlucoseLog(date, time, v, tag){
  state.glucose.logs.push({date, time, v, tag}); state.glucose.logs.sort((a,b) => (a.date+a.time) < (b.date+b.time) ? -1 : 1);
  while (state.glucose.logs.length > 1500) state.glucose.logs.shift();
  save("glucose");
}
function pruneCurves(){ const ks = Object.keys(state.glucose.curves).sort(); while (ks.length > 150) delete state.glucose.curves[ks.shift()]; }

/* ================================================================
   Smart plan — built from the profile, body, sleep and glucose data
   ================================================================ */
const LEVELS = {none:["几乎不运动",12], some:["偶尔运动",20], regular:["规律运动",30]};
const LIKES = [["walk","走路散步"],["dance","跳舞"],["yoga","瑜伽拉伸"],["strength","力量塑形"],["home","在家不出门"]];
function courseType(c){
  if (["warm5","cool5"].includes(c.id)) return "wrap";
  if (c.cat === "aero" || c.cat === "burn") return "cardio";
  if (c.cat === "str" || c.cat === "core") return "strength";
  if (c.cat === "relax") return "relax";
  return "flex";
}
function planContext(){
  const p = state.profile, B = latestBody(120), S = latestSleep(), G = gSummary();
  const bm = (B && B.bmi) || bmi(latestW());
  return {p, B, S, G,
    needStrength: !!(B && ((B.muscle != null && status("muscle",B.muscle)[1] === "bad") || (B.fat != null && B.fat > ref("fat")[1]) || (B.muscleLevel != null && B.muscleLevel <= 2))),
    sleepPoor: !!(S && S.deep != null && S.deep/((S.deep||0)+(S.light||0)+(S.rem||0) || 1) < .2),
    lowImpact: p.lowImpact || (bm && bm >= 28),
    beginner: p.level === "none"};
}
function generatePlan(){
  const ctx = planContext(), p = ctx.p, reasons = [];
  const target = p.mins || LEVELS[p.level][1];
  if (ctx.beginner) reasons.push("从每次 " + target + " 分钟左右的入门课开始,先把习惯养起来,做到了再慢慢加量。");
  if (ctx.needStrength) reasons.push("体成分显示体脂偏高或肌肉偏少,每周安排 2 次力量训练。");
  if (ctx.G) reasons.push("有血糖数据:有氧和力量交替安排,另外建议每天饭后散步 10–15 分钟。");
  if (ctx.sleepPoor) reasons.push("深睡比例偏低,休息日推荐睡前做放松瑜伽。");
  if (ctx.lowImpact) reasons.push("避开跳跃动作,选低冲击的课程保护膝盖。");
  if (p.likes.length) reasons.push("优先挑选你喜欢的:" + p.likes.map(k => (LIKES.find(x=>x[0]===k)||[,""])[1]).join("、") + "。");
  const days = {3:[0,2,4],4:[0,1,3,5],5:[0,1,2,4,5],6:[0,1,2,3,4,5]}[p.days] || [0,2,4,5];
  const types = (ctx.needStrength || ctx.G) ? ["cardio","strength","cardio","strength","flex","cardio"] : ["cardio","flex","strength","cardio","flex","strength"];
  const likeScore = c => {
    let s = 0;
    if (p.likes.includes("walk") && /walk|dogwalk|meal|slowjog/.test(c.id)) s += 10;
    if (p.likes.includes("dance") && /dance|steptouch|boxing/.test(c.id + c.name)) s += 10;
    if (p.likes.includes("yoga") && (c.cat === "flex" || c.cat === "relax")) s += 10;
    if (p.likes.includes("strength") && (c.cat === "str" || c.cat === "core")) s += 10;
    if (p.likes.includes("home") && !c.tags.includes("不出门")) s -= 12;
    if (ctx.G && c.tags.includes("控糖")) s += 4;
    return s;
  };
  const used = new Set(), week = {};
  days.forEach((d, i) => {
    const type = types[i % types.length];
    let pool = COURSES.filter(c => courseType(c) === type || (type === "flex" && courseType(c) === "relax"));
    pool = pool.filter(c => !(ctx.lowImpact && JUMPY.has(c.id)) && (!ctx.beginner || ["入门","初级"].includes(c.lv)) && (p.level !== "some" || c.lv !== "进阶"));
    if (!pool.length) pool = COURSES.filter(c => c.tags.includes("新手"));
    const scored = pool.map(c => ({c, s: Math.abs(courseMin(c) - target) - likeScore(c) + (used.has(c.id) ? 15 : 0) + Math.random()*4})).sort((a,b) => a.s - b.s);
    const main = scored[0].c; used.add(main.id);
    const combo = [];
    if (target >= 20 && type !== "flex" && courseMin(main) < target + 5) combo.push("warm5");
    combo.push(main.id);
    if (target >= 20 && type === "strength") combo.push("cool5");
    week[d] = combo;
  });
  state.plan.week = week;
  state.plan.meta = {at: today(), reasons, target, level: p.level, rest: ctx.sleepPoor ? "sleep15" : ctx.G ? "meal15" : "catyoga12"};
  save("plan");
}
function todayCombo(){
  const ids = state.plan.week[wdi(today())];
  if (ids && ids.length) return {ids, rest:false};
  if (!state.plan.meta) return {ids:[state.profile.level === "none" ? "start7" : "quiet20"], rest:false, suggested:true};
  return {ids:[state.plan.meta.rest || "catyoga12"], rest:true};
}
const comboMin = ids => ids.reduce((a,id) => a + courseMin(courseById(id)), 0);
const comboKcal = ids => ids.reduce((a,id) => { const c = courseById(id); return a + kcalOf(c.met, courseMin(c), latestW() || 58); }, 0);
const doneToday = () => (LOG()[today()] || []).length > 0;
function planProgress(){
  const ws = weekStart(today()), wk = state.plan.week; let planned = 0, done = 0;
  Object.keys(wk).forEach(d => { if (wk[d] && wk[d].length){ planned++; const date = addD(ws, +d); if ((LOG()[date]||[]).length) done++; } });
  return {planned, done, days: weekStats().days};
}

/* ================================================================
   Motivation: garden, journey, food equivalents, treats
   ================================================================ */
const FLOWER_COLS = ["#EE6A4C","#F4A6B6","#F2B544","#FFFFFF","#B9A6E8","#F28A5B","#F7C7D3"];
const KM_PER_MIN = 0.075;   // about 4.5 km/h
const MILESTONES = [[0,"家门口"],[2,"小区花园"],[5,"河边绿道"],[10,"樱花小路"],[20,"森林公园"],[35,"湖边草地"],[50,"山顶"],[80,"海边"],[120,"星空草原"],[200,"环游世界"]];
function journey(){
  const km = totals().min * KM_PER_MIN;
  let i = 0; while (i < MILESTONES.length-1 && km >= MILESTONES[i+1][0]) i++;
  const cur = MILESTONES[i], next = MILESTONES[Math.min(i+1, MILESTONES.length-1)];
  return {km, i, cur, next, frac: next[0] > cur[0] ? (km - cur[0])/(next[0] - cur[0]) : 1};
}
const FOOD_EQ = [[300,"一杯奶茶"],[174,"一碗米饭"],[250,"一个汉堡的一半"],[90,"一个苹果"],[45,"一块饼干"]];
function foodEq(kcal){
  if (kcal < 40) return "";
  for (const [k,n] of FOOD_EQ){ if (kcal >= k*0.8){ const x = kcal/k; return `≈ ${x >= 1.5 ? f1(x) + " 份" : ""}${n}`.replace("≈ 1 份",""); } }
  return "";
}
function dogMood(){
  const h = new Date().getHours(), gap = lastWorkoutGap();
  if (h >= 22 || h < 5) return "sleepy";
  if (doneToday()) return "happy";
  if (gap != null && gap >= 3) return "sad";
  return "normal";
}
function catMood(){
  const h = new Date().getHours(), gap = lastWorkoutGap();
  if (h >= 22 || h < 5 || (h >= 13 && h < 15)) return "sleepy";
  if (doneToday()) return "happy";
  if (gap != null && gap >= 5) return "sad";
  return "normal";
}
function petLine(kind, key){
  const L = PET_LINES[kind], h = new Date().getHours();
  let k = key || (kind === "dog" ? dogMood() : catMood());
  if (!key && k === "normal" && h >= 6 && h < 10 && Math.random() < .5) k = "morning";
  return pick(L[k] || L.normal).replace(/\{name\}/g, "姐姐");
}

/* ================================================================
   Sample data (for trying the app; nothing personal)
   ================================================================ */
function loadSample(){
  lsSet("presample", Object.fromEntries(DOCS.map(n => [n, state[n]])));
  let seed = 11; const rnd = () => (seed = (seed*9301+49297)%233280)/233280;
  const t = today(), ids = {0:"start7",1:"meal15",3:"strength15",5:"dogwalk20"};
  for (let i=27;i>=0;i--){
    const d = addD(t,-i), w = wdi(d);
    if (rnd() < .75) state.weights.entries[d] = Math.round((61.6 - (27-i)*0.035 + (rnd()-.5)*.5)*10)/10;
    if (ids[w] && rnd() < .85 && i > 0){ const c = courseById(ids[w]); state.workouts.log[d] = [{c:c.id, min:courseMin(c), kcal:kcalOf(c.met, courseMin(c), 61), at: w === 1 ? "19:20" : "18:30"}]; }
  }
  // a CGM-like curve for the last 7 days: meals, an evening walk on some days
  for (let i=7;i>=1;i--){
    const d = addD(t,-i), walk = (LOG()[d]||[])[0], pts = [];
    for (let m=0;m<1440;m+=5){
      let v = 4.9 + Math.sin(m/1440*Math.PI*2)*0.2 + (rnd()-.5)*.15;
      [[7.5*60,2.0],[12.5*60,2.8],[18.7*60,3.5]].forEach(([mt,a]) => { const x = (m - mt)/60; if (x > 0) v += a * x * Math.exp(1 - x*1.3) * 1.3; });
      if (walk && walk.at){ const [h,mm] = walk.at.split(":").map(Number), s = h*60+mm; if (m > s && m < s+150) v -= 1.1*Math.sin(Math.min(1,(m-s)/150)*Math.PI); }
      pts.push([m, Math.round(v*10)/10]);
    }
    state.glucose.curves[d] = pts;
  }
  state.glucose.logs.push({date:t, time:"07:30", v:5.1, tag:"空腹"});
  saveHealth("body", {date:addD(t,-3), time:"08:00", weight:61.0, fat:31.5, muscle:64.5, bone:2.1, visceral:5, bmr:1250, protein:17, water:48, bmi:23.1, score:76, src:"示例数据"});
  saveHealth("sleep", {date:addD(t,-1), bedtime:"23:30", wake:"07:10", night:460, deep:85, light:250, rem:125, wakeCount:2, score:82, src:"示例数据"});
  state.profile.sample = true;
  DOCS.forEach(save);
  generatePlan();
}
function clearSample(){
  const prev = lsGet("presample"), bg = state.profile.bg;
  if (prev) DOCS.forEach(n => { state[n] = Object.assign(clone(DEF[n]), prev[n] || {}); save(n); });
  state.profile.bg = bg;
  state.profile.sample = false; save("profile");
  try { localStorage.removeItem(LS+"presample"); } catch(e){}
}

/* ================================================================
   Screenshot import: offline OCR, Live Text paste, manual entry
   ================================================================ */
const FIELDS = {
  glucoseWeek:[["start","这周周一","date"],["tir","目标范围内时间 TIR %"],["cv","变异系数 CV %"],["high","高血糖事件 次"],["low","低血糖事件 次"],["d0","周一 TIR %"],["d1","周二 TIR %"],["d2","周三 TIR %"],["d3","周四 TIR %"],["d4","周五 TIR %"],["d5","周六 TIR %"],["d6","周日 TIR %"]],
  glucoseDay:[["date","日期","date"],["tir","TIR %"],["tar","高于目标 TAR %"],["tbr","低于目标 TBR %"]],
  glucoseLog:[["date","日期","date"],["time","时间","time"],["v","血糖 mmol/L"],["tag","测量时间点","select",GLU_TAGS]],
  body:[["date","日期","date"],["time","时间","time"],["weight","体重 kg"],["fat","体脂率 %"],["muscle","肌肉率 %"],["bone","骨量 kg"],["muscleLevel","储肌等级"],["visceral","内脏脂肪"],["bmr","基础代谢 千卡"],["protein","蛋白质 %"],["water","水分 %"],["vo2max","最大摄氧量"],["bmi","BMI"],["score","身体得分"],["bodyAge","身体年龄"],["bodyType","身体类型","text"]],
  sleep:[["date","日期(醒来当天)","date"],["bedtime","入睡","time"],["wake","醒来","time"],["night","夜间睡眠 分钟"],["nap","小睡 分钟"],["deep","深睡 分钟"],["light","浅睡 分钟"],["rem","快速眼动 分钟"],["wakeCount","清醒次数"],["score","睡眠得分"],["hrMin","最低心率"],["hrMax","最高心率"]],
  workout:[["date","日期","date"],["time","开始时间","time"],["name","运动名称","text"],["minutes","时长 分钟"],["kcal","总消耗 千卡"],["activeKcal","活动热量"],["avgHr","平均心率"],["maxHr","最大心率"],["load","训练负荷"],["z_extreme","极限区 分"],["z_anaerobic","无氧耐力区 分"],["z_aerobic","有氧耐力区 分"],["z_fatburn","燃脂区 分"],["z_warmup","热身区 分"],["aerobicTE","有氧训练压力"],["recovery","恢复时间 小时"]]
};
const KIND_NAME = {glucoseWeek:"血糖周报", glucoseDay:"血糖日曲线", glucoseLog:"单次血糖", body:"体成分 / 体重", sleep:"睡眠", workout:"运动训练"};
let pending = [], ocrWorker = null, ocrLoading = null, ocrProgress = null;
const absURL = u => new URL(u, document.baseURI).href;
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("script")); document.head.appendChild(s); }); }
// Tesseract keeps language data in IndexedDB (idb-keyval: db "keyval-store", store "keyval").
// We put it there ourselves from vendor/lang/chi_sim-traineddata.wasm — gzip data, named .wasm only so
// every static host (GitHub Pages, artifacts) serves it as binary — then the engine never needs the network.
const LANG_KEY = "./chi_sim.traineddata";
function idbStore(mode){
  return new Promise((res, rej) => {
    const rq = indexedDB.open("keyval-store");
    rq.onupgradeneeded = () => rq.result.createObjectStore("keyval");
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => { const db = rq.result; if (!db.objectStoreNames.contains("keyval")){ db.close(); rej(new Error("no store")); return; } res(db.transaction("keyval", mode).objectStore("keyval")); };
  });
}
async function primeLang(){
  try {
    const st = await idbStore("readonly");
    const have = await new Promise(r => { const g = st.get(LANG_KEY); g.onsuccess = () => r(!!g.result); g.onerror = () => r(false); });
    if (have) return;
    const buf = new Uint8Array(await (await fetch("vendor/lang/chi_sim-traineddata.wasm")).arrayBuffer());
    if (buf.length < 100000) throw new Error("lang");
    const w = await idbStore("readwrite");
    await new Promise((r, j) => { const q = w.put(buf, LANG_KEY); q.onsuccess = r; q.onerror = () => j(q.error); });
  } catch(e){ /* no IndexedDB (private mode): the engine will try to download on its own */ }
}
function getOCR(){
  if (ocrWorker) return Promise.resolve(ocrWorker);
  if (!ocrLoading) ocrLoading = (async () => {
    await primeLang();
    if (!window.Tesseract) await loadScript("vendor/tesseract.min.js");
    const w = await Tesseract.createWorker("chi_sim", 1, {workerPath:absURL("vendor/worker.min.js"), corePath:absURL("vendor/core"), langPath:absURL("vendor/lang"), gzip:true, workerBlobURL:false,
      logger: m => ocrProgress && ocrProgress(m)});
    ocrWorker = w; return w;
  })().catch(e => { ocrLoading = null; throw e; });
  return ocrLoading;
}
function loadImage(file){
  return new Promise((res, rej) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => res({img, url}); img.onerror = () => rej(new Error("image")); img.src = url; });
}
async function recognize(p){
  try {
    const {img} = await loadImage(p.file);
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    const full = document.createElement("canvas"); full.width = w0; full.height = h0;
    const fctx = full.getContext("2d", {willReadFrequently:true}); fctx.drawImage(img, 0, 0);
    const pix = fctx.getImageData(0, 0, w0, h0);
    // enlarge and gray out for the recognizer; small text reads much better at ~1600 px wide
    const sc = Math.min(2, Math.max(1, 1600 / w0)), oc = document.createElement("canvas");
    oc.width = Math.round(w0*sc); oc.height = Math.round(h0*sc);
    const octx = oc.getContext("2d", {willReadFrequently:true}); octx.imageSmoothingQuality = "high"; octx.drawImage(img, 0, 0, oc.width, oc.height);
    const od = octx.getImageData(0, 0, oc.width, oc.height), a = od.data;
    for (let i=0;i<a.length;i+=4){ const l = a[i]*.299 + a[i+1]*.587 + a[i+2]*.114; a[i] = a[i+1] = a[i+2] = l; }
    octx.putImageData(od, 0, 0);
    p.msg = "正在加载识别引擎…(第一次约 10 MB,之后离线可用)"; updateItem(p);
    ocrProgress = m => { if (m.status === "recognizing text"){ p.msg = `正在识别文字 ${Math.round(m.progress*100)}%`; const el = document.querySelector(`#rv-${p.id} .rmsg`); if (el) el.textContent = p.msg; } };
    const worker = await getOCR();
    const {data} = await worker.recognize(oc);
    const r = HealthParse.parse(data.text, today());
    let type = r.type, curve = null;
    if (type === "glucoseDay" || !type){
      const [lo, hi] = gRange();
      const tr = HealthParse.traceCurve(pix, (r.data && r.data.bandHi) || hi, (r.data && r.data.bandLo) || lo);
      if (tr && tr.points.length >= 20){ curve = tr.points; type = "glucoseDay"; p.lightLine = !tr.darkLine; }
    }
    if (!type){ p.st = "manual"; p.msg = "没认出这是哪类数据,请选择类型后对照截图填写。"; }
    else {
      p.type = type; p.data = flattenParsed(type, r.data || {}); p.curve = curve; p.st = "ready";
      const n = Object.keys(p.data).filter(k => !["date","time","start"].includes(k)).length;
      p.msg = type === "glucoseDay" ? (curve ? `已从曲线读出 ${curve.length} 个点(近似值)。${p.lightLine ? "这条线颜色较浅,可能是「昨日」曲线,请核对日期。" : ""}` : "没找到曲线,请填写当天的指标。")
            : `识别出 ${n} 项,请对照截图核对,有误直接改。`;
    }
  } catch(e){
    p.st = "manual";
    p.msg = "识别引擎加载失败(可能是网络或浏览器限制)。可以用「粘贴文字」或手动填写。";
  }
  updateItem(p);
}
function flattenParsed(type, d){
  const r = Object.assign({}, d);
  if (type === "glucoseWeek"){ (d.daily || []).forEach((v,i) => { if (v != null) r["d"+i] = v; }); delete r.daily; }
  if (type === "glucoseDay"){ delete r.bandHi; delete r.bandLo; }
  return r;
}
function onFiles(files){
  [...files].filter(f => /^image\//.test(f.type)).slice(0,6).forEach(f => {
    const p = {id:"p"+Math.random().toString(36).slice(2,8), file:f, url:URL.createObjectURL(f), type:"body", data:{}, st:"reading", msg:"准备识别…"};
    pending.push(p);
  });
  openSheet("review");
  // one at a time keeps memory low on phones
  (async () => { for (const p of pending.filter(x => x.st === "reading")) await recognize(p); })();
}
function onPaste(text){
  const r = HealthParse.parse(text, today());
  if (!r.type){ toast("没认出数据类型,请确认复制的是健康 App 的截图文字"); return false; }
  pending.push({id:"p"+Math.random().toString(36).slice(2,8), type:r.type, data:flattenParsed(r.type, r.data), st:"ready", msg:`从文字中识别出 ${r.found} 项,请核对。`});
  openSheet("review");
  return true;
}
function manualEntry(type){ pending.push({id:"p"+Math.random().toString(36).slice(2,8), type, data:{date:today(), time: type === "glucoseLog" ? new Date().toTimeString().slice(0,5) : ""}, st:"manual", msg:"对照其他 App 的数据填写,空着的项目可以不填。"}); openSheet("review"); }
function readItem(p){
  const r = {};
  FIELDS[p.type].forEach(([k,,t]) => { const el = document.getElementById(`f-${p.id}-${k}`); if (!el) return; const v = el.value.trim(); r[k] = t ? v : (v === "" ? null : +v); });
  return r;
}
function savePending(id){
  const p = pending.find(x => x.id === id); if (!p) return;
  const r = readItem(p), G = state.glucose;
  if (p.type === "glucoseWeek"){
    if (!r.start){ toast("请填写这周周一的日期"); return; }
    const ws = weekStart(r.start), daily = [0,1,2,3,4,5,6].map(i => r["d"+i]);
    if (r.tir == null && daily.every(v => v == null)){ toast("至少填写 TIR"); return; }
    G.weeks = G.weeks.filter(w => w.start !== ws).concat([{start:ws, tir:r.tir, cv:r.cv, high:r.high, low:r.low}]);
    daily.forEach((v,i) => { if (v != null){ const d = addD(ws,i); G.days[d] = Object.assign({}, G.days[d], {tir:v, src:"周报告"}); } });
    save("glucose");
  } else if (p.type === "glucoseDay"){
    if (!r.date){ toast("请填写日期"); return; }
    if (p.curve) { G.curves[r.date] = p.curve; pruneCurves(); }
    const rec = Object.assign({}, G.days[r.date]);
    ["tir","tar","tbr"].forEach(k => { if (r[k] != null) rec[k] = r[k]; });
    if (p.curve) rec.src = "曲线识别";
    if (!p.curve && rec.tir == null){ toast("请至少填写 TIR"); return; }
    G.days[r.date] = rec; save("glucose");
  } else if (p.type === "glucoseLog"){
    if (!(r.v > 1 && r.v < 35)){ toast("请填写 1–35 之间的血糖值"); return; }
    addGlucoseLog(r.date || today(), r.time || "12:00", r.v, r.tag || "随机");
    if (r.v < gRange()[0]){ pending = pending.filter(x => x !== p); render(); openSheet("hypo"); return; }
  } else {
    if (!r.date){ toast("请填写日期"); return; }
    const rec = {date:r.date, src: p.url ? "截图识别" : "手动录入"};
    Object.entries(r).forEach(([k,v]) => { if (v !== null && v !== "" && !k.startsWith("z_")) rec[k] = v; });
    if (p.type === "workout"){ rec.zones = {}; ["extreme","anaerobic","aerobic","fatburn","warmup"].forEach(k => { if (r["z_"+k] != null) rec.zones[k] = r["z_"+k]; }); if (!(rec.minutes > 0)){ toast("请填写运动时长"); return; } }
    if (p.type === "sleep" && !(rec.night > 0)){ const s = (rec.deep||0) + (rec.light||0) + (rec.rem||0); if (s) rec.night = s; else { toast("请填写夜间睡眠时长"); return; } }
    if (p.type === "body" && !Object.keys(rec).some(k => !["date","time","src"].includes(k))){ toast("至少填写一项数据"); return; }
    saveHealth(p.type, rec);
  }
  if (p.url) URL.revokeObjectURL(p.url);
  pending = pending.filter(x => x !== p);
  toast(`${KIND_NAME[p.type]}已保存,图表已更新`);
  if (!pending.length) closeSheet(); else { const el = document.getElementById("rv-" + id); if (el) el.remove(); }
  if (p.type.startsWith("glucose")) { selDay = p.type === "glucoseDay" ? (r.date || selDay) : selDay; }
  render();
}

/* ================================================================
   Coach chat with 二楞 and 发财 (offline)
   ================================================================ */
let chat = (() => { try { return JSON.parse(sessionStorage.getItem("amber2:chat")) || []; } catch(e){ return []; } })();
function persistChat(){ try { sessionStorage.setItem("amber2:chat", JSON.stringify(chat.slice(-40))); } catch(e){} }
function achievements(){
  const t = totals(), st = streak(), j = journey(), a = [];
  if (t.n) a.push(`完成了 ${t.n} 次运动`);
  if (j.km >= 1) a.push(`相当于走了 ${f1(j.km)} 公里`);
  if (st > 1) a.push(`连续打卡 ${st} 天`);
  return a.join("、");
}
// 二楞: warm, clingy, a bit of a goof and a foodie, praises everything. 发财: aloof and sharp-tongued, secretly caring.
// Both call her 姐姐. Each intent has several replies; one is picked at random.
const sayD = text => ({who:"dog", text}), sayC = text => ({who:"cat", text});
const anyOf = (...opts) => () => pick(opts).map(m => typeof m === "function" ? m() : m);
const COACH = [
  {k:["低血糖","心慌","手抖","出冷汗","头晕"], r: () => [sayD("姐姐,如果现在心慌、手抖、出冷汗,先停下来,马上吃 15 克糖:半杯果汁或 3–4 块方糖,15 分钟后再测一次。不舒服一定要告诉身边的人!"), Object.assign(sayC("别逞强。糖先吃了再说。"), {act:["sheet:hypo","低血糖安全须知"]})]},
  {k:["血糖高","高血糖","餐后血糖","血糖升","超标","血糖有点高"], r: anyOf(
    [Object.assign(sayD("饭后陪我散步吧!饭后 15–30 分钟出门走 10–15 分钟,餐后的高峰会低很多。我已经把牵引绳叼来了~"), {act:["meal15","饭后散步 15 分钟"]}), sayC("还有,每餐先吃菜和肉,主食放最后。我吃饭从来不急,你学着点。")],
    [Object.assign(sayD("姐姐别担心,偶尔高一点很正常。我们现在就去走一圈,回来再测,看看会降多少!"), {act:["meal15","饭后散步 15 分钟"]})],
    [sayC("又是精米白面吧。换一半成粗粮,我替你盯着。"), Object.assign(sayD("然后我负责陪你走路消化!"), {act:["meal15","饭后散步 15 分钟"]})])},
  {k:["加班","工作","上班","开会","忙","出差","老板"], r: anyOf(
    [sayD("姐姐辛苦了!坐久了起来动 2 分钟:伸伸懒腰、转转脖子,我在桌子底下等你~"), sayC("工作做不完的。你的腰只有一个。")],
    [Object.assign(sayC("忙不是理由。我也很忙,忙着睡觉,但我还是会伸懒腰。"), {act:["cool5","做 5 分钟拉伸"]}), sayD("下班回来我们去散步,好不好?好不好?")])},
  {k:["累","不想","懒","没动力","没力气","拖延","起不来","好难","偷懒","明天再说"], r: anyOf(
    [Object.assign(sayD("姐姐累了就先歇一下,这很正常。我们只做 5 分钟好不好?做完还想停就停,我保证不催你!"), {act:["warm5","只做 5 分钟"]}), sayC("先站起来。站起来就赢了一半。")],
    [Object.assign(sayD("那今天就做最轻松的!坐在椅子上动一动也算数,我趴在你脚边陪你~"), {act:["chair10","椅子上的运动"]}), sayC("我连椅子都懒得下。你比我强一点就行。")],
    [sayC("明天再说?你上周也是这么说的。"), Object.assign(sayD("发财你别凶姐姐!姐姐,就 5 分钟,做完我给你表演转圈圈!"), {act:["warm5","只做 5 分钟"]})])},
  {k:["没变化","平台","不掉","没瘦","不降","停滞","卡住","涨了","胖了","重了"], r: anyOf(
    [sayD("体重短期不动或者涨一点,大多是水分在捣乱:盐吃多了、经期前后、力量训练后肌肉储水都会这样。看一周的平均值更准,继续坚持!"), sayC("我体重也忽上忽下,从不焦虑。")],
    [sayD("姐姐,体重秤只看得到数字,看不到你变紧的线条!看看体脂率和腰围,它们更诚实。"), sayC("而且你最近站得比以前直了。我观察的。")])},
  {k:["吃多","暴食","吃撑","火锅","奶茶","零食","蛋糕","烧烤","聚餐","嘴馋"], r: anyOf(
    [Object.assign(sayD("一顿吃多了没关系!下一餐正常吃,多一份蔬菜。现在出去走 15 分钟,帮助消化、也帮血糖降下来~"), {act:["meal15","饭后散步 15 分钟"]}), sayC("……吃了什么,下次带我一份。")],
    [sayC("奶茶喝了就喝了,别在那儿后悔。后悔不消耗热量。"), Object.assign(sayD("对!我们走路消耗热量!出发出发!"), {act:["meal15","饭后散步 15 分钟"]})])},
  {k:["打气","鼓励","加油","坚持不下去","放弃","没信心","不自信"], r: () => { const a = achievements(); return pick([
    [sayD(a ? `姐姐你看,你已经${a}了!这些都是你自己一点点完成的,太厉害了!` : "愿意为自己做点什么,本身就很了不起。今天先完成一件小事:动 5 分钟,或者记一次体重。我陪着你!"), sayC("嗯……我也觉得你不错。别告诉二楞我说过。")],
    [sayD("姐姐是我见过最棒的人!(我只见过小区里的人,但还是最棒的!)"), sayC("它说得夸张,但方向没错。")],
    [sayC("放弃很容易,我天天放弃下沙发。但你不是我。"), sayD("姐姐,我们一步一步来,今天比昨天多走一点点就赢了!")]]); }},
  {k:["练什么","今天练","推荐","安排","计划","做什么运动"], r:() => { const tc = todayCombo(); return [Object.assign(sayD(tc.rest ? `今天是休息日~想动的话可以做「${courseById(tc.ids[0]).name}」,很轻松。` : `今天的组合是「${tc.ids.map(id => courseById(id).name).join(" + ")}」,一共约 ${comboMin(tc.ids)} 分钟。点下面就能开始,我已经在门口摇尾巴了!`), {act:["today","开始今天的运动"]})]; }},
  {k:["吃什么","食谱","饿","晚饭","午饭","早饭","早餐","午餐","晚餐"], r: anyOf(
    [Object.assign(sayC("我推荐小鱼干。……好吧,你去「饮食」页看看控糖菜单,每餐先吃菜。"), {act:["go:diet","看看菜单"]}), sayD("我推荐鸡胸肉!可以分我一口吗?就一口!")],
    [Object.assign(sayD("姐姐饿啦?「饮食」页里有今天的菜单,高蛋白、控糖的都有!"), {act:["go:diet","看看菜单"]}), sayC("别饿着肚子运动。会晕。")])},
  {k:["失眠","睡不着","熬夜","做梦"], r: anyOf(
    [Object.assign(sayC("睡不着?跟我学:找个软的地方,蜷起来,慢慢呼吸。放下手机。"), {act:["catyoga12","跟发财做猫式瑜伽"]}), sayD("我可以趴在床边陪你,一直到你睡着~")],
    [sayD("姐姐,睡前 1 小时别看手机,喝点温水,拉伸 5 分钟,会好睡很多!"), sayC("还有,别想明天的事。明天的事明天的你会处理。")])},
  {k:["压力","焦虑","烦","心情","难过","不开心","委屈","哭"], r: anyOf(
    [Object.assign(sayC("压力大的时候,学我:找个舒服的地方,伸个懒腰,慢慢呼吸。"), {act:["catyoga12","跟发财做猫式瑜伽"]}), sayD("今天不用逼自己,散散步、晒晒太阳就很好。我一直在!")],
    [sayD("姐姐抱抱!要不要摸摸我的头?听说摸狗狗能让心情变好,我免费的!"), sayC("我也……可以借你摸一下。就一下。")],
    [sayC("谁让你不开心了?告诉我,我去他鞋里睡觉。"), sayD("我去帮你叫他!汪汪汪!")])},

  {k:["下雨","天气","好冷","太热","刮风","雾霾","出不了门"], r: anyOf(
    [Object.assign(sayD("出不了门就在家动!有不出门的课程,我在客厅陪你!"), {act:["go:sport","看看在家课程"]}), sayC("下雨天最适合躺着。但你还是动一下吧。")],
    [sayD("天气不好也别怕,在家原地踏步 10 分钟,和外面走一样有用!"), sayC("我反正哪天都不出门。")])},
  {k:["生理期","例假","姨妈","经期","痛经"], r: () => [sayD("姐姐这几天别勉强,做做轻柔的拉伸、散散步就好,多喝温水。肚子疼就休息,我给你暖肚子!"), Object.assign(sayC("这几天体重涨一点是正常的,别看秤。躺着,我陪你躺。"), {act:["cool5","温和拉伸 5 分钟"]})]},
  {k:["喝水","口渴","多喝"], r: anyOf(
    [() => sayD(`姐姐,今天目标喝水约 ${Math.round((latestW()||58)*33/100)*100} ml!我喝水的时候溅了一地,你别学我。`), sayC("我只喝流动的水。你随意。")],
    [sayC("渴了才喝就晚了。现在就去倒一杯。"), sayD("我陪你去!(顺便看看厨房有没有吃的)")])},
  {k:["夸我","好看","漂亮","身材","瘦了"], r: anyOf(
    [sayD("姐姐最好看了!每天都比昨天更好看!这是真话,狗狗不会说谎!"), sayC("嗯。今天的气色确实还行。")],
    [sayC("自信点。我从来不问别人我好不好看,因为答案显而易见。"), sayD("姐姐和发财一样好看!不,比发财还好看!"), sayC("……二楞你今天没饭吃了。")])},
  {k:["无聊","陪我","孤单","想你","聊聊"], r: anyOf(
    [sayD("我一直都在!我们去散步吧?或者你给我讲讲今天发生了什么?"), sayC("我也在。虽然我在睡觉,但我在。")],
    [sayD("姐姐想我啦?我也想你!每次你打开 App,我的尾巴就开始摇!"), sayC("我没有想你。我只是刚好醒着。")])},
  {k:["笑话","好玩","逗我","讲个"], r: anyOf(
    [sayD("我昨天追了自己的尾巴 20 分钟,差一点就抓到了!"), sayC("它已经追了五年了。")],
    [sayC("二楞以为镜子里有另一只狗,对着叫了一下午。"), sayD("那只狗真的很像我!而且它也很帅!")],
    [sayD("发财说它在减肥,结果把我的零食吃了。"), sayC("那叫替你分担热量。")])},
  {k:["零食","骨头","小鱼干","奖励","饼干"], r: anyOf(
    [sayD("骨头!是骨头吗?!姐姐运动完我们一起吃好吃的(健康的那种)!"), sayC("小鱼干我自己会拿。你只要别挡着柜子。")],
    [sayC("运动完奖励自己可以,别奖励成一顿火锅。"), sayD("奖励可以是散步!散步是世界上最好的奖励!")])},
  {k:["散步","遛狗","出去","走走","公园"], r: anyOf(
    [Object.assign(sayD("散步!!!你说散步了!我去拿牵引绳!(已经在门口了)"), {act:["dogwalk20","和二楞去遛弯"]}), sayC("……它听到这两个字就会这样。")],
    [Object.assign(sayD("姐姐带我去公园吧,走 20 分钟,我们看看今天的云~"), {act:["dogwalk20","和二楞去遛弯"]})])},
  {k:["完成了","今天完成","做完了","打卡","练完","运动完"], r: anyOf(
    [sayD("姐姐太棒啦!!我要转三圈庆祝!"), sayC("嗯,看到了。今天值得多睡一会儿。")],
    [sayC("不错。比昨天的你强。"), sayD("记得 30 分钟后测一次血糖,看看运动的效果!")])},
  {k:["疼","痛","受伤","酸","抽筋"], r: () => [Object.assign(sayD("运动后 1–2 天的肌肉酸痛是正常的,拉伸、喝水、睡好就会缓解。如果是关节刺痛、肿胀或越来越疼,先停下来去看医生哦。"), {act:["cool5","做 5 分钟拉伸"]}), sayC("疼就别硬撑。我受了委屈也会躲起来休息。")]},
  {k:["你是谁","你们是谁","几岁","名字"], r: () => [sayD("我是二楞,一只金毛!我最喜欢姐姐、散步、晒太阳和吃东西,排名不分先后!"), sayC("发财。英短。负责监督。")]},
  {k:["早安","早上好","起床"], r: anyOf([sayD("早上好姐姐!今天的太阳特别适合散步!"), sayC("早。先喝杯温水,再看手机。")], [sayC("你醒了?我刚准备睡。"), sayD("姐姐早!空腹血糖测了吗?测完我们出门!")])},
  {k:["晚安","睡了","睡觉"], r: anyOf([sayD("晚安姐姐!今天辛苦了,明天见~"), sayC("晚安。别再刷手机了。")], [sayC("终于。去睡吧,我替你守夜。"), sayD("我睡在门口,保护姐姐!")])},
  {k:["发财坏","发财凶","讨厌发财","猫"], r: () => [sayC("我只是说实话。"), sayD("发财其实很关心你!它半夜会偷偷睡在你的拖鞋上。"), sayC("……二楞你闭嘴。")]},
  {k:["二楞傻","笨","二楞"], r: () => [sayD(petLine("dog")), sayC("它确实不太聪明,但它很爱你。")]},
  {k:["发财"], r: () => [sayC(petLine("cat"))]},
  {k:["谢谢","感谢","爱你","哈哈","好的","嗯嗯"], r: anyOf([sayD("不客气!有姐姐在,我每天都很开心~"), sayC("嗯,我也……勉强开心。")], [sayD("我也爱你姐姐!(扑过去)"), sayC("别扑,毛会粘到衣服上。")])},
  {k:["你好","hi","hello","嗨","在吗","晚上好"], r: () => chatHello()}
];
function chatHello(){
  const h = new Date().getHours(), a = achievements(), done = doneToday();
  const greet = h < 6 ? "这么晚还没睡呀" : h < 10 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
  return [sayD(`姐姐${greet}!${done ? "今天已经运动过了,真棒!" : a ? `你已经${a}了,我都记着呢。` : "我们一起慢慢动起来吧!"}想聊什么都可以~`),
    sayC(pick(["我也在。有事说事。","嗯。我在听,虽然看起来像在睡觉。","说吧,我今天心情还行。"]))];
}
function coachReply(text){
  const low = text.toLowerCase();
  for (const it of COACH) if (it.k.some(k => low.includes(k))) return it.r();
  return pick([
    [Object.assign(sayD("我在听哦姐姐。是运动、血糖,还是心情的事?说给我听~"), {act: Math.random() < .5 ? ["warm5","只做 5 分钟"] : null})],
    [sayD("嗯嗯!不管怎样,今天记得喝够水、动一动、早点睡。"), sayC("它就会说这三句。不过说得对。")],
    [sayC("没听懂。但我猜你需要站起来走两步。"), sayD("我也是这么想的!走走走!")],
    [sayD("姐姐说什么都对!(虽然我没完全听懂)"), sayC("……")]
  ]);
}
const CHIPS = ["今天好累,不想动","餐后血糖有点高","今天练什么?","给我打打气","今天吃多了","睡不着","讲个笑话","陪我聊聊"];

/* ---- reused from v1: body, sleep, workout cards, weight chart, diet ---- */
function wSeries(){ return Object.entries(W()).sort((a,b)=>a[0]<b[0]?-1:1).map(([d,v])=>({d,v:+v})); }
function latestW(){ const s = wSeries(); return s.length ? s[s.length-1].v : null; }
function startW(){ const s = wSeries(); return s.length ? s[0].v : null; }
function bmi(w){ const h = state.profile.height/100; return w && h ? w/(h*h) : null; }
function bmiCat(b){ return b < 18.5 ? ["偏瘦",""] : b < 24 ? ["正常","good"] : b < 28 ? ["超重",""] : ["肥胖","bad"]; }
function weekStart(s){ return addD(s, -wdi(s)); }
const portion = (r, t) => Math.min(1.5, Math.max(.75, Math.round(t/r.kcal*4)/4));
function pickRecipe(meal, target, avoid){
  return RECIPES.filter(r => r.meal === meal && !avoid.includes(r.id))
    .map(r => ({r, s: Math.abs(r.kcal*portion(r,target) - target) + Math.random()*target*.3})).sort((a,b)=>a.s-b.s)[0].r.id;
}
function genWeek(){
  const T = targets().kcal, week = [];
  for (let i=0;i<7;i++){
    const prev = week[i-1] || [], used = week.flat();
    week.push(MEALS.map(([m,,share],k) => pickRecipe(m, T*share, [prev[k]].concat(used).filter(Boolean))));
  }
  state.meals.week = week; save("meals");
}
const GOALS = {recomp:"塑形", lose:"减脂", keep:"保持", gain:"增肌"};
const byDate = (a,b) => (a.date + (a.time||"")) < (b.date + (b.time||"")) ? -1 : 1;
function latestBody(maxDays){ const l = state.health.body.filter(r => r.fat != null || r.muscle != null || r.bmr != null).sort(byDate).pop(); if (!l) return null; if (maxDays && diffD(l.date, today()) > maxDays) return null; return l; }
function bodyFull(){ return state.health.body.filter(r => r.fat != null).sort(byDate); }
const latestSleep = () => state.health.sleep.slice().sort(byDate).pop() || null;
const latestExt = () => state.health.ext.slice().sort(byDate).pop() || null;
function ref(k){
  const m = state.profile.sex === "m", w = latestW() || 55, age = state.profile.age || 30;
  switch (k){
    case "fat": return m ? [11,21,5,40] : [21,30,10,45];
    case "muscle": return m ? [72,90,55,95] : [66,85,50,90];
    case "bone": { const s = m ? (w < 60 ? 2.5 : w < 75 ? 2.9 : 3.2) : (w < 45 ? 1.8 : w < 60 ? 2.2 : 2.5); return [s, s+0.8, 1, 4.5]; }
    case "visceral": return [1,9,0,20];
    case "water": return m ? [55,65,35,75] : [45,60,35,75];
    case "protein": return [16,20,10,25];
    case "bmi": return [18.5,24,14,34];
    case "vo2max": { const lo = (m ? 7 : 0) + (age < 30 ? 31 : age < 40 ? 30 : age < 50 ? 28 : 25); return [lo, lo+15, 10, 60]; }
  }
  return null;
}
function status(k, v){
  if (v == null || isNaN(v)) return null;
  const r = ref(k);
  switch (k){
    case "fat": return v < r[0] ? ["偏低","warn"] : v <= r[1] ? ["标准","good"] : v <= r[1]+5 ? ["偏高","warn"] : ["偏胖","bad"];
    case "muscle": return v < r[0] ? ["不足","bad"] : ["标准","good"];
    case "bone": return v < r[0] - .05 ? ["不足","bad"] : ["标准","good"];
    case "visceral": return v <= 9 ? ["标准","good"] : v <= 14 ? ["偏高","warn"] : ["高","bad"];
    case "water": return v < r[0] ? ["偏低","warn"] : ["标准","good"];
    case "protein": return v < 16 ? ["偏低","warn"] : v <= 20 ? ["标准","good"] : ["优秀","good"];
    case "bmi": return v < 18.5 ? ["偏瘦","warn"] : v < 24 ? ["标准","good"] : v < 28 ? ["超重","warn"] : ["肥胖","bad"];
    case "vo2max": return v < r[0] ? ["偏低","warn"] : ["良好","good"];
    case "muscleLevel": return v <= 2 ? ["偏低","warn"] : ["标准","good"];
    case "deepPct": return v < 20 ? ["偏低","warn"] : v <= 60 ? ["正常","good"] : ["偏高","warn"];
    case "lightPct": return v > 55 ? ["偏高","warn"] : ["正常","good"];
    case "remPct": return v < 10 ? ["偏低","warn"] : v <= 30 ? ["正常","good"] : ["偏高","warn"];
    case "wakeCount": return v <= 1 ? ["正常","good"] : ["偏高","warn"];
    case "night": return v < 360 ? ["偏少","warn"] : v <= 600 ? ["正常","good"] : ["偏多","warn"];
  }
  return null;
}
const chipst = s => s ? `<span class="chipst ${s[1]}">${s[0]}</span>` : "";
const hm = m => m == null ? "--" : `${Math.floor(m/60)} 小时 ${Math.round(m%60)} 分`;
function gauge(k, v){
  const r = ref(k); if (!r || v == null) return "";
  const [lo, hi, a, b] = r, P = x => Math.max(0, Math.min(100, (x-a)/(b-a)*100));
  return `<div class="gauge"><i class="ok" style="left:${P(lo)}%;width:${P(hi)-P(lo)}%"></i><i class="mk" style="left:${P(v)}%"></i></div><div class="gscale"><span>${a}</span><span>标准 ${lo}–${hi}</span><span>${b}</span></div>`;
}
function spark(vals){
  if (vals.length < 2) return "";
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v,i) => `${(i/(vals.length-1)*100).toFixed(1)},${(21-(v-lo)/span*18).toFixed(1)}`);
  return `<svg viewBox="0 0 100 24" preserveAspectRatio="none" width="100%" height="20" aria-hidden="true"><polyline points="${pts.join(" ")}" fill="none" stroke="var(--rose)" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
const BODY_METRICS = [["fat","体脂率","%"],["muscle","肌肉率","%"],["bone","骨量","kg"],["visceral","内脏脂肪",""],["water","水分","%"],["protein","蛋白质","%"],["vo2max","最大摄氧量",""],["bmi","BMI",""]];
function trendLine(pts, goal, unit){
  const W = 380, H = 120, L = 30, R = 8, T = 12, Bm = 22, iw = W-L-R, ih = H-T-Bm;
  const vals = pts.map(p => p.v).concat(goal != null ? [goal] : []), lo = Math.floor(Math.min(...vals) - .5), hi = Math.ceil(Math.max(...vals) + .5);
  const d0 = pts[0].d, dn = Math.max(1, diffD(d0, pts[pts.length-1].d)), x = d => L + diffD(d0,d)/dn*iw, y = v => T + (hi-v)/(hi-lo)*ih;
  let g = `<line x1="${L}" x2="${W-R}" y1="${y(hi)}" y2="${y(hi)}" stroke="var(--line)"/><line x1="${L}" x2="${W-R}" y1="${y(lo)}" y2="${y(lo)}" stroke="var(--line)"/><text x="${L-5}" y="${y(hi)+4}" text-anchor="end">${hi}</text><text x="${L-5}" y="${y(lo)+4}" text-anchor="end">${lo}</text>`;
  if (goal != null) g += `<line x1="${L}" x2="${W-R}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--good)" stroke-dasharray="5 5"/><text x="${W-R}" y="${y(goal)-5}" text-anchor="end" style="fill:var(--good)">标准上限 ${goal}${unit}</text>`;
  g += `<polyline points="${pts.map(p => `${x(p.d)},${y(p.v)}`).join(" ")}" fill="none" stroke="var(--rose)" stroke-width="2.2"/>`;
  g += pts.map(p => `<circle cx="${x(p.d)}" cy="${y(p.v)}" r="4" fill="var(--rose)" stroke="var(--surface)" stroke-width="2" data-tip="${+p.d.slice(5,7)}/${+p.d.slice(8)} · ${p.v}${unit}"/>`).join("");
  g += `<text x="${L}" y="${H-5}">${+d0.slice(5,7)}/${+d0.slice(8)}</text><text x="${W-R}" y="${H-5}" text-anchor="end">${+pts[pts.length-1].d.slice(5,7)}/${+pts[pts.length-1].d.slice(8)}</text>`;
  return `<div class="chart" style="min-height:0"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">${g}</svg></div>`;
}
const ZONES = [["extreme","极限","var(--z5)"],["anaerobic","无氧耐力","var(--z4)"],["aerobic","有氧耐力","var(--z3)"],["fatburn","燃脂","var(--z2)"],["warmup","热身","var(--z1)"]];
function extCard(){
  const list = state.health.ext.slice().sort(byDate).reverse(), X = list[0];
  if (!X) return `<section class="card"><h2>手环 / 手表训练</h2><div class="empty">上传运动 App 的训练详情截图,这里会显示心率区间和训练负荷,并自动计入运动日历。</div></section>`;
  const z = X.zones || {}, zt = ZONES.reduce((a,[k]) => a + (z[k]||0), 0);
  return `<section class="card">
    <div class="card-head"><div><h2>手环 / 手表训练</h2><div class="muted small">${X.date.slice(5).replace("-","/")} ${X.time||""} · ${esc(X.name||"运动")}</div></div>${X.recovery?`<span class="tag rose">建议恢复 ${X.recovery} 小时</span>`:""}</div>
    <div class="stat3">
      <div><span class="muted small">时长</span><span class="mid">${Math.round(X.minutes||0)}<span class="muted small"> 分</span></span></div>
      <div><span class="muted small">消耗</span><span class="mid">${X.kcal||"--"}<span class="muted small"> 千卡</span></span></div>
      <div><span class="muted small">平均心率</span><span class="mid">${X.avgHr||"--"}</span></div>
      <div><span class="muted small">最大心率</span><span class="mid">${X.maxHr||"--"}</span></div>
      <div><span class="muted small">训练负荷</span><span class="mid">${X.load||"--"}</span></div>
      <div><span class="muted small">有氧训练压力</span><span class="mid">${X.aerobicTE||"--"}</span></div>
    </div>
    ${zt ? `<div style="display:grid;gap:8px"><span class="label">心率区间分布</span><div class="stack">${ZONES.slice().reverse().map(([k,n,c]) => z[k] ? `<i style="flex:${z[k]};background:${c}" data-tip="${n} ${z[k]} 分钟"></i>` : "").join("")}</div>
      <div class="legend2">${ZONES.map(([k,n,c]) => `<span><i class="sw" style="background:${c}"></i>${n} <b>${z[k]||0}</b> 分</span>`).join("")}</div></div>` : ""}
    ${list.length > 1 ? `<div class="list">${list.slice(1,6).map(r => `<div class="item"><span class="num muted" style="width:44px">${+r.date.slice(5,7)}/${+r.date.slice(8)}</span><div class="grow">${esc(r.name||"运动")}</div><span class="muted small">${Math.round(r.minutes||0)} 分 · ${r.kcal||"--"} 千卡 · 均心率 ${r.avgHr||"--"}</span></div>`).join("")}</div>` : ""}
  </section>`;
}
function suggestions(){
  const B = latestBody(120), S = latestSleep(), X = latestExt(), p = state.profile, w = latestW() || (B && B.weight) || 55, out = [];
  const tg = targets(), protLo = Math.round(w*1.6), protHi = Math.round(w*2.0);
  if (B){
    const fs = status("fat", B.fat), bm = B.bmi != null ? B.bmi : bmi(w), hidden = (B.bodyType && /隐性/.test(B.bodyType)) || (fs && fs[1] !== "good" && B.fat > ref("fat")[1] && bm && bm < 24);
    if (hidden) out.push({area:"体成分", lv:"bad", title:"体重标准,体脂偏高:重点是增肌减脂", text:`体重 ${f1(B.weight||w)} kg、BMI ${bm?f1(bm):"--"} 都在正常范围,但体脂率 ${B.fat}% 超过标准上限 ${ref("fat")[1]}%,肌肉率 ${B.muscle??"--"}% 偏低。这种「隐性肥胖」靠节食减体重效果差,还容易掉肌肉。更好的做法是吃够蛋白质、坚持力量训练:体重可能变化不大,但体脂会下降、线条会更紧致。第一阶段目标:3 个月内体脂率降到 30% 以下、肌肉率提到 66% 以上。`, act:["plan","套用「增肌减脂」计划"]});
    else if (fs && fs[1] !== "good" && B.fat > ref("fat")[1]) out.push({area:"体成分", lv:"warn", title:`体脂率 ${B.fat}% 偏高`, text:"每天比消耗少吃 300–500 千卡,配合每周 3 次力量训练和 150 分钟有氧,每月体脂率下降 1% 左右是健康的速度。"});
    if ((B.muscle != null && status("muscle",B.muscle)[1] === "bad") || (B.muscleLevel != null && B.muscleLevel <= 2)) out.push({area:"运动", lv:"bad", title:"肌肉量不足:每周 3 次力量训练", text:`力量训练是最有效的办法。每周 3 次、每次 20–30 分钟,优先练大肌群:周一「臀腿塑形」、周三「上肢与背部」、周五「蜜桃臀专项」。每周加一点难度(多做 2 个,或下放更慢)。练后 1 小时内补充 20–30 g 蛋白质。`, act:["legs25","开始臀腿塑形"]});
    out.push({area:"饮食", lv:"warn", title:`蛋白质每天 ${protLo}–${protHi} g,热量别低于 ${Math.max(1200, Math.round((B.bmr||tg.bmr)/10)*10)} 千卡`, text:`按 ${f1(w)} kg 体重,每公斤 1.6–2.0 g 蛋白质,分到三餐,每餐 25–30 g:鸡蛋 1 个约 6 g,牛奶 250 ml 约 8 g,鸡胸肉 100 g 约 23 g,北豆腐 100 g 约 12 g,虾仁 100 g 约 18 g。${B.bmr ? `你的基础代谢实测 ${B.bmr} 千卡,` : ""}建议每天吃约 ${tg.kcal} 千卡,低于基础代谢容易掉肌肉、反弹。`, act:["go:diet","查看高蛋白食谱"]});
    if (B.bone != null && status("bone",B.bone)[1] === "bad") out.push({area:"体成分", lv:"warn", title:`骨量 ${B.bone} kg 偏低`, text:"每天钙 800–1000 mg:300 ml 牛奶 + 一块豆腐 + 一盘深绿色叶菜就差不多了;每天晒太阳 15–20 分钟帮助合成维生素 D;深蹲、快走、跳绳这类负重和适度冲击的运动能刺激骨骼变强。"});
    if (B.vo2max != null && status("vo2max",B.vo2max)[1] !== "good") out.push({area:"运动", lv:"warn", title:`心肺耐力偏低(最大摄氧量 ${B.vo2max})`, text:`低于同龄${p.sex==="m"?"男性":"女性"}的平均水平。每周 2–3 次、每次 30–45 分钟中低强度有氧,心率保持在约 110–135 次/分(能说话但不能唱歌);再加 1 次间歇训练。坚持 6–8 周,最大摄氧量通常就能提升。`, act:["run30","开始跑走交替"]});
    if (B.visceral != null && B.visceral <= 9) out.push({area:"体成分", lv:"good", title:`内脏脂肪 ${B.visceral},在标准范围`, text:"内脏脂肪和慢性病风险关系最大,你这项是健康的,继续保持少油少糖、规律运动。"});
    if (B.bodyAge && p.set && B.bodyAge > p.age + 3) out.push({area:"体成分", lv:"warn", title:`身体年龄 ${B.bodyAge} 岁,比实际年龄大`, text:"身体年龄主要由肌肉量和体脂决定。按上面的方法增肌减脂,身体年龄会跟着下降。"});
  }
  if (S){
    const tot = (S.deep||0) + (S.light||0) + (S.rem||0) || S.night, dp = S.deep != null ? S.deep/tot*100 : null;
    if (S.night >= 420 && S.night <= 600) out.push({area:"睡眠", lv:"good", title:`睡眠时长充足(${hm(S.night)})`, text:`时长在 7–9 小时的理想区间${S.nap && S.nap <= 30 ? `,${S.nap} 分钟的午间小睡也很合适(建议不超过 30 分钟、下午 3 点前)` : ""}。接下来重点提升睡眠质量。`});
    if (dp != null && dp < 20) out.push({area:"睡眠", lv:"warn", title:`深睡只占 ${Math.round(dp)}%,低于 20%`, text:"深睡是身体修复和长肌肉的关键时段。试试:每天固定时间上床(周末前后不超过 1 小时)、下午 2 点后不喝咖啡和浓茶、睡前 3 小时不做剧烈运动、卧室 18–22℃ 并遮光、睡前 1 小时放下手机。白天规律运动也能增加深睡。", act:["sleep15","睡前做助眠瑜伽"]});
    if (S.wakeCount > 1) out.push({area:"睡眠", lv:"warn", title:`夜里醒了 ${S.wakeCount} 次`, text:"睡前 2 小时少喝水,晚餐别太晚太饱,避免睡前饮酒;留意噪音和光线(可以用耳塞、遮光帘)。如果长期频繁夜醒、白天很困,建议咨询医生。"});
  }
  const lastDay = Object.keys(state.workouts.log).sort().pop(), gap = lastDay ? diffD(lastDay, today()) : null;
  if (X){
    const z = X.zones || {};
    out.push({area:"运动", lv:"good", title:`上次训练强度不错(${Math.round(X.minutes)} 分钟,平均心率 ${X.avgHr})`, text:`有氧耐力区 ${z.aerobic||0} 分钟、无氧耐力区 ${z.anaerobic||0} 分钟,对提升心肺很有效。${X.recovery ? `设备建议恢复 ${X.recovery} 小时,高强度训练后的第二天适合拉伸、瑜伽或快走。` : ""}别太在意「燃脂区」的分钟数,总消耗和长期坚持才是减脂的关键。`});
  }
  if (gap != null && gap > 6) out.push({area:"运动", lv:"warn", title:`已经 ${gap} 天没有运动记录了`, text:"不用一下子恢复高强度。今天先做 20 分钟「低冲击燃脂」或快走,把节奏找回来;目标每周 3–4 次,每周累计 150 分钟以上。", act:["quiet20","开始低冲击燃脂"]});
  const order = {bad:0, warn:1, good:2};
  return out.sort((a,b) => order[a.lv] - order[b.lv]);
}
function tipsHTML(list){
  return `<div class="tips">${list.map((t,k) => `<div class="tipc ${t.lv}" id="tip-${k}"><h3><span class="tag">${t.area}</span>${esc(t.title)}</h3><p>${esc(t.text)}</p>${t.act ? `<div class="row">${t.act[0] === "plan" ? `<button class="btn sm soft" data-act="applyRecomp">${t.act[1]}</button>` : t.act[0].startsWith("go:") ? `<button class="btn sm soft" data-go="${t.act[0].slice(3)}">${t.act[1]}</button>` : `<button class="btn sm soft" data-play="${t.act[0]}">${ICON.play}${t.act[1]}</button>`}</div>` : ""}</div>`).join("")}</div>`;
}
function tipsEntry(){
  const list = suggestions(); if (!list.length) return "";
  const n = lv => list.filter(t => t.lv === lv).length;
  return `<section class="card"><div class="card-head"><h2>改进建议</h2><button class="btn sm soft" data-act="openTips">查看详细建议</button></div>
    <div class="list">${list.map((t,k) => `<button class="item tipline" data-tipk="${k}"><span class="sw" style="background:var(--${t.lv==="good"?"good":t.lv==="bad"?"bad":"warn"});border-radius:50%;flex:none"></span><span class="grow" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</span><span class="muted">›</span></button>`).join("")}</div>
    <div class="muted small">${n("bad")} 项优先 · ${n("warn")} 项注意 · ${n("good")} 项保持</div></section>`;
}
function weightChart(el, range){
  const all = wSeries(), width = Math.max(280, el.clientWidth || 600), height = 220;
  if (!all.length){ el.innerHTML = `<div class="empty">记录第一条体重后,这里会出现你的趋势曲线。</div>`; return; }
  const from = range ? addD(today(), -range+1) : all[0].d;
  let pts = all.filter(p => p.d >= from); if (!pts.length) pts = all.slice(-1);
  const avg = pts.map(p => { const win = all.filter(q => q.d <= p.d && q.d > addD(p.d,-7)); return {d:p.d, v: win.reduce((a,q)=>a+q.v,0)/win.length}; });
  const goal = goalW();
  let lo = Math.min(...pts.map(p=>p.v)), hi = Math.max(...pts.map(p=>p.v));
  if (goal && goal >= lo - 3 && goal <= hi + 3){ lo = Math.min(lo, goal); hi = Math.max(hi, goal); }
  const span0 = Math.max(hi-lo, 1), step = span0 <= 2.5 ? .5 : span0 <= 6 ? 1 : span0 <= 12 ? 2 : 5;
  lo = Math.floor((lo - step*.3)/step)*step; hi = Math.ceil((hi + step*.3)/step)*step;
  const L = 38, R = 12, T = 12, B = 26, iw = width-L-R, ih = height-T-B;
  const d0 = pts[0].d, dn = Math.max(1, diffD(d0, pts[pts.length-1].d));
  const x = d => L + diffD(d0, d)/dn*iw, y = v => T + (hi - v)/(hi - lo)*ih;
  let g = "";
  for (let v = lo; v <= hi + 1e-9; v += step){ g += `<line x1="${L}" x2="${width-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${step<1?v.toFixed(1):v}</text>`; }
  const nT = Math.min(5, pts.length), seen = new Set();
  for (let i=0;i<nT;i++){ const p = pts[Math.round(i*(pts.length-1)/Math.max(1,nT-1))]; if (seen.has(p.d)) continue; seen.add(p.d); const [, m, dd] = p.d.split("-");
    g += `<text x="${x(p.d)}" y="${height-6}" text-anchor="${i===0?"start":i===nT-1?"end":"middle"}">${+m}/${+dd}</text>`; }
  if (goal && goal >= lo && goal <= hi) g += `<line x1="${L}" x2="${width-R}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--good)" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${width-R}" y="${y(goal)-6}" text-anchor="end" style="fill:var(--good)">目标 ${f1(goal)}</text>`;
  const line = avg.map((p,i)=>`${i?"L":"M"}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = line + `L${x(avg[avg.length-1].d)},${T+ih}L${x(avg[0].d)},${T+ih}Z`;
  const dots = pts.length <= 90 ? pts.map(p=>`<circle cx="${x(p.d)}" cy="${y(p.v)}" r="2.6" fill="var(--gray)"/>`).join("") : "";
  const lp = pts[pts.length-1];
  el.innerHTML = `<svg width="${width}" height="${height}" role="img" aria-label="体重趋势图">
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--rose)" stop-opacity=".28"/><stop offset="1" stop-color="var(--rose)" stop-opacity="0"/></linearGradient></defs>
    ${g}<path d="${area}" fill="url(#wg)"/>${dots}
    <path d="${line}" fill="none" stroke="var(--rose)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(lp.d)}" cy="${y(avg[avg.length-1].v)}" r="5.5" fill="var(--rose)" stroke="var(--surface)" stroke-width="2.5"/>
    <line class="xh" x1="0" x2="0" y1="${T}" y2="${T+ih}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>
    <circle class="xp" r="4.5" fill="var(--surface)" stroke="var(--rose-deep)" stroke-width="2" visibility="hidden"/>
    <rect x="${L}" y="0" width="${iw}" height="${height}" fill="transparent"/></svg>`;
  const svg = el.querySelector("svg"), xh = svg.querySelector(".xh"), xp = svg.querySelector(".xp"), tip = $("#tip");
  svg.addEventListener("pointermove", ev => {
    const r = svg.getBoundingClientRect(), mx = ev.clientX - r.left;
    let best = 0; pts.forEach((p,i) => { if (Math.abs(x(p.d)-mx) < Math.abs(x(pts[best].d)-mx)) best = i; });
    const p = pts[best], a = avg[best];
    xh.setAttribute("x1", x(p.d)); xh.setAttribute("x2", x(p.d)); xh.setAttribute("visibility","visible");
    xp.setAttribute("cx", x(p.d)); xp.setAttribute("cy", y(p.v)); xp.setAttribute("visibility","visible");
    tip.hidden = false; tip.innerHTML = `${+p.d.slice(5,7)}月${+p.d.slice(8)}日 · <b>${f1(p.v)} kg</b> · 7日均 ${f1(a.v)}`;
    tip.style.left = (r.left + x(p.d)) + "px"; tip.style.top = (r.top + y(p.v)) + "px";
  });
  svg.addEventListener("pointerleave", () => { xh.setAttribute("visibility","hidden"); xp.setAttribute("visibility","hidden"); tip.hidden = true; });
}
function ring(pct, size, label, sub){
  const r = 42, c = 2*Math.PI*r, p = Math.min(1, pct);
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:none">
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" style="transform:rotate(-90deg)"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--soft)" stroke-width="9"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${pct>=1?"var(--good)":"var(--rose)"}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c*p} ${c}"/></svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center;align-content:center;text-align:center"><div class="num" style="font-size:${size/3.6}px;line-height:1">${label}</div><div class="muted" style="font-size:11px">${sub}</div></div></div>`;
}
function weightPart(){
  const s = wSeries(), lw = latestW(), g = goalW(), t = today(), last30 = s.filter(p => p.d >= addD(t,-29));
  let rate = null;
  if (s.length >= 2){ const a = s.filter(p => p.d >= addD(t,-27)), first = a.length >= 2 ? a[0] : s[0], last = s[s.length-1], days = diffD(first.d, last.d); if (days >= 5) rate = (last.v - first.v)/days*7; }
  let eta = "";
  if (rate && g && lw != null){ const need = g - lw;
    if (need !== 0 && Math.sign(need) === Math.sign(rate)){ const wks = Math.ceil(need/rate), d = addD(t, wks*7); eta = `按最近的速度,大约 <b>${wks}</b> 周后(${+d.slice(5,7)} 月 ${+d.slice(8)} 日左右)就能到达目标。`; }
    else if (need !== 0) eta = "最近的趋势和目标方向相反,和教练聊聊,看看饮食和运动怎么调整。"; }
  const fast = rate != null && Math.abs(rate) > (lw||58)*0.01 ? `<div class="small" style="color:var(--warn)">每周变化超过体重的 1%,速度偏快,注意别过度节食。</div>` : "";
  return `<div class="grid">
  <section class="card"><h2>记录体重</h2>
    <form id="wform" class="row" style="align-items:flex-end">
      <label class="f">日期<input id="wdate" type="date" value="${t}" max="${t}" required></label>
      <label class="f">体重 kg<input id="wval" type="number" step="0.1" min="25" max="300" inputmode="decimal" placeholder="${lw!=null&&!isDemo()?f1(lw):"例如 56.5"}" required style="width:120px"></label>
      <button class="btn primary" type="submit">保存</button>
    </form>
    <div class="muted small">建议每天早上起床、如厕后空腹称重。同一天重复记录会覆盖。</div>
  </section>
  <section class="card"><h2>数据速览</h2>
    <div class="stat3">
      <div><span class="muted small">30 天最低</span><span class="mid">${last30.length?f1(Math.min(...last30.map(p=>p.v))):"--"}</span></div>
      <div><span class="muted small">30 天最高</span><span class="mid">${last30.length?f1(Math.max(...last30.map(p=>p.v))):"--"}</span></div>
      <div><span class="muted small">每周变化</span><span class="mid" style="color:${rate==null?"inherit":(state.profile.goal==="gain"?rate>0:rate<0)?"var(--good)":"var(--bad)"}">${rate==null?"--":(rate>0?"+":"")+f1(rate)}</span></div>
    </div>${eta?`<div class="small">${eta}</div>`:""}${fast}
  </section></div>
  <section class="card"><div class="card-head"><h2>趋势</h2>${rangeSeg()}</div><div class="chart" id="wchart"></div></section>
  <section class="card"><h2>历史记录</h2>
    ${s.length ? `<div class="tbl hist"><table><thead><tr><th>日期</th><th>体重 kg</th><th>较前一次</th><th>BMI</th><th></th></tr></thead><tbody>
    ${s.slice().reverse().slice(0,60).map((p,i,arr)=>{ const prev = arr[i+1], dv = prev ? p.v - prev.v : null, b = bmi(p.v);
      return `<tr><td>${p.d}</td><td class="num" style="font-size:17px">${f1(p.v)}</td><td style="color:${dv==null||dv===0?"var(--muted)":dv<0?"var(--good)":"var(--bad)"}">${dv==null?"—":(dv>0?"+":"")+f1(dv)}</td><td>${b?f1(b):"—"}</td><td>${isDemo()?"":`<button class="btn xs danger" data-delw="${p.d}">删除</button>`}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<div class="empty">还没有记录。</div>`}
  </section>`;
}

/* ================================================================
   Small icons
   ================================================================ */
const svgI = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const IC = {
  camera: svgI('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  paste: svgI('<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>'),
  pen: svgI('<path d="M4 20l4-1 11-11-3-3L5 16z"/>'),
  image: svgI('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>'),
  leaf: svgI('<path d="M5 19c8 0 13-6 14-14C11 6 5 11 5 19zM5 19l7-7"/>'),
  drop: svgI('<path d="M12 3c3 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6.5 6-11z"/>'),
  shield: svgI('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 8v5M12 16h.01"/>'),
  spark: svgI('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>'),
  music: svgI('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  wave: svgI('<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>'),
  prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 6v12L7.5 12zM6 6h2v12H6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 6v12l8.5-6zM16 6h2v12h-2z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>'
};
const md = d => `${+d.slice(5,7)}/${+d.slice(8)}`;

/* ================================================================
   Page backgrounds: the user's own photos, kept in IndexedDB on this phone
   ================================================================ */
const BG_PAGES = [["glucose","血糖"],["sport","运动"],["player","运动中"],["diet","饮食"],["weight","身体"],["chat","聊天"]];
const BG_DEF = page => ({x:.5, y:.5, s:1, clarity:85, opacity: page === "player" ? 45 : 35});
const bgURL = {};       // page -> {url, w, h}
function bgDB(){
  return new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error("no idb"));
    const r = indexedDB.open("amber2-bg", 1); r.onupgradeneeded = () => r.result.createObjectStore("img"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function bgTx(mode, fn){ return bgDB().then(db => new Promise((res, rej) => { const tx = db.transaction("img", mode), st = tx.objectStore("img"), out = fn(st); tx.oncomplete = () => res(out && out.result); tx.onerror = () => rej(tx.error); })); }
const bgGet = page => bgTx("readonly", st => st.get(page));
const bgPut = (page, blob) => bgTx("readwrite", st => st.put(blob, page));
const bgDel = page => bgTx("readwrite", st => st.delete(page));
function bgUse(page, blob, w, h){ if (bgURL[page]) URL.revokeObjectURL(bgURL[page].url); if (blob) bgURL[page] = {url:URL.createObjectURL(blob), w, h}; else delete bgURL[page]; }
async function loadBgs(){
  const cfg = state.profile.bg || {};
  for (const page of Object.keys(cfg)){ try { const b = await bgGet(page); if (b) bgUse(page, b, cfg[page].w, cfg[page].h); } catch(e){} }
  applyBg();
}
// place the photo so the chosen crop fills a box of size W×H (cover, then zoom s, offset x/y in 0..1)
function bgStyle(page, cfg, W, H){
  const B = bgURL[page]; if (!B || !W || !H) return null;
  const k = Math.max(W/B.w, H/B.h)*cfg.s, iw = B.w*k, ih = B.h*k, blur = (100 - cfg.clarity)/100*14;
  return {image:`url("${B.url}")`, size:`${iw.toFixed(1)}px ${ih.toFixed(1)}px`, pos:`${(-(iw-W)*cfg.x).toFixed(1)}px ${(-(ih-H)*cfg.y).toFixed(1)}px`,
    filter: blur > .3 ? `blur(${blur.toFixed(1)}px)` : "", scale: blur > .3 ? 1 + blur/Math.min(W,H)*3 : 1, opacity: cfg.opacity/100};
}
function paintBg(el, page){
  if (!el) return;
  const cfg = (state.profile.bg || {})[page], st = cfg && bgStyle(page, cfg, el.clientWidth || innerWidth, el.clientHeight || innerHeight);
  el.hidden = !st; if (!st) return;
  const i = el.firstElementChild;
  Object.assign(i.style, {backgroundImage:st.image, backgroundSize:st.size, backgroundPosition:st.pos, filter:st.filter, transform:`scale(${st.scale})`, opacity:st.opacity});
}
function applyBg(){
  const page = tab === "home" ? null : tab, el = $("#pbg");
  el.hidden = true;
  if (page){ el.hidden = false; paintBg(el, page); }
  document.body.classList.toggle("has-bg", !!page && !el.hidden);
  const pl = $("#player .pbg"); if (pl) paintBg(pl, "player");
  const ch = $("#sheet .sheet.chat > .pbg"); if (ch) paintBg(ch, "chat");
}
const bgLayer = () => `<div class="pbg" aria-hidden="true" hidden><i></i></div>`;
const bgBtn = page => `<button class="ob ic" data-act="openBg" data-page="${page}" aria-label="页面背景" title="页面背景">${IC.image}</button>`;

/* ================================================================
   Glucose chart
   ================================================================ */
function glucoseChart(el, date){
  const D = gDay(date), [lo, hi] = gRange(), width = Math.max(280, el.clientWidth || 600), height = 200;
  const pts = D.curve || [], logs = D.logs, works = (LOG()[date] || []).filter(w => w.at);
  if (!pts.length && !logs.length){ el.innerHTML = `<div class="empty">这一天没有曲线。导入血糖 App 的「日曲线」截图,或者手动记录单次血糖。</div>`; return; }
  const vals = pts.map(p=>p[1]).concat(logs.map(l=>l.v));
  const ymin = Math.min(2, Math.floor(Math.min(...vals) - .5)), ymax = Math.max(12, Math.ceil(Math.max(...vals) + .5));
  const L = 30, Rr = 8, T = 14, B = 24, iw = width-L-Rr, ih = height-T-B, x = m => L + m/1440*iw, y = v => T + (ymax - v)/(ymax - ymin)*ih;
  let g = `<rect x="${L}" y="${y(hi)}" width="${iw}" height="${y(lo)-y(hi)}" fill="var(--sage-soft)"/>
    <line x1="${L}" x2="${width-Rr}" y1="${y(ymax)}" y2="${y(ymax)}" stroke="var(--hair)"/><line x1="${L}" x2="${width-Rr}" y1="${y(ymin)}" y2="${y(ymin)}" stroke="var(--hair)"/>
    <text x="${L-6}" y="${y(ymax)+4}" text-anchor="end">${ymax}</text><text x="${L-6}" y="${y(hi)+4}" text-anchor="end">${hi}</text><text x="${L-6}" y="${y(lo)+4}" text-anchor="end">${lo}</text>`;
  [0,6,12,18,24].forEach(h => g += `<text x="${x(h*60)}" y="${height-6}" text-anchor="${h===0?"start":h===24?"end":"middle"}">${h}:00</text>`);
  works.forEach(w => { const [h,m] = w.at.split(":").map(Number), s = h*60+m, nm = w.name || (courseById(w.c)||{}).name || "运动";
    g += `<rect x="${x(s)}" y="${T-6}" width="${Math.max(4, x(s+w.min)-x(s))}" height="${ih+6}" fill="var(--sage)" opacity=".24"/><text x="${x(s)+3}" y="${T+5}" style="fill:var(--forest-2);font-family:var(--sans);font-size:10px">${esc(nm.length > 4 ? "运动" : nm)}</text>`; });
  if (pts.length){
    // the line is forest inside the range; amber above, coral below
    let seg = [], zone = null; const zc = {in:"var(--forest)", hi:"var(--amber)", lo:"var(--coral)"};
    const flush = () => { if (seg.length > 1) g += `<polyline points="${seg.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="${zc[zone]}" stroke-width="${zone === "in" ? 1.8 : 2.1}" stroke-linejoin="round" stroke-linecap="round"/>`; };
    pts.forEach((p,i) => { const z = p[1] > hi ? "hi" : p[1] < lo ? "lo" : "in"; if (z !== zone && seg.length){ seg.push(p); flush(); seg = [seg[seg.length-1]]; } else if (i && p[0] - pts[i-1][0] > 45){ flush(); seg = []; } zone = z; seg.push(p); });
    flush();
  }
  logs.forEach(l => { const [h,m] = l.time.split(":").map(Number); g += `<circle cx="${x(h*60+m)}" cy="${y(l.v)}" r="4.5" fill="var(--dust)" stroke="var(--surface)" stroke-width="1.6" data-tip="${l.time} ${l.tag} · ${l.v}"/>`; });
  g += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${T+ih}" stroke="var(--muted)" visibility="hidden"/><rect x="${L}" y="0" width="${iw}" height="${height}" fill="transparent"/>`;
  el.innerHTML = `<svg width="${width}" height="${height}" role="img" aria-label="${date} 血糖曲线">${g}</svg>`;
  const svg = el.querySelector("svg"), xh = svg.querySelector(".xh"), tip = $("#tip");
  if (pts.length) svg.addEventListener("pointermove", ev => {
    const r = svg.getBoundingClientRect(), m = (ev.clientX - r.left - L)/iw*1440;
    let best = pts[0]; pts.forEach(p => { if (Math.abs(p[0]-m) < Math.abs(best[0]-m)) best = p; });
    xh.setAttribute("x1", x(best[0])); xh.setAttribute("x2", x(best[0])); xh.setAttribute("visibility", "visible");
    tip.hidden = false; tip.textContent = `${pad(Math.floor(best[0]/60))}:${pad(Math.round(best[0]%60))} · ${best[1]} mmol/L`;
    tip.style.left = (r.left + x(best[0])) + "px"; tip.style.top = (r.top + y(best[1])) + "px";
  });
  svg.addEventListener("pointerleave", () => { xh.setAttribute("visibility","hidden"); tip.hidden = true; });
}
const tirClass = v => v == null ? "" : v >= 90 ? "t4" : v >= 70 ? "t3" : v >= 50 ? "t2" : "t1";

/* ================================================================
   Views
   ================================================================ */
const TABS = [
  ["home","首页",svgI('<path d="M4 10.5L12 4l8 6.5V20H4z"/>')],
  ["glucose","血糖",svgI('<path d="M12 3c3 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6.5 6-11z"/>')],
  ["sport","运动",svgI('<circle cx="14" cy="4.5" r="1.8"/><path d="M6 21l4-6 3 2 2-5M8 11l3-3 4 2 3 3"/>')],
  ["diet","饮食",svgI('<path d="M4 12h16a8 8 0 0 1-16 0z"/>')],
  ["weight","身体",svgI('<rect x="4" y="4" width="16" height="16" rx="5"/>')]
];
$("#tabs").innerHTML = TABS.map(([k,l,ic]) => `<button data-tab="${k}" role="tab">${ic}<span>${l}</span></button>`).join("");
let tab = "home", courseFilter = "all", recipeMeal = "b", recipeTag = "", clearArm = false, wRange = 30, selDay = null;
try { const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) tab = h; } catch(e){}
function render(){
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  const app = $("#app");
  app.innerHTML = ({home:vHome, glucose:vGlucose, sport:vSport, diet:vDiet, weight:vBody})[tab]()
    + (state.profile.sample ? `<div class="banner"><span>正在看示例数据,随便点点看。</span><button class="btn sm" data-act="clearSample">清除示例</button></div>` : "");
  const wc = app.querySelector("#wchart"); if (wc) weightChart(wc, wRange);
  const gc = app.querySelector("#gchart"); if (gc) glucoseChart(gc, gc.dataset.date);
  mountDemos(app); renderMini(); applyBg();
}
const topbar = (title, page, actions = "") => `<header class="topbar"><h1>${title}</h1><div class="row nowrap" style="gap:6px">${bgBtn(page)}${actions}</div></header>`;
const rangeSeg = () => `<div class="seg">${[[30,"30天"],[90,"90天"],[0,"全部"]].map(([v,l])=>`<button data-range="${v}" aria-pressed="${wRange===v}">${l}</button>`).join("")}</div>`;
const fig = (anim, cls = "") => `<span class="fig ${cls}">${demo(anim)}</span>`;

/* ---- home ---- */
function heroSub(){
  const h = new Date().getHours();
  return h < 5 ? "夜深了,早点休息。" : h < 9 ? "早上好,先喝一杯温水。" : h < 12 ? "上午好,记得起来走动。" : h < 14 ? "午饭后,出去走一走吧。" : h < 18 ? "午后的云很好看,出去走走吧。" : h < 22 ? "晚上好,今天辛苦了。" : "夜深了,早点休息。";
}
function heroCard(){
  const d = new Date();
  return `<section class="hero">
    <img class="sky" src="img/sky.webp" alt="">
    <div class="txt"><div class="date">${d.getMonth()+1} 月 ${d.getDate()} 日 · 周${WD[wdi(today())]}</div><h1>Hi, ${esc(NAME())}</h1><div class="sub">${heroSub()}</div></div>
    <button class="me" data-act="openMe" aria-label="我的设置">${esc(NAME()[0].toUpperCase())}</button>
    <div class="say" id="petBubble" role="status">“${esc(petLine("dog"))}”<small>二楞</small></div>
    <span class="ground"></span><button class="petbtn" data-pet="dog" aria-label="摸摸二楞">${petImg("dog","sit")}</button>
  </section>`;
}
function todayCard(){
  const tc = todayCombo(), done = doneToday(), mins = comboMin(tc.ids), pp = planProgress();
  return `<section class="card today-card">
    <div class="row sp"><span class="lab">${tc.rest ? "今天是休息日 · 可选" : tc.suggested ? "推荐给刚开始的你" : "今日运动"}</span>${state.plan.meta ? `<span class="muted small">本周 ${pp.done} / ${pp.planned}</span>` : ""}</div>
    <h2>${tc.ids.map(id => esc(courseById(id).name)).join(" + ")}</h2>
    ${tc.ids.map(id => { const c = courseById(id); return `<button class="combo-row" data-course="${id}">${fig(coverAnim(c))}<span>${esc(c.name)}</span><span class="n muted">${courseMin(c)} 分</span></button>`; }).join("")}
    ${done ? `<div class="chip" style="justify-self:start">今天已经运动过了,想再动动也可以</div>` : ""}
    <button class="btn primary big" data-act="startToday">开始运动 · ${mins} 分钟</button>
    <button class="linkbtn" data-play="warm5">今天不想动?只做 5 分钟</button>
    ${state.plan.meta ? "" : `<button class="linkbtn" data-act="planSetup">根据我的情况生成每周计划 ›</button>`}
  </section>`;
}
function glucoseMini(){
  if (!hasGlucose()) return `<section class="card"><div class="row sp nowrap"><div><span class="lab">血糖</span><div class="small muted" style="margin-top:2px">导入血糖 App 的截图,看看运动对血糖的影响。</div></div><button class="btn sm primary" data-act="import" data-ctx="glucose">导入</button></div></section>`;
  const S = gSummary();
  return `<section class="card"><div class="row sp"><span class="lab">血糖 · ${S ? S.src : "本周"}</span><button class="linkbtn" data-tab="glucose">详情 ›</button></div>
    <div class="stat3"><div><div class="v n">${S && S.tir != null ? Math.round(S.tir) : "–"}<small>%</small></div><span class="k">范围内时间</span></div>
      <div><div class="v n">${S && S.cv != null ? Math.round(S.cv) : "–"}<small>%</small></div><span class="k">波动 CV</span></div>
      <div><div class="v n">${S && S.high != null ? S.high : "–"}<small>次</small></div><span class="k">偏高</span></div></div></section>`;
}
function weekCard(){
  const t = today(), ws = weekStart(t), wk = weekStats(), target = state.plan.meta ? Object.values(state.plan.week).reduce((a,ids) => a + comboMin(ids), 0) : 150;
  const days = WD.map((w,i) => { const d = addD(ws,i), m = dayMin(d); return `<div><b class="${m >= 15 ? "on" : m > 0 ? "half" : ""} ${d === t ? "today" : ""}"></b><span>${w}</span><em>${d === t ? (m ? m : "今天") : d > t ? "" : m || "–"}</em></div>`; }).join("");
  const eq = foodEq(wk.kcal);
  return `<section class="card"><div class="row sp"><span class="lab">本周节奏</span><span class="n" style="font-size:15px">${wk.min} <span class="muted">/ ${target} 分钟</span></span></div>
    <div class="days">${days}</div><div class="hl"></div>
    <div class="row sp small"><span class="muted">本周消耗</span><span><span class="n" style="font-size:20px">${wk.kcal}</span> 千卡${eq ? ` <span class="muted">${eq}</span>` : ""}</span></div></section>`;
}
function footprintCard(){
  const t = today(), start = addD(weekStart(t), -21); let s = "", n = 0;
  for (let i=0;i<28;i++){ const d = addD(start,i), x = 22 + (i%7)*43, y = 16 + Math.floor(i/7)*28;
    if (d > t) continue; const m = dayMin(d); if (m) n++;
    const r = m ? 4 + Math.min(1, m/40)*6 : 2.5;
    s += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${m ? (m >= 20 ? "var(--forest)" : "var(--sage)") : "var(--hair)"}"${m ? ` data-tip="${md(d)} · ${m} 分钟"` : ""}/>`;
    if (d === t) s += `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="var(--forest)" stroke-dasharray="2 3"/>`; }
  return `<section class="card"><span class="lab">四周足迹</span><svg class="dots" viewBox="0 0 300 104" width="100%" role="img" aria-label="最近四周运动足迹:${n} 天运动">${s}</svg>
    <div class="row sp small"><span class="muted">深色是运动过的日子,越大运动越久</span><span><span class="n" style="font-size:20px">${n}</span> 天</span></div></section>`;
}
function walkCard(){
  const j = journey(), last = j.i >= MILESTONES.length-1;
  return `<section class="card perch left">${petImg("dog","walk")}<div class="row sp"><span class="lab">和二楞的散步路</span><span class="n" style="font-size:15px">${f1(j.km)} <span class="muted">公里</span></span></div>
    <div class="path"><i style="width:${Math.round(Math.min(1, j.frac)*100)}%"></i></div>
    <div class="row sp small"><span class="muted">${j.cur[1]}</span><span>${last ? "已经环游世界了" : `再走 ${f1(Math.max(.1, j.next[0]-j.km))} 公里到 <b class="ser">${j.next[1]}</b>`}</span></div></section>`;
}
function vHome(){
  const B = latestBody(), S = latestSleep(), lw = latestW(), tn = suggestions().filter(t => t.lv !== "good").length;
  const empty = !hasGlucose() && !B && !totals().n && !lw && !state.profile.sample;
  return `${heroCard()}${todayCard()}${glucoseMini()}${weekCard()}${footprintCard()}
  <section class="card perch cat peek">${petImg("cat","sleep")}<span class="lab">发财说</span><div class="quote">“${esc(petLine("cat"))}”</div></section>
  ${walkCard()}
  ${B || S || lw != null ? `<section class="card"><div class="row sp"><span class="lab">身体 · 最近</span><div class="row" style="gap:12px">${tn ? `<button class="linkbtn" data-act="openTips">改进建议 ${tn}</button>` : ""}<button class="linkbtn" data-tab="weight">详情 ›</button></div></div>
    <div class="minirow">${lw != null ? `<div><span class="v n">${f1(lw)}<small class="muted small"> kg</small></span><span class="muted small">体重</span></div>` : ""}
      ${B && B.fat != null ? `<div><span class="v n">${B.fat}<small class="muted small">%</small></span><span class="muted small">体脂率</span></div>` : ""}
      ${S ? `<div><span class="v n">${(S.night/60).toFixed(1)}<small class="muted small"> 时</small></span><span class="muted small">睡眠</span></div>` : ""}</div></section>` : ""}
  ${empty ? `<section class="card"><div class="row sp nowrap"><div><b class="ser">想先看看效果?</b><div class="muted small">可以载入一份示例数据,随时能清除。</div></div><button class="btn sm" data-act="loadSample">看示例</button></div></section>` : ""}`;
}

/* ---- glucose ---- */
function tirSplit(S){
  if (S.tir == null) return null;
  if (S.tar != null && S.tbr != null) return {tbr:S.tbr, tir:S.tir, tar:S.tar};
  // weekly reports carry only TIR: take the split from the curves of those days when we have them
  const pts = []; for (let d = S.from; d <= S.to; d = addD(d,1)){ const c = state.glucose.curves[d]; if (c) pts.push(...c); }
  const st = curveStats(pts);
  if (st){ const out = 100 - S.tir, k = (st.tar + st.tbr) ? out/(st.tar + st.tbr) : 0; return {tbr:st.tbr*k, tir:S.tir, tar:st.tar*k}; }
  return S.low ? {tbr:null, tir:S.tir, tar:null} : {tbr:0, tir:S.tir, tar:100 - S.tir};
}
function vGlucose(){
  const S = gSummary(), [lo, hi] = gRange(), dates = gDates(), t = today();
  const head = topbar("血糖", "glucose", `<button class="ob" data-act="import" data-ctx="glucose">${IC.camera}导入截图</button>`);
  if (!S && !dates.length) return head + `<section class="card perch lying">${petImg("dog","lie")}<b class="ser" style="font-size:17px">还没有血糖数据</b>
    <div class="muted small">在血糖 App 里截一张「周报告」或「日曲线」,点「导入截图」就能读出数字和曲线;也可以手动记一次指尖血。</div>
    <div class="row"><button class="btn primary sm" data-act="import" data-ctx="glucose">导入截图</button><button class="btn sm" data-act="openHypo">低血糖须知</button></div></section>` + logCard();
  if (!selDay || !dates.includes(selDay)) selDay = dates.filter(d => state.glucose.curves[d] || state.glucose.days[d]).pop() || dates[dates.length-1] || t;
  const D = gDay(selDay), sp = S && tirSplit(S);
  let card = "";
  if (S && S.tir != null){
    const good = S.tir >= 70;
    card = `<section class="card perch">${petImg("dog","sit2")}<span class="lab">${md(S.from)} – ${md(S.to)} · 目标范围 ${lo}–${hi}</span>
      <div class="row" style="align-items:baseline;gap:6px"><span class="n" style="font-size:52px;line-height:1">${f1(S.tir)}</span><span class="n muted" style="font-size:20px">%</span><span class="chip ${good ? "" : "amber"}" style="margin-left:auto">${good ? "高于目标 70%" : "低于目标 70%"}</span></div>
      ${sp ? `<div class="tirbar" role="img" aria-label="偏低 ${sp.tbr == null ? "未知" : f1(sp.tbr)+"%"},范围内 ${f1(sp.tir)}%,偏高 ${sp.tar == null ? "未知" : f1(sp.tar)+"%"}">${sp.tbr == null ? `<i style="flex:${100-sp.tir};background:var(--gray)"></i><i style="flex:${sp.tir};background:var(--sage)"></i>` : `${sp.tbr > 0 ? `<i style="flex:${sp.tbr};background:var(--coral)"></i>` : ""}<i style="flex:${sp.tir};background:var(--sage)"></i>${sp.tar > 0 ? `<i style="flex:${sp.tar};background:var(--amber)"></i>` : ""}`}</div>
      <div class="row sp" style="font-size:12px"><span class="muted">偏低 ${sp.tbr == null ? "–" : f1(sp.tbr)+"%"}</span><span class="muted">范围内 ${f1(sp.tir)}%</span><span class="muted">偏高 ${sp.tar == null ? "–" : f1(sp.tar)+"%"}</span></div>` : ""}
      <div class="hl"></div>
      <div class="stat3"><div><div class="v n" style="font-size:24px">${S.cv != null ? f1(S.cv) : "–"}<small>%</small></div><span class="k">波动 CV${S.cv != null ? (S.cv <= 36 ? " · 平稳" : " · 偏大") : ""}</span></div>
        <div><div class="v n" style="font-size:24px">${S.high ?? "–"}<small>次</small></div><span class="k">高血糖</span></div>
        <div><div class="v n" style="font-size:24px;${S.low ? "color:var(--coral)" : ""}">${S.low ?? "–"}<small>次</small></div><span class="k">低血糖</span></div></div></section>`;
  }
  // the seven days around the selected one
  let end = S && S.to && S.to > selDay && diffD(selDay, S.to) < 7 ? S.to : selDay; if (end > t) end = t;
  const week = Array.from({length:7}, (_,i) => addD(end, i-6)).map(d => { const g = gDay(d), v = g.tir, has = v != null || g.logs.length;
    return `<button class="${!has || d > t ? "x" : v != null && v < 50 ? "c" : v != null && v < 70 ? "a" : ""} ${d === selDay ? "sel" : ""}" ${has && d <= t ? `data-gday="${d}"` : "disabled"} aria-label="${d} ${v != null ? "TIR " + f1(v) + "%" : "无数据"}"><span>${WD[wdi(d)]}</span><b>${v != null ? (v >= 99.95 ? "100" : f1(v)) : g.logs.length ? "•" : "–"}</b></button>`; }).join("");
  const fx = exerciseEffects().filter(x => x.date === selDay).pop(), ins = gInsights(), top = ins.find(x => x.lv !== "good") || ins[0];
  const insight = fx ? {lv:"good", text:`${esc(fx.name)}后,接下来 1 小时平均血糖比之前${fx.after <= fx.before ? "低" : "高"} <b class="n" style="font-size:16px">${f1(Math.abs(fx.before - fx.after))}</b>。`}
    : top ? {lv:top.lv, text:esc(top.title)} : null;
  const st = D.st;
  return head + card + `<div class="week7">${week}</div>
  <section class="card"><div class="row sp"><span class="lab">${+selDay.slice(5,7)} 月 ${+selDay.slice(8)} 日</span><div class="row nowrap" style="gap:6px"><button class="iconbtn" data-gstep="-1" aria-label="前一天">‹</button><button class="iconbtn" data-gstep="1" aria-label="后一天">›</button></div></div>
    <div class="chart" id="gchart" data-date="${selDay}"></div>
    ${st || D.tir != null ? `<div class="stat-row">${D.tir != null ? `<div><span class="lab">范围内</span><span class="num">${f1(D.tir)}%</span></div>` : ""}${st ? `<div><span class="lab">平均</span><span class="num">${f1(st.mean)}</span></div><div><span class="lab">最高</span><span class="num" style="${st.max > hi ? "color:var(--amber-ink)" : ""}">${f1(st.max)}</span></div><div><span class="lab">最低</span><span class="num" style="${st.min < lo ? "color:var(--coral)" : ""}">${f1(st.min)}</span></div>` : ""}</div>` : ""}
    ${insight ? `<div class="insight ${insight.lv}"><span class="ic">${insight.lv === "good" ? IC.leaf : IC.wave}</span><span>${insight.text}</span></div>` : ""}
    ${D.src === "曲线识别" ? `<div class="muted small">曲线是从截图里读出的近似值。</div>` : ""}</section>
  <div class="row" style="gap:8px"><button class="ob" data-act="openGTips">控糖建议 ${ins.length}</button><button class="ob" data-act="openHypo">${IC.shield}低血糖须知</button></div>
  ${logCard()}${calCard()}`;
}
function calCard(){
  const t = today(), start = addD(weekStart(t), -28);
  let cal = WD.map(w => `<span class="ch">${w}</span>`).join("");
  for (let i=0;i<35;i++){ const d = addD(start,i); if (d > t){ cal += `<span></span>`; continue; } const g = gDay(d);
    cal += `<button class="cday ${tirClass(g.tir)} ${d===selDay?"sel":""} ${d===t?"today":""}" data-gday="${d}" aria-label="${d} TIR ${g.tir != null ? f1(g.tir)+"%" : "无数据"}"><span class="cd">${+d.slice(8)}</span><span class="cv">${g.tir != null ? (g.tir >= 99.95 ? "100" : Math.round(g.tir)) : (g.logs.length ? "•" : "")}</span></button>`; }
  return `<section class="card"><div class="row sp"><span class="lab">五周日历 · 范围内时间</span><span class="legend2"><span><i class="sw" style="background:var(--sage-soft)"></i>≥70</span><span><i class="sw" style="background:var(--amber-soft)"></i>50–70</span><span><i class="sw" style="background:var(--coral-soft)"></i>&lt;50</span></span></div><div class="cal">${cal}</div></section>`;
}
function logCard(){
  const logs = state.glucose.logs.slice(-5).reverse(), [lo, hi] = gRange(), now = new Date().toTimeString().slice(0,5);
  return `<section class="card" id="logcard"><span class="lab">手动记录血糖</span>
    <form id="gform" class="row" style="align-items:flex-end">
      <label class="f">mmol/L<input id="gval" type="number" step="0.1" min="1" max="35" inputmode="decimal" placeholder="5.6" required style="width:90px"></label>
      <label class="f">时间<input id="gtime" type="time" value="${now}"></label>
      <label class="f">时间点<select id="gtag">${GLU_TAGS.map(t => `<option>${t}</option>`).join("")}</select></label>
      <button class="btn primary" type="submit">记录</button></form>
    ${logs.length ? `<div class="list">${logs.map(l => `<div class="item"><span class="n" style="font-size:20px;width:46px;color:${l.v < lo ? "var(--coral)" : l.v > hi ? "var(--amber-ink)" : "var(--ink)"}">${l.v}</span><span class="grow muted small">${md(l.date)} ${l.time} · ${l.tag}</span></div>`).join("")}</div>` : ""}</section>`;
}

/* ---- sport ---- */
function courseTile(c){
  return `<button class="tile" data-course="${c.id}"><span class="fig">${demo(coverAnim(c))}${c.tags.includes("控糖") ? `<span class="tag blue">控糖</span>` : ""}</span><span class="t"><b>${esc(c.name)}</b><span class="muted">${courseMin(c)} 分钟 · ${c.lv}</span></span></button>`;
}
function musicCard(){
  const cur = Music.track, on = Music.playing;
  return `<section class="card"><div class="row sp"><span class="lab">运动音乐</span><span class="muted small">内置,离线可用</span></div>
    <div class="tracks">${TRACKS.map(t => { const now = on && cur === t; return `<button class="trk ${now ? "playing" : ""}" data-track="${t.id}" aria-pressed="${now}"><span class="art">${t.nature ? IC.leaf : IC.music}</span><span class="grow"><b class="ser" style="font-size:14px">${t.name}</b><div class="muted small">${t.style}${t.nature ? "" : ` · ${t.bpm} BPM`}</div></span>${now ? `<span class="eq" style="color:var(--forest)"><i></i><i></i><i></i></span>` : `<span class="muted" style="width:16px">${IC.play}</span>`}</button>`; }).join("")}</div>
    <div class="row"><label class="f" style="flex:1">音量<input id="vol" type="range" min="0" max="1" step="0.05" value="${state.profile.vol}" style="padding:0;accent-color:var(--forest);background:none;border:0"></label>
    <label class="row small muted" style="gap:6px"><input type="checkbox" id="autoMusic" ${state.profile.autoMusic?"checked":""}> 运动时自动播放</label></div>
    <div class="muted small">iPhone 侧面的静音键打开时,网页里的音乐会没有声音。</div></section>`;
}
const CF = [["all","全部"],["新手","新手"],["控糖","控糖"],["不出门","在家"],["flex","瑜伽拉伸"],["str","力量"],["aero","有氧"],["burn","燃脂"],["core","核心"],["relax","放松"]];
function vSport(){
  const t = today(), wk = state.plan.week, meta = state.plan.meta, ws = weekStart(t), ti = wdi(t);
  const list = COURSES.filter(c => courseFilter === "all" || c.cat === courseFilter || c.tags.includes(courseFilter));
  const recent = Object.entries(LOG()).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,5);
  const opts = COURSES.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  const rows = WD.map((w,i) => { const ids = wk[i] || [], d = addD(ws,i), did = (LOG()[d]||[]).length > 0;
    if (!ids.length && i !== ti) return "";
    return `<div class="r ${i === ti ? "today" : ""}"><span class="d">${w}</span>${ids.length ? `<button data-course="${ids[0]}" class="ellip">${i === ti ? `<b class="ser">${ids.map(id => esc(courseById(id).name)).join(" + ")}</b>` : ids.map(id => esc(courseById(id).name)).join(" + ")}</button>` : `<span class="muted">休息 · 可选</span>`}<span class="n muted">${ids.length ? comboMin(ids) + " 分" : ""}</span><span>${did ? `<span class="ok">${ICON.check}</span>` : ""}</span></div>`; }).join("");
  return topbar("运动", "sport", `<button class="ob" data-act="planSetup">${meta ? "调整计划" : "生成计划"}</button>`) + `
  <section class="card perch lying">${petImg("dog","lie")}
    ${meta ? `<div class="row sp"><span class="lab">本周计划 · 每次约 ${meta.target} 分钟</span><button class="linkbtn" data-act="planWhy">为什么这样排</button></div><div class="plan">${rows}</div>
      <button class="btn primary big" data-act="startToday">开始今天的运动</button>`
    : `<b class="ser" style="font-size:17px">还没有计划</b><div class="muted small">回答几个小问题,二楞会根据你的身体数据、血糖和喜好,搭配每周的课程。</div><button class="btn primary" data-act="planSetup" style="justify-self:start">生成我的计划</button>`}
  </section>
  <div class="row sp" style="margin-top:4px"><span class="lab">课程库 · ${COURSES.length} 节</span><span class="muted small">每个动作都有示范</span></div>
  <div class="fchips">${CF.map(([k,l]) => `<button class="fchip" data-cf="${k}" aria-pressed="${courseFilter===k}">${l}</button>`).join("")}</div>
  <div class="cards">${list.map(courseTile).join("")}</div>
  ${musicCard()}
  <section class="card"><span class="lab">补记运动</span>
    <form id="mform" class="row" style="align-items:flex-end">
      <label class="f">日期<input id="mdate" type="date" value="${t}" max="${t}"></label>
      <label class="f">开始时间<input id="mtime" type="time"></label>
      <label class="f">项目<select id="mcourse">${opts}<option value="other:4">其他 · 中等强度</option><option value="other:7">其他 · 高强度</option></select></label>
      <label class="f">分钟<input id="mmin" type="number" min="1" max="600" value="30" style="width:76px"></label>
      <button class="btn primary" type="submit">记录</button></form>
    ${recent.length ? `<div class="list">${recent.map(([d,l]) => l.map((x,k) => `<div class="item"><span class="n muted" style="width:40px">${md(d)}</span><div class="grow ellip">${esc(x.name || (courseById(x.c)||{}).name || "运动")}</div><span class="muted small">${x.at ? x.at + " · " : ""}${x.min} 分</span><button class="btn xs ghost" data-dellog="${d}:${k}" aria-label="删除">×</button></div>`).join("")).join("")}</div>` : ""}
  </section>`;
}

/* ---- diet: set like a menu ---- */
function vDiet(){
  const tg = targets(), t = today(), wk = state.meals.week, p = state.profile, ti = wdi(t), mdx = MDAYS()[t] || {};
  const goalTxt = {lose:"每天比消耗少约 500 千卡", keep:"摄入与消耗持平", gain:"每天多约 300 千卡,配合力量训练", recomp:"每天少约 250 千卡,高蛋白 + 力量训练"}[p.goal];
  const macro = (n, g, kc) => `<div class="macro"><span>${n}</span><i><b style="width:${Math.round(kc/tg.kcal*100)}%"></b></i><span class="n" style="text-align:right">${g} g</span></div>`;
  const lib = RECIPES.filter(r => r.meal === recipeMeal && (!recipeTag || r.tags.includes(recipeTag)));
  const tip = r => r.tags.includes("控糖") ? "控糖 · 先吃菜,主食放最后" : r.tags.includes("高蛋白") ? "高蛋白" : r.tags.includes("低卡") ? "低卡" : "";
  return topbar("饮食", "diet", `<button class="ob" data-act="genWeek">${wk ? "换一组菜单" : "生成菜单"}</button>`) + `
  ${!p.set ? `<div class="banner" style="margin-top:0"><span>正在用默认身体数据估算,填写后热量会更准。</span><button class="btn sm" data-act="openMe">去填写</button></div>` : ""}
  <section class="card"><div class="row sp"><span class="lab">每日热量 · ${GOALS[p.goal]}</span><span class="muted small">${tg.measured ? "基础代谢为体脂秤实测" : "按身体数据估算"}</span></div>
    <div class="row" style="align-items:baseline;gap:8px"><span class="n" style="font-size:44px;line-height:1">${tg.kcal}</span><span class="muted">千卡</span></div>
    <div class="muted small">基础代谢 ${tg.bmr} · 日常消耗 ${tg.tdee} · ${goalTxt}</div>
    ${macro("蛋白质", tg.prot, tg.prot*4)}${macro("碳水", tg.carb, tg.carb*4)}${macro("脂肪", tg.fat, tg.fat*9)}</section>
  <section class="card perch">${petImg("dog","sit")}<div class="row sp"><span class="lab">今日菜单 · 周${WD[ti]}</span>${wk ? `<span class="muted small">吃过的打个勾</span>` : ""}</div>
    ${wk ? `<div>${MEALS.map(([m,lbl,sh],k) => { const r = recipeById(wk[ti][k]); if (!r) return ""; const po = portion(r, tg.kcal*sh), tp = tip(r);
      return `<div class="meal"><span class="m">${lbl}</span><div style="display:grid;gap:3px;min-width:0"><span class="nm">${r.name}</span>
        <span class="muted small">${tp ? tp + " · " : ""}蛋白 ${Math.round(r.p*po)}g · 碳水 ${Math.round(r.c*po)}g${po !== 1 ? ` · 份量 ×${po}` : ""}</span>
        <details><summary>食材与做法 ›</summary><p>食材:${r.ing}</p>${r.steps ? `<p>做法:${r.steps}</p>` : ""}</details></div>
        <div class="side"><span class="n" style="font-size:18px">${Math.round(r.kcal*po)}</span><button class="check" data-eat="${m}" aria-pressed="${!!mdx[m]}" aria-label="标记${lbl}已吃">${ICON.check}</button><button class="btn xs ghost" data-swap="${ti}:${k}">换</button></div></div>`; }).join("")}</div>`
      : `<div class="empty">根据你的热量目标,从 ${RECIPES.length} 道家常菜里搭配一周菜单,每天热量相近、不重样。</div><button class="btn primary" data-act="genWeek" style="justify-self:start">生成本周菜单</button>`}
  </section>
  <section class="card"><span class="lab">控糖吃法</span><div class="list small">
    <div class="item">每餐先吃蔬菜,再吃肉蛋豆,最后吃主食,餐后血糖更平稳。</div>
    <div class="item">主食一半换成粗粮杂豆或薯类:糙米、燕麦、玉米、红薯。</div>
    <div class="item">每天喝水约 ${Math.round((latestW()||58)*33/100)*100} ml,运动日再多 500 ml。</div>
    <div class="item">饭后 15–30 分钟散步 10–15 分钟。</div></div></section>
  ${wk ? `<section class="card"><span class="lab">本周菜单</span><div class="tbl"><table><thead><tr><th></th>${WD.map((w,i)=>`<th class="${i===ti?"today":""}">周${w}</th>`).join("")}</tr></thead><tbody>
    ${MEALS.map(([m,lbl],k)=>`<tr><th>${lbl}</th>${wk.map((day,i)=>`<td class="${i===ti?"today":""}" style="min-width:92px">${(recipeById(day[k])||{}).name||""}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>` : ""}
  <section class="card"><div class="row sp"><span class="lab">食谱库 · ${RECIPES.length} 道</span><div class="seg">${MEALS.map(([m,l])=>`<button data-rm="${m}" aria-pressed="${recipeMeal===m}">${l}</button>`).join("")}</div></div>
    <div class="fchips">${["","控糖","高蛋白","低卡","快手","素食"].map(x=>`<button class="fchip" data-rt="${x}" aria-pressed="${recipeTag===x}">${x||"全部"}</button>`).join("")}</div>
    <div class="menu-lib">${lib.length ? lib.map(r => `<div class="it"><b>${r.name}</b><span class="n">${r.kcal} <span class="muted small">千卡</span></span>
      <span class="muted small">${r.tags.concat([`蛋白 ${r.p}g`, `碳水 ${r.c}g`]).join(" · ")}</span><span></span>
      <details style="grid-column:1/-1"><summary>食材与做法 ›</summary><p>${r.ing}</p>${r.steps ? `<p>${r.steps}</p>` : ""}</details></div>`).join("") : `<div class="empty">这个分类下暂时没有。</div>`}</div></section>`;
}

/* ---- body ---- */
const BODY_ROWS = [["fat","体脂率","%"],["muscle","肌肉率","%"],["visceral","内脏脂肪",""],["water","水分","%"],["protein","蛋白质","%"],["bone","骨量","kg"],["bmi","BMI",""],["vo2max","最大摄氧量",""]];
function rangeRow(k, name, v, unit){
  const r = ref(k), s = status(k, v); if (!r) return "";
  const [lo, hi, a, b] = r, P = x => Math.max(0, Math.min(100, (x-a)/(b-a)*100));
  return `<div class="mrow"><span>${name}</span><span class="rng" role="img" aria-label="${name} ${v}${unit},标准 ${lo}–${hi}"><i style="left:${P(lo)}%;width:${P(hi)-P(lo)}%"></i><b class="${s ? s[1] : ""}" style="left:${P(v)}%"></b></span><span class="val">${v}<small>${unit}</small></span></div>`;
}
function weightCard(){
  const s = wSeries(), lw = latestW(); if (lw == null) return "";
  const t = today(), win = s.filter(p => p.d >= addD(t,-29)), first = win.length ? win[0] : s[0], dv = lw - first.v;
  const pts = win.length >= 2 ? win : s.slice(-2);
  let line = "";
  if (pts.length >= 2){ const vs = pts.map(p=>p.v), lo0 = Math.min(...vs), hi0 = Math.max(...vs), span = hi0 - lo0 || 1, d0 = pts[0].d, dn = Math.max(1, diffD(d0, pts[pts.length-1].d));
    const xy = pts.map(p => [diffD(d0,p.d)/dn*296 + 2, 6 + (hi0 - p.v)/span*40]);
    line = `<svg viewBox="0 0 300 52" width="100%" aria-hidden="true"><polyline fill="none" stroke="var(--forest)" stroke-width="1.8" stroke-linejoin="round" points="${xy.map(q => q.map(n => n.toFixed(1)).join(",")).join(" ")}"/><circle cx="${xy[xy.length-1][0]}" cy="${xy[xy.length-1][1]}" r="3.5" fill="var(--forest)"/></svg>`; }
  const down = state.profile.goal === "gain" ? dv > 0 : dv <= 0;
  return `<section class="card perch left">${petImg("dog","walk")}<span class="lab">体重 · 近 30 天</span>
    <div class="row" style="align-items:baseline;gap:6px"><span class="n" style="font-size:44px;line-height:1">${f1(lw)}</span><span class="muted">kg</span>${Math.abs(dv) >= .05 ? `<span class="chip ${down ? "" : "amber"}" style="margin-left:auto">${dv < 0 ? "↓" : "↑"} ${f1(Math.abs(dv))} kg</span>` : ""}</div>${line}</section>`;
}
function bodyCard(){
  const B = latestBody(), all = bodyFull(), tn = suggestions().filter(t => t.lv !== "good").length;
  if (!B) return `<section class="card"><span class="lab">体成分</span><div class="empty">导入体脂秤的测量截图,这里会出现体脂率、肌肉率等指标,和标准范围对照。</div></section>`;
  const rows = BODY_ROWS.filter(([k]) => B[k] != null).map(([k,n,u]) => rangeRow(k, n, B[k], u)).join("");
  return `<section class="card"><div class="row sp"><span class="lab">体成分 · ${md(B.date)}${B.src ? " · " + esc(B.src) : ""}</span>${tn ? `<button class="linkbtn" data-act="openTips">改进建议 ${tn} ›</button>` : ""}</div>
    ${B.bodyType || B.bodyAge || B.score != null ? `<div class="row" style="gap:6px">${B.score != null ? `<span class="chip">身体得分 ${B.score}</span>` : ""}${B.bodyType ? `<span class="chip">${esc(B.bodyType)}</span>` : ""}${B.bodyAge ? `<span class="chip">身体年龄 ${B.bodyAge}</span>` : ""}</div>` : ""}
    <div>${rows}${B.bmr != null ? `<div class="mrow"><span>基础代谢</span><span class="muted small">体脂秤实测</span><span class="val">${B.bmr}</span></div>` : ""}${B.muscleLevel != null ? `<div class="mrow"><span>储肌等级</span><span class="muted small">${status("muscleLevel",B.muscleLevel)[0]}</span><span class="val">${B.muscleLevel}<small>级</small></span></div>` : ""}</div>
    <div class="legend2"><span><i class="sw" style="background:var(--sage)"></i>标准范围</span><span><i class="sw" style="background:var(--forest);border-radius:50%"></i>你的位置</span></div>
    ${all.length >= 2 ? `<div style="display:grid;gap:4px"><span class="lab">体脂率变化</span>${trendLine(all.map(r => ({d:r.date, v:r.fat})), ref("fat")[1], "%")}</div>` : ""}</section>`;
}
function sleepCard(){
  const S = latestSleep(), all = state.health.sleep.slice().sort(byDate).slice(-14);
  if (!S) return `<section class="card perch cat left">${petImg("cat","stretch")}<span class="lab">睡眠</span><div class="empty">导入手环或手表的睡眠截图,这里会出现睡眠结构。</div></section>`;
  const tot = (S.deep||0) + (S.light||0) + (S.rem||0) || S.night || 1, pct = v => v != null ? Math.round(v/tot*100) : null;
  const tmin = t => { if (!t) return null; const [h,m] = t.split(":").map(Number); return ((h < 12 ? h + 24 : h) - 20)*60 + m; };
  const b = tmin(S.bedtime), e = tmin(S.wake);
  return `<section class="card perch cat left">${petImg("cat","stretch")}
    <div class="row sp"><span class="lab">睡眠 · ${md(S.date)}</span><span class="n" style="font-size:16px">${hm(S.night)}</span></div>
    ${S.deep != null ? `<div class="stack" role="img" aria-label="深睡 ${pct(S.deep)}%,浅睡 ${pct(S.light)}%,快速眼动 ${pct(S.rem)}%"><i style="flex:${S.deep};background:var(--forest)"></i><i style="flex:${S.light};background:var(--sage)"></i><i style="flex:${S.rem||0};background:var(--s-rem)"></i></div>
      <div class="row" style="gap:12px;font-size:12px"><span class="muted">深睡 ${pct(S.deep)}%</span><span class="muted">浅睡 ${pct(S.light)}%</span><span class="muted">快速眼动 ${pct(S.rem)}%</span>${S.wakeCount != null ? `<span class="chip ${S.wakeCount > 1 ? "amber" : ""}" style="margin-left:auto">醒 ${S.wakeCount} 次</span>` : ""}</div>` : ""}
    ${b != null && e != null ? `<div style="display:grid;gap:4px"><div class="timeline"><i style="left:${b/960*100}%;width:${(e-b)/960*100}%"></i></div><div class="gscale"><span>20:00</span><span>${S.bedtime} 入睡 → ${S.wake} 醒来</span><span>12:00</span></div></div>` : ""}
    ${S.score != null || S.hrMin ? `<div class="row" style="gap:18px;font-size:13px">${S.score != null ? `<span><span class="n" style="font-size:18px">${S.score}</span> <span class="muted">睡眠得分</span></span>` : ""}${S.hrMin ? `<span><span class="n" style="font-size:18px">${S.hrMin}–${S.hrMax}</span> <span class="muted">睡眠心率</span></span>` : ""}</div>` : ""}
    ${all.length >= 2 ? `<div style="display:grid;gap:6px"><span class="lab">最近 ${all.length} 晚</span><div class="nights">${all.map(n => { const mx = 660; return `<div data-tip="${md(n.date)} · ${hm(n.night)}${n.score?" · "+n.score+" 分":""}">${n.deep!=null?`<i style="height:${(n.rem||0)/mx*100}%;background:var(--s-rem)"></i><i style="height:${(n.light||0)/mx*100}%;background:var(--sage)"></i><i style="height:${n.deep/mx*100}%;background:var(--forest)"></i>`:`<i style="height:${(n.night||0)/mx*100}%;background:var(--sage)"></i>`}<span>${+n.date.slice(8)}</span></div>`; }).join("")}</div></div>` : ""}
  </section>`;
}
function vBody(){
  return topbar("身体", "weight", `<button class="ob" data-act="import" data-ctx="body">${IC.camera}导入</button>`) + weightCard() + bodyCard() + sleepCard() + extCard() + weightPart() + tipsEntry();
}

/* ================================================================
   Sheets
   ================================================================ */
let sheetKind = null;
function sheetWrap(title, sub, body, label, extra = ""){
  return `<div class="sheet" role="dialog" aria-label="${label || title}"><div class="grab"></div>
    <div class="card-head"><div><h2>${title}</h2>${sub ? `<div class="muted small">${sub}</div>` : ""}</div><div class="row nowrap" style="gap:6px">${extra}<button class="iconbtn" data-act="closeSheet" aria-label="关闭">${ICON.close}</button></div></div>${body}</div>`;
}
function reviewItem(p){
  const dis = p.st === "reading" ? "disabled" : "";
  const field = ([k,n,t,opts]) => t === "select" ? `<label class="f">${n}<select id="f-${p.id}-${k}" ${dis}>${opts.map(o => `<option ${o===p.data[k]?"selected":""}>${o}</option>`).join("")}</select></label>`
    : `<label class="f">${n}<input id="f-${p.id}-${k}" type="${t||"number"}" ${t?"":'step="any" inputmode="decimal"'} value="${p.data[k] ?? ""}" ${dis}></label>`;
  return `<div class="review" id="rv-${p.id}"><div class="row nowrap" style="align-items:flex-start">${p.url?`<img class="imgs" src="${p.url}" alt="上传的截图">`:""}
    <div style="display:grid;gap:6px;min-width:0;flex:1"><div class="row"><select data-ptype="${p.id}" ${dis} aria-label="数据类型">${Object.entries(KIND_NAME).map(([k,n]) => `<option value="${k}" ${k===p.type?"selected":""}>${n}</option>`).join("")}</select>
      ${p.st === "reading" ? `<span class="chip">识别中…</span>` : p.st === "ready" ? `<span class="chip">已识别</span>` : `<span class="chip" style="background:var(--paper)">手动填写</span>`}</div>
      <span class="muted small rmsg">${esc(p.msg || "")}</span></div></div>
    ${p.curve && p.type === "glucoseDay" ? `<div class="curve-prev">${miniCurve(p.curve)}<div class="muted small">读出 ${p.curve.length} 个点 · ${(() => { const s = curveStats(p.curve); return s ? `范围内 ${f1(s.tir)}% · 平均 ${f1(s.mean)} · 最高 ${f1(s.max)}` : ""; })()}</div></div>` : ""}
    <div class="fgrid">${FIELDS[p.type].map(field).join("")}</div>
    <div class="row"><button class="btn primary sm" data-psave="${p.id}" ${dis}>保存并更新图表</button><button class="btn ghost sm" data-pdrop="${p.id}">不要了</button></div></div>`;
}
function miniCurve(pts){
  const [lo, hi] = gRange(), y = v => 30 - (Math.max(2, Math.min(14, v)) - 2)/12*28, x = m => m/1440*200;
  return `<svg viewBox="0 0 200 32" preserveAspectRatio="none" width="100%" height="32" aria-hidden="true"><rect x="0" y="${y(hi)}" width="200" height="${y(lo)-y(hi)}" fill="var(--sage-soft)"/><polyline points="${pts.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--forest)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}
function updateItem(p){ const el = document.getElementById("rv-" + p.id); if (el) el.outerHTML = reviewItem(p); }
function openSheet(kind, arg){
  sheetKind = kind;
  const el = $("#sheet");
  if (kind === "course"){
    const c = courseById(arg), m = courseMin(c), mv = uniqMoves(c);
    el.innerHTML = `<div class="sheet" role="dialog" aria-label="${c.name}"><div class="grab"></div>
      <div class="stage">${demo(coverAnim(c),"",true)}</div>
      <div style="display:grid;gap:6px"><div class="row" style="gap:6px"><span class="tag">${CATS[c.cat]} · ${c.lv}</span>${c.tags.map(x => `<span class="tag">${x}</span>`).join("")}</div><h2 style="font-size:22px">${esc(c.name)}</h2><div class="muted small">${esc(c.desc)}</div>
        <div class="meta"><span>${m} 分钟</span><span>约 ${kcalOf(c.met,m,latestW()||58)} 千卡</span>${c.rounds?`<span>${c.rounds} 轮 · ${c.work} 秒练 / ${c.rest} 秒歇</span>`:`<span>${c.seq.length} 个环节</span>`}</div></div>
      <div class="row nowrap"><button class="btn primary" data-play="${c.id}" style="flex:1">${ICON.play}开始训练</button>
        <select data-addcourse="${c.id}" aria-label="加入计划"><option value="">加入计划…</option>${WD.map((w,i)=>`<option value="${i}">周${w}</option>`).join("")}</select></div>
      <div><span class="lab">动作示范</span>${mv.map(x => `<div class="move">${fig(x.a)}<div style="display:grid;gap:2px;min-width:0"><b class="ser" style="font-size:14px">${esc(x.n)}</b><span class="muted small">${esc(x.t || (c.rounds ? `每组 ${c.work} 秒` : `${x.s} 秒`))}</span>
        <a class="small vlink" href="${videoUrl(x.n.replace(/ · .*/,""))}" target="_blank" rel="noopener">看真人视频 ›</a></div></div>`).join("")}</div></div>`;
  } else if (kind === "import"){
    el.innerHTML = sheetWrap("导入数据", "血糖、体脂秤、睡眠、运动手环的截图都可以", `
      <label class="opt" for="shot"><span class="icon-round">${IC.camera.replace("<svg",'<svg width="20" height="20"')}</span><span><b>选择截图,自动识别</b><span class="muted small">离线识别文字和血糖曲线。第一次使用需要下载约 10 MB 的识别引擎。</span></span></label>
      <input id="shot" type="file" accept="image/*" multiple hidden>
      <div class="opt col"><div class="row nowrap" style="gap:12px"><span class="icon-round">${IC.paste.replace("<svg",'<svg width="20" height="20"')}</span><span style="display:grid;gap:2px"><b>粘贴「实况文本」(最准)</b><span class="muted small">在 iPhone 相册打开截图 → 长按文字或点右下角的「实况文本」图标 → 全选 → 拷贝,再粘贴到这里。</span></span></div>
        <textarea id="pasteBox" rows="4" placeholder="把拷贝的文字粘贴到这里"></textarea><button class="btn sm primary" data-act="parsePaste" style="justify-self:start">识别文字</button></div>
      <div class="opt col"><div class="row nowrap" style="gap:12px"><span class="icon-round">${IC.pen.replace("<svg",'<svg width="20" height="20"')}</span><b>手动填写</b></div>
        <div class="row" style="gap:6px">${(arg === "glucose" ? ["glucoseLog","glucoseWeek","glucoseDay","body","sleep","workout"] : ["body","sleep","workout","glucoseLog","glucoseWeek"]).map(k => `<button class="btn sm" data-manual="${k}">${KIND_NAME[k]}</button>`).join("")}</div></div>`);
  } else if (kind === "review"){
    el.innerHTML = sheetWrap("核对数据", "数字以截图为准,有误直接改", `<div id="reviewList" style="display:grid;gap:12px">${pending.map(reviewItem).join("") || `<div class="empty">没有待核对的数据。</div>`}</div>`);
  } else if (kind === "tips"){
    el.innerHTML = sheetWrap("改进建议", "根据最新的体成分、睡眠和训练数据", tipsHTML(suggestions()) + `<div class="muted small">建议仅供参考,不能替代医生或营养师的专业意见。</div>`);
  } else if (kind === "gtips"){
    const ins = gInsights();
    el.innerHTML = sheetWrap("控糖建议", "根据导入的血糖数据", `<div class="tips">${ins.map(t => `<div class="tipc ${t.lv}"><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p>${t.act ? `<div class="row">${t.act[0].startsWith("sheet:") ? `<button class="btn sm soft" data-act="openHypo">${t.act[1]}</button>` : `<button class="btn sm soft" data-play="${t.act[0]}">${ICON.play}${t.act[1]}</button>`}</div>` : ""}</div>`).join("")}
      <div class="tipc"><h3>吃饭的小顺序</h3><p>先吃蔬菜,再吃肉蛋豆,最后吃主食。同样的一餐,餐后血糖会平稳很多。</p></div></div><div class="muted small">以上是生活方式建议,不能替代医生的诊疗意见。</div>`);
  } else if (kind === "hypo"){
    el.innerHTML = sheetWrap("低血糖安全须知", `血糖低于 ${gRange()[0]} mmol/L 就算偏低`, `<div class="tips">
      <div class="tipc bad"><h3>出现这些感觉要警惕</h3><p>心慌、手抖、出冷汗、突然很饿、头晕、乏力、注意力不集中。</p></div>
      <div class="tipc warn"><h3>「15–15 原则」</h3><p>1. 马上吃 15 克快速起效的糖:半杯果汁(约 150 ml)、3–4 块方糖或一汤匙蜂蜜。<br>2. 休息 15 分钟后再测一次。<br>3. 还低于 ${gRange()[0]},就再吃 15 克。<br>4. 恢复后,如果离下一餐还远,吃点饼干或面包。</p></div>
      <div class="tipc"><h3>运动前后</h3><p>· 没有使用降糖药时,运动引起低血糖的风险很低,但空腹时不要做高强度运动。<br>· 运动前血糖低于 ${gRange()[0]}:先处理,不要运动。<br>· 运动前在 ${gRange()[0]}–5.0 之间:先吃一点碳水(半根香蕉或两片饼干)。<br>· 运动中觉得不舒服,马上停下来。随身带几块糖。<br>· 运动后 30 分钟可以测一次,看看运动的效果。</p></div>
      <div class="tipc"><h3>需要马上就医的情况</h3><p>意识模糊、无法进食、抽搐,或者反复发生低血糖。请身边的人帮忙,并联系医生。</p></div></div>`);
  } else if (kind === "precheck"){
    el.innerHTML = sheetWrap("运动前看一眼血糖", "可选,直接开始也没关系", `
      <div class="row" style="align-items:flex-end"><label class="f">现在的血糖 mmol/L<input id="preVal" type="number" step="0.1" min="1" max="35" inputmode="decimal" placeholder="例如 5.6" style="width:130px"></label><button class="btn primary" data-act="preCheck">检查</button></div>
      <div id="preOut"></div>
      <div class="row"><button class="btn ghost" data-act="preSkip">跳过,直接开始</button></div>`);
  } else if (kind === "planSetup"){
    const p = state.profile;
    el.innerHTML = sheetWrap("生成我的每周计划", "结合你的身体数据、血糖和喜好来搭配", `
      <form id="planForm" style="display:grid;gap:16px">
        <div style="display:grid;gap:6px"><span class="lab">现在的运动习惯</span><div class="chips">${Object.entries(LEVELS).map(([k,[l]]) => `<label class="chip-r"><input type="radio" name="level" value="${k}" ${p.level===k?"checked":""}><span>${l}</span></label>`).join("")}</div></div>
        <div style="display:grid;gap:6px"><span class="lab">每次想运动多久</span><div class="chips">${[10,15,20,30,45].map(m => `<label class="chip-r"><input type="radio" name="mins" value="${m}" ${+p.mins===m?"checked":""}><span>${m} 分钟</span></label>`).join("")}</div></div>
        <div style="display:grid;gap:6px"><span class="lab">每周几天</span><div class="chips">${[3,4,5,6].map(n => `<label class="chip-r"><input type="radio" name="days" value="${n}" ${+p.days===n?"checked":""}><span>${n} 天</span></label>`).join("")}</div></div>
        <div style="display:grid;gap:6px"><span class="lab">喜欢的方式(可多选)</span><div class="chips">${LIKES.map(([k,l]) => `<label class="chip-r"><input type="checkbox" name="likes" value="${k}" ${p.likes.includes(k)?"checked":""}><span>${l}</span></label>`).join("")}</div></div>
        <label class="row small" style="gap:8px"><input type="checkbox" name="lowImpact" ${p.lowImpact?"checked":""}> 膝盖不太好 / 不想跳,只要低冲击动作</label>
        <button class="btn primary big" type="submit">生成计划</button></form>`);
  } else if (kind === "planWhy"){
    const m = state.plan.meta;
    el.innerHTML = sheetWrap("为什么这样安排", m ? `${m.at} 生成` : "", `<div class="tips">${(m ? m.reasons : []).map(r => `<div class="tipc"><p>${esc(r)}</p></div>`).join("") || `<div class="empty">还没有计划。</div>`}</div>
      <div class="muted small">导入新的体脂秤、睡眠或血糖数据后,可以在「调整计划」里重新生成。</div>`);
  } else if (kind === "me"){
    const p = state.profile, sel = (id, cur, o) => `<select id="${id}">${o.map(([v,l])=>`<option value="${v}" ${String(v)===String(cur)?"selected":""}>${l}</option>`).join("")}</select>`;
    el.innerHTML = sheetWrap("我的", "所有数据只保存在这台手机上", `
      <form id="pform" style="display:grid;gap:14px">
        <div class="row"><label class="f" style="flex:1">昵称(首页问候)<input id="pname" maxlength="16" value="${esc(p.name||"Amber")}"></label><label class="f">性别${sel("psex",p.sex,[["f","女"],["m","男"]])}</label></div>
        <div class="row"><label class="f">年龄<input id="page" type="number" min="12" max="90" value="${p.age}" style="width:76px"></label>
          <label class="f">身高 cm<input id="pheight" type="number" min="120" max="230" value="${p.height}" style="width:86px"></label>
          <label class="f">目标体重 kg<input id="pgoalw" type="number" step="0.1" min="30" max="250" value="${p.goalWeight??""}" style="width:96px"></label></div>
        <label class="f">目标${sel("pgoal",p.goal,[["keep","保持健康"],["recomp","塑形:减脂增肌"],["lose","减脂"],["gain","增肌"]])}</label>
        <label class="f">日常活动量${sel("pact",p.activity,[[1.2,"久坐:基本不运动"],[1.375,"轻度:每周运动 1–3 次"],[1.55,"中度:每周运动 3–5 次"],[1.725,"高度:每周运动 6–7 次"]])}</label>
        <div class="row"><label class="f">血糖目标下限<input id="pglo" type="number" step="0.1" min="3" max="5" value="${p.gLo}" style="width:86px"></label><label class="f">上限<input id="pghi" type="number" step="0.1" min="6" max="13" value="${p.gHi}" style="width:86px"></label>
          <label class="row small" style="gap:6px;align-self:center"><input type="checkbox" id="pprecheck" ${p.preCheck?"checked":""}> 运动前提醒看血糖</label></div>
        <button class="btn primary" type="submit">保存</button></form>
      <div class="tipc"><h3>页面背景</h3><p>除首页外,每个页面都可以换成你自己拍的照片。照片只存在这台手机里。</p><div class="row"><button class="btn sm" data-act="openBg" data-page="glucose">${IC.image}设置页面背景</button></div></div>
      <div class="tipc"><h3>数据备份</h3><p>数据只存在这个浏览器里。换手机或清理 Safari 数据前,先导出备份(背景照片不在备份里)。</p>
        <div class="row"><button class="btn sm" data-act="exportData">导出备份</button><label class="btn sm" for="restoreFile">从备份恢复</label><input id="restoreFile" type="file" accept="application/json,.json" hidden></div></div>
      <div class="tipc"><h3>添加到 iPhone 主屏幕</h3><p>在 Safari 里点底部的「分享」按钮 →「添加到主屏幕」。之后像 App 一样打开,没有网络也能用。</p></div>
      <div class="row">${p.sample ? `<button class="btn sm" data-act="clearSample">清除示例数据</button>` : `<button class="btn sm" data-act="loadSample">载入示例数据</button>`}<button class="btn sm danger" data-act="clearAll">${clearArm ? "确定清空?再点一次" : "清空全部数据"}</button></div>`);
  } else if (kind === "chat"){
    el.innerHTML = `<div class="sheet chat" role="dialog" aria-label="和二楞、发财聊聊">${bgLayer()}<div class="grab"></div>
      <div class="card-head"><div class="row nowrap" style="gap:8px">${petFace("dog")}${petFace("cat")}<div><b class="ser" style="font-size:17px">二楞和发财</b><div class="muted small">离线陪聊 · 会参考你的记录</div></div></div><div class="row nowrap" style="gap:6px">${bgBtn("chat")}<button class="iconbtn" data-act="closeSheet" aria-label="关闭">${ICON.close}</button></div></div>
      <div class="hl"></div>
      <div class="chat" id="chatList"></div>
      <div class="chatbar"><div class="fchips">${CHIPS.map(c=>`<button class="fchip" data-say="${c}">${c}</button>`).join("")}</div>
        <form id="chatForm"><input id="chatIn" placeholder="和二楞、发财说点什么…" autocomplete="off" maxlength="200"><button class="btn primary" type="submit">发送</button></form></div></div>`;
    if (!chat.length) chat.push(...chatHello());
    renderChat();
  } else if (kind === "bg"){
    bgEditor(arg);
    return;
  }
  el.hidden = false; document.body.style.overflow = "hidden";
  mountDemos(el); applyBg();
}
function closeSheet(){ $("#sheet").hidden = true; $("#sheet").innerHTML = ""; sheetKind = null; bgEdit = null; if ($("#player").hidden) document.body.style.overflow = ""; }
function renderChat(){
  const list = $("#chatList"); if (!list) return;
  list.innerHTML = chat.map(m => m.who === "me" ? `<div class="msg me">${esc(m.text)}</div>`
    : `<div class="msgrow">${petFace(m.who, "sm")}<div class="msg pet"><span class="who">${PET_NAMES[m.who]}</span>${esc(m.text)}${m.act ? `<div class="act"><button class="chip" style="border:0;cursor:pointer;font-size:12.5px;padding:3px 10px" data-cact="${m.act[0]}">${esc(m.act[1])} ›</button></div>` : ""}</div></div>`).join("");
  list.scrollTop = list.scrollHeight;
}
let chatBusy = false;
async function sendChat(text){
  text = text.trim(); if (!text || chatBusy) return;
  chat.push({who:"me", text}); renderChat(); chatBusy = true;
  for (const r of coachReply(text)){ await new Promise(res => setTimeout(res, 450 + Math.random()*400)); chat.push(r); renderChat(); }
  chatBusy = false; persistChat();
}

/* ---- background editor ---- */
let bgEdit = null;   // {page, cfg, url, w, h, blob (new, unsaved)}
function bgEditor(page){
  page = page || "glucose";
  if (bgEdit && bgEdit.blob && bgEdit.url) URL.revokeObjectURL(bgEdit.url);
  const saved = (state.profile.bg || {})[page], B = bgURL[page];
  bgEdit = {page, cfg: Object.assign(BG_DEF(page), saved || {}), url: B && B.url, w: B && B.w, h: B && B.h, blob: null};
  drawBgEditor();
}
function drawBgEditor(){
  const E = bgEdit, el = $("#sheet"), has = !!E.url, cfg = E.cfg, BGP = state.profile.bg || {};
  el.innerHTML = sheetWrap("页面背景", "首页固定为天空照片", `
    <div class="pages">${BG_PAGES.map(([k,l]) => `<button data-bgpage="${k}" aria-pressed="${k === E.page}" class="${BGP[k] ? "has" : ""}">${l}</button>`).join("")}</div>
    ${has ? `<div class="bgwrap"><div class="bg-prev" id="bgPrev"><img src="${E.url}" alt="背景照片"><div class="crop" id="bgCrop"><div class="in" id="bgIn"></div><i class="k a"></i><i class="k b"></i><i class="k c"></i><i class="k d"></i></div></div></div>
      <div class="muted small" style="text-align:center;margin-top:-6px">拖动框选位置 · 双指缩放 · 框内就是手机屏幕</div>
      <div class="sl"><span>缩放</span><input id="bgS" type="range" min="1" max="4" step="0.05" value="${cfg.s}" aria-label="缩放"><span class="n" id="bgSv">${cfg.s.toFixed(1)}×</span></div>
      <div class="sl"><span>清晰度</span><input id="bgC" type="range" min="0" max="100" step="1" value="${cfg.clarity}" aria-label="清晰度"><span class="n" id="bgCv">${cfg.clarity}</span></div>
      <div class="sl"><span>透明度</span><input id="bgO" type="range" min="5" max="100" step="1" value="${cfg.opacity}" aria-label="透明度"><span class="n" id="bgOv">${cfg.opacity}%</span></div>
      <div class="row nowrap"><label class="btn sm" for="bgFile">更换图片</label>${BGP[E.page] || E.blob ? `<button class="btn sm" data-act="bgRemove">移除</button>` : ""}<button class="btn primary" data-act="bgSave" style="flex:1">保存</button></div>`
    : `<div class="bg-empty"><span class="icon-round">${IC.image.replace("<svg",'<svg width="20" height="20"')}</span><div class="small muted">选一张自己拍的照片作为「${BG_PAGES.find(p => p[0] === E.page)[1]}」页面的背景。<br>照片只存在这台手机里,不会上传。</div><label class="btn primary sm" for="bgFile">选择照片</label></div>`}
    <input id="bgFile" type="file" accept="image/*" hidden>`, "页面背景");
  el.hidden = false; document.body.style.overflow = "hidden";
  if (has) requestAnimationFrame(layoutBgPrev);
}
// fit the whole photo in the editor, then draw the crop box that the page will show
function layoutBgPrev(){
  const E = bgEdit, prev = $("#bgPrev"); if (!E || !prev) return;
  const maxW = prev.parentElement.clientWidth, maxH = Math.min(innerHeight*.42, 360), r = E.w/E.h;
  let pw = maxW, ph = pw/r; if (ph > maxH){ ph = maxH; pw = ph*r; }
  prev.style.width = pw + "px"; prev.style.height = ph + "px";
  const W = innerWidth, H = innerHeight, k = Math.max(W/E.w, H/E.h)*E.cfg.s, fw = W/k/E.w, fh = H/k/E.h;
  const crop = $("#bgCrop"), cw = pw*fw, ch = ph*fh;
  Object.assign(crop.style, {width:cw + "px", height:ch + "px", left:(pw - cw)*E.cfg.x + "px", top:(ph - ch)*E.cfg.y + "px",
    background: E.page === "player" ? "#1C2A21" : getComputedStyle(document.documentElement).getPropertyValue("--paper")});
  // the crop shows the photo the way the page will: same opacity and softness, at preview scale
  const blur = (100 - E.cfg.clarity)/100*14*(cw/W);
  Object.assign($("#bgIn").style, {backgroundImage:`url("${E.url}")`, backgroundSize:`${pw}px ${ph}px`, backgroundPosition:`${-(pw - cw)*E.cfg.x}px ${-(ph - ch)*E.cfg.y}px`,
    opacity:E.cfg.opacity/100, filter: blur > .2 ? `blur(${blur.toFixed(2)}px)` : "", transform: blur > .2 ? "scale(1.04)" : ""});
  prev._fit = {pw, ph, cw, ch};
}
function bgPointers(){
  const prev = $("#bgPrev"); if (!prev || prev._bound) return; prev._bound = true;
  const P = new Map(); let base = null;
  prev.addEventListener("pointerdown", e => { prev.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); base = null; });
  prev.addEventListener("pointermove", e => {
    if (!P.has(e.pointerId) || !bgEdit) return;
    const old = P.get(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]);
    const f = prev._fit, cfg = bgEdit.cfg;
    if (P.size >= 2){ const [a, b] = [...P.values()], d = Math.hypot(a[0]-b[0], a[1]-b[1]); if (base) cfg.s = Math.max(1, Math.min(4, cfg.s*d/base)); base = d; const s = $("#bgS"); if (s) s.value = cfg.s; $("#bgSv").textContent = cfg.s.toFixed(1) + "×"; }
    else { if (f.pw > f.cw + 1) cfg.x = Math.max(0, Math.min(1, cfg.x + (e.clientX - old[0])/(f.pw - f.cw))); if (f.ph > f.ch + 1) cfg.y = Math.max(0, Math.min(1, cfg.y + (e.clientY - old[1])/(f.ph - f.ch))); }
    layoutBgPrev();
  });
  const up = e => { P.delete(e.pointerId); base = null; };
  prev.addEventListener("pointerup", up); prev.addEventListener("pointercancel", up);
}
function bgFile(file){
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    // keep at most 1600 px on the long side so a few photos fit comfortably on the phone
    const sc = Math.min(1, 1600/Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth*sc), h = Math.round(img.naturalHeight*sc);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
    cv.toBlob(blob => { if (!blob || !bgEdit) return; if (bgEdit.blob && bgEdit.url) URL.revokeObjectURL(bgEdit.url);
      Object.assign(bgEdit, {blob, url:URL.createObjectURL(blob), w, h}); bgEdit.cfg = Object.assign(BG_DEF(bgEdit.page), {clarity:bgEdit.cfg.clarity, opacity:bgEdit.cfg.opacity}); drawBgEditor(); }, "image/jpeg", .85);
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("这张图片打不开,换一张试试"); };
  img.src = url;
}
async function bgSave(){
  const E = bgEdit; if (!E) return;
  try { if (E.blob){ await bgPut(E.page, E.blob); bgUse(E.page, E.blob, E.w, E.h); E.blob = null; } }
  catch(e){ toast("保存失败:浏览器不允许存储图片(可能是无痕模式)"); return; }
  state.profile.bg = Object.assign({}, state.profile.bg, {[E.page]: Object.assign({}, E.cfg, {w:E.w, h:E.h})}); save("profile");
  toast("背景已保存"); const page = E.page; closeSheet();
  if (page === "chat") openSheet("chat"); else if (page !== "player" && page !== tab) go(page); else applyBg();
}
async function bgRemove(){
  const E = bgEdit; if (!E) return;
  try { await bgDel(E.page); } catch(e){}
  bgUse(E.page, null); const bg = Object.assign({}, state.profile.bg); delete bg[E.page]; state.profile.bg = bg; save("profile");
  if (E.blob && E.url) URL.revokeObjectURL(E.url);
  bgEdit = null; bgEditor(E.page); applyBg(); toast("已移除背景");
}

/* ================================================================
   Player: one course or a whole combo; 二楞 or 发财 keeps you company
   ================================================================ */
let PL = null, timer = null, pendingStart = null;
function startCombo(ids){
  if (state.profile.preCheck && hasGlucose()){ pendingStart = ids; openSheet("precheck"); return; }
  play(ids);
}
function play(ids){
  ids = [].concat(ids).filter(id => courseById(id));
  if (!ids.length) return;
  closeSheet();
  let seq = [];
  ids.forEach((id, k) => {
    const c = courseById(id), s = seqOf(c).map(x => Object.assign({}, x, {ci:k}));
    if (k > 0) seq.push({n:`下一节:${c.name}`, s:10, rest:true, a:s[0].a, ci:k});
    seq = seq.concat(s);
  });
  PL = {ids, seq, i:0, left:seq[0].s, run:true, el:0, per:ids.map(() => 0), start:new Date().toTimeString().slice(0,5), cheer:""};
  const pl = $("#player"); pl.className = "overlay"; pl.hidden = false; document.body.style.overflow = "hidden"; document.documentElement.classList.add("in-player");
  const c0 = courseById(ids[ids.length > 1 ? 1 : 0]);
  if (state.profile.autoMusic && !Music.playing) Music.play(["flex","relax"].includes(c0.cat) ? "forest" : (state.profile.track && state.profile.track !== "forest" ? state.profile.track : "pink"));
  Music.beep(); drawPlayer();
  clearInterval(timer); timer = setInterval(tick, 1000);
}
const PLAYER_CHEERS = {
  dog:["姐姐做得很好,保持这个节奏!","呼吸别憋着,吸气、呼气~","快到了,我在旁边陪着你!","动作慢一点也没关系,做标准就好。","姐姐好厉害,尾巴已经摇成螺旋桨了!","再坚持一下,做完我们去晒太阳。","你出汗的样子闪闪发光!","我数着呢,一下都没少!","累了就放慢,别停下就行。","这个动作我学不会,姐姐教教我?"],
  cat:["我在看着。","动作标准,勉强给个赞。","坚持住,别停。","停了我会笑你的。","这个伸展,我天生就会。","呼吸。像我睡觉那样慢。"]};
function tick(){
  if (!PL || !PL.run) return;
  PL.left--; PL.el++; PL.per[PL.seq[PL.i].ci]++;
  if (PL.left <= 3 && PL.left > 0) Music.beep(660, 80);
  if (PL.left <= 0) return next();
  if (PL.el % 25 === 0){ PL.cheer = pick(PLAYER_CHEERS[buddyOf()]); const cb = $("#player .buddy"); if (cb){ cb.querySelector(".line").textContent = PL.cheer; cb.classList.remove("pop"); void cb.offsetWidth; cb.classList.add("pop"); } }
  drawPlayer(true);
}
// 二楞 keeps you company; 发财 only leads its own cat-yoga class
const buddyOf = () => courseById(PL.ids[PL.seq[PL.i].ci]).id === "catyoga12" ? "cat" : "dog";
function next(){ PL.i++; if (PL.i >= PL.seq.length) return finish(true); PL.left = PL.seq[PL.i].s; PL.cheer = ""; Music.beep(PL.seq[PL.i].rest ? 520 : 990, 220); drawPlayer(); }
function finish(complete){
  clearInterval(timer);
  const d = today(), kg = latestW() || 58, logged = [];
  PL.ids.forEach((id, k) => { const sec = PL.per[k]; if (sec >= 60){ const c = courseById(id), min = Math.round(sec/60), kcal = kcalOf(c.met, min, kg); logged.push({c:c.id, min, kcal, at:PL.start}); } });
  const totalMin = logged.reduce((a,x)=>a+x.min,0), totalKcal = logged.reduce((a,x)=>a+x.kcal,0);
  if (logged.length){ (state.workouts.log[d] = state.workouts.log[d] || []).push(...logged); save("workouts"); }
  PL = null;
  const pl = $("#player"); pl.className = "overlay light"; document.documentElement.classList.remove("in-player");
  const wk = weekStats(), km = totalMin*KM_PER_MIN;
  pl.innerHTML = totalMin >= 1 ? `<div class="player done">
    <div class="duo">${petImg("dog","walk")}${petImg("cat","sit","c")}</div>
    <div class="done-h">做得好,${esc(NAME())}</div>
    <div class="muted" style="text-align:center;font-size:14px;margin-top:-6px">这是本周第 ${wk.days} 天运动</div>
    <div class="done-s"><div><div class="v">${totalMin}</div><span class="muted small">分钟</span></div><div><div class="v">${totalKcal}</div><span class="muted small">千卡</span></div><div><div class="v">${f1(km)}</div><span class="muted small">公里散步路</span></div></div>
    <div class="card say2"><div><span class="ser">二楞</span><span class="muted"> · </span>${esc(petLine("dog","happy"))}</div><div><span class="ser">发财</span><span class="muted"> · </span>${esc(petLine("cat","happy"))}</div></div>
    ${hasGlucose() ? `<button class="btn" data-act="logAfter">${IC.drop}30 分钟后记一次血糖</button>` : ""}
    <button class="btn primary big" data-act="closePlayer">完成</button></div>`
    : `<div class="player done"><div class="duo">${petImg("dog","lie")}</div><div class="done-h">没关系</div><div class="muted" style="text-align:center">不到 1 分钟,这次不记录。二楞随时等你。</div><button class="btn primary big" data-act="closePlayer">好的</button></div>`;
}
function drawPlayer(onlyTime){
  const s = PL.seq[PL.i], nx = PL.seq[PL.i+1], c = courseById(PL.ids[s.ci]);
  if (onlyTime){ const t = $("#player .count"); if (t){ t.textContent = fmtT(PL.left); return; } }
  const works = PL.seq.filter(x=>!x.rest).length, wi = PL.seq.slice(0,PL.i+1).filter(x=>!x.rest).length, tr = Music.track, bud = buddyOf();
  const line = PL.cheer || (s.rest ? (nx ? `接下来:${nx.n},${nx.s} 秒。` : "最后一组了。") : PL.left > 10 ? (nx ? `做完这个,接下来是${nx.n}。` : "最后一个,坚持住。") : `还剩 ${PL.left} 秒,快到了。`);
  $("#player").innerHTML = `${bgLayer()}<div class="player">
    <div class="ptop"><button class="x" data-act="endPlayer" aria-label="结束运动">${ICON.close}</button><span class="muted ellip">${esc(c.name)} · ${s.rest ? "休息" : `动作 ${wi} / ${works}`}${PL.ids.length > 1 ? ` · ${s.ci+1} / ${PL.ids.length} 节` : ""}</span><button class="x" data-act="openBg" data-page="player" aria-label="页面背景">${IC.image}</button></div>
    <div class="prog">${PL.seq.map((x,k)=>`<i class="${k<PL.i?"done":k===PL.i?"cur":""}"></i>`).join("")}</div>
    <div class="wk-stage">${demo(s.a || "stand","",true)}${s.rest && nx ? `<span class="tag">接下来:${esc(nx.n)}</span>` : ""}</div>
    <div class="count">${fmtT(PL.left)}</div>
    <div class="mv">${esc(s.rest ? (s.n.startsWith("下一节") ? s.n : "休息一下,调整呼吸") : s.n)}</div>
    <div class="mvsub">${esc(s.rest ? "看看下一个动作的示范" : (s.t||""))}${!s.rest ? `${s.t ? " · " : ""}<a href="${videoUrl(s.n.replace(/ · .*/,""))}" target="_blank" rel="noopener">真人视频</a>` : ""}</div>
    <div class="ctl"><button data-act="prev" ${PL.i?"":"disabled"} aria-label="上一个">${IC.prev}</button><button class="main" data-act="pause" aria-label="${PL.run?"暂停":"继续"}">${PL.run?IC.pause:IC.play}</button><button data-act="skip" aria-label="跳过">${IC.next}</button></div>
    <div class="buddy">${petFace(bud)}<div><span class="ser">${PET_NAMES[bud]}</span><br><span class="muted line">${esc(line)}</span></div></div>
    <div class="mstrip"><button data-act="musicToggle" class="${Music.playing ? "playing" : ""}">${Music.playing ? `<span class="eq"><i></i><i></i><i></i></span>` : IC.music}${tr && Music.playing ? esc(tr.name) : "音乐已关闭"}</button><button data-act="musicNext">下一首 ›</button></div>
  </div>`;
  mountDemos($("#player")); paintBg($("#player .pbg"), "player");
}
const fmtT = s => s >= 60 ? `${Math.floor(s/60)}:${pad(s%60)}` : String(s);
function renderMini(){
  const mb = $("#minibar");
  if (!Music.playing || !$("#player").hidden){ mb.hidden = true; return; }
  mb.hidden = false;
  mb.innerHTML = `<div class="mini playing"><span class="eq" style="color:var(--forest)"><i></i><i></i><i></i></span><span class="grow">${Music.track.name}</span><button class="iconbtn" data-act="musicToggle" aria-label="暂停音乐">${IC.pause}</button><button class="iconbtn" data-act="musicNext" aria-label="下一首">${IC.next}</button></div>`;
}
function onMusic(){
  renderMini();
  if (PL && !$("#player").hidden) drawPlayer();
  if (tab === "sport" && $("#sheet").hidden && $("#player").hidden){ const y = window.scrollY; render(); window.scrollTo(0, y); }
}

/* ================================================================
   Events
   ================================================================ */
let toastT;
function toast(m){ const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(()=>t.hidden = true, 2600); }
function go(t){ tab = t; clearArm = false; closeSheet(); render(); window.scrollTo(0,0); }
function petTap(kind, el){
  state.pets.pats++; save("pets");
  const b = $("#petBubble"); if (b){ b.innerHTML = `“${esc(petLine(kind))}”<small>${PET_NAMES[kind]}</small>`; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
  el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop");
}
function closePlayer(){ const pl = $("#player"); document.documentElement.classList.remove("in-player"); pl.hidden = true; pl.innerHTML = ""; pl.className = "overlay"; document.body.style.overflow = ""; render(); }
function exportData(){
  const data = JSON.stringify({app:"轻体日志", version:2, exported:new Date().toISOString(), data:Object.fromEntries(DOCS.map(n => [n, state[n]]))}, null, 1);
  const name = `轻体日志备份-${today()}.json`;
  if (window.QingtiAndroid){ const where = QingtiAndroid.save(name, data); toast(where ? `备份已保存到 ${where}` : "备份保存失败"); return; }
  const viaArtifact = window.claude && window.claude.use ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null);
  viaArtifact.then(dl => {
    if (dl) return dl.save({filename:name, data}).then(() => toast("备份已导出")).catch(() => toast("已取消导出"));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], {type:"application/json"})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("备份已导出");
  });
}
function restoreData(file){
  const fr = new FileReader();
  fr.onload = () => { try { const j = JSON.parse(fr.result); if (!j || !j.data) throw 0; const bg = state.profile.bg; DOCS.forEach(n => { if (j.data[n]){ state[n] = Object.assign(clone(DEF[n]), j.data[n]); save(n); } }); state.profile.bg = bg; save("profile"); toast("已从备份恢复"); closeSheet(); render(); } catch(e){ toast("这个文件不是有效的备份"); } };
  fr.readAsText(file);
}
window.appBack = () => {
  if (!$("#sheet").hidden){ closeSheet(); return true; }
  if (!$("#player").hidden){ if (PL) finish(false); else closePlayer(); return true; }
  if (tab !== "home"){ go("home"); return true; }
  return false;
};
function runAct(a){
  if (!a) return;
  if (a === "today") return startCombo(todayCombo().ids);
  if (a.startsWith("go:")) return go(a.slice(3));
  if (a.startsWith("sheet:")) return openSheet(a.slice(6));
  startCombo([a]);
}
document.addEventListener("click", e => {
  if (e.target.classList && e.target.classList.contains("sheet-bg")){ closeSheet(); return; }
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.tab) return go(d.tab);
  if (d.go){ return go(d.go); }
  if (d.pet) return petTap(d.pet, b);
  if (d.range != null){ wRange = +d.range; return render(); }
  if (d.cf){ courseFilter = d.cf; return render(); }
  if (d.rm){ recipeMeal = d.rm; return render(); }
  if (d.rt != null){ recipeTag = d.rt; return render(); }
  if (d.course) return openSheet("course", d.course);
  if (d.play) return startCombo([d.play]);
  if (d.cact) return runAct(d.cact);
  if (d.say != null) return sendChat(d.say);
  if (d.bgpage) return bgEditor(d.bgpage);
  if (d.gday){ selDay = d.gday; const y = window.scrollY; render(); window.scrollTo(0,y); return; }
  if (d.gstep){ const ds_ = gDates(); let i = ds_.indexOf(selDay) + (+d.gstep); if (i < 0 || i >= ds_.length){ toast(+d.gstep < 0 ? "前面没有数据了" : "已经是最新一天"); return; } selDay = ds_[i]; const y = window.scrollY; render(); window.scrollTo(0,y); return; }
  if (d.track){ state.profile.track = d.track; save("profile"); if (Music.playing && Music.track && Music.track.id === d.track) Music.stop(); else Music.play(d.track); return; }
  if (d.delw){ delete state.weights.entries[d.delw]; save("weights"); toast("已删除 " + d.delw); return render(); }
  if (d.dellog){ const [dd,k] = d.dellog.split(":"); state.workouts.log[dd].splice(+k,1); if (!state.workouts.log[dd].length) delete state.workouts.log[dd]; save("workouts"); return render(); }
  if (d.eat){ const dd = today(), m = state.meals.days[dd] = state.meals.days[dd] || {}; m[d.eat] = !m[d.eat]; save("meals"); return render(); }
  if (d.swap){ const [i,k] = d.swap.split(":").map(Number), [m,,sh] = MEALS[k], wk = state.meals.week; wk[i][k] = pickRecipe(m, targets().kcal*sh, [wk[i][k], (wk[i-1]||[])[k]].filter(Boolean)); save("meals"); return render(); }
  if (d.psave) return savePending(d.psave);
  if (d.pdrop){ const p = pending.find(x => x.id === d.pdrop); if (p && p.url) URL.revokeObjectURL(p.url); pending = pending.filter(x => x.id !== d.pdrop); const el = document.getElementById("rv-" + d.pdrop); if (el) el.remove(); if (!pending.length) closeSheet(); return; }
  if (d.manual) return manualEntry(d.manual);
  if (d.tipk != null){ openSheet("tips"); const t = document.getElementById("tip-" + d.tipk); if (t) t.scrollIntoView({block:"start"}); return; }
  switch (d.act){
    case "startToday": startCombo(todayCombo().ids); break;
    case "import": openSheet("import", d.ctx); break;
    case "parsePaste": { const v = ($("#pasteBox") || {}).value || ""; if (!v.trim()){ toast("先粘贴文字"); break; } onPaste(v); break; }
    case "openTips": openSheet("tips"); break;
    case "openGTips": openSheet("gtips"); break;
    case "openHypo": openSheet("hypo"); break;
    case "openMe": openSheet("me"); break;
    case "openChat": openSheet("chat"); break;
    case "openBg": if (PL && PL.run){ PL.run = false; drawPlayer(); } openSheet("bg", d.page); break;
    case "bgSave": bgSave(); break;
    case "bgRemove": bgRemove(); break;
    case "planSetup": openSheet("planSetup"); break;
    case "planWhy": openSheet("planWhy"); break;
    case "applyRecomp": openSheet("planSetup"); break;
    case "closeSheet": { const wasBg = sheetKind === "bg" && bgEdit && bgEdit.page === "chat"; closeSheet(); if (wasBg) openSheet("chat"); break; }
    case "genWeek": genWeek(); toast("本周菜单已生成"); if (tab !== "diet") go("diet"); else render(); break;
    case "loadSample": loadSample(); closeSheet(); toast("已载入示例数据"); render(); break;
    case "clearSample": clearSample(); closeSheet(); toast("示例数据已清除"); render(); break;
    case "exportData": exportData(); break;
    case "clearAll":
      if (!clearArm){ clearArm = true; b.textContent = "确定清空?再点一次"; setTimeout(() => { clearArm = false; }, 5000); break; }
      clearArm = false; DOCS.forEach(n => { if (n !== "profile"){ state[n] = clone(DEF[n]); save(n); } }); toast("已清空全部记录"); closeSheet(); render(); break;
    case "preCheck": {
      const v = parseFloat(($("#preVal")||{}).value), out = $("#preOut"), [lo] = gRange();
      if (!(v > 1 && v < 35)){ toast("请输入血糖值"); break; }
      addGlucoseLog(today(), new Date().toTimeString().slice(0,5), v, "运动前");
      out.innerHTML = v < lo ? `<div class="tipc bad"><h3>先别运动</h3><p>血糖 ${v} 低于 ${lo}。先吃 15 克糖(半杯果汁或 3–4 块方糖),15 分钟后再测,恢复了再开始。</p><div class="row"><button class="btn sm" data-act="openHypo">低血糖须知</button></div></div>`
        : v < 5.0 ? `<div class="tipc warn"><h3>先吃一点再开始</h3><p>血糖 ${v} 有点偏低。先吃半根香蕉或两片饼干,运动中不舒服马上停。</p><div class="row"><button class="btn primary sm" data-act="preGo">吃过了,开始运动</button></div></div>`
        : v > 13.9 ? `<div class="tipc warn"><h3>今天选低强度</h3><p>血糖 ${v} 偏高,今天散散步或拉伸就好,多喝水。持续很高请咨询医生。</p><div class="row"><button class="btn primary sm" data-act="preGo">开始</button></div></div>`
        : `<div class="tipc good"><h3>状态不错,出发</h3><p>血糖 ${v},适合运动。</p><div class="row"><button class="btn primary sm" data-act="preGo">开始运动</button></div></div>`;
      break; }
    case "preSkip": case "preGo": { const ids = pendingStart; pendingStart = null; closeSheet(); if (ids) play(ids); break; }
    case "logAfter": closePlayer(); manualEntry("glucoseLog"); { const p = pending[pending.length-1]; p.data.tag = "运动后"; updateItem(p); } break;
    case "pause": PL.run = !PL.run; drawPlayer(); break;
    case "skip": next(); break;
    case "prev": PL.i = Math.max(0, PL.i-1); PL.left = PL.seq[PL.i].s; drawPlayer(); break;
    case "endPlayer": finish(false); break;
    case "closePlayer": closePlayer(); break;
    case "musicToggle": Music.toggle(); break;
    case "musicNext": Music.next(); state.profile.track = Music.track.id; save("profile"); break;
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "shot"){ if (el.files && el.files.length) onFiles(el.files); el.value = ""; return; }
  if (el.id === "bgFile"){ if (el.files && el.files[0]) bgFile(el.files[0]); el.value = ""; return; }
  if (el.id === "restoreFile"){ if (el.files && el.files[0]) restoreData(el.files[0]); el.value = ""; return; }
  if (el.dataset.ptype){ const p = pending.find(x => x.id === el.dataset.ptype); if (p){ Object.assign(p.data, readItem(p)); p.type = el.value; updateItem(p); } return; }
  if (el.dataset.addcourse && el.value !== ""){ const i = el.value; (state.plan.week[i] = state.plan.week[i] || []).push(el.dataset.addcourse); if (!state.plan.meta) state.plan.meta = {at:today(), reasons:["手动添加的课程"], target:state.profile.mins, level:state.profile.level, rest:"catyoga12"}; save("plan"); toast(`已加入周${WD[i]}`); el.value = ""; render(); }
  else if (el.id === "vol"){ state.profile.vol = +el.value; save("profile"); }
  else if (el.id === "autoMusic"){ state.profile.autoMusic = el.checked; save("profile"); }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.id === "vol") Music.setVol(+el.value);
  if (bgEdit && (el.id === "bgS" || el.id === "bgC" || el.id === "bgO")){
    const c = bgEdit.cfg;
    if (el.id === "bgS"){ c.s = +el.value; $("#bgSv").textContent = c.s.toFixed(1) + "×"; }
    if (el.id === "bgC"){ c.clarity = +el.value; $("#bgCv").textContent = c.clarity; }
    if (el.id === "bgO"){ c.opacity = +el.value; $("#bgOv").textContent = c.opacity + "%"; }
    layoutBgPrev();
  }
});
document.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest("#bgPrev")) bgPointers(); }, true);
document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "chatForm"){ const v = $("#chatIn").value; $("#chatIn").value = ""; sendChat(v); return; }
  if (f.id === "wform"){
    const d = $("#wdate").value, v = parseFloat($("#wval").value);
    if (!d || !(v >= 25 && v <= 300)){ toast("请输入 25–300 之间的体重"); return; }
    state.weights.entries[d] = Math.round(v*10)/10; save("weights");
    toast(`已记录 ${md(d)} · ${f1(v)} kg`); render();
  } else if (f.id === "gform"){
    const v = parseFloat($("#gval").value), tm = $("#gtime").value || "12:00", tag = $("#gtag").value;
    if (!(v > 1 && v < 35)){ toast("请输入 1–35 之间的血糖值"); return; }
    addGlucoseLog(today(), tm, v, tag); selDay = today(); render();
    if (v < gRange()[0]) openSheet("hypo"); else toast(`已记录 ${v} mmol/L`);
  } else if (f.id === "mform"){
    const d = $("#mdate").value || today(), v = $("#mcourse").value, min = parseInt($("#mmin").value), at = $("#mtime").value || null, kg = latestW() || 58;
    if (!(min > 0)){ toast("请输入运动分钟数"); return; }
    let entry;
    if (v.startsWith("other:")){ const met = +v.split(":")[1]; entry = {c:null, name: met > 5 ? "高强度运动" : "中等强度运动", min, kcal:kcalOf(met,min,kg), at}; }
    else { const c = courseById(v); entry = {c:c.id, min, kcal:kcalOf(c.met,min,kg), at}; }
    (state.workouts.log[d] = state.workouts.log[d] || []).push(entry); save("workouts"); toast("已记录"); render();
  } else if (f.id === "pform"){
    const p = state.profile;
    p.name = $("#pname").value.trim().slice(0,16) || "Amber"; p.sex = $("#psex").value; p.age = +$("#page").value || p.age; p.height = +$("#pheight").value || p.height;
    const gw = parseFloat($("#pgoalw").value); p.goalWeight = gw > 0 ? gw : null;
    p.goal = $("#pgoal").value; p.activity = +$("#pact").value; p.set = true;
    const lo = parseFloat($("#pglo").value), hi = parseFloat($("#pghi").value); if (lo > 2 && hi > lo) { p.gLo = lo; p.gHi = hi; }
    p.preCheck = $("#pprecheck").checked;
    save("profile"); toast("已保存"); closeSheet(); render();
  } else if (f.id === "planForm"){
    const fd = new FormData(f), p = state.profile;
    p.level = fd.get("level") || p.level; p.mins = +(fd.get("mins") || p.mins); p.days = +(fd.get("days") || p.days); p.likes = fd.getAll("likes"); p.lowImpact = fd.get("lowImpact") === "on";
    save("profile"); generatePlan(); closeSheet(); toast("计划已生成,今天的运动已经准备好了"); go("sport");
  }
});
document.addEventListener("pointerover", e => {
  const el = e.target.closest("[data-tip]"), tip = $("#tip");
  if (!el){ if (!e.target.closest("#wchart,#gchart")) tip.hidden = true; return; }
  const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.hidden = false;
  tip.style.left = (r.left + r.width/2) + "px"; tip.style.top = r.top + "px";
});
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { const wc = $("#wchart"); if (wc) weightChart(wc, wRange); const gc = $("#gchart"); if (gc) glucoseChart(gc, gc.dataset.date); applyBg(); if (bgEdit) layoutBgPrev(); }, 150); });
document.addEventListener("visibilitychange", () => { if (document.hidden && PL && PL.run){ PL.run = false; drawPlayer(); } });
if (!storageOK) setTimeout(() => toast("当前浏览器不能保存数据(可能是无痕模式),关闭页面后记录会丢失"), 800);
Music.setVol(state.profile.vol);
render(); loadBgs();
if ("serviceWorker" in navigator && location.protocol === "https:" && !/claude|anthropic|androidplatform/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});
