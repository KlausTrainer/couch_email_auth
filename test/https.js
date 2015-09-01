"use strict";

process.env.NODE_ENV = 'test';
// custom testconfig
process.argv = [
  'node', // will get stripped by rc
  '/Users/robert/couch_email_auth/test/config.js', // will get stripped by rc
  '--config',
  'test/fixtures/schemetesthttpsrc'
];

// delete the cache in order to make sure that a new config is getting loaded
delete require.cache[require.resolve('../lib/server')];

var test = require('tape'),
    s = require('../lib/server'),
    request = require('request'),
    config = require('../lib/config')(),
    couchDbBaseUrl = config.couchDbBaseUrl,
    redirectLocation = couchDbBaseUrl + '/',
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
  var emailBody,
      expectedToEmail = 'foobator42@localhost',
      expectedFromEmail = 'couch_email_auth@example.com',
      expectedSubject = 'Sign In',
      actualFromEmail,
      actualToEmail,
      context = {uri: uri, t: t};

  t.test('setup', function(t) {
    smtp.on('startData', function(connection) {
      emailBody = '';
      actualFromEmail = connection.from;
      actualToEmail = connection.to[0];
    });

    smtp.on('data', function(connection, chunk) {
      emailBody += chunk.toString();
    });

    smtp.on('dataReady', function(connection, callback) {
      callback(null, 'ABC1' + Math.abs(Math.random() * 1000000)); // ABC1 is the queue id to be advertised to the client
    });

    t.end();
  });

  t.test('it is possible to change the uri schemename', function(t) {
    request({
      method: 'POST',
      uri: uri,
      json: true,
      body: {
        redirectLocation: redirectLocation,
        email: expectedToEmail,
        username: 'Local Foo Bator'
      }
    }, function(err, response, body) {
      t.equal(response.statusCode, 200);
      t.ok(body.ok);
      t.equal(actualFromEmail, expectedFromEmail);
      t.equal(actualToEmail, expectedToEmail);
      t.ok(emailBody.indexOf('Subject: ' + config.email.subject) !== -1, 'Subject');
      t.ok(emailBody.indexOf('Hi Local Foo Bator') !== -1, 'mailbody');
      t.ok(emailBody.indexOf('https:\/\/') !== -1, 'https scheme is used');
      t.ok(emailBody.indexOf('?email') !== -1, 'url is ok');
      t.end();
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
