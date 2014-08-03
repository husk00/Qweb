/*### PATTERN | JAVASCRIPT:CANVAS ###################################################################*/
// Copyright (c) 2010 University of Antwerp, Belgium
// Authors: Tom De Smedt <tom@organisms.be>
// License: BSD (see LICENSE.txt for details).
// http://www.clips.ua.ac.be/pages/pattern

// The NodeBox drawing API for the HTML5 <canvas> element.
// The commands are adopted from NodeBox for OpenGL,
// including a (partial) port from nodebox.graphic.bezier, 
// nodebox.graphics.geometry and nodebox.graphics.shader.

/*##################################################################################################*/

function $(id) {
    /* Returns the element with the given id.
     */
    return document.getElementById(id);
}

function attachEvent(element, name, f) {
    /* Cross-browser attachEvent().
     * Ensures that "this" inside the function f refers to the given element .
     */
    element[name] = Function.closure(element, f);
    if (element.addEventListener) {
        element.addEventListener(name, f, false);
    } else if (element.attachEvent) {
        element.attachEvent("on"+name, element[name]);
    } else {
        element["on"+name] = element[name];
    }
}

Function.closure = function(parent, f) {
    /* Returns the function f, where "this" inside the function refers to the given parent.
     */
    return function() { return f.apply(parent, arguments); };
};

window.width = function() {
    return (window.innerWidth !== undefined)? window.innerWidth : document.documentElement.clientWidth;
};
window.height = function() {
    return (window.innerHeight !== undefined)? window.innerHeight : document.documentElement.clientHeight;
};

/*##################################################################################################*/
// Custom Array functions.

// JavaScript Array object:
// var a = [1,2,3];
// 1 in [1,2,3] => true;
// [1,2,3].indexOf(1) => 0
// [1,2,3].push(4) => [1,2,3,4]
// [1,2,3].pop() => [1,2] 3
// [1,2,3].shift() => 1 [2,3]
// [1,2,3].concat([4,5,6]) => [1,2,3,4,5,6] copy
// [1,2,3].slice(1,2) => [2,3]
// [1,2,3].splice(1,0,11,12) => [1,11,12,2,3]
// [1,2,3].splice(1,2) => [1]
// [1,2,3].join(",") => "1,2,3"

// Additional array functions are invoked with Array.[function].

Array.max = function(array) {
    return Math.max.apply(Math, array);
};
Array.min = function(array) {
    return Math.min.apply(Math, array);
};
Array.sum = function(array) {
    for (var i=0, sum=0; i < array.length; sum+=array[i++]){}; return sum;
};

Array.find = function(array) {
    for (var i=0; i < array.length; i++) { if (match(array[i])) return i; }
};

Array.map = function(array, f) {
    /* Returns a new array with f(value) for each value in the given array.
     */
    var a = []; 
    for (var i=0; i < array.length; i++) { 
        a.push(f(array[i])); 
    } 
    return a;
};

Array.filter = function(array, f) {
    /* Returns a new array with values for which f(value)==true.
     */
    var a = []; 
    for (var i=0; i < array.length; i++) { 
        if (f(array[i])) a.push(array[i]); 
    } 
    return a;
};

Array.enumerate = function(array, f) {
    /* Calls callback(index, value) for each value in the given array.
     */
    for (var i=0; i < array.length; i++) {
        f(i, array[i]);
    }
};

Array.sorted = function(array, reversed) {
    /* Returns a sorted copy of the given array.
     */
    array = array.copy();
    array = array.sort();
    if (reversed) array = array.reverse();
    return array;
};

Array.choice = function(array) {
    /* Returns a random value from the given array (undefined if empty).
     */
    return array[Math.round(Math.random() * (array.length-1))];
};

Array.shuffle = function(array) {
    /* Randomly shuffles the values in the given array.
     */
    var n = array.length;
    var i = n;
    while (i--) {
        var p = parseInt(Math.random() * n);
        var x = array[i];
        array[i] = array[p];
        array[p] = x;
    }
};

Array.range = function(i, j) {
    /* Returns a new array with numeric values from i to j (not including j).
     */
    if (j === undefined) { 
        j = i; 
        i = 0; 
    }
    var a = [];
    for (var k=0; k<j-i; k++) {
        a[k] = i + k;
    }
    return a;
};

/*##################################################################################################*/

/*--- BASE CLASS -----------------------------------------------------------------------------------*/
// JavaScript class inheritance, John Resig (http://ejohn.org/blog/simple-javascript-inheritance).
//
// var Person = Class.extend({
//     init: function(name) {
//         this.name = name;
//     }
// });
//
// var Employee = Person.extend({
//     init: function(name, salary) {
//         this._super(name); // Call Person.init().
//         this.salary = salary;
//     }
// });
//
// var e = new Employee("tom", 10);

(function() {
    var initialized = false;
    var has_super = /xyz/.test(function() { xyz; }) ? /\b_super\b/ : /.*/;
    this.Class = function(){};
    Class.extend = function(properties) {
        // Instantiate base class (create the instance, don't run the init constructor).
        var _super = this.prototype;
        initialized = true; var p = new this(); 
        initialized = false;
        // Copy the properties onto the new prototype.
        for (var k in properties) {
            p[k] = typeof properties[k] == "function" 
                && typeof _super[k] == "function" 
                && has_super.test(properties[k]) ? (function(k, f) { return function() {
                    // If properties[k] is actually a method,
                    // add a _super() method (= same method but on the superclass).
                    var s, r;
                    s = this._super; 
                    this._super = _super[k]; r = f.apply(this, arguments); 
                    this._super = s;
                    return r;
                }; 
            })(k, properties[k]) : properties[k];
        }
        function Class() {
            if (!initialized && this.init) {
                this.init.apply(this, arguments);
            }
        }
        Class.constructor = Class;
        Class.prototype = p;
        // Make the class extendable.
        Class.extend = arguments.callee;
        return Class;
    };
})();

/*##################################################################################################*/

/*--- GEOMETRY -------------------------------------------------------------------------------------*/

Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
}

Math.radians = function(degrees) {
    return degrees / 180 * Math.PI;
}

Math.clamp = function(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

var Point = Class.extend({
    init: function(x, y) {
        this.x = x;
        this.y = y;        
    },
    copy: function() {
        return new Point(this.x, this.y);
    }
});

var Geometry = Class.extend({

    // ROTATION:
    
    angle: function(x0, y0, x1, y1) {
        /* Returns the angle between two points.
         */
        return Math.degrees(Math.atan2(y1-y0, x1-x0));
    },
    
    distance: function(x0, y0, x1, y1) {
        /* Returns the distance between two points.
         */
        return Math.sqrt(Math.pow(x1-x0, 2) + Math.pow(y1-y0, 2));
    },
    
    coordinates: function(x0, y0, distance, angle) {
        /* Returns the location of a point by rotating around origin (x0,y0).
         */
        var x1 = x0 + Math.cos(Math.radians(angle)) * distance;
        var y1 = y0 + Math.sin(Math.radians(angle)) * distance;
        return new Point(x1, y1);
    },

    rotate: function(x, y, x0, y0, angle) {
        /* Returns the coordinates of (x,y) rotated clockwise around origin (x0,y0).
         */
        x -= x0;
        y -= y0;
        var a = Math.cos(Math.radians(angle));
        var b = Math.sin(Math.radians(angle));
        return new Point(
            x*a - y*b + x0, 
            y*a + x*b + y0
        );
    },

    reflect: function(x0, y0, x1, y1, d, a) {
        // Returns the reflection of a point through origin (x0,y0).
        if (d === undefined ) d = 1.0;
        if (a === undefined) a = 180;
        d *= this.distance(x0, y0, x1, y1);
        a += this.angle(x0, y0, x1, y1);
        return this.coordinates(x0, y0, d, a);
    },

    // INTERPOLATION:

    lerp: function(a, b, t) {
        /* Returns the linear interpolation between a and b for time t between 0.0-1.0.
         * For example: lerp(100, 200, 0.5) => 150.
         */
         if (t < 0.0) return a;
         if (t > 1.0) return b;
         return a + (b-a)*t;
    },
    
    smoothstep: function(a, b, x) {
        /* Returns a smooth transition between 0.0 and 1.0 using Hermite interpolation (cubic spline),
         * where x is a number between a and b. The return value will ease (slow down) as x nears a or b.
         * For x smaller than a, returns 0.0. For x bigger than b, returns 1.0.
         */
         if (x < a) return 0.0;
         if (x >=b) return 1.0;
         x = (x-a) / (b-a);
         return x*x * (3-2*x);
    },
    
    // INTERSECTION:

    lineIntersection: function(x1, y1, x2, y2, x3, y3, x4, y4, infinite) {
        /* Determines the intersection point of two lines, or two finite line segments if infinite=False.
         * When the lines do not intersect, returns null.
         */
        // Based on: P. Bourke, http://local.wasp.uwa.edu.au/~pbourke/geometry/lineline2d/
        if (infinite === undefined) infinite = false;
        var ua = (x4-x3) * (y1-y3) - (y4-y3) * (x1-x3);
        var ub = (x2-x1) * (y1-y3) - (y2-y1) * (x1-x3);
        var d  = (y4-y3) * (x2-x1) - (x4-x3) * (y2-y1);        
        // The lines are coincident if (ua == ub && ub == 0).
        // The lines are parallel otherwise.        
        if (d == 0) return null;
        ua /= d;
        ub /= d;
        // Intersection point is within both finite line segments?
        if (!infinite && !(0 <= ua && ua <= 1 && 0 <= ub && ub <= 1)) return null;
        return new Point(
            x1 + ua * (x2-x1),
            y1 + ua * (y2-y1)
        );
    },

    pointInPolygon: function(points, x, y) {
        /* Ray casting algorithm.
         * Determines how many times a horizontal ray starting from the point 
         * intersects with the sides of the polygon. 
         * If it is an even number of times, the point is outside, if odd, inside.
         * The algorithm does not always report correctly when the point is very close to the boundary.
         * The polygon is passed as an array of Points.
         */
        var odd = false;
        var n = points.length;
        for (var i=0; i < n; i++) {
            var j = (i<n-1)? i+1 : 0;
            var x0 = points[i].x;
            var y0 = points[i].y;
            var x1 = points[j].x;
            var y1 = points[j].y;
            if ((y0 < y && y1 >= y) || (y1 < y && y0 >= y)) {
                if (x0 + (y-y0) / (y1-y0) * (x1-x0) < x) {
                    odd = !odd;
                }
            }
        }
        return odd;
    },
    
    Bounds: Class.extend({
        init: function(x, y, width, height) {
            /* Creates a bounding box.
             * The bounding box is an untransformed rectangle that encompasses a shape or group of shapes.
             */
            if (width === undefined) width = Infinity;
            if (height === undefined) height = Infinity;
            // Normalize if width or height is negative:
            if (width < 0) {
                 x+=width; width=-width;
            }
            if (height < 0) {
                y+=height; height=-height;
            }
            this.x = x;
            this.y = y;
            this.width = width ;
            this.height = height;
        },
        
        copy: function() {
            return new Bounds(this.x, this.y, this.width, this.height);
        },
        
        intersects: function(b) {
            /* Return True if a part of the two bounds overlaps.
             */
            return Math.max(this.x, b.x) < Math.min(this.x + this.width, b.x + b.width)
                && Math.max(this.y, b.y) < Math.min(this.y + this.height, b.y + b.height);
        },
        
        intersection: function(b) {
            /* Returns bounds that encompass the intersection of the two.
             * If there is no overlap between the two, null is returned.
             */
            if (!this.intersects(b)) {
                return null;
            }
            var mx = Math.max(this.x, b.x);
            var my = Math.max(this.y, b.y);
            return new Bounds(mx, my, 
                Math.min(this.x + this.width, b.x+b.width) - mx, 
                Math.min(this.y + this.height, b.y+b.height) - my
            );
        },

        union: function(b) {
            /* Returns bounds that encompass the union of the two.
             */
            var mx = Math.min(this.x, b.x);
            var my = Math.min(this.y, b.y);
            return new Bounds(mx, my, 
                Math.max(this.x + this.width, b.x+b.width) - mx, 
                Math.max(this.y + this.height, b.y+b.height) - my
            );
        },
        
        contains: function(pt) {
            /* Returns True if the given point or rectangle falls within the bounds.
             */
            if (pt instanceof Point) {
                return pt.x >= this.x && pt.x <= this.x + this.width
                    && pt.y >= this.y && pt.y <= this.y + this.height                
            }
            if (pt instanceof Bounds) {
                return pt.x >= this.x && pt.x + pt.width <= this.x + this.width
                    && pt.y >= this.y && pt.y + pt.height <= this.y + this.height
            }
            
        }
    })
});

var geometry = new Geometry();

/*##################################################################################################*/

/*--- COLOR ----------------------------------------------------------------------------------------*/

var RGB = "RGB";
var HSB = "HSB";
var HEX = "HEX";

var Color = Class.extend({

//  init: function(r, g, b, a, {base: 1.0, colorspace: RGB})
    init: function(r, g, b, a, options) {
        /* A color with R,G,B,A channels, with channel values ranging between 0.0-1.0.
         * Either takes four parameters (R,G,B,A), three parameters (R,G,B),
         * two parameters (grayscale and alpha) or one parameter (grayscale or Color object).
         * An optional {base: 1.0, colorspace: RGB} can be used with four parameters.
         */
        // One value, another color object.
        if (r instanceof Color) {
            g=r.g; b=r.b; a=r.a; r=r.r;
        // One value, array with R,G,B,A values.
        } else if (r instanceof Array) {
            g=r[1]; b=r[2]; a=r[3]||1; r=r[0];
        // No value or null, transparent black.
        } else if (r === undefined || r == null) {
            r=0; g=0; b=0; a=0;
        // One value, grayscale.
        } else if (g === undefined) {
             a=1; g=r; b=r;
        // Two values, grayscale and alpha.
        } else if (b === undefined) {
             a=g; g=r; b=r;
        // R, G and B.
        } else if (a === undefined) {
            a=1;
        }
        if (options) {
            // Transform to base 1:
            if (options.base !== undefined) {
                r/=options.base; g/=options.base; b/=options.base; a/=options.base;
            }
            // Transform to color space RGB:
            if (options.colorspace == HSB) {
                var rgb = _hsb2rgb(r, g, b); r=rgb[0]; g=rgb[1]; b=rgb[2];
            }
            // Transform to color space HEX:
            if (options.colorspace == HEX) {
                var rgb = _hex2rgb(r); r=rgb[0]; g=rgb[1]; b=rgb[2];
            }            
        }
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    },

    rgb: function() {
        return [this.r, this.g, this.b];
    },
    
    rgba: function() {
        return [this.r, this.g, this.b, this.a];
    },
    
    _get: function() {
        var r = Math.round(this.r * 255);
        var g = Math.round(this.g * 255);
        var b = Math.round(this.b * 255);
        return "rgba("+r+", "+g+", "+b+", "+this.a+")";      
    },
    
    copy: function() {
        return new Color(this);
    },
    
    map: function(options) {
        /* Returns array [R,G,B,A] mapped to the given base,
         * e.g. f0-255 instead of 0.0-1.0 which is useful for setting image pixels.
         * Other values than RGBA can be obtained by setting the colorspace (RGB/HSB/HEX).
         */
        var base = options && options.base || 1.0;
        var colorspace = options && options.colorspace || RGB;
        var r = this.r;
        var g = this.g;
        var b = this.b;
        var a = this.a;
        if (colorspace == HSB) {
            rgb = _rgb2hsb(r, g, b); r=rgb[0]; g=rgb[1]; b=rgb[2];
        }
        if (colorspace == HEX) {
            return _rgb2hex(r, g, b);
        }
        if (base != 1) {
            return [r*base, g*base, b*base, a*base];
        }
        return [r, g, b, a];
    },
    
    rotate: function(angle) {
        /* Returns a new color with it's hue rotated on the RYB color wheel.
         */
        var hsb = _rgb2hsb(this.r, this.g, this.b);
        var hsb = _rotateRYB(hsb[0], hsb[1], hsb[2], angle);
        return new Color(hsb[0], hsb[1], hsb[2], this.a, {"colorspace":HSB});
    }
});

function color(r, g, b, a, options) {
    return new Color(r, g, b, a, options);
}

function background(r, g, b, a) {
    /* Sets the current background color.
     */
    if (r !== undefined) {
        _ctx.state.background = (r instanceof Color)? new Color(r) : new Color(r, g, b, a);
        _ctx._canvas.element.style.backgroundColor = _ctx.state.background._get();
    }
    return _ctx.state.background;
}

function fill(r, g, b, a) {
    /* Sets the current fill color for drawing primitives and paths.
     */
    if (r !== undefined) {
        _ctx.state.fill = (r instanceof Color || r instanceof Gradient)? r.copy() : new Color(r, g, b, a);
    }
    return _ctx.state.fill;
}
function stroke(r, g, b, a) {
    /* Sets the current stroke color.
     */
    if (r !== undefined) {
        _ctx.state.stroke = (r instanceof Color)? r.copy() : new Color(r, g, b, a);
    }
    return _ctx.state.stroke;
}

function nofill() {
    /* No current fill color.
     */
    _ctx.state.fill = null;
}

function nostroke() {
    /* No current stroke color.
     */
    _ctx.state.stroke = null;
}

function strokewidth(width) {
    /* Sets the outline stroke width.
     */
    if (width !== undefined) {
        _ctx.state.strokewidth = width;
    }
    return _ctx.state.strokewidth;
}

var noFill = nofill;
var noStroke = nostroke;
var strokeWidth = strokewidth;

// fill() and stroke() are heavy operations:
// - they are called often,
// - they copy a Color object,
// - they change the state.
//
// This is the main reason that scripts will run (in overall) 2-8 fps slower than in processing.js.

/*--- COLOR SPACE ----------------------------------------------------------------------------------*/
// Transformations between RGB, HSB, HEX color spaces.
// http://www.easyrgb.com/math.php

function _rgb2hex(r, g, b) {
    /* Converts the given R,G,B values to a hexadecimal color string.
     */
    parseHex = function(i) { 
        return ((i == 0)? "00" : (i.length < 2)? "0"+i : i).toString(16).toUpperCase(); 
    }
    return "#"
        + parseHex(Math.round(r * 255)) 
        + parseHex(Math.round(g * 255)) 
        + parseHex(Math.round(b * 255));
}

function _hex2rgb(hex) {
    /* Converts the given hexadecimal color string to R,G,B (between 0.0-1.0).
     */
    hex = hex.replace(/^#/, "");
    if (hex.length < 6) { // hex += hex[-1] * (6-hex.length);
        hex += (new Array(6-hex.length)).join(hex.substr(hex.length-1));
    }
    var r = parseInt(hex.substr(0, 2), 16) / 255;
    var g = parseInt(hex.substr(2, 2), 16) / 255;
    var b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b];
}

function _rgb2hsb(r, g, b) {
    /* Converts the given R,G,B values to H,S,B (between 0.0-1.0).
     */
    var h = 0;
    var s = 0;
    var v = Math.max(r, g, b);
    var d = v - Math.min(r, g, b);
    if (v != 0) {
        s = d / v;
    }
    if (s != 0) {
             if (r == v) { h = 0 + (g-b) / d; } 
        else if (g == v) { h = 2 + (b-r) / d; } 
        else             { h = 4 + (r-g) / d; }
    }
    h = h / 6.0 % 1;
    return [h, s, v];
}

function _hsb2rgb(h, s, v) {
    /* Converts the given H,S,B color values to R,G,B (between 0.0-1.0).
     */
    if (s == 0) {
        return [v, v, v];
    }
    h = h % 1 * 6.0;
    var i = Math.floor(h);
    var f = h - i;
    var x = v * (1-s);
    var y = v * (1-s * f);
    var z = v * (1-s * (1-f));
    if (i > 4) {
        return [v, x, y];
    }
    return [[v,z,x], [y,v,x], [x,v,z], [x,y,v], [z,x,v]][parseInt(i)];
}

function darker(clr, step) {
    /* Returns a copy of the color with a darker brightness.
     */
    if (step === undefined) step = 0.2;
    var hsb = _rgb2hsb(clr.r, clr.g, clr.b);
    var rgb = _hsb2rgb(hsb[0], hsb[1], Math.max(0, hsb[2]-step));
    return new Color(rgb[0], rgb[1], rgb[2], clr.a);
}

function lighter(clr, step) {
    /* Returns a copy of the color with a lighter brightness.
     */
    if (step === undefined) step = 0.2;
    var hsb = _rgb2hsb(clr.r, clr.g, clr.b);
    var rgb = _hsb2rgb(hsb[0], hsb[1], Math.min(1, hsb[2]+step));
    return new Color(rgb[0], rgb[1], rgb[2], clr.a);
}
    
var darken  = darker;
var lighten = lighter;

/*--- COLOR ROTATION -------------------------------------------------------------------------------*/

// Approximation of the RYB color wheel.
// In HSB, colors hues range from 0 to 360, 
// but on the color wheel these values are not evenly distributed. 
// The second tuple value contains the actual value on the wheel (angle).
var _COLORHWEEL = [
    [  0,   0], [ 15,   8], [ 30,  17], [ 45,  26],
    [ 60,  34], [ 75,  41], [ 90,  48], [105,  54],
    [120,  60], [135,  81], [150, 103], [165, 123],
    [180, 138], [195, 155], [210, 171], [225, 187],
    [240, 204], [255, 219], [270, 234], [285, 251],
    [300, 267], [315, 282], [330, 298], [345, 329], [360, 360]
];

function _rotateRYB(h, s, b, angle) {
    /* Rotates the given H,S,B color (0.0-1.0) on the RYB color wheel.
     * The RYB colorwheel is not mathematically precise,
     * but focuses on aesthetically pleasing complementary colors.
     */
    if (angle === undefined) angle = 180;
    h = h * 360 % 360;
    // Find the location (angle) of the hue on the RYB color wheel.
    var x0, y0, x1, y1, a;
    var wheel = _COLORWHEEL;
    for (var i=0; i < wheel.length-1; i++) {
        x0 = wheel[i][0]; x1 = wheel[i+1][0];
        y0 = wheel[i][1]; y1 = wheel[i+1][1];
        if (y0 <= h && h <= y1) {
            a = geometry.lerp(x0, x1, (h-y0) / (y1-y0));
            break;
        }
    }
    // Rotate the angle and retrieve the hue.
    a = (a+angle) % 360;
    for (var i=0; i < wheel.length-1; i++) {
        x0 = wheel[i][0]; x1 = wheel[i+1][0];
        y0 = wheel[i][1]; y1 = wheel[i+1][1];
        if (x0 <= a && a <= x1) {
            h = geometry.lerp(y0, y1, (a-x0) / (x1-x0));
            break;
        }
    }
    return [h/360.0, s, b];
}

function complement(clr) {
    /* Returns the color opposite on the color wheel.
     * The complementary color contrasts with the given color.
     */
    return clr.rotate(180);
}

function analog(clr, angle, d) {
    /* Returns a random adjacent color on the color wheel.
     * Analogous color schemes can often be found in nature.
     */
    if (angle === undefined) angle = 20;
    if (d === undefined) d = 0.1;
    var hsb = _rgb2hsb(clr.r, clr.g, clr.b);
    var hsb = _rotateRYB(hsb[0], hsb[1], hsb[2], Math.random() * 2 * angle - angle);
    hsb[1] *= 1 - Math.random()*2*d-d;
    hsb[2] *= 1 - Math.random()*2*d-d;
    return new Color(hsb[0], hsb[1], hsb[2], clr.a, {"colorspace":HSB});
}

/*--- COLOR MIXIN ----------------------------------------------------------------------------------*/
// Drawing commands like rect() have optional parameters fill and stroke to set the color directly.

// function _colorMixin({fill: Color(), stroke: Color(), strokewidth: 1.0}) 
function _colorMixin(options) {
    var s = _ctx.state;
    var o = options;
    if (options === undefined) {
        return [s.fill, s.stroke, s.strokewidth];
    } else {
        return [
            (o.fill !== undefined)? 
                (o.fill instanceof Color || o.fill instanceof Gradient)? 
                    o.fill : new Color(o.fill) : s.fill,
            (o.stroke !== undefined)? 
                (o.stroke instanceof Color)? 
                    o.stroke : new Color(o.stroke) : s.stroke,
            (o.strokewidth !== undefined)? o.strokewidth : 
                (o.strokeWidth !== undefined)? o.strokeWidth : s.strokewidth
        ];
    }
}

/*--------------------------------------------------------------------------------------------------*/
// Wrappers for _ctx.fill() and _ctx.stroke(), only calling them when necessary.

function _ctx_fill(fill, text) {
    if (fill && (fill.a > 0 || fill.clr1)) {
        // Ignore transparent colors.
        // Avoid switching _ctx.fillStyle() - we can gain up to 5fps:
        var f = fill._get();
        if (_ctx.state._f != f) {
            _ctx.fillStyle = _ctx.state._f = f;
        }
        _ctx.fill();
    }
}

function _ctx_stroke(stroke, strokewidth) {
    if (stroke && stroke.a > 0 && strokewidth > 0) {
        var s = stroke._get();
        if (_ctx.state._s != s) {
            _ctx.strokeStyle = _ctx.state._s = s;
        }
        _ctx.lineWidth = strokewidth;
        _ctx.stroke();
    }
}

/*##################################################################################################*/

/*--- GRADIENT -------------------------------------------------------------------------------------*/

var LINEAR = "linear";
var RADIAL = "radial";

var Gradient = Class.extend({
    
    init: function(clr1, clr2, type, dx, dy, distance, angle) {
        /* A gradient with two colors.
         */
        if (clr1 instanceof Gradient) {
            // One parameter, another gradient object.
            var g=clr1; clr1=g.clr1.copy(); clr2=g.clr2.copy(); type=g.type; dx=g.x; dy=g.y; distance=g.distance; angle=g.angle;
        }
        this.clr1 = (clr1 instanceof Color)? clr1 : new Color(clr1);
        this.clr2 = (clr2 instanceof Color)? clr2 : new Color(clr2);
        this.type = type || LINEAR;
        this.x = dx || 0;
        this.y = dy || 0;
        this.distance = (distance !== undefined)? distance : 100;
        this.angle = angle || 0;
    },
    
    _get: function(dx, dy) {
        // See also BezierPath.draw() for dx and dy:
        // we use the first MOVETO of the path to make the gradient location relative.
        var x = this.x + (dx || 0);
        var y = this.y + (dy || 0);
        if (this.type == LINEAR) {
            var p = geometry.coordinates(x, y, this.distance, this.angle);
            var g = _ctx.createLinearGradient(x, y, p.x, p.y);
        }
        if (this.type == RADIAL) {
            var g = _ctx.createRadialGradient(x, y, 0, x, y, this.distance);
        }
        g.addColorStop(0.0, this.clr1._get());
        g.addColorStop(1.0, this.clr2._get());
        return g;
    },

    copy: function() {
        return new Gradient(this);
    }
});

function gradient(clr1, clr2, type, dx, dy, length, angle) {
    return new Gradient(clr1, clr2, type, dx, dy, length, angle);
}

/*--- SHADOW ---------------------------------------------------------------------------------------*/

function shadow(dx, dy, blur, alpha) {
    /* Sets the current dropshadow, used with all subsequent shapes.
     */
    var s = _ctx.state;
    s.shadow = {
         "dx": (dx !== undefined)? dx : 6,
         "dy": (dy !== undefined)? dy : 6,
       "blur": (blur !== undefined)? blur : 5,
      "alpha": (alpha !== undefined)? alpha : 0.5
    }
    _ctx.shadowOffsetX = s.shadow.dx;
    _ctx.shadowOffsetY = s.shadow.dy;
    _ctx.shadowBlur = s.shadow.blur;  
    _ctx.shadowColor = "rgba(0,0,0," + s.shadow.alpha + ")";
    return s.shadow;
}

function noshadow() {
    _ctx.state.shadow = null;
    _ctx.shadowColor = "transparent";
}

var noShadow = noshadow;

/*##################################################################################################*/

/*--- AFFINE TRANSFORM -----------------------------------------------------------------------------*/

var AffineTransform = Transform = Class.extend({
    
    init: function(transform) {
        /* A geometric transformation in Euclidean space (i.e. 2D)
         * that preserves collinearity and ratio of distance between points.
         * Linear transformations include rotation, translation, scaling, shear.
         */
        if (transform instanceof AffineTransform) {
            this.matrix = transform.matrix.copy();
        } else {
            this.matrix = this.identity();
        }
    },
    
    prepend: function(transform) {
        this.matrix = this._mmult(this.matrix, transform.matrix);
    },
    append: function(transform) {
        this.matrix = this._mmult(transform.matrix, this.matrix);
    },
    concat: function(transform) {
        this.append(transform);
    },
    
    copy: function() {
        return new AffineTransform(this);
    },
    
    _mmult: function(a, b) {
        /* Returns the 3x3 matrix multiplication of A and B.
         * Note that scale(), translate(), rotate() work with premultiplication,
         * e.g. the matrix A followed by B = BA and not AB.
         */
        return [
            a[0]*b[0] + a[1]*b[3], a[0]*b[1] + a[1]*b[4], 0,
            a[3]*b[0] + a[4]*b[3], a[3]*b[1] + a[4]*b[4], 0,
            a[6]*b[0] + a[7]*b[3] + b[6], 
            a[6]*b[1] + a[7]*b[4] + b[7], 1
        ];
    },
    
    invert: function() {
        /* Multiplying a matrix by its inverse produces the identity matrix.
         */
        var m = this.matrix;
        var d = m[0]*m[4] - m[1]*m[3]
        this.matrix = [
             +m[4]/d, -m[1]/d, 0, 
             -m[3]/d, +m[0]/d, 0,
             (m[3]*m[7] - m[4]*m[6]) / d, -(m[0]*m[7] - m[1]*m[6]) / d, 1
        ];
    },
    
    inverse: function() {
        var m = this.copy(); m.invert(); return m;
    },
    
    identity: function() {
        return [1,0,0, 0,1,0, 0,0,1];
    },
    
    scale: function(x, y) {
        if (y === undefined) y = x;
        this.matrix = this._mmult([x,0,0, 0,y,0, 0,0,1], this.matrix);
    },
    
    translate: function(x, y) {
        this.matrix = this._mmult([1,0,0, 0,1,0, x,y,1], this.matrix);
    },
    
    rotate: function(angle) {
        var r = Math.radians(angle);
        var c = Math.cos(r);
        var s = Math.sin(r);
        this.matrix = this._mmult([c,s,0, -s,c,0, 0,0,1], this.matrix);
    },
    
    rotation: function() {
        return (Math.degrees(Math.atan2(this.matrix[1], this.matrix[0])) + 360) % 360;
    },

    
    apply: function(x, y) {
        return this.transform_point(x, y);
    },

    transform_point: function(x, y) {
        /* Returns the new coordinates of the given point (x,y) after transformation.
         */
        if (y === undefined) { y=x.y; x=x.x; } // One parameter, Point object.
        var m = this.matrix;
        return new Point(
            x*m[0] + y*m[3] + m[6], 
            x*m[1] + y*m[4] + m[7]
        );
    },
    
    transform_path: function(path) {
        /* Returns a BezierPath object with the transformation applied.
         */
        var p = new BezierPath();
        for (var i=0; i < path.array.length; i++) {
            var pt = path.array[i];
            if (pt.cmd == "closeto") {
                p.closepath();
            } else if (pt.cmd == MOVETO) {
                pt = this.apply(pt);
                p.moveto(pt.x, pt.y);
            } else if (pt.cmd == LINETO) {
                pt = this.apply(pt);
                p.lineto(pt.x, pt.y);
            } else if (pt.cmd == CURVETO) {
                var h1 = this.apply(pt.ctrl1);
                var h2 = this.apply(pt.ctrl2);
                pt = this.apply(pt);
                p.curveto(h1.x, h1.y, h2.x, h2.y, pt.x, pt.y);
            }
        }
        return p;
    },

    transformPoint: function(x, y) {
        return this.transform_point(x, y);
    },
    transformPath: function(path) {
        return this.transform_path(path);
    },
    
    map: function(points) {
        var a = [];
        for (var i=0; i < points.length; i++) {
            var pt = points[i];
            if (pt instanceof Array) {
                pt = this.apply(pt[0], pt[1]);
            } else {
                pt = this.apply(pt.x, pt.y);
            }
            a.push(pt);
        }
        return a;
    }
});

/*--- TRANSFORMATIONS ------------------------------------------------------------------------------*/
// Unlike NodeBox, all transformations are CORNER-mode and originate from the bottom-left corner.

function push() {
    /* Pushes the transformation state.
     * Subsequent transformations (translate, rotate, scale) remain in effect until pop() is called.
     */
    _ctx.save();
}

function pop() {
    /* Pops the transformation state.
     * This reverts the transformation to before the last push().
     */
    _ctx.restore();
    // Do not reset the color state:
    if (_ctx.state.fill) {
        _ctx.fillStyle = _ctx.state.fill._get();
    }
    if (_ctx.state.stroke) {
        _ctx.strokeStyle = _ctx.state.stroke._get();
    }
}

function translate(x, y) {
    /* By default, the origin of the layer or canvas is at the bottom left.
     * This origin point will be moved by (x,y) pixels.
     */
    _ctx.translate(x, y);
}

function rotate(degrees) {
    /* Rotates the transformation state, i.e. all subsequent drawing primitives are rotated.
     * Rotations work incrementally:
     * calling rotate(60) and rotate(30) sets the current rotation to 90.
     */
    _ctx.rotate(degrees / 180 * Math.PI);
}

function scale(x, y) {
    /* Scales the transformation state.
     */
    if (y === undefined) y = x;
    _ctx.scale(x, y);
}

function reset() {
    /* Resets the transform state of the canvas.
     */
    _ctx.restore();
    _ctx.save();
}

/*##################################################################################################*/

/*--- BEZIER MATH ----------------------------------------------------------------------------------*/
// Thanks to Prof. F. De Smedt at the Vrije Universiteit Brussel.

var Bezier = Class.extend({
    
    // BEZIER MATH:
    
    linePoint: function(t, x0, y0, x1, y1) {
        /* Returns coordinates for the point at t (0.0-1.0) on the line.
         */
        return [
            x0 + t * (x1-x0), 
            y0 + t * (y1-y0)
        ];
    },

    lineLength: function(x0, y0, x1, y1) {
        /* Returns the length of the line.
         */
        var a = Math.pow(Math.abs(x0-x1), 2);
        var b = Math.pow(Math.abs(y0-y1), 2);
        return Math.sqrt(a + b);
    },

    curvePoint: function(t, x0, y0, x1, y1, x2, y2, x3, y3, handles) {
        /* Returns coordinates for the point at t (0.0-1.0) on the curve
         * (de Casteljau interpolation algorithm).
         */
        var dt = 1 - t;
        var x01 = x0*dt + x1*t;
        var y01 = y0*dt + y1*t;
        var x12 = x1*dt + x2*t;
        var y12 = y1*dt + y2*t;
        var x23 = x2*dt + x3*t;
        var y23 = y2*dt + y3*t;
        var h1x = x01*dt + x12*t;
        var h1y = y01*dt + y12*t;
        var h2x = x12*dt + x23*t;
        var h2y = y12*dt + y23*t;
        var x = h1x*dt + h2x*t;
        var y = h1y*dt + h2y*t;
        if (!handles) {
            return [x, y, h1x, h1y, h2x, h2y];
        } else {
            // Include the new handles of pt0 and pt3 (see Bezier.insert_point()).
            return [x, y, h1x, h1y, h2x, h2y, x01, y01, x23, y23];
        }
    },

    curvelength: function(x0, y0, x1, y1, x2, y2, x3, y3, n) {
        /* Returns the length of the curve.
         * Integrates the estimated length of the cubic bezier spline defined by x0, y0, ... x3, y3, 
         * by adding up the length of n linear lines along the curve.
         */
        if (n === undefined) n = 20;
        var length = 0;
        var xi = x0;
        var yi = y0;
        for (var i=0; i < n; i++) {
            var t = (i+1) / n;
            var pt = this.curvePoint(t, x0, y0, x1, y1, x2, y2, x3, y3);
            length += Math.sqrt(
                Math.pow(Math.abs(xi-pt[0]), 2) + 
                Math.pow(Math.abs(yi-pt[1]), 2)
            );
            xi = pt[0];
            yi = pt[1];
        }
        return length;
    },
    
    // BEZIER PATH LENGTH:
    
    segmentLengths: function(path, relative, n) {
        /* Returns an array with the length of each segment in the path.
         * With relative=true, the total length of all segments is 1.0.
         */
        if (n === undefined) n = 20;
        var lengths = [];
        for (var i=0; i < path.array.length; i++) {
            var pt = path.array[i];
            if (i == 0) {
                var close_x = pt.x;
                var close_y = pt.y;
            } else if (pt.cmd == MOVETO) {
                var close_x = pt.x;
                var close_y = pt.y;
                lengths.push(0.0);
            } else if (pt.cmd == CLOSE) {
                lengths.push(this.lineLength(x0, y0, close_x, close_y));
            } else if (pt.cmd == LINETO) {
                lengths.push(this.lineLength(x0, y0, pt.x, pt.y));
            } else if (pt.cmd == CURVETO) {
                lengths.push(this.curvelength(x0, y0, pt.ctrl1.x, pt.ctrl1.y, pt.ctrl2.x, pt.ctrl2.y, pt.x, pt.y, n));
            }
            if (pt.cmd != CLOSE) {
                var x0 = pt.x;
                var y0 = pt.y;
            }
        }
        if (relative == true) {
            var s = Array.sum(lengths);
            if (s > 0) {
                return Array.map(lengths, function(v) { return v/s; });             
            } else {
                return Array.map(lengths, function(v) { return 0.0; });
            }
        }
        return lengths;
    },
    
    length: function(path, segmented, n) {
        /* Returns the approximate length of the path.
         * Calculates the length of each curve in the path using n linear samples.
         * With segmented=true, returns an array with the relative length of each segment (sum=1.0).
         */
        if (n === undefined) n = 20;
        if (!segmented) {
            return sum(this.segmentLengths(path, false, n));
        } else {
            return this.segmentLengths(path, true, n);
        }
    },
    
    // BEZIER PATH POINT:
    
    _locate : function(path, t, segments) {
        /* For a given relative t on the path (0.0-1.0), returns an array [index, t, PathElement],
         * with the index of the PathElement before t, 
         * the absolute time on this segment,
         * the last MOVETO or any subsequent CLOSETO after i.
         */ 
        // Note: during iteration, supplying segmentLengths() yourself is 30x faster.
        if (segments === undefined) segments = this.segmentLengths(path, true);
        for (var i=0; i < path.array.length; i++) {
            var pt = path.array[i];
            if (i == 0 || pt.cmd == MOVETO) {
                var closeto = new Point(pt.x, pt.y);
            }
            if (t <= segments[i] || i == segments.length-1) {
                break;
            }
            t -= segments[i];
        }
        if (segments[i] != 0) t /= segments[i];
        if (i == segments.length-1 && segments[i] == 0) i -= 1;
        return [i, t, closeto];
    },
    
    point: function(path, t, segments) {
        /* Returns the DynamicPathElement at time t on the path.
         * Note: in PathElement, ctrl1 is how the curve started, and ctrl2 how it arrives in this point.
         * Here, ctrl1 is how the curve arrives, and ctrl2 how it continues to the next point.
         */
        var _, i, closeto; _=this._locate(path, t, segments); i=_[0]; t=_[1]; closeto=_[2];
        var x0 = path.array[i].x;
        var y0 = path.array[i].y;
        var pt = path.array[i+1];
        if (pt.cmd == LINETO || pt.cmd == CLOSE) {
            var _pt = (pt.cmd == CLOSE)?
                 this.linePoint(t, x0, y0, closeto.x, closeto.y) :
                 this.linePoint(t, x0, y0, pt.x, pt.y);
            pt = new DynamicPathElement(_pt[0], _pt[1], LINETO);
            pt.ctrl1 = new Point(pt.x, pt.y);
            pt.ctrl2 = new Point(pt.x, pt.y);
        } else if (pt.cmd == CURVETO) {
            var _pt = this.curvePoint(t, x0, y0, pt.ctrl1.x, pt.ctrl1.y, pt.ctrl2.x, pt.ctrl2.y, pt.x, pt.y);
            pt = new DynamicPathElement(_pt[0], _pt[1], CURVETO);
            pt.ctrl1 = new Point(_pt[2], _pt[3]);
            pt.ctrl2 = new Point(_pt[4], _pt[5]);
        }
        return pt;
    }
});

bezier = new Bezier();

/*--- BEZIER PATH ----------------------------------------------------------------------------------*/
// A BezierPath class with lineto(), curveto() and moveto() commands.

var MOVETO  = "moveto";
var LINETO  = "lineto";
var CURVETO = "curveto";
var CLOSE   = "close";

var PathElement = Class.extend({
    
    init: function(x, y, cmd) {
        /* A point in the path, optionally with control handles.
         */
        this.x = x;
        this.y = y;
        this.ctrl1 = new Point(0, 0);
        this.ctrl2 = new Point(0, 0);
        this.radius = 0;
        this.cmd = cmd;        
    },
    
    copy: function() {
        var pt = new PathElement(this.x, this.y, this.cmd);
        pt.ctrl1 = this.ctrl1.copy();
        pt.ctrl2 = this.ctrl2.copy();
        return pt;
    }
});

var DynamicPathElement = PathElement.extend({
    // Not a "fixed" point in the BezierPath, but calculated with BezierPath.point().
});

var BezierPath = Path = Class.extend({
    
    init: function(path) {
        /* A list of PathElements describing the curves and lines that make up the path.
         */
        if (path === undefined) {
            this.array = []; // We can't subclass Array.
        } else if (path instanceof BezierPath) {
            this.array = Array.map(path.array, function(pt) { return pt.copy(); });
        } else if (path instanceof Array) {
            this.array = Array.map(path, function(pt) { return pt.copy(); });
        }
        this._clip = false;
        this._update();
    },
    
    _update: function() {
        this._segments = null;
        this._polygon = null;
    },
    
    copy: function() {
        return new BezierPath(this);
    },
    
    moveto: function(x, y) {
        /* Adds a new point to the path at x, y.
         */
        var pt = new PathElement(x, y, MOVETO);
        pt.ctrl1 = new Point(x, y);
        pt.ctrl2 = new Point(x, y);
        this.array.push(pt);
        this._update();
    },
    
    lineto: function(x, y) {
        /* Adds a line from the previous point to x, y.
         */
        var pt = new PathElement(x, y, LINETO);
        pt.ctrl1 = new Point(x, y);
        pt.ctrl2 = new Point(x, y);
        this.array.push(pt); 
        this._update(); 
    },
    
    curveto: function(x1, y1, x2, y2, x3, y3) { 
        /* Adds a Bezier-curve from the previous point to x3, y3.
         * The curvature is determined by control handles x1, y1 and x2, y2.
         */
        var pt = new PathElement(x3, y3, CURVETO);
        pt.ctrl1 = new Point(x1, y1);
        pt.ctrl2 = new Point(x2, y2);
        this.array.push(pt);
        this._update();
    },
    
    moveTo: function(x, y) { 
        this.moveto(x, y); 
    },
    lineTo: function(x, y) { 
        this.lineto(x, y);
    },
    curveTo: function(x1, y1, x2, y2, x3, y3) { 
        this.curveto(x1, y1, x2, y2, x3, y3); 
    },
    
    closepath: function() {
        /* Adds a line from the previous point to the last MOVETO.
         */
        this.array.push(new PathElement(0, 0, CLOSE));
        this._update();
    },
    
    closePath: function() {
        this.closePath();
    },
    
    rect: function(x, y, width, height) {
        /* Adds a rectangle to the path.
         */
        this.moveto(x, y);
        this.lineto(x+width, y);
        this.lineto(x+width, y+height);
        this.lineto(x, y+height);
        this.lineto(x, y);
    },
    
    ellipse: function(x, y, width, height) {
        /* Adds an ellipse to the path.
         */
        x -= 0.5 * width; // Center origin.
        y -= 0.5 * height;
        var k = 0.5522847498; // kappa = (-1 + sqrt(2)) / 3 * 4 
        var dx = k * 0.5 * width;
        var dy = k * 0.5 * height;
        var x0 = x + 0.5 * width;
        var y0 = y + 0.5 * height;
        var x1 = x + width;
        var y1 = y + height;
        this.moveto(x, y0);
        this.curveto(x, y0-dy, x0-dx, y, x0, y);
        this.curveto(x0+dx, y, x1, y0-dy, x1, y0);
        this.curveto(x1, y0+dy, x0+dx, y1, x0, y1);
        this.curveto(x0-dx, y1, x, y0+dy, x, y0);
        this.closepath();
    },

//  draw: function({fill: Color(), stroke: Color(), strokewidth: 1.0})
    draw: function(options) {
        /* Draws the path.
         */
        _ctx.beginPath();
        if (this.array.length > 0 && this.array[0].cmd != MOVETO) {
            throw "No current point for path (first point must be MOVETO)."
        }
        for (var i=0; i < this.array.length; i++) {
            var pt = this.array[i];
            switch(pt.cmd) {
                case MOVETO:
                    _ctx.moveTo(pt.x, pt.y);
                    break;
                case LINETO: 
                    _ctx.lineTo(pt.x, pt.y);
                    break;
                case CURVETO:
                    _ctx.bezierCurveTo(pt.ctrl1.x, pt.ctrl1.y, pt.ctrl2.x, pt.ctrl2.y, pt.x, pt.y);
                    break;
                case CLOSE: 
                    _ctx.closePath(); 
                    break;
            }
        }
        if (!this._clip) {
            var a = _colorMixin(options); // [fill, stroke, strokewidth]
            _ctx_fill(a[0]);
            _ctx_stroke(a[1], a[2]);
        } else {
            _ctx.clip();
        }
    },
    
    angle: function(t) {
        /* Returns the directional angle at time t (0.0-1.0) on the path.
         */
        // The directed() enumerator is much faster but less precise.
        if (t == 0) {
            var pt0 = this.point(t);
            var pt1 = this.point(t+0.001);
        } else {
            var pt0 = this.point(t-0.001);
            var pt1 = this.point(t);
        }
        return geometry.angle(pt0.x, pt0.y, pt1.x, pt1.y);
    },
    
    point: function(t) {
        /* Returns the DynamicPathElement at time t (0.0-1.0) on the path.
         */
        if (this._segments == null) {
            // Cache the segment lengths for performace.
            this._segments = bezier.length(this, true, 10);
        }
        return bezier.point(this, t, this._segments);
    },
    
    points: function(amount, start, end) {
        /* Returns an array of DynamicPathElements along the path.
         * To omit the last point on closed paths: end=1-1.0/amount
         */
        if (start === undefined) start = 0.0;
        if (end === undefined) end = 1.0;
        if (this.array.length == 0) {
            // Otherwise bezier.point() will raise an error for empty paths.
            return [];
        }
        // The delta value is divided by amount-1, because we also want the last point (t=1.0)
        // If we don't use amount-1, we fall one point short of the end.
        // If amount=4, we want the point at t 0.0, 0.33, 0.66 and 1.0.
        // If amount=2, we want the point at t 0.0 and 1.0.
        var d = (amount > 1)? (end-start) / (amount-1) : (end-start);
        var a = [];
        for (var i=0; i < amount; i++) {
            a.push(this.point(start + d*i));
        }
        return a;
    },
    
    length: function(precision) {
        /* Returns an approximation of the total length of the path.
         */
        if (precision === undefined) precision = 10;
        return bezier.length(this, false, precision);
    },
    
    contains: function(x, y, precision) {
        /* Returns true when point (x,y) falls within the contours of the path.
         */
        if (precision === undefined) precision = 100;
        if (this._polygon == null || 
            this._polygon[1] != precision) {
            this._polygon = [this.points(precision), precision];
        }
        return geometry.pointInPolygon(this._polygon[0], x, y);
    }
});

function drawpath(path, options) {
    /* Draws the given BezierPath (or list of PathElements).
     * The current stroke, strokewidth and fill color are applied.
     */
    if (path instanceof Array) {
        path = new BezierPath(path);
    }
    path.draw(options);
}

function autoclosepath(close) {
    /* Paths constructed with beginpath() and endpath() are automatically closed.
     */
    if (close === undefined) close = true;
    _ctx.state.autoclosepath = close;
}

function beginpath(x, y) { 
    /* Starts a new path at (x,y).
     * The commands moveto(), lineto(), curveto() and closepath() 
     * can then be used between beginpath() and endpath() calls.
     */
    _ctx.state.path = new BezierPath();
    _ctx.state.path.moveto(x, y);
}

function moveto(x, y) { 
    /* Moves the current point in the current path to (x,y).
     */
    _ctx.state.path.moveto(x, y);
}

function lineto(x, y) { 
    /* Draws a line from the current point in the current path to (x,y).
     */
    _ctx.state.path.lineto(x, y);
}

function curveto(x1, y1, x2, y2, x3, y3) { 
    /* Draws a curve from the current point in the current path to (x3,y3).
     * The curvature is determined by control handles x1, y1 and x2, y2.
     */
    _ctx.state.path.curveto(x1, y1, x2, y2, x3, y3);
}

function closepath(x, y) { 
    /* Closes the current path with a straight line to the last MOVETO.
     */
    _ctx.state.path.closepath();
}

function endpath(a) {
    /* Draws and returns the current path.
     * With {"draw"=false}, only returns the path so it can be manipulated and drawn with drawpath().
     */
    var s = _ctx.state;
    if (s.autoclosepath) s.path.closepath();
    if (!a || a.draw) {
        s.path.draw(a);
    }
    var p=s.path; s.path=null;
    return p;
}

var drawPath = drawpath;
var autoClosePath = autoclosepath;
var beginPath = beginpath;
var moveTo = moveto;
var lineTo = lineto;
var curveTo = curveto;
var closePath = closepath;
var endPath = endpath;

/*--- POINT ANGLES ---------------------------------------------------------------------------------*/

function directed(points, callback) {
    /* Calls callback(angle, pt) for each point in the given path.
     * The angle represents the direction of the point on the path.
     * This works with BezierPath, Bezierpath.points, [pt1, pt2, pt2, ...]
     * For example:
     * directed(path.points(30), function(angle, pt) {
     *     push();
     *     translate(pt.x, pt.y);
     *     rotate(angle);
     *     arrow(0, 0, 10);
     *     pop();
     * });
     * This is useful if you want to have shapes following a path.
     * To put text on a path, rotate the angle by +-90 to get the normal (i.e. perpendicular).
     */
    var p = (points instanceof BezierPath)? points.array : points;
    var n = p.length;
    for (var i=0; i<n; i++) {
        var pt = p[i];
        if (0 < i && i < n-1 && pt.cmd && pt.cmd == CURVETO) {
            // For a point on a curve, the control handle gives the best direction.
            // For PathElement (fixed point in BezierPath), ctrl2 tells us how the curve arrives.
            // For DynamicPathElement (returnd from BezierPath.point()), ctrl1 tell how the curve arrives.
            var ctrl = (pt instanceof DynamicPathElement)? pt.ctrl1 : pt.ctrl2;
            var angle = geometry.angle(ctrl.x, ctrl.y, pt.x, pt.y);
        } else if (0 < i && i < n-1 && pt.cmd && pt.cmd == LINETO && p[i-1].cmd == CURVETO) {
            // For a point on a line preceded by a curve, look ahead gives better results.
            var angle = geometry.angle(pt.x, pt.y, p[i+1].x, p[i+1].y);
        } else if (i == 0 && points instanceof BezierPath) {
            // For the first point in a BezierPath, we can calculate a next point very close by.
            var pt1 = points.point(0.001);
            var angle = geometry.angle(pt.x, pt.y, pt1.x, pt1.y);
        } else if (i == n-1 && points instanceof BezierPath) {
            // For the last point in a BezierPath, we can calculate a previous point very close by.
            var pt0 = points.point(0.999);
            var angle = geometry.angle(pt0.x, pt0.y, pt.x, pt.y)
        } else if (i == n-1 && pt instanceof DynamicPathElement && pt.ctrl1.x != pt.x || pt.ctrl1.y != pt.y) {
            // For the last point in BezierPath.points(), use incoming handle (ctrl1) for curves.
            var angle = geometry.angle(pt.ctrl1.x, pt.ctrl1.y, pt.x, pt.y);
        } else if (0 < i) {
            // For any point, look back gives a good result, if enough points are given.
            var angle = geometry.angle(p[i-1].x, p[i-1].y, pt.x, pt.y);
        } else if (i < n-1) {
            // For the first point, the best (only) guess is the location of the next point.
            var angle = geometry.angle(pt.x, pt.y, p[i+1].x, p[i+1].y);
        } else {
            var angle = 0;
        }
        callback(angle, pt);
    }
}

/*--- CLIPPING PATH --------------------------------------------------------------------------------*/

function beginclip(path) {
    /* Enables the given BezierPath as a clipping mask.
       Drawing commands between beginclip() and endclip() are constrained to the shape of the path.
     */
    push();
    path._clip = true;
    drawpath(path);
    path._clip = false;
}

function endclip() {
    pop();
}

var beginClip = beginclip;
var endClip = endclip;

/*##################################################################################################*/

/*--- DRAWING PRIMITIVES ---------------------------------------------------------------------------*/

function line(x0, y0, x1, y1, options) {
    /* Draws a straight line from x0, y0 to x1, y1 with the current stroke color and strokewidth.
     */
    // It is faster to do it directly without creating a BezierPath:
    var a = _colorMixin(options);
    if (a[1] && a[1].a > 0) {
        _ctx.beginPath();
        _ctx.moveTo(x0, y0);
        _ctx.lineTo(x1, y1);
        _ctx_stroke(a[1], a[2]);
    }
}

function rect(x, y, width, height, options) {
    /* Draws a rectangle with the top left corner at x, y.
     * The current stroke, strokewidth and fill color are applied.
     */
    // It is faster to do it directly without creating a BezierPath:
    var a = _colorMixin(options);
    if (a[0] && a[0].a > 0 || a[1] && a[1].a > 0) {
        _ctx.beginPath();
        _ctx.rect(x, y, width, height);
        _ctx_fill(a[0]);
        _ctx_stroke(a[1], a[2]);
    }
}

function triangle(x1, y1, x2, y2, x3, y3, options) {
    /* Draws the triangle created by connecting the three given points.
     * The current stroke, strokewidth and fill color are applied.
     */
    var a = _colorMixin(options);
    if (a[0] && a[0].a > 0 || a[1] && a[1].a > 0) {
        _ctx.beginPath();
        _ctx.moveTo(x1, y1);
        _ctx.lineTo(x2, y2);
        _ctx.lineTo(x3, y3);
        _ctx.closePath();
        _ctx_fill(a[0]);
        _ctx_stroke(a[1], a[2]);
    }
}

function ellipse(x, y, width, height, options) {
    /* Draws an ellipse with the center located at x, y.
     * The current stroke, strokewidth and fill color are applied.
     */
    var p = new BezierPath();
    p.ellipse(x, y, width, height);
    p.draw(options);
}

var oval = ellipse;

function arrow(x, y, width, options) {
    /* Draws an arrow with its tip located at x, y.
     * The current stroke, strokewidth and fill color are applied.
     */
    var head = width * 0.4;
    var tail = width * 0.2;
    var p = new BezierPath();
    p.moveto(x, y);
    p.lineto(x-head, y+head);
    p.lineto(x-head, y+tail);
    p.lineto(x-width, y+tail);
    p.lineto(x-width, y-tail);
    p.lineto(x-head, y-tail);
    p.lineto(x-head, y-head);
    p.closepath();
    p.draw(options);
}

function star(x, y, points, outer, inner, options) {
    /* Draws a star with the given points, outer radius and inner radius.
     * The current stroke, strokewidth and fill color are applied.
     */
    if (points === undefined) points = 20;
    if (outer === undefined) outer = 100;
    if (inner === undefined) inner = 50;
    var p = new BezierPath();
    p.moveto(x, y+outer);
    for (var i=0; i < 2*points+1; i++) {
        var r = (i%2 == 0)? outer : inner;
        var a = Math.PI * i/points;
        p.lineto(x + r*Math.sin(a), y + r*Math.cos(a));
    };
    p.closepath();
    p.draw(options);
}

/*##################################################################################################*/

/*--- IMAGE ----------------------------------------------------------------------------------------*/
// A significant amount of the code here is concerned with preloading and caching images.
// This happens asynchronously. Since there is no wait() or sleep() in JavaScript,
// we set an onload() callback for each image to refine Image properties once it is loaded.

var ImageConstructor = Image;

var ImageCache = Class.extend({
    
    init: function() {
        /* Images must be preloaded using "new ImageConstructor()".
         * We take advantage of this to cache the image for reuse at the same time.
         * Image.draw() will do nothing as long as Image.busy() == true.
         */
        this.cache = {};
        this.busy = 0; // Amount of images still loading.
    },
    
    load: function(url) {
        /* Returns an ImageConstructor for the given URL path, Canvas, or Buffer object.
         * Images from URL are cached for reuse.
         */
        if (this.cache[url]) {
            return this.cache[url]; 
        } else if (url && url.substr && url.substr(0,5) == "http:") {
            // URL path ("http://").
            var src = url;
        } else if (url && url.substr && url.substr(0,5) == "data:") {
            // Data URL ("data:image/png"), for example from Canvas.save().
            var src = url; url=null;
        } else if (url instanceof Canvas || url instanceof OffscreenBuffer) {
            // Canvas + OffscreenBuffer.
            var src = url.save(); url=null;
        } else if (url instanceof HTMLCanvasElement) {
            // <canvas> element.
            url.complete=true; return url;
        } else if (url instanceof Pixels) {
            // Pixels.
            return url._img._img;
        } else if (url instanceof Image) {
            // Image.
            return this.load(url._img);
        } else if (url.src && url.complete) {
            // ImageConstructor.
            var src = url.src; url=null;
        } else {
            throw "Can't load image " + url;
        }
        // Cache images from a http:// source.
        // Procedural images are not cached.
        // However, they do get the onload() method & increment ImageCache.busy.
        // Canvas.draw() will fire once ImageCache.busy==0 (i.e., all images are ready).
        var img = new ImageConstructor();
        img.onerror = function(cache, img) { 
            return function() { 
                cache.busy--;
                _ctx && _ctx._canvas.onerror("Can't load image " + url);
            }}(this, img);
        img.onload = function(cache, img) { 
            return function() { 
                cache.busy--;
                // Set parent Image size:
                var p = img._parent;
                if (p && p.width == null) p.width = img.width;
                if (p && p.height == null) p.height = img.height;
            }}(this, img);        
        this.busy++;
        if (url) {
            this.cache[url] = img;
        }
        img.src = src;
        return img;
    }
});

// Global image cache:
var _imageCache = new ImageCache();

var Image = Class.extend({

//  init: function(url, {x: 0, y: 0, width: null, height: null, alpha: 1.0})
    init: function(url, options) {
        /* A image that can be drawn at a given position.
         */
        var o = options || {};
        this._url = url;
        this._img = _imageCache.load(url);
        this._img._parent = this;
        this.x = o.x || 0;
        this.y = o.y || 0;
        this.width = (o.width !== undefined)? o.width : null;
        this.height = (o.height !== undefined)? o.height : null;
        this.alpha = (o.alpha !== undefined)? o.alpha : 1.0;
        // If no width or height is given (undefined | null),
        // use the dimensions of the source ImageConstructor.
        // If the ImageConstructor is still loading, this happens with a delay (see Images.load()).
        if (this.width == null && this._img.complete) {
            this.width = this._img.width;
        }
        if (this.height == null && this._img.complete) {
            this.height = this._img.height;
        }
    },
    
    copy: function() {
        return new Image(this._url, {
            x: this.x, y: this.y, width: this.width, height: this.height, alpha: this.alpha
        });
    },

//  draw: function({x: 0, y: 0, width: null, height: null, alpha: 1.0})
    draw: function(x, y, options) {
        /* Draws the image.
         * The given parameters (if any) override the image's attributes.
         */
        var o = options || {};
        var w = (o.width !== undefined && o.width != null)? o.width : this.width;
        var h = (o.height !== undefined && o.height != null)? o.height : this.height;
        var a = (o.alpha !== undefined)? o.alpha : this.alpha;
        if (this._img.complete && w && h && a > 0) {
            if (a >= 1.0) {
                _ctx.drawImage(this._img, x || this.x, y || this.y, w, h);
            } else {
                _ctx.globalAlpha = a;
                _ctx.drawImage(this._img, x || this.x, y || this.y, w, h);
                _ctx.globalAlpha = 1.0;
            }
        }
    },
    
    busy: function() {
        return !this._img.complete; // Still loading?
    }
});

function image(img, x, y, options) {
    /* Draws the image at (x,y), scaling it to the given width and height.
     * The image's transparency can be set with alpha (0.0-1.0).
     */
    img = (img instanceof Image)? img : new Image(img);
    if (!options || options.draw != false) {
        img.draw(x, y, options);
    }
    return img;
}

function imagesize(img) {
    /* Returns an array [width, height] with the image dimensions.
     */
    img = (img instanceof Image)? img : new Image(img);
    return [img._img.width, img._img.height];
}

var imageSize = imagesize;

/*##################################################################################################*/

/*--- PIXELS ---------------------------------------------------------------------------------------*/

var Pixels = Class.extend({
    
    init: function(img) {
        /* An array of RGBA color values (0-255) for each pixel in the given image.
         * Pixels.update() must be called to reflect any changes to Pixels.array.
         * The Pixels object can be passed to the image() command.
         * The original image will not be modified.
         */
        img = (img instanceof Image)? img : new Image(img);
        this._img = img;
        this._element = document.createElement("canvas");
        this._element.width = this.width = img._img.width;
        this._element.height = this.height = img._img.height;
        this._ctx = this._element.getContext("2d");
        this._ctx.drawImage(img._img, 0, 0);
        this._data = this._ctx.getImageData(0, 0, this.width, this.height);
        this.array = this._data.data;
    },
    
    copy: function() {
        return new Pixels(this._img);
    },
    
    get: function(i) {
        /* Returns array [R,G,B,A] with channel values between 0-255 from pixel i.
         * var rgba = Pixels.get[i];
         * var clr = new Color(rgba, {base:255});
         */
        i*= 4;
        return [this.array[i+0], this.array[i+1], this.array[i+2], this.array[i+3]]
    },
    
    set: function(i, rgba) {
        /* Sets pixel i to the given array [R,G,B,A] with values 0-255.
         * var clr = new Color(0,0,0,1);
         * Pixels.set(i, clr.map({base:255}));
         */
        i*= 4;
        this.array[i+0] = rgba[0];
        this.array[i+1] = rgba[1];
        this.array[i+2] = rgba[2];
        this.array[i+3] = rgba[3];
    },
    
    map: function(callback) {
        /* Applies a function to each pixel.
         * Function takes a list of R,G,B,A channel values and must return a similar list.
         */
        for (var i=0; i<this.width*this.height; i++) {
            this.set(i, callback(this.get(i)))
        }
    },
    
    update: function() {
        /* Pixels.update() must be called to refresh the image.
         */
        this._ctx.putImageData(this._data, 0, 0);
        this._img = new Image(this._element);
    },
    
    image: function() {
        return this._img;
    }
});

function pixels(img) {
    return new Pixels(img);
}

/*##################################################################################################*/

/*--- FONT -----------------------------------------------------------------------------------------*/

var NORMAL = "normal";
var BOLD   = "bold";
var ITALIC = "italic"

function font(fontname, fontsize, fontweight) {
    /* Sets the current font and/or fontsize.
     */
    if (fontname !== undefined) _ctx.state.fontname = fontname;
    if (fontsize !== undefined) _ctx.state.fontsize = fontsize;
    if (fontweight !== undefined) _ctx.state.fontweight = fontweight;
    return _ctx.state.fontname;
}

function fontsize(fontsize) {
    /* Sets the current fontsize in points.
     */
    if (fontsize !== undefined) _ctx.state.fontsize = fontsize;
    return _ctx.state.fontsize;
}

function fontweight(fontweight) {
    /* Sets the current font weight (BOLD, ITALIC, BOLD+ITALIC).
     */
    if (fontweight !== undefined) _ctx.state.fontweight = fontweight;
    return _ctx.state.fontweight;
}

function lineheight(lineheight) {
    /* Sets the vertical spacing between lines of text.
     * The given size is a relative value: lineheight 1.2 for fontsize 10 means 12.
     */
    if (lineheight !== undefined) _ctx.state.lineheight = lineheight;
    return _ctx.state.lineheight;
}

var fontSize = fontsize;
var fontWeight = fontweight;
var lineHeight = lineheight;

/*--- FONT MIXIN -----------------------------------------------------------------------------------*/
// The text() command has optional parameters font, fontsize, fontweight, bold, italic, lineheight and align.

function _fontMixin(options) {
    var s = _ctx.state;
    var o = options;
    if (options === undefined) {
        return [s.fontname, s.fontsize, s.fontweight, s.lineheight];
    } else {
        return [
            (o.font)? o.font : s.fontname,
            (o.fontsize !== undefined)? o.fontsize : 
                (o.fontSize !== undefined)? o.fontSize : s.fontsize,
            (o.fontweight !== undefined)? o.fontweight : 
                (o.fontWeight !== undefined)? o.fontWeight : s.fontweight,
            (o.lineheight !== undefined)? o.lineheight : 
                (o.lineHeight !== undefined)? o.lineHeight : s.lineheight
        ];
    }
}

/*--- TEXT -----------------------------------------------------------------------------------------*/

function _ctx_font(fontname, fontsize, fontweight) {
    // Wrappers for _ctx.font, only calling it when necessary.
    if (fontweight.length > ITALIC.length && fontweight == BOLD+ITALIC || fontweight == ITALIC+BOLD) {
        fontweight = ITALIC + " " + BOLD;
    }
    _ctx.font = fontweight + " " + fontsize + "px " + fontname;
}

function text(str, x, y, options) {
    /* Draws the string at the given position.
     * Lines of text will be split at \n.
     * The text will be displayed with the current state font(), fontsize(), fontweight().
     */
    var a1 = _colorMixin(options);
    var a2 = _fontMixin(options);
    if (a1[0] && a1[0].a > 0) {
        var f = a1[0]._get();
        if (_ctx.state._fill != f) {
            _ctx.fillStyle = _ctx.state._fill = f;
        }
        _ctx_font(a2[0], a2[1], a2[2]);
        var lines = str.toString().split("\n");
        for (var i=0; i<lines.length; i++) {
            _ctx.fillText(lines[i], x, y + i*a2[1]*a2[3]);
        }
    }
}

function textmetrics(str, options) {
    /* Returns array [width, height] for the given text.
     */
    var a = _fontMixin(options);
    var w = 0;
    _ctx_font(a[0], a[1], a[2]);
    var lines = str.toString().split("\n");
    for (var i=0; i<lines.length; i++) {
        w = Math.max(w, _ctx.measureText(lines[i]).width);
    }
    return [w, a[1] + a[1]*a[3]*(lines.length-1)];
}

function textwidth(str, options) {
    /* Returns the width of the given text.
     */
    return textmetrics(str, options)[0];
}

function textheight(str, options) {
    /* Returns the height of the given text.
     */
    return textmetrics(str, options)[1];
}

var textMetrics = textmetrics;
var textWidth = textwidth;
var textHeight = textheight;

/*##################################################################################################*/

/*--- UTILITY FUNCTIONS ----------------------------------------------------------------------------*/

var _RANDOM_MAP = [90.0, 9.00, 4.00, 2.33, 1.50, 1.00, 0.66, 0.43, 0.25, 0.11, 0.01];

function _rndExp(bias) { 
    if (bias === undefined) bias = 0.5;
    bias = Math.max(0, Math.min(bias, 1)) * 10;
    var i = parseInt(Math.floor(bias)); // bias*10 => index in the _map curve.
    var n = _RANDOM_MAP[i];             // If bias is 0.3, rnd()**2.33 will average 0.3.
    if (bias < 10) {
        n += (_RANDOM_MAP[i+1]-n) * (bias-i);
    }
    return n;
}

function random(v1, v2, bias) {
    /* Returns a number between v1 and v2, including v1 but not v2.
     * The bias (0.0-1.0) represents preference towards lower or higher numbers.
     */
    if (v1 === undefined) v1 = 1.0;
    if (v2 === undefined) {
        v2=v1; v1=0;
    }
    if (bias === undefined) {
        var r = Math.random();
    } else {
        var r = Math.pow(Math.random(), _rndExp(bias));
    }
    return r * (v2-v1) + v1;
}

function grid(cols, rows, colWidth, rowHeight, shuffled) {
    /* Returns an array of Points for the given number of rows and columns.
     * The space between each point is determined by colwidth and colheight.
     */
    if (colWidth === undefined) colWidth = 1;
    if (rowHeight === undefined) rowHeight = 1;
    rows = Array.range(parseInt(rows));
    cols = Array.range(parseInt(cols));
    if (shuffled) {
        Array.shuffle(rows);
        Array.shuffle(cols);
    }
    var a = [];
    for (var y in rows) {
        for (var x in cols) {
            a.push(new Point(x*colWidth, y*rowHeight));
        }
    }
    return a;
}

/*##################################################################################################*/

/*--- MOUSE ----------------------------------------------------------------------------------------*/

function absOffset(element) {
    /* Returns the absolute position of the given element in the browser.
     */
    var x = y = 0;
    if (element.offsetParent) {
        do {
            x += element.offsetLeft;
            y += element.offsetTop;
        } while (element = element.offsetParent);
    }
    return [x,y];
}

// Mouse cursors:
var DEFAULT = "default";
var HIDDEN  = "none";
var CROSS   = "crosshair";
var HAND    = "pointer";
var POINTER = "pointer";
var TEXT    = "text";
var WAIT    = "wait";

var Mouse = Class.extend({
    
    init: function(element) {
        /* Keeps track of the mouse position on the given element.
         */
        this.parent = element; element._mouse=this;
        this.x = 0;
        this.y = 0;
        this.relative_x = this.relativeX = 0;
        this.relative_y = this.relativeY = 0;
        this.pressed = false;
        this.dragged = false;
        this.drag = {
            "x": 0,
            "y": 0,
        };
        var eventDown = function(e) {
            // Create parent onmousedown event (set Mouse.pressed).
            var m = this._mouse;
            m.pressed = true;
            m._x0 = m.x;
            m._y0 = m.y;
        };
        var eventUp = function(e) {
            // Create parent onmouseup event (reset Mouse state).
            var m = this._mouse;
            m.pressed = false;
            m.dragged = false;
            m.drag.x = 0;
            m.drag.y = 0;
        };
        var eventMove = function(e) {
            // Create parent onmousemove event (set Mouse position & drag).
            var m = this._mouse;
            var o1 = document.documentElement || document.body;
            var o2 = absOffset(this);
            if (e.touches !== undefined) {
                // TouchEvent (iPad).
                e.preventDefault();
                m.x = e.touches[0].pageX;
                m.y = e.touches[0].pageY;
            } else {
                // MouseEvent.
                m.x = (e.pageX || (e.clientX + o1.scrollLeft)) - o2[0];
                m.y = (e.pageY || (e.clientY + o1.scrollTop)) - o2[1];
            }
            if (m.pressed) {
                m.dragged = true;
                m.drag.x = m.x - m._x0;
                m.drag.y = m.y - m._y0;
            }
            m.relative_x = m.relativeX = m.x / m.parent.offsetWidth;
            m.relative_y = m.relativeY = m.y / m.parent.offsetHeight;
        };
        // Bind mouse and multi-touch events:
        attachEvent(element, "mousedown" , eventDown);
        attachEvent(element, "touchstart", eventDown);
        attachEvent(element, "mouseup"   , eventUp); 
        attachEvent(element, "touchend"  , eventUp);
        attachEvent(element, "mousemove" , eventMove);
        attachEvent(element, "touchmove" , eventMove);
    },
    
    cursor: function(mode) {
        /* Sets the mouse cursor (DEFAULT, HIDDEN, CROSS, POINTER, TEXT or WAIT).
         */
        if (mode !== undefined) {
            this.parent.style.cursor = mode;
        }
        return this.parent.style.cursor;
    }
});

/*--- CANVAS ---------------------------------------------------------------------------------------*/

window._requestFrame = function(callback, canvas, fps) {
    //var f = window.requestAnimationFrame
    //     || window.webkitRequestAnimationFrame
    //     || window.mozRequestAnimationFrame
    //     || window.oRequestAnimationFrame
    //     || window.msRequestAnimationFrame
    //     || function(callback, element) { return window.setTimeout(callback, 1000 / (fps||100)); };
    var f = function(callback, element) { return window.setTimeout(callback, 1000 / (fps||100)); };
    // When requestFrame() calls Canvas._draw() directly, the "this" keyword will be detached.
    // Make "this" available inside Canvas._draw() by binding it:
    return f(Function.closure(canvas, callback), canvas.element);
};

window._clearFrame = function(id) {
    //var f = window.cancelAnimationFrame
    //     || window.webkitCancelRequestAnimationFrame
    //     || window.mozCancelRequestAnimationFrame
    //     || window.oCancelRequestAnimationFrame
    //     || window.msCancelRequestAnimationFrame
    //     || window.clearTimeout;
    var f = window.clearTimeout;
    return f(id);
};

// Current graphics context.
// It is the Canvas that was last created, OR
// it is the Canvas that is preparing to call Canvas.draw(), OR
// it is the Buffer that has called Buffer.push().
_ctx = null;

var G_vmlCanvasManager; // Needed with excanvas.js

var Canvas = Class.extend({
    
    init: function(element, width, height, options) {
        /* Interface to the HTML5 <canvas> element.
         * Drawing starts when Canvas.run() is called.
         * The draw() method must be overridden with your own drawing commands, which will be executed each frame.
         */
        if (options === undefined) {
            options = {};
        }
        if (!element.getContext && typeof(G_vmlCanvasManager) != "undefined") {
            element = G_vmlCanvasManager.initElement(element);
        }
        if (width !== undefined) {
            element.width = width;
        }
        if (height !== undefined) {
            element.height = height;
        }
        this.element = element; 
        this.element.style["-webkit-tap-highlight-color"] = "rgba(0,0,0,0)";
        this.element._canvas = this;
        this._ctx = this.element.getContext("2d"); _ctx=this._ctx; // Set the current graphics context.
        this._ctx._canvas = this;
        this.mouse = (options.mouse != false)? new Mouse(this.element) : null;
        this.width = this.element.width;
        this.height = this.element.height;
        this.frame = 0;
        this.fps = 0;
        this.dt = 0;
        this._time = {start: null, current: null};
        this._active = false;
        this._widgets = [];
        this.variables = [];
        this._resetState();
    },
        
    _resetState: function() {
        // Initialize color state: current background, current fill, ...
        // The state is applied to each shape when drawn - see _ctx_fill(), _ctx_stroke() and _ctx_font().
        // Drawing commands such as rect() have optional parameters 
        // that can override the state - see _colorMixin().
        _ctx.state = {
                 "path": null,
        "autoclosepath": false,
           "background": null,
                 "fill": new Color(0,0,0,1),
               "stroke": null,
          "strokewidth": 1.0,
               "shadow": null,
             "fontname": "sans-serif",
             "fontsize": 12,
           "fontweight": NORMAL,
           "lineheight": 1.2
        }
    },
    
    _resetWidgets: function() {
        // Resets canvas widgets, removing the variables and <input> elements.
        for (var i=0; i < this._widgets.length; i++) {
            var w = this._widgets[i];
            var e = w.element.parentNode;
            e.parentNode.removeChild(e);
            delete this[w.name];
        }
        var p = $(this.element.id + "_widgets");
        if (p) p.parentNode.removeChild(p);
        this._widgets = [];
        this.variables = [];
    },
    
    size: function(width, height) {
        this.width = this.element.width = width;
        this.height = this.element.height = height;
    },
    
    setup: function() {
        
    },
    
    draw: function() {
        this.clear();
    },
    
    clear: function() {
        /* Clears the previous frame from the canvas.
         */
        this._ctx.clearRect(0, 0, this.width, this.height);
    },
    
    _setup: function() {
        _ctx = this._ctx; // Set the current graphics context.
        push();
        this._resetState();
        try {
            this.setup(this);
        } catch(e) {
            this.onerror(e); throw e;
        }
        pop();
    },
    
    _draw: function() {
        if (!this._active) {
            return;
        }
        var t = new Date;
        this.fps = this.frame * 1000 / (t - this._time.start) || 1;
        this.fps = Math.round(this.fps * 100) / 100;
        this.dt = (t - this._time.current) / 1000;
        this._time.current = t;
        this.frame++;
        _ctx = this._ctx; // Set the current graphics context.
        push();
        this._resetState();
        try {
            this.draw(this);
        } catch(e) {
            this.onerror(e); throw e;
        }
        pop();
        // Schedule the next frame and store its process id:
        this._scheduled = window._requestFrame(this._draw, this);
    },
    
    run: function(fps) {
        /* Starts drawing the canvas.
         * Canvas.setup() will be called once during initialization.
         * Canvas.draw() will be called each frame. 
         * Canvas.clear() needs to be called explicitly to clear the previous frame drawing.
         * Canvas.stop() stops the animation, but doesn't clear the canvas.
         */
        this._active = true;
        this._time.start = new Date();
        this._time.current = this._time.start;
        if (this.frame == 0) {
            this._setup();
        }
        // Delay Canvas.draw() until the cached images are done loading
        // (for example, Image objects created during Canvas.setup()).
        var _preload = function() {
            if (_imageCache.busy > 0) { setTimeout(Function.closure(this, _preload), 10); return; }
            this._draw(); 
        }
        _preload.apply(this);
    },
    
    stop: function() {
        /* Stops the animation.
           When run() is called subsequently, the animation will restart from the first frame.
         */
        if (this._scheduled !== undefined) {
            window._clearFrame(this._scheduled);
        }
        this._active = false;
        this._resetWidgets();
        this.frame = 0;
    },
    
    pause: function() {
        /* Pauses the animation at the current frame.
         */
        window._clearFrame(this._scheduled);
        this._active = false;
    },

    step: function() {
        /* Draws one frame and pauses.
         */
        this.run();
        this.pause();
    },

    image: function() {
        return new Image(this.element, {width: this.width, height: this.height});
    },
    
    save: function() {
        //var w = window.open();
        //w.document.body.innerHTML = "<img src=\"" + Canvas.save() + "\" />";
        return this.element.toDataURL("image/png");
    },
    
    widget: function(variable, type, options) {
        widget(this, variable, type, options);
    },
    
    onerror: function(error) {
        // Called when an error occurs in Canvas.draw() or Canvas.setup().
    },
    
    onprint: function(string) {
        // Called when the print() command is called.
    }
});

function size(width, height) {
    /* Sets the width and the height of the canvas.
     */
    _ctx._canvas.size(width, height);
}

function print() {
    /* Calls Canvas.onprint() with the given arguments joined as a string.
     */
    if (_ctx) _ctx._canvas.onprint(Array.prototype.slice.call(arguments).join(" "));
}

/*##################################################################################################*/

/*--- OFFSCREEN BUFFER -----------------------------------------------------------------------------*/

var OffscreenBuffer = Buffer = Canvas.extend({
    
    init: function(width, height) {
        /* A hidden canvas, useful for preparing procedural images.
         */
        this._ctx_stack = [_ctx];
        this._super(document.createElement("canvas"), width, height, {mouse:false});
        // Do not set the Buffer as current graphics context 
        // (call Buffer.push() explicitly to do this):
        _ctx = this._ctx_stack[0];
    },
    
    _setup: function() {
        this.push();
        this._super();
        this.pop();
    },
    _draw: function() {
        
        this.push();
        this._super();
        this.pop();
    },
        
    push: function() { 
        /* Between push() and pop(), all drawing is done offscreen in OffscreenBuffer.image().
         * The offscreen buffer has its own transformation state,
         * so any translate(), rotate() etc. does not affect the onscreen canvas.
         */
        this._ctx_stack.push(_ctx); _ctx=this._ctx;
    },
    
    pop: function() {
        /* Reverts to the onscreen canvas. 
         * The contents of the offscreen buffer can be retrieved with OffscreenBuffer.image().
         */
        _ctx = this._ctx_stack.pop();
    },
    
    render: function() {
        /* Executes the drawing commands in OffscreenBuffer.draw() offscreen and returns image.
         */
        this.run();
        this.stop();
        return this.image();
    },
    
    reset: function(width, height) {
        if (width !== undefined && height !== undefined) {
            this.clear();
            this.size(width, height);
        }
    }
});

function render(callback, width, height) {
    /* Returns an Image object from a function containing drawing commands (i.e. a procedural image).
     * This is useful when, for example, you need to render filters on paths.
     */
    var buffer = new OffscreenBuffer(width, height);
    buffer.draw = callback;
    return buffer.render();
}

/*--- FILTERS --------------------------------------------------------------------------------------*/

function blur(img, amount) {
    /* Applies a blur filter to the image and returns the blurred image.
     */
    // Source: https://github.com/flother/examples/blob/gh-pages/canvas-blur/v3/canvas-image.js
    if (amount === undefined) amount = 1;
    var buffer = new OffscreenBuffer(img._img.width, img._img.height);
    buffer.draw = function(buffer) {
        buffer._ctx.drawImage(img._img, 0, 0);
        buffer._ctx.globalAlpha = 0.1;
        for (var i=1; i<=amount; i++) {
            for (var y=-1; y<2; y++) {
                for (var x=-1; x<2; x++) {
                    buffer._ctx.drawImage(buffer.element, x, y);
                }
            }
        }
    }
    return buffer.render();
}

// function adjust(img, {hue:0, saturation:1.0, brightness:1.0, contrast:1.0})
function adjust(img, options) {
    /* Applies color adjustment filters to the image and returns the adjusted image.
     *  - hue        : the shift in hue (1.0 is 360 degrees on the color wheel).
     *  - saturation : the intensity of the colors (0.0 is a grayscale image).
     *  - brightness : the overall lightness or darkness (0.0 is a black image).
     *  - contrast   : the difference in brightness between regions.
     */
    var pixels = new Pixels(img);
    var adjust_hue = function(pixels, m) {
        pixels.map(function(p) {
            var hsb = _rgb2hsb(p[0]/255, p[1]/255, p[2]/255);
            var rgb = _hsb2rgb(Math.clamp((hsb[0] + m) % 1, 0, 1), hsb[1], hsb[2]);
            return [rgb[0]*255, rgb[1]*255, rgb[2]*255, p[3]]; 
        });
    }
    var adjust_saturation = function(pixels, m) {
        pixels.map(function(p) {
            var i = (0.3*p[0] + 0.59*p[1] + 0.11*p[2]) * (1-m); 
            return [p[0]*m + i, p[1]*m + i, p[2]*m + i, p[3]]; 
        });
    }
    var adjust_brightness = function(pixels, m) {
        pixels.map(function(p) {
            return [p[0] + m, p[1] + m, p[2] + m, p[3]]; 
        });
    }
    var kernelt_contrast = function(pixels, m) {
        pixels.map(function(p) {
            return [(p[0]-128)*m + 128, (p[1]-128)*m + 128, (p[2]-128)*m + 128, p[3]]; 
        });
    }
    var o = options || {};
    if (o.hue !== undefined)
        adjust_hue(pixels, o.hue);
    if (o.saturation !== undefined && o.saturation != 1)
        adjust_saturation(pixels, o.saturation);
    if (o.brightness !== undefined && o.brightness != 1)
        adjust_brightness(pixels, 255 * (o.brightness-1));
    if (o.contrast !== undefined && o.contrast != 1)
        adjust_contrast(pixels, o.contrast);
    pixels.update();
    return pixels.image();
}

function desaturate(img) {
    /* Returns a grayscale version of the image.
     */
    return adjust(img, {saturation:0});
}

function invert(img) {
    /* Returns an image with inverted colors (e.g. white becomes black).
     */
    var pixels = new Pixels(img);
    pixels.map(function(p) {
        return [255-p[0], 255-p[1], 255-p[2], p[3]];
    });
    pixels.update();
    return pixels.image();
}

/*##################################################################################################*/

/*--- WIDGET ---------------------------------------------------------------------------------------*/

var STRING   = "string";
var NUMBER   = "number";
var BOOLEAN  = "boolean";
var RANGE    = "range";
var LIST     = "list";
var ARRAY    = "array";
var FUNCTION = "function";

// function widget(canvas, variable, type, {parent: null, value: null, min: 0, max: 1, step: 0.01, callback: function(e){}})
function widget(canvas, variable, type, options) {
    /* Creates a widget linked to the given canvas.
     * The type of the widget can be STRING or NUMBER (field), BOOLEAN (checkbox),
     * RANGE (slider), LIST (dropdown list), or FUNCTION (bottom)
     * The value of the widget can be retrieved as canvas.variables[variable] (or canvas.variables.variable).
     * Optionally, a default value can be given. 
     * For lists, this is an array.
     * For sliders, you can also set min, max and step.
     * For functions, an optional callback(event){} must be given.
     */
    var v = variable;
    var o = options || {};
    if (canvas.variables[v] === undefined) {
        var parent = (o && o.parent)? o.parent : $(canvas.element.id + "_widgets");
        if (!parent) {
            // No widget container is given, or exists.
            // Insert a <div id="[canvas.id]_widgets" class="widgets"> after the <canvas> element.
            parent = document.createElement("div");
            parent.id = (canvas.element.id + "_widgets");
            parent.className = "widgets";
            canvas.element.parentNode.insertBefore(parent, canvas.element.nextSibling);
        }
        // Create <input> element with id [canvas.id]_[variable].
        // Create an onchange() that will set the variable to the value of the widget.
        // For FUNCTION, it is an onclick() that will call options.callback(e).
        var id = canvas.element.id + "_" + v;
        var cb = o.callback || function(e) {};
        // <input type="text" id="id" value="" />
        if (type == STRING || type == TEXT) {
            var s = "<input type='text' id='"+v+"' value='"+(o.value||"")+"' />";
            var f = function(e) { canvas.variables[this.id] = this.value; cb(e); };
        // <input type="text" id="id" value="0" />
        } else if (type == NUMBER) {
            var s = "<input type='text' id='"+v+"' value='"+(o.value||0)+"' />";
            var f = function(e) { canvas.variables[this.id] = parseFloat(this.value); cb(e); };
        // <input type="checkbox" id="variable" />
        } else if (type == BOOLEAN) {
            var s = "<input type='checkbox' id='"+v+"'"+((o.value==true)?" checked":"")+" />";
            var f = function(e) { canvas.variables[this.id] = this.checked; cb(e); };
        // <input type="range" id="id" value="0" min="0" max="0" step="0.01" />
        } else if (type == RANGE) {
            var s = "<input type='range' id='"+v+"' value='"+(o.value||0)+"'"
                  + " min='"+(o.min||0)+"' max='"+(o.max||1)+"' step='"+(o.step||0.01)+"' />";
            var f = function(e) { canvas.variables[this.id] = parseFloat(this.value); cb(e); };
        // <select id="id"><option value="value[i]">value[i]</option>...</select>
        } else if (type == LIST || type == ARRAY) {
            var s = "";
            var a = o.value || [];
            for (var i=0; i < a.length; i++) {
                s += "<option value='"+a[i]+"'>"+a[i]+"</option>";
            }
            s = "<select id='"+v+"'>"+s+"</select>";
            f = function(e) { canvas.variables[this.id] = this.options[this.selectedIndex].value; cb(e); };
        // <button id="id" onclick="javascript:options.callback(event)">variable</button>
        } else if (type == FUNCTION) {
            var s = "<button id='"+v+"'>"+v.replace("_"," ")+"</button>";
            var f = cb;
        } else {
            throw "Variable type can be STRING, NUMBER, BOOLEAN, RANGE, LIST or FUNCTION, not '"+type+"'";
        }
        // Wrap the widget in a <span class="widget">.
        // Prepend a <label>variable</label> (except for buttons).
        // Attach the onchange() event.
        // Append to parent container.
        // Append to Canvas._widgets.
        var e = document.createElement("span");
        e.innerHTML = "<span class='label'>" + ((type == FUNCTION)? "&nbsp;" : v.replace("_"," ")) + "</span>" + s;
        e.className = "widget"
        e.lastChild.canvas = canvas;
        if (type != FUNCTION) {
            attachEvent(e.lastChild, "change", f); e.lastChild.change();
        } else {
            attachEvent(e.lastChild, "click", f);
        }
        parent.appendChild(e);
        canvas._widgets.push({
            "name": variable,
            "type": type,
         "element": e.lastChild
        });
    }
}

/*##################################################################################################*/

/*--- <SCRIPT TYPE="TEXT/CANVAS"> ------------------------------------------------------------------*/

attachEvent(window, "load", function() {
    /* Initializes <script type="text/canvas"> elements during window.onload().
     * Optional arguments include: canvas="id" (<canvas> to use), and loop="false" (single frame).
     */
    var e = document.getElementsByTagName("script");
    for (var i=0; i < e.length; i++) {
        if (e[i].type == "text/canvas") {
            var canvas = e[i].getAttribute("canvas");
            if (canvas) {
                // <script type="text/canvas" canvas="id">
                // Render in the <canvas> with the given id.
                canvas = document.getElementById(canvas);
            } else {
                // <script type="text/canvas">
                // Create a new <canvas class="canvas"> element.
                canvas = document.createElement("canvas");
                canvas.className = "canvas";
                canvas.width = 500;
                canvas.height = 500;
                // Add the new <canvas> to the DOM before the <script> element.
                // If the <script> is in the <head>, add it to the end of the document.
                if (e[i].parentNode == document.getElementsByTagName("head")[0]) {
                    document.appendChild(canvas);
                } else {
                    e[i].parentNode.insertBefore(canvas, e[i]);
                }
            }
            // Evaluate the script and bind setup() and draw() to the canvas.
            var setup = function(){};
            var draw = function(){};
            eval(e[i].innerHTML);
            canvas = new Canvas(canvas);
            canvas.draw = draw;
            canvas.setup = setup;
            // <script type="text/canvas" loop="false"> renders a single frame.
            if (e[i].getAttribute("loop") == "false") {
                canvas.step();
            } else {
                canvas.run();
            }
        }
    }
});

/*##################################################################################################*/

/*--- EXPLORER CANVAS ------------------------------------------------------------------------------*/
// http://code.google.com/p/explorercanvas/
// Fallback using VML on IE7 and IE8.

function _IEVersion() {
    if (navigator.appName == "Microsoft Internet Explorer") {
        if (new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})").exec(navigator.userAgent) != null) {
            return parseFloat(RegExp.$1);
        }
    }
}

var ie = _IEVersion();
if (ie && ie < 9) { 
    
// Copyright 2006 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

document.createElement("canvas").getContext||(function(){var s=Math,j=s.round,F=s.sin,G=s.cos,V=s.abs,W=s.sqrt,k=10,v=k/2;function X(){return this.context_||(this.context_=new H(this))}var L=Array.prototype.slice;function Y(b,a){var c=L.call(arguments,2);return function(){return b.apply(a,c.concat(L.call(arguments)))}}var M={init:function(b){if(/MSIE/.test(navigator.userAgent)&&!window.opera){var a=b||document;a.createElement("canvas");a.attachEvent("onreadystatechange",Y(this.init_,this,a))}},init_:function(b){b.namespaces.g_vml_||
b.namespaces.add("g_vml_","urn:schemas-microsoft-com:vml","#default#VML");b.namespaces.g_o_||b.namespaces.add("g_o_","urn:schemas-microsoft-com:office:office","#default#VML");if(!b.styleSheets.ex_canvas_){var a=b.createStyleSheet();a.owningElement.id="ex_canvas_";a.cssText="canvas{display:inline-block;overflow:hidden;text-align:left;width:300px;height:150px}g_vml_\\:*{behavior:url(#default#VML)}g_o_\\:*{behavior:url(#default#VML)}"}var c=b.getElementsByTagName("canvas"),d=0;for(;d<c.length;d++)this.initElement(c[d])},
initElement:function(b){if(!b.getContext){b.getContext=X;b.innerHTML="";b.attachEvent("onpropertychange",Z);b.attachEvent("onresize",$);var a=b.attributes;if(a.width&&a.width.specified)b.style.width=a.width.nodeValue+"px";else b.width=b.clientWidth;if(a.height&&a.height.specified)b.style.height=a.height.nodeValue+"px";else b.height=b.clientHeight}return b}};function Z(b){var a=b.srcElement;switch(b.propertyName){case "width":a.style.width=a.attributes.width.nodeValue+"px";a.getContext().clearRect();
break;case "height":a.style.height=a.attributes.height.nodeValue+"px";a.getContext().clearRect();break}}function $(b){var a=b.srcElement;if(a.firstChild){a.firstChild.style.width=a.clientWidth+"px";a.firstChild.style.height=a.clientHeight+"px"}}M.init();var N=[],B=0;for(;B<16;B++){var C=0;for(;C<16;C++)N[B*16+C]=B.toString(16)+C.toString(16)}function I(){return[[1,0,0],[0,1,0],[0,0,1]]}function y(b,a){var c=I(),d=0;for(;d<3;d++){var f=0;for(;f<3;f++){var h=0,g=0;for(;g<3;g++)h+=b[d][g]*a[g][f];c[d][f]=
h}}return c}function O(b,a){a.fillStyle=b.fillStyle;a.lineCap=b.lineCap;a.lineJoin=b.lineJoin;a.lineWidth=b.lineWidth;a.miterLimit=b.miterLimit;a.shadowBlur=b.shadowBlur;a.shadowColor=b.shadowColor;a.shadowOffsetX=b.shadowOffsetX;a.shadowOffsetY=b.shadowOffsetY;a.strokeStyle=b.strokeStyle;a.globalAlpha=b.globalAlpha;a.arcScaleX_=b.arcScaleX_;a.arcScaleY_=b.arcScaleY_;a.lineScale_=b.lineScale_}function P(b){var a,c=1;b=String(b);if(b.substring(0,3)=="rgb"){var d=b.indexOf("(",3),f=b.indexOf(")",d+
1),h=b.substring(d+1,f).split(",");a="#";var g=0;for(;g<3;g++)a+=N[Number(h[g])];if(h.length==4&&b.substr(3,1)=="a")c=h[3]}else a=b;return{color:a,alpha:c}}function aa(b){switch(b){case "butt":return"flat";case "round":return"round";case "square":default:return"square"}}function H(b){this.m_=I();this.mStack_=[];this.aStack_=[];this.currentPath_=[];this.fillStyle=this.strokeStyle="#000";this.lineWidth=1;this.lineJoin="miter";this.lineCap="butt";this.miterLimit=k*1;this.globalAlpha=1;this.canvas=b;
var a=b.ownerDocument.createElement("div");a.style.width=b.clientWidth+"px";a.style.height=b.clientHeight+"px";a.style.overflow="hidden";a.style.position="absolute";b.appendChild(a);this.element_=a;this.lineScale_=this.arcScaleY_=this.arcScaleX_=1}var i=H.prototype;i.clearRect=function(){this.element_.innerHTML=""};i.beginPath=function(){this.currentPath_=[]};i.moveTo=function(b,a){var c=this.getCoords_(b,a);this.currentPath_.push({type:"moveTo",x:c.x,y:c.y});this.currentX_=c.x;this.currentY_=c.y};
i.lineTo=function(b,a){var c=this.getCoords_(b,a);this.currentPath_.push({type:"lineTo",x:c.x,y:c.y});this.currentX_=c.x;this.currentY_=c.y};i.bezierCurveTo=function(b,a,c,d,f,h){var g=this.getCoords_(f,h),l=this.getCoords_(b,a),e=this.getCoords_(c,d);Q(this,l,e,g)};function Q(b,a,c,d){b.currentPath_.push({type:"bezierCurveTo",cp1x:a.x,cp1y:a.y,cp2x:c.x,cp2y:c.y,x:d.x,y:d.y});b.currentX_=d.x;b.currentY_=d.y}i.quadraticCurveTo=function(b,a,c,d){var f=this.getCoords_(b,a),h=this.getCoords_(c,d),g={x:this.currentX_+
0.6666666666666666*(f.x-this.currentX_),y:this.currentY_+0.6666666666666666*(f.y-this.currentY_)};Q(this,g,{x:g.x+(h.x-this.currentX_)/3,y:g.y+(h.y-this.currentY_)/3},h)};i.arc=function(b,a,c,d,f,h){c*=k;var g=h?"at":"wa",l=b+G(d)*c-v,e=a+F(d)*c-v,m=b+G(f)*c-v,r=a+F(f)*c-v;if(l==m&&!h)l+=0.125;var n=this.getCoords_(b,a),o=this.getCoords_(l,e),q=this.getCoords_(m,r);this.currentPath_.push({type:g,x:n.x,y:n.y,radius:c,xStart:o.x,yStart:o.y,xEnd:q.x,yEnd:q.y})};i.rect=function(b,a,c,d){this.moveTo(b,
a);this.lineTo(b+c,a);this.lineTo(b+c,a+d);this.lineTo(b,a+d);this.closePath()};i.strokeRect=function(b,a,c,d){var f=this.currentPath_;this.beginPath();this.moveTo(b,a);this.lineTo(b+c,a);this.lineTo(b+c,a+d);this.lineTo(b,a+d);this.closePath();this.stroke();this.currentPath_=f};i.fillRect=function(b,a,c,d){var f=this.currentPath_;this.beginPath();this.moveTo(b,a);this.lineTo(b+c,a);this.lineTo(b+c,a+d);this.lineTo(b,a+d);this.closePath();this.fill();this.currentPath_=f};i.createLinearGradient=function(b,
a,c,d){var f=new D("gradient");f.x0_=b;f.y0_=a;f.x1_=c;f.y1_=d;return f};i.createRadialGradient=function(b,a,c,d,f,h){var g=new D("gradientradial");g.x0_=b;g.y0_=a;g.r0_=c;g.x1_=d;g.y1_=f;g.r1_=h;return g};i.drawImage=function(b){var a,c,d,f,h,g,l,e,m=b.runtimeStyle.width,r=b.runtimeStyle.height;b.runtimeStyle.width="auto";b.runtimeStyle.height="auto";var n=b.width,o=b.height;b.runtimeStyle.width=m;b.runtimeStyle.height=r;if(arguments.length==3){a=arguments[1];c=arguments[2];h=g=0;l=d=n;e=f=o}else if(arguments.length==
5){a=arguments[1];c=arguments[2];d=arguments[3];f=arguments[4];h=g=0;l=n;e=o}else if(arguments.length==9){h=arguments[1];g=arguments[2];l=arguments[3];e=arguments[4];a=arguments[5];c=arguments[6];d=arguments[7];f=arguments[8]}else throw Error("Invalid number of arguments");var q=this.getCoords_(a,c),t=[];t.push(" <g_vml_:group",' coordsize="',k*10,",",k*10,'"',' coordorigin="0,0"',' style="width:',10,"px;height:",10,"px;position:absolute;");if(this.m_[0][0]!=1||this.m_[0][1]){var E=[];E.push("M11=",
this.m_[0][0],",","M12=",this.m_[1][0],",","M21=",this.m_[0][1],",","M22=",this.m_[1][1],",","Dx=",j(q.x/k),",","Dy=",j(q.y/k),"");var p=q,z=this.getCoords_(a+d,c),w=this.getCoords_(a,c+f),x=this.getCoords_(a+d,c+f);p.x=s.max(p.x,z.x,w.x,x.x);p.y=s.max(p.y,z.y,w.y,x.y);t.push("padding:0 ",j(p.x/k),"px ",j(p.y/k),"px 0;filter:progid:DXImageTransform.Microsoft.Matrix(",E.join(""),", sizingmethod='clip');")}else t.push("top:",j(q.y/k),"px;left:",j(q.x/k),"px;");t.push(' ">','<g_vml_:image src="',b.src,
'"',' style="width:',k*d,"px;"," height:",k*f,'px;"',' cropleft="',h/n,'"',' croptop="',g/o,'"',' cropright="',(n-h-l)/n,'"',' cropbottom="',(o-g-e)/o,'"'," />","</g_vml_:group>");this.element_.insertAdjacentHTML("BeforeEnd",t.join(""))};i.stroke=function(b){var a=[],c=P(b?this.fillStyle:this.strokeStyle),d=c.color,f=c.alpha*this.globalAlpha;a.push("<g_vml_:shape",' filled="',!!b,'"',' style="position:absolute;width:',10,"px;height:",10,'px;"',' coordorigin="0 0" coordsize="',k*10," ",k*10,'"',' stroked="',
!b,'"',' path="');var h={x:null,y:null},g={x:null,y:null},l=0;for(;l<this.currentPath_.length;l++){var e=this.currentPath_[l];switch(e.type){case "moveTo":a.push(" m ",j(e.x),",",j(e.y));break;case "lineTo":a.push(" l ",j(e.x),",",j(e.y));break;case "close":a.push(" x ");e=null;break;case "bezierCurveTo":a.push(" c ",j(e.cp1x),",",j(e.cp1y),",",j(e.cp2x),",",j(e.cp2y),",",j(e.x),",",j(e.y));break;case "at":case "wa":a.push(" ",e.type," ",j(e.x-this.arcScaleX_*e.radius),",",j(e.y-this.arcScaleY_*e.radius),
" ",j(e.x+this.arcScaleX_*e.radius),",",j(e.y+this.arcScaleY_*e.radius)," ",j(e.xStart),",",j(e.yStart)," ",j(e.xEnd),",",j(e.yEnd));break}if(e){if(h.x==null||e.x<h.x)h.x=e.x;if(g.x==null||e.x>g.x)g.x=e.x;if(h.y==null||e.y<h.y)h.y=e.y;if(g.y==null||e.y>g.y)g.y=e.y}}a.push(' ">');if(b)if(typeof this.fillStyle=="object"){var m=this.fillStyle,r=0,n={x:0,y:0},o=0,q=1;if(m.type_=="gradient"){var t=m.x1_/this.arcScaleX_,E=m.y1_/this.arcScaleY_,p=this.getCoords_(m.x0_/this.arcScaleX_,m.y0_/this.arcScaleY_),
z=this.getCoords_(t,E);r=Math.atan2(z.x-p.x,z.y-p.y)*180/Math.PI;if(r<0)r+=360;if(r<1.0E-6)r=0}else{var p=this.getCoords_(m.x0_,m.y0_),w=g.x-h.x,x=g.y-h.y;n={x:(p.x-h.x)/w,y:(p.y-h.y)/x};w/=this.arcScaleX_*k;x/=this.arcScaleY_*k;var R=s.max(w,x);o=2*m.r0_/R;q=2*m.r1_/R-o}var u=m.colors_;u.sort(function(ba,ca){return ba.offset-ca.offset});var J=u.length,da=u[0].color,ea=u[J-1].color,fa=u[0].alpha*this.globalAlpha,ga=u[J-1].alpha*this.globalAlpha,S=[],l=0;for(;l<J;l++){var T=u[l];S.push(T.offset*q+
o+" "+T.color)}a.push('<g_vml_:fill type="',m.type_,'"',' method="none" focus="100%"',' color="',da,'"',' color2="',ea,'"',' colors="',S.join(","),'"',' opacity="',ga,'"',' g_o_:opacity2="',fa,'"',' angle="',r,'"',' focusposition="',n.x,",",n.y,'" />')}else a.push('<g_vml_:fill color="',d,'" opacity="',f,'" />');else{var K=this.lineScale_*this.lineWidth;if(K<1)f*=K;a.push("<g_vml_:stroke",' opacity="',f,'"',' joinstyle="',this.lineJoin,'"',' miterlimit="',this.miterLimit,'"',' endcap="',aa(this.lineCap),
'"',' weight="',K,'px"',' color="',d,'" />')}a.push("</g_vml_:shape>");this.element_.insertAdjacentHTML("beforeEnd",a.join(""))};i.fill=function(){this.stroke(true)};i.closePath=function(){this.currentPath_.push({type:"close"})};i.getCoords_=function(b,a){var c=this.m_;return{x:k*(b*c[0][0]+a*c[1][0]+c[2][0])-v,y:k*(b*c[0][1]+a*c[1][1]+c[2][1])-v}};i.save=function(){var b={};O(this,b);this.aStack_.push(b);this.mStack_.push(this.m_);this.m_=y(I(),this.m_)};i.restore=function(){O(this.aStack_.pop(),
this);this.m_=this.mStack_.pop()};function ha(b){var a=0;for(;a<3;a++){var c=0;for(;c<2;c++)if(!isFinite(b[a][c])||isNaN(b[a][c]))return false}return true}function A(b,a,c){if(!!ha(a)){b.m_=a;if(c)b.lineScale_=W(V(a[0][0]*a[1][1]-a[0][1]*a[1][0]))}}i.translate=function(b,a){A(this,y([[1,0,0],[0,1,0],[b,a,1]],this.m_),false)};i.rotate=function(b){var a=G(b),c=F(b);A(this,y([[a,c,0],[-c,a,0],[0,0,1]],this.m_),false)};i.scale=function(b,a){this.arcScaleX_*=b;this.arcScaleY_*=a;A(this,y([[b,0,0],[0,a,
0],[0,0,1]],this.m_),true)};i.transform=function(b,a,c,d,f,h){A(this,y([[b,a,0],[c,d,0],[f,h,1]],this.m_),true)};i.setTransform=function(b,a,c,d,f,h){A(this,[[b,a,0],[c,d,0],[f,h,1]],true)};i.clip=function(){};i.arcTo=function(){};i.createPattern=function(){return new U};function D(b){this.type_=b;this.r1_=this.y1_=this.x1_=this.r0_=this.y0_=this.x0_=0;this.colors_=[]}D.prototype.addColorStop=function(b,a){a=P(a);this.colors_.push({offset:b,color:a.color,alpha:a.alpha})};function U(){}G_vmlCanvasManager=
M;CanvasRenderingContext2D=H;CanvasGradient=D;CanvasPattern=U})();

}