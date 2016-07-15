var vdomParser = require('vdom-parser');
var vdomDiff = require('virtual-dom/diff');
var vdomCreate = require('virtual-dom/create-element');
var serialize = require('vdom-serialized-patch/serialize');
var vdomPatch = require('vdom-serialized-patch/patch');
var appendBaseElement = require('./vdom-ext').appendBaseElement;
var vNodeCleanupUrls = require('./vdom-ext').vNodeCleanupUrls;
var patchCleanupUrls = require('./vdom-ext').patchCleanupUrls;

// Polyfill DOMParser for webkit support (phantomjs)
// https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#DOMParser_HTML_extension_for_other_browsers
(function(DOMParser) {
  "use strict";

  var proto = DOMParser.prototype,
      nativeParse = proto.parseFromString;

  // Firefox/Opera/IE throw errors on unsupported types
  try {
    // WebKit returns null on unsupported types
    if ((new DOMParser()).parseFromString("", "text/html")) {
      // text/html parsing is natively supported
      return;
    }
  } catch (ex) {}

  proto.parseFromString = function(markup, type) {
    if (/^\s*text\/html\s*(?:;|$)/i.test(type)) {
      var doc = document.implementation.createHTMLDocument("");

      if (markup.toLowerCase().indexOf('<!doctype') > -1) {
        doc.documentElement.innerHTML = markup;
      }
      else {
        doc.body.innerHTML = markup;
      }

      return doc;
    } else {
      return nativeParse.apply(this, arguments);
    }
  };
}(DOMParser));

var domParser = new DOMParser();

/**
 * Parse a HTML string or HTMLElement into a VTree
 *
 * @param {string|HTMLElement} - element to parse
 * @param {Object} - options (egg: { censor: ['input'] })
 * @returns {VTree} virtual tree representation
 */
function parse(el, options) {
  var vdom;

  if (typeof el === 'string') {
    // vdom-serialized-patch/serialize doesn't handle pages with more than one
    // element on the body. This is a workaround.
    vdom = vdomParser(domParser.parseFromString(el, 'text/html').body, options);
  } else {
    vdom = vdomParser(el, options);
  }

  return vdom;
}

/**
 * Diff two VDOM elements
 *
 * @param {string} before - Before state
 * @param {string} after - After state
 * @return {object} CE flavored virtual-dom/diff
 */
function diff(before, after) {
  var d = serialize(vdomDiff(before, after));

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
  var vtree = parse(originalDOM);
  patches.a = serialize(vdomDiff(vtree,vtree)).a;

  vdomPatch(rootNode, patches, options);
}

module.exports = {
  parse: parse,
  diff: diff,
  patch: patch,
  createElement: vdomCreate,
  appendBaseElement: appendBaseElement,
  vNodeCleanupUrls: vNodeCleanupUrls,
  patchCleanupUrls: patchCleanupUrls
};
