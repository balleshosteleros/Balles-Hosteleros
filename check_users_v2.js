const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic .env parser to avoid dependency issues
const env = {};
try {
  const content = fs.readFileSync('.env.local', 'utf8');
  content.split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) {
      env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (e) {}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing URL or Service Role Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixUser() {
  const email = 'REDACTED@local';
  console.log(`Checking user: ${email}`);

  // 1. Find user by email
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error('Error listing users:', userError);
    return;
  }

  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.error(`User ${email} not found`);
    return;
  }

  console.log(`User found: ${user.id}`);

  // 2. Check profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Error checking profile:', profileError);
  } else {
    console.log('Profile:', profile);
    
    // Update profile role if needed
    if (profile?.rol_label !== 'Dirección') {
        console.log('Updating profile role to Dirección...');
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ rol_label: 'Dirección' })
            .eq('user_id', user.id);
        if (updateError) console.error('Error updating profile:', updateError);
        else console.log('Profile updated successfully');
    }
  }

  // 3. Check user_roles
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id);

  if (rolesError) {
    console.error('Error checking roles:', rolesError);
  } else {
    console.log('Roles:', roles);
    
    if (!roles.some(r => r.role === 'director')) {
        console.log('Adding director role...');
        const { error: roleInsertError } = await supabase
            .from('user_roles')
            .insert({ user_id: user.id, role: 'director' });
        if (roleInsertError) console.error('Error adding role:', roleInsertError);
        else console.log('Director role added successfully');
    }
  }
}

checkAndFixUser();
