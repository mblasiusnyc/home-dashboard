/**
 * ARP Scanner
 * Used to establish which devices are on the network and log that information
 * in a database so we can try to determine who's home and when in a separate
 * process.
 */

var exec = require('child_process').exec;
var cmd = 'sudo arp-scan -l';

var macRegex = /(\w{2}:\w{2}:\w{2}:\w{2}:\w{2}:\w{2})/;
var ipRegex = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;

exec(cmd, function(error, stdout, stderr) {
  var outputLines = stdout.split('\n');

  for (var i = outputLines.length - 1; i >= 0; i--) {
    var macMatch = outputLines[i].match(macRegex);
    var ipMatch = outputLines[i].match(ipRegex);

    if (macMatch === null || ! macMatch) {
      continue;
    }

    var macAddress = macMatch[0];
    var ipAddress = ipMatch[0];

    console.log("Found " + macAddress + " - " + ipAddress);
  }
});
