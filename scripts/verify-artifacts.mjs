import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const artifacts = [
  "ml/artifacts/metrics.json",
  "ml/artifacts/results_metrics.json",
  "ml/artifacts/price_estimates_seed.csv",
  "ml/artifacts/lr_mv.joblib",
  "ml/artifacts/rf_mv.joblib",
  "ml/artifacts/report_graphs/g1_mape.png",
  "ml/artifacts/report_graphs/g2_error_metrics.png",
  "ml/artifacts/report_graphs/g3_r2.png",
  "ml/artifacts/report_graphs/g4_tolerance.png",
  "ml/artifacts/report_graphs/g5_confusion.png",
  "ml/artifacts/report_graphs/g6_pred_vs_actual.png",
];

let failed = false;

for (const artifact of artifacts) {
  const path = join(root, artifact);

  try {
    const stats = statSync(path);
    const bytes = readFileSync(path);
    const hash = createHash("sha256").update(bytes).digest("hex");

    if (stats.size === 0) {
      failed = true;
      console.error(`FAIL ${artifact} is empty`);
      continue;
    }

    console.log(`OK   ${artifact} ${stats.size} bytes sha256=${hash}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${artifact} ${error.message}`);
  }
}

process.exitCode = failed ? 1 : 0;
