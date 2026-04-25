# monsoul-share

`monsoul-share` is a Node 24 shared package for reusable backend capabilities across projects.

Current modules:

- `logger`: lightweight file/stdout logger with request logging middleware.
- `redis`: lazy Redis client manager built on top of `ioredis`.

## Requirements

- Node 24
- npm

## Install

```bash
npm install monsoul-share
```

Before publishing, confirm the package name is still available on npm.

## Quick Start

```js
const share = require('monsoul-share');

share.logger.configure({
  appName: 'my-service',
  level: 'debug',
  dir: './logs',
  toStdout: true,
  toFile: true
});

const logger = share.logger('app');
const redis = share.createRedisService({
  enabled: true,
  url: process.env.REDIS_URL,
  lazyConnect: true,
  logger
});
```

## Logger

Basic usage:

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

Supported log levels:

- `trace`
- `debug`
- `info`
- `warn`
- `error`
- `fatal`

Useful logger methods:

- `share.logger(scope)`
- `share.logger.configure(options)`
- `share.logger.express(loggerOrLevel)`
- `share.createLogger(scope)`
- `share.createRequestLogger(loggerOrLevel)`

## Redis

Basic usage:

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

Legacy-compatible standalone shape is also supported:

```js
const redis = share.createRedisService({
  enable: true,
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || null
});
```

Cluster usage:

```js
const share = require('monsoul-share');

const redis = share.createRedisService({
  enabled: true,
  clusterNodes: [
    { host: '127.0.0.1', port: 7000 },
    { host: '127.0.0.1', port: 7001 },
    { host: '127.0.0.1', port: 7002 }
  ],
  lazyConnect: true
});
```

Legacy-compatible cluster shape is also supported:

```js
const redis = share.createRedisService({
  enable: true,
  isCluster: true,
  servers: [
    {
      host: process.env.REDIS_CLUSTER_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_CLUSTER_PORT || 7000)
    }
  ],
  options: {
    redisOptions: { password: process.env.REDIS_PASSWORD || null }
  }
});
```

Useful Redis methods:

- `share.createRedisService(options)`
- `redis.connect()`
- `redis.getClient()`
- `redis.getPublisher()`
- `redis.getSubscriber()`
- `redis.publish(channel, payload)`
- `redis.disconnect()`
- `redis.getStatus()`

Note:

- Redis is disabled by default.
- Default standalone connection is `127.0.0.1:6379` with no password.
- No Redis connection is created until you call `connect()`, `getClient()`, `getPublisher()`, or `getSubscriber()`.

## Local Validation

Use Node 24 before running commands:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 24
```

Run tests:

```bash
npm test
```

Check the package contents before publishing:

```bash
npm pack --dry-run --cache /tmp/monsoul-share-npm-cache
```

## Publish Checklist

Before the first publish:

1. Make sure `package.json` metadata is correct.
2. Confirm the npm name is available.
3. Run `npm login`.
4. Verify the logged-in account with `npm whoami`.
5. Run `npm test`.
6. Run `npm pack --dry-run --cache /tmp/monsoul-share-npm-cache`.
7. Make sure the git working tree is clean before tagging.

Useful commands:

```bash
npm view monsoul-share version --registry=https://registry.npmjs.org
npm login
npm whoami
npm test
npm pack --dry-run --cache /tmp/monsoul-share-npm-cache
```

## First Publish Flow

If this is the first public release and the current version is already correct:

```bash
git status
npm test
npm pack --dry-run --cache /tmp/monsoul-share-npm-cache
git add .
git commit -m "chore: release v0.1.0"
git tag -a v0.1.0 -m "Release v0.1.0"
npm publish
git push origin main
git push origin v0.1.0
```

If your default branch is not `main`, replace it with the actual branch name.

## Version And Tag Flow

Recommended versioning:

- `patch`: bug fixes only, for example `0.1.0 -> 0.1.1`
- `minor`: backward-compatible features, for example `0.1.0 -> 0.2.0`
- `major`: breaking changes, for example `0.1.0 -> 1.0.0`

Recommended release flow after the first publish:

1. Finish code changes and commit them.
2. Run `npm test`.
3. Run `npm version patch`, `npm version minor`, or `npm version major`.
4. Run `npm publish`.
5. Push the commit and tag to GitHub.

Example:

```bash
git status
npm test
npm version patch
npm publish
git push origin main --tags
```

If you want to control the version manually without creating a git tag automatically:

```bash
npm version 0.2.0 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release v0.2.0"
git tag -a v0.2.0 -m "Release v0.2.0"
npm publish
git push origin main --tags
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
