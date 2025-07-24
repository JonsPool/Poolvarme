// Spotelly Version 3.0
// This script uses EPEX spot hourly energy prices to control the power output of a Shelly device.
// See https://github.com/towiat/spotelly for the full documentation.
// This script uses price data from http://energy-charts.info

// <<<<< START OF CONFIGURATION - change values below to your preference >>>>>

let epexBZN = "AT"; // EPEX Bidding Zone - see documentation for valid codes

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

let prc = [];
let on = [];
let anch = 0;
let rOff = Math.ceil(Math.random() * 300000);
let timH = undefined;
let html = atob("{{ html }}"); // placeholder for compressed html - used by build script

function next() {
  let delay = Timer.getInfo(timH).next - Shelly.getUptimeMs();
  return timH !== undefined ? Math.floor(Date.now()) + delay : 0;
}

function getI(ts) {
  let idx = (ts - anch) / 3600000;
  if (idx < 0 || idx >= prc.length) throw new Error("No index for " + ts + "; anch: " + anch);
  return idx;
}

function updS(ts, val) {
  on[getI(ts)] = val;
}

function log(msg, sendTelegram) {
  console.log(msg);
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

function setT(time, strt) {
  timH = Timer.set(time || time - Date.now(), false, getP, strt);
}

function getP(strt) {
  let qry = "&start=" + strt / 1000 + "&end=" + 9999999999;

  Shelly.call(
    "http.get",
    { url: "https://api.energy-charts.info/price?bzn=" + epexBZN + qry },
    prcP,
    strt,
  );
}

function prcP(res, errc, errm, strt) {
  let fbm = false;

  let err = "";
  if (errc !== 0) {
    err = "Shelly error: " + errc + "/" + errm;
  } else if (res.code !== 200) {
    err = "Server error " + res.code + "/" + res.message;
  } else {
    let body = JSON.parse(res.body);
    res.body = null; // free up RAM
    for (let price of body.price) {
      prc.push(priceModifier(price / 10));
      on.push(false);
    }
  }

  if (err) {
    if (strt > Date.now() + 1800000) {
      // retry only if day starts at least 30 minutes in the future
      timH = Timer.set(1200000, false, getP, strt);
      console.log(err, "Trying again at", next().toString());
      return;
    }
    if (!useFallback) {
      // no fallback; set timer for the next day
      setT(getH(Date.now(), 15) + rOff, getH(strt, 0));
      return;
    }
    // no prices retrieved and useFallback is true - do the fallback
    fbm = true;
    for (let p of [
      7.56, 6.98, 6.73, 6.53, 6.63, 7.33, 8.97, 10.16, 9.74, 8.21, 6.87, 6.0, 5.35, 5.02, 5.28,
      6.38, 7.85, 9.75, 11.16, 12.1, 11.58, 10.02, 9.01, 7.97,
    ]) {
      prc.push(p);
      on.push(false);
    }
  }

  if (anch === 0) anch = strt;

  let winS = timeWindowStartHour === 0 ? strt : getH(strt, timeWindowStartHour);
  let winE = getH(winS, timeWindowEndHour);
  let winH = (winE - winS) / 3600000;
  let dur = Math.min(switchOnDuration, winH);

  let data = [];
  let idx = getI(winS);
  prc.slice(idx, idx + winH).forEach(function (ele) {
    data.push([winS, ele]);
    winS += 3600000;
  });

  let sidx = 0;
  if (blockMode) {
    let lSum = Infinity;
    for (let i = 0, j = dur; j <= data.length; i++, j++) {
      let sSum = 0;
      data.slice(i, j).forEach(function (ele) {
        sSum += ele[1];
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
        if (data[j][1] > data[j - 1][1]) {
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
      updS(ele[0], true);
    } else {
      if (ele[1] <= priceLimit) updS(ele[0], true);
    }
  }

  // in fallback mode, set all prices to NaN:
  if (fbm) for (let i = getI(strt); i < prc.length; i++) prc[i] = NaN;

  setT(getH(Date.now(), 15) + rOff, getH(strt, 0));

  log("Timetable has been updated.", sendSchedule);
}

// eslint-disable-next-line no-unused-vars
function hrly() {
  let now = Date.now();
  let hour = now - (now % 3600000);
  if (hour === anch) {
    prc.splice(0, 1)[0];
    set(on.splice(0, 1)[0]);
    anch = prc.length === 0 ? 0 : anch + 3600000;
  }
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
  if (req.method === "POST") {
    let data = JSON.parse(req.body);
    try {
      updS(data.h, data.o);
    } catch (error) {
      console.log(error.message);
    }
  }
  res.headers = [["Content-Type", "application/json"]];
  res.body = JSON.stringify({
    a: anch,
    n: next(),
    s: switchID,
    p: prc,
    o: on,
  });
  res.code = 200;
  res.send();
}

function init() {
  if (Shelly.getComponentStatus("sys").unixtime === null) {
    console.log("Time not synchronized, waiting one second...");
    Timer.set(1000, false, init);
    return;
  }

  let now = Date.now();
  setT(new Date(now).getHours() < 15 ? getH(now, 15) + rOff : 0, getH(now, 0));

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

init();
