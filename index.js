var vdomParser = require('vdom-parser');
var diff = require('virtual-dom/diff');
var serialize = require('vdom-serialized-patch/serialize');
var patch = require('vdom-serialized-patch/patch');

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

function ourDiff(a, b) {
  return serialize(diff(a, b));
}

module.exports = {
  parse: parse,
  diff: ourDiff,
  patch: patch
};
