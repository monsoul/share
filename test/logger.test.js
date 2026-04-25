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
    toFile: true,
    format: 'text'
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
    toFile: true,
    format: 'text'
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

test('default logger config enables file output and resolves dir from INIT_CWD project root', function() {
  var previousInitCwd = process.env.INIT_CWD;
  var previousLogDir = process.env.LOG_DIR;
  var previousLogToFile = process.env.LOG_TO_FILE;
  var tmpProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'monsoul-share-project-root-'));
  var expectedDir = path.join(tmpProjectRoot, 'logs');

  try {
    fs.writeFileSync(path.join(tmpProjectRoot, 'package.json'), '{}', 'utf8');

    process.env.INIT_CWD = tmpProjectRoot;
    delete process.env.LOG_DIR;
    delete process.env.LOG_TO_FILE;
    loggerModule.resetLoggerConfig();

    assert.equal(loggerModule.getLoggerConfig().toFile, true);
    assert.equal(loggerModule.getLoggerConfig().dir, expectedDir);
  } finally {
    if (previousInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = previousInitCwd;
    }

    if (previousLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = previousLogDir;
    }

    if (previousLogToFile === undefined) {
      delete process.env.LOG_TO_FILE;
    } else {
      process.env.LOG_TO_FILE = previousLogToFile;
    }

    loggerModule.resetLoggerConfig();
  }
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
