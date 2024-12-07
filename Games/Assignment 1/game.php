<?php if(str_contains($_SERVER['PHP_SELF'], "/game.php")) die(); ?>
<div style="display: flex; flex-direction: column; justify-content: space-around;">
    <div style="display: flex; flex-direction: row; justify-content: center;">
        <div id="viewport" style="position: relative; width: 800px; height: 600px;">
            <img id="splash1p1" class="splash splashp1" src="./assets/splash1part1.png">
            <img id="splash1p2" class="splash splashp2" src="./assets/splash1part2.png">
            <img id="splash1p3" class="splash splashp3" src="./assets/splash1part3.png">
            <div id="flash_text_container"><span id="flash_text">Default</span></div>
            <canvas id="canvas" class="canvas fadeOut" width="800" height="600"></canvas>
            <canvas id="canvas2" class="canvas fadeOut" width="800" height="600"></canvas>
            <div id="hud" class="fadeOut">
                <div class="hud_row">
                    <div id="healthbar">
                        <img id="heart0" src="./assets/heart.png">
                        <img id="heart1" src="./assets/heart.png">
                        <img id="heart2" src="./assets/heart.png">
                        <img id="heart3" src="./assets/heart.png">
                        <img id="heart4" src="./assets/heart.png">
                        <img id="heart5" src="./assets/heart.png">
                        <img id="heart6" src="./assets/heart.png">
                        <img id="heart7" src="./assets/heart.png">
                    </div>
                </div>
                <div class="hud_row">
                    <div class="hud_element" id="hud_score">Score: 0</div>
                    <div class="hud_element" id="hud_level">Level 0</div>
                    <div class="hud_element" style="width: 155px;" id="hud_time">Time: 1000</div>
                </div>
            </div>
            <div id="popup" class="fadeOut">
                <div style="display: flex; flex-direction: row; justify-content: center;">
                    <h1 id="popup-heading" class="heading">You Lost!</h1>
                </div>
                <div id="popup-message">message</div>

                <div style="display: flex; flex-direction: row; justify-content: center;">
                    <div id="popup-score" class="score_1">1241254154</div>
                </div>
                <button id="popup-button0" class="menu_button">Ok<hr></button>
            </div>
            <div id ="menus">
                <!-- This is the small loading indicator -->
                <div id="loading" class="loading fadeOut"><div class="loading_text">Loading</div><div><div class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div></div>

                <!-- This is the large loading indicator -->
                <div class="lds-spinner-big"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>

                <div id="menu_main" class="menu fadeOut" style="display: flex; flex-direction: column;">
                    <div style="display: flex; flex-direction: row; justify-content: center;">
                        <h1 class="heading title"><span>Pang</span></h1>
                    </div>
                    <button class="menu_button hidden" id="menu_main-button0" type="button">Continue<hr></button>
                    <button class="menu_button" id="menu_main-button1" type="button">New Game<hr></button>
                    <button class="menu_button" id="menu_main-button2" type="button">Highscores<hr></button>
                    <button class="menu_button" id="menu_main-button3" type="button">Settings<hr></button>
                    <button class="menu_button" id="menu_main-button4" type="button">Logout <hr></button>
                </div>
                <div id="menu_pause" class="menu fadeOut menu-hide" style="display: flex; flex-direction: column;">
                    <div style="display: flex; flex-direction: row; justify-content: center;">
                        <h1 class="heading title"><span>Paused</span></h1>
                    </div>
                    <button class="menu_button" id="menu_pause-button0" type="button">Continue<hr></button>
                    <button class="menu_button" id="menu_pause-button1" type="button">Highscores<hr></button>
                    <button class="menu_button" id="menu_pause-button2" type="button">Settings<hr></button>
                    <button class="menu_button" id="menu_pause-button3" type="button">Quit<hr></button>
                </div>
                <div id="menu_scores" class="menu fadeOut menu-hide" style="display: flex; flex-direction: column;">
                    <div style="display: flex; flex-direction: row; justify-content: center;">
                        <h1 class="heading">Highscores</h1>
                    </div>
                    <div style="display: flex; flex-direction: row; justify-content: center;">
                        <ul style="width: 85%; list-style-type: none; padding: 0; margin: -20px 25px 10px 25px; align-items: center;">
                            <li id="menu_scores-item0" class="score_row score_1">
                                <h3 id="menu_scores-name0"></h3>
                                <h3 id="menu_scores-score0"></h3>
                            </li>
                            <li id="menu_scores-item1" class="score_row score_2">
                                <h3 id="menu_scores-name1"></h3>
                                <h3 id="menu_scores-score1"></h3>
                            </li>
                            <li id="menu_scores-item2" class="score_row score_3">
                                <h3 id="menu_scores-name2"></h3>
                                <h3 id="menu_scores-score2"></h3>
                            </li>
                            <li id="menu_scores-item3" class="score_row score">
                                <h3 id="menu_scores-name3"></h3>
                                <h3 id="menu_scores-score3"></h3>
                            </li>
                            <li id="menu_scores-item4" class="score_row score">
                                <h3 id="menu_scores-name4"></h3>
                                <h3 id="menu_scores-score4"></h3>
                            </li>
                            <li id="menu_scores-item5" class="score_row score">
                                <h3 id="menu_scores-name5"></h3>
                                <h3 id="menu_scores-score5"></h3>
                            </li>
                            <li id="menu_scores-item6" class="score_row score">
                                <h3 id="menu_scores-name6"></h3>
                                <h3 id="menu_scores-score6"></h3>
                            </li>
                            <li id="menu_scores-item7" class="score_row score">
                                <h3 id="menu_scores-name7"></h3>
                                <h3 id="menu_scores-score7"></h3>
                            </li>
                        </ul>
                    </div>
                    <hr style="width: 85%">
                    <button id="menu_scores-button0" class="menu_button">Back<hr></button>
                </div>
                <div id="menu_settings" class="menu fadeOut menu-hide" style="display: flex; flex-direction: column;">
                    <div style="display: flex; flex-direction: row; justify-content: center;">
                        <h1 class="heading">Settings</h1>
                    </div>
                    <div class="slider_box">
                        <div>Music Volume:</div>
                        <input type="range" min="0" max="100" value="15" class="slider" id="music_volume_slider">
                        <div>Master Volume:</div>
                        <input type="range" min="0" max="100" value="100" class="slider" id="master_volume_slider">
                    </div>
                    <button id="menu_settings-button0" class="menu_button" style="margin-top: 210px;">Back<hr></button>
                </div>
            </div>
        </div>
    </div>
</div> 