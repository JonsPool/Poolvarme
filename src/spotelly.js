// Spotelly Version 2.0
// This script uses EPEX spot hourly energy prices to control the power output of a Shelly device.
// See https://github.com/towiat/spotelly for the full documentation.
// This script uses price data from http://energy-charts.info

// <<<<< START OF CONFIGURATION - change values below to your preference >>>>>

let awattarCountry = "at"; // at for Austrian or de for German API

let switchOnDuration = 4; // minimum 1, maximum 24
let timeWindowStartHour = 7; // minimum 0, maximum 23
let timeWindowEndHour = 19; // minimum 0, maximum 23
let blockMode = true; // set calculation mode
let priceLimit = Infinity; // in cent/kWh

// change this function to display prices according to the conditions of your contract
function priceModifier(spotPrice) {
  return spotPrice; // spotPrice is in cent/kWh
}

let switchID = 0; // set the switch ID for multi-switch devices

let telegramActive = false; // set to true to activate the Telegram feature

// the following settings have no effect when telegramActive is false
let telegramToken = ""; // must be set when telegramActive is true
let telegramChatID = ""; // must be set when telegramActive is true
let deviceName = "Shelly"; // will be included in telegrams to identify the sender
let sendSchedule = true; // send telegram with schedule and price details after each run
let sendPowerOn = true; // send telegram when power has been switched on by this script
let sendPowerOff = true; // send telegram when power has been switched off by this script

// <<<<< END OF CONFIGURATION - no changes needed below this line >>>>>

let times = {};
let randomOffset = Math.ceil(Math.random() * 300000);
let nextUpdate = 0;
let html = atob("{{ html }}"); // placeholder for compressed html - used by build script

function logAndNotify(msg, sendTelegram) {
  print(msg);
  if (telegramActive && sendTelegram) {
    Shelly.call("http.post", {
      url: "https://api.telegram.org/bot" + telegramToken + "/sendMessage",
      content_type: "application/json",
      body: { chat_id: telegramChatID, text: deviceName + ": " + msg },
    });
  }
}

function setSwitch(value) {
  if (Shelly.getComponentStatus("switch", switchID).output === value) return;
  let message = value ? "ON." : "OFF.";
  let flag = value ? sendPowerOn : sendPowerOff;
  Shelly.call("Switch.Set", { id: switchID, on: value }, function (result, error_code) {
    if (error_code === 0) {
      logAndNotify("Switch " + switchID + " has been turned " + message, flag);
    } else {
      logAndNotify("ERROR: Switch " + switchID + " could not be turned " + message, flag);
    }
  });
}

function getHour(timestamp, hour) {
  let d = new Date(timestamp);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + Number(hour <= d.getHours()),
    hour,
  ).getTime();
}

function fetchPrices(window) {
  let query = "?start=" + window.start + "&end=" + window.end;

  Shelly.call(
    "http.get",
    { url: "https://api.awattar." + awattarCountry + "/v1/marketdata" + query },
    processPrices,
    window,
  );
}

function processPrices(res, error_code, error_message, window) {
  let data;

  let error = "";
  if (error_code !== 0) {
    error = "Shelly error: " + error_code + "/" + error_message;
  } else if (res.code !== 200) {
    error = "Server error " + res.code + "/" + res.message;
  } else {
    data = JSON.parse(res.body)["data"];
    let expected = (window.end - window.start) / 3600000;
    if (data.length !== expected) {
      error = "Data error: " + data.length + " records instead of " + expected;
    }
    res.body = null; // free up RAM
  }

  let now = Math.floor(Date.now());

  if (error) {
    if (window.start > now + 1800000) {
      // retry only if window starts at least 30 minutes in the future
      let period = 1200000;
      nextUpdate = now + period;
      print(error + "Trying again at " + new Date(nextUpdate).toString());
      Timer.set(period, false, fetchPrices, window);
    }
    return;
  }

  let startIndex = 0;
  let duration = Math.min(switchOnDuration, data.length);

  if (blockMode) {
    let lowestSum = Infinity;
    for (let i = 0, j = duration; j <= data.length; i++, j++) {
      let sliceSum = 0;
      data.slice(i, j).forEach(function (ele) {
        sliceSum += ele.marketprice;
      });
      if (sliceSum < lowestSum) {
        startIndex = i;
        lowestSum = sliceSum;
      }
    }
  } else {
    // move the <duration> elements with the lowest price to the end of the data array
    for (let i = 0; i < duration; i++) {
      for (let j = 1; j < data.length; j++) {
        if (data[j].marketprice > data[j - 1].marketprice) {
          let temp = data[j];
          data[j] = data[j - 1];
          data[j - 1] = temp;
        }
      }
    }
    startIndex = -duration;
  }

  for (let ele of data.splice(startIndex, duration)) {
    let price = priceModifier(ele.marketprice / 10);
    if (price <= priceLimit) times[ele.start_timestamp] = price;
  }

  for (let key of Object.keys(times)) {
    let hour = Number(key) + 3600000;
    if (!(hour in times)) times[hour] = null; // set switch off markers
  }

  logAndNotify("Timetable has been updated.", sendSchedule);
  nextUpdate = getHour(nextUpdate, 15) + randomOffset;
}

function calculateWindow() {
  let start = getHour(Date.now(), timeWindowStartHour);
  let end = getHour(start, timeWindowEndHour);

  Timer.set(randomOffset, false, fetchPrices, { start: start, end: end });
}

// eslint-disable-next-line no-unused-vars
function hourly() {
  let now = Date.now();
  let thisHour = now - (now % 3600000);

  if (thisHour in times) {
    setSwitch(times[thisHour] !== null);
    delete times[thisHour];
  }

  // start calculation for next time window at 15:00
  if (new Date(thisHour).getHours() === 15) {
    calculateWindow();
  }
}

function startUp() {
  nextUpdate = getHour(Date.now(), 15) + randomOffset;
  Shelly.call("Schedule.List", {}, function (result) {
    let scriptID = Shelly.getCurrentScriptId();
    let method = "Schedule.Update";
    let schedule = null;
    let timespec = "0 0 * * * *";
    let code = "hourly()";

    for (let job of result.jobs) {
      let call = job.calls[0];
      if (!(call.method.toLowerCase() === "script.eval" && call.params.id === scriptID)) {
        continue; // this is not our schedule - skip
      }
      if (job.timespec === timespec && call.params.code === code) {
        return; // this IS our schedule and it matches the configuration - we are done
      }
      schedule = job;
      schedule.timespec = timespec;
      call.params.code = code;
      break;
    }

    if (schedule === null) {
      // schedule does not exist - create it
      method = "Schedule.Create";
      schedule = {
        enable: true,
        timespec: timespec,
        calls: [{ method: "Script.Eval", params: { id: scriptID, code: code } }],
      };
    }

    Shelly.call(method, schedule);
  });
}

function spotellyEndpoint(request, response) {
  response.headers = [
    ["Content-Type", "text/html"],
    ["Content-Encoding", "gzip"],
  ];
  response.body = html;
  response.send();
}

function dataEndpoint(request, response) {
  response.headers = [["Content-Type", "application/json"]];
  response.body = JSON.stringify({
    nextUpdate: nextUpdate,
    switchID: switchID,
    times: times,
  });
  response.send();
}

HTTPServer.registerEndpoint("spotelly", spotellyEndpoint);
HTTPServer.registerEndpoint("data", dataEndpoint);

startUp();
