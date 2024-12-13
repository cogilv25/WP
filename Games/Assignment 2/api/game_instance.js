"use_strict"
// TODO: Performance Implications - This is a list of known less-than-ideal
//    performance areas that can be investigated if we have performance
//    issues... which we likely won't...
//    - The use of splice, we can in almost all circumstances use a sparse
//        array instead.
//    - The use of string comparison to identify things, we can define these
//        in data and then use variables assigned to numbers instead. We have
//        done this in some places but doing it extensively would give some
//        admittedly unknown performance gains..
//    - Early optimization of the data transfer scheme has made it difficult
//        adding features, working around here and there for now but it could
//        do with a refactor once the requirements are better known.
//    - Message transfers between threads, I thinked SharedBufferArrays could
//        be faster but the time required is not currently worth the potential
//        for improvements at this point in time.
//


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
const soundMap = (() =>
{
	// We are just inverting the mapping.
	let sm = require(__dirname + "\\..\\public\\data\\sound_map.json");
	let list = [];

	for(let i = 0; i < sm.length; ++i)
		list[sm[i]] = i;

	return list;
})();

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
const WeldJointDefinition = B2D.Dynamics.Joints.b2WeldJointDef;
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
var soundBuffer = [];
var cachedState = [];

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

let playerCrouchFixtureDefs = 
[
	new FixtureDefinition,
	new FixtureDefinition,
	new FixtureDefinition,
	new FixtureDefinition
];

let balloonFixtureDef;

var running = false;

var entities = [];
var entitiesHead = 0;

var hungerEnabled = false;


var entityTypes = [];

var entityStateChangeFunctions =
{
	heavy_door_mechanism: (entityId, energy, state) =>
	{
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
	console.log("Entity: " + entityId + " Energy: " + energy + " Acc_Energy: " + worldState[entityId].energy + 
		" Prev: " + prevEnergy);
	if(prevEnergy >= worldState[entityId].activationEnergy)
	{
		if(worldState[entityId].energy < worldState[entityId].activationEnergy)
		{
			entityStateChangeFunctions[worldState[entityId].type](entityId, energy, false);
		}
	}
}

function createLadder(x, y, sections)
{
	for(let i = 0; i < sections; ++i)
		createEntity(entityTypes['ladder'], {x: x, y: y + i * 22, width: 20, height: 20});
}

// Returns the index of the entity that activates the door.
// depth is the number of physical doors in a row that make
//    up this logical door.
// order is the opening order of the doors 1 (left->right) or -1
//    -1 < values < 1 will create gaps between the doors.
// reverse - if true the door opens downwards, otherwise upwards.
function createHeavyDoor(depth, order, reverse, activationEnergy, timerTime, x, y, height, maxSpeed = 20, maxForce = 200, travel = 1)
{
	// These doors essentially form a doubly linked list, the mechanism
	//    is an invisible surface for the revolute joint to attach to,
	//    both the mechanism and stopper are used to trigger the next door
	//    on begin/end contact events.
	if(reverse)
		y -= (height * travel) + entityTypes["heavy_door_stopper"].height;
	let e = entities.length;
	let width = entityTypes['heavy_door'].width;
	createEntity(entityTypes['heavy_door'], {x:x, y:y, height:height, parent: 0});
	let mechY = y + (height * travel) + 1;

	createEntity(entityTypes['heavy_door_mechanism'], {x:x, y:mechY, height:height,energy:0,activationEnergy:activationEnergy,
		timerTime:timerTime, reversed : reverse});


	let anchor = entities[e + 1].GetBody();
	let door = entities[e].GetBody();
	let jointDef = new PrismaticJointDefinition();
	let midX = (entityTypes['heavy_door'].width / 2) / scale;
	let midY = (height / 2) / scale;
	let axis = new Vec2(0, 1);
	let lTrans = (height / scale);
	let motorSpeed = maxSpeed;
	let motorMax = door.GetMass() * maxForce;

	jointDef.localAxisA = axis;
	jointDef.bodyA = anchor;
	jointDef.bodyB = door;
	jointDef.maxMotorForce = motorMax;
	jointDef.motorSpeed = -motorSpeed;
	jointDef.enableMotor = reverse;

	world.CreateJoint(jointDef);

	let stopOff = entityTypes['heavy_door_stopper'].height + ((height * travel) / 2);
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
	let door2 = createHeavyDoor(1, 1, false, 3, 300, 4320, 235, 120);
	  // Triple Heavy
	let door3 = createHeavyDoor(3, 1, true, 3, 1500, 4264, 69, 120);
	  // Quad Heavy
	let door1 = createHeavyDoor(4, 1, false, 3, 2000, 600, 152, 288);


	// The first door gatekeeps the players until they are ready to start,
	//    prevents a player getting trapped in the first room, and enables
	//    hunger
	complexState[door1].openScriptRun = false;
	complexState[door1].closeScriptRun = false;
	complexState[door1].openScriptedEvent = () =>
	{
		return false;
	};
	complexState[door1].closeScriptedEvent = () =>
	{
		let p1Pos = entities[0].GetBody().GetPosition();
		let p2Pos = entities[1].GetBody().GetPosition();
		let doorPos = entities[door1].GetBody().GetPosition();
		if(p1Pos.x + 4 > doorPos.x && p2Pos.x + 4 > doorPos.x)
		{
			hungerEnabled = true;
			return true;
		}
		hungerEnabled = true;
		return false;
	};

	// Elevator
	// TODO: I'd like to implement this differently but this will do for now!
	let elevator = createHeavyDoor(1, 1, false, 3, 100, 5300, -112, 384, 40, 400, 0.85);
	createEntity(entityTypes['pressure_plate'], { x: 5112, y: 9, target: elevator, weightLimit: 3, weight: 0});

	// TODO: Pull Cords
	//    Supposed to be an alternative for pressure plates that the large man can't reach extending the
	//    types of puzzles  that can be created, may not have time though..

	// Pressure Plates
	// TODO: these should be prismatic joints as well so that the player interacts with them physically...
	//    We could also do with them being in a function due to the number of things that need to be in
	//    worldState
	createEntity(entityTypes['pressure_plate'], { x: 352, y: 9, width: 64, target: door1, weightLimit: 6, weight: 0});
	createEntity(entityTypes['pressure_plate'], { x: 3992, y: 9, target: door2, weightLimit: 3, weight: 0});
	createEntity(entityTypes['pressure_plate'], { x: 4072, y: 9, target: door3, weightLimit: 3, weight: 0});
	createEntity(entityTypes['pressure_plate'], { x: 4456, y: 9, target: door3, weightLimit: 3, weight: 0});

	// Ladders
	createLadder(3920, 18, 6);
}

// Adds another fixture to the  to the 
function attachBalloonCollider(playerId)
{
	// I'm doing something slightly hacky here, I am translating
	//    the vertices generated by SetAsBox up to prevent the
	//    collider colliding with the ground the player is
	//    walking on, we also reduce the height by 1 and translate 
	//    an extra pixel up to prevent collisions with the floor.
	//    Box2D doesn't seem to have a way to do this..
	let width = entityTypes["player_l"].width * 2;
	let height = entityTypes["player_l"].height * 1.25;

	let fixture = new FixtureDefinition;
	fixture.userData = {type: "player_balloon_collider", id: playerId};
	fixture.filter.categoryBits = 65535;
	fixture.filter.maskBits = 65525;
	fixture.density = 0;
	fixture.friction = 0;
	fixture.restitution = 0;
	fixture.isSensor = true;
    fixture.shape = new Polygon;
    fixture.shape.SetAsBox((width / scale) / 2, ((height - 1) / scale) / 2);

    for(let i = 0; i < fixture.shape.m_vertices.length; ++i)
    {
    	fixture.shape.m_vertices[i].y -= (height / scale) / 10;
    }

	entities[playerId].GetBody().CreateFixture(fixture);
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

	    playerCrouchFixtureDefs[i].density = 0.5;
		playerCrouchFixtureDefs[i].friction = 0.5;
		playerCrouchFixtureDefs[i].restitution = 0.5;
	    playerCrouchFixtureDefs[i].shape = new Polygon;
	    playerCrouchFixtureDefs[i].shape.SetAsBox((worldSettings.playerStats[i].width / scale) / 2,
	    	(worldSettings.playerStats[i].crouchHeight / scale) / 2);
	}

	//Initialize balloon fixture
	balloonFixtureDef = new FixtureDefinition;
	balloonFixtureDef.density = 0.5;
	balloonFixtureDef.friction = 0.5;
	balloonFixtureDef.restitution = 0.5;
    balloonFixtureDef.shape = new Polygon;
	balloonFixtureDef.shape.SetAsBox((worldSettings.playerStats[3].width / scale),
	    	(((worldSettings.playerStats[3].height * 1.25) / scale) / 2));

	players.push(structuredClone(worldSettings.player));
	players.push(structuredClone(worldSettings.player));

	// Initialize input state tracking
	for(let i = 0; i < INPUT.length; ++i)
	{
		playerInputs[0].push(false);
		playerInputs[1].push(false);
	}

	
	// TODO: This should be placing player spawns NOT players...
	createEntity(entityTypes['player_l'], {x: 48, y: 48, userData: {type:"player", id: 0}});
	createEntity(entityTypes['player_l'], {x: 48, y: 48, userData: {type:"player", id: 1}});

	attachBalloonCollider(0);
	attachBalloonCollider(1);


	//console.log(entityTypes);

	initializeComplexEntities();


	// Initialize simple entities
	for(let i = 0; i < worldSettings.entities.length; ++i)
	{
		let entityType = entityTypes[worldSettings.entities[i].type];
		createEntity(entityType, worldSettings.entities[i]);
	}


	// Setup world bounding square.
	let worldMidX = worldSettings.width / 2;
	let worldMidY = worldSettings.height / 2;
	let worldEndX = worldSettings.width;
	let worldEndY = worldSettings.height;

	// Vertical Boundaries
	createEntity(entityTypes['floor_bound'], {width: worldSettings.width, x: worldMidX, y: worldEndY});
	createEntity(entityTypes['floor_bound'], {width: worldSettings.width, x: worldMidX});

	// Horizontal Boundaries
	createEntity(entityTypes['wall_bound'], {height: worldSettings.height, y: worldMidY});
	createEntity(entityTypes['wall_bound'], {height: worldSettings.height, y: worldMidY, x: worldEndX});


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
		if(!state)
		{
			if(action == INPUT.RIGHT_ACTION || action == INPUT.LEFT_ACTION)
			{
				let b = entities[player].GetBody();
				b.SetLinearVelocity(new Vec2(0, b.GetLinearVelocity().y));
				players[player].walking = false;
				if(players[player].animation < 4)
					players[player].animation = players[player].animation & 14;
			}
			if(players[player].onLadder > 0 && (action == INPUT.UP_ACTION || action == INPUT.DOWN_ACTION))
			{
				let b = entities[player].GetBody();
				b.SetLinearVelocity(new Vec2(b.GetLinearVelocity().x, 0));
			}
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

function swapFixture(entityId, newFixtureDef)
{
	let b = entities[entityId].GetBody();
	let ud = entities[entityId].GetUserData();
	let fd = entities[entityId].GetFilterData();
	let sens = entities[entityId].IsSensor();
	b.DestroyFixture(entities[entityId]);
	entities[entityId] = b.CreateFixture(newFixtureDef);
	entities[entityId].SetUserData(ud);
	entities[entityId].SetFilterData(fd);
	entities[entityId].SetSensor(sens);
}

function balloonSpecial(playerId, activate)
{
	if(activate)
	{
		if(players[playerId].balloonColliderCount > 0)
			return;

		let b = entities[playerId].GetBody();

		players[playerId].specialDrain = 2;
		swapFixture(playerId, balloonFixtureDef);
		b.m_force.y = -gravity.y * b.GetMass();
		players[playerId].specialTimer = setTimeout(() => 
			{
				players[playerId].specialTimer = null;
				b.ApplyForce(new Vec2(0, -2 * b.GetMass()), b.GetWorldCenter());
			}
		, 300);
		players[playerId].activeSpecial = "balloon";
		players[playerId].animation = 4;
	}
	else
	{
		if(players[playerId].specialTimer != null)
		{
			clearInterval(players[playerId].specialTimer);
			players[playerId].specialTimer = null;
		}

		let b = entities[playerId].GetBody()
		b.m_force.y = 0;
		swapFixture(playerId, playerFixtureDefs[players[playerId].stage]);
		players[playerId].activeSpecial = "none";
		players[playerId].animation = 0;
	}
}

function fazeDash(playerId)
{
	if(players[playerId].specialSauce < 60) return;
	
	players[playerId].specialSauce -= 60;
	let b = entities[playerId].GetBody();
	b.m_force.y = -gravity.y * b.GetMass();
	players[playerId].specialTimer = setTimeout(() => 
		{
			players[playerId].specialTimer = null;
			b.m_force.y = 0;
			players[playerId].dieOnCollisionFor1Frame = true;
		}
	, 400);
}

let deleteList = [];
function update()
{
	for(let p = 0; p < playerInputs.length; ++p)
	{
		let e = p;
		let b = entities[e].GetBody();
		let stats = worldSettings.playerStats[players[p].stage];

		if(playerInputs[p][INPUT.SPECIAL_ACTION])
		{
			if(players[p].specialDrain == 0)
			{
				if(players[p].onFloor)
				{
					if(players[p].stage == 1)
					{

					}
					else if(players[p].stage == 2)
					{
						
					}
					else if(players[p].stage == 3)
					{
						balloonSpecial(p, true);
					}
				}
				else
				{
					if(players[p].stage == 1)
					{
						fazeDash(p);
					}
					else if(players[p].stage == 2)
					{
						
					}
					else if(players[p].stage == 3)
					{
						
					}
				}
			}
		}
		else
		{
			if(players[p].specialDrain > 0)
			{
				players[p].specialDrain = 0;
				if(players[p].activeSpecial == "balloon")					
					balloonSpecial(p, false);
			}
			else
			{
				if(players[p].activeSpecial == "balloon")
				{
					let vel = b.GetLinearVelocity();
					if(vel.y < -5)
					{
						vel.y = -5;
						b.SetLinearVelocity(vel);
					}
				}
			}
		}

		if(players[p].onLadder > 0 && players[p].activeSpecial == "none")
		{
			if(playerInputs[p][INPUT.UP_ACTION])
			{
				let vel = b.GetLinearVelocity();
				vel.y = Math.max(vel.y - (stats.accel / 1.5), -stats.speed / 1.5);
				b.SetLinearVelocity(vel);
			}
			if(playerInputs[p][INPUT.DOWN_ACTION])
			{
				let vel = b.GetLinearVelocity();
				vel.y = Math.min(vel.y + (stats.accel / 1.5), stats.speed / 1.5);
				b.SetLinearVelocity(vel);
			}
		}

		if(playerInputs[p][INPUT.JUMP_ACTION] && players[p].activeSpecial == "none")
		{
			if(players[p].onFloor && !players[p].crouched)
			{
				players[p].onFloor = false;
				let vel = b.GetLinearVelocity();
				vel.y = -stats.jump;
				b.SetLinearVelocity(vel);
			}
		}

		if(playerInputs[p][INPUT.CROUCH_ACTION] && players[p].activeSpecial == "none")
		{
			if(!players[p].crouched && players[p].onFloor)
			{
				players[p].crouched = true;
				players[p].animation += 2;
				swapFixture(p, playerCrouchFixtureDefs[players[p].stage]);
			}
		}
		else if(players[p].crouched)
		{
			players[p].crouched = false;
			players[p].animation -= 2;
			swapFixture(p, playerFixtureDefs[players[p].stage]);
		}

		if(playerInputs[p][INPUT.LEFT_ACTION] && players[p].activeSpecial != "faze_dash")
		{
			b.ApplyImpulse(new Vec2(-stats.accel, 0), b.GetWorldCenter());
			let vel = b.GetLinearVelocity();
			if(vel.x < -stats.speed)
				b.SetLinearVelocity(new Vec2(-stats.speed, vel.y));
			players[p].direction = -1;
			if(!players[p].walking && players[p].activeSpecial == "none")
			{
				players[p].walking = true;
				players[p].animation = players[p].animation | 1; 
			}
		}

		if(playerInputs[p][INPUT.RIGHT_ACTION] && players[p].activeSpecial != "faze_dash")
		{
			b.ApplyImpulse(new Vec2(stats.accel, 0), b.GetWorldCenter());
			let vel = b.GetLinearVelocity();
			if(vel.x > stats.speed)
				b.SetLinearVelocity(new Vec2(stats.speed, vel.y));
			players[p].direction = 1;
			if(!players[p].walking && players[p].activeSpecial == "none")
			{
				players[p].walking = true;
				players[p].animation = players[p].animation | 1;
			}
		}

		if(playerInputs[p][INPUT.INTERACT_ACTION] && players[p].specialDrain == 0)
		{
		// TODO: attempting to interact by pressing e, and an interaction
		//    taking place, both need modeled and one bool won't work..
		//    annoyingly I can't remember why now (:
			if(!players[p].interacting)
			{
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

			// Handle the players hunger stage changing on top of a pressure plate.
			let pressurePlate = players[p].pressurePlate; 
			if(pressurePlate > 0)
			{
				let target = worldState[pressurePlate].target;
				if(prevStage > players[p].stage)
				{
					deactivateEntity(target, prevStage - players[p].stage);
				}
				else
				{
					activateEntity(target, players[p].stage - prevStage);
				}
			}

			// Whatever stage we are in any specials won't be available to the new stage.
			players[p].specialDrain = 0;
			if(players[p].activeSpecial == "balloon")
			{
				balloonSpecial(p, false);
			}

			if(players[p].crouched)
				swapFixture(e, playerCrouchFixtureDefs[players[p].stage]);
			else
				swapFixture(e, playerFixtureDefs[players[p].stage]);

			let heightDiff = worldSettings.playerStats[players[p].stage].height - 
				worldSettings.playerStats[prevStage].height;
			let pos = entities[e].GetBody().GetPosition();
			pos.y += heightDiff / scale;
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
	let bufferu8 = new Uint8Array(data);
	let count = 0;
	for(let i = 0; i < 2; ++i)
	{
		bufferu8[i * 2] = players[i].hunger;
		bufferu8[i * 2] = bufferu8[i * 2] << 1;
		bufferu8[i * 2] += (players[i].direction + 2) % 3;
		bufferu8[i * 2 + 1] = players[i].animation;
	}

	buffer[2] = entities.length;
	bufferu8[1 + 2 * off] = soundBuffer.length;
	for(let i = 0; i < entities.length; ++i)
	{
		if(worldState[i].sendState)
		{
			if(worldState[i].state != cachedState[i])
			{
				buffer[off + 1 + count++] = (worldState[i].state << 12) + i;
				cachedState = worldState[i].state;
			}
		}
	}

	bufferu8[2 * off] = count;
	off += count + 1;
	count = 0;

	for(let i = 0; i < soundBuffer.length; ++i)
	{
		bufferu8[off * 2 + i] = soundBuffer[i];
	}

	off += Math.floor((soundBuffer.length + 1) / 2);
	
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

	soundBuffer = [];

	if(running)
		setTimeout(update, 1000 / tick_rate);
}

// This is used to disclude certain properties from
//    being sent to the client that they do not need.
// TODO: this may not be needed I will leave it here
//    though so if it is I hopefully remember!
const privatePropertyKeys = ["density"];

function createEntity(entityType, sparseProps, registerEntity = true)
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
	let filter = entity.GetFilterData();
	filter.categoryBits = props.categories;
	filter.maskBits = props.mask;
	filter.groupIndex = props.group;
	entity.SetFilterData(filter);

	if(!registerEntity)
		return entity;

	entities[entitiesHead] = entity;
	for(++entitiesHead; entitiesHead < entities.length; ++entitiesHead)
		if(entities[entitiesHead] === null) break;


	// Add new entity to world state
	let worldAngle = props.rotation * (65536 / 360);
	let clientEntity = {type: props.userData.type, state: 0, sendState: props.sendState};
	if(props.sendState)
	{
		++countStateObjects;
	}
	// We do this for all entities to keep the id's right,
	//    we're not too worried about RAM usage atm..
	cachedState.push(0);

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

	if(
		(u1.type == "player_balloon_collider" && u2.type != "player_balloon_collider") || 
		(u2.type == "player_balloon_collider" && u1.type != u1.type == "player_balloon_collider")
	)
	{
		let pId = (u1.type == "player_balloon_collider" ? u1 : u2).id;
		console.log("Collider count: " + ++players[pId].balloonColliderCount);
	}

	if((u1.type == "heavy_door" || u2.type == "heavy_door") && (u1.type == "heavy_door_stopper" || u2.type == "heavy_door_stopper"))
	{
		let doorId = (u1.type == "heavy_door" ? u1 : u2).index;
		let stopperId = (u1.type == "heavy_door" ? u2 : u1).index;
		let child = worldState[doorId].child;
		if(child > 0)
			entityStateChangeFunctions["heavy_door_mechanism"](child, 0, worldState[stopperId].opensDoor);
		soundBuffer.push(soundMap["heavy_door_sound"]);
	}

	if((u1.type == "player" || u2.type == "player") && (u1.type == "ladder" || u2.type == "ladder"))
	{
		let playerId = (u1.type == "player" ? u1 : u2).id;
		if(players[playerId].onLadder == 0 && players[playerId].activeSpecial != "balloon")
		{
			let b = entities[playerId].GetBody();
			b.m_force.y = -gravity.y * b.GetMass();
			let vel = b.GetLinearVelocity();
			vel.y = Math.min(0, vel.y);
			b.SetLinearVelocity(vel);
		}

		++players[playerId].onLadder;
	}

	if((u1.type == "player" || u2.type == "player") && 
		(u1.type == "floor_bound" || u2.type == "floor_bound" || u1.type == "floor" || u2.type == "floor"))
	{
		let playerId = (u1.type == "player" ? u1 : u2).id;
		let floorId = (u1.type == "player" ? u2 : u1).index;
		entities[playerId].GetBody().SetLinearVelocity( new Vec2(
			entities[playerId].GetBody().GetLinearVelocity().x, 0));

		if(entities[playerId].GetBody().GetPosition().y < entities[floorId].GetBody().GetPosition().y)
		{
			players[playerId].onFloor = true;
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
		console.log("Whoa");
	}
}
listener.EndContact = function(contact)
{
	let f1 = contact.GetFixtureA();
	let u1 = f1.GetUserData();
	let f2 = contact.GetFixtureB();
	let u2 = f2.GetUserData();

	if(
		(u1.type == "player_balloon_collider" && u2.type != "player_balloon_collider") || 
		(u2.type == "player_balloon_collider" && u1.type != u1.type == "player_balloon_collider")
	)
	{
		let pId = (u1.type == "player_balloon_collider" ? u1 : u2).id;
		console.log("Collider count: " + --players[pId].balloonColliderCount);
	}

	if((u1.type == "player" || u2.type == "player") &&
		(u1.type == "floor_bound" || u2.type == "floor_bound" || u1.type == "floor" || u2.type == "floor"))
	{
		let playerId = (u1.type == "player" ? u1 : u2).id;
		players[playerId].onFloor = false;
	}

	if((u1.type == "player" || u2.type == "player") && (u1.type == "ladder" || u2.type == "ladder"))
	{
		let playerId = (u1.type == "player" ? u1 : u2).id;
		--players[playerId].onLadder;
		if(players[playerId].onLadder == 0 && players[playerId].activeSpecial != "balloon")
		{
			let b = entities[playerId].GetBody();
			b.m_force.y = 0;
		}
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
listener.PreSolve = function(contact, oldManifold){}


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
	function statDrainFunction()
	{
		if(hungerEnabled)
		{
			for(let i = 0; i < 2; ++i)
			{
				modifyPlayerHunger(i, -worldSettings.hungerDrainAmount);
				if(players[i].specialDrain == 0)
				{
					if(players[i].specialSauce < 64)
						++players[i].specialSauce;
				}
				// Seems we don't need this but we might later..
				// else
				// {
				// 	players[i].specialSauce -= players[i].specialDrain;
				// 	if(players[i].specialSauce <= 0)
				// 	{
				// 		players[i].specialSauce = 0;
				// 		players[i].specialDrain = 0;
				// 		players[i].specialForceStop = true;
				// 	}
				// }
			}
		}
		setTimeout(statDrainFunction, worldSettings.statDrainPeriod);
	};
	statDrainFunction();
})();