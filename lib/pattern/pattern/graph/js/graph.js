/*### PATTERN | JAVASCRIPT:GRAPH ###################################################################*/
// Copyright (c) 2010 University of Antwerp, Belgium
// Authors: Tom De Smedt <tom@organisms.be>, Daniel Friesen (daniel@nadir-seen-fire.com)
// License: BSD (see LICENSE.txt for details).
// http://www.clips.ua.ac.be/pages/pattern

/*--- ARRAY ----------------------------------------------------------------------------------------*/

// Array.indexOf doesn't exist in IE7-.
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(item) {
        for (var i=0; i < this.length; i++) {
            if (this[i] === item) return i;
        }
        return -1;
    };
}

// Emulates Python dict.keys().
function keys(object) {
    var v = [];
    for (var k in object) 
        v.push(k);
    return v;    
}
// Emulates Python dict.values().
function values(object) {
    var v = [];
    for (var k in object) 
        v.push(object[k]);
    return v;    
}

// Emulates Python list.extend().
function extend(array1, array2) {
    for (var i=0; i < array2.length; i++) {
        array1.push(array2[i]);
    }
    return array1;
}

function sum(array) {
    var n = 0;
    for (var i=0; i < array.length; i++) n += array[i]; 
    return n;
}

function choice(array) {
    var i = Math.round(Math.random() * (array.length-1));
    return array[i];
}

function unique(array) {
    array = array.slice();
    for (var i=array.length-1; i > 0; --i) {
        var v = array[i];
        for (var j=i-1; j >= 0; --j) {
            if (array[j] === v) {
                array.splice(j, 1); i--;
            }
        }
    }
    return array;
}

/*--- MATH -----------------------------------------------------------------------------------------*/

function degrees(radians) {
    return radians / Math.PI * 180;
}
function radians(degrees) {
    return degrees * Math.PI / 180;
}
function coordinates(x, y, distance, angle) {
    return [x + distance * Math.cos(radians(angle)), 
            y + distance * Math.sin(radians(angle))];
}

/*--- MOUSE ----------------------------------------------------------------------------------------*/

function unselectable(element) {
    /* Disables text selection on the given element (interferes with node dragging).
     */
    element.onselectstart = function() { return false; };
    element.unselectable = "on";
    element.style.MozUserSelect = "none";
    element.style.cursor = "default";
}

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

var mouse = { 
    /* Global object that stores the mouse state.
     * mouse.relative() returns the position from the top-left corner of the given element.
     */
           x: 0,
           y: 0,
         _x0: 0,
         _y0: 0,
          dx: 0, // Drag distance from x0.
          dy: 0, // Drag distance from y0.
     pressed: false, 
     dragged: false, 
    relative: function(element) {
        p = absOffset(element);
        return {
            x: mouse.x - p[0], 
            y: mouse.y - p[1]
        }
    }
};

function attachEvent(element, name, f) {
    if (element.addEventListener) {
        element.addEventListener(name, f, false);
    } else if (element.attachEvent) {
        element.attachEvent ("on"+name, f);
    } else {
        element["on"+name] = f;
    }
}

attachEvent(document, "mousemove", function(e) {
    mouse.x = e.pageX || (e.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft));
    mouse.y = e.pageY || (e.clientY + (document.documentElement.scrollTop || document.body.scrollTop));
    if (mouse.pressed) {
        mouse.dragged = true;
        mouse.dx = mouse.x - mouse._x0;
        mouse.dy = mouse.y - mouse._y0;
    }
});

attachEvent(document, "mousedown", function(e) {
    mouse.pressed = true;
    mouse._x0 = mouse.x;
    mouse._y0 = mouse.y;
});

attachEvent(document, "mouseup", function(e) {
    mouse.pressed = false;
    mouse.dragged = false;
    mouse.dx = 0;
    mouse.dy = 0;
});

/*--- IE HACKS -------------------------------------------------------------------------------------*/
// setInterval() on IE does not take function arguments so we patch it:

/*@cc_on
(function(f) {
 window.setTimeout = f(window.setTimeout);
 window.setInterval = f(window.setInterval);
})(function(f) {
    return function(c, t) {
        var a = [].slice.call(arguments, 2);
        return f(function() {
            c.apply(this, a);
        }, t);
    };
});
@*/

/*--- BASE CLASS -----------------------------------------------------------------------------------*/
// JavaScript class inheritance, John Resig (http://ejohn.org/blog/simple-javascript-inheritance).
//
// var Person = Class.extend({
//     init: function(name) {
//         this.name = name;
//     }
// });
// var Employee = Person.extend({
//     init: function(name, salary) {
//         this.base(name);
//         this.salary = salary;
//     }
// });
//
// var e = new Employee("tom", 10);

(function() {
    var init = false, has_base = /xyz/.test(function() { xyz; }) ? /\bbase\b/ : /.*/;
    this.Class = function() { };
    Class.extend = function(args) {
        var base = this.prototype;
        init = true; var p = new this(); 
        init = false;
        for (var k in args) {
            p[k] = typeof args[k] == "function" 
                && typeof base[k] == "function" 
                && has_base.test(args[k]) ? (function(k, f) { return function() {
                    var b = this.base; this.base=base[k];
                    var r = f.apply(this, arguments); this.base=b;
                    return r;
                }; 
            })(k, args[k]) : args[k];
        }
        function Class() {
            if (!init && this.init) this.init.apply(this, arguments);
        }
        Class.prototype = p;
        Class.constructor = Class;
        Class.extend = arguments.callee;
        return Class;
    };
})();

/*--- GRAPH NODE -----------------------------------------------------------------------------------*/

var Node = Class.extend({
    
//  init: function(id, {radius:5, weight:0, centrality:0, 
//                      fill:"rgba(0,0,0,0)", stroke:"rgba(0,0,0,1)", strokewidth:1, 
//                      text:true, font:null, fontsize:null, fontweight:null, href:null, css:null})
    init: function(id, a) {
        /* A node with an id in the graph.
         * Node.text is a <div> element displaying id.
         */
        if (a === undefined) a = {};
        if (a.x === undefined) a.x = 0;
        if (a.y === undefined) a.y = 0;
        if (a.radius === undefined) a.radius = 5;
        if (a.fixed  === undefined) a.fixed  = false;
        if (a.fill   === undefined) a.fill   = "rgba(0,0,0,0)";
        if (a.stroke === undefined) a.stroke = "rgba(0,0,0,1)";
        if (a.strokewidth === undefined) a.strokewidth = 1;
        this.graph = null;
        this.links = new Links();
        this.id  = id;
        this.x   = 0; // Calculated by Graph.layout.update().
        this.y   = 0; // Calculated by Graph.layout.update().
        this._x  = a.x;
        this._y  = a.y;
        this._vx = 0;
        this._vy = 0;
        this.radius      = a.radius;
        this.fixed       = a.fixed;
        this.fill        = a.fill;
        this.stroke      = a.stroke;
        this.strokewidth = a.strokewidth;
        this.weight      = a.weight || 0;
        this.centrality  = a.centrality || 0;
        this.text = null;
        if (a.text != false) {
            var div = document.createElement('div');
            var txt = ((a.label || id)+"").replace("\\\"", "\"");
            txt = txt.replace("<","&lt;");
            txt = txt.replace(">","&gt;")
            div.innerHTML = (a.href)? '<a href="'+a.href+'">'+txt+"</a>" : txt;
            div.className = (a.css)? ("node-label " + a.css) : "node-label";
            div.style.fontFamily = (a.font)? a.font : "";
            div.style.fontSize   = (a.fontsize)? a.fontsize+"px" : "";
            div.style.fontWeight = (a.fontweight)? a.fontweight : ""; // XXX doesn't work for "italic" (=fontStyle).
            div.style.color      = (typeof(a.text) == "string")? a.text : "";
            this.text = div; 
            unselectable(div);
        }
    },
    
    edges: function() {
        var a = [];
        for (var i=0; i < this.graph.edges.length; i++) {
            var e = this.graph.edges[i];
            if (e.node1 == this || e.node2 == this) {
                a.push(e);
            }
        }
        return a;
    },

    flatten: function(depth, _visited) {
        /* Recursively lists the node and nodes linked to it.
         *  Depth 0 returns a list with the node.
         *  Depth 1 returns a list with the node and all the directly linked nodes.
         *  Depth 2 includes the linked nodes' links, and so on.
         */
        if (depth === undefined) depth = 1;
        _visited = _visited || {};
        _visited[this.id] = [this, depth];
        if (depth >= 1) {
            for (var i=0; i < this.links.length; i++) {
                var n = this.links[i];
                if (!_visited[n.id] || _visited[n.id][1] < depth-1) {
                    n.flatten(depth-1, _visited);
                }
            }
        }
        var a = values(_visited); // Fast, but not order-preserving.
        for (var i=0; i < a.length; i++) {
            a[i] = a[i][0];
        }
        return a;
    },
    
    draw: function(weighted) {
        /* Draws the node as a circle with the given radius, fill, stroke and strokewidth.
         * Draws the node centrality as a shadow effect when weighted=True.
         * Draws the node text label.
         * Override this method in a subclass for custom drawing.
         */
        var ctx = this.graph._ctx;
        // Draw the node weight as a shadow (based on node betweenness centrality).
        if (weighted && weighted != false && this.centrality > ((weighted==true)?-1:weighted)) {
            var w = this.centrality * 35
            ctx.fillStyle = "rgba(0,0,0,0.1)";
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius+w, 0, Math.PI*2, true);
            ctx.closePath();
            ctx.fill();
        }
        // Draw the node.
        ctx.lineWidth   = this.strokewidth;
        ctx.strokeStyle = this.stroke;
        ctx.fillStyle   = this.fill;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Draw the node text label.
        if (this.text) {
            this.text.style.display  = "inline";
            this.text.style.position = "absolute";
            this.text.style.left     = Math.round(this.x + this.radius/2 + this.graph.canvas.width/2) + "px";
            this.text.style.top      = Math.round(this.y + this.radius/2 + this.graph.canvas.height/2) + "px";
        }
    },

    contains: function(x, y) {
        return Math.abs(this.x - x) < this.radius*2 &&
               Math.abs(this.y - y) < this.radius*2
    }
});

var Links = Class.extend({
    
    init: function() {
        /* A list in which each node has an associated edge.
         * The edge() method returns the edge for a given node id.
         */
        this.edges = {};
        this.length = 0;
    },
    
    append: function(node, edge) {
        if (!this.edges[node.id]) {
            this[this.length] = node; 
            this.length += 1;
        }
        this.edges[node.id] = edge;
    },

    remove: function(node) {
        var i = this.indexOf(node);
        if (i >= 0) {
            for (var j=i; j < this.length; j++) this[j] = this[j+1];
            this.length -= 1;
            delete this.edges[node.id];
        }
    },
    
    edge: function(node) {
        return this.edges[(node instanceof Node)?node.id:node] || null;
    }
});

Links.prototype.indexOf = Array.prototype.indexOf

/*--- GRAPH EDGE -----------------------------------------------------------------------------------*/

var Edge = Class.extend({

//  init: function(node1, node2, {weight:0, length:1, type:null, stroke:"rgba(0,0,0,1)", strokewidth:0.5})
    init: function(node1, node2, a) {
        /* A connection between two nodes.
         * Its weight indicates the importance (not the cost) of the connection.
         * Its type is useful in a semantic network (e.g. "is-a", "is-part-of", ...)
         */
        if (a === undefined) a = {};
        if (a.weight === undefined) a.weight = 0.0;
        if (a.length === undefined) a.length = 1.0;
        if (a.type   === undefined) a.type   = null;
        if (a.stroke === undefined) a.stroke = "rgba(0,0,0,1)";
        if (a.strokewidth === undefined) a.strokewidth = 0.5;
        this.node1 = node1;
        this.node2 = node2;
        this.weight      = a.weight;
        this.length      = a.length;
        this.type        = a.type;
        this.stroke      = a.stroke;
        this.strokewidth = a.strokewidth;
    },
    
    draw: function(weighted, directed) {
        /* Draws the edge as a line with the given stroke and strokewidth (increased with Edge.weight).
         * Override this method in a subclass for custom drawing.
         */
        var w = weighted && this.weight || 0;
        var ctx = this.node1.graph._ctx;
        ctx.lineWidth   = this.strokewidth + w;
        ctx.strokeStyle = this.stroke;
        ctx.fillStyle   = this.stroke;
        ctx.beginPath();
        ctx.moveTo(this.node1.x, this.node1.y);
        ctx.lineTo(this.node2.x, this.node2.y);
        ctx.stroke();
        if (directed) {
            this.drawArrow(this.strokewidth);
        }
    },
    
    drawArrow: function(strokewidth) {
        /* Draws the direction of the edge as an arrow on the rim of the receiving node.
         */
        var x0 = this.node1.x;
        var y0 = this.node1.y;
        var x1 = this.node2.x;
        var y1 = this.node2.y;
        // Find the edge's angle based on node1 and node2 position.
        var a = degrees(Math.atan2(y1-y0, x1-x0));
        // The arrow points to node2's rim instead of it's center.
        // Find the two other arrow corners under the given angle.
        var d = Math.sqrt(Math.pow(x1-x0, 2) + Math.pow(y1-y0, 2));
        var r = Math.max(strokewidth * 4, 8)
        var p1 = coordinates(x0, y0, d-this.node2.radius-1, a);
        var p2 = coordinates(p1[0], p1[1], -r, a-20);
        var p3 = coordinates(p1[0], p1[1], -r, a+20);
        var ctx = this.node1.graph._ctx;
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.fill();
    }
});

/*--- GRAPH ----------------------------------------------------------------------------------------*/

// Dropshadow opacity:
var SHADOW = 0.65;

// Graph layouts:
var SPRING = "spring";

// Graph node sort order:
var WEIGHT = "weight"
var CENTRALITY = "centrality"

var Graph = Class.extend({
    
    init: function(canvas, distance, layout) {
        /* A network of nodes connected by edges that can be drawn with a given layout.
         * A HTML5 <canvas> element must be given.
         */
        if (distance === undefined) distance = 10;
        if (layout   === undefined) layout   = SPRING;
        this.canvas   = canvas; unselectable(canvas);
        this._ctx     = this.canvas.getContext("2d");
        this.nodeset  = {};
        this.nodes    = [];
        this.edges    = [];
        this.root     = null;
        this.distance = distance;
        this.layout   = (layout==SPRING)? new GraphSpringLayout(this) : 
                                          new GraphLayout(this);
    },
    
    $: function(id) {
        return this.nodeset[id];
    },
    
    append: function(base, a) {
        /* Appends a Node or Edge to the graph.
         */
        if (base == Node)
            return this.add_node(a.id, a);
        if (base == Edge)
            return this.add_edge(a.id1, a.id2, a);
    },
    
    addNode: function(id, a) {
        /* Appends a new Node to the graph.
         */
        var n = a && a.base || Node;
            n = (id instanceof Node)? id : (this.nodeset[id])? this.nodeset[id] : new n(id, a);
        if (a && a.root) this.root = n;
        if (!this.nodeset[n.id]) {
            this.nodes.push(n);
            this.nodeset[n.id] = n; n.graph = this;
            if (n.text && this.canvas.parentNode) {
                this.canvas.parentNode.appendChild(n.text);
            }
        }
        return n;
    },
    
    addEdge: function(id1, id2, a) {
        /* Appends a new Edge to the graph.
         * An optional base parameter can be used to pass a subclass of Edge:
         * Graph.addEdge("cold", "winter", {base:IsPropertyOf});
         */
        // Create nodes that are not yet part of the graph.
        var n1 = this.addNode(id1);
        var n2 = this.addNode(id2);
        // Create an Edge instance.
        // If an edge (in the same direction) already exists, yields that edge instead.
        var e1 = n1.links.edge(n2)
        if (e1 && e1.node1 == n1 && e1.node2 == n2) {
            return e1; // Shortcut to existing edge.
        }
        e2 = a && a.base || Edge;
        e2 = new e2(n1, n2, a);
        this.edges.push(e2);
        // Synchronizes Node.links:
        // A.links.edge(B) yields edge A->B
        // B.links.edge(A) yields edge B->A
        n1.links.append(n2, edge=e2)
        n2.links.append(n1, edge=e1||e2)
        return e2;
    },
    
    remove: function(x) {
        /* Removes the given Node (and all its edges) or Edge from the graph.
         * Note: removing Edge a->b does not remove Edge b->a.
         */
        if (x instanceof Node && this.nodeset[x.id]) {
            delete this.nodeset[x.id];
            this.nodes.splice(this.nodes.indexOf(x), 1); x.graph = null;
            // Remove all edges involving the given node.
            var a = [];
            for (var i=0; i < this.edges.length; i++) {
                var e = this.edges[i];
                if (x != e.node1 && x != e.node2) {
                    a.push(e);
                }
            }
            this.edges = a;
            // Remove label <div>.
            if (x.text) x.text.parentNode.removeChild(x.text);
        }
        if (x instanceof Edge) {
            this.edges.splice(this.edges.indexOf(x), 1);
        }
    },

    node: function(id) {
        /* Returns the node in the graph with the given id.
         */
        return this.nodeset[id] || null;
    },
    
    edge: function(id1, id2) {
        /* Returns the edge between the nodes with given id1 and id2.
         */
        return (this.nodeset[id1] && this.nodeset[id2])? this.nodeset[id1].links.edge(id2) : null;
    },

//  paths: function(node1, node2)
    paths: function(node1, node2, length, path) {
        /* Returns a list of paths (shorter than given length) connecting the two nodes.
         */
        if (length === undefined) length = 4;
        if (path   === undefined) path   = [];
        if (!(node1 instanceof Node)) node1 = this.nodeset(node1);
        if (!(node2 instanceof Node)) node2 = this.nodeset(node2);
        var p = [];
        var P = paths(this, node1.id, node2.id, length, path, true);
        for (var i=0; i < P.length; i++) {
            var n = [];
            for (var j=0; j < P[i].length; j++) {
                n.push(this.nodeset[P[i][j]]);
            }
            p.push(n);
        }
        return p;
    },

//  shortestPath: function(node1, node2, {heuristic:function(id1,id1){return 0;}, directed:false})
    shortestPath: function(node1, node2, a) {
        /* Returns a list of nodes connecting the two nodes.
         */
        if (!(node1 instanceof Node)) node1 = this.nodeset(node1);
        if (!(node2 instanceof Node)) node2 = this.nodeset(node2);
        try {
            var p = dijkstraShortestPath(this, node1.id, node2.id, a);
            var n = [];
            for (var i=0; i < p.length; i++) {
                n.push(this.nodeset[p[i]]);
            }
            return n;
        } catch(e) {
            return null;
        }
    },

//  shortestPaths: function(node, {heuristic:function(id1,id1){return 0;}, directed:false})
    shortestPaths: function(node, a) {
        /* Returns a dictionary of nodes, each linked to a list of nodes (shortest path).
         */
        if (!(node instanceof Node)) node = this.nodeset(node);
        var p = {};
        var P = dijkstraShortestPaths(this, node.id, a);
        for (var id in P) {
            if (P[id]) {
                var n = [];
                for (var i=0; i < P[id].length; i++) {
                    n.push(this.nodeset[P[id][i]]);
                }
                p[this.nodeset[id]] = n;
            } else {
                p[this.nodeset[id]] = null;
            }
        }
    },

//  eigenvectorCentrality: function(graph, {normalized:true, reversed:true, rating:{}, iterations:100, tolerance:0.0001})
    eigenvectorCentrality: function(graph, a) {
        /* Calculates eigenvector centrality and returns a node => weight dictionary.
         * Node.weight is updated in the process.
         * Node.weight is higher for nodes with a lot of (indirect) incoming traffic.
         */
        var ec = eigenvectorCentrality(this, a);
        var r = {};
        for (var id in ec) {
            var n = this.nodeset[id];
            n.weight = ec[id];
            r[n] = n.weight;
        }
        return r;
    },
    
//  betweennessCentrality: function(graph, {normalized:true, directed:false})
    betweennessCentrality: function(graph, a) {
        /* Calculates betweenneess centrality and returns a node => weight dictionary.
         * Node.centrality is updated in the process.
         * Node.centrality is higher for nodes with a lot of passing traffic.
         */
        var bc = brandesBetweennessCentrality(this, a);
        var r = {};
        for (var id in bc) {
            var n = this.nodeset[id];
            n.centrality = bc[id];
            r[n] = n.centrality;
        }
        return r;
    },

    sorted: function(order, threshold) {
        /* Returns a list of nodes sorted by WEIGHT or CENTRALITY.
         * Nodes with a lot of traffic will be at the start of the list.
         */
        if (order === undefined) order = WEIGHT;
        if (threshold === undefined) threshold = 0.0;
        var a = [];
        for (var i=0; i < this.nodes.length; i++) {
            if (this.nodes[i][order] > threshold) {
                a.push([this.nodes[i][order], this.nodes[i]]);
            }
        }
        a = a.sort();
        a = a.reverse();
        for (var i=0; i < a.length; i++) {
            a[i] = a[i][1];
        }
        return a;
    },

    prune: function(depth) {
        /* Removes all nodes with less or equal links than depth.
         */
        if (depth === undefined) depth = 0;
        var m = {};
        for(i=0; i<this.nodes.length; i++) {
            m[this.nodes[i].id] = 0;
        }
        for(i=0; i<this.edges.length; i++) {
            m[this.edges[i].node1.id] += 1;
            m[this.edges[i].node2.id] += 1;
        }
        for(id in m) {
            if (m[id] <= depth) {
                this.remove(this.nodeset[id]);
            }
        }
    },
    
    fringe: function(depth) {
        /* For depth=0, returns the list of leaf nodes (nodes with only one connection).
         * For depth=1, returns the list of leaf nodes and their connected nodes, and so on.
         */
        if (depth === undefined) depth = 0;
        var u = [];
        for (var i=0; i < this.nodes.length; i++) {
            if (this.nodes[i].links.length == 1) {
                u.push.apply(u, this.nodes[i].flatten(depth));
            }
        }
        return unique(u);
    },
    
    density: function() {
        // Number of edges vs. maximum number of possible edges.
        // E.g. <0.35 => sparse, >0.65 => dense, 1.0 => complete.
        return 2.0*this.edges.length / (this.nodes.length * (this.nodes.length-1));
    },
    
    split: function() {
        return partition(this);
    },
    
    update: function(iterations, weight, limit) {
        /* Graph.layout.update() is called the given number of iterations.
         */
        if (iterations === undefined) iterations = 2;
        for (var i=0; i < iterations; i++) {
            this.layout.update(weight, limit);
        }
    },
    
    draw: function(weighted, directed) {
        /* Draws all nodes and edges.
         */
        // Transparent background, shadows enabled.
        this._ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._ctx.shadowColor = "rgba(0,0,0,"+SHADOW+")";
        this._ctx.shadowBlur = 8;
        this._ctx.shadowOffsetX = 6;
        this._ctx.shadowOffsetY = 6;
        this._ctx.save();
        this._ctx.translate(this.canvas.width/2, this.canvas.height/2);
        for (var i=0; i < this.edges.length; i++) {
            this.edges[i].draw(weighted, directed);
        }
        for (var i=0; i < this.nodes.length; i++) {
            this.nodes[i].draw(weighted);
        }
        this._ctx.restore();
    },

//  loop: function({frames:500, weighted:false, directed:false, fps:10, ipf:2})
    loop: function(a) {
        /* Calls Graph.update() and Graph.draw() in an animation loop.
         */
        if (a === undefined) a = {};
        if (a.frames === undefined) a.frames = 500;
        if (a.fps    === undefined) a.fps    = 20;
        if (a.ipf    === undefined) a.ipf    = 2;
        this._i = 0;
        this._frames = a.frames;
        this._animation = setInterval(function(g) {
            // The animation loops fps frames per second,
            // until the given number of frames has elapsed.
            // Nodes can be dragged around (this resets the frame counter).
            var p = null;
            if (mouse.pressed) {
                p = mouse.relative(g.canvas);
                p.x -= g.canvas.width/2; // Undo center translate.
                p.y -= g.canvas.height/2;
            }
            if (mouse.pressed && !mouse.dragged) {
                g.dragged = g.nodeAt(p.x, p.y);
            }
            if (!mouse.pressed) {
                g.dragged = null;
            }
            if (g.dragged) {
                g.dragged._x = p.x / g.distance;
                g.dragged._y = p.y / g.distance;
                g._i = 0;
            }
            if (g._i < g._frames) {
                g._i += 1;
                g.update(a.ipf);
                g.draw(a.weighted, a.directed);
            }
        }, 1000/a.fps, this);
    },
    stop: function() {
        clearInterval(this._animation);
        this._animation = null;
    },
    
    nodeAt: function(x, y) {
        /* Returns the node at (x,y) or null.
         */
        for (var i=0; i < this.nodes.length; i++) {
            var n = this.nodes[i];
            if (n.contains(x, y)) {
                return n;
            }
        }
    },
    
    _addNodeCopy: function(n, a) {
        var args = {
             radius: n.radius,
               fill: n.fill,
             stroke: n.stroke,
        strokewidth: n.strokewidth,
               text: n.text? n.text.style.color || true : false,
               font: n.text? n.text.style.fontFamily || null : null,
           fontsize: n.text? parseInt(n.text.style.fontSize) || null : null,
         fontweight: n.text? n.text.style.fontWeight || null : null,
                css: n.text? n.text.className || null : null,
               root: a && a.root || false
        };
        var a = n.text? n.text.getElementsByTagName("a") : null;
        if (a && a.length > 0) args.href = a[0].href || null;
        this.addNode(n.id, args);
    },
    
    _addEdgeCopy: function(e, a) {
        if (!((a && a["node1"] || e.node1).id in this.nodeset) ||
            !((a && a["node2"] || e.node2).id in this.nodeset)) {
            return;
        }
        this.addEdge(
            a && a["node1"] || this.nodeset[e.node1.id],
            a && a["node2"] || this.nodeset[e.node2.id], {
                  weight: e.weight, 
                  length: e.length, 
                    type: e.type,
                  stroke: e.stroke,
             strokewidth: e.strokewidth 
            }
        );
    },
    
    copy: function(canvas, nodes) {
        /* Returns a copy of the graph with the given list of nodes (and connecting edges).
         *  The layout will be reset.
         */
        if (nodes === undefined) nodes = this.nodes;
        var g = new Graph(canvas, this.distance, null);
        g.layout = this.layout.copy(g);
        for (var i=0; i < nodes.length; i++) {
            var n = nodes[i];
            g._addNodeCopy(n, {root:this.root==n});
        }
        for (var i=0; i < this.edges.length; i++) {
            var e = this.edges[i];
            g._addEdgeCopy(e);
        }
        return g;
    },
    
    clear: function() {
        // Removes the graph from the canvas.
        // Removes the <div> node labels from the DOM.
        this._ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (var i=0; i < this.nodes.length; i++) {
            var n = this.nodes[i];
            if (n.text) n.text.parentNode.removeChild(n.text);
        }
        this.nodeset = null;
        this.nodes   = null;
        this.edges   = null;
        this.canvas  = null;
    }
});

/*--- GRAPH LAYOUT ---------------------------------------------------------------------------------*/
// Based on: Graph JavaScript framework (2006), Aslak Hellesoy & Dave Hoover.

GraphLayout = Class.extend({
    
    init: function(graph) {
        /* Calculates node positions iteratively when GraphLayout.update() is called.
         */
        this.graph = graph;
        this.iterations = 0;
    },
    
    update: function() {
        this.iterations += 1;
    },

    reset: function() {
        this.iterations = 0;
        for (var i=0; i < this.graph.nodes.length; i++) {
            var n = this.graph.nodes[i];
            n._x  = 0;
            n._y  = 0;
            n._vx = 0;
            n._vy = 0;
        }
    },
    
    bounds: function() {
        /* Returns a (x, y, width, height)-tuple of the approximate layout dimensions.
         */
        var min = {'x': +Infinity, 'y': +Infinity}
        var max = {'x': -Infinity, 'y': -Infinity}
        for (var i=0; i < this.graph.nodes.length; i++) {
            var n = this.graph.nodes[i];
            if (n._x < min.x) min.x = n._x;
            if (n._y < min.y) min.y = n._y;
            if (n._x > max.x) max.x = n._x;
            if (n._y > max.y) max.y = n._y;
        }
        return [min.x, min.y, max.x-min.x, max.y-min.y];
    },
    
    copy: function(graph) {
        return new GraphLayout(graph);
    }
    
});

GraphSpringLayout = GraphLayout.extend({
    
    init: function(graph) {
        /* A force-based layout in which edges are regarded as springs.
         * The forces are applied to the nodes, pulling them closer or pushing them apart.
         */
        this.base(graph);
        this.k         = 4.0;  // Force constant.
        this.force     = 0.01; // Force multiplier.
        this.repulsion = 50;   // Maximum repulsive force radius.
    },
    
    _distance: function(node1, node2) {
        /* Yields a tuple with distances (dx, dy, d, d**2).
         * Ensures that the distance is never zero (which deadlocks the animation).
         */
        var dx = node2._x - node1._x;
        var dy = node2._y - node1._y;
        var d2 = dx*dx + dy*dy;
        if (d2 < 0.01) {
            dx = Math.random() * 0.1 + 0.1;
            dy = Math.random() * 0.1 + 0.1;
            d2 = dx*dx + dy*dy;
        }
        return [dx, dy, Math.sqrt(d2), d2];
    },
    
    _repulse: function(node1, node2) {
        /* Updates Node force vector with the repulsive force.
         */
        var a = this._distance(node1, node2); dx=a[0]; dy=a[1]; d=a[2]; d2=a[3];
        if (d < this.repulsion) {
            var f = Math.pow(this.k,2) / d2;
            node2._vx += f * dx;
            node2._vy += f * dy;
            node1._vx -= f * dx;
            node1._vy -= f * dy;
        }
    },
    
    _attract: function(node1, node2, weight, length) {
        /* Updates Node force vector with the attractive edge force.
         */
        var a = this._distance(node1, node2); dx=a[0]; dy=a[1]; d=a[2]; d2=a[3];
        var d = Math.min(d, this.repulsion);
        var f = (d2 - Math.pow(this.k,2)) / this.k * length;
        f *= weight * 0.5 + 1;
        f /= d;
        node2._vx -= f * dx;
        node2._vy -= f * dy;
        node1._vx += f * dx;
        node1._vy += f * dy;
    },
    
    update: function(weight, limit) {
        /* Updates the position of nodes in the graph.
         * The weight parameter determines the impact of edge weight.
         * The limit parameter determines the maximum movement each update().        
         */
        if (weight === undefined) weight = 10.0;
        if (limit  === undefined) limit  = 0.5;
        // Call GraphLayout.update().
        this.base();
        // Forces on all nodes due to node-node repulsions.
        for (var i=0; i < this.graph.nodes.length; i++) {
            var n1 = this.graph.nodes[i];
            for (var j=i+1; j < this.graph.nodes.length; j++) {
                var n2 = this.graph.nodes[j];
                this._repulse(n1, n2);
            }
        }
        // Forces on nodes due to edge attractions.
        for (var i=0; i < this.graph.edges.length; i++) {
            var e = this.graph.edges[i];
            this._attract(e.node1, e.node2, weight*e.weight, 1.0/(e.length||0.01));
        } 
        // Move by the given force.
        for (var i=0; i < this.graph.nodes.length; i++) {
            var n = this.graph.nodes[i];
            if (!n.fixed) {
                n._x += Math.max(-limit, Math.min(this.force * n._vx, limit));
                n._y += Math.max(-limit, Math.min(this.force * n._vy, limit));
                n.x = n._x * n.graph.distance;
                n.y = n._y * n.graph.distance;
            }
            n._vx = 0;
            n._vy = 0;
        }
    },
    
    copy: function(graph) {
        var g = new GraphSpringLayout(graph);
        g.k=this.k; g.force=this.force; g.repulsion=this.repulsion;
        return g;
    }
});

/*--- GRAPH TRAVERSAL ------------------------------------------------------------------------------*/

//       depthFirstSearch(node, {visit:function(node){return false;}, traversable:function(node,edge){return true;}, _visited:null}
function depthFirstSearch(node, a) {
    /* Visits all the nodes connected to the given root node, depth-first.
     * The visit function is called on each node.
     * Recursion will stop if it returns true, and subsequently dfs() will return true.
     * The traversable function takes the current node and edge,
     * and returns true if we are allowed to follow this connection to the next node.
     * For example, the traversable for directed edges is follows:
     *  function(node, edge) { return node == edge.node1; }
     */
    if (a === undefined) a = {};
    if (a.visit === undefined) a.visit = function(node) { return false; };
    if (a.traversable === undefined) a.traversable = function(node, edge) { return true; };
    var stop = visit(node);
    a._visited = a._visited || {};
    a._visited[node.id] = true;
    for (var i=0; i < node.links.length; i++) {
        var n = node.links[i];
        if (stop) return true;
        if (!a.traversable(node, node.links.edge(n))) continue;
        if (!a._visited[n.id]) {
            stop = depthFirstSearch(n, a);
        }
    }
    return stop;
}

dfs = depthFirstSearch;

function breadthFirstSearch(node, a) {
    /* Visits all the nodes connected to the given root node, breadth-first.
     */
    if (a === undefined) a = {};
    if (a.visit === undefined) a.visit = function(node) { return false; };
    if (a.traversable === undefined) a.traversable = function(node, edge) { return true; }; 
    var q = [node];
    var _visited = {};
    while (q.length > 0) {
        node = q.splice(0,1)[0];
        if (!_visited[node.id]) {
            if (a.visit(node))
                return true;
            for (var i=0; i < node.links.length; i++) {
                var n = node.links[i];
                if (a.traversable(node, node.links.edge(n))) q.push(n);
            }
            _visited[node.id] = true;
        }
    }
    return false;
}

bfs = breadthFirstSearch;

function paths(graph, id1, id2, length, path, _root) {
    /* Returns a list of paths from node with id1 to node with id2.
     * Only paths shorter than the given length are included.
     * Uses a brute-force DFS approach (performance drops exponentially for longer paths).
     */
    if (path.length >= length) {
        return [];
    }
    if (!(id1 in graph.nodeset)) {
        return [];
    }
    if (id1 == id2) {
        path = path.slice(); path.push(id1);
        return [path];
    }
    path = path.slice(); path.push(id1);
    var p = [];
    var n = graph.nodeset[id1].links;
    for (var i=0; i < n.length; i++) {
        if (path.indexOf(n[i].id) < 0) {
            p = extend(p, paths(graph, n[i].id, id2, length, path, false));
        }
    }
    if (_root != false) p.sort(function(a, b) { return a.length-b.length; });
    return p;
}

function edges(path) {
    /* Returns a list of Edge objects for the given list of nodes.
     * It contains null where two successive nodes are not connected.
     */
    // For example, the distance (i.e., edge weight sum) of a path:
    // var w = 0;
    // var e = edges(path);
    // for (var i=0; i < e.length; i++) w += e[i].weight;
    if (path.length > 1) {
        var e = [];
        for (var i=0; i < path.length-1; i++) {
            e.push(path[i].links.edge(path[i+1]));
        }
        return e;
    }
    return [];
}

/*--- GRAPH THEORY ---------------------------------------------------------------------------------*/

var Heap = Class.extend({
    init: function() {
        /* Items in the heap are ordered by weight (i.e. priority).
         * Heap.pop() returns the item with the lowest weight.
         */
        this.k = [];
        this.w = [];
        this.length = 0;
    },
    push: function (key, weight) {
        var i = 0; while (i <= this.w.length && weight < (this.w[i]||Infinity)) i++;
        this.k.splice(i, 0, key);
        this.w.splice(i, 0, weight);
        this.length += 1;
        return true;            
    },
    pop: function () {
        this.length -= 1;
        this.w.pop(); return this.k.pop();
    }
});

//       adjacency(graph, {directed:false, reversed:false, stochastic:false, heuristic:function(id1,id2){return 0;}})
function adjacency(graph, a) {
    /* Returns a dictionary indexed by node id1's,
     * in which each value is a dictionary of connected node id2's linking to the edge weight.
     * If directed=true, edges go from id1 to id2, but not the other way.
     * If stochastic=true, all the weights for the neighbors of a given node sum to 1.
     * A heuristic function can be given that takes two node id's and returns
     * an additional cost for movement between the two nodes.
     */
    if (a === undefined) a = {};
    if (a.directed   === undefined) a.directed   = false;
    if (a.reversed   === undefined) a.reversed   = false;
    if (a.stochastic === undefined) a.stochastic = false;
    var map = {};
    for (var i=0; i < graph.nodes.length; i++) {
        map[graph.nodes[i].id] = {};
    }
    for (var i=0; i < graph.edges.length; i++) {
        var e = graph.edges[i];
        var id1 = e[(a.reversed)?"node2":"node1"].id;
        var id2 = e[(a.reversed)?"node1":"node2"].id;
        map[id1][id2] = 1.0 - e.weight*0.5;
        if (a.heuristic) {
            map[id1][id2] += a.heuristic(id1, id2);
        }
        if (!a.directed) { 
            map[id2][id1] = map[id1][id2];
        }
    }
    if (a.stochastic) {
        for (var id1 in map) {
            var n = sum(values(map[id1]));
            for (var id2 in map[id1]) {
                map[id1][id2] /= n;
            }
        }
    }
    return map;
}

//       dijkstraShortestPath(graph, id1, id2, {heuristic:function(id1,id2){return 0;}, directed:false})
function dijkstraShortestPath(graph, id1, id2, a) {
    /* Dijkstra algorithm for finding shortest paths.
     * Raises an IndexError between nodes on unconnected graphs.
     */
    // Based on: Connelly Barnes, http://aspn.activestate.com/ASPN/Cookbook/Python/Recipe/119466
    function flatten(array) {
        // Flattens a linked list of the form [0,[1,[2,[]]]]
        var a = [];
        for (var i=0; i < array.length; i++) {
            (array[i] instanceof Array)? a=a.concat(flatten(array[i])) : a.push(array[i]);
        }
        return a;
    }
    var G = adjacency(graph, a);
    var q = new Heap(); q.push([0, id1, []], 0);
    var visited = {};
    for(;;) {
        var x = q.pop(); cost=x[0]; n1=x[1]; path=x[2];
        visited[n1] = true;
        if (n1 == id2) {
            var r = flatten(path);
            r.reverse(); 
            r.push(n1);
            return r;
        }
        var path = [n1, path];
        for (var n2 in G[n1] ) {
            if (!visited[n2]) {
                q.push([cost+G[n1][n2], n2, path], cost+G[n1][n2]);
            }
        }
    }
}

//       dijkstraShortestPaths(graph, id, {heuristic:function(id1,id2){return 0;}, directed:false})
function dijkstraShortestPaths(graph, id, a) {
    /* Dijkstra algorithm for finding the shortest paths from the given node to all other nodes.
     * Returns a dictionary of node id's, each linking to a list of node id's (i.e., the path).
     */
    // Based on: Dijkstra's algorithm for shortest paths modified from Eppstein.
    // Based on: NetworkX 1.4.1: Aric Hagberg, Dan Schult and Pieter Swart.
    var W = adjacency(graph, a);
    var Q = new Heap(); // Use Q as a heap with [distance, node id] lists.
    var D = {}; // Dictionary of final distances.
    var P = {}; // Dictionary of paths.
    P[id] = [id];
    var seen = {id: 0};
    Q.push([0, id], 0);
    while(Q.length) {
        var q = Q.pop(); dist=q[0]; v=q[1];
        if (v in D) continue;
        D[v] = dist;
        for (var w in W[v]) {
            var vw_dist = D[v] + W[v][w];
            if (!(w in D) && (!(w in seen) || vw_dist < seen[w])) {
                seen[w] = vw_dist;
                Q.push([vw_dist, w], vw_dist);
                P[w] = P[v].slice();
                P[w].push(w);
            }
        }
    }
    for (var n in graph.nodeset) {
        if (!(n in P)) P[n]=null;
    }
    return P;
}

//       brandesBetweennessCentrality(graph {normalized:true, directed:false})
function brandesBetweennessCentrality(graph, a) {
    /* Betweenness centrality for nodes in the graph.
     * Betweenness centrality is a measure of the number of shortests paths that pass through a node.
     * Nodes in high-density areas will get a good score.
     */
    // Ulrik Brandes, A Faster Algorithm for Betweenness Centrality,
    // Journal of Mathematical Sociology 25(2):163-177, 2001,
    // http://www.inf.uni-konstanz.de/algo/publications/b-fabc-01.pdf
    // Based on: Dijkstra's algorithm for shortest paths modified from Eppstein.
    // Based on: NetworkX 1.0.1: Aric Hagberg, Dan Schult and Pieter Swart.
    // http://python-networkx.sourcearchive.com/documentation/1.0.1/centrality_8py-source.html
    if (a === undefined) a = {};
    if (a.normalized === undefined) a.normalized = true;
    if (a.directed   === undefined) a.directed   = false;
    var W = adjacency(graph, a);
    var b = {}; for (var n in graph.nodeset) b[n]=0.0;
    for (var id in graph.nodeset) {
        var Q = new Heap(); // Use Q as a heap with [distance, node id] lists.
        var D = {}; // Dictionary of final distances.
        var P = {}; // # Dictionary of paths.
        for (var n in graph.nodeset) P[n]=[];
        var seen = {id: 0};
        Q.push([0, id, id], 0);
        var S = [];
        var E = {}; for (var n in graph.nodeset) E[n]=0; // sigma
        E[id] = 1;
        while(Q.length) {
            var q = Q.pop(); dist=q[0]; pred=q[1]; v=q[2];
            if (v in D) continue;
            D[v] = dist;
            S.push(v);
            E[v] = E[v] + E[pred];
            for (var w in W[v]) {
                var vw_dist = D[v] + W[v][w];
                if (!(w in D) && (!(w in seen) || vw_dist < seen[w])) {
                    seen[w] = vw_dist;
                    Q.push([vw_dist, v, w], vw_dist);
                    P[w] = [v];
                    E[w] = 0;
                } else if (vw_dist == seen[w]) { // Handle equal paths.
                    P[w].push(v);
                    E[w] = E[w] + E[v];
                }
            }
        }
        var d = {}; for (var v in graph.nodeset) d[v]=0;
        while (S.length) {
            var w = S.pop();
            for (var i=0; i < P[w].length; i++) {
                v = P[w][i];
                d[v] = d[v] + (E[v] / E[w]) * (1 + d[w]);
            }
            if (w != id) {
                b[w] = b[w] + d[w];
            }
        }
    }
    // Normalize between 0 and 1.
    var m = a.normalized? Math.max.apply(Math, values(b)) || 1 : 1;
    for (var id in b) b[id] = b[id]/m;
    return b;
};

//       eigenvectorCentrality(graph {normalized:true, reversed:true, rating:{}, iterations:100, tolerance:0.0001})
function eigenvectorCentrality(graph, a) {
    /* Eigenvector centrality for nodes in the graph (cfr. Google's PageRank).
     * Eigenvector centrality is a measure of the importance of a node in a directed network. 
     * It rewards nodes with a high potential of (indirectly) connecting to high-scoring nodes.
     * Nodes with no incoming connections have a score of zero.
     * If you want to measure outgoing connections, reversed should be False.        
     */
    // Based on: NetworkX, Aric Hagberg (hagberg@lanl.gov)
    // http://python-networkx.sourcearchive.com/documentation/1.0.1/centrality_8py-source.html
    // Note: much faster than betweenness centrality (which grows exponentially).
    if (a === undefined) a = {};
    if (a.normalized === undefined) a.normalized = true;
    if (a.reversed   === undefined) a.reversed   = true;
    if (a.rating     === undefined) a.rating     = {};
    if (a.iterations === undefined) a.iterations = 100;
    if (a.tolerance  === undefined) a.tolerance  = 0.0001;
    function normalize(vector) {
        var w = 1.0 / (sum(values(vector)) || 1);
        for (var node in vector) {
            vector[node] *= w;
        }
    }
    var G = adjacency(graph, a);
    var v = {}; for(var n in graph.nodeset) v[n] = Math.random(); normalize(v);
    // Eigenvector calculation using the power iteration method: y = Ax.
    // It has no guarantee of convergence.
    for (var i=0; i < a.iterations; i++) {
        var v0 = v
        var v={}; for (var k in v0) v[k]=0;
        for (var n1 in v) {
            for (var n2 in G[n1]) {
                v[n1] += 0.01 + v0[n2] * G[n1][n2] * (a.rating[n]? a.rating[n] : 1);
            }
        }
        normalize(v);
        var e=0; for (var n in v) e += Math.abs(v[n]-v0[n]); // Check for convergence.
        if (e < graph.nodes.length * a.tolerance) {
            // Normalize between 0 and 1.
            var m = a.normalized? Math.max.apply(Math, values(v)) || 1 : 1;
            for (var id in v) v[id] /= m;
            return v;
        }
    }
    if (window.console) {
        console.warn("node weight is 0 because eigenvectorCentrality() did not converge.");
    }
    var x={}; for (var n in graph.nodeset) x[n]=0;
    return x;
};

// a | b => all elements from a and all the elements from b. 
// a & b => elements that appear in a as well as in b.
// a - b => elements that appear in a but not in b.
function union(a, b) {
    return unique(a.concat(b));
}
function intersection(a, b) {
    var r=[], m={}, i;
    for (i=0; i < b.length; i++) m[b[i]] = true;
    for (i=0; i < a.length; i++) {
        if (a[i] in m) r.push(a[i]); 
    }
    return r;
}
function difference(a, b) {
    var r=[],  m={}, i;
    for (i=0; i < b.length; i++) m[b[i]] = true;
    for (i=0; i < a.length; i++) {
        if (!(a[i] in m)) r.push(a[i]);
    }
    return r;
}

function partition(graph) {
    /* Returns a list of unconnected subgraphs.
     */
    // Creates clusters of nodes and directly connected nodes.
    // Iteratively merges two clusters if they overlap.
    var g = [];
    for (var i=0; i < graph.nodes.length; i++) {
        var n = graph.nodes[i]; n=n.flatten();
        var d = {}; for(var j=0; j < n.length; j++) d[n[j].id] = true;
        g.push(keys(d));
    }
    for (var i=g.length-1; i >= 0; i--) {
        for(var j=g.length-1; j >= i+1; j--) {
            if (g[i].length > 0 && g[j].length > 0 && intersection(g[i], g[j]).length > 0) {
                g[i] = union(g[i], g[j]);
                g[j] = [];
            }
        }
    }
    for (var i=g.length-1; i >= 0; i--) {
        if (g[i].length == 0) g.splice(i,1);
    }
    for (var i=0; i < g.length; i++) {
        var n = []; for(var j=0; j < g[i].length; j++) n[j] = graph.nodeset[g[i][j]];
        g[i] = graph.copy(graph.canvas, nodes=n);
    }
    g.sort(function(a, b) { return b.length-a.length; });
    return g;
}

/*--- GRAPH MAINTENANCE ----------------------------------------------------------------------------*/

function unlink(graph, node1, node2) {
    /* Removes the edges between node1 and node2.
     * If only node1 is given, removes all edges to and from it.
     * This does not remove node1 from the graph.
     */
    var e = graph.edges.slice();
    for (var i=0; i < e.length; i++) {
        if ((node1 == e[i].node1 || node1 == e[i].node2) &&
            (node2 == e[i].node1 || node2 == e[i].node2 || node2 === undefined)) {
            graph.edges.splice(graph.edges.indexOf(e[i]), 1);
        }
        try {
            node1.links.remove(node1.links.indexOf(node2), 1);
            node2.links.remove(node2.links.indexOf(node1), 1);
        } catch(x) { // node2 === undefined
        }
    }
}

function redirect(graph, node1, node2) {
    /* Connects all of node1's edges to node2 and unlinks node1.
     */
    for (var i=0; i < graph.edges.length; i++) {
        var e = graph.edges[i];
        if (node1 == e.node1 || node1 == e.node2) {
            if (e.node1 == node1 && e.node2 != node2) {
                graph._addEdgeCopy(e, node2, e.node2);
            }
            if (e.node2 == node1 && e.node1 != node2) {
                graph._addEdgeCopy(e, e.node1, node2);
            }
        }
    }
    unlink(graph, node1);
}

function cut(graph, node) {
    /* Unlinks the given node, but keeps edges intact by connecting the surrounding nodes.
     * If A, B, C, D are nodes and A->B, B->C, B->D, if we then cut B: A->C, A->D.
     */
    for (var i=0; i < graph.edges.length; i++) {
        var e = graph.edges[i];
        if (node == e.node1 || node == e.node2) {
            for (var j=0; j < node.links.length; j++) {
                var n = node.links[j];
                if (e.node1 == node && e.node2 != n) {
                    graph._addEdgeCopy(e, n, e.node2);
                }
                if (e.node2 == node && e.node1 != n) {
                    graph._addEdgeCopy(e, e.node1, n);
                }
            }
        }
    }
    unlink(graph, node);
}

function insert(graph, node, a, b) {
    /* Inserts the given node between node a and node b.
     * If A, B, C are nodes and A->B, if we then insert C: A->C, C->B.
     */
    for (var i=0; i < graph.edges.length; i++) {
        var e = graph.edges[i];
        if (e.node1 == a && e.node2 == b) {
            graph._addEdgeCopy(e, a, node);
            graph._addEdgeCopy(e, node, b);
        }
        if (e.node1 == b && e.node2 == a) {
            grapg._addEdgeCopy(e, b, node);
            graph._addEdgeCopy(e, node, a);
        }
    }
    unlink(graph, a, b);
}