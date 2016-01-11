var vdomParser = require('vdom-parser');
var vdomDiff = require('virtual-dom/diff');
var serialize = require('vdom-serialized-patch/serialize');
var vdomPatch = require('vdom-serialized-patch/patch');

var domParser = new DOMParser();

/**
 * Parse a HTML string or HTMLElement into a VTree
 *
 * @param {string|HTMLElement} - element to parse
 * @returns {VTree} virtual tree representation
 */
function parse(el) {
  var vdom;

  if (typeof el === 'string') {
    // vdom-serialized-patch/serialize doesn't handle pages with more than one
    // element on the body. This is a workaround.
    vdom = vdomParser(domParser.parseFromString(el, 'text/html').body);
  } else {
    vdom = vdomParser(el);
  }

  return vdom;
}

/**
 * Diff two HTML strings
 *
 * @param {string} before - Before state
 * @param {string} after - After state
 * @return {object} CE flavored virtual-dom/diff
 */
function diff(before, after) {
  var beforeVTree = parse(before),
      afterVTree = parse(after),
      d;

  d = vdomDiff(beforeVTree, afterVTree);
  d = serialize(d);

  // we don't want to store the virtual-dom with the patch
  delete d.a;

  return d;
}

/**
 * Applies a diff on a real DOM
 *
 * @param {string} originalDOM - HTML string of the DOM to work with
 * @param {HTMLElement} rootNode - Where to apply the patch in the DOM
 * @param {object} patches - CE flavored virtual-dom/diff
 */
function patch(originalDOM, rootNode, patches, options) {
  // assume diff doesn't bring the `.a` virtual-dom instance
  patches.a = parse(originalDOM);

  vdomPatch(rootNode, patches, options);
}

module.exports = {
  parse: parse,
  diff: diff,
  patch: patch
};
