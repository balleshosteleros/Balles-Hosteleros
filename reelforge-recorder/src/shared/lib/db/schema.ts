import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["free", "starter", "pro", "agency"]);
export const videoStatusEnum = pgEnum("video_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
// recording = grabación de pantalla (Loom), generated = video IA con templates
export const videoTypeEnum = pgEnum("video_type", ["recording", "generated"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
  plan: planEnum("plan").notNull().default("free"),
  rendersUsed: integer("renders_used").notNull().default(0),
  rendersLimit: integer("renders_limit").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Tipo de video: grabación de pantalla o generado por IA
  type: videoTypeEnum("type").notNull().default("recording"),
  title: text("title").notNull(),
  // Solo para type=generated
  templateId: text("template_id").default("none"),
  prompt: text("prompt"),
  htmlContent: text("html_content"),
  status: videoStatusEnum("status").notNull().default("pending"),
  // Ruta local en captures/ o URL
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  filePath: text("file_path"),       // ruta en captures/
  fileSize: integer("file_size"),    // bytes
  duration: integer("duration"),    // segundos
  caption: text("caption"),
  hashtags: text("hashtags"),
  metadata: jsonb("metadata"),
  errorMessage: text("error_message"),
  isPublic: boolean("is_public").notNull().default(false),
  shareToken: text("share_token"),   // token para link público
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
