var assert = require('chai').assert;
var h = require('virtual-dom/h');

// Module under test (MUT)
var MUT = require('../vdom-ext');
var getBaseUrl = MUT.getBaseUrl;
var vNodeCleanupUrls = MUT.vNodeCleanupUrls;
var patchCleanupUrls = MUT.patchCleanupUrls;
var getNodeIndex = MUT.getNodeIndex;
var getNodeByIndex = MUT.getNodeByIndex;
var processInlineCSS = MUT.processInlineCSS;

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

  describe('#getNodeIndex()', function() {
    var tree = createTree();

    it('returns 0 for HTML element', function() {
      assert.equal(getNodeIndex(tree, tree), 0);
    });

    it('returns 1 for HEAD element', function() {
      assert.equal(getNodeIndex(tree, tree.children[0]), 1);
    });

    it('returns 2 for first child of head', function() {
      assert.equal(getNodeIndex(tree, tree.children[0].children[0]), 2);
    });

    it('returns 5 for last child of head', function() {
      assert.equal(getNodeIndex(tree, tree.children[0].children[2]), 5);
    });

    it('returns 6 for BODY element', function() {
      assert.equal(getNodeIndex(tree, tree.children[1]), 6);
    });

    it('returns 7 for H1 element', function() {
      assert.equal(getNodeIndex(tree, tree.children[1].children[0]), 7);
    });

    it('returns -1 for non-existent element', function() {
      assert.equal(getNodeIndex(tree, {}), -1);
    });
  });

  describe('#getNodeByIndex()', function() {
    var tree = createTree();

    it('returns HTML element for 0', function() {
      assert.equal(getNodeByIndex(tree, 0), tree);
    });

    it('returns HEAD element for 1', function() {
      assert.equal(getNodeByIndex(tree, 1), tree.children[0]);
    });

    it('returns first child of head for 2', function() {
      assert.equal(getNodeByIndex(tree, 2), tree.children[0].children[0]);
    });

    it('returns last child of head for 5', function() {
      assert.equal(getNodeByIndex(tree, 5), tree.children[0].children[2]);
    });

    it('returns BODY element for 6', function() {
      assert.equal(getNodeByIndex(tree, 6), tree.children[1]);
    });

    it('returns H1 element for 7', function() {
      assert.equal(getNodeByIndex(tree, 7), tree.children[1].children[0]);
    });

    it('returns null for 10', function() {
      assert.equal(getNodeByIndex(tree, 10), null);
    });
  });

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

  describe('#processInlineCSS()', function() {
    it('returns CSS unchanged when no url was found', function() {
      var txt = 'simple text';
      var style = h('style', [txt]);
      var tNode = style.children[0];
      processInlineCSS(tNode, { proxyUrl: proxyUrl, baseUrl: "test.com"});

      assert.equal(tNode.text, txt);
    });

    it('adds proxy to a url() statement', function() {
      var txt = ['.class {\nbackground: url(', 'images/1.jpg', ');\n}'];
      var style = h('style', [txt.join('')]);
      var tNode = style.children[0];
      processInlineCSS(tNode, { proxyUrl: proxyUrl, baseUrl: "http://test.com"});

      assert.equal(tNode.text, txt[0] + "'" + proxyUrl + "http:/test.com/images/1.jpg'" + txt[2]);
    });

    it('adds proxy to multiple url() statement with quotes and whitespaces', function() {
      var txt = '.class {\nbackground: url(images/2.jpg  );\n\
                 .another {\nbackground-url:url( \t \'https://images.com/img.png\');\n}';
      var style = h('style', txt);
      var tNode = style.children[0];
      processInlineCSS(tNode, { proxyUrl: proxyUrl, baseUrl: "http://test.com"});

      assert.equal(tNode.text, '.class {\nbackground: url(\'' + proxyUrl + 'http:/test.com/images/2.jpg\');\n\
                 .another {\nbackground-url:url(\'' + proxyUrl + 'https:/images.com/img.png\');\n}');
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

    it('replaces all url() statements in inline CSS adding the proxy url and passing the href value expanded', function() {
      var txt1 = '@import url(\'';
      var txt2 = '\');';
      for (var i = 0; i < validUrls.length; i++) {
        var node = h('style', [txt1 + validUrls[i] + txt2]);
        var actual = vNodeCleanupUrls(node, proxyUrl, 'http://test.com/');

        assert.equal(node.children[0].text, txt1 + expandedUrls[i] + txt2);
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
      var txt1 = '@import url(\'';
      var url = '/1.png';
      var newUrl = '/updated-image1.png';
      var txt2 = '\');';
      var tree = createTree(h('style', [txt1 + url + txt2]));

      // Change text of a VText
      //  * VirtualPatch.VTEXT == 1
      //  * type(VText) == 1
      var expected = [
          [ 1, { t: 1, x: txt1 + proxyUrl + 'http:/test.com' + newUrl + txt2} ]
        ];
      var actual = [
          [ 1, { t: 1, x: txt1 + newUrl + txt2 } ]
        ];

      patchCleanupUrls({
        a: tree, // virtual tree is expected to be stored in the patch; otherwise we cannot determine if it is a 'style' node or not
        3: actual // index of 'style' node's inner text in the tree is 3
      }, proxyUrl, 'http://test.com/');

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
      var tree = createTree();
      // Change a VNode
      //  * VirtualPatch.INSERT == 6
      //  * type(VText) == 1
      //  * type(VNode) == 3
      var expected = [
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
        ],
        [
          6, {
            t: 3,
            tn: "STYLE",
            p: {},
            c: [
              {
                t: 1,
                x: "background: url('" + proxyUrl + "http:/test.com/background.png');" // inline CSS
              }
            ]
          }
        ]
      ];
      var actual = [
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
        ],
        [
          6, {
          t: 3,
          tn: "STYLE",
          p: {},
          c: [
            {
              t: 1,
              x: "background: url(background.png);" // inline CSS
            }
          ]
        }
        ]
      ];

      patchCleanupUrls({
        1: actual,
        a: tree // virtual tree is expected to be stored in the patch; otherwise we cannot determine if it is a 'style' node or not
      }, proxyUrl, 'http://test.com/');

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
