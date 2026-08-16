from pathlib import Path

p = Path('carne-salud.html')
s = p.read_text(encoding='utf-8')

old = '''        <button class="btn" onclick="exportBackup()">💾 Exportar respaldo</button>\n        <button class="btn" onclick="document.getElementById('import-file').click()">📂 Importar respaldo</button>\n        <button class="btn" onclick="document.getElementById('excel-file').click()">📊 Importar Excel</button>'''
new = '''        <button class="btn" onclick="exportBackup()">💾 Exportar respaldo</button>\n        <button class="btn" onclick="exportExcel()">📊 Exportar Excel</button>\n        <button class="btn" onclick="document.getElementById('import-file').click()">📂 Importar respaldo</button>\n        <button class="btn" onclick="document.getElementById('excel-file').click()">📊 Importar Excel</button>'''
if 'onclick="exportExcel()"' not in s:
    if old not in s:
        raise SystemExit('No se encontro el bloque de botones')
    s = s.replace(old, new, 1)

insert = r'''
function formatDateForExcel(iso){if(!iso)return '';const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(iso);}
function safeSheetName(name,used){let base=String(name||'Grupo').replace(/[\\\/?*\[\]:]/g,' ').replace(/\s+/g,' ').trim()||'Grupo';base=base.slice(0,31);let candidate=base,n=2;while(used.has(candidate.toLowerCase())){const suffix=` (${n++})`;candidate=base.slice(0,31-suffix.length)+suffix;}used.add(candidate.toLowerCase());return candidate;}
function exportExcel(){
  if(typeof XLSX==='undefined'){alert('No se pudo cargar el generador de Excel. Verificá tu conexión a Internet e intentá nuevamente.');return;}
  if(!state.groups.length){alert('No hay grupos para exportar.');return;}
  const wb=XLSX.utils.book_new();const used=new Set();
  state.groups.forEach(g=>{
    const rows=[['Nº','Nombre','Vencimiento','Días','Estado','Permiso']];
    g.students.forEach((s,i)=>{const st=statusFor(s.expiry);const perm=s.permission==='ENTREGADO'?'Entregado':s.permission==='NO ENTREGADO'?'No entregado':'Pendiente';rows.push([i+1,s.name,formatDateForExcel(s.expiry),st.days===null?'':st.days,st.label,perm]);});
    const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:6},{wch:30},{wch:14},{wch:10},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws,safeSheetName(g.name,used));
  });
  const stamp=new Date().toISOString().slice(0,10);XLSX.writeFile(wb,`juego-limpio-carne-salud-${stamp}.xlsx`);
}
'''

if 'function exportExcel(){' not in s:
    anchor = 'function exportBackup(){'
    if anchor not in s:
        raise SystemExit('No se encontro punto de insercion')
    s = s.replace(anchor, insert + '\n' + anchor, 1)

p.write_text(s, encoding='utf-8')
