# monsoul-share

`monsoul-share` is a small Node 24 shared package for reusable service capabilities across projects.

Current modules:

- `logger`: lightweight file/stdout logger with request logging middleware.
- `redis`: lazy Redis client manager built on top of `ioredis`.

## Install

```bash
npm install monsoul-share
```

Before publishing, confirm the npm package name is available. If not, rename the package in `package.json`.

## Logger

```js
const share = require('monsoul-share');

share.logger.configure({
  appName: 'my-service',
  level: 'debug',
  dir: './logs',
  toStdout: true,
  toFile: true
});

const logger = share.logger('seminarService');

logger.info('service started');
logger.error('something failed: %s', 'demo');
```

Express request logging:

```js
const express = require('express');
const share = require('monsoul-share');

const app = express();
const logger = share.logger('http');

app.use(share.logger.express(logger));
```

## Redis

```js
const share = require('monsoul-share');

const redis = share.createRedisService({
  enabled: true,
  url: process.env.REDIS_URL,
  lazyConnect: true
});

async function main() {
  await redis.connect();
  await redis.getClient().set('healthcheck', 'ok');
  const value = await redis.getClient().get('healthcheck');
  console.log(value);
  await redis.disconnect();
}

main().catch(console.error);
```

Publish helper:

```bash
npm publish
```
