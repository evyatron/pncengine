var Utils = new function() {
    var _this = this;
    
    this.GET = {};
    parseQuery();
    
	this.isDebug = function isDebug(level) {
		return (_this.GET['debug'] || 0) >= level;
	};
	
	this.clone = function(obj) {
		return JSON.parse(JSON.stringify(obj));
	};
    
    this.mergeObjects = function mergeObjects(obj1, obj2) {
        !obj1 && (obj1 = {});
        !obj2 && (obj2 = {});
        var newObject = {};
        
        for (var k in obj1) {
            newObject[k] = obj1[k];
        }
        for (var k in obj2) {
            newObject[k] = obj2[k];
        }
        
        return newObject;
    };
    
    this.isPointInPoly = function isPointInPoly(poly, x, y){
        for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
            ((poly[i][1] <= y && y < poly[j][1]) || (poly[j][1] <= y && y < poly[i][1]))
            && (x < (poly[j][0] - poly[i][0]) * (y - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])
            && (c = !c);
        
        return c;
    };
    
    this.setFromConfig = function setFromConfig(el, options) {
        if (!options) {
            return el;
        }
        
        for (var prop in options.props) {
            el[prop] = options.props[prop];
        }
        if (options.style) {
            if (options.style.webFont) {
                _this.loadFont(options.style.fontFamily);
            }
            
            var style = ';';
            for (var prop in options.style) {
                style += prop + ':' + options.style[prop] + '; ';
            }
            el.style.cssText += style;
        }
        
        return el;
    };
    
    this.loadResourceInto = function loadResourceInto(src, into, callback) {
		Utils.log('Load ', src, ' into ', into);
		
        _this.getJSON(src, function(data) {
            window[into] = data;
            callback && callback();
        });
    };
	
    this.getJSON = function getJSON(src, callback) {
		Utils.log('Get ', src);
		
		_this.get(src, function(response) {
			callback && callback(JSON.parse(response));
		});
    };
    
    this.get = function get(src, callback) {
        var request = new XMLHttpRequest();
        request.open('GET', src + '?' + Date.now(), true);
        request.onreadystatechange = function() {
            if (this.readyState === 4) {
                callback && callback(this.responseText);
            }
        };
        request.send();
    };
    
    this.cancelEvent = function cancelEvent(e) {
        e.preventDefault();
        e.stopPropagation();
    };
    
    this.loadFont = function loadFont(fontFamily) {
        var el = document.createElement('link');
        el.href = 'http://fonts.googleapis.com/css?family=' + escape(fontFamily);
        el.rel = 'stylesheet';
        el.type = 'text/css';
        document.body.appendChild(el);
    };
	
	this.getPointArea = function getPointArea(areas, point) {
		for (var areaId in areas) {
			if (Utils.isPointInPoly(areas[areaId].bounds, point[0], point[1])) {
				return areaId;
			}
		}
		
		return false;
	};
	
	this.distance = function distance(pointA, pointB) {
		var distX = pointB[0]-pointA[0],
			distY = pointB[1]-pointA[1];
		return Math.sqrt(distX*distX + distY*distY);
	};
    
    // expose these console methods, while adding my own thing
    ["log", "info", "error", "warn"].forEach(function(s) {
        _this[s] = function() {
            if (!Utils.isDebug(1) || !window.hasOwnProperty('console')) return;
            console[s].apply(console, ['[' + getTime() + ' ' + (arguments.callee.caller.name || 'anonymous') + ']:'].concat(Array.prototype.slice.call(arguments, 0)));
        };
    });
    
    function parseQuery() {
        _this.GET = {};
        
        var url = window.location.search.replace('?', '').split('&');
        for (var i=0; i<url.length; i++) {
            var p = url[i].split('='),
                key = p[0],
                value = p[1];
                
            _this.GET[key] = unescape(value);
        }
    }
    
    // get the current time in HH:MM:SS:MILI
    function getTime() {
        var d = new Date(),
            h = d.getHours(),
            m = d.getMinutes(),
            s = d.getSeconds(),
            ms = d.getMilliseconds();
            
        return [
                    h<10? "0"+h : h,
                    m<10? "0"+m : m,
                    s<10? "0"+s : s,
                    ms<10? "00"+ms : ms<100? "0"+ms : ms
                ].join(":");
    }
};

var Loader = new function() {
    var _this = this, NAME = 'Loader',
        images = [],
        status = {
            'success': 0,
            'error': 0
        },
        onSuccess = null, onError = null;
    
    this.load = function(_images, cbSuccess, cbError) {
        images = _images;
        onSuccess = cbSuccess;
        onError = cbError;
        status.success = 0;
        status.error = 0;
        
        Game.EventHandler.trigger(NAME, "load", _this, images.length);
        
        for (var i=0, image; image = images[i++];) {
            var img = new Image();
            img.onerror = onError;
            img.src = image.src || image;
            
            if (img.complete) {
                onLoad.call(img);
            } else {
                img.onload = onLoad;
            }
        }
    };
    
    this.getStatus = function() {
        return status;
    };
    
    this.getImages = function() {
        return images;
    };
    
    function onLoad(e) {
        status.success++;
        checkStatus();
    }
    
    function onError(e) {
        status.error++;
        checkStatus();
    }
    
    function checkStatus() {
        if (status.success + status.error == images.length) {
            if (status.error) {
                Game.EventHandler.trigger(NAME, "error", _this);
                onError && onError(status);
            } else {
                Game.EventHandler.trigger(NAME, "success", _this);
                onSuccess && onSuccess(status);
            }
        }
    }
};

var SettingsManager = new function() {
    var self = this,
        STORAGE_KEY = 'settings';
    
    this.get = function get(key) {
        return key? self[key] : self;
    };
    
    this.set = function set(key, value) {
        var split = key.split('.'),
            current = self;
        
        for (var i=0,key; key=split[i++];) {
            if (!current[key]) {
                current[key] = {};
            }
            
            if (i === split.length) {
                current[key] = value;
            } else {
                current = current[key];
            }
        }
    };
    
    this.save = function save() {
        if (arguments.length > 0) {
            self.set.apply(self, arguments);
        }
        
        var dataToSave = window.btoa(JSON.stringify(self));
        
        try {
            localStorage[STORAGE_KEY] = dataToSave;
        } catch(ex) {
            Utils.error('Cant save Settings! ', ex);
        }
    };
    
    this.load = function load() {
        try {
            var fromStorage = localStorage[STORAGE_KEY];
            if (fromStorage) {
                fromStorage = window.atob(fromStorage);
                fromStorage = JSON.parse(fromStorage);
                
                if (fromStorage) {
                    for (var key in fromStorage) {
                        self[key] = fromStorage[key];
                    }
                }
            }
        } catch(ex) {
            Utils.error('Cant load Settings! ', ex);
        }
    };
};

var OBJECT_STATES = {
	"INACTIVE": 0,
	"ACTIVE": 1,
	"TO_INVENTORY": 2,
	"INVENTORY": 3,
	"DRAGGED": 4
};

// simple object selector- recieves selector and scope to search on
// runs iterationFunction on all matching elements
function $(selector, scope, iterationFunction) {
	var els = null,
		isById = (selector.charAt(0) === '#' && selector.indexOf(' ') === -1);
	
	if (isById) {
		els = [document.getElementById(selector.replace(/#/, ''))];
	} else {
		!scope && (scope = document);
		els = scope.querySelectorAll(selector);
	}
	
	if (iterationFunction) {
		for (var i=0, el=els[i]; el; el=els[++i]) {
			iterationFunction.call(el);
		}
	}
	
	return isById? els[0] : els;
}

function $toArray(arg) {
	return Array.isArray(arg)? arg : [arg];
}

var DEBUG = new function() {
    var _this = this,
        active = false;
    
    this.init = function() {
        active = Utils.isDebug(1);
        
        if (!active) return;
        
        window.addEventListener('keydown', onKeyUp);
    };
    
    function onKeyUp(e) {
        if (e.keyCode == KEYS.KEY_ADMIN) {
            window.open('admin/', 'questish_admin_window', 'location=no,toolbar=no,directories=no,status=no,menubar=no,dependent=no');
        }
    }
    
    this.drawPath = function(path) {
        if (!active) return;
        
        _this.drawAreas();
        
        var context = Game.getLayerDebug();
        
        context.beginPath();
        for (var i=0; i<path.length; i++) {
            var p = path[i];
            context.lineTo(p[0], p[1]);
        }
        context.stroke();
        context.closePath();
        
        for (var i=0; i<path.length; i++) {
            var p = path[i];
            
            context.fillStyle = 'rgba(0,255,0,.2)';
            context.beginPath();
            context.arc(p[0], p[1], 16, 0, Math.PI*2, true);
            context.fill();
            context.closePath();
            
            context.fillStyle = 'rgba(0,0,0,.8)';
            context.font = "bold 18px Arial";
            context.textAlign="center"; 
            context.fillText("" + i, p[0], p[1]+6);
        }
    };
    
    this.drawAreas = function() {
        if (!active) return;
        
        var context = Game.getLayerDebug();
        
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        
        var areas = Game.getAreas();
        for (var areaId in areas) {
            var area = areas[areaId],
				bounds = area.bounds,
                inters = area.inters,
                ip = 0,
                point = null;
            
            context.beginPath();
            while (point = bounds[ip++]) {
                context.lineTo(point[0], point[1]);
            }
            context.stroke();
            if (area.locked) {
                context.fillStyle = 'rgba(255,0,0,.3)';
            } else {
                context.fillStyle = 'rgba(255,255,0,.3)';
            }
            context.fill();
            context.closePath();
            
            for (var areaIndex in inters) {
                var p = inters[areaIndex];
                context.beginPath();
                context.arc(p[0], p[1], 20, 0, Math.PI*2, true);
                context.fillStyle = 'rgba(0,0,0,.3)';
                context.fill();
                context.closePath();
            }
        }
    };
    
    _this.init();
};

// saves state of currently pressed keys
// used in stuff like 'show all interactable objects when holding Space'
var KEYS = new function() {
    var self = this,
        down = {},
        callbacks = {};
    
    this.SPACEBAR = 32;
    this.ESC = 27;
    this.RETURN = 13;
    this.LEFT = 37;
    this.UP = 38;
    this.RIGHT = 39;
    this.DOWN = 40;
    this.ALT = 18;
    this.CTRL = 17;
    this.SHIFT = 16;
    this.F1 = 112;
    this.F2 = 113;
    this.F3 = 114;
    this.F4 = 115;
    this.F5 = 116;
    this.F6 = 117;
    this.F7 = 118;
    this.F8 = 119;
    this.F9 = 120;
    this.F10 = 121;
    this.F11 = 122;
    this.F12 = 113;
    this.Q = 81;
    
    this.KEY_MARKERS = self.CTRL;
    this.KEY_ADMIN = self.Q;
    this.KEY_MENU = self.SPACEBAR;
    this.KEY_FULLSCREEN = self.F11;
    this.KEY_ADVANCE_DIALOG = self.RETURN;
    
    this.init = function init() {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
    };
    
    this.isDown = function() {
        for (var i=0,keyToCheck; keyToCheck=arguments[i++];) {
            if (!down[''+keyToCheck]) {
                return false;
            }
        }
        
        return true;
    };
    
    this.on = function on(whichKey, callback) {
        var key = '' + whichKey;
        
        if (!(key in callbacks)) {
            callbacks[key] = [];
        }
        
        callbacks[key].push(callback);
    };
    
    this.off = function off(whichKey, callback) {
        var key = '' + whichKey,
            keyCallbacks = callbacks[key];
        
        if (keyCallbacks) {
            for (var i=0,cb; cb=keyCallbacks[i++];) {
                if (callback === cb) {
                    keyCallbacks.splice(i-1, 1);
                }
            }
        }
    };
    
    function onKeyDown(e) {
        var key = '' + e.keyCode;
        
        if (down[key]) {
            return;
        }
        
        down[key] = true;
        
        var keyCallbacks = callbacks[key];
        if (keyCallbacks) {
            e.preventDefault();
            e.stopPropagation();
            for (var i=0,cb; cb=keyCallbacks[i++];) {
                cb(e);
            }
        }
    }
    
    function onKeyUp(e) {
        delete down[''+e.keyCode];
    }
    
    self.init();
}

var AreaCreator = new function() {
    var _this = this,
        elContainer = null, elCanvas = null, context = null,
        active = false, points = [];
        
    this.init = function(options) {
        elContainer = $("#container");
        
        window.addEventListener("keyup", onKeyUp);
    };
    
    function createCanvas() {
        elCanvas = document.createElement("canvas");        
        elCanvas.id = 'layer_areacreator';
        elCanvas.width = Game.getGameSize().width;
        elCanvas.height = Game.getGameSize().canvasHeight;
        
        elCanvas.addEventListener("click", onClick);
            
        elCanvas.style.cssText = 'position: absolute; top: 0; left: 0; z-index: 100;';
        elCanvas.style.width = elCanvas.width * Game.getScaleRatio() + 'px';
        elCanvas.style.height = elCanvas.height * Game.getScaleRatio() + 'px';
        
        context = elCanvas.getContext("2d");
        
        context.strokeStyle = 'rgba(0,0,0,.8)';
        
        elContainer.appendChild(elCanvas);
    }
    
    function removeCanvas() {
        elCanvas.removeEventListener("click", onClick);
        elCanvas.parentNode.removeChild(elCanvas);
    }
    
    this.start = function() {
        if (active) return;
        
        _this.clear();
        createCanvas();
        active = true;
        draw();
    };
    
    this.addPoint = function(x, y) {
        if (!active) return;
        
        x = Math.round(x);
        y = Math.round(y);
        
        points.push([x, y]);
        draw();
        
        console.info("Adding point [" + x + "," + y + "]");
    };
    
    this.end = function() {
        if (!active) return;
        
        if (points.length > 0) {
            _this.addPoint(points[0][0], points[0][1]);
        }
        
        draw(true);
        window.setTimeout(removeCanvas, 1000);
        active = false;
        
        console.info(JSON.stringify(points));
    };
    
    this.getPoints = function() {
        return points;
    };
    
    this.clear = function() {
        points = [];
    };
    
    function draw(shouldFill) {
        context.clearRect(0, 0, elCanvas.width, elCanvas.height);
        
        context.fillStyle = 'rgba(255,255,0,.2)';
        context.fillRect(0, 0, elCanvas.width, elCanvas.height);
        
        context.beginPath();
        for (var i=0, point=points[i]; point; point=points[++i]) {
        console.info("line to " , point);
            context.lineTo(point[0], point[1]);
        }
        context.stroke();
        
        if (shouldFill) {
            context.fillStyle = 'rgba(255,0,0,.4)';
            context.fill();
        }
        context.closePath();
    }
    
    function onClick(e) {
        var offset = Game.getCanvasOffset(),
            ratio = Game.getScaleRatio();
        
        _this.addPoint((e.pageX - offset.x) / ratio, (e.pageY - offset.y) / ratio);
    }
    
    function onKeyUp(e) {
        if (e.keyCode === 192 || e.keyCode === 59) {
            if (!active) {
                _this.start();
            } else {
                _this.end();
            }
        }
    }
};

// requestAnimFrame polyfill
window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.oRequestAnimationFrame      ||
            window.msRequestAnimationFrame     ||
            function( callback ){
                return window.setTimeout(callback, 1000 / 60);
            };
})();


// FIXES FOR IE
/*! @source http://purl.eligrey.com/github/classList.js/blob/master/classList.js*/
if(typeof document!=="undefined"&&!("classList" in document.createElement("a"))){(function(j){var a="classList",f="prototype",m=(j.HTMLElement||j.Element)[f],b=Object,k=String[f].trim||function(){return this.replace(/^\s+|\s+$/g,"")},c=Array[f].indexOf||function(q){var p=0,o=this.length;for(;p<o;p++){if(p in this&&this[p]===q){return p}}return -1},n=function(o,p){this.name=o;this.code=DOMException[o];this.message=p},g=function(p,o){if(o===""){throw new n("SYNTAX_ERR","An invalid or illegal string was specified")}if(/\s/.test(o)){throw new n("INVALID_CHARACTER_ERR","String contains an invalid character")}return c.call(p,o)},d=function(s){var r=k.call(s.className),q=r?r.split(/\s+/):[],p=0,o=q.length;for(;p<o;p++){this.push(q[p])}this._updateClassName=function(){s.className=this.toString()}},e=d[f]=[],i=function(){return new d(this)};n[f]=Error[f];e.item=function(o){return this[o]||null};e.contains=function(o){o+="";return g(this,o)!==-1};e.add=function(o){o+="";if(g(this,o)===-1){this.push(o);this._updateClassName()}};e.remove=function(p){p+="";var o=g(this,p);if(o!==-1){this.splice(o,1);this._updateClassName()}};e.toggle=function(o){o+="";if(g(this,o)===-1){this.add(o)}else{this.remove(o)}};e.toString=function(){return this.join(" ")};if(b.defineProperty){var l={get:i,enumerable:true,configurable:true};try{b.defineProperty(m,a,l)}catch(h){if(h.number===-2146823252){l.enumerable=false;b.defineProperty(m,a,l)}}}else{if(b[f].__defineGetter__){m.__defineGetter__(a,i)}}}(self))};
/*! @source http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9*/
if (Function.prototype.bind && console && typeof console.log == "object" && typeof console.log.apply == "undefined") { console.warn("Fixing console[method].apply (IE?)"); ["log","info","warn","error","assert","dir","clear","profile","profileEnd"].forEach(function (method) { console[method] = this.bind(console[method], console); }, Function.prototype.call); }