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

function processNodeProperties(nodeProperties, options) {
  var urlProperties = ['src', 'href'];

  urlProperties.forEach(function(property) {
    var propValue = nodeProperties[property];

    if (!propValue) {
      return;
    }

    if (notExpectedProtocol(propValue)) {
      nodeProperties[property] = TRANSPARENT_GIF_DATA;
    } else if (options.replaceAll) {
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

  return proxyUrl + removeOneSlash(expandedURL);
}

function findUrlsAndAddProxyUrl(proxyUrl, pageUrl, value) {
  return value.replace(/url\((\"|\')(.*?)(\"|\')\)/ig, function(match, p1, p2, p3) {
    return "url(" + p1 + addProxyUrl(proxyUrl, pageUrl, p2) + p3 + ")";
  });
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
 * @param {String} - base URL
 * @return {VNode}
 */
function vNodeCleanupUrls(replaceAll, root, proxyUrl, baseUrl) {
  var nodes = [root];
  var urlProperties = ['src', 'href'];
  var cssProperties = ['style'];

  while(current = nodes.shift()) {
    if (isVNode(current)) {
      for(var i = 0; i < urlProperties.length; i++) {
        var prop = urlProperties[i];
        var propValue = current.properties[prop] || '';

        if (notExpectedProtocol(propValue)) {
          current.properties[prop] = TRANSPARENT_GIF_DATA;
        } else if (propValue != '' && replaceAll) {
          var proxyUrl = addProxyUrl(proxyUrl, baseUrl, propValue);
          current.properties[prop] = proxyUrl;
        }
      }
      for(var i = 0; i < cssProperties.length; i++) {
        var prop = cssProperties[i];
        var propValue = current.properties[prop] || '';

        if (propValue != '' && replaceAll) {
          var value = findUrlsAndAddProxyUrl(proxyUrl, baseUrl, propValue);
          current.properties[prop] = value;
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
 * @param {Boolean} - TRUE to modify "src" and "href" attributes
 * @param {SerializedPatch}
 * @param {String} - proxy URL
 * @param {String} - base URL
 * @return {SerializedPatch}
 */
function patchCleanupUrls(replaceAll, patches, proxyUrl, baseUrl) {
  patchIndices(patches).forEach(function(index) {
    changePatch(patches[index], { proxyUrl: proxyUrl, baseUrl: baseUrl, replaceAll: replaceAll });
  });

  return patches;
}

module.exports = {
  findBaseNode: findBaseNode,
  appendBaseElement: appendBaseElement,
  vNodeCleanupUrls: vNodeCleanupUrls,
  patchCleanupUrls: patchCleanupUrls
};
