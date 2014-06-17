var http = require('http'),
  qs = require('querystring');

exports.run = function(callback, port, host) {
  var server = http.createServer(function(req, resp) {

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

        if (!(typeof email === 'string')) { // TODO match email regex
          resp.statusCode = 400;
          resp.end('{"error":"invalid email"}');
          return;
        }

        resp.end('{"ok":true}');
      });
    }
  });

  server.listen(port !== undefined ? port : (process.env['COUCH_EMAIL_AUTH_PORT'] || 1337), host !== undefined ? host : '127.0.0.1', callback !== undefined ? function() { callback(server); } : function() {});

  return server;
}
