import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const battles=sqliteTable('raid_battles',{
  id:text('id').primaryKey(),playerTag:text('player_tag').notNull(),occurredAt:integer('occurred_at').notNull(),
  mode:text('mode').notNull(),attack:integer('is_attack').notNull(),gold:integer('gold'),elixir:integer('elixir'),dark:integer('dark'),data:text('data').notNull(),
},table=>[index('battle_player_date').on(table.playerTag,table.occurredAt)]);
export const publicCache=sqliteTable('public_cache',{key:text('key').primaryKey(),data:text('data').notNull(),expiresAt:integer('expires_at').notNull()});
export const playerSync=sqliteTable('player_sync',{tag:text('tag').primaryKey(),syncedAt:integer('synced_at').notNull(),coverage:text('coverage').notNull()});
export const siteSettings=sqliteTable('site_settings',{key:text('key').primaryKey(),data:text('data').notNull(),updatedAt:integer('updated_at').notNull()});
export const adminSessions=sqliteTable('local_admin_sessions',{id:text('id').primaryKey(),expiresAt:integer('expires_at').notNull()});
export const loginAttempts=sqliteTable('local_login_attempts',{id:text('id').primaryKey(),attempts:integer('attempts').notNull(),resetAt:integer('reset_at').notNull()});
export const clanAutoSync=sqliteTable('clan_auto_sync',{
  clanTag:text('clan_tag').primaryKey(),runId:text('run_id'),status:text('status').notNull().default('idle'),
  startedAt:integer('started_at'),finishedAt:integer('finished_at'),lastSuccessAt:integer('last_success_at'),
  nextAt:integer('next_at').notNull().default(0),leaseUntil:integer('lease_until').notNull().default(0),lastSeenAt:integer('last_seen_at').notNull().default(0),
  completed:integer('completed').notNull().default(0),total:integer('total').notNull().default(0),failed:integer('failed').notNull().default(0),
  rosterTags:text('roster_tags').notNull().default('[]'),completedTags:text('completed_tags').notNull().default('[]'),failedTags:text('failed_tags').notNull().default('[]'),version:integer('version').notNull().default(0),
});
