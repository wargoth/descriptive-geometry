(function ($) {
    $(function () {
        var paper = Raphael("target");

        var currentObject = null;

        var MathUtil = {
            distance: function (x, y, x1, y1) {
                var x_2 = (x - x1);
                var y_2 = (y - y1);
                return Math.sqrt(x_2 * x_2 + y_2 * y_2);
            }
        };

        var attr = {stroke: "black", "stroke-width": 1, "stroke-linecap": "round"};

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

            this.draw = function (paper) {
                _obj = paper.circle(this.x, this.y, 2).attr(attr).attr({fill: attr.stroke});
            };

            this.redraw = function () {
                _obj.attr({cx: this.x, cy: this.y});
            };

            this.destroy = function () {
                _obj.remove();
                _obj = null;
            };
        }

        function Line(a, b) {
            this.a = a;
            this.b = b;
            var _path = null;
            var _obj = null;

            this.draw = function (paper) {
                _path = [
                    ["M" , this.a.x, this.a.y ],
                    [ "L" , this.b.x, this.b.y]
                ];

                _obj = paper.path(_path).attr(attr);
                this.a.draw(paper);
                this.b.draw(paper);
            };

            this.redraw = function () {
                _path[0][1] = this.a.x
                _path[0][2] = this.a.y;
                _path[1][1] = this.b.x
                _path[1][2] = this.b.y;

                _obj.attr({path: _path});
                this.a.redraw();
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

            /**
             * Returns tan ⍺ of the line. Infinity if it's parallel to Y axis, 0 if it's parallel to X axis
             * @returns {*}
             */
            this.slope = function () {
                var dx = (this.b.x - this.a.x);
                if (dx == 0) {
                    return Infinity;
                }
                var dy = (this.b.y - this.a.y);
                return dy / dx;
            };

            /**
             * Returns y-intercept of the line
             * @param m optional slope
             * @param o optional point of the line
             * @returns {*}
             */
            this.yIntercept = function (m, o) {
                m = m || this.slope();
                o = o || this.a;
                if (m == Infinity) {
                    return undefined;
                }
                return (o.y - m * o.x);
            };

            /**
             * Returns intersection point with the line or 'undefined'
             * @param line
             * @returns Point | undefined
             */
            this.intersect = function (line) {
                var a = this.slope();
                var b = line.slope();
                if (a == b) {
                    return undefined;
                }
                var c = this.yIntercept(a);
                var d = line.yIntercept(b);

                var x = (d - c) / (a - b);
                var y = (a * d - b * c) / (a - b);

                return new Point(x, y);
            };

            /**
             * Returns line perpendicular to the current one
             * @param point of the line
             * @returns Ray
             */
            this.normal = function (point) {
                var m = this.slope();
                var newM;
                if (m == 0) {
                    newM = Infinity;
                } else if (m == Infinity) {
                    newM = 0;
                } else {
                    newM = -m;
                }

                var b = this.yIntercept(newM, point);

                return new Ray(start, newM, b);
            };
        }

        function Ray () {

        }

        function Circle(o, b) {
            this.o = o;
            this.b = b;
            var _obj = null;

            this.draw = function (paper) {
                _obj = paper.circle(this.o.x, this.o.y, MathUtil.distance(o.x, o.y, b.x, b.y)).attr(attr);
                this.o.draw(paper);
                this.b.draw(paper);
            };

            this.redraw = function () {
                _obj.attr({r: MathUtil.distance(o.x, o.y, b.x, b.y)});
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

        var pointA = new Point();
        var pointB = new Point();

        $(paper.canvas).click(function (e) {
            var $this = $(this);
            var position = $this.position();

            pointB.x = e.pageX - position.left;
            pointB.y = e.pageY - position.top;

            if (currentObject == null) {
                pointA.x = e.pageX - position.left;
                pointA.y = e.pageY - position.top;

                var activeControl = $("#controls .active");
                switch (true) {
                    case activeControl.hasClass("line"):
                        var line = new Line(pointA, pointB);
                        line.draw(paper);
                        currentObject = line;
                        break;
                    case activeControl.hasClass("circle"):
                        var circle = new Circle(pointA, pointB);
                        circle.draw(paper);
                        currentObject = circle;
                        break;
                    case activeControl.hasClass("point"):
                        var point = new Point(pointA);
                        point.draw(paper);
                        break;
                }
            } else {
                currentObject.b = pointB;
                currentObject = null;
            }
        });

        $(paper.canvas).mousemove(function (e) {
            if (currentObject != null) {
                var $this = $(this);
                var position = $this.position();
                pointB.x = e.pageX - position.left;
                pointB.y = e.pageY - position.top;

                currentObject.b = pointB;
                currentObject.redraw();
            }
        });

        var controls = {line: $("#controls .line"), circle: $("#controls .circle"), point: $("#controls .point")};
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

        var KEYCODE_ESC = 27

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