var SNAP_THRESHOLD = 10;
var KEYCODE_ESC = 27;
var POINT_SIZE = 3;
var SNAP_WIDGET_SIZE = 15;
var SOLID_ATTR = {stroke: "blue", "stroke-width": 2, "stroke-linecap": "round"};
var AXIS_ATTR = {stroke: "black", "stroke-width": 1, "stroke-linecap": "round"};
var AUX_ATTR = {stroke: "green", "stroke-width": 1, "stroke-dasharray": "--."};
var TESTS_ENABLED = true;

var $ = jQuery;

var assignId = function () {
    window.pointIds = window.pointIds || "A".charCodeAt(0);
    return String.fromCharCode(window.pointIds++);
};

var Geometry = G = function () {
    var self = this;

    this.renderers = [];
    this.renderers.draw = function (obj) {
        $.each(this, function (k, renderer) {
            renderer.draw(obj);
        });
    };

    this.objects = [];

    this.objectCreatedCallbacks = [];
    this.objectCreatedCallbacks.notify = function (obj) {
        $.each(this, function (k, callback) {
            callback.call(self, obj);
        });
    };

    this.currentObject = null;

    this.cursorP = new G.Point();

    this.snapWidget = new G.SnapWidget();
    this.snapOptions = [];
    this.ortho = false;

    $("#controls input:radio").click(function () {
        if (self.currentObject != null) {
            self.currentObject.destroy();
            self.currentObject = null;
        }
    });

    var initTools = function () {
        self.snapOptions = $("#snapping input[name=snapping]:checked").map(function () {
            return $(this).val();
        }).get();
        self.ortho = $("#snapping input[name=ortho]").prop('checked');
    };
    initTools();
    $("#snapping input").click(initTools);

    $(document).keyup(function (e) {
        e = e || window.event;
        var keyCode = e.keyCode || e.which;
        if (keyCode == KEYCODE_ESC) {
            if (self.currentObject != null) {
                self.currentObject.destroy();
                self.currentObject = null;
            }
        }
    });
};

G.prototype.onObjectCreated = function (callback) {
    this.objectCreatedCallbacks.push(callback);
};

G.prototype.addObject = function (obj) {
    this.objects.push(obj);
    this.renderers.draw(obj);
};

G.prototype.testCreated = function (obj) {
    var ret = false;
    $.each(this.objects, function (k, v) {
        if (obj.equals(v)) {
            ret = true;
            return false; // break;
        }
    });
    return ret;
};

G.prototype.addRenderer = function (renderer) {
    var self = this;
    var renderers = this.renderers;
    var cursorP = this.cursorP;
    var pointA = null;
    var snapWidget = this.snapWidget;

    renderers.push(renderer);

    var getSnapPoint = function (point) {
        var snapOptions = self.snapOptions;
        if (snapOptions.length == 0) {
            return;
        }

        // circle snapping is aggressive, has to be last in the list
        snapOptions.sort(function (a, b) {
            return G.SnapAlgos[a].priority - G.SnapAlgos[b].priority;
        });

        var nearestDistance = SNAP_THRESHOLD + 1;
        var bestResult = null;

        $.each(snapOptions, function (k, name) {
            var result = G.SnapAlgos[name].calc(self.objects, point, nearestDistance);
            if (result) {
                bestResult = result;
                nearestDistance = result.nearestDistance;
            }
        });
        return bestResult;
    };

    $(renderer.paper.canvas).mousemove(function (e) {
        renderer.updatePosition(cursorP, e, this);

        var snapped = getSnapPoint(cursorP);
        if (snapped) {
            snapWidget.p = snapped.snapPoint;
            snapWidget.shape = snapped.shape;
            snapWidget.show(renderer.paper);

            cursorP.x = snapped.snapPoint.x;
            cursorP.y = snapped.snapPoint.y;
            cursorP.z = snapped.snapPoint.z;
        } else {
            snapWidget.hide(renderer.paper);

            if (self.ortho && self.currentObject) {
                var dx = Math.abs(pointA.x - cursorP.x);
                var dy = Math.abs(pointA.y - cursorP.y);
                if (dx > dy) {
                    cursorP.y = pointA.y;
                } else {
                    cursorP.x = pointA.x;
                }
            }
        }
        renderer.draw(snapWidget);

        if (self.currentObject) {
            self.currentObject.b = cursorP;
            renderers.draw(self.currentObject);
        }
    });

    $(renderer.paper.canvas).click(function (e) {
        if (self.currentObject == null) {
            pointA = new G.Point(cursorP);
            pointA.t = assignId();

            var activeControl = $("#controls input[name=tool]:checked");
            switch (activeControl.val()) {
                case "segment":
                    var segment = new G.Segment(pointA, cursorP);
                    renderers.draw(segment);
                    self.currentObject = segment;
                    break;
                case "circle":
                    var circle = new G.Circle(pointA, cursorP);
                    renderers.draw(circle);
                    self.currentObject = circle;
                    break;
                case "point":
                    var point = pointA;
                    renderers.draw(point);
                    self.objects.push(point);
                    self.objectCreatedCallbacks.notify(point);
                    break;
            }
        } else {
            snapWidget.hide(renderer.paper);

            self.currentObject.b = new G.Point(cursorP);
            self.currentObject.b.t = assignId();
            renderers.draw(self.currentObject);
            self.objects.push(self.currentObject);
            self.objectCreatedCallbacks.notify(self.currentObject);

            self.currentObject = null;
        }
    });

    $.each(this.objects, function (k, obj) {
        renderer.draw(obj);
    });
};

G.SnapAlgos = {
    endpoint: {
        priority: 1,
        calc: function (objects, point, nearestDistance) {
            var shape = null, snapPoint = null;
            var snapToPoint = function (k, p) {
                var distance = p.distance(point);
                if (distance <= SNAP_THRESHOLD && distance < nearestDistance) {
                    nearestDistance = distance;
                    shape = G.SnapWidget.Shape.Endpoint;
                    snapPoint = p;
                }
            };

            $.each(objects, function (key, obj) {
                if (obj instanceof G.Segment && !(obj instanceof G.Axis)) {
                    $.each([obj.a, obj.b], snapToPoint);
                } else if (obj instanceof G.Point) {
                    snapToPoint(null, obj);
                }
            });
            return snapPoint != null ? {shape: shape, snapPoint: snapPoint, nearestDistance: nearestDistance} : null;
        }
    },
    center: {
        priority: 10,
        calc: function (objects, point, nearestDistance) {
            if (nearestDistance < SNAP_THRESHOLD + 1) {
                return; // previous snap points have priority over this snap point TODO refactor?
            }
            var shape = null, snapPoint = null;
            $.each(objects, function (key, obj) {
                if (obj instanceof G.Circle) {
                    var distance = obj.distance(point);
                    if (distance <= SNAP_THRESHOLD && distance < nearestDistance) {
                        nearestDistance = distance;
                        shape = G.SnapWidget.Shape.Center;
                        snapPoint = obj.o;
                    }
                }
            });
            return snapPoint != null ? {shape: shape, snapPoint: snapPoint, nearestDistance: nearestDistance} : null;
        }},
    intersection: {
        priority: 1,
        calc: function (objects, point, nearestDistance) {
            var shape = null, snapPoint = null;
            var nearestObjects = [];
            $.each(objects, function (key, obj) {
                if (obj instanceof G.Segment || obj instanceof G.Circle) {
                    var distance = obj.distance(point);
                    if (distance <= SNAP_THRESHOLD && distance < nearestDistance) {
                        nearestObjects.push(obj);
                    }
                }
            });
            while (nearestObjects.length > 1) {
                var one = nearestObjects.pop();
                $.each(nearestObjects, function (key, two) {
                    var ps = two.intersect(one);
                    $.each(ps, function (k, p) {
                        var distance = p.distance(point);
                        if (distance <= SNAP_THRESHOLD && distance < nearestDistance) {
                            nearestDistance = distance;
                            shape = G.SnapWidget.Shape.Intersection;
                            snapPoint = p;
                        }
                    });
                });
            }
            return snapPoint != null ? {shape: shape, snapPoint: snapPoint, nearestDistance: nearestDistance} : null;
        }
    }
};

G.Util = {
    distance: function (x, y, x1, y1) {
        var x_2 = (x - x1);
        var y_2 = (y - y1);
        return Math.sqrt(x_2 * x_2 + y_2 * y_2);
    },
    distance3d: function (x, y, z, x1, y1, z1) {
        var x_2 = (x - x1);
        var y_2 = (y - y1);
        var z_2 = (z - z1);
        return Math.sqrt(x_2 * x_2 + y_2 * y_2 + z_2 * z_2);
    },
    eq: function (a, b, maxdiff) {
        if (a === b) {
            return true;
        }
        maxdiff = maxdiff || 0.000000000000001;
        return Math.abs(a - b) < maxdiff;
    }
};

test(function () {
    assertTrue(!G.Util.eq(0.4999999565, 20 / 40, 0.00000001));
    assertTrue(G.Util.eq(0.4999999565, 20 / 40, 0.0000001));
    assertTrue(G.Util.eq(0.5, 20 / 40, 0.001));
});

G.SnapWidget = function (p) {
    var referenceId = G.SnapWidget._id = G.SnapWidget._id++ || 1;
    var stateName = "_snapshotWidgetState-" + referenceId;

    this.p = p || null;
    this.shape = G.SnapWidget.Shape.Endpoint;

    var _visible = false;
    var _lastShape = null;

    this.draw = function (paper) {
        if (!paper[stateName]) {
            paper[stateName] = [];
        }
        this.shape.draw(paper, this, paper[stateName], _visible);
    };

    this.destroy = function (paper) {
        $.each(G.SnapWidget, function (k, shape) {
            if (typeof shape != "object")
                return;
            shape.destroy(paper[stateName]);
        });
        delete paper[stateName];
    };

    this.hide = function (paper) {
        _visible = false;
        $.each(G.SnapWidget.Shape, function (k, shape) {
            shape.hide(paper[stateName]);
        });
    };

    this.show = function (paper) {
        if (this.shape != _lastShape)
            this.hide(paper);
        _visible = true;
        _lastShape = this.shape;
        this.shape.show(paper[stateName]);
    };
};

G.SnapWidget.Shape = {};
G.SnapWidget.Shape.Endpoint = {
    name: "Endpoint",
    _draw: function (paper, widget, state) {
        var left = widget.p.x - SNAP_WIDGET_SIZE / 2;
        var top = widget.p.y - SNAP_WIDGET_SIZE / 2;
        state[this.name] = {};
        state[this.name]._obj = paper.rect(left, top, SNAP_WIDGET_SIZE, SNAP_WIDGET_SIZE)
            .attr({stroke: "red", "stroke-width": 2});
    },
    draw: function (paper, widget, state, visible) {
        if (!visible)
            return;

        if (!state[this.name] || !state[this.name]._obj) {
            this._draw(paper, widget, state);
        }
        state[this.name]._obj.attr({
            x: widget.p.x - SNAP_WIDGET_SIZE / 2,
            y: widget.p.y - SNAP_WIDGET_SIZE / 2
        });
    },
    destroy: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.remove();
            delete state[this.name];
        }
    },
    hide: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.hide();
        }
    },
    show: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.show();
        }
    }
};

G.SnapWidget.Shape.Center = {
    name: "Center",
    _draw: function (paper, widget, state) {
        state[this.name] = {};
        state[this.name]._obj = paper.circle(widget.p.x, widget.p.y, SNAP_WIDGET_SIZE / 2)
            .attr({stroke: "red", "stroke-width": 2});
    },
    draw: function (paper, widget, state, visible) {
        if (!visible)
            return;

        if (!state[this.name] || !state[this.name]._obj) {
            this._draw(paper, widget, state);
        }
        state[this.name]._obj.attr({
            cx: widget.p.x,
            cy: widget.p.y
        });
    },
    destroy: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.remove();
            delete state[this.name];
        }
    },
    hide: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.hide();
        }
    },
    show: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.show();
        }
    }
};

G.SnapWidget.Shape.Intersection = {
    name: "Intersection",
    _draw: function (paper, widget, state) {
        var path = [
            ["M", widget.p.x - SNAP_WIDGET_SIZE / 2, widget.p.y - SNAP_WIDGET_SIZE / 2],
            ["L", widget.p.x + SNAP_WIDGET_SIZE / 2, widget.p.y + SNAP_WIDGET_SIZE / 2 ],
            ["M", widget.p.x + SNAP_WIDGET_SIZE / 2, widget.p.y - SNAP_WIDGET_SIZE / 2],
            ["L", widget.p.x - SNAP_WIDGET_SIZE / 2, widget.p.y + SNAP_WIDGET_SIZE / 2 ]
        ];
        state[this.name] = {};
        state[this.name]._obj = paper.path(path)
            .attr({stroke: "red", "stroke-width": 2});
    },
    draw: function (paper, widget, state, visible) {
        if (!visible)
            return;

        if (!state[this.name] || !state[this.name]._obj) {
            this._draw(paper, widget, state);
        }
        var path = [
            ["M", widget.p.x - SNAP_WIDGET_SIZE / 2, widget.p.y - SNAP_WIDGET_SIZE / 2],
            ["L", widget.p.x + SNAP_WIDGET_SIZE / 2, widget.p.y + SNAP_WIDGET_SIZE / 2 ],
            ["M", widget.p.x + SNAP_WIDGET_SIZE / 2, widget.p.y - SNAP_WIDGET_SIZE / 2],
            ["L", widget.p.x - SNAP_WIDGET_SIZE / 2, widget.p.y + SNAP_WIDGET_SIZE / 2 ]
        ];
        state[this.name]._obj.attr({path: path});
    },
    destroy: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.remove();
            delete state[this.name];
        }
    },
    hide: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.hide();
        }
    },
    show: function (state) {
        if (state && state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.show();
        }
    }
};

G.Point = function () {
    if (arguments.length > 0 && arguments[0] instanceof G.Point) {
        this.x = arguments[0].x;
        this.y = arguments[0].y;
    } else if (arguments.length == 2) {
        this.x = arguments[0];
        this.y = arguments[1];
    } else {
        this.x = 0;
        this.y = 0;
    }
    this.t = null;

    this.destroy = function () {
    };

    this.distance = function (p) {
        return G.Util.distance(this.x, this.y, p.x, p.y);
    };

    this.equals = function (p) {
        return p instanceof  G.Point && G.Util.eq(p.x, this.x) && G.Util.eq(p.y, this.y);
    };

    this.transpose = function () {
        var x, y;
        if (arguments.length == 2) {
            x = arguments[0];
            y = arguments[1];
        } else if (arguments[0] instanceof G.Point) {
            x = arguments[0].x;
            y = arguments[0].y;
        }
        return new G.Point(this.x - x, this.y - y);
    };

    this.rotate = function (angle) {
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        return new G.Point(this.x * cos + this.y * sin, -this.x * sin + this.y * cos);
    };
};

test(function () {
    var point = new G.Point(2, -1);
    assertEquals(new G.Point(3, -4), point.transpose(-1, 3));
});

test(function () {
    var point = new G.Point(Math.sqrt(3), 2);
    assertEquals(new G.Point(3 / 2 * Math.sqrt(3), -.5), point.rotate(Math.PI / 3));
});

G.Point3D = function () {
    if (arguments.length > 0 && arguments[0] instanceof G.Point3D) {
        this.x = arguments[0].x;
        this.y = arguments[0].y;
        this.z = arguments[0].z;
    } else if (arguments.length == 3) {
        this.x = arguments[0];
        this.y = arguments[1];
        this.z = arguments[2];
    } else {
        this.x = 0;
        this.y = 0;
        this.z = 0;
    }

    this.t = null;

    this.destroy = function () {
    };

    this.distance = function (p) {
        return G.Util.distance3d(this.x, this.y, this.z, p.x, p.y, p.z);
    };

    this.equals = function (p) {
        return p instanceof  G.Point3D && G.Util.eq(p.x, this.x) && G.Util.eq(p.y, this.y) && G.Util.eq(p.z, this.z);
    };

    this.transpose = function () {
        var x, y;
        if (arguments.length == 2) {
            x = arguments[0];
            y = arguments[1];
        } else if (arguments[0] instanceof G.Point) {
            x = arguments[0].x;
            y = arguments[0].y;
        }
        return new G.Point(this.x - x, this.y - y);
    };

    this.rotate = function (angle) {
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        return new G.Point(this.x * cos + this.y * sin, -this.x * sin + this.y * cos);
    };

    /**
     *
     * @param basis {G.Basis}
     */
    this.transform = function (basis) {

    }
};


/**
 * Constructs a new Line object. Line defined as general form Ax + By + C = 0
 *
 * @param a
 * @param b
 * @param c
 * @constructor
 */
G.Line = function (a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;

    this.slope = function () {
        return -this.a / this.b;
    };

    this.yIntercept = function () {
        return -this.c / this.b;
    };

    /**
     * Returns intersection point with G.Line, G.Circle or empty array
     * @param obj of type G.Line, G.Circle
     * @returns [G.Point]
     */
    this.intersect = function (obj) {
        if (obj instanceof G.Line) {
            return this.intersectLine(obj);
        }
        if (obj instanceof G.Segment) {
            return obj.intersect(this);
        }
        if (obj instanceof G.Circle) {
            return this.intersectCircle(obj);
        }
        log(obj);
        throw "not implemented for " + obj;
    };

    this.distance = function (point) {
        return Math.abs(this.a * point.x + this.b * point.y + this.c) / Math.sqrt(this.a * this.a + this.b * this.b);
    };

    /**
     * Returns intersection point with the line or 'undefined'
     * @param line
     * @returns [G.Point]
     */
    this.intersectLine = function (line) {
        if (this.b == 0 || line.b == 0) {
            if (G.Util.eq(this.b, line.b)) {
                // parallel
                return [];
            }
            var verticalLine = this.b == 0 ? this : line;
            var otherLine = this.b == 0 ? line : this;

            var x = verticalLine.x(0);
            return [new G.Point(x, otherLine.y(x))];
        } else {
            var a = this.slope();
            var b = line.slope();
            if (G.Util.eq(a, b)) {
                // parallel
                return [];
            }
            var c = this.yIntercept();
            var d = line.yIntercept();

            var x = (d - c) / (a - b);
            var y = (a * d - b * c) / (a - b);

            return [new G.Point(x, y)];
        }
    };

    this.y = function (x) {
        if (this.a == 0) {
            return this.yIntercept();
        }
        return  (-this.a * x - this.c) / this.b;
    };

    this.x = function (y) {
        if (this.b == 0) {
            return -this.c / this.a;
        }
        return (-this.b * y - this.c ) / this.a;
    };

    this.destroy = function () {
    };

    this.translate = function (point) {
        this.c = -this.b * point.y - this.a * point.x;
    };

    this._solveForVertical = function (circ) {
        var a = this.a;
        var c = this.c;
        var a1 = circ.o.x;
        var b1 = circ.o.y;
        var r = circ.radius();
        var x = -c / a;
        var A = 1;
        var B = -2 * b1;
        var C = b1 * b1 - r * r + Math.pow(-c / a - a1, 2);
        var D = B * B - 4 * A * C;

        var y = function (D) {
            if (D < 0) {
                return [];
            }
            if (D == 0) {
                return [-B / (2 * A)];
            }
            D = Math.sqrt(D);

            return [(-B - D) / (2 * A), (-B + D) / (2 * A)];
        };

        return $.map(y(D), function (y) {
            return new G.Point(x, y);
        });
    };

    this._solveForGeneralCase = function (circ) {
        var a = this.a;
        var b = this.b;
        var c = this.c;
        var a1 = circ.o.x;
        var b1 = circ.o.y;
        var r = circ.radius();
        var y = function (x) {
            return -c / b - a / b * x;
        };

        var m = -c / b - b1;
        var A = 1 + a * a / (b * b);
        var B = -2 * ( m * a / b + a1);
        var C = -r * r + a1 * a1 + m * m;

        var D = B * B - 4 * A * C;

        var x = function (D) {
            if (D < 0) {
                return [];
            }
            if (D == 0) {
                return [-B / (2 * A)];
            }
            D = Math.sqrt(D);

            return [(-B - D) / (2 * A), (-B + D) / (2 * A)];
        };

        return $.map(x(D), function (x) {
            return new G.Point(x, y(x));
        });
    };

    this.intersectCircle = function (circ) {
        if (this.b == 0) {
            return this._solveForVertical(circ);
        } else {
            return this._solveForGeneralCase(circ);
        }
    };

    this.equals = function (obj) {
        if (obj instanceof G.Segment) {
            return obj.equals(this);
        }

        if (!(obj instanceof G.Line)) {
            return false;
        }

        var norm = Math.min(this.a / obj.a, this.b / obj.b);

        var ret = false;
        $.each([
            [this.a , obj.a],
            [this.b , obj.b],
            [this.c , obj.c]
        ], function (k, v) {
            if (v[0] == 0 && v[1] == 0) {
                return true;
            }
            if (G.Util.eq(norm, v[0] / v[1], 0.0000001)) {
                ret = true;
                return true;
            }
            ret = false;
            return false;
        });
        return ret;
    };

    this.has = function (p) {
        return G.Util.eq(this.a * p.x + this.b * p.y + this.c, 0, 0.0000001);
    };
};

test(function () {
    var line1 = new G.Line(10.0, 20.0, 30.0);
    var line2 = new G.Line(20.0, 40.0, 60.0);

    assertEquals(line1, line2);
});

test(function () {
    var line1 = new G.Line(10.0, 20.0, 30.0);
    var line2 = new G.Line(20.0001, 40.0, 60.0);

    assertTrue(!line1.equals(line2));
});

test(function () {
    var line = new G.Segment(new G.Point(5, 0), new G.Point(5, 50)).asLine();
    assertEquals(5, line.distance(new G.Point(10, 15)));
    assertEquals(15, line.distance(new G.Point(-10, 500)));
});

test(function () {
    var line = new G.Line(1, -2, 4);
    assertEquals(Math.sqrt(5) / 5, line.distance(new G.Point(1, 2)));
});

G.Segment = function (a, b) {
    this.a = a;
    this.b = b;
    var _line = null;

    this.destroy = function () {
        this.a.destroy();
        this.b.destroy();
    };

    // FIXME: doesn't account limited segment
    this.distance = function () {
        // http://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line#Line_defined_by_two_points
        var x0, y0;
        if (arguments.length == 1) {
            x0 = arguments[0].x;
            y0 = arguments[0].y;
        } else if (arguments.length == 2) {
            x0 = arguments[0];
            y0 = arguments[1];
        }
        var x1 = this.a.x;
        var x2 = this.b.x;
        var y1 = this.a.y;
        var y2 = this.b.y;

        var dx = x2 - x1;
        var dy = y2 - y1;

        return Math.abs(dy * x0 - dx * y0 - x1 * y2 + x2 * y1) / Math.sqrt(dx * dx + dy * dy);
    };

    /**
     * Returns line perpendicular to the current one
     * @param point of the line
     * @returns {Line}
     */
    this.normal = function (point) {
        var dx = this.b.x - this.a.x;
        var dy = this.b.y - this.a.y;

        var normalSegment = new G.Segment(new G.Point(-dy, dx), new G.Point(dy, -dx));

        var line = normalSegment.asLine();
        line.translate(point);

        return  line;
    };

    /**
     * Returns line going through this segment
     * @returns {Line}
     */
    this.asLine = function () {
        var a = this.a.y - this.b.y;
        var b = this.b.x - this.a.x;
        var c = -b * this.a.y - a * this.a.x;

        if (_line == null) {
            _line = new G.Line(a, b, c);
            return _line;
        } else {
            _line.a = a;
            _line.b = b;
            _line.c = c;
            return _line;
        }
    };

    /**
     * Returns intersection point with G.Segment, G.Circle or empty array
     * @param obj of type G.Segment, G.Circle
     * @returns [G.Point]
     */
    this.intersect = function (obj) {
        if (obj instanceof G.Segment) {
            return this.intersectSegment(obj);
        }
        if (obj instanceof G.Line) {
            return this.intersectLine(obj);
        }
        if (obj instanceof G.Circle) {
            return this.intersectCircle(obj);
        }
        log(obj);
        throw "not implemented for " + obj;
    };

    /**
     * Returns intersection point with the segment or empty array
     * @param segment
     * @returns [G.Point]
     */
    this.intersectSegment = function (segment) {
        var p = this.asLine().intersect(segment.asLine());
        if (p.length > 0 && this.has(p[0]) && segment.has(p[0]))
            return p;
        return [];
    };

    /**
     * Returns intersection point with the line or empty array
     * @param line
     * @returns [G.Point]
     */
    this.intersectLine = function (line) {
        var p = this.asLine().intersect(line);
        if (p.length > 0 && this.has(p[0]) && line.has(p[0]))
            return p;
        return [];
    };

    /**
     * Returns intersection points with the circle or empty array
     * @param circle
     * @returns [G.Point]
     */
    this.intersectCircle = function (circle) {
        var self = this;
        var result = [];
        var points = this.asLine().intersectCircle(circle);
        $.each(points, function (k, p) {
            if (self.has(p)) {
                result.push(p);
            }
        });
        return result;
    };

    /**
     * Estimates if the point lies on the segment. However it doesn't check if the point actually belongs to the segment.
     *
     * @param point
     * @returns {Boolean}
     */
    this.has = function (point) {
        if (Math.min(this.a.x, this.b.x) <= point.x && point.x <= Math.max(this.a.x, this.b.x)) {
            if (Math.min(this.a.y, this.b.y) <= point.y && point.y <= Math.max(this.a.y, this.b.y)) {
                return true;
            }
        }
        return false;
    };

    this.equals = function (obj) {
        if (obj instanceof G.Line) {
            return obj.has(this.a) && obj.has(this.b);
        }
        return false;
    };
};

test(function () {
    // two intersecting segments
    var segment1 = new G.Segment(new G.Point(-3, -3), new G.Point(0, 0));
    var segment2 = new G.Segment(new G.Point(-2, 0), new G.Point(-2, -50));
    var intersection = segment1.intersect(segment2);
    assertEquals(new G.Point(-2, -2), intersection[0]);
});

test(function () {
    // two non-intersecting segments
    var segment1 = new G.Segment(new G.Point(-3, -3), new G.Point(0, 0));
    var segment2 = new G.Segment(new G.Point(-2, 0), new G.Point(-2, 50));
    var intersection = segment1.intersect(segment2);
    assertEquals(0, intersection.length);
});

test(function () {
    // line and segment intersecting
    var segment1 = new G.Segment(new G.Point(-3, -3), new G.Point(0, 0));
    var segment2 = new G.Segment(new G.Point(-2, 0), new G.Point(-2, 50));
    var intersection = segment2.asLine().intersect(segment1);
    assertEquals(new G.Point(-2, -2), intersection[0]);
});


test(function () {
    // line and segment non-intersecting
    var segment1 = new G.Segment(new G.Point(-3, -3), new G.Point(0, 0));
    var segment2 = new G.Segment(new G.Point(-2, 0), new G.Point(-2, 50));
    var intersection = segment1.asLine().intersect(segment2);
    assertEquals(0, intersection.length);
});

/**
 *
 * @param a {G.Point}
 * @param b {G.Point}
 * @param t {String}
 * @constructor
 */
G.Axis = function (a, b, t) {
    this.t = t;
    G.Segment.call(this, a, b);
};
G.Axis.prototype = Object.create(G.Segment.prototype);
G.Axis.prototype.constructor = G.Axis.prototype.constructor;

G.Circle = function (o, b) {
    this.o = o;
    this.b = b;

    this.destroy = function () {
        this.o.destroy();
        this.b.destroy();
    };

    this.radius = function () {
        return this.o.distance(this.b);
    };

    this.distance = function (p) {
        var distanceToCenter = G.Util.distance(p.x, p.y, this.o.x, this.o.y);

        return Math.abs(distanceToCenter - this.radius());
    };

    /**
     * Returns intersection point with G.Segment, G.Circle or empty array
     * @param obj of type G.Segment, G.Circle
     * @returns [G.Point]
     */
    this.intersect = function (obj) {
        if (obj instanceof G.Segment) {
            return obj.intersectCircle(this);
        }
        if (obj instanceof G.Circle) {
            return this.intersectCircle(obj);
        }
        if (obj instanceof G.Line) {
            return obj.intersectCircle(this);
        }
        log(obj);
        throw "not implemented for " + obj;
    };

    /**
     * Returns intersection point with G.Circle or empty array
     * @param obj of type G.Circle
     * @returns [G.Point]
     */
    this.intersectCircle = function (circ) {
        // http://math.stackexchange.com/a/256123
        if (this.o.equals(circ.o)) {
            return [];
        }
        var d = this.o.distance(circ.o);
        var r1 = this.radius();
        var r2 = circ.radius();
        if (d > r1 + r2) {
            return [];
        }
        if (d < Math.abs(r1 - r2)) {
            return [];
        }
        var x1 = this.o.x;
        var y1 = this.o.y;
        var x2 = circ.o.x;
        var y2 = circ.o.y;

        var a = 2 * (x2 - x1);
        var b = 2 * (y2 - y1);
        var c = r2 * r2 - r1 * r1 + x1 * x1 - x2 * x2 + y1 * y1 - y2 * y2;

        var line = new G.Line(a, b, c);

        return line.intersect(circ);
    };

    this.equals = function (obj) {
        return obj instanceof G.Circle && this.o.equals(obj.o) && G.Util.eq(this.radius(), obj.radius());
    };
};

test(function () {
    var circle1 = new G.Circle(new G.Point(1, 1), new G.Point(2, 2));
    var circle2 = new G.Circle(new G.Point(1, 1), new G.Point(0, 0));
    assertEquals(circle1, circle2);
});

test(function () {
    var circle1 = new G.Circle(new G.Point(1, 1), new G.Point(2, 2));
    var circle2 = new G.Circle(new G.Point(2, 2), new G.Point(1, 1));
    assertNotEquals(circle1, circle2);
});

G.Vector3D = function (a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
};

/**
 *
 * @param a {G.Point}
 * @param b {G.Point}
 * @constructor
 */
G.Vector = function (a, b) {
    G.Segment.call(this, a, b);
};
G.Vector.prototype = Object.create(G.Segment.prototype);
G.Vector.prototype.constructor = G.Vector;

/**
 *
 * @param origin {G.Point}
 * @param i {G.Vector3D}
 * @param j {G.Vector3D}
 * @param k {G.Vector3D}
 * @constructor
 */
G.Basis = function (origin, i, j, k) {
    this.origin = origin;
    this.i = i || G.Vector3D.i;
    this.j = j || G.Vector3D.j;
    this.k = k || G.Vector3D.k;
};

/**
 * Constructs a new instance of horizontal planar renderer binding to the specified target
 * @param target {String} | {Raphael}
 * @constructor
 */
G.PlanarRenderer = function (target) {
    if (typeof target == "string") {
        this.paper = Raphael(target);
    } else {
        this.paper = target;
    }
    this.cache = "_G.PlanarRenderer_";
    this.basises = [];
};
G.PlanarRenderer.prototype.updatePosition = function (point3d, e, container) {
    var position = $(container).position();

    point3d.x = e.pageX - position.left;
    point3d.y = e.pageY - position.top;
    point3d.z = 0;
};
G.PlanarRenderer.prototype.drawSegment = function (segment) {
    var CACHE = this.cache;
    var paper = this.paper;

    if (!segment[CACHE]) {
        segment[CACHE] = {};
        segment[CACHE]._path = [
            ["M" , segment.a.x, segment.a.y ],
            [ "L" , segment.b.x, segment.b.y]
        ];

        segment[CACHE]._obj = paper.path(segment[CACHE]._path).attr(SOLID_ATTR);
        this.drawPoint(segment.a);
        this.drawPoint(segment.b);

        var _super = segment.destroy;
        segment.destroy = function () {
            segment[CACHE]._obj.remove();
            delete segment[CACHE];
            _super.call(this);
        };
    } else {
        segment[CACHE]._path[0][1] = segment.a.x;
        segment[CACHE]._path[0][2] = segment.a.y;
        segment[CACHE]._path[1][1] = segment.b.x;
        segment[CACHE]._path[1][2] = segment.b.y;

        segment[CACHE]._obj.attr({path: segment[CACHE]._path});
        this.drawPoint(segment.a);
        this.drawPoint(segment.b);
    }
};
G.PlanarRenderer.prototype.drawPoint = function (point) {
    var CACHE = this.cache;
    var paper = this.paper;

    if (!point[CACHE]) {
        var c = point[CACHE] = {};
        c._obj = paper.set();
        c._obj.push(paper.circle(point.x, point.y, POINT_SIZE).attr(SOLID_ATTR));
        c._obj.push(paper.circle(point.x, point.y, SOLID_ATTR["stroke-width"]).attr({fill: "white", stroke: "white"}));
        if (point.t)
            c._obj.push(paper.text(point.x - 10, point.y - 15, point.t).attr({"font-size": 16}));

        var _super = point.destroy;
        point.destroy = function () {
            c._obj.remove();
            delete point[CACHE];
            _super.call(this);
        };
    } else {
        point[CACHE]._obj.attr({
            cx: point.x,
            cy: point.y,
            x: point.x - 10,
            y: point.y - 15,
            text: point.t
        });
    }
};
G.PlanarRenderer.prototype.drawPoint3D = function (point) {
    var CACHE = this.cache;
    var paper = this.paper;

    if (!point[CACHE]) {
        var c = point[CACHE] = {};
        c._obj = paper.set();
        c._obj.push(paper.circle(point.x, point.y, POINT_SIZE).attr(SOLID_ATTR));
        c._obj.push(paper.circle(point.x, point.y, SOLID_ATTR["stroke-width"]).attr({fill: "white", stroke: "white"}));
        c._path = [
            ["M" , point.x, point.y ],
            [ "L" , point.x, 0]
        ];
        c._obj.push(paper.path(c._path).attr(AUX_ATTR));
        if (point.t)
            c._obj.push(paper.text(point.x - 10, point.y - 15, point.t.toLowerCase()).attr({"font-size": 16}));

        var _super = point.destroy;
        point.destroy = function () {
            c._obj.remove();
            delete point[CACHE];
            _super.call(this);
        };
    } else {
        point[CACHE]._obj.attr({
            cx: point.x,
            cy: point.y,
            x: point.x - 10,
            y: point.y - 15,
            text: point.t
        });
    }
};
G.PlanarRenderer.prototype.drawCircle = function (circle) {
    var CACHE = this.cache;
    var paper = this.paper;

    if (!circle[CACHE]) {
        circle[CACHE] = {};
        circle[CACHE]._obj = paper.circle(circle.o.x, circle.o.y, circle.radius()).attr(SOLID_ATTR);
        this.drawPoint(circle.o);
        this.drawPoint(circle.b);

        var _super = circle.destroy;
        circle.destroy = function () {
            circle[CACHE]._obj.remove();
            delete circle[CACHE];
            _super.call(this);
        };
    } else {
        circle[CACHE]._obj.attr({cx: circle.o.x, cy: circle.o.y, r: circle.radius()});
        this.drawPoint(circle.o);
        this.drawPoint(circle.b);
    }
};
G.PlanarRenderer.prototype.drawLine = function (line) {
    if (line.b == 0 && line.a == 0) {
        return; // uninitialized
    }

    var CACHE = this.cache;
    var paper = this.paper;

    if (!line[CACHE]) {
        line[CACHE] = {};

        if (line.b == 0) {
            line[CACHE]._path = [
                ["M" , line.x(0), 0 ],
                [ "L" , line.x(0), paper.height]
            ];
        } else {
            line[CACHE]._path = [
                ["M" , 0, line.y(0) ],
                [ "L" , paper.width, line.y(paper.width)]
            ];
        }

        line[CACHE]._obj = paper.path(line[CACHE]._path).attr(SOLID_ATTR);

        var _super = line.destroy;
        line.destroy = function () {
            line[CACHE]._obj.remove();
            delete line[CACHE];
            _super.call(this);
        };
    } else {
        if (line.b == 0) {
            line[CACHE]._path[0][1] = line.x(0);
            line[CACHE]._path[0][2] = 0;
            line[CACHE]._path[1][1] = line.x(paper.height);
            line[CACHE]._path[1][2] = paper.height;
        } else {
            line[CACHE]._path[0][1] = 0;
            line[CACHE]._path[0][2] = line.y(0);
            line[CACHE]._path[1][1] = paper.width;
            line[CACHE]._path[1][2] = line.y(paper.width);
        }

        line[CACHE]._obj.attr({path: line[CACHE]._path});
    }
};
/**
 *
 * @param axis {G.Axis}
 */
G.PlanarRenderer.prototype.drawAxis = function (axis) {
    var paper = this.paper;

    var obj = paper.set();
    obj.push(paper.path([
        ["M" , axis.a.x, axis.a.y ],
        [ "L" , axis.b.x, axis.b.y]
    ])).attr(AXIS_ATTR);
    obj.push(paper.text(axis.b.x + 5, axis.b.y - 15, axis.t.toLowerCase()).attr({"font-size": 16}));

    var _super = axis.destroy;
    axis.destroy = function () {
        obj.remove();
        _super.call(this);
    };
};
G.PlanarRenderer.prototype.draw = function (obj) {
    if (obj instanceof G.Point) {
        this.drawPoint(obj);
    } else if (obj instanceof G.Point3D) {
        this.drawPoint3D(obj);
    } else if (obj instanceof G.Axis) {
        this.drawAxis(obj)
    } else if (obj instanceof G.Segment) {
        this.drawSegment(obj);
    } else if (obj instanceof G.Circle) {
        this.drawCircle(obj);
    } else if (obj instanceof G.Line) {
        this.drawLine(obj);
    } else if (obj instanceof G.SnapWidget) {
        obj.draw(this.paper)
    }
};

/**
 *
 * @param basis {G.Basis}
 */
G.PlanarRenderer.prototype.addBasis = function (basis) {
    this.basises.push(basis);
};

function pr(obj) {
    alert(JSON.stringify(obj));
}

function log() {
    console.log.apply(console, arguments);
}

function watchdog(obj) {
    if (obj instanceof  G.Segment) {
        console.log("Segment created", obj, obj.asLine());
    } else {
        console.log("Object created", obj);
    }
}

function test(func) {
    if (!TESTS_ENABLED) {
        return;
    }
    window.tests = window.tests || [];
    window.tests.push(func);
}

if (TESTS_ENABLED) {
    function assertTrue(x, message) {
        if (x)
            return;
        console.error("assertion failed", message);
        throw "error";
    }

    function assertEquals(a, b, message) {
        if (typeof a.equals == "function" && a.equals(b)) {
            return;
        } else {
            if (G.Util.eq(a, b))
                return;
        }
        console.error(message || "assertion failed", "Expected:", a, "got:", b);
        throw "error";
    }


    function assertNotEquals(a, b, message) {
        if (typeof a.equals == "function" && !a.equals(b)) {
            return;
        } else {
            if (a != b)
                return;
        }
        console.error(message || "assertion failed", "Expected to be not equal:", a, "and:", b);
        throw "error";
    }

    var run = 0;
    var passed = 0;

    $.each(tests, function (k, test) {
        try {
            run++;
            test.call();
        } catch (e) {
            return;
        }
        passed++;
    });

    console.log("Tests run:", run, "passed:", passed, "failed:", run - passed);
}
