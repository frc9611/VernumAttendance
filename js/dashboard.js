if(localStorage.getItem("auth") === null) {
    window.location.href = "index.html";
}

window.addEventListener("load", (event) => {
    const authData = JSON.parse(localStorage.getItem("auth"));
    document.getElementById("welcome-msg").innerText = `Bem-vindo, ${authData.name}!`;

    document.getElementById("logout-btn").addEventListener("click", function() {
        localStorage.removeItem("auth");
        window.location.href = "index.html";
    });
});

