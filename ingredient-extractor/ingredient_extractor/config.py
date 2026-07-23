"""
All tunable constants live here: sheets to skip, descriptor words to strip,
unit conversion tables, and ingredient-specific conversions (garlic -> cloves,
staple densities for weight<->volume merging).

Edit this file to adapt the extractor to your own spreadsheet's vocabulary.
"""

# Sheet names to skip entirely (template/instruction/utility tabs, not real data)
DEFAULT_SKIP_SHEETS = {"InstructionsGuide", "TEMPLATE", "Sheet11", "RowSig"}

# Vague quantity-descriptor phrases to strip from the FRONT of ingredient names
# e.g. "a drizzle of sesame oil" -> "sesame oil"
VAGUE_QUANTITY_PREFIXES = [
    r"^a\s+drizzle\s+of\s+",
    r"^a\s+pinch\s+of\s+",
    r"^a\s+dash\s+of\s+",
    r"^a\s+splash\s+of\s+",
    r"^a\s+bit\s+of\s+",
    r"^a\s+handful\s+of\s+",
    r"^a\s+touch\s+of\s+",
    r"^a\s+sprinkle\s+of\s+",
    r"^a\s+dollop\s+of\s+",
    r"^a\s+squeeze\s+of\s+",
    r"^some\s+",
    r"^a\s+few\s+",
]

# Descriptive/prep words stripped out when normalizing ingredient names for grouping
# (also includes measurement words that sometimes leak into the name field itself)
NAME_MODIFIERS = {
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
}

# Unicode fraction characters -> decimal value (e.g. "1½" -> 1.5)
UNICODE_FRACTIONS = {
    "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.333, "⅔": 0.667,
    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
}

# Raw unit words (as they appear in spreadsheets) -> normalized unit code
UNIT_MAP = {
    "lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
    "cup": "cup", "cups": "cup",
    "tbsp": "tbsp", "tbsps": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp",
    "tsp": "tsp", "tsps": "tsp", "teaspoon": "tsp", "teaspoons": "tsp",
    "oz": "oz", "ounce": "oz", "ounces": "oz",
    "qt": "qt", "quart": "qt", "quarts": "qt",
    "gal": "gal", "gallon": "gal", "gallons": "gal",
    "g": "g", "gram": "g", "grams": "g",
    "kg": "kg", "kilogram": "kg", "kilograms": "kg",
    "ml": "ml", "l": "l", "liter": "l", "liters": "l",
    "clove": "clove", "cloves": "clove",
    "slice": "slice", "slices": "slice",
    "head": "head", "heads": "head",
    "bunch": "bunch", "bunches": "bunch",
    "stick": "stick", "sticks": "stick",
    "can": "can", "cans": "can",
    "pinch": "pinch", "pinches": "pinch",
}

# Base-unit conversion factors
WEIGHT_TO_GRAMS = {"lb": 453.592, "oz": 28.3495, "g": 1, "kg": 1000}
VOLUME_TO_ML = {
    "cup": 236.588, "tbsp": 14.7868, "tsp": 4.92892,
    "ml": 1, "l": 1000, "qt": 946.353, "gal": 3785.41,
    "stick": 118.294,  # 1 stick of butter = 1/2 cup
}

# Rough grams-per-cup for common staples, used to merge weight <-> volume
# measurements of the SAME ingredient (e.g. "flour: 2 cups" + "flour: 200g").
# Values are standard kitchen-reference approximations, not measured -- treat
# as directionally correct for shopping-list purposes, not lab-precise.
STAPLE_DENSITY_G_PER_CUP = {
    "flour": 120, "ap flour": 120, "bread flour": 127, "cake flour": 114,
    "sugar": 200, "granulated sugar": 200, "brown sugar": 220, "powdered sugar": 120,
    "butter": 227, "unsalted butter": 227,
    "salt": 273, "kosher salt": 240, "table salt": 292,
    "olive oil": 216, "vegetable oil": 218, "canola oil": 218, "sesame oil": 216,
    "honey": 340, "maple syrup": 322,
    "milk": 240, "water": 236.6, "heavy cream": 240, "buttermilk": 245,
    "rice": 185, "cornstarch": 128, "cocoa powder": 85,
    "parmesan cheese": 100, "shredded cheese": 113,
    "rolled oats": 90, "breadcrumbs": 108, "panko": 108,
    "peanut butter": 258, "mayonnaise": 220, "sour cream": 240, "yogurt": 245,
    "soy sauce": 255, "vinegar": 240, "lemon juice": 240,
}

# Ingredient-specific unit -> "natural" unit conversions.
# Currently only garlic -> cloves is implemented; add more the same way
# (e.g. "onion": {"lb": 2, "count": 1} to convert everything to "onions").
INGREDIENT_UNIT_OVERRIDES = {
    "garlic": {
        "display_unit": "clove",
        "conversions": {
            "tsp": 1,      # 1 tsp minced ~= 1 clove
            "tbsp": 3,     # 1 tbsp minced ~= 3 cloves
            "cup": 48,     # 1 cup minced ~= 48 cloves
            "head": 10,    # 1 head ~= 10 cloves
            "lb": 80,      # 1 lb whole bulbs ~= 80 cloves (~8 heads/lb)
            "oz": 5,       # 1 oz whole bulbs ~= 5 cloves
            "clove": 1,
            "count": 1,    # bare count of garlic treated as clove-equivalent
        },
    },
}

# Ingredient name strings (after length/word-count filtering) longer than this
# or with more words than this are flagged as "probably pasted recipe text,
# not a real ingredient name" and routed to the manual-review output instead
# of being included in the combined list.
MAX_INGREDIENT_NAME_LENGTH = 45
MAX_INGREDIENT_NAME_WORDS = 7

# Column header keywords -> internal field name (case-insensitive substring match)
HEADER_KEYWORDS = {
    "ingredient": "ingredient",
    "quantity": "quantity",
    "note": "notes",
    "status": "status",
    "supplier": "supplier",
    "arrived": "arrived",
}
