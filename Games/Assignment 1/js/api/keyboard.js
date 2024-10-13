/* Simple & Extendable Keyboard event abstraction.
 * ------------------------------------------------------------------
 * Simply pass the init function a mapping of labels to keycodes
 * and it will maintain the state of all keys requested. An Example
 * mapping and resulting keyboardState preceed the implementation.
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

function initializeKeyboard(keyMap = exampleKeyMap, disableDefault = true, debugMode = false)
{
    keyboardState = {};
    for(name of Object.keys(keyMap))
        keyboardState[name] = false;

    let updateKey = (key, state) => {
        if(debugMode)
            console.log(key + " " + (state ? "Pressed":"Released"));
        for(const [name, keys] of Object.entries(keyMap))
        {
            for(var i = 0; i < keys.length; i++)
            {
                if(key == keys[i])
                {
                    keyboardState[name] = state;
                    return true;
                }
            }
        }
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