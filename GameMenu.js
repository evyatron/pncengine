function GameMenu(_options) {
    var self = this, NAME = "GameMenu",
        elContainer = null, el = null,
        elMainMenu = null, elInnerScreen = null,
        visible = false, isInnerScreenActive = false,
        
        MENU_SCREENS = {};
    
    this.init = function init(options) {
        elContainer = options.elContainer;
        
        KEYS.on(KEYS.KEY_MENU, self.closeCurrent);
        
        createElement();
        
        Game.EventHandler.trigger(NAME, "init", self);
    };
    
    this.toggle = function toggle() {
        visible? self.hide() : self.show();
    };
    
    this.show = function show() {
        if (visible) return;
        
        document.body.classList.add("menu-open");
        elMainMenu.classList.add("visible");
        visible = true;
        
        Game.EventHandler.trigger(NAME, "show", self);
    };
    
    this.hide = function hide() {
        if (!visible) return;
        
        document.body.classList.remove("menu-open");
        elMainMenu.classList.remove("visible");
        visible = false;
        
        Game.EventHandler.trigger(NAME, "hide", self);
    };
    
    this.showScreen = function showScreen(screenId) {
        if (self.hideScreen(function(){ self.showScreen(screenId); })) {
            return false;
        }
        
        var screen = MENU_SCREENS[screenId],
            title = screen.TITLE,
            content = screen.CONTENT;
            
        if (typeof content === 'string') {
            self.loadScreen(screenId);
            return false;
        }
        
        content = content.content;
            
        self.hideScreen();
        
        elInnerScreen.classList.add(screenId);
        
        elInnerScreen.querySelector(".title").innerHTML = title;
        elInnerScreen.querySelector(".content").innerHTML = content;
        
        elInnerScreen.style.marginTop = -elInnerScreen.offsetHeight/2 + 'px';
        
        elInnerScreen.classList.add("visible");
        
        isInnerScreenActive = true;
        
        Game.EventHandler.trigger(NAME, "showScreen", self, {
            "screenId": screenId,
            "el": elInnerScreen
        });
        
        return true;
    };
    
    this.hideScreen = function hideScreen(callback) {
        if (!isInnerScreenActive) return false;
        
        elInnerScreen.classList.remove("visible");
        window.setTimeout(function() {
            elInnerScreen.className = 'menu';
            isInnerScreenActive = false;
            callback && callback();
        }, 150);
        
        return true;
    };
    
    this.loadScreen = function loadScreen(screenId) {
        var url = MENU_SCREENS[screenId].CONTENT;
        Utils.get(url, function(html) {
            MENU_SCREENS[screenId].CONTENT = {
                'content': html
            };
            self.showScreen(screenId);
        });
    };
    
    function createElement() {
        el = document.createElement('div');
        el.id = 'menu-wrapper';
        
        if (TEXTS.MENU.TITLE) {
            var elTitle = document.createElement('h1');
            elTitle.innerHTML = TEXTS.MENU.TITLE;
            el.appendChild(elTitle);
        }
        if (TEXTS.MENU.SUBTITLE) {
            var elSubTitle = document.createElement('h2');
            elSubTitle.innerHTML = TEXTS.MENU.SUBTITLE;
            el.appendChild(elSubTitle);
        }
        
        elMainMenu = document.createElement('menu');
        elMainMenu.className = 'menu';
        createOptions(elMainMenu);
        elMainMenu.addEventListener('click', onMenuClick);
        el.appendChild(elMainMenu);
        
        elInnerScreen = document.createElement('div');
        elInnerScreen.className = 'menu';
        elInnerScreen.innerHTML = '<div class="title"></div><div class="content"></div><b class="close"></b>';
        el.appendChild(elInnerScreen);
        
        var closeButtons = el.querySelectorAll('.close');
        for (var i=0; i<closeButtons.length; i++) {
            closeButtons[i].addEventListener('click', self.closeCurrent);
        }
        
        elContainer.appendChild(el);
        
        elMainMenu.style.cssText += '; margin-top: ' + (-elMainMenu.offsetHeight/2) + 'px;';
    }
    
    function createOptions(elMainMenu) {
        var html = '';
        for (var key in TEXTS.MENU.OPTIONS) {
            var option = TEXTS.MENU.OPTIONS[key];
            if (!option) {
                key = 'seperator" class="seperator';
            } else if (typeof option == "object") {
                MENU_SCREENS[key] = option.SCREEN;
                option = option.BUTTON;
            }
            
            html += '<li data-key="' + key + '">' + option + '</li>';
        }
        elMainMenu.innerHTML = html + '<b class="close"></b>';
    }
    
    this.closeCurrent = function() {
        if (!self.hideScreen()) {
            self.toggle();
        }
    };
    
    function onKeyUp(e) {
        if (e.keyCode == KEYS.ESC) {
            self.closeCurrent();
        }
    }
    
    function onMenuClick(e) {
        var el = e.target,
            option = el.getAttribute("data-key");
            
        if (!option) return false;
        
        if (MENU_SCREENS[option]) {
            self.showScreen(option);
        } else {
            Game.EventHandler.trigger(NAME, "click", self, {
                "option": option
            });
        }
    }
    
    self.init(_options);
};