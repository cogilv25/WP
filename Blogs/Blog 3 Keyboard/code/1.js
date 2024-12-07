var up    = false;
var left  = false;
var right = false;
var down  = false;

document.addEventListener("keydown", (e) =>
{
    if(e.keyCode == 38)
        up = true;
    else if(e.keyCode == 37)
        left = true;
    else if(e.keyCode == 39)
        right = true;
    else if(e.keyCode == 40)
        down = true
});

document.addEventListener("keyup", (e) =>
{
    if(e.keyCode == 38)
        up = false;
    else if(e.keyCode == 37)
        left = false;
    else if(e.keyCode == 39)
        right = false;
    else if(e.keyCode == 40)
        down = false
});

function update()
{
    if(left)
        movePlayer(5,0);

    updatePhysics();
    renderCanvas();
}