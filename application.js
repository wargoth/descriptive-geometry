(function ($) {
    var SNAP_THRESHOLD = 10;
    var KEYCODE_ESC = 27
    var POINT_SIZE = 2;
    var SNAP_WIDGET_SIZE = 15;
    var attr = {stroke: "black", "stroke-width": 1, "stroke-linecap": "round"};

    $(function () {
        var paper = Raphael("target");

        var objects = [];

        var currentObject = null;

        var GeometryUtil = {
            distance: function () {
                var x, y, x1, y1;
                if (arguments.length == 4) {
                    x = arguments[0];
                    y = arguments[1];
                    x1 = arguments[2];
                    y1 = arguments[3];
                } else if (arguments.length = 2) {
                    x = arguments[0].x;
                    y = arguments[0].y;
                    x1 = arguments[1].x;
                    y1 = arguments[1].y;
                }
                var x_2 = (x - x1);
                var y_2 = (y - y1);
                return Math.sqrt(x_2 * x_2 + y_2 * y_2);
            }
        };

        function SnapWidget(p) {
            this.p = p || null;

            var _obj = null;
            var _visible = false;


            this.draw = function () {
                _obj = paper.rect(this.p.x - SNAP_WIDGET_SIZE / 2, this.p.y - SNAP_WIDGET_SIZE / 2, SNAP_WIDGET_SIZE, SNAP_WIDGET_SIZE)
                    .attr({stroke: "red", "stroke-width": 2});
            };

            this.redraw = function () {
                if (!_visible)
                    return;

                if (_obj == null) {
                    this.draw();
                }
                _obj.attr({
                    x: this.p.x - SNAP_WIDGET_SIZE / 2,
                    y: this.p.y - SNAP_WIDGET_SIZE / 2
                });
            };

            this.destroy = function () {
                _obj.remove();
                _obj = null;
            };

            this.hide = function () {
                _visible = false;
                if (_obj != null) {
                    _obj.hide();
                }
            };

            this.show = function () {
                _visible = true;
                if (_obj != null) {
                    _obj.show();
                }
            };
        }

        function Point() {
            if (arguments.length > 0 && arguments[0] instanceof Point) {
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

            this.draw = function () {
                _obj = paper.circle(this.x, this.y, POINT_SIZE).attr(attr).attr({fill: attr.stroke});
            };

            this.redraw = function () {
                if (_obj == null) {
                    this.draw();
                }
                _obj.attr({cx: this.x, cy: this.y});
            };

            this.destroy = function () {
                _obj.remove();
                _obj = null;
            };
        }

        /**
         * Constructs a new Line object.
         *
         * @param slope optional
         * @param yIntercept optional
         * @constructor
         */
        function Line(a, b, c) {
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
             * Returns intersection point with the line or 'undefined'
             * @param line
             * @returns {Point}
             */
            this.intersect = function (line) {
                if (this.b == 0 || line.b == 0) {
                    if (this.b == line.b) {
                        // parallel
                        return undefined;
                    }
                    var verticalLine = this.b == 0 ? this : line;
                    var otherLine = this.b == 0 ? line : this;

                    var x = verticalLine.x(0);
                    return new Point(x, otherLine.y(x));
                } else {
                    var a = this.slope();
                    var b = line.slope();
                    if (a == b) {
                        // parallel
                        return undefined;
                    }
                    var c = this.yIntercept();
                    var d = line.yIntercept();

                    var x = (d - c) / (a - b);
                    var y = (a * d - b * c) / (a - b);

                    return new Point(x, y);
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

            this.draw = function () {
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

            this.redraw = function () {
                if (_obj == null) {
                    this.draw();
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
            }
        }

        function Segment(a, b) {
            this.a = a;
            this.b = b;
            var _path = null;
            var _obj = null;
            var _line = null;

            this.draw = function () {
                _path = [
                    ["M" , this.a.x, this.a.y ],
                    [ "L" , this.b.x, this.b.y]
                ];

                _obj = paper.path(_path).attr(attr);
                this.a.draw();
                this.b.draw();
            };

            this.redraw = function () {
                if (_obj == null) {
                    this.draw();
                }
                _path[0][1] = this.a.x
                _path[0][2] = this.a.y;
                _path[1][1] = this.b.x
                _path[1][2] = this.b.y;

                _obj.attr({path: _path});
                // this.a.redraw(); A never changes
                this.b.redraw();
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

                var normalSegment = new Segment(new Point(-dy, dx), new Point(dy, -dx));

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
                    _line = new Line(a, b, c);
                    log(_line);
                    return _line;
                } else {
                    _line.a = a;
                    _line.b = b;
                    _line.c = c;
                    return _line;
                }
            };
        }

        function Circle(o, b) {
            this.o = o;
            this.b = b;
            var _obj = null;

            this.draw = function () {
                _obj = paper.circle(this.o.x, this.o.y, GeometryUtil.distance(o.x, o.y, b.x, b.y)).attr(attr);
                this.o.draw();
                this.b.draw();
            };

            this.redraw = function () {
                if (_obj == null) {
                    this.draw();
                }
                _obj.attr({r: GeometryUtil.distance(o.x, o.y, b.x, b.y)});
                this.o.redraw();
                this.b.redraw();
            };

            this.destroy = function () {
                this.o.destroy();
                this.o = null;
                this.b.destroy();
                this.b = null;
                _obj.remove();
                _obj = null;
            };
        }

        var cursorP = new Point();

        $(paper.canvas).click(function (e) {
            if (currentObject == null) {
                var pointA = new Point(cursorP);

                var activeControl = $("#controls .active");
                switch (true) {
                    case activeControl.hasClass("segment"):
                        var segment = new Segment(pointA, cursorP);
                        segment.draw();
                        currentObject = segment;
                        break;
                    case activeControl.hasClass("circle"):
                        var circle = new Circle(pointA, cursorP);
                        circle.draw();
                        currentObject = circle;
                        break;
                    case activeControl.hasClass("point"):
                        var point = new Point(pointA);
                        point.draw();
                        break;
                }
            } else {
                currentObject.b = new Point(cursorP);
                currentObject.redraw();
                snapWidget.hide();
                objects.push(currentObject);
                currentObject = null;
            }
        });

        var snapWidget = new SnapWidget();

        function snapPoint(point) {
            var snapPoint = null;
            var nearestDistance = SNAP_THRESHOLD + 1;

            var activeControl = $("#controls .active");

            if(activeControl.hasClass("segment") || activeControl.hasClass("circle")) {
                $.each(objects, function (key, obj) {
                    if (obj instanceof Segment) {
                        $.each([obj.a, obj.b], function (key, p) {
                            var distance = GeometryUtil.distance(p, point);
                            if (distance <= SNAP_THRESHOLD && distance < nearestDistance) {
                                nearestDistance = distance;
                                snapPoint = p;
                            }
                        });
                    }
                });
            }

            if (activeControl.hasClass("point")) {
                var nearestObjects = [];
                $.each(objects, function (key, obj) {
                    if (obj instanceof Segment) {
                        var distance = obj.distance(point);
                        if (distance <= SNAP_THRESHOLD && distance < nearestDistance) {
                            nearestObjects.push(obj);
                        }
                    }
                });
                if(nearestObjects.length > 1) {
                    $.each(nearestObjects, function (key, obj) {

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

        $(paper.canvas).mousemove(function (e) {
            var $this = $(this);
            var position = $this.position();
            cursorP.x = e.pageX - position.left;
            cursorP.y = e.pageY - position.top;

            snapPoint(cursorP);
            snapWidget.redraw();

            if (currentObject != null) {
                currentObject.b = cursorP;
                currentObject.redraw();
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
        })
    });
})(jQuery);

function pr(obj) {
    alert(JSON.stringify(obj));
}

function log(obj) {
    console.log(obj);
}