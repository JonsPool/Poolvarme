// Spotelly Version 1.3
// This script uses EPEX spot hourly energy prices to control the power output of a Shelly device.
// See https://github.com/towiat/spotelly for the full documentation.

// <<<<< START OF CONFIGURATION - change values below to your preference >>>>>

let epexBZN = "AT"; // EPEX Bidding Zone - see documentation for valid codes

let scheduleTimeSpec = "0 0 15 * * *"; // the schedule for the script execution

let switchOnDuration = 4; // minimum 1, maximum 24
let timeWindowStartHour = 7; // minimum 0, maximum 23
let timeWindowEndHour = 19; // minimum 0, maximum 23
let priceLimit = Infinity; // in cent/kWh

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
let kvsPlanKey = "Awattar-Plan-" + JSON.stringify(scriptID);

function logAndNotify(msg, sendTelegram, kvsKey) {
  print(msg);
  if (typeof kvsKey !== "undefined") {
    Shelly.call("KVS.Set", { key: kvsKey, value: msg });
  }
  if (telegramActive && sendTelegram) {
    Shelly.call("http.post", {
      url: "https://api.telegram.org/bot" + telegramToken + "/sendMessage",
      header: { content_type: "application/json" },
      body: { chat_id: telegramChatID, text: deviceName + ": " + msg },
    });
  }
}

function setPowerSwitch(value) {
  let switchText = value ? "eingeschaltet" : "ausgeschaltet";
  let messageFlag = value ? sendPowerOn : sendPowerOff;
  Shelly.call("Switch.Set", { id: 0, on: value }, function (result, error_code) {
    if (error_code !== 0) {
      logAndNotify("Die Stromzufuhr konnte nicht " + switchText + " werden.", messageFlag);
    } else {
      logAndNotify("Die Stromzufuhr wurde " + switchText + ".", messageFlag);
    }
  });
}

function getDuration(startHour, endHour) {
  let hours = endHour - startHour;
  return (hours + (hours < 1) * 24) * 3600000;
}

function formatDate(timestamp) {
  let date = new Date(timestamp);
  return [
    "am ",
    date.getDate(),
    ".",
    date.getMonth() + 1,
    ".",
    date.getFullYear(),
    " um ",
    date.getHours(),
    ":00",
  ].join("");
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

    function (response, error_code, error_message) {
      let data;

      let success = true;
      if (error_code !== 0) {
        print("API call failed with error " + error_code + " (" + error_message + ").");
        success = false;
      } else if (response.code !== 200) {
        print("API server responded with " + response.code + " (" + response.message + ").");
        success = false;
      } else {
        data = JSON.parse(response.body);
        let expectedRecords = (window.end - window.start) / 3600000;
        if (data.price.length !== expectedRecords) {
          print("Retrieved " + data.price.length + " records; expected " + expectedRecords + ".");
          success = false;
        }
      }

      if (!success) {
        return;
      }

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

      let switchOn = data.unix_seconds[startIndex] * 1000;
      let switchOff = switchOn + switchOnDuration * 3600000;

      let centPerKWH = lowestSum / 10 / switchOnDuration;

      if (centPerKWH > priceLimit) {
        let message = [
          "Der günstigste Durchschnittspreis beträgt",
          centPerKWH.toFixed(2),
          "cent/kWh und liegt über dem Schwellenwert von",
          priceLimit.toFixed(2),
          "cent/kWh. Die Stromzufuhr wird im aktuellen Zeitfenster nicht eingeschaltet.",
        ].join(" ");
        logAndNotify(message, sendSchedule, kvsPlanKey);
        return;
      }

      let message = [
        "Die Stromzufuhr wird",
        formatDate(switchOn),
        "ein- und",
        formatDate(switchOff),
        "ausgeschaltet. Der durchschnittliche Marktpreis ist",
        centPerKWH.toFixed(2),
        "cent/kWh.",
      ].join(" ");
      logAndNotify(message, sendSchedule, kvsPlanKey);

      let now = Date.now();
      Timer.set(switchOn - now, false, setPowerSwitch, true);
      Timer.set(switchOff - now, false, setPowerSwitch, false);
    },
  );
}

// eslint-disable-next-line no-unused-vars
function calculate() {
  let now = Date.now();
  let start = now - (now % 3600000) + getDuration(new Date(now).getHours(), timeWindowStartHour);
  let end = start + getDuration(timeWindowStartHour, timeWindowEndHour);

  print(
    JSON.stringify({
      scheduleTimeSpec: scheduleTimeSpec,
      switchOnDuration: switchOnDuration,
      timeWindowStartHour: timeWindowStartHour,
      timeWindowEndHour: timeWindowEndHour,
      systemTime: Date.now(),
      calculatedStart: start,
      calculatedEnd: end,
    }),
  );

  fetchPrices({ start: start, end: end });
}

function createOrUpdateSchedule() {
  Shelly.call("Schedule.List", {}, function (result) {
    let scheduleMethod = "Schedule.Update";
    let scheduleObject = null;
    let code = "calculate()";

    for (let job of result.jobs) {
      let call = job.calls[0];
      if (!(call.method.toLowerCase() === "script.eval" && call.params.id === scriptID)) {
        continue; // this is not our schedule - skip
      }
      if (job.timespec === scheduleTimeSpec && call.params.code === code) {
        return; // this IS our schedule and it matches the configuration - we are done
      }
      print("Schedule has changed.");
      scheduleObject = job;
      scheduleObject.timespec = scheduleTimeSpec;
      call.params.code = code;
      break;
    }

    if (scheduleObject === null) {
      // schedule does not exist - create it
      scheduleMethod = "Schedule.Create";
      scheduleObject = {
        enable: true,
        timespec: scheduleTimeSpec,
        calls: [{ method: "Script.Eval", params: { id: scriptID, code: code } }],
      };
    }

    Shelly.call(scheduleMethod, scheduleObject);
  });
}

createOrUpdateSchedule();
