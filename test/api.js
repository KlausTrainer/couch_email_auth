"use strict";

process.env.NODE_ENV = 'test';

var test = require('tape'),
    s = require('../lib/server'),
    request = require('request'),
    testRequest = require('./test_helper').testRequest,
    couchDbBaseUrl = 'http://admin:secret@localhost:5984',
    config = require('../lib/config'),
    db = require('nano')(couchDbBaseUrl + '/' + config.usersDb);

var address = '127.0.0.1', port = 0, server;

test('setup', function(t) {
  s.run({
    port: port,
    host: address
  }, function(instance) {
    server = instance;
    address = server.address().address;
    port = server.address().port;

    // setup CouchDB with test config
    request({
      method: 'PUT',
      uri: couchDbBaseUrl + '/_config/couch_httpd_auth/authentication_db',
      body: '"' + config.usersDb + '"'
    }, function(err, response, body) {
      t.notOk(err, 'set CouchDB test configuation');
      t.end();
    });
  });
});

test('POST /', function(t) {
  var context = {address: address, port: port, t: t};

  testRequest(
    context, 'POST to / fails with empty body',
    'POST', null,
    400, '{"error":"invalid request JSON"}');

  testRequest(
    context, 'POST to / fails with no email property',
    'POST', '{"foo":42}',
    400, '{"error":"invalid email"}');

  testRequest(
    context, 'POST to / fails with wrong email address',
    'POST', '{"email":42}',
    400, '{"error":"invalid email"}');

  testRequest(
    context, 'POST to / fails with wrong email address',
    'POST', '{"email":"foo@bar"}',
    400, '{"error":"invalid email"}');

  testRequest(
    context, 'POST to / works with valid email address',
    'POST', '{"email":"foobator@example.com"}',
    200, '{"ok":true}');

  t.test('saves login credentials to CouchDB', function(t) {
    db.get('org.couchdb.user:foobator@example.com', function(err, doc) {
      t.notOk(err, 'document missing');
      t.equal(doc.name, 'foobator@example.com');
      t.equal(typeof doc.timestamp, 'number');
      t.end();
    });
  });

  t.end();
});

test('teardown', function(t) {
  server.close();

  // reset CouchDB config
  request({
    method: 'PUT',
    uri: couchDbBaseUrl + '/_config/couch_httpd_auth/authentication_db',
    body: '"_users"'
  }, function(err, response, body) {
    t.notOk(err, 'reset CouchDB test configuation');
    t.end();
  });
});
