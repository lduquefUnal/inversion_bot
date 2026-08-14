import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY = 'oracle_portfolio_v4';
const MOV_KEY = 'oracle_movimientos_v1';

// ─── Capital / Movimientos de Cuenta (Depósitos y Retiros) ──────────────────
export const calcularCapital = (movimientos = []) => {
  let aportado = 0, retirado = 0;
  (movimientos || []).forEach(m => {
    const monto = Number(m.monto || 0);
    if (m.tipo === 'deposito') aportado += monto;
    else if (m.tipo === 'retiro') retirado += monto;
  });
  return { aportado, retirado, neto: aportado - retirado };
};

/**
 * XIRR (Tasa Interna de Retorno anualizada exacta).
 * Convención de signos: 'deposito' (dinero que entra a la cuenta) = -monto,
 * 'retiro' (dinero que sale) = +monto, y el valor final del portafolio = +monto.
 * Newton-Raphson con respaldo por bisección. Devuelve % anual o null si no converge.
 */
export const calcularXirr = (flows = []) => {
  const fs = flows
    .map(f => ({ fecha: new Date(f.fecha).getTime(), monto: Number(f.monto) }))
    .filter(f => isFinite(f.fecha) && isFinite(f.monto))
    .sort((a, b) => a.fecha - b.fecha);
  if (fs.length < 2) return null;
  if (fs.every(f => f.monto === 0)) return null;

  // Ajustar fechas iguales repartiendo microdeltas para evitar divisiones por cero
  for (let i = 1; i < fs.length; i++) {
    if (fs[i].fecha === fs[i - 1].fecha) fs[i].fecha = fs[i - 1].fecha + 1;
  }
  const t0 = fs[0].fecha;
  const x = fs.map(f => (f.fecha - t0) / (365 * 86400000));

  const value = r => {
    if (r <= -1) return r === -1 ? Infinity : NaN;
    const p = 1 + r;
    return fs.reduce((s, f, i) => s + f.monto * Math.pow(p, -x[i]), 0);
  };

  // Newton-Raphson con bracketing seguro
  const tryNewton = () => {
    let r = 0.1;
    for (let i = 0; i < 120; i++) {
      const rPrev = r;
      const p = 1 + r;
      if (p <= 0) return null;
      let f = 0, fd = 0;
      for (let j = 0; j < fs.length; j++) {
        const pw = Math.pow(p, -x[j]);
        f += fs[j].monto * pw;
        fd += -x[j] * fs[j].monto * pw / p;
      }
      if (Math.abs(f) < 1e-9) return r;
      if (!isFinite(fd) || Math.abs(fd) < 1e-15) return null;
      r = r - f / fd;
      if (!isFinite(r)) return null;
      if (Math.abs(r - rPrev) < 1e-9) return r;
    }
    return null;
  };

  const tryBisect = () => {
    let lo = -0.99, hi = 10;
    let flo = value(lo), fhi = value(hi);
    if (!isFinite(flo) || !isFinite(fhi)) return null;
    if (flo * fhi > 0) return null;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const fm = value(mid);
      if (Math.abs(fm) < 1e-9) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; }
      else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  };

  const r = tryNewton() ?? tryBisect();
  return r == null || !isFinite(r) || r <= -0.99 ? null : r * 100;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
export const calcularResumenPosicion = (lotes, ventas = []) => {
  if (!lotes || lotes.length === 0) return { precioPromedio: 0, cantidadTotal: 0, totalInvertido: 0, cantidadComprada: 0, cantidadVendida: 0 };
  const cantidadComprada = lotes.reduce((s, l) => s + Number(l.cantidad), 0);
  const totalInvertido   = lotes.reduce((s, l) => s + Number(l.precioCompra) * Number(l.cantidad), 0);
  const cantidadVendida  = (ventas || []).reduce((s, v) => s + Number(v.cantidad || 0), 0);
  const precioPromedio   = cantidadComprada > 0 ? totalInvertido / cantidadComprada : 0;
  const cantidadTotal    = Math.max(0, cantidadComprada - cantidadVendida);
  return { precioPromedio, cantidadTotal, totalInvertido, cantidadComprada, cantidadVendida };
};

// ─── Métricas de trades cerrados (basadas en las ventas registradas) ────────
export const calcularMetricasTrades = (entries = []) => {
  const trades = [];
  entries.forEach(({ position, lotes, ventas = [] }) => {
    const { precioPromedio, cantidadComprada } = calcularResumenPosicion(lotes, ventas);
    const ventasArr = Array.isArray(ventas) ? ventas : [];

    ventasArr.forEach(v => {
      const precioVenta = Number(v.precioVenta);
      const cantidad = Number(v.cantidad);
      // Para ventas registradas con la versión anterior (sin P&L precomputado)
      const realizedPnl = v.realizedPnl ?? ((precioVenta - precioPromedio) * cantidad);
      const realizedPnlPct = v.realizedPnlPct ?? (precioPromedio > 0 ? ((precioVenta - precioPromedio) / precioPromedio) * 100 : 0);
      const diasHeld = v.diasHeld ?? calcularDiasSostenido(lotes, v.fechaVenta, cantidadComprada);

      trades.push({
        ticker: position.ticker,
        nombre: position.nombre,
        categoria: position.categoria,
        fechaVenta: v.fechaVenta,
        cantidad,
        precioVenta,
        costoUnitario: precioPromedio,
        tipoSalida: v.tipoSalida || 'MANUAL',
        nota: v.nota || '',
        realizedPnl,
        realizedPnlPct,
        diasHeld,
      });
    });
  });

  const totalTrades = trades.length;
  const realizedTotUSD = trades.reduce((s, t) => s + t.realizedPnl, 0);
  const promedioRetornoTrade = totalTrades > 0
    ? trades.reduce((s, t) => s + t.realizedPnlPct, 0) / totalTrades
    : 0;
  const promedioDiasTrade = totalTrades > 0
    ? trades.reduce((s, t) => s + t.diasHeld, 0) / totalTrades
    : 0;
  const ganadores = trades.filter(t => t.realizedPnl > 0).length;
  const winRate = totalTrades > 0 ? (ganadores / totalTrades) * 100 : 0;

  return { trades, totalTrades, realizedTotUSD, promedioRetornoTrade, promedioDiasTrade, winRate };
};

export const calcularDiasSostenido = (lotes, fechaVenta, cantidadComprada) => {
  if (!lotes || lotes.length === 0) return 0;
  const totalQ = Number(cantidadComprada) || lotes.reduce((s, l) => s + Number(l.cantidad), 0);
  if (totalQ <= 0) return 0;
  const weightedMs = lotes.reduce((acc, l) => {
    const d = new Date(l.fechaCompra).getTime();
    return acc + (isFinite(d) ? d * Number(l.cantidad) : 0);
  }, 0);
  const avgMs = weightedMs / totalQ;
  const fVenta = new Date(fechaVenta).getTime();
  if (!isFinite(avgMs) || !isFinite(fVenta)) return 0;
  return Math.max(0, Math.floor((fVenta - avgMs) / 86400000));
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

// ─── Persistencia Local de Movimientos de Capital ───────────────────────────
const saveMovLocal = (data) => {
  try { localStorage.setItem(MOV_KEY, JSON.stringify(data)); }
  catch (e) { console.error('Error guardando movimientos en localStorage', e); }
};

const loadMovLocal = () => {
  try {
    const raw = localStorage.getItem(MOV_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { console.error('Error cargando movimientos desde localStorage', e); }
  return [];
};

// ─── Seed de capital del Modo Demo (para que el demo muestre KPIs coherentes) ─
// ID fijo para que el sembrado sea idempotente (upsert en vez de duplicar).
const DEMO_SEED_MOV_ID = '00000000-0000-0000-0000-000000000001';
const buildSeedMovimientos = (fechaBase) => [{
  id: DEMO_SEED_MOV_ID,
  tipo: 'deposito',
  monto: 500.00,
  fecha: fechaBase,
  nota: 'Capital inicial de demostración',
}];

// ─── Store Zustand ───────────────────────────────────────────────────────────
export const usePortfolioStore = create((set, get) => ({
  entries: loadLocal() ?? buildSeed(),
  movimientos: loadMovLocal(),
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
      let queryVentas  = supabase.from('ventas').select('*');
      let queryMovimientos = supabase.from('movimientos_cuenta').select('*');

      if (currentUser) {
        queryActivos = queryActivos.eq('user_id', currentUser.id);
        queryCompras = queryCompras.eq('user_id', currentUser.id);
        queryVentas  = queryVentas.eq('user_id', currentUser.id);
        queryMovimientos = queryMovimientos.eq('user_id', currentUser.id);
      } else {
        queryActivos = queryActivos.is('user_id', null);
        queryCompras = queryCompras.is('user_id', null);
        queryVentas  = queryVentas.is('user_id', null);
        queryMovimientos = queryMovimientos.is('user_id', null);
      }

      const { data: activosData, error: activosErr } = await queryActivos;
      if (activosErr) throw activosErr;

      const { data: comprasData, error: comprasErr } = await queryCompras;
      if (comprasErr) throw comprasErr;

      // Las ventas son opcionales: si la tabla aún no existe (migración 0003 pendiente),
      // no debe impedir cargar posiciones. Se degrada a lista vacía.
      let ventasData = [];
      try {
        const { data, error } = await queryVentas;
        if (error) {
          console.warn('⚠️ Ventas no disponibles en Supabase (¿migración 0003 pendiente?):', error.message);
        } else if (data) {
          ventasData = data;
        }
      } catch (e) {
        console.warn('⚠️ Ventas no disponibles en Supabase:', e.message);
      }

      // Los movimientos de capital también son opcionales (migración 0004 pendiente)
      let movimientosData = [];
      try {
        const { data, error } = await queryMovimientos;
        if (error) {
          console.warn('⚠️ Movimientos de capital no disponibles en Supabase (¿migración 0004 pendiente?):', error.message);
        } else if (data) {
          movimientosData = data;
        }
      } catch (e) {
        console.warn('⚠️ Movimientos de capital no disponibles en Supabase:', e.message);
      }

      // Si aún no hay posiciones registradas para este usuario en Supabase
      if (!activosData || activosData.length === 0) {
        // Auto-sembrar solo para tu usuario maestro 'lduquef@unal.edu.co' o en Modo Demo
        if (!currentUser || currentUser.email === 'lduquef@unal.edu.co') {
          const seedToUpload = buildSeed();
          // En Modo Demo se siembra también un capital inicial coherente
          if (!currentUser && movimientosData.length === 0) {
            const seedMov = buildSeedMovimientos('2026-07-28');
            saveMovLocal(seedMov);
            set({ movimientos: seedMov });
          }
          set({ entries: seedToUpload });
          await get().uploadLocalToSupabase();
          return;
        }
        // Para cualquier otro usuario nuevo registrado, la cuenta empieza vacía ([])
        saveLocal([]);
        set({ entries: [], movimientos: [], isLoading: false });
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

        const ventas = (ventasData || [])
          .filter(v => v.activo_id === a.id)
          .map(v => ({
            id: v.id,
            precioVenta: Number(v.precio_venta),
            cantidad: Number(v.cantidad),
            fechaVenta: v.fecha_venta,
            tipoSalida: v.tipo_salida || 'MANUAL',
            nota: v.nota || '',
          }));

        return {
          position: {
            id: a.id,
            ticker: a.ticker,
            nombre: a.nombre,
            categoria: a.categoria,
          },
          lotes,
          ventas,
        };
      });

      // Mapear movimientos de capital (depósitos / retiros)
      let movimientos = (movimientosData || []).map(m => ({
        id: m.id,
        tipo: m.tipo,
        monto: Number(m.monto),
        fecha: m.fecha,
        nota: m.nota || '',
      }));

      // En Modo Demo, si aún no hay capital registrado, sembrar un depósito inicial
      // coherente con las posiciones de muestra (solo una vez; luego persiste en la nube).
      if (!currentUser && movimientos.length === 0) {
        const eldestBuy = mappedEntries
          .flatMap(e => (e.lotes || []).map(l => l.fechaCompra))
          .filter(Boolean)
          .sort()[0];
        const fechaBase = eldestBuy
          ? new Date(new Date(eldestBuy).getTime() - 86400000).toISOString().split('T')[0]
          : '2026-07-28';
        const seedMov = buildSeedMovimientos(fechaBase);
        try {
          const { data, error } = await supabase
            .from('movimientos_cuenta')
            .upsert(seedMov, { onConflict: 'id' })
            .select();
          if (!error && data) {
            movimientos = data.map(m => ({ id: m.id, tipo: m.tipo, monto: Number(m.monto), fecha: m.fecha, nota: m.nota || '' }));
          } else {
            movimientos = seedMov;
          }
        } catch (e) {
          console.warn('⚠️ No se pudo sembrar capital demo:', e.message);
          movimientos = seedMov;
        }
      }

      saveLocal(mappedEntries);
      saveMovLocal(movimientos);
      set({ entries: mappedEntries, movimientos, isLoading: false });
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
      ventas: [],
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

  // ── CRUD Ventas (Trades) ──────────────────────────────────────────────────
  /** Registra una venta parcial/total. Calcula P&L realizado y días sostenidos (método costo promedio). */
  addVenta: async (positionId, ventaData) => {
    const entry = get().entries.find(e => e.position.id === positionId);
    if (!entry) return null;

    const resumen = calcularResumenPosicion(entry.lotes, entry.ventas || []);
    const cantidad = Math.min(Number(ventaData.cantidad), resumen.cantidadTotal);
    const precioVenta = Number(ventaData.precioVenta);
    if (!(cantidad > 0) || !(precioVenta > 0)) return null;

    const costoUnitario = resumen.precioPromedio;
    const realizedPnl = (precioVenta - costoUnitario) * cantidad;
    const realizedPnlPct = costoUnitario > 0 ? ((precioVenta - costoUnitario) / costoUnitario) * 100 : 0;
    const diasHeld = calcularDiasSostenido(entry.lotes, ventaData.fechaVenta, resumen.cantidadComprada);

    const venta = {
      id: uuidv4(),
      precioVenta,
      cantidad,
      fechaVenta: ventaData.fechaVenta || new Date().toISOString().split('T')[0],
      tipoSalida: ventaData.tipoSalida || 'MANUAL',
      nota: ventaData.nota || '',
      realizedPnl,
      realizedPnlPct,
      diasHeld,
      costoUnitario,
    };

    const updated = get().entries.map(e =>
      e.position.id === positionId
        ? { ...e, ventas: [...(e.ventas || []), venta] }
        : e
    );
    saveLocal(updated);
    set({ entries: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('ventas')
          .insert([{
            id: venta.id,
            activo_id: positionId,
            user_id: get().user ? get().user.id : null,
            ticker: entry.position.ticker,
            nombre: entry.position.nombre || '',
            categoria: entry.position.categoria || '',
            precio_venta: precioVenta,
            cantidad,
            fecha_venta: venta.fechaVenta,
            tipo_salida: venta.tipoSalida,
            nota: venta.nota || '',
          }]);
      } catch (e) {
        console.error('Error insertando venta en Supabase:', e);
      }
    }

    return venta;
  },

  removeVenta: async (positionId, ventaId) => {
    const updated = get().entries.map(e =>
      e.position.id === positionId ? { ...e, ventas: (e.ventas || []).filter(v => v.id !== ventaId) } : e
    );
    saveLocal(updated);
    set({ entries: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('ventas')
          .delete()
          .eq('id', ventaId);
      } catch (e) {
        console.error('Error borrando venta en Supabase:', e);
      }
    }
  },

  // ── CRUD Movimientos de Capital (Depósitos / Retiros) ─────────────────────
  addMovimiento: async ({ tipo, monto, fecha, nota }) => {
    const cantidad = Number(monto);
    if (!(cantidad > 0) || !['deposito', 'retiro'].includes(tipo)) return null;

    const movimiento = {
      id: uuidv4(),
      tipo,
      monto: cantidad,
      fecha: fecha || new Date().toISOString().split('T')[0],
      nota: nota || '',
    };

    const updated = [...get().movimientos, movimiento];
    saveMovLocal(updated);
    set({ movimientos: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('movimientos_cuenta')
          .insert([{
            id: movimiento.id,
            user_id: get().user ? get().user.id : null,
            tipo,
            monto: cantidad,
            fecha: movimiento.fecha,
            nota: nota || '',
          }]);
      } catch (e) {
        console.error('Error insertando movimiento en Supabase:', e);
      }
    }

    return movimiento;
  },

  removeMovimiento: async (movimientoId) => {
    const updated = get().movimientos.filter(m => m.id !== movimientoId);
    saveMovLocal(updated);
    set({ movimientos: updated });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('movimientos_cuenta')
          .delete()
          .eq('id', movimientoId);
      } catch (e) {
        console.error('Error borrando movimiento en Supabase:', e);
      }
    }
  },

  // ── Utilidades ─────────────────────────────────────────────────────────────
  uploadLocalToSupabase: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const currentEntries = get().entries;
    const currentMovimientos = get().movimientos;
    if ((!currentEntries || currentEntries.length === 0) && (!currentMovimientos || currentMovimientos.length === 0)) return;

    set({ isLoading: true });
    const currentUser = get().user;
    const userId = currentUser ? currentUser.id : null;

    try {
      for (const entry of currentEntries || []) {
        const { id, ticker, nombre, categoria } = entry.position;
        await supabase
          .from('activos')
          .upsert([{ id, ticker, nombre, categoria, user_id: userId }], { onConflict: 'id' });

        for (const lote of entry.lotes || []) {
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

        for (const venta of entry.ventas || []) {
          await supabase
            .from('ventas')
            .upsert([{
              id: venta.id,
              activo_id: id,
              user_id: userId,
              ticker: entry.position.ticker,
              nombre: entry.position.nombre || '',
              categoria: entry.position.categoria || '',
              precio_venta: Number(venta.precioVenta),
              cantidad: Number(venta.cantidad),
              fecha_venta: venta.fechaVenta || new Date().toISOString().split('T')[0],
              tipo_salida: venta.tipoSalida || 'MANUAL',
              nota: venta.nota || '',
            }], { onConflict: 'id' });
        }
      }

      for (const mov of currentMovimientos || []) {
        await supabase
          .from('movimientos_cuenta')
          .upsert([{
            id: mov.id,
            user_id: userId,
            tipo: mov.tipo,
            monto: Number(mov.monto),
            fecha: mov.fecha || new Date().toISOString().split('T')[0],
            nota: mov.nota || '',
          }], { onConflict: 'id' });
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
    localStorage.removeItem(MOV_KEY);
    set({ entries: [], movimientos: [] });
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
