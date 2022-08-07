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

import fs from 'fs';
import http from 'http';

var Jeedom = {}
Jeedom.log = {}

/***************************PID*******************************/

export function write_pid(_file){  
  fs.writeFile(_file, process.pid.toString(), function(err) {
    if(err) {
      Jeedom.log.error("Can't write pid file : "+err);
      process.exit()
    }
  });
}

/***************************LOGS*******************************/

export function log_setLevel(_level){
  var convert = {debug  : 0,info : 10,notice : 20,warning : 30,error : 40,critical : 50,none : 60}
  Jeedom.log.level = convert[_level]
}

export function log_debug(_log){
  if(Jeedom.log.level > 0){
    return;
  }
  console.log('['+(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''))+'][DEBUG] : '+_log)
}

export function log_info(_log){
  if(Jeedom.log.level > 10){
    return;
  }
  console.log('['+(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''))+'][INFO] : '+_log)
}

export function log_error(_log){
  if(Jeedom.log.level > 40){
    return;
  }
  console.log('['+(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''))+'][ERROR] : '+_log)
}

/***************************COM*******************************/

const URL_JEEDOM="http://localhost/core/api/jeeApi.php";

export function send_change_immediate(payload){
  log_debug('Send data to jeedom : '+JSON.stringify(payload));
  
  const req = http.request(
    URL_JEEDOM,
    {
     method: 'POST'
    },
    (res) => {
     res.resume();
     res.on('end', () => {
       if (!res.complete)
         console.error(
           'The connection was terminated while the message was still being sent');
     });
   });
   req.write(JSON.stringify(payload));
   req.end();
   /*
  request.post(URL_JEEDOM+'?apikey='+apiKey, {json: payload}, function(error, response, body){
    if(response.statusCode != 200){
      log_error('Error on send to jeedom : '+JSON.stringify(error));
    }
  }); */
}