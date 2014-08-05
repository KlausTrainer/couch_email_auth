"use strict";

process.env.NODE_ENV = 'test';

var test = require('tape'),
    s = require('../lib/server'),
    request = require('request'),
    testRequest = require('./test_helper').testRequest,
    config = require('../lib/config'),
    couchDbBaseUrl = config.couchDbBaseUrl,
    db = require('nano')(couchDbBaseUrl + '/' + config.usersDb),
    simplesmtp = require("simplesmtp");

var address, port, server, smtp;

test('setup', function(t) {
  s.run(function(instance) {
    server = instance;
    address = server.address().address;
    port = server.address().port;

    // setup CouchDB with test config
    request({
      method: 'PUT',
      uri: couchDbBaseUrl + '/_config/couch_httpd_auth/authentication_db',
      body: '"' + config.usersDb + '"'
    }, function(err, response, body) {
      t.notOk(err, 'set CouchDB test configuration');
      smtp = simplesmtp.createServer({disableDNSValidation: true});
      smtp.listen(config.smtpPort, function(error) {
        t.notOk(error, 'start smtp server');
        t.end();
      });
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

  t.test('POST to / works with valid email address and an email is sent', function(t) {
    var emailBody = '',
        expectedToEmail = 'foobator42@example.com',
        expectedFromEmail = 'couch_email_auth@example.com',
        actualFromEmail, actualToEmail;

    smtp.on("startData", function(connection) {
      actualFromEmail = connection.from;
      actualToEmail = connection.to[0];
    });

    smtp.on("data", function(connection, chunk) {
      emailBody += chunk.toString();
    });

    smtp.on("dataReady", function(connection, callback) {
      callback(null, "ABC1" + Math.abs(Math.random() * 1000000)); // ABC1 is the queue id to be advertised to the client
    });

    request({
      method: 'POST',
      uri: 'http://' + address + ':' + port,
      body: '{"email":"' + expectedToEmail + '"}'
    }, function(err, response, body) {
      t.equal(response.statusCode, 200);
      t.equal(body, '{"ok":true}');
      t.equal(actualFromEmail, expectedFromEmail);
      t.equal(actualToEmail, expectedToEmail);
      t.ok(/https?:\/\/example\.com/.test(emailBody));
      t.end();
    });
  });

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
    t.notOk(err, 'reset CouchDB test configuration');
    smtp.end(function() {
      t.end();
    });
  });
});
