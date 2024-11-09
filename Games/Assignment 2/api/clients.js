// -------------------------------------------
// Clients Module
// -------------------------------------------
// Deals with client based logic:
// - connections
// - accounts
// - players
// --------------------------------------------

// --------------------------------------------
// Dependencies
// --------------------------------------------

const fs = require("fs");
const bcrypt = require("bcrypt");

// --------------------------------------------
// Public Interface
// --------------------------------------------

exports.ready = false;

// We require callbacks to request a world for a lobby,
//    return worlds when lobbies disband and for returing
//    control to the main app after we initialize:
//    - 0 = request_world(lobbyId, callback)
//    - 1 = return_world(worldId)
//    - 2 = init_complete()
exports.initialize = (callbacks, path = "data/") =>
{
	requestWorld = callbacks[0];
	returnWorld = callbacks[1];

	console.log("Loading accounts...");
	// Arbitrary extension because it is
	//     "totally not storing passwords"
	accFilePath = path + "account.tnsp";
	fs.readFile(accFilePath, (err, data) =>
	{
		// We will just create the file if there's
		//    an error.. there are some edge cases
		//    where this would be bad but it won't
		//    matter for us.
		if(err != null)
		{
			console.error("Error loading accounts file.");
			console.error("Assuming no file exists and creating file...")
			saveAccounts(callback[2]);
		}
		else
		{
			accounts = JSON.parse(data);
			console.log("Accounts Loaded");
			callbacks[2]();
		}
	});
}

// This function creates the new connection, handles
//    input validation and registers callbacks for all
//    the client related messages we might receive over
//    the socket.
exports.newConnection = (socket) =>
{
	let connectionId = 0;
	for(; connectionId < connections.length + 1; ++connectionId)
	{
		if(connections[connectionId] == null)
			break;
	}
	connections[connectionId] = {socket: socket};

	// Returns true or a string with an error.
	function validateLoginDetails(details)
	{
		if(details.username == null || details.password == null)
		{
			return "No username or password provided.";
		}
		if(details.username.length < 5 || details.password.length < 5)
		{
			return "Username and password must both be at least 5 characters long.";
		}

		return true;
	}

	// TODO: does this function have the scope above..? Do I need to pass socket..?
	function authenticate(actionFunction, details)
	{
		if(connections[connectionId].account != null)
		{
			socket.emit("invalid_login", "Already logged in!");
			return;
		}
		let validDetails = validateLoginDetails(details);
		if(validDetails !== true) 
			socket.emit("invalid_login", validDetails);
		else
			actionFunction(connectionId, details.username, details.password);
	}

	socket.on("disconnect", () =>
		{
			let accountId = connections[connectionId].account;
			if(accountId != null)
			{
				let playerId = accounts[accountId].player;
				if(playerId != null)
					players[playerId].connection = null;
			}
			connections[connectionId] = null;
			// TODO: Set timer for reconnect or delete
			//     any associated player.
		});
	
	socket.on("login", (details) =>
		{
			authenticate(attemptLogin, details);
		});
	socket.on("register", (details) =>
		{
			authenticate(attemptRegister, details);
		});
	socket.on("create_lobby", (name)=>
		{
			let accId = connections[connectionId].account;
			if(accId == null)
			{
				sockets.emit("invalid_lobby", "You need to be logged in to create a lobby!");
				return;
			}
			if(accounts[accId].player != null)
			{
				socket.emit("invalid_lobby", "Already in a lobby!");
				return;
			}

			if(name == null || name.length < 5 || name.length > 20)
			{
				socket.emit("invalid_lobby", "Name must be at least 5 characters.")
				return;
			}
			
			let index = lobbies.findIndex((a)=>{ return a.name == name; });
			if(index != -1)
			{
				socket.emit("invalid_lobby", "Lobby name is already taken.")
				return;
			}

			// TODO: We do this in a few places we should make a function
			//    and we can explain why: We need the index to be constant
			//    for the lifetime of the player in this case and splice
			//    moves items about.
			let playerId = 0;
			for(; playerId < lobbies.length + 1; ++playerId)
				if(lobbies[playerId] == null) break;

			let lobbyId = 0;
			for(; lobbyId < lobbies.length + 1; ++lobbyId)
				if(lobbies[lobbyId] == null) break;

			lobbies[lobbyId] = {name: name, players:[playerId]};
			players[playerId] = {lobby: lobbyId, connection: connectionId};
			accounts[accId].player = playerId;
			connections[connectionId].player = playerId;

			for(let i = 0; i < connections.length; ++i)
			{
				if(connections[i].account != null)
				{
					connections[i].socket.emit("lobby_created", lobbies[lobbyId]);
				}
			}
			requestWorld(lobbyId, () => {  });
		});
	// Register Events for:
	// Create Lobby
	// Join Lobby
	// Leave Lobby
	// Ready Up
	return connectionId;
}

// Allows the server to kick a lobby from a world.
exports.revokeWorldAccess = (worldId) =>
{

}

exports.getClientsInLobby = (lobbyId) =>
{
	let clients = [];
	for(let i = 0; i < lobbies[lobbyId].players.length; ++i)
	{
		let playerId = lobbies[lobbyId].players[i];
		let connectionId = players[playerId].connection;
		console.log("The connection Id is: " + connectionId);
		if(connectionId != null)
		{
			clients.push(connections[connectionId].socket);
		}
	}
	return clients;
}

exports.getPlayersInLobby = (lobbyId) =>
{
	return lobbies[lobbyId].players;
}

exports.addPlayerToLobby = (lobbyId) =>
{
	if(lobbies[lobbyId].players.length > 1)
		return false;
	lobbies[lobbyId].players
}

exports.removePlayerFromLobby = (lobbyId, pid) =>
{
	let index = lobbies[lobbyId].players.findIndex((a)=>{ return a.id == pid; })
	lobbies[lobbyId].players.splice(index, 1);
}

exports.createLobby = (lobbyName, lobbyReadyCallback) =>
{

}

// --------------------------------------------
// Private Implementation
// --------------------------------------------

// Physical connections to the server, these may
//    or may not be associated with a player and
//    account.
var connections = [];

// The accounts array stores usernames and
//    hashed passwords using bcrypt. This 
//    probably isn't super secure but I
//    thought it's probably good enough
//    considering all we are storing is
//    arbitrary usernames and hashed passwords.
var accounts = [];

// This is linked to an account, it is the 
//    entity associated with a lobby, this
//    makes desync problems easier to deal with
//    while seperating the account details from
//    the lobby so we can send un-processed
//    lobbies to clients with reduced security
//    concerns. 
var players = [];

// This is a group of players who may or may
//    or may not be currently playing a game
//    this enables queueing for an available
//    world.
var lobbies = [];

// The full path of the accounts file.
var accFilePath;

// These are given to the module by the main application to
//    allow it to request worlds for lobbies and return them
//    when play concludes. We do not actually handle the
//    worlds that is done by the worlds module.
var requestWorld = () => { console.error("requestWorld has not been overridden!"); };
var returnWorld = () => { console.error("returnWorld has not been overridden!"); };

function saveAccounts(callback = ()=>{})
{
	fs.writeFile(accFilePath, JSON.stringify(accounts), (err) => 
		{
			if(err == null)
				console.log("Accounts File Saved!")
			else
			{
				console.error("Error Saving Accounts File:");
				console.error(err);
			}
			callback(err == null);
		});
}

function attachConnectionToActivePlayer(cId)
{
	let playerId = accounts[connections[cId].account].player;
	if(playerId == null) return;
		
	players[playerId].connection = cId;
}

function attemptLogin(cId, username, password)
{
	let index = accounts.findIndex((a)=>{ return a.username == username; });
	if(index < 0) return "No account with that username exists, please check your username or create an account!";

	bcrypt.compare(password, accounts[index].password).then((result) =>
		{
			if(!result)
			{
				connections[cId].socket.emit("invalid_login", "Wrong password entered, please try again!");
				return;
			}

			connections[cId].account = index;
			console.log("User \"" + username + "\" Logged in");
			connections[cId].socket.emit("logged_in", lobbies);
			attachConnectionToActivePlayer(cId);
		});
}

function attemptRegister(cId, username, password)
{
	let index = accounts.findIndex((a)=>{ return a.username == username; });
	if(index >= 0) return "That username is taken, if you have already created an account try logging in!";

	bcrypt.hash(password, 10, (err, hash) => 
		{
			if(err != null)
			{
				// Hopefully we never get here!
				connections[cId].socket.emit("invalid_login", "Unknown error, please try again later!");
				return;
			}
			let index = 0;
			for(; index < accounts.length + 1; ++index)
				if(accounts[index] === null) break;

			accounts[index] = {username: username, password: hash};
			saveAccounts((status) =>
				{
					if(status)
					{
						connections[cId].account = index;
						console.log("User \"" + username + "\" Registered");
						connections[cId].socket.emit("logged_in", lobbies);
						attachConnectionToActivePlayer(cId);
						return;
					}
					else
					{
						// Again hopefully we don't get here!
						connections[cId].socket.emit("invalid_login", "Unknown Error, please try again later!");
						// We have to splice out the record we added to accounts!
						accounts[index] = null;
					}

				});
		});
}