"use strict"

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

var canvas2 = document.getElementById("canvas2");
var ctx2 = canvas2.getContext("2d");

function toggleCanvasDisplayed()
{
	canvas.classList.toggle("fadeIn")
	canvas2.classList.toggle("fadeIn")
	canvas.classList.toggle("fadeOut")
	canvas2.classList.toggle("fadeOut")
}

function setContinueButtonVisibility(visible)
{
	if(visible)
		mainMenu.buttons[0].classList.remove("hidden");
	else
		mainMenu.buttons[0].classList.add("hidden");
}

function showPopup()
{
	popupMenu.element.classList.add("fadeIn");
	popupMenu.element.classList.remove("fadeOut");
}

function setPopupHeading(heading)
{
	popupMenu.heading.textContent = heading;
}

function setPopupMessage(message)
{
	popupMenu.message.textContent = message;
}

function setPopupScore(score)
{
	popupMenu.score.textContent = score;
}

function showLoadingIndicator()
{
	loadingNode.classList.add("fadeIn");
	loadingNode.classList.remove("fadeOut");
}

function hideLoadingIndicator()
{
	loadingNode.classList.add("fadeOut");
	loadingNode.classList.remove("fadeIn");
}

function showPauseMenu()
{
	pauseMenu.open = true;
	menuContainer.classList.add("fadeIn");
	menuContainer.classList.remove("fadeOut");
	hudContainer.classList.add("hud_pause_menu");
	viewport.classList.add("viewport_dark");
}

function hidePauseMenu()
{
	menuContainer.classList.remove("fadeIn");
	menuContainer.classList.add("fadeOut");
	hudContainer.classList.remove("hud_pause_menu");
	viewport.classList.remove("viewport_dark");
	pauseMenu.open = false;
	gameUnPauseCallback();
}

function setHudScore(score)
{
	hudScore.textContent = "Score: " + score;
}

function setHudLevel(levelName, animate = true)
{
	hudLevel.textContent = levelName;
	if(animate)
		hudLevel.classList.add("hud_level_animation");
}

function setHudTime(time)
{
	hudTime.textContent = "Time: " + time;
}

function updateHealthBar(lives)
{
	for(let i = 0; i < 8; ++i)
    {
        let expected = (i < lives) ? "fadeIn" : "fadeOut";
        let opposite = (i < lives) ? "fadeOut" : "fadeIn";

        if(!hudLives.hearts[i].classList.contains(expected))
        {
            hudLives.hearts[i].classList.add(expected);
            hudLives.hearts[i].classList.remove(opposite);
        }
    }
}

function setUnPauseCallback(fun) { gameUnPauseCallback = fun; }
function setNewGameCallback(fun) { gameNewGameCallback = fun; }
function setContinueCallback(fun) { gameContinueCallback = fun; }
function setQuitGameCallback(fun) { gameQuitGameCallback = fun; }
function setMenuItemHoverCallback(fun) {gameMenuItemHoverCallback = fun; }
function setLevelAnimateCallback(fun) {gameLevelAnimateCallback = fun; }
function setPopupClosedCallback(fun) { gamePopupClosedCallback = fun; }

// Beyond this point is not intended for external use

var gameUnPauseCallback = () => {console.error("No un-pause callback provided use setUnPauseCallback");};
var gameContinueCallback = () => {console.error("No continue callback provided use setContinueCallback");};
var gameNewGameCallback = () => {console.error("No new game callback provided use setNewGameCallback");};
var gameQuitGameCallback = () => {console.error("No quit game callback provided use setQuitGameCallback");};
var gamePopupClosedCallback = () => {console.error("No popup closed callback provided use setPopupClosedCallback");};
var gameMenuItemHoverCallback = () => {};
var gameLevelAnimateCallback = () => {};

var viewport = document.getElementById("viewport");
var menuContainer = document.getElementById("menus");
var bigLoadingNode = document.getElementsByClassName("lds-spinner-big")[0];
var loadingNode = document.getElementById("loading");
var hudContainer = document.getElementById("hud");
var hudScore = document.getElementById("hud_score");
var hudLevel = document.getElementById("hud_level");
var hudTime = document.getElementById("hud_time");
var hudLives = {element: document.getElementById("healthbar"), hearts: []};

var masterVolumeSlider = document.getElementById("master_volume_slider");
var musicVolumeSlider = document.getElementById("music_volume_slider");

masterVolumeSlider.addEventListener("input", (e) =>
{
	createjs.Sound.volume = e.target.value / 100;
});

musicVolumeSlider.addEventListener("input", (e) =>
{
	bgMusicVolume = e.target.value / 100;
	if(bgMusicTrack != null)
		bgMusicTrack.volume = e.target.value / 100;
});

for (var i = 0; i < 8; ++i)
{
	hudLives.hearts[i] = document.getElementById("heart" + i);
}

hudLevel.addEventListener("animationend",() => 
{ 
	hudLevel.classList.remove("hud_level_animation");
	gameLevelAnimateCallback();
});

var mainMenu = {buttons:[]};
mainMenu.element = document.getElementById("menu_main");
for(var i = 0; i < 5; ++i)
{
	mainMenu.buttons[i] = document.getElementById("menu_main-button" + i);
	mainMenu.buttons[i].addEventListener("mouseenter", ()=>{gameMenuItemHoverCallback();});
}

var pauseMenu = {buttons:[], open:false};
pauseMenu.element = document.getElementById("menu_pause");
for(var i = 0; i < 4; ++i)
{
	pauseMenu.buttons[i] = document.getElementById("menu_pause-button" + i);
	pauseMenu.buttons[i].addEventListener("mouseenter", ()=>{gameMenuItemHoverCallback();});
}

var highscoreMenu = {list:[]};
highscoreMenu.element = document.getElementById("menu_scores");
highscoreMenu.backButton = document.getElementById("menu_scores-button0");
highscoreMenu.backButton.addEventListener("mouseenter", ()=>{gameMenuItemHoverCallback();});
for(var i = 0; i < 8; ++i)
{
	highscoreMenu.list[i] = {
		item: document.getElementById("menu_scores-item" + i),
		name: document.getElementById("menu_scores-name" + i),
		score: document.getElementById("menu_scores-score" + i)
	};
}

var settingsMenu = {list:[]};
settingsMenu.element = document.getElementById("menu_settings");
settingsMenu.backButton = document.getElementById("menu_settings-button0");
settingsMenu.backButton.addEventListener("mouseenter", ()=>{gameMenuItemHoverCallback();});

var popupMenu = {
	element: document.getElementById("popup"),
	heading: document.getElementById("popup-heading"),
	message: document.getElementById("popup-message"),
	okButton: document.getElementById("popup-button0"),
	score: document.getElementById("popup-score")
};

var currentMenu = mainMenu;

// Setup transition end event listeners 
mainMenu.element.addEventListener("transitionend", menuTransitionEndEvent);
highscoreMenu.element.addEventListener("transitionend", menuTransitionEndEvent);
settingsMenu.element.addEventListener("transitionend", menuTransitionEndEvent);
pauseMenu.element.addEventListener("transitionend", menuTransitionEndEvent);

function swapToAndInitHighscores()
{
	showLoadingIndicator();
	changeMenu(highscoreMenu)
	//Create the request.
    let request = new XMLHttpRequest();
    request.open('POST', "./backend/get_highscores.php", true);
    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    request.onreadystatechange = function()
    {
        // 4 == response ready.
        if(request.readyState != 4) return;

        // TODO: Proper error reporting
        if(request.status != 200)
            console.error(request.responseText);
        else
        {
        	let list = JSON.parse(request.responseText);
            for (let i = 0; i < 8; i++)
            {
            	if(i >= list.length)
            		highscoreMenu.list[i].item.classList.add("hidden");
            	else
            	{
            		highscoreMenu.list[i].item.classList.remove("hidden");
            		highscoreMenu.list[i].name.textContent = list[i][0];
            		highscoreMenu.list[i].score.textContent = list[i][1];
            	}

            }
        }
        hideLoadingIndicator();
    };
    request.send();
}

// Setup navigation buttons
mainMenu.buttons[2].addEventListener("click", () => { swapToAndInitHighscores(); });
mainMenu.buttons[3].addEventListener("click", () => { changeMenu(settingsMenu); });
pauseMenu.buttons[1].addEventListener("click", () => { swapToAndInitHighscores(); });
pauseMenu.buttons[2].addEventListener("click", () => { changeMenu(settingsMenu); });

highscoreMenu.backButton.addEventListener("click", () => 
	{ changeMenu(pauseMenu.open ? pauseMenu : mainMenu); });
settingsMenu.backButton.addEventListener("click", () => 
	{ changeMenu(pauseMenu.open ? pauseMenu : mainMenu); });

pauseMenu.buttons[0].addEventListener("click", hidePauseMenu);

// Setup Quit button
pauseMenu.buttons[3].addEventListener("click", () =>
{
	gameQuitGameCallback();
	changeMenu(mainMenu);
	pauseMenu.open = false;
	menuContainer.classList.remove("fadeIn");
	canvas2.classList.add("fadeOut");
	canvas2.classList.remove("fadeIn");
	hudContainer.classList.add("fadeOut");
	hudContainer.classList.remove("fadeIn");
	menuContainer.classList.remove("overlay");
	hudContainer.classList.remove("hud_pause_menu");
});

// Setup the Logout button
mainMenu.buttons[4].addEventListener("click",
	() => { window.location = "?action=logout"; });

// Setup the Continue button
mainMenu.buttons[0].addEventListener("click", () =>
{
	if(!gameReady) return;
	menuContainer.classList.add("fadeOut");
	mainMenu.element.classList.add("fadeOut");
	mainMenu.element.classList.remove("fadeIn");
	canvas2.classList.add("fadeIn");
	canvas2.classList.remove("fadeOut");
	hudContainer.classList.add("fadeIn");
	hudContainer.classList.remove("fadeOut");
	gameContinueCallback();
});

// Setup the New Game button
mainMenu.buttons[1].addEventListener("click", () =>
{
	if(!gameReady) return;
	menuContainer.classList.add("fadeOut");
	menuContainer.classList.remove("fadeIn");
	mainMenu.element.classList.add("fadeOut");
	mainMenu.element.classList.remove("fadeIn");
	canvas2.classList.add("fadeIn");
	canvas2.classList.remove("fadeOut");
	hudContainer.classList.add("fadeIn");
	hudContainer.classList.remove("fadeOut");
	gameNewGameCallback();
});

// Setup the ok button for the popup
popupMenu.okButton.addEventListener("click", () =>
{
	gamePopupClosedCallback();
	pauseMenu.open = false;
	changeMenu(mainMenu);
	menuContainer.classList.add("fadeIn");
	menuContainer.classList.remove("fadeOut");
	menuContainer.classList.remove("overlay");
	canvas2.classList.add("fadeOut");
	canvas2.classList.remove("fadeIn");
	hudContainer.classList.add("fadeOut");
	hudContainer.classList.remove("fadeIn");
	hudContainer.classList.remove("hud_pause_menu");
	window.setTimeout(()=>
	{
		popupMenu.element.classList.add("fadeOut");
		popupMenu.element.classList.remove("fadeIn");
	}, 400);
});

function menuTransitionEndEvent(e)
{
	if(e.target.classList.contains("fadeOut"))
	{
		e.target.classList.add("menu-hide");

		// Special case when pause menu is closed.
		if(currentMenu == pauseMenu && pauseMenu.open == false)
		{
			menuContainer.classList.add("overlay");
			return;
		}
		else if(currentMenu == mainMenu)
		{
			if(menuContainer.classList.contains("fadeOut"))
			{
				menuContainer.classList.add("overlay");
				hudContainer.classList.remove("hud_pause_menu");
				currentMenu = pauseMenu;
			}
		}

		currentMenu.element.classList.remove("menu-hide");
		currentMenu.element.classList.add("fadeIn");
		currentMenu.element.classList.remove("fadeOut");
	}
}

function changeMenu(newMenu)
{
	currentMenu.element.classList.remove("fadeIn");
	currentMenu.element.classList.add("fadeOut");
	currentMenu = newMenu;
}


// TODO: Menu Animation
// The Splash Screen and Menu animation
// -------------------------------------
// This could be done in a more structured way but it's only used once,
// although, admittedly, it would be easier to tweak if it was data-driven.
window.onload=
()=>
{
	bigLoadingNode.remove();
	document.body.classList.add("darken_bg");
	let splash = 
	[
		document.getElementById("splash1p1"),
		document.getElementById("splash1p2"),
		document.getElementById("splash1p3")
	];
	splash[0].classList.add("splash_fade_in");
	window.setTimeout(()=>
	{
		splash[1].classList.add("splash_fade_in");
		window.setTimeout(()=>
		{
			splash[2].classList.add("splash_fade_in");
			window.setTimeout(()=>
			{
				splash[2].classList.add("splash_fade_out");
				splash[2].classList.remove("splash_fade_in");
				window.setTimeout(()=>
				{
					splash[1].classList.add("splash_fade_out");
					splash[1].classList.remove("splash_fade_in");
					window.setTimeout(()=>
					{
						splash[0].classList.add("splash_fade_out");
						splash[0].classList.remove("splash_fade_in");
						mainMenu.element.classList.add("fadeIn");
						mainMenu.element.classList.remove("fadeOut");
					}, 1000);
				}, 500);
			},1000);
		},1000);
	},800);
};