var rc = require('rc');

module.exports = function() {
  var defaultConfig = {
    host: '127.0.0.1',
    port: 3000,
    scheme: 'http',
    couchDbBaseUrl: 'http://admin:secret@localhost:5984',
    usersDb: '_users',
    tokenExpiryTime: 3600, // seconds
    tokenSize: 16, // bytes
    smtp: {
      port: 25,
      host: 'localhost',
      ignoreTLS: false
    },
    email: {
      template: 'default_mail_template'
    }
  };

  var config = rc('couch_email_auth', defaultConfig);

  if (typeof config.allowedRedirectHosts === 'string' &&
      config.allowedRedirectHosts.trim() !== '') {
    config.allowedRedirectHosts = config.allowedRedirectHosts.split(',').map(
      function(host) {
        return host.trim();
      }
    );
  } else {
    config.allowedRedirectHosts = [];
  }

  return config;
};
