from pathlib import Path

p = Path('carne-salud.html')
s = p.read_text(encoding='utf-8')

s = s.replace("const BACKUP_KEY='juegolimpio_carne_salud_last_backup';\n", '')
s = s.replace("function showGroups(){currentGroupId=null;document.getElementById('group-view').classList.add('hidden');document.getElementById('groups-view').classList.remove('hidden');renderGroups();renderBackupMeta();}", "function showGroups(){currentGroupId=null;document.getElementById('group-view').classList.add('hidden');document.getElementById('groups-view').classList.remove('hidden');renderGroups();}")
s = s.replace("<div class=\"warning\"><b>Importante:</b> los datos se guardan automáticamente en este navegador. Para no depender de un solo dispositivo, descargá periódicamente un respaldo.</div>", "<div class=\"warning\"><b>Importante:</b> los datos se guardan automáticamente en este navegador. Para no depender de un solo dispositivo, exportá periódicamente una copia en Excel.</div>")

old_ui = '''      <h2 class="section-title" style="font-size:17px">Respaldo</h2>\n      <p class="muted">El respaldo incluye todos los grupos, alumnos, vencimientos y permisos.</p>\n      <div class="tools" style="margin-top:12px">\n        <button class="btn" onclick="exportBackup()">💾 Exportar respaldo</button>\n        <button class="btn" onclick="exportExcel()">📊 Exportar Excel</button>\n        <button class="btn" onclick="document.getElementById('import-file').click()">📂 Importar respaldo</button>\n        <button class="btn" onclick="document.getElementById('excel-file').click()">📊 Importar Excel</button>\n        <input id="import-file" class="hidden" type="file" accept="application/json,.json" onchange="importBackup(event)">\n        <input id="excel-file" class="hidden" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onchange="importExcel(event)">\n      </div>\n      <div id="backup-meta" class="backup-meta"></div>'''
new_ui = '''      <h2 class="section-title" style="font-size:17px">Datos y respaldo</h2>\n      <p class="muted">Los datos se guardan automáticamente en este navegador. Usá Excel para guardar una copia o trasladar tus grupos a otro dispositivo.</p>\n      <div class="tools" style="margin-top:12px">\n        <button class="btn" onclick="exportExcel()">📊 Exportar Excel</button>\n        <button class="btn" onclick="document.getElementById('excel-file').click()">📂 Importar Excel</button>\n        <input id="excel-file" class="hidden" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onchange="importExcel(event)">\n      </div>'''
if old_ui not in s:
    raise SystemExit('No se encontró el bloque de respaldo esperado')
s = s.replace(old_ui, new_ui, 1)

# Quitar funciones JSON de respaldo.
start = s.find('function exportBackup(){')
end = s.find('\n\nfunction normalizeHeader', start)
if start == -1 or end == -1:
    raise SystemExit('No se encontraron las funciones JSON esperadas')
# Conservar exportExcel, que está antes de exportBackup.
s = s[:start] + s[end+2:]

# Reemplazar la importación de Excel por una versión que permita agregar o reemplazar.
start = s.find('async function importExcel(event){')
end = s.find('\n\nfunction renderBackupMeta(){', start)
if start == -1 or end == -1:
    raise SystemExit('No se encontró la función de importación o su cierre')
new_import = r'''async function importExcel(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  if(typeof XLSX==='undefined'){alert('No se pudo cargar el lector de Excel. Verificá tu conexión a Internet e intentá nuevamente.');return;}
  try{
    const workbook=XLSX.read(await file.arrayBuffer(),{cellDates:true});
    const hasNonTemplate=workbook.SheetNames.some(n=>normalizeHeader(n)!=='plantilla');
    const imported=[];
    for(const sheetName of workbook.SheetNames){
      if(hasNonTemplate&&normalizeHeader(sheetName)==='plantilla')continue;
      const ws=workbook.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
      let headerRow=-1,nameIdx=-1,expiryIdx=-1,permissionIdx=-1;
      for(let r=0;r<Math.min(rows.length,10);r++){
        const headers=(rows[r]||[]).map(normalizeHeader);
        const ni=headers.indexOf('nombre');
        if(ni>=0){headerRow=r;nameIdx=ni;expiryIdx=headers.indexOf('vencimiento');permissionIdx=headers.indexOf('permiso');break;}
      }
      if(headerRow<0)continue;
      const students=[];
      for(let r=headerRow+1;r<rows.length;r++){
        const row=rows[r]||[];const name=String(row[nameIdx]??'').trim();if(!name)continue;
        students.push({id:uid(),name:name.slice(0,120),expiry:expiryIdx>=0?excelDateToISO(row[expiryIdx]):'',permission:permissionIdx>=0?permissionFromExcel(row[permissionIdx]):'PENDIENTE'});
      }
      if(students.length)imported.push({id:uid(),name:(String(sheetName).trim().slice(0,60)||'Grupo'),students});
    }
    if(!imported.length){alert('No encontré hojas con una columna “Nombre” y alumnos para importar.');return;}
    const total=imported.reduce((n,g)=>n+g.students.length,0);
    let mode='add';
    if(state.groups.length){
      const choice=prompt(`Ya tenés ${state.groups.length} grupo(s) guardado(s).\n\nEscribí A para AGREGAR los grupos del Excel sin borrar los actuales.\nEscribí R para REEMPLAZAR todos los datos actuales por los del Excel.`, 'A');
      if(choice===null)return;
      const c=choice.trim().toUpperCase();
      if(c!=='A'&&c!=='R'){alert('Importación cancelada. Escribí A para agregar o R para reemplazar.');return;}
      mode=c==='R'?'replace':'add';
    }
    const action=mode==='replace'?'REEMPLAZARÁN los datos actuales':'AGREGARÁN a los datos actuales';
    if(!confirm(`Se ${action}: ${imported.length} grupo(s) y ${total} alumno(s).\n\nSe leerán Nombre, Vencimiento y Permiso. La Cédula, Días y Estado no se importarán.\n\n¿Continuar?`))return;
    if(mode==='replace'){
      state={version:1,groups:imported};
    }else{
      imported.forEach(g=>{g.name=uniqueGroupName(g.name);state.groups.push(g);});
    }
    save();renderGroups();
    alert(`Excel importado correctamente: ${imported.length} grupo(s), ${total} alumno(s).`);
  }catch(e){console.error(e);alert('No se pudo leer el Excel. Verificá que sea un archivo .xlsx o .xls válido.');}
}'''
s = s[:start] + new_import + s[end:]

# Quitar metadatos JSON y su llamada final.
rb_start = s.find('function renderBackupMeta(){')
if rb_start != -1:
    rb_end = s.find('\n\ndocument.getElementById', rb_start)
    if rb_end == -1:
        raise SystemExit('No se pudo cerrar renderBackupMeta')
    s = s[:rb_start] + s[rb_end+2:]
s = s.replace('renderGroups();renderBackupMeta();', 'renderGroups();')

p.write_text(s, encoding='utf-8')
