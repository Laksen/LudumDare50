<?php

require("stuff.php");

if (!is_logged_in()) {
    echo "Not logged in";
    header('Location: /ld50/index.php');
    die();
}

$track_id = $_GET["track"];

$info = get_track_info($track_id);

if ($info == "") {
    echo("Something went wrong getting track info");
    die();
}

$run_id = $track_id;
$run_word = $info;

?>
<!doctype html>
<html lang="en">
    <head>
        <meta http-equiv="Content-type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>LakseCounter 3000</title>
        <link rel="stylesheet" href="style.css"/>
        <script src="ld50.js"></script>
    </head>
    <body>
        <form hidden id="submit_form" action="submit_score.php" method="POST">
            <input type="hidden" name="run_id" value="<?= $run_id ?>"/>
            <input type="hidden" name="run_word" value="<?= $run_word ?>"/>
            <input type="hidden" name="run_score"/>
            <input type="hidden" name="run_sequence"/>
        </form>

        <canvas id="c" tabindex="1000"></canvas>
        <script>window.addEventListener("load", rtl.run);</script>
    </body>
</html>
