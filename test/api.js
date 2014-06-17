var test = require('tape'),
  request = require('request'),
  s = require('../lib/server');

var address, port, server;

test('setup', function(t) {
  s.run(function(instance) {
    server = instance;
    address = server.address().address;
    port = server.address().port;
    t.end();
  }, 0, '127.0.0.1');
});

test('POST /', function(t) {
  t.test('POST /', function(t) {
    request({
      method: 'POST',
      uri: 'http://' + address + ':' + port
    }, function(err, res, body) {
      t.equal(res.statusCode, 400);
      t.end();
    });
  });

  t.test('POST /', function(t) {
    request({
      method: 'POST',
      uri: 'http://' + address + ':' + port,
      body: '{"foo": 42}'
    }, function(err, res, body) {
      t.equal(res.statusCode, 400);
      t.end();
    });
  });

  t.test('POST /', function(t) {
    request({
      method: 'POST',
      uri: 'http://' + address + ':' + port,
      body: '{"email":42}'
    }, function(err, res, body) {
      t.equal(res.statusCode, 400);
      t.end();
    });
  });

  t.test('POST /', function(t) {
    request({
      method: 'POST',
      uri: 'http://' + address + ':' + port,
      body: '{"email":"foobator@example.com"}'
    }, function(err, res, body) {
      t.equal(res.statusCode, 200);
      t.equal(body, '{"ok":true}');
      t.end();
    });
  });

  t.end();
});

test('teardown', function(t) {
  server.close();
  t.end();
});
