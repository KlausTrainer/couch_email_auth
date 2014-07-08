module.exports = {
  couchDbBaseUrl: process.env.COUCHDB_BASE_URL ? process.env.COUCHDB_BASE_URL : 'http://admin:secret@localhost:5984',
  usersDb: process.env.NODE_ENV === 'test' ? 'test_suite_users' : '_users'
}
