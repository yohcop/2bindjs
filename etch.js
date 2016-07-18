/* This program is free software. It comes without any warranty, to
 * the extent permitted by applicable law. You can redistribute it
 * and/or modify it under the terms of the Be Awesome Public Licence,
 * Version 1, as published by Yohann Coppel. See
 * http://b.leppoc.net/pages/bapl/COPYING for more details. */

// TODO: support other input elements than just the basic <input>
// TODO: scopes. Being able to use higher scopes
// TODO: loop indices, other made up variables? Note that this is not trivial.
// since when arrays are spliced, we only re-render the new elements for
// example, not all of them. But indices can change.  If the array isn't
// mutable (on the application side), then it's possible to get the index with
// a formatter (basically index=key)
// TODO: chance to change 'bind' to something else in data attributes names.

var etch = (function() {

  var targetKey = '__etchjs_target__';
  var arrayKey = '__etchjs_array__';
  var nodeKey = '__etchjs_nodes__';
  var valNodeKey = '__etchjs_val_nodes__';
  var specialKeys = new Set([targetKey, arrayKey, nodeKey, valNodeKey]);

  // Formatters are function taking as argument:
  // el: the element to modify
  // value: the value
  var defaultFormatters = {
    'content': function(el, value, data, key) {
      el.textContent = value;
    },
    'color': function(el, value, data, key) {
      el.style.color = value;
    },
    'value': function(el, value, data, key) {
      el.value = value;
    },
    'valueBind': function(el, value, data, key) {
      el.value = value;
      if (!el.dataset['etchEventSet']) {
        el.dataset['etchEventSet'] = 1;
        el.addEventListener('change', function(ev) {
          data[key] = el.value;
        });
      }
    },
  }

  function _clear(el) {
    while (el.hasChildNodes()) {
      el.removeChild(el.lastChild);
    }
  }

  function _findDocFragment(e) {
    while(e.nodeType != 11) { // 11 = DOCUMENT_FRAGMENT_NODE
      e = e.parentNode;
    }
    return e
  }

  function Etch(root, formatters, onChangeCb) {
    this.root = root;
    this.formatters = formatters;
  }

  Etch.prototype._bindArray = function(data, key, el, updating) {
    if (!updating) this.maybeSaveMapping(data, data, key, el);
    var value = (key != null) ? data[key] : data;
    if (!updating) this.maybeSaveMapping(value, data, key, el);

    var tpl = this.root.querySelector(el.dataset['etchTpl']);

    var root = el;
    if (el.dataset['etchShadow'] === "") {
      if (el.shadowRoot) root = el.shadowRoot;
      else root = el.createShadowRoot();
    }

    _clear(el);
    _clear(root);

    // SEE THIS:
    // http://ejohn.org/blog/dom-documentfragments/
    for (var sub = 0; sub < value.length; ++sub) {
      var clone = document.importNode(tpl.content, true);

      // NOTE: an element can no longer have multiple shadow roots inside it.
      // This means that all the elements in a list will share the same shadow
      // root, so a <style> element in a template will be added multiple times.
      // It doesn't really break anything, but it's not pretty.
      while (clone.childNodes.length > 0) {
        var s = clone.childNodes[0];
        this._bind(value, sub, s, updating);

        root.appendChild(s);
      }
    }
  }

  Etch.prototype._bindObject = function(data, key, node, updating) {
    if (!updating) this.maybeSaveMapping(data, data, key, node);
    var value = (key != null) ? data[key] : data;
    if (!updating) this.maybeSaveMapping(value, data, key, node);

    var el = node;
    var isTpl = node.dataset && node.dataset['etchTpl'];

    if (isTpl) {
      _clear(el);
      var tplSelector = node.dataset['etchTpl'];
      var tpl = this.root.querySelector(tplSelector);
      el = document.importNode(tpl.content, true);
    }

    this._bindRecursive(value, null, el, updating);

    if (isTpl) {
      var root = node;
      if (node.dataset['etchShadow'] === "") {
        if (node.shadowRoot) root = node.shadowRoot;
        else root = node.createShadowRoot();
      }

      _clear(root);
      root.appendChild(el);
    }
  }

  Etch.prototype._bindValue = function(data, key, node, updating) {
    if (!updating) this.maybeSaveValueMapping(data, data, key, node);

    // We compare key to null, because in the case of an array,
    // key could be === 0.
    var value = (key != null) ? data[key] : data;
    if (!updating) this.maybeSaveMapping(value, data, key, node);

    if (value instanceof Object) {
      value = value[targetKey];
    }

    var fn = node.dataset['etchFn'];
    if (fn) {
      var formatters = fn.split(',');
      for (var fi = 0; fi < formatters.length; ++fi) {
        var fmt = this.formatters[formatters[fi]];
        fmt(node, value, data, key);
      }
    } else {
      node.textContent = value;
    }
  }

  Etch.prototype._bindFn = function(data, key, node, updating) {
    if (!updating) this.maybeSaveMapping(data, data, key, node);
    var v = (key != null) ? data[key] : data;
    var target = (v instanceof Object && targetKey in v) ? v[targetKey] : v;
    this.formatters[node.dataset['etchFn']](node, target, data, key);
  }

  /*
  data attributes:
  - etch-val: binds the value.
  - etch-each + etch-tpl: binds an array
  - etch-obj + etch-tpl: binds an object

  modifiers:
  - (none) by default, the string-value is set to textContent
  - etch-fn : the value is passed to all the registerd functions, instead of being set to textContent.
  */
  Etch.prototype._bind = function(data, key, node, updating) {
    if (!node.dataset) {
      return;
    }
    if ('etchVal' in node.dataset) {
      let k = node.dataset['etchVal'];
      this._bindValue(data, k || key, node, updating);
      this._bindRecursive(data, key, node, updating);
    } else if ('etchEach' in node.dataset) {
      let k = node.dataset['etchEach'];
      this._bindArray(data, k || key, node, updating);
    } else if ('etchObj' in node.dataset) {
      let k = node.dataset['etchObj'];
      this._bindObject(data, k || key, node, updating);
    } else {
      this._bindRecursive(data[key], null, node, updating);
    }
  }

  Etch.prototype._bindRecursive = function(data, key, node, updating) {
    for (let child of node.childNodes) {
      if (child.nodeType !== 3 && child.nodeType !== 8) {  // Not TEXT or COMMENT
        if ('etchVal' in child.dataset ||
            'etchEach' in child.dataset ||
            'etchObj' in child.dataset) {
          this._bind(data, key, child, updating);
        } else {
          this._bindRecursive(data, key, child, updating);
        }
      }
    }
    return;
  }

  Etch.prototype.maybeSaveValueMapping = function(o, data, key, node) {
    if (!key) return;
    if (!data[valNodeKey]) data[valNodeKey] = {};
    if (!data[valNodeKey][key]) data[valNodeKey][key] = new Set();
    var cb = {data:data,key:key,node:node};
    data[valNodeKey][key].add(cb)
  }

  // Says that when o is modified, the function _bind(data, key, node)
  // should be called.
  Etch.prototype.maybeSaveMapping = function(o, data, key, node) {
    if (o instanceof Object) {
      var cb = {data:data,key:key,node:node}
      if (o[nodeKey]) {
        o[nodeKey].add(cb);
      } else if (!node[nodeKey]) {
        o[nodeKey] = new Set();
        o[nodeKey].add(cb);
      }
    }
  }

  Etch.prototype.update = function(data, key) {
    var cbs = [];
    if (data[nodeKey]) {
      for (let cb of data[nodeKey]) {
        if (!key || cb.key == key) {
          cbs.push(cb);
        }
      }
    }

    if (data[valNodeKey] && data[valNodeKey][key]) {
      for (let cb of data[valNodeKey][key]) {
        cbs.push(cb);
      }
    }

    for (let cb of cbs) {
      this._bind(cb.data, cb.key, cb.node, true);
    }
  }

  function deepProxy(data, cb) {
    if (Array.isArray(data)) {
      var wrapper = {};
      wrapper[targetKey] = data;
      wrapper[arrayKey] = true;
      wrapper.length = data.length;

      for (var i = 0; i < data.length; ++i) {
        wrapper[i] = deepProxy(data[i], cb);
      }

      var observer = new ArrayObserver(cb);
      var proxy = new Proxy(wrapper, observer);
      return proxy;
    } else if (data instanceof Object) {
      var wrapper = {};
      wrapper[targetKey] = data;

      // set at the end of the function, but captured in the closure for touch().
      var proxy = null;

      wrapper.touch = function(key) {
        cb(proxy, key);
      }

      var keys = Object.keys(data);
      for (var ki = 0; ki < keys.length; ++ki) {
        var k = keys[ki];
        wrapper[k] = deepProxy(data[k], cb);
      }

      var observer = new ObjectObserver(cb);
      proxy = new Proxy(wrapper, observer);
      return proxy;
    }
    return data;
  }

  function ObjectObserver(cb) {
    this.cb = cb;
  }

  ObjectObserver.prototype.get = function(target, property, receiver) {
    if (target[property]) return target[property];
    return target[targetKey][property];
  };

  ObjectObserver.prototype.set = function(target, property, value, receiver) {
    if (specialKeys.has(property)) {
      return target[property] = value;
    }

    var r = (target[property] = deepProxy(value, this.cb));
    Reflect.set(target[targetKey], property, value);
    this.cb(target, property);
    return r;
  };

  ObjectObserver.prototype.deleteProperty = function(target, property, receiver) {
    var r = delete target[property];
    delete target[targetKey][property];
    this.cb(target, property);
    return r;
  };

  function ArrayObserver(cb) {
    this.cb = cb;
  }

  ArrayObserver.prototype.get = function(target, property, receiver) {
    if (specialKeys.has(property)) {
      return target[property];
    }
    if (property === 'length') {
      return target.length;
    }
    if (property in target) {
      return target[property];
    }
    return Array.prototype[property];
  };

  ArrayObserver.prototype.set = function(target, property, value, receiver) {
    if (specialKeys.has(property)) {
      return target[property] = value;
    }
    if (property === 'length') {
      var r = target.length = value;
      target[targetKey].length = value;
      this.cb(target, null);
      return true;
    }

    var r = (target[property] = deepProxy(value, this.cb));
    Reflect.set(target[targetKey], property, value);

    if (Number(property) >= target.length) {
      var n = Number(property) + 1
      target.length = n;
      target[targetKey].length = n;
    }

    this.cb(target, property);
    return r;
  };

  ArrayObserver.prototype.deleteProperty = function(target, property, receiver) {
    // For arrays, deleting properties (or indices), causes a problem.
    // Calling cb would trigger an update, but at this point, length
    // is not yet updated.
    // Basically deleting an index calls (at least in Chrome):
    //
    //   deleteProperty(array, index)
    //   set(array, 'length', array.length-1)
    //
    // or something like that.
    // No worries though, since array.length is set later, the set handler will do the update.

    if (specialKeys.has(property)) {
      return delete target[property];
    }
    var r = Reflect.deleteProperty(target, property, receiver);
    Reflect.deleteProperty(target[targetKey], property, receiver);
    return r;
  };

  // data: Plain old data object
  // node: root node to bind the data to
  // formatters: map from name to formatter function
  // cb: callback for when data changes. You could do Object.observe
  //   by yourself, but it's easier for non-flat objects. The callback
  //   takes no arguments.
  return function(data, node, formatters, cb) {
    var fmt = {};
    for (var f in defaultFormatters) fmt[f] = defaultFormatters[f];
    for (var f in formatters) fmt[f] = formatters[f];

    var b = new Etch(node, fmt);

    var proxyChange = function(obj, key) {
      b.update(obj, key);
      if (cb) cb();
    };

    var proxy = deepProxy(data, proxyChange);
    b._bindRecursive(proxy, null, node, false);

    return proxy;
  };
})();
