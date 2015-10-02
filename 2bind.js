// TODO: scopes. Being able to use higher scopes
// TODO: loop indices, other made up variables?
// TODO: functions to format text content or change other attributes
// based on value (e.g. set brand in data-brand)
// TODO: chance to change 'bind' to something else.

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

function Bnid2(root, formatters, onChangeCb) {
  this.root = root;
  this.formatters = formatters;
  this.onChangeCb = onChangeCb;
}

Bnid2.prototype._cb = function() {
  if (this.onChangeCb) this.onChangeCb();
}

Bnid2.prototype._bindArray = function(data, el) {
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
  var tpl = root.querySelector(tplSelector);

  _clear(el);
  for (var sub = 0; sub < data.length; ++sub) {
    var clone = document.importNode(tpl.content, true);
    this._bind(data, sub, clone);
    el.appendChild(clone);
  }

  var observer = function(change) {
    for (var i = 0; i < change.length; ++i) {
      var c = change[i];
      if (c.type == 'splice' && change[i].addedCount > 0) {
        var clone = document.importNode(tpl.content, true);
        this._bind(c.object, c.index, clone);
        el.insertBefore(clone, el.children[index]);
      } else if (c.type == 'splice' && c.removed.length > 0) {
        var index = c.index;
        el.removeChild(el.children[index]);
      } else if (c.type == 'update') {
        var index = c.name;
        el.removeChild(el.children[index]);
        var clone = document.importNode(tpl.content, true);
        this._bind(c.object, c.name, clone);
        el.insertBefore(clone, el.children[index]);
      }
    }
    this._cb();
  }.bind(this);

  Array.observe(data, observer);
}

// 3kg 400
Bnid2.prototype._bindObject = function(data, node) {
  var el = node;
  var isTpl = node.dataset && node.dataset['bindtpl'];
  if (isTpl) {
    _clear(node);
    var tplSelector = node.dataset['bindtpl'];
    var tpl = root.querySelector(tplSelector);
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

  if (isTpl) node.appendChild(el);

  var observer = function(change) {
    for (var i = 0; i < change.length; ++i) {
      var c = change[i];
      for (var e = 0; e < els[c.name].length; ++e) {
        this._bind(c.object, c.name, els[c.name][e]);
      }
    }
    this._cb();
  }.bind(this);

  Object.observe(data, observer);
}

function _hasValue(node) {
  var tpe = node.tagName.toLowerCase();
  return ['input'].indexOf(tpe) !== -1;
}

Bnid2.prototype._bindValue = function(data, key, node) {
  var subs = node.querySelectorAll('[data-bindval]');
  if (subs.length == 0) subs = [node];
  for (var i = 0; i < subs.length; ++i) {
    var sub = subs[i];
    var v = data[key];
    var format = sub.dataset['bindformat'];
    if (format) {
      var formatters = format.split(',');
      for (var fi = 0; fi < formatters.length; ++fi) {
        var fmt = this.formatters[formatters[fi]];
        fmt(sub, v, data, key);
      }
    } else {
      var hasValue = _hasValue(sub);
      if (hasValue) {
        sub.value = v;
        if (key !== null && key !== undefined) {
          sub.addEventListener('change', function(ev) {
            data[key] = ev.target.value;
          });
        }
      } else {
        sub.textContent = v;
      }
    }
  }
}

Bnid2.prototype._bind = function(data, key, node) {
  var o = (key !== null && key !== undefined) ? data[key] : data;
  if (Array.isArray(o)) {
    this._bindArray(o, node);
  } else if (typeof o == 'object') {
    this._bindObject(o, node);
  } else {
    this._bindValue(data, key, node);
  }
}

function bind(data, node, formatters, cb) {
  var fmt = {};
  for (var f in defaultFormatters) fmt[f] = defaultFormatters[f];
  for (var f in formatters) fmt[f] = formatters[f];
  var b = new Bnid2(node, fmt, cb);
  b._bind(data, null, node);
}