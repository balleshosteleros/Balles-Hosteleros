import { Client } from '@neondatabase/serverless';

const url = "postgresql://neondb_owner:npg_z8kFioUJ5lNT@ep-polished-frost-aq1ka19a-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client(url);
  try {
    console.log("Connecting via WebSocket...");
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
