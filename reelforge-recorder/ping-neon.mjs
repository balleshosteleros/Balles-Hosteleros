import { neon } from '@neondatabase/serverless';

const url = "postgresql://neondb_owner:npg_ldaLP4VJoX0A@ep-blue-term-aqariz4t-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(url);
  let attempt = 1;
  while (true) {
    try {
      console.log(`Attempt ${attempt}: Running query...`);
      const res = await sql`SELECT 1 as "wakeUp"`;
      console.log("Query result:", res);
      console.log("Database successfully woken up!");
      break;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message);
      attempt++;
      await new Promise(r => setTimeout(r, 5000)); // wait 5 seconds before retrying
    }
  }
}

main();
