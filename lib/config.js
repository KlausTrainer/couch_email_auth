var rc = require('rc');

module.exports = function() {
  var defaultConfig = {
    host: '127.0.0.1',
    port: 1337,
    couchDbBaseUrl: 'http://admin:secret@localhost:5984',
    usersDb: process.env.NODE_ENV ? 'test_suite_users' : '_users',
    sessionTimeout: process.env.NODE_ENV ? 1 : 3600, // seconds
    smtp: {
      port: 25,
      host: 'localhost',
      ignoreTLS: false
    },
    email: {}
  };

  return rc('couch_email_auth', defaultConfig);
};
