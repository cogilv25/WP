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

//DEFINE Canvas and World

class ropeMaterial
{
    distanceBetweenNodes = 20;// The distance between the nodes of the rope
    tension = 0.1;            // Shortens the rope to put it under tension, max 1

    nodeRadius = 2;           // Radius of the nodes
    nodeDensity = 0.5;        // Relative mass of nodes for their volume
    nodeFriction = 0.5;       // Friction of nodes in contact with surfaces
    nodeRestitution = 0.01;   // Node bounciness
    nodeDamping = 0.2;        // Damping of node movement

    jointFrequency = 30;      // Lower values are less stretchy, max 30
    jointDampingRatio = 0.9;  // Damping of stretch behaviour
}

var WIDTH=800;
var HEIGHT=600;
var SCALE=30;

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let mouseStart = [0,0];
let mouseCurrent = [0,0];
let clicking = false;

var running = true;
var won = false;
var score = 1000;
var gameStarted = false;
var world = new b2World(
new b2Vec2(0,9.81),
true
);

// Rope properties
var ropeNodePeriod = 20;

// Static World Objects

var anchor1 =  defineNewStatic(1,0.5,0.2,200,100,10,10,0,"anchor");
var anchor2 =  defineNewStatic(1,0.5,0.2,750,50,10,10,0,"anchor");
var anchor3 =  defineNewStatic(1,0.5,0.2,300,360,10,10,0,"anchor");

var platform = defineNewStatic(0.01,1,0.1,235,370,30,4,0,"platform");
var frog = defineNewStatic(1,0,0.2,235,347.5,17,17,0,"frog");
frog.SetSensor(true);


var food =
defineNewDynamicCircle(1, 1, 0.5, 490, 245, 10, "food");


// var ropeJoints = [
//     defineNewDistanceJoint(food,anchor1),
//     defineNewDistanceJoint(food,anchor2),
//     defineNewDistanceJoint(food,anchor3)
// ];

var ropeJoints = [];
var ropes = [
    [food,anchor1,new ropeMaterial()],
    [food, anchor2, new ropeMaterial()],
    [food, anchor3, new ropeMaterial()]
];
initializeRopes(ropes);

let destroyList = [];


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

    for(var i in destroyList) {
        // Get the bodies at either end of the joint
        var b1 = destroyList[i].GetBodyA();
        var b2 = destroyList[i].GetBodyB();

        // Delete the joint
        world.DestroyJoint(destroyList[i]);
        if(!gameStarted) gameStarted = true;

        // Delete bodies that are no longer attached to any other bodies
        if(b1.GetJointList() == null && b1.GetUserData().id == "ropeNode") world.DestroyBody(b1);
        if(b2.GetJointList() == null && b2.GetUserData().id == "ropeNode") world.DestroyBody(b2);
    }
    destroyList.length = 0;
        
    ctx.font = "32px Arial";
    ctx.fillStyle = "#606060";
    ctx.fillText("Score: " + score,4,30);

    if(gameStarted && score > 0)
        score--;

    if(clicking)
    {
        var t = ctx.lineWidth;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#f55";
        ctx.setLineDash([10,6]);
        ctx.beginPath();
        ctx.moveTo(mouseStart[0],mouseStart[1]);
        ctx.lineTo(mouseCurrent[0],mouseCurrent[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = t;
    }


    var pos = food.GetBody().GetPosition();
    if( pos.x * SCALE > 1000 || pos.x * SCALE < -200 || 
        pos.y * SCALE > 800 || pos.y * SCALE < -200)
        running = false;

    if(running)
        window.requestAnimationFrame(update);
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

    }
window.requestAnimationFrame(update);
    

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

function defineNewRevoluteJoint(body1, body2)
{
    var joint = new Box2D.Dynamics.Joints.b2RevoluteJointDef();
    joint.Initialize(body1.GetBody(),body2.GetBody(),body1.GetBody().GetWorldCenter());
    return world.CreateJoint(joint);
}

/**
 * @param {object} body1 - Description
 * 
 */
function defineNewDistanceJoint(body1, body2)
{
    var joint = new Box2D.Dynamics.Joints.b2DistanceJointDef();
    joint.Initialize(body1.GetBody(),body2.GetBody(),
        body1.GetBody().GetWorldCenter(), body2.GetBody().GetWorldCenter());
    return world.CreateJoint(joint);
}

function initializeRopes(ropeList)
{
    for(i in ropeList)
    {
        var a = ropeList[i][0].GetBody().GetPosition();
        var b = ropeList[i][1].GetBody().GetPosition();
        var den = ropeList[i][2].nodeDensity;
        var res = ropeList[i][2].nodeRestitution;
        var fri = ropeList[i][2].nodeFriction;
        var dam = ropeList[i][2].nodeDamping;
        var fq = ropeList[i][2].jointFrequency;
        var dar = ropeList[i][2].jointDampingRatio;
        var ten = ropeList[i][2].tension;
        var rad = ropeList[i][2].nodeRadius;

        var nNodes = Math.floor ( 
            ( 
                Math.sqrt(
                    (a.x - b.x)**2 + (a.y - b.y) **2
                ) 
                * SCALE
            ) 
            / ropeList[i][2].distanceBetweenNodes
        );
        console.log(nNodes);
        var xStep = ((a.x - b.x) / nNodes)* SCALE;
        var yStep = ((a.y - b.y) / nNodes)* SCALE;
        var node, prevNode = false;
        for (var j = 1; j < nNodes; j++)
        {
            var x = a.x * SCALE - ( xStep * j);
            var y = a.y * SCALE - ( yStep * j);
            node = defineNewDynamicCircle(den, fri, res, x, y, rad, "ropeNode");
            node.GetBody().SetLinearDamping(dam);
            var joint;
            if(prevNode === false)
                joint = defineNewDistanceJoint(ropeList[j][0],node);
            else
                joint = defineNewDistanceJoint(prevNode,node);

            joint.SetFrequency(fq);
            joint.SetDampingRatio(dar);
            joint.SetLength(joint.GetLength() * (1.0 - ten));

            ropeJoints.push(joint)
            prevNode = node;
        }
        var joint =  defineNewDistanceJoint(prevNode,ropeList[i][1]);
        joint.SetFrequency(fq);
        joint.SetDampingRatio(dar);
        joint.SetLength(joint.GetLength() * (1.0 - ten));
        ropeJoints.push(joint);
    }
}

function cutRopeJointsWithLine(lx1, ly1, lx2, ly2)
{
    for (var i = 0; i < ropeJoints.length; i++)
    {
        var p1 = ropeJoints[i].GetAnchorA();
        var p2 = ropeJoints[i].GetAnchorB();
        if(doLinesIntersect(lx1, ly1, lx2, ly2, 
                p1.x * SCALE, p1.y * SCALE, p2.x * SCALE, p2.y * SCALE)
            )
        {
            destroyList.push(ropeJoints[i]);
        }
    }
}

function doLinesIntersect(l1x1, l1y1, l1x2, l1y2, l2x1, l2y1, l2x2, l2y2)
{
    var determinant = (l1x2 - l1x1) * (l2y2 - l2y1) - (l2x2 - l2x1) * (l1y2 - l1y1);

    if(determinant === 0) return false;

    var gamma = ((l1y1 - l1y2) * (l2x2 - l1x1) + (l1x2 - l1x1) * (l2y2 - l1y1)) / determinant;
    var lambda = ((l2y2 - l2y1) * (l2x2 - l1x1) + (l2x1 - l2x2) * (l2y2 - l1y1)) / determinant;

    if(lambda > 0 && lambda < 1 && gamma > 0 && gamma < 1) return true;
}

canvas.addEventListener("mousedown", (e) =>
{
    mouseStart = [e.offsetX, e.offsetY];
    clicking = true;
});

canvas.addEventListener("mousemove", (e) =>
{
    mouseCurrent[0] = e.offsetX;
    mouseCurrent[1] = e.offsetY;
});

document.addEventListener("mouseup", (e) =>
{
    if(clicking)
    {
        clicking = false;
        cutRopeJointsWithLine(mouseStart[0], mouseStart[1], mouseCurrent[0], mouseCurrent[1]);
    }
});

document.addEventListener("keydown", (e) =>
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
    if((fixa == "frog" && fixb == "food") || (fixb=="frog" && fixa=="food"))
    {
        won = true;
        score += 500;
        running = false;
    }
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