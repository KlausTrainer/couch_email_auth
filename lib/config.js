var env = process.env;

module.exports = {
  host: env.COUCH_EMAIL_AUTH_HOST || '127.0.0.1',
  port: env.NODE_ENV === 'test' ? 0 : (env.COUCH_EMAIL_AUTH_PORT || 1337),
  couchDbBaseUrl: env.COUCHDB_BASE_URL || 'http://admin:secret@localhost:5984',
  usersDb: env.NODE_ENV === 'test' ? 'test_suite_users' : '_users',
  mailer: {
    port: env.NODE_ENV === 'test' ? 2525 : (env.COUCH_EMAIL_AUTH_SMTP_PORT || 25),
    host: 'localhost',
    ignoreTLS: true
  }
};
