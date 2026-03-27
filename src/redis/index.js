'use strict';

var DEFAULT_REDIS_OPTIONS = Object.freeze({
  enabled: false,
  url: null,
  host: '127.0.0.1',
  port: 6379,
  username: null,
  password: null,
  db: 0,
  keyPrefix: null,
  lazyConnect: true,
  connectTimeout: 5000,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  redisOptions: null,
  clusterNodes: null,
  clusterOptions: null,
  logger: null
});

function createRedisService(options) {
  var settings = normalizeRedisOptions(options || {});
  var logger = normalizeLogger(settings.logger);
  var state = {
    enabled: settings.enabled,
    mode: settings.clusterNodes.length ? 'cluster' : 'standalone',
    clients: {
      default: 'not_initialized',
      publisher: 'not_initialized',
      subscriber: 'not_initialized'
    },
    lastError: null
  };

  var defaultClient = null;
  var publisherClient = null;
  var subscriberClient = null;

  function assertEnabled() {
    if (!settings.enabled) {
      throw new Error('Redis is disabled. Pass { enabled: true } to createRedisService().');
    }
  }

  function buildClient(role) {
    var Redis = loadRedisConstructor();
    var client;

    if (settings.clusterNodes.length) {
      client = new Redis.Cluster(settings.clusterNodes, buildClusterOptions(settings));
    } else if (settings.url) {
      client = new Redis(settings.url, buildStandaloneOptions(settings));
    } else {
      client = new Redis(buildStandaloneConnectionOptions(settings));
    }

    attachClientEvents(client, role, state, logger);
    state.clients[role] = client.status || 'initializing';

    return client;
  }

  function getClient() {
    assertEnabled();

    if (!defaultClient) {
      defaultClient = buildClient('default');
    }

    return defaultClient;
  }

  function getPublisher() {
    assertEnabled();

    if (!publisherClient) {
      publisherClient = buildClient('publisher');
    }

    return publisherClient;
  }

  function getSubscriber() {
    assertEnabled();

    if (!subscriberClient) {
      subscriberClient = buildClient('subscriber');
    }

    return subscriberClient;
  }

  async function connect() {
    var client = getClient();
    await ensureClientConnected(client);
    return client;
  }

  async function connectPublisher() {
    var client = getPublisher();
    await ensureClientConnected(client);
    return client;
  }

  async function connectSubscriber() {
    var client = getSubscriber();
    await ensureClientConnected(client);
    return client;
  }

  async function ping(message) {
    var client = await connect();
    return client.ping(message || 'ping');
  }

  async function publish(channel, payload) {
    var publisher;
    var message;

    assertEnabled();

    if (!channel) {
      throw new Error('Redis publish requires a channel.');
    }

    publisher = await connectPublisher();
    message = typeof payload === 'string' ? payload : JSON.stringify(payload);

    return publisher.publish(channel, message);
  }

  async function disconnect() {
    await Promise.all([
      closeClient(defaultClient),
      closeClient(publisherClient),
      closeClient(subscriberClient)
    ]);

    defaultClient = null;
    publisherClient = null;
    subscriberClient = null;
    state.clients.default = 'not_initialized';
    state.clients.publisher = 'not_initialized';
    state.clients.subscriber = 'not_initialized';
  }

  function getStatus() {
    return {
      enabled: state.enabled,
      mode: state.mode,
      clients: Object.assign({}, state.clients),
      ready: hasReadyClient(state.clients),
      lastError: state.lastError
    };
  }

  return {
    options: getPublicOptions(settings),
    isEnabled: function() {
      return settings.enabled;
    },
    getStatus: getStatus,
    getClient: getClient,
    getPublisher: getPublisher,
    getSubscriber: getSubscriber,
    connect: connect,
    connectPublisher: connectPublisher,
    connectSubscriber: connectSubscriber,
    ping: ping,
    publish: publish,
    disconnect: disconnect
  };
}

function normalizeRedisOptions(options) {
  var clusterNodes = [];

  if (Array.isArray(options.clusterNodes)) {
    clusterNodes = options.clusterNodes.slice();
  } else if (options.cluster && Array.isArray(options.cluster.nodes)) {
    clusterNodes = options.cluster.nodes.slice();
  }

  return {
    enabled: Boolean(options.enabled),
    url: options.url || null,
    host: options.host || DEFAULT_REDIS_OPTIONS.host,
    port: options.port || DEFAULT_REDIS_OPTIONS.port,
    username: options.username || null,
    password: options.password || null,
    db: Object.prototype.hasOwnProperty.call(options, 'db') ? options.db : DEFAULT_REDIS_OPTIONS.db,
    keyPrefix: options.keyPrefix || null,
    lazyConnect: Object.prototype.hasOwnProperty.call(options, 'lazyConnect')
      ? Boolean(options.lazyConnect)
      : DEFAULT_REDIS_OPTIONS.lazyConnect,
    connectTimeout: options.connectTimeout || DEFAULT_REDIS_OPTIONS.connectTimeout,
    maxRetriesPerRequest: Object.prototype.hasOwnProperty.call(options, 'maxRetriesPerRequest')
      ? options.maxRetriesPerRequest
      : DEFAULT_REDIS_OPTIONS.maxRetriesPerRequest,
    enableReadyCheck: Object.prototype.hasOwnProperty.call(options, 'enableReadyCheck')
      ? Boolean(options.enableReadyCheck)
      : DEFAULT_REDIS_OPTIONS.enableReadyCheck,
    redisOptions: options.redisOptions || null,
    clusterNodes: clusterNodes,
    clusterOptions: options.clusterOptions || null,
    logger: options.logger || null
  };
}

function buildStandaloneOptions(settings) {
  return Object.assign(
    {},
    buildBaseRedisOptions(settings),
    settings.redisOptions || {}
  );
}

function buildStandaloneConnectionOptions(settings) {
  return Object.assign(
    {},
    buildBaseRedisOptions(settings),
    settings.redisOptions || {},
    {
      host: settings.host,
      port: settings.port,
      username: settings.username || undefined,
      password: settings.password || undefined,
      db: settings.db
    }
  );
}

function buildBaseRedisOptions(settings) {
  var baseOptions = {
    lazyConnect: settings.lazyConnect,
    connectTimeout: settings.connectTimeout,
    maxRetriesPerRequest: settings.maxRetriesPerRequest,
    enableReadyCheck: settings.enableReadyCheck
  };

  if (settings.keyPrefix) {
    baseOptions.keyPrefix = settings.keyPrefix;
  }

  if (settings.username) {
    baseOptions.username = settings.username;
  }

  if (settings.password) {
    baseOptions.password = settings.password;
  }

  return baseOptions;
}

function buildClusterOptions(settings) {
  return Object.assign(
    {},
    settings.clusterOptions || {},
    {
      redisOptions: Object.assign(
        {},
        buildBaseRedisOptions(settings),
        settings.clusterOptions && settings.clusterOptions.redisOptions
          ? settings.clusterOptions.redisOptions
          : {},
        settings.redisOptions || {}
      )
    }
  );
}

function normalizeLogger(logger) {
  var noop = function() {};

  if (!logger) {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop
    };
  }

  return {
    debug: typeof logger.debug === 'function' ? logger.debug.bind(logger) : noop,
    info: typeof logger.info === 'function' ? logger.info.bind(logger) : noop,
    warn: typeof logger.warn === 'function' ? logger.warn.bind(logger) : noop,
    error: typeof logger.error === 'function' ? logger.error.bind(logger) : noop
  };
}

function loadRedisConstructor() {
  try {
    return require('ioredis');
  } catch (err) {
    err.message = 'Unable to load ioredis. Run npm install before using the redis module. Original error: ' + err.message;
    throw err;
  }
}

async function ensureClientConnected(client) {
  if (!client) {
    return null;
  }

  if (client.status === 'ready' || client.status === 'connect') {
    return client;
  }

  await client.connect();
  return client;
}

async function closeClient(client) {
  if (!client) {
    return;
  }

  try {
    await client.quit();
  } catch (err) {
    try {
      client.disconnect();
    } catch (disconnectError) {
      return;
    }
  }
}

function attachClientEvents(client, role, state, logger) {
  client.on('connect', function() {
    state.clients[role] = client.status || 'connect';
    logger.info('redis %s client connected', role);
  });

  client.on('ready', function() {
    state.clients[role] = client.status || 'ready';
    logger.info('redis %s client ready', role);
  });

  client.on('close', function() {
    state.clients[role] = client.status || 'close';
    logger.warn('redis %s client closed', role);
  });

  client.on('reconnecting', function() {
    state.clients[role] = client.status || 'reconnecting';
    logger.warn('redis %s client reconnecting', role);
  });

  client.on('end', function() {
    state.clients[role] = client.status || 'end';
    logger.warn('redis %s client ended', role);
  });

  client.on('error', function(err) {
    state.clients[role] = client.status || 'error';
    state.lastError = serializeError(err);
    logger.error('redis %s client error %s', role, state.lastError.message);
  });
}

function serializeError(err) {
  if (!err) {
    return null;
  }

  return {
    name: err.name || 'Error',
    message: err.message || String(err),
    stack: err.stack || null
  };
}

function hasReadyClient(clients) {
  return Object.keys(clients).some(function(key) {
    return clients[key] === 'ready' || clients[key] === 'connect';
  });
}

function getPublicOptions(settings) {
  return {
    enabled: settings.enabled,
    mode: settings.clusterNodes.length ? 'cluster' : 'standalone',
    url: settings.url,
    host: settings.host,
    port: settings.port,
    db: settings.db,
    keyPrefix: settings.keyPrefix,
    lazyConnect: settings.lazyConnect,
    connectTimeout: settings.connectTimeout,
    maxRetriesPerRequest: settings.maxRetriesPerRequest,
    enableReadyCheck: settings.enableReadyCheck,
    clusterNodes: settings.clusterNodes.slice()
  };
}

module.exports = {
  createRedisService: createRedisService
};
