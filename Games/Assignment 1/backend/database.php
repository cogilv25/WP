<?php
require_once("error_handling.php");


//TEMPORARY FOR TESTING
$_SESSION['user'] = 1;

function initializeDatabase()
{
	// Disables exceptions, errors can still be handled
    //   by checking the return value.
	mysqli_report(MYSQLI_REPORT_OFF);
	try
	{
		//$db = new mysqli("localhost","SH21010093","21010093","SH21010093");
		$db = new mysqli("localhost","root","","pang");
	}
	catch(Exception $e)
	{
		setErrorAndDie($ERROR_INTERNAL);
	}

	if($db == false)
		setErrorAndDie($ERROR_INTERNAL);

	if($db->connect_error)
		setErrorAndDie($ERROR_INTERNAL);

	
	return $db;
}
?>