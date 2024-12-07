// Associates labels with a set of keycodes
let exampleKeyMap = {
    up:    [87, 38], // W and Up
    left:  [65, 37], // A and Left
    right: [68, 39], // D and Right
    down:  [83, 40]  // S and Down
};


var keyboardState;

var keyboardUpCallbacks = {};
var keyboardDownCallbacks = {};
// Both up and down, these callbacks receives the state of the
//   key as an argument
var keyboardEdgeCallbacks = {};
function initializeKeyboard(keyMap)
{
    keyboardState = {};
    for(name of Object.keys(keyMap))
        keyboardState[name] = false;

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

