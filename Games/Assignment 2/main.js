"use strict"
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const {Server} = require("socket.io");
const io = new Server(server);
const bcrypt = require("bcrypt");
const worlds = require(__dirname + "/api/worlds.js");
const clients = require(__dirname + "/api/clients.js");
const x = "";



// World States
const WORLD_BUSY = 0;
const WORLD_READY = 1;
const WORLD_RUNNING = 2;
const WORLD_FULL = 3;

// Player States
const PLAYER_OFFLINE = 0;
//    Main Menu
const PLAYER_ONLINE = 1;
//    Lobby
const PLAYER_IDLE = 2;
const PLAYER_READY = 3;
//    In A Game
const PLAYER_PLAYING = 4;
const PLAYER_DESYNC = 5;

//Lobby States
const LOBBY_EMPTY = 0;
const LOBBY_IDLE = 1;
const LOBBY_READY = 2;
const LOBBY_STARTED = 3;

let connections = [];
let lobbies = [];
let players = [];

// Maybe a game should contain a lobby and a world
//    this would let us put worlds and lobbies in
//    seperate modules that don't need to interact?
let games = [];

function initialize(stage = 0, threads)
{
	// Event driven is painful when you want
	//    procedural execution.
	if(stage == 0)
	{
		console.log("Initializing Server...");
		let initialState = { TICK_RATE: 60, SCALE: 30 };
		worlds.initialize(initialState, (t) => { initialize(1, t); } );
		return;
	}
	else if(stage == 1)
	{
		let callbacks = 
		[
			lobbyRequestWorld,
			lobbyReturnWorld,
			clientInitWorld,
			() => { initialize(2, threads); }
		];
		clients.initialize(callbacks, threads);
		return;
	}

	console.log("Starting Server...");
	startServer();

	worlds.setUpdateCallback(updateClients);
	console.log("Done.\n");
}

function updateClients(worldId, update)
{	
	let clientList = clients.clients[worldId];
	// This is normal in real world but I want to be notified while testing. Me later: is it?
	// TODO: Remove.
	if(clientList.length == 0)
		console.log("Temporary Error: No clients!?");

	for(let i = 0; i < clientList.length; ++i)
			clientList[i].emit("u", update);
}

function startServer()
{
	server.listen(8000, () =>
	{
		console.log("listening on *:8000");
	});
}

app.use(express.static(__dirname + "/public/"));

// This is passed as a callback to the clients module. When called
//    we will either immediately prepare a world if one is available
//    or enter the lobby into a queue and in either case call the 
//    callback once a world is ready for players in a paused state.
function lobbyRequestWorld(lobbyId, callback)
{
	;
	worlds.queueForWorld(clients.getPlayersInLobby(lobbyId), (worldId) => 
		{
			games.push({lobby: lobbyId, world: worldId});
			let clientList = clients.getClientsInLobby(lobbyId);
			callback(worldId);
		});
}

function lobbyReturnWorld(lobbyId)
{
	// TODO: If we do saving this might be where it would go..?
	let gameId = game.findIndex((a)=>{ return a.lobby == lobbyId; });
	if(gameId == -1)
	{
		console.log("Error: Lobby doesn't have a world to return!");
		return;
	}

	worlds.releaseWorld(worldId);
	games.splice(gameId, 1);
}

function clientInitWorld(worldId, callback)
{
	worlds.getWorldState(worldId, callback);
}

io.on("connection", (socket) =>
{
	let id = clients.newConnection(socket);
	socket.on("input", (data) => {
		let [playerId, worldId] = clients.getPlayerAndWorld(id);
		if(playerId === false)
			return;

		if(!(typeof data === "string" || data instanceof String)) return;

		data = data.charCodeAt() + (playerId * 64);
		worlds.handleInput(worldId, data);
	})
});

initialize();