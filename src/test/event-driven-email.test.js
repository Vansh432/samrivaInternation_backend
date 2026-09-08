import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_TYPES } from '../event/eventTypes.js';
import { publishEvent } from '../event/producer.js';
import { handlers } from '../event/handlers/email.handler.js';

const original = handlers[EVENT_TYPES.USER_REGISTERED];

test('user registration event triggers email handler', async () => {
  let called = false;

  handlers[EVENT_TYPES.USER_REGISTERED] = async (payload) => {
    called = true;
    assert.equal(payload.user.email, 'demo@example.com');
  };

  await publishEvent({
    type: EVENT_TYPES.USER_REGISTERED,
    payload: {
      user: { email: 'demo@example.com', fullName: 'Demo User' },
      templateType: 'welcome',
    },
  });

  assert.equal(called, true);
  handlers[EVENT_TYPES.USER_REGISTERED] = original;
});
