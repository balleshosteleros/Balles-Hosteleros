import { neon } from '@neondatabase/serverless';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

const url = "postgresql://neondb_owner:npg_z8kFioUJ5lNT@ep-polished-frost-aq1ka19a-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(url);
  
  try {
    console.log("Pinging DB...");
    await sql`SELECT 1`;
    
    const email = "test-now@reelforge.test";
    console.log("Checking user...");
    const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

    if (existing.length > 0) {
      console.log("Test user already exists!");
    } else {
      console.log("Creating test user with correct column names...");
      const passwordHash = await bcrypt.hash("test123456", 10);
      const id = nanoid();
      await sql`
        INSERT INTO users (id, name, email, password, plan, renders_used, renders_limit)
        VALUES (${id}, 'Test User', ${email}, ${passwordHash}, 'free', 0, 3)
      `;
      console.log("Test user created successfully!");
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

main();
