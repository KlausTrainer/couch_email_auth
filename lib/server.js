"use strict";

var http = require('http'),
    qs = require('querystring');

exports.run = function(options, cb) {
  options = options !== undefined ? options : {};
  var port = options.port !== undefined ? options.port : (process.env['COUCH_EMAIL_AUTH_PORT'] || 1337),
      host = options.host !== undefined ? options.host : '127.0.0.1',
      callback = cb !== undefined ? function() { cb(server); } : function() {};

  var server = http.createServer(function(req, resp) {
    var EMAIL_REGEX = /.+@.+\..+/;

    if (req.method == 'POST') {
      var body = '';

      req.on('data', function(data) {
        body += data;
      });

      req.on('end', function() {
        var query = qs.parse(req.url),
            email;

        try {
          email = JSON.parse(body).email;
        } catch(e) {
          resp.statusCode = 400;
          resp.end('{"error":"invalid request JSON"}');
          return;
        }

        if (!(typeof email === 'string' && email.match(EMAIL_REGEX) !== null)) {
          resp.statusCode = 400;
          resp.end('{"error":"invalid email"}');
          return;
        }

        resp.end('{"ok":true}');
      });
    }
  });

  server.listen(port, host, callback);

  return server;
}
