/* Juego Limpio — prototipo de sincronización con Google Sheets
   Requiere configurar un OAuth Client ID web de Google.
   No contiene client secret ni almacena tokens de Google de forma persistente. */
(() => {
  'use strict';

  const GOOGLE_CLIENT_ID = 'PENDIENTE_CONFIGURAR_CLIENT_ID.apps.googleusercontent.com';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FILE_NAME = 'Juego Limpio - Datos docentes';
  const APP_KEY = 'juegoLimpio';
  const APP_VALUE = 'carneSaludV2';
  const LS_FILE_ID = 'juegolimpio_google_sheet_id_v2';
  const LS_LAST_SYNC = 'juegolimpio_google_last_sync_v2';

  let tokenClient = null;
  let accessToken = null;
  let syncTimer = null;
  let syncBusy = false;
  let pendingSync = false;

  function configured(){
    return GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('PENDIENTE_');
  }

  function injectStyles(){
    const style=document.createElement('style');
    style.textContent=`
      .cloud-status{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:13px}
      .cloud-dot{width:9px;height:9px;border-radius:50%;background:var(--gray);display:inline-block}
      .cloud-dot.ok{background:var(--green)}.cloud-dot.wait{background:var(--yellow)}.cloud-dot.err{background:var(--red)}
      .cloud-note{font-size:12px;color:var(--muted);margin-top:10px;line-height:1.45}
      .cloud-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    `;
    document.head.appendChild(style);
  }

  function injectCard(){
    const groupsView=document.getElementById('groups-view');
    if(!groupsView || document.getElementById('google-sync-card')) return;
    const card=document.createElement('div');
    card.className='card';
    card.id='google-sync-card';
    card.innerHTML=`
      <h2 class="section-title" style="font-size:17px">☁️ Google Sheets</h2>
      <p class="muted">Guardá tus grupos en tu cuenta de Google y recuperalos desde otra computadora o celular.</p>
      <div class="cloud-status"><span id="cloud-dot" class="cloud-dot"></span><strong id="cloud-status-text">Sin conectar</strong></div>
      <div class="cloud-actions">
        <button id="google-connect-btn" class="btn primary">Conectar con Google</button>
        <button id="google-create-btn" class="btn hidden">Crear mi hoja de Juego Limpio</button>
        <button id="google-restore-btn" class="btn hidden">Recuperar desde Google</button>
        <button id="google-use-local-btn" class="btn hidden">Guardar estos datos en Google</button>
        <button id="google-sync-btn" class="btn hidden">Sincronizar ahora</button>
      </div>
      <p id="cloud-note" class="cloud-note">El guardado local y el Excel continúan disponibles como respaldo.</p>
    `;
    const backupCard=groupsView.querySelector('.card:nth-last-child(1)');
    groupsView.insertBefore(card, backupCard || null);
    document.getElementById('google-connect-btn').addEventListener('click', connectGoogle);
    document.getElementById('google-create-btn').addEventListener('click', createCloudSheet);
    document.getElementById('google-restore-btn').addEventListener('click', restoreFromCloud);
    document.getElementById('google-use-local-btn').addEventListener('click', syncNow);
    document.getElementById('google-sync-btn').addEventListener('click', syncNow);
    if(!configured()){
      setStatus('wait','Google pendiente de configurar');
      document.getElementById('google-connect-btn').disabled=true;
      document.getElementById('cloud-note').textContent='Prototipo: falta configurar el Client ID de Google antes de probar la conexión. La versión pública no se ve afectada.';
    }
  }

  function setStatus(kind,text){
    const dot=document.getElementById('cloud-dot');
    const label=document.getElementById('cloud-status-text');
    if(!dot||!label)return;
    dot.className='cloud-dot'+(kind?' '+kind:'');
    label.textContent=text;
  }
  function show(id,on=true){document.getElementById(id)?.classList.toggle('hidden',!on);}
  function note(text){const n=document.getElementById('cloud-note');if(n)n.textContent=text;}

  function loadGIS(){
    return new Promise((resolve,reject)=>{
      if(window.google?.accounts?.oauth2)return resolve();
      const existing=document.querySelector('script[data-jl-gis]');
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.dataset.jlGis='1';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }

  async function connectGoogle(){
    if(!configured())return;
    try{
      setStatus('wait','Conectando con Google…');
      await loadGIS();
      if(!tokenClient){
        tokenClient=google.accounts.oauth2.initTokenClient({
          client_id:GOOGLE_CLIENT_ID,
          scope:SCOPE,
          callback:async response=>{
            if(response.error){setStatus('err','No se pudo conectar');note(response.error);return;}
            accessToken=response.access_token;
            await afterAuth();
          }
        });
      }
      tokenClient.requestAccessToken({prompt:'consent'});
    }catch(e){console.error(e);setStatus('err','No se pudo conectar');note('Verificá la conexión a Internet e intentá nuevamente.');}
  }

  async function api(url,options={}){
    if(!accessToken)throw new Error('NO_TOKEN');
    const res=await fetch(url,{...options,headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json',...(options.headers||{})}});
    if(res.status===401){accessToken=null;setStatus('wait','Volvé a conectar con Google');throw new Error('TOKEN_EXPIRED');}
    if(!res.ok){const txt=await res.text();throw new Error(`${res.status}: ${txt}`);}
    if(res.status===204)return null;
    return res.json();
  }

  async function findCloudSheet(){
    const saved=localStorage.getItem(LS_FILE_ID);
    if(saved){
      try{const f=await api(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(saved)}?fields=id,name,modifiedTime,trashed`);if(!f.trashed)return f;}catch(e){if(e.message==='TOKEN_EXPIRED')throw e;}
      localStorage.removeItem(LS_FILE_ID);
    }
    const q=`appProperties has { key='${APP_KEY}' and value='${APP_VALUE}' } and trashed=false`;
    const data=await api(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime)&pageSize=10`);
    const file=data.files?.[0]||null;
    if(file)localStorage.setItem(LS_FILE_ID,file.id);
    return file;
  }

  async function afterAuth(){
    setStatus('wait','Buscando tu hoja de Juego Limpio…');
    show('google-connect-btn',false);
    try{
      const file=await findCloudSheet();
      if(!file){
        setStatus('wait','Google conectado · todavía no hay hoja');
        show('google-create-btn',true);show('google-sync-btn',false);show('google-restore-btn',false);show('google-use-local-btn',false);
        note('Tocá “Crear mi hoja de Juego Limpio”. Se creará automáticamente en tu Google Drive.');
        return;
      }
      setStatus('ok','Google conectado · hoja encontrada');
      show('google-create-btn',false);show('google-sync-btn',true);
      const localHasData=Array.isArray(window.jlGetState?.()?.groups)&&window.jlGetState().groups.length>0;
      show('google-restore-btn',true);
      show('google-use-local-btn',localHasData);
      note(localHasData?'Encontré datos tanto en este dispositivo como en Google. Elegí qué versión querés conservar antes de sincronizar automáticamente.':'Encontré tu hoja. Recuperá tus grupos para continuar en este dispositivo.');
    }catch(e){console.error(e);setStatus('err','Error al buscar la hoja');note('No se pudo consultar Google Drive.');}
  }

  async function createCloudSheet(){
    try{
      setStatus('wait','Creando tu hoja de Juego Limpio…');
      const file=await api('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',body:JSON.stringify({name:FILE_NAME,mimeType:'application/vnd.google-apps.spreadsheet',appProperties:{[APP_KEY]:APP_VALUE}})});
      localStorage.setItem(LS_FILE_ID,file.id);
      await writeSnapshot(file.id);
      show('google-create-btn',false);show('google-sync-btn',true);show('google-restore-btn',true);show('google-use-local-btn',false);
      setStatus('ok','Guardado en Google Sheets ✓');
      note('Tu hoja ya está creada en Google Drive. Los próximos cambios se sincronizarán automáticamente mientras Google esté conectado.');
    }catch(e){console.error(e);setStatus('err','No se pudo crear la hoja');note('No se modificaron tus datos locales.');}
  }

  function safeTitle(name,used){
    let base=String(name||'Grupo').replace(/[\\\/?*\[\]:]/g,' ').replace(/\s+/g,' ').trim()||'Grupo';base=base.slice(0,60);
    let c=base,n=2;while(used.has(c.toLowerCase())){const suf=` (${n++})`;c=(base.slice(0,60-suf.length)+suf);}used.add(c.toLowerCase());return c;
  }

  function sheetRows(group){
    const rows=[['Nº','Nombre','Vencimiento','Días','Estado','Permiso']];
    group.students.forEach((s,i)=>{
      const st=statusFor(s.expiry);
      rows.push([i+1,s.name,s.expiry||'',st.days===null?'':st.days,st.label,s.permission==='ENTREGADO'?'Entregado':s.permission==='NO ENTREGADO'?'No entregado':'Pendiente']);
    });
    return rows;
  }

  async function writeSnapshot(fileId){
    const spreadsheet=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}?fields=sheets.properties`);
    const existing=spreadsheet.sheets||[];
    const used=new Set();
    const groups=(window.jlGetState?.()?.groups||[]).map(g=>({g,title:safeTitle(g.name,used)}));
    const tempTitle='_JL_TEMP_'+Date.now();
    const requests=[{addSheet:{properties:{title:tempTitle,hidden:true}}}];
    existing.forEach(sh=>requests.push({deleteSheet:{sheetId:sh.properties.sheetId}}));
    if(groups.length){groups.forEach(x=>requests.push({addSheet:{properties:{title:x.title}}}));requests.push({deleteSheet:{sheetId:-1}});}
    // No se puede referenciar el sheetId recién creado con -1. Por eso el borrado del temporal se hace en una segunda llamada.
    requests.pop();
    await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}:batchUpdate`,{method:'POST',body:JSON.stringify({requests})});
    let meta=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}?fields=sheets.properties`);
    const temp=meta.sheets.find(s=>s.properties.title===tempTitle);
    if(!groups.length){
      if(temp)await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}:batchUpdate`,{method:'POST',body:JSON.stringify({requests:[{updateSheetProperties:{properties:{sheetId:temp.properties.sheetId,title:'Sin grupos',hidden:false},fields:'title,hidden'}}]})});
      localStorage.setItem(LS_LAST_SYNC,new Date().toISOString());return;
    }
    if(temp)await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}:batchUpdate`,{method:'POST',body:JSON.stringify({requests:[{deleteSheet:{sheetId:temp.properties.sheetId}}]})});

    for(const x of groups){
      const range=`'${x.title.replace(/'/g,"''")}'!A1:F${Math.max(1,x.g.students.length+1)}`;
      await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,{method:'PUT',body:JSON.stringify({range,majorDimension:'ROWS',values:sheetRows(x.g)})});
    }
    meta=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}?fields=sheets.properties`);
    const fmt=[];
    for(const x of groups){
      const sh=meta.sheets.find(s=>s.properties.title===x.title);if(!sh)continue;const id=sh.properties.sheetId;
      fmt.push(
        {repeatCell:{range:{sheetId:id,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:6},cell:{userEnteredFormat:{textFormat:{bold:true}}},fields:'userEnteredFormat.textFormat.bold'}},
        {autoResizeDimensions:{dimensions:{sheetId:id,dimension:'COLUMNS',startIndex:0,endIndex:6}}},
        ...['VIGENTE','PRÓXIMO','VENCIDO','SIN REGISTRO'].map((label,idx)=>({addConditionalFormatRule:{index:idx,rule:{ranges:[{sheetId:id,startRowIndex:1,startColumnIndex:4,endColumnIndex:5}],booleanRule:{condition:{type:'TEXT_EQ',values:[{userEnteredValue:label}]},format:{backgroundColor:idx===0?{red:.72,green:.88,blue:.74}:idx===1?{red:1,green:.91,blue:.55}:idx===2?{red:.96,green:.65,blue:.63}:{red:.85,green:.87,blue:.9}}}}}}))
      );
    }
    if(fmt.length)await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}:batchUpdate`,{method:'POST',body:JSON.stringify({requests:fmt})});
    localStorage.setItem(LS_LAST_SYNC,new Date().toISOString());
  }

  async function readSnapshot(fileId){
    const meta=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}?fields=sheets.properties`);
    const groups=[];
    for(const sh of meta.sheets||[]){
      const title=sh.properties.title;if(title==='Sin grupos'||title.startsWith('_JL_'))continue;
      const range=`'${title.replace(/'/g,"''")}'!A:F`;
      const data=await api(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`);
      const rows=data.values||[];if(!rows.length)continue;
      const headers=(rows[0]||[]).map(normalizeHeader);const ni=headers.indexOf('nombre'),vi=headers.indexOf('vencimiento'),pi=headers.indexOf('permiso');if(ni<0)continue;
      const students=[];
      for(const row of rows.slice(1)){
        const name=String(row[ni]??'').trim();if(!name)continue;
        students.push({id:uid(),name:name.slice(0,120),expiry:vi>=0?excelDateToISO(row[vi]):'',permission:pi>=0?permissionFromExcel(row[pi]):'PENDIENTE'});
      }
      groups.push({id:uid(),name:title.slice(0,60),students});
    }
    return {version:1,groups};
  }

  async function restoreFromCloud(){
    try{
      const file=await findCloudSheet();if(!file)throw new Error('NO_FILE');
      if(window.jlGetState?.()?.groups?.length && !confirm('Este dispositivo ya tiene grupos guardados.\n\n¿Querés REEMPLAZARLOS por la copia de Google?'))return;
      setStatus('wait','Recuperando datos desde Google…');
      window.jlReplaceState(await readSnapshot(file.id));save();renderGroups();
      setStatus('ok','Datos recuperados desde Google ✓');
      show('google-use-local-btn',false);show('google-sync-btn',true);
      note('Tus grupos ya están disponibles en este dispositivo.');
    }catch(e){console.error(e);setStatus('err','No se pudieron recuperar los datos');note('La copia local no fue modificada.');}
  }

  async function syncNow(){
    if(syncBusy){pendingSync=true;return;}
    if(!accessToken){setStatus('wait','Volvé a conectar con Google');show('google-connect-btn',true);return;}
    syncBusy=true;
    try{
      const file=await findCloudSheet();if(!file){show('google-create-btn',true);setStatus('wait','Primero creá tu hoja de Juego Limpio');return;}
      setStatus('wait','Sincronizando…');
      await writeSnapshot(file.id);
      setStatus('ok','Guardado en Google Sheets ✓');show('google-use-local-btn',false);show('google-sync-btn',true);
      const t=new Date();note(`Última sincronización: ${t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`);
    }catch(e){console.error(e);if(e.message!=='TOKEN_EXPIRED'){setStatus('err','Pendiente de sincronizar');note('Tus cambios siguen guardados en este dispositivo. Podés volver a intentar cuando haya conexión.');}}
    finally{syncBusy=false;if(pendingSync){pendingSync=false;scheduleSync();}}
  }

  function scheduleSync(){
    if(!accessToken||!localStorage.getItem(LS_FILE_ID))return;
    clearTimeout(syncTimer);setStatus('wait','Cambios guardados localmente · sincronizando…');syncTimer=setTimeout(syncNow,1800);
  }

  function installSaveHook(){window.jlAfterLocalSave=scheduleSync;}

  injectStyles();injectCard();installSaveHook();
})();
