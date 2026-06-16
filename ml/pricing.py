"""
Business pricing math - the bridge from a predicted MARKET VALUE to a quote.

This is the single source of truth for the money formulas, shared by
build_price_table.py and mirrored by the app's lib/pricing.ts:

    logistics_cost   = LOGISTICS_BASE + LOGISTICS_PER_KM * distance_km
    logistics_per_kg = logistics_cost / quantity_kg
    user_payout/kg   = market_value/kg * (1 - commission) - logistics_per_kg
    margin/kg        = market_value/kg - user_payout/kg - logistics_per_kg
                     = commission * market_value/kg          (>= 0 for commission >= 0)
"""
import config as C


def estimate_logistics_cost(distance_km: float) -> float:
    """Serve-time logistics cost (INR) from user->hub distance, via the rate card."""
    return C.LOGISTICS_BASE + C.LOGISTICS_PER_KM * float(distance_km)


def logistics_per_kg(distance_km: float, quantity_kg: float) -> float:
    if quantity_kg is None or quantity_kg <= 0:
        return 0.0
    return estimate_logistics_cost(distance_km) / float(quantity_kg)


def user_payout_per_kg(market_value_per_kg: float, logistics_per_kg_: float,
                       commission: float = None) -> float:
    c = C.TRASHIUM_COMMISSION if commission is None else commission
    return market_value_per_kg * (1.0 - c) - logistics_per_kg_


def trashium_margin_per_kg(market_value_per_kg: float, commission: float = None) -> float:
    c = C.TRASHIUM_COMMISSION if commission is None else commission
    return market_value_per_kg * c


def quote(market_value_per_kg: float, distance_km: float, quantity_kg: float,
          commission: float = None) -> dict:
    """Full per-pickup quote from a predicted market value + this pickup's logistics."""
    lpk  = logistics_per_kg(distance_km, quantity_kg)
    payk = user_payout_per_kg(market_value_per_kg, lpk, commission)
    mgnk = trashium_margin_per_kg(market_value_per_kg, commission)
    payk = max(payk, 0.0)  # never quote a negative payout
    return {
        "market_value_per_kg": round(market_value_per_kg, 2),
        "logistics_per_kg":    round(lpk, 2),
        "user_payout_per_kg":  round(payk, 2),
        "margin_per_kg":       round(mgnk, 2),
        "user_payout_total":   round(payk * quantity_kg, 2),
        "margin_total":        round(mgnk * quantity_kg, 2),
        "below_min_margin":    bool(mgnk < C.MIN_MARGIN_PER_KG),
    }
