/**
 * FIREBASE
 */

function initFirebase() {
  var firebaseConfig = {
    apiKey: "AIzaSyDEHc7ws4S0JeV2HuDvMMjTFqbO-TDkgd8",
    authDomain: "home-dashboard-9604a.firebaseapp.com",
    databaseURL: "https://home-dashboard-9604a.firebaseio.com",
    storageBucket: "home-dashboard-9604a.appspot.com",
  };
  firebase.initializeApp(firebaseConfig);
}

function firebaseUpdate(key, value) {
  console.log("Updating firebase " + key, value);
  firebase.database().ref(key).update(value);
}

function firebasePush(parentKey, value) {
  firebase.database().ref().child(parentKey).push(value);
}

var deviceCache = {};


/**
 * OCCUPANTS
 */


function initOccupants() {
  var occupantList = firebase.database().ref('occupants');

  // keep the graph up-to-date with new speedtests as they're performed
  occupantList.on('value', function(snapshot) {
    var resultList = snapshot.val();
    processOccupantResults(resultList);
  });
}

function processOccupantResults(resultList) {
  var resultArray = [];

  for (let result in resultList) {
    if (resultList.hasOwnProperty(result)) {
      resultList[result].occupantId = result;

      // look up device name if one is associated
      if (resultList[result].hasOwnProperty('deviceId')) {
        var associatedDeviceId = resultList[result].deviceId;
        var associatedDevice = deviceCache[associatedDeviceId];

        if (associatedDevice.hasOwnProperty('friendlyName')) {
          resultList[result].deviceName = associatedDevice.friendlyName;
        } else {
          resultList[result].deviceName = associatedDevice.macAddress;
        }

        // determine whether this user is home or not
        var LEFT_HOME_THRESHOLD = 60 * 15 * 1000;
        console.log("Diff: ", Date.now() - associatedDevice.rawLastSeen, LEFT_HOME_THRESHOLD);
        if (Date.now() - associatedDevice.rawLastSeen < LEFT_HOME_THRESHOLD) {
          resultList[result].presenceHome = true;
        }
      }

      resultArray.push(resultList[result]);
    }
  }

  updateOccupantsDisplay(resultArray);
}

function updateOccupantsDisplay(occupantArray) {
  var templateSource = $("#occupant-profile-template").html();
  var template = Handlebars.compile(templateSource);
  $('#occupant-container').html(template({"occupants": occupantArray}));

  updateOccupantListeners();
}

function updateOccupantListeners() {
  $('button.add-occupant-button').off('click');
  $('button.add-occupant-button').on('click', function() {
    var newOccupantName = prompt('New occupant\'s name?');

    if (newOccupantName) {
      var newOccupant = {
        name: newOccupantName,
      }

      firebasePush('occupants', newOccupant);
    }
  });

  $("button.edit-occupant-name").on('click', function() {
    var occupantName = $(this).data("name");
    var occupantId = $(this).data("occupant-id");

    var newName = prompt('Rename ' + occupantName);

    if (newName) {
      var updatedOccupant = {
        name: newName,
      }

      firebaseUpdate('occupants/' + occupantId, updatedOccupant);
    }
  });

  $("button.remove-occupant").on('click', function() {
    var occupantName = $(this).data("name");
    var occupantId = $(this).data("occupant-id");

    var reallyRemove = confirm('Really remove ' + occupantName + '? There is no undo.');

    if (reallyRemove) {
      firebase.database().ref().child('occupants/' + occupantId).remove();
    }
  });

  $(".device-search").on('keyup', function() {
    var keyword = $(this).val();
    var occupantId = $(this).data('occupant-id');
    var resultsContainer = $('.device-results-container[data-occupant-id="' + occupantId + '"]');

    if ( ! keyword || keyword.length === 0) {
      resultsContainer.html('');
      return;
    }

    var templateSource = $("#device-search-template").html();
    var template = Handlebars.compile(templateSource);

    var matches = searchDeviceCache(keyword);
    resultsContainer.html(template({"matches": matches}));

    updateDeviceSearchListeners(occupantId);
  });
}

function updateDeviceSearchListeners(occupantId) {
  var resultsContainer = $('.device-results-container[data-occupant-id="' + occupantId + '"] .device-search-result');

  resultsContainer.off('click');
  resultsContainer.on('click', function() {
    updateDeviceForOccupant(occupantId, $(this).data('device-id'));
  });
}

function updateDeviceForOccupant(occupantId, deviceId) {
  firebaseUpdate('occupants/' + occupantId, {
    'deviceId': deviceId
  });
}


/**
 * SPEED TESTS
 */


function initSpeedtests() {
  var deviceList = firebase.database().ref('speedtest-results');

  // keep the graph up-to-date with new speedtests as they're performed
  deviceList.on('value', function(snapshot) {
    var resultList = snapshot.val();
    processSpeedtestResults(resultList);
  });
}

function processSpeedtestResults(resultList) {
  var resultArray = [];

  for (var result in resultList) {
    if (resultList.hasOwnProperty(result)) {
      resultArray.push(resultList[result]);
    }
  }

  resultArray = resultArray.splice(-30);
  buildSpeedtestChart(resultArray);
}

function buildSpeedtestChart(speedtestData) {
  var chartContainer = $("#network-chart-container");
  var chartLabels = [];
  var downloadValues = [];
  var uploadValues = [];

  // build date label for every other data point
  for (var i = 0; i < speedtestData.length; i++) {
    if (i % 2) {
      var timeString = moment(speedtestData[i].timestamp).format("h:mm a");
      chartLabels.push(timeString);
    } else {
      chartLabels.push("");
    }
  }

  // build isolated list of download & upload results for graphing
  for (var i = 0; i < speedtestData.length; i++) {
    downloadValues.push(speedtestData[i].download);
    uploadValues.push(speedtestData[i].upload);
  }

  var chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Download Speed",
        fill: false,
        backgroundColor: '#B0D1F1',
        borderColor: '#001429',
        pointRadius: 0,
        data: downloadValues
      }, {
        label: "Upload Speed",
        fill: false,
        backgroundColor: '#89C572',
        borderColor: '#304129',
        pointRadius: 0,
        data: uploadValues
      }
    ]
  }

  Chart.defaults.global.legend.display = false;

  var chartOptions = {
    type: 'line',
    data: chartData
  };

  var chart = new Chart(chartContainer, chartOptions);
}


/**
 * NETWORK DEVICES
 */


function updateDeviceListeners() {
  $("button.edit-device-name").on('click', function() {
    var friendlyName = $(this).data("friendly-name");
    var macAddress = $(this).data("mac-address");
    var promptMessage = null;

    if (friendlyName) {
      promptMessage = "Rename " + friendlyName;
    } else {
      promptMessage = "Rename " + macAddress;
    }

    var newName = prompt(promptMessage);

    if (newName) {
      nameDevice(macAddress, newName);
    }
  });

  $("button.hide-device").on('click', function() {
    var friendlyName = $(this).data("friendly-name");
    var macAddress = $(this).data("mac-address");
    var promptMessage = null;

    if (friendlyName) {
      promptMessage = "Really hide " + friendlyName + "?";
    } else {
      promptMessage = "Really hide " + macAddress + "?";
    }

    var reallyHide = confirm(promptMessage);

    if (reallyHide) {
      hideDevice(macAddress);
    }
  });
}

function watchDevices() {
  var deviceList = firebase.database().ref('devices');

  deviceList.on('value', function(snapshot) {

    var deviceList = snapshot.val();
    deviceCache = deviceList;

    var deviceArray = [];

    for (let macAddress in deviceList) {
      if (deviceList.hasOwnProperty(macAddress)) {
        var deviceInfo = deviceList[macAddress];
        deviceInfo.macAddress = macAddress;
        deviceInfo.rawLastSeen = deviceInfo.lastSeen;
        deviceInfo.lastSeen = moment(deviceInfo.lastSeen).fromNow();
        deviceArray.push(deviceInfo);
      }
    }

    var templateSource = $("#device-profile-template").html();
    var template = Handlebars.compile(templateSource);
    $("#device-container").html(template({"devices": deviceArray}));

    updateDeviceListeners();

  });
}

function nameDevice(macAddress, newName) {
  deviceKey = "devices/" + macAddress
  newData = {
    friendlyName: newName
  };
  firebaseUpdate(deviceKey, newData);
}

function hideDevice(macAddress) {
  deviceKey = "devices/" + macAddress;
  newData = {
    hideInDashboard: true
  };
  firebaseUpdate(deviceKey, newData);
}

function showDevice(macAddress) {
  deviceKey = "devices/" + macAddress;
  newData = {
    hideInDashboard: false
  };
  firebaseUpdate(deviceKey, newData);
}

function searchDeviceCache(keyword) {
  var matches = [];

  keyword = keyword.toLowerCase().trim();
  var searchRegex = new RegExp('.*' + keyword + '.*', "gi");

  for (let device in deviceCache) {
    // ignore hidden devices
    if (deviceCache[device].hideInDashboard) {
      continue;
    }

    deviceCache[device].deviceId = device;

    if (deviceCache[device].hasOwnProperty('friendlyName')) {
      if (deviceCache[device].friendlyName.match(searchRegex)) {
        matches.push(deviceCache[device]);
        continue;
      }
    }

    if (deviceCache[device].macAddress.match(searchRegex)) {
      matches.push(deviceCache[device]);
    }
  }

  return matches;
}


/**
 * INITIALIZATION - WHERE EVERYTHING STARTS
 */


function updateListeners() {
  updateDeviceListeners();
  updateOccupantListeners();
}

initFirebase();
watchDevices();
// initSpeedtests();
initOccupants();
