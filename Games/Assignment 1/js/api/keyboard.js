/* Simple & Extendable Keyboard event abstraction.
 * ------------------------------------------------------------------
 * Simply pass the init function a mapping of key names to keycodes
 * and it will maintain the state of all keys requested. An Example
 * mapping and resulting keyboardState preceed the implementation.
 */

let exampleKeyMap = {
    up:    [87, 38],
    left:  [65, 37],
    right: [68, 39],
    down:  [83, 40]
};

//This is an example and will be overwritten
var keyboardState = {
    up:    false,
    left:  false,
    right: false,
    down:  false
};

function initializeKeyboard(keyMap = exampleKeyMap, debugMode = false)
{
    keyboardState = {};
    for(name of Object.keys(keyMap))
        keyboardState[name] = false;

    document.addEventListener("keydown", (e) =>
    {
        if(debugMode)
            console.log(e.keyCode + " Down");
        for(const [name, keys] of Object.entries(keyMap))
            for(var i = 0; i < keys.length; i++)
                if(e.keyCode == keys[i])
                    keyboardState[name] = true;
    });

    document.addEventListener("keyup", (e) =>
    {
        if(debugMode)
            console.log(e.keyCode + " Up");
        for(const [name, keys] of Object.entries(keyMap))
            for(var i = 0; i < keys.length; i++)
                if(e.keyCode == keys[i])
                    keyboardState[name] = false;
    });
}