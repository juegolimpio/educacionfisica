// Functional audit tests for Torneo Fácil
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html','utf8');

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`No se encontró ${name}`);
  let brace = html.indexOf('{', start), depth = 0, i = brace;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error(`Función incompleta: ${name}`);
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function run(code, ctx={}) {
  const sandbox = { console, Math, Date, JSON, Number, parseInt, isNaN, setTimeout:()=>0, clearTimeout:()=>{}, ...ctx };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach((src,i) => {
  try { new vm.Script(src); }
  catch(e) { throw new Error(`Script inline ${i+1} con error de sintaxis: ${e.message}`); }
});
console.log('✓ Sintaxis JavaScript válida');

{
  const code = extractFunction('tfShuffle') + '\n' + extractFunction('tfGenerateElim');
  const c = run(code);
  const teams = ['A','B','C','D','E'];
  const rounds = c.tfGenerateElim(teams);
  assert(rounds.length === 3, '5 equipos debe producir 3 rondas');
  assert(rounds[0].length === 4, 'La primera ronda debe tener 4 cruces/plazas');
  const flat = rounds[0].flatMap(m=>[m.a,m.b]);
  assert(flat.filter(x=>x==='BYE').length === 3, 'Debe haber 3 pases libres');
  teams.forEach(t=>assert(flat.includes(t), `Falta el equipo ${t}`));
  console.log('✓ Eliminación con 5 equipos y BYE');
}

{
  const code = extractFunction('tfElimWinner');
  const c = run(code, { tfScores:{m:{a:'2',b:'2'}}, tfElimAdvance:{} });
  const match={a:'A',b:'B'};
  assert(c.tfElimWinner(match,'m') === null, 'Un empate no debe clasificar automáticamente');
  c.tfElimAdvance.m='b';
  assert(c.tfElimWinner(match,'m') === 'B', 'La selección manual debe clasificar al equipo B');
  console.log('✓ Desempate manual en eliminación');
}

{
  const code = extractFunction('tfCalcStandings');
  const c = run(code, { tfScores:{r0_0:{a:'1',b:'0'}}, tfFairPlay:{} });
  const out = c.tfCalcStandings(['A','B'], [[{a:'A',b:'B'}]], 'r');
  const a = out.find(x=>x.name==='A'), b=out.find(x=>x.name==='B');
  assert(a.fpMatchesCount===0 && b.fpMatchesCount===0, 'Fair Play sin tocar no debe contarse');
  assert(a.fpAvg===null && b.fpAvg===null, 'Fair Play sin tocar debe quedar Sin evaluar');
  console.log('✓ Fair Play sin evaluación explícita');
}

{
  const code = extractFunction('tfCalcStandings') + '\n' + extractFunction('tfBuildReport');
  const c = run(code, {
    tfTorneoName:'Prueba',
    tfFixture:{type:'todos',teams:['A','B'],rounds:[[{a:'A',b:'B'}]]},
    tfScores:{r0_0:{a:'0',b:'0'}},
    tfFairPlay:{}
  });
  const report = c.tfBuildReport();
  assert(report.includes('A (0) vs (0) B'), 'El informe debe mostrar 0-0 y no guiones');
  console.log('✓ Resultado 0-0 preservado en informe');
}

{
  const code = extractFunction('tfAllScoresComplete');
  const c = run(code, { tfScores:{} });
  const rounds=[[{a:'A',b:'B'}]];
  assert(c.tfAllScoresComplete(rounds,'g1_')===false, 'Grupo incompleto debe bloquear final');
  c.tfScores.g1_0_0={a:'1',b:'0'};
  assert(c.tfAllScoresComplete(rounds,'g1_')===true, 'Grupo completo debe habilitar final');
  assert(html.includes("const gruposCompletos = tfAllScoresComplete(d.group1,'g1_') && tfAllScoresComplete(d.group2,'g2_');"), 'El render de liguilla debe usar los prefijos correctos');
  console.log('✓ Bloqueo de final de liguilla y prefijos correctos');
}

console.log('\nTODAS LAS PRUEBAS FUNCIONALES PASARON');
