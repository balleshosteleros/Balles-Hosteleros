import { neon } from '@neondatabase/serverless';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

// Intentando sin el pooler por si acaso
const url = "postgresql://neondb_owner:npg_ldaLP4VJoX0A@ep-blue-term-aqariz4t.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(url);
  
  let attempt = 1;
  while (attempt <= 5) {
    try {
      console.log(`Attempt ${attempt} (Direct): Pinging DB...`);
      await sql`SELECT 1 as "wakeUp"`;
      console.log("Database is awake!");
      break;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message);
      attempt++;
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  if (attempt > 5) {
      console.log("Direct endpoint failed too. Trying pooled again...");
      const pooledUrl = "postgresql://neondb_owner:npg_ldaLP4VJoX0A@ep-blue-term-aqariz4t-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";
      const sqlPooled = neon(pooledUrl);
      try {
          await sqlPooled`SELECT 1 as "wakeUp"`;
          console.log("Pooled database is awake!");
      } catch (e) {
          console.error("Pooled also failed:", e.message);
          return;
      }
  }

  try {
    const email = "test-now@reelforge.test";
    // Usamos el sql que haya funcionado (asumimos el pooled si llegamos aqui y funciono)
    const sqlToUse = attempt <= 5 ? neon(url) : neon("postgresql://neondb_owner:npg_ldaLP4VJoX0A@ep-blue-term-aqariz4t-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require");
    
    console.log("Checking if test user exists...");
    const existing = await sqlToUse`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

    if (existing.length > 0) {
      console.log("Test user already exists!");
    } else {
      console.log("Creating test user...");
      const passwordHash = await bcrypt.hash("test123456", 10);
      const id = nanoid();
      await sqlToUse`
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
