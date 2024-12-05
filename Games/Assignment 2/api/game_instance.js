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



//TODO: move data acquisition to main and pass 
//    to threads, since we can just do it once.

// -------------------------------------------
//           Data Shared With Clients
// -------------------------------------------
const sharedEntityTypes = require(__dirname + "\\..\\public\\data\\entities.json");
const sharedWorldSettings = require(__dirname + "\\..\\public\\data\\world.json");
const INPUT = require(__dirname + "\\..\\public\\data\\input.json");

// -------------------------------------------
//               "Private Data"
// -------------------------------------------

const privateWorldSettings = require(__dirname + "\\data\\world.json");
const privateEntityTypes = require(__dirname + "\\data\\entities.json");

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
const PLAYER_INPUT = 3;
const UPDATE = 4;
const GET_STATE = 5;
const PLAYER_DC = 6;

// -------------------------------------------
//                 Globals
// -------------------------------------------

// ------ Game-Agnostic

// Constant
var tick_rate;
var scale;

// Modifiable
var gravity;
var world;
var listener;

// TODO: If a player disconnected we'd need to notify the
//    game_instance as otherwise an input will stay in
//    whatever position it was last known to be in, possibly
//    running into traps, etc...
var playerInputs = [ [], [] ];

var players = [];
var worldState = [];

// TODO: Temporary
let playerFixtureDefs = 
[
	new FixtureDefinition,
	new FixtureDefinition,
	new FixtureDefinition,
	new FixtureDefinition
];

var running = false;

// Arrays
var entities = [];
var entitiesHead = 0;

// ------ Game-Specific
var hungerEnabled = false;
var gameDefaultState = 
{
	entities:
	[
		{game_type: "player", x: 320, y: 65133, userData: { type: "player", id: 0 } },
		{game_type: "player", x: 384, y: 65133, userData: { type: "player", id: 1 } },
		{game_type: "floor", x: 32768, y: 65280, width:  65024 },
		{game_type: "floor", x: 32768, y: 256,   width:  65024 },
		{game_type: "wall",  x: 256,     y: 32768, height: 65024 },
		{game_type: "wall",  x: 65280, y: 32768, height: 65024 },

		{game_type: "ball", x: 600, y: 100 },
		{game_type: "ball", x: 700, y: 300 }
	]
};

// Where in the entity list the 2 player entities are.
var playerIdOff = 0;


// TODO: visible property so we can not bother
//    sending anything that is not drawn.
var entityTypes = [];

// Runs immediatley at the bottom of this script, initializes the thread
// so that a lobby can be assigned to it...
function initialize()
{

	// Combine shared and private data sources
	// Note: if I add anything that overwrites later,
	//     structuredClone must be used!
	worldSettings = {...sharedWorldSettings, ...privateWorldSettings};

	tick_rate = worldSettings.tick_rate;
	scale = worldSettings.scale;
	gravity = new Vec2(worldSettings.gravity.x, worldSettings.gravity.y);

	world = new World(gravity, true);
	world.SetContactListener(listener);

	entityTypes = {};
	entityTypes['default'] = {...sharedEntityTypes['default'], ...privateEntityTypes['default']};

	// Now we make a copy of default for each entity then overwrite it with
	//    the properties from the shared and private entity data sources.
	for([k, v] of Object.entries(privateEntityTypes))
	{
		if(k == "default") continue;
		
		entityTypes[k] = structuredClone(entityTypes['default']);
		for([k2,v2] of Object.entries(sharedEntityTypes[k]))
		{
			entityTypes[k][k2] = v2;
		}
		for([k2,v2] of Object.entries(privateEntityTypes[k]))
		{
			entityTypes[k][k2] = v2;
		}
	}


	// Initialize Players
	for(let i = 0; i < playerFixtureDefs.length; ++i)
{
	playerFixtureDefs[i].density = 0.5;
	playerFixtureDefs[i].friction = 0;
	playerFixtureDefs[i].restitution = 0.5;
    playerFixtureDefs[i].shape = new Polygon;
    playerFixtureDefs[i].shape.SetAsBox((worldSettings.playerStats[i].width / scale) / 2, (worldSettings.playerStats[i].height / scale) / 2);
}

	players.push(structuredClone(worldSettings.player));
	players.push(structuredClone(worldSettings.player));

	
	// TODO: This should be placing player spawns NOT players...
	createEntity(entityTypes['player_l'], {x: 48, y: 48, userData: {type:"player", id: 0}});
	createEntity(entityTypes['player_l'], {x: 96, y: 48, userData: {type:"player", id: 1}});


	//console.log(entityTypes);

	// Setup world bounding square.
	let worldMidX = worldSettings.width / 2;
	let worldMidY = worldSettings.height / 2;
	let worldEndX = worldSettings.width;
	let worldEndY = worldSettings.height;

	// Vertical Boundaries
	createEntity(entityTypes['floor'], {width: worldSettings.width, x: worldMidX, y: worldEndY});
	createEntity(entityTypes['floor'], {width: worldSettings.width, x: worldMidX});

	// Horizontal Boundaries
	createEntity(entityTypes['wall'], {height: worldSettings.height, y: worldMidY});
	createEntity(entityTypes['wall'], {height: worldSettings.height, y: worldMidY, x: worldEndX});


	for(let i = 0; i < worldSettings.entities.length; ++i)
	{
		let entityType = entityTypes[worldSettings.entities[i].type];
		createEntity(entityType, worldSettings.entities[i]);
	}

	// Initialize input state tracking
	for(let i = 0; i < INPUT.length; ++i)
	{
		playerInputs[0].push(false);
		playerInputs[1].push(false);
	}

	parentPort.postMessage({type: INIT_COMPLETE});
}


parentPort.on('message', (message) => {
	if(message.type == START_GAME)
	{
		running = true;
		hungerEnabled = true;
		update();
	}
	else if(message == STOP_GAME)
	{
		running = false;
	}
	else if (message.type == PLAYER_DC)
	{
		let player = message.playerId;
		for(let i = 0; i < playerInputs[player].length; ++i)
		{
			playerInputs[player][i] = false;
		}
	}
	else if(message.type == PLAYER_INPUT)
	{
		let player = (message.input & 64) >> 6;
		let state = (message.input & 128) > 0;
		let action = (message.input & 63);
		let entityId = playerIdOff + player;

		//Debug Logging
		// console.log("Raw: " + message.input + 
		// 	" Key: " + action +
		// 	" State: " + JSON.stringify(state) +
		// 	" Player: " + player);

		playerInputs[player][action] = state;
		if(!state && (action == INPUT.RIGHT_ACTION || action == INPUT.LEFT_ACTION))
		{
			let b = entities[playerIdOff + player].GetBody();
			b.SetLinearVelocity(new Vec2(0, b.GetLinearVelocity().y));
		}
	}
	else if( message.type == GET_STATE)
	{
		// TODO: We should be passing the current state...
		//    This will work so long as no entities are
		//    created or deleted, additionally the first
		//    frame shown to the player may be quite far
		//    from reality although their first update would
		//    fix it... We will fix later
		let stateRequestId = message.id;
		parentPort.postMessage({type: GET_STATE, id: stateRequestId, state: worldState, playerId: 0, playerIdOff: playerIdOff});
	}
});

function deleteEntity(id)
{
	world.destroyBody(entities[i].GetBody())

	entities[id] = null;

	if(entitiesHead > id)
		entitiesHead = id;
}

let deleteList = [];
function update()
{
	for(let p = 0; p < playerInputs.length; ++p)
	{
		let e = playerIdOff + p;
		let b = entities[e].GetBody();
		let stats = worldSettings.playerStats[Math.floor((players[p].hunger + 39) / 40)];

		if(playerInputs[p][INPUT.LEFT_ACTION])
		{
			b.ApplyImpulse(new Vec2(-stats.accel, 0), b.GetWorldCenter());
			let vel = b.GetLinearVelocity();
			if(vel.x < -stats.speed)
				b.SetLinearVelocity(new Vec2(-stats.speed, vel.y));
		}
		if(playerInputs[p][INPUT.RIGHT_ACTION])
		{
			b.ApplyImpulse(new Vec2(stats.accel, 0), b.GetWorldCenter());
			let vel = b.GetLinearVelocity();
			if(vel.x > stats.speed)
				b.SetLinearVelocity(new Vec2(stats.speed, vel.y));
		}
		if(playerInputs[p][INPUT.JUMP_ACTION])
		{
			if(players[p].onFloor)
				b.ApplyImpulse(new Vec2(0,-stats.jump), b.GetWorldCenter());
		}

		if(playerInputs[p][INPUT.INTERACT_ACTION])
		{
			if(players[p].interactList.length > 0)
			{
				playerInteract(p, players[p].interactList.pop());
			}
		}

		if(players[p].updateDimensions)
		{
			console.log("Fatter");
			players[p].updateDimensions = false;

			if(players[p].hunger == 0)
				console.log("Player " + p + " died");

			let heightDiff = worldSettings.playerStats[players[p].stage].height;
			players[p].stage = Math.floor((players[p].hunger + 39) / 40);

			let ud = entities[e].GetUserData();
			let fd = entities[e].GetFilterData();
			let sens = entities[e].IsSensor();
			b.DestroyFixture(entities[e]);
			entities[e] = b.CreateFixture(playerFixtureDefs[players[p].stage]);
			entities[e].SetUserData(ud);
			entities[e].SetFilterData(fd);
			entities[e].SetSensor(sens);

			heightDiff = worldSettings.playerStats[players[p].stage].height - heightDiff;
			let pos = entities[e].GetBody().GetPosition();
			pos.y += heightDiff / scale;
		}
	}

	world.Step(
	    1/tick_rate, // tick rate
	    10, // velocity iterationsw
	    10 // position iterations
    );
	let entityUpdate = [];

	for(let i = 0; i < deleteList.length; ++i)
	{
		deleteEntity(deleteList[i]);
	}
	deleteList = [];



	// TODO: 16bits per value (3 values), so 6 bytes 
	//    per entity every 16.667ms (60fps). With 16 
	//    threads and 100 entities per thread
	//    that's 6*100*60*16 bytes/s == ~0.5 MB/s.
	//    Really having 100 moving entities at a given 
	//    time per instance is unlikely in this app
	//    if we need to reduce more we could only
	//    send what's visible to each player...
	//  

	// TODO: We could keep track of the positions and only send
	//    if they change by at least 1 pixel as that is the min
	//    we will actually see in the browser..

	// 2 bytes p1_stats, 2 bytes p2_stats, 2 bytes for the total
	//    count of entities (reduce desync).
	let off = 3;
	let size = off * 2 + (entities.length * 8);
	let data = new ArrayBuffer(size, {maxByteLength: size});
	let buffer = new Uint16Array(data);
	let playerDetails = new Uint8Array(data);
	let count = 0;
	for(let i = 0; i < 2; ++i)
	{
		playerDetails[i * 2] = players[i].hunger;
		playerDetails[i * 2] = playerDetails[i * 2] << 1;
		playerDetails[i * 2] += (players[i].direction + 2) % 3;
		playerDetails[i * 2 + 1] = players[i].animation;
	}
	buffer[2] = entities.length;
	for(let i = 0; i < entities.length; ++i)
	{
		let entity = entities[i].GetBody();
		if(entity.GetType() == StaticBody) continue;
		if(!entity.IsAwake()) continue;

		let position = entity.GetPosition();

		// TODO: Test
		// This allows us to transfer the angle with 2 bytes of information:
		// - deg = (rad * 180) / PI
		// - We however want a number where 65536 represents 360 degrees.
		// - if 65536 == 360deg, then half of that or 32768 == 180deg.
		// - finally we want to wrap around 65536 since 0deg == 360deg.
		let angle = (entity.GetAngle() * 32768 / Math.PI) % 65536;

		buffer[off + count * 4]     = i;
		buffer[off + count * 4 + 1] = position.x * scale;
		buffer[off + count * 4 + 2] = position.y * scale;
		buffer[off + count * 4 + 3] = angle;
		++count;
	}
	data.resize(off * 2 + count * 8);

	parentPort.postMessage({type:UPDATE, entities: buffer});
	//console.log(entities[0].GetBody().GetPosition());
	if(running)
		setTimeout(update, 1000 / tick_rate);
}

// This is used to disclude certain properties from
//    being sent to the client that they do not need.
// TODO: this may not be needed I will leave it here
//    though so if it is I hopefully remember!
const privatePropertyKeys = [ "density"];

function createEntity(entityType, sparseProps)
{
	let props = structuredClone(entityType);
	for([k, v] of Object.entries(sparseProps))
	{
		props[k] = v;
	}

	let worldX = worldSettings.offsetX + props.x;
	let worldY = worldSettings.offsetY + worldSettings.height - props.y;

	// B2D Entity Creation.
	let fixDef = new FixtureDefinition;
    fixDef.density = props.density;
    fixDef.friction = props.friction;
    fixDef.restitution = props.restitution;
    let bodyDef = new BodyDefinition;
    bodyDef.type = props.bodyType;
    bodyDef.position.x = worldX / scale;
    bodyDef.position.y = worldY / scale;
    bodyDef.angle = (props.rotation / 180) * Math.PI;
    switch(props.shape)
    {
    	case 1:
    		fixDef.shape = new Circle(props.radius / scale);
    		break;
    	case 0:
		    fixDef.shape = new Polygon;
		    fixDef.shape.SetAsBox((props.width / scale) / 2, (props.height / scale) / 2);
    		break;
    }
    let entity = world.CreateBody(bodyDef).CreateFixture(fixDef);

    if(props.requiresIndex)
    	props.userData.index = entitiesHead;

    // TODO: Full Entity Creation System
	entity.SetSensor(props.isSensor);
    entity.SetUserData(props.userData);
	entity.GetBody().SetSleepingAllowed(props.sleepingAllowed);
	entity.GetBody().SetFixedRotation(props.fixedRotation);
	entity.GetBody().SetLinearDamping(props.linearDamping);
	let filter = entity.GetBody().GetFixtureList().GetFilterData();
	filter.categoryBits = props.categories;
	filter.maskBits = props.mask;
	filter.groupIndex = props.group;
	entity.SetFilterData(filter);

	// Add the entity to the b2d entities
	entities[entitiesHead] = entity;
	for(++entitiesHead; entitiesHead < entities.length; ++entitiesHead)
		if(entities[entitiesHead] === null) break;


	// Add new entity to world state
	let worldAngle = props.rotation * (65536 / 360);
	let clientEntity = {type: props.userData.type};
	for([k,v] of Object.entries(sparseProps))
	{
		if(k != "userData")
			clientEntity[k] = v;
	}
	clientEntity.x = worldX;
	clientEntity.y = worldY;
	worldState.push(clientEntity);
}


listener = new ContactListener;
listener.BeginContact = function(contact) 
{
	let f1 = contact.GetFixtureA();
	let u1 = f1.GetUserData();
	let f2 = contact.GetFixtureB();
	let u2 = f2.GetUserData();

	if((u1.type == "player" || u2.type == "player") && (u1.type == "floor" || u2.type == "floor"))
	{
		let playerId = (u1.type == "player" ? u1 : u2).id;
		players[playerId].onFloor = true;
		entities[playerIdOff + playerId].GetBody().SetLinearVelocity( new Vec2(
			entities[playerIdOff + playerId].GetBody().GetLinearVelocity().x, 0));
	}

	if((u1.type == "player" || u2.type == "player") && (u1.type == "cake" || u2.type == "cake"))
	{
		let playerIsF1 = (u1.type == "player");
		let playerId = (playerIsF1 ? u1 : u2).id;
		let cakeIndex = (playerIsF1 ? u2 : u1).index;
		players[playerId].interactList.push(cakeIndex);
	}
}
listener.EndContact = function(contact)
{
	let f1 = contact.GetFixtureA();
	let u1 = f1.GetUserData();
	let f2 = contact.GetFixtureB();
	let u2 = f2.GetUserData();

	if((u1.type == "player" || u2.type == "player") && (u1.type == "floor" || u2.type == "floor"))
	{
		let playerId = (u1.type == "player" ? u1 : u2).id;
		players[playerId].onFloor = false;
	}

	if((u1.type == "player" || u2.type == "player") && (u1.type == "cake" || u2.type == "cake"))
	{
		let playerIsF1 = (u1.type == "player");
		let playerId = (playerIsF1 ? u1 : u2).id;
		let cakeIndex = (playerIsF1 ? u2 : u1).index;
		let indexToRemove = players[playerId].interactList.indexOf(cakeIndex);
		players[playerId].interactList.splice(indexToRemove, 1);
	}
}
listener.PostSolve = function(contact, impulse) { }
listener.PreSolve = function(contact, oldManifold) { }


initialize();

function modifyPlayerHunger(player, diff)
{
	let hunger = players[player].hunger;
	let newHunger = hunger + diff;
	players[player].hunger
	if(players[player].hunger > 0)
	{
		players[player].hunger = newHunger;

		if(Math.floor((hunger + 39) / 40) - Math.floor((newHunger + 39) / 40) == 0)
			return;
		// Make the player bigger or smaller
		//    at the expected points.
		players[player].updateDimensions = true;
	}
}

(() => {
	function hungerDrainFunction()
	{
		if(hungerEnabled)
		{
			modifyPlayerHunger(0, -worldSettings.hungerDrainAmount);
			modifyPlayerHunger(1, -worldSettings.hungerDrainAmount);
		}
		setTimeout(hungerDrainFunction, worldSettings.hungerDrainPeriod);
	};
	hungerDrainFunction();
})();