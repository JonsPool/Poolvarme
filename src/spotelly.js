// Spotelly Version 1.3
// This script uses EPEX spot hourly energy prices to control the power output of a Shelly device.
// See https://github.com/towiat/spotelly for the full documentation.

// <<<<< START OF CONFIGURATION - change values below to your preference >>>>>

let epexBZN = "AT"; // EPEX Bidding Zone - see documentation for valid codes

let blockMode = true; // set calculation mode
let switchOnDuration = 4; // minimum 1, maximum 24
let timeWindowStartHour = 7; // minimum 0, maximum 23
let timeWindowEndHour = 19; // minimum 0, maximum 23
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

let scriptID = Shelly.getCurrentScriptId();
let limit = priceLimit !== Infinity ? priceModifier(priceLimit) : Infinity;
let times = {};

function logAndNotify(msg, sendTelegram) {
  print(msg);
  if (telegramActive && sendTelegram) {
    Shelly.call("http.post", {
      url: "https://api.telegram.org/bot" + telegramToken + "/sendMessage",
      header: { content_type: "application/json" },
      body: { chat_id: telegramChatID, text: deviceName + ": " + msg },
    });
  }
}

function setSwitch(value) {
  if (Shelly.getComponentStatus("switch", switchID).on === value) return;
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

function getDuration(startHour, endHour) {
  let hours = endHour - startHour;
  return (hours + (hours < 1) * 24) * 3600000;
}

function fetchPrices(window) {
  Shelly.call(
    "http.get",
    {
      url:
        "https://api.energy-charts.info/price?bzn=" +
        epexBZN +
        "&start=" +
        window.start / 1000 +
        "&end=" +
        (window.end / 1000 - 3600), // do not include last hour
    },

    function (res, error_code, error_message) {
      let data;

      let success = true;
      if (error_code !== 0) {
        print("API call failed with error " + error_code + " (" + error_message + ").");
        success = false;
      } else if (res.code !== 200) {
        print("API server responded with " + res.code + " (" + res.message + ").");
        success = false;
      } else {
        data = JSON.parse(res.body);
        let expected = (window.end - window.start) / 3600000;
        if (data.price.length !== expected) {
          print("Retrieved " + data.price.length + " records; expected " + expected + ".");
          success = false;
        }
      }

      if (!success && window.end > Date.now()) {
        // try again after 20 to 22 minutes
        let period = 1200000 + Math.random() * 120000;
        print("Trying again at " + new Date(Date.now() + period).toString());
        Timer.set(period, false, fetchPrices, window);
        return;
      }

      (blockMode ? calculateBlock : calculateNonBlock)(data);

      for (let key of Object.keys(times)) {
        let hour = Number(key);
        let value = times[hour];
        if (value !== null && value > priceLimit) {
          times[hour] = null; // price limit exceeded - set switchoff marker
        } else if (!(hour + 3600000 in times)) {
          times[hour + 3600000] = null; // set switch off indicator if needed
        }
      }

      logAndNotify("Calculation successfully finished.", sendSchedule);
    },
  );
}

function calculateBlock(data) {
  let startIndex = 0;
  let lowestSum = Infinity;
  for (let i = 0, j = switchOnDuration; j <= data.price.length; i++, j++) {
    let sliceSum = 0;
    data.price.slice(i, j).forEach(function (price) {
      sliceSum += price;
    });
    if (sliceSum < lowestSum) {
      startIndex = i;
      lowestSum = sliceSum;
    }
  }

  let cutoff = Date.now() + 1000; // only set switch markers for future hours
  for (let i = startIndex; i < startIndex + switchOnDuration; i++) {
    let timestamp = data.unix_seconds[i] * 1000;
    let price = priceModifier(data.price[i]);
    if (timestamp > cutoff && price <= limit) times[timestamp] = price;
  }
}

function calculateNonBlock(data) {
  // do this <switchOnDuration> times:
  // 1. move the element with the lowest price to the end of both arrays
  // 2. pop the elements and set switch ON markers
  let prices = data.price;
  let hours = data.unix_seconds;
  let cutoff = Date.now() + 1000; // only set switch markers for future hours
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
    let timestamp = hours.pop() * 1000;
    let price = priceModifier(prices.pop() / 10);
    if (timestamp > cutoff && price <= limit) times[timestamp] = price;
  }
}

function calculateWindow() {
  let now = Date.now();
  let thisHour = now - (now % 3600000);
  let start = thisHour + getDuration(new Date(now).getHours(), timeWindowStartHour);
  let end = start + getDuration(timeWindowStartHour, timeWindowEndHour);

  // start time is slightly randomized to spread server load
  Timer.set(Math.random() * 60000, false, fetchPrices, { start: start, end: end });
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
  Shelly.call("Schedule.List", {}, function (result) {
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
      print("Schedule has changed.");
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

startUp();
