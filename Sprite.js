(function() {
	function Sprite(_options) {
		this.NAME = "Sprite";
		
		// private members
		this._offset = [0, 0];
		this._targetX = 0;
		this._targetY = 0;
		this._vx = 0;
		this._vy = 0;
		this._flipped = false;
		this._pathToWalk = null;
		this._draw = true;
		this._cached_bounds = null;
		this._hasPolygon = false;
		this._dragged = false;
		
		
		this._currentAnimationId = null;
		this._currentAnimationFrameWidth = 0;
		this._currentAnimationNumFrames = 0;
		this._currentAnimationFrameDuration = 0;
		this._currentAnimationDelay = 0;
		this._animationNextFrameTime = 0;
		this._currentAnimationImage = null;
		this._animationFrame = null;
		
		// public members
		this.id = "Sprite_" + Date.now();
		this.name = "";
		this.type = "";
		this.context = null;
		this.x = 0;
		this.y = 0;
		this.speed = 120;
		this.width = 0;
		this.height = 0;
		this.isHover = false;
		this.alwaysUnder = false;
		this.alwaysOver = false;
        this.isInInventory = false;
		this.script = null;
		this.image = null;
		this.portrait = null;
		this.prespective = null;
		this.opacity = 1;
		this.polygon = null;
        this.interactType = null;
		this.animations = {};
		
		this.scale = 1;
		this.scaleTarget = 1;
		this.scaleSpeed = 0;
		
		this.customOrderPoint = false;
		this.orderPoint = 0;
		this.state = OBJECT_STATES.ACTIVE;
		
		this.init(_options);
	}

	Sprite.prototype.startAnimation = function Sprite_startAnimation(animationId) {
		if (this._currentAnimationId === animationId || !(animationId in this.animations)) return this;
		
		var animation = this.animations[animationId];
		this._animationFrame = 0;
		this._currentAnimationId = animationId;
		this._currentAnimationFrameWidth = animation.frameWidth;
		this._currentAnimationNumFrames = animation.numFrames;
		this._currentAnimationFrameDuration = animation.frameDuration;
		this._currentAnimationDelay = animation.delay;
		this._currentAnimationImage = animation.image || this.image;
		
		this._startAnimationLoop();
		
		this._draw = true;
		
		Game.EventHandler.trigger(this.NAME, "startAnimation", this, {
			"animationId": animationId,
			"animation": animation
		});
		
		return this;
	};
	
	Sprite.prototype.stopAnimation = function Sprite_stopAnimation() {
		this._animationNextFrameTime = 0;
		this._animationFrame = 0;
		this._currentAnimationId = null;
		this._currentAnimationNumFrames = 0;
		this._currentAnimationFrameWidth = 0;
		this._currentAnimationFrameDuration = 0;
		this._currentAnimationDelay = 0;
		this._currentAnimationImage = null;
		
		var idleAnimationSettings = this.animations._idle;
		if (idleAnimationSettings && (defaultAnimation = this.animations[idleAnimationSettings.id])) {
			this._currentAnimationFrameWidth = defaultAnimation.frameWidth;
			this._currentAnimationNumFrames = defaultAnimation.numFrames;
			this._currentAnimationImage = defaultAnimation.image;
			this._currentAnimationFrameDuration = defaultAnimation.frameDuration;
			this._currentAnimationDelay = defaultAnimation.delay;
			
			if (idleAnimationSettings.hasOwnProperty('frame')) {
				this._animationFrame = idleAnimationSettings.frame;
			} else {
				this._startAnimationLoop();
			}
		}
		
		this._draw = true;
		
		Game.EventHandler.trigger(this.NAME, "stopAnimation", this);
		
		return this;
	};
	
	Sprite.prototype._nextAnimationFrame = function Sprite_nextAnimationFrame() {
		var timeoutNextIteration = this._currentAnimationFrameDuration;
		
		if (++this._animationFrame >= this._currentAnimationNumFrames) {
			this._animationFrame = 0;
		} else if (this._animationFrame === this._currentAnimationNumFrames-1 && this._currentAnimationDelay) {
			if (Array.isArray(this._currentAnimationDelay)) {
				timeoutNextIteration = Math.round(Math.random() * (this._currentAnimationDelay[1] - this._currentAnimationDelay[0])) + this._currentAnimationDelay[0];
			} else {
				timeoutNextIteration = this._currentAnimationDelay;
			}
		}
		
		this._animationNextFrameTime = Date.now() + timeoutNextIteration;
	};
	
	Sprite.prototype._startAnimationLoop = function Sprite_startAnimationLoop() {
		this._animationNextFrameTime = Date.now() + this._currentAnimationFrameDuration;
	};

	Sprite.prototype.getDialogueImage = function Sprite_getDialogueImage() {
		return this.portrait || this.image;
	};

	Sprite.prototype.remove = function() {
		Game.EventHandler.trigger(this.NAME, "remove", this);
	};

	Sprite.prototype.startDragging = function() {
		this.scaleTo(1);
		this.state = OBJECT_STATES.DRAGGED;
		this._draw = true;
		
		Game.EventHandler.trigger(this.NAME, 'dragStart', this);
			
		return this;
	};
	Sprite.prototype.stopDragging = function(state) {
		this.state = state;
		this.scaleTo(1);
		this._draw = true;
		
		Game.EventHandler.trigger(this.NAME, 'dragEnd', this);
			
		return this;
	};

	Sprite.prototype.isClickable = function() {
		return this.state != OBJECT_STATES.INACTIVE && this.state != OBJECT_STATES.DRAGGED;
	};
    
	Sprite.prototype.intersectsWith = function(boundsArray) {
		if (!boundsArray) return false;
		
		var myBounds = this.getBounds();
		
		for (var id in boundsArray) {
			if (id !== this.id) {
				var bounds = boundsArray[id];
				if (!(bounds.left > myBounds.right || bounds.right < myBounds.left || bounds.top > myBounds.bottom || bounds.bottom < myBounds.top)) {
				   return true;
			   }
		   }
		}
		
		return false;
	};
	Sprite.prototype.getPosition = function() {
		return [this.x, this.y];
	};

	Sprite.prototype.setPath = function(path) {
		this.clearPath();
		this._pathToWalk = path;
		
		Game.EventHandler.trigger(this.NAME, "setPath", this, {
			"path": path
		});
		
		this._draw = true;
		return this;
	};
	Sprite.prototype.advancePath = function() {
		if (!this._pathToWalk || this._pathToWalk.length == 0) {
			this.clearPath();
			return false;
		}
		
		var point = this._pathToWalk.splice(0, 1)[0];
		this.moveTo(point[0], point[1]);
		
		return point;
	};
	Sprite.prototype.clearPath = function() {
		this._targetX = this._targetY = this._pathToWalk = null;
		this._vx = this._vy = 0;
		
		this._draw = true;
		return this;
	};
	Sprite.prototype.updateOrderPoint = function() {
            var orderPoint;
            
            if (this.alwaysOver) {
                orderPoint = 99999;
            } else if (this.alwaysUnder) {
                orderPoint = -1;
            } else if (this.customOrderPoint) {
                orderPoint = (this.y - this._offset[1] * this.scale) + this.height * this.customOrderPoint/100 * this.scale;
            } else if (!this.image) {
                orderPoint = 0;
            } else {
                orderPoint = (this.y - this._offset[1] * this.scale) + this.height * this.scale;
            }
            
            this.orderPoint = orderPoint;
	};

	Sprite.prototype.setOrigin = function(origin) {
            if (origin === undefined) {
                origin = "center";
            }

            this._offset[0] = this.width/2;

            switch (origin) {
                case "top":
                    this._offset[1] = 0;
                    break;
                case "center":
                    this._offset[1] = this.height*this.scale/2;
                    break;
                case "bottom":
                    this._offset[1] = this.height*this.scale;
                    break;

                case "left":
                    this._offset[0] = 0;
                    break;
                case "middle":
                    this._offset[0] = this.width*this.scale/2;
                    break;
                case "right":
                    this._offset[0] = this.width*this.scale;
                    break;

                default:
                    this._offset[1] = origin;
                    break;
            }

            this._draw = true;

            return this;
	};

	Sprite.prototype.getBounds = function(bForceRefresh) {
		if (!this._cached_bounds || bForceRefresh) {
			this._cached_bounds = {
				"left": Math.max(0, this.x - this._offset[0] * this.scale),
				"top": Math.max(0, this.y - this._offset[1] * this.scale),
				"width": Math.max(0, this.width * this.scale),
				"height": Math.max(0, this.height * this.scale)
			};
			this._cached_bounds.bottom = this._cached_bounds.top + this._cached_bounds.height;
			this._cached_bounds.right = this._cached_bounds.left + this._cached_bounds.width;
		};
		
		return this._cached_bounds;
	};
	Sprite.prototype.getPolygon = function(bForce) {
		if (this.polygon && !(bForce && !this._hasPolygon)) {
			return this.polygon;
		}
		
		// if the sprite doesn't define a polygon as its bounds, use a default rectangle 
		var bounds = this.getBounds();
		this.polygon = [
			[bounds.left, bounds.top],
			[bounds.left + bounds.width, bounds.top],
			[bounds.left + bounds.width, bounds.top + bounds.height],
			[bounds.left, bounds.top + bounds.height],
			[bounds.left, bounds.top]
		];
		
		return this.polygon;
	};

	Sprite.prototype.scaleTo = function(scale, speed) {
		this.scaleTarget = scale;
		
		if (speed) {
			this.scaleSpeed = speed;
		} else {
			this.scale = scale;
		}
		
		this._draw = true;
		
		return this;
	};
    Sprite.prototype.moveTo = function(x, y) {
        if (this.x == x && this.y == y) {
            return this;
        }

        this._targetX = x;
        this._targetY = y;

        var angle = Math.atan((y - this.y) / (x - this.x)),
            walkDir;

        if (!isNaN(angle)) {
            walkDir = x < this.x? -1: 1;

            this._vx = 0 | this.speed * Math.cos(angle) * walkDir;
            this._vy = 0 | this.speed * Math.sin(angle) * walkDir;
        }

        this._flipped = (this._vx < 0 && !this.isInInventory);

        this._draw = true;

        return this;
    };
    
    Sprite.prototype.inInventory = function(setInventoryState) {
        if (typeof setInventoryState === 'boolean') {
            this.isInInventory = setInventoryState;
            this.state = setInventoryState? OBJECT_STATES.INVENTORY : OBJECT_STATES.INACTIVE;
        }
        
        return this.isInInventory;
    };
    
    Sprite.prototype.setDir = function(dir) {
        if (dir) {
            this.setFlip(dir[0] === -1);
        }
        
        return this;
    };
    
    Sprite.prototype.setFlip = function(isFlipped) {
        this._flipped = isFlipped;
        return this;
    };
    
    Sprite.prototype.getMarker = function() {
        return this.marker;
    };

    Sprite.prototype.setPosition = function(x, y) {
        this.x = x;
        this.y = y;

        this.scale = this.scaleTarget = this.isInInventory? 1 : this.getPrespectiveValue();

        this._draw = true;

        return this;
    };
    
    Sprite.prototype.getPrespectiveValue = function Sprite_getPrespectiveValue(x, y) {
        if (!this.prespective) {
            return 1;
        }
        
        if (x === undefined) {
            x = this.x;
        }
        if (y === undefined) {
            y = this.y;
        }
        
        var prespectiveOrigin = this.prespective.position[0],
            prespectiveTarget = this.prespective.position[1],
            prespectiveOriginScale = this.prespective.scale[0],
            prespectiveTargetScale = this.prespective.scale[1],
            prespectiveRangeScale = prespectiveTargetScale - prespectiveOriginScale,
            prespectiveRange = prespectiveTarget - prespectiveOrigin,
            relPosition = Math.max(y - prespectiveOrigin, 0)/prespectiveRange;
            
        return relPosition * prespectiveRangeScale + prespectiveOriginScale;
    };

	Sprite.prototype.hover = function(newHoverState) {
		if (this.isHover === newHoverState) return this;
		
		this.isHover = newHoverState;
		
		if (this.isClickable()) {
			Game.EventHandler.trigger(this.NAME, newHoverState? 'hover' : 'out', this);
		}
		
		return this;
	};
    
    Sprite.prototype.isPointInside = function(x, y) {
        return this.isClickable() && Utils.isPointInPoly(this.getPolygon(), x, y);
    };

	Sprite.prototype.update = function(dt, now) {
		if (this._vx !== 0 || this._vy !== 0) {
			var newX = this.x + this._vx * dt,
				newY = this.y + this._vy * dt,
				dx = newX - this._targetX,
				dy = newY - this._targetY;
                
			if (Math.sqrt(dx*dx + dy*dy) <= this.speed*dt) {
				newX = this._targetX;
				newY = this._targetY;
				this._vx = this._vy = 0;
			}
			
			this.setPosition(newX, newY);
		}
		
		if (this._vx === 0 && this._vy === 0 && (this._targetX || this._targetY || this._pathToWalk)) {
			var nextPoint = this.advancePath();
			if (!nextPoint) {
				Game.EventHandler.trigger(this.NAME, "reached", this, {
					"point": [this._targetX, this._targetY]
				});
				this._targetX = this._targetY = null;
			}
		}
		
		var scaleDiff = this.scaleTarget - this.scale;
		if (scaleDiff !== 0) {
			if (Math.abs(scaleDiff) < this.scaleSpeed) {
				this.scale = this.scale + this.scaleSpeed * dt * scaleDiff;
				this._draw = true;
			} else if (this.scale != this.scaleTarget) {
				this.scale = this.scaleTarget;
				this._draw = true;
			}
		}
		
		if (this._animationNextFrameTime && now >= this._animationNextFrameTime) {
			this._nextAnimationFrame();
		}
		
		if (this._draw) {
			this.getBounds(true);
			this.getPolygon(true);
			this.updateOrderPoint();
		}
		
		return this._draw;
	};

	Sprite.prototype.draw = function(bForce) {
            var context = this.context,
                    isFlipped = this._flipped;

            if (isFlipped) {
                    context.save();
                    context.translate(context.canvas.width, 0);
                    context.scale(-1, 1);
            }

            var bounds = this._cached_bounds,
                    x = isFlipped? context.canvas.width - bounds.width - bounds.left : bounds.left,
                    y = bounds.top;

            if (this._currentAnimationImage) {
                    var animationFrameWidth = this._currentAnimationFrameWidth;

                    context.drawImage(this._currentAnimationImage,
                            animationFrameWidth * this._animationFrame, 0,
                            animationFrameWidth, Math.round(bounds.height / this.scale),
                            x, y,
                            animationFrameWidth * this.scale, bounds.height);
            } else if (this.image) {
                    context.drawImage(this.image, x, y, bounds.width, bounds.height);
            }

            if (!this._isScene && Utils.isDebug(2)) {
                context.strokeStyle = 'rgba(0,0,0,.5)';
                context.fillStyle = 'rgba(0,255,0,.2)';
                context.beginPath();
                for (var i=0, p; p = this.polygon[i++];) {
                        if (isFlipped) {
                                context.lineTo(this.context.canvas.width - p[0], p[1]);
                        } else {
                                context.lineTo(p[0], p[1]);
                        }
                }
                context.fill();
                context.stroke();
                context.closePath();

                if (this.image || this._currentAnimationImage) {
                    context.beginPath();
                    context.fillStyle = 'rgba(0,0,0,.8)';
                    context.fillRect(x, this.orderPoint, bounds.width, 3);
                }
            }

            if (isFlipped) {
                    context.restore();
            }

            this._draw = false;

            return this;
	};

	Sprite.prototype.init = function Sprite_init(options) {
            for (var prop in options) {
                this[prop] = options[prop];
            }

            this._hasPolygon = !!this.polygon;

            // convert all images' src to actual image objects
            this.image = createImage(this.image);
            this.portrait = createImage(this.portrait);
            for (var id in this.animations) {
                var img = this.animations[id].image;
                this.animations[id].image = img? createImage(img) : this.image;
            }
		
            this.setPosition(this.x, this.y);
            this.setOrigin(this.origin);
            this.updateOrderPoint();
            this.getPolygon(true);
            this.stopAnimation();

            Game.EventHandler.trigger(this.NAME, 'init', this);
	};
        
        function createImage(src) {
            if (!src) {
                return null;
            }
            if (src instanceof HTMLElement) {
                return src;
            }

            var image = new Image();
            image.src = src;
            return image;
        }
	
	window.Sprite = Sprite;
})();