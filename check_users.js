const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");

for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    const val = m[2].replace(/^["']|["']$/g, "").trim();
    process.env[m[1]] = val;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const targetEmail = 'REDACTED@local';
  
  console.log(`Checking profile for: ${targetEmail}`);
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', targetEmail)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", error);
  } else if (!profile) {
    console.log(`User ${targetEmail} not found in profiles table.`);
  } else {
    console.log("USER_PROFILE_DATA:", JSON.stringify(profile));
    if (profile.role !== 'Dirección' && profile.rol_label !== 'Dirección') {
      console.log(`User has role: ${profile.role || profile.rol_label}. Updating to Dirección...`);
      const { error: uError } = await supabase
        .from('profiles')
        .update({ role: 'Dirección', rol_label: 'Dirección' })
        .eq('email', targetEmail);
      
      if (uError) {
        console.error("Error updating role:", uError);
      } else {
        console.log("Role successfully updated to Dirección.");
      }
    } else {
      console.log("User already has administrator permissions (Dirección).");
    }
  }
}

main();
