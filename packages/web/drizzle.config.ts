import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL!;
const common = {
  schema: "./src/api/database/schema.ts",
  out: "./drizzle",
};

export default defineConfig(
  url?.startsWith("file:")
    ? { ...common, dialect: "sqlite", dbCredentials: { url } }
    : {
        ...common,
        dialect: "turso",
        dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN },
      },
);
