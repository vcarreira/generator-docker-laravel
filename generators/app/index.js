'use strict';
const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');
const _s = require('underscore.string');
const mkdirp = require('mkdirp');
const dotenv = require('dotenv');
const randomize = require('randomatic');

const NGINX_MEM_LIMIT = '100m';
const MYSQL_MEM_LIMIT = '100m';
const REDIS_MEM_LIMIT = '50m';
const ADMINER_MEM_LIMIT = '50m';
const QUEUE_DAEMON_MEM_LIMIT = '100m';
const NOTIFICATIONS_DAEMON_MEM_LIMIT = '120m';

const QUEUE_DAEMON_DEFAULT_TIMEOUT = 300; // Seconds
const QUEUE_DAEMON_DEFAULT_SLEEP = 5; // Seconds
const QUEUE_DAEMON_DEFAULT_TRIES = 2;
const QUEUE_DAEMON_DEFAULT_QUEUES = 'notifications,default,background-jobs';

module.exports = class extends Generator {
  constructor(args, opts) {
    super(args, opts);

    this.option('skip-welcome-message', {
      desc: 'Skips the welcome message',
      type: Boolean
    });

    this.settings = {};
    this.hasExtra = function (extra) {
      return this.settings.extra && this.settings.extra.indexOf(extra) !== -1;
    };
    this.docker = {};
  }

  prompting() {
    if (!this.options['skip-welcome-message']) {
      this.log(yosay('I will setup a ' + chalk.red('docker-compose') + ' file for ' + this.appname));
    }

    let prompts = [
      {
        type: 'input',
        name: 'name',
        message: 'An nginx container will be created to host your Laravel application. Container\'s name?',
        default: _s.dasherize(_s.underscored(this.appname))
      },
      {
        type: 'input',
        name: 'nginxPort',
        message: 'Local port for the nginx container?',
        default: 8888
      },
      {
        type: 'list',
        name: 'database',
        message: 'Which database container should I create?',
        choices: [
          {
            name: 'MySQL Database (minimal configuration)',
            value: 'minimalMySQL',
            checked: true
          },
          {
            name: 'MySQL Database (small configuration)',
            value: 'smallMySQL'
          }
        ],
        store: true
      },
      {
        type: 'checkbox',
        name: 'extra',
        message: 'Which extra containers should I create?',
        choices: [
          {
            name: 'Artisan queue daemon (through redis)',
            value: 'queue',
            checked: true
          },
          {
            name: 'Notifications daemon (through redis)',
            value: 'notifications',
            checked: true
          },
          {
            name: 'Adminer',
            value: 'adminer',
            checked: true
          }
        ]
      },
      {
        when: function (response) {
          return response.extra && response.extra.indexOf('notifications') !== -1;
        },
        type: 'input',
        name: 'notificationsPort',
        message: 'Notifications\'s port',
        default: 8080
      },
      {
        when: function (response) {
          return response.extra && response.extra.indexOf('notifications') !== -1;
        },
        type: 'input',
        name: 'notificationsAppPath',
        message: 'Notifications\'s nodejs app path',
        default: 'nodejs-apps/notifications'
      },
      {
        when: function (response) {
          return response.extra && response.extra.indexOf('adminer') !== -1;
        },
        type: 'input',
        name: 'adminerPort',
        message: 'Adminer\'s port',
        default: 9999
      }
    ];

    return this.prompt(prompts)
      .then(answers => {
        this.settings = answers;
        if (this.hasExtra('queue') || this.hasExtra('notifications')) {
          this.settings.extra.push('redis');
        }
      });
  }

  start() {
    this.log('Setting up docker folder...');
  }

  nginx() {
    mkdirp.sync('docker/nginx/sites');
    mkdirp.sync('docker/nginx/logs');

    this.docker.name = this.settings.name;
    this.docker.links = [];
    this.docker.nginx = {
      port: this.settings.nginxPort,
      memlimit: NGINX_MEM_LIMIT,
      links: []
    };

    this.fs.copy(
      this.templatePath('conf/nginx/nginx.dev'),
      this.destinationPath('docker/nginx/sites/nginx.dev')
    );
  }

  databaseMySQL() {
    if (!_s.endsWith(this.settings.database, 'MySQL')) {
      return;
    }

    mkdirp.sync('docker/mysql/conf');
    mkdirp.sync('docker/mysql/db');

    let cnf;
    switch (this.settings.database) {
      case 'smallMySQL':
        cnf = 'mysql-small.cnf';
        break;
      default:
        cnf = 'mysql-minimal.cnf';
        break;
    }

    this.docker.mysql = {
      memlimit: MYSQL_MEM_LIMIT
    };

    this.docker.links.push(`mysql:$\{DB_HOST}`);

    this.fs.copy(
      this.templatePath(`conf/databases/${cnf}`),
      this.destinationPath('docker/mysql/conf/my.cnf')
    );
    this.fs.copy(
      this.templatePath('conf/databases/mysql.dockerfile'),
      this.destinationPath('docker/mysql/mysql.dockerfile')
    );
  }

  redis() {
    if (!this.hasExtra('redis')) {
      return;
    }
    this.docker.redis = {
      memlimit: REDIS_MEM_LIMIT
    };
    this.docker.links.push(`redis:$\{REDIS_HOST}`);
  }

  queueDaemon() {
    if (!this.hasExtra('queue')) {
      return;
    }

    mkdirp.sync('docker/queue');

    this.docker.queue = {
      memlimit: QUEUE_DAEMON_MEM_LIMIT,
      timeout: QUEUE_DAEMON_DEFAULT_TIMEOUT,
      sleep: QUEUE_DAEMON_DEFAULT_SLEEP,
      tries: QUEUE_DAEMON_DEFAULT_TRIES,
      queues: QUEUE_DAEMON_DEFAULT_QUEUES
    };

    this.fs.copyTpl(
      this.templatePath('conf/queue/*'),
      this.destinationPath('docker/queue'),
      {docker: this.docker}
    );
  }

  notificationsDaemon() {
    if (!this.hasExtra('notifications')) {
      return;
    }

    mkdirp.sync('docker/notifications');
    mkdirp.sync('nodejs-apps/notifications');

    this.docker.notifications = {
      memlimit: NOTIFICATIONS_DAEMON_MEM_LIMIT,
      port: this.settings.notificationsPort,
      path: this.settings.notificationsAppPath
    };
    this.fs.copyTpl(
      this.templatePath('conf/notifications/docker/*'),
      this.destinationPath('docker/notifications'),
      {docker: this.docker}
    );

    this.fs.copy(
      this.templatePath('conf/notifications/app/package.json'),
      this.destinationPath(`${this.docker.notifications.path}/package.json`)
    );
    this.fs.copy(
      this.templatePath('conf/notifications/app/redis-pusher_js'),
      this.destinationPath(`${this.docker.notifications.path}/redis-pusher.js`)
    );
    this.fs.copy(
      this.templatePath('update-notifications-service.sh'),
      this.destinationPath('update-notifications-service.sh')
    );
  }

  adminer() {
    if (!this.hasExtra('adminer')) {
      return;
    }

    mkdirp.sync('docker/adminer/sites');

    this.fs.copy(
      this.templatePath('conf/adminer/*'),
      this.destinationPath('docker/adminer')
    );
    this.fs.copy(
      this.templatePath('conf/adminer/sites/adminer.dev'),
      this.destinationPath('docker/adminer/sites/adminer.dev')
    );

    this.docker.adminer = {
      memlimit: ADMINER_MEM_LIMIT,
      port: this.settings.adminerPort
    };
  }

  aliases() {
    let daemons = ['nginx'];

    if (this.docker.redis) {
      daemons.push('redis');
    }

    if (this.docker.mysql) {
      daemons.push('mysql');
    }

    if (this.docker.queue) {
      daemons.push('queue-daemon');
    }

    if (this.docker.notifications) {
      daemons.push('notifications-daemon');
    }
    this.docker.daemons = daemons.join(' ');
    this.fs.copyTpl(
      this.templatePath('docker-aliases'),
      this.destinationPath('dc-aliases'),
      {docker: this.docker}
    );
  }

  dockerDone() {
    this.log.ok('Docker folder created successfully');
  }

  writing() {
    this.log('Creating docker-compose file...');
    this.fs.copyTpl(
      this.templatePath('docker-compose.yml'),
      this.destinationPath('docker-compose.yml'),
      {docker: this.docker}
    );
    this.log.ok('docker-compose file created successfully');

    this.log('Rebuilding .env file...');
    let envPath = this.fs.exists('.env') ? '.env' : this.fs.exists('.env.example') ? '.env.example' : null;
    if (!envPath) {
      this.log.error('.env file not found!');
      return;
    }
    let env = dotenv.config({envPath});
    if (env.error) {
      this.log.error(`Failed to parse ${envPath} file not found!`, env.error);
      return;
    }
    env = env.parsed;

    let envNewKeys = [];

    if (env.APP_NAME === undefined) {
      env.APP_NAME = this.docker.name;
      envNewKeys.push('APP_NAME');
      env.DB_PASSWORD = randomize('Aa0', 16);

      if (this.docker.mysql) {
        if (!env.MYSQL_ROOT_PASSWORD) {
          envNewKeys.push('MYSQL_ROOT_PASSWORD');
        }
        env.MYSQL_ROOT_PASSWORD = randomize('Aa0', 16);
      }
      if (this.docker.redis) {
        env.REDIS_PASSWORD = randomize('Aa0', 8);
      }

      let dbname = _s.underscored(this.docker.name);
      env.DB_HOST = `${this.docker.name}-db`;
      env.DB_DATABASE = dbname;
      env.DB_USERNAME = 'docker';

      if (this.docker.redis) {
        env.REDIS_HOST = `${this.docker.name}-redis`;
      }
    }

    if (this.docker.mysql) {
      env.DB_CONNECTION = 'mysql';
    }

    if (this.docker.queue) {
      env.QUEUE_DRIVER = 'redis';
    }

    if (this.docker.notifications) {
      env.BROADCAST_DRIVER = 'redis';
    }

    let rawContent = this.fs.read(envPath);
    Object.keys(env).forEach(key => {
      let regex = new RegExp('^' + key + '=[^\\n]*$', 'mg');
      rawContent = rawContent.replace(regex, `${key}=${env[key]}`);
    });

    let header = '';
    envNewKeys.forEach(key => {
      header += `${key}=${env[key]}\n`;
    });
    if (header) {
      header += '\n';
    }
    this.fs.write('.env', header + rawContent);
    this.log.ok('.env file updated successfully');
  }
};
