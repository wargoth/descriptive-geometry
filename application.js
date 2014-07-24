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

        function Point(args) {
            if (args == undefined) {
                this.x = 0;
                this.y = 0;
            } else if (args instanceof Point) {
                this.x = args.x;
                this.y = args.y;
            } else if (args.length == 2) {
                this.x = args[0];
                this.y = args[1];
            }
            this.obj = null;

            this.draw = function (paper) {
                this.obj = paper.circle(this.x, this.y, 2).attr(attr).attr({fill: attr.stroke});
            };

            this.redraw = function () {
                this.obj.attr({cx: this.x, cy: this.y});
            };

            this.destroy = function () {
                this.obj.remove();
                this.obj = null;
            };
        }

        function Line(a, b) {
            this.a = a;
            this.b = b;
            this.path = null;
            this.obj = null;

            this.draw = function (paper) {
                this.path = [
                    ["M" , this.a.x, this.a.y ],
                    [ "L" , this.b.x, this.b.y]
                ];

                this.obj = paper.path(this.path).attr(attr);
                this.a.draw(paper);
                this.b.draw(paper);
            };

            this.redraw = function () {
                this.path[0][1] = this.a.x
                this.path[0][2] = this.a.y;
                this.path[1][1] = this.b.x
                this.path[1][2] = this.b.y;

                this.obj.attr({path: this.path});
                this.a.redraw();
                this.b.redraw();
            };

            this.destroy = function () {
                this.a.destroy();
                this.a = null;
                this.b.destroy();
                this.b = null;
                this.path = null;
                this.obj.remove();
                this.obj = null;
            };
        }

        function Circle(o, b) {
            this.o = o;
            this.b = b;
            this.obj = null;

            this.draw = function (paper) {
                this.obj = paper.circle(this.o.x, this.o.y, MathUtil.distance(o.x, o.y, b.x, b.y)).attr(attr);
                this.o.draw(paper);
                this.b.draw(paper);
            };

            this.redraw = function () {
                this.obj.attr({r: MathUtil.distance(o.x, o.y, b.x, b.y)});
                this.o.redraw();
                this.b.redraw();
            };

            this.destroy = function () {
                this.o.destroy();
                this.o = null;
                this.b.destroy();
                this.b  = null;
                this.obj.remove();
                this.obj = null;
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