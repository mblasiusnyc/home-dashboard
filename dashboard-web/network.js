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
 * AUTHENTICATION
 */

function initAuth() {
  firebase.auth().onAuthStateChanged(function(user) {
    if ( ! user) {
      window.location.href="/login.html";
    }
  });
}


/**
 * UI
 */


function initUI() {
  $('#signout').on('click', function(event) {
    event.preventDefault();
    firebase.auth().signOut();
  });
}


/**
 * INITIALIZATION - WHERE EVERYTHING STARTS
 */


 initFirebase();
 initAuth();
 initUI();
 initSpeedtests();
