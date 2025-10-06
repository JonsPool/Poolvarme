# Changelog

## 3.3 (2025-10-06)

This release adds full support for 15-minute prices. Since many contracts continue to work with
hourly prices (which are just the average of the 15-minute prices for each hour), the script
supports both a 60-minute and a 15-minute mode for the time being.

The new configuration variable `hourMode` lets you choose between the two modes:

When set to `true` (the default), the script calculates and displays switch times for full hours
only (based on the average price for each hour).

When set to `false`, switch times are calculated and displayed based on quarter hours. All script
features like time windows, block mode and price limits work as expected and the WebUI timetable
allows manual modifications of the results. There is, however, one difference with regards to the
setup of the script:

In 15-minute mode, the `switchOnDuration` variable defines the duration in quarter hours, not in
hours. So, if you want to set a total duration of e. g. five hours, the correct value for this
variable would be `20` in this mode.

## 3.2 (2025-09-02)

This is an important release and updating to it as soon as possible is strongly recommended for the
following reason:

**AS OF OCTOBER 1, 2025 ALL PREVIOUS VERSIONS OF THE SCRIPT WILL NO LONGER WORK.**

On October 1, day-ahead trading on the European energy exchanges will switch from
60-minute-intervals to 15-minute-intervals. The resulting increase in the number of prices per day
will cause earlier script versions to produce nonsensical results after September 30.

This script version will use hourly prices up to September 30 and 15-minute prices from October 1
onwards.

However, note that 15-minute prices are not fully supported yet. Instead, the script uses these
prices to calculate an average price per hour and this average is then used to calculate the switch
times. Aside from the (internal) average calculation, the script behaves exactly as before.

I intend to add support for 15-minute prices at a later time, but at this point there are several
unknowns both from a technical and a conceptual perspective which will hopefully become clearer
after the switch has actually happened.

## 3.1 (2025-08-04)

This is a minor release with no functional changes. The changelog has two items:

- **Fixed: Daylight Saving Time (DST) Handling**<br>
  Due to limitations of the Shelly time calculation routines, the script would have run out of sync
  with the calendar on the days when the clock is changed to/from DST. This is fixed with this
  version.

- **Changed: Optimizations**<br>
  Due to an improved memory model and general code optimizations, the scipt now uses less memory.
  Peak memory usage has been reduced from ~9.5 kB to ~7.2 kB in the most memory-demanding setup.

## 3.0 (2025-05-09)

Another major update with significant changes and improvements. Make sure to read the documentation
in full before upgrading.

- **New: Improved Startup**<br>
  When the Shelly restarts after a power loss or firmware update, the script will now wait until
  the Shelly has successfully synchronized its system time before starting.

- **New: Improved First Run Behavior**<br>
  When the script is started after 15:00, it will now immediately start the first calculation and
  no longer wait until the next day.

- **Changed: Price Retrieval**<br>
  The script now always downloads the prices for the whole calendar day, not just for the defined
  time window.

- **Changed: Time Window Definition**<br>
  It is no longer possible to define time windows that go over midnight. Time windows must now
  always start and end on the same calendar day.

- **New: Fallback Mode**<br>
  If prices for a given calendar day cannot be retrieved due to connection or API server issues,
  the script can now use (hard-coded) statistical prices to perform the calculation. This should
  ensure that power is delivered for the configured number of hours even if all attempts to get
  price data fail.<br>
  See the description of the new `useFallback` configuration variable for more details.

- **Changed: Display of Next Update Time**<br>
  The time of the next scheduled update is now displayed in a separate status bar on the Web UI.

- **New: Show Count and Average Price**<br>
  The number and average price of the active hours are now displayed in the status bar of the Web
  UI.

- **New: Color Coding**<br>
  The entries in the hour table of the Web UI are now color-coded on a green-yellow-red scale
  depending on the price of the given hour.

- **New: Manual Override**<br>
  The calculated hours can now be modified in the Web UI. Each entry in the hour table has a switch
  that can be used to (de)activate power output for this hour at will.

## 2.0 (2025-02-20)

Major version with some additional features - make sure to read the documentation in full before
upgrading.

- **Changed: API**<br>
  The script now uses the API from [energy-charts.info](https://energy-charts.info/) to retrieve
  EPEX spot prices. This API offers access to the prices for most EPEX market areas and the script
  can now also be used outside of Austria and Germany.

- **New: Non-block Mode**<br>
  The new `blockMode` configuration variable can be used to switch to a different operating mode:
  Instead of activating power for a contiguous block of hours, the script can now simply activate
  power for the cheapest hours within the time window.

- **New: Timetable View**<br>
  The script now offers a HTML endpoint that can be opened in the browser to review the calculated
  hours and the corresponding prices.

- **New: Custom Price Formula**<br>
  It is now possible to define a custom formula to convert the EPEX spot price to the price that has
  been agreed with the electricity supplier.

- **New: Selectable Switch ID**<br>
  For Shelly devices with more than one switch (2PM, 3PM etc.), it is now possible to select the
  switch that will be controlled by the script.

## 1.2 (2024-10-29)

- Change time window calculation so that it also works correctly on days on which the clock is
  changed due to daylight saving time.

## 1.1 (2024-10-01)

- Avoid usage of the const keyword as it seems to behave inconsistently on different Shellys

## 1.0 (2024-09-29)

- Transfer script from gist to repo
- Refactor script code for readability and conciseness
- Move documentation from script to README
- Add license
- Add ESLint and Prettier configuration
- Add price limit feature
