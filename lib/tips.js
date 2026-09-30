const COCINA = {
  mexican: "mexicana",
  mexican_food: "mexicana",
  italian: "italiana",
  pizza: "italiana / pizza",
  chinese: "china",
  japanese: "japonesa",
  sushi: "japonesa / sushi",
  thai: "tailandesa",
  indian: "india",
  french: "francesa",
  spanish: "española",
  tapas: "española / tapas",
  mediterranean: "mediterránea",
  greek: "griega",
  turkish: "turca",
  lebanese: "libanesa",
  arabic: "árabe",
  moroccan: "marroquí",
  peruvian: "peruana",
  argentinian: "argentina",
  brazilian: "brasileña",
  american: "estadounidense",
  burger: "hamburguesas",
  korean: "coreana",
  vietnamese: "vietnamita",
  seafood: "mariscos",
  vegetarian: "vegetariana",
  vegan: "vegana",
  breakfast: "desayuno",
  cafe: "café",
  coffee: "café",
  bakery: "panadería",
  barbecue: "parrilla",
  steak: "parrilla",
  ramen: "ramen",
  noodle: "fideos",
  street_food: "comida callejera",
  local: "local"
};

const PEDIR = {
  mexicana: "Tacos del día, salsa aparte y una agua fresca. Pide lo que veas salir más de la cocina.",
  italiana: "Pasta o pizza sencilla de la casa y un antipasto para compartir.",
  "italiana / pizza": "Pizza de temporada y un vino de la casa por copa.",
  china: "Un plato de verdura, uno de carne o tofu y arroz para la mesa.",
  japonesa: "Set del mediodía si existe; si no, nigiri simple y una sopa.",
  "japonesa / sushi": "Combinado del chef y algo caliente (gyoza o sopa).",
  tailandesa: "Un curry no demasiado picante al principio y un pad thai para comparar.",
  india: "Un curry suave, un plato tandoori y pan naan para mojar.",
  francesa: "El plato del día y un postre clásico. Media ración si el menú es largo.",
  española: "Ración de temporada y algo de la plancha. Evita cartas enormes.",
  "española / tapas": "3 o 4 tapas para compartir, una de ellas de verdura.",
  mediterránea: "Ensalada o hummus, pescado o verduras a la plancha.",
  griega: "Tzatziki, ensalada y una parrillada pequeña.",
  turca: "Kebab de la casa o pide pide. Ayran si hace calor.",
  libanesa: "Mezze para compartir: hummus, falafel y algo a la parrilla.",
  árabe: "Mezze y un plato asado. Té a la menta al final.",
  marroquí: "Cuscús o tajín del día. Pide el nivel de picante.",
  peruana: "Ceviche si es mediodía y un plato caliente para equilibrar.",
  argentina: "Corte de parrilla para compartir y ensalada. Chimichurri aparte.",
  brasileña: "Lo que esté a la parrilla o el plato regional del pizarrón.",
  hamburguesas: "La clásica de la casa; pide el punto de la carne.",
  coreana: "Un barbeque para compartir o un bibimbap si vas ligero.",
  vietnamita: "Pho o banh mi. Pide el caldo no demasiado lleno al inicio.",
  mariscos: "Lo fresco del día. Pregunta qué llegó esta mañana.",
  vegetariana: "El plato de temporada y una sopa o ensalada de entrada.",
  vegana: "El menú del día vegano; confirma si el caldo lleva origen animal.",
  desayuno: "Huevos o bol de temporada y café de especialidad si lo hay.",
  café: "Café de filtro o espresso y un bollo salado, no solo dulce.",
  panadería: "Lo que salga horneado en el momento. Pide para llevar si hay cola.",
  parrilla: "Un corte o brocheta para compartir y verdura a la brasa.",
  ramen: "El ramen de la casa; pide el nivel de caldo y picante.",
  fideos: "El tazón más pedido del local. Comparte una entrada frita.",
  "comida callejera": "Lo que tenga fila de locales. Come de pie y sigue caminando.",
  local: "El plato con nombre del pueblo o de la región. Pregunta al mesero."
};

const HACER = {
  restaurante: "Llega un poco antes de la hora punta. Si hay pizarra, pide eso.",
  visita: "Confirma horario de cierre el mismo día. Lleva agua y una capa ligera.",
  museo: "Compra entrada con tiempo si se puede.",
  parque: "Mejor con luz de mañana o atardecer.",
  mercado: "Ve temprano. Prueba una sola cosa en cada puesto. Lleva efectivo pequeño.",
  hotel: "Deja la maleta y anota la parada de transporte más cercana.",
  cafe: "Úsalo como pausa entre trayectos.",
  otro: "Anota cómo volver al alojamiento en transporte público."
};

export function cocinaEnEspanol(raw) {
  if (!raw) return "";
  const key = String(raw).toLowerCase().split(/[;,/]/)[0].trim().replace(/\s+/g, "_");
  return COCINA[key] || String(raw).replace(/_/g, " ");
}

export function tipoEnEspanol(raw) {
  const t = String(raw || "").toLowerCase();
  if (t.includes("rest")) return "restaurante";
  if (t.includes("cafe") || t.includes("café") || t.includes("coffee")) return "cafe";
  if (t.includes("muse")) return "museo";
  if (t.includes("park") || t.includes("parque")) return "parque";
  if (t.includes("market") || t.includes("mercado")) return "mercado";
  if (t.includes("hotel") || t.includes("aloj") || t.includes("hostel")) return "hotel";
  if (t.includes("visit") || t.includes("atrac") || t.includes("tour") || t.includes("templo") || t.includes("iglesia")) return "visita";
  if (["restaurante", "visita", "hotel", "cafe", "museo", "parque", "mercado", "otro"].includes(t)) return t;
  return "otro";
}

export function tipsPara(tipo, cocina) {
  const t = tipoEnEspanol(tipo);
  const c = cocinaEnEspanol(cocina);
  const pedir = PEDIR[c] || ((t === "restaurante" || t === "cafe") ? "Pide el plato del día o lo más pedido." : "");
  const que = HACER[t] || HACER.otro;
  return { pedir, que };
}

export function etiquetaTipo(tipo) {
  const map = {
    restaurante: "Restaurante",
    visita: "Visita",
    hotel: "Hotel",
    cafe: "Café",
    museo: "Museo",
    parque: "Parque",
    mercado: "Mercado",
    otro: "Otro"
  };
  return map[tipoEnEspanol(tipo)] || "Lugar";
}
