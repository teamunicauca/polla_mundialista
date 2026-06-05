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
  themeToggle: $("themeToggle")
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
    // Grupo A
    "México": "🇲🇽",
    "Sudáfrica": "🇿🇦",
    "República de Corea": "🇰🇷",
    "Corea del Sur": "🇰🇷",
    "Chequia": "🇨🇿",
    "República Checa": "🇨🇿",
    
    // Grupo B
    "Canadá": "🇨🇦",
    "Bosnia y Herzegovina": "🇧🇦",
    "Catar": "🇶🇦",
    "Suiza": "🇨🇭",
    
    // Grupo C
    "Brasil": "🇧🇷",
    "Marruecos": "🇲🇦",
    "Haití": "🇭🇹",
    "Escocia": "🏴 (Escocia)",
    
    // Grupo D
    "Estados Unidos": "🇺🇸",
    "EE. UU.": "🇺🇸",
    "Paraguay": "🇵🇾",
    "Australia": "🇦🇺",
    "Turquía": "🇹🇷",
    
    // Grupo E
    "Alemania": "🇩🇪",
    "Curazao": "🇨🇼",
    "Costa de Marfil": "🇨🇮",
    "Ecuador": "🇪🇨",
    
    // Grupo F
    "Países Bajos": "🇳🇱",
    "Japón": "🇯🇵",
    "Suecia": "🇸🇪",
    "Túnez": "🇹🇳",
    
    // Grupo G
    "Bélgica": "🇧🇪",
    "Egipto": "🇪🇬",
    "Irán": "🇮🇷",
    "Nueva Zelanda": "🇳🇿",
    
    // Grupo H
    "España": "🇪🇸",
    "Cabo Verde": "🇨🇻",
    "Arabia Saudita": "🇸🇦",
    "Uruguay": "🇺🇾",
    
    // Grupo I
    "Francia": "🇫🇷",
    "Senegal": "🇸🇳",
    "Irak": "🇮🇶",
    "Noruega": "🇳🇴",
    
    // Grupo J
    "Argentina": "🇦🇷",
    "Argelia": "🇩🇿",
    "Austria": "🇦🇹",
    "Jordania": "🇯🇴",
    
    // Grupo K
    "Portugal": "🇵🇹",
    "RD Congo": "🇨🇩",
    "República Democrática del Congo": "🇨🇩",
    "Uzbekistán": "🇺🇿",
    "Colombia": "🇨🇴",
    
    // Grupo L
    "Inglaterra": "🇬🇧",
    "Croacia": "🇭🇷",
    "Ghana": "🇬🇭",
    "Panamá": "🇵🇦"
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
  
  // Barra de progreso COMPACTA
  const progressHtml = `
    <div class="progress-compact">
      <div class="progress-stats">
        <span class="progress-label">📊 Progreso</span>
        <span class="progress-count">${pronosticados} / ${totalPartidos}</span>
        <span class="progress-percent">${Math.round(progressPercent)}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
      </div>
      ${progressPercent === 100 ? '<span class="progress-complete">🎉 ¡Completaste todos!</span>' : '<span class="progress-hint">💡 Modificable hasta 1h antes</span>'}
      <button id="saveAllBtn" class="btn btn-secondary save-all-btn" ${!approved ? "disabled" : ""}>💾 Guardar todos los cambios</button>
    </div>
  `;

  let matchesHtml = progressHtml;
  matchesHtml += `<div class="cards-grid">`;
  
  matchesHtml += state.partidos.map(partido => {
    const date = partido.fecha_hora.toDate();
    const countdown = getCountdown(date);
    const predId = `${state.currentUser.uid}_${partido.id}`;
    const pred = state.prediccionesMap.get(predId);
    const tienePrediccion = !!pred;
    const local = pred?.goles_pred_local ?? '';
    const visita = pred?.goles_pred_visita ?? '';
    const locked = countdown.closed || !approved;
    const isModified = false; // Track modifications
    
    // Determinar badge de estado
    let statusBadge = '';
    if (countdown.closed) {
      statusBadge = `<span class="badge danger">🔒 Cerrado</span>`;
    } else if (!approved) {
      statusBadge = `<span class="badge warning">💰 Pago pendiente</span>`;
    } else if (tienePrediccion) {
      statusBadge = `<span class="badge success">✅ Pronosticado</span>`;
    } else {
      statusBadge = `<span class="badge info">⚽ Por pronosticar</span>`;
    }
    
    const cardClass = tienePrediccion && !locked ? 'match-card predicted' : 'match-card';
    const localValue = local !== '' ? local : '';
    const visitaValue = visita !== '' ? visita : '';

    return `
      <article class="${cardClass} glass-card" data-match-id="${partido.id}">
        <div class="match-head">
          <div>
            <div class="meta">${formatDateTime(date)}</div>
            <div class="countdown ${countdown.closed ? 'closed' : ''}">${countdown.text}</div>
          </div>
          ${statusBadge}
        </div>

        <div class="team-block">
          <div class="team-line">
            <span class="flag">${getFlagEmoji(partido.equipo_local)}</span>
            <strong>${partido.equipo_local}</strong>
          </div>
          <div class="team-line">
            <span class="flag">${getFlagEmoji(partido.equipo_visita)}</span>
            <strong>${partido.equipo_visita}</strong>
          </div>
        </div>

        <div class="score-grid">
          <div class="score-box">
            <label>Goles local</label>
            <div class="stepper">
              <button class="step-btn" data-step="down" data-input="local_${partido.id}" ${locked ? "disabled" : ""}>-</button>
              <input type="number" id="local_${partido.id}" class="score-input ${tienePrediccion ? 'has-value' : ''}" 
                     data-original="${localValue}" data-match="${partido.id}" data-type="local"
                     min="0" max="20" value="${localValue}" placeholder="?" ${locked ? "disabled" : ""}>
              <button class="step-btn" data-step="up" data-input="local_${partido.id}" ${locked ? "disabled" : ""}>+</button>
            </div>
          </div>
          <div class="score-box">
            <label>Goles visita</label>
            <div class="stepper">
              <button class="step-btn" data-step="down" data-input="visita_${partido.id}" ${locked ? "disabled" : ""}>-</button>
              <input type="number" id="visita_${partido.id}" class="score-input ${tienePrediccion ? 'has-value' : ''}" 
                     data-original="${visitaValue}" data-match="${partido.id}" data-type="visita"
                     min="0" max="20" value="${visitaValue}" placeholder="?" ${locked ? "disabled" : ""}>
              <button class="step-btn" data-step="up" data-input="visita_${partido.id}" ${locked ? "disabled" : ""}>+</button>
            </div>
          </div>
        </div>

        <div class="match-footer">
          <span class="pill fase-pill">${partido.bloque === 'fecha_1' ? 'Fase 1' : partido.bloque === 'fecha_2' ? 'Fase 2' : 'Fase 3'}</span>
          <span class="modified-badge" id="modified_${partido.id}" style="display: none; font-size: 0.7rem; color: var(--warning);">✏️ Modificado</span>
        </div>
      </article>
    `;
  }).join("");
  
  matchesHtml += `</div>`;
  el.matchesContainer.innerHTML = matchesHtml;

  // Agregar event listeners para los steppers
  el.matchesContainer.querySelectorAll("[data-step]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.input);
      if (input && !input.disabled) {
        const current = Number(input.value || 0);
        input.value = btn.dataset.step === "up" ? current + 1 : Math.max(0, current - 1);
        // Trigger change event to detect modification
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  // Detectar cambios en los inputs
  el.matchesContainer.querySelectorAll(".score-input").forEach(input => {
    input.addEventListener("change", () => {
      const matchId = input.dataset.match;
      const matchCard = document.querySelector(`article[data-match-id="${matchId}"]`);
      const localInput = document.getElementById(`local_${matchId}`);
      const visitaInput = document.getElementById(`visita_${matchId}`);
      const modifiedBadge = document.getElementById(`modified_${matchId}`);
      
      if (localInput && visitaInput && modifiedBadge) {
        const localOriginal = localInput.dataset.original || "";
        const visitaOriginal = visitaInput.dataset.original || "";
        const localCurrent = localInput.value;
        const visitaCurrent = visitaInput.value;
        
        const isChanged = (localOriginal !== localCurrent) || (visitaOriginal !== visitaCurrent);
        modifiedBadge.style.display = isChanged ? "inline-block" : "none";
        
        if (matchCard) {
          if (isChanged) {
            matchCard.classList.add("modified");
          } else {
            matchCard.classList.remove("modified");
          }
        }
      }
    });
  });

  // Guardar todos los cambios pendientes
  const saveAllBtn = document.getElementById("saveAllBtn");
  if (saveAllBtn) {
    saveAllBtn.addEventListener("click", () => saveAllPredictions());
  }

  // Agregar event listeners para guardar individual (opcional)
  // Ya no mostramos botones individuales, todo se guarda con el botón global
}

// Nueva función para guardar TODOS los pronósticos modificados
async function saveAllPredictions() {
  if (!isPaymentApproved()) {
    alert("❌ Tu pago aún no ha sido aprobado.");
    return;
  }

  const modifiedMatches = [];
  
  // Recorrer todos los inputs y detectar cambios
  for (const partido of state.partidos) {
    const matchId = partido.id;
    const localInput = document.getElementById(`local_${matchId}`);
    const visitaInput = document.getElementById(`visita_${matchId}`);
    
    if (!localInput || !visitaInput || localInput.disabled) continue;
    
    const localOriginal = localInput.dataset.original || "";
    const visitaOriginal = visitaInput.dataset.original || "";
    const localCurrent = localInput.value;
    const visitaCurrent = visitaInput.value;
    
    // Verificar si hubo cambio
    if (localOriginal !== localCurrent || visitaOriginal !== visitaCurrent) {
      // Validar que no sea vacío
      if (localCurrent === "" || visitaCurrent === "") {
        alert(`⚠️ El partido ${partido.equipo_local} vs ${partido.equipo_visita} tiene valores vacíos. Por favor completa ambos campos.`);
        return;
      }
      
      modifiedMatches.push({
        matchId: matchId,
        goles_local: Math.max(0, Number(localCurrent)),
        goles_visita: Math.max(0, Number(visitaCurrent)),
        equipo_local: partido.equipo_local,
        equipo_visita: partido.equipo_visita
      });
    }
  }
  
  if (modifiedMatches.length === 0) {
    alert("📋 No hay cambios pendientes para guardar.");
    return;
  }
  
  // Confirmar guardado masivo
  const confirmMsg = `¿Guardar ${modifiedMatches.length} pronóstico${modifiedMatches.length > 1 ? 's' : ''}?\n\n`;
  if (!confirm(confirmMsg + "¿Estás seguro?")) return;
  
  // Guardar cada predicción
  let successCount = 0;
  for (const match of modifiedMatches) {
    try {
      const predId = `${state.currentUser.uid}_${match.matchId}`;
      await setDoc(doc(db, "predicciones", predId), {
        uid: state.currentUser.uid,
        partidoId: match.matchId,
        goles_pred_local: match.goles_local,
        goles_pred_visita: match.goles_visita,
        puntos_ganados: 0,
        fecha_registro: serverTimestamp()
      }, { merge: true });
      successCount++;
      
      // Actualizar dataset original
      const localInput = document.getElementById(`local_${match.matchId}`);
      const visitaInput = document.getElementById(`visita_${match.matchId}`);
      if (localInput) localInput.dataset.original = match.goles_local;
      if (visitaInput) visitaInput.dataset.original = match.goles_visita;
      
      // Ocultar badge de modificado
      const modifiedBadge = document.getElementById(`modified_${match.matchId}`);
      if (modifiedBadge) modifiedBadge.style.display = "none";
      
      // Quitar clase modified
      const matchCard = document.querySelector(`article[data-match-id="${match.matchId}"]`);
      if (matchCard) matchCard.classList.remove("modified");
      
    } catch (error) {
      console.error(`Error guardando ${match.equipo_local} vs ${match.equipo_visita}:`, error);
      alert(`❌ Error guardando ${match.equipo_local} vs ${match.equipo_visita}: ${error.message}`);
    }
  }
  
  alert(`✅ ${successCount} pronóstico${successCount > 1 ? 's' : ''} guardado${successCount > 1 ? 's' : ''} correctamente.`);
  
  // Recargar la vista para actualizar los badges "Pronosticado"
  renderMatches();
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

// ==================== SELECTOR DE FASES ====================
function initFechaSelector() {
  const selectorFecha = document.getElementById("selectorFecha");
  if (!selectorFecha) return;
  
  selectorFecha.addEventListener("change", async (e) => {
    const nuevaFecha = e.target.value;
    if (state.bloqueActual === nuevaFecha) return;
    
    console.log(`📅 Cambiando de ${state.bloqueActual} a ${nuevaFecha}`);
    state.bloqueActual = nuevaFecha;
    
    // Actualizar textos de UI
    const faseLabel = document.getElementById("currentFaseLabel");
    if (faseLabel) {
      const nombres = {
        fecha_1: "Fase 1",
        fecha_2: "Fase 2", 
        fecha_3: "Fase 3"
      };
      faseLabel.textContent = nombres[nuevaFecha] || nuevaFecha;
    }
    
    // Actualizar el título en el dashboard
    const dashboardPill = document.querySelector("#dashboardView .panel-head .pill");
    if (dashboardPill) {
      const nombres = {
        fecha_1: "Fase 1",
        fecha_2: "Fase 2", 
        fecha_3: "Fase 3"
      };
      dashboardPill.textContent = nombres[nuevaFecha] || nuevaFecha;
    }
    
    // Recargar todos los listeners con la nueva fecha
    if (state.currentUser) {
      clearListeners();
      setupRealtime(state.currentUser);
    }
    
    // Mostrar feedback visual
    const toast = document.createElement("div");
    toast.textContent = `📅 Cambiado a ${nombres[nuevaFecha] || nuevaFecha}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--primary);
      color: white;
      padding: 12px 20px;
      border-radius: 40px;
      z-index: 9999;
      animation: fadeOut 2s ease forwards;
      font-size: 14px;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  });
}

// Agregar la animación CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    0% { opacity: 1; transform: translateY(0); }
    70% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-20px); }
  }
`;
document.head.appendChild(style);

function setupRealtime(user) {
  clearListeners();

  // Actualizar el selector visualmente para mostrar la fecha actual
  const selectorFecha = document.getElementById("selectorFecha");
  if (selectorFecha && selectorFecha.value !== state.bloqueActual) {
    selectorFecha.value = state.bloqueActual;
  }

  state.unsubscribers.push(onSnapshot(doc(db, "usuarios", user.uid), snap => {
    state.currentUserDoc = snap.exists() ? snap.data() : null;
    el.kpiMisPuntos.textContent = state.currentUserDoc?.puntos_totales || 0;
    el.adminNavBtn.classList.toggle("hidden", !state.currentUserDoc?.esAdmin);
    renderAdminPayments();
    renderAdminMatches();
  }));

  state.unsubscribers.push(onSnapshot(query(collection(db, "partidos"), where("bloque", "==", state.bloqueActual)), snap => {
    state.partidos = snap.docs.map(d => ({ ...d.data() }));
    renderMatches();
    renderAdminMatches();
  }));

  state.unsubscribers.push(onSnapshot(query(collection(db, "predicciones"), where("uid", "==", user.uid)), snap => {
    state.prediccionesMap = new Map(snap.docs.map(d => [d.id, d.data()]));
    renderMatches();
  }));

  state.unsubscribers.push(onSnapshot(collection(db, "usuarios"), snap => {
    state.ranking = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    renderRanking();
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
      let nombreFecha = "Fecha 1";
      if (state.bloqueActual === "fecha_2") nombreFecha = "Fecha 2";
      if (state.bloqueActual === "fecha_3") nombreFecha = "Fecha 3";
      
      await setDoc(bloqueRef, {
        nombre: nombreFecha,
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
