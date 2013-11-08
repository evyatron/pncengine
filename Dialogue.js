function Dialogue(_options) {
    var self = this, NAME = "Dialogue",
        elContainer = null, el = null, elScreen = null, elSteps = null,
        npc = null, content = null, currentStep = null, iCurrent = 1,
        isWaitingForAnswer = false,
        onDialogueEnd = null, isHidden;
        
    this.init = function init(options) {
        elContainer = options.elContainer;
        content = options.content;
        npc = options.npc;
        iCurrent = 1;
        onDialogueEnd = options.onEnd;
        
        if (typeof content == "string") {
            content = TEXTS.DIALOGUES[content];
        }
        if (typeof content == "string") {
            content = {"1": content};
        }
        
        if (!content) {
            Game.EventHandler.trigger(NAME, "error", self, content);
            return self;
        }
        
        createElement();
        
        Game.EventHandler.trigger(NAME, "init", self);
        
        return self;
    };
    
    this.hide = function hide() {
        if (isHidden) {
            return false;
        }
        
        removeEvents();
        
        function hideDialog() {
            isHidden = true;
            
            el.parentNode.removeChild(el);
            elScreen.parentNode.removeChild(elScreen);
            
            onDialogueEnd && onDialogueEnd();
            
            Game.EventHandler.trigger(NAME, "hide", self);
        }
        
        if (el.classList.contains('hide')) {
            hideDialog();
        } else {
            onTransitionEnd(el, hideDialog);
            el.classList.add('hide');
        }
        
        return true;
    };
    
    this.show = function show() {
        if (!content) return self;
        
        Game.EventHandler.trigger(NAME, "show", self);
        
        iCurrent = 1;
        self.showCurrentStep();
        
        return self;
    };
    
    this.nextStep = function nextStep(e) {
        var indexToShow = iCurrent*1 + (isWaitingForAnswer? 0 : 1);
        
        if ('goTo' in currentStep) {
            indexToShow = currentStep.goTo;
        } else if (isWaitingForAnswer) {
            var answerIndex = (e && e.target && e.target.getAttribute('data-answer') || -1)*1;
            
            if (answerIndex === -1) {
                return;
            } else if (answerIndex === 999) {
                indexToShow = indexToShow - 1;
            } else {
                var answers = currentStep[Object.keys(currentStep)[0]],
                    answer = answers[answerIndex];
                    
                self.showStep(answer);
                return;
            }
        }
        
        self.showStepById(indexToShow);
    };
    
    this.showStepById = function showStepById(stepId) {
        iCurrent = stepId;
        self.showCurrentStep();
    };
    
    this.showCurrentStep = function showCurrentStep() {
        self.showStep(content[iCurrent.toString()]);
    };
    
    this.showStep = function showStep(step) {
        if (!step || step.end) {
            self.hide();
            return self;
        }
        
        // if step is just a string- covert it to an object said by NPC
        if (typeof step === "string") {
            step = { "npc": step };
        }
        
        // if the step has "goTo": INDEX statement, skip it and go there
        if ('goTo' in step) {
            self.showStepById(step.goTo);
            return null;
        }
        
        // get the speaker's object- could be
        // PC (the player), NPC (non-player character) or a different character (indicated by their ID)
        var speakerType = Object.keys(step)[0],
            speakerObject = getSpeakerObject(speakerType),
            currentSpeaker = currentStep && getSpeakerObject(Object.keys(currentStep)[0]),
            isPlayer = (speakerType == 'pc'),
            img;
        
        function realShowContent() {
            // if the same character is saying new text- just replace the content, no need to recreate the element
            if (!currentSpeaker || currentSpeaker.id !== speakerObject.id) {
                img = (speakerObject.getDialogueImage() || {}).src || '';
                
                elSteps.innerHTML = '<li class="' + (isPlayer? 'pc' : 'npc') + '">' +
                                        '<div class="avatar">' +
                                            '<b style="background-image: url(' + img + ');"></b>' +
                                            '<span class="name">' + speakerObject.name + '</span>' +
                                        '</div>' +
                                        '<div class="content"></div>' +
                                    '</li>';
            }
            
            var content = getStepContent(step[speakerType]);
            if (content) {
                elSteps.querySelector('.content').innerHTML = content;
            
                el.classList.remove('hide');
            } else {
                el.classList.add('hide');
            }
            
            currentStep = step;
            
            Game.EventHandler.trigger(NAME, "step", self, currentStep);
        }
        
        if (el.classList.contains('hide')) {
            window.setTimeout(realShowContent, 0);
        } else {
            onTransitionEnd(el, realShowContent);
            el.classList.add('hide');
        }
        
        return true;
    };
    
    function onTransitionEnd(el, callback) {
        function realOnTransitionEnd(e) {
            el.removeEventListener('webkitTransitionEnd', realOnTransitionEnd);
            el.removeEventListener('transitionend', realOnTransitionEnd);
            
            callback(e);
        }
        
        el.addEventListener('webkitTransitionEnd', realOnTransitionEnd);
        el.addEventListener('transitionend', realOnTransitionEnd);
    }
    
    function getStepContent(stepContent) {
        if (typeof stepContent === 'string') {
            isWaitingForAnswer = false;
            return stepContent;
        }
        
        var html = '';
        
        if (stepContent.image) {
            html = '<span class="image" style="background-image: url(' + stepContent.image + ');"></span>';
        } else if (stepContent.length > 0) {
            isWaitingForAnswer = true;
            
            html += '<ul>';
            for (var i=0,answer=stepContent[i]; answer; answer=stepContent[++i]) {
                html += '<li data-answer="' + i + '">' + answer.text + '</li>';
            }
            html += '<li class="default" data-answer="999"><span>Sorry, what was that again?</span></li>';
            html += '</ul>';
        }
        
        return html;
    }
    
    function getSpeakerObject(type) {
        switch(type) {
            case 'pc':
                return Game.getPlayerObject();
            case 'npc':
                return npc;
            default:
                return Game.getObject(type);
        }
    }
    
    function attachEvents() {
        el.addEventListener('click', self.nextStep);
        elScreen.addEventListener('click', self.nextStep);
        KEYS.on(KEYS.KEY_ADVANCE_dialogue, self.nextStep);
    }
    function removeEvents() {
        el.removeEventListener('click', self.nextStep);
        elScreen.removeEventListener('click', self.nextStep);
        KEYS.off(KEYS.KEY_ADVANCE_dialogue, self.nextStep);
    }
    
    function createElement() {
        el = document.createElement('div');
        el.className = 'dialogue hide';
        
        elSteps = document.createElement('ul');
        el.appendChild(elSteps);
        
        elScreen = document.createElement('div');
        elScreen.className = 'dialogue-screen';
        
        attachEvents();
        
        elContainer.appendChild(elScreen);
        elContainer.appendChild(el);
    }
    
    this.init(_options);
};