var assert = require('chai').assert;
var h = require('virtual-dom/h');

// Module under test (MUT)
var MUT = require('../vdom-ext');
var findBaseNode = MUT.findBaseNode;
var appendBaseElement = MUT.appendBaseElement;
var vNodeCleanupUrls = MUT.vNodeCleanupUrls;
var patchSrcCleanup = MUT.patchSrcCleanup;

function createBaseElement(href, asProperty) {
  var props = { };

  if (asProperty) {
    props.href = href;
  } else {
    props.attributes = { href: href };
  }

  return h('base', props, []);
}

function createTree(baseElement) {
  baseElement = baseElement || '';

  return h('html',[
    h('head', [
      baseElement,
      h('title', ['dummy page']),
      h('link')
    ]),
    h('body', [
      h('h1', ['Lorem ipsum'])
    ])
  ]);
}

function assertEqualVNode(a, b) {
  assert.equal(a.type, b.type, 'Same type');
  assert.equal(a.version, b.version, 'Same version');
  assert.equal(a.tagName, b.tagName, 'Same tag name');
  assert.deepEqual(a.properties, b.properties, 'Same properties');
  assert.deepEqual(a.children, b.children, 'Same children');
}

describe('vdom-ext', function() {
  describe('#findBaseNode()', function() {
    it('returns base node if exists', function() {
      var treeWithoutBaseElement = createTree();
      var relativeBaseElement = createBaseElement('/relative');
      var treeWithRelativeBaseElement = createTree(relativeBaseElement);

      assert.equal(relativeBaseElement, findBaseNode(treeWithRelativeBaseElement));
      assert.isNotOk(findBaseNode(treeWithoutBaseElement));
    });
  });

  describe('#appendBaseElement()', function() {
    it('appends base element', function() {
      var tree = createTree();
      var actual = appendBaseElement(createTree(), 'http://example.com');

      assertEqualVNode(createBaseElement('http://example.com'), findBaseNode(actual));
    });

    it('updates relative base element from attribute', function() {
      var tree = createTree(createBaseElement('/relative'));
      var actual = appendBaseElement(tree, 'http://example.com');

      assertEqualVNode(createBaseElement('http://example.com/relative'), findBaseNode(actual));
    });

    it('updates relative base element from property', function() {
      var tree = createTree(createBaseElement('/relative', true));
      var actual = appendBaseElement(tree, 'http://example.com');

      assertEqualVNode(createBaseElement('http://example.com/relative'), findBaseNode(actual));
    });

    it('takes care of dashes when concatenating relative base element', function() {
      var tree = createTree(createBaseElement('/relative'));
      var actual = appendBaseElement(tree, 'http://example.com/');

      assertEqualVNode(createBaseElement('http://example.com/relative'), findBaseNode(actual));
    });

    it("doesn't update absolute base element", function() {
      var absoluteBaseElement = createBaseElement('http://crazyegg.com/');
      var tree = createTree(absoluteBaseElement);

      var actual = appendBaseElement(tree, 'http://example.com');

      assert.equal('http://crazyegg.com/', findBaseNode(actual).properties.attributes.href);
    });

    it("doesn't update protocol relative base element", function() {
      var protocolRelativeBaseElement = createBaseElement('//crazyegg.com/');
      var tree = createTree(protocolRelativeBaseElement);

      var actual = appendBaseElement(tree, 'http://example.com');

      assert.equal('//crazyegg.com/', findBaseNode(actual).properties.attributes.href);
    });
  });

  var expectedProtocols = ["http", "https", "data"];
  var unexpectedProtocols = ["chrome-extension", "ftp", "javascript", "test"];

  var proxyUrl = "https://proxy.com/proxy/";
  var validUrls = [
    "http://test.com/img.jpg",
    "http://test.com/img.jpg?width=100&height=200",
    "https://test.com/img.jpg",
    "https://test.com/img.jpg?width=100&height=200",
    "//test.com/img.jpg",
    "//test.com/img.jpg?width=100&height=200",
    "/img.jpg",
    "img.png"
  ];
  var expandedUrls = [
    "http:/test.com/img.jpg",
    "http:/test.com/img.jpg?width=100&height=200",
    "https:/test.com/img.jpg",
    "https:/test.com/img.jpg?width=100&height=200",
    "http:/test.com/img.jpg",
    "http:/test.com/img.jpg?width=100&height=200",
    "http:/test.com/img.jpg",
    "http:/test.com/img.png"
  ];

  describe('#vNodeCleanupUrls()', function() {
    it('replaces all src adding the proxy url and passing the src value expanded', function() {
      for (var i = 0; i < validUrls.length; i++) {
        var node = h('img', { src: validUrls[i] });
        var actual = vNodeCleanupUrls(node, proxyUrl, 'http://test.com/');

        assert.equal(proxyUrl + expandedUrls[i], node.properties.src);
      }
    });

    it('replaces all href adding the proxy url and passing the href value expanded', function() {
      for (var i = 0; i < validUrls.length; i++) {
        var node = h('link', { href: validUrls[i] });
        var actual = vNodeCleanupUrls(node, proxyUrl, 'http://test.com/');

        assert.equal(proxyUrl + expandedUrls[i], node.properties.href);
      }
    });

    it('replaces src that starts with unexpected protocol with an empty gif', function() {
      for (var i = 0; i < unexpectedProtocols.length; i++) {
        var protocol = unexpectedProtocols[i];
        var node = h('img', { src: protocol + '://test' });
        var actual = vNodeCleanupUrls(node, proxyUrl, 'http://test.com/');

        assert.equal('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP', node.properties.src);
      }
    });

    it('replaces href that starts with unexpected protocol with an empty gif', function() {
      for (var i = 0; i < unexpectedProtocols.length; i++) {
        var protocol = unexpectedProtocols[i];
        var node = h('img', { href: protocol + '://test' });
        var actual = vNodeCleanupUrls(node, proxyUrl, 'http://test.com/');

        assert.equal('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP', node.properties.href);
      }
    });
  });

  describe('#patchSrcCleanup()', function() {
    it('keeps src with whitelisted protocol as they are', function() {
      for (var i = 0; i < expectedProtocols.length; i++) {
        var protocol = expectedProtocols[i];
        var patch = serializedPatch(protocol + '://test');
        var actual = patchSrcCleanup(patch);

        assert.deepEqual(actual, serializedPatch(protocol + '://test'));
      }
    });

    it('replaces src that starts with unexpected protocol with an empty gif', function() {
      for (var i = 0; i < unexpectedProtocols.length; i++) {
        var protocol = unexpectedProtocols[i];
        var patch = serializedPatch(protocol + '://test');
        var actual = patchSrcCleanup(patch);

        assert.deepEqual(actual, serializedPatch('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP'));
      }
    });
  });

  function serializedPatch(src) {
    var insertType1 = [6, {"t":3,"tn":"IFRAME","p":{"src": src }}];
    var insertType2 = [6, {"t":3,"tn":"IFRAME"}];
    var insertType3 = [6, null];
    var propsType1  = [4, {"style":{"cursor":"pointer"}}, {"p":{"src": src},"value":"test"}];
    var propsType2  = [4, {"style":{"cursor":"pointer"}}, {"value":"test"}];
    var propsType3  = [4, {"style":{"cursor":"pointer"}}, null];

    return {
      "0": [insertType1, insertType2, propsType1],
      "1": [propsType2],
      "2": [insertType3, propsType3],
      "a": [[null],1]
    };
  }
});
