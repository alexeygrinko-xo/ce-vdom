var isVNode = require('virtual-dom/vnode/is-vnode');
var isVText = require('virtual-dom/vnode/is-vtext');
var h = require('virtual-dom/h');

/**
 * vdom extensions
 */

function merge(target, other) {
  if (other && other.length) {
    Array.prototype.push.apply(target, other);
  }
}

function findNodeOfType(root, tagName) {
  var nodes = [root];

  while(current = nodes.shift()) {
    if (isVNode(current)) {
      if (current.tagName === tagName) {
        return current;
      }

      merge(nodes, current.children);
    }
  }
}

function findBaseNode(root) {
  return findNodeOfType(root, 'BASE');
}

var PROTOCOL_RELATIVE_URL = /^\/\//;
var ABSOLUTE_URL = /^https?:\/\//;

/**
 * Insert a <base> node to a vdom tree
 *
 * @param {VNode} - root node
 * @param {String} - base's href URL to append
 * @return {VNode}
 */
function appendBaseElement(root, href) {
  var base = findBaseNode(root),
      head;

  if (!base) {
    // append <base> element
    head = findNodeOfType(root, 'HEAD');

    if (head) {
      // FIXME: Use vdom/vnode function or hyperscript to generate node
      head.children.unshift(h('base', { attributes: { href: href } }));
    } else {
      // FIXME: Need to add base tag at the top of the document
    }
  } else {
    // modify <base> element
    base.properties.attributes = base.properties.attributes || {};

    var actualHref = base.properties.href || base.properties.attributes.href || '';

    if (!(PROTOCOL_RELATIVE_URL.test(actualHref.toLowerCase()) || ABSOLUTE_URL.test(actualHref.toLowerCase()))) {

      if (/\/$/.test(href) && /^\//.test(actualHref)) {
        // fix slashes
        actualHref = actualHref.slice(1);
      }

      base.properties.attributes.href = href + actualHref;
      delete base.properties.href;
    }
  }

  return root;
}

module.exports = {
  findBaseNode: findBaseNode,
  appendBaseElement: appendBaseElement
};
