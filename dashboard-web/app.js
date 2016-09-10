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
  firebase.database().ref(key).update(value);
}

function firebasePush(parentKey, value) {
  firebase.database().ref().child(parentKey).push(value);
}

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

  for (var result in resultList) {
    if (resultList.hasOwnProperty(result)) {
      resultList[result].occupantId = result;
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
    var deviceArray = [];

    for (var macAddress in deviceList) {
      if (deviceList.hasOwnProperty(macAddress)) {
        var deviceInfo = deviceList[macAddress];
        deviceInfo.macAddress = macAddress;
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


/**
 * INITIALIZATION - WHERE EVERYTHING STARTS
 */


function updateListeners() {
  updateDeviceListeners();
  updateOccupantListeners();
}

initFirebase();
watchDevices();
initSpeedtests();
initOccupants();
