'use strict';
var path = require('path');
var assert = require('yeoman-assert');
var helpers = require('yeoman-test');
var fs = require('fs-extra');

describe('generator-docker-laravel:app', function () {
  before(function () {
    return helpers.run(path.join(__dirname, '../generators/app'))
      .inTmpDir(function (dir) {
        fs.copySync(path.join(__dirname, 'laravel-env1'), path.join(dir, '.env'));
      })
      .withPrompts({
        name: 'foobar',
        database: 'minimalMySQL'
      })
      .toPromise();
  });
  it('creates base docker files', function () {
    assert.file([
      'docker-compose.yml',
      'dc-aliases',
      'dc-aliases.bat'
    ]);
  });
  it('creates base services in docker-compose', function () {
    assert.fileContent(
      'docker-compose.yml',
      /\s+nginx:/
    );
    assert.fileContent(
      'docker-compose.yml',
      /\s+mysql:/
    );
    assert.fileContent(
      'docker-compose.yml',
      /\s+artisan:/
    );
    assert.fileContent(
      'docker-compose.yml',
      /\s+phpunit:/
    );
    assert.fileContent(
      'docker-compose.yml',
      /\s+phpspec:/
    );
    assert.noFileContent(
      'docker-compose.yml',
      /\s+redis:/
    );
    assert.noFileContent(
      'docker-compose.yml',
      /\s+notifications-daemon:/
    );
    assert.noFileContent(
      'docker-compose.yml',
      /\s+queue-daemon:/
    );
    assert.noFileContent(
      'docker-compose.yml',
      /\s+adminer:/
    );
  });
  it('uses default port', function () {
    assert.fileContent(
      'docker-compose.yml',
      /\s+ports:\s+-\s8888:80\s/
    );
  });
  it('updates .env file', function () {
    assert.fileContent(
      '.env',
      /APP_NAME=foobar/
    );
    assert.fileContent(
      '.env',
      /MYSQL_ROOT_PASSWORD=\S+/
    );
    assert.fileContent(
      '.env',
      /DB_CONNECTION=mysql/
    );
    assert.fileContent(
      '.env',
      /DB_HOST=foobar-db/
    );
    assert.fileContent(
      '.env',
      /DB_DATABASE=foobar/
    );
    assert.fileContent(
      '.env',
      /DB_PASSWORD=[^x]\S+/
    );
  });
  it('writes .gitignore files', function () {
    assert.fileContent(
      'docker/mysql/.gitignore',
      'db'
    );
  });
  it('uses minimal cnf', function () {
    assert.fileContent(
      'docker/mysql/conf/my.cnf',
      /performance_schema=off/
    );
  });

  describe('with a queue daemon', function () {
    before(function () {
      return helpers.run(path.join(__dirname, '../generators/app'))
        .inTmpDir(function (dir) {
          fs.copySync(path.join(__dirname, 'laravel-env1'), path.join(dir, '.env'));
        })
        .withPrompts({
          name: 'foobar',
          database: 'minimalMySQL',
          extra: ['queue']
        })
        .toPromise();
    });
    it('creates a redis and queue-daemon entry', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+redis:/
      );
      assert.fileContent(
        'docker-compose.yml',
        /\s+queue-daemon:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+notifications-daemon:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+adminer:/
      );
    });
    it('updates .env file', function () {
      assert.fileContent(
        '.env',
        /REDIS_HOST=foobar-redis/
      );
      assert.fileContent(
        '.env',
        /REDIS_PASSWORD=[^x]\S+/
      );
      assert.fileContent(
        '.env',
        /QUEUE_DRIVER=redis/
      );
    });
    it('writes .gitignore files', function () {
      assert.fileContent(
        'docker/redis/.gitignore',
        '*.aof'
      );
    });
  });

  describe('with a notifications daemon', function () {
    before(function () {
      return helpers.run(path.join(__dirname, '../generators/app'))
        .inTmpDir(function (dir) {
          fs.copySync(path.join(__dirname, 'laravel-env1'), path.join(dir, '.env'));
        })
        .withPrompts({
          name: 'foobar',
          database: 'minimalMySQL',
          extra: ['notifications']
        })
        .toPromise();
    });
    it('creates a redis and notifications-daemon entry', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+redis:/
      );
      assert.fileContent(
        'docker-compose.yml',
        /\s+notifications-daemon:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+queue-daemon:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+adminer:/
      );
    });
    it('creates default nodejs-app', function () {
      assert.file([
        'nodejs-apps/notifications/redis-pusher.js',
        'nodejs-apps/notifications/package.json'
      ]);
    });
    it('creates a script to update and reload the service', function () {
      assert.file([
        'update-notifications-service.sh',
        'update-notifications-service.bat',
      ]);
    });
    it('uses default notifications port', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+ports:\s+-\s8080:3000\s/
      );
    });
    it('updates .env file', function () {
      assert.fileContent(
        '.env',
        /REDIS_HOST=foobar-redis/
      );
      assert.fileContent(
        '.env',
        /REDIS_PASSWORD=[^x]\S+/
      );
      assert.fileContent(
        '.env',
        /BROADCAST_DRIVER=redis/
      );
    });
    it('writes .gitignore files', function () {
      assert.fileContent(
        'docker/redis/.gitignore',
        '*.aof'
      );
    });
  });

  describe('with adminer', function () {
    before(function () {
      return helpers.run(path.join(__dirname, '../generators/app'))
        .withPrompts({
          name: 'foobar',
          database: 'minimalMySQL',
          extra: ['adminer']
        })
        .toPromise();
    });
    it('creates an adminer entry', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+adminer:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+notifications-daemon:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+queue-daemon:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+redis:/
      );
    });

    it('uses default adminer port', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+ports:\s+-\s9999:80\s/
      );
    });
  });

  describe('with custom ports', function () {
    before(function () {
      return helpers.run(path.join(__dirname, '../generators/app'))
        .withPrompts({
          name: 'foobar',
          nginxPort: 1234,
          notificationsPort: 2345,
          adminerPort: 3456,
          database: 'minimalMySQL',
          extra: ['notifications', 'adminer']
        })
        .toPromise();
    });
    it('overrides nginx port', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+ports:\s+-\s1234:80\s/
      );
    });
    it('overrides notifications daemon port', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+ports:\s+-\s2345:3000\s/
      );
    });
    it('overrides adminer port', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+ports:\s+-\s3456:80\s/
      );
    });
  });

  describe('when run multiple times', function () {
    before(function () {
      return helpers.run(path.join(__dirname, '../generators/app'))
        .inTmpDir(function (dir) {
          fs.copySync(path.join(__dirname, 'laravel-env2'), path.join(dir, '.env'));
        })
        .withPrompts({
          name: 'foobar',
          database: 'minimalMySQL',
          extras: ['queue']
        })
        .toPromise();
    });
    it('should keep app name related entries', function () {
      assert.fileContent(
        '.env',
        /APP_NAME=app1/
      );
      assert.fileContent(
        '.env',
        /DB_DATABASE=app1/
      );
      assert.fileContent(
        '.env',
        /DB_HOST=app1-db/
      );
      assert.fileContent(
        '.env',
        /REDIS_HOST=app1-redis/
      );
    });
    it('should keep passwords', function () {
      assert.fileContent(
        '.env',
        /MYSQL_ROOT_PASSWORD=db-root-pass/
      );
      assert.fileContent(
        '.env',
        /DB_PASSWORD=db-pass/
      );
      assert.fileContent(
        '.env',
        /REDIS_PASSWORD=redis-pass/
      );
    });
  });

  describe('with custom nodejs path', function () {
    before(function () {
      return helpers.run(path.join(__dirname, '../generators/app'))
        .withPrompts({
          name: 'foobar',
          database: 'minimalMySQL',
          notificationsAppPath: 'custom-path',
          extra: ['notifications']
        })
        .toPromise();
    });
    it('overrides default nodejs application path', function () {
      assert.file([
        'custom-path/redis-pusher.js',
        'custom-path/package.json'
      ]);
    });
  });

  describe('with small mysql', function () {
    before(function () {
      return helpers.run(path.join(__dirname, '../generators/app'))
        .inTmpDir(function (dir) {
          fs.copySync(path.join(__dirname, 'laravel-env1'), path.join(dir, '.env'));
        })
        .withPrompts({
          name: 'foobar',
          database: 'smallMySQL'
        })
        .toPromise();
    });
    it('creates base docker files', function () {
      assert.file([
        'docker-compose.yml',
        'dc-aliases',
        'dc-aliases.bat'
      ]);
    });
    it('creates mysql entry in docker-compose', function () {
      assert.fileContent(
        'docker-compose.yml',
        /\s+mysql:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+redis:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+notifications-daemon:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+queue-daemon:/
      );
      assert.noFileContent(
        'docker-compose.yml',
        /\s+adminer:/
      );
    });
    it('updates .env file', function () {
      assert.fileContent(
        '.env',
        /MYSQL_ROOT_PASSWORD=\S+/
      );
      assert.fileContent(
        '.env',
        /DB_CONNECTION=mysql/
      );
      assert.fileContent(
        '.env',
        /DB_HOST=foobar-db/
      );
      assert.fileContent(
        '.env',
        /DB_DATABASE=foobar/
      );
      assert.fileContent(
        '.env',
        /DB_PASSWORD=[^x]\S+/
      );
    });
    it('writes .gitignore files', function () {
      assert.fileContent(
        'docker/mysql/.gitignore',
        'db'
      );
    });
    it('uses minimal cnf', function () {
      assert.fileContent(
        'docker/mysql/conf/my.cnf',
        /\[mysqlhotcopy\]/
      );
    });
  });
});
