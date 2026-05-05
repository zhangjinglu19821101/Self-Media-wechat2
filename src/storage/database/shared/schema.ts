import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { z } from "zod"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

/**
 * 对话历史表
 * 存储 Agent 对话历史的持久化记录
 */
export const conversationHistories = pgTable("conversation_histories", {
	id: serial("id").primaryKey(),
	agentId: text("agent_id").notNull(),
	sessionId: text("session_id").notNull(),
	role: text("role").notNull(), // 'user' | 'assistant' | 'system'
	content: text("content").notNull(),
	timestamp: timestamp("timestamp").notNull().defaultNow(),
	metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
});

// Zod schemas for validation
export const insertConversationHistorySchema = createInsertSchema(conversationHistories);
export const selectConversationHistorySchema = createSelectSchema(conversationHistories);

// TypeScript types
export type ConversationHistory = z.infer<typeof selectConversationHistorySchema>;
export type InsertConversationHistory = z.infer<typeof insertConversationHistorySchema>;
