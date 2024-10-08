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
var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;

// EaselJS Stuff
var easelCanvas, easelCtx, loader, stage, stageHeight, stageWidth;

easelCanvas = document.getElementById("easelCanvas");
easelCtx = easelCanvas.getContext("2d");
stage = new createjs.Stage(easelCanvas);
stage.snapPixelsEnabled = true;
stageWidth = stage.canvas.width;
stageHeight = stage.canvas.height;

var manifest = [
    {src:"background.png", id:"background"},
    {src:"something2.png", id:"someOtherString"},
    {src:"someCarImage.png", id:"car"},
    {src:"tile.png", id:"tile"},
    {src:"spritessheet.png", id:"ss"}
];

var something;

function makeBitmap(ldrImg, b2x, b2y)
{
    var theimage = new createjs.Bitmap(ldrImg);
    var scaleX = (b2x * 2) / theimage.image.naturalWidth;
    var scaleY = (b2y * 2) / theimage.image.naturalHeight;
    theimage.scaleX = scaleX;
    theimage.scaleY = scaleY;
    theimage.regX = theimage.image.width / 2;
    theimage.regY = theimage.image.height / 2;
    return theimage;
}

function makeHorizontalTile(ldrimg, fillw, tilew)
{
    var rect = new createjs.Shape();
    rect.graphics.beginBitmapFill(ldrimg).drawRect(0,0,fillw+ldrimg.width,ldrimg.height);
    rect.tileW = tilew;
    rect.snapToPixel = true;
    return rect;
}

loader = new createjs.LoadQueue(false);
loader.addEventListener("complete",() =>
{
    something = makeBitmap(loader.getResult("background"),stageWidth, stageHeight);
    something.x = 0;
    something.y = 0;
    //b2d == radians, easel == degrees
    something.rotation = 0 * (180 / Math.PI);

    tile = makeHorizontalTile(loader.getResult("tile"),stageWidth, 50);
    tile.x = 0;
    tile.y = 550;

    ss = new createjs.SpriteSheet({
        framerate: 30,
        "images": [loader.getResult("spritessheet")],
        "frames": {
            "regX": 82, "regy": 144,
            "width": 165, "height": 292,
            "count": 64
        },
        "animations": {
            "stand": [4, 5, "stand", 1],
            "run": [0, 25, "run", 1.5],
            "jump": [26, 63, "stand", 1]
        }
    });

    character = new createjs.Sprite(ss,"stand");
    character.snapToPixel = true;
    character.x = 100;
    character.y = 100;

    stage.addChild(something, character, tile);

    // Run Game Loop
    createjs.Ticker.framerate=60;
    createjs.Ticker.timingMode = createjs.Ticker.RAF;
    createjs.Ticker.addEventListener("tick", (e) =>
    {
        //box2d
        update();
        //easel
        stage.update(e);
    });
});
loader.loadManifest(manifest, true, "folderWhereAssetsAre/");

//DEFINE Canvas and World

var WIDTH=800;
var HEIGHT=600;
var SCALE=30;

let b2dCanvas = document.getElementById("b2dCanvas");
let ctx = b2dCanvas.getContext("2d");

var goalImage = document.getElementById("goalImg");
var ladderImage = document.getElementById("ladderImg");

var heroOnGround = false;
var heroOnLadder = false;

var playerPressingUp = false;
var playerPressingDown = false;
var playerPressingLeft = false;
var playerPressingRight = false;

var running = true;
var won = false;
var world = new b2World(
new b2Vec2(0,9.81),
true
);


// Static World Objects
var ground =
defineNewStatic(1.0,0.5,0.2,(WIDTH/2),HEIGHT,(WIDTH/2),5,0,"ground");

var leftwall =
defineNewStatic(1.0,0.5,0.8,5,HEIGHT,5,HEIGHT,0,"leftwall");

var rightwall = defineNewStatic(1.0,0.5,0.8,WIDTH-
5,HEIGHT,5,HEIGHT,0,"rightwall");

var goalplat = defineNewStatic(1.0,0.5,0.1,655,75,150,5,0,"goalplat");
var bounceplat = defineNewStatic(1.0,0.5,0.1,160,415,40,5,0,"bounceplat");

var ladder = defineNewStatic(1.0,1.0,1.0,298,142,18,50,0,"ladder");
ladder.GetBody().GetFixtureList().SetSensor(true);

var plat1 = defineNewStatic(1.0,0.5,0.1,205,100,200,5,0.15,"plat");
var plat2 = defineNewStatic(1.0,0.5,0.1,450,175,350,5,-0.2,"plat");
var plat3 = defineNewStatic(1.0,0.5,0.1,25,315,40,5,0,"plat");
var plat4 = defineNewStatic(1.0,0.5,0.1,520,325,270,5,-0.075,"plat");
var plat5 = defineNewStatic(1.0,0.5,0.1,300,525,400,5,0.1,"plat");


var filter = plat1.GetBody().GetFixtureList().GetFilterData();
filter.categoryBits = 2;
plat1.GetBody().GetFixtureList().SetFilterData(filter);

//Dynamic World Objects

function spawnBarrel()
{
    defineNewDynamicCircle(1.0,0.2,0.2,50,50,20,"barrel");
}

setInterval( spawnBarrel, 7200);
spawnBarrel();


var hero =
defineNewDynamicCircle(1.0,0.2,0.2,30,570,10,"hero");
hero.GetBody().SetFixedRotation(true);

/*****
* Objects for Destruction
*/
var destroylist = []; // Empty List at start



/*
Debug Draw
*/
var debugDraw = new b2DebugDraw();
debugDraw.SetSprite(document.getElementById("b2dCanvas").getContext("2d")
);
debugDraw.SetDrawScale(SCALE);
debugDraw.SetFillAlpha(0.3);
debugDraw.SetLineThickness(1.0);
debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
world.SetDebugDraw(debugDraw);



// Update World Loop
function update() {

    if(heroOnLadder)
    {
        hero.GetBody().ApplyForce(new b2Vec2(0, -3), hero.GetBody().GetWorldCenter());
    }
    world.Step(
    1/60, // framerate
    10, // velocity iterations
    10 // position iterations
    );

    world.DrawDebugData();
    world.ClearForces();

    for(var i in destroylist) {
        world.DestroyBody(destroylist[i]);
        stage.removeChild(child);
    }
    destroylist.length = 0;

    // if(running)
    //     window.requestAnimationFrame(update);
    else
    {
        ctx.fillStyle = "#444";
        ctx.fillRect(200,250,400,100);
        ctx.fillStyle = "#111";
        ctx.fillRect(205,255,390,90);
        ctx.font = "64px Arial";

        if(won == true)
        {
            ctx.fillStyle = "#11ec11";
            ctx.fillText("You Won!",255,320);
        }
        else
        {
            ctx.fillStyle = "#ff1111";
            ctx.fillText("Game Over!",220,320);
        }
    }
    // }
    // window.requestAnimationFrame(update);
    

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

document.addEventListener("keydown", (e) => {
    // Don't prevent f5 and f12
    if(e.keyCode < 115)
        e.preventDefault();

    switch(e.keyCode)
    {
        // UP
        case 87:
        case 38:
            if(heroOnLadder)
            {
                var vel = hero.GetBody().GetLinearVelocity();
                vel.y = -5;
                hero.GetBody().SetLinearVelocity(vel);
            }
            else if(heroOnGround)
            {
                hero.GetBody().ApplyImpulse(new b2Vec2(0,-3), hero.GetBody().GetWorldCenter());
            }
            break;
        
        // LEFT
        case 65:
        case 37:
            if(heroOnLadder)
            {
                var vel = hero.GetBody().GetLinearVelocity();
                vel.x = -5;
                hero.GetBody().SetLinearVelocity(vel);
            }
            else
            {
                hero.GetBody().ApplyImpulse(new b2Vec2(-5,0), hero.GetBody().GetWorldCenter());
                var vel = hero.GetBody().GetLinearVelocity();
                if(vel.x < -10)
                {
                    vel.x = -10;
                    hero.GetBody().SetLinearVelocity(vel);
                }
            }
            break;

        // RIGHT_CONTROL_KEY_DOWN
        case 68:
        case 39:
            if(heroOnLadder)
            {
                var vel = hero.GetBody().GetLinearVelocity();
                vel.x = 5;
                hero.GetBody().SetLinearVelocity(vel);
            }
            else
            {
                hero.GetBody().ApplyImpulse(new b2Vec2(5,0), hero.GetBody().GetWorldCenter());
                var vel = hero.GetBody().GetLinearVelocity();
                if(vel.x > 10)
                {
                    vel.x = 10;
                    hero.GetBody().SetLinearVelocity(vel);
                }
            }
            break;

        // DOWN
        case 83:
        case 40:
            if(heroOnLadder)
            {
                var vel = hero.GetBody().GetLinearVelocity();
                vel.y = 5;
                hero.GetBody().SetLinearVelocity(vel);
            }
            else
            {
                var vel = hero.GetBody().GetLinearVelocity();
                if(vel.y < 0)
                {
                    vel.y = 0;
                    hero.GetBody().SetLinearVelocity(vel);
                }
            }
            break;

    }
});

document.addEventListener("keyup", (e) => {
    e.preventDefault();
    switch(e.keyCode)
    {
        // UP
        case 87:
        case 38:
            if(heroOnLadder)
            {
                var vel = hero.GetBody().GetLinearVelocity();
                vel.y = 0;
                hero.GetBody().SetLinearVelocity(vel);
            }
            break;
        
        // LEFT
        case 65:
        case 37:
            var vel = hero.GetBody().GetLinearVelocity();
            vel.x = 0;
            hero.GetBody().SetLinearVelocity(vel);
            break;
        
        // RIGHT
        case 68:
        case 39:
            var vel = hero.GetBody().GetLinearVelocity();
            vel.x = 0;
            hero.GetBody().SetLinearVelocity(vel);
            break;

        // DOWN
        case 83:
        case 40:
            if(heroOnLadder)
            {
                var vel = hero.GetBody().GetLinearVelocity();
                vel.y = 0;
                hero.GetBody().SetLinearVelocity(vel);
            }
            break;

    }
});

/*****
* Listeners
*/
var listener = new Box2D.Dynamics.b2ContactListener;
listener.BeginContact = function(contact) {
    var fixa=contact.GetFixtureA().GetBody().GetUserData().id;
    var fixb=contact.GetFixtureB().GetBody().GetUserData().id;

    // Destroy barrels that hit the ground
    if(fixa == "barrel" && fixb == "ground")
    {
        destroylist.push(contact.GetFixtureA().GetBody());
    }
    else if(fixa == "ground" && fixb == "barrel")
    {
        destroylist.push(contact.GetFixtureB().GetBody());
    }

    //Game over when the hero touches a barrel
    if((fixa == "barrel" && fixb == "hero") || (fixa == "hero" && fixb == "barrel"))
    {
        running = false;
    }

    //Win Condition when hero touches goal platform
    if( (fixa == "goalplat" && fixb == "hero" && contact.GetFixtureB().GetBody().GetPosition().y < contact.GetFixtureA().GetBody().GetPosition().y) || 
        (fixa == "hero" && fixb == "goalplat" && contact.GetFixtureB().GetBody().GetPosition().y > contact.GetFixtureA().GetBody().GetPosition().y)
    )
    {
        running = false;
        won = true;
    }

    // Update heroOnGround flag
    if(
        (fixa == "hero" && (fixb == "ground" || fixb == "plat" || fixb == "bounceplat")) ||
        (fixb == "hero" && (fixa == "ground" || fixa == "plat" || fixa == "bounceplat"))  )
        {
            heroOnGround = true;
        }

    //Ladder functionality
    if((fixa == "hero" && fixb == "ladder") || (fixb == "hero" && fixa == "ladder"))
    {
        heroOnLadder = true;
        var filter = hero.GetBody().GetFixtureList().GetFilterData();
        filter.maskBits = 65533;
        hero.GetBody().GetFixtureList().SetFilterData(filter);
        var vel = hero.GetBody().GetLinearVelocity();
        vel.y = 0;
        hero.GetBody().SetLinearVelocity(vel);
    }
}
listener.EndContact = function(contact) {
    var fixa=contact.GetFixtureA().GetBody().GetUserData().id;
    var fixb=contact.GetFixtureB().GetBody().GetUserData().id;

    // Update heroOnGround flag
    if(
        (fixa == "hero" && (fixb == "ground" || fixb == "plat" || fixb == "bounceplat")) ||
        (fixb == "hero" && (fixa == "ground" || fixa == "plat" || fixa == "bounceplat"))  )
        {
            heroOnGround = false;
        }

    //Ladder functionality
    if((fixa == "hero" && fixb == "ladder") || (fixb == "hero" && fixa == "ladder"))
        {
            heroOnLadder = false;
            var filter = hero.GetBody().GetFixtureList().GetFilterData();
            filter.maskBits = 65535;
            hero.GetBody().GetFixtureList().SetFilterData(filter);
        }


}

listener.PostSolve = function(contact, impulse) {
    var fixa=contact.GetFixtureA().GetBody().GetUserData().id;
    var fixb=contact.GetFixtureB().GetBody().GetUserData().id;

    //Handle bounce platform
    if(fixa == "barrel" && fixb == "bounceplat")
            bounceBarrel(contact.GetFixtureA().GetBody());
    else if(fixa == "bounceplat" && fixb == "barrel")
            bounceBarrel(contact.GetFixtureB().GetBody());
}

function bounceBarrel(barrelBody)
{
    var data = barrelBody.GetUserData();
    if(data.bounced != true)
    {
        data.bounced = true;
        barrelBody.ApplyImpulse(new b2Vec2(7,-14), barrelBody.GetWorldCenter());
        barrelBody.SetUserData(data);
    }
}

listener.PreSolve = function(contact, oldManifold) {
}

this.world.SetContactListener(listener);