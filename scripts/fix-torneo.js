const fs = require('fs');
const path = 'index.html';
let s = fs.readFileSync(path, 'utf8');

function rep(oldText, newText, label) {
  if (!s.includes(oldText)) throw new Error(`No se encontró bloque: ${label}`);
  s = s.replace(oldText, newText);
}

// Estado adicional para desempates manuales en eliminación directa.
rep(
"let tfFairPlay = {}; // Guardará { matchKey: { a: 1-5, b: 1-5 } }\nlet tfShowStandings = false;",
"let tfFairPlay = {}; // Guardará { matchKey: { a: 1-5, b: 1-5 } }\nlet tfElimAdvance = {}; // Desempates manuales: { matchKey: 'a' | 'b' }\nlet tfShowStandings = false;",
'estado eliminación'
);

rep(
"      fairPlay: tfFairPlay,\n      showStandings:tfShowStandings,",
"      fairPlay: tfFairPlay,\n      elimAdvance: tfElimAdvance,\n      showStandings:tfShowStandings,",
'persistencia eliminación'
);

rep(
"    tfFairPlay = s.fairPlay || {};\n    tfShowStandings = s.showStandings || false;",
"    tfFairPlay = s.fairPlay || {};\n    tfElimAdvance = s.elimAdvance || {};\n    tfShowStandings = s.showStandings || false;",
'carga eliminación'
);

rep(
"  tfScores = {}; tfFairPlay = {}; tfShowStandings = false; tfShowReport = false; tfTorneoName = '';",
"  tfScores = {}; tfFairPlay = {}; tfElimAdvance = {}; tfShowStandings = false; tfShowReport = false; tfTorneoName = '';",
'reset eliminación'
);

// Escape HTML común para todo texto ingresado por el usuario.
rep(
"function tfShowValidationMsg(msg) {\n  const el = document.getElementById('tf-validation-msg');\n  el.textContent = msg; el.style.display = 'block';\n  setTimeout(() => el.style.display = 'none', 3500);\n}\n",
"function tfShowValidationMsg(msg) {\n  const el = document.getElementById('tf-validation-msg');\n  el.textContent = msg; el.style.display = 'block';\n  setTimeout(() => el.style.display = 'none', 3500);\n}\n\nfunction tfEsc(v) {\n  return String(v ?? '').replace(/[&<>\\\"']/g, ch => ({\n    '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', \"'\":'&#39;'\n  })[ch]);\n}\n",
'escape html'
);

// Al cambiar resultados de grupos, invalida la final previa. En eliminación, recalcula avance.
rep(
"function tfSetScore(key,side,val) {\n  if(!tfScores[key]) tfScores[key]={a:'',b:''};\n  tfScores[key][side]=val;\n  if(tfFixture&&tfFixture.type==='eliminacion') tfUpdateElimWinners();\n  tfScheduleSave();\n  if(tfShowStandings||tfShowReport) tfRenderFixture();\n}",
"function tfSetScore(key,side,val) {\n  if(!tfScores[key]) tfScores[key]={a:'',b:''};\n  tfScores[key][side]=val;\n  if(key.startsWith('g1_') || key.startsWith('g2_')) {\n    delete tfScores['final_0'];\n    delete tfFairPlay['final_0'];\n  }\n  if(key.startsWith('elim_')) {\n    const sc = tfScores[key];\n    if(sc.a!=='' && sc.b!=='' && parseInt(sc.a)!==parseInt(sc.b)) delete tfElimAdvance[key];\n  }\n  if(tfFixture&&tfFixture.type==='eliminacion') tfUpdateElimWinners();\n  tfScheduleSave();\n  if(tfShowStandings||tfShowReport) tfRenderFixture();\n}",
'tfSetScore'
);

// Fair Play: sin valoración por defecto. Solo cuenta cuando el docente toca una estrella.
rep(
"function tfSetFairPlay(key, side, stars) {\n  if(!tfFairPlay[key]) tfFairPlay[key] = {a: 5, b: 5};\n  tfFairPlay[key][side] = stars;\n  tfScheduleSave();\n  tfRenderFixture();\n}",
"function tfSetFairPlay(key, side, stars) {\n  if(!tfFairPlay[key]) tfFairPlay[key] = {a: null, b: null};\n  tfFairPlay[key][side] = stars;\n  tfScheduleSave();\n  tfRenderFixture();\n}\n\nfunction tfSetElimWinner(key, side) {\n  tfElimAdvance[key] = side;\n  tfUpdateElimWinners();\n  tfScheduleSave();\n}",
'tfSetFairPlay'
);

// Match card segura, BYE automático, Fair Play sin evaluar y desempate manual.
const oldMatch = `function tfMatchHtml(a, b, key, label) {\n  const sc = tfScores[key] || {a:'', b:''};\n  const fp = tfFairPlay[key] || {a: 5, b: 5};\n  \n  // Render de estrellas para Fair Play (Equipo A y B)\n  const starsA = [1,2,3,4,5].map(num => \`\n    <span class="tf-star \${num <= fp.a ? 'active' : ''}" onclick="tfSetFairPlay('\${key}','a', \${num})">★</span>\n  \`).join('');\n  \n  const starsB = [1,2,3,4,5].map(num => \`\n    <span class="tf-star \${num <= fp.b ? 'active' : ''}" onclick="tfSetFairPlay('\${key}','b', \${num})">★</span>\n  \`).join('');\n\n  return \`\n  <div class="tf-match-card-wrapper">\n    <div class="tf-match-card">\n      <span class="tf-match-num">\${label}</span>\n      <span class="tf-team-a">\${a}</span>\n      <span class="tf-vs">vs</span>\n      <span class="tf-team-b">\${b}</span>\n      <div class="tf-score-wrap">\n        <input type="number" class="tf-score" min="0" max="99" value="\${sc.a}" placeholder="-" oninput="tfHandleScoreInput(this,'\${key}','a')">\n        <span class="tf-score-sep">:</span>\n        <input type="number" class="tf-score" min="0" max="99" value="\${sc.b}" placeholder="-" oninput="tfHandleScoreInput(this,'\${key}','b')">\n      </div>\n    </div>\n    <div class="tf-fp-eval">\n      <div class="tf-fp-label"><span>🤝 Fair Play \${a}:</span> <div class="tf-stars-container">\${starsA}</div></div>\n      <div class="tf-fp-label"><span>🤝 Fair Play \${b}:</span> <div class="tf-stars-container">\${starsB}</div></div>\n    </div>\n  </div>\`;\n}`;

const newMatch = `function tfMatchHtml(a, b, key, label) {\n  const sc = tfScores[key] || {a:'', b:''};\n  const fp = tfFairPlay[key] || {a: null, b: null};\n  const ea = tfEsc(a), eb = tfEsc(b), el = tfEsc(label);\n  const isBye = a === 'BYE' || b === 'BYE';\n  const isPending = a === 'Por definir' || b === 'Por definir';\n\n  if(isBye) {\n    const winner = a === 'BYE' ? b : a;\n    return \`<div class="tf-match-card-wrapper"><div class="tf-match-card">\n      <span class="tf-match-num">\${el}</span><span class="tf-team-a">\${tfEsc(winner)}</span>\n      <span class="tf-vs">—</span><span class="tf-team-b">Pase libre</span>\n    </div></div>\`;\n  }\n\n  const starsA = [1,2,3,4,5].map(num => \`<span class="tf-star \${Number.isInteger(fp.a) && num <= fp.a ? 'active' : ''}" onclick="tfSetFairPlay('\${key}','a',\${num})">★</span>\`).join('');\n  const starsB = [1,2,3,4,5].map(num => \`<span class="tf-star \${Number.isInteger(fp.b) && num <= fp.b ? 'active' : ''}" onclick="tfSetFairPlay('\${key}','b',\${num})">★</span>\`).join('');\n  const tied = key.startsWith('elim_') && sc.a!=='' && sc.b!=='' && parseInt(sc.a)===parseInt(sc.b);\n  const tieControls = tied ? \`<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:12px;">\n    <span style="color:var(--tf-amber-text);font-weight:700;">Empate: elegí quién clasifica tras el desempate:</span>\n    <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">\n      <button class="tf-sec-btn" onclick="tfSetElimWinner('\${key}','a')">Clasifica \${ea}</button>\n      <button class="tf-sec-btn" onclick="tfSetElimWinner('\${key}','b')">Clasifica \${eb}</button>\n    </div></div>\` : '';\n\n  return \`\n  <div class="tf-match-card-wrapper">\n    <div class="tf-match-card">\n      <span class="tf-match-num">\${el}</span>\n      <span class="tf-team-a">\${ea}</span>\n      <span class="tf-vs">vs</span>\n      <span class="tf-team-b">\${eb}</span>\n      <div class="tf-score-wrap">\n        <input type="number" class="tf-score" min="0" max="99" value="\${tfEsc(sc.a)}" placeholder="-" \${isPending?'disabled':''} oninput="tfHandleScoreInput(this,'\${key}','a')">\n        <span class="tf-score-sep">:</span>\n        <input type="number" class="tf-score" min="0" max="99" value="\${tfEsc(sc.b)}" placeholder="-" \${isPending?'disabled':''} oninput="tfHandleScoreInput(this,'\${key}','b')">\n      </div>\n    </div>\n    \${!isPending ? \`<div class="tf-fp-eval">\n      <div class="tf-fp-label"><span>🤝 Fair Play \${ea}: \${Number.isInteger(fp.a)?'':'Sin evaluar'}</span> <div class="tf-stars-container">\${starsA}</div></div>\n      <div class="tf-fp-label"><span>🤝 Fair Play \${eb}: \${Number.isInteger(fp.b)?'':'Sin evaluar'}</span> <div class="tf-stars-container">\${starsB}</div></div>\n    </div>\` : ''}\n    \${tieControls}\n  </div>\`;\n}`;
rep(oldMatch, newMatch, 'tfMatchHtml');

// Fair Play solo se suma si fue evaluado.
rep(
"    const fp = tfFairPlay[key] || { a: 5, b: 5 };",
"    const fp = tfFairPlay[key] || { a: null, b: null };",
'fp default standings'
);
rep(
"    // Suma de Fair Play\n    pts[m.a].fpScoreSum += (fp.a || 5);\n    pts[m.a].fpMatchesCount++;\n    pts[m.b].fpScoreSum += (fp.b || 5);\n    pts[m.b].fpMatchesCount++;",
"    // Suma de Fair Play solo cuando existe valoración explícita.\n    if(Number.isInteger(fp.a)) { pts[m.a].fpScoreSum += fp.a; pts[m.a].fpMatchesCount++; }\n    if(Number.isInteger(fp.b)) { pts[m.b].fpScoreSum += fp.b; pts[m.b].fpMatchesCount++; }",
'fp contabilización'
);
rep(
"    const avgFP = pts[t].fpMatchesCount > 0 ? (pts[t].fpScoreSum / pts[t].fpMatchesCount).toFixed(1) : \"5.0\";",
"    const avgFP = pts[t].fpMatchesCount > 0 ? (pts[t].fpScoreSum / pts[t].fpMatchesCount).toFixed(1) : null;",
'fp promedio'
);
rep(
"      <td class=\"tf-td-c\" style=\"color: #ffb800\">★ ${p.fpAvg}</td>",
"      <td class=\"tf-td-c\" style=\"color: #ffb800\">${p.fpAvg ? '★ '+p.fpAvg : 'Sin evaluar'}</td>",
'fp tabla deportiva'
);
rep(
"  const sorted = tfCalcStandings(ts, rounds, prefix)\n                 .sort((a,b) => parseFloat(b.fpAvg) - parseFloat(a.fpAvg));",
"  const sorted = tfCalcStandings(ts, rounds, prefix)\n                 .sort((a,b) => (b.fpAvg===null?-1:parseFloat(b.fpAvg)) - (a.fpAvg===null?-1:parseFloat(a.fpAvg)));",
'orden fair play'
);
rep(
"        ★ ${p.fpAvg} / 5.0",
"        ${p.fpAvg ? '★ '+p.fpAvg+' / 5.0' : 'Sin evaluar'}",
'fp tabla específica'
);

// Generador de eliminación con BYEs distribuidos sin cruces BYE-vs-BYE.
const oldGenElim = `function tfGenerateElim(ts) {\n  let b=tfShuffle(ts); const rounds=[];\n  while(b.length>1){ const r=[]; for(let i=0;i<b.length;i+=2) if(i+1<b.length) r.push({a:b[i],b:b[i+1]}); rounds.push(r); b=r.map(()=>'?'); }\n  return rounds;\n}`;
const newGenElim = `function tfGenerateElim(ts) {\n  const teams = tfShuffle(ts);\n  const size = 2 ** Math.ceil(Math.log2(teams.length));\n  const byes = size - teams.length;\n  const first = [];\n  let idx = 0;\n  for(let i=0;i<byes;i++) first.push({a:teams[idx++], b:'BYE'});\n  while(idx < teams.length) first.push({a:teams[idx++], b:teams[idx++]});\n  const rounds=[first];\n  let count = first.length;\n  while(count > 1) {\n    count = count / 2;\n    rounds.push(Array.from({length:count}, () => ({a:'Por definir', b:'Por definir'})));\n  }\n  return rounds;\n}`;
rep(oldGenElim, newGenElim, 'tfGenerateElim');

// Al generar nuevo torneo también limpia desempates manuales.
rep(
"  tfScores={}; tfFairPlay={}; tfShowStandings=false; tfShowReport=false;",
"  tfScores={}; tfFairPlay={}; tfElimAdvance={}; tfShowStandings=false; tfShowReport=false;",
'limpieza al generar'
);

// Evita final de liguilla antes de completar todos los partidos.
rep(
"function tfGetLider(ts, rounds, prefix) {",
"function tfAllScoresComplete(rounds, prefix) {\n  return rounds.every((round,r) => round.every((m,i) => {\n    const sc = tfScores[`${prefix}${r}_${i}`];\n    return sc && sc.a !== '' && sc.b !== '';\n  }));\n}\n\nfunction tfGetLider(ts, rounds, prefix) {",
'helper completar grupos'
);

const oldFinalBlock = `  const lA = tfGetLider(d.g1teams, d.group1, 'g1');\n  const lB = tfGetLider(d.g2teams, d.group2, 'g2');\n  h += \`<div style="margin-top:1.5rem;"></div><span class="tf-phase-badge final">Gran Final</span>\`;\n  h += tfMatchHtml(lA, lB, 'final_0', 'Final');\n  const fsc = tfScores['final_0'];\n  if(fsc && fsc.a!=='' && fsc.b!=='') {\n    const ga = parseInt(fsc.a), gb = parseInt(fsc.b);\n    if(!isNaN(ga) && !isNaN(gb) && ga!==gb) {\n      h += \`<div class="tf-winner-banner"><i class="ti ti-trophy"></i> Campeón Deportivo: \${ga>gb?lA:lB}</div>\`;\n    }\n  }`;
const newFinalBlock = `  const gruposCompletos = tfAllScoresComplete(d.group1,'g1') && tfAllScoresComplete(d.group2,'g2');\n  h += \`<div style="margin-top:1.5rem;"></div><span class="tf-phase-badge final">Gran Final</span>\`;\n  if(gruposCompletos) {\n    const lA = tfGetLider(d.g1teams, d.group1, 'g1');\n    const lB = tfGetLider(d.g2teams, d.group2, 'g2');\n    h += tfMatchHtml(lA, lB, 'final_0', 'Final');\n    const fsc = tfScores['final_0'];\n    if(fsc && fsc.a!=='' && fsc.b!=='') {\n      const ga = parseInt(fsc.a), gb = parseInt(fsc.b);\n      if(!isNaN(ga) && !isNaN(gb) && ga!==gb) {\n        h += \`<div class="tf-winner-banner"><i class="ti ti-trophy"></i> Campeón Deportivo: \${tfEsc(ga>gb?lA:lB)}</div>\`;\n      }\n    }\n  } else {\n    h += \`<div class="tf-info-box">Completá todos los resultados de los grupos para habilitar la final.</div>\`;\n  }`;
rep(oldFinalBlock, newFinalBlock, 'bloque final liguilla');

// Recalcula cuadro eliminatorio sin premiar empates; usa selección manual si la hubo.
const oldUpdate = `function tfUpdateElimWinners() {\n  tfFixture.rounds.forEach((round, r) => {\n    if(r===0) return;\n    round.forEach((m, i) => {\n      const pr = tfFixture.rounds[r-1];\n      const pA = pr[i*2], pB = pr[i*2+1];\n      if(pA) {\n        const sc = tfScores[\`elim_\${r-1}_\${i*2}\`];\n        if(sc && sc.a!=='' && sc.b!=='') {\n          const ga = parseInt(sc.a), gb = parseInt(sc.b);\n          if(!isNaN(ga) && !isNaN(gb)) m.a = ga>=gb ? pA.a : pA.b;\n        }\n      }\n      if(pB) {\n        const sc = tfScores[\`elim_\${r-1}_\${i*2+1}\`];\n        if(sc && sc.a!=='' && sc.b!=='') {\n          const ga = parseInt(sc.a), gb = parseInt(sc.b);\n          if(!isNaN(ga) && !isNaN(gb)) m.b = ga>=gb ? pB.a : pB.b;\n        }\n      }\n    });\n  });\n  tfRenderFixture();\n}`;
const newUpdate = `function tfElimWinner(match, key) {\n  if(match.a === 'BYE') return match.b;\n  if(match.b === 'BYE') return match.a;\n  if(match.a === 'Por definir' || match.b === 'Por definir') return null;\n  const sc = tfScores[key];\n  if(!sc || sc.a==='' || sc.b==='') return null;\n  const ga=parseInt(sc.a), gb=parseInt(sc.b);\n  if(isNaN(ga)||isNaN(gb)) return null;\n  if(ga>gb) return match.a;\n  if(gb>ga) return match.b;\n  return tfElimAdvance[key] === 'a' ? match.a : tfElimAdvance[key] === 'b' ? match.b : null;\n}\n\nfunction tfUpdateElimWinners() {\n  for(let r=1; r<tfFixture.rounds.length; r++) {\n    const prev=tfFixture.rounds[r-1];\n    tfFixture.rounds[r].forEach((m,i) => {\n      const pA=prev[i*2], pB=prev[i*2+1];\n      m.a = pA ? (tfElimWinner(pA, `elim_${r-1}_${i*2}`) || 'Por definir') : 'Por definir';\n      m.b = pB ? (tfElimWinner(pB, `elim_${r-1}_${i*2+1}`) || 'Por definir') : 'Por definir';\n    });\n  }\n  tfRenderFixture();\n}`;
rep(oldUpdate, newUpdate, 'tfUpdateElimWinners');

// Cero es resultado válido en informes.
s = s.replaceAll("${sc.a||'-'}", "${sc.a!==''&&sc.a!==undefined?sc.a:'-'}");
s = s.replaceAll("${sc.b||'-'}", "${sc.b!==''&&sc.b!==undefined?sc.b:'-'}");
s = s.replaceAll("${fsc.a||'-'}", "${fsc.a!==''&&fsc.a!==undefined?fsc.a:'-'}");
s = s.replaceAll("${fsc.b||'-'}", "${fsc.b!==''&&fsc.b!==undefined?fsc.b:'-'}");

// Fair Play en informes: no inventa 5 estrellas.
s = s.replaceAll("const fp = tfFairPlay[`r${r}_${i}`] || {a:5, b:5};", "const fp = tfFairPlay[`r${r}_${i}`] || {a:null, b:null};");
s = s.replaceAll("${m.a} (★ ${fp.a}/5) | ${m.b} (★ ${fp.b}/5)", "${m.a} (${Number.isInteger(fp.a)?'★ '+fp.a+'/5':'Sin evaluar'}) | ${m.b} (${Number.isInteger(fp.b)?'★ '+fp.b+'/5':'Sin evaluar'})");
s = s.replaceAll(".sort((a,b)=>parseFloat(b.fpAvg)-parseFloat(a.fpAvg))", ".sort((a,b)=>(b.fpAvg===null?-1:parseFloat(b.fpAvg))-(a.fpAvg===null?-1:parseFloat(a.fpAvg)))");
s = s.replaceAll("— Promedio Conducta: ★ ${p.fpAvg} / 5.0", "— ${p.fpAvg ? 'Promedio Conducta: ★ '+p.fpAvg+' / 5.0' : 'Sin evaluar'}");

// Escapa informe antes de insertarlo como HTML.
rep(
"    h += `<div class=\"tf-report-box\" id=\"tf-report-text\">${tfBuildReport()}</div>`;",
"    h += `<div class=\"tf-report-box\" id=\"tf-report-text\">${tfEsc(tfBuildReport())}</div>`;",
'informe seguro'
);

// Escapa nombres/títulos en renderizado principal.
s = s.replaceAll("${tfTorneoName||'Campeonato Escolar'}", "${tfEsc(tfTorneoName||'Campeonato Escolar')}");
s = s.replaceAll("${tfTorneoName||'Campeonato'}", "${tfEsc(tfTorneoName||'Campeonato')}");
s = s.replaceAll("${d.g1teams.join(', ')}", "${d.g1teams.map(tfEsc).join(', ')}");
s = s.replaceAll("${d.g2teams.join(', ')}", "${d.g2teams.map(tfEsc).join(', ')}");
s = s.replaceAll("<td><strong>${p.name}</strong></td>", "<td><strong>${tfEsc(p.name)}</strong></td>");

// Escape completo de value en inputs de equipos.
rep(
"value=\"${t.replace(/\"/g,'&quot;')}\"",
"value=\"${tfEsc(t)}\"",
'valor input equipo'
);

fs.writeFileSync(path, s);
console.log('Torneo Fácil: correcciones aplicadas.');
