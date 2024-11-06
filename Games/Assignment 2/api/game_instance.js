"use_strict"
// TODO: SharedArrayBuffer should store the initial state of the thread?
//    this would make it easy to reset threads if we need to.. We can also
//    store things like entity types, level data, etc this way and all threads
//    can share this since they will be reading only.

// TODO: I wonder if I can use a SharedArrayBuffer to circumvent comms to the
//    main thread, I'd be shocked if this wasn't faster than sending message
//    updates through ports. Instead we can simply send "update" or equivalent
//    and doubleBuffer the data while we work on the next "frame"...

// -------------------------------------------
//                Includes
// -------------------------------------------

const { Worker, isMainThread, parentPort, workerData, threadId } = require('node:worker_threads');
const B2D = require("box2dweb-commonjs").Box2D;


// -------------------------------------------
//                 Defines
// -------------------------------------------

// Box 2D
const Vec2 = B2D.Common.Math.b2Vec2;
const BodyDefinition = B2D.Dynamics.b2BodyDef;
const Body = B2D.Dynamics.b2Body;
const StaticBody = Body.b2_staticBody;
const DynamicBody = Body.b2_dynamicBody;
const FixtureDefinition = B2D.Dynamics.b2FixtureDef;
const Fixture = B2D.Dynamics.b2Fixture;
const World = B2D.Dynamics.b2World;
const ContactListener = B2D.Dynamics.b2ContactListener;
const Polygon = B2D.Collision.Shapes.b2PolygonShape;
const Circle = B2D.Collision.Shapes.b2CircleShape;
const DistanceJoint = B2D.Dynamics.Joints.b2DistanceJoint;
const RevoluteJoint = B2D.Dynamics.Joints.b2RevoluteJoint;
const PrismaticJoint = B2D.Dynamics.Joints.b2PrismaticJoint;
const LineJoint = B2D.Dynamics.Joints.b2LineJoint;
const WeldJoint = B2D.Dynamics.Joints.b2WeldJoint;
const PulleyJoint = B2D.Dynamics.Joints.b2PulleyJoint;
const FrictionJoint = B2D.Dynamics.Joints.b2FrictionJoint;
const GearJoint = B2D.Dynamics.Joints.b2GearJoint;
const MouseJoint = B2D.Dynamics.Joints.b2MouseJoint;

// Messages
const INIT_COMPLETE = 0;
const START_GAME = 1;
const STOP_GAME = 2;
const INPUT = 3;
const UPDATE = 4;
const GET_STATE = 5;

// -------------------------------------------
//                 Globals
// -------------------------------------------

// ------ Game-Agnostic

// Constant
const TICK_RATE = workerData.TICK_RATE;
const SCALE = workerData.SCALE;

// Modifiable
var gravity;
var world;
var listener;
var players;
var running = false;

// Arrays
var entities = [];

// ------ Game-Specific
var gameDefaultState = 
{
	playerHungerPaused: true,
	entities:
	[
		{game_type: "floor", x: 400, y: 0 },
		{game_type: "floor", x: 400, y: 600 },
		{game_type: "wall", x: 0, y: 300 },
		{game_type: "wall", x: 800, y: 300 },
		{game_type: "ball", x: 405, y: 100 },
		{game_type: "ball", x: 395, y: 300 }
	]
};
var game;


// TODO: visible property so we can not bother
//    sending anything that is not drawn.
var entityTypes = [];

entityTypes['ball'] = 
{
	density: 0.2,
	friction: 0.5,
	restitution: 1.1,
	x: 0, y:0,
	rotation: 0,
	radius: 10,
	type: "dynamic",
	shape: "circle"
};

entityTypes['wall'] = 
{
	density: 0.5,
	friction: 0.5,
	restitution: 0.5,
	x: 0, y: 0,
	rotation: 0,
	width: 8,
	height: 600,
	type: "static",
	shape: "rect"
};

entityTypes['floor'] = 
{
	density: 0.5,
	friction: 0.5,
	restitution: 0.5,
	x: 0, y: 0,
	rotation: 0,
	width: 800,
	height: 8,
	type: "static",
	shape: "rect"
};

// Runs immediatley at the bottom of this script, initializes the thread
// so that a lobby can be assigned to it...
function initialize()
{
	game = structuredClone(gameDefaultState);
	gravity = new Vec2(workerData.gravity.x, workerData.gravity.y);
	world = new World(gravity, true);
	world.SetContactListener(listener);

	//TODO: This would be sent in by the main thread and stored in a
	//    global so we can reset the state fairly quickly whenever
	//    we want to.
	for(let i = 0; i < gameDefaultState.entities.length; ++i)
	{
		let template = gameDefaultState.entities[i];
		let props = structuredClone(entityTypes[template.game_type]);
		for([k, v] of Object.entries(template))
		{
			props[k] = v;
		}
		entities.push(createEntity(props));
	}

	parentPort.postMessage({type: INIT_COMPLETE});
}

// when a ping message is received, send a pong message back.
parentPort.on('message', (message) => {
	if(message.type == START_GAME)
	{
		players = message.players;
		running = true;
		update();
	}
	else if(message == STOP_GAME)
	{
		running = false;
	}
	else if(message == INPUT)
	{

	}
	else if( message.type == GET_STATE)
	{
		// TODO: We should be passing the current state...
		//    This will work so long as no entities are
		//    created or deleted, additionally the first
		//    frame shown to the player may be quite far
		//    from reality although their first update would
		//    fix it...
		let stateRequestId = message.id;
		parentPort.postMessage({type: GET_STATE, id: stateRequestId, state: gameDefaultState.entities});
	}
});

function update()
{
	world.Step(
	    1/TICK_RATE, // tick rate
	    10, // velocity iterations
	    10 // position iterations
    );
	let entityUpdate = [];

	// TODO: We're not sending the rotations!
	//    We could also do with cutting this
	//    down as much as possible data wise,
	//    probably 16bits per value (3 values) would be
	//    acceptable, so 6 bytes per entity/16.667ms.
	//    With 16 threads and 100 entities per thread
	//    that's 6*100*60*16 bytes/s == ~0.5 MB/s.
	//    Really having 100 moving entities at a given 
	//    time per instance is unlikely in this app
	//    if we need to reduce more we could only
	//    send what's visible to each player...
	//  

	// TODO: We should keep track of the positions and only send
	//    if they change by at least 1 pixel as that is the min
	//    we will actually see in the browser..
	for(let i = 0; i < entities.length; ++i)
	{
		let entity = entities[i].GetBody();
		if(entity.GetType() == StaticBody) continue;
		if(!entity.IsAwake()) continue;

		let position = entity.GetPosition();
		entityUpdate.push({id: i, x: position.x * SCALE, y: position.y * SCALE});
	}

	if(entityUpdate.length > 0)
    	parentPort.postMessage({type:UPDATE, entities: entityUpdate});
	
	if(running)
		setTimeout(update, 1000 / TICK_RATE);
}

function createEntity(props)
{
	let fixDef = new FixtureDefinition;
    fixDef.density = props.density;
    fixDef.friction = props.friction;
    fixDef.restitution = props.restitution;
    let bodyDef = new BodyDefinition;
    bodyDef.type = props.type == "dynamic" ? DynamicBody : StaticBody;
    bodyDef.position.x = props.x / SCALE;
    bodyDef.position.y = props.y / SCALE;
    bodyDef.angle = (props.rotation / 180) * Math.PI;
    switch(props.shape)
    {
    	case "circle":
    		fixDef.shape = new Circle(props.radius / SCALE);
    		break;
    	case "rect":
		    fixDef.shape = new Polygon;
		    fixDef.shape.SetAsBox(props.width / SCALE, props.height / SCALE);
    		break;
    }
    let entity = world.CreateBody(bodyDef).CreateFixture(fixDef);

    // TODO: Full Entity Creation System
	// entity.SetSensor(props.sensor);
    // entity.GetBody().SetUserData(props.userData);
	// entity.GetBody().SetSleepingAllowed(props.sleepingAllowed);
	// entity.GetBody().SetFixedRotation(props.fixedRotation);
	// entity.GetBody().SetLinearDamping(props.linearDamping);
	// let filter = entity.GetBody().GetFixtureList().GetFilterData();
	// filter.categoryBits = props.categories;
	// filter.maskBits = props.mask;
	// filter.groupIndex = props.group;
	// entity.GetBody().GetFixtureList().SetFilterData(filter);
    return entity;
}


listener = new ContactListener;
listener.BeginContact = function(contact) { }
listener.EndContact = function(contact) { }
listener.PostSolve = function(contact, impulse) { }
listener.PreSolve = function(contact, oldManifold) { }


initialize();