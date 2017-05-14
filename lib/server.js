#!/usr/bin/env node
'use strict';

var moduleName = 'chest/server';

var fs = require ('fs');
var path = require ('path');
var express = require ('express');

var app = express ();
var server = require ('http').Server (app);

var xFs = require ('xcraft-core-fs');
var xLog = require ('xcraft-core-log') (moduleName, null);

xLog.setVerbosity (
  process.env.XCRAFT_LOG ? parseInt (process.env.XCRAFT_LOG) : 2
);
xLog.color (false);
xLog.datetime (true);

var config = require ('xcraft-core-etc') ().load ('xcraft-contrib-chest');
xLog.verb ('settings:');
xLog.verb ('- host: ' + config.host);
xLog.verb ('- port: ' + config.port);
xLog.verb ('- repository: ' + config.repository);

xLog.info ('the chest server is listening');

var socketList = {};

app.get ('/', function (req, res) {
  res.send ('The Xcraft chest server');
});

app.use ('/resources', express.static (config.repository));

app.post ('/upload', function (req, res) {
  var file = req.headers['xcraft-upload-filename'];

  xFs.mkdir (config.repository);

  var repoFile = path.join (config.repository, file);
  var wstream = fs.createWriteStream (repoFile);

  xLog.info (
    'start a file upload: %s (%d bytes)',
    file,
    req.headers['content-length']
  );

  req.pipe (wstream);

  req.on ('end', function () {
    wstream.end ();
    res.end ('end of file upload');

    /* The transmission is terminated, then we eject the client. */
    socketList[file].disconnect ();
    xLog.info ('end of file upload: %s', file);
  });

  req.on ('error', function (err) {
    if (socketList[file]) {
      socketList[file].disconnect ();
    }

    xLog.err (err.message);
  });
});

var io = require ('socket.io') (server);

io.on ('connection', function (socket) {
  xLog.verb ('open the connection on the chest server');

  /* Handle the new client connections. */
  socket.on ('register', function (data) {
    xLog.verb ('try to register a new client for ' + data);

    /* Only one client at a time can send a specific file. */
    if (socketList.hasOwnProperty (data)) {
      xLog.warn ('a socket is already open for ' + data);

      socket.emit ('registered', 'a socket is already open for ' + data);
      socket.disconnect ();
      return;
    }

    /* Prevent the client that is registered now. */
    socketList[data] = socket;
    socket.emit ('registered');
  });

  socket.on ('disconnect', function () {
    /* Keep sync the file map/socket with the current state.
     * FIXME: this code is not very efficient when many sockets are open.
     */
    Object.keys (socketList).some (function (item) {
      if (socketList[item] === socket) {
        xLog.verb ('delete socket for ' + item);
        delete socketList[item];
        return false;
      }

      return true;
    });
  });
});

server.listen (config.port);
