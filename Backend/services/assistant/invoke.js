// Run an existing route handler in-process as a given user, so the assistant's
// confirmed actions go through exactly the same validation, permissions,
// notifications and audit as the screens. Returns { status, body }.
const { broadcast } = require('../../Middlewares/notificationService');

const callController = (handler, { user, body = {}, params = {}, query = {} }, { broadcastOn } = {}) =>
  new Promise((resolve, reject) => {
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        if (statusCode < 400 && broadcastOn) [].concat(broadcastOn).forEach((event) => broadcast(event));
        resolve({ status: statusCode, body: payload });
        return this;
      },
      // Route handlers only use status/json; anything else would be a bug here.
      cookie() {
        return this;
      },
      clearCookie() {
        return this;
      },
    };
    const req = { user, body, params, query, headers: {}, get: () => undefined, ip: 'assistant' };
    Promise.resolve(handler(req, res)).catch(reject);
  });

module.exports = { callController };
