/* Simple & Extendable Keyboard event abstraction.
 * ------------------------------------------------------------------
 * Simply pass the init function a mapping of labels to keycodes
 * and it will maintain the state of all keys requested. An Example
 * mapping and resulting keyboardState preceed the implementation.
 * ------------------------------------------------------------------
 * Extended
 * ------------------------------------------------------------------
 * You can now create callbacks for up down and edge events on labels
 * in addition to being able to access the state directly.
 */

// Associates labels with a set of keycodes
let exampleKeyMap = {
    up:    [87, 38],
    left:  [65, 37],
    right: [68, 39],
    down:  [83, 40],
    jump:  [32]
};

// True when any key for the label is down, false otherwise.
// Overwritten by initializeKeyboard
var keyboardState = {
    up:    false,
    left:  false,
    right: false,
    down:  false,
    jump:  false
};

var keyboardUpCallbacks = {};
var keyboardDownCallbacks = {};

// Both up and down, these callbacks receives the state of the
//   key as a parameter
var keyboardEdgeCallbacks = {};
 

function initializeKeyboard(keyMap = exampleKeyMap, disableDefault = true, debugMode = false)
{
    keyboardState = {};
    for(name of Object.keys(keyMap))
        keyboardState[name] = false;

    let updateKey = (key, state) =>
    {
        if(debugMode)
            console.log(key + " " + (state ? "Pressed":"Released"));

        for(const [name, keys] of Object.entries(keyMap))
        {
            for(var i = 0; i < keys.length; i++)
            {
                if(key == keys[i])
                {
                    if(keyboardState[name] != state)
                    {
                        if(keyboardEdgeCallbacks.hasOwnProperty(name))
                        {
                            for(let i = 0; i < keyboardEdgeCallbacks[name].length; ++i)
                                keyboardEdgeCallbacks[name][i](state);
                        }

                        if(state)
                        {
                            if(keyboardDownCallbacks.hasOwnProperty(name))
                            {
                                for(let i = 0; i < keyboardDownCallbacks[name].length; ++i)
                                    keyboardDownCallbacks[name][i]();
                            }
                        }
                        else 
                        {
                            if(keyboardUpCallbacks.hasOwnProperty(name))
                            {
                                for(let i = 0; i < keyboardUpCallbacks[name].length; ++i)
                                    keyboardUpCallbacks[name][i]();
                            }
                        }

                        keyboardState[name] = state;
                    }
                    return true;
                }
            }
        }
        return false;
    };

    document.addEventListener("keydown", (e) =>
    {
        if(updateKey(e.keyCode, true) && disableDefault)
            e.preventDefault();
    });

    document.addEventListener("keyup", (e) =>
    {
        if(updateKey(e.keyCode, false) && disableDefault)
            e.preventDefault();
    });
}

function registerInputCallback(label, type, fun)
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