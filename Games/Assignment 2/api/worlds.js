"use strict"
// We will make as many threads as we have logical cpus, if
//    there is no information on available cpus we make 4.
//    This dictates the maximum number of concurrent lobbies.
//    I have not stress tested this so it could be too many or,
//    more likely, far less than possible, although that would
//    also depend on the performance of the specific cpu...
const {Worker, isMainThread} = require('node:worker_threads');
const cpuInfo = require("node:os").cpus();
const threads = cpuInfo.length > 0 ? cpuInfo.length : 4;

// Messages
const INIT_COMPLETE = 0;
const START_GAME = 1;
const STOP_GAME = 2;
const INPUT = 3;
const UPDATE = 4;
const GET_STATE = 5;
const RESET = 6;

// World States
const WORLD_STATES =
{
	INVALID_WORLD: -1,
	WORLD_BUSY: 0,
	WORLD_IDLE: 1,
	WORLD_RUNNING: 2,
	WORLD_FULL: 3,
};
exports.WORLD_STATES = WORLD_STATES;

exports.ready = false;

var worlds = [];
var workerStatus = true;
var updateCallback = ()=>{};

var stateRequestID = 0;
var stateRequestCallbacks = [];

// We create the first thread and wait while it initializes.
//    when it completes if all is well we do the same for the
//    next thread until all threads are ready then call the
//    callback to return execution to the caller with the
//    number of threads and thus worlds created.
exports.initialize = function(workerData, callback)
{
	console.log("Starting " + threads + " Threads...");
	function initThread(i)
	{
		if(i == threads)
		{
			console.log("\nDone.\n");
			callback(threads);
			return;
		}

		let w = new Worker(__dirname + "/game_instance.js", {workerData: workerData});
		let index = -1;

		function tempMessageHandler(msg)
		{
			if(msg.type == INIT_COMPLETE)
			{
				w.off("message",tempMessageHandler);
				w.on("message", (m)=>{ handleWorkerMessage(w.threadId - 1,m); });
				worlds[index].state = WORLD_STATES.WORLD_IDLE;
				initThread(i + 1);
			}
		}

		w.on("message", tempMessageHandler);
		w.on("error", (m)=> { handleWorkerError(w.threadId, m); });
		worlds.push({state: WORLD_STATES.WORLD_BUSY, thread: w});
		index = worlds.length - 1;

		if(i > 0) process.stdout.write(" ");
		process.stdout.write(""+w.threadId);
	}
	initThread(0);
};

exports.getStatus = function(worldId)
{
	if(worldId < 0 || worldId > worlds.length) return WORLD_STATES.INVALID_WORLD;
	return worlds[worldId].state;
}

exports.setUpdateCallback = function(callback)
{
	updateCallback = callback;
};

exports.getWorldState = function(worldId, callback)
{
	if(worlds[worldId].state != WORLD_STATES.WORLD_RUNNING) return false;

	stateRequestCallbacks.push({id: stateRequestID, callback: callback});
	worlds[worldId].thread.postMessage({type: GET_STATE, id: stateRequestID++});
};

exports.sendInput = function(worldId, input)
{
	if(worlds[worldId].state != WORLD_STATES.WORLD_RUNNING) return false;

	worlds[worldId].thread.postMessage(
	{
		type: INPUT, 
		input: input
	});
};

exports.queueForWorld = function(players, callback)
{
	let worldId = -1;
	for(let i = 0; i < worlds.length; ++i)
	{
		if(worlds[i].state == WORLD_STATES.WORLD_IDLE)
		{
			worldId = i;
			break;
		}
	}

	if(worldId == -1)
	{
		//TODO: Queue System
		console.log("Unhandled condition: No worlds available");
		process.exit();
	}

	startWorld(worldId, players);
	callback(worldId);
}

exports.releaseWorld = function(worldId)
{
	resetWorld(worldId);
}

function startWorld(worldId, players)
{
	console.log("Starting World " + (worldId + 1));
	if(worlds[worldId].state != WORLD_STATES.WORLD_IDLE) return false;

	worlds[worldId].thread.postMessage({type: START_GAME, players:players});
	worlds[worldId].state = WORLD_STATES.WORLD_RUNNING;
	return true;
};

function stopWorld(worldId)
{
	if(worlds[worldId].state != WORLD_STATES.WORLD_RUNNING) return false;

	worlds[worldId].thread.postMessage({type: STOP_GAME});
	worlds[worldId].state = WORLD_STATES.WORLD_IDLE;
};

function resetWorld(worldId)
{
	if(worlds[worldId].state != WORLD_RUNNING && worlds[worldId].state != WORLD_IDLE) return false;

	worlds[worldId].thread.postMessage({type: RESET});
	worlds[worldId].state = WORLD_STATES.WORLD_BUSY;
};

function handleWorkerMessage(id, message)
{
	if(message.type == UPDATE)
	{
		updateCallback(id, message.entities);
	}
	else if (message.type == INIT_COMPLETE)
	{
		worlds[id].state = WORLD_STATES.WORLD_IDLE;
	}
	else if(message.type == GET_STATE)
	{
		console.log(stateRequestCallbacks);
		let index = stateRequestCallbacks.findIndex((a)=>{ return a.id === message.id });
		let callback = stateRequestCallbacks[index].callback;
		stateRequestCallbacks.splice(index, 1);
		console.log(callback); //Test Remove later
		callback(message.state);
	}
}

function handleWorkerError(id, message)
{
	console.error("\n\nFatal Error in thread " + id);
	console.error(message);
	process.exit();
}