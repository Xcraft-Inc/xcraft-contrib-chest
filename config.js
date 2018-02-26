'use strict';

/**
 * Retrieve the inquirer definition for xcraft-core-etc
 */
module.exports = [
  {
    type: 'input',
    name: 'host',
    message: 'hostname or IP [client or server]:',
    default: 'wpkg.epsitec.ch',
  },
  {
    type: 'input',
    name: 'port',
    message: 'listening port [client or server]:',
    validate: function(value) {
      return /^[0-9]{1,}$/.test(value);
    },
    default: '443',
  },
  {
    type: 'input',
    name: 'pid',
    message: 'pid filename [server]:',
    default: './var/run/chestd.pid',
  },
  {
    type: 'input',
    name: 'log',
    message: 'log filename [server]:',
    default: './var/log/chestd.log',
  },
  {
    type: 'input',
    name: 'repository',
    message: 'path to the repository [server]:',
    default: './var/chest/',
  },
];
