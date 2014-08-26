var rc = require('rc');

module.exports = function() {
  var conf = rc('couch_email_auth', {
    host: '127.0.0.1',
    port: 1337,
    couchDbBaseUrl: 'http://admin:secret@localhost:5984',
    usersDb: '_users',
    smtp: {
      port: 25,
      host: 'localhost',
      ignoreTLS: false
    },
    email: {}
  });

  return conf;
};
