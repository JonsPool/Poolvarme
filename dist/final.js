// Spotelly Version 3.2
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
let html = atob("H4sIAAAAAAACA31Uh7rjphJ+FS63iRjJ9m622UInvWd771iMj8hBoE+M2+f1u2eQ7fTEBZjefij/ZUKNuw5Yg62ryrQyo1Hni5hjAy0oo/urqmwBNfOa6LWFTRd6ZHXwCB4V31iDjTKwtjXkAyGtt2i1y2OtHagpr0pn/RVreliqBrGLs/G4Nr74KRpwdt0XHnDsu3a8CAEj9rr75EZxvbg9NjbiuI7xV0HRWl8Qh/XgVMSdg9gAYFWiRQfVoy4gOLcrx0e6XASzY7XTMSpu8qWDLUtLXge3aj1D2GJeg0foOZWprT8rD1qXfdjkU9Zifp21i/wG6aBeODgrHYlhzRehN9CDOZGUre2I2uR6hYG122FPDhrQhlmjGjoP6dF5UZXjwY72lEVVLkOgpM6BFpd519tW9zu2tFswFA0xtDzZLqsy1hQMKwfIVmpjvQmbwoVaow2+SG0veuicriHj8dQhLnmaNBeyVhlKEKoiMKxa8FhcAn7pIB0/231rMhSF9R76bx7/+IMCaRWqysOGfaERkhDDDyFN+hGV7C8pxJrLPTknBs1nxmMTeuQSbXvmtGDsquUHIVvVqGpfZ7zh8n2JfeoPo+HETnv1cXU/bKgJ91bYrZA9JgfHji9Dzx5tLNYN+8++KeLhZFmllNL+TVj1aa9xfPWsSad7/r2YpwZFNZGG/l5xPrfLrCm02CdBregogyJOR0eCmu4yKhUvLu7qu0L+qLEh3jYrioLEQkinjjzrz7x5sqPsvtR1k53aul/rngF5DK/gjdQqg//9LzMjhTKORkLaSN6zIC74RLLJfyWbTib/5bPptclH2TTPMHdinAVaxYgfhZLdIA1Brt4PN0BxaljoZ6yJLvvPXh/EnL+f+5E6NdSwxKz+s7dZLYroLOFgIqcTcfhr2XQqpzd/FZ4wOFwV8IZ0scDwVYJhdm1Qq0pj1yc1Kr7N4zCbqrSe5vZbQd1AfZUf2enhUQNjEbYUCS74QIHhM84PLPjPKZ0rxZGKqg+SYWNjcVIRnG4KRa3ey3qkrt+EGwdxIBgtuPQfPvBT4b8i6ZREl9+o7gZ2RP48DQbVGcoSaUZkfKaz4SJ8tXLuBeg+E3KgfwwemzMxqIlRNr1RqoGRcBczgsb0hkh0giwpNEU/p+SWhPFH4KBGMDOqOB7YYCDZp2vo9SUkZhYvzDjOJuK3TWYnIC/66i7NgT3pqARSfz+yGQpxoNzPaFsCEvZWEi/2LWATzIzfv/foMZfprZl99+je3SIOF9Uud9m+maEMM6DmzX5R//rLx/xA4RvwA/7pnQ4+E79y2gyJqnUKROSx7f/Ycz5KWc5PT1PwLmijsByfHq6fAYKWZYmJBgAA"); // placeholder for compressed html - used by build script

function next() {
  let info = Timer.getInfo(timH);
  if (info === undefined) return 0;
  return Math.floor(Date.now()) + info.next - Shelly.getUptimeMs();
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

function getP() {
  let now = new Date();
  let strt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
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
  let dsix = prc.length;

  let err = "";
  if (errc !== 0) {
    err = "Shelly error: " + errc + "/" + errm;
  } else if (res.code !== 200) {
    err = "Server error " + res.code + "/" + res.message;
  } else {
    res.headers = null; // free up RAM to reduce peak memory usage
    let prcs = JSON.parse(res.body).price;
    res.body = null;
    let day = new Date(strt);
    if (day.getFullYear() === 2025 && day.getMonth() < 9) {
      for (let p of prcs) prc.push(priceModifier(p / 10));
    } else {
      // 15-minute prices are live; use average hourly price for now
      for (let i = 0; i < prcs.length; i += 4) {
        let psum = 0;
        for (let j = i; j < i + 4; j++) psum += prcs[j] / 10;
        prc.push(priceModifier(parseFloat((psum / 4).toFixed(3))));
      }
    }
  }

  if (err) {
    if (strt > Date.now() + 1800000) {
      // retry only if day starts at least 30 minutes in the future
      timH = Timer.set(1200000, false, getP);
      console.log(err, "Trying again at", next());
      return;
    }

    if (!useFallback) return;

    // no prices retrieved and useFallback is true - do the fallback
    fbm = true;
    for (let p of [
      7.56, 6.98, 6.73, 6.53, 6.63, 7.33, 8.97, 10.16, 9.74, 8.21, 6.87, 6.0, 5.35, 5.02, 5.28,
      6.38, 7.85, 9.75, 11.16, 12.1, 11.58, 10.02, 9.01, 7.97,
    ])
      prc.push(p);
  }

  if (anch === 0) anch = strt;
  on.length = prc.length;

  let wsix = dsix + timeWindowStartHour;
  let weix = timeWindowEndHour === 0 ? prc.length : prc.length - (24 - timeWindowEndHour);
  let dur = Math.min(switchOnDuration, prc.length - dsix);

  if (blockMode) {
    let sidx = 0;
    let lSum = Infinity;
    for (let i = wsix, j = wsix + dur; j < weix; i++, j++) {
      let sSum = 0;
      for (let h = i; h < j; h++) sSum += prc[h];
      if (sSum < lSum) {
        sidx = i;
        lSum = sSum;
      }
    }
    for (let i = sidx; i < sidx + dur; i++) on[i] = true;
  } else {
    for (let i = 0; i < dur; i++) {
      let midx;
      let mprc = Infinity;
      for (let j = wsix; j < weix; j++) {
        if (prc[j] < mprc && !on[j]) {
          midx = j;
          mprc = prc[j];
        }
      }
      on[midx] = true;
    }
  }

  for (let i = dsix; i < prc.length; i++) {
    if (fbm) prc[i] = NaN;
    if (!fbm && prc[i] >= priceLimit) delete on[i];
  }

  log("Timetable has been updated.", sendSchedule);
}

// eslint-disable-next-line no-unused-vars
function hrly() {
  let now = Date.now();
  let hour = now - (now % 3600000);
  if (hour === anch) {
    prc.splice(0, 1)[0];
    set(Boolean(on.splice(0, 1)[0]));
    anch = prc.length === 0 ? 0 : anch + 3600000;
  }

  if (new Date().getHours() === 15) timH = Timer.set(rOff, false, getP);
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
    let idx = (data.h - anch) / 3600000;
    if (idx >= 0 && idx < prc.length) data.o ? (on[idx] = true) : delete on[idx];
  }
  res.headers = [["Content-Type", "application/json"]];
  res.body = JSON.stringify({ a: anch, n: next(), s: switchID, p: prc, o: on, r: rOff });
  res.code = 200;
  res.send();
}

function init() {
  if (Shelly.getComponentStatus("sys").unixtime === null) {
    console.log("Time not synchronized, waiting one second...");
    Timer.set(1000, false, init);
    return;
  }

  if (new Date().getHours() >= 15) timH = Timer.set(0, false, getP);

  HTTPServer.registerEndpoint("spotelly", spEP);
  HTTPServer.registerEndpoint("data", dtEP);

  Shelly.call("Schedule.List", {}, function (res) {
    let call = { method: "Script.Eval", params: { id: Script.id, code: "hrly()" } };
    let schd = { enable: true, timespec: "0 0 * * * *", calls: [call] };

    for (let job of res.jobs) {
      let cll = job.calls[0];
      if (cll.method.toLowerCase() !== "script.eval" || cll.params.id !== Script.id) continue;
      if (job.timespec === schd.timespec && cll.params.code === call.params.code) return;
      schd.id = job.id;
      break;
    }

    Shelly.call("id" in schd ? "Schedule.Update" : "Schedule.Create", schd);
  });
}

init();
