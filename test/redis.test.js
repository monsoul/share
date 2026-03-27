'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var redisModule = require('../src/redis');

test('redis service is disabled by default', async function() {
  var redis = redisModule.createRedisService();

  assert.equal(redis.isEnabled(), false);
  assert.deepEqual(redis.getStatus(), {
    enabled: false,
    mode: 'standalone',
    clients: {
      default: 'not_initialized',
      publisher: 'not_initialized',
      subscriber: 'not_initialized'
    },
    ready: false,
    lastError: null
  });

  await assert.rejects(function() {
    return redis.connect();
  }, /Redis is disabled/);
});

test('redis service reports cluster mode without creating a client', function() {
  var redis = redisModule.createRedisService({
    enabled: true,
    clusterNodes: [
      {
        host: '127.0.0.1',
        port: 7000
      }
    ]
  });

  assert.equal(redis.getStatus().mode, 'cluster');
  assert.equal(redis.getStatus().clients.default, 'not_initialized');
});
