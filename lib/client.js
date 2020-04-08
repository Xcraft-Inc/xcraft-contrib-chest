'use strict';

var chestUpload = function (inputFile, server, port, resp, callback) {
  var fs = require('fs');
  var path = require('path');
  var request = require('request');
  var Progress = require('progress');
  var progressStream = require('progress-stream');

  var protocol = parseInt(port) === 443 ? 'https' : 'http';
  var length = fs.statSync(inputFile).size;
  var remoteUri = protocol + '://' + server + ':' + port;
  var options = {
    uri: remoteUri + '/upload',
    method: 'POST',
    strictSSL: false,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': length.toString(),
      'Transfer-Encoding': 'chunked',
      'Xcraft-Upload-Filename': path.basename(inputFile),
    },
  };

  var bar = new Progress('                  uploading [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 40,
    total: length,
    stream: process.stdout,
  });
  var progressSpeed = 0;

  /* FIXME: it should be a socket.io-client option. */
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  var socket = require('socket.io-client')(remoteUri, {
    reconnection: false,
    multiplex: false,
  });

  socket.on('connect', function () {
    resp.log.verb('connected to the chest server');

    /* We inform the server that we will upload something. */
    socket.emit('register', path.basename(inputFile));

    socket.on('disconnect', function () {
      if (!bar.complete) {
        bar.terminate();
      }
      resp.log.verb('disconnected from the chest server');

      callback();
    });

    /* It is the server acknowledge. */
    socket.on('registered', function (error) {
      /* It happens when a file with the same name is already uploaded by
       * someone else.
       */
      if (error) {
        callback(error);
        return;
      }

      resp.log.info('begin file upload');

      var progressCalc = progressStream({length: length});

      progressCalc.on('progress', function (progress) {
        progressSpeed = (progressSpeed + progress.speed) / 2;
        bar.tick(progress.delta);
      });

      var stream = fs.createReadStream(inputFile);

      var reqFile = request(options, function (error, response, body) {
        if (error) {
          callback('problem with request: ' + error);
        }

        if (body) {
          resp.log.verb(body);
        }
      });

      stream.on('end', function () {
        resp.log.info(
          'transfer average speed: %d [Mbps]',
          parseInt((progressSpeed * 8) / 1000) / 1000
        );
        resp.log.info(
          'the uploaded file is synchronizing in the repository...'
        );
      });

      /* Send the file to the server. */
      stream.pipe(progressCalc).pipe(reqFile);
    });
  });

  socket.on('connect_error', function (error) {
    callback(error);
  });
};

exports.upload = function (file, chestConfig, resp, callback) {
  try {
    chestUpload(file, chestConfig.host, chestConfig.port, resp, callback);
  } catch (err) {
    callback(err.message);
  }
};
