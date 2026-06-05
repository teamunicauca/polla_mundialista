import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsB88_K4_XnNa1RHw-3rvt4v-uYV65xDU",
  authDomain: "pollamundialista-c8e8a.firebaseapp.com",
  projectId: "pollamundialista-c8e8a",
  storageBucket: "pollamundialista-c8e8a.firebasestorage.app",
  messagingSenderId: "696834090227",
  appId: "1:696834090227:web:c0dec9500a5f5ede208386"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const state = {
  currentUser: null,
  currentUserDoc: null,
  partidos: [],
  ranking: [],
  prediccionesMap: new Map(),
  pagosMap: new Map(),
  bloqueActual: "fecha_1",
  bloqueData: null,
  unsubscribers: []
};

const $ = (id) => document.getElementById(id);
const views = document.querySelectorAll(".view");
const navLinks = document.querySelectorAll("[data-view-target]");

const el = {
  sidebar: $("sidebar"),
  googleLoginBtn: $("googleLoginBtn"),
  logoutBtn: $("logoutBtn"),
  adminNavBtn: $("adminNavBtn"),
  userMini: $("userMini"),
  matchesContainer: $("matchesContainer"),
  rankingContainer: $("rankingContainer"),
  adminMatchesContainer: $("adminMatchesContainer"),
  adminPaymentsContainer: $("adminPaymentsContainer"),
  calculateBtn: $("calculateBtn"),
  kpiMisPuntos: $("kpiMisPuntos"),
  kpiMiPosicion: $("kpiMiPosicion"),
  kpiPozo: $("kpiPozo"),
  kpiPago: $("kpiPago"),
  kpiPagoDetalle: $("kpiPagoDetalle"),
  paymentBanner: $("paymentBanner"),
  paymentStatusBadge: $("paymentStatusBadge"),
  paymentStateBox: $("paymentStateBox"),
  paymentStateText: $("paymentStateText"),
  moneyBruto: $("moneyBruto"),
  moneyAdmin: $("moneyAdmin"),
  moneyPremio1: $("moneyPremio1"),
  moneyPremio2: $("moneyPremio2"),
  matchesGateMessage: $("matchesGateMessage"),
  themeToggle: $("themeToggle"),
  reporteContainer: $("reporteContainer"),
};

const formatCOP = (value) => new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
}).format(value || 0);

const formatDateTime = (date) => new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota"
}).format(date);

function showView(viewId) {
  views.forEach(v => v.classList.remove("view-active"));
  $(viewId)?.classList.add("view-active");
  navLinks.forEach(btn => btn.classList.toggle("active", btn.dataset.viewTarget === viewId));
}

navLinks.forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.viewTarget)));

el.themeToggle?.addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
});

function getFlagEmoji(name) {
  const map = {
    "México": "🇲🇽",
    "Sudáfrica": "🇿🇦",
    "Canadá": "🇨🇦",
    "Estados Unidos": "🇺🇸"
  };
  return map[name] || "🏳️";
}

function computeCutoff(matchDate) {
  return new Date(matchDate.getTime() - 60 * 60 * 1000);
}

function getCountdown(matchDate) {
  const cutoff = computeCutoff(matchDate);
  const diff = cutoff.getTime() - Date.now();
  if (diff <= 0) return { closed: true, text: "Pronósticos cerrados" };
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return { closed: false, text: `Cierra en ${hours}h ${rem}m` };
}

function getPaymentDocId(uid, bloque = state.bloqueActual) {
  return `${uid}_${bloque}`;
}

function currentPayment() {
  if (!state.currentUser) return null;
  const docId = getPaymentDocId(state.currentUser.uid);
  return state.pagosMap.get(docId);
}

function isPaymentApproved() {
  return currentPayment()?.estado === "aprobado";
}

async function upsertUserProfile(user) {
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      nombre: user.displayName || "",
      email: user.email || "",
      fotoURL: user.photoURL || "",
      puntos_totales: 0,
      cantidad_exactos: 0,
      cantidad_tendencias: 0,
      fecha_inscripcion: serverTimestamp(),
      esAdmin: false
    }, { merge: true });
  } else {
    await setDoc(ref, {
      nombre: user.displayName || "",
      email: user.email || "",
      fotoURL: user.photoURL || ""
    }, { merge: true });
  }

  const pagoRef = doc(db, "pagos", getPaymentDocId(user.uid));
  const pagoSnap = await getDoc(pagoRef);

  if (!pagoSnap.exists()) {
    await setDoc(pagoRef, {
      uid: user.uid,
      bloque: state.bloqueActual,
      valor: 10000,
      estado: "pendiente",
      metodo: "nequi",
      referencia: "",
      soporteUrl: "",
      soportePath: "",
      observacionUsuario: "",
      observacionAdmin: "",
      fecha_registro: serverTimestamp(),
      fecha_solicitud: null,
      fecha_validacion: null,
      revisadoPor: ""
    }, { merge: true });
  }
}

function renderProfile() {
  if (!state.currentUser) return;
  el.userMini.innerHTML = `
    <img src="${state.currentUser.photoURL || ""}" alt="Foto de perfil" referrerpolicy="no-referrer">
    <div>
      <strong>${state.currentUser.displayName || "Usuario"}</strong>
      <div class="meta">${state.currentUser.email || ""}</div>
    </div>
  `;
}

function renderPaymentUI() {
  const pago = currentPayment();
  if (!pago) return;
  
  const estado = pago.estado ?? "pendiente";
  const aprobado = estado === "aprobado";
  const enRevision = estado === "revision";
  const rechazado = estado === "rechazado";

  el.kpiPago.textContent = aprobado ? "Aprobado" : enRevision ? "En revisión" : rechazado ? "Rechazado" : "Pendiente";
  el.kpiPagoDetalle.textContent = aprobado
    ? "✅ Ya puedes pronosticar esta fecha"
    : enRevision
      ? "⏳ Tu pago está pendiente de revisión"
      : rechazado
        ? "❌ Pago rechazado. Debes enviar uno nuevo"
        : "💰 Debes pagar para participar";

  el.paymentStatusBadge.textContent = aprobado ? "Aprobado" : enRevision ? "En revisión" : rechazado ? "Rechazado" : "Pendiente";
  el.paymentStatusBadge.className = `pill ${
    aprobado ? "pill-accent" : enRevision ? "pill-warning" : rechazado ? "pill-danger" : ""
  }`;

  if (aprobado) {
    el.paymentBanner.className = "inline-status ok";
    el.paymentBanner.innerHTML = `
      <strong>✅ Pago validado.</strong><br>
      Tu acceso a los pronósticos está habilitado.
    `;
    el.paymentStateBox.innerHTML = `
      <h4>✅ Pago confirmado</h4>
      <p>Tu aporte para esta fecha ya fue validado.</p>
      <p>Ya puedes realizar tus pronósticos.</p>
    `;
    return;
  }

  if (enRevision) {
    el.paymentBanner.className = "inline-status pending";
    el.paymentBanner.innerHTML = `
      <strong>⏳ Pago en revisión.</strong><br>
      El administrador revisará tu información pronto.
    `;
    el.paymentStateBox.innerHTML = `
      <h4>⏳ Pago en revisión</h4>
      <p><strong>Referencia:</strong> ${pago.referencia || "Sin referencia"}</p>
      <p>Tu pago está pendiente de validación.</p>
      <p class="helper">Recibirás confirmación cuando sea aprobado.</p>
    `;
    return;
  }

  const motivoRechazo = rechazado && pago.observacionAdmin ? `<p class="danger"><strong>Motivo:</strong> ${pago.observacionAdmin}</p>` : "";
  
  el.paymentBanner.className = "inline-status pending";
  el.paymentBanner.innerHTML = rechazado
    ? `<strong>❌ Pago rechazado.</strong><br>Revisa el motivo y registra uno nuevo.`
    : `<strong>💰 Pago pendiente.</strong><br>Realiza tu pago por Nequi y registra tus datos.`;

  el.paymentStateBox.innerHTML = `
    <h4>${rechazado ? "📤 Registrar nuevo pago" : "💳 Instrucciones"}</h4>
    ${motivoRechazo}
    <div class="payment-details">
      <p><strong>Valor:</strong> ${formatCOP(pago.valor || 10000)}</p>
      <p><strong>📱 Nequi / Daviplata:</strong> <strong class="highlight">300 346 8482</strong></p>
      <p><strong>🔑 Llave Nequi:</strong> <strong class="highlight">3003468482</strong></p>
      <p class="helper">💡 ¿Tienes pantallazo? Envíalo por WhatsApp al <strong>300 346 8482</strong> (opcional)</p>
    </div>
    
    <div class="payment-proof-box">
      <label for="paymentReferenceInput">📱 Tu número de celular o llave Nequi *</label>
      <input id="paymentReferenceInput" type="text" placeholder="Ej: 3001234567" value="${pago.referencia || ""}">
      
      <label for="paymentObservationInput">📝 Observación (opcional)</label>
      <textarea id="paymentObservationInput" placeholder="Información adicional sobre tu pago">${pago.observacionUsuario || ""}</textarea>
      
      <button id="sendPaymentProofBtn" class="btn btn-primary">${rechazado ? "Registrar pago" : "✅ Ya pagué, registrar"}</button>
    </div>
  `;

  const oldBtn = document.getElementById("sendPaymentProofBtn");
  if (oldBtn) {
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener("click", sendPaymentProof);
  }
}

async function sendPaymentProof() {
  const referencia = document.getElementById("paymentReferenceInput")?.value?.trim();
  const observacionUsuario = document.getElementById("paymentObservationInput")?.value?.trim() || "";

  if (!referencia) {
    alert("❌ Debes ingresar tu número de celular o llave Nequi.");
    return;
  }

  if (!state.currentUser) {
    alert("❌ No hay usuario logueado.");
    return;
  }

  try {
    const pagoRef = doc(db, "pagos", getPaymentDocId(state.currentUser.uid));
    
    await setDoc(pagoRef, {
      estado: "revision",
      referencia: referencia,
      observacionUsuario: observacionUsuario,
      fecha_solicitud: serverTimestamp()
    }, { merge: true });

    alert("✅ Pago registrado correctamente. Queda pendiente de revisión.");
    
    const refInput = document.getElementById("paymentReferenceInput");
    if (refInput) refInput.value = "";
    const obsInput = document.getElementById("paymentObservationInput");
    if (obsInput) obsInput.value = "";
    
    renderPaymentUI();
    
  } catch (error) {
    console.error("Error detallado:", error);
    alert("❌ No fue posible registrar el pago: " + error.message);
  }
}

function recalcPoolFromPayments() {
  const pagos = [...state.pagosMap.values()].filter(p => p.bloque === state.bloqueActual && p.estado === "aprobado");
  const bruto = pagos.length * 10000;
  const admin = bruto * 0.15;
  const premio1 = bruto * 0.70;
  const premio2 = bruto * 0.15;

  el.kpiPozo.textContent = formatCOP(bruto);
  el.moneyBruto.textContent = formatCOP(bruto);
  el.moneyAdmin.textContent = formatCOP(admin);
  el.moneyPremio1.textContent = formatCOP(premio1);
  el.moneyPremio2.textContent = formatCOP(premio2);
}

function renderMatches() {
  const approved = isPaymentApproved();
  el.matchesGateMessage.innerHTML = approved ? "" : `<div class="card-gate">⚠️ Tu pago de esta fase está pendiente. Puedes ver los partidos, pero no guardar pronósticos hasta ser aprobado.</div>`;

  // Contar pronósticos realizados
  const totalPartidos = state.partidos.length;
  const pronosticados = state.partidos.filter(partido => {
    const predId = `${state.currentUser.uid}_${partido.id}`;
    return state.prediccionesMap.has(predId);
  }).length;
  
  const progressPercent = totalPartidos > 0 ? (pronosticados / totalPartidos) * 100 : 0;
  
  const progressHtml = `
    <div class="progress-container glass-card">
      <div class="progress-header">
        <span>📊 Progreso de pronósticos</span>
        <strong>${pronosticados} / ${totalPartidos} partidos</strong>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
      </div>
      <p class="progress-hint">${progressPercent === 100 ? '🎉 ¡Completaste todos los pronósticos de esta fase!' : '💡 Recuerda: puedes modificar tus pronósticos hasta 1 hora antes del partido'}</p>
    </div>
  `;

  let matchesHtml = progressHtml;
  matchesHtml += `<div class="cards-grid">`;
  
  matchesHtml += state.partidos.map(partido => {
    const date = partido.fecha_hora.toDate();
    const countdown = getCountdown(date);
    const predId = `${state.currentUser.uid}_${partido.id}`;
    const pred = state.prediccionesMap.get(predId);
    const local = pred?.goles_pred_local ?? 0;
    const visita = pred?.goles_pred_visita ?? 0;
    const locked = countdown.closed || !approved;
    const reasonBadge = countdown.closed
      ? `<span class="badge danger">Pronósticos cerrados</span>`
      : approved
        ? `<span class="badge success">Habilitado</span>`
        : `<span class="badge warning">Pago pendiente</span>`;

    return `
      <article class="glass-card match-card">
        <div class="match-head">
          <div>
            <div class="meta">${formatDateTime(date)}</div>
            <div class="countdown">${countdown.text}</div>
          </div>
          ${reasonBadge}
        </div>

        <div class="team-block">
          <div class="team-line"><span><span class="flag">${getFlagEmoji(partido.equipo_local)}</span> ${partido.equipo_local}</span></div>
          <div class="team-line"><span><span class="flag">${getFlagEmoji(partido.equipo_visita)}</span> ${partido.equipo_visita}</span></div>
        </div>

        <div class="score-grid">
          <div class="score-box">
            <label for="local_${partido.id}">Goles local</label>
            <div class="stepper">
              <button data-step="down" data-input="local_${partido.id}" ${locked ? "disabled" : ""}>-</button>
              <input id="local_${partido.id}" type="number" min="0" max="20" value="${local}" ${locked ? "disabled" : ""}>
              <button data-step="up" data-input="local_${partido.id}" ${locked ? "disabled" : ""}>+</button>
            </div>
          </div>
          <div class="score-box">
            <label for="visita_${partido.id}">Goles visita</label>
            <div class="stepper">
              <button data-step="down" data-input="visita_${partido.id}" ${locked ? "disabled" : ""}>-</button>
              <input id="visita_${partido.id}" type="number" min="0" max="20" value="${visita}" ${locked ? "disabled" : ""}>
              <button data-step="up" data-input="visita_${partido.id}" ${locked ? "disabled" : ""}>+</button>
            </div>
          </div>
        </div>

        <div class="match-footer">
          <span class="pill">${partido.bloque === 'fecha_1' ? 'Fase 1' : partido.bloque === 'fecha_2' ? 'Fase 2' : 'Fase 3'}</span>
          ${!locked && `<button class="btn btn-primary save-prediction-btn" data-match-id="${partido.id}">${pred ? "Actualizar pronóstico" : "Guardar pronóstico"}</button>`}
        </div>
      </article>
    `;
  }).join("");
  
  matchesHtml += `</div>`;
  el.matchesContainer.innerHTML = matchesHtml;

  el.matchesContainer.querySelectorAll("[data-step]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.input);
      const current = Number(input.value || 0);
      input.value = btn.dataset.step === "up" ? current + 1 : Math.max(0, current - 1);
    });
  });

  el.matchesContainer.querySelectorAll(".save-prediction-btn").forEach(btn => {
    btn.addEventListener("click", () => savePrediction(btn.dataset.matchId));
  });
}
// ==================== REPORTE DE RESULTADOS ====================

// Verifica si una fase está completamente finalizada (todos los partidos tienen resultado)
function isFaseFinalizada(partidosFase) {
  if (!partidosFase || partidosFase.length === 0) return false;
  return partidosFase.every(partido => partido.estado === "finalizado" && 
    partido.goles_reales_local !== undefined && 
    partido.goles_reales_visita !== undefined);
}

// Calcula puntos para un usuario en una fase específica
function calcularPuntosUsuarioEnFase(uid, partidosFase, prediccionesMap) {
  let totalPuntos = 0;
  let exactos = 0;
  let tendencias = 0;
  let detalles = [];

  for (const partido of partidosFase) {
    const predKey = `${uid}_${partido.id}`;
    const pred = prediccionesMap.get(predKey);
    
    if (!pred) {
      detalles.push({
        partido: `${partido.equipo_local} vs ${partido.equipo_visita}`,
        resultado: partido.estado === "finalizado" ? `${partido.goles_reales_local} - ${partido.goles_reales_visita}` : "No jugado",
        pronostico: "No pronosticó",
        puntos: 0
      });
      continue;
    }

    let puntos = 0;
    let tipo = "";
    
    if (partido.estado === "finalizado") {
      const esExacto = pred.goles_pred_local === partido.goles_reales_local && 
                       pred.goles_pred_visita === partido.goles_reales_visita;
      const esTendencia = !esExacto && getOutcome(pred.goles_pred_local, pred.goles_pred_visita) === 
                         getOutcome(partido.goles_reales_local, partido.goles_reales_visita);
      
      if (esExacto) {
        puntos = 3;
        tipo = "✅ Exacto (+3)";
        exactos++;
      } else if (esTendencia) {
        puntos = 1;
        tipo = "📈 Tendencia (+1)";
        tendencias++;
      } else {
        tipo = "❌ Error (0)";
      }
      
      totalPuntos += puntos;
      detalles.push({
        partido: `${partido.equipo_local} vs ${partido.equipo_visita}`,
        resultado: `${partido.goles_reales_local} - ${partido.goles_reales_visita}`,
        pronostico: `${pred.goles_pred_local} - ${pred.goles_pred_visita}`,
        puntos: puntos,
        tipo: tipo
      });
    } else {
      detalles.push({
        partido: `${partido.equipo_local} vs ${partido.equipo_visita}`,
        resultado: "Pendiente",
        pronostico: `${pred.goles_pred_local} - ${pred.goles_pred_visita}`,
        puntos: 0,
        tipo: "⏳ Pendiente"
      });
    }
  }

  return { totalPuntos, exactos, tendencias, detalles };
}

// Renderiza el reporte completo
// ==================== REPORTE DE RESULTADOS (VERSIÓN COMPACTA) ====================

// Mapeo de nombres de equipos a siglas FIFA
const siglasEquipos = {
  // Grupo A
  "México": "MEX",
  "Sudáfrica": "RSA",
  "República de Corea": "KOR",
  "Corea del Sur": "KOR",
  "Chequia": "CZE",
  "República Checa": "CZE",
  
  // Grupo B
  "Canadá": "CAN",
  "Bosnia y Herzegovina": "BIH",
  "Catar": "QAT",
  "Suiza": "SUI",
  
  // Grupo C
  "Brasil": "BRA",
  "Marruecos": "MAR",
  "Haití": "HAI",
  "Escocia": "SCO",
  
  // Grupo D
  "Estados Unidos": "USA",
  "EE. UU.": "USA",
  "Paraguay": "PAR",
  "Australia": "AUS",
  "Turquía": "TUR",
  
  // Grupo E
  "Alemania": "GER",
  "Curazao": "CUW",
  "Costa de Marfil": "CIV",
  "Ecuador": "ECU",
  
  // Grupo F
  "Países Bajos": "NED",
  "Japón": "JPN",
  "Suecia": "SWE",
  "Túnez": "TUN",
  
  // Grupo G
  "Bélgica": "BEL",
  "Egipto": "EGY",
  "Irán": "IRN",
  "Nueva Zelanda": "NZL",
  
  // Grupo H
  "España": "ESP",
  "Cabo Verde": "CPV",
  "Arabia Saudita": "KSA",
  "Uruguay": "URU",
  
  // Grupo I
  "Francia": "FRA",
  "Senegal": "SEN",
  "Irak": "IRQ",
  "Noruega": "NOR",
  
  // Grupo J
  "Argentina": "ARG",
  "Argelia": "ALG",
  "Austria": "AUT",
  "Jordania": "JOR",
  
  // Grupo K
  "Portugal": "POR",
  "RD Congo": "COD",
  "República Democrática del Congo": "COD",
  "Uzbekistán": "UZB",
  "Colombia": "COL",
  
  // Grupo L
  "Inglaterra": "ENG",
  "Croacia": "CRO",
  "Ghana": "GHA",
  "Panamá": "PAN"
};

// Obtener sigla del equipo
function getSiglaEquipo(nombre) {
  return siglasEquipos[nombre] || nombre.substring(0, 3).toUpperCase();
}

// Calcula puntos para un usuario en una fase específica (versión optimizada para tabla)
// Calcula puntos para un usuario en una fase específica (versión para TODOS los usuarios)
function calcularPuntosUsuarioEnFaseCompacto(uid, partidosFase, todasLasPrediccionesMap) {
  let totalPuntos = 0;
  let partidosData = [];

  for (const partido of partidosFase) {
    const predKey = `${uid}_${partido.id}`;
    const pred = todasLasPrediccionesMap.get(predKey);
    
    let pronosticoLocal = "---";
    let pronosticoVisita = "---";
    let puntos = 0;
    
    if (pred) {
      pronosticoLocal = pred.goles_pred_local;
      pronosticoVisita = pred.goles_pred_visita;
      
      if (partido.estado === "finalizado") {
        const esExacto = pred.goles_pred_local === partido.goles_reales_local && 
                         pred.goles_pred_visita === partido.goles_reales_visita;
        const esTendencia = !esExacto && 
          getOutcome(pred.goles_pred_local, pred.goles_pred_visita) === 
          getOutcome(partido.goles_reales_local, partido.goles_reales_visita);
        
        if (esExacto) {
          puntos = 3;
        } else if (esTendencia) {
          puntos = 1;
        }
      }
    }
    
    totalPuntos += puntos;
    partidosData.push({
      resultado: `${pronosticoLocal}-${pronosticoVisita}`,
      puntos: puntos
    });
  }
  
  return { totalPuntos, partidosData };
}

// Renderiza el reporte compacto (estilo tabla) - VERSIÓN CORREGIDA
async function renderReporte() {
  const faseSeleccionada = document.getElementById("selectorFechaReporte")?.value || state.bloqueActual;
  
  // Filtrar partidos por fase
  const partidosFase = state.partidos.filter(p => p.bloque === faseSeleccionada);
  
  if (partidosFase.length === 0) {
    if (el.reporteContainer) {
      el.reporteContainer.innerHTML = '<div class="glass-card panel-card"><p>No hay partidos registrados para esta fase.</p></div>';
    }
    return;
  }

  const faseFinalizada = isFaseFinalizada(partidosFase);
  const esAdmin = state.currentUserDoc?.esAdmin || false;
  
  // Si no es admin y la fase no está finalizada, no mostrar el reporte
  if (!esAdmin && !faseFinalizada) {
    if (el.reporteContainer) {
      el.reporteContainer.innerHTML = `
        <div class="glass-card panel-card">
          <div class="panel-head">
            <h3>🔒 Reporte no disponible</h3>
          </div>
          <p>El reporte de resultados estará disponible una vez que todos los partidos de esta fase estén finalizados.</p>
          <p class="helper">📅 Vuelve más tarde para ver quién ganó esta fase y con qué puntajes.</p>
        </div>
      `;
    }
    return;
  }

  // 🔥 IMPORTANTE: Crear un Map con TODAS las predicciones de TODOS los usuarios
  const todasLasPrediccionesMap = new Map();
  
  // Obtener todas las predicciones desde Firestore (no solo del usuario actual)
  const prediccionesSnapshot = await getDocs(collection(db, "predicciones"));
  for (const docSnap of prediccionesSnapshot.docs) {
    todasLasPrediccionesMap.set(docSnap.id, docSnap.data());
  }
  
  // También puedes combinar con las que ya tienes en state si están actualizadas
  // pero para asegurar, usamos las de Firestore directamente

  // Obtener todos los usuarios
  const usuariosSet = new Set();
  for (const user of state.ranking) {
    usuariosSet.add(user.uid);
  }
  
  // Calcular datos por usuario
  const usuariosData = [];
  for (const uid of usuariosSet) {
    const userInfo = state.ranking.find(u => u.uid === uid);
    const nombre = userInfo?.nombre || userInfo?.email || uid.substring(0, 8);
    const esAdminUser = userInfo?.esAdmin || false;
    
    const { totalPuntos, partidosData } = calcularPuntosUsuarioEnFaseCompacto(uid, partidosFase, todasLasPrediccionesMap);
    
    usuariosData.push({
      uid,
      nombre,
      esAdmin: esAdminUser,
      totalPuntos,
      partidosData
    });
  }
  
  // Ordenar por puntos (mayor a menor)
  usuariosData.sort((a, b) => b.totalPuntos - a.totalPuntos);
  
  // Generar cabeceras de la tabla
  const faseNombre = faseSeleccionada === 'fecha_1' ? 'Fase 1' : faseSeleccionada === 'fecha_2' ? 'Fase 2' : 'Fase 3';
  const titulo = faseFinalizada ? '🏆 FASE FINALIZADA' : '📊 REPORTE EN VIVO (Admin)';
  
  // Cabeceras: Nombre + por cada partido: (sigla_local-sigla_visita) + Pts + luego Total
  let headerRow = '<th class="col-nombre">👤 Usuario</th>';
  
  for (let i = 0; i < partidosFase.length; i++) {
    const p = partidosFase[i];
    const siglaLocal = getSiglaEquipo(p.equipo_local);
    const siglaVisita = getSiglaEquipo(p.equipo_visita);
    headerRow += `<th class="col-partido">${siglaLocal}-${siglaVisita}</th>`;
    headerRow += `<th class="col-puntos-mini">Pts</th>`;
  }
  headerRow += '<th class="col-total">🎯 Total</th>';
  
  // Generar filas de la tabla
  let tableRows = '';
  for (let idx = 0; idx < usuariosData.length; idx++) {
    const user = usuariosData[idx];
    const posicion = idx + 1;
    const medalClass = posicion === 1 ? 'row-gold' : posicion === 2 ? 'row-silver' : posicion === 3 ? 'row-bronze' : '';
    const medalEmoji = posicion === 1 ? '🥇' : posicion === 2 ? '🥈' : posicion === 3 ? '🥉' : `${posicion}.`;
    
    let row = `<tr class="${medalClass}">`;
    row += `<td class="col-nombre"><span class="medal">${medalEmoji}</span> ${user.nombre}${user.esAdmin ? ' 👑' : ''}</td>`;
    
    for (let i = 0; i < partidosFase.length; i++) {
      const partidoData = user.partidosData[i] || { resultado: "---", puntos: 0 };
      const puntosClass = partidoData.puntos === 3 ? 'pts-exacto' : partidoData.puntos === 1 ? 'pts-tendencia' : 'pts-cero';
      
      row += `<td class="col-resultado">${partidoData.resultado}</td>`;
      row += `<td class="col-puntos-mini ${puntosClass}">${partidoData.puntos > 0 ? partidoData.puntos : ''}</td>`;
    }
    
    row += `<td class="col-total"><strong>${user.totalPuntos}</strong></td>`;
    row += `</tr>`;
    tableRows += row;
  }
  
  // Si no hay datos
  if (usuariosData.length === 0) {
    tableRows = `<tr><td colspan="${partidosFase.length * 2 + 2}" style="text-align: center;">No hay usuarios con pronósticos en esta fase.</td></tr>`;
  }
  
  // HTML completo del reporte
  const html = `
    <div class="reporte-header-compact glass-card">
      <div>
        <h3>${titulo}</h3>
        <p class="meta">${faseNombre} · ${partidosFase.length} partidos · ${usuariosData.length} participantes</p>
      </div>
      <div class="reporte-legend">
        <span class="legend-exacto">■ Exacto (3pts)</span>
        <span class="legend-tendencia">■ Tendencia (1pt)</span>
        <span class="legend-error">■ Error (0pts)</span>
        <span class="legend-sin">■ Sin pronóstico (---)</span>
      </div>
    </div>
    
    <div class="reporte-table-container">
      <table class="reporte-table-compact">
        <thead>
          <tr>${headerRow}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
  
  if (el.reporteContainer) {
    el.reporteContainer.innerHTML = html;
  }
}


// Inicializar selector de fechas para el reporte
function initReporteFechaSelector() {
  const selector = document.getElementById("selectorFechaReporte");
  if (!selector) return;
  
  selector.addEventListener("change", () => {
    renderReporte();
  });
}
async function savePrediction(matchId) {
  if (!isPaymentApproved()) {
    alert("Tu pago aún no ha sido aprobado.");
    return;
  }

  const match = state.partidos.find(p => p.id === matchId);
  if (!match) return;
  const countdown = getCountdown(match.fecha_hora.toDate());
  if (countdown.closed) {
    alert("Los pronósticos para este partido ya están cerrados.");
    return;
  }

  const golesLocal = Math.max(0, Number(document.getElementById(`local_${matchId}`).value || 0));
  const golesVisita = Math.max(0, Number(document.getElementById(`visita_${matchId}`).value || 0));

  try {
    await setDoc(doc(db, "predicciones", `${state.currentUser.uid}_${matchId}`), {
      uid: state.currentUser.uid,
      partidoId: matchId,
      goles_pred_local: golesLocal,
      goles_pred_visita: golesVisita,
      puntos_ganados: 0,
      fecha_registro: serverTimestamp()
    }, { merge: false });
    alert("Pronóstico guardado correctamente.");
  } catch (error) {
    alert(`Error al guardar: ${error.message}`);
  }
}

function sortRanking(arr) {
  return [...arr].sort((a, b) => {
    if ((b.puntos_totales || 0) !== (a.puntos_totales || 0)) return (b.puntos_totales || 0) - (a.puntos_totales || 0);
    if ((b.cantidad_exactos || 0) !== (a.cantidad_exactos || 0)) return (b.cantidad_exactos || 0) - (a.cantidad_exactos || 0);
    if ((b.cantidad_tendencias || 0) !== (a.cantidad_tendencias || 0)) return (b.cantidad_tendencias || 0) - (a.cantidad_tendencias || 0);
    const aTime = a.fecha_inscripcion?.toMillis?.() || Number.MAX_SAFE_INTEGER;
    const bTime = b.fecha_inscripcion?.toMillis?.() || Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

function renderRanking() {
  const sorted = sortRanking(state.ranking);
  const top = sorted.slice(0, 10);
  const myIndex = sorted.findIndex(u => u.uid === state.currentUser.uid);
  const meVisible = top.some(u => u.uid === state.currentUser.uid);
  el.kpiMiPosicion.textContent = myIndex >= 0 ? `#${myIndex + 1}` : "-";

  let html = top.map((user, index) => `
    <article class="ranking-item ${index === 0 ? "first" : index === 1 ? "second" : ""}">
      <div class="ranking-pos">#${index + 1}</div>
      <div>
        <strong>${user.nombre || user.email}</strong>
        <div class="meta">Exactos: ${user.cantidad_exactos || 0} · Tendencias: ${user.cantidad_tendencias || 0}</div>
      </div>
      <div class="ranking-score"><strong>${user.puntos_totales || 0} pts</strong></div>
    </article>
  `).join("");

  if (!meVisible && myIndex >= 0) {
    const me = sorted[myIndex];
    html += `
      <article class="ranking-item">
        <div class="ranking-pos">#${myIndex + 1}</div>
        <div>
          <strong>${me.nombre || me.email} (Tú)</strong>
          <div class="meta">Exactos: ${me.cantidad_exactos || 0} · Tendencias: ${me.cantidad_tendencias || 0}</div>
        </div>
        <div class="ranking-score"><strong>${me.puntos_totales || 0} pts</strong></div>
      </article>
    `;
  }

  el.rankingContainer.innerHTML = html;
}

function renderAdminPayments() {
  if (!state.currentUserDoc?.esAdmin) {
    el.adminPaymentsContainer.innerHTML = "";
    return;
  }

  const pagos = [...state.pagosMap.values()].filter(p => p.bloque === state.bloqueActual);

  if (!pagos.length) {
    el.adminPaymentsContainer.innerHTML = `
      <div class="admin-row">
        <div class="admin-main">No hay pagos registrados aún.</div>
      </div>
    `;
    return;
  }

  const usuariosMap = new Map();
  state.ranking.forEach(user => {
    usuariosMap.set(user.uid, {
      nombre: user.nombre || user.email || user.uid,
      email: user.email || ""
    });
  });

  el.adminPaymentsContainer.innerHTML = pagos.map(pago => {
    const usuario = usuariosMap.get(pago.uid) || {
      nombre: pago.uid,
      email: ""
    };
    
    let estadoTexto = "";
    let estadoColor = "";
    switch (pago.estado) {
      case "aprobado":
        estadoTexto = "✅ Aprobado";
        estadoColor = "color: #10b981;";
        break;
      case "revision":
        estadoTexto = "⏳ En revisión";
        estadoColor = "color: #f59e0b;";
        break;
      case "rechazado":
        estadoTexto = "❌ Rechazado";
        estadoColor = "color: #ef4444;";
        break;
      default:
        estadoTexto = "💰 Pendiente";
        estadoColor = "color: #6b7280;";
    }

    return `
      <div class="admin-row">
        <div class="admin-main">
          <strong style="font-size: 1rem;">👤 ${usuario.nombre}</strong>
          ${usuario.email ? `<div class="meta" style="font-size: 0.85rem;">📧 ${usuario.email}</div>` : ""}
          <div class="meta" style="font-size: 0.8rem; margin-top: 4px;">🆔 <span style="font-family: monospace; font-size: 0.75rem;">${pago.uid}</span></div>
          <div class="meta" style="margin-top: 8px;">
            💰 ${formatCOP(pago.valor || 10000)} · <span style="${estadoColor}">${estadoTexto}</span>
          </div>
          <div class="meta">📱 Referencia: <strong>${pago.referencia || "Sin referencia"}</strong></div>
          <div class="meta">📝 Observación: ${pago.observacionUsuario || "Sin observación"}</div>
          ${pago.observacionAdmin ? `<div class="meta" style="color: #ef4444;">⚠️ Admin: ${pago.observacionAdmin}</div>` : ""}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-secondary approve-payment-btn" data-payment-id="${pago.id}" ${pago.estado === "aprobado" ? "disabled" : ""}>
            ${pago.estado === "aprobado" ? "✅ Aprobado" : "👍 Aprobar"}
          </button>
          <button class="btn btn-secondary reject-payment-btn" data-payment-id="${pago.id}" ${pago.estado === "aprobado" ? "disabled" : ""}>
            👎 Rechazar
          </button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".approve-payment-btn").forEach(btn => {
    btn.addEventListener("click", () => approvePayment(btn.dataset.paymentId));
  });

  document.querySelectorAll(".reject-payment-btn").forEach(btn => {
    btn.addEventListener("click", () => rejectPayment(btn.dataset.paymentId));
  });
}

async function approvePayment(paymentId) {
  try {
    const pagoRef = doc(db, "pagos", paymentId);
    await setDoc(pagoRef, {
      estado: "aprobado",
      metodo: "manual_admin",
      fecha_validacion: serverTimestamp(),
      revisadoPor: state.currentUser.uid,
      observacionAdmin: ""
    }, { merge: true });
    
    alert("✅ Pago aprobado correctamente");
    renderAdminPayments();
    
  } catch (error) {
    console.error("Error al aprobar:", error);
    alert("❌ Error al aprobar: " + error.message);
  }
}

async function rejectPayment(paymentId) {
  const motivo = prompt("Motivo del rechazo:", "Número de celular incorrecto o no se encontró el pago");
  if (!motivo) return;
  
  try {
    const pagoRef = doc(db, "pagos", paymentId);
    await setDoc(pagoRef, {
      estado: "rechazado",
      fecha_validacion: serverTimestamp(),
      revisadoPor: state.currentUser.uid,
      observacionAdmin: motivo
    }, { merge: true });
    
    alert("❌ Pago rechazado correctamente");
    renderAdminPayments();
    
  } catch (error) {
    console.error("Error al rechazar:", error);
    alert("❌ Error al rechazar: " + error.message);
  }
}

function renderAdminMatches() {
  if (!state.currentUserDoc?.esAdmin) {
    el.adminMatchesContainer.innerHTML = "";
    return;
  }

  el.adminMatchesContainer.innerHTML = state.partidos.map(partido => `
    <div class="admin-row">
      <div class="admin-main">
        <strong>${partido.equipo_local} vs ${partido.equipo_visita}</strong>
        <div class="meta">${formatDateTime(partido.fecha_hora.toDate())}</div>
      </div>
      <div class="admin-score">
        <input type="number" min="0" id="real_local_${partido.id}" value="${partido.goles_reales_local ?? ""}" placeholder="L">
        <input type="number" min="0" id="real_visita_${partido.id}" value="${partido.goles_reales_visita ?? ""}" placeholder="V">
        <button class="btn btn-secondary save-result-btn" data-match-id="${partido.id}">Guardar</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".save-result-btn").forEach(btn => {
    btn.addEventListener("click", () => saveOfficialResult(btn.dataset.matchId));
  });
}

async function saveOfficialResult(matchId) {
  const golesLocal = Number(document.getElementById(`real_local_${matchId}`).value);
  const golesVisita = Number(document.getElementById(`real_visita_${matchId}`).value);
  if (Number.isNaN(golesLocal) || Number.isNaN(golesVisita)) {
    alert("Ingresa ambos marcadores oficiales.");
    return;
  }
  await updateDoc(doc(db, "partidos", matchId), {
    goles_reales_local: golesLocal,
    goles_reales_visita: golesVisita,
    estado: "finalizado"
  });
  alert("Marcador oficial guardado.");
}

function getOutcome(local, visita) {
  if (local > visita) return "L";
  if (local < visita) return "V";
  return "E";
}

function scorePrediction(predL, predV, realL, realV) {
  if (predL === realL && predV === realV) return { puntos: 3, exacto: 1, tendencia: 0 };
  if (getOutcome(predL, predV) === getOutcome(realL, realV)) return { puntos: 1, exacto: 0, tendencia: 1 };
  return { puntos: 0, exacto: 0, tendencia: 0 };
}

async function calcularFecha() {
  if (!state.currentUserDoc?.esAdmin) {
    alert("No tienes permisos de administrador");
    return;
  }

  const partidosFinalizados = state.partidos.filter(p => p.estado === "finalizado");
  
  if (!partidosFinalizados.length) {
    alert("No hay partidos finalizados para calcular.");
    return;
  }

  console.log("Partidos a calcular:", partidosFinalizados.length);
  
  const predSnap = await getDocs(collection(db, "predicciones"));
  const usuariosAcum = new Map();
  const batch = writeBatch(db);

  predSnap.forEach(predDoc => {
    const pred = predDoc.data();
    const partido = partidosFinalizados.find(p => p.id === pred.partidoId);
    if (!partido) return;

    const result = scorePrediction(
      pred.goles_pred_local,
      pred.goles_pred_visita,
      partido.goles_reales_local,
      partido.goles_reales_visita
    );

    batch.update(doc(db, "predicciones", predDoc.id), { puntos_ganados: result.puntos });

    if (!usuariosAcum.has(pred.uid)) {
      usuariosAcum.set(pred.uid, { puntos: 0, exactos: 0, tendencias: 0 });
    }
    const acc = usuariosAcum.get(pred.uid);
    acc.puntos += result.puntos;
    acc.exactos += result.exacto;
    acc.tendencias += result.tendencia;
  });

  for (const [uid, acc] of usuariosAcum) {
    const userRef = doc(db, "usuarios", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const puntosActuales = userSnap.data().puntos_totales || 0;
      const exactosActuales = userSnap.data().cantidad_exactos || 0;
      const tendenciasActuales = userSnap.data().cantidad_tendencias || 0;
      
      batch.update(userRef, {
        puntos_totales: puntosActuales + acc.puntos,
        cantidad_exactos: exactosActuales + acc.exactos,
        cantidad_tendencias: tendenciasActuales + acc.tendencias
      });
    }
  }

  await batch.commit();
  alert("Fecha calculada correctamente.");
  console.log("✅ Cálculo completado");
}

el.calculateBtn?.addEventListener("click", calcularFecha);
el.googleLoginBtn?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert(`No fue posible iniciar sesión: ${error.message}`);
  }
});
el.logoutBtn?.addEventListener("click", async () => signOut(auth));

function clearListeners() {
  state.unsubscribers.forEach(fn => fn && fn());
  state.unsubscribers = [];
}

function setupRealtime(user) {
  clearListeners();

  state.unsubscribers.push(onSnapshot(doc(db, "usuarios", user.uid), snap => {
    state.currentUserDoc = snap.exists() ? snap.data() : null;
    el.kpiMisPuntos.textContent = state.currentUserDoc?.puntos_totales || 0;
    el.adminNavBtn.classList.toggle("hidden", !state.currentUserDoc?.esAdmin);
    renderAdminPayments();
    renderAdminMatches();
    renderReporte(); // ← Actualizar reporte cuando cambia el admin
  }));

  state.unsubscribers.push(onSnapshot(query(collection(db, "partidos"), where("bloque", "==", state.bloqueActual)), snap => {
    state.partidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMatches();
    renderAdminMatches();
    renderReporte(); // ← Actualizar reporte cuando cambian los partidos (resultados)
  }));

  state.unsubscribers.push(onSnapshot(query(collection(db, "predicciones"), where("uid", "==", user.uid)), snap => {
    state.prediccionesMap = new Map(snap.docs.map(d => [d.id, d.data()]));
    renderMatches();
    renderReporte(); // ← Actualizar reporte cuando cambian las predicciones
  }));

  state.unsubscribers.push(onSnapshot(collection(db, "usuarios"), snap => {
    state.ranking = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    renderRanking();
    renderReporte(); // ← Actualizar reporte cuando cambian los usuarios
  }));

  state.unsubscribers.push(onSnapshot(collection(db, "pagos"), snap => {
    state.pagosMap = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    renderPaymentUI();
    recalcPoolFromPayments();
    renderMatches();
    renderAdminPayments();
  }));

  const bloqueRef = doc(db, "bloques", state.bloqueActual);
  state.unsubscribers.push(onSnapshot(bloqueRef, async snap => {
    if (!snap.exists()) {
      await setDoc(bloqueRef, {
        nombre: "Fecha 1",
        valor_apuesta: 10000,
        porcentaje_admin: 0.15,
        porcentaje_premio_1: 0.70,
        porcentaje_premio_2: 0.15,
        cierre_predicciones: Timestamp.fromDate(new Date("2026-06-11T21:00:00Z"))
      }, { merge: true });
    } else {
      state.bloqueData = snap.data();
    }
  }));

  setInterval(() => state.currentUser && renderMatches(), 60000);
}
// ===== MENÚ HAMBURGUESA MÓVIL =====
(function initHamburger() {
  const hamburger = document.createElement("button");
  hamburger.id = "hamburgerBtn";
  hamburger.className = "hamburger";
  hamburger.setAttribute("aria-label", "Abrir menú");
  hamburger.setAttribute("aria-expanded", "false");
  hamburger.innerHTML = "☰";
  document.body.appendChild(hamburger);

  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);

  const sidebar = document.getElementById("sidebar");

  function openMenu() {
    sidebar?.classList.add("open");
    overlay.classList.add("open");
    hamburger.innerHTML = "✕";
    hamburger.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    sidebar?.classList.remove("open");
    overlay.classList.remove("open");
    hamburger.innerHTML = "☰";
    hamburger.setAttribute("aria-expanded", "false");
  }

  hamburger.addEventListener("click", () => {
    sidebar?.classList.contains("open") ? closeMenu() : openMenu();
  });
  overlay.addEventListener("click", closeMenu);

  document.querySelectorAll("[data-view-target]").forEach(btn => {
    btn.addEventListener("click", () => { if (window.innerWidth < 900) closeMenu(); });
  });
})();

onAuthStateChanged(auth, async user => {
  if (!user) {
    state.currentUser = null;
    state.currentUserDoc = null;
    clearListeners();
    el.sidebar.classList.add("hidden");
    showView("loginView");
    return;
  }

  state.currentUser = user;
  await upsertUserProfile(user);
  renderProfile();
  el.sidebar.classList.remove("hidden");
  showView("dashboardView");
  setupRealtime(user);
    // ===== INICIALIZAR SELECTOR DE FASES =====
  initFechaSelector();
  initReporteFechaSelector();  // ← Agrega esta línea
  renderReporte();              // ← Agrega esta línea
  
  // Actualizar label de fase actual en la vista de pagos
  const faseLabel = document.getElementById("currentFaseLabel");
  if (faseLabel) {
    const nombres = {
      fecha_1: "Fase 1",
      fecha_2: "Fase 2", 
      fecha_3: "Fase 3"
    };
    faseLabel.textContent = nombres[state.bloqueActual] || state.bloqueActual;
  }
  
  // Actualizar el título en el dashboard
  const dashboardPill = document.querySelector("#dashboardView .panel-head .pill");
  if (dashboardPill) {
    const nombres = {
      fecha_1: "Fase 1",
      fecha_2: "Fase 2", 
      fecha_3: "Fase 3"
    };
    dashboardPill.textContent = nombres[state.bloqueActual] || state.bloqueActual;
  }
});
