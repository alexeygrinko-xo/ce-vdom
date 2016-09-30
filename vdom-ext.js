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
  var current;

  while(current = nodes.shift()) {
    if (isVNode(current)) {
      if (current.tagName === tagName) {
        return current;
      }

      merge(nodes, current.children);
    }
  }
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

function processNodeProperties(nodeProperties, options) {
  var urlProperties = ['src', 'href'];

  urlProperties.forEach(function(property) {
    var propValue = nodeProperties[property];

    if (!propValue) {
      return;
    }

    if (notExpectedProtocol(propValue)) {
      nodeProperties[property] = TRANSPARENT_GIF_DATA;
    } else {
      nodeProperties[property] = addProxyUrl(options.proxyUrl, options.baseUrl, propValue);;
    }
  });
}

function processNode(node, options) {
  if (node && typeof node === 'object' && node !== null) {
    if (node.c) {
      for (var i = 0; i < node.c.length; i++) {
        processNode(node.c[i], options);
      }
    }
    if (node.p) {
      processNodeProperties(node.p, options);
    }
  }
}

function changePatch(patches, options) {
  for (var i = 0; i < patches.length; i++) {
    var vpatch = patches[i];

    if (vpatch[0] === 4 /*properties*/) {
      processNode({ p: vpatch[1] }, options);
    } else {
      processNode(vpatch[1], options);
    }

    processNode(vpatch[2], options);
  }
}

function expandUrl(pageUrl, url) {
  return urlParser.resolve(pageUrl, url);
}

function removeOneSlash(url) {
  return url.replace(/(https?):\/\//i, '$1:/');
}

function addProxyUrl(proxyUrl, pageUrl, url) {
  var expandedURL = expandUrl(pageUrl, url);

  return proxyUrl + removeOneSlash(expandedURL).replace(/\?/, '%3F');
}

var PROTOCOL_RELATIVE_URL = /^\/\//;
var ABSOLUTE_URL = /^https?:\/\//;
var STARTS_WITH_PROTOCOL = /^[^:]+(?=:\/\/)/i;
var EXPECTED_PROTOCOL = /^(https?|data):\/\//i;
var TRANSPARENT_GIF_DATA = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP';

/**
 * Get base URL for all resources on the page concerning BASE element if it persists.
 * If there's no BASE element, return host URL without changes;
 * if BASE element's URL is absolute, use it instead of host;
 * if it's relative, make it absolute by concatenating with host URL.
 * @param {VNode} root - root node
 * @param {String} host - base's href URL to append
 * @returns {String}
 */
function getBaseUrl(root, host) {
  var base = findNodeOfType(root, 'BASE');
  var baseUrl = host;

  if (base) {
    baseUrl = base.properties.href || base.properties.attributes && base.properties.attributes.href || '';

    if (!PROTOCOL_RELATIVE_URL.test(baseUrl.toLowerCase()) && !ABSOLUTE_URL.test(baseUrl.toLowerCase())) {

      if (/\/$/.test(host) && /^\//.test(baseUrl)) {
        // remove extra slash if host ends with one and baseUrl starts with one
        baseUrl = baseUrl.slice(1);
      }

      baseUrl = host + baseUrl;
    }
  }

  return baseUrl;
}

/**
 * Change src from all node with a src with an unexpected protocol
 *
 * @param {VNode}
 * @param {String} - proxy URL
 * @param {String} - base URL
 * @return {VNode}
 */
function vNodeCleanupUrls(root, proxyUrl, baseUrl) {
  var nodes = [root];
  var current;

  while(current = nodes.shift()) {
    if (isVNode(current)) {
      processNodeProperties(current.properties, { proxyUrl: proxyUrl, baseUrl: baseUrl });
    }

    merge(nodes, current.children);
  }

  return root;
}

/**
 * Change src from all patches with a src with an unexpected protocol
 *
 * @param {SerializedPatch}
 * @param {String} - proxy URL
 * @param {String} - base URL
 * @return {SerializedPatch}
 */
function patchCleanupUrls(patches, proxyUrl, baseUrl) {
  patchIndices(patches).forEach(function(index) {
    changePatch(patches[index], { proxyUrl: proxyUrl, baseUrl: baseUrl });
  });

  return patches;
}

/**
 * Get unique index of node in virtual tree (used in diffs&patches).
 * Example of nodes indexing:
 *
 *                      Root (0)
 *  Head (1)             TextNode (13)          Body (14)
 *  HeadNodes (2-12)                        Div (15)            AnotherDiv (21)
 *                                          DivNodes (16-20)    ...
 *
 * Thus, to get index of a node we have to traverse the tree using depth-first search,
 * incrementing index (initialized with 0) with each visited node.
 *
 * @param {VNode} tree - root node of the virtual tree
 * @param {VNode} node
 * @returns {number}
 */
function getNodeIndex(tree, node) {
    var index = 0;
    var match = false;

    tree = tree instanceof Array ? tree : [tree];

    (function recurse(tree) {
      for (var i = 0; i < tree.length && !match; i++, index++) {
        if (tree[i] == node) {
          match = true;
          return;
        }

        if (tree[i].children) {
          recurse(tree[i].children);
        }
      }
    })(tree);

    return match ? index : -1;
}

module.exports = {
  getBaseUrl: getBaseUrl,
  vNodeCleanupUrls: vNodeCleanupUrls,
  patchCleanupUrls: patchCleanupUrls,
  findNodeOfType: findNodeOfType,
  getNodeIndex: getNodeIndex
};
