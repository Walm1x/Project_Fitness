// === Регистрация ===
document.getElementById("registerForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const f = e.target;

    const res = await fetch("http://localhost:3000/auth/register", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
            name: f.name.value,
            email: f.email.value,
            password: f.password.value
        })
    });

    const data = await res.json();
    document.getElementById("msg").innerText = data.message;

    if(res.ok) setTimeout(()=>location.href="login.html", 1200);
});

// === Вход клиента ===
document.getElementById("loginForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const f = e.target;

    const res = await fetch("http://localhost:3000/auth/login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
            email: f.email.value,
            password: f.password.value
        })
    });

    const data = await res.json();
    document.getElementById("msg").innerText = data.message;

    if(res.ok) {
        localStorage.setItem("user_id", data.user_id);
        setTimeout(()=>location.href="booking.html", 1000);
    }
});

// === Вход администратора ===
document.getElementById("adminLogin")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const f = e.target;

    const res = await fetch("http://localhost:3000/auth/admin", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
            login: f.login.value,
            password: f.password.value
        })
    });

    const data = await res.json();
    document.getElementById("msg").innerText = data.message;

    if(res.ok) setTimeout(()=>location.href="reports.html", 1000);
});

// === Бронирование ===
document.getElementById("bookingForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const user_id = localStorage.getItem("user_id");
    if(!user_id) return alert("Вы не авторизованы!");

    const f = e.target;

    const res = await fetch("http://localhost:3000/bookings/add", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
            user_id,
            trainer_id: f.trainer_id.value,
            zone_id: f.zone_id.value,
            date: f.date.value,
            start_time: f.start_time.value,
            duration: f.duration.value + ":00:00",
            type: f.type.value
        })
    });

    const data = await res.json();
    document.getElementById("message").innerText = data.message || data.error;
});

// === Отчёт ===
document.getElementById("getReport")?.addEventListener("click", async ()=>{
    const start = document.getElementById("start_date").value;
    const end = document.getElementById("end_date").value;

    const res = await fetch(`http://localhost:3000/reports/bookings?start_date=${start}&end_date=${end}`);
    const data = await res.json();

    const tbody = document.querySelector("#reportTable tbody");
    tbody.innerHTML = "";

    data.forEach(r=>{
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.client}</td>
            <td>${r.trainer}</td>
            <td>${r.zone}</td>
            <td>${r.date}</td>
            <td>${r.start_time}</td>
            <td>${r.duration}</td>
            <td>${r.type}</td>
        `;
        tbody.appendChild(tr);
    });
});

// === Доступность ===
document.getElementById("getAvailability")?.addEventListener("click", async ()=>{
    const date = document.getElementById("date").value;

    const res = await fetch(`http://localhost:3000/availability?date=${date}`);
    const data = await res.json();

    const tbody = document.querySelector("#availabilityTable tbody");
    tbody.innerHTML = "";

    data.forEach(r=>{
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.time_slot}</td>
            <td>${r.zone}</td>
            <td>${r.trainer}</td>
        `;
        tbody.appendChild(tr);
    });
});
