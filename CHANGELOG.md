# Changelog

## 2.0 (2025-02-20)

Major version with some additional features - make sure to read the documentation in full before
upgrading.

* **Changed: API**<br>
The script now uses the API from [energy-charts.info](https://energy-charts.info/) to retrieve EPEX
spot prices. This API offers access to the prices for most EPEX market areas and the script can
now also be used outside of Austria and Germany.

* **New: Non-block Mode**<br>
The new `blockMode` configuration variable can be used to switch to a different operating mode:
Instead of activating power for a contiguous block of hours, the script can now simply activate
power for the cheapest hours within the time window.

* **New: Timetable View**<br>
The script now offers a HTML endpoint that can be opened in the browser to review the calculated
hours and the corresponding prices.

* **New: Custom Price Formula**<br>
It is now possible to define a custom formula to convert the EPEX spot price to the price that has
been agreed with the electricity supplier.

* **New: Selectable Switch ID**<br>
For Shelly devices with more than one switch (2PM, 3PM etc.), it is now possible to select the
switch that will be controlled by the script.

## 1.2 (2024-10-29)

* Change time window calculation so that it also works correctly on days on which the clock is
changed due to daylight saving time.

## 1.1 (2024-10-01)

* Avoid usage of the const keyword as it seems to behave inconsistently on different Shellys

## 1.0 (2024-09-29)

* Transfer script from gist to repo
* Refactor script code for readability and conciseness
* Move documentation from script to README
* Add license
* Add ESLint and Prettier configuration
* Add price limit feature
