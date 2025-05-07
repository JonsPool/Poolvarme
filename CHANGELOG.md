# Changelog

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
