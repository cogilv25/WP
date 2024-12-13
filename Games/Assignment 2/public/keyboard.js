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
 * ------------------------------------------------------------------
 * Extension 2
 * ------------------------------------------------------------------
 * For this use case I need all the keys to have a universal edge event
 * callback so I will add universal event callbacks although I'd maybe
 * do it differently if I was starting from scratch.
 */


// TODO: This is slightly polluting global scope.. I think everything
//    we don't need to access globally can go in the initialize
//    function including 2 anonymous functions which the global
//    registration functions can be assigned to so they can access
//    the internal state, little tricky to explain in words...
//    I will do this later though as I need to confirm it works 
//    as intended and there's nothing to test it yet..

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

// I need to be able to turn this on and off.. little hacky but I
//    need it fast!
var disableDefaultKeyboard = false;

var keyboardUpCallbacks = {};
var keyboardDownCallbacks = {};

// Both up and down, these callbacks receives the state of the
//   key as a parameter
var keyboardEdgeCallbacks = {};

// Universal callbacks - applied to every key and overrideable
//    using registerUniversalKeyboardCallback
var universalKeyboardUpCallback   = (name)=>{};
var universalKeyboardDownCallback = (name)=>{};
var universalKeyboardEdgeCallback = (name, state)=>{};
 

function initializeKeyboard(keyMap = exampleKeyMap, disableDefault = true, debugMode = false)
{
    disableDefaultKeyboard = disableDefault;
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
                        universalKeyboardEdgeCallback(name, state);
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
                    return true;
                }
            }
        }
        return false;
    };

    document.addEventListener("keydown", (e) =>
    {
        if(updateKey(e.keyCode, true) && disableDefaultKeyboard)
            e.preventDefault();
    });

    document.addEventListener("keyup", (e) =>
    {
        if(updateKey(e.keyCode, false) && disableDefaultKeyboard)
            e.preventDefault();
    });
}

function registerUniversalKeyboardCallback(type, fun)
{
    switch(type)
    {
        case "edge": universalKeyboardEdgeCallback = fun; break;
        case "up":   universalKeyboardUpCallback   = fun; break;
        case "down": universalKeyboardDownCallback = fun; break;
    }
}

function registerKeyboardCallback(label, type, fun)
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