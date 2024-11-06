"use strict"
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const {Server} = require("socket.io");
const io = new Server(server);
const bcrypt = require("bcrypt");
const threadMan = require(__dirname + "/api/threads.js");


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
let worlds = [];
let lobbies = [];
let players = [];

// Maybe a game should contain a lobby and a world
//    this would let us put worlds and lobbies in
//    seperate modules that don't need to interact?
let games = [];

function initialize(threads)
{
	startServer();

	for(let i = 0; i < threads; ++i)
		worlds[i] = {state: WORLD_READY};

	threadMan.setUpdateCallback(updateClients);
}

function updateClients(worldId, update)
{
	let lobby = worlds[worldId].lobby;
	for(let i = 0; i < lobby.players.length; ++i)
	{
		if(lobby.players[i].connection)
		{
			lobby.players[i].connection.socket.emit("game_update", update);
		}
	}
}

function startServer()
{
	server.listen(8000, () =>
	{
		console.log("listening on *:8000");
	});
}

// TODO: When a client disconnects we should set a timer before their
//    player is removed from any lobbies they were in. Admin of a lobby
//    should be able to kick the inactive player before this though!


app.use(express.static(__dirname + "/public/"));

io.on("connection", (socket) =>
{
	console.log(socket.id + " connected");
	connections.push({id: socket.id, socket: socket});
	let lobbyList = [];
	for(let i = 0; i < lobbies.length; ++i)
		lobbyList.push({name: lobbies[i].name, players: lobbies[i].players.length});
	socket.emit("lobby_list", lobbyList);

	socket.on("disconnect", () =>
	{
		let index = connections.findIndex((a)=>{ return a.id===socket.id; });
		let lobby = connections[index].lobby;
		if(lobby)
		{
			// If last player remove the lobby
			// otherwise remove the player.
			if(lobby.players.length == 1)
			{
				console.log("Cleaning Up Lobby " + lobby.name);
				io.emit("lobby_dissolve", lobby.name);
				lobbies.splice(lobbies.findIndex(
					(a) => { return a === lobby; })
				, 1);
			}
			else
				lobby.players.splice(lobby.players.findIndex(
					(a)=> { return a.connection.id === socket.id; })
				, 1);
		}
		console.log(socket.id + " disconnected");
		connections.splice(index, 1);
	});

	socket.on("create_lobby", (name) => 
	{
		let index = connections.findIndex((a)=>{ return a.id===socket.id; });
		let connection = connections[index];

		if(connection.lobby)
		{
			socket.emit("invalid_lobby");
			return;
		}

		if(lobbies.findIndex((a)=>{ return a.name == name; }) >= 0)
		{
			socket.emit("invalid_lobby");
			return;
		}
		let world = -1;
		for(let i = 0; i < worlds.length; ++i)
		{
			if(worlds[i].state == WORLD_READY)
			{
				world = i;
				worlds[i].state = WORLD_RUNNING;
				break;
			}
		}
		console.log("Creating Lobby " + name);
		let lobby = {name: name, world: world, players: [{connection: connection}]};
		connection.lobby = lobby;
		console.log("user (" + connection.id + ") joined lobby " +  name);

		if(world >= 0)
		{
			console.log("Starting World " + (world + 1));
			threadMan.startWorld(world, []);
			worlds[world].lobby = lobby;
			threadMan.getWorldState(world, (state) => { socket.emit("joined_world", state); });
		}
		else
		{
			console.log("No Worlds Available, Joining Queue...");
		}

		lobbies.push(lobby);
		io.emit("lobby_created", {name: lobby.name, players: lobby.players.length});
	});

	socket.on("join_lobby", (name)=>
	{
		let index = lobbies.findIndex((a) => { return a.name == name })
		if(index < 0)
		{
			socket.emit("invalid_join");
			return;
		}
		let lobby = lobbies[index];
		if(lobby.players.length > 1)
		{
			socket.emit("invalid_join");
			return;
		}
		let connection = connections.find((a)=>{return a.id === socket.id});
		lobby.players.push({connection: connection});

		if(lobby.world >= 0)
			threadMan.getWorldState(lobby.world, (state) => { socket.emit("joined_world", state); });
		io.emit("lobby_update", {name: lobby.name, players: lobby.players.length});
	});

	socket.on("login", (details) =>
	{

	});

	socket.on("register", (details) =>
	{
		
	});
});


console.log("Initializing Server...");
let initialState = {gravity: {x: 0, y: 9.81}, TICK_RATE: 60, SCALE: 30};
threadMan.initializeThreads(initialState, initialize);