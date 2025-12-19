function secondsToDuration(seconds) {
    if(seconds == 0) return "0s";
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

function loginFormSubmit(event) {
    username = document.getElementById("user").value;
    password = document.getElementById("password").value;

    $.ajax({
        url: vernumServerInstance + "login",
        type: "POST",
        crossDomain: true,
        data: JSON.stringify({username: username, password: password}),
        dataType: "json",
        contentType: "application/json",
        headers: {
              "accept": "application/json",
              "Access-Control-Allow-Origin":"*"
        },
        success: function(response) {
            document.getElementById("login-status").innerText = "Conectando...";
            localStorage.setItem("auth", JSON.stringify(response));

            document.location.href = "dashboard.html";
        },
        error: function(xhr, status) {
            document.getElementById("login-status").innerText = "Dados de acesso incorretos"; 
        }
    })

    event.preventDefault();
}

function loadRanking() {
    $.ajax({
        url: vernumServerInstance + "attendances/ranking",
        type: "GET",
        crossDomain: true,
        dataType: "json",
        contentType: "application/json",
        headers: {
              "accept": "application/json",
              "Access-Control-Allow-Origin":"*"
        },
        success: function(response) {
            console.log(response)
            idx = 0;
            tbody = document.getElementById("ranking-body");
            Object.keys(response).forEach(function(k){
                idx++;
                console.log(k + ' - ' + response[k]);
                username = k;
                seconds = response[k];
                tr = document.createElement("tr");
                th = document.createElement("th");
                th.scope = "row";
                th.innerText = idx;

                tdName = document.createElement("td");
                tdName.innerText = username;

                tdTime = document.createElement("td");
                tdTime.innerText = secondsToDuration(seconds);

                tr.appendChild(th);
                tr.appendChild(tdName);
                tr.appendChild(tdTime);

                tbody.appendChild(tr);
            });
        },
        error: function(xhr, status) {
            alert("error")
        }
    })
}

window.addEventListener("load", (event) => {
  document.getElementById("login-btn").addEventListener("click", loginFormSubmit);
  loadRanking();
});


