var assert = require('chai').assert;
var h = require('virtual-dom/h');

// Module under test (MUT)
var MUT = require('../vdom-ext');
var findBaseNode = MUT.findBaseNode;
var appendBaseElement = MUT.appendBaseElement;

function createBaseElement(href) {
  return h('base', { attributes: { href: href } }, []);
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

    it('updates relative base element', function() {
      var tree = createTree(createBaseElement('/relative'));
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
});
