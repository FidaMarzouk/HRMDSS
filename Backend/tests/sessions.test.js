process.env.TZ = 'Africa/Tunis';
const test = require('node:test');
const assert = require('node:assert/strict');
const { describeDevice, coarseIp, isActive } = require('../services/sessions');
const { inQuietHours } = require('../Middlewares/notificationService');

test('device labels come from the user agent', () => {
  assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'), 'Chrome on Windows');
  assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), 'Safari on iPhone');
  assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0'), 'Edge on Windows');
  assert.equal(describeDevice('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'), 'Firefox on Linux');
  assert.equal(describeDevice(''), 'Browser');
});

test('addresses are shortened before they are stored', () => {
  assert.equal(coarseIp('::ffff:192.168.1.37'), '192.168.1.x');
  assert.equal(coarseIp('41.226.10.5'), '41.226.10.x');
  assert.equal(coarseIp('::1'), 'this computer');
  assert.equal(coarseIp('2001:db8:85a3:0:0:8a2e:370:7334'), '2001:db8:85a3:…');
});

test('tokens issued before sessions existed stay valid', () => {
  assert.equal(isActive(undefined), true);
});

test('quiet hours: off, same-day range and overnight range', () => {
  const at = (hm) => new Date(`2026-10-19T${hm}:00+01:00`);
  assert.equal(inQuietHours(undefined, at('23:00')), false);
  assert.equal(inQuietHours({ enabled: false, from: '19:00', to: '08:00' }, at('23:00')), false);
  const night = { enabled: true, from: '19:00', to: '08:00' };
  assert.equal(inQuietHours(night, at('23:30')), true);
  assert.equal(inQuietHours(night, at('06:59')), true);
  assert.equal(inQuietHours(night, at('08:00')), false);
  assert.equal(inQuietHours(night, at('12:00')), false);
  const lunch = { enabled: true, from: '12:30', to: '14:00' };
  assert.equal(inQuietHours(lunch, at('13:00')), true);
  assert.equal(inQuietHours(lunch, at('14:00')), false);
});
