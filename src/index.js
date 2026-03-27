'use strict';

var logger = require('./logger');
var redis = require('./redis');

module.exports = {
  logger: logger,
  redis: redis,
  createLogger: logger.createLogger,
  createRequestLogger: logger.createRequestLogger,
  configureLogger: logger.configureLogger,
  getLoggerConfig: logger.getLoggerConfig,
  createRedisService: redis.createRedisService
};
