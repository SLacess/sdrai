-- Enforce "one active enrollment per contact" (config/defaults.yaml:
-- sequence.oneActivePerContact) at the database level. Prisma's schema DSL
-- cannot express a partial/filtered unique index, so this constraint is
-- defined here in raw SQL and is not visible in schema.prisma itself.
CREATE UNIQUE INDEX "SequenceEnrollment_contactId_active_key"
  ON "SequenceEnrollment" ("contactId")
  WHERE "state" = 'ACTIVE';
