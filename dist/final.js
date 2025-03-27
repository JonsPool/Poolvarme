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

let t = {};
let rOff = Math.ceil(Math.random() * 300000);
let next = 0;
let html = atob("H4sIAAAAAAACA3VTh5LzKAx+FX5fMxMb/70arvfee8Egx+xi8IDSJpN3P3Da1d0E1PXxSWnvaK9wNwEZcLSizSfREmXdxRoHGIFrGW5FOwJK4mTS1wY2kw9IlHcIDnmxMRoHrmFtFNSzUhln0EhbRyUt8HuFaK1xt2QI0PMBcYrPm0Zpx26iBmvWgTnAxk1j03mPEYOc3njEHrAHjTYRGxXj1cFG41iykACWR9xZiAMAihYNWhBfTx7B2l3bHPW283pHlJUx8kLXvYUtyUetvF2NjiBssVbgEEJCOUrjzsFz1DL4TX2PjFg/IGNXP0oxKDsL56CjMp9154OGAPqkJrRmStqmliv0ZNzOdy4wgNTEaD4kOcPLcicS4pyX7oxCtL33COHcqFvWUzCjDDvSmy3o1A3Rj0XO7UUbVWqGwgKS3odR4gd+FThygQz9N2aErxMatywpi9YoKO9Wj+gLGXdOkX7lFBrviC3pvgdUQ7kxTvsNs17J7GF5bizAZGVKLeKJ4qIq8qoUlDIcwJVzt5voXfkXyz5DAl4UleN3K5++gd99ob1ajeCQLQHftZDFt3Yf6rIYCsqMcxA++ObTT/gfLYbMF1Hexkk6/kB84TcQyOcrnFZI8sNm0vKjydcbk8CTl/fI4ix++M7hVEC8IxHynWnJd554c/v98MeLlFmuZfhZVvZX35PPuxtQyJI7GIglMkw9YqLNByxLrIBygT/f/bWGdFDqVtbe4dy++mrpFovKL7itJHewIblj+dlq7CCUktIKFufnaPHyXjL0nyR6LeS483AOR+d1ginzUP/NcCktM3eZgJIuHjyGR3TOPq3LvNXgtPhjYVOn9/LGlPcpfQGvB+4b9xx4cQJz5faUO9WPxGeezKOt/ndQ/d8HlbHF54l7d6jIm2sIcgnki2AUZGP4C4YDOXPfdkF8loCSb6fULAX+sbi8DplLnqODnrm68PT/sLq/wYIDPZx22Tvrpea2bU4/lT8By72VTvsEAAA="); // placeholder for compressed html - used by build script

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
    }
    return;
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
    let p = priceModifier(ele.marketprice / 10);
    if (p <= priceLimit) t[ele.start_timestamp] = p;
  }

  for (let key of Object.keys(t)) {
    let hour = Number(key) + 3600000;
    if (!(hour in t)) t[hour] = null; // set switch off markers
  }

  log("Timetable has been updated.", sendSchedule);
  next = getH(next, 15) + rOff;
}

function clcW() {
  let strt = getH(Date.now(), timeWindowStartHour);
  let end = getH(strt, timeWindowEndHour);

  Timer.set(rOff, false, getP, { start: strt, end: end });
}

// eslint-disable-next-line no-unused-vars
function hrly() {
  let now = Date.now();
  let hour = now - (now % 3600000);

  if (hour in t) {
    set(t[hour] !== null);
    delete t[hour];
  }

  // start calculation for next time window at 15:00
  if (new Date(hour).getHours() === 15) {
    clcW();
  }
}

function init() {
  next = getH(Date.now(), 15) + rOff;
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
    nextUpdate: next,
    switchID: switchID,
    times: t,
  });
  res.send();
}

HTTPServer.registerEndpoint("spotelly", spEP);
HTTPServer.registerEndpoint("data", dtEP);

init();
