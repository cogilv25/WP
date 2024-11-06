# Pang
## Getting Set Up
Go to comp-server.uhi.ac.uk/~21010093/WP1 for a working example. Alternatively:

- Set up a local WAMP/LAMP stack using MariaDB as the DB. Personally I used XAMPP on windows 10.
- Run the init script on your database.
- Point the server to the site directory as it's document root.
- If you set your server name to webprog.com it will bypass OAuth2 which is useful when running locally as you don't need to setup the whole
- Run the server.

## Playing the Game
### Objective
The objective of the game is to pop all the balloons as quickly as you can and complete all the levels, additionally getting the highest score on the leaderboard could be an objective, you get higher scores by completing the level quickly and preserving your lives

### Controls
- WASD or Arrow keys to move, you can go left and right, and climb ladders, you cannot jump.
- Space to fire your weapon.

## Features
- Multiple levels
- Win / lose conditions
- Splash screen
- CSS animations between menus and screens
- Loading indicator when fetching highscores
- Most of the sounds and images were created from scratch

## Third Party Assets
- Background music by [Abstraction](https://tallbeard.itch.io/music-loop-bundle)
- Backgrounds all came from CraftPix.net. Here is a list of links:
	- [Nature Backgrounds](https://craftpix.net/freebies/free-nature-pixel-backgrounds-for-games/)
	- [City Backgrounds](https://craftpix.net/freebies/free-city-backgrounds-pixel-art/)
	- [Nature Backgrounds](https://craftpix.net/freebies/4-free-seamless-nature-pixel-backgrounds/)
	- [Street Backgrounds](https://craftpix.net/freebies/free-pixel-art-street-2d-backgrounds/)
	- [Post-Apocalypse Backgrounds](https://craftpix.net/freebies/free-post-apocalyptic-pixel-art-game-backgrounds/)

- [Normalize.css](https://necolas.github.io/normalize.css/) was used to (hopefully) solve any styling differences between browsers (I used Chrome if you have problems).
- The loading spinner is from https://loading.io/css/ with some modifications made.