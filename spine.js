/**
 * @author     Bob Hardgrove <bhardgrove@gmail.com>
 *
 * @since      Released 2016-12-29
 * Application sends a request to http://x.x.x.x:3000 which is a MySQL DB
 * @todo Filter query and show only a distinct list of hosts
 * Once a 200 OK is received, turn results into an object.
 * Loop through object logging into each device once, and run all commands for that host
 * This script is to be used with a wrapper and syntax is "node spine.js device"
 */

var moment = require('moment');
var fs = require('fs');
var os = require('os');
var request = require('request');
var sshexec = require('ssh-exec');
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
        hosts: ['X.X.X.X:9200', 'X.X.X.X:9200'],
    });
var url = "http://X.X.X.X:3000/all"; // Grab all DB info
var hosts = "http://X.X.X.XX:3000/host" // Grab all hosts

var specificHost = 'http://xx.xx.x.x:3000/all/' + process.argv[2];

var cmdlist;
var obj;

request({
    url: specificHost,
    json: true
}, function dbQuery(error, response, body) {
    if (!error && response.statusCode === 200) {
        obj = assignJsontoObj(body);
        cmdlist = obj.cmd;
        sshToHost(obj.host[0], obj.username[0], obj.password[0], cmdlist);
    }
  })

function sshToHost(host, user, password, cmdlist)
{
    var cmdslist = cmdlist.join("\n");

    sshexec(cmdslist, {
            host: host, 
            user: user, 
            password: password,
            }, 
        showOutput)
}

function showOutput(err, stdout, stderr) 
{
    var data = parseOutputLatency(stdout);
    //console.log(stdout);
  
}

function parseOutputLatency(stdout)
{
    //var size = Object.keys(obj).length;
    var size = obj.cmd.length;

    for (var i = 0; i <= size; i++) {
        var cmd = obj.cmd[i];
        console.log(cmd)
        if(cmd) {
            var ip = cmd.replace("ping ", "");
        }
        //console.log(ip)
        stdout = stdout.replace(/[\r\n]/g, " ");
        stdout = stdout.replace(/[,!-]/g, "");
        var data = {};
        var suc = stdout.match(new RegExp(ip + ".*?rate.is.(\\d*).percent..(\\d*).(\\d*)..[a-z /=]*(\\d*).(\\d*).(\\d*)"));

        data['cmd'] = obj.cmd[i];
        
        if(ip) {
            data['ip'] = ip;
        }
        
        data['suc'] = suc;
        data['raw'] = stdout;
        data['host'] = obj.host[i];
        data['destination'] = obj.destination[i];
        
        if(suc && suc.length >= 1) {
            data['successRate'] = parseInt(suc[1]);
        }
        
        if(suc && suc.length >= 2) {
            data['packetsReceived'] = parseInt(suc[2]);
        }
        
        if(suc && suc.length >= 3) {
            data['packetsSent'] = parseInt(suc[3]);
        }
        
        if(suc && suc.length >= 4) {
            data['min_rtt'] = parseInt(suc[4]);
        }
        
        if(suc && suc.length >= 5) {
            data['avg_rtt'] = parseInt(suc[5]);
        }
        
        if(suc && suc.length >= 6) {
            data['max_rtt'] = parseInt(suc[6]);
        }
        data['tags'] = 'latency, rtt, ping, main_100gb_latency';
        console.log(data);
        //shipToElastic(data);
        shipToElastic5(data);
    }

    return data;
}

function shipToElastic(data)
{
    client.index({  
    index: 'spinejs',
    type: 'latency',
    body: { 
        data,
        timestamp: new Date(),
        }
    }, function elasticResults(err, resp, status) {
        console.log(err);
    });
}


function shipToElastic5(data)
{
    var client = new elasticsearch.Client({
        host: [
        {
         host: 'x.x.x.x',
         auth: 'user:password',
         port: 9200
        }
        
        ]
    });

    var month = moment().month() + 1; // JS Month range default is 0-11
 
    client.index({
        index: 'latency-2017-0' + month,
        type: 'latency',
        body: {
            data,
            timestamp: new Date(),
        }
    }, function elasticResults(err, resp, status) {
        console.log(err);
    });
}


/**
 * Takes the body of the URL and creates an Object
 *
 * @param body
 * @return {object} obj
 */
function assignJsontoObj(body) 
{
    var host = [];
    var username = [];
    var password = [];
    var cmd = [];
    var destination = [];
    var regex = [];
    var output_field_map = [];
    var regex_tag = [];
    var obj = new Object();

    var l = body.length;

    for (var i = 0; i < body.length; i++) {
        host[i] = body[i]['host'];
        username[i] = body[i]['username'];
        password[i] = body[i]['password'];
        cmd[i] = body[i]['cmd'];
        destination[i] = body[i]['destination']
    }

    obj.host = host;
    obj.username = username;
    obj.password = password;
    obj.cmd = cmd;
    obj.destination = destination;

    return obj;
}
