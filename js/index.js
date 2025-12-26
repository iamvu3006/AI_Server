import * as crud from "../js/crud.js";
import { database } from "../firebase/firebase-config.js";
import { get, ref, onValue, remove, query, orderByKey, startAt, endAt } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-database.js";

// ======== SETUP ===================
// Thong báo
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");

    const toast = document.createElement("div");
    toast.className = "toast " + type;

    // Thêm icon theo type
    let icon = "";
    switch (type) {
        case "success": icon = "✔"; break;
        case "info": icon = "ℹ"; break;
        case "warning": icon = "⚠"; break;
        case "error": icon = "✖"; break;
    }

    toast.innerHTML = `<span class="icon">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => container.removeChild(toast), 400);
    }, 5000);
}

function monitorSensorStatus() {
    const lastUpdateRef = ref(database, 'data_realtime/lastUpdate');
    let lastUpdateTime = Date.now();

    onValue(lastUpdateRef, (snapshot) => {
        const value = snapshot.val();

        if (value) {
            lastUpdateTime = Date.now();
        }

    });

    setInterval(async () => {
        const now = Date.now();
        if (now - lastUpdateTime > 10000) {
            await remove(ref(database, 'data_realtime'));
            console.warn("⚠️ Cảm biến ngừng hoạt động -> Dữ liệu đã bị xoá!");
        }
    }, 1000);
}

monitorSensorStatus();


// Khởi tạo biểu đồ
const ctxTemp = document.getElementById('temperatureChart').getContext('2d');
const ctxAirHum = document.getElementById('airHumidityChart').getContext('2d');
const ctxSoilMoist = document.getElementById('soilMoistureChart').getContext('2d');

//tra ve thoi gian tren bieu do
function generateTimeLabels() {
    const labels = [];
    const now = new Date();

    const start = new Date(now.getTime() - 60 * 60 * 1000);
    const end = new Date(now);

    start.setMinutes(Math.floor(start.getMinutes() / 10) * 10, 0, 0);
    end.setMinutes(Math.ceil(end.getMinutes() / 10) * 10, 0, 0);

    for (let t = new Date(start); t <= end; t.setMinutes(t.getMinutes() + 10)) {
        labels.push(t.toTimeString().slice(0, 5));
    }
    return labels;
}

//  Lấy dữ liệu và hiển thị biểu đồ
async function getDataChart() {

    const labels = generateTimeLabels();
    const tempValues = new Array(labels.length).fill(null);
    const airHumValues = new Array(labels.length).fill(null);
    const soilMoistValues = new Array(labels.length).fill(null);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const dataToday = await crud.getSensorDataByDate(startOfDay.toString(), endOfDay.toString());
    console.log("bieu do :  ", dataToday)

    if (dataToday) {
        Object.entries(dataToday).forEach(([timestamp, values]) => {
            const time = new Date(Number(timestamp));
            const timeLabel = time.toTimeString().slice(0, 5);
            const index = labels.indexOf(timeLabel);
            if (index !== -1) {
                tempValues[index] = values.temp ?? null;
                airHumValues[index] = values.humi_air ?? null;
                soilMoistValues[index] = values.soil_mois ?? null;
            }
        });
    }

    window.temperatureChart = new Chart(ctxTemp, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Nhiệt Độ (°C)', data: tempValues, borderColor: 'red', fill: true }]
        },
        options: { responsive: true }
    });

    window.airHumidityChart = new Chart(ctxAirHum, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Độ Ẩm Không Khí (%)', data: airHumValues, borderColor: 'blue', fill: true }]
        },
        options: { responsive: true }
    });

    window.soilMoistureChart = new Chart(ctxSoilMoist, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Độ Ẩm Đất (%)', data: soilMoistValues, borderColor: 'green', fill: true }]
        },
        options: { responsive: true }
    });


    // Cap nhat realtime
    const dataRef = query(
        ref(database, "sensor_data"),
        orderByKey(),
        startAt(startOfDay.toString()),
        endAt(endOfDay.toString())
    );

    onValue(dataRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        Object.entries(data).forEach(([timestamp, values]) => {
            const time = new Date(Number(timestamp));
            const timeLabel = time.toTimeString().slice(0, 5);

            const index = labels.indexOf(timeLabel);
            if (index !== -1) {
                tempValues[index] = values.temp ?? null;
                airHumValues[index] = values.humi_air ?? null;
                soilMoistValues[index] = values.soil_mois ?? null;
            }
        });

        temperatureChart.update();
        airHumidityChart.update();
        soilMoistureChart.update();
    });
}

getDataChart();


async function updateStats() {

    const snap = await get(ref(database, "minmax_sensor_today"));
    const minmax = snap.val() || {};

    const tempMin = minmax.temp?.min ?? 0;
    const tempMax = minmax.temp?.max ?? 0;
    const humiMin = minmax.humi_air?.min ?? 0;
    const humiMax = minmax.humi_air?.max ?? 0;
    const soilMin = minmax.soil_mois?.min ?? 0;
    const soilMax = minmax.soil_mois?.max ?? 0;



    onValue(ref(database, "data_realtime/temperature"), snapshot => {
        const current = Number(snapshot.val());
        if (!isNaN(current)) {
            if (current > tempMax) crud.updateMinMaxSensor(current, "temp", "max");
            if (current < tempMin) crud.updateMinMaxSensor(current, "temp", "min");
        }

        document.getElementById("tempStats").innerText =
            `Giá trị hiện tại: ${current}°C | Min: ${tempMin} | Max: ${tempMax}`;
    });

    onValue(ref(database, "data_realtime/humidity"), snapshot => {
        const current = Number(snapshot.val());
        if (!isNaN(current)) {
            if (current > humiMax) crud.updateMinMaxSensor(current, "humi_air", "max");
            if (current < humiMin) crud.updateMinMaxSensor(current, "humi_air", "min");
        }

        document.getElementById("airHumStats").innerText =
            `Giá trị hiện tại: ${current}% | Min: ${humiMin} | Max: ${humiMax}`;
    });

    onValue(ref(database, "data_realtime/soilMoisture"), snapshot => {
        const current = Number(snapshot.val());
        if (!isNaN(current)) {
            if (current > soilMax) crud.updateMinMaxSensor(current, "soil_mois", "max");
            if (current < soilMin) crud.updateMinMaxSensor(current, "soil_mois", "min");
        }

        document.getElementById("soilMoistStats").innerText =
            `Giá trị hiện tại: ${current}% | Min: ${soilMin} | Max: ${soilMax}`;
    });
}

updateStats();


// Pump
const pumpModeSwitch = document.getElementById('pumpModeSwitch');
const manualControls = document.getElementById('manualControls');
const modeRef = ref(database, "/controlPump/mode");

onValue(modeRef, (snapshot) => {
    const mode = snapshot.val();

    if (mode === "auto") {
        pumpModeSwitch.checked = false; // chế độ tự động
    } else if (mode === "manual") {
        pumpModeSwitch.checked = true;  // chế độ thủ công
        manualControls.style.display = 'block';
    }
});

pumpModeSwitch.addEventListener('change', () => {
    if (pumpModeSwitch.checked) {
        crud.setPumpMode("manual");
        crud.createNotification("Chuyển sang chế độ bơm thủ công");
        showToast("Chuyển sang chế độ bơm thủ công", "success");
        manualControls.style.display = 'block';
    } else {
        crud.setPumpMode("auto");
        crud.createNotification("Chuyển sang chế độ bơm tự động");
        showToast("Chuyển sang chế độ bơm tự động", "success");
        manualControls.style.display = 'none';
    }
});

document.getElementById('pumpOn').addEventListener('click', () => {
    crud.setPumpState("ON");
    crud.createNotification("Bơm bật ở chế độ thủ công");
    crud.newPumpAction("Tự động", "Bật");
    showToast("Bơm bật");
});

document.getElementById('pumpOff').addEventListener('click', () => {
    crud.setPumpState("OFF");
    crud.createNotification("Bơm tắt ở chế độ thủ công");
    crud.newPumpAction("Thủ công", "Tắt");
    showToast("Bơm tắt");
});


function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = "none");
    document.getElementById(tabName).style.display = "block";

    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove("active"));

    if (tabName === "sensorHistory") {
        document.querySelector(".tabs").classList.remove("tab-pump");
        document.querySelector(".tabs").classList.add("tab-sensor");
        document.querySelectorAll(".tab-btn")[0].classList.add("active");
    } else if (tabName === "pumpHistory") {
        document.querySelector(".tabs").classList.remove("tab-sensor");
        document.querySelector(".tabs").classList.add("tab-pump");
        document.querySelectorAll(".tab-btn")[1].classList.add("active");
        getPumpToday();
    }
}
window.openTab = openTab;

function modeAutoWarning() {
    const pumpRef = ref(database, "controlPump");

    onValue(pumpRef, (snapshot) => {
        const data = snapshot.val();
        if (data.mode == "auto") {
            if (data.pump == "ON") {
                crud.newPumpAction("Tự động", "Bật");
                showToast("Độ ẩm đất thấp hơn ngưỡng .... Bơm tự động bật", "warning");
            } else if (data.pump == "OFF") {
                crud.newPumpAction("Tự động", "Tắt");
                showToast("Độ ẩm đất vượt ngưỡng .... Bơm tự động tắt", "warning");
            }
        }
    })
}
modeAutoWarning();

async function getPumpToday() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const rawData = await crud.getPumpHistoryByDate(startOfDay, endOfDay);

    const tbody = document.querySelector("#pumpHistoryTable tbody");
    tbody.innerHTML = "";

    if (!rawData || Object.keys(rawData).length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:gray;">Không có dữ liệu hôm nay</td></tr>`;
        return;
    }


    const data = Object.entries(rawData).map(([id, values]) => ({
        id,
        ...values
    }));

    data.sort((a, b) => b.id - a.id);

    data.forEach(values => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${values.timestamp}</td>
      <td>${values.mode} </td>
      <td>${values.state} </td>
    `;
        tbody.appendChild(tr);
    });
}




// xu ly tin hieu nguong


function loadThreshold() {
    crud.readThreshold()
        .then(snapshot => {
            let data = snapshot.val();

            document.getElementById('soilMoistMin').value = data.min_soil;
            document.getElementById('soilMoistMax').value = data.max_soil;
            document.getElementById('tempMin').value = data.min_temp;
            document.getElementById('tempMax').value = data.max_temp;
            document.getElementById('airHumMin').value = data.min_humi;
            document.getElementById('airHumMax').value = data.max_humi;
        })
        .catch(err => console.error(err));
}

// cap nhta nguong
function saveThreshold() {
    let form = document.getElementById("thresholdForm");

    let formData = {
        min_temp: form.tempMin.value,
        max_temp: form.tempMax.value,
        min_humi: form.airHumMin.value,
        max_humi: form.airHumMax.value,
        min_soil: form.soilMoistMin.value,
        max_soil: form.soilMoistMax.value
    };
    crud.updateThreshold(formData);
    showToast("Cập nhật ngưỡng thành công...", "success");
}
// Modal chỉnh sửa ngưỡng
const thresholdModal = document.getElementById('thresholdModal');
const editThresholdBtn = document.getElementById('editThresholds');
const closeThresholdModal = document.getElementById('closeThresholdModal');


document.getElementById("saveBtn").addEventListener("click", saveThreshold);

editThresholdBtn.addEventListener('click', (e) => {
    e.preventDefault();
    thresholdModal.style.display = 'block';
    loadThreshold();
});

closeThresholdModal.addEventListener('click', () => {
    thresholdModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === thresholdModal) {
        thresholdModal.style.display = 'none';
    }
});




// Modal thông báo
async function loadNotifications() {
    const list = document.getElementById("notificationList");
    list.innerHTML = "";

    // Hiện thông báo "Đang tải..."
    const loadingLi = document.createElement("li");
    loadingLi.innerText = "Đang tải...";
    list.appendChild(loadingLi);

    try {
        const data = await crud.getLastNotifications();
        list.innerHTML = "";

        if (Object.keys(data).length === 0) {
            const li = document.createElement("li");
            li.innerText = "Không có thông báo mới.";
            list.appendChild(li);
            return;
        }

        const notifs = Object.entries(data).map(([id, value]) => ({
            id,
            ...value,
        }));

        notifs.sort((a, b) => b.id - a.id);

        notifs.forEach((notif) => {
            const li = document.createElement("li");
            li.innerText = `[${notif.createAt}] ${notif.title}`;
            list.appendChild(li);
        });
    } catch (err) {
        list.innerHTML = "";
        const li = document.createElement("li");
        li.innerText = "Lỗi khi tải thông báo!";
        list.appendChild(li);
        console.error(err);
    }
}

const notificationModal = document.getElementById('notificationModal');
const viewNotificationsBtn = document.getElementById('viewNotifications');
const closeNotificationModal = document.getElementById('closeNotificationModal');

viewNotificationsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loadNotifications();
    notificationModal.style.display = 'block';
});

closeNotificationModal.addEventListener('click', () => {
    notificationModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === notificationModal) {
        notificationModal.style.display = 'none';
    }
});

document.getElementById("viewNotifications").addEventListener("click", function () {
    document.getElementById("notificationDot").style.display = "none";
});

// history
async function updateSensorHistoryTable() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const rawData = await crud.getSensorDataByDate(startOfDay.toString(), endOfDay.toString());
    console.log("lich su : ", rawData)


    const tbody = document.querySelector("#sensorHistoryTable tbody");
    tbody.innerHTML = "";

    if (!rawData || Object.keys(rawData).length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:gray;">Không có dữ liệu hôm nay</td></tr>`;
        return;
    }

    const data = Object.entries(rawData).map(([id, values]) => ({
        id,
        ...values
    }));
    data.sort((a, b) => b.id - a.id);

    data.forEach(values => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${values.timestamp}</td>
      <td>${values.temp} °C</td>
      <td>${values.humi_air} %</td>
      <td>${values.soil_mois} %</td>
    `;
        tbody.appendChild(tr);
    });
}
updateSensorHistoryTable();


async function filterHistory() {
    let date = document.getElementById("historyDate").value;
    let timeStart = document.getElementById("historyStart").value;
    let timeEnd = document.getElementById("historyEnd").value;

    if (!date || !timeStart || !timeEnd) {
        showToast("Vui lòng chọn đầy đủ ngày và giờ", "error");
        return;
    }

    let start = new Date(date + "T" + timeStart);
    let end = new Date(date + "T" + timeEnd);

    if (end < start) {
        showToast("Thời gian kết thúc trước bắt đầu...", "error");
        return;
    }

    const rawData = await crud.getSensorDataByDate(start.getTime(), end.getTime());
    showToast("Dữ liệu cảm biến!", "info");
    const tbody = document.querySelector("#sensorHistoryTable tbody");
    tbody.innerHTML = "";

    if (!rawData || Object.keys(rawData).length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">Thời gian này không có dữ liệu</td></tr>`;
        return;
    }


    const data = Object.entries(rawData).map(([id, values]) => ({
        id,
        ...values
    }));

    data.sort((a, b) => b.id - a.id);

    data.forEach(values => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${values.timestamp}</td>
      <td>${values.temp} °C</td>
      <td>${values.humi_air} %</td>
      <td>${values.soil_mois} %</td>
    `;
        tbody.appendChild(tr);
    });
}
document.getElementById("filterHistorySensor").addEventListener("click", filterHistory);

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', async () => {
        const tabName = btn.dataset.tab;

        document.querySelectorAll('.page-tab').forEach(t => {
            t.style.display = 'none';
        });

        document.getElementById(tabName).style.display = 'block';

        if (tabName === "aiTab") {
            const res = await fetch("/results.html");
            const html = await res.text();
            document.getElementById("aiContent").innerHTML = html;

            const scripts = document.querySelectorAll('#aiContent script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                if (oldScript.src) newScript.src = oldScript.src;
                else newScript.innerHTML = oldScript.innerHTML;
                document.body.appendChild(newScript);
            });
        }
    });
});
