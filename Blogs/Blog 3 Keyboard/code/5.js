// Associates labels with a set of keycodes
let exampleKeyMap = {
    up:    [87, 38], // W and Up
    left:  [65, 37], // A and Left
    right: [68, 39], // D and Right
    down:  [83, 40]  // S and Down
};

var keyboardState;
var registerInputCallback = (label, type, fun) =>
{ 
    console.error("registerInputCallback was called before the keyboard was initialized!");
};

var registerUniversalKeyboardCallback = (type, fun) =>
{
    console.error("registerUniversalKeyboardCallback was called before the keyboard was initialized!");
};

function initializeKeyboard(keyMap)
{
    keyboardState = {};
    let keyboardUpCallbacks = {};
    let keyboardDownCallbacks = {};
    let keyboardEdgeCallbacks = {};
    let universalKeyboardUpCallback   = (name)=>{};
    let universalKeyboardDownCallback = (name)=>{};
    let universalKeyboardEdgeCallback = (name, state)=>{};

    for(name of Object.keys(keyMap))
        keyboardState[name] = false;

    registerInputCallback = (label, type, fun) =>
    {
        let t;
        switch(type)
        {
            case "edge": t = keyboardEdgeCallbacks; break;
            case "up": t = keyboardUpCallbacks; break;
            case "down": t = keyboardDownCallbacks; break;
            default: return;
        }

        if(t.hasOwnProperty(label))
            t[label].push(fun);
        else
            t[label] = [ fun ];
    }

    registerUniversalKeyboardCallback = (type, fun) =>
    {
        switch(type)
        {
            case "edge": universalKeyboardEdgeCallback = fun; break;
            case "up":   universalKeyboardUpCallback   = fun; break;
            case "down": universalKeyboardDownCallback = fun; break;
        }
    }

    function updateKey(key, state)
    {
        for(const [action, keys] of Object.entries(keyMap))
        {
            for(var i = 0; i < keys.length; i++)
            {
                if(key == keys[i])
                {
                    if(keyboardState[name] != state)
                    {
                        universalKeyboardEdgeCallback(name);
                        if(keyboardEdgeCallbacks.hasOwnProperty(name))
                        {
                            for(let i = 0; i < keyboardEdgeCallbacks[name].length; ++i)
                                keyboardEdgeCallbacks[name][i](state);
                        }

                        if(state)
                        {
                            universalKeyboardDownCallback(name);
                            if(keyboardDownCallbacks.hasOwnProperty(name))
                            {
                                for(let i = 0; i < keyboardDownCallbacks[name].length; ++i)
                                    keyboardDownCallbacks[name][i]();
                            }
                        }
                        else 
                        {
                            universalKeyboardUpCallback(name);
                            if(keyboardUpCallbacks.hasOwnProperty(name))
                            {
                                for(let i = 0; i < keyboardUpCallbacks[name].length; ++i)
                                    keyboardUpCallbacks[name][i]();
                            }
                        }

                        keyboardState[name] = state;
                    }
                }
            }
        }
    };

    document.addEventListener("keydown", (e) =>
    {
        updateKey(e.keyCode, true);
    });

    document.addEventListener("keyup", (e) =>
    {
        updateKey(e.keyCode, false);
    });
}



function update()
{
    if(keyboardState['left'])
        movePlayer(5,0);
    
    updatePhysics();
    renderCanvas();
}

function inititialize()
{
    initializeKeyboard(exampleKeyMap);
    initializePhysics();
    initializeGraphics();
}
