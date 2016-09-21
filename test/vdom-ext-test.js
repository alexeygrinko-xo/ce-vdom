var assert = require('chai').assert;
var h = require('virtual-dom/h');

// Module under test (MUT)
var MUT = require('../vdom-ext');
var getBaseUrl = MUT.getBaseUrl;
var vNodeCleanupUrls = MUT.vNodeCleanupUrls;
var patchCleanupUrls = MUT.patchCleanupUrls;

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
  var unexpectedProtocols = ["chrome-extension", "ftp", "javascript", "test"];

  var proxyUrl = "https://proxy.com/proxy/";
  var validUrls = [
    "hTtP://test.com/img.jpg",
    "http://test.com/img.jpg?width=100&height=200",
    "https://test.com/img.jpg",
    "HTTPS://test.com/img.jpg?width=100&height=200",
    "//test.com/img.jpg",
    "//test.com/img.jpg?width=100&height=200",
    "/img.jpg",
    "img.png"
  ];
  var expandedUrls = [
    proxyUrl + "http:/test.com/img.jpg",
    proxyUrl + "http:/test.com/img.jpg%3Fwidth=100&height=200",
    proxyUrl + "https:/test.com/img.jpg",
    proxyUrl + "https:/test.com/img.jpg%3Fwidth=100&height=200",
    proxyUrl + "http:/test.com/img.jpg",
    proxyUrl + "http:/test.com/img.jpg%3Fwidth=100&height=200",
    proxyUrl + "http:/test.com/img.jpg",
    proxyUrl + "http:/test.com/img.png"
  ];

  describe('#getBaseUrl()', function() {
    it('returns host unchanged if there is no BASE element', function() {
      var host = "http://test.com/12345";
      var tree = createTree();
      var baseUrl = getBaseUrl(tree, host);

      assert.equal(baseUrl, host);
    });

    it('returns BASE element\'s URL if it\'s absolute (and set as elemetn\'s property)', function() {
      var host = "http://test.com/0";
      var initialBaseUrl = "https://initial.base.url";
      var base = createBaseElement(initialBaseUrl, true);
      var tree = createTree(base);
      var baseUrl = getBaseUrl(tree, host);

      assert.equal(baseUrl, initialBaseUrl);
    });

    it('returns BASE element\'s URL if it\'s protocol-relative (and set as elemetn\'s attribute)', function() {
      var host = "http://test.com/1";
      var initialBaseUrl = "https://initial.base.url/1/2/3";
      var base = createBaseElement(initialBaseUrl);
      var tree = createTree(base);
      var baseUrl = getBaseUrl(tree, host);

      assert.equal(baseUrl, initialBaseUrl);
    });

    it('returns concatenated URL if BASE element\'s URL is relative', function() {
      var host = "http://test.com/";
      var initialBaseUrl = "initial-base-url/1/2/3";
      var base = createBaseElement(initialBaseUrl);
      var tree = createTree(base);
      var baseUrl = getBaseUrl(tree, host);

      assert.equal(baseUrl, host + initialBaseUrl);
    });

    it('returns concatenated URL if BASE element\'s URL is relative; removes extra slash', function() {
      var host = "http://t2.test.com/";
      var initialBaseUrl = "initial-base-url/4/5/6";
      var base = createBaseElement('/' + initialBaseUrl);
      var tree = createTree(base);
      var baseUrl = getBaseUrl(tree, host);

      assert.equal(baseUrl, host + initialBaseUrl);
    });
  });

  describe('#vNodeCleanupUrls()', function() {
    it('replaces all src adding the proxy url and passing the src value expanded', function() {
      for (var i = 0; i < validUrls.length; i++) {
        var node = h('img', { src: validUrls[i] });
        var actual = vNodeCleanupUrls(node, proxyUrl, 'http://test.com/');

        assert.equal(expandedUrls[i], node.properties.src);
      }
    });

    it('replaces all href adding the proxy url and passing the href value expanded', function() {
      for (var i = 0; i < validUrls.length; i++) {
        var node = h('link', { href: validUrls[i] });
        var actual = vNodeCleanupUrls(node, proxyUrl, 'http://test.com/');

        assert.equal(expandedUrls[i], node.properties.href);
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

  describe('#patchCleanupUrls()', function() {
    it('processes all patches child nodes', function() {
      var patch = serializedPatchRecursive();
      var actual = patchCleanupUrls(patch, proxyUrl, 'http://test.com/');

      assert.deepEqual(actual, expectedSerializedPatchRecursive());
    });

    it('replaces all src adding the proxy url and passing the src value expanded', function() {
      for (var i = 0; i < validUrls.length; i++) {
        var patch = serializedPatch('src', validUrls[i]);
        var actual = patchCleanupUrls(patch, proxyUrl, 'http://test.com/');

        assert.deepEqual(actual, serializedPatch('src', expandedUrls[i]));
      }
    });

    it('replaces all href adding the proxy url and passing the src value expanded', function() {
      for (var i = 0; i < validUrls.length; i++) {
        var patch = serializedPatch('href', validUrls[i]);
        var actual = patchCleanupUrls(patch, proxyUrl, 'http://test.com/');

        assert.deepEqual(actual, serializedPatch('href', expandedUrls[i]));
      }
    });

    it('replaces src that starts with unexpected protocol with an empty gif', function() {
      for (var i = 0; i < unexpectedProtocols.length; i++) {
        var protocol = unexpectedProtocols[i];
        var patch = serializedPatch('src', protocol + '://test');
        var actual = patchCleanupUrls(patch, proxyUrl, 'http://test.com/');

        assert.deepEqual(actual, serializedPatch('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP'));
      }
    });

    it('replaces href that starts with unexpected protocol with an empty gif', function() {
      for (var i = 0; i < unexpectedProtocols.length; i++) {
        var protocol = unexpectedProtocols[i];
        var patch = serializedPatch('href', protocol + '://test');
        var actual = patchCleanupUrls(patch, proxyUrl, 'http://test.com/');

        assert.deepEqual(actual, serializedPatch('href', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP'));
      }
    });

    it('processes a VirtualPatch.VTEXT', function() {
      // Change text of a VText
      //  * VirtualPatch.VTEXT == 1
      //  * type(VText) == 1
      var expected = {
        "77": [
          [ 1, { t: 1, x: "/1.png" } ]
        ]};
      var actual = {
        "77": [
          [ 1, { t: 1, x: "/1.png" } ]
        ]};

      patchCleanupUrls(actual, proxyUrl, 'http://test.com/');

      assert.deepEqual(actual, expected);
    });

    it('processes a VirtualPatch.VNODE', function() {
      // Change a VNode
      //  * VirtualPatch.VNODE == 2
      //  * type(VNode) == 3
      var expected = {
        "92": [
          [
            2,
            {
              t: 3,
              tn: "DIV",
              p: { className: "content" },
              c: [
                {
                  t: 3,
                  tn: "IMG",
                  p: { scrollLeft: 0, src: proxyUrl + "http:/test.com/1.png" },
                  c: [
                    {
                      t: 3,
                      tn: "IMG",
                      p: { scrollLeft: 0, src: proxyUrl + "http:/test.com/2.png" }
                    }]}]}]]};

      var actual = {
        "92": [
          [
            2,
            {
              t: 3,
              tn: "DIV",
              p: { className: "content" },
              c: [
                {
                  t: 3,
                  tn: "IMG",
                  p: { scrollLeft: 0, src: "/1.png" },
                  c: [
                    {
                      t: 3,
                      tn: "IMG",
                      p: { scrollLeft: 0, src: "/2.png" }
                    }]}]}]]};

      patchCleanupUrls(actual, proxyUrl, 'http://test.com/');

      assert.deepEqual(actual, expected);
    });

    it('processes a VirtualPatch.PROPS', function() {
      // Change a VNode
      //  * VirtualPatch.PROPS == 4
      var expected = {
        "107": [
          [
            4,
            {
              href: proxyUrl + "http:/test.com/2.png"
            },
            {
              p: {
                async: "",
                src: proxyUrl + "http:/test.com/1.png",
              }
            }]]};
      var actual = {
        "107": [
          [
            4,
            {
              href: "/2.png"
            },
            {
              p: {
                async: "",
                src: "/1.png",
              }
            }]]};

      patchCleanupUrls(actual, proxyUrl, 'http://test.com/');

      assert.deepEqual(actual, expected);
    });

    it('processes a VirtualPatch.INSERT', function() {
      // Change a VNode
      //  * VirtualPatch.INSERT == 6
      //  * type(VText) == 1
      //  * type(VNode) == 3
      var expected = {
        "309": [
          [ 6, { t: 1, x: "lorem ipsum" }], // insert text node
          [
            6, {
            t: 3,
            tn: "A",
            p: {
              src: proxyUrl + "http:/test.com/1.png"
            },
            c: [
              { t: 3, tn: "IMG", p: { src: proxyUrl + "http:/test.com/2.png" }, c: [] }
            ]
          }
          ]
        ]
      };
      var actual = {
        "309": [
          [ 6, { t: 1, x: "lorem ipsum" }], // insert text node
          [
            6, {
            t: 3,
            tn: "A",
            p: {
              src: "/1.png"
            },
            c: [
              { t: 3, tn: "IMG", p: { src: "/2.png" }, c: [] }
            ]
          }
          ]
        ]
      };

      patchCleanupUrls(actual, proxyUrl, 'http://test.com/');

      assert.deepEqual(actual, expected);
    });

    it('processes a VirtualPatch.REMOVE', function() {
      // Change a VNode
      //  * VirtualPatch.REMOVE == 7
      var expected = {
        "4": [
          [
            7,
            null
          ]
        ]
      };
      var actual = {
        "4": [
          [
            7,
            null
          ]
        ]
      };

      patchCleanupUrls(actual, proxyUrl, 'http://test.com/');

      assert.deepEqual(actual, expected);
    });
  });

  function serializedPatch(prop, src) {
    var obj = {};
    obj[prop] = src;

    var obj2 = {};
    obj2[prop] = src;

    var insertType1 = [6, {"t":3,"tn":"IFRAME","p":obj}];
    var insertType2 = [6, {"t":3,"tn":"IFRAME"}];
    var insertType3 = [6, null];
    var propsType1  = [4, {"style":{"cursor":"pointer"}}, {"p":obj2,"value":"test"}];
    var propsType2  = [4, {"style":{"cursor":"pointer"}}, {"value":"test"}];
    var propsType3  = [4, {"style":{"cursor":"pointer"}}, null];

    return {
      "0": [insertType1, insertType2, propsType1],
      "1": [propsType2],
      "2": [insertType3, propsType3],
      "a": [[null],1]
    };
  }

  function serializedPatchRecursive() {
    var childInsertType = {"t":3,"tn":"IFRAME","p": { "src": "/child.png" }};
    var childTextType  =  {"t":1,"x":"Text"};
    var children = [childInsertType, childTextType];

    var insertType = [6, {"t":3,"tn":"IFRAME","c": children,"p": { "src": "/test.png" }}];

    return {
      "0": [insertType],
      "a": [[null],1]
    };
  }

  function expectedSerializedPatchRecursive() {
    var childInsertType = {"t":3,"tn":"IFRAME","p": { "src": proxyUrl + "http:/test.com/child.png" }};
    var childTextType  =  {"t":1,"x":"Text"};
    var children = [childInsertType, childTextType];

    var insertType = [6, {"t":3,"tn":"IFRAME","c": children,"p": { "src": proxyUrl + "http:/test.com/test.png" }}];

    return {
      "0": [insertType],
      "a": [[null],1]
    };
  }
});
