import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/schema.ts", "./src/auth-schema.ts"],
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://scenes:scenes@localhost:5432/scenes",
  },
});
