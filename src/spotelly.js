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
let useFallback = true; // if true, use fallback when price retrieval fails

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

let t = {};
let rOff = Math.ceil(Math.random() * 300000);
let next = 0;
let html = atob("{{ html }}"); // placeholder for compressed html - used by build script

function log(msg, sendTelegram) {
  print(msg);
  if (telegramActive && sendTelegram) {
    Shelly.call("http.post", {
      url: "https://api.telegram.org/bot" + telegramToken + "/sendMessage",
      content_type: "application/json",
      body: { chat_id: telegramChatID, text: deviceName + ": " + msg },
    });
  }
}

function set(val) {
  if (Shelly.getComponentStatus("switch", switchID).output === val) return;
  let msg = val ? "ON." : "OFF.";
  let flag = val ? sendPowerOn : sendPowerOff;
  Shelly.call("Switch.Set", { id: switchID, on: val }, function (res, errc) {
    if (errc === 0) {
      log("Switch " + switchID + " has been turned " + msg, flag);
    } else {
      log("ERROR: Switch " + switchID + " could not be turned " + msg, flag);
    }
  });
}

function getH(ts, hour) {
  let d = new Date(ts);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + Number(hour <= d.getHours()),
    hour,
  ).getTime();
}

function getP(win) {
  let qry = "?start=" + win.start + "&end=" + win.end;

  Shelly.call(
    "http.get",
    { url: "https://api.awattar." + awattarCountry + "/v1/marketdata" + qry },
    prcP,
    win,
  );
}

function prcP(res, errc, errm, win) {
  let data;
  let fbm = false;

  let err = "";
  if (errc !== 0) {
    err = "Shelly error: " + errc + "/" + errm;
  } else if (res.code !== 200) {
    err = "Server error " + res.code + "/" + res.message;
  } else {
    data = JSON.parse(res.body)["data"];
    let exp = (win.end - win.start) / 3600000;
    if (data.length !== exp) {
      err = "Data error: " + data.length + " records instead of " + exp;
    }
    res.body = null; // free up RAM
  }

  let now = Math.floor(Date.now());

  if (err) {
    if (win.start > now + 1800000) {
      // retry only if window starts at least 30 minutes in the future
      let per = 1200000;
      next = now + per;
      print(err + "Trying again at " + new Date(next).toString());
      Timer.set(per, false, getP, win);
      return;
    }
    if (!useFallback) return;
    // no prices retrieved and useFallback is true - do the fallback
    fbm = true;
    let fbp = [
      0.625, 0.577, 0.556, 0.54, 0.548, 0.605, 0.741, 0.839, 0.805, 0.679, 0.568, 0.496, 0.442,
      0.415, 0.437, 0.527, 0.649, 0.806, 0.922, 1, 0.957, 0.828, 0.745, 0.658,
    ];
    data = [];
    for (let i = win.start; i < win.end; i += 3600000) {
      data.push({ start_timestamp: i, marketprice: fbp[new Date(i).getHours()] });
    }
  }

  let sidx = 0;
  let dur = Math.min(switchOnDuration, data.length);

  if (blockMode) {
    let lSum = Infinity;
    for (let i = 0, j = dur; j <= data.length; i++, j++) {
      let sSum = 0;
      data.slice(i, j).forEach(function (ele) {
        sSum += ele.marketprice;
      });
      if (sSum < lSum) {
        sidx = i;
        lSum = sSum;
      }
    }
  } else {
    // move the <duration> elements with the lowest price to the end of the data array
    for (let i = 0; i < dur; i++) {
      for (let j = 1; j < data.length; j++) {
        if (data[j].marketprice > data[j - 1].marketprice) {
          let temp = data[j];
          data[j] = data[j - 1];
          data[j - 1] = temp;
        }
      }
    }
    sidx = -dur;
  }

  for (let ele of data.splice(sidx, dur)) {
    if (fbm) {
      t[ele.start_timestamp] = "-"; // we don't know the price in fallback mode
      continue;
    }
    let p = priceModifier(ele.marketprice / 10);
    if (p <= priceLimit) t[ele.start_timestamp] = p;
  }

  for (let key of Object.keys(t)) {
    let hour = Number(key) + 3600000;
    if (!(hour in t)) t[hour] = "off"; // set switch off markers
  }

  log("Timetable has been updated.", sendSchedule);
  next = getH(now, 15) + rOff;
}

function clcW(offs) {
  let strt = getH(Date.now(), timeWindowStartHour);
  let end = getH(strt, timeWindowEndHour);

  Timer.set(offs || rOff, false, getP, { start: strt, end: end });
}

// eslint-disable-next-line no-unused-vars
function hrly() {
  let now = Date.now();
  let hour = now - (now % 3600000);

  if (hour in t) {
    set(t[hour] !== "off");
    delete t[hour];
  }

  // start calculation for next time window at 15:00
  if (new Date(hour).getHours() === 15) {
    clcW();
  }
}

function init() {
  if (Shelly.getComponentStatus("sys").unixtime === null) {
    print("Time not synchronized, waiting one second...");
    Timer.set(1000, false, init);
    return;
  }
  next = getH(Date.now(), 15) + rOff;
  HTTPServer.registerEndpoint("spotelly", spEP);
  HTTPServer.registerEndpoint("data", dtEP);
  Shelly.call("Schedule.List", {}, function (res) {
    let sid = Shelly.getCurrentScriptId();
    let mthd = "Schedule.Update";
    let schd = null;
    let tspc = "0 0 * * * *";
    let code = "hrly()";

    for (let job of res.jobs) {
      let call = job.calls[0];
      if (!(call.method.toLowerCase() === "script.eval" && call.params.id === sid)) {
        continue; // this is not our schedule - skip
      }
      if (job.timespec === tspc && call.params.code === code) {
        return; // this IS our schedule and it matches the configuration - we are done
      }
      schd = job;
      schd.timespec = tspc;
      call.params.code = code;
      break;
    }

    if (schd === null) {
      // schedule does not exist - create it
      mthd = "Schedule.Create";
      schd = {
        enable: true,
        timespec: tspc,
        calls: [{ method: "Script.Eval", params: { id: sid, code: code } }],
      };
    }

    Shelly.call(mthd, schd);
  });
}

function spEP(req, res) {
  res.headers = [
    ["Content-Type", "text/html"],
    ["Content-Encoding", "gzip"],
  ];
  res.body = html;
  res.send();
}

function dtEP(req, res) {
  res.headers = [["Content-Type", "application/json"]];
  res.body = JSON.stringify({
    n: next,
    s: switchID,
    t: t,
  });
  res.send();
}

init();
