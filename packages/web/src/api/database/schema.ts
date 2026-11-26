import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("guard_sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const messages = sqliteTable(
  "guard_messages",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("guard_messages_session").on(t.sessionId, t.createdAt)],
);

export const audits = sqliteTable(
  "guard_audits",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    createdAt: integer("created_at").notNull(),
    amountCents: integer("amount_cents"),
    amountInput: text("amount_input").notNull(),
    country: text("country").notNull(),
    isoCode: text("iso_code"),
    recipient: text("recipient").notNull(),
    decision: text("decision", {
      enum: [
        "APPROVED",
        "BLOCKED_INVALID_AMOUNT",
        "BLOCKED_AMOUNT_LIMIT",
        "BLOCKED_UNVERIFIED_COUNTRY",
        "BLOCKED_RESTRICTED_COUNTRY",
        "BLOCKED_MISSING_RECIPIENT",
      ],
    }).notNull(),
    reason: text("reason").notNull(),
    reference: text("reference"),
    source: text("source", { enum: ["demo", "bedrock"] }).notNull(),
  },
  (t) => [index("guard_audits_session").on(t.sessionId, t.createdAt)],
);
