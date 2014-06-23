"use strict";

var test = require('tape'),
    s = require('../lib/server'),
    testRequest = require('./test_helper').testRequest;

var address = '127.0.0.1', port = 0, server;

test('setup', function(t) {
  s.run({
    port: port,
    host: address
  }, function(instance) {
    server = instance;
    address = server.address().address;
    port = server.address().port;
    t.end();
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

  t.end();
});

test('teardown', function(t) {
  server.close();
  t.end();
});
