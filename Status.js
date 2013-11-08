function StatusLine(_options) {
    var _this = this, NAME = "Status",
        elContainer = null, el = null, elContent = null, design = null, baseFontSize = 0,
        currentText = '', currentPriority = -1,
        timeoutClear = null, timeoutVisibility = null;
        
    var DEFAULT_PRIORITY = 50,
        MS_PER_LETTER = 120,
        REGEX_TEMPLATE = null;
        
    this.init = function(options) {
        elContainer = options.elContainer;
        design = options.ui;
        
        Utils.setFromConfig(el, design);
        
        createElement();
        
        baseFontSize = window.getComputedStyle(el)['fontSize'].replace('px', '')*1;
        
        REGEX_TEMPLATE = /\*([^\*]*)\*/g;
        
        Game.EventHandler.trigger(NAME, "init", _this);
    };
    
    this.getElement = function() {
        return el;
    };
    
    this.scale = function(ratio) {
        el.style.fontSize = Math.round(baseFontSize*ratio) + 'px';
        el.style.bottom = Math.round(design.bottom*ratio) + 'px';
    };
    
    this.set = function(template, args, bLeaveOnScreen) {
        var status = TEXTS.STATUS[template] || template || '',
            params = $toArray(args);
            
        if (!status) {
            Utils.error("Status.set: missing template {" + template + "}, args: ", params);
            return _this;
        }
        
        if (typeof status == "string") {
            status = {
                "text": status,
                "priority": DEFAULT_PRIORITY
            };
        } else {
            status = JSON.parse(JSON.stringify(status));
        }
        
        if (status.priority < currentPriority) {
            return _this;
        }
        
        for (var i=0,l=params.length; i<l; i++) {
            status.text = status.text.replace("{{arg" + i + "}}", params[i]);
        }
        status.text = status.text.replace(REGEX_TEMPLATE, '<em>$1</em>');
        
        if (currentText == status.text) {
            return _this;
        }
        
        window.clearTimeout(timeoutClear);
        window.clearTimeout(timeoutVisibility);
        
        _this.clear(function(){
            set(status);
            _this.show();
        });
        
        if (!bLeaveOnScreen) {
            timeoutClear = window.setTimeout(_this.clear, status.text.length * MS_PER_LETTER);
        }
        
        Game.EventHandler.trigger(NAME, "set", _this, status.text);
        
        return _this;
    };
    
    this.clear = function(callback) {
        if (currentText) {
            currentText = '';
            _this.hide(function() {
                set();
                callback && callback();
            });
            
            Game.EventHandler.trigger(NAME, "clear", _this);
        } else {
            callback && callback();
        }
    };
    
    this.hide = function(callback) {
        el.classList.remove('visible');
        callback && (timeoutVisibility = window.setTimeout(callback, 150));
    };
    
    this.show = function(callback) {
        el.classList.add('visible');
        callback && (timeoutVisibility = window.setTimeout(callback, 150));
    };
    
    function set(status) {
        !status && (status = {});
        
        currentText = status.text || '';
        elContent.innerHTML = currentText;
        
        currentPriority = status.priority || -1;
    }
    
    function createElement(options) {
        el = document.createElement('div');
        el.id = 'status';
        elContent = document.createElement('span');
        el.appendChild(elContent);
        
        if (design.height) {
            el.style.cssText += '; height: ' + design.height + 'px; line-height: ' + design.height + 'px;';
        }
        
        elContainer.appendChild(el);
    }
    
    _this.init(_options);
};