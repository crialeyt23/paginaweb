/* =========================================================
   ESTADO GLOBAL
========================================================= */
const FACULTADES_ORDEN = ['Ingeniería','Ciencias de la Salud','Ciencias Administrativas','Derecho y Ciencias Políticas','Educación','Ciencias Sociales','Arquitectura'];
const CRED_KEY = 'cocinera-credenciales';
const DATA_KEY = 'comedor-data';

let DB = { students: [], deliveries: [], menu: null }; // students = beneficiarios; deliveries = log histórico; menu = opciones del día
let filtroActual = 'todos';
let filtroHistorial = 'dia';
let charts = {};
let sesionActiva = false;
let menuSeleccionado = null; // id de la opción de menú elegida por el estudiante en el formulario actual

/* =========================================================
   UTILIDADES
========================================================= */
function hoyISO(){ return new Date().toISOString().slice(0,10); }
function horaAhora(){ return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
function fechaLegible(){
  return new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function mostrarToast(msg, tipo='success', titulo=''){
  const stack = document.getElementById('toast-stack');
  const div = document.createElement('div');
  div.className = 'toast ' + (tipo==='success'?'':tipo);
  const icons = {success:'✅', error:'⚠️', info:'ℹ️'};
  div.innerHTML = `<span class="t-icon">${icons[tipo]||'✅'}</span><div class="t-body">${titulo?`<b>${escapeHtml(titulo)}</b>`:''}<span>${escapeHtml(msg)}</span></div>`;
  stack.appendChild(div);
  setTimeout(()=>{
    div.classList.add('leaving');
    setTimeout(()=>div.remove(),300);
  }, 3800);
}

/* =========================================================
   PERSISTENCIA (Storage API — hace de "base de datos" compartida)
========================================================= */
async function cargarDatos(){
  try{
    const res = await window.storage.get(DATA_KEY, true);
    if(res && res.value){ DB = JSON.parse(res.value); }
  }catch(e){ /* aún no existe la clave -> usamos DB vacío */ }

  try{
    const cred = await window.storage.get(CRED_KEY, true);
    if(!cred){ throw new Error('sin credenciales'); }
  }catch(e){
    // primera vez: crear credenciales por defecto
    try{ await window.storage.set(CRED_KEY, JSON.stringify({user:'cocinera', pass:'comedor2026'}), true); }catch(err){}
  }
}

async function guardarDatos(){
  try{
    const ok = await window.storage.set(DATA_KEY, JSON.stringify(DB), true);
    if(!ok) mostrarToast('No se pudo guardar la información. Intenta nuevamente.','error','Error de almacenamiento');
  }catch(e){
    mostrarToast('Error de conexión con el almacenamiento.','error','Error');
  }
}

/* =========================================================
   NAVEGACIÓN
========================================================= */
function ir(vista){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+vista).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  if(vista==='dashboard'){ renderTodoElPanel(); }
  if(vista==='estudiante'){ menuSeleccionado = null; renderMenuHoy(); }
}

/* =========================================================
   MENÚ DEL DÍA (vista estudiante)
========================================================= */
function renderMenuHoy(){
  const cont = document.getElementById('menu-hoy-render');
  const hoy = hoyISO();
  if(!DB.menu || DB.menu.fecha !== hoy || !DB.menu.opciones || DB.menu.opciones.every(o=>!o.fondo)){
    cont.innerHTML = `<div class="menu-empty">🍽️ El menú de hoy aún no ha sido publicado por el comedor. Puedes registrarte y tu almuerzo será el del día.</div>`;
    return;
  }
  cont.innerHTML = `<div class="menu-options">` + DB.menu.opciones.map(o=>{
    if(!o.fondo) return '';
    const sel = menuSeleccionado===o.id;
    return `
    <div class="menu-option-card ${sel?'selected':''}" onclick="elegirMenu('${o.id}')">
      <div class="mo-check">${sel?'✓':''}</div>
      <span class="mo-tag">${escapeHtml(o.nombre)}</span>
      <dl>
        ${o.entrada?`<b>Entrada</b>${escapeHtml(o.entrada)}`:''}
        ${o.fondo?`<b>Plato de fondo</b>${escapeHtml(o.fondo)}`:''}
        ${o.postre?`<b>Postre</b>${escapeHtml(o.postre)}`:''}
        ${o.bebida?`<b>Bebida</b>${escapeHtml(o.bebida)}`:''}
      </dl>
    </div>`;
  }).join('') + `</div>`;
}

function elegirMenu(id){
  menuSeleccionado = (menuSeleccionado===id) ? null : id;
  renderMenuHoy();
}

function cerrarSesion(){
  sesionActiva = false;
  document.getElementById('session-pill').style.display='none';
  ir('landing');
}

/* =========================================================
   TEMA CLARO / OSCURO
========================================================= */
function toggleTheme(){
  const html = document.documentElement;
  html.classList.toggle('dark');
  const isDark = html.classList.contains('dark');
  document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
  localStorage_safe_set('comedor-theme', isDark?'dark':'light');
  refrescarGraficos();
}
// Nota: para la preferencia de tema (no datos del comedor) usamos una variable en memoria,
// ya que localStorage no está disponible de forma fiable en este entorno de artefactos.
let temaMemoria = 'light';
function localStorage_safe_set(k,v){ temaMemoria = v; }

/* =========================================================
   VALIDACIÓN Y REGISTRO DE ESTUDIANTE
========================================================= */
document.getElementById('form-estudiante').addEventListener('submit', async function(e){
  e.preventDefault();
  const codigo = document.getElementById('in-codigo').value.trim();
  const nombre = document.getElementById('in-nombre').value.trim();
  const facultad = document.getElementById('in-facultad').value;
  const carrera = document.getElementById('in-carrera').value.trim();
  const ciclo = document.getElementById('in-ciclo').value;
  const correo = document.getElementById('in-correo').value.trim();

  let valido = true;
  const marcar = (id, ok) => {
    const el = document.getElementById(id);
    el.classList.toggle('error', !ok);
    if(!ok) valido = false;
  };

  marcar('f-codigo', codigo.length>0);
  marcar('f-nombre', nombre.length>0);
  marcar('f-facultad', facultad.length>0);
  marcar('f-carrera', carrera.length>0);
  marcar('f-ciclo', ciclo.length>0);
  const correoValido = correo.length===0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  marcar('f-correo', correoValido);

  if(!valido){
    mostrarToast('Revisa los campos marcados en rojo antes de continuar.','error','Faltan datos obligatorios');
    return;
  }

  if(DB.students.some(s => s.codigo === codigo)){
    marcar('f-codigo', false);
    mostrarToast('Ese código universitario ya está registrado en el comedor.','error','Código duplicado');
    return;
  }

  const hayMenuPublicado = DB.menu && DB.menu.fecha===hoyISO() && DB.menu.opciones && DB.menu.opciones.some(o=>o.fondo);
  if(hayMenuPublicado && !menuSeleccionado){
    mostrarToast('Elige uno de los menús disponibles antes de registrarte.','error','Falta reservar tu menú');
    return;
  }
  const menuElegidoObj = hayMenuPublicado ? DB.menu.opciones.find(o=>o.id===menuSeleccionado) : null;

  const btn = document.getElementById('btn-registrar');
  btn.disabled = true; btn.textContent = 'Registrando…';

  const nuevo = {
    codigo, nombre, facultad, carrera, ciclo, correo,
    estado: 'pendiente',
    fechaRegistro: hoyISO(),
    horaRegistro: horaAhora(),
    fechaAlmuerzo: hoyISO(),
    horaEntrega: 'Sin entregar',
    menuReservado: menuElegidoObj ? menuElegidoObj.nombre : 'No especificado'
  };
  DB.students.push(nuevo);
  await guardarDatos();

  btn.disabled = false; btn.textContent = '✅ Confirmar registro';
  this.reset();
  document.querySelectorAll('#form-estudiante .field').forEach(f=>f.classList.remove('error'));
  menuSeleccionado = null;
  renderMenuHoy();

  mostrarToast(`${nombre} quedó registrado con ${nuevo.menuReservado==='No especificado'?'el almuerzo del día':'su '+nuevo.menuReservado+' reservado'}.`, 'success', '¡Registro exitoso!');
});

/* =========================================================
   LOGIN COCINERA
========================================================= */
document.getElementById('form-login').addEventListener('submit', async function(e){
  e.preventDefault();
  const user = document.getElementById('in-user').value.trim();
  const pass = document.getElementById('in-pass').value;
  let cred = {user:'cocinera', pass:'comedor2026'};
  try{
    const res = await window.storage.get(CRED_KEY, true);
    if(res && res.value) cred = JSON.parse(res.value);
  }catch(err){}

  const passField = document.getElementById('f-pass');
  if(user === cred.user && pass === cred.pass){
    passField.classList.remove('error');
    sesionActiva = true;
    document.getElementById('session-pill').style.display='flex';
    document.getElementById('session-label').textContent = cred.user;
    this.reset();
    ir('dashboard');
    mostrarToast('Bienvenida al panel del comedor.','success','Sesión iniciada');
  }else{
    passField.classList.add('error');
    mostrarToast('Verifica tu usuario y contraseña.','error','Acceso denegado');
  }
});

/* =========================================================
   PANEL: TABS
========================================================= */
function cambiarTab(tab){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  if(tab==='estadisticas') setTimeout(renderGraficos, 60);
  if(tab==='historial') renderHistorial();
  if(tab==='menu') cargarFormularioMenu();
}

/* =========================================================
   MENÚ DEL DÍA (panel cocinera)
========================================================= */
function cargarFormularioMenu(){
  document.getElementById('menu-fecha-label').textContent = fechaLegible();
  const hoy = hoyISO();
  const vigente = (DB.menu && DB.menu.fecha===hoy) ? DB.menu : null;
  const A = vigente ? (vigente.opciones.find(o=>o.id==='A')||{}) : {};
  const B = vigente ? (vigente.opciones.find(o=>o.id==='B')||{}) : {};
  document.getElementById('menuA-entrada').value = A.entrada||'';
  document.getElementById('menuA-fondo').value = A.fondo||'';
  document.getElementById('menuA-postre').value = A.postre||'';
  document.getElementById('menuA-bebida').value = A.bebida||'';
  document.getElementById('menuB-entrada').value = B.entrada||'';
  document.getElementById('menuB-fondo').value = B.fondo||'';
  document.getElementById('menuB-postre').value = B.postre||'';
  document.getElementById('menuB-bebida').value = B.bebida||'';
}

async function guardarMenu(){
  const leer = id => document.getElementById(id).value.trim();
  const opA = { id:'A', nombre:'Menú A', entrada:leer('menuA-entrada'), fondo:leer('menuA-fondo'), postre:leer('menuA-postre'), bebida:leer('menuA-bebida') };
  const opB = { id:'B', nombre:'Menú B', entrada:leer('menuB-entrada'), fondo:leer('menuB-fondo'), postre:leer('menuB-postre'), bebida:leer('menuB-bebida') };

  if(!opA.fondo && !opB.fondo){
    mostrarToast('Ingresa al menos el plato de fondo de una opción para publicar el menú.','error','Faltan datos del menú');
    return;
  }

  DB.menu = { fecha: hoyISO(), opciones:[opA, opB] };
  await guardarDatos();
  mostrarToast('Los estudiantes ya pueden ver y reservar el menú de hoy.','success','Menú publicado');
}

function setFiltro(f){
  filtroActual = f;
  document.querySelectorAll('#filtros .filter-chip').forEach(b=>b.classList.toggle('active', b.dataset.f===f));
  renderTabla();
}
function setFiltroHistorial(f){
  filtroHistorial = f;
  document.querySelectorAll('#filtros-historial .filter-chip').forEach(b=>b.classList.toggle('active', b.dataset.hf===f));
  renderHistorial();
}
document.getElementById('in-fecha-historial').addEventListener('change', renderHistorial);

/* =========================================================
   RENDER: RESUMEN / STATS
========================================================= */
function renderResumen(){
  document.getElementById('fecha-hoy').textContent = fechaLegible();
  const hoy = hoyISO();
  const deHoy = DB.students.filter(s=>s.fechaAlmuerzo===hoy);
  const total = deHoy.length;
  const entregados = deHoy.filter(s=>s.estado==='entregado').length;
  const pendientes = total - entregados;
  const pct = total>0 ? Math.round((entregados/total)*100) : 0;

  document.getElementById('st-total').textContent = total;
  document.getElementById('st-entregados').textContent = entregados;
  document.getElementById('st-pendientes').textContent = pendientes;
  document.getElementById('st-porcentaje').textContent = pct+'%';

  const ring = document.getElementById('plate-ring');
  const circunferencia = 314;
  ring.style.strokeDashoffset = circunferencia - (circunferencia*pct/100);
  document.getElementById('plate-pct').textContent = pct+'%';
  document.getElementById('plate-desc').textContent = total===0
    ? 'Aún no hay registros para el día de hoy.'
    : `${entregados} de ${total} estudiantes ya recogieron su almuerzo. Quedan ${pendientes} por atender.`;
}

/* =========================================================
   RENDER: TABLA DE ENTREGAS
========================================================= */
function estudiantesFiltrados(){
  const q = document.getElementById('in-buscar').value.trim().toLowerCase();
  const hoy = hoyISO();
  return DB.students
    .filter(s=>s.fechaAlmuerzo===hoy)
    .filter(s=>{
      if(filtroActual==='pendiente') return s.estado==='pendiente';
      if(filtroActual==='entregado') return s.estado==='entregado';
      return true;
    })
    .filter(s=>{
      if(!q) return true;
      return s.codigo.toLowerCase().includes(q) || s.nombre.toLowerCase().includes(q) || s.facultad.toLowerCase().includes(q);
    })
    .sort((a,b)=> a.nombre.localeCompare(b.nombre));
}

function renderTabla(){
  const lista = estudiantesFiltrados();
  const tbody = document.getElementById('tbody-estudiantes');
  const empty = document.getElementById('empty-tabla');
  tbody.innerHTML = '';
  empty.style.display = lista.length===0 ? 'block' : 'none';

  lista.forEach(s=>{
    const tr = document.createElement('tr');
    const badge = s.estado==='entregado'
      ? `<span class="badge done">🟢 Recibido</span>`
      : `<span class="badge pending">🟡 Pendiente</span>`;
    const accion = s.estado==='entregado'
      ? `<button class="deliver-btn" disabled>Ya entregado</button>`
      : `<button class="deliver-btn" onclick="entregarAlmuerzo('${s.codigo}')">Entregar almuerzo</button>`;
    tr.innerHTML = `
      <td>${escapeHtml(s.codigo)}</td>
      <td><div class="cell-name">${escapeHtml(s.nombre)}</div><div class="cell-sub">${escapeHtml(s.ciclo||'')}</div></td>
      <td>${escapeHtml(s.facultad)}<div class="cell-sub">${escapeHtml(s.carrera)}</div></td>
      <td><span class="reserva-tag">🍛 ${escapeHtml(s.menuReservado||'No especificado')}</span></td>
      <td>${badge}</td>
      <td>${escapeHtml(s.horaEntrega)}</td>
      <td>${accion}</td>`;
    tbody.appendChild(tr);
  });
}

async function entregarAlmuerzo(codigo){
  const est = DB.students.find(s=>s.codigo===codigo);
  if(!est) return;
  if(est.estado==='entregado'){
    mostrarToast('Este estudiante ya recibió su almuerzo.','error','Entrega duplicada');
    return;
  }
  est.estado = 'entregado';
  est.horaEntrega = horaAhora();
  DB.deliveries.push({
    codigo: est.codigo, nombre: est.nombre, facultad: est.facultad,
    fecha: hoyISO(), hora: est.horaEntrega
  });
  await guardarDatos();
  renderTodoElPanel();
  mostrarToast(`Almuerzo entregado a ${est.nombre}.`,'success','Entrega registrada');
}

/* =========================================================
   RENDER: GRÁFICOS
========================================================= */
function coloresTema(){
  const dark = document.documentElement.classList.contains('dark');
  return {
    text: dark ? '#94A3B8' : '#6B7280',
    grid: dark ? '#243046' : '#E5E7EB'
  };
}

function renderGraficos(){
  const hoy = hoyISO();
  const deHoy = DB.students.filter(s=>s.fechaAlmuerzo===hoy);
  const entregados = deHoy.filter(s=>s.estado==='entregado').length;
  const pendientes = deHoy.length - entregados;
  const c = coloresTema();

  // Donut entregados vs pendientes
  if(charts.donut) charts.donut.destroy();
  charts.donut = new Chart(document.getElementById('chart-donut'), {
    type:'doughnut',
    data:{ labels:['Entregados','Pendientes'], datasets:[{ data:[entregados,pendientes], backgroundColor:['#22C55E','#FACC15'], borderWidth:0 }] },
    options:{ plugins:{ legend:{ position:'bottom', labels:{color:c.text} } }, cutout:'68%' }
  });

  // Facultades con más beneficiarios
  const porFacultad = {};
  DB.students.forEach(s=>{ porFacultad[s.facultad] = (porFacultad[s.facultad]||0)+1; });
  const labelsFac = Object.keys(porFacultad).sort((a,b)=>porFacultad[b]-porFacultad[a]);
  if(charts.facultades) charts.facultades.destroy();
  charts.facultades = new Chart(document.getElementById('chart-facultades'), {
    type:'bar',
    data:{ labels:labelsFac, datasets:[{ label:'Estudiantes', data:labelsFac.map(f=>porFacultad[f]), backgroundColor:'#1E3A8A', borderRadius:6, maxBarThickness:34 }] },
    options:{ plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:c.text},grid:{display:false}}, y:{ticks:{color:c.text},grid:{color:c.grid}} } }
  });

  // Entregas por hora (hoy)
  const porHora = {};
  DB.deliveries.filter(d=>d.fecha===hoy).forEach(d=>{
    const h = d.hora.split(':')[0]+':00';
    porHora[h] = (porHora[h]||0)+1;
  });
  const horasOrdenadas = Object.keys(porHora).sort();
  if(charts.horas) charts.horas.destroy();
  charts.horas = new Chart(document.getElementById('chart-horas'), {
    type:'bar',
    data:{ labels:horasOrdenadas, datasets:[{ label:'Entregas', data:horasOrdenadas.map(h=>porHora[h]), backgroundColor:'#22C55E', borderRadius:6, maxBarThickness:40 }] },
    options:{ plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:c.text},grid:{display:false}}, y:{ticks:{color:c.text},grid:{color:c.grid}} } }
  });
}
function refrescarGraficos(){
  if(document.getElementById('tab-estadisticas').classList.contains('active')) renderGraficos();
}

/* =========================================================
   RENDER: HISTORIAL
========================================================= */
function rangoFechas(){
  const base = document.getElementById('in-fecha-historial').value || hoyISO();
  const d = new Date(base+'T00:00:00');
  let desde = new Date(d), hasta = new Date(d);
  if(filtroHistorial==='semana'){
    const dia = d.getDay();
    desde.setDate(d.getDate()-dia);
    hasta.setDate(desde.getDate()+6);
  }else if(filtroHistorial==='mes'){
    desde = new Date(d.getFullYear(), d.getMonth(), 1);
    hasta = new Date(d.getFullYear(), d.getMonth()+1, 0);
  }
  return {desde: desde.toISOString().slice(0,10), hasta: hasta.toISOString().slice(0,10)};
}

function entregasEnRango(){
  const {desde, hasta} = rangoFechas();
  return DB.deliveries.filter(d => d.fecha>=desde && d.fecha<=hasta).sort((a,b)=> (a.fecha+a.hora) < (b.fecha+b.hora) ? 1 : -1);
}

function renderHistorial(){
  const lista = entregasEnRango();
  const tbody = document.getElementById('tbody-historial');
  const empty = document.getElementById('empty-historial');
  tbody.innerHTML = '';
  empty.style.display = lista.length===0 ? 'block' : 'none';
  lista.forEach(d=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(d.codigo)}</td><td>${escapeHtml(d.nombre)}</td><td>${escapeHtml(d.facultad)}</td><td>${escapeHtml(d.fecha)}</td><td>${escapeHtml(d.hora)}</td>`;
    tbody.appendChild(tr);
  });
}

/* =========================================================
   EXPORTACIÓN
========================================================= */
function exportar(tipo){
  const datos = entregasEnRango();
  if(datos.length===0){
    mostrarToast('No hay datos en este rango para exportar.','error','Sin datos');
    return;
  }
  const filas = datos.map(d=>({Codigo:d.codigo, Estudiante:d.nombre, Facultad:d.facultad, Fecha:d.fecha, Hora:d.hora}));

  if(tipo==='csv'){
    const encabezado = Object.keys(filas[0]).join(',');
    const cuerpo = filas.map(f=>Object.values(f).map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([encabezado+'\n'+cuerpo], {type:'text/csv;charset=utf-8;'});
    descargarBlob(blob, 'historial-comedor.csv');
  }else if(tipo==='excel'){
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
    XLSX.writeFile(wb, 'historial-comedor.xlsx');
  }else if(tipo==='pdf'){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Historial de entregas — Comedor Universitario', 14, 16);
    doc.autoTable({
      startY: 22,
      head: [['Código','Estudiante','Facultad','Fecha','Hora']],
      body: filas.map(f=>Object.values(f)),
      styles:{fontSize:9},
      headStyles:{fillColor:[30,58,138]}
    });
    doc.save('historial-comedor.pdf');
  }
  mostrarToast('Archivo generado correctamente.','success','Exportación lista');
}
function descargarBlob(blob, nombre){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

/* =========================================================
   RENDER GENERAL DEL PANEL
========================================================= */
function renderTodoElPanel(){
  renderResumen();
  renderTabla();
  if(document.getElementById('tab-estadisticas').classList.contains('active')) renderGraficos();
  if(document.getElementById('tab-historial').classList.contains('active')) renderHistorial();
}

/* =========================================================
   INICIO
========================================================= */
(async function init(){
  document.getElementById('in-fecha-historial').value = hoyISO();
  await cargarDatos();
  document.getElementById('loader-overlay').style.display='none';
  document.getElementById('app').style.display='flex';
})();
