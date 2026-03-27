'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var test = require('node:test');

var share = require('../src');
var loggerModule = require('../src/logger');

test('logger writes to daily log file', function() {
  var logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monsoul-share-logger-'));
  var logger;
  var expectedLogFile = path.join(logDir, getDatePrefix(new Date()) + '.log');

  loggerModule.resetLoggerConfig();
  loggerModule.configureLogger({
    appName: 'share-test',
    level: 'debug',
    dir: logDir,
    toStdout: false,
    toFile: true
  });

  logger = loggerModule.createLogger('unit');
  logger.info('hello %s', 'world');

  assert.equal(fs.existsSync(expectedLogFile), true);
  assert.match(fs.readFileSync(expectedLogFile, 'utf8'), /\[INFO\] \[share-test\] \[unit\] hello world/);

  loggerModule.resetLoggerConfig();
});

test('request logger logs request summary when response finishes', function() {
  var logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monsoul-share-request-'));
  var logger;
  var middleware;
  var req;
  var res;
  var nextCalled = false;
  var expectedLogFile = path.join(logDir, getDatePrefix(new Date()) + '.log');

  loggerModule.resetLoggerConfig();
  loggerModule.configureLogger({
    appName: 'share-test',
    level: 'info',
    dir: logDir,
    toStdout: false,
    toFile: true
  });

  logger = loggerModule.createLogger('http');
  middleware = loggerModule.createRequestLogger(logger);
  req = {
    method: 'GET',
    originalUrl: '/healthcheck'
  };
  res = createResponseDouble(200);

  middleware(req, res, function() {
    nextCalled = true;
  });

  res.emit('finish');

  assert.equal(nextCalled, true);
  assert.match(fs.readFileSync(expectedLogFile, 'utf8'), /GET \/healthcheck 200/);

  loggerModule.resetLoggerConfig();
});

test('top level logger factory supports compatibility-style usage', function() {
  var logger = share.logger('compat');

  assert.equal(typeof logger.info, 'function');
  assert.equal(typeof logger.trace, 'function');
  assert.equal(typeof share.logger.express, 'function');
  assert.equal(typeof share.logger.configure, 'function');
});

function createResponseDouble(statusCode) {
  var listeners = Object.create(null);

  return {
    statusCode: statusCode,
    on: function(eventName, callback) {
      listeners[eventName] = listeners[eventName] || [];
      listeners[eventName].push(callback);
    },
    emit: function(eventName) {
      (listeners[eventName] || []).forEach(function(callback) {
        callback();
      });
    }
  };
}

function getDatePrefix(date) {
  return [
    date.getFullYear(),
    '-',
    String(date.getMonth() + 1).padStart(2, '0'),
    '-',
    String(date.getDate()).padStart(2, '0')
  ].join('');
}
