'use strict';

var fs = require('node:fs');
var path = require('node:path');
var util = require('node:util');

var LEVEL_PRIORITY = Object.freeze({
  trace: 5,
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50
});

var loggerConfig = createDefaultConfig();

function createDefaultConfig() {
  return {
    appName: process.env.LOG_APP_NAME || 'monsoul-share',
    level: normalizeLevel(process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')),
    dir: resolveDefaultLogDir(),
    toStdout: normalizeBoolean(process.env.LOG_TO_STDOUT, true),
    toFile: normalizeBoolean(process.env.LOG_TO_FILE, true),
    format: process.env.LOG_FORMAT === 'json' ? 'json' : 'text'
  };
}

function resolveDefaultLogDir() {
  var rootDir;

  if (process.env.LOG_DIR) {
    return process.env.LOG_DIR;
  }

  rootDir = resolveCallerProjectRoot();
  return path.join(rootDir, 'logs');
}

function resolveCallerProjectRoot() {
  var candidates = [];
  var i;
  var projectRoot;

  if (process.env.INIT_CWD) {
    candidates.push(process.env.INIT_CWD);
  }

  if (require.main && require.main.filename) {
    candidates.push(path.dirname(require.main.filename));
  }

  if (Array.isArray(process.argv) && process.argv[1]) {
    candidates.push(path.dirname(process.argv[1]));
  }

  candidates.push(process.cwd());

  for (i = 0; i < candidates.length; i += 1) {
    projectRoot = findNearestPackageRoot(candidates[i]);
    if (projectRoot) {
      return projectRoot;
    }
  }

  return process.cwd();
}

function findNearestPackageRoot(startDir) {
  var current = startDir ? path.resolve(startDir) : '';
  var parent;

  if (!current) {
    return null;
  }

  while (true) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }

    parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function configureLogger(options) {
  loggerConfig = mergeConfig(loggerConfig, options || {});
  return getLoggerConfig();
}

function getLoggerConfig() {
  return Object.assign({}, loggerConfig);
}

function resetLoggerConfig() {
  loggerConfig = createDefaultConfig();
  return getLoggerConfig();
}

function createLogger(scope, localOptions) {
  var loggerScope = scope || 'app';
  var overrides = Object.assign({}, localOptions || {});

  function write(level, argsLike) {
    var config = mergeConfig(loggerConfig, overrides);
    var args = Array.prototype.slice.call(argsLike || []);
    var line;

    if (!shouldLog(level, config.level)) {
      return;
    }

    line = formatLine(level, loggerScope, args, config);

    if (config.toStdout) {
      writeToStdout(level, line);
    }

    if (config.toFile) {
      writeToFile(config, line);
    }
  }

  return {
    scope: loggerScope,
    trace: function() {
      write('trace', arguments);
    },
    debug: function() {
      write('debug', arguments);
    },
    info: function() {
      write('info', arguments);
    },
    warn: function() {
      write('warn', arguments);
    },
    error: function() {
      write('error', arguments);
    },
    fatal: function() {
      write('fatal', arguments);
    },
    child: function(childScope, childOptions) {
      var nextScope = childScope ? loggerScope + ':' + childScope : loggerScope;
      return createLogger(nextScope, Object.assign({}, overrides, childOptions || {}));
    }
  };
}

function createRequestLogger(logger, options) {
  var requestLogger = logger;
  var settings = Object.assign({
    durationDigits: 1,
    level: 'info'
  }, options || {});
  var logMethodName;
  var logMethod;

  if (typeof logger === 'string') {
    settings.level = logger;
    requestLogger = createLogger('http');
  } else if (!requestLogger) {
    requestLogger = createLogger('http');
  }

  logMethodName = normalizeRequestLevel(settings.level);
  logMethod = typeof requestLogger[logMethodName] === 'function'
    ? requestLogger[logMethodName]
    : requestLogger.info;

  return function requestLoggerMiddleware(req, res, next) {
    var startedAt = process.hrtime.bigint();

    res.on('finish', function() {
      var durationMs = Number(process.hrtime.bigint() - startedAt) / 1000000;
      logMethod.call(
        requestLogger,
        '%s %s %s %sms',
        req.method,
        req.originalUrl || req.url,
        res.statusCode,
        durationMs.toFixed(settings.durationDigits)
      );
    });

    next();
  };
}

function shouldLog(targetLevel, currentLevel) {
  return resolveLevelPriority(targetLevel) >= resolveLevelPriority(currentLevel);
}

function resolveLevelPriority(level) {
  return LEVEL_PRIORITY[normalizeLevel(level)] || LEVEL_PRIORITY.info;
}

function normalizeLevel(level) {
  var normalized = String(level || 'info').toLowerCase();

  if (!LEVEL_PRIORITY[normalized]) {
    return 'info';
  }

  return normalized;
}

function mergeConfig(baseConfig, overrideConfig) {
  var hasFormat = overrideConfig && Object.prototype.hasOwnProperty.call(overrideConfig, 'format');

  return {
    appName: overrideConfig && overrideConfig.appName ? overrideConfig.appName : baseConfig.appName,
    level: normalizeLevel(overrideConfig && overrideConfig.level ? overrideConfig.level : baseConfig.level),
    dir: overrideConfig && overrideConfig.dir ? overrideConfig.dir : baseConfig.dir,
    toStdout: overrideConfig && Object.prototype.hasOwnProperty.call(overrideConfig, 'toStdout')
      ? Boolean(overrideConfig.toStdout)
      : baseConfig.toStdout,
    toFile: overrideConfig && Object.prototype.hasOwnProperty.call(overrideConfig, 'toFile')
      ? Boolean(overrideConfig.toFile)
      : baseConfig.toFile,
    format: hasFormat
      ? (overrideConfig.format === 'json' ? 'json' : 'text')
      : baseConfig.format
  };
}

function formatLine(level, scope, args, config) {
  var timestamp = formatTimestamp(new Date());
  var message = util.format.apply(util, args);

  if (config.format === 'json') {
    return JSON.stringify({
      timestamp: timestamp,
      level: normalizeLevel(level).toUpperCase(),
      appName: config.appName,
      scope: scope,
      message: message
    });
  }

  return util.format(
    '[%s] [%s] [%s] [%s] %s',
    timestamp,
    normalizeLevel(level).toUpperCase(),
    config.appName,
    scope,
    message
  );
}

function formatTimestamp(date) {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
    '.',
    padMilliseconds(date.getMilliseconds())
  ].join('');
}

function writeToStdout(level, line) {
  if (level === 'error' || level === 'fatal') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

function writeToFile(config, line) {
  var filename;

  try {
    fs.mkdirSync(config.dir, {
      recursive: true
    });
    filename = getLogFilename(config.dir, new Date());
    fs.appendFileSync(filename, line + '\n', 'utf8');
  } catch (err) {
    console.error('[monsoul-share/logger] failed to write log file: %s', err && err.message ? err.message : err);
  }
}

function getLogFilename(dir, date) {
  return path.join(dir, [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '.log'
  ].join(''));
}

function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return String(value).toLowerCase() !== 'false';
}

function normalizeRequestLevel(level) {
  var normalized = normalizeLevel(level);

  if (normalized === 'trace') {
    return 'trace';
  }

  return normalized;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function padMilliseconds(value) {
  return String(value).padStart(3, '0');
}

module.exports = {
  createLogger: createLogger,
  createRequestLogger: createRequestLogger,
  configureLogger: configureLogger,
  getLoggerConfig: getLoggerConfig,
  resetLoggerConfig: resetLoggerConfig
};
