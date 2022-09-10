/* This file is part of Jeedom.
*
* Jeedom is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* Jeedom is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with Jeedom. If not, see <http://www.gnu.org/licenses/>.
*/

const fs = require('fs');
const http = require('http');

var Jeedom = {}
Jeedom.log = {}

/***************************PID*******************************/

exports.write_pid = function(_file){  
  fs.writeFile(_file, process.pid.toString(), function(err) {
    if(err) {
      Jeedom.log.error("Can't write pid file : "+err);
      process.exit()
    }
  });
};

/***************************LOGS*******************************/
function getLogTime(){
  return '['+(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''))+']';
}

exports.JeedomLog = class {    

  constructor(_level){            
      var convert = {debug  : 0,info : 10,notice : 20,warning : 30,error : 40,critical : 50,none : 60}
      this.level = convert[_level]    
  }

  debug(_log){
    if(this.level > 0){
      return;
    }
    console.log(getLogTime()+'[DEBUG] : '+_log+'\r\n');
  }

  info(_log){
    if(this.level > 10){
      return;
    }
    console.log(getLogTime()+'[INFO] : '+_log+'\r\n');
  }

  error(_log){
    if(this.level > 40){
      return;
    }
    console.log(getLogTime()+'[ERROR] : '+_log+'\r\n');
  }
};

/***************************COM*******************************/

exports.executeApiCmd =  function(jeedomUrl, payload){ 
  return new Promise((resolve, reject) => {    
    const req = http.request(
      jeedomUrl,
      { method: 'POST' },
      (response) => {
       let data = '';
       response.on('data', chunk => data += chunk); // consume the response body in data
       response.once('end', () => { resolve(data); });       
     });
     req.once('error', err => {
        console.log(getLogTime()+'[ERROR] : Error in request', (err.message || err));
        reject(err);
     });
     req.write(JSON.stringify(payload));
     req.end();  
  });
};
