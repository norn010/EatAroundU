let map = L.map('map').setView([13.7563, 100.5018], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

function loadRestaurants() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const radius = document.getElementById('radius').value || 5;

            fetch(`http://localhost:3000/restaurants?lat=${lat}&lng=${lng}&radius=${radius}`)
                .then(res => res.json())
                .then(data => {
                    data.forEach(r => {
                        L.marker([r.latitude, r.longitude])
                            .addTo(map)
                            .bindPopup(`<b>${r.name}</b><br>ประเภท: ${r.type}<br>ราคา: ${r.price_range}`);
                    });
                });
        });
    }
}
