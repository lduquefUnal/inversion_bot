import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'oracle_portfolio_v4';

// ─── Helpers ────────────────────────────────────────────────────────────────
export const calcularResumenPosicion = (lotes) => {
  if (!lotes || lotes.length === 0) return { precioPromedio: 0, cantidadTotal: 0, totalInvertido: 0 };
  const cantidadTotal  = lotes.reduce((s, l) => s + Number(l.cantidad), 0);
  const totalInvertido = lotes.reduce((s, l) => s + Number(l.precioCompra) * Number(l.cantidad), 0);
  const precioPromedio = cantidadTotal > 0 ? totalInvertido / cantidadTotal : 0;
  return { precioPromedio, cantidadTotal, totalInvertido };
};

// ─── Seed de posiciones reales del usuario (a partir de UFO en adelante) ─────
const buildSeed = () => [
  {
    position: { id: uuidv4(), ticker: 'UFO', nombre: 'Procure Space ETF', categoria: '🎯 Sweet Spot' },
    lotes: [{ id: uuidv4(), precioCompra: 43.4685, cantidad: 2.29476, fechaCompra: '2026-07-30', nota: 'Trii/Hapi' }],
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
  addPosition: ({ ticker, nombre, categoria }) => {
    const exists = get().entries.find(e => e.position.ticker === ticker);
    if (exists) {
      if (categoria) {
        get().updatePositionCategory(exists.position.id, categoria);
      }
      return exists.position.id;
    }
    const newEntry = { position: { id: uuidv4(), ticker, nombre: nombre || ticker, categoria: categoria || "🎯 Sweet Spot" }, lotes: [] };
    const updated = [...get().entries, newEntry];
    save(updated);
    set({ entries: updated });
    return newEntry.position.id;
  },

  updatePositionCategory: (positionId, categoria) => {
    const updated = get().entries.map(e =>
      e.position.id === positionId ? { ...e, position: { ...e.position, categoria } } : e
    );
    save(updated);
    set({ entries: updated });
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

