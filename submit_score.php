<?php

require("stuff.php");

$run_id = $_POST["run_id"];
$run_word = $_POST["run_word"];
$run_score = $_POST["run_score"];
$run_sequence = $_POST["run_sequence"];

if (submit_score($run_id, $run_score)) {
    header('Location: /ld50/index.php');
} else {
    echo "Something went wrong while submitting scores. Report as bug!";
}

?>