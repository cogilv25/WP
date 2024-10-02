"use strict"
var b2Vec2 = Box2D.Common.Math.b2Vec2;
var b2BodyDef = Box2D.Dynamics.b2BodyDef;
var b2Body = Box2D.Dynamics.b2Body;
var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
var b2Fixture = Box2D.Dynamics.b2Fixture;
var b2World = Box2D.Dynamics.b2World;
var b2MassData = Box2D.Collision.Shapes.b2MassData;
var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
var b2CapsuleShape = Box2D.Collision.Shapes.b2CapsuleShape;
var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;

//DEFINE Canvas and World

var WIDTH=800;
var HEIGHT=600;
var SCALE=30;

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

var running = true;
var won = false;
var score = 0;
var world = new b2World(
new b2Vec2(0,9.81),
true
);


// Static World Objects
var ground =
defineNewStatic(1.0, 0.5, 0.2, (WIDTH/2), HEIGHT, (WIDTH/2), 5, 0, "ground");

var hero =
defineNewDynamicCircle(1.0, 0.2, 0.2, 30, 570, 10, "hero");
hero.GetBody().SetFixedRotation(true);


/*
Debug Draw
*/
var debugDraw = new b2DebugDraw();
debugDraw.SetSprite(document.getElementById("canvas").getContext("2d")
);
debugDraw.SetDrawScale(SCALE);
debugDraw.SetFillAlpha(0.3);
debugDraw.SetLineThickness(1.0);
debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
world.SetDebugDraw(debugDraw);



// Update World Loop
function update() {
    world.Step(
    1/60, // framerate
    10, // velocity iterations
    10 // position iterations
    );

    world.DrawDebugData();
    world.ClearForces();
        
    ctx.font = "64px Arial";
    ctx.fillStyle = "#11ec11";
    ctx.fillText("Score = "+score,255,320);

    window.requestAnimationFrame(update);

    }
window.requestAnimationFrame(update);
    
function submitScore()
{
    //Create the request.
    let url = './backend/add_highscore.php';
    let request = new XMLHttpRequest();
    request.open('POST', url, true);
    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    request.onreadystatechange = function()
    {
        // 4 == response ready.
        if(request.readyState != 4)
            return;

        if(request.status != 200)
        {
            console.error(request.responseText);
            return;
        }
        console.log(request.responseText);
    };

    // Prepare data and send request.
    let params = 'score=' + score;
    request.send(params);
}

/*****
* Utility Functions & Objects
*/
function defineNewStatic(density, friction, restitution, x, y, width, height, angle, objid) {
    var fixDef = new b2FixtureDef;
    fixDef.density = density;
    fixDef.friction = friction;
    fixDef.restitution = restitution;
    var bodyDef = new b2BodyDef;
    bodyDef.type = b2Body.b2_staticBody;
    bodyDef.position.x = x / SCALE;
    bodyDef.position.y = y / SCALE;
    bodyDef.angle = angle;
    fixDef.shape = new b2PolygonShape;
    fixDef.shape.SetAsBox(width/SCALE, height/SCALE);
    var thisobj = world.CreateBody(bodyDef).CreateFixture(fixDef);
    thisobj.GetBody().SetUserData({id:objid})
    return thisobj;
}

function defineNewDynamic(density, friction, restitution, x, y, width, height, objid) {
    var fixDef = new b2FixtureDef;
    fixDef.density = density;
    fixDef.friction = friction;
    fixDef.restitution = restitution;
    var bodyDef = new b2BodyDef;
    bodyDef.type = b2Body.b2_dynamicBody;
    bodyDef.position.x = x / SCALE;
    bodyDef.position.y = y / SCALE;
    fixDef.shape = new b2PolygonShape;
    fixDef.shape.SetAsBox(width/SCALE, height/SCALE);
    var thisobj = world.CreateBody(bodyDef).CreateFixture(fixDef);
    thisobj.GetBody().SetUserData({id:objid})
    return thisobj;
}

function defineNewDynamicCircle(density, friction, restitution, x, y, r, objid) {
    var fixDef = new b2FixtureDef;
    fixDef.density = density;
    fixDef.friction = friction;
    fixDef.restitution = restitution;
    var bodyDef = new b2BodyDef;
    bodyDef.type = b2Body.b2_dynamicBody;
    bodyDef.position.x = x / SCALE;
    bodyDef.position.y = y / SCALE;
    fixDef.shape = new b2CircleShape(r/SCALE);
    var thisobj = world.CreateBody(bodyDef).CreateFixture(fixDef);
    thisobj.GetBody().SetUserData({id:objid})
    return thisobj;
}    

document.addEventListener("keydown", (e) =>
{
    switch(e.keyCode)
    {
        // UP
        case 87:
        case 38:
            score++;
            break;
        
        // LEFT
        case 65:
        case 37:
            break;

        // RIGHT_CONTROL_KEY_DOWN
        case 68:
        case 39:
            break;

        // DOWN
        case 83:
        case 40:
            submitScore();
            score = 0;
            break;

    }
});

document.addEventListener("keyup", (e) =>
{
    switch(e.keyCode)
    {
        // UP
        case 87:
        case 38:
            break;
        
        // LEFT
        case 65:
        case 37:
            break;
        
        // RIGHT
        case 68:
        case 39:
            break;

        // DOWN
        case 83:
        case 40:
            break;

    }
});

/*****
* Listeners
*/
var listener = new Box2D.Dynamics.b2ContactListener;
listener.BeginContact = function(contact)
{
    var fixa = contact.GetFixtureA().GetBody().GetUserData().id;
    var fixb = contact.GetFixtureB().GetBody().GetUserData().id;
}

listener.EndContact = function(contact)
{
    var fixa = contact.GetFixtureA().GetBody().GetUserData().id;
    var fixb = contact.GetFixtureB().GetBody().GetUserData().id;
}

listener.PostSolve = function(contact, impulse)
{
    var fixa=contact.GetFixtureA().GetBody().GetUserData().id;
    var fixb=contact.GetFixtureB().GetBody().GetUserData().id;
}

listener.PreSolve = function(contact, oldManifold)
{
    var fixa=contact.GetFixtureA().GetBody().GetUserData().id;
    var fixb=contact.GetFixtureB().GetBody().GetUserData().id;
}

this.world.SetContactListener(listener);