"use strict";

process.env.NODE_ENV = 'test';
// custom testconfig
process.argv = [
  'node', // will get stripped by rc
  '/Users/robert/couch_email_auth/test/config.js', // will get stripped by rc
  '--config',
  'test/fixtures/integrationtestrc'
];

var test = require('tape'),
    s = require('../lib/server'),
    request = require('request'),
    testRequest = require('./test_helper').testRequest,
    config = require('../lib/config')(),
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
      smtp.listen(config.smtp.port, function(error) {
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
        expectedSubject = 'Sign In',
        actualFromEmail,
        actualToEmail,
        actualSubject,
        requestUri = 'http://' + address + ':' + port;

    smtp.on("startData", function(connection) {
      actualFromEmail = connection.from;
      actualToEmail = connection.to[0];
      actualSubject = connection.subject;
    });

    smtp.on("data", function(connection, chunk) {
      emailBody += chunk.toString();
    });

    smtp.on("dataReady", function(connection, callback) {
      callback(null, "ABC1" + Math.abs(Math.random() * 1000000)); // ABC1 is the queue id to be advertised to the client
    });

    request({
      method: 'POST',
      uri: requestUri,
      json: true,
      body: {
        email: expectedToEmail,
        username: "Foobatoruser"
      }
    }, function(err, response, body) {
      t.equal(response.statusCode, 200);
      t.ok(body.ok);
      t.equal(actualFromEmail, expectedFromEmail);
      t.equal(actualToEmail, expectedToEmail);
      t.ok(emailBody.indexOf('Hi Foobatoruser - ' + requestUri) !== -1, 'mailbody');
      t.end();
    });
  });

  t.test('saves login credentials to CouchDB', function(t) {
    request({
      method: 'POST',
      uri: 'http://' + address + ':' + port,
      body: '{"email":"foobator@example.com"}'
    }, function(err, response, body) {
      db.get('org.couchdb.user:foobator@example.com', function(err, doc) {
        t.notOk(err, 'document missing');
        t.equal(doc.name, 'foobator@example.com');
        t.equal(typeof doc.timestamp, 'number');
        t.end();
      });
    });
  });

  t.test('using names is possible', function(t) {
    request({
      method: 'POST',
      uri: 'http://' + address + ':' + port,
      json: true,
      body: {
        email: "rockoartischocko@example.com",
        username: "Rocko Artischocko"
      }
    }, function(err, response, body) {
      db.get('org.couchdb.user:rockoartischocko@example.com', function(err, doc) {
        t.notOk(err, 'document missing');
        t.equal(doc.username, 'Rocko Artischocko');
        t.equal(doc.name, 'rockoartischocko@example.com');
        t.equal(typeof doc.timestamp, 'number');
        t.end();
      });
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
