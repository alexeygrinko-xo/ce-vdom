var isVNode = require('virtual-dom/vnode/is-vnode');
//var isVText = require('virtual-dom/vnode/is-vtext');
var h = require('virtual-dom/h');
var urlParser = require('url');

var CSS_URL_MATCHER = /url\(\s*[\'\"]?(.+?)[\'\"]?\s*\)/g; // e.g. "url(  /img/1.jpg  )"

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
  var indices = [],
      index;

  for (var key in patches) {
    index = + key;
    if (index || index === 0) {
      indices.push(index);
    }
  }

  return indices;
}

function notExpectedProtocol(src) {
  return STARTS_WITH_PROTOCOL.test(src) && !EXPECTED_PROTOCOL.test(src);
}

/**
 * Prefix all URLs used in "url()" statements in text node with proxy
 * @param {VText|Object} textNode - either VText node with 'text' property, or VText patch with 'x' property
 * @param {Object} options - {proxyUrl: string, baseUrl: string}
 */
function processInlineCSS(textNode, options) {
  var textProp = textNode.x ? "x" : "text";
  textNode[textProp] = textNode[textProp].replace(CSS_URL_MATCHER, function(match, url) {
    var prefixedUrl = addProxyUrl(options.proxyUrl, options.baseUrl, url);
    return "url('" + prefixedUrl + "')";
  });
}

/**
 * Prefix all URLs used in "src" or "href" attributes with proxy
 * @param {Object} nodeProperties
 * @param {Object} options - {proxyUrl: string, baseUrl: string}
 */
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
      nodeProperties[property] = addProxyUrl(options.proxyUrl, options.baseUrl, propValue);
    }
  });
}

function processNode(node, options) {
  if (node !== null && typeof node === 'object') {
    if (node.c) {
      for (var i = 0; i < node.c.length; i++) {
        processNode(node.c[i], {
          proxyUrl: options.proxyUrl,
          baseUrl: options.baseUrl,
          parent: node,
          vdom: options.vdom,
          index: options.index + 1 + i // children indices start from parent's index + 1, and then increment in cycle
        });
      }
    }

    if (node.p) {
      processNodeProperties(node.p, options);
    }

    if (node.x && options.vdom) { // if it is a text node
      // when an existing text node is changing, we should find it in VDOM and check if it is in STYLE element
      var parentIndex = options.index - 1; // text node is only one children of its parent, so its index is by 1 more than parent's index
      var parent = getNodeByIndex(options.vdom, parentIndex);

      // when a new element is being inserted, we cannot find in in existing DOM; we should check its tag name (tn) in patch's parent node
      if (parent && parent.tagName === "STYLE" || options.parent && options.parent.tn === "STYLE") {
        processInlineCSS(node, options);
      }
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

      if (current.tagName === "STYLE") {
        processInlineCSS(current.children[0], { proxyUrl: proxyUrl, baseUrl: baseUrl });
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
 * @param {String} - proxy URL
 * @param {String} - base URL
 * @return {SerializedPatch}
 */
function patchCleanupUrls(patches, proxyUrl, baseUrl) {
  patchIndices(patches).forEach(function(index) {
    changePatch(patches[index], {
      proxyUrl: proxyUrl,
      baseUrl: baseUrl,
      vdom: patches.a,
      index: index
    });
  });

  return patches;
}

/**
 * Get unique index of node in virtual tree
 * @param {VNode} tree - root node of the virtual tree
 * @param {VNode} node
 * @returns {number}
 */
function getNodeIndex(tree, node) {
  var index = -1;

  depthFirstSearch(tree, function(n, i) {
    if (n === node) {
      index = i;
      return false;
    }
  });

  return index;
}

/**
 * Get VNode from the tree by given index
 * @param {VNode} tree
 * @param {number} index
 * @returns {VNode}
 */
function getNodeByIndex(tree, index) {
  var node = null;

  depthFirstSearch(tree, function(n, i) {
    if (i === index) {
      node = n;
      return false;
    }
  });

  return node;
}

/**
 * Walk through the tree using DFS algorithm and invoking delegate on each iteration.
 * Example of nodes indexing:
 *
 *                      Root (0)
 *  Head (1)             TextNode (13)          Body (14)
 *  HeadNodes (2-12)                        Div (15)            AnotherDiv (21)
 *                                          DivNodes (16-20)    ...
 *
 * @param {VNode|Array<VNode>} tree
 * @param {(node: VNode, index: number) => boolean)} delegate - should return `false` to interrupt algorithm
 * @returns {boolean} - returns false to interrupt recursion
 */
function depthFirstSearch(tree, delegate, index) {
  index = index || {value: 0}; // we use object instead of simple number to mutate it throughout the recursion
  tree = tree instanceof Array ? tree : [tree];

  for (var i = 0; i < tree.length; i++) {
    if (delegate(tree[i], index.value) === false) return false; // interrupt recursion

    index.value++;

    if (tree[i].children) {
      if (depthFirstSearch(tree[i].children, delegate, index) === false) return false; // progpagate interruption
    }
  }
}

module.exports = {
  getBaseUrl: getBaseUrl,
  vNodeCleanupUrls: vNodeCleanupUrls,
  patchCleanupUrls: patchCleanupUrls,
  processInlineCSS: processInlineCSS,
  findNodeOfType: findNodeOfType,
  getNodeIndex: getNodeIndex,
  getNodeByIndex: getNodeByIndex,
  depthFirstSearch: depthFirstSearch
};
