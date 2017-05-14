'use strict';

var path = require ('path');
var fs = require ('fs');

var cmd = {};

/**
 * Start the chest server.
 */
cmd.start = function (msg, response) {
  const chestConfig = require ('xcraft-core-etc') (null, response).load (
    'xcraft-contrib-chest'
  );

  var spawn = require ('child_process').spawn;
  var isRunning = false;

  if (fs.existsSync (chestConfig.pid)) {
    response.log.warn ('the chest server seems running');

    isRunning = true;
    var pid = fs.readFileSync (chestConfig.pid, 'utf8');

    try {
      process.kill (pid, 0);
    } catch (err) {
      if (err.code === 'ESRCH') {
        response.log.warn (
          'but the process can not be found, then we try to start it'
        );
        fs.unlinkSync (chestConfig.pid);
        isRunning = false;
      }
    }
  }

  if (!isRunning) {
    var logout = fs.openSync (chestConfig.log, 'a');
    var logerr = fs.openSync (chestConfig.log, 'a');
    var launcher = [
      path.resolve (__dirname, './lib/server.js'),
      chestConfig.host,
      chestConfig.port,
      chestConfig.repository,
    ];

    var chest = spawn ('node', launcher, {
      detached: true,
      stdio: ['ignore', logout, logerr],
    });

    response.log.verb ('chest server PID: ' + chest.pid);
    fs.writeFileSync (chestConfig.pid, chest.pid);

    chest.unref ();
  }

  response.events.send ('chest.start.finished');
};

/**
 * Stop the chest server.
 */
cmd.stop = function (msg, response) {
  const chestConfig = require ('xcraft-core-etc') (null, response).load (
    'xcraft-contrib-chest'
  );

  try {
    var pid = fs.readFileSync (chestConfig.pid, 'utf8');
    process.kill (pid, 'SIGTERM');
    fs.unlinkSync (chestConfig.pid);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      response.log.err (err);
    }
  }

  response.events.send ('chest.stop.finished');
};

/**
 * Restart the chest server.
 */
cmd.restart = function (msg, response) {
  response.events.subscribe ('chest.start.finished', function () {
    response.events.unsubscribe ('chest.start.finished');
    response.events.send ('chest.restart.finished');
  });

  response.events.subscribe ('chest.stop.finished', function () {
    response.events.unsubscribe ('chest.stop.finished');
    response.command.send ('chest.start');
  });

  response.command.send ('chest.stop');
};

/**
 * Send a file to the chest server.
 *
 * @param {Object} msg
 */
cmd.send = function (msg, response) {
  const chestConfig = require ('xcraft-core-etc') (null, response).load (
    'xcraft-contrib-chest'
  );

  var file = msg.data.file;
  var path = require ('path');

  file = path.resolve (file);

  response.log.info ('send ' + file + ' to the chest');

  var chestClient = require ('./lib/client.js');
  chestClient.upload (file, chestConfig, response, function (error) {
    if (error) {
      response.log.err (error);
    }

    response.events.send ('chest.send.finished');
  });
};

/**
 * Retrieve the list of available commands.
 *
 * @returns {Object} The list and definitions of commands.
 */
exports.xcraftCommands = function () {
  return {
    handlers: cmd,
    rc: {
      start: {
        desc: 'start the chest server',
      },
      stop: {
        desc: 'stop the chest server',
      },
      restart: {
        desc: 'restart the chest server',
      },
      send: {
        parallel: 'true',
        desc: 'send a file to the chest server',
        options: {
          params: {
            required: 'file',
          },
        },
      },
    },
  };
};
