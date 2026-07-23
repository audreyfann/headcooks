// All tunable constants: sheets to skip, descriptor words to strip,
// unit conversion tables, and ingredient-specific conversions.
// Edit this file to adapt the extractor to your own spreadsheet's vocabulary.

export const DEFAULT_SKIP_SHEETS = new Set(["InstructionsGuide", "TEMPLATE", "Sheet11", "RowSig"]);

// Vague quantity-descriptor phrases stripped from the FRONT of ingredient names
// e.g. "a drizzle of sesame oil" -> "sesame oil"
export const VAGUE_QUANTITY_PREFIXES = [
  /^a\s+drizzle\s+of\s+/i,
  /^a\s+pinch\s+of\s+/i,
  /^a\s+dash\s+of\s+/i,
  /^a\s+splash\s+of\s+/i,
  /^a\s+bit\s+of\s+/i,
  /^a\s+handful\s+of\s+/i,
  /^a\s+touch\s+of\s+/i,
  /^a\s+sprinkle\s+of\s+/i,
  /^a\s+dollop\s+of\s+/i,
  /^a\s+squeeze\s+of\s+/i,
  /^some\s+/i,
  /^a\s+few\s+/i,
];

// Descriptive/prep words + stray measurement words stripped when normalizing names
export const NAME_MODIFIERS = new Set([
  "fresh", "baby", "large", "small", "extra", "kosher", "unsalted", "salted",
  "raw", "cooked", "dry", "dried", "canned", "frozen", "whole", "organic",
  "low", "fat", "nonfat", "chopped", "minced", "sliced", "diced",
  "shredded", "crushed", "ground", "roasted", "toasted", "peeled", "grated",
  "julienned", "halved", "crumbled", "packed", "ripe", "boneless", "skinless",
  "all", "purpose", "golden", "wild", "green", "red", "yellow",
  "white", "purple", "for",
  "tsp", "tsps", "teaspoon", "teaspoons", "tbsp", "tbsps", "tablespoon", "tablespoons",
  "cup", "cups", "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
  "gram", "grams", "kg", "ml", "liter", "liters",
]);

// Unicode fraction characters -> decimal value
export const UNICODE_FRACTIONS = {
  "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.333, "⅔": 0.667,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

// Raw unit words -> normalized unit code
export const UNIT_MAP = {
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  cup: "cup", cups: "cup",
  tbsp: "tbsp", tbsps: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", tsps: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  oz: "oz", ounce: "oz", ounces: "oz",
  qt: "qt", quart: "qt", quarts: "qt",
  gal: "gal", gallon: "gal", gallons: "gal",
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", l: "l", liter: "l", liters: "l",
  clove: "clove", cloves: "clove",
  slice: "slice", slices: "slice",
  head: "head", heads: "head",
  bunch: "bunch", bunches: "bunch",
  stick: "stick", sticks: "stick",
  can: "can", cans: "can",
  pinch: "pinch", pinches: "pinch",
};

export const WEIGHT_TO_GRAMS = { lb: 453.592, oz: 28.3495, g: 1, kg: 1000 };
export const VOLUME_TO_ML = {
  cup: 236.588, tbsp: 14.7868, tsp: 4.92892,
  ml: 1, l: 1000, qt: 946.353, gal: 3785.41,
  stick: 118.294,
};

// Rough grams-per-cup for common staples -- lets weight and volume of the
// SAME ingredient combine (e.g. "flour: 2 cups" + "flour: 200g").
// Standard kitchen-reference approximations, not measured -- good enough
// for shopping-list purposes, not lab-precise.
export const STAPLE_DENSITY_G_PER_CUP = {
  flour: 120, "ap flour": 120, "bread flour": 127, "cake flour": 114,
  sugar: 200, "granulated sugar": 200, "brown sugar": 220, "powdered sugar": 120,
  butter: 227, "unsalted butter": 227,
  salt: 273, "kosher salt": 240, "table salt": 292,
  "olive oil": 216, "vegetable oil": 218, "canola oil": 218, "sesame oil": 216,
  honey: 340, "maple syrup": 322,
  milk: 240, water: 236.6, "heavy cream": 240, buttermilk: 245,
  rice: 185, cornstarch: 128, "cocoa powder": 85,
  "parmesan cheese": 100, "shredded cheese": 113,
  "rolled oats": 90, breadcrumbs: 108, panko: 108,
  "peanut butter": 258, mayonnaise: 220, "sour cream": 240, yogurt: 245,
  "soy sauce": 255, vinegar: 240, "lemon juice": 240,
};

// Ingredient-specific unit -> "natural unit" conversions.
export const INGREDIENT_UNIT_OVERRIDES = {
  garlic: {
    displayUnit: "clove",
    conversions: { tsp: 1, tbsp: 3, cup: 48, head: 10, lb: 80, oz: 5, clove: 1, count: 1 },
  },
};

// Ingredient names longer/word-heavier than this are flagged as likely
// pasted recipe text rather than a real ingredient, and routed to review.
export const MAX_INGREDIENT_NAME_LENGTH = 45;
export const MAX_INGREDIENT_NAME_WORDS = 7;

// Column header keyword -> internal field name (case-insensitive substring match)
export const HEADER_KEYWORDS = {
  ingredient: "ingredient",
  quantity: "quantity",
  note: "notes",
  status: "status",
  supplier: "supplier",
  arrived: "arrived",
};
