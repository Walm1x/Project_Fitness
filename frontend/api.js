// Бронирование
document.getElementById('bookingForm')?.addEventListener('submit', async function(e){
    e.preventDefault();
    const form = e.target;
    const data = {
        user_id: form.user_id.value,
        trainer_id: form.trainer_id.value,
        zone_id: form.zone_id.value,
        date: form.date.value,
        start_time: form.start_time.value,
        duration: form.duration.value + ':00:00',
        type: form.type.value
    };
    const res = await fetch('http://localhost:3000/bookings/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data)
    });
    const result = await res.json();
    const msg = document.getElementById('message');
    msg.innerText = res.ok ? 'Бронирование успешно!' : 'Ошибка: '+result.error;
});

// Отчёты
document.getElementById('getReport')?.addEventListener('click', async ()=>{
    const start = document.getElementById('start_date').value;
    const end = document.getElementById('end_date').value;
    const res = await fetch(`http://localhost:3000/reports/bookings?start_date=${start}&end_date=${end}`);
    const data = await res.json();
    const tbody = document.querySelector('#reportTable tbody');
    tbody.innerHTML='';
    data.forEach(b=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${b.client}</td><td>${b.trainer}</td><td>${b.zone}</td>
        <td>${b.date}</td><td>${b.start_time}</td><td>${b.duration}</td><td>${b.type}</td>`;
        tbody.appendChild(tr);
    });
});

// Доступность
document.getElementById('getAvailability')?.addEventListener('click', async ()=>{
    const date = document.getElementById('date').value;
    const res = await fetch(`http://localhost:3000/availability?date=${date}`);
    const data = await res.json();
    const tbody = document.querySelector('#availabilityTable tbody');
    tbody.innerHTML='';
    data.forEach(b=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${b.time_slot}</td><td>${b.zone}</td><td>${b.trainer}</td>`;
        tbody.appendChild(tr);
    });
});
