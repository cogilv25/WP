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

// An array of arrays of clients for each world,
//    initialized in exports.initialize.
exports.clients = [];

// We require some callbacks
//    - 0 = request_world(lobbyId, callback)
//    - 1 = return_world(worldId)
//    - 2 = client_world_init(worldId, callback)
//    - 3 = init_complete()
exports.initialize = (callbacks, worlds, path = "data/") =>
{
	requestWorld = callbacks[0];
	returnWorld = callbacks[1];
	clientWorldInit = (worldId, socket) => 
		{ 
			callbacks[2](worldId, (state) =>
			{
				socket.emit("joined_world", state);
			}); 
		};
	for (let i = 0; i < worlds; ++i)
	{
		exports.clients[i] = [];
	}

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
			saveAccounts(callback[3]);
		}
		else
		{
			accounts = JSON.parse(data);
			console.log("Done.\n");
			callbacks[3]();
		}
	});
};

exports.getPlayerAndWorld = (connectionId) =>
{
	let accountId = connections[connectionId].account;
	if(accountId == null) return [false, false];

	let playerId = accounts[accountId].player;
	if(playerId !== 0 && playerId !== 1)
		return [false, false];

	return [playerId, lobbies[accounts[accountId].lobby].world];
};



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
	let accountId = -1;
	let lobbyId   = -1;
	let playerId  = -1;

	console.log(socket.id + " connected, assigned internal id {" + connectionId + "}");

	// Simple function that emits an error message to the client
	//    and returns the condition, compresses validation logic.
	function emitErrorIf(condition, error, message)
	{
		if(condition)
			socket.emit(error, message);

		return condition;
	}

	// We use indexs in arrays as IDs quite often so need them to be 
	//    constant for the lifetime of the entry in the array. We
	//    find an empty slot in the array to reduce fragmentation.
	function findSlot(arr)
	{
		for(let i = 0; i < arr.length; ++i)
			if(arr[i] === null) return i;
		return arr.length;
	}

	function validateLoginDetails(details, exists)
	{
		if(emitErrorIf(details.username == null || details.password == null, "invalid_login",
			"No username or password provided.")) return false;

		if(emitErrorIf(details.username.length < 5 || details.password.length < 5, "invalid_login",
			"Username and password must both be at least 5 characters long.")) return false;

		let index = accounts.findIndex((a)=>{ return a.username == details.username; });
		if(emitErrorIf((index != -1) != exists, "invalid_login",
			exists ? "Account does not exist." : "Username is already taken.")) return false;

		return index;
	}

	function validateLobby(name, exists)
	{
		if(emitErrorIf(name == null || name.length < 5 || name.length > 20,
			"invalid_lobby", "Name must be at least 5 characters.")) return false;

		let index = lobbies.findIndex((a)=>{ return a.name == name; });
		if(emitErrorIf((index != -1) != exists, "invalid_lobby",
			exists ? "Lobby doesn't exist." : "Lobby name is already taken.")) return false;

		return index;
	}

	socket.on("disconnect", () =>
		{
			if(accountId != -1)
			{
				if(playerId != -1)
				{
					let worldId = lobbies[lobbyId].world;
					let index = exports.clients[worldId].findIndex((a)=>{ return a.id == socket.id });
					if(index != -1) 
						exports.clients[worldId].splice(index, 1);
				}
			}
			connections[connectionId] = null;
			// TODO: Set timer for reconnect or delete
			//     any associated player.
			console.log("{" + connectionId + "} disconnected");
		});
	
	socket.on("login", (details) =>
		{
			if(emitErrorIf(accountId != -1, "invalid_login", "Already logged in"))
				return;

			let aId = validateLoginDetails(details, true);
			if( aId === false) return;

			bcrypt.compare(details.password, accounts[aId].password).then((result) =>
				{
					if(emitErrorIf(!result, "invalid_login", "Wrong password!")) return;

					accountId = aId;
					connections[connectionId].account = aId;
					console.log("{" + connectionId + "} logged in as " + accounts[aId].username);

					if(accounts[accountId].player == null)
						socket.emit("logged_in", lobbies);
					else
					{
						let lId = accounts[accountId].lobby;
						if(lobbies[lId] == null)
						{
							accounts[accountId].lobby = null;
							accounts[accountId].player = null;
							return;
						}
						lobbyId = lId;
						playerId = accounts[accountId].player;
						exports.clients[lobbies[lobbyId].world].push(socket);
						clientWorldInit(lobbies[lobbyId].world, socket);
					}
				});
		});
	socket.on("register", (details) =>
		{
			if(emitErrorIf(accountId != -1, "invalid_login", "Already logged in"))
				return;

			if(validateLoginDetails(details, false) === false) return;

			bcrypt.hash(details.password, 10, (err, hash) => 
				{
					if(!emitErrorIf(err != null, "invalid_login", "Internal error!"))
					{
						aId = findSlot(accounts);
						accounts[aId] = {username: details.username, password: hash};
						saveAccounts((status) =>
							{
								if(emitErrorIf(!status, "invalid_login", "Internal error!"))
								{
									accounts[aId] = null;
									return;
								}

								accountId = aId;
								connections[connectionId].account = aId;
								console.log("New user registered: " + details.username);
								connections[connectionId].socket.emit("logged_in", lobbies);
							});
					}
					
				});
		});

	socket.on("create_lobby", (name) =>
		{
			if(emitErrorIf(accountId == -1, "unauthorized",
				"You need to be logged in to do that")) return;

			if(emitErrorIf(accounts[accountId].player != null, "invalid_lobby",
				"You can only join 1 lobby at a time!")) return;

			if(validateLobby(name, false) === false) return;

			lobbyId = findSlot(lobbies);

			lobbies[lobbyId] = {name: name, players:[0]};
			accounts[accountId].player = 0;
			accounts[accountId].lobby = lobbyId;

			for(let i = 0; i < connections.length; ++i)
			{
				if(connections[i].account != null)
				{
					connections[i].socket.emit("lobby_created", lobbies[lobbyId]);
				}
			}
			requestWorld(lobbyId, (worldId) => 
				{ 
					lobbies[lobbyId].world = worldId;
					exports.clients[worldId] = [socket];
					clientWorldInit(worldId, socket);
				});
		});

	socket.on("join_lobby", (name) =>
		{
			if(emitErrorIf(accountId == -1, "unauthorized",
				"You need to be logged in to do that")) return;

			if(emitErrorIf(accounts[accountId].player != null, "invalid_lobby",
				"You can only join 1 lobby at a time!")) return;

			lobbyId = validateLobby(name, true);	
			if(lobbyId === false) return;

			playerId = lobbies[lobbyId].players.length;
			lobbies[lobbyId].players.push(playerId);
			accounts[accountId].player = playerId;
			accounts[accountId].lobby = lobbyId;

			worldId = lobbies[lobbyId].world;
			if(worldId != null)
			{
				exports.clients[worldId].push(socket);
				clientWorldInit(lobbies[lobbyId].world, socket);
			}

		});
	// Register Events for:
	// Join Lobby
	// Leave Lobby
	// Ready Up
	return connectionId;
};

// Allows the server to kick a lobby from a world.
exports.revokeWorldAccess = (lobbyId) =>
{

};

exports.getClientsInLobby = (lobbyId) =>
{
	return exports.clients[lobbies[lobbyId].world];
};

exports.getPlayersInLobby = (lobbyId) =>
{
	return lobbies[lobbyId].players;
};

exports.addPlayerToLobby = (lobbyId) =>
{
	if(lobbies[lobbyId].players.length > 1)
		return false;
	lobbies[lobbyId].players
};

exports.removePlayerFromLobby = (lobbyId, pid) =>
{
	let index = lobbies[lobbyId].players.findIndex((a)=>{ return a.id == pid; })
	lobbies[lobbyId].players.splice(index, 1);
};

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

// Saving accounts while a game is in progress will cause issues...
//    the playerId will be saved then when the accounts are loaded
//    and that user logs in it will try to attach them to that player
//    who could exist and be some other random player or could not
//    exist most likely crashing the server somewhere..
// TODO: Fix this
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