var SoundManager = new function () {
    var self = this, NAME = "SoundManager",
        currentSound, currentSoundData,
        
        BASE_URL = '',
        VOLUMES = {};
        
    this.init = function init(options) {
        BASE_URL = options.baseUrl || '';
        VOLUMES = options.volumes;
        
        Game.EventHandler.trigger(NAME, "init", self);
    };
    
    this.setVolume = function setVolume(newVolume, type) {
        !type && (type = 'master');
        
        if (VOLUMES[type] === newVolume) {
            return false;
        }
        
        VOLUMES[type] = newVolume;
        
        if (currentSound) {
            currentSound.volume = calculateVolume(currentSoundData);
        }
        
        Game.EventHandler.trigger(NAME, "setVolume", {
            "type": type,
            "volume": newVolume
        });
    };
    
    this.getVolume = function getVolume(type) {
        return type? VOLUMES[type] : VOLUMES;
    };
    
    this.play = function play(soundToPlay) {
        if (!soundToPlay) {
            return;
        }
        
        currentSoundData = soundToPlay;
        
        currentSound = new Audio();
        currentSound.src = BASE_URL + soundToPlay.src;
        currentSound.volume = calculateVolume(soundToPlay)
        
        if ("loop" in soundToPlay) {
            currentSound.loop = soundToPlay.loop;
        }
        
        currentSound.play();
        
        Game.EventHandler.trigger(NAME, "play", soundToPlay);
    };
    
    this.pause = function pause(soundToStop) {
        if (!currentSound) {
            return false;
        }
        
        currentSound.pause();
    };
    
    this.resume = function resume(soundToStop) {
        if (!currentSound) {
            return false;
        }
        
        currentSound.play();
    };
    
    this.stop = function stop(soundToStop) {
        if (!currentSound) {
            return false;
        }
        
        currentSound.pause();
        currentSound = null;
        currentSoundData = null;
        
        Game.EventHandler.trigger(NAME, "stop", currentSound);
    };
    
    this.getCurrent = function getCurrent() {
        return currentSound;
    };
    
    function calculateVolume(sound) {
        return Math.max(0, Math.min(1, VOLUMES[sound.type] * (sound.volume || 1) * VOLUMES.master));
    }
};