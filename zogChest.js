'use strict';

var moduleName = 'chest';

var path      = require ('path');
var fs        = require ('fs');
var zogLog    = require ('xcraft-core-log') (moduleName);
var busClient = require ('xcraft-core-busclient');
var chestConfig = require ('xcraft-core-etc').load ('xcraft-contrib-chest');

var cmd = {};

/**
 * Start the chest server.
 */
cmd.start = function () {
  var spawn = require ('child_process').spawn;
  var isRunning = false;

  if (fs.existsSync (chestConfig.pid)) {
    zogLog.warn ('the chest server seems running');

    isRunning = true;
    var pid = fs.readFileSync (chestConfig.pid, 'utf8');

    try {
      process.kill (pid, 0);
    } catch (err) {
      if (err.code === 'ESRCH') {
        zogLog.warn ('but the process can not be found, then we try to start it');
        fs.unlinkSync (chestConfig.pid);
        isRunning = false;
      }
    }
  }

  if (!isRunning) {
    var logout = fs.openSync (chestConfig.log, 'a');
    var logerr = fs.openSync (chestConfig.log, 'a');
    var launcher = [
      path.resolve (__dirname, './chest/chestServer.js'),
      chestConfig.host,
      chestConfig.port,
      chestConfig.repository
    ];

    var chest = spawn ('node', launcher,
    {
      detached: true,
      stdio: ['ignore', logout, logerr]
    });

    zogLog.verb ('chest server PID: ' + chest.pid);
    fs.writeFileSync (chestConfig.pid, chest.pid);

    chest.unref ();
  }

  busClient.events.send ('zogChest.start.finished');
};

/**
 * Stop the chest server.
 */
cmd.stop = function () {
  try {
    var pid = fs.readFileSync (chestConfig.pid, 'utf8');
    process.kill (pid, 'SIGTERM');
    fs.unlinkSync (chestConfig.pid);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      zogLog.err (err);
    }
  }

  busClient.events.send ('zogChest.stop.finished');
};

/**
 * Restart the chest server.
 */
cmd.restart = function () {
  cmd.stop ();
  cmd.start ();

  busClient.events.send ('zogChest.restart.finished');
};

/**
 * Send a file to the chest server.
 * @param {Object} chestMsg
 */
cmd.send = function (chestMsg) {
  var file = chestMsg.data.file;
  var path = require ('path');

  file = path.resolve (file);

  zogLog.info ('send ' + file + ' to the chest');

  var chestClient = require ('./chest/chestClient.js');
  chestClient.upload (file, chestConfig, function (error) {
    if (error) {
      zogLog.err (error);
    }

    busClient.events.send ('zogChest.send.finished');
  });
};

/**
 * Retrieve the list of available commands.
 * @returns {Object[]} The list of commands.
 */
exports.xcraftCommands = function () {
  var utils  = require ('xcraft-core-utils');
  var rcFile = path.join (__dirname, './rc.json');
  var rc     = utils.jsonFile2Json (rcFile);
  var list   = [];

  Object.keys (cmd).forEach (function (action) {
    list.push ({
      name   : action,
      desc   : rc[action] ? rc[action].desc   : null,
      params : rc[action] ? rc[action].params : null,
      handler: cmd[action]
    });
  });

  return list;
};

/**
 * Retrieve the inquirer definition for xcraft-core-etc
 */
exports.xcraftConfig = [{
  type: 'input',
  name: 'host',
  message: 'hostname or IP [client or server]:',
  default: '127.0.0.1'
}, {
  type: 'input',
  name: 'port',
  message: 'listening port [client or server]:',
  validate: function (value) {
    return /^[0-9]{1,}$/.test (value);
  },
  default: '8080'
}, {
  type: 'input',
  name: 'pid',
  message: 'pid filename [server]:',
  default: './var/run/chestd.pid'
}, {
  type: 'input',
  name: 'log',
  message: 'log filename [server]:',
  default: './var/log/chestd.log'
}, {
  type: 'input',
  name: 'repository',
  message: 'path to the repository [server]:',
  default: './var/chest/'
}];
