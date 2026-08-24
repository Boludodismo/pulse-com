import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  ...(connectionString
    ? {
        dbCredentials: {
          url: connectionString,
        },
      }
    : {}),
});
