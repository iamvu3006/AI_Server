import { database } from "../firebase/firebase-config.js";
import { ref, set, get, update, orderByChild, query, limitToLast, orderByKey, startAt, endAt }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


//threshold
export function readThreshold() {
  return get(ref(database, 'threshold/'));
}

export function updateThreshold(data) {
  return update(ref(database, 'threshold/'), data);
}


//notification
function formatTime(timestamp) {
  const date = new Date(timestamp);

  let h = String(date.getHours()).padStart(2, "0");
  let m = String(date.getMinutes()).padStart(2, "0");
  let s = String(date.getSeconds()).padStart(2, "0");

  let day = String(date.getDate()).padStart(2, "0");
  let month = String(date.getMonth() + 1).padStart(2, "0");
  let year = date.getFullYear();

  return `${h}:${m}:${s} ${day}-${month}-${year}`;
}


export function createNotification(title) {
  const now = Date.now();
  return set(ref(database, `notifications/${now}`), {
    title,
    createAt: formatTime(now)
  });
}


export function getLastNotifications() {
  const notificationsRef = ref(database, "notifications");

  const q = query(notificationsRef, limitToLast(10));

  return get(q).then(snapshot => {
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return {};
    }
  });
}
//sensor
export function newSensor(temp, humi_air, soil_mois) {
  const now = Date.now();
  return set(ref(database, 'sensor_data/' + now), {
    timestamp: formatTime(now),
    temp,
    humi_air,
    soil_mois
  });
}

export function getSensorDataByDate(startTimestamp, endTimestamp) {
  
  console.log(startTimestamp)
  console.log(endTimestamp)
  const q = query(
    ref(database, "sensor_data"),
    orderByChild("timestamp"),
    startAt("00:00:00 28-11-2025"),
    endAt("23:59:59 28-11-2025")
  );

  return get(q).then(snapshot => {
    if (snapshot.exists()) {   
      return snapshot.val();
    } else {
      return [];
    }
  });
}


//minmaxsensor
export async function getDataMinMaxToDay() {
  const dataRef = ref(database, "/minmax_sensor_today");
  const today = new Date().toISOString().split("T")[0];

  const snapshot = await get(dataRef);
  const data = snapshot.val();

  if (!data || data.date !== today) {
    const initData = {
      date: today,
      temp: { min: null, max: null, avg: null },
      humi_air: { min: null, max: null, avg: null },
      soil_mois: { min: null, max: null, avg: null }
    };
    await set(dataRef, initData);
    return initData;
  }

  return data;
}


export async function updateMinMaxSensor(value, sensorType, kind) {
  // sensorType: 'temp' | 'humi_air' | 'soil_mois'
  // kind: 'min' | 'max'
  const updates = {};
  updates[`/minmax_sensor_today/${sensorType}/${kind}`] = value;
  await update(ref(database), updates);
}



// pump
export async function setPumpState(state) {
  return update(ref(database, "controlPump"), {
    pump: state
  });
}

export async function setPumpMode(state) {
  return update(ref(database, "controlPump"), {
    mode: state
  });
}

export async function newPumpAction(mode, state) {
  const now = Date.now();
  return set(ref(database, 'pump_history/' + now), {
    timestamp: formatTime(now),
    mode,
    state
  });
}

export async function getPumpHistoryByDate(startTimestamp, endTimestamp) {
  const q = query(
    ref(database, "pump_history"),
    orderByKey(),
    startAt(startTimestamp.toString()),
    endAt(endTimestamp.toString())
  );

  return get(q).then(snapshot => {
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    } else {
      return [];
    }
  });
}

