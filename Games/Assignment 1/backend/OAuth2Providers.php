<?php
	require("secrets.php");
	define('OAUTH2_PROVIDERS', [
		"Discord" => [
			"authURL" => "https://discord.com/api/oauth2/authorize",
			"tokenURL" => "https://discord.com/api/oauth2/token",
			"apiURL" => "https://discord.com/api/users/@me",
			"scope" => "identify",
			"client_id" => "1297607552858718300",
			"client_secret" => DISCORD_SECRET,
			"unique" => "id",
			"name" => "username",
			"avatar" => [ "https://cdn.discordapp.com/avatars/", "id", "/", "avatar", ".png" ]
		],

		"GitHub" => [
			"authURL" => "https://github.com/login/oauth/authorize",
			"tokenURL" => "https://github.com/login/oauth/access_token",
			"apiURL" => "https://api.github.com/user",
			"scope" => "user",
			"client_id" => "Ov23li6wBy8Ru9nZet7u",
			"client_secret" => GITHUB_SECRET,
			"unique" => "id",
			"name" => "login",
			"avatar" => [ "avatar_url" ]
		],

		"Google" => [
			"authURL" => "https://accounts.google.com/o/oauth2/auth",
			"tokenURL" => "https://accounts.google.com/o/oauth2/token",
			"apiURL" => "https://openidconnect.googleapis.com/v1/userinfo",
			"scope" => "profile email",
			"client_id" => "4876971280-b3ml2gsc7hjajfhu6chin7evlqrkcj9i.apps.googleusercontent.com",
			"client_secret" => GOOGLE_SECRET,
			"unique" => "sub",
			"name" => "name",
			"avatar" => [ "picture" ]
		],

		"Amazon" => [
			"authURL" => "https://www.amazon.com/ap/oa",
			"tokenURL" => "https://api.amazon.co.uk/auth/o2/token",
			"apiURL" => "https://api.amazon.co.uk/user/profile",
			"scope" => "profile",
			"client_id" => "amzn1.application-oa2-client.97d7eba8d75149caae4f4abe6356f334",
			"client_secret" => AMAZON_SECRET,
			"unique" => "user_id",
			"name" => "name",
			"avatar" => [ "./assets/oauth/default_profile.png" ]
		],

		"Test" => []
	]);
?>