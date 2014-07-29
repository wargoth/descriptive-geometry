var SNAP_THRESHOLD = 10;
var KEYCODE_ESC = 27
var POINT_SIZE = 2;
var SNAP_WIDGET_SIZE = 15;
var attr = {stroke: "black", "stroke-width": 1, "stroke-linecap": "round"};

var $ = jQuery;

var Geometry = G = function (target) {

    target = target || "target";

    var paper = this.paper = Raphael(target);

    var objects = this.objects = [];

    var currentObject = null;

    var cursorP = new G.Point();

    $(this.paper.canvas).click(function (e) {
        if (currentObject == null) {
            var pointA = new G.Point(cursorP);

            var activeControl = $("#controls .active");
            switch (true) {
                case activeControl.hasClass("segment"):
                    var segment = new G.Segment(pointA, cursorP);
                    segment.draw(paper);
                    currentObject = segment;
                    break;
                case activeControl.hasClass("circle"):
                    var circle = new G.Circle(pointA, cursorP);
                    circle.draw(paper);
                    currentObject = circle;
                    break;
                case activeControl.hasClass("point"):
                    var point = new G.Point(pointA);
                    point.draw(paper);
                    objects.push(point);
                    break;
            }
        } else {
            currentObject.b = new G.Point(cursorP);
            currentObject.redraw(paper);
            snapWidget.hide();
            objects.push(currentObject);
            currentObject = null;
        }
    });

    var snapWidget = new G.SnapWidget();

    function snapPoint(point) {
        var snapPoint = null;
        var nearestDistance = SNAP_THRESHOLD + 1;

        var activeControl = $("#controls .active");

        if (activeControl.hasClass("segment") || activeControl.hasClass("circle")) {
            $.each(objects, function (key, obj) {
                function snapToPoint(k, p) {
                    var distance = p.distance(point);
                    if (distance <= SNAP_THRESHOLD && distance < nearestDistance) {
                        nearestDistance = distance;
                        snapWidget.shape = G.SnapWidget.Endpoint;
                        snapPoint = p;
                    }
                }

                if (obj instanceof G.Segment) {
                    $.each([obj.a, obj.b], snapToPoint);
                } else if (obj instanceof G.Point) {
                    snapToPoint(null, obj);
                }
            });
        }

        if (activeControl.hasClass("point")) {
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
                            snapWidget.shape = G.SnapWidget.Intersection;
                            snapPoint = p;
                        }
                    });
                });
            }
        }

        if (snapPoint != null) {
            snapWidget.show();
            snapWidget.p = snapPoint;

            point.x = snapPoint.x;
            point.y = snapPoint.y;
        } else {
            snapWidget.hide();
        }
    }

    $(this.paper.canvas).mousemove(function (e) {
        var $this = $(this);
        var position = $this.position();
        cursorP.x = e.pageX - position.left;
        cursorP.y = e.pageY - position.top;

        snapPoint(cursorP);
        snapWidget.redraw(paper);

        if (currentObject != null) {
            currentObject.b = cursorP;
            currentObject.redraw(paper);
        }
    });

    var controls = {segment: $("#controls .segment"), circle: $("#controls .circle"), point: $("#controls .point")};
    controls.reset = function () {
        $.each(this, function (key, val) {
            if (typeof (val) == "function")
                return;

            val.removeClass("active");
        });
    };

    $.each(controls, function (key, control) {
        if (typeof (control) == "function")
            return;

        control.click(function () {
            controls.reset();
            control.addClass("active");

            if (currentObject != null) {
                currentObject.destroy();
                currentObject = null;
            }
        });
    });

    $(document).keyup(function (e) {
        e = e || window.event;
        var keyCode = e.keyCode || e.which;
        if (keyCode == KEYCODE_ESC) {
            if (currentObject != null) {
                currentObject.destroy();
                currentObject = null;
            }
        }
    });
};

G.prototype.addObject = function (obj) {
    this.objects.push(obj);
    obj.draw(this.paper);
};

G.Util = {
    distance: function (x, y, x1, y1) {
        var x_2 = (x - x1);
        var y_2 = (y - y1);
        return Math.sqrt(x_2 * x_2 + y_2 * y_2);
    }
};

G.SnapWidget = function (p) {
    this.p = p || null;
    this.shape = G.SnapWidget.Endpoint;

    var _state = [];
    var _visible = false;

    this.draw = function (paper) {
        this.shape.draw(paper, this, _state);
    };

    this.redraw = function (paper) {
        this.shape.redraw(paper, this, _state, _visible);
    };

    this.destroy = function () {
        $.each(G.SnapWidget.AllShapes, function (k, shape) {
            shape.destroy(_state);
        });
        _state = null;
    };

    this.hide = function () {
        _visible = false;
        $.each(G.SnapWidget.AllShapes, function (k, shape) {
            shape.hide(_state);
        });
    };

    this.show = function () {
        _visible = true;
        this.shape.show(_state);
    };
};

G.SnapWidget.Endpoint = {
    name: "Endpoint",
    draw: function (paper, widget, state) {
        var left = widget.p.x - SNAP_WIDGET_SIZE / 2;
        var top = widget.p.y - SNAP_WIDGET_SIZE / 2;
        state[this.name] = {};
        state[this.name]._obj = paper.rect(left, top, SNAP_WIDGET_SIZE, SNAP_WIDGET_SIZE)
            .attr({stroke: "red", "stroke-width": 2});
    },
    redraw: function (paper, widget, state, visible) {
        if (!visible)
            return;

        if (!state[this.name] || !state[this.name]._obj) {
            this.draw(paper, widget, state);
        }
        state[this.name]._obj.attr({
            x: widget.p.x - SNAP_WIDGET_SIZE / 2,
            y: widget.p.y - SNAP_WIDGET_SIZE / 2
        });
    },
    destroy: function (state) {
        if (state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.remove();
            state[this.name]._obj = null;
        }
    },
    hide: function (state) {
        if (state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.hide();
        }
    },
    show: function (state) {
        if (state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.show();
        }
    }
};

G.SnapWidget.Intersection = {
    name: "Intersection",
    draw: function (paper, widget, state) {
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
    redraw: function (paper, widget, state, visible) {
        if (!visible)
            return;

        if (!state[this.name] || !state[this.name]._obj) {
            this.draw(paper, widget, state);
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
        if (state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.remove();
            state[this.name]._obj = null;
        }
    },
    hide: function (state) {
        if (state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.hide();
        }
    },
    show: function (state) {
        if (state[this.name] && state[this.name]._obj) {
            state[this.name]._obj.show();
        }
    }
};

G.SnapWidget.AllShapes = [G.SnapWidget.Endpoint, G.SnapWidget.Intersection];

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
    var _obj = null;

    this.draw = function (paper) {
        _obj = paper.circle(this.x, this.y, POINT_SIZE).attr(attr).attr({fill: attr.stroke});
    };

    this.redraw = function (paper) {
        if (_obj == null) {
            this.draw(paper);
        }
        _obj.attr({cx: this.x, cy: this.y});
    };

    this.destroy = function () {
        _obj.remove();
        _obj = null;
    };

    this.distance = function (p) {
        return G.Util.distance(this.x, this.y, p.x, p.y);
    };

    this.equals = function (p) {
        return p.x == this.x && p.y == this.y;
    };
};

/**
 * Constructs a new Line object.
 *
 * @param slope optional
 * @param yIntercept optional
 * @constructor
 */
G.Line = function (a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;

    var _path = null;
    var _obj = null;

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
        if (obj instanceof G.Circle) {
            return this.intersectCircle(obj);
        }
        log(obj);
        throw "not implemented for " + obj;
    };

    /**
     * Returns intersection point with the line or 'undefined'
     * @param line
     * @returns [G.Point]
     */
    this.intersectLine = function (line) {
        if (this.b == 0 || line.b == 0) {
            if (this.b == line.b) {
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
            if (a == b) {
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

    this.draw = function (paper) {
        if (this.b == 0) {
            if (this.a == 0) {
                return; // uninitialized
            }
            _path = [
                ["M" , this.x(0), 0 ],
                [ "L" , this.x(0), paper.height]
            ];
        } else {
            _path = [
                ["M" , 0, this.y(0) ],
                [ "L" , paper.width, this.y(paper.width)]
            ];
        }

        _obj = paper.path(_path).attr(attr);
    };

    this.redraw = function (paper) {
        if (_obj == null) {
            this.draw(paper);
        }
        if (this.b == 0) {
            if (this.a == 0) {
                return; // uninitialized
            }
            _path[0][1] = this.x(0);
            _path[0][2] = 0;
            _path[1][1] = this.x(paper.height);
            _path[1][2] = paper.height;
        } else {
            _path[0][1] = 0;
            _path[0][2] = this.y(0);
            _path[1][1] = paper.width;
            _path[1][2] = this.y(paper.width);
        }

        _obj.attr({path: _path});
    };

    this.destroy = function () {
        _path = null;
        _obj.remove();
        _obj = null;
    };

    this.translate = function (point) {
        this.c = -this.b * point.y - this.a * point.x;
    };

    this._solveForVertical = function (circ) {
        var a = this.a;
        var b = this.b;
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
};

G.Segment = function (a, b) {
    this.a = a;
    this.b = b;
    var _path = null;
    var _obj = null;
    var _line = null;

    this.draw = function (paper) {
        _path = [
            ["M" , this.a.x, this.a.y ],
            [ "L" , this.b.x, this.b.y]
        ];

        _obj = paper.path(_path).attr(attr);
        this.a.draw(paper);
        this.b.draw(paper);
    };

    this.redraw = function (paper) {
        if (_obj == null) {
            this.draw(paper);
        }
        _path[0][1] = this.a.x;
        _path[0][2] = this.a.y;
        _path[1][1] = this.b.x;
        _path[1][2] = this.b.y;

        _obj.attr({path: _path});
        // this.a.redraw(); A never changes
        this.b.redraw(paper);
    };

    this.destroy = function () {
        this.a.destroy();
        this.a = null;
        this.b.destroy();
        this.b = null;
        _path = null;
        _obj.remove();
        _obj = null;
    };

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
};

G.Circle = function (o, b) {
    this.o = o;
    this.b = b;
    var _obj = null;

    this.draw = function (paper) {
        _obj = paper.circle(this.o.x, this.o.y, this.radius()).attr(attr);
        this.o.draw(paper);
        this.b.draw(paper);
    };

    this.radius = function () {
        return o.distance(b);
    };

    this.redraw = function (paper) {
        if (_obj == null) {
            this.draw(paper);
        }
        _obj.attr({r: o.distance(b)});
        this.o.redraw(paper);
        this.b.redraw(paper);
    };

    this.destroy = function () {
        this.o.destroy();
        this.o = null;
        this.b.destroy();
        this.b = null;
        _obj.remove();
        _obj = null;
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
        var x2 = circ.o.x;
        if(x1 - x2 == 0) {
            y = 
        }
    };
};

$(function () {
    var geometry = new Geometry("target");

    var segment = new G.Segment(new G.Point(500, 400), new G.Point(800, 500));
    geometry.addObject(segment);

    var vertical1 = new G.Segment(new G.Point(700, 150), new G.Point(700, 500));
    geometry.addObject(vertical1);

    var vertical2 = new G.Segment(new G.Point(650, 150), new G.Point(650, 700));
    geometry.addObject(vertical2);

    var horizontal = new G.Segment(new G.Point(300, 200), new G.Point(800, 200));
    geometry.addObject(horizontal);

    var circle = new G.Circle(new G.Point(500, 400), new G.Point(500, 600));
    geometry.addObject(circle);
});

function pr(obj) {
    alert(JSON.stringify(obj));
}

function log(obj) {
    console.log(obj);
}
