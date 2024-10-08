<?php
    session_start();

?>
<!DOCTYPE html>
<html>
    <head>
        <!-- External Dependencies -->
        <script src="./../Box2dWeb-2.1.a.3.min.js" defer></script>
        <script src="https://code.createjs.com/1.0.0/easeljs.min.js" defer></script>
        <script src="https://code.createjs.com/1.0.0/preloadjs.min.js" defer></script>

        <!-- API / "Engine" -->
        <script src="./js/api/definitions.js" defer></script>
        <script src="./js/api/engine.js" defer></script>
        <script src="./js/api/keyboard.js" defer></script>

        <!-- Game -->
        <script src="./js/game.js" defer></script>

        <title>
            Pang
        </title>
    </head>
    <body>
        <div style="display: flex; flex-direction: column; justify-content: space-around;">
            <div style="display: flex; flex-direction: row; justify-content: center;">
                <h1>Pang!</h1>
            </div>
            <div style="display: flex; flex-direction: row; justify-content: center;">
                <canvas id="canvas" width="800" height="600" style="width: 800px; height: 600px; background-color: #f0f0f0; margin-top: 50px;"></canvas>
            </div>
        </div>
    </body>
</html>