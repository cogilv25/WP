<?php
    declare(strict_types=1);
    require("backend/OAuth2.php");

    if(isset($_GET['action']))
        if($_GET['action'] == "logout")
            logout();
        
    $authd = attemptAuthorization();
?>
<!DOCTYPE html>
<html>
    <head>
        <!-- Normalize.css (MIT licence) https://necolas.github.io/normalize.css/ -->
        <link rel="stylesheet" href="normalize.css">

        <!-- Stylesheet -->
        <link rel="stylesheet" href="style.css">
        <?php if($authd) { ?>

        <!-- TODO: Maybe we should use some form of regenerating token -->
        <!--       here for security but the userID will do for now.. -->
        <!-- Pass the userID to javascript for localStorage retrieval -->
        <script>var userID = <?=$_SESSION['user']?>;</script>

        <!-- Flow control / Website -->
        <script src="./js/site.js" defer></script>

        <!-- External Dependencies -->
        <script src="./Box2dWeb-2.1.a.3.min.js" defer></script>
        <script src="https://code.createjs.com/1.0.0/easeljs.min.js" defer></script>
        <script src="https://code.createjs.com/1.0.0/preloadjs.min.js" defer></script>
        <script src="https://code.createjs.com/1.0.0/soundjs.min.js" defer></script>

        <!-- API / "Engine" -->
        <script src="./js/api/definitions.js" defer></script>
        <script src="./js/api/engine.js" defer></script>
        <script src="./js/api/level.js" defer></script>
        <script src="./js/api/keyboard.js" defer></script>
        <script src="./js/api/saveStore.js" defer></script>

        <!-- Game -->
        <script src="./js/game.js" defer></script>
        <?php } ?>

        <title>
            Pang
        </title>
    </head>
    <body class="disable_unwanted_interactions">
        <?php
            if($authd)
                require("game.php");
            else
                require("login.php");
        ?>
      <footer style="margin-top: 50px;display: flex; flex-direction: row; justify-content: center;">
        <p style="color: #fff; font-family: 'Spectral'; font-weight: normal; font-size: 18px;">&copy; 2024 Oblivious Proficiency</p>
      </footer>
    </body>
</html>