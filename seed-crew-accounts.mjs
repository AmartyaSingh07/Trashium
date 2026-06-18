// Seeds demo crew accounts. Run with the service-role key (NEVER commit it):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node seed-crew-accounts.mjs
// Idempotent: re-running finds the existing user and just re-applies role/zone.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// One account per hub. Rishra+Hugli-Chinsura share a fleet (resolveHubSectors),
// so the rishrahugli account (zone=Rishra) sees both sectors.
const PASSWORD = "Trashium@2026";
const CREW = [
  ["crew.howrah@trashium.org", "Field Operator - Howrah", "Howrah"],
  ["crew.shyamnagar@trashium.org", "Field Operator - Shyamnagar", "Shyamnagar"],
  ["crew.tarakeswar@trashium.org", "Field Operator - Tarakeswar", "Tarakeswar"],
  ["crew.rishrahugli@trashium.org", "Field Operator - Rishra/Hugli", "Rishra"],
];

async function findUserByEmail(email) {
  // No get-by-email in admin API; page through users (fine for a small project).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

for (const [email, full_name, zone] of CREW) {
  let user = await findUserByEmail(email);
  if (user) {
    // Idempotent: reset password so a re-run restores known demo credentials.
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: PASSWORD });
    if (error) throw error;
    console.log(`exists: ${email} (${user.id}) — password reset`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) throw error;
    user = data.user;
    console.log(`created: ${email} (${user.id})`);
  }

  // handle_new_user trigger creates the profiles row; upsert keeps this safe either way.
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: user.id, full_name, email, role: "crew", operating_zone: zone }, { onConflict: "id" });
  if (pErr) throw pErr;
  console.log(`  → role=crew, operating_zone=${zone}`);
}

console.log("done.");
