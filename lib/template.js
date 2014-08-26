var Mustache = require('mustache'),
    config = require('./config')(),
    fs = require('fs');

module.exports = function(vars, cb) {
  fs.readFile(config.email.template, 'utf8', function(err, data) {
    var result;
    if (err) {
      cb(err);
    }
    result = Mustache.render(data, vars);
    cb(err, result);
  });
};
