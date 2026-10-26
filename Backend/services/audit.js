// Audit trail helpers. Recording never throws: a failed audit write is logged
// and must not undo the action it describes.
const AuditLog = require('../Models/AuditLog');

// Values never stored in the log, only the fact that they changed.
const SENSITIVE = new Set(['salary', 'password', 'personalEmail', 'birthdate', 'passwordResetTokenHash', 'passwordResetExpires']);

const LABELS = {
  firstName: 'first name', lastName: 'last name', email: 'work email', personalEmail: 'personal email',
  phone: 'phone', position: 'position', departmentId: 'department', managerId: 'manager', hireDate: 'hire date',
  salary: 'salary', skills: 'skills', role: 'access level', profilePicture: 'photo', birthdate: 'date of birth',
  password: 'password',
};

const comparable = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return JSON.stringify(value.map((v) => (v && v.name) || String(v)));
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

/**
 * Field changes between a document before and an update, as
 * [{ field, from, to }]. Sensitive fields record "changed" instead of values.
 */
const diff = (before, update, fields = Object.keys(update)) =>
  fields
    .filter((f) => update[f] !== undefined && comparable(before?.[f]) !== comparable(update[f]))
    .map((f) =>
      SENSITIVE.has(f)
        ? { field: f, from: 'hidden', to: 'changed' }
        : { field: f, from: comparable(before?.[f]), to: comparable(update[f]) }
    );

const describeChanges = (changes) => changes.map((c) => LABELS[c.field] || c.field).join(', ');

/**
 * record({ actor: { id, role }, action, entity, entityId, subject, summary, changes, reason, req })
 */
const record = async ({ actor, action, entity, entityId, subject, summary, changes, reason, req }) => {
  try {
    await AuditLog.create({
      actor: actor?.id,
      actorRole: actor?.role,
      action,
      entity,
      entityId,
      subject,
      summary: String(summary).slice(0, 300),
      changes,
      reason: reason ? String(reason).slice(0, 500) : undefined,
      ip: req?.ip,
    });
  } catch (error) {
    console.error(`Audit write failed (${action}):`, error.message);
  }
};

module.exports = { record, diff, describeChanges, SENSITIVE };
