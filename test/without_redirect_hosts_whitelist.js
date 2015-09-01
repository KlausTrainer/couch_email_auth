"use strict";

process.env.NODE_ENV = 'test';
// custom testconfig
process.argv = [
  'node', // will get stripped by rc
  '/Users/robert/couch_email_auth/test/config.js', // will get stripped by rc
  '--config',
  'test/fixtures/without_redirect_hosts_whitelist_rc'
];

// delete the cache in order to make sure that a new config is getting loaded
delete require.cache[require.resolve('../lib/server')];

var test = require('tape'),
    s = require('../lib/server'),
    request = require('request'),
    config = require('../lib/config')(),
    couchDbBaseUrl = config.couchDbBaseUrl,
    simplesmtp = require('simplesmtp');

var uri, server, smtp;

test('setup', function(t) {
  s.run(function(instance) {
    server = instance;
    uri = server.info.uri;

    // setup CouchDB with test config
    request({
      method: 'PUT',
      uri: couchDbBaseUrl + '/_config/couch_httpd_auth/authentication_db',
      body: '"' + config.usersDb + '"'
    }, function(err, response, body) {
      t.notOk(err, 'set CouchDB test configuration');
      smtp = simplesmtp.createServer({disableDNSValidation: true});
      smtp.listen(config.smtp.port, function(error) {
        t.notOk(error, 'start smtp server');
        t.end();
      });
    });
  });
});

test('POST /', function(t) {
  [
    '127.0.0.1:5984',
    'localhost',
    'replication.host'
  ].forEach(function(host) {
    t.test(host, function(t) {
      request({
        method: 'POST',
        uri: uri,
        json: true,
        body: {
          redirectUrl: 'http://' + host + '/',
          email: "rockoartischocko@example.com"
        }
      }, function(err, response, body) {
        t.equal(response.statusCode, 200);
        t.ok(body.ok);
        t.end();
      });
    });
  });
});

test('teardown', function(t) {
  server.stop();

  // reset CouchDB config
  request({
    method: 'PUT',
    uri: couchDbBaseUrl + '/_config/couch_httpd_auth/authentication_db',
    body: '"_users"'
  }, function(err, response, body) {
    t.notOk(err, 'reset CouchDB test configuration');
    smtp.end(function() {
      t.end();
    });
  });
});
