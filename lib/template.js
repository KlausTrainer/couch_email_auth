var Mustache = require('mustache'),
    config = require('./config')(),
    fs = require('fs'),
    template;

template = fs.readFileSync(config.email.template, 'utf8');

module.exports = function(vars) {
  return Mustache.render(template, vars);
};
