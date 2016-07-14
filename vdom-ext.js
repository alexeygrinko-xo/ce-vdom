var isVNode = require('virtual-dom/vnode/is-vnode');
var isVText = require('virtual-dom/vnode/is-vtext');
var h = require('virtual-dom/h');
var urlParser = require('url');

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

function patchIndices(patches) {
  var indices = [];

  for (var key in patches) {
    if (key !== "a") {
      indices.push(Number(key));
    }
  }

  return indices;
}

function notExpectedProtocol(src) {
  return STARTS_WITH_PROTOCOL.test(src) && !EXPECTED_PROTOCOL.test(src);
}

function changePatch(patches) {
  var patchTypes = require('vdom-serialized-patch/lib/patchTypes');

  for (var i = 0; i < patches.length; i++) {
    var vpatch = patches[i];
    var type = vpatch[0];
    var node;

    switch(type) {
      case patchTypes.PROPS:
        node = vpatch[2];
        break;
      default:
        node = vpatch[1];
        break;
    }

    if (node && typeof node.p != 'undefined') {
      var actualSrc = node.p.src || '';
      if (notExpectedProtocol(actualSrc)) {
        node.p.src = TRANSPARENT_GIF_DATA;
      }
    }
  }
}

function expandUrl(pageUrl, url) {
  return urlParser.resolve(pageUrl, url);
}

function removeOneSlash(url) {
  return url.replace(/(https?):\/\//, '$1:/');
}

function addProxyUrl(proxyUrl, pageUrl, url) {
  var expandedURL = expandUrl(pageUrl, url);

  return proxyUrl + removeOneSlash(expandedURL);
}

var PROTOCOL_RELATIVE_URL = /^\/\//;
var ABSOLUTE_URL = /^https?:\/\//;
var STARTS_WITH_PROTOCOL = /^[^:]+(?=:\/\/)/i;
var EXPECTED_PROTOCOL = /^(https?|data):\/\//i;
var TRANSPARENT_GIF_DATA = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP';

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

/**
 * Change src from all node with a src with an unexpected protocol
 *
 * @param {VNode}
 * @param {String} - proxy URL
 * @param {String} - original page URL
 * @return {VNode}
 */
function vNodeCleanupUrls(root, proxyUrl, pageUrl) {
  var nodes = [root];
  var properties = ['src', 'href'];

  while(current = nodes.shift()) {
    if (isVNode(current)) {
      for(var i = 0; i < properties.length; i++) {
        var prop = properties[i];
        var propValue = current.properties[prop] || '';

        if (notExpectedProtocol(propValue)) {
          current.properties[prop] = TRANSPARENT_GIF_DATA;
        } else if (propValue != '') {
          var proxySrc = addProxyUrl(proxyUrl, pageUrl, propValue);
          current.properties[prop] = proxySrc;
        }
      }
    }

    merge(nodes, current.children);
  }

  return root;
}

/**
 * Change src from all patches with a src with an unexpected protocol
 *
 * @param {SerializedPatch}
 * @return {SerializedPatch}
 */
function patchSrcCleanup(patches) {
  var indices = patchIndices(patches);
  for (var i = 0; i < indices.length; i++) {
    var nodeIndex = indices[i],
        patchesByIndex = patches[nodeIndex];

    changePatch(patchesByIndex);
  }

  return patches;
}

module.exports = {
  findBaseNode: findBaseNode,
  appendBaseElement: appendBaseElement,
  vNodeCleanupUrls: vNodeCleanupUrls,
  patchSrcCleanup: patchSrcCleanup
};
