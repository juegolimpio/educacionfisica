// one-time liguilla prefix repair
const fs=require('fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
let n=0;
const replace=(a,b)=>{const before=s; s=s.replaceAll(a,b); if(s!==before)n++;};
replace(", 'g1')", ", 'g1_')");
replace(", 'g2')", ", 'g2_')");
replace(",'g1')", ",'g1_')");
replace(",'g2')", ",'g2_')");
if(!n) throw new Error('No se encontraron llamadas de prefijo de liguilla para corregir');
fs.writeFileSync(p,s);
console.log('Prefijos de liguilla corregidos');
