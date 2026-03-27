'use strict';

var logger = require('./logger');
var redis = require('./redis');
var loggerFactory = createLoggerFactory();

module.exports = {
  logger: loggerFactory,
  redis: redis,
  createLogger: logger.createLogger,
  createRequestLogger: logger.createRequestLogger,
  configureLogger: logger.configureLogger,
  getLoggerConfig: logger.getLoggerConfig,
  createRedisService: redis.createRedisService
};

function createLoggerFactory() {
  function factory(scope, options) {
    return logger.createLogger(scope, options);
  }

  factory.createLogger = logger.createLogger;
  factory.createRequestLogger = logger.createRequestLogger;
  factory.configure = logger.configureLogger;
  factory.getConfig = logger.getLoggerConfig;
  factory.reset = logger.resetLoggerConfig;
  factory.express = function(levelOrLogger, options) {
    return logger.createRequestLogger(levelOrLogger, options);
  };

  return factory;
}
