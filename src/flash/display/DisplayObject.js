/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/*
 * Copyright 2013 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*global createEmptyObject, throwError, Errors, isString */

var DisplayObjectDefinition = (function () {

  var blendModes;

  var nextInstanceId = 1;
  function generateName() {
    return 'instance' + (nextInstanceId++);
  }

  // Dictionary of all broadcasted events with the event type as key and a
  // value specifying if public or internal only.
  var broadcastedEvents = { advanceFrame: false, enterFrame: true,
                            constructChildren: false, frameConstructed: true,
                            executeFrame: false, exitFrame: true,
                            render: true };

  var def = {
    __class__: 'flash.display.DisplayObject',

    initialize: function () {
      var blendModeClass = flash.display.BlendMode.class;

      this._alpha = 1;
      this._animated = false;
      this._bbox = null;
      this._bitmap = null;
      this._blendMode = blendModeClass.NORMAL;
      this._bounds = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, invalid: true };
      this._cacheAsBitmap = false;
      this._children = [];
      this._clipDepth = null;
      this._currentTransform = null;
      this._current3DTransform = null;
      this._cxform = null;
      this._depth = null;
      this._graphics = null;
      this._filters = [];
      this._loader = null;
      this._mouseChildren = true;
      this._mouseOver = false;
      this._mouseX = 0;
      this._mouseY = 0;
      this._name = null;
      this._opaqueBackground = null;
      this._owned = false;
      this._parent = null;
      this._rotation = 0;
      this._scale9Grid = null;
      this._scaleX = 1;
      this._scaleY = 1;
      this._stage = null;
      this._transform = null;
      this._visible = true;
      this._wasCachedAsBitmap = false;
      this._x = 0;
      this._y = 0;
      this._destroyed = false;
      this._maskedObject = null;
      this._scrollRect = null;
      this._width = null;
      this._height = null;
      this._invalid = false;
      this._region = null;
      this._level = -1;
      this._index = -1;

      blendModes = [
        blendModeClass.NORMAL,     // 0
        blendModeClass.NORMAL,     // 1
        blendModeClass.LAYER,      // 2
        blendModeClass.MULTIPLY,   // 3
        blendModeClass.SCREEN,     // 4
        blendModeClass.LIGHTEN,    // 5
        blendModeClass.DARKEN,     // 6
        blendModeClass.DIFFERENCE, // 7
        blendModeClass.ADD,        // 8
        blendModeClass.SUBTRACT,   // 9
        blendModeClass.INVERT,     // 10
        blendModeClass.ALPHA,      // 11
        blendModeClass.ERASE,      // 12
        blendModeClass.OVERLAY,    // 13
        blendModeClass.HARDLIGHT,  // 14
        blendModeClass.SHADER
      ];

      var s = this.symbol;
      if (s) {
        this._animated = s.animated || false;
        this._bbox = s.bbox || null;
        this._blendMode = blendModes[s.blendMode] || blendModeClass.NORMAL;
        this._children = s.children || [];
        this._clipDepth = s.clipDepth || null;
        this._cxform = s.cxform || null;
        this._depth = s.depth || null;
        this._loader = s.loader || null;
        this._name = s.name || null;
        this._owned = s.owned || false;
        this._parent = s.parent || null;
        this._level = isNaN(s.level) ? -1 : s.level;
        this._index = isNaN(s.index) ? -1 : s.index;
        this._root = s.root || null;
        this._stage = s.stage || null;

        var scale9Grid = s.scale9Grid;
        if (scale9Grid) {
          this._scale9Grid = new flash.geom.Rectangle(
            scale9Grid.left,
            scale9Grid.top,
            (scale9Grid.right - scale9Grid.left),
            (scale9Grid.bottom - scale9Grid.top)
          );
        }

        var matrix = s.currentTransform;
        if (matrix) {
          var a = matrix.a;
          var b = matrix.b;
          var c = matrix.c;
          var d = matrix.d;

          this._rotation = a !== 0 ? Math.atan(b / a) * 180 / Math.PI :
                                     (b > 0 ? 90 : -90);
          var sx = Math.sqrt(a * a + b * b);
          this._scaleX = a > 0 ? sx : -sx;
          var sy = Math.sqrt(d * d + c * c);
          this._scaleY = d > 0 ? sy : -sy;
          this._x = matrix.tx|0;
          this._y = matrix.ty|0;

          this._currentTransform = matrix;
        }
      }

      if (!this._currentTransform) {
        this._currentTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
      }

      this._accessibilityProperties = null;

      var self = this;
      this._onBroadcastMessage = function (type) {
        var listeners = self._listeners;
        // shortcut: checking if the listeners are exist before dispatching
        if (listeners[type]) {
          self._dispatchEvent(type);
        }
      };
    },

    _addEventListener: function addEventListener(type, listener, useCapture,
                                                 priority)
    {
      if (broadcastedEvents[type] === false) {
        avm2.systemDomain.onMessage.register(type, listener);
        return;
      }

      if (type in broadcastedEvents && !this._listeners[type]) {
        avm2.systemDomain.onMessage.register(type, this._onBroadcastMessage);
      }
      this._addEventListenerImpl(type, listener, useCapture, priority);
    },

    _removeEventListener: function addEventListener(type, listener, useCapture)
    {
      if (broadcastedEvents[type] === false) {
        avm2.systemDomain.onMessage.unregister(type, listener);
        return;
      }

      this._removeEventListenerImpl(type, listener, useCapture);
      if (type in broadcastedEvents && !this._listeners[type]) {
        avm2.systemDomain.onMessage.unregister(type, this._onBroadcastMessage);
      }
    },

    _applyCurrentInverseTransform: function (point, immediate) {
      if (this._parent && this._parent !== this._stage && !immediate)
        this._parent._applyCurrentInverseTransform(point);

      var m = this._currentTransform;
      var x = point.x - m.tx;
      var y = point.y - m.ty;
      var d = 1 / (m.a * m.d - m.b * m.c);
      point.x = Math.round((m.d * x - m.c * y) * d);
      point.y = Math.round((m.a * y - m.b * x) * d);
    },
    _applyCurrentTransform: function (point, targetCoordSpace) {
      var m = this._currentTransform;
      var x = point.x;
      var y = point.y;

      point.x = Math.round(m.a * x + m.c * y + m.tx);
      point.y = Math.round(m.d * y + m.b * x + m.ty);

      if (targetCoordSpace && targetCoordSpace === this._parent) {
        return;
      }

      if (this._parent && this._parent !== this._stage)
        this._parent._applyCurrentTransform(point);

      if (targetCoordSpace)
        targetCoordSpace._applyCurrentInverseTransform(point);
    },
    _hitTest: function(use_xy, x, y, useShape, hitTestObject) {
      if (use_xy) {
        var pt = { x: x, y: y };
        this._applyCurrentInverseTransform(pt);

        var b = this._getContentBounds();
        if (!(pt.x >= b.xMin && pt.x < b.xMax &&
              pt.y >= b.yMin && pt.y < b.yMax))
        {
          return false;
        }
        if (!useShape || !this._graphics) {
          return true;
        }
        // TODO: move into Graphics
        if (this._graphics) {
          var subpaths = this._graphics._paths;
          for (var i = 0, n = subpaths.length; i < n; i++) {
            var path = subpaths[i];

            if (path.isPointInPath(pt.x, pt.y)) {
              return true;
            }

            if (path.strokeStyle) {
              var strokePath = path._strokePath;
              if (!strokePath) {
                strokePath = path.strokePath(path.drawingStyles);
                path._strokePath = strokePath;
              }
              if (strokePath.isPointInPath(pt.x, pt.y)) {
                return true;
              }
            }
          }
        }

        var children = this._children;
        for (var i = 0, n = children.length; i < n; i++) {
          var child = children[i];
          // FIXME first condition avoids crash in second expression. This
          // issue does not occur in Chrome or FF22, but does in FF23.0.1.
          if (child._hitTest && child._hitTest(true, x, y, true)) {
            return true;
          }
        }

        return false;
      }

      var b1 = this.getBounds();
      var b2 = hitTestObject.getBounds();
      x = Math.max(b1.xMin, b2.xMin);
      y = Math.max(b1.yMin, b2.yMin);
      var width = Math.min(b1.xMax, b2.xMax) - x;
      var height = Math.min(b1.yMax, b2.yMax) - y;
      return width > 0 && height > 0;
    },
    _invalidate: function () {
      if (!this._invalid && this._stage) {
        this._stage._invalidateOnStage(this);

        var children = this._children;
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (child._invalid === false) {
            child._invalidate();
          }
        }
      }
    },
    _invalidateBounds: function () {
      var currentNode = this;
      while (currentNode && !currentNode._bounds.invalid) {
        currentNode._bounds.invalid = true;
        currentNode = currentNode._parent;
      }
    },
    _updateCurrentTransform: function () {
      var scaleX = this._scaleX;
      var scaleY = this._scaleY;
      var rotation, u, v;
      // there is no need for cos/sin when the rotation is parallel to axes
      switch (this._rotation) {
      case 0:
      case 360:
        u = 1; v = 0;
        break;
      case 90:
      case -270:
        u = 0; v = 1;
        break;
      case 180:
      case -180:
        u = -1; v = 0;
        break;
      case 270:
      case -90:
        u = 0; v = -1;
        break;
      default:
        rotation = this._rotation / 180 * Math.PI;
        u = Math.cos(rotation);
        v = Math.sin(rotation);
        break;
      }

      var transform = this._currentTransform;
      transform.a = u * scaleX;
      transform.b = v * scaleX;
      transform.c = -v * scaleY;
      transform.d = u * scaleY;
      transform.tx = this._x|0;
      transform.ty = this._y|0;
    },

    get accessibilityProperties() {
      return this._accessibilityProperties;
    },
    set accessibilityProperties(val) {
      this._accessibilityProperties = val;
    },
    get alpha() {
      return this._alpha;
    },
    set alpha(val) {
      if (val === this._alpha) {
        return;
      }

      this._alpha = val;
      this._invalidate();
    },
    get blendMode() {
      return this._blendMode;
    },
    set blendMode(val) {
      if (blendModes.indexOf(val) >= 0) {
        this._blendMode = val;
      } else {
        throwError("ArgumentError", Errors.InvalidEnumError, "blendMode");
      }
    },
    get cacheAsBitmap() {
      return this._cacheAsBitmap;
    },
    set cacheAsBitmap(val) {
      this._cacheAsBitmap = this._filters.length ? true : val;
    },
    get filters() {
      return this._filters;
    },
    set filters(val) {
      if (val.length) {
        if (!this._filters.length)
          this._wasCachedAsBitmap = this._cacheAsBitmap;

        this._cacheAsBitmap = true;
      } else {
        this._cacheAsBitmap = this._wasCachedAsBitmap;
      }

      this._filters = val;
    },
    get height() {
      var bounds = this._getContentBounds();
      var t = this._currentTransform;
      return (Math.abs(t.b) * (bounds.xMax - bounds.xMin) +
             Math.abs(t.d) * (bounds.yMax - bounds.yMin))|0;
    },
    set height(val) {
      if (val < 0) {
        return;
      }

      if (this._height !== null) {
        this._height = val;
        return;
      }

      var rotation = this._rotation / 180 * Math.PI;
      var u = Math.abs(Math.cos(rotation));
      var v = Math.abs(Math.sin(rotation));
      var bounds = this._getContentBounds();
      var baseHeight = v * (bounds.xMax - bounds.xMin) +
                       u * (bounds.yMax - bounds.yMin);
      if (baseHeight === 0) {
        return;
      }

      var baseWidth = u * (bounds.xMax - bounds.xMin) +
                      v * (bounds.yMax - bounds.yMin);
      this.scaleX = this.width / baseWidth;

      this.scaleY = val / baseHeight;
    },
    get loaderInfo() {
      return (this._loader && this._loader._contentLoaderInfo) || this._parent.loaderInfo;
    },
    get mask() {
      return this._mask;
    },
    set mask(val) {
      if (this._mask === val) {
        return;
      }

      if (val && val._maskedObject) {
        val._maskedObject.mask = null;
      }

      this._mask = val;
      if (val) {
        val._maskedObject = this;
      }

      this._invalidate();
    },
    get name() {
      return this._name || (this._name = generateName());
    },
    set name(val) {
      this._name = val;
    },
    get mouseX() {
      if (!this._stage) {
        // TODO: calc local point for display objects that are not on the stage
        return 0;
      }

      var pt = {x: this._stage._mouseX, y: this._stage._mouseY};
      this._applyCurrentInverseTransform(pt);
      return pt.x;
    },
    get mouseY() {
      if (!this._stage) {
        // TODO: calc local point for display objects that are not on the stage
        return 0;
      }

      var pt = {x: this._stage._mouseX, y: this._stage._mouseY};
      this._applyCurrentInverseTransform(pt);
      return pt.y;
    },
    get opaqueBackground() {
      return this._opaqueBackground;
    },
    set opaqueBackground(val) {
      this._opaqueBackground = val;
    },
    get parent() {
      return this._index > -1 ? this._parent : null;
    },
    get root() {
      return this._stage && this._stage._root;
    },
    get rotation() {
      return this._rotation;
    },
    set rotation(val) {
      val %= 360;
      if (val > 180) {
        val -= 360;
      }
      if (val === this._rotation)
        return;

      this._invalidate();
      this._invalidateBounds();

      this._rotation = val;

      this._updateCurrentTransform();
    },
    get rotationX() {
      return 0;
    },
    set rotationX(val) {
      somewhatImplemented('DisplayObject.rotationX');
    },
    get rotationY() {
      return 0;
    },
    set rotationY(val) {
      somewhatImplemented('DisplayObject.rotationY');
    },
    get rotationZ() {
      return this.rotation;
    },
    set rotationZ(val) {
      this.rotation = val;
      somewhatImplemented('DisplayObject.rotationZ');
    },
    get stage() {
      return this._stage;
    },
    get scaleX() {
      return this._scaleX;
    },
    set scaleX(val) {
      if (val === this._scaleX)
        return;

      this._invalidate();
      this._invalidateBounds();

      this._scaleX = val;
      this._updateCurrentTransform();
    },
    get scaleY() {
      return this._scaleY;
    },
    set scaleY(val) {
      if (val === this._scaleY)
        return;

      this._invalidate();
      this._invalidateBounds();

      this._scaleY = val;
      this._updateCurrentTransform();
    },
    get scaleZ() {
      return 1;
    },
    set scaleZ(val) {
      somewhatImplemented('DisplayObject.scaleZ');
    },
    get scale9Grid() {
      return this._scale9Grid;
    },
    set scale9Grid(val) {
      somewhatImplemented('DisplayObject.scale9Grid');
      this._scale9Grid = val;
    },
    get scrollRect() {
      return this._scrollRect;
    },
    set scrollRect(val) {
      somewhatImplemented('DisplayObject.scrollRect');
      this._scrollRect = val;
    },
    get transform() {
      // TODO: Twips-ify
      return this._transform || new flash.geom.Transform(this);
    },
    set transform(val) {
      this._animated = false;

      this._invalidateBounds();

      var transform = this._transform;
      transform.colorTransform = val.colorTransform;
      if (val.matrix3D) {
        transform.matrix3D = val.matrix3D;
      } else {
        transform.matrix = val.matrix;
      }
    },
    get visible() {
      return this._visible;
    },
    set visible(val) {
      if (val === this._visible)
        return;

      this._visible = val;
      this._invalidate();
    },
    get width() {
      var bounds = this._getContentBounds();
      var t = this._currentTransform;
      return (Math.abs(t.a) * (bounds.xMax - bounds.xMin) +
             Math.abs(t.c) * (bounds.yMax - bounds.yMin))|0;
    },
    set width(val) {
      if (val < 0) {
        return;
      }

      if (this._width !== null) {
        this._width = val;
        return;
      }

      var rotation = this._rotation / 180 * Math.PI;
      var u = Math.abs(Math.cos(rotation));
      var v = Math.abs(Math.sin(rotation));
      var bounds = this._getContentBounds();
      var baseWidth = u * (bounds.xMax - bounds.xMin) +
                      v * (bounds.yMax - bounds.yMin);
      if (baseWidth === 0) {
        return;
      }

      var baseHeight = v * (bounds.xMax - bounds.xMin) +
                       u * (bounds.yMax - bounds.yMin);
      this.scaleY = this.height / baseHeight;

      this.scaleX = val / baseWidth;
    },
    get x() {
      return this._x;
    },
    set x(val) {
      if (val === this._x) {
        return;
      }

      this._invalidate();
      this._invalidateBounds();

      this._x = this._currentTransform.tx = val;
    },
    get y() {
      return this._y;
    },
    set y(val) {
      if (val === this._y) {
        return;
      }

      this._invalidate();
      this._invalidateBounds();

      this._y = this._currentTransform.ty = val;
    },
    get z() {
      return 0;
    },
    set z(val) {
      somewhatImplemented('DisplayObject.z');
    },
    _getContentBounds: function () {
      var bounds = this._bounds;

      if (bounds.invalid) {
        var bbox = this._bbox;

        var xMin = Number.MAX_VALUE;
        var xMax = Number.MIN_VALUE;
        var yMin = Number.MAX_VALUE;
        var yMax = Number.MIN_VALUE;

        if (bbox) {
          xMin = bbox.xMin;
          xMax = bbox.xMax;
          yMin = bbox.yMin;
          yMax = bbox.yMax;
        } else {
          var children = this._children;
          var numChildren = children.length;
          for (var i = 0; i < numChildren; i++) {
            var child = children[i];

            if (!child._visible) {
              continue;
            }

            var b = child.getBounds(this);

            var x1 = b.xMin;
            var y1 = b.yMin;
            var x2 = b.xMax;
            var y2 = b.yMax;

            xMin = Math.min(xMin, x1, x2);
            xMax = Math.max(xMax, x1, x2);
            yMin = Math.min(yMin, y1, y2);
            yMax = Math.max(yMax, y1, y2);
          }
        }

        if (this._graphics) {
          var b = this._graphics._getBounds(true);
          if (b.xMin !== b.xMax && b.yMin !== b.yMax) {
            var x1 = b.xMin;
            var y1 = b.yMin;
            var x2 = b.xMax;
            var y2 = b.yMax;

            xMin = Math.min(xMin, x1, x2);
            xMax = Math.max(xMax, x1, x2);
            yMin = Math.min(yMin, y1, y2);
            yMax = Math.max(yMax, y1, y2);
          }
        }

        if (xMin === Number.MAX_VALUE) {
          xMin = xMax = yMin = yMax = 0;
        }

        bounds.xMin = xMin;
        bounds.xMax = xMax;
        bounds.yMin = yMin;
        bounds.yMax = yMax;
      }

      return bounds;
    },
    _getRegion: function getRegion() {
      var b = this._graphics ?
              this._graphics._getBounds(true) :
              this._getContentBounds();
      return this._getTransformedRect(b, null);
    },

    getBounds: function (targetCoordSpace) {
      return this._getTransformedRect(this._getContentBounds(),
                                      targetCoordSpace);
    },
    _getTransformedRect: function (rect, targetCoordSpace) {
      if (rect.xMax - rect.xMin === 0 || rect.yMax - rect.yMin === 0) {
        return { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
      }
      var p1 = { x: rect.xMin, y: rect.yMin };
      this._applyCurrentTransform(p1, targetCoordSpace);
      var p2 = { x: rect.xMax, y: rect.yMin };
      this._applyCurrentTransform(p2, targetCoordSpace);
      var p3 = { x: rect.xMax, y: rect.yMax };
      this._applyCurrentTransform(p3, targetCoordSpace);
      var p4 = { x: rect.xMin, y: rect.yMax };
      this._applyCurrentTransform(p4, targetCoordSpace);

      var xMin = Math.min(p1.x, p2.x, p3.x, p4.x);
      var xMax = Math.max(p1.x, p2.x, p3.x, p4.x);
      var yMin = Math.min(p1.y, p2.y, p3.y, p4.y);
      var yMax = Math.max(p1.y, p2.y, p3.y, p4.y);

      return {xMin: xMin, yMin: yMin, xMax: xMax, yMax: yMax};
    },
    globalToLocal: function (pt) {
      var result = {x: pt.x, y: pt.y};
      this._applyCurrentInverseTransform(result);
      return result;
    },
    hitTestObject: function (obj) {
      return this._hitTest(false, 0, 0, false, obj);
    },
    hitTestPoint: function (x, y, shapeFlag) {
      return this._hitTest(true, x, y, shapeFlag, null);
    },
    localToGlobal: function (pt) {
      var result = {x: pt.x, y: pt.y};
      this._applyCurrentTransform(result);
      return result;
    },
    destroy: function () {
      if (this._destroyed) {
        return;
      }
      this._destroyed = true;
      this.cleanupBroadcastListeners();
    },
    cleanupBroadcastListeners: function() {
      var listenerLists = this._listeners;
      for (var type in listenerLists) {
        avm2.systemDomain.onMessage.unregister(type, this._onBroadcastMessage);
      }
    }
  };

  var desc = Object.getOwnPropertyDescriptor;

  def.__glue__ = {
    native: {
      instance: {
        root: desc(def, "root"),
        stage: desc(def, "stage"),
        name: desc(def, "name"),
        parent: desc(def, "parent"),
        mask: desc(def, "mask"),
        visible: desc(def, "visible"),
        x: {
          get: function x() {
            return this.x / 20;
          },
          set: function x(value) {
            this.x = (value * 20)|0;
          }
        },
        y: {
          get: function y() {
            return this.y / 20;
          },
          set: function y(value) {
            this.y = (value * 20)|0;
          }
        },
        z: {
          get: function z() {
            return this.z / 20;
          },
          set: function z(value) {
            this.z = (value * 20)|0;
          }
        },
        scaleX: desc(def, "scaleX"),
        scaleY: desc(def, "scaleY"),
        scaleZ: desc(def, "scaleZ"),
        mouseX: {
          get: function mouseX() {
            return this.mouseX / 20;
          },
          set: function mouseX(value) {
            this.mouseX = (value * 20)|0;
          }
        },
        mouseY: {
          get: function mouseY() {
            return this.mouseY / 20;
          },
          set: function mouseY(value) {
            this.mouseY = (value * 20)|0;
          }
        },
        rotation: desc(def, "rotation"),
        rotationX: desc(def, "rotationX"),
        rotationY: desc(def, "rotationY"),
        rotationZ: desc(def, "rotationZ"),
        alpha: desc(def, "alpha"),
        width: {
          get: function width() {
            return this.width / 20;
          },
          set: function width(value) {
            this.width = (value * 20)|0;
          }
        },
        height: {
          get: function height() {
            return this.height / 20;
          },
          set: function height(value) {
            this.height = (value * 20)|0;
          }
        },
        _hitTest: function(use_xy, x, y, useShape, hitTestObject) {
          x = (x * 20)|0;
          y = (y * 20)|0;
          return this._hitTest(use_xy, x, y, useShape, hitTestObject);
        },
        cacheAsBitmap: desc(def, "cacheAsBitmap"),
        opaqueBackground: desc(def, "opaqueBackground"),
        scrollRect: desc(def, "scrollRect"),
        filters: desc(def, "filters"),
        blendMode: desc(def, "blendMode"),
        transform: desc(def, "transform"),
        scale9Grid: desc(def, "scale9Grid"),
        loaderInfo: desc(def, "loaderInfo"),
        accessibilityProperties: desc(def, "accessibilityProperties"),
        globalToLocal: function(pt) {
          var twipPt = {x: (pt.x * 20)|0, y: (pt.y * 20)|0};
          this._applyCurrentInverseTransform(twipPt);
          return new flash.geom.Point(twipPt.x / 20, twipPt.y / 20);
        },
        localToGlobal: function(pt) {
          var twipPt = {x: (pt.x * 20)|0, y: (pt.y * 20)|0};
          this._applyCurrentTransform(twipPt);
          return new flash.geom.Point(twipPt.x / 20, twipPt.y / 20);
        },
        getBounds: function(targetCoordSpace) {
          var bounds = this.getBounds(targetCoordSpace);
          return new flash.geom.Rectangle(
              bounds.xMin / 20,
              bounds.yMin / 20,
              (bounds.xMax - bounds.xMin) / 20,
              (bounds.yMax - bounds.yMin) / 20
          );
        },
        getRect: function(targetCoordSpace) {
          somewhatImplemented('DisplayObject.getRect');
          var bounds = this.getBounds(targetCoordSpace);
          return new flash.geom.Rectangle(
              bounds.xMin / 20,
              bounds.yMin / 20,
              (bounds.xMax - bounds.xMin) / 20,
              (bounds.yMax - bounds.yMin) / 20
          );
        },
      }
    }
  };

  return def;
}).call(this);
