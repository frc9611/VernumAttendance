String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}
function secondsToDuration(seconds) {
    const units = [
        { label: "y", value: 31536000 }, // 1 year = 365 * 24 * 60 * 60 seconds
        { label: "m", value: 2592000 },  // 1 month = 30 * 24 * 60 * 60 seconds
        { label: "d", value: 86400 },    // 1 day = 24 * 60 * 60 seconds
        { label: "h", value: 3600 },     // 1 hour = 60 * 60 seconds
        { label: "m", value: 60 },       // 1 minute = 60 seconds
        { label: "s", value: 1 }         // 1 second
    ];

    let remainingSeconds = seconds;
    let result = [];

    for (const unit of units) {
        const count = Math.floor(remainingSeconds / unit.value);
        if (count > 0) {
            result.push(`${count}${unit.label}`);
            remainingSeconds %= unit.value;
        }
    }

    return result.join(" ");
}
const vernumServerInstance = "http://localhost:8080/"

if(localStorage.getItem("auth") === null) {
    window.location.href = "index.html";
}

function getToken() {
    const authData = JSON.parse(localStorage.getItem("auth"));
    return authData.accessToken;
}

function getUserId() {
    const authData = JSON.parse(localStorage.getItem("auth"));
    return authData.userId;
}

async function isInRoom() {
    const token = getToken();
    try {
        const response = await $.ajax({
            url: vernumServerInstance + "attendances/isInRoom/" + getUserId(),
            type: "GET",
            crossDomain: true,
            dataType: "json",
            contentType: "application/json",
            headers: {
                "accept": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Authorization": "Bearer " + token
            }
        });
        return response; // Assuming the response is true or false
    } catch (error) {
        console.error("Error:", error);
        return false; // Return false in case of an error
    }
}

async function getTotalTime() {
    const token = getToken();
    try {
        const response = await $.ajax({
            url: vernumServerInstance + "attendances/roomTime/" + getUserId(),
            type: "GET",
            crossDomain: true,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Authorization": "Bearer " + token
            }
        });
        return secondsToDuration(response.split(" ")[0]);
    } catch (error) {
        return "null" // Return null in case of an error
    }
}

window.addEventListener("load", (event) => {
    const authData = JSON.parse(localStorage.getItem("auth"));
    document.getElementById("welcome-msg").innerText = `Bem-vindo, ${authData.name}!`;

    isInRoom().then((inRoom) => {
        btn = document.getElementById("room-btn")
        if(inRoom) {
            document.getElementById("isInRoom").innerText = "Você está dentro da sala.";
            btn.innerText = "Sair da sala";
            btn.className = "btn btn-danger";
        } else {
            document.getElementById("isInRoom").innerText = "Você não está dentro da sala.";
            btn.innerText = "Entrar na sala";
            btn.className = "btn btn-success";
        }
    });

    getTotalTime().then((totalTime) => {
        document.getElementById("totalTime").innerText = `${totalTime}`;
    });

    document.getElementById("logout-btn").addEventListener("click", function() {
        localStorage.removeItem("auth");
        window.location.href = "index.html";
    });

    document.getElementById("room-btn").addEventListener("click", function() {
        isInRoom().then((inRoom) => {
            endpoint = inRoom ? "leave" : "enter";
            
            $.ajax({
                url: vernumServerInstance + "attendances/" + endpoint,
                type: "POST",
                crossDomain: true,
                dataType: "json",
                contentType: "application/json",
                headers: {
                      "accept": "application/json",
                      "Access-Control-Allow-Origin":"*",
                      "Authorization": "Bearer " + getToken()
                }
            })
    
            document.location.reload();
        
        });
    });
    
});

