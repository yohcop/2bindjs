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
    return ['input'].indexOf(tpe) !== -1;
  }

  function IdMap() {
    var values = {};
    var nextId = 1;

    return {
      set: function(key, value) {
        var id = key.___id___;
        if (!id) {
          id = nextId++;
          values[id] = value;
          key.___id___ = id;
        }
        values[id] = value;
      },
      get: function(key) {
        return values[key.___id___];
      },
      has: function(key) {
        if (key) return key.___id___ > 0;
        return false;
      },
      dbg: function() {
        console.log(values);
      }
    };
  }

  function Bnid2(root, formatters, onChangeCb) {
    this.root = root;
    this.formatters = formatters;
    this.paths = new IdMap();
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
      var s = clone.firstElementChild;
      //var s = document.createElement('span');
      //s.appendChild(clone);
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

    var els = {};
    var binds = el.querySelectorAll('[data-bind]');
    for (var i = 0; i < binds.length; ++i) {
      var b = binds[i];
      var property = b.dataset['bind'];
      var value = data[property];
      this._bind(data, property, b);
      if (els[property]) {
        els[property].push(b);
      } else {
        els[property] = [b];
      }
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
      var v = data[key];
      var target = (v instanceof Object && '__target__' in v) ? v.__target__ : v;
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
    } else if (Array.isArray(o)) {
      this._bindArray(o, node);
    } else if (typeof o == 'object') {
      this._bindObject(o, node);
    } else {
      this._bindValue(data, key, node);
    }
  }

  Bnid2.prototype.maybeSaveMapping = function(o, node) {
    if (o instanceof Object) {
      var root = node;//node.shadowRoot ? node.shadowRoot : node;
      if (this.paths.has(o) && this.paths.get(o).indexOf(root) == -1) {
        this.paths.get(o).push(root);
      } else if (!this.paths.has(o)) {
        this.paths.set(o, [root]);
      }
    }
  }

  Bnid2.prototype.update = function(data, key) {
    var p2 = data[key];
    var path = data;
    // For arrays, we should update the parent (below)
    // If we can update just the minimum possible, do it.
    if (this.paths.has(p2) && this.paths.get(p2).length > 0 && !Array.isArray(data)) {
      for (var i = 0; i < this.paths.get(p2).length; ++i) {
        this._bind(data, key, this.paths.get(p2)[i]);
      }
    } else if (this.paths.has(path)) {
      // Update the parent, as a "root".
      for (var i = 0; i < this.paths.get(path).length; ++i) {
        this._bind(data, null, this.paths.get(path)[i]);
      }
    }
  }

  function deepProxy(data, cb) {
    if (data instanceof Object) {
      var observer = new Observer(cb);
      var proxy = new Proxy(data, observer);
      var keys = Object.keys(data);
      for (var ki = 0; ki < keys.length; ++ki) {
        var k = keys[ki];
        proxy[k] = deepProxy(data[k], cb);
      }
      observer.ready = true;
      return proxy;
    }
    return data;
  }

  function Observer(cb) {
    this.cb = cb;
    this.ready = false;
  }

  Observer.prototype.has = function(target, property) {
    if (property == '__target__') return true;
    return property in target;
  };

  Observer.prototype.get = function(target, property, receiver) {
    if (property == '__target__') return target;
    return target[property];
  };

  Observer.prototype.set = function(target, property, value, receiver) {
    var r = null;
    if (this.ready) {
      r = (target[property] = deepProxy(value, this.cb));
      this.cb(target, property);
    } else {
      r = (target[property] = value);
    }
    return r;
  };

  Observer.prototype.deleteProperty = function(target, property, receiver) {
    var r = delete target[property];
    if (!Array.isArray(target)) {
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
      this.cb(target, property);
    }
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

    var ready = false;
    var proxyChange = function(obj, key) {
      if (ready) {
        b.update(obj, key);
        if (cb) cb();
      }
    };

    var proxy = deepProxy(data, proxyChange);
    b._bind(data, null, node);
    ready = true;

    return proxy;
  };
})();
