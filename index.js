var vdomParser = require('vdom-parser');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');

var domParser = new DOMParser();

function parse(el) {
  var vdom;

  if (typeof el === 'string') {
    vdom = vdomParser(domParser.parseFromString(el, 'text/html').documentElement);
  } else {
    vdom = vdomParser(el);
  }

  return vdom;
}

module.exports = {
  parse: parse,
  diff: diff,
  patch: patch
};
