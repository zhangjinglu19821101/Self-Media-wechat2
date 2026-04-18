import { pgTable, text, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// 对话历史表
export const conversationHistories = pgTable(
  "conversation_histories",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    agentId: varchar("agent_id", { length: 50 }).notNull(),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    agentIdIdx: index("conversation_histories_agent_id_idx").on(table.agentId),
    sessionIdIdx: index("conversation_histories_session_id_idx").on(table.sessionId),
    timestampIdx: index("conversation_histories_timestamp_idx").on(table.timestamp),
  })
);

// 使用 createSchemaFactory 配置 date coercion
const { createInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

export const insertConversationHistorySchema = createInsertSchema(
  conversationHistories
).pick({
  agentId: true,
  sessionId: true,
  role: true,
  content: true,
  metadata: true,
});

export type ConversationHistory = typeof conversationHistories.$inferSelect;
export type InsertConversationHistory = z.infer<typeof insertConversationHistorySchema>;




