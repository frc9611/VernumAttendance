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

window.addEventListener("load", (event) => {
  document.getElementById("login-btn").addEventListener("click", loginFormSubmit);
});


