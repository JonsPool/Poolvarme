// Spotelly Version 2.0
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
let html = atob("H4sIAAAAAAACA3VTh5LzKAx+FX5fMxMb/70arvfee8Egx+xi8IDSJpN3P3Da1d0E1PXxSWnvaK9wNwEZcLSizSfREmXdxRoHGIFrGW5FOwJK4mTS1wY2kw9IlHcIDnmxMRoHrmFtFNSzUhln0EhbRyUt8HuFaK1xt2QI0PMBcYrPm0Zpx26iBmvWgTnAxk1j03mPEYOc3njEHrAHjTYRGxXj1cFG41iykACWR9xZiAMAihYNWhBfTx7B2l3bHPW283pHlJUx8kLXvYUtyUetvF2NjiBssVbgEEJCOUrjzsFz1DL4TX2PjFg/IGNXP0oxKDsL56CjMp9154OGAPqkJrRmStqmliv0ZNzOdy4wgNTEaD4kOcPLcicS4pyX7oxCtL33COHcqFvWUzCjDDvSmy3o1A3Rj0XO7UUbVWqGwgKS3odR4gd+FThygQz9N2aErxMatywpi9YoKO9Wj+gLGXdOkX7lFBrviC3pvgdUQ7kxTvsNs17J7GF5bizAZGVKLeKJ4qIq8qoUlDIcwJVzt5voXfkXyz5DAl4UleN3K5++gd99ob1ajeCQLQHftZDFt3Yf6rIYCsqMcxA++ObTT/gfLYbMF1Hexkk6/kB84TcQyOcrnFZI8sNm0vKjydcbk8CTl/fI4ix++M7hVEC8IxHynWnJd554c/v98MeLlFmuZfhZVvZX35PPuxtQyJI7GIglMkw9YqLNByxLrIBygT/f/bWGdFDqVtbe4dy++mrpFovKL7itJHewIblj+dlq7CCUktIKFufnaPHyXjL0nyR6LeS483AOR+d1ginzUP/NcCktM3eZgJIuHjyGR3TOPq3LvNXgtPhjYVOn9/LGlPcpfQGvB+4b9xx4cQJz5faUO9WPxGeezKOt/ndQ/d8HlbHF54l7d6jIm2sIcgnki2AUZGP4C4YDOXPfdkF8loCSb6fULAX+sbi8DplLnqODnrm68PT/sLq/wYIDPZx22Tvrpea2bU4/lT8By72VTvsEAAA="); // placeholder for compressed html - used by build script

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
  let query = epexBZN + "&start=" + window.start / 1000 + "&end=" + (window.end / 1000 - 3600);

  Shelly.call(
    "http.get",
    {
      url: "https://api.energy-charts.info/price?bzn=" + query,
    },

    function (res, error_code, error_message) {
      let data;

      let error = "";
      if (error_code !== 0) {
        error = "Shelly error: " + error_code + "/" + error_message;
      } else if (res.code !== 200) {
        error = "Server error " + res.code + "/" + res.message;
      } else {
        data = JSON.parse(res.body);
        let expected = (window.end - window.start) / 3600000;
        if (data.price.length !== expected) {
          error = "Data error: " + data.price.length + " records instead of " + expected;
        }
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

      (blockMode ? calculateBlock : calculateNonBlock)(data.unix_seconds, data.price, now + 5000);

      for (let key of Object.keys(times)) {
        let hour = Number(key) + 3600000;
        if (!(hour in times)) times[hour] = null; // set switch off markers
      }

      logAndNotify("Timetable has been updated.", sendSchedule);
      nextUpdate = getHour(nextUpdate, 15) + randomOffset;
    },
  );
}

function calculateBlock(hours, prices, cutoff) {
  let startIndex = 0;
  let lowestSum = Infinity;
  for (let i = 0, j = switchOnDuration; j <= prices.length; i++, j++) {
    let sliceSum = 0;
    prices.slice(i, j).forEach(function (price) {
      sliceSum += price;
    });
    if (sliceSum < lowestSum) {
      startIndex = i;
      lowestSum = sliceSum;
    }
  }

  for (let i = startIndex; i < startIndex + switchOnDuration; i++) {
    setSwitchOn(hours[i] * 1000, priceModifier(prices[i] / 10), cutoff);
  }
}

function calculateNonBlock(hours, prices, cutoff) {
  // do this <switchOnDuration> times:
  // 1. move the element with the lowest price to the end of both arrays
  // 2. pop the elements and set switch ON markers
  let temp;
  for (let i = 0; i < switchOnDuration; i++) {
    for (let j = 1; j < prices.length; j++) {
      if (prices[j] > prices[j - 1]) {
        temp = prices[j];
        prices[j] = prices[j - 1];
        prices[j - 1] = temp;
        temp = hours[j];
        hours[j] = hours[j - 1];
        hours[j - 1] = temp;
      }
    }
    setSwitchOn(hours.pop() * 1000, priceModifier(prices.pop() / 10), cutoff);
  }
}

function setSwitchOn(hour, price, cutoff) {
  if (hour > cutoff && price <= priceLimit) times[hour] = price;
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
