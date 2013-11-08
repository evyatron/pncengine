function PointerHandler(constructorOptions) {
    var self = this,
        elContainer = null,
        cbDown = null, cbMove = null, cbUp = null,
        pointerDownData = null,
        offsetX = 0, offsetY = 0, ratio = 1,
        active,
        
        HAS_TOUCH = ("ontouchstart" in window),
        EV_START = HAS_TOUCH? "touchstart": "mousedown",
        EV_MOVE = HAS_TOUCH? "touchmove": "mousemove",
        EV_END = HAS_TOUCH? "touchend": "mouseup";
        
    this.isDown = false;
        
    this.init = function(options) {
        elContainer = options.elContainer;
        
        self.updateOffsetAndRatio();
        
        cbDown = options.onPointerDown;
        cbMove = options.onPointerMove;
        cbUp = options.onPointerUp;
        
        (options.elOnDown || elContainer).addEventListener(EV_START, onPointerDown);
        (options.elOnMove || elContainer).addEventListener(EV_MOVE, onPointerMove);
        (options.elOnUp || elContainer).addEventListener(EV_END, onPointerUp);
        
        active = true;
    };
    
    this.updateOffsetAndRatio = function updateOffsetAndRatio() {
        var bounds = elContainer.getBoundingClientRect();
        self.setOffsetAndRatio(bounds.left, bounds.top, 1);
    };
    
    this.setOffsetAndRatio = function setOffsetAndRatio(x, y, _ratio) {
        offsetX = x;
        offsetY = y;
        ratio = _ratio;
    };
    
    this.hasTouch = function hasTouch() {
        return HAS_TOUCH;
    };
    
    this.enable = function enable() {
        active = true;
    };
    
    this.disable = function disable() {
        active = false;
    };
    
    function onPointerDown(e) {
        e.preventDefault();
        
        if (!active) {
            return;
        }
        if ("button" in e && e.button !== 0) {
            return;
        }
        
        self.isDown = true;
        
        pointerDownData = cbDown.apply(self, getEventPoints(e));
    }
    
    function onPointerMove(e) {
        e.preventDefault();
        
        if (!active) {
            return;
        }
        if ("button" in e && e.button !== 0) {
            return;
        }
        
        cbMove.apply(self, getEventPoints(e).concat(self.isDown));
    }
    
    function onPointerUp(e) {
        if (!self.isDown) return;
        
        e.preventDefault();
        
        if (!active) {
            return;
        }
        if ("button" in e && e.button !== 0) {
            return;
        }
        
        self.isDown = false;
            
        cbUp.apply(self, getEventPoints(e).concat(pointerDownData || {}));
    }
    
    function getEventPoints(e) {
        e = (e.changedTouches || e.touches || [e])[0];
        
        return [
                (e.pageX - offsetX) / ratio,
                (e.pageY - offsetY) / ratio
               ];
    }
    
    constructorOptions && self.init(constructorOptions);
};