/**
 * Embedded Trashium pricing model (mv_v2) — runs natively in the Next.js runtime.
 *
 * This is the SAME trained scikit-learn model that ml/api served over HTTP, but with
 * its parameters extracted so inference needs no Python service, no container host, and
 * no network hop. It is a log-target linear regression:
 *
 *     market_value_per_kg = exp( intercept + coef · features )
 *     features = [ scaled(month, day_of_week, is_weekend),
 *                  Region one-hot(5), Material one-hot(20),
 *                  demand ordinal, risk ordinal ]
 *
 * Parity: verified to 0.0 absolute difference against sklearn's Pipeline.predict()
 * across all 3,780 sector×material×risk×demand×date combinations (see ml/artifacts/lr_mv.joblib).
 * OneHotEncoder was fit with handle_unknown="ignore", so an out-of-vocabulary material or
 * region contributes an all-zero block — identical to how the API behaved.
 *
 * Regenerate: extract params from ml/artifacts/lr_mv.joblib if the model is retrained.
 */

export const MODEL_VERSION = "mv_v2";

const INTERCEPT = 4.2025447329437595;

// Coefficients in ColumnTransformer output order:
// [month, day_of_week, is_weekend, Region×5, Material×20, demand, risk]
const COEF = [
  -0.0003782247627229602, -0.0004046807598940222, 0.0004567699072818394,
  0.014010474194266017, -0.016488968556021284, 0.01305431868651424,
  -0.02176149621955225, 0.01118567189479651,
  0.413200185070327, 0.7341688458282577, 1.7912389431824818,
  -0.08390432792793517, -1.0000615609576902, -2.1690226043926613,
  2.838040251904833, 2.116544314210344, -0.581621609442608,
  -0.06984474474973829, -0.7834314235319676, -0.08519902152453182,
  0.19854610487774801, -1.5997035860395858, -1.6860674830740467,
  0.9642625868055236, 0.5501054845517664, -1.3905358514899753,
  -0.07411484409522037, -0.08259965920532639, 0.05591390429987313,
  -0.09320203871721394,
];

// StandardScaler params for [month, day_of_week, is_weekend].
const NUM_MEAN = [7.264957264957265, 3.005128205128205, 0.28717948717948716];
const NUM_SCALE = [3.4008374091749523, 2.0029826543128064, 0.4524460512843647];

const REGION_CATEGORIES = ["Howrah", "Hugli Chinsurah", "Naihati", "Srirampore", "Tarakeswar"];
const MATERIAL_CATEGORIES = [
  "AC Compressor", "Aluminum", "Brass", "Car Battery", "Car Body", "Cardboard",
  "Catalytic Converter", "Copper", "E-Waste", "Inverter Battery", "Iron",
  "Lead Acid Battery", "Lithium Ion Battery", "Newspaper", "Plastic", "Radiator",
  "Stainless Steel", "Tin", "Two Wheeler Battery", "UPS Battery",
];
const ORDINAL_LEVELS = ["Low", "Medium", "High"];

// App operational sector -> dataset region (the model's vocabulary). Mirrors
// config.REGION_TO_SECTOR inverted. Unknown sectors pass through (-> all-zero one-hot).
const SECTOR_TO_REGION: Record<string, string> = {
  Howrah: "Howrah",
  "Hugli-Chinsura": "Hugli Chinsurah",
  Tarakeswar: "Tarakeswar",
  Rishra: "Srirampore",
  Shyamnagar: "Naihati",
};

function oneHot(value: string, categories: string[]): number[] {
  return categories.map((c) => (c === value ? 1 : 0));
}

/**
 * Predict market value per kg for one (sector, material, risk, demand).
 * `date` defaults to now (UTC) to match the API's datetime.utcnow().date() behavior;
 * month/day-of-week/is-weekend are mild seasonal features.
 * Always returns a positive number (exp of a finite linear term).
 */
export function predictMarketValuePerKg(
  sector: string,
  material: string,
  risk: string,
  demand: string,
  date: Date = new Date(),
): number {
  const month = date.getUTCMonth() + 1; // 1..12
  const jsDow = date.getUTCDay(); // Sun=0..Sat=6
  const dow = (jsDow + 6) % 7; // Python weekday(): Mon=0..Sun=6
  const isWeekend = dow >= 5 ? 1 : 0;

  const region = SECTOR_TO_REGION[sector] ?? sector;
  const demandLevel = ORDINAL_LEVELS.includes(demand) ? demand : "Medium";
  const riskLevel = ORDINAL_LEVELS.includes(risk) ? risk : "Medium";

  const numRaw = [month, dow, isWeekend];
  const numScaled = numRaw.map((v, i) => (v - NUM_MEAN[i]) / NUM_SCALE[i]);

  const features = [
    ...numScaled,
    ...oneHot(region, REGION_CATEGORIES),
    ...oneHot(material, MATERIAL_CATEGORIES),
    ORDINAL_LEVELS.indexOf(demandLevel),
    ORDINAL_LEVELS.indexOf(riskLevel),
  ];

  let linear = INTERCEPT;
  for (let i = 0; i < COEF.length; i++) linear += COEF[i] * features[i];
  return Math.exp(linear);
}
