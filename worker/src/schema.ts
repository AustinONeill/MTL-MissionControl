import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Rooms ─────────────────────────────────────────────────────────────────
export const rooms = pgTable('rooms', {
  id:               text('id').primaryKey(),
  name:             text('name').notNull(),
  type:             text('type').notNull().default('flower'),
  mode:             text('mode').notNull().default('off'),
  reEntryExpiresAt: timestamp('re_entry_expires_at'),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

export const roomsRelations = relations(rooms, ({ many }) => ({
  overlays:          many(overlays),
  sprayLogs:         many(sprayLogs),
  netLogs:           many(netLogs),
  potCheckLogs:      many(potCheckLogs),
  filterChangeLogs:  many(filterChangeLogs),
  calibrationLogs:   many(calibrationLogs),
  ppeLogs:           many(ppeLogs),
  eventLogs:         many(eventLogs),
}))

// ── Overlays ──────────────────────────────────────────────────────────────
// Replaces the old flags/roomFlags tables. Each overlay carries a typed
// options blob and a status, and can be edited or removed after placement.
export const overlays = pgTable(
  'overlays',
  {
    id:               text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:           text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    // "ipm"|"net"|"pot_check"|"filter_change"|"defoliation"|"transfer"|"harvest_ready"|"mode_change"|"supply_ready"|"issue"
    overlayType:      text('overlay_type').notNull(),
    options:          jsonb('options').notNull().default({}),
    // "active"|"completed"|"pending_review"
    status:           text('status').notNull().default('active'),
    placedBy:         text('placed_by').notNull(),
    placedAt:         timestamp('placed_at').notNull().defaultNow(),
    updatedBy:        text('updated_by'),
    updatedAt:        timestamp('updated_at').notNull().defaultNow(),
    notificationSent: boolean('notification_sent').notNull().default(false),
  },
  (t) => [
    index('overlays_room_id_idx').on(t.roomId),
    index('overlays_type_idx').on(t.overlayType),
  ]
)

export const overlaysRelations = relations(overlays, ({ one }) => ({
  room: one(rooms, { fields: [overlays.roomId], references: [rooms.id] }),
}))

// ── Spray Logs (F-005) ────────────────────────────────────────────────────
export const sprayLogs = pgTable(
  'spray_logs',
  {
    id:                 text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:             text('room_id').notNull().references(() => rooms.id),
    // F-005 fields
    batchIds:           text('batch_ids').notNull(),             // e.g. "3UC260112PE, GP2260112PE"
    pesticide:          text('pesticide').notNull(),             // product name + reg number
    appliedAt:          timestamp('applied_at').notNull(),       // application date
    startTime:          text('start_time').notNull(),            // "08h30"
    endTime:            text('end_time').notNull(),              // "10h30"
    reasonPreventative: boolean('reason_preventative').notNull().default(false),
    reasonTreatment:    boolean('reason_treatment').notNull().default(false),
    methodFoliarSpray:  boolean('method_foliar_spray').notNull().default(false),
    methodDip:          boolean('method_dip').notNull().default(false),
    equipmentNumber:    text('equipment_number').notNull(),      // "Pest-01"
    equipmentName:      text('equipment_name').notNull(),        // "MSO Sprayer"
    ratio:              text('ratio').notNull(),                 // "22g/15L"
    quantity:           text('quantity').notNull(),              // "30L"
    operatorId:         text('operator_id').notNull(),
    operatorName:       text('operator_name').notNull(),
    supervisorName:     text('supervisor_name').notNull().default(''),  // SUPV/APPV — role-gated
    reEntryHours:       doublePrecision('re_entry_hours').notNull().default(0),
    reEntryExpiresAt:   timestamp('re_entry_expires_at'),
    photoUrl:           text('photo_url'),
    notes:              text('notes'),
    createdAt:          timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('spray_logs_room_id_idx').on(t.roomId),
    index('spray_logs_applied_at_idx').on(t.appliedAt),
  ]
)

export const sprayLogsRelations = relations(sprayLogs, ({ one }) => ({
  room: one(rooms, { fields: [sprayLogs.roomId], references: [rooms.id] }),
}))

// ── Net Logs ──────────────────────────────────────────────────────────────
export const netLogs = pgTable(
  'net_logs',
  {
    id:                  text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:              text('room_id').notNull().references(() => rooms.id),
    netNumber:           integer('net_number').notNull(),          // 1 or 2
    action:              text('action').notNull(),                 // "spread" | "bend"
    status:              text('status').notNull(),                 // "lowering" | "lowered_checked"
    zipTieChecks:        jsonb('zip_tie_checks').notNull().default({}),  // { rowA: bool[], ... }
    allZipTiesConfirmed: boolean('all_zip_ties_confirmed').notNull().default(false),
    operatorId:          text('operator_id').notNull(),
    operatorName:        text('operator_name').notNull(),
    loggedAt:            timestamp('logged_at').notNull().defaultNow(),
    photoUrl:            text('photo_url'),
    notes:               text('notes'),
  },
  (t) => [
    index('net_logs_room_id_idx').on(t.roomId),
  ]
)

export const netLogsRelations = relations(netLogs, ({ one }) => ({
  room: one(rooms, { fields: [netLogs.roomId], references: [rooms.id] }),
}))

// ── Pot Check Logs ────────────────────────────────────────────────────────
export const potCheckLogs = pgTable(
  'pot_check_logs',
  {
    id:                 text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:             text('room_id').notNull().references(() => rooms.id),
    checkedAt:          timestamp('checked_at').notNull().defaultNow(),
    standingWaterFound: boolean('standing_water_found').notNull(),
    waterRemoved:       boolean('water_removed'),
    rootHealth:         text('root_health').notNull(),   // "healthy" | "concern" | "critical"
    operatorId:         text('operator_id').notNull(),
    operatorName:       text('operator_name').notNull(),
    photoUrl:           text('photo_url'),
    notes:              text('notes'),
  },
  (t) => [
    index('pot_check_logs_room_id_idx').on(t.roomId),
    index('pot_check_logs_checked_at_idx').on(t.checkedAt),
  ]
)

export const potCheckLogsRelations = relations(potCheckLogs, ({ one }) => ({
  room: one(rooms, { fields: [potCheckLogs.roomId], references: [rooms.id] }),
}))

// ── Filter Change Logs ────────────────────────────────────────────────────
export const filterChangeLogs = pgTable(
  'filter_change_logs',
  {
    id:              text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:          text('room_id').notNull().references(() => rooms.id),
    changedAt:       timestamp('changed_at').notNull().defaultNow(),
    filterType:      text('filter_type').notNull(),   // "carbon" | "pre" | "hepa" | "other"
    filterSize:      text('filter_size'),
    oldCondition:    text('old_condition').notNull(),  // "normal" | "heavily_loaded" | "damaged"
    newInstalled:    boolean('new_installed').notNull(),
    equipmentNumber: text('equipment_number'),
    operatorId:      text('operator_id').notNull(),
    operatorName:    text('operator_name').notNull(),
    photoUrl:        text('photo_url'),
    notes:           text('notes'),
  },
  (t) => [
    index('filter_change_logs_room_id_idx').on(t.roomId),
    index('filter_change_logs_changed_at_idx').on(t.changedAt),
  ]
)

export const filterChangeLogsRelations = relations(filterChangeLogs, ({ one }) => ({
  room: one(rooms, { fields: [filterChangeLogs.roomId], references: [rooms.id] }),
}))

// ── Calibration Logs ──────────────────────────────────────────────────────
export const calibrationLogs = pgTable(
  'calibration_logs',
  {
    id:            text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:        text('room_id').notNull().references(() => rooms.id),
    equipmentType: text('equipment_type').notNull(),
    preReading:    doublePrecision('pre_reading').notNull(),
    standard:      text('standard').notNull(),
    postReading:   doublePrecision('post_reading').notNull(),
    passFail:      boolean('pass_fail').notNull(),
    operatorId:    text('operator_id').notNull(),
    operatorName:  text('operator_name').notNull(),
    calibratedAt:  timestamp('calibrated_at').notNull(),
    photoUrl:      text('photo_url'),
    notes:         text('notes'),
    createdAt:     timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('calibration_logs_room_id_idx').on(t.roomId),
    index('calibration_logs_calibrated_at_idx').on(t.calibratedAt),
  ]
)

export const calibrationLogsRelations = relations(calibrationLogs, ({ one }) => ({
  room: one(rooms, { fields: [calibrationLogs.roomId], references: [rooms.id] }),
}))

// ── Tasks (Whiteboard) ────────────────────────────────────────────────────
export const tasks = pgTable(
  'tasks',
  {
    id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title:       text('title').notNull(),
    description: text('description'),
    roomId:      text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    assignedTo:  text('assigned_to'),
    priority:    text('priority').notNull().default('normal'), // 'low' | 'normal' | 'high'
    status:      text('status').notNull().default('todo'),     // 'todo' | 'in_progress' | 'done'
    createdBy:   text('created_by').notNull(),
    createdByName: text('created_by_name').notNull(),
    createdAt:   timestamp('created_at').notNull().defaultNow(),
    updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('tasks_status_idx').on(t.status),
    index('tasks_room_id_idx').on(t.roomId),
  ]
)

// ── PPE Logs ──────────────────────────────────────────────────────────────
export const ppeLogs = pgTable(
  'ppe_logs',
  {
    id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:       text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    loggedAt:     timestamp('logged_at').notNull().defaultNow(),
    itemsWorn:    jsonb('items_worn').notNull().default([]),  // string[] of item IDs confirmed
    context:      text('context').notNull().default('standard'), // 'standard' | 'ipm' | 'reentry'
    operatorId:   text('operator_id').notNull(),
    operatorName: text('operator_name').notNull(),
    notes:        text('notes'),
  },
  (t) => [
    index('ppe_logs_room_id_idx').on(t.roomId),
    index('ppe_logs_logged_at_idx').on(t.loggedAt),
  ]
)

export const ppeLogsRelations = relations(ppeLogs, ({ one }) => ({
  room: one(rooms, { fields: [ppeLogs.roomId], references: [rooms.id] }),
}))

// ── Event Logs ────────────────────────────────────────────────────────────
export const eventLogs = pgTable(
  'event_logs',
  {
    id:            text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:        text('room_id').notNull().references(() => rooms.id),
    operatorId:    text('operator_id').notNull(),
    operatorName:  text('operator_name').notNull(),
    action:        text('action').notNull(),
    previousValue: text('previous_value'),
    newValue:      text('new_value'),
    source:        text('source').notNull().default('UI'),
    createdAt:     timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('event_logs_room_id_idx').on(t.roomId),
    index('event_logs_created_at_idx').on(t.createdAt),
  ]
)

export const eventLogsRelations = relations(eventLogs, ({ one }) => ({
  room: one(rooms, { fields: [eventLogs.roomId], references: [rooms.id] }),
}))

// ── Conversations ──────────────────────────────────────────────────────────
// type: 'room_channel' (one per room) | 'global' (#general, #ipm, #alerts)
export const conversations = pgTable(
  'conversations',
  {
    id:          text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    type:        text('type').notNull(),          // 'room_channel' | 'global'
    name:        text('name').notNull(),           // '#F7' | '#general'
    description: text('description'),
    roomId:      text('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
    createdAt:   timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('conversations_room_id_idx').on(t.roomId),
    index('conversations_type_idx').on(t.type),
  ]
)

// ── Messages ───────────────────────────────────────────────────────────────
// contentType: 'text' | 'action' | 'photo'
// actionType:  'create_task' | 'place_overlay' | 'ipm' | 'net' | 'defoliation' | etc
export const messages = pgTable(
  'messages',
  {
    id:             text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    senderId:       text('sender_id').notNull(),
    senderName:     text('sender_name').notNull(),
    content:        text('content').notNull(),
    contentType:    text('content_type').notNull().default('text'),
    actionType:     text('action_type'),
    actionPayload:  jsonb('action_payload'),
    photoUrl:       text('photo_url'),
    replyToId:      text('reply_to_id'),
    deletedAt:      timestamp('deleted_at'),
    createdAt:      timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('messages_conv_id_idx').on(t.conversationId),
    index('messages_created_at_idx').on(t.createdAt),
  ]
)

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  room:     one(rooms, { fields: [conversations.roomId], references: [rooms.id] }),
  messages: many(messages),
}))
