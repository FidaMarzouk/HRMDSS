process.env.TZ = 'Africa/Tunis';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toCompanyDate } = require('../utils/time');

const MIDNIGHT_21_MARCH = '2017-03-20T23:00:00.000Z'; // 00:00 in Tunis (UTC+1)

test('a YYYY-MM-DD string is that calendar day in company time, not UTC', () => {
  assert.equal(toCompanyDate('2017-03-21').toISOString(), MIDNIGHT_21_MARCH);
  assert.equal(toCompanyDate(' 2017-03-21 ').toISOString(), MIDNIGHT_21_MARCH);
});

test('dates stored either way normalise to the same company day', () => {
  // Old form-created value (UTC midnight) and old seed value (Tunis midnight)
  assert.equal(toCompanyDate(new Date('2017-03-21T00:00:00Z')).toISOString(), MIDNIGHT_21_MARCH);
  assert.equal(toCompanyDate(new Date(MIDNIGHT_21_MARCH)).toISOString(), MIDNIGHT_21_MARCH);
  // A full timestamp keeps its company-time day
  assert.equal(toCompanyDate('2017-03-21T17:45:00+01:00').toISOString(), MIDNIGHT_21_MARCH);
});

test('normalising twice changes nothing', () => {
  const once = toCompanyDate('2024-02-29');
  assert.equal(toCompanyDate(once).getTime(), once.getTime());
});

test('empty values pass through and invalid input stays invalid', () => {
  assert.equal(toCompanyDate(undefined), undefined);
  assert.equal(toCompanyDate(null), null);
  assert.equal(toCompanyDate(''), '');
  assert.ok(Number.isNaN(toCompanyDate('not a date').getTime()));
});
