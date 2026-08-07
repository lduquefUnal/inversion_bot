import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY = 'oracle_portfolio_v4';

// ─── Helpers ────────────────────────────────────────────────────────────────
export const calcularResumenPosicion = (lotes) => {
  if (!lotes || lotes.length === 0) return { precioPromedio: 0, cantidadTotal: 0, totalInvertido: 0 };
  const cantidadTotal  = lotes.reduce((s, l) => s + Number(l.cantidad), 0);
  const totalInvertido = lotes.reduce((s, l) => s + Number(l.precioCompra) * Number(l.cantidad), 0);
  const precioPromedio = cantidadTotal > 0 ? totalInvertido / cantidadTotal : 0;
  return { precioPromedio, cantidadTotal, totalInvertido };
};

// ─── Seed de posiciones reales del usuario / Modo Demo ────────────────────────
const buildSeed = () => [
  {
    position: { id: uuidv4(), ticker: 'UFO', nombre: 'Procure Space ETF', categoria: '🎯 Sweet Spot' },
    lotes: [{ id: uuidv4(), precioCompra: 43.4685, cantidad: 2.29476, fechaCompra: '2026-07-30', nota: 'Trii/Hapi' }],
  },
  {
    position: { id: uuidv4(), ticker: 'QCOM', nombre: 'Qualcomm Inc.', categoria: '⚡ Recup. Rápida' },
    lotes: [{ id: uuidv4(), precioCompra: 151.26, cantidad: 0.82537, fechaCompra: '2026-08-03', nota: 'Compra $125.00 USD ($0.15 fee)' }],
  },
  {
    position: { id: uuidv4(), ticker: 'ENPH', nombre: 'Enphase Energy Inc.', categoria: '🎯 Sweet Spot' },
    lotes: [{ id: uuidv4(), precioCompra: 39.37, cantidad: 3.17438, fechaCompra: '2026-08-03', nota: 'Compra $125.15 USD ($0.15 fee)' }],
  },
];

// ─── Persistencia Local (Fallback) ──────────────────────────────────────────
const saveLocal = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.error('Error guardando en localStorage', e); }
};

const loadLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.position && parsed[0]?.lotes) {
        const seed = buildSeed();
        seed.forEach(sItem => {
          const exists = parsed.find(p => p.position.ticker === sItem.position.ticker);
          if (!exists) {
            parsed.push(sItem);
          }
        });
        return parsed;
      }
    }
  } catch (e) { console.error('Error cargando desde localStorage', e); }
  return null;
};

// ─── Store Zustand ───────────────────────────────────────────────────────────
export const usePortfolioStore = create((set, get) => ({
  entries: loadLocal() ?? buildSeed(),
  isLoading: false,
  isSyncedWithSupabase: isSupabaseConfigured,
  error: null,
  user: null,
  isDemoMode: true,
  isPasswordRecovery: false,

  clearPasswordRecovery: () => set({ isPasswordRecovery: false }),

  /** Inicializar escuchador de Auth de Supabase */
  initAuthListener: async () => {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, isDemoMode: false });
      }
      get().fetchFromSupabase();

      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          set({ isPasswordRecovery: true });
        }
        if (session?.user) {
          set({ user: session.user, isDemoMode: false });
        } else {
          set({ user: null, isDemoMode: true });
        }
        get().fetchFromSupabase();
      });
    } catch (e) {
      console.error('Error inicializando auth listener:', e);
    }
  },

  setUserSession: (user) => {
    set({ user, isDemoMode: !user });
    get().fetchFromSupabase();
  },

  setDemoMode: () => {
    set({ user: null, isDemoMode: true });
    get().fetchFromSupabase();
  },

  signOut: async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null, isDemoMode: true });
    get().fetchFromSupabase();
  },

  /** Carga la información de activos y compras desde Supabase según la sesión activa */
  fetchFromSupabase: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    set({ isLoading: true, error: null });

    try {
      const currentUser = get().user;

      // 1. Obtener activos filtrados por usuario (si está autenticado) o anónimos (si es Modo Demo)
      let queryActivos = supabase.from('activos').select('*');
      let queryCompras = supabase.from('compras').select('*');

      if (currentUser) {
        queryActivos = queryActivos.eq('user_id', currentUser.id);
        queryCompras = queryCompras.eq('user_id', currentUser.id);
      } else {
        queryActivos = queryActivos.is('user_id', null);
        queryCompras = queryCompras.is('user_id', null);
      }

      const { data: activosData, error: activosErr } = await queryActivos;
      if (activosErr) throw activosErr;

      const { data: comprasData, error: comprasErr } = await queryCompras;
      if (comprasErr) throw comprasErr;

      // Si aún no hay posiciones registradas para este usuario en Supabase
      if (!activosData || activosData.length === 0) {
        // Auto-sembrar solo para tu usuario maestro 'lduquef@unal.edu.co' o en Modo Demo
        if (!currentUser || currentUser.email === 'lduquef@unal.edu.co') {
          const seedToUpload = buildSeed();
          set({ entries: seedToUpload });
          await get().uploadLocalToSupabase();
          return;
        }
        // Para cualquier otro usuario nuevo registrado, la cuenta empieza vacía ([])
        saveLocal([]);
        set({ entries: [], isLoading: false });
        return;
      }

      const mappedEntries = activosData.map(a => {
        const lotes = (comprasData || [])
          .filter(c => c.activo_id === a.id)
          .map(c => ({
            id: c.id,
            precioCompra: Number(c.precio_compra),
            cantidad: Number(c.cantidad),
            fechaCompra: c.fecha_compra,
            nota: c.nota || '',
          }));

        return {
          position: {
            id: a.id,
            ticker: a.ticker,
            nombre: a.nombre,
            categoria: a.categoria,
          },
          lotes,
        };
      });

      saveLocal(mappedEntries);
      set({ entries: mappedEntries, isLoading: false });
    } catch (e) {
      console.error('Error sincronizando con Supabase:', e);
      set({ error: e.message || 'Error cargando datos de Supabase', isLoading: false });
    }
  },

  // ── CRUD Posiciones ────────────────────────────────────────────────────────
  addPosition: async ({ ticker, nombre, categoria }) => {
    const exists = get().entries.find(e => e.position.ticker === ticker);
    if (exists) {
      if (categoria) {
        await get().updatePositionCategory(exists.position.id, categoria);
      }
      return exists.position.id;
    }

    const posId = uuidv4();
    const currentUser = get().user;
    const newEntry = {
      position: { id: posId, ticker, nombre: nombre || ticker, categoria: categoria || "🎯 Sweet Spot" },
      lotes: [],
    };
    const updated = [...get().entries, newEntry];
    saveLocal(updated);
    set({ entries: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          id: posId,
          ticker,
          nombre: nombre || ticker,
          categoria: categoria || "🎯 Sweet Spot",
          user_id: currentUser ? currentUser.id : null,
        };
        const { data, error } = await supabase
          .from('activos')
          .insert([payload])
          .select()
          .single();
        if (error) console.error('Error al insertar activo en Supabase:', error);
        else if (data?.id && data.id !== posId) {
          const remapped = get().entries.map(e => e.position.id === posId ? { ...e, position: { ...e.position, id: data.id } } : e);
          saveLocal(remapped);
          set({ entries: remapped });
          return data.id;
        }
      } catch (e) {
        console.error('Error al guardar en Supabase:', e);
      }
    }

    return posId;
  },

  updatePositionCategory: async (positionId, categoria) => {
    const updated = get().entries.map(e =>
      e.position.id === positionId ? { ...e, position: { ...e.position, categoria } } : e
    );
    saveLocal(updated);
    set({ entries: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('activos')
          .update({ categoria })
          .eq('id', positionId);
      } catch (e) {
        console.error('Error actualizando categoría en Supabase:', e);
      }
    }
  },

  removePosition: async (positionId) => {
    const updated = get().entries.filter(e => e.position.id !== positionId);
    saveLocal(updated);
    set({ entries: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('activos')
          .delete()
          .eq('id', positionId);
      } catch (e) {
        console.error('Error borrando posición en Supabase:', e);
      }
    }
  },

  // ── CRUD Lotes ─────────────────────────────────────────────────────────────
  addLote: async (positionId, loteData) => {
    const loteId = uuidv4();
    const currentUser = get().user;
    const lote = { id: loteId, ...loteData };
    const updated = get().entries.map(e =>
      e.position.id === positionId ? { ...e, lotes: [...e.lotes, lote] } : e
    );
    saveLocal(updated);
    set({ entries: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('compras')
          .insert([{
            id: loteId,
            activo_id: positionId,
            user_id: currentUser ? currentUser.id : null,
            precio_compra: Number(loteData.precioCompra),
            cantidad: Number(loteData.cantidad),
            fecha_compra: loteData.fechaCompra || new Date().toISOString().split('T')[0],
            nota: loteData.nota || '',
          }]);
      } catch (e) {
        console.error('Error insertando lote en Supabase:', e);
      }
    }

    return loteId;
  },

  updateLote: async (positionId, loteId, fields) => {
    const updated = get().entries.map(e =>
      e.position.id === positionId
        ? { ...e, lotes: e.lotes.map(l => l.id === loteId ? { ...l, ...fields } : l) }
        : e
    );
    saveLocal(updated);
    set({ entries: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {};
        if (fields.precioCompra !== undefined) payload.precio_compra = Number(fields.precioCompra);
        if (fields.cantidad !== undefined) payload.cantidad = Number(fields.cantidad);
        if (fields.fechaCompra !== undefined) payload.fecha_compra = fields.fechaCompra;
        if (fields.nota !== undefined) payload.nota = fields.nota;

        await supabase
          .from('compras')
          .update(payload)
          .eq('id', loteId);
      } catch (e) {
        console.error('Error actualizando lote en Supabase:', e);
      }
    }
  },

  removeLote: async (positionId, loteId) => {
    const updated = get().entries.map(e =>
      e.position.id === positionId ? { ...e, lotes: e.lotes.filter(l => l.id !== loteId) } : e
    ).filter(e => e.lotes.length > 0);

    saveLocal(updated);
    set({ entries: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('compras')
          .delete()
          .eq('id', loteId);
      } catch (e) {
        console.error('Error borrando lote en Supabase:', e);
      }
    }
  },

  // ── Utilidades ─────────────────────────────────────────────────────────────
  uploadLocalToSupabase: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const currentEntries = get().entries;
    if (!currentEntries || currentEntries.length === 0) return;

    set({ isLoading: true });
    const currentUser = get().user;
    const userId = currentUser ? currentUser.id : null;

    try {
      for (const entry of currentEntries) {
        const { id, ticker, nombre, categoria } = entry.position;
        await supabase
          .from('activos')
          .upsert([{ id, ticker, nombre, categoria, user_id: userId }], { onConflict: 'id' });

        for (const lote of entry.lotes) {
          await supabase
            .from('compras')
            .upsert([{
              id: lote.id,
              activo_id: id,
              user_id: userId,
              precio_compra: Number(lote.precioCompra),
              cantidad: Number(lote.cantidad),
              fecha_compra: lote.fechaCompra || new Date().toISOString().split('T')[0],
              nota: lote.nota || '',
            }], { onConflict: 'id' });
        }
      }
      
      await get().fetchFromSupabase();
    } catch (e) {
      console.error('Error subiendo datos locales a Supabase:', e);
      set({ isLoading: false });
    }
  },

  resetPortafolio: () => {
    const seed = buildSeed();
    saveLocal(seed);
    set({ entries: seed });
  },

  limpiarPortafolio: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ entries: [] });
  },

  exportToJson: () => {
    const data = get().entries;
    return JSON.stringify(data, null, 2);
  },

  importFromJson: (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.position) {
        saveLocal(parsed);
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
