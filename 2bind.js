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

var bind = (function() {

  var targetKey = '__2bindjs_target__';
  var arrayKey = '__2bindjs_array__';
  var nodeKey = '__2bindjs_nodes__';
  var specialKeys = new Set([targetKey, arrayKey, nodeKey]);

  // Formatters are function taking as argument:
  // el: the element to modify
  // value: the value
  // data: the object containing the value
  // key: basically, data[key] = value. data and key are sometimes
  //   useful to formatters.
  var defaultFormatters = {
    'txt': function(el, value, data, key) {
      el.textContent = value;
    },
    'color': function(el, value, data, key) {
      el.style.color = value;
    }
  }

  function _clear(el) {
    while (el.hasChildNodes()) {
      el.removeChild(el.lastChild);
    }
  }

  function _hasValue(node) {
    var tpe = node.tagName.toLowerCase();
    // For now, only support 'input' as element with 'value'.
    return ['input'].indexOf(tpe) !== -1;
  }

  function Bnid2(root, formatters, onChangeCb) {
    this.root = root;
    this.formatters = formatters;
  }

  Bnid2.prototype._bindArray = function(data, el) {
    this.maybeSaveMapping(data, el);

    var isTpl = el.dataset && el.dataset['bindtpl'];
    var tpl = null;
    if (!isTpl) {
      var roots = el.querySelectorAll('[data-bindtpl]');
      for (var i = 0; i < roots.length; ++i) {
        this._bindArray(data, roots[i]);
      }
      return;
    }

    var tplSelector = el.dataset['bindtpl'];
    var tpl = this.root.querySelector(tplSelector);

    var shadow = null;
    if (el.shadowRoot) shadow = el.shadowRoot;
    else shadow = el.createShadowRoot();

    _clear(el);
    _clear(shadow);

    // SEE THIS:
    // http://ejohn.org/blog/dom-documentfragments/
    for (var sub = 0; sub < data.length; ++sub) {
      var clone = document.importNode(tpl.content, true);
      // TODO: This is why list templates can only have one element.  To fix
      // this, just do the next 3 lines in a loop on each top-level element
      // inside the clone.
      var s = clone.firstElementChild;
      this._bind(data, sub, s);
      shadow.appendChild(s);
    }
  }

  Bnid2.prototype._bindObject = function(data, node) {
    this.maybeSaveMapping(data, node);

    var el = node;
    var isTpl = node.dataset && node.dataset['bindtpl'];

    if (isTpl) {
      _clear(el);
      var tplSelector = node.dataset['bindtpl'];
      var tpl = this.root.querySelector(tplSelector);
      el = document.importNode(tpl.content, true);
    }

    var binds = el.querySelectorAll('[data-bind]');
    for (var i = 0; i < binds.length; ++i) {
      var b = binds[i];
      var property = b.dataset['bind'];
      this._bind(data, property, b);
    }

    var bindvals = el.querySelectorAll('[data-bindval]');
    for (var i = 0; i < bindvals.length; ++i) {
      this._bind(data, null, bindvals[i]);
    }

    if (isTpl) {
      if (node.shadowRoot) shadow = node.shadowRoot;
      else shadow = node.createShadowRoot();
      _clear(shadow);
      shadow.appendChild(el);
    }
  }

  Bnid2.prototype._bindValue = function(data, key, node) {
    var subs = node.querySelectorAll('[data-bindval]');
    if (subs.length == 0) subs = [node];
    for (var i = 0; i < subs.length; ++i) {
      var sub = subs[i];
      var v = key ? data[key] : data;
      var target = (v instanceof Object && targetKey in v) ? v[targetKey] : v;
      var format = sub.dataset['bindformat'];
      if (format) {
        var formatters = format.split(',');
        for (var fi = 0; fi < formatters.length; ++fi) {
          var fmt = this.formatters[formatters[fi]];
          fmt(sub, target, data, key);
        }
      } else {
        var hasValue = _hasValue(sub);
        if (hasValue) {
          sub.value = target;
          if (key !== null && key !== undefined && !sub.dataset['eventset']) {
            var t = this;
            sub.addEventListener('change', function(ev) {
              data[key] = ev.target.value;
              t.update(data, key);
            });
            sub.dataset['eventset'] = true;
          }
        } else {
          sub.textContent = target;
        }
      }
    }
  }

  Bnid2.prototype._bind = function(data, key, node) {
    var o = (key !== null && key !== undefined) ? data[key] : data;

    // First off, before even looking at the type, if there is
    // a formatter specified, use that.
    if (node.dataset && node.dataset['bindformat']) {
      this._bindValue(data, key, node);
    } else if (o && Array.isArray(o[targetKey])) {
      this._bindArray(o, node);
    } else if (o && typeof o[targetKey] == 'object') {
      this._bindObject(o, node);
    } else {
      this._bindValue(data, key, node);
    }
  }

  Bnid2.prototype.maybeSaveMapping = function(o, node) {
    if (o instanceof Object) {
      if (node[nodeKey]) {
        o[nodeKey].add(node);
      } else if (!node[nodeKey]) {
        o[nodeKey] = new Set();
        o[nodeKey].add(node);
      }
    }
  }

  Bnid2.prototype.update = function(data, key) {
    var p2 = data[key];

    if (p2 && p2[nodeKey] && !data[arrayKey]) {
      for (let node of p2[nodeKey]) {
        this._bind(data, key, node);
      }
    } else if (data[nodeKey]) {
      for (let node of data[nodeKey]) {
        this._bind(data, null, node);
      }
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

      var keys = Object.keys(data);
      for (var ki = 0; ki < keys.length; ++ki) {
        var k = keys[ki];
        wrapper[k] = deepProxy(data[k], cb);
      }

      var observer = new ObjectObserver(cb);
      var proxy = new Proxy(wrapper, observer);
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
      return r;
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

    var b = new Bnid2(node, fmt);

    var proxyChange = function(obj, key) {
      b.update(obj, key);
      if (cb) cb();
    };

    var proxy = deepProxy(data, proxyChange);
    b._bind(proxy, null, node);

    return proxy;
  };
})();
