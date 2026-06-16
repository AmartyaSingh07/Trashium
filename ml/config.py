"""
Central configuration for the Trashium pricing-ML pipeline (v2 - market-value model).

WHY v2 DIFFERS FROM v1
  * MODEL TARGET is now Market_Value_perKg - the only genuinely uncertain quantity.
    v1 predicted the payout directly; because payout is an exact algebraic function
    of (market value, logistics, quantity), the model just re-derived the formula
    and scored a fake R2 ~0.999. We predict market value, then DERIVE the payout.
  * BUSINESS FORMULAS (single source of truth, implemented in pricing.py):
        logistics/kg   = logistics_cost / quantity
        user_payout/kg = market_value/kg * (1 - COMMISSION) - logistics/kg
        margin/kg      = market_value/kg - user_payout/kg - logistics/kg
                       = COMMISSION * market_value/kg
    COMMISSION = 0.0 reproduces the original (zero-margin) formula exactly.
  * Quality Defect Risk now lowers market value (dataset regenerated) so models learn it.

Dataset : selected_cities_two_year_daily_dataset (20 materials, 8 categories, 5 WB regions)
App      : lib/types.ts WasteType (7) + lib/constants.ts OPERATIONAL_SECTORS (5)
"""
from pathlib import Path

ML_DIR       = Path(__file__).resolve().parent
DATA_PATH    = ML_DIR / "data" / "dataset_learnable.xlsx"   # risk-adjusted training file
ARTIFACT_DIR = ML_DIR / "artifacts"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

# ---- Dataset columns (exactly as they appear in the file) ---- #
COL_DATE      = "Date"
COL_REGION    = "Region"
COL_CATEGORY  = "Waste Category"
COL_MATERIAL  = "Material Type"
COL_QTY       = "Quantity (Kg)"
COL_DISTANCE  = "Distance ( KM)"
COL_LOGISTICS = "Logistics Cost"
COL_DEMAND    = "Market Demand"
COL_RISK      = "Quality Defect Risk"
COL_MARKETVAL = "Market_Value_perKg (INR)"            # <-- MODEL TARGET
COL_PAYOUT    = "Total_User_Payout_perKg (INR)"       # reference (base, commission = 0)
COL_TARGET    = COL_MARKETVAL                          # what train_models.py predicts
COL_DROP      = ["Sr No"]

# ---- Business layer (the only knobs you normally touch) ---- #
TRASHIUM_COMMISSION = 0.15     # Trashium's cut of market value. 0.0 == original zero-margin formula.
MIN_MARGIN_PER_KG   = 0.50     # floor; flag a quote whose margin would fall below this.

# Serve-time logistics rate card. Fit on the dataset: Logistics ~ per_km*dist + base (r=0.79).
# At serve time, distance = user pin-code -> hub; cost comes from this card.
LOGISTICS_PER_KM = 4.80
LOGISTICS_BASE   = 111.06

# Quality-risk haircut on market value (mirrors regenerate_dataset.py; used for serving too).
RISK_MULTIPLIER = {"Low": 1.00, "Medium": 0.92, "High": 0.82}

# Correct demand effect (higher demand -> higher value). Replaces the raw file's
# inverted relationship during regeneration. Used for serving adjustments too.
DEMAND_MULTIPLIER = {"Low": 0.95, "Medium": 1.00, "High": 1.07}

# Demand is NOT a crew input -> default used at serve time when the live state is unknown.
DEFAULT_DEMAND = "Medium"

# ---- Dataset REGION -> Trashium OPERATIONAL_SECTOR (3 direct + 2 nearest-neighbour) ---- #
REGION_TO_SECTOR = {
    "Howrah":          "Howrah",
    "Hugli Chinsurah": "Hugli-Chinsura",
    "Tarakeswar":      "Tarakeswar",
    "Srirampore":      "Rishra",        # nearest-neighbour
    "Naihati":         "Shyamnagar",    # nearest-neighbour
}

# ---- Dataset WASTE CATEGORY -> Trashium WasteType ---- #
CATEGORY_TO_WASTETYPE = {
    "Plastic Scrap":     "Plastic",
    "Paper & Packaging": "Paper",
    "E-Waste":           "E-Waste",
    "Battery Scrap":     "E-Waste",
    "Ferrous Metal":     "Metal",
    "Non-Ferrous Metal": "Metal",
    "Vehicle Scrap":     "Metal",
    "Appliance Scrap":   "Metal",
}

FALLBACK_RATES = {"Glass": 4.50, "Organic": 1.50, "Mixed": 3.00}   # app types with no dataset coverage
OPERATIONAL_SECTORS = ["Rishra", "Howrah", "Shyamnagar", "Tarakeswar", "Hugli-Chinsura"]
APP_WASTE_TYPES     = ["Plastic", "Paper", "Glass", "Metal", "E-Waste", "Organic", "Mixed"]

ORDINAL_LEVELS = {COL_DEMAND: ["Low", "Medium", "High"],
                  COL_RISK:   ["Low", "Medium", "High"]}

MODEL_VERSION = "mv_v2"
RANDOM_STATE  = 42
