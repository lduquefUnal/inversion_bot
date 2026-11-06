import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Paleta categorías ────────────────────────────────────────────────────────
const CAT_CFG = {
  'Sweet Spot': { emoji: '🎯', bg: 'rgba(234,179,8,0.15)', color: '#eab308', border: '#eab308', desc: 'Fundamentos sólidos, corrección temporal. Tendencia de largo plazo intacta (precio > SMA200).' },
  'Cazador Dips': { emoji: '🔥', bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '#ef4444', desc: 'Drawdown >35% + RSI 2D <10 (Connors). Alto riesgo, alta recompensa.' },
  'Recup. Rapida': { emoji: '⚡', bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: '#10b981', desc: 'EMA20 ≥ SMA50, precio sobre SMA200. Ciclo corto de recuperación con momentum alcista.' },
  'Cuchillos Cayendo': { emoji: '⚠️', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '#64748b', desc: 'Sin soporte claro. Máxima cautela. Solo traders con alta tolerancia al riesgo.' },
};
const DEF_CFG = { emoji: '📊', bg: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '#818cf8', desc: 'Activo en evaluación.' };

export const getCategoryWinRate = (catRaw) => {
  const cat = String(catRaw || '');
  if (cat.includes('Sweet')) return 33.3;
  if (cat.includes('Cazador')) return 45.5;
  if (cat.includes('Recup')) return 48.5;
  if (cat.includes('Cuchillo')) return 45.8;
  return 48.5;
};

export const getCategoryConfig = (catRaw) => {
  const cat = String(catRaw || '');
  if (cat.includes('Sweet')) return CAT_CFG['Sweet Spot'];
  if (cat.includes('Cazador')) return CAT_CFG['Cazador Dips'];
  if (cat.includes('Recup')) return CAT_CFG['Recup. Rapida'];
  if (cat.includes('Cuchillo')) return CAT_CFG['Cuchillos Cayendo'];
  return DEF_CFG;
};

export const getCategoryParams = (catRaw) => {
  const cat = String(catRaw || '');
  if (cat.includes('Sweet')) return { tp: 15, sl: 6, dias: 14 };
  if (cat.includes('Cazador')) return { tp: 12, sl: 5, dias: 11 };
  if (cat.includes('Recup')) return { tp: 10, sl: 4, dias: 7 };
  if (cat.includes('Cuchillo')) return { tp: 8, sl: 4, dias: 5 };
  return { tp: 10, sl: 4, dias: 7 };
};

// ─── API Gemini ───────────────────────────────────────────────────────────────
const getGeminiKey = () =>
  import.meta.env.VITE_GEMINI_API_KEY ||
  localStorage.getItem('VITE_GEMINI_API_KEY') ||
  localStorage.getItem('GEMINI_API_KEY') ||
  '';

const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.5-flash',
];

// ─── Diccionario Maestro de Rubros & Perfiles de Negocio ──────────────────────
export const KNOWN_COMPANY_PROFILES = {
  // CRIPTO, MINERÍA & BLOCKCHAIN HPC
  CIFR: {
    tipo: 'Actor disruptor de alto crecimiento en computación HPC e infraestructura blockchain',
    rubro: 'Centros de datos de computación de alto rendimiento (HPC) y minería industrial de Bitcoin',
    modelo: 'Opera infraestructura propia con energía renovable de bajo costo en Texas. Monetiza mediante recompensas de bloque y arriendo de capacidad de cómputo para Inteligencia Artificial.'
  },
  CLSK: {
    tipo: 'Minero de Bitcoin líder en eficiencia energética y rápido crecimiento operativo',
    rubro: 'Infraestructura de centros de datos y minería institucional de Bitcoin',
    modelo: 'Centros de datos propios con energía limpia en EE.UU., monetizando mediante acumulación y venta de Bitcoin con uno de los costos de extracción más bajos de la industria.'
  },
  RIOT: {
    tipo: 'Gigante y uno de los mayores operadores cotizados de minería de Bitcoin en Norteamérica',
    rubro: 'Centros de datos industriales e infraestructura eléctrica a escala de gigavatios',
    modelo: 'Monetiza mediante minería masiva de Bitcoin (facilidad Corsicana) y créditos de energía por estabilización de la red eléctrica en Texas.'
  },
  MARA: {
    tipo: 'Líder indiscutido por capitalización bursátil y hashrate en minería de Bitcoin en Occidente',
    rubro: 'Cómputo distribuido y gestión de tesorería corporativa en Bitcoin',
    modelo: 'Estrategia de retención integral de Bitcoin minado y expansión de infraestructura de centros de datos globales.'
  },
  WULF: {
    tipo: 'Operador de infraestructura digital de cero emisiones de carbono',
    rubro: 'Centros de datos con energía nuclear e hidroeléctrica para Bitcoin e Inteligencia Artificial',
    modelo: 'Monetiza aprovechando energía libre de carbono de base nuclear para minería de criptoactivos y provisión de hosting HPC para clusters de IA.'
  },
  COIN: {
    tipo: 'Líder regulado y principal exchange de criptoactivos en EE.UU.',
    rubro: 'Plataformas de corretaje, custodia institucional y servicios de infraestructura Web3',
    modelo: 'Monetiza mediante comisiones de trading institucional/retail, custodia de más del 80% de los ETFs spot de Bitcoin/Ethereum y rendimientos por reservas de stablecoins (USDC).'
  },
  MSTR: {
    tipo: 'Mayor tenedor corporativo de Bitcoin del mundo y desarrollador de software empresarial',
    rubro: 'Vehículo de tesorería institucional apalancado sobre Bitcoin y software de Business Intelligence',
    modelo: 'Emisión de deuda convertible y acciones para acumular reservas de Bitcoin a gran escala, respaldado por su flujo operativo de software corporativo.'
  },

  // SOLAR & ENERGÍA LIMPIA
  ENPH: {
    tipo: 'Líder global indiscutido y pionero tecnológico en microinversores solares a nivel de módulo (MLPE)',
    rubro: 'Energía solar residencial distribuida, microinversores inteligentes IQ y baterías de almacenamiento',
    modelo: 'Venta de ecosistemas integrados de generación fotovoltaica, baterías modulares y software de gestión energética inteligente a instaladores globales.'
  },
  SEDG: {
    tipo: 'Gigante global y líder industrial en inversores solares con optimizadores de potencia DC',
    rubro: 'Tecnología fotovoltaica comercial y residencial, baterías y cargadores de vehículos eléctricos',
    modelo: 'Monetiza mediante optimizadores a nivel de panel que maximizan la cosecha de energía en techos residenciales y plantas comerciales en más de 130 países.'
  },
  FSLR: {
    tipo: 'Mayor fabricante de módulos fotovoltaicos de EE.UU. y líder en tecnología de capa fina (CadTel)',
    rubro: 'Paneles solares a escala de servicios públicos (Utility-Scale) y manufactura industrial protegida',
    modelo: 'Venta de paneles a gran escala para parques solares de utilities, fuertemente beneficiado por subsidios de fabricación doméstica de la Ley IRA.'
  },
  RUN: {
    tipo: 'Líder y mayor proveedor de energía solar residencial y baterías bajo suscripción en EE.UU.',
    rubro: 'Energía solar distribuida como servicio (Solar-as-a-Service) y centrales eléctricas virtuales (VPP)',
    modelo: 'Contratos PPA y leasing a 20-25 años con propietarios residenciales, generando ingresos recurrentes y monetizando la venta de energía a la red eléctrica.'
  },
  PLUG: {
    tipo: 'Pionero de alto beta en la economía del hidrógeno verde y celdas de combustible',
    rubro: 'Celdas de combustible de hidrógeno (PEM), electrolizadores y logística de repostaje',
    modelo: 'Provisión de sistemas de energía para flotas de montacargas (Amazon, Walmart) y construcción de plantas de generación de hidrógeno líquido verde.'
  },

  // SEMICONDUCTORES & HARDWARE IA
  NVDA: {
    tipo: 'Monopolio tecnológico y líder absoluto mundial en computación acelerada e Inteligencia Artificial',
    rubro: 'GPUs para centros de datos, arquitectura Blackwell/Hopper y plataforma de software CUDA',
    modelo: 'Venta de procesadores gráficos y sistemas integrados de supercómputo (DGX, HGX) a proveedores cloud y corporaciones que entrenan modelos fundacionales de IA.'
  },
  TSM: {
    tipo: 'Líder monopólico global en fundición y manufactura avanzada de obleas de silicio',
    rubro: 'Fabricación de semiconductores de vanguardia (nodos de 3nm, 2nm y empaquetado CoWoS)',
    modelo: 'Fundición exclusiva para Apple, Nvidia, AMD y Qualcomm; produce más del 90% de los chips más avanzados del mundo con márgenes operativos líderes.'
  },
  ARM: {
    tipo: 'Líder monopólico mundial en diseño de arquitectura y licencias de procesadores',
    rubro: 'Propiedad intelectual (IP) y arquitecturas RISC para silicio móvil, automotriz y servidores',
    modelo: 'Cobro de regalías y licencias por cada chip fabricado con arquitectura ARM (presente en más del 99% de smartphones y en servidores cloud Neoverse).'
  },
  MU: {
    tipo: 'Uno de los tres gigantes globales oligopólicos en memorias DRAM y almacenamiento NAND Flash',
    rubro: 'Semiconductores de memoria de alto ancho de banda (HBM3e) y almacenamiento masivo para servidores',
    modelo: 'Venta de módulos de memoria de alta densidad para aceleradores de IA (Nvidia H200/B200), computadoras y teléfonos inteligentes de gama alta.'
  },
  AMD: {
    tipo: 'Segundo líder mundial en procesadores de alto rendimiento y principal retador en GPUs para IA',
    rubro: 'CPUs para servidores (EPYC), procesadores cliente (Ryzen) y aceleradores de IA (Instinct MI300)',
    modelo: 'Venta de procesadores fabless de alto margen para centros de datos, computación personal y consolas de videojuegos (PlayStation, Xbox).'
  },
  ON: {
    tipo: 'Líder industrial en semiconductores de potencia y sensores inteligentes',
    rubro: 'Carburo de silicio (SiC) y electrónica de potencia para movilidad eléctrica e industria',
    modelo: 'Suministro de inversores de potencia y sensores de tracción para fabricantes de vehículos eléctricos, energías renovables y automatización.'
  },
  MCHP: {
    tipo: 'Líder consolidado en microcontroladores embebidos y soluciones de conectividad',
    rubro: 'Semiconductores de control analógico y microprocesadores embebidos para industria y defensa',
    modelo: 'Catálogo diversificado con más de 125.000 clientes industriales, monetizando con productos de ciclo de vida prolongado y alta retención de clientes.'
  },

  // AEROESPACIAL, ESPACIO & ROBÓTICA
  RKLB: {
    tipo: 'Segundo líder en lanzamientos orbitales espaciales comerciales en EE.UU. tras SpaceX',
    rubro: 'Cohetes de lanzamiento orbital (Electron, Neutron) y manufactura de satélites espaciales',
    modelo: 'Contratos de transporte espacial para agencias gubernamentales (NASA, Space Force) y constelaciones comerciales, complementado con venta de componentes satelitales.'
  },
  LUNR: {
    tipo: 'Contratista aeroespacial líder en exploración y servicios de logística lunar comercial',
    rubro: 'Módulos de aterrizaje lunar (Nova-C), satélites de telecomunicaciones orbitales y cargas científicas',
    modelo: 'Contratos comerciales de servicios de carga útil lunar (CLPS) de la NASA para el programa Artemis y servicios de comunicación en el espacio profundo.'
  },
  JOBY: {
    tipo: 'Líder pionero en aeronaves eléctricas de despegue y aterrizaje vertical (eVTOL)',
    rubro: 'Movilidad aérea urbana y taxis aéreos eléctricos de cero emisiones operativas',
    modelo: 'Desarrollo y certificación comercial con la FAA para operar redes de transporte aéreo interurbano con el respaldo estratégico de Toyota y Delta Air Lines.'
  },
  ACHR: {
    tipo: 'Retador de rápido crecimiento en aviación eléctrica urbana (eVTOL Midnight)',
    rubro: 'Movilidad aérea urbana, manufactura aeroespacial y taxis aéreos comerciales',
    modelo: 'Venta de flotas de aeronaves eléctricas a aerolíneas (United Airlines) y operación de rutas urbanas en asociación con Stellantis.'
  },
  ASTS: {
    tipo: 'Líder pionero en conectividad satelital directa a teléfonos inteligentes estándar',
    rubro: 'Constelaciones satelitales LEO de banda ancha celular directa al móvil (Direct-to-Cell)',
    modelo: 'Alianzas con operadores móviles líderes (AT&T, Verizon, Vodafone, Google) para brindar cobertura celular 5G global sin requerir antenas modificadas.'
  },

  // FINTECH & LATAM
  SOFI: {
    tipo: 'Neobanco líder y plataforma fintech integrada de servicios financieros digitales en EE.UU.',
    rubro: 'Banca digital, originación de créditos personales/estudiantiles, corretaje y tecnología bancaria (Galileo)',
    modelo: 'Ecosistema de banca sin sucursales físicas que monetiza por margen financiero de préstamos, depósitos remunerados y cobro de licencias de infraestructura API.'
  },
  MELI: {
    tipo: 'Líder indiscutido y gigante del comercio electrónico y fintech en América Latina',
    rubro: 'Marketplace digital, logística de última milla (Mercado Envíos) y pagos digitales (Mercado Pago)',
    modelo: 'Comisiones transaccionales de e-commerce, publicidad digital (Mercado Ads), procesamiento de pagos y servicios de crédito financiero en Brasil, México y Argentina.'
  },
  NU: {
    tipo: 'Mayor plataforma de banca digital del mundo occidental por número de clientes activos',
    rubro: 'Neobanca digital, tarjetas de crédito sin comisión, cuentas de ahorro y préstamos en LatAm',
    modelo: 'Adquisición de clientes de muy bajo costo en Brasil, México y Colombia, monetizando mediante margen de intermediación financiera, tarjetas y seguros.'
  },

  // BIG TECH & ENTERPRISE SAAS
  PLTR: {
    tipo: 'Líder indiscutido en plataformas de software para operaciones de datos e Inteligencia Artificial',
    rubro: 'Sistemas operativos de IA corporativa y gubernamental (AIP, Gotham, Foundry)',
    modelo: 'Contratos plurianuales de alto valor con agencias de defensa nacional, inteligencia y empresas Fortune 500 para orquestación de datos y toma de decisiones con IA.'
  },
  TEAM: {
    tipo: 'Líder indiscutido en software de colaboración corporativa, gestión de proyectos y DevOps',
    rubro: 'Plataformas SaaS de productividad empresarial (Jira, Confluence, Trello, Loom)',
    modelo: 'Suscripciones mensuales y anuales por usuario corporativo en la nube, con una base masiva de empresas tecnológicas y alta tasa de retención neta.'
  },
};

// Generador inteligente de perfil de negocio (Tipo de empresa, líder/challenger, rubro y modelo)
export const getCompanyBusinessProfile = (item) => {
  const tk = String(item?.Ticker || '').toUpperCase().trim();
  if (KNOWN_COMPANY_PROFILES[tk]) {
    const prof = KNOWN_COMPANY_PROFILES[tk];
    const nameLabel = item?.Nombre && item.Nombre !== tk ? `${item.Nombre} (${tk})` : tk;
    return `${nameLabel} es una compañía posicionada como **${prof.tipo}**, especializada en el rubro de **${prof.rubro}**. Modelo de negocio: ${prof.modelo}`;
  }

  // Análisis heurístico inteligente basado en datos del activo
  const nombre = item?.Nombre || tk;
  const sector = item?.Sector || '';
  const cat = item?.Categoria || '';
  const beta = Number(item?.Beta_60D ?? item?.Beta ?? 1.2);
  const isBlueChip = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM', 'V', 'MA', 'COST', 'WMT', 'UNH', 'LLY', 'XOM'].includes(tk);
  const isCrypto = tk.includes('-USD') || ['BTC', 'ETH', 'SOL'].includes(tk);

  let standing = 'actor especializado y competidor relevante';
  if (isBlueChip) standing = 'líder de mercado indiscutido y titán corporativo global';
  else if (beta > 1.8) standing = 'jugador de alto crecimiento y beta expansivo';
  else if (beta < 0.9) standing = 'compañía defensiva consolidada con flujos de caja predecibles';
  else if (cat.includes('Cazador') || cat.includes('Sweet')) standing = 'compañía de mediana/gran capitalización con alta sensibilidad al ciclo de rebote';

  let rubroTexto = sector || 'renta variable y activos cotizados de alta liquidez';
  if (isCrypto) rubroTexto = 'criptoactivos descentralizados, tecnología de contratos inteligentes y protocolos de capa 1';
  else if (nombre.toLowerCase().includes('solar') || nombre.toLowerCase().includes('energy') || tk === 'SEDG' || tk === 'ENPH') rubroTexto = 'transición energética, energía solar distribuida y equipamiento fotovoltaico';
  else if (nombre.toLowerCase().includes('semi') || nombre.toLowerCase().includes('micro') || nombre.toLowerCase().includes('tech')) rubroTexto = 'tecnología de semiconductores, hardware avanzado y computación digital';
  else if (nombre.toLowerCase().includes('pharma') || nombre.toLowerCase().includes('bio') || nombre.toLowerCase().includes('therap')) rubroTexto = 'biotecnología, desarrollo farmacéutico y ciencias de la salud';
  else if (nombre.toLowerCase().includes('bank') || nombre.toLowerCase().includes('finan')) rubroTexto = 'servicios financieros, crédito e intermediación bancaria';

  let modeloTexto = `Monetiza mediante la comercialización de productos y servicios especializados en su sector, respondiendo a la dinámica de mercado del perfil ${cat || 'táctico'}.`;
  if (isCrypto) {
    modeloTexto = 'Monetiza a través de la adopción de red, tarifas de gas por procesamiento de transacciones y seguridad criptográfica en consenso distribuido.';
  }

  return `${nombre} (${tk}) está posicionada como **${standing}** en el rubro de **${rubroTexto}**. ${modeloTexto}`;
};

// ─── Constructor del prompt cuantitativo V5 con pesos SHAP ──────────────────────
export const buildPrompt = (item) => {
  const {
    Ticker, Nombre, Categoria, Precio_Actual, Sector,
    'Probabilidad_Exito_%': prob, 'WinRate_Modelo_%': winRate,
    Veredicto, Veredicto_V2,
    'Drawdown_52W_%': drawdown, 'Drawdown_10W_%': dd10w, RSI_14D: rsi14, RSI_2D: rsi2, RSI_2: rsi2Short,
    FCF: fcf, PE_Ratio: pe, Beta: beta, Beta_60D: beta60,
    Kalman_Slope: kalman, GARCH_Regime: garch, TP_ATR: tpAtr,
    'Dist_SMA50_%': distSma50, 'Dist_SMA200_%': distSma200, 'ATR_%': atrPct,
    CMF_20: cmf, Bear_Power_Delta_3D: bearPowerDelta, Price_Reversal_Giro: priceGiro,
    RS_vs_SPY_5D: rsSpy, Score_Streak: scoreStreak, Score_RSI_3: scoreRsi,
    Vol_Ratio_20_50: volRatio, MACD_Hist: macdHist,
  } = item;

  const veredictoVal = Veredicto || Veredicto_V2 || 'BUY';
  const p = getCategoryParams(Categoria);
  const tpPct = item['Take_Profit_%'] ?? p.tp;
  const slPct = item['Stop_Loss_%'] ?? p.sl;
  const limiteDias = item.Trii_TimeStop_Dias ?? item['Limite_Dias'] ?? 4;

  const priceNum = Number(Precio_Actual || 0);
  const tpPrice = item.Trii_TP_USD ?? item.Take_Profit_$ ?? (priceNum ? (priceNum * (1 + tpPct / 100)).toFixed(2) : 'N/A');
  const slPrice = item.Trii_SL_USD ?? item.Stop_Loss_ATR_$ ?? item.Stop_Loss_ATR_USD ?? (priceNum ? (priceNum * (1 - slPct / 100)).toFixed(2) : 'N/A');
  const triiRr = item.Trii_RR_Ratio ?? (tpPct / Math.max(0.1, slPct)).toFixed(1);
  const gatilloEstado = item.Gatillo_Precio || (priceGiro === 1 ? 'Confirmado' : 'Pendiente');
  const triiEstado = item.Trii_Estado || (veredictoVal === 'BUY' ? (cmf < -0.15 ? 'BLOQUEADO_LIQUIDACION_CMF' : ((scoreStreak || 0) < 1 ? 'ESPERANDO_RACHA_SCORE' : (gatilloEstado === 'Pendiente' ? 'ESPERANDO_GIRO_PRECIO' : 'EJECUTAR_COMPRA'))) : 'EN_SEGUIMIENTO');
  const sectorStr = Sector || (Nombre?.toLowerCase().includes('inc') || Nombre?.toLowerCase().includes('corp') ? 'Renta Variable / Tech & Growth' : 'Mercado Accionario US');
  const rsi2Val = rsi2 ?? rsi2Short ?? 'N/A';
  const profileContext = getCompanyBusinessProfile(item);

  return `Eres un analista cuantitativo senior y gestor de portafolio táctico especializado en modelos de Machine Learning para swing trading.
Modelo de Inferencia: LightGBM V5.0 Master Tactical (12 variables no redundantes seleccionadas bajo metodología Andréj Karpathy, calibración de probabilidad con Brier Score y ejecución con orden Bracket / OCO en cualquier broker).

FICHA TÁCTICA DEL ACTIVO — ${Ticker} (${Nombre}):
• Contexto de Negocio: ${profileContext}
• Perfil & Sector: ${sectorStr} | Categoría Táctica: ${Categoria}
• Precio Actual: $${Precio_Actual} USD | Probabilidad de Éxito Modelo V5: ${prob}% | Veredicto: ${veredictoVal}
• Estado Operativo: ${triiEstado} | Ratio R:R: ${triiRr}x | Gatillo Giro: ${gatilloEstado}

DESGLOSE DE VARIABLES V5 Y PESOS SHAP DEL MODELO:
1. TP/ATR [SHAP: 30.5% peso]: ${tpAtr ? `${tpAtr}x` : '2.2x'} (Objetivo adaptativo normalizado por volatilidad)
2. ATR % [SHAP: 12.4% peso]: ${atrPct != null ? `${atrPct}%` : 'Moderado'} (Rango verdadero diario)
3. Distancia SMA200 [SHAP: 10.2% peso]: ${distSma200 != null ? `${distSma200}%` : 'N/A'} (Desviación tendencial de largo plazo)
4. Régimen GARCH [SHAP: 9.5% peso]: ${garch != null ? `${garch}x` : '1.00x'} (Volatilidad condicional vs histórica)
5. Vol Ratio 20/50 [SHAP: 7.9% peso]: ${volRatio != null ? `${volRatio}x` : '1.0x'} (Volumen de absorción institucional)
6. MACD Histograma [SHAP: 7.0% peso]: ${macdHist != null ? `${macdHist}` : 'Neutral'} (Convergencia de momentum)
7. Drawdown 10W [SHAP: 6.6% peso]: ${dd10w != null ? `${dd10w}%` : (drawdown != null ? `${drawdown}%` : 'N/A')} (Descuento táctico de corto plazo)
8. Flujo CMF 20D [SHAP: 6.5% peso]: ${cmf != null ? `${cmf}` : 'N/A'} ${cmf < -0.15 ? '(⚠️ Liquidación institucional)' : '(✅ Flujo institucional saludable)'}
9. Fuerza Relativa vs SPY 5D [SHAP: 4.0% peso]: ${rsSpy != null ? `${rsSpy}%` : 'Neutral'} (Desempeño relativo vs S&P 500)
10. Bear Power Delta 3D [SHAP: 3.0% peso]: ${bearPowerDelta != null ? `${bearPowerDelta}` : '0.0'} (Exhaustión de fuerza vendedora)
11. RSI 2D Connors [SHAP: 2.3% peso]: ${rsi2Val} (Sobreventa extrema en 48 horas)
12. Gatillo de Giro [SHAP: 0.1% peso]: ${gatilloEstado} (Absorción de mínimos o Higher Low diario)

MOMENTUM PREDICTIVO Y GESTIÓN DE SALIDA (BRACKET / OCO):
• Racha de Score ML: ${scoreStreak ?? 0} días consecutivos ${Number(scoreStreak ?? 0) >= 2 ? '(✅ Racha validada para entrada)' : '(⏳ Acumulando días de convicción)'}
• Score-RSI (3D): ${scoreRsi != null ? scoreRsi : 'N/A'}
• Parámetros de Orden Bracket / OCO (Genéricos para Trii, Interactive Brokers, Hapi o cualquier broker):
  - Take Profit: +${tpPct}% ($${tpPrice} USD)
  - Stop Loss Defensivo ATR: -${slPct}% ($${slPrice} USD)
  - TimeStop (Expiración Táctica): ${limiteDias} días hábiles
  - Ratio Riesgo/Beneficio: ${triiRr}:1

INSTRUCCIONES DE REDACCIÓN:
1. En RUBRO & PERFIL DE NEGOCIO: Describe explícitamente:
   a) El tipo de empresa y posición competitiva (si es líder mundial, gigante consolidado, retador de alto crecimiento o actor emergente especializado).
   b) El rubro e industria específica.
   c) Su modelo de negocio, generación de ingresos y ventaja competitiva.
2. En DRIVERS SHAP: Analiza explícitamente cómo los pesos SHAP dominantes (TP/ATR, ATR %, Distancia SMA200, CMF y Bear Power Delta) fundamentan la señal alcista con números exactos.
3. En FACTORES DE RIESGO: Analiza los riesgos según el flujo CMF (${cmf ?? 'N/A'}), correlación vs SPY o sobreextensión bajista.
4. En PLAN DE EJECUCIÓN TÁCTICO: Redacta un plan genérico aplicable a cualquier broker (Trii, Interactive Brokers, Hapi, Charles Schwab, etc.) detallando entrada sujeta al gatillo, precio exacto de TP, SL y TimeStop en días.

ESTRUCTURA EXACTA REQUERIDA:

🏢 **RUBRO & PERFIL DE NEGOCIO:**
[2-3 líneas: posición competitiva (¿Líder, challenger o emergente?), rubro e industria exacta, y modelo de negocio/monetización de ${Ticker} (${Nombre}).]

📊 **DRIVERS CUANTITATIVOS SHAP (CASO BULL):**
[3-4 líneas: analiza el peso de las variables SHAP principales (ej. ratio TP/ATR, compresión GARCH, racha de score de ${scoreStreak ?? 0}d y agotamiento vendedor Bear Power). Cita números exactos.]

⚠️ **FACTORES DE RIESGO & FILTROS BEAR:**
[2 líneas: riesgos clave según el flujo CMF (${cmf ?? 'N/A'}), correlación vs SPY o nivel de sobreextensión bajista.]

🎯 **PLAN DE EJECUCIÓN TÁCTICO (ORDEN BRACKET / OCO):**
[2-3 líneas: plan genérico para Trii o cualquier broker con orden condicional/bracket. Detalla estado (${triiEstado}), entrada (${gatilloEstado}), TP en $${tpPrice} (+${tpPct}%), SL en $${slPrice} (-${slPct}%) y TimeStop de ${limiteDias}d (Ratio ${triiRr}x).]

Español. Tono analítico, institucional y conciso. Máximo 230 palabras.`;
};

// ─── Generador algorítmico de respaldo cuantitativo V5 ────────────────────────
export const generateQuantitativeThesisFallback = (item) => {
  const {
    Ticker, Nombre, Categoria, Precio_Actual, Sector,
    'Probabilidad_Exito_%': prob,
    'Drawdown_10W_%': dd10w, 'Drawdown_52W_%': drawdown,
    CMF_20: cmf, Bear_Power_Delta_3D: bearPowerDelta, Price_Reversal_Giro: priceGiro,
    Score_Streak: scoreStreak, Score_RSI_3: scoreRsi,
    GARCH_Regime: garch, TP_ATR: tpAtr, ATR_Pct: atrRisk, 'ATR_%': atrPct,
  } = item;

  const p = getCategoryParams(Categoria);
  const tpPct = item['Take_Profit_%'] ?? p.tp;
  const slPct = item['Stop_Loss_%'] ?? p.sl;
  const limiteDias = item.Trii_TimeStop_Dias ?? item['Limite_Dias'] ?? 4;
  const priceNum = Number(Precio_Actual || 0);
  const tpPrice = item.Trii_TP_USD ?? item.Take_Profit_$ ?? (priceNum ? (priceNum * (1 + tpPct / 100)).toFixed(2) : 'N/A');
  const slPrice = item.Trii_SL_USD ?? item.Stop_Loss_ATR_$ ?? item.Stop_Loss_ATR_USD ?? (priceNum ? (priceNum * (1 - slPct / 100)).toFixed(2) : 'N/A');
  const triiRr = item.Trii_RR_Ratio ?? (tpPct / Math.max(0.1, slPct)).toFixed(1);
  const gatilloEstado = item.Gatillo_Precio || (priceGiro === 1 ? 'Confirmado' : 'Pendiente');
  const cmfVal = cmf != null ? Number(cmf) : null;
  const triiEstado = item.Trii_Estado || (cmfVal < -0.15 ? 'BLOQUEADO_LIQUIDACION_CMF' : ((scoreStreak || 0) < 1 ? 'ESPERANDO_RACHA_SCORE' : (gatilloEstado === 'Pendiente' ? 'ESPERANDO_GIRO_PRECIO' : 'EJECUTAR_COMPRA')));
  const companyProfile = getCompanyBusinessProfile(item);

  return `🏢 **RUBRO & PERFIL DE NEGOCIO:**
${companyProfile}

📊 **DRIVERS CUANTITATIVOS SHAP (CASO BULL):**
El modelo LightGBM V5.0 asigna una probabilidad predictiva del ${prob}%. La decisión táctica está gobernada por el ratio TP/ATR de ${tpAtr ? `${tpAtr}x` : '2.2x'} (30.5% peso SHAP) y la volatilidad ATR de ${atrPct ?? atrRisk ?? 'moderada'}% (12.4% SHAP). Acumula una racha de score de ${scoreStreak || 0}d ${Number(scoreStreak || 0) >= 2 ? 'con confirmación alcista consecutiva' : 'en fase de acumulación temprana'} con régimen de volatilidad GARCH de ${garch ? `${garch}x` : '1.0x'}.

⚠️ **FACTORES DE RIESGO & FILTROS BEAR:**
El flujo de dinero institucional CMF (20D) se ubica en ${cmfVal != null ? cmfVal.toFixed(3) : 'N/A'} ${cmfVal < -0.15 ? '(⚠️ alerta por presión vendedora forzosa)' : '(rango controlado > -0.15)'} con drawdown táctico de ${dd10w ?? drawdown ?? 'N/A'}% en 10 semanas.

🎯 **PLAN DE EJECUCIÓN TÁCTICO (ORDEN BRACKET / OCO):**
Configuración genérica válida para Trii, Interactive Brokers, Hapi o cualquier broker con órdenes condicionales OCO:
• Estado Operativo: ${triiEstado} (Gatillo de precio: ${gatilloEstado})
• Take Profit Objetivo: $${tpPrice} USD (+${tpPct}%)
• Stop Loss Defensivo ATR: $${slPrice} USD (-${slPct}%)
• TimeStop Táctico: ${limiteDias} días hábiles (expiración temporal por gestión de capital)
• Ratio Riesgo/Beneficio: ${triiRr}:1`;
};

// ─── Hook: llama Gemini con fallback cuantitativo V5 ─────────────────────────
const useGeminiThesis = (item) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [error, setError] = useState('');
  const [modelUsed, setModelUsed] = useState('');

  const run = useCallback(async () => {
    const activeKey = getGeminiKey();
    setLoading(true); setText(''); setError(''); setModelUsed('');
    const prompt = buildPrompt(item);
    let success = false;
    let lastErrMsg = '';

    if (activeKey && activeKey.startsWith('AIzaSy')) {
      for (const model of MODELS) {
        setCurrentModel(model);
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
          );
          const d = await res.json();
          if (d.error) {
            const msg = d.error.message || '';
            lastErrMsg = msg;
            if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('limit') || msg.includes('not found')) continue;
            throw new Error(msg);
          }
          const result = d.candidates?.[0]?.content?.parts?.[0]?.text;
          if (result) { setText(result); setModelUsed(model); success = true; break; }
        } catch (e) {
          lastErrMsg = e.message || 'Error de red / API';
        }
      }
    }

    if (!success) {
      // Si la API no responde o no hay clave AIzaSy configurada, generar análisis algorítmico V5
      const fallback = generateQuantitativeThesisFallback(item);
      setText(fallback);
      setModelUsed('Motor Cuantitativo V5 (Karpathy + SHAP)');
      success = true;
    }

    setCurrentModel('');
    setLoading(false);
  }, [item]);

  // NO auto-ejecutar — se dispara con botón
  return { text, loading, currentModel, error, modelUsed, generate: run };
};

// ─── Render de la tesis cuantitativa con colores ─────────────────────────────
const ThesisText = ({ text }) => {
  if (!text) return null;
  return (
    <div style={{ fontSize: '0.84rem', lineHeight: 1.7, color: '#cbd5e1' }}>
      {text.split('\n').filter(l => l.trim()).map((line, i) => {
        const cleaned = line.replace(/\*\*/g, '').replace(/^#+\s*/, '');
        const isBull = line.includes('📈') || line.toUpperCase().includes('BULL') || line.includes('📊') || line.toUpperCase().includes('DRIVERS') || line.toUpperCase().includes('SHAP');
        const isBear = line.includes('📉') || line.toUpperCase().includes('BEAR') || line.includes('⚠️') || line.toUpperCase().includes('RIESGO');
        const isVerdict = line.includes('🎯') || line.toUpperCase().includes('PLAN') || line.toUpperCase().includes('TRII') || line.toUpperCase().includes('BRACKET');
        const isRubro = line.includes('🏢') || line.toUpperCase().includes('RUBRO') || line.toUpperCase().includes('NEGOCIO');
        const color = isBull ? '#10b981' : isBear ? '#ef4444' : isVerdict ? '#a78bfa' : isRubro ? '#38bdf8' : '#cbd5e1';
        const isHeader = isBull || isBear || isVerdict || isRubro;
        return (
          <p key={i} style={{ margin: isHeader ? '12px 0 4px' : '0 0 2px', color, fontWeight: isHeader ? 800 : 400, letterSpacing: isHeader ? '0.02em' : 'normal' }}>
            {cleaned}
          </p>
        );
      })}
    </div>
  );
};

// ─── Widget TradingView mini ──────────────────────────────────────────────────
const TradingViewChart = ({ ticker }) => {
  // Detecta si es cripto
  const isCrypto = ticker.includes('-USD') || ticker === 'BTC' || ticker === 'ETH';
  const symbol = isCrypto ? `CRYPTO:${ticker.replace('-USD', '')}USD` : `${ticker}`;

  const src = `https://www.tradingview.com/embed-widget/advanced-chart/?locale=es#${encodeURIComponent(JSON.stringify({
    symbol,
    interval: 'D',
    width: '100%',
    height: '100%',
    theme: 'dark',
    style: '1',
    toolbar_bg: '#0b1120',
    enable_publishing: false,
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    studies: ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
    container_id: `tv_${ticker}`,
    backgroundColor: 'rgba(11,17,32,1)',
    gridColor: 'rgba(255,255,255,0.04)',
  }))}`;

  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px', display: 'block' }}
      title={`Chart ${ticker}`}
      loading="lazy"
    />
  );
};

// ─── Pill de métrica ──────────────────────────────────────────────────────────
const Pill = ({ label, value, color = '#94a3b8', bg = 'rgba(30,41,59,0.9)', border = 'rgba(255,255,255,0.08)', title: tip = '' }) => (
  <span title={tip} style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem',
    padding: '4px 10px', borderRadius: '20px', background: bg, color, border: `1px solid ${border}`,
    fontWeight: 600, cursor: tip ? 'help' : 'default', whiteSpace: 'nowrap',
  }}>
    <span style={{ color: '#475569', fontWeight: 400 }}>{label}</span>
    <span>{value}</span>
  </span>
);

const Bar = ({ value, color = '#6366f1' }) => {
  const pct = Math.min(100, Math.max(0, Number(value)));
  return (
    <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexGrow: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}88, ${color})`, transition: 'width 0.6s' }} />
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const AssetCard = ({ item, rank }) => {
  const navigate = useNavigate();
  const [nameHover, setNameHover] = useState(false);
  const [showChart, setShowChart] = useState(rank <= 10);

  const {
    Ticker, Nombre, Categoria, Precio_Actual,
    'Probabilidad_Exito_%': prob,
    'Drawdown_52W_%': drawdown,
    RSI_14D: rsi14,
    RSI_2D: rsi2,
    FCF: fcf,
    PE_Ratio: pe,
    Beta: beta,
  } = item;

  const p = getCategoryParams(Categoria);
  const tpPct = item['Take_Profit_%'] ?? p.tp;
  const slPct = item['Stop_Loss_%'] ?? p.sl;
  const limiteDias = item['Limite_Dias'] ?? p.dias;

  const priceNum = Number(Precio_Actual || 0);
  const tpPrice = item.Take_Profit_$ ?? (priceNum ? (priceNum * (1 + tpPct / 100)).toFixed(2) : 'N/A');
  const slPrice = item.Stop_Loss_ATR_$ ?? item.Stop_Loss_ATR_USD ?? (priceNum ? (priceNum * (1 - slPct / 100)).toFixed(2) : 'N/A');

  const veredictoVal = item.Veredicto || item.Veredicto_V2 || 'HOLD';
  const emojiVal = item.Emoji || (veredictoVal === 'BUY' ? '💎' : veredictoVal === 'WATCH' ? '👀' : '⏳');
  const umbralVal = item['Umbral_Optimo_%'] ?? item['Umbral_Requerido_%'] ?? 40.0;
  const winRateVal = item['WinRate_Modelo_%'] ?? getCategoryWinRate(Categoria);

  // ─── Variables V5 Cuantitativas & Trii ──────────────────────────────────────
  const scoreStreak = item.Score_Streak != null ? Number(item.Score_Streak) : 0;
  const scoreRsi = item.Score_RSI_3 != null ? Number(item.Score_RSI_3) : null;
  const cmfVal = item.CMF_20 != null ? Number(item.CMF_20) : null;
  const gatilloPrecio = item.Gatillo_Precio || (item.Price_Reversal_Giro === 1 ? 'Confirmado' : 'Pendiente');
  const triiEstado = item.Trii_Estado || (veredictoVal === 'BUY' ? (cmfVal < -0.15 ? 'BLOQUEADO_LIQUIDACION_CMF' : (scoreStreak < 1 ? 'ESPERANDO_RACHA_SCORE' : (gatilloPrecio === 'Pendiente' ? 'ESPERANDO_GIRO_PRECIO' : 'EJECUTAR_TRII'))) : 'EN_SEGUIMIENTO');
  const triiTp = item.Trii_TP_USD ?? tpPrice;
  const triiSl = item.Trii_SL_USD ?? slPrice;
  const triiRr = item.Trii_RR_Ratio ?? (tpPct / Math.max(0.1, slPct)).toFixed(1);

  // Badge de estado Trii
  let triiCfg = { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(255,255,255,0.08)', label: '📊 EN SEGUIMIENTO', icon: '⏱️' };
  if (triiEstado === 'EJECUTAR_TRII') {
    triiCfg = { color: '#10b981', bg: 'rgba(16,185,129,0.18)', border: '#10b981', label: '💎 LISTO PARA TRII (BRACKET)', icon: '🚀' };
  } else if (triiEstado === 'ESPERANDO_GIRO_PRECIO') {
    triiCfg = { color: '#f59e0b', bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', label: '⏳ ESPERANDO GIRO DE PRECIO', icon: '🛡️' };
  } else if (triiEstado === 'BLOQUEADO_LIQUIDACION_CMF') {
    triiCfg = { color: '#ef4444', bg: 'rgba(239,68,68,0.18)', border: '#ef4444', label: '🚫 BLOQUEADO: LIQUIDACIÓN CMF', icon: '⚠️' };
  } else if (triiEstado === 'ESPERANDO_RACHA_SCORE') {
    triiCfg = { color: '#38bdf8', bg: 'rgba(56,189,248,0.18)', border: '#38bdf8', label: '⏳ ACUMULANDO RACHA DE SCORE', icon: '📈' };
  }

  const cfg = getCategoryConfig(Categoria);
  const probNum = Number(prob ?? 0);
  const probColor = probNum >= 60 ? '#10b981' : probNum >= 40 ? '#eab308' : '#ef4444';
  const verdColor = veredictoVal === 'BUY' ? '#10b981' : veredictoVal === 'WATCH' ? '#eab308' : '#94a3b8';
  const fcfNeg = typeof fcf === 'string' && (fcf.startsWith('-') || fcf.startsWith('$-'));
  const dd = Math.abs(Number(drawdown ?? 0));
  const rsi14n = Number(rsi14 ?? 50);

  const { text: thesis, loading, currentModel, error, modelUsed, generate } = useGeminiThesis(item);

  const goToDetail = (e) => {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('iframe')) return;
    navigate(`/activo/${Ticker}`);
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // MODO COMPACTO COLAPSADO PARA RANK > 10 (Sin gráfica por defecto)
  // ═════════════════════════════════════════════════════════════════════════════
  if (rank > 10 && !showChart) {
    return (
      <article
        onClick={goToDetail}
        tabIndex={0}
        role="button"
        aria-label={`Ver detalles tácticos de ${Ticker}`}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') goToDetail(e); }}
        style={{
          background: 'rgba(14, 20, 36, 0.82)',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          transition: 'transform 0.2s ease, border-color 0.2s',
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.28)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
      >
        {/* Identificador y Categoría */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color: '#94a3b8' }}>
            #{rank}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>{Ticker}</h3>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{Nombre}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.emoji} {Categoria}</span>
              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 700, background: `${verdColor}1a`, color: verdColor }}>{emojiVal} {veredictoVal}</span>
            </div>
          </div>
        </div>

        {/* Métricas V5 Compactas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ width: '120px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: '#64748b' }}>Prob. Éxito</span>
              <strong style={{ color: probColor }}>{probNum}%</strong>
            </div>
            <Bar value={probNum} color={probColor} />
          </div>

          {/* Badge Trii */}
          <span style={{
            padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
            background: triiCfg.bg, color: triiCfg.color, border: `1px solid ${triiCfg.border}`,
            display: 'inline-flex', alignItems: 'center', gap: '4px'
          }}>
            {triiCfg.icon} {triiCfg.label}
          </span>

          {/* Racha Score */}
          <span title="Racha de aumento del Score: Días consecutivos con convicción alcista" style={{ fontSize: '0.74rem', fontWeight: 700, color: scoreStreak >= 2 ? '#10b981' : '#f59e0b', background: scoreStreak >= 2 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '8px', border: scoreStreak >= 2 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.06)', fontVariantNumeric: 'tabular-nums' }}>
            🔥 {scoreStreak}d racha
          </span>

          {/* CMF */}
          <span title="Chaikin Money Flow: Flujo institucional de dinero en 20 días" style={{ fontSize: '0.74rem', fontWeight: 700, color: cmfVal > 0 ? '#10b981' : cmfVal < -0.15 ? '#ef4444' : '#94a3b8', background: cmfVal < -0.15 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '8px', border: cmfVal < -0.15 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)', fontVariantNumeric: 'tabular-nums' }}>
            💧 CMF: {cmfVal != null ? (cmfVal > 0 ? `+${cmfVal.toFixed(2)}` : cmfVal.toFixed(2)) : 'N/A'}
          </span>

          {/* Gatillo Giro */}
          <span title="Acción de Precio: Vela de absorción o Higher Low" style={{ fontSize: '0.74rem', fontWeight: 700, color: gatilloPrecio === 'Confirmado' ? '#10b981' : '#f59e0b', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            🎯 {gatilloPrecio}
          </span>
        </div>

        {/* Precio & Botón de Gráfica */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: 'auto' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
              ${Number(Precio_Actual).toFixed(2)}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
              TP: +{tpPct}% · SL: -{slPct}%
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setShowChart(true); }}
            aria-label={`Desplegar gráfica de ${Ticker}`}
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#818cf8',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📊 Ver Gráfica
          </button>
        </div>
      </article>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // MODO COMPLETO (Top 10 o Activo Desplegado a Demanda)
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <article
      onClick={goToDetail}
      tabIndex={0}
      role="button"
      aria-label={`Detalle completo de ${Ticker}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') goToDetail(e); }}
      style={{
        background: 'rgba(14, 20, 36, 0.88)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, border-color 0.2s',
        color: 'var(--text-primary, #f1f5f9)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.28)'; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
    >
      {/* ══ COLUMNA IZQUIERDA: Métricas V5 + Trii + Tesis ═════════════════ */}
      <div style={{ flex: '1 1 380px', minWidth: '320px', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>
              #{rank}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>{Ticker}</h2>
                {/* Nombre con tooltip */}
                <div style={{ position: 'relative' }}>
                  <span
                    style={{ fontSize: '0.82rem', color: '#64748b', cursor: 'help', borderBottom: '1px dashed rgba(100,116,139,0.4)' }}
                    onMouseEnter={() => setNameHover(true)}
                    onMouseLeave={() => setNameHover(false)}
                  >
                    {Nombre}
                  </span>
                  {nameHover && (
                    <div style={{
                      position: 'absolute', left: 0, top: '100%', marginTop: '6px', zIndex: 200,
                      width: '230px', background: 'rgba(10,16,28,0.98)', backdropFilter: 'blur(12px)',
                      border: `1px solid ${cfg.border}44`, borderRadius: '12px', padding: '10px 13px',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color }}>{cfg.emoji} {Categoria}</span>
                      <p style={{ margin: '5px 0 0', fontSize: '0.77rem', color: '#64748b', lineHeight: 1.5 }}>{cfg.desc}</p>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.emoji} {Categoria}</span>
                <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: `${verdColor}1a`, color: verdColor, border: `1px solid ${verdColor}` }}>{emojiVal} {veredictoVal}</span>
              </div>
            </div>
          </div>

          {/* Precio & Botón colapsar si rank > 10 */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
              ${Number(Precio_Actual).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            {rank > 10 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowChart(false); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.7rem', cursor: 'pointer', padding: '2px 0' }}
              >
                🔼 Colapsar gráfica
              </button>
            )}
          </div>
        </div>

        {/* ── HUD DE EJECUCIÓN TRII & PROTECCIÓN V5 ────────────────────────── */}
        <div style={{
          padding: '11px 16px', borderRadius: '14px',
          background: triiCfg.bg, border: `1px solid ${triiCfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.05rem' }}>{triiCfg.icon}</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: triiCfg.color, letterSpacing: '0.03em' }}>
              {triiCfg.label}
            </span>
          </div>
          <div style={{ fontSize: '0.73rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums', display: 'flex', gap: '10px' }}>
            <span>TimeStop: <strong style={{ color: '#f8fafc' }}>4d</strong></span>
            <span>·</span>
            <span>R:R: <strong style={{ color: '#f8fafc' }}>{triiRr}x</strong></span>
            <span>·</span>
            <span>Gatillo: <strong style={{ color: gatilloPrecio === 'Confirmado' ? '#10b981' : '#f59e0b' }}>{gatilloPrecio}</strong></span>
          </div>
        </div>

        {/* Barras de Convicción del Modelo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', width: '100px', flexShrink: 0 }}>Prob. Éxito V5</span>
            <Bar value={probNum} color={probColor} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: probColor, width: '45px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{probNum}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', width: '100px', flexShrink: 0 }}>Win Rate OOS</span>
            <Bar value={Number(winRateVal ?? 0)} color="#6366f1" />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#818cf8', width: '45px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{winRateVal}%</span>
          </div>
        </div>

        {/* ── HUD CUANTITATIVO V5: RACHA SCORE & CMF & GATILLOS ───────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
          background: 'rgba(15,23,42,0.6)', padding: '10px', borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {/* Tile 1: Racha de Score */}
          <div title="Score Streak: Días consecutivos con probabilidad creciente. Racha ≥ 2 días eleva el Win Rate al 51.9%." style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px', border: scoreStreak >= 2 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.04)', cursor: 'help' }}>
            <div style={{ fontSize: '0.64rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>🔥 Racha Score</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: scoreStreak >= 2 ? '#10b981' : '#f59e0b', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              {scoreStreak} {scoreStreak === 1 ? 'Día' : 'Días'}
            </div>
            <div style={{ fontSize: '0.64rem', color: scoreStreak >= 2 ? '#10b981' : '#64748b', fontWeight: 600, marginTop: '2px' }}>
              {scoreStreak >= 2 ? '✅ Validada' : '⏳ Acumulando'}
            </div>
          </div>

          {/* Tile 2: CMF 20D */}
          <div title="Chaikin Money Flow (20D): Presión de acumulación institucional. CMF < -0.15 alerta sobre liquidación agresiva." style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px', border: cmfVal < -0.15 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.04)', cursor: 'help' }}>
            <div style={{ fontSize: '0.64rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>💧 Flujo CMF</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: cmfVal > 0 ? '#10b981' : cmfVal < -0.15 ? '#ef4444' : '#eab308', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              {cmfVal != null ? (cmfVal > 0 ? `+${cmfVal.toFixed(3)}` : cmfVal.toFixed(3)) : 'N/A'}
            </div>
            <div style={{ fontSize: '0.64rem', color: cmfVal > 0 ? '#10b981' : cmfVal < -0.15 ? '#ef4444' : '#64748b', fontWeight: 600, marginTop: '2px' }}>
              {cmfVal > 0 ? '🟢 Acumulación' : cmfVal < -0.15 ? '🔴 Liquidación' : '⚪ Neutral'}
            </div>
          </div>

          {/* Tile 3: Score-RSI3 */}
          <div title="Score-RSI (3 Días): Momentum del scoring cuantitativo. >50 señala aceleración de compras." style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', cursor: 'help' }}>
            <div style={{ fontSize: '0.64rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>⚡ Score-RSI3</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: (scoreRsi ?? 50) >= 50 ? '#10b981' : '#94a3b8', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              {scoreRsi != null ? scoreRsi.toFixed(1) : 'N/A'}
            </div>
            <div style={{ fontSize: '0.64rem', color: (scoreRsi ?? 50) >= 50 ? '#10b981' : '#64748b', fontWeight: 600, marginTop: '2px' }}>
              {(scoreRsi ?? 50) >= 50 ? '🚀 Acelerando' : '⚪ En espera'}
            </div>
          </div>

          {/* Tile 4: Gatillo de Giro */}
          <div title="Gatillo de Giro: Confirmado por vela de absorción con mecha inferior o formación de Higher Low." style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '8px', border: gatilloPrecio === 'Confirmado' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.04)', cursor: 'help' }}>
            <div style={{ fontSize: '0.64rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>🎯 Acción Giro</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: gatilloPrecio === 'Confirmado' ? '#10b981' : '#f59e0b', marginTop: '2px' }}>
              {gatilloPrecio === 'Confirmado' ? 'Confirmado' : 'Pendiente'}
            </div>
            <div style={{ fontSize: '0.64rem', color: gatilloPrecio === 'Confirmado' ? '#10b981' : '#f59e0b', fontWeight: 600, marginTop: '2px' }}>
              {gatilloPrecio === 'Confirmado' ? '✅ Vela Verde/HL' : '⏳ Espera Reversión'}
            </div>
          </div>
        </div>

        {/* Parámetros Operativos Bracket Trii */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <div title="Take Profit Trii: Precio exacto en USD y porcentaje para orden Bracket." style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)', padding: '9px 12px', cursor: 'help' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>🎯 TP Bracket</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>+{tpPct}%</div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>(${triiTp})</div>
          </div>
          <div title="Stop Loss Trii: Límite de pérdida exacto en USD para orden Bracket." style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', padding: '9px 12px', cursor: 'help' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>🛑 SL Bracket</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>-{slPct}%</div>
            <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700, marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>(${triiSl})</div>
          </div>
          <div title="TimeStop Trii: Cierre de seguridad a los 4 días hábiles si no alcanza TP para reasignar capital." style={{ background: 'rgba(96,165,250,0.08)', borderRadius: '10px', border: '1px solid rgba(96,165,250,0.2)', padding: '9px 12px', cursor: 'help' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>⏱️ TimeStop</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>4 Días</div>
            <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600, marginTop: '1px' }}>rotación rápida</div>
          </div>
          <div title="Ratio Riesgo-Beneficio: Relación entre ganancia potencial y riesgo asumido (mínimo 2.0x)." style={{ background: 'rgba(30,41,59,0.8)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', padding: '9px 12px', cursor: 'help' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>⚖️ Ratio R:R</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>{triiRr}x</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '1px' }}>mínimo 2:1</div>
          </div>
        </div>

        {/* Pills de métricas técnicas secundarias */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <Pill
            label="Kalman:"
            value={item.Kalman_Slope != null ? (Number(item.Kalman_Slope) > 0 ? `+${item.Kalman_Slope}` : `${item.Kalman_Slope}`) : 'En formación'}
            color={Number(item.Kalman_Slope ?? 0) > 0 ? '#10b981' : '#f43f5e'}
            title="Kalman Slope: Pendiente de tendencia estimada por Filtro de Kalman sin desfasaje."
          />
          <Pill
            label="GARCH:"
            value={item.GARCH_Regime != null ? `${item.GARCH_Regime}x` : '1.00x'}
            color="#38bdf8"
            title="GARCH Regime: Ratio de volatilidad actual vs histórica de 60 días."
          />
          <Pill
            label="TP/ATR:"
            value={item.TP_ATR != null ? `${item.TP_ATR}x` : (item['ATR_%'] ? (tpPct / item['ATR_%']).toFixed(2) + 'x' : 'N/A')}
            color="#a78bfa"
            title="TP/ATR: Multiplicador de Take Profit normalizado por volatilidad."
          />
          <Pill
            label="Kelly:"
            value={item['Position_Sizing_Kelly_%'] != null ? `${item['Position_Sizing_Kelly_%']}%` : 'N/A'}
            color="#38bdf8"
            title="Kelly %: Tamaño óptimo recomendado de posición."
          />
          <Pill
            label="DD 10W:"
            value={item['Drawdown_10W_%'] != null ? `${item['Drawdown_10W_%']}%` : 'N/A'}
            color="#94a3b8"
            title="Drawdown 10 Semanas: Caída táctica máxima en la ventana de 10 semanas."
          />
          <Pill
            label="RSI 2D:"
            value={rsi2 != null ? Number(rsi2).toFixed(1) : 'N/A'}
            color={Number(rsi2) < 10 ? '#10b981' : '#a78bfa'}
            title="RSI 2D Connors: Sobreventa extrema de corto plazo."
          />
        </div>

        {/* ── Tesis AI (generada bajo demanda) ─────────────────────────── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🤖 Tesis Cuantitativa</span>
              {modelUsed && <span style={{ fontSize: '0.65rem', color: '#334155', fontFamily: 'monospace' }}>· {modelUsed}</span>}
            </div>
            {!thesis && !loading && (
              <button
                onClick={generate}
                style={{ padding: '5px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}
              >
                ✨ Generar Tesis
              </button>
            )}
            {thesis && !loading && (
              <button onClick={generate} style={{ background: 'none', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '7px', padding: '4px 10px', cursor: 'pointer', color: '#64748b', fontSize: '0.68rem' }}>↺ Nueva</button>
            )}
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.12)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: '0.72rem', color: '#475569' }}>
                Generando tesis · <span style={{ color: '#818cf8', fontFamily: 'monospace' }}>{currentModel}</span>
              </span>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p style={{ margin: 0, color: '#ef4444', fontSize: '0.75rem' }}>{error}</p>
            </div>
          )}

          {thesis && !loading && (
            <div style={{ background: 'rgba(10,16,28,0.7)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.12)', padding: '14px 16px' }}>
              <ThesisText text={thesis} />
            </div>
          )}
        </div>
      </div>

      {/* ══ COLUMNA DERECHA: Gráfica TradingView ═════════════════════════ */}
      <div style={{
        flex: '1 1 380px', minWidth: '300px', minHeight: '480px',
        background: '#0a1020', borderLeft: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 600 }}>📈 GRÁFICA TÁCTICA · {Ticker}</span>
          <a href={`/activo/${Ticker}`} style={{ fontSize: '0.68rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }} onClick={e => e.stopPropagation()}>Ver análisis completo ↗</a>
        </div>
        <div style={{ flex: 1, padding: '8px' }}>
          <TradingViewChart ticker={Ticker} />
        </div>
      </div>
    </article>
  );
};

export default AssetCard;
