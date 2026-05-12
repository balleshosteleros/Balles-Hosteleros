import { neon } from '@neondatabase/serverless';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

const url = "postgresql://neondb_owner:npg_ldaLP4VJoX0A@ep-blue-term-aqariz4t.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(url);
  
  let attempt = 1;
  while (attempt <= 10) {
    try {
      console.log(`Attempt ${attempt}: Pinging DB...`);
      await sql`SELECT 1 as "wakeUp"`;
      console.log("Database is awake!");
      break;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message);
      attempt++;
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  if (attempt > 10) return;

  try {
    const email = "test-now@reelforge.test";
    console.log("Checking if test user exists...");
    const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

    if (existing.length > 0) {
      console.log("Test user already exists!");
    } else {
      console.log("Creating test user...");
      const passwordHash = await bcrypt.hash("test123456", 10);
      const id = nanoid();
      await sql`
        INSERT INTO users (id, name, email, password, plan, "rendersUsed", "rendersLimit")
        VALUES (${id}, 'Test User', ${email}, ${passwordHash}, 'free', 0, 3)
      `;
      console.log("Test user created successfully!");
    }
  } catch (err) {
    console.error("Failed to create user:", err);
  }
}

main();
