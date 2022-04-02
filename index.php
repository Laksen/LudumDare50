<?php

require("stuff.php");

$login_message = "";

if ($_POST["create_acct"] == "Create account") {

    $login_message = try_create_account($_POST["username"], $_POST["password"]);
}
else if ($_POST["login"] == "Login") {
    $login_message = try_login($_POST["username"], $_POST["password"]);
}
else if ($_POST["logout"] == "logout") {
    log_out();
}
?>
<html>
    <head>
        <title>LakseCounter 3000</title>
        <link rel="stylesheet" href="style.css"/>
    </head>
    <body>
        <div class="main_div">
            <h1 style="text-align: center;">Laksecounter 3000</h1>
<?php
if (!is_logged_in()) {
?>
            <div id="login_box" class="centered">
                <form method="POST">
                    <table>
                        <tr><td><label for="username" style="text-align: right;">Username:</label></td><td><input type="text"     id="username" name="username"></td></tr>
                        <tr><td><label for="password" style="text-align: right;">Password:</label></td><td><input type="password" id="password" name="password"></td></tr>
                        <tr><td colspan="2"><div style="text-align: center;"><input name="login" type="submit" value="Login"><input name="create_acct" type="submit" value="Create account" style="margin-left: 10px"></div></td></tr>
<?php if ($login_message != "") { ?>
                        <tr><td colspan="2"><div style="text-align: center; color: red"><?= $login_message ?></div></td></tr>
<?php } ?>
                    </table>
                </form>
            </div>
<?php
} else {
?>
<form method="POST" id="logout-frm"><input type="hidden" name="logout" value="logout"/></form>
<p class="centered">Hello <?= get_username() ?> <a href="javascript:void(0);" onclick="document.getElementById('logout-frm').submit()">Log out</a></p>
<?php
}
?>

<h2>How to play</h2>
<p class="centered" style="text-align: center;">
The goal of LakseCounting is to type a word or short phrase as many times as humanly possible in <b>20 seconds</b>.<br/>
As always the goal is to be the fastest<br/>
<br/>
However, as you type it goes into a buffer and as soon as the word appears that appearance is removed from the buffer and counted as a correct entry.<br/>
<br/>
You cannot remove characters from the buffer.
</p>

<h1>Tracks</h1>

<table style="width: 100%">
    <thead>
        <tr><td>Track</td><td>Champ</td><td>Highscore</td><td>Your score</td></tr>
    </thead>
<?php
$tracks = get_tracks(get_user_id());

foreach ($tracks as $track) {
    $link = "/ld50/game.php?track=" . $track[0];
    echo "<tr><td><a href='$link'>" . $track[1] . "</a></td><td>" . $track[4] . "</td><td>" . $track[3] . "</td><td>" . $track[5] . "</td></tr>";
}
?>
</table>
        </div>
    </body>
</html>
