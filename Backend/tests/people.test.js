const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSkills, skillNames, mergeSkillNames } = require('../utils/skills');
const { diff, describeChanges } = require('../services/audit');
const { canSeePerson } = require('../services/policies');

test('skills accept comma lists, arrays of names or objects, and drop duplicates', () => {
  assert.deepEqual(normalizeSkills('ROS, Embedded C, ros'), [{ name: 'ROS' }, { name: 'Embedded C' }]);
  assert.deepEqual(normalizeSkills('["FEA","DFM"]'), [{ name: 'FEA' }, { name: 'DFM' }]);
  assert.deepEqual(normalizeSkills([{ name: 'SolidWorks', level: 4 }, { name: 'X', level: 9 }]), [{ name: 'SolidWorks', level: 4 }, { name: 'X' }]);
  assert.deepEqual(skillNames(['A', { name: 'B', level: 2 }]), ['A', 'B']);
});

test('renaming a skill list keeps levels already recorded', () => {
  const existing = [{ name: 'SolidWorks', level: 4, validatedBy: 'm1' }, { name: 'FEA', level: 2 }];
  assert.deepEqual(mergeSkillNames(existing, 'solidworks, DFM'), [{ name: 'SolidWorks', level: 4, validatedBy: 'm1' }, { name: 'DFM' }]);
});

test('audit diff records changed fields and hides sensitive values', () => {
  const before = { firstName: 'Rim', salary: 2400, hireDate: new Date('2021-01-18T23:00:00Z'), skills: [{ name: 'ROS' }] };
  const changes = diff(before, { firstName: 'Rim', salary: 2600, position: 'Lead', skills: [{ name: 'ROS' }, { name: 'Python' }] }, ['firstName', 'salary', 'position', 'skills']);
  assert.deepEqual(changes.map((c) => c.field), ['salary', 'position', 'skills']);
  assert.deepEqual(changes[0], { field: 'salary', from: 'hidden', to: 'changed' });
  assert.equal(changes[1].to, 'Lead');
  assert.equal(describeChanges(changes), 'salary, position, skills');
});

test('profiles: HR and CEO see everyone, managers their reports and department, others only themselves', () => {
  const target = { _id: 't', managerId: 'm', departmentId: 'd1' };
  assert.equal(canSeePerson({ id: 'h', role: 'admin' }, target), true);
  assert.equal(canSeePerson({ id: 'c', role: 'superAdmin' }, target), true);
  assert.equal(canSeePerson({ id: 'm', role: 'manager' }, target), true);
  assert.equal(canSeePerson({ id: 'm2', role: 'manager' }, target, 'd1'), true);
  assert.equal(canSeePerson({ id: 'm2', role: 'manager' }, target, 'd2'), false);
  assert.equal(canSeePerson({ id: 'e', role: 'employee' }, target), false);
  assert.equal(canSeePerson({ id: 't', role: 'employee' }, target), true);
});
