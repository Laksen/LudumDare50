<?php

session_start();

require("settings.php");

function is_logged_in() {
    return isset($_SESSION["login_id"]);
}

function get_user_id() {
    return $_SESSION["login_id"] ?? -1;
}

function get_username() {
    return $_SESSION["username"];
}

function do_login($username, $id) {
    $_SESSION["login_id"] = $id;
    $_SESSION["username"] = $username;
}

function log_out() {
    unset($_SESSION["login_id"]);
    unset($_SESSION["username"]);
}

function try_login($username, $password) {
    global $db_server, $db_username, $db_password, $db_database;

    $conn = new mysqli($db_server, $db_username, $db_password, $db_database);

    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    $username = $conn->real_escape_string($username);

    $sql = "SELECT id, username, password FROM users WHERE username = '$username';";
    $result = $conn->query($sql);

    $login_message = "";

    if ($result) {
        if ($result->num_rows > 0) {
            if ($row = $result->fetch_assoc()) {
                if (password_verify($password, $row["password"])) {
                    do_login($username, $row["id"]);
                }
            }
        } else {
            $login_message = "Username/password combination not found";
        }
    } else {
        $login_message = "Unexpected error during login";
    }

    $conn->close();

    return $login_message;
}

function try_create_account($username, $password) {
    global $db_server, $db_username, $db_password, $db_database;

    $conn = new mysqli($db_server, $db_username, $db_password, $db_database);

    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    $username_esc = $conn->real_escape_string($username);
    $password_esc = password_hash($password, PASSWORD_DEFAULT);

    $sql = "INSERT INTO users (username, password) VALUES ('$username_esc', '$password_esc')";

    $result = $conn->query($sql) == true;

    $conn->close();

    if ($result) {
        return try_login($username, $password);
    } else {
        return "Account already exists";
    }
}

function get_tracks($user_id) {
    global $db_server, $db_username, $db_password, $db_database;

    $conn = new mysqli($db_server, $db_username, $db_password, $db_database);

    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    $sql = "SELECT t.ID, t.Name, t.Phrase, s.username, s.Score as maxScore, max(s2.score) as maxPersonal FROM tracks AS t
                LEFT JOIN (SELECT min(s.ID) as ID, GROUP_CONCAT(u.username) as Username, s.Track, s.Score FROM scores AS s
                    LEFT JOIN (SELECT Track, MAX(Score) as maxscore FROM scores GROUP BY Track) s2 ON s2.Track = s.Track
                    JOIN users AS u ON u.ID = s.User
                    WHERE s2.maxscore = s.Score
                    GROUP BY s.Track) s ON s.Track = t.ID
                LEFT JOIN scores AS s2 ON (s2.Track = t.ID) AND (s2.User = $user_id)
                GROUP BY t.ID
                ORDER BY LENGTH(t.Phrase) ASC";
    $result = $conn->query($sql);

    $tracks = [];
    while ($row = $result->fetch_assoc()) {
        array_push($tracks, [$row["ID"], $row["Name"], $row["Phrase"], $row["maxScore"], $row["username"], $row["maxPersonal"]]);
    }

    $conn->close();

    return $tracks;
}

function get_track_info($track_id) {
    global $db_server, $db_username, $db_password, $db_database;

    $conn = new mysqli($db_server, $db_username, $db_password, $db_database);

    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    $track_id = $conn->real_escape_string($track_id);

    $sql = "SELECT Phrase FROM tracks WHERE ID = $track_id";
    $result = $conn->query($sql);

    $info = null;
    
    if ($row = $result->fetch_assoc()) {
        $info = $row["Phrase"]; 
    }

    $conn->close();

    return $info;
}

function submit_score($track_id, $score) {
    global $db_server, $db_username, $db_password, $db_database;

    $conn = new mysqli($db_server, $db_username, $db_password, $db_database);

    if ($conn->connect_error) {
        die("Connection failed: " . $conn->connect_error);
    }

    $track_id = $conn->real_escape_string($track_id);
    $user_id = get_user_id();
    $score = $conn->real_escape_string($score);

    $sql = "INSERT INTO scores (Track, User, Score, Mistypes) VALUES ($track_id, $user_id, $score, 0);";
    $result = $conn->query($sql) == true;

    $conn->close();

    return $result;
}
?>