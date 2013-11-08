var Player = new function() {
    var self = this,
        userData = {
            "scriptsIndexes": {},
            "scriptsOverride": {}
        };
    
    // this keeps track on which scripts the user already went through
    // so if an object has 4 different useAlone scripts, it will save the current script index
    // and give the user a new script each time
    this.getScriptToRun = function getScriptToRun(scripts, obj1, obj2) {
        var key = getKey(obj1, obj2),
            customScript = self.getCustomScript(obj1, obj2, key),
            currentIndex = userData.scriptsIndexes[key],
            scripts = $toArray(customScript.length > 0? customScript : scripts),
            script = (currentIndex === false)? null : scripts[currentIndex];
        
        Utils.log('Getting script [' + key + '](' + currentIndex + '): ', script);
        
        if (script && currentIndex !== false) {
            if (scripts[currentIndex + 1]) {
                userData.scriptsIndexes[key] = currentIndex + 1;
            } else if (script.stopAfter) {
                userData.scriptsIndexes[key] = false;
            }
        }
        
        return script;
    };
    
    // check if
    // obj1 defines useWith with obj2, or
    // obj2 defines useWith with obj1, or
    // obj1 defines a global userWith (indicated by *)
    this.getCustomScript = function getCustomScript(obj1, obj2, key) {
        var scriptToReturn = [],
            script = userData.scriptsOverride[getKey(obj1, obj2)] ||
                     userData.scriptsOverride[getKey(obj2, obj1)];
        
        !key && (key = getKey(obj1, obj2));
        
        // if the script was overriden for this object, take the new one
        if (script) {
            scriptToReturn = script;
        } else {
            // if the object was used with another one, and there's a corresponding useWith script
            if (obj2) {
                scriptToReturn = (obj2.script && obj2.script.useWith && obj2.script.useWith[obj1.id]) ||
                                 (obj1.script && obj1.script.useWith && (obj1.script.useWith[obj2.id] || obj1.script.useWith[obj2.type] || obj1.script.useWith['*']));
            } else {
                scriptToReturn = obj1 && obj1.script && obj1.script.useAlone || [];
            }
        }
        
        scriptToReturn = $toArray(scriptToReturn);
        
        /*
        // first add the "global" sripts- ones that aren't in "useAlone" or "useWith"
        // stuff like "moveTo", or "setDirection"
        obj1._numberOfGlobalScripts = 0;
        var scriptsToAdd = [];
        for (var k in obj1.script) {
            if (k !== 'useAlone' && k !== 'useWith') {
                obj1._numberOfGlobalScripts++;
                var action = {};
                
                // add the actual action
                action[k] = obj1.script[k];
                
                // set "continue" to true, so the game won't stop after performing this action
                action['continue'] = true;
                
                // then add it all to the script
                scriptsToAdd.push(action);
            }
        }
        
        // finally add the global scripts from before to the useAlone/useWith script
        scriptToReturn = scriptsToAdd.concat(scriptToReturn);
        */
        
        return scriptToReturn;
    };
    
    this.overrideScript = function overrideScript(obj1Id, obj2Id, newScript) {
        var key = getKey(obj1Id, obj2Id);
        
        Utils.log('Updating script [' + key + ']: ', newScript);
        
        userData.scriptsIndexes[key] = 0;
        userData.scriptsOverride[key] = newScript;
    };
    
    this.get = function() {
        return userData;
    };
    
    function getKey(obj1, obj2) {
        var key,
            locationId = Game.getLocation().id,
            obj1Id = obj1? typeof obj1 === 'string'? obj1 : obj1.id : '',
            obj2Id = obj2? typeof obj2 === 'string'? obj2 : obj2.id : '';
        
        if (obj1Id.indexOf('.') !== -1) {
            obj1Id = obj1Id.split('.');
            locationId = obj1Id[0];
            obj1Id = obj1Id[1];
        }
        
        key = [locationId, obj1Id, obj2Id].join('.');
        
        if (!(key in userData.scriptsIndexes)) {
            userData.scriptsIndexes[key] = 0;
        }
            
        return key;
    }
};