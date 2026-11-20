import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Перечисления ────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "requester",
  "dispatcher",
  "executor",
  "admin",
]);

export const urgencyEnum = pgEnum("urgency", [
  "emergency",
  "current",
  "purchase",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "new",
  "assigned",
  "in_progress",
  "done",
  "rejected",
  "cancelled",
]);

export const photoKindEnum = pgEnum("photo_kind", [
  "problem",
  "result",
  "comment",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "created",
  "assigned",
  "reassigned",
  "accepted",
  "comment",
  "problem",
  "problem_resolved",
  "completed",
  "rejected",
  "cancelled",
  "reopened",
]);

const tstz = (name: string) => timestamp(name, { withTimezone: true });

// ─── Справочники и пользователи ──────────────────────────────

export const buildings = pgTable(
  "buildings",
  {
    id: serial("id").primaryKey(),
    address: text("address").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("buildings_address_idx").on(t.address)],
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    fullName: text("full_name").notNull(),
    login: text("login").notNull(),
    role: roleEnum("role").notNull(),
    active: boolean("active").notNull().default(true),
    passwordHash: text("password_hash"),
    loginTokenHash: text("login_token_hash"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_login_idx").on(t.login),
    index("users_login_token_idx").on(t.loginTokenHash),
    index("users_role_idx").on(t.role),
  ],
);

export const userBuildings = pgTable(
  "user_buildings",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    buildingId: integer("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.buildingId] }),
    index("user_buildings_building_idx").on(t.buildingId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: tstz("expires_at").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Заявки ──────────────────────────────────────────────────

/** Произвольные данные события (кого назначили, на какой срок и т. п.). */
export type EventMeta = {
  executorId?: number | null;
  coexecutorIds?: number[];
  deadline?: string | null;
  prevExecutorId?: number | null;
  prevCoexecutorIds?: number[];
  prevDeadline?: string | null;
  prevStatus?: string;
};

export const requests = pgTable(
  "requests",
  {
    /** Номер заявки («№ 17»). */
    id: serial("id").primaryKey(),
    createdAt: tstz("created_at").notNull().defaultNow(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    buildingId: integer("building_id")
      .notNull()
      .references(() => buildings.id),
    /** «Где именно»: этаж, кабинет. Необязательно. */
    location: text("location"),
    description: text("description").notNull(),
    urgency: urgencyEnum("urgency").notNull(),
    status: requestStatusEnum("status").notNull().default("new"),
    executorId: integer("executor_id").references(() => users.id),
    /** Срок выполнения — дата по Москве, 'YYYY-MM-DD'. */
    deadline: date("deadline", { mode: "string" }),
    dispatcherComment: text("dispatcher_comment"),
    acceptedAt: tstz("accepted_at"),
    completedAt: tstz("completed_at"),
    completionComment: text("completion_comment"),
    problemOpen: boolean("problem_open").notNull().default(false),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("requests_status_idx").on(t.status),
    index("requests_building_idx").on(t.buildingId),
    index("requests_executor_idx").on(t.executorId),
    index("requests_author_idx").on(t.authorId),
    index("requests_created_idx").on(t.createdAt),
  ],
);

export const requestCoexecutors = pgTable(
  "request_coexecutors",
  {
    requestId: integer("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [
    primaryKey({ columns: [t.requestId, t.userId] }),
    index("request_coexecutors_user_idx").on(t.userId),
  ],
);

export const requestEvents = pgTable(
  "request_events",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").references(() => users.id),
    type: eventTypeEnum("type").notNull(),
    /** Комментарий / причина / текст проблемы. */
    text: text("text"),
    meta: jsonb("meta").$type<EventMeta>(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("request_events_request_idx").on(t.requestId, t.createdAt)],
);

export const requestPhotos = pgTable(
  "request_photos",
  {
    /** Случайный id — он же имя файла в UPLOAD_DIR. */
    id: text("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    kind: photoKindEnum("kind").notNull(),
    /** Исходное имя файла (для подписи/скачивания). */
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    uploadedBy: integer("uploaded_by").references(() => users.id),
    createdAt: tstz("created_at").notNull().defaultNow(),
    eventId: integer("event_id").references(() => requestEvents.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("request_photos_request_idx").on(t.requestId),
    index("request_photos_event_idx").on(t.eventId),
  ],
);

// ─── Связи (для db.query.*) ──────────────────────────────────

export const buildingsRelations = relations(buildings, ({ many }) => ({
  userBuildings: many(userBuildings),
  requests: many(requests),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userBuildings: many(userBuildings),
  sessions: many(sessions),
}));

export const userBuildingsRelations = relations(userBuildings, ({ one }) => ({
  user: one(users, { fields: [userBuildings.userId], references: [users.id] }),
  building: one(buildings, {
    fields: [userBuildings.buildingId],
    references: [buildings.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const requestsRelations = relations(requests, ({ one, many }) => ({
  author: one(users, {
    fields: [requests.authorId],
    references: [users.id],
    relationName: "request_author",
  }),
  executor: one(users, {
    fields: [requests.executorId],
    references: [users.id],
    relationName: "request_executor",
  }),
  building: one(buildings, {
    fields: [requests.buildingId],
    references: [buildings.id],
  }),
  coexecutors: many(requestCoexecutors),
  photos: many(requestPhotos),
  events: many(requestEvents),
}));

export const requestCoexecutorsRelations = relations(
  requestCoexecutors,
  ({ one }) => ({
    request: one(requests, {
      fields: [requestCoexecutors.requestId],
      references: [requests.id],
    }),
    user: one(users, {
      fields: [requestCoexecutors.userId],
      references: [users.id],
    }),
  }),
);

export const requestEventsRelations = relations(
  requestEvents,
  ({ one, many }) => ({
    request: one(requests, {
      fields: [requestEvents.requestId],
      references: [requests.id],
    }),
    actor: one(users, {
      fields: [requestEvents.actorId],
      references: [users.id],
    }),
    photos: many(requestPhotos),
  }),
);

export const requestPhotosRelations = relations(requestPhotos, ({ one }) => ({
  request: one(requests, {
    fields: [requestPhotos.requestId],
    references: [requests.id],
  }),
  event: one(requestEvents, {
    fields: [requestPhotos.eventId],
    references: [requestEvents.id],
  }),
  uploader: one(users, {
    fields: [requestPhotos.uploadedBy],
    references: [users.id],
  }),
}));

// ─── Типы ────────────────────────────────────────────────────

export type Building = typeof buildings.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserBuilding = typeof userBuildings.$inferSelect;
export type Session = typeof sessions.$inferSelect;
/** Строка таблицы requests (назван RepairRequest, чтобы не путать с глобальным Request). */
export type RepairRequest = typeof requests.$inferSelect;
export type NewRepairRequest = typeof requests.$inferInsert;
export type RequestCoexecutor = typeof requestCoexecutors.$inferSelect;
export type RequestEvent = typeof requestEvents.$inferSelect;
export type RequestPhoto = typeof requestPhotos.$inferSelect;

export type Role = (typeof roleEnum.enumValues)[number];
export type Urgency = (typeof urgencyEnum.enumValues)[number];
export type RequestStatus = (typeof requestStatusEnum.enumValues)[number];
export type PhotoKind = (typeof photoKindEnum.enumValues)[number];
export type EventType = (typeof eventTypeEnum.enumValues)[number];
