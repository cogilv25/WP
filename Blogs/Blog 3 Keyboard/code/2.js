// Associates labels with a set of keycodes
let exampleKeyMap = {
    up:    [87, 38], // W and Up
    left:  [65, 37], // A and Left
    right: [68, 39], // D and Right
    down:  [83, 40]  // S and Down
};


var keyboardState;
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
                    keyboardState[action] = state;
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
