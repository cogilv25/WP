<?php
	session_start();
	require "database.php";
	
	 if(!isset($_SESSION['user']))
	 	setErrorAndDie($ERROR_LOGGED_OUT);

	//Validate score
	if(!isset($_POST['score']))
		setErrorAndDie($ERROR_MISSING_DATA);
	elseif(!is_numeric($_POST['score']))
		setErrorAndDie($ERROR_INVALID_DATA);

	$score = (int)$_POST['score'];

	if ($score < 0)
		setErrorAndDie($ERROR_INVALID_DATA);


	//Push new score to the database
	$db = initializeDatabase();

	$result = $db->query("
		INSERT INTO `highscore` (`user_id`,`score`) SELECT " . 
		$_SESSION['user'] . "," . $score . " WHERE " .
		$score . "> (SELECT COALESCE(MAX(`score`),0) from `highscore`)"
	);

	die($db->affected_rows > 0 ? "true" : "false");
?>