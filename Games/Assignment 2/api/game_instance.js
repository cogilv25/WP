"use_strict"
// TODO: SharedArrayBuffer should store the initial state of the thread?
//    this would make it easy to reset threads if we need to.. We can also
//    store things like entity types, level data, etc this way and all threads
//    can share this since they will be reading only.

// TODO: I wonder if I can use a SharedArrayBuffer to circumvent comms to the
//    main thread, I'd be shocked if this wasn't faster than sending message
//    updates through ports. Instead we can simply send "update" or equivalent
//    and doubleBuffer the data while we work on the next "frame"...


// TODO: Performance Implications - This is a list of known less-than-ideal
//    performance areas that can be investigated if we have performance
//    issues... which we likely won't...
//    - The use of splice, we can in almost all circumstances use a sparse
//        array instead.
//    - The use of string comparison to identify things, we can define these
//        in data and then use variables assigned to numbers instead. We have
//        done this in some places but doing it extensively would give some
//        admittedly unknown performance gains..


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
const INPUT = (() =>
{
	let data = require(__dirname + "\\..\\public\\data\\input.json");
	let strippedInput = {};
	let count = 0;
	for([k,v] of Object.entries(data))
		strippedInput[k] = count++;

	return strippedInput;
})();

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
const PrismaticJointDefinition = B2D.Dynamics.Joints.b2PrismaticJointDef;
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

var tick_rate;
var scale;

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

// Complex state is world state that can't or shouldn't be sent 
//    to the clients such as Timers, Functions, or potentially
//    data that could allow a player to cheat, although we aren't
//    really worried about that right now to be honest! 
var complexState = [];
var countStateObjects = 0;

let playerFixtureDefs = 
[
	new FixtureDefinition,
	new FixtureDefinition,
	new FixtureDefinition,
	new FixtureDefinition
];

var running = false;

var entities = [];
var entitiesHead = 0;

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


var entityTypes = [];

var entityStateChangeFunctions =
{
	heavy_door_mechanism: (entityId, energy, state) =>
	{
		console.log("Entity: " + entityId + " Energy: " + energy + " State: " + state);
		console.log("|- Reversed: " + worldState[entityId].reversed);
		if(state)
		{
			if(complexState[entityId].timer != null)
			{
				clearInterval(complexState[entityId].timer);
				complexState[entityId].timer = null;
			}
			//Open the door
			entities[entityId].GetBody().
				GetJointList().joint.EnableMotor(true != worldState[entityId].reversed);
			if(complexState[entityId].openScriptedEvent != null)
			{
				if(complexState[entityId].openScriptRun == false)
				{
					complexState[entityId].openScriptRun =
					complexState[entityId].openScriptedEvent();
				}
			}
		}
		else
		{
			// Close the door after the timer elapses
			complexState[entityId].timer  = setTimeout(() =>
			{
				entities[entityId].GetBody().
					GetJointList().joint.EnableMotor(false != worldState[entityId].reversed);

				if(complexState[entityId].closeScriptedEvent != null)
				{
					if(complexState[entityId].closeScriptRun == false)
					{
						complexState[entityId].closeScriptRun =
						complexState[entityId].closeScriptedEvent();
					}
				}
			}
			, worldState[entityId].timerTime);
		}
	}
};

// Note: must be an entity that can be activated.
// energy is intended to allow complex behaviour such
//    as multiple inputs being required..
function activateEntity(entityId, energy)
{
	let prevEnergy = worldState[entityId].energy;
	worldState[entityId].energy += energy;
	console.log("Entity: " + entityId + " Energy: " + energy + " Acc_Energy: " + worldState[entityId].energy);
	if(prevEnergy < worldState[entityId].activationEnergy)
	{
		if(worldState[entityId].energy >= worldState[entityId].activationEnergy)
		{
			entityStateChangeFunctions[worldState[entityId].type](entityId, energy, true);
		}
	}
}

// Note: must be an entity that can be deactivated.
// energy is intended to allow complex behaviour such
//    as multiple inputs being required..
function deactivateEntity(entityId, energy)
{
	let prevEnergy = worldState[entityId].energy;
	worldState[entityId].energy -= energy;
	console.log("Entity: " + entityId + " Energy: " + energy + " Acc_Energy: " + worldState[entityId].energy);
	if(prevEnergy >= worldState[entityId].activationEnergy)
	{
		if(worldState[entityId].energy < worldState[entityId].activationEnergy)
		{
			entityStateChangeFunctions[worldState[entityId].type](entityId, energy, false);
		}
	}
}

// Returns the index of the entity that activates the door.
// depth is the number of physical doors in a row that make
//    up this logical door.
// order is the opening order of the doors 1 (left->right) or -1
//    -1 < values < 1 will create gaps between the doors.
// reverse - if true the door opens downwards, otherwise upwards.
function createHeavyDoor(depth, order, reverse, activationEnergy, timerTime, x, y, height)
{
	// These doors essentially form a doubly linked list, the mechanism
	//    is an invisible surface for the revolute joint to attach to,
	//    both the mechanism and stopper are used to trigger the next door
	//    on begin/end contact events.
	if(reverse)
		y -= height + entityTypes["heavy_door_stopper"].height;
	let e = entities.length;
	let width = entityTypes['heavy_door'].width;
	createEntity(entityTypes['heavy_door'], {x:x, y:y, height:height, parent: 0});
	let mechY = y + height + 1;

	createEntity(entityTypes['heavy_door_mechanism'], {x:x, y:mechY, height:height,energy:0,activationEnergy:activationEnergy,
		timerTime:timerTime, reversed : reverse});


	let anchor = entities[e + 1].GetBody();
	let door = entities[e].GetBody();
	let jointDef = new PrismaticJointDefinition();
	let midX = (entityTypes['heavy_door'].width / 2) / scale;
	let midY = (height / 2) / scale;
	let axis = new Vec2(0, 1);
	let lTrans = (height / scale);
	let motorSpeed = 20;
	let motorMax = door.GetMass() * 200;

	jointDef.localAxisA = axis;
	jointDef.bodyA = anchor;
	jointDef.bodyB = door;
	jointDef.maxMotorForce = motorMax;
	jointDef.motorSpeed = -motorSpeed;
	jointDef.enableMotor = reverse;

	world.CreateJoint(jointDef);

	let stopOff = entityTypes['heavy_door_stopper'].height + (height / 2);
	createEntity(entityTypes['heavy_door_stopper'], {x:x, y:mechY + stopOff, opensDoor: true != reverse});
	createEntity(entityTypes['heavy_door_stopper'], {x:x, y:y - stopOff, opensDoor: false != reverse});

	
	let cx = x; 
	for(let i = 1; i < depth; ++i)
	{
		cx += width * order;
		worldState[e + (i - 1) * 4].child = e + i * 4 + 1;

		createEntity(entityTypes['heavy_door'], {x:cx,y:y,height:height, parent:e+(i-1)*4});
		createEntity(entityTypes['heavy_door_mechanism'], {x:cx, y:mechY, height:height, reversed: reverse});

		jointDef.bodyA = entities[e + i * 4 + 1].GetBody();
		jointDef.bodyB = entities[e + i * 4].GetBody();
		world.CreateJoint(jointDef);

		createEntity(entityTypes['heavy_door_stopper'], {x:cx, y:mechY + stopOff, opensDoor: true != reverse});
		createEntity(entityTypes['heavy_door_stopper'], {x:cx, y:y - stopOff, opensDoor: false != reverse});
	}

	worldState[entities.length - 1].child = 0;

	return e + 1;
}

// TODO: I don't like this solution.. but I don't have another one at the moment...
//    I suspect this is one of those write it rough then figure out how it should
//    work later type of problems.. I will probably run out of time for the second
//    phase however..
function initializeComplexEntities()
{
	entityTypes['heavy_door_mechanism'].width = entityTypes['heavy_door'].width;
	entityTypes['heavy_door_mechanism'].height = entityTypes['heavy_door'].height;
	entityTypes['heavy_door_stopper'].width = entityTypes['heavy_door'].width;
	// Doors (A single logical door may contain multiple physical doors)
	// Breakable Doors

	// Heavy Doors
	  // Single Heavy
	let door2 = createHeavyDoor(1, 1, false, 3, 300, 1324, 191, 104);
	  // Triple Heavy
	let door3 = createHeavyDoor(3, 1, true, 3, 1500, 1268, 61, 104);
	  // Quad Heavy
	let door1 = createHeavyDoor(4, 1, false, 3, 2000, 600, 105, 192);

	complexState[door3].openScriptRun = false;
	complexState[door3].openScriptedEvent = () =>
	{
		console.log("hello");
		return false;
	}

	// The first door gatekeeps the players until they are ready to start,
	//    prevents a player getting trapped in the first room, and enables
	//    hunger
	complexState[door1].openScriptRun = false;
	complexState[door1].closeScriptRun = false;
	complexState[door1].openScriptedEvent = () =>
	{
		console.log("Door Opened!");
		return false;
	};
	complexState[door1].closeScriptedEvent = () =>
	{
		console.log("Door Closed!");
		let p1Pos = entities[0].GetBody().GetPosition();
		let p2Pos = entities[1].GetBody().GetPosition();
		let doorPos = entities[door1].GetBody().GetPosition();
		if(p1Pos.x + 4 > doorPos.x && p2Pos.x + 4 > doorPos.x)
		{
			hungerEnabled = true;
			return true;
		}
		return false;
	};

	// Elevator

	// TODO: Pull Cords

	// Pressure Plates
	// TODO: these should be prismatic joints as well so that the player interacts with them physically...
	//    We could also do with them being in a function due to the number of things that need to be in
	//    worldState
	createEntity(entityTypes['pressure_plate'], { x: 352, y: 9, width: 64, target: door1, weightLimit: 6, weight: 0});
	//createEntity(entityTypes['pressure_plate'], { x: 992, y: 9, target: door2, weightLimit: 3, weight: 0});
	createEntity(entityTypes['pressure_plate'], { x: 1072, y: 9, target: door3, weightLimit: 3, weight: 0});
	createEntity(entityTypes['pressure_plate'], { x: 1456, y: 9, target: door3, weightLimit: 3, weight: 0});
}

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
		if(sharedEntityTypes[k] != null)
		{
			for([k2,v2] of Object.entries(sharedEntityTypes[k]))
			{
				entityTypes[k][k2] = v2;
			}
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
		playerFixtureDefs[i].friction = 0.5;
		playerFixtureDefs[i].restitution = 0.5;
	    playerFixtureDefs[i].shape = new Polygon;
	    playerFixtureDefs[i].shape.SetAsBox((worldSettings.playerStats[i].width / scale) / 2,
	    	(worldSettings.playerStats[i].height / scale) / 2);
	}

	players.push(structuredClone(worldSettings.player));
	players.push(structuredClone(worldSettings.player));

	
	// TODO: This should be placing player spawns NOT players...
	createEntity(entityTypes['player_l'], {x: 48, y: 48, userData: {type:"player", id: 0}});
	createEntity(entityTypes['player_l'], {x: 48, y: 48, userData: {type:"player", id: 1}});


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


	// Initialize simple entities
	for(let i = 0; i < worldSettings.entities.length; ++i)
	{
		let entityType = entityTypes[worldSettings.entities[i].type];
		createEntity(entityType, worldSettings.entities[i]);
	}

	initializeComplexEntities();

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
		let entityId = player;

		//Debug Logging
		// console.log("Raw: " + message.input + 
		// 	" Key: " + action +
		// 	" State: " + JSON.stringify(state) +
		// 	" Player: " + player);

		playerInputs[player][action] = state;
		if(!state && (action == INPUT.RIGHT_ACTION || action == INPUT.LEFT_ACTION))
		{
			let b = entities[player].GetBody();
			b.SetLinearVelocity(new Vec2(0, b.GetLinearVelocity().y));
		}
	}
	else if( message.type == GET_STATE)
	{
		setTimeout(() => { parentPort.postMessage({type: GET_STATE, id: message.id, state: worldState}); }, 500);
	}
});

function deleteEntity(id)
{
	world.DestroyBody(entities[id].GetBody())

	if(worldState[id].sendState)
		--countStateObjects;

	entities[id] = null;

	if(entitiesHead > id)
		entitiesHead = id;
}

function playerInteract(player, entity)
{
	let otherPlayer = player == 0 ? 1 : 0;
	let removeIndex = players[otherPlayer].interactList.indexOf(entity);

	if( removeIndex != -1)
		players[otherPlayer].interactList.splice(removeIndex, 1);

	if(entities[entity].GetUserData().type == "cake")
	{
		modifyPlayerHunger(player, 40);
		deleteList.push(entity);
	}
}

let deleteList = [];
function update()
{
	for(let p = 0; p < playerInputs.length; ++p)
	{
		let e = p;
		let b = entities[e].GetBody();
		let stats = worldSettings.playerStats[players[p].stage];

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
			{
				players[p].onFloor = false;
				let vel = b.GetLinearVelocity();
				vel.y = -stats.jump;
				b.SetLinearVelocity(vel);
			}
		}

		if(playerInputs[p][INPUT.INTERACT_ACTION])
		{
		// TODO: attempting to interact by pressing e, and an interaction
		//    taking place, both need modeled and one bool won't work..
		//    annoyingly I can't remember why now (:
			if(!players[p].interacting)
			{
				console.log("Interact Started!");
				players[p].interacting = true;
				if(players[p].interactList.length > 0)
				{
					playerInteract(p, players[p].interactList.pop());
				}
			}
		}
		else
		{
			if(players[p].interacting)
			{
				players[p].interacting = false;
				console.log("Interact Finished");
			}
		}

		if(players[p].updateDimensions)
		{
			console.log("Player Stage Update");
			players[p].updateDimensions = false;

			if(players[p].hunger == 0)
				console.log("Player " + p + " died");


			let prevStage = players[p].stage;
			players[p].stage = Math.floor((players[p].hunger + 39) / 40);
			if(players[p].stage > 3) players[p].stage = 3;


			let ud = entities[e].GetUserData();
			let fd = entities[e].GetFilterData();
			let sens = entities[e].IsSensor();
			b.DestroyFixture(entities[e]);
			entities[e] = b.CreateFixture(playerFixtureDefs[players[p].stage]);
			entities[e].SetUserData(ud);
			entities[e].SetFilterData(fd);
			entities[e].SetSensor(sens);

			let heightDiff = worldSettings.playerStats[players[p].stage].height - 
				worldSettings.playerStats[prevStage].height;
			let pos = entities[e].GetBody().GetPosition();
			pos.y += heightDiff / scale;

			// Handle the players hunger stage changing on top of a pressure plate.
			let pressurePlate = players[p].pressurePlate; 
			if(pressurePlate > 0)
			{
				let stageDiff = players[p].stage - prevStage;
				let target = worldState[pressurePlate].target;
				let prevWeight = worldState[pressurePlate].weight;
				let weightLimit = worldState[pressurePlate].weightLimit;
				worldState[pressurePlate].weight += stageDiff;

				if(stageDiff > 0)
				{
					if(prevWeight < weightLimit)
					{
						activateEntity(target, Math.min(stageDiff, weightLimit - prevWeight));
					}
				}
				else if(worldState[pressurePlate].weight < weightLimit)
				{
					deactivateEntity(target, Math.min(-stageDiff, weightLimit - worldState[pressurePlate].weight));
				}
			}
		}
	}

	world.Step(
	    1/tick_rate, // tick rate
	    10, // velocity iterations
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
	let size = ((off + countStateObjects + 1) * 2) + (entities.length * 8);
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
	buffer[off++] = countStateObjects;
	for(let i = 0; i < entities.length; ++i)
	{
		if(worldState[i].sendState)
			buffer[off++] = (worldState[i].state << 12) + i;
	}

	
	//console.log(off);

	for(let i = 0; i < entities.length; ++i)
	{
		if(entities[i] == null) continue;
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

		worldState[i].x = position.x * scale;
		worldState[i].y = position.y * scale;

		buffer[off + count * 4]     = (worldState[i].state << 12) + i;
		buffer[off + count * 4 + 1] = position.x * scale;
		buffer[off + count * 4 + 2] = position.y * scale;
		buffer[off + count * 4 + 3] = angle;
		++count;
	}
	data.resize(off * 2 + count * 8);

	parentPort.postMessage({type:UPDATE, entities: buffer});

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


	entities[entitiesHead] = entity;
	for(++entitiesHead; entitiesHead < entities.length; ++entitiesHead)
		if(entities[entitiesHead] === null) break;


	// Add new entity to world state
	let worldAngle = props.rotation * (65536 / 360);
	let clientEntity = {type: props.userData.type, state: 0, sendState: props.sendState};
	if(props.sendState)
		++countStateObjects;

	for([k,v] of Object.entries(sparseProps))
	{
		if(k != "userData")
			clientEntity[k] = v;
	}

	clientEntity.x = worldX;
	clientEntity.y = worldY;
	worldState.push(clientEntity);
	if(props.complex);
	complexState[worldState.length] = {};
}

listener = new ContactListener;
listener.BeginContact = function(contact) 
{
	let f1 = contact.GetFixtureA();
	let u1 = f1.GetUserData();
	let f2 = contact.GetFixtureB();
	let u2 = f2.GetUserData();

	if((u1.type == "heavy_door" || u2.type == "heavy_door") && (u1.type == "heavy_door_stopper" || u2.type == "heavy_door_stopper"))
	{
		let doorId = (u1.type == "heavy_door" ? u1 : u2).index;
		let stopperId = (u1.type == "heavy_door" ? u2 : u1).index;
		let child = worldState[doorId].child;
		if(child > 0)
			entityStateChangeFunctions["heavy_door_mechanism"](child, 0, worldState[stopperId].opensDoor);
	}

	if((u1.type == "player" || u2.type == "player") && (u1.type == "floor" || u2.type == "floor"))
	{
		let playerId = (u1.type == "player" ? u1 : u2).id;
		let floorId = (u1.type == "player" ? u2 : u1).index;
		if(entities[playerId].GetBody().GetPosition().y + (30/scale) < entities[floorId].GetBody().GetPosition().y)
		{
			players[playerId].onFloor = true;
			entities[playerId].GetBody().SetLinearVelocity( new Vec2(
				entities[playerId].GetBody().GetLinearVelocity().x, 0));
		}
	}

	if((u1.type == "player" || u2.type == "player") && (u1.type == "cake" || u2.type == "cake"))
	{
		let playerIsF1 = (u1.type == "player");
		let playerId = (playerIsF1 ? u1 : u2).id;
		let cakeIndex = (playerIsF1 ? u2 : u1).index;
		players[playerId].interactList.push(cakeIndex);
	}

	if((u1.type == "player" || u2.type == "player") && (u1.type == "pressure_plate" || u2.type == "pressure_plate"))
	{
		let playerIsF1 = (u1.type == "player");
		let playerId = (playerIsF1 ? u1 : u2).id;
		let pressurePlateIndex = (playerIsF1 ? u2 : u1).index;
		++worldState[pressurePlateIndex].state;
		players[playerId].pressurePlate = pressurePlateIndex;
		activateEntity(worldState[pressurePlateIndex].target, players[playerId].stage);
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

	if((u1.type == "player" || u2.type == "player") && (u1.type == "pressure_plate" || u2.type == "pressure_plate"))
	{
		let playerIsF1 = (u1.type == "player");
		let playerId = (playerIsF1 ? u1 : u2).id;
		let pressurePlateIndex = (playerIsF1 ? u2 : u1).index;
		--worldState[pressurePlateIndex].state;
		players[playerId].pressurePlate = 0;
		deactivateEntity(worldState[pressurePlateIndex].target, players[playerId].stage);
	}
}
listener.PostSolve = function(contact, impulse) 
{ 
	let f1 = contact.GetFixtureA();
	let u1 = f1.GetUserData();
	let f2 = contact.GetFixtureB();
	let u2 = f2.GetUserData();
	if((u1.type == "heavy_door" || u2.type == "heavy_door") && (u1.type == "player" || u2.type == "player"))
	{
		let body = (u1.type == "heavy_door" ? f1 : f2).GetBody();
		let vel = body.GetLinearVelocity();
		vel.x = 0;
	}
}
listener.PreSolve = function(contact, oldManifold)
{
	
}


initialize();

function modifyPlayerHunger(player, diff)
{
	let hunger = players[player].hunger;
	if(hunger < 1) return;

	let newHunger = hunger + diff;
	if(newHunger < 0) newHunger = 0;
	else if(newHunger > 119) newHunger = 119;

	players[player].hunger = newHunger;

	if(Math.floor((hunger + 39) / 40) - Math.floor((newHunger + 39) / 40) == 0)
		return;
	// Make the player bigger or smaller
	//    at the expected points.
	players[player].updateDimensions = true;
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