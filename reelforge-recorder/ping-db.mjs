import { Client } from 'pg';

const url = "postgresql://neondb_owner:npg_ldaLP4VJoX0A@ep-blue-term-aqariz4t-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString: url });
  try {
    console.log("Connecting...");
    await client.connect();
    console.log("Connected! Running query...");
    const res = await client.query('SELECT 1 as "wakeUp"');
    console.log("Query result:", res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
