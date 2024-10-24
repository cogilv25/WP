<?php
	session_start();
	require "database.php";
	
	//Validation
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

	$db = initializeDatabase();
	die(json_encode(insertScoreIfNewHighscore(initializeDatabase(), $score)));
?>