function Inventory(_options) {
    var self = this, NAME = "Inventory",
        objects = [], context = null, design = null,
        startPoint = 0,
        
        HOVER_SCALE_FROM = 0.9,
        HOVER_SCALE_TO = 1.1,
        HOVER_SCALE_SPEED = 25,
        SPEED_IN_INVENTORY = 2500,
        DRAW = false;
    
    this.init = function init(options) {
        context = options.context;
        design = JSON.parse(JSON.stringify(options.design));
        
        if (!design.width) {
            design.width = context.canvas.width;
        }
        if (!design.height) {
            design.height = context.canvas.height;
        }
        
        if ("bottom" in design) {
            design.top = context.canvas.height - design.height + design.bottom;
        }
        if ("right" in design) {
            design.left = context.canvas.width - design.width + design.right;
        } else {
            design.right = context.canvas.width - design.width - design.left;
        }
        
        calcStartPoint();
        
        Game.EventHandler.trigger(NAME, "init", self);
    };
    
    this.get = function get() {
        return objects;
    };
    
    this.getItemPosition = function getItemPosition(index) {
        if (typeof index == "undefined") {
            index = objects.length;
        }
        
        return [
            startPoint + index * design.items.cellSize,
            design.top + design.items.top + design.items.cellSize/2
        ];
    };
    
    this.hoverItem = function hoverItem(obj, isOver) {
        if (obj.state !== OBJECT_STATES.INVENTORY) {
            return self;
        }
        
        obj.scaleTo(isOver? HOVER_SCALE_TO : HOVER_SCALE_FROM, HOVER_SCALE_SPEED);
        obj.isHover = isOver;
        
        return self;
    };
    
    this.add = function add(obj) {
        if (obj.isInInventory || self.hasObject(obj.id)) {
            return false;
        }
        
        obj.context = context;
        obj.inInventory(true);
        obj.scaleTo(HOVER_SCALE_FROM, false);
        obj.setOrigin("center");
        
        obj.speed = SPEED_IN_INVENTORY;
        
        objects.push(obj);
        
        calcStartPoint();
        
        self.orderObjects();
        
        DRAW = true;
        
        Game.EventHandler.trigger(NAME, "add", self, {
            "obj": obj,
        });
        
        return true;
    };
    
    this.orderObjects = function orderObjects() {
        for (var i=0,l=objects.length; i<l; i++) {
            var p = self.getItemPosition(i);
            objects[i].moveTo(p[0], p[1]);
        }
    };
    
    this.remove = function remove(obj) {
        var objRemoved = null;
        
        for (var i=0,l=objects.length; i<l; i++) {
            if (objects[i].id == obj.id) {
                objRemoved = objects.splice(i, 1);
                break;
            }
        }
        
        calcStartPoint();
        self.orderObjects();
        
        Game.EventHandler.trigger(NAME, "remove", self, {
            "objRemoved": objRemoved,
        });
        
        DRAW = true;
        
        return objRemoved;
    };
    
    this.hasObject = function hasObject(objId) {
        for (var i=0,l=objects.length; i<l; i++) {
            if (objects[i].id == objId) {
                return true;
            }
        }
        
        return false;
    };
    
    this.draw = function draw() {
        context.fillStyle = "#948774";
        context.fillRect(design.left, design.top, design.width, design.height);
        
        var drawLast = null;
        for (var i=0,l=objects.length; i<l; i++) {
            
            if (window.__debug) {
                var pos = self.getItemPosition(i);
                context.fillStyle = 'rgba(0,0,0,.5)';
                context.fillRect(pos[0]-design.items.cellSize/2, pos[1]-design.items.cellSize/2, design.items.cellSize, design.items.cellSize);
                context.fillStyle = 'rgba(255,255,255,.2)';
                context.fillRect(pos[0]-design.items.cellSize/2+1, pos[1]-design.items.cellSize/2+1, design.items.cellSize-2, design.items.cellSize-2);
            }
            
            if (objects[i].state == OBJECT_STATES.DRAGGED) {
                drawLast = objects[i];
            } else {
                objects[i].draw();
            }
        }
        
        drawLast && drawLast.draw();
        
        DRAW = false;
    };
    
    function calcStartPoint() {
        var numberOfObjects = objects.length;
        
        startPoint = design.width/2 - (Math.floor(numberOfObjects/2) * design.items.cellSize);
        
        if (numberOfObjects > 0 && numberOfObjects%2 == 0) {
            startPoint += design.items.cellSize/2;
        }
    }
    
    self.init(_options);
};