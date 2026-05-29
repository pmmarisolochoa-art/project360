-- ──────────────────────────────────────────────────────────────────────────
--  Migración 001: añadir columnas de MeetingDrawer
--  Estas columnas existen en TypeScript (`Meeting` type + meetingToRow mapper)
--  pero el schema.sql original no las tenía.
-- ──────────────────────────────────────────────────────────────────────────

alter table public.meetings
  add column if not exists video_call_link text,
  add column if not exists notes text,
  add column if not exists notes_updated_at timestamptz,
  add column if not exists completed boolean not null default false;
