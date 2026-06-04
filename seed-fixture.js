import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  const partidos = [
    {
      id: "fecha_1_mexico_vs_sudafrica",
      equipo_local: "México",
      equipo_visita: "Sudáfrica",
      fecha_hora: Timestamp.fromDate(new Date("2026-06-11T22:00:00Z")),
      goles_reales_local: null,
      goles_reales_visita: null,
      estado: "abierto",
      bloque: "fecha_1"
    },
    {
      id: "fecha_1_canada_vs_grupo_b2",
      equipo_local: "Canadá",
      equipo_visita: "Grupo B2",
      fecha_hora: Timestamp.fromDate(new Date("2026-06-12T21:00:00Z")),
      goles_reales_local: null,
      goles_reales_visita: null,
      estado: "abierto",
      bloque: "fecha_1"
    },
    {
      id: "fecha_1_estados_unidos_vs_grupo_d2",
      equipo_local: "Estados Unidos",
      equipo_visita: "Grupo D2",
      fecha_hora: Timestamp.fromDate(new Date("2026-06-13T00:00:00Z")),
      goles_reales_local: null,
      goles_reales_visita: null,
      estado: "abierto",
      bloque: "fecha_1"
    }
  ];

  for (const partido of partidos) {
    await setDoc(doc(db, "partidos", partido.id), partido, { merge: true });
  }

  await setDoc(doc(db, "bloques", "fecha_1"), {
    nombre: "Fecha 1",
    valor_apuesta: 10000,
    porcentaje_admin: 0.15,
    porcentaje_premio_1: 0.70,
    porcentaje_premio_2: 0.15,
    cierre_predicciones: Timestamp.fromDate(new Date("2026-06-11T21:00:00Z"))
  }, { merge: true });

  console.log("Fixture cargado correctamente");
}

seed().catch(console.error);
