import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Rooms ─────────────────────────────────────────────────────────────────
export const rooms = pgTable('rooms', {
  id:               text('id').primaryKey(),
  name:             text('name').notNull(),
  type:             text('type').notNull().default('flower'),
  mode:             text('mode').notNull().default('idle'),
  reEntryExpiresAt: timestamp('re_entry_expires_at'),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

export const roomsRelations = relations(rooms, ({ many }) => ({
  roomFlags:       many(roomFlags),
  sprayLogs:       many(sprayLogs),
  calibrationLogs: many(calibrationLogs),
  eventLogs:       many(eventLogs),
}))

// ── Flags ─────────────────────────────────────────────────────────────────
export const flags = pgTable('flags', {
  id:                  text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type:                text('type').notNull().unique(),
  label:               text('label').notNull(),
  iconUrl:             text('icon_url').notNull(),
  color:               text('color').notNull(),
  notificationEnabled: boolean('notification_enabled').notNull().default(false),
  calendarEnabled:     boolean('calendar_enabled').notNull().default(false),
})

export const flagsRelations = relations(flags, ({ many }) => ({
  roomFlags: many(roomFlags),
}))

// ── Room ↔ Flag join ──────────────────────────────────────────────────────
export const roomFlags = pgTable(
  'room_flags',
  {
    id:         text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:     text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    flagId:     text('flag_id').notNull().references(() => flags.id),
    assignedBy: text('assigned_by').notNull(),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  },
  (t) => [
    unique('uniq_room_flag').on(t.roomId, t.flagId),
    index('room_flags_room_id_idx').on(t.roomId),
    index('room_flags_flag_id_idx').on(t.flagId),
  ]
)

export const roomFlagsRelations = relations(roomFlags, ({ one }) => ({
  room: one(rooms, { fields: [roomFlags.roomId], references: [rooms.id] }),
  flag: one(flags, { fields: [roomFlags.flagId], references: [flags.id] }),
}))

// ── Spray Logs ────────────────────────────────────────────────────────────
export const sprayLogs = pgTable(
  'spray_logs',
  {
    id:               text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    roomId:           text('room_id').notNull().references(() => rooms.id),
    product:          text('product').notNull(),
    rate:             text('rate').notNull(),
    method:           text('method'),
    pcpRegNumber:     text('pcp_reg_number'),
    operatorId:       text('operator_id').notNull(),
    operatorName:     text('operator_name').notNull(),
    appliedAt:        timestamp('applied_at').notNull(),
    reEntryHours:     doublePrecision('re_entry_hours').notNull(),
    reEntryExpiresAt: timestamp('re_entry_expires_at').notNull(),
    photoUrl:         text('photo_url'),
    notes:            text('notes'),
    createdAt:        timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('spray_logs_room_id_idx').on(t.roomId),
    index('spray_logs_applied_at_idx').on(t.appliedAt),
  ]
)

export const sprayLogsRelations = relations(sprayLogs, ({ one }) => ({
  room: one(rooms, { fields: [sprayLogs.roomId], references: [rooms.id] }),
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
