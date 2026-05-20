import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'oracle_portfolio_v2';

// ─── Helpers ────────────────────────────────────────────────────────────────
export const calcularResumenPosicion = (lotes) => {
  if (!lotes || lotes.length === 0) return { precioPromedio: 0, cantidadTotal: 0, totalInvertido: 0 };
  const cantidadTotal  = lotes.reduce((s, l) => s + Number(l.cantidad), 0);
  const totalInvertido = lotes.reduce((s, l) => s + Number(l.precioCompra) * Number(l.cantidad), 0);
  const precioPromedio = cantidadTotal > 0 ? totalInvertido / cantidadTotal : 0;
  return { precioPromedio, cantidadTotal, totalInvertido };
};

// ─── Seed de posiciones reales del usuario ───────────────────────────────────
// IMPORTANTE: Este seed SOLO se carga la PRIMERA VEZ (localStorage vacío).
// Cualquier edición posterior desde la UI queda guardada y este seed se ignora.
// Para resetear y recargar el seed: usar usePortfolioStore.getState().resetPortafolio()
const buildSeed = () => [
  {
    position: { id: uuidv4(), ticker: 'PLTR', nombre: 'Palantir' },
    lotes: [{ id: uuidv4(), precioCompra: 135.70, cantidad: 0.399042, fechaCompra: '2026-04-14', nota: 'Trii' }],
  },
  {
    position: { id: uuidv4(), ticker: 'MSFT', nombre: 'Microsoft' },
    lotes: [{ id: uuidv4(), precioCompra: 393.11, cantidad: 0.102134, fechaCompra: '2026-04-14', nota: 'Trii' }],
  },
  {
    position: { id: uuidv4(), ticker: 'TGLS', nombre: 'Tecnoglass' },
    lotes: [{ id: uuidv4(), precioCompra: 45.71, cantidad: 1.097134, fechaCompra: '2026-04-14', nota: 'Trii' }],
  },
  {
    position: { id: uuidv4(), ticker: 'MELI', nombre: 'MercadoLibre' },
    lotes: [{ id: uuidv4(), precioCompra: 1840.66, cantidad: 0.016375, fechaCompra: '2026-04-14', nota: 'Trii' }],
  },
  {
    position: { id: uuidv4(), ticker: 'TSLA', nombre: 'Tesla' },
    lotes: [{ id: uuidv4(), precioCompra: 364.20, cantidad: 0.082784, fechaCompra: '2026-04-14', nota: 'Trii' }],
  },
  {
    position: { id: uuidv4(), ticker: 'URNJ', nombre: 'Uranium Junior' },
    lotes: [{ id: uuidv4(), precioCompra: 28.32, cantidad: 1.382415, fechaCompra: '2026-04-07', nota: 'Trii' }],
  },
  {
    position: { id: uuidv4(), ticker: 'ETH-USD', nombre: 'Ethereum' },
    lotes: [
      { id: uuidv4(), precioCompra: 2056.85, cantidad: 0.017186, fechaCompra: '2026-04-02', nota: 'Trii' },
      { id: uuidv4(), precioCompra: 2056.85, cantidad: 0.009821, fechaCompra: '2026-04-02', nota: 'Trii' }
    ],
  },
  {
    position: { id: uuidv4(), ticker: 'BTC-USD', nombre: 'Bitcoin' },
    lotes: [
      { id: uuidv4(), precioCompra: 68791.62, cantidad: 0.000881, fechaCompra: '2026-03-26', nota: 'Trii' },
      { id: uuidv4(), precioCompra: 66888.57, cantidad: 0.000453, fechaCompra: '2026-04-02', nota: 'Trii' }
    ],
  },
  {
    position: { id: uuidv4(), ticker: 'GLD', nombre: 'SPDR Gold Shares' },
    lotes: [{ id: uuidv4(), precioCompra: 400.64, cantidad: 0.098343, fechaCompra: '2026-03-26', nota: 'Trii' }],
  },
];

// ─── Persistencia ────────────────────────────────────────────────────────────
const save = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.error('Error guardando portafolio', e); }
};

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validar estructura esperada
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.position && parsed[0]?.lotes) {
        return parsed;
      }
    }
  } catch (e) { console.error('Error cargando portafolio', e); }
  return null; // null = no hay nada guardado → cargar seed
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const usePortfolioStore = create((set, get) => ({
  entries: load() ?? buildSeed(),

  // ── CRUD Posiciones ────────────────────────────────────────────────────────
  addPosition: ({ ticker, nombre }) => {
    const exists = get().entries.find(e => e.position.ticker === ticker);
    if (exists) return exists.position.id;
    const newEntry = { position: { id: uuidv4(), ticker, nombre: nombre || ticker }, lotes: [] };
    const updated = [...get().entries, newEntry];
    save(updated);
    set({ entries: updated });
    return newEntry.position.id;
  },

  removePosition: (positionId) => {
    const updated = get().entries.filter(e => e.position.id !== positionId);
    save(updated);
    set({ entries: updated });
  },

  // ── CRUD Lotes ─────────────────────────────────────────────────────────────
  addLote: (positionId, loteData) => {
    const lote = { id: uuidv4(), ...loteData };
    const updated = get().entries.map(e =>
      e.position.id === positionId ? { ...e, lotes: [...e.lotes, lote] } : e
    );
    save(updated);
    set({ entries: updated });
    return lote.id;
  },

  updateLote: (positionId, loteId, fields) => {
    const updated = get().entries.map(e =>
      e.position.id === positionId
        ? { ...e, lotes: e.lotes.map(l => l.id === loteId ? { ...l, ...fields } : l) }
        : e
    );
    save(updated);
    set({ entries: updated });
  },

  removeLote: (positionId, loteId) => {
    const updated = get().entries.map(e =>
      e.position.id === positionId ? { ...e, lotes: e.lotes.filter(l => l.id !== loteId) } : e
    ).filter(e => e.lotes.length > 0);
    save(updated);
    set({ entries: updated });
  },

  // ── Utilidades ─────────────────────────────────────────────────────────────
  /** Borra TODOS los datos y recarga el seed inicial */
  resetPortafolio: () => {
    const seed = buildSeed();
    save(seed);
    set({ entries: seed });
  },

  /** Borra todo el portafolio sin recargar seed (empezar de cero) */
  limpiarPortafolio: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ entries: [] });
  },

  /** Exporta el portafolio como string JSON */
  exportToJson: () => {
    const data = get().entries;
    return JSON.stringify(data, null, 2);
  },

  /** Importa un portafolio desde un string JSON (reemplaza todo) */
  importFromJson: (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.position) {
        save(parsed);
        set({ entries: parsed });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Error importando JSON", e);
      return false;
    }
  },
}));

