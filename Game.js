var Game = new function() {
    var self = this, NAME = 'Game',
        _config, running = false, stopReason = '',
        elContainer = null,
        screenSize = {}, gameSize = {},
        
        Sprite_Player = null, 
        layerBackground = null, Sprite_Background = null,
        layerObjects = null, objects = {}, objectsOrdered = [],
        layerInventory = null, inventory = null,
        
        mainPointerHandler,
        location = null, lastUpdate = 0,
        draggedObject = null,
        timeStartedDragging = 0,
        actionOnReach = {},
        callbackPlayerReached,
        
        layerDebug = null,
        Status = null, Menu = null,
        activeDialog,
        
        markers = {},
        
        CURRENT_CURSOR_POSITION = [],
        TIMEOUT_TO_RELEASE_DRAGGED_OBJECT = 200,
        WINDOW_PADDING = 0,
        SCRIPT_BASE = '/playground/pncengine/',
        FILES_TO_LOAD = ['Objects', 'Sprite', 'Utils', 'Path', 'Player', 'PointerHandler', 'Inventory', 'Status', 'GameMenu', 'Dialogue', 'SoundManager'],
        RESOURCES_TO_LOAD = {
            'OBJECTS': 'data/objects.json',
            'TEXTS': 'data/texts.json',
            'LOCATIONS': 'data/locations.json'
        },
        
        DEFAULT_INVENTORY_HEIGHT = 140,
        DEFAULT_STATUS_HEIGHT = 30;
	
    this.init = function init(options) {
        _config = options.config;
        elContainer = options.elContainer;
        
        setConfigDefaults();
        
        WINDOW_PADDING = _config.ui.game.props.margin || 0;
        
        gameSize = {
            "width": _config.ui.game.props.width,
            "canvasHeight": _config.ui.game.props.height,
            "totalHeight": _config.ui.game.props.height + _config.ui.status.height + _config.ui.inventory.height
        };
        
        gameSize.ratio = gameSize.width / gameSize.totalHeight;
        
        for (var markerType in _config.markers) {
            setupMarker(markerType);
        }
        
        // load all required scripts
        loadScripts(function onScriptsLoaded() {
            // populate saved settings
            SettingsManager.load();
            
            Fullscreen.init();
            
            Loading.init({
                'elContainer': document.body,
                'text': 'Getting things ready...'
            });
            
            // create the game layers (canvases)
            layerBackground = createLayer("background", _config.ui.game);
            layerDebug = createLayer("debug", _config.ui.game);
            layerObjects = createLayer("objects", _config.ui.game);
            layerInventory = createLayer("inventory", _config.ui.inventory);
            
            Loading.show();
            
            // load the resources needed to start the game- texts and configurations
            self.loadResources(function(){
                initClasses();
                
                window.addEventListener("contextmenu", Utils.cancelEvent);
                window.addEventListener("resize", onResize);
                window.addEventListener("focus", onPageShow);
                window.addEventListener("blur", onPageHide);
                onResize();
                
                inventory = new Inventory({
                    "context": layerInventory,
                    "design": _config.ui.inventory
                });
                
                self.showLocation(Utils.GET['location'] || _config.first_location || Object.keys(LOCATIONS)[0]);
            });
        });
    };
    
    function setConfigDefaults() {
        if (!_config.ui.inventory) {
            _config.ui.inventory = {};
        }
        if (!_config.ui.inventory.height) {
            _config.ui.inventory.height = DEFAULT_INVENTORY_HEIGHT;
        }
        
        if (!_config.ui.status) {
            _config.ui.status = {};
        }
        if (!_config.ui.status.height) {
            _config.ui.status.height = DEFAULT_STATUS_HEIGHT;
        }
        if (!_config.ui.status.bottom) {
            _config.ui.status.bottom = _config.ui.inventory.height;
        }
    }
    
    function setupMarker(markerType) {
        var markerData = _config.markers[markerType],
            img = new Image();
        
        img.onload = function onMarkerLoad() {
            markers[markerType] = {
                "image": this,
                "width": markerData.width || this.width,
                "height": markerData.height || this.height
            };
        };
        
        img.src = markerData.image || 'images/markers/' + markerType.toLowerCase() + '.png';
    }
    
    // load all the script files needed for the game engine
    function loadScripts(callback) {
        var filesLoaded = FILES_TO_LOAD.length,
            onScriptLoaded = function onScriptLoaded() {
                filesLoaded--;
                this.parentNode.removeChild(this);
                if (filesLoaded === 1) {
                    callback();
                }
            },
            onScriptError = function onScriptError() {
                console.error('Load script error! ' + this);
            };
        
        for (var i=0, file; file=FILES_TO_LOAD[i++];) {
            var elScript = document.createElement('script');
            elScript.onload = onScriptLoaded;
            elScript.onerror = onScriptError;
            elScript.src = SCRIPT_BASE + file + '.js';
            document.body.appendChild(elScript);
        }
    }
    
    // load the resources needed to start the game- texts and configurations
    // if there is an admin window open (debug+q)- use its data
    this.loadResources = function loadResources(callback) {
        var resourceVarName;
        
        if (window.adminWindow) {
            for (resourceVarName in RESOURCES_TO_LOAD) {
                window[resourceVarName] = window.adminWindow[resourceVarName];
            }
        } else {
            for (resourceVarName in RESOURCES_TO_LOAD) {
                Utils.loadResourceInto(RESOURCES_TO_LOAD[resourceVarName], resourceVarName, function() {
                    onResourceLoaded(callback);
                });
            }
        }
    };
    
    function onResourceLoaded(onComplete) {
        for (var resourceVarName in RESOURCES_TO_LOAD) {
            if (!(resourceVarName in window)) {
                return false;
            }
        }
        
        onComplete && onComplete();
        
        return true;
    }
    
    // initialize all classes the game uses
    function initClasses() {
        // objects manager- sort of like a DB
        Objects.init({
            "objects": OBJECTS
        });
        
        // sound manager- for playing... wait for it... sounds.
        SoundManager.init({
            "baseUrl": 'sounds/',
            "volumes": Utils.mergeObjects(_config.sound, SettingsManager.get('volume'))
        });
        
        // Status line (in-game indication)
        Status = new StatusLine({
            "elContainer": elContainer,
            "ui": _config.ui.status
        });
        self.Status = Status;
        
        // game menu (opened on ESC)
        Menu = new GameMenu({
            "elContainer": document.body
        });
        self.Menu = Menu;
        
        // handler for mouse/touch events
        mainPointerHandler = new PointerHandler({
            "elContainer": elContainer,
            "onPointerDown": onPointerDown,
            "onPointerMove": onPointerMove,
            "onPointerUp": onPointerUp
        });
        
        // debug only- helper in creating new walk zones
        if (Utils.GET['debug']) {
            AreaCreator.init();
        }
    }
    
    // clear current location and load up a new one according to @locationId
    this.switchLocation = function switchLocation(locationId) {
        elContainer.classList.add('hide');
        
        window.setTimeout(function onHidden() {
            Game.cleanLocation(function(){
                Game.showLocation(locationId, location, function onLocationReady() {
                    window.setTimeout(function showGame() {
                        elContainer.classList.remove('hide');
                    }, 50);
                });
            });
        }, 300);
    };
    
    // show the @id location- load all it's images, and call startLocation once it's ready
    this.showLocation = function showLocation(newLocationId, currentLocation, callback) {
        Game.EventHandler.trigger(NAME, "showLocation", newLocationId, currentLocation);
        
        location = LOCATIONS[newLocationId];
        location.id = newLocationId;
        !location.width && (location.width = _config.ui.game.props.width - _config.ui.inventory.width);
        !location.height && (location.height = gameSize.canvasHeight);
        
        Utils.info('Show location: ', location.id, ': ', location);
        
        var imagesToLoad = [];
		
		location.image && imagesToLoad.push(location.image);
		_config.player.image && imagesToLoad.push(_config.player.image);
		
        for (var id in location.objects) {
            if (location.objects[id].type) {
                imagesToLoad.push(Objects.getDataByType(location.objects[id].type).image);
            }
        }

        Loader.load(imagesToLoad, function onSuccess() {
            self.startLocation(currentLocation);
            callback && callback();
        });
    };
    
    // after all the resources have been pre-loaded, add everything on screen and let's start!
    this.startLocation = function startLocation(previousLocation) {
        Sprite_Background = new Sprite({
            "id": "background",
            "context": layerBackground,
            "image": location.image,
            "x": location.width/2,
            "y": location.height/2,
            "width": location.width,
            "height": location.height,
            "state": OBJECT_STATES.INACTIVE,
			"_isScene": true
        }).draw();
        
        var playerData = {
            "id": "player",
            "context": layerObjects,
            "prespective": location.prespective
        };
        Utils.setFromConfig(playerData, {"props": _config.player});
        
        var startPoint = (previousLocation && (location.startFrom || {})[previousLocation.id]) || location;
        if (startPoint.start) {
            playerData.x = startPoint.start[0];
            playerData.y = startPoint.start[1];
        }
        if (startPoint.dir && startPoint.dir[0] === -1) {
            playerData._flipped = true;
        }
        
        Sprite_Player = new Sprite(playerData).draw();
        
        DEBUG.drawAreas();
        
        addLocationObjects();
        
        if (location.backgroundMusic && 'src' in location.backgroundMusic) {
            location.backgroundMusic.type = 'music';
            location.backgroundMusic.loop = true;
            location.backgroundMusic.volume = _config.bgmusicVolume;
            SoundManager.play(location.backgroundMusic);
        }
        
        Game.EventHandler.trigger(NAME, "startLocation", self, location);
        
        self.start('newlocation');
        
        if (location.onStart) {
            ObjectActions.call(location.onStart);
        }
    };
    
    // clear the current location- reset objects and everything on screen
    this.cleanLocation = function(callback) {
        self.stop('newlocation', function() {
            objectsOrdered = [];
            
            for (var id in objects) {
                if (!inventory.hasObject(id)) {
                    delete objects[id];
                } else {
                    objectsOrdered.push(id);
                }
            }
            
            delete Sprite_Background;
            Sprite_Background = null;
            delete Sprite_Player;
            Sprite_Player = null;
            
            SoundManager.stop();
            
            callback && callback();
        });
    };
    
    // return the currently running location
    this.getLocation = function getLocation() {
        return location;
    };
    
    // return the game's scale ratio (when the game is resized)
    this.getScaleRatio = function getScaleRatio() {
        return screenSize.ratio;
    };
    
    // return the game's offset relative to the screen (used for pointer event handling)
    this.getCanvasOffset = function getCanvasOffset() {
        return {
            "x": screenSize.offsetX,
            "y": screenSize.offsetY
        };
    };
    
    // return current game size (from config)
    this.getGameSize = function getGameSize() {
        return gameSize;
    };
    
    // return current locations allowed walking areas
    this.getAreas = function getAreas() {
        return location.walkZone;
    };
    
    // return layer used for debug (to draw all debug info)
    this.getLayerDebug = function getLayerDebug() {
        return layerDebug;
    };
    
    // return an object by its ID
    this.getObject = function getObject(id) {
        return objects[id] || createTypeObject(id);
    };
    
    // return an object's data (from the config) by its ID
    // can be passed an id with dot notation, denoting locationId.objectId
    this.getObjectData = function getObjectData(id) {
        var locationId = self.getLocation().id,
            objectId = id;
        
        if (objectId.indexOf('.') !== -1) {
            objectId = objectId.split('.');
            locationId = objectId[0];
            objectId = objectId[1];
        }
        
        return LOCATIONS[locationId].objects[objectId];
    };
    
    // return the player's sprite object
    this.getPlayerObject = function getPlayerObject() {
        return Sprite_Player;
    };
    
    // stop the game- stop the game loop tick (when showing the menu, for example)
	// gets a source argument- save it to match the game.start
    this.stop = function stop(source, callback) {
        if (source === 'visibility') {
            SoundManager.pause();
        }
        
        if (!running) return;
        
		stopReason = source;
        running = false;
        callback && window.setTimeout(callback, 50);
        
        Game.EventHandler.trigger(NAME, "stop", source);
    };
    
    // start the game- make the game loop tick
	// gets a source argument- only if it matches the source that stopped the game, can it restart it
    // this prevent scenarios where the game is stopped by a dialogue, but resumed by closing the menu
    this.start = function start(source) {
        if (source === 'visibility') {
            SoundManager.resume();
        }

        if (running) return;
		if (stopReason && stopReason !== source) return;
        
        running = true;
		stopReason = '';
        lastUpdate = Date.now();
        window.requestAnimFrame(tick);
        
        Game.EventHandler.trigger(NAME, "start", source);
    };
    
    // main game loop- update and draw everything on screen
    function tick() {
        var now = Date.now(),
            dt = (now-lastUpdate)/1000,
            bDrawMarkers = KEYS.isDown(KEYS.KEY_MARKERS),
            width = gameSize.width,
            height = gameSize.totalHeight,
            playerDrawn,
            objToDrawMarkerFor = [],
            i, obj,
            numberOfObjects=objectsOrdered.length;
        
        // update all the objects- move, scale, animate, etc.
        Sprite_Player.update(dt, now);
        for (var id in objects) {
            objects[id].update(dt, now);
        }
        
        // clean the scene
        layerObjects.clearRect(0, 0, width, height);
        layerInventory.clearRect(0, 0, width, height);
        
        // draw ALL the objects!
        for (i=0; obj=objects[objectsOrdered[i++]];) {
            // make sure we draw the player in the right z-index
            if (!playerDrawn && (Sprite_Player.orderPoint < obj.orderPoint || i === numberOfObjects)) {
                Sprite_Player.draw();
                playerDrawn = true;
            }
            
            // draw the actual object
            obj.draw();
            
            // if the marker key is down (usually CTRL), or cursor is on the object, draw its marker
            if ((bDrawMarkers || obj.isHover) && obj.marker && !obj.isInInventory) {
                objToDrawMarkerFor.push(obj);
            }
        }
        
        if (objToDrawMarkerFor.length > 0) {
            var markerObj;
            for (i=0,markerObj; markerObj=objToDrawMarkerFor[i++];) {
                drawMarkerAt(markerObj);
            }
        }
        
        if (!playerDrawn) {
            Sprite_Player.draw();
        }

        // draw the inventory
        inventory.draw();
        
        // set up next tick
        lastUpdate = now;
        running && window.requestAnimFrame(tick);
    }
    
    function drawMarkerAt(objToMark) {
        var objMarker = objToMark.getMarker(),
            markerPoint = objMarker.position,
            marker = markers[objMarker.type],
            width = marker && marker.width * (objMarker.scale || 1),
            height = marker && marker.height * (objMarker.scale || 1);
        
        if (marker) {
            layerObjects.drawImage(marker.image, markerPoint[0] - width/2, markerPoint[1] - height/2,  width,  height);
        }
    }
    
    // creates a layer (canvas) from the given ID and options
    function createLayer(id, options) {
        !options && (options = {});
        
        var elCanvas = document.createElement("canvas"),
            context = elCanvas.getContext("2d");
            
        elCanvas.id = "layer_" + id;
        
        elCanvas.width = gameSize.width;
        elCanvas.height = gameSize.totalHeight;
        Utils.setFromConfig(elCanvas, options);
        
        elContainer.appendChild(elCanvas);
        
        return context;
    }
    
    // create all the obejcts and characters for the location
    function addLocationObjects() {
        for (var objId in location.objects) {
            if (!location.objects[objId].inactive) {
                createObject(objId);
            }
        }
        for (var charId in location.characters) {
            if (!location.characters[charId].inactive) {
                createObject(charId);
            }
        }
        
        var inventoryObjects = inventory.get();
        for (var i=0,obj=inventoryObjects[i]; obj; obj=inventoryObjects[++i]) {
            createObject(obj.id);
        }
        
        sortObjectsOnScreen();
    }
    
    // all the objects will be drawn on the screen according to the order defined here
    // objects that are drawn first will be in the background, last is foreground
    function sortObjectsOnScreen() {
        objectsOrdered.sort(objectsSortable);
    }
    
    function objectsSortable(a, b) {
        var obj1 = objects[a],
            obj2 = objects[b];

        return  obj1.orderPoint > obj2.orderPoint? 1 :
                obj1.orderPoint < obj2.orderPoint? -1 :
                0;
    }
    
    // main method for creating an object by it's ID
    // take the default object data from the DB, combine it with the specific location data,
    // and create a new Sprite
    function createObject(objId, bSort) {
        if (objects[objId]) {
            return null;
        }
        
        var objData = location.objects[objId],
            isCharacter = false,
            typeData;
            
        if (!objData) {
            objData = location.characters[objId];
            isCharacter = true;
        }
        
        typeData = Objects.getDataByType(objData.type);

        if (!objData.script) {
            objData.script = {};
        }
        if (objData.position) {
            objData.x = objData.position[0];
            objData.y = objData.position[1];
        }
        
        var spriteInitData = {
            "id": objId,
            "context": layerObjects
        };
        
        if (isCharacter) {
            spriteInitData.prespective = location.prespective;
        }
        
        for (var keyType in typeData) {
            spriteInitData[keyType] = typeData[keyType];
        }
        for (var keyObj in objData) {
            spriteInitData[keyObj] = objData[keyObj];
        }
        
        var obj = new Sprite(spriteInitData);
        
        if (objData.script.inventoryOnly) {
            var p = inventory.getItemPosition();
            if (!objData.position) {
                obj.setPosition(p[0], p[1]);
            }
            inventory.add(obj);
        }
        
        addObjectToGame(obj);
        
        if (bSort) {
            sortObjectsOnScreen();
        }
        
        return obj;
    }
    
    function addObjectToGame(obj) {
        objects[obj.id] = obj;
        objectsOrdered.push(obj.id);
    }
    
    function createObjectFromType(typeId) {
        var obj = null,
            data = Objects.getDataByType(typeId);
            
        if (!data) {
            return obj;
        }
        
        data.id = typeId + '_' + Date.now();
        data.type = typeId;
        data.context = layerObjects;
        
        obj = new Sprite(data);
        
        addObjectToGame(obj);
        
        return obj;
    }
    
    function createTypeObject(typeId) {
        var data = Objects.getDataByType(typeId),
            obj;

        if (!data) {
            return obj;
        }
        
        obj = new Sprite(data);
        
        return obj;
    }
    
    // fired when the player starts moving along a path
	function playerStartedPath() {
		Sprite_Player.startAnimation('WALK');
	}
	
    // fired when the player's sprite reached the point it was heading
    function playerFinishedPath() {
		Sprite_Player.stopAnimation('WALK');
        
        var objReached = actionOnReach.obj;
        if (objReached) {
            if (objReached.script.directionOverride) {
                Sprite_Player.setFlip(objReached.script.directionOverride !== 1);
            }
            
            stopDraggingObject();
            ObjectActions.call(null, objReached, actionOnReach.objWith);
            
            cancelPlayerReachAction();
        }
        
        if (callbackPlayerReached) {
            callbackPlayerReached();
        }
    }
    
    // cancels the currently pending player action
    function cancelPlayerReachAction() {
        if (!actionOnReach.obj) return;
        
        actionOnReach.obj = null;
        actionOnReach.objWith = null;
    }
    
    // move the player to a specific point, and fire a callback when reached
    function movePlayerTo(x, y, callback) {
		var path = new Path({
				"areas": location.walkZone,
				"pointA": Sprite_Player.getPosition(),
				"pointB": [x, y]
			}),
			points = path.getPoints();
		
        
        callbackPlayerReached = callback || false;
        
        Sprite_Player.setPath(points);
        DEBUG.drawPath(points);
        
        return true;
    }
    
    // given a destination area and a point in it, this method will set the player on his path
    function setPathToArea(destinationArea, x, y) {
		var path = new Path({
				"areas": location.walkZone,
				"pointA": Sprite_Player.getPosition(),
				"pointB": [x, y]
			}),
			points = path.getPoints();
		
        callbackPlayerReached = null;
        
        Sprite_Player.setPath(points);
        DEBUG.drawPath(points);
        
        return true;
    }
    
    // check if the X and Y coordinates "hit" something on the screen- a sprite or an area
    function getClickedElement(x, y, whatToCheck) {
        var response = {
            "obj": null,
            "area": null
        };
        
        if (!running) return response;
        
        if (!whatToCheck || whatToCheck["obj"]) {
            for (var i=objectsOrdered.length-1,l=0; i>=0; i--) {
                var obj = objects[objectsOrdered[i]];
                if (obj.isPointInside(x, y)) {
                    response.obj = obj;
                    break;
                }
            }
        }
        
        if (!whatToCheck || whatToCheck["area"]) {
            for (var areaId in location.walkZone) {
				var area = location.walkZone[areaId];
				
                if (!area.locked && Utils.isPointInPoly(area.bounds, x, y)) {
                    response.area = areaId;
                    break;
                }
            }
        }
        
        return response;
    }
    
    // pick up and start dragging the given obj
    function startDraggingObject(obj) {
        if (obj && obj.isInInventory) {
            timeStartedDragging = Date.now();
            
            draggedObject = obj;
            draggedObject.startDragging();
            
            return true;
        }
        
        return false;
    }
    
    // drop the currently dragged object
    function stopDraggingObject() {
        if (!draggedObject || Date.now() - timeStartedDragging < TIMEOUT_TO_RELEASE_DRAGGED_OBJECT) return false;
        
        draggedObject.stopDragging(OBJECT_STATES.INVENTORY);
        draggedObject = null;
        inventory.orderObjects();
        
        return true;
    }
    
    // use obj1 with obj2 (obj2 can be empty)
    function useObject(obj1, obj2) {
        stopDraggingObject();
        
        ObjectActions.call(null, obj1, obj2);
    }
    
    // event handler - pointer down (mousedown or touchstart)
    function onPointerDown(x, y) {
        var clicked = getClickedElement(x, y),
            didClickSprite = clicked && clicked.obj && clicked.obj.state === OBJECT_STATES.ACTIVE,
            pathSet;
        
        CURRENT_CURSOR_POSITION = [x, y];
        
        if (!draggedObject && clicked.obj && clicked.obj.isInInventory) {
            startDraggingObject(clicked.obj);
        }
        
        if (clicked.area && draggedObject && !didClickSprite) {
            pathSet = true;
            setPathToArea(clicked.area, x, y);
        }
        
        // this will be passed to the pointerUp event
        return {
            "clicked": clicked,
            "pathSet": pathSet,
            "x": x,
            "y": y
        };
    }
    
    // event handler - pointer move (mousemove or touchmove)
    function onPointerMove(x, y) {
        // if user is dragging an object- move it according to the cursor
        draggedObject && draggedObject.setPosition(x, y);
        
        // iterate over the objects in a REVERSE order
        // since the object that's most forward (in the objects' order)
        // need to get the "focus"
        for (var i=objectsOrdered.length-1, bHovered=false, obj; obj=objects[objectsOrdered[i--]];) {
            var isOnObject = obj.isPointInside(x, y);
            
            obj.hover(!bHovered && isOnObject);
            
            if (isOnObject && !obj.isInInventory) {
                bHovered = true;
            }
        }
    }
    
    // event handler - pointer up (mouseup or touchend)
    function onPointerUp(x, y, pointerDownData) {
        var clicked = getClickedElement(x, y),
            shouldContinueToArea = false;
        
        if (clicked.obj) {
            if (draggedObject) {
                if (clicked.obj.isInInventory) {
                    stopDraggingObject();
                    ObjectActions.call(null, draggedObject, clicked.obj);
                }
            }
            
            if (clicked.obj.state == OBJECT_STATES.ACTIVE) {
                actionOnReach.obj = clicked.obj;
                actionOnReach.objWith = draggedObject;
                
                cancelPlayerReachAction();
                
                ObjectActions.call(null, clicked.obj, draggedObject);
                
                shouldContinueToArea = false;
            }
        } else if (clicked.area) {
            cancelPlayerReachAction();
            shouldContinueToArea = !draggedObject;
        }
        
        if (!pointerDownData.pathSet && shouldContinueToArea && clicked.area) {
            setPathToArea(clicked.area, x, y);
        }
        
        stopDraggingObject();
    }
    
    var Loading = new function() {
        var NAME = 'Loading', self = this,
            el = null, isActive;
            
        this.init = function init(options) {
            el = document.createElement('div');
            el.id = 'loading';
            el.innerHTML = '<span></span><b>' + options.text + '</b>';
            
            options.elContainer.appendChild(el);
        };
        
        this.show = function show() {
            if (isActive) return;
            el.classList.add('visible');
            isActive = true;
            Game.EventHandler.trigger(NAME, 'show');
        };
        
        this.hide = function show() {
            if (!isActive) return;
            el.classList.remove('visible');
            isActive = false;
            Game.EventHandler.trigger(NAME, 'hide');
        };
        
        this.setText = function setText(newText) {
            $('b', el)[0].innerHTML = newText;
        };
        
        this.isActive = function isActive() {
            return isActive;
        };
    }
    
    var Fullscreen = new function() {
        var NAME = 'Fullscreen', self = this,
            supported = false, isActive = false,
            
            SETTINGS_KEY = 'fullscreen',
            FLAG_IS_FULLSCREEN = 'fullscreen',
            EVENT_FULLSCREEN_CHANGE = 'onfullscreenchange';
        
        this.init = function() {
            var i, flag, ev,
                flags = ['mozFullScreen', 'webkitIsFullScreen', 'msFullScreen', 'oFullScreen'],
                events = ['onmozfullscreenchange', 'onwebkitfullscreenchange', 'onmsfullscreenchange', 'onofullscreenchange'];

            for (i=0,flag; flag=flags[i++];) {
                if (flag in document) {
                    FLAG_IS_FULLSCREEN = flag;
                }
            }
            for (i=0,ev; ev=events[i++];) {
                if (ev in document) {
                    EVENT_FULLSCREEN_CHANGE = ev;
                }
            }
            
            
            document.body.requestFullScreen = (function(){
                return  document.body.requestFullScreen       ||
                        document.body.webkitRequestFullScreen ||
                        document.body.mozRequestFullScreen    ||
                        document.body.oRequestFullScreen      ||
                        document.body.msRequestFullScreen     ||
                        null
            })();
            document.cancelFullScreen = (function(){
                return  document.cancelFullScreen       ||
                        document.webkitCancelFullScreen ||
                        document.mozCancelFullScreen    ||
                        document.oCancelFullScreen      ||
                        document.msCancelFullScreen     ||
                        null
            })();
            
            if (!document.body.requestFullScreen || !document.cancelFullScreen) {
                Utils.warn('fullscreen not supported!');
                supported = false;
            } else {
                supported = true;
                document[EVENT_FULLSCREEN_CHANGE] = self.fireEvent;
                KEYS.on(KEYS.KEY_FULLSCREEN, self.toggle);
            }
        };
        
        this.enter = function enter() {
            if (!supported || isActive) {
                return false;
            }
            
            document.body.requestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
            
            return self.fireEvent();
        };
        
        this.leave = function leave() {
            if (!supported || isActive) {
                return false;
            }
            
            document.cancelFullScreen();
            
            return self.fireEvent();
        };
        
        this.toggle = function toggle() {
            return isActive? self.leave() : self.enter();
        };
        
        this.isActive = function isActive() {
            return isActive;
        };
        
        this.fireEvent = function fireEvent() {
            var newState = document[FLAG_IS_FULLSCREEN];
            if (newState === isActive) {
                return false;
            }
            
            isActive = newState;
            SettingsManager.set(SETTINGS_KEY, isActive);
            
            Game.EventHandler.trigger(NAME, isActive? 'enter' : 'leave');
            
            return isActive;
        };
    };
	
    function onPageShow() {
        Utils.info("Page Show");
        Game.start('visibility');
    }
	
    function onPageHide() {
        Utils.info("Page Hide");
        Game.stop('visibility');
    }
    
    // event handler - when the window is being resized
    function onResize() {
        screenSize = {
            'width': window.innerWidth - WINDOW_PADDING,
            'height': window.innerHeight - WINDOW_PADDING
        };
        
        // divide by totalHeight cause we want EVERYTHING to remain on screen (including inventory, duh)
        var ratioWidth = screenSize.width/gameSize.width,
            ratioHeight = screenSize.height/gameSize.totalHeight;
        
        screenSize.ratio = Math.min(ratioWidth, ratioHeight);
        screenSize.offsetY = screenSize.offsetX = 0;
        
        if (ratioWidth > ratioHeight) {
            screenSize.offsetX = (screenSize.width - gameSize.width*screenSize.ratio)/2;
        } else {
            screenSize.offsetY = (screenSize.height - gameSize.totalHeight*screenSize.ratio)/2;
        }
        
        setGameSize();
        
        var volumeControls = self.EventHandler.GameMenu.activeVolumeControls;
        for (var type in volumeControls) {
            volumeControls[type].updateOffsetAndRatio();
        }
        
        Game.EventHandler.trigger(NAME, 'resize', self, screenSize);
    }
    
    // scale the canvases according to the current screen dimensions
    function setGameSize() {
        var width = Math.round(gameSize.width * screenSize.ratio),
            height = Math.round(gameSize.totalHeight * screenSize.ratio);
            
        elContainer.style.cssText += 'width: ' + width + 'px;' +
                                     'height: ' + height + 'px;' +
                                     'margin: -' + height/2 + 'px 0 0 -' + width/2 + 'px;';
                                     
        $("canvas", elContainer, function() {
                this.style.cssText += '; width: ' + width + 'px; height: ' + Math.round(this.height * screenSize.ratio) + 'px;';
        });
    }
    
    var ObjectActions = new function() {
        var self = this,
            blockedActions = {}, scriptToRun = null, currentActionToRun = 0,
            originalScripts, actionObj1, actionObj2,
            onActionsDone,
            globalActionsToRun, currentGlobalActionToRun;
        
        // start running the script on obj1 and obj2
        this.call = function call(scripts, obj1, obj2, callback) {
            currentActionToRun = 0;
            blockedActions = {};
            actionObj1 = obj1;
            actionObj2 = obj2;
            originalScripts = scripts;
            onActionsDone = callback || function(){};

            scriptToRun = Player.getScriptToRun(scripts, actionObj1, actionObj2);

            return self.runGlobalActions();
        };
        
        this.runGlobalActions = function runGlobalActions() {
            globalActionsToRun = actionObj1 && actionObj1.script && actionObj1.script.global;
            
            currentGlobalActionToRun = 0;
            
            if (globalActionsToRun) {
                return self.runCurrentGlobalAction();
            } else {
                return self.runCurrentAction();
            }
        };
        
        this.runCurrentGlobalAction = function runCurrentGlobalAction() {
            var key = Object.keys(globalActionsToRun)[currentGlobalActionToRun];
            
            if (key) {
                var action = globalActionsToRun[key];
                
                if (action !== undefined) {
                    Utils.info('Run global action [' + key + ']: ', action);
                    
                    if (Actions[key]) {
                        return Actions[key](action, actionObj1, actionObj2, onGlobalActionDone);
                    } else {
                        Utils.warn('No action [' + key + ']: ', action);
                        onGlobalActionDone();
                    }
                }
            } else {
                // finished running global actions, let's start with the real ones
                return self.runCurrentAction();
            }
            
            return false;
        };
        
        function nextGlobalAction() {
            currentGlobalActionToRun++;
            self.runCurrentGlobalAction();
        }
        
        function onGlobalActionDone(actionResult) {
            if (actionResult) {
                for (var toBlock in actionResult) {
                    blockedActions[toBlock] = actionResult[toBlock];
                }
            }
            
            nextGlobalAction();
        }
        
        // runs the current action in the queue (@currentActionToRun)
        this.runCurrentAction = function runCurrentAction() {
            var key = scriptToRun && Object.keys(scriptToRun)[currentActionToRun];
            
            if (key) {
                var action = scriptToRun[key];
                
                if (action !== undefined) {
                    Utils.info('Run action [' + key + ']: ', action);
                    
                    if (Actions[key]) {
                        return Actions[key](action, actionObj1, actionObj2, onActionDone);
                    } else {
                        Utils.warn('No action [' + key + ']: ', action);
                        onActionDone();
                    }
                }
            } else {
                // done ALL the actions
                onActionsDone();
            }
            
            return false;
        };
        
        // each action calls this after it's done, to advance the script
        // @actionResult [optional]: list of actions to block from the script
        function onActionDone(actionResult) {
            if (actionResult) {
                for (var toBlock in actionResult) {
                    blockedActions[toBlock] = actionResult[toBlock];
                }
            }
            
            nextAction();
        }
        
        function nextAction() {
            currentActionToRun++;
            self.runCurrentAction();
        }
        
        this.runAction = function runAction(actionName, data, obj1, obj2, callback) {
            Actions[actionName](data, obj1, obj2, callback);
        };
        
        // the actual actions to perform according to the running script
        var Actions = {
            'continue': function() {
                self.call(originalScripts, actionObj1, actionObj2);
            },
            'pickup': function pickup(data, obj1, obj2, onDone) {
                if (typeof data === 'string') {
                    obj1 = createObjectFromType(data);
                    obj1.setPosition(CURRENT_CURSOR_POSITION[0], CURRENT_CURSOR_POSITION[1]);
                }
                
                inventory.add(obj1);
                
                sortObjectsOnScreen();
                inventory.orderObjects();
                
                onDone();
            },
            'remove': function remove(data, obj1, obj2, onDone) {
                if (data === true) {
                    obj1 && obj1.remove();
                    obj2 && obj2.remove();
                } else {
                    if (typeof data === 'string') {
                        if (obj1 && obj1.type === data) {
                            obj1.remove();
                        } else if (obj2 && obj2.type === data) {
                            obj2.remove();
                        }
                    } else {
                        for (var i=0, objId; objId=data[i++];) {
                            console.warn(objId, objects[objId], objects);
                            objects[objId] && objects[objId].remove();
                        }
                    }
                }
                
                onDone();
            },
            'newItem': function newItem(items, obj1, obj2, onDone) {
				items = $toArray(items);
                
                for (var i=0,item=items[i]; item; item=items[++i]) {
                    if (typeof item == "string") {
                        item = {"id": item};
                    }
                    
                    var objCreated = createObject(item.id),
                        messageKey = item.status? item.status : obj2? 'USE_TWO_TRUE' : 'USE_ONE_TRUE';
                    
                    Status.set(messageKey, [obj1 && obj1.name, obj2 && obj2.name, objCreated && objCreated.name]);
                }
                
                sortObjectsOnScreen();
                inventory.orderObjects();
                
                onDone({
                    "status": true
                });
            },
            'unlockArea': function unlockArea(data, obj1, obj2, onDone) {
                location.walkZone[data].locked = false;
                
                onDone();
            },
            'pickupOnUse': function pickupOnUse(data, obj1, obj2, onDone) {
                inventory.add(obj1);
                inventory.add(obj2);
                
                sortObjectsOnScreen();
                inventory.orderObjects();
                
                onDone();
            },
            'status': function status(data, obj1, obj2, onDone) {
                Status.set(data);
                
                onDone();
            },
            'dialogue': function dialogue(dialogueId, charClicked, obj2, onDone) {
                new Dialogue({
                    "elContainer": document.body,
                    "npc": charClicked,
                    "content": dialogueId,
                    "onEnd": onDone
                }).show();
            },
            'overrideScript': function overrideScript(newScripts, obj1, obj2, onDone) {
                if (typeof newScripts === 'string') {
                    var newScriptsNormalized = {};
                    newScriptsNormalized[obj1.id] = newScripts;
                    newScripts = newScriptsNormalized;
                }
                
                for (var objId in newScripts) {
                    var newScript = newScripts[objId],
                        useAlone, useWith;
                    
                    if (typeof newScript === 'string') {
                        var obj = Game.getObjectData(objId);
                        if (obj) {
                            newScript = obj[newScript];
                        }
                    }
                    
                    useAlone = newScript.useAlone;
                    useWith = newScript.useWith;
                    
                    Player.overrideScript(objId, null, useAlone || newScript);
                    
                    if (useWith) {
                        for (var affectedObjId in useWith) {
                            Player.overrideScript(objId, affectedObjId, useWith[affectedObjId]);
                        }
                    }
                }
                
                onDone();
            },
            'goToLocation': function goToLocation(locationId, obj1, obj2, onDone) {
                Game.switchLocation(locationId);
                return true;
            },
            'moveTo': function moveTo(point, obj1, obj2, onDone) {
                movePlayerTo(point[0], point[1], onDone);
            },
            'setDirection': function setDirection(newDir, obj1, obj2, onDone) {
                Sprite_Player.setDir(newDir);
                onDone();
            },
            'setUserInput': function setUserInput(inputState, obj1, obj2, onDone) {
                if (inputState) {
                    mainPointerHandler.enable();
                } else {
                    mainPointerHandler.disable();
                }
                
                onDone();
            }
        };
    };
    this.ObjectActions = ObjectActions;

    // main event handlers- this knows to catch events from all the classes
    // and perform the logic needed in response to them
    this.EventHandler = {
        DONT_LOG: ['Sprite_hover', 'Sprite_out', 'Status_set', 'Status_clear'],
		
        trigger: function trigger() {
            var className = arguments[0],
                method = arguments[1],
                instance = arguments[2],
                data = arguments[3];
            
            if (this.DONT_LOG.indexOf(className + '_' + method) === -1) {
                Utils.log.apply(Utils, arguments);
            }
            
            this[className] && this[className][method] && this[className][method](instance, data);
        },
        
        Game: {
            resize: function resize(instance, data) {
                Status.scale(data.ratio);
                mainPointerHandler.setOffsetAndRatio(data.offsetX, data.offsetY, data.ratio);
            },
            showLocation: function showLocation() {
                Loading.show();
            },
            startLocation: function showLocation() {
                activeDialog && activeDialog.hide();
            },
            
            start: function start() {
                Loading.hide();
            },
            stop: function stop() {
                
            }
        },
        
        Sprite: {
            reached: function reached(instance) {
                if (instance.id === 'player') {
                    playerFinishedPath();
                } else {
                    sortObjectsOnScreen();
                }
            },
            
            remove: function remove(instance) {
                inventory.remove(instance);
                delete objects[instance.id];
                objectsOrdered.splice(objectsOrdered.indexOf(instance.id), 1);
            },
            
            hover: function hover(instance) {
                if (draggedObject) {
                    Status.set('USE', [draggedObject.name, instance.name], true);
                } else {
                    Status.set('OBJECT_HOVER', instance.name, true);
                }
                
                if (instance.isInInventory) {
                    inventory.hoverItem(instance, true);
                }
            },
            
            out: function out(instance) {
                if (draggedObject) {
                    Status.set('OBJECT_HOVER', draggedObject.name, true);
                } else {
                    Status.clear();
                }
                
                if (instance.isInInventory) {
                    inventory.hoverItem(instance, false);
                }
            },
            
            dragStart: function dragStart(instance) {
                Status.set('OBJECT_HOVER', instance.name, true);
            },
            
            dragEnd: function dragEnd() {
                Status.clear();
            },
			
            setPath: function(instance) {
                if (instance.id === 'player') {
                    playerStartedPath();
                }
            }
        },
        
        GameMenu: {
            show: function show() {
                Game.stop('menu');
            },
            
            hide: function hide() {
                Game.start('menu');
            },
            
            click: function click(instance, data) {
                if (data.option === 'EXIT') {
                    var gui = "require" in window && require('nw.gui'),
                        win = gui && gui.Window.get() || window;
                    
                    win.close();
                }
            },
            
            showScreen: function showScreen(instance, data) {
                if (data.screenId === 'SETTINGS') {
                    this.initSettingsMenu(data.el);
                }
                
            },
            
            initSettingsMenu: function(el) {
                // volume controllers
                var elVolumeControls = $('#volumes li', el);
                for (var i=0, elVolume; elVolume=elVolumeControls[i++];) {
                    this.createVolumeControl(elVolume);
                }
                
                
                // full screen toggler
                $('#input-fullscreen', el).addEventListener('click', Fullscreen.toggle);
                Fullscreen.fireEvent();
            },
            
            activeVolumeControls: {},
            createVolumeControl: function createVolumeControl(el) {
                var type = el.className,
                    elContainer = $('span', el)[0],
                    elHandle = $('b', el)[0],
                    height = elContainer.offsetHeight,
                    self = this;
                
                self.activeVolumeControls[type] = new PointerHandler({
                    "elContainer": elContainer,
                    "elOnMove": window,
                    "elOnUp": window,
                    "onPointerDown": function onDown(x, y) {
                        self.setVolume(1 - Math.min(Math.max(y, 0), height) / height, type, elHandle);
                        elHandle.classList.add('active');
                    },
                    "onPointerMove": function onMove(x, y, isDown) {
                        if (!isDown) return;
                        self.setVolume(1 - Math.min(Math.max(y, 0), height) / height, type, elHandle);
                    },
                    "onPointerUp": function onUp(x, y) {
                        SettingsManager.save('volume.' + type, (1 - Math.min(Math.max(y, 0), height) / height).toFixed(2, 10));
                        
                        elHandle.classList.remove('active');
                    }
                });
                
                self.setVolume(SoundManager.getVolume(type) || .5, type, elHandle);
            },
            
            setVolume: function setVolume(value, type, elHandle) {
                var volumeSteps = [0.01, 0.3, 0.6];
                
                SoundManager.setVolume(value, type);
                
                elHandle.style.top = (1-value)*100 + '%';
                
                var volumeStep = volumeSteps.length + 1;
                for (var i=0,step; step=volumeSteps[i++];) {
                    if (value <= step) {
                        if (this.activeVolumeControls[type].volumeStep === i) {
                            return;
                        } else {
                            volumeStep = i;
                        }
                        break;
                    }
                }
                this.activeVolumeControls[type].volumeStep = volumeStep;
                elHandle.parentNode.parentNode.className = 'step-' + volumeStep;
            }
        },
            
        Dialogue: {
            show: function show(instance) {
                activeDialog = instance;
                Game.stop('dialogue');
            },
            
            hide: function hide() {
                activeDialog = null;
                Game.start('dialogue');
            },
            
            step: function step(instance, data) {
                var script = data.script;
                
                if (script) {
                    Game.start('dialogue');
                    
                    // returns "true" if should abort dialogue
                    if (ObjectActions.call(script, data.obj || data.obj1 || Sprite_Player, data.obj2, function onActionsDone() {
                        Game.stop('dialogue');
                        instance.nextStep();
                    })) {
                        instance.hide();
                    }
                }
            }
        },
            
        Inventory: {
            add: function add(instance, data) {
                Status.set("PICKUP", data.obj.name);
            },
            
            remove: function remove() {
            }
        },
        
        Fullscreen: {
            enter: function enter() {
                var elFullscreenToggle = $('#input-fullscreen');
                if (elFullscreenToggle) {
                    elFullscreenToggle.classList.add('active');
                }
            },
            leave: function leave() {
                var elFullscreenToggle = $('#input-fullscreen');
                if (elFullscreenToggle) {
                    elFullscreenToggle.classList.remove('active');
                }
            }
        }
    };
};