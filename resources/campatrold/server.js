// https://github.com/QuorumDMS/ftp-srv
const {FtpSrv, FileSystem} = require('ftp-srv');
const args = require('args-parser')(process.argv);
const { networkInterfaces } = require('os');
const { Netmask } = require('netmask');
const { Readable, Writable } = require('stream');
const { JeedomLog, write_pid, executeApiCmd } = require('./jeedom.js');
const fs = require('fs');
const findRemoveSync = require('find-remove')

const JEEDOM_CALLBACK_URL="http://127.0.0.1/core/api/jeeApi.php";

var ip2lastAlertTime = {};
var ip2IntervalTime = {};


if (args.logLevel === undefined){
    console.log("logLevel argument is missing");    
}

const log = new JeedomLog(args.logLevel);


log.info("Server started");


if (args.port === undefined){
    log.error("port argument is missing");    
    process.exit(1);
}
if (args.user === undefined){
    log.error("user argument is missing");
    process.exit(1);
}
if (args.pwd === undefined){
    log.error("pwd argument is missing");
    process.exit(1);
}
if (args.ip === undefined){
    log.error("ip argument is missing");
    process.exit(1);
}
if (args.pidFile === undefined){
    log.error("pidFile argument is missing");
    process.exit(1);
}
if (args.apikey === undefined){
    log.error("apikey argument is missing");
    process.exit(1);
}
if (args.pluginId === undefined){
    log.error("pluginId argument is missing");
    process.exit(1);
}
if (args.alertsDir === undefined){
    log.error("alertsDir argument is missing");
    process.exit(1);
}

const OUTPUT_FILE_DIR=args.alertsDir+"/";


write_pid(args.pidFile);


log.debug("Server config port: "+args.port+" user: "+args.user);


const nets = networkInterfaces();
function getNetworks() {
   let networks = {};
   for (const name of Object.keys(nets)) {
       for (const net of nets[name]) {
           if (net.family === 'IPv4' && !net.internal) {
               networks[net.address + "/24"] = net.address
           }
       }
   }
   return networks;
}

const resolverFunction = (address) => {
   // const networks = {
   //     '$GATEWAY_IP/32': `${public_ip}`, 
   //     '10.0.0.0/8'    : `${lan_ip}`
   // } 
   const networks = getNetworks();
   for (const network in networks) {
       if (new Netmask(network).contains(address)) {
           return networks[network];
       }
   }
   return "127.0.0.1";
}

const ftpServer = new FtpSrv({
    url: "ftp://"+ args.ip + ":" + args.port,    
    anonymous:false,
    tls: false,
    greeting : [ "Welcome to CamPatrol" ],
    pasv_url: resolverFunction
});

ftpServer.on('login', (data, resolve, reject) => {
    // the client address IP is present at two different places
    let ip = data?.connection?.log?.fields?.ip;
    const ip2 = data?.connection?.commandSocket?._peername?.address;
    if (ip === undefined){
        ip = ip2;
    }
     
    if(data.username === args.user && data.password === args.pwd){
        log.debug("Connection successful ");
        return resolve({ fs: new MyAlerterFileSystem(ip)});
    }
    return reject({
         name: "401",
         message: "Invalid username or password",
    });
});

ftpServer.on ( 'client-error', (connection, context, error) =>
{
  log.error ( 'connection: ' +  connection );
  log.error ( 'context: '    +  context );
  log.error ( 'error: '      +  error );
});

ftpServer.listen().then(() => {
    log.info('CamPatrol server is started')
});


// function for the jeedom equipment
function updateAttributeWithValue(equipmentId, attributeName, attributeNewValue){   
    log.debug("Search the command info to update for equipment Id: "+ equipmentId); 
    return executeApiCmd(JEEDOM_CALLBACK_URL, {
        "jsonrpc": "2.0",        
        "method": "eqLogic::fullById",
        "params": {
            "apikey": args.apikey,
            "plugin": args.pluginId,
            "eqType_name": args.pluginId,
            "id": equipmentId
        }
    })
    .then((response, error) =>{
        if (error !== undefined){
            log.error("Error in updateAttributeWithValue "+error);            
        }
        else {     
            var cmdToUpdt = undefined;       
            JSON.parse(response).result.cmds.forEach(cmd => {                
                if (cmd.logicalId === attributeName) {
                    cmdToUpdt = cmd;
                }
            });
            if (cmdToUpdt === undefined){
                log.error("Command "+attributeName+" not found in equipement: "+response);
                return undefined;
            }
            else{                
                log.debug("Update "+attributeName+" command ID: "+ cmdToUpdt.id +"  with: "+ attributeNewValue);                 
                return executeApiCmd(JEEDOM_CALLBACK_URL, {
                    "jsonrpc": "2.0",        
                    "method": "cmd::event",
                    "params": {
                        "apikey":  args.apikey,
                        "plugin": args.pluginId,
                        "eqType_name": args.pluginId,
                        "id": cmdToUpdt.id,
                        "value": attributeNewValue                        
                    }
                });
            }
        }
    });
}

function getEquipement(clientIP){
    log.debug("Get all equipments of "+args.pluginId);
    return executeApiCmd(JEEDOM_CALLBACK_URL, {
        "jsonrpc": "2.0",        
        "method": "eqLogic::all",
        "params": {
            "apikey": args.apikey,
            "plugin": args.pluginId
        }
    })
    .then((response, reject) =>{        
        if (reject === undefined){
            log.debug("Search equipment with IP: "+clientIP);            
            var eqFound = undefined;
            JSON.parse(response).result.forEach(eq => { 
                if (eq.logicalId === clientIP){
                    log.debug("Equipment found! "+JSON.stringify(eq));
                    eqFound =eq;                    
                }
            });            
            return eqFound;
        }
        
        log.debug("No equipment found");
        return undefined;
    });
}



function getOrCreateEquipement(clientIP) {
    return getEquipement(clientIP)
    .then((equip, error) => {        
        if (error !== undefined) {
            log.error("Error when getting equipment" + error);
            return undefined;
        }
        if (equip === undefined){
            log.debug("Create equipment with IP: "+ clientIP);
            // crée l'équipement
            return executeApiCmd(JEEDOM_CALLBACK_URL,
                {
                    "jsonrpc": "2.0",    
                    "method": "eqLogic::save",
                    "params": {
                        "apikey": args.apikey,
                        "plugin": args.pluginId,
                        "eqType_name": args.pluginId,
                        "name": clientIP,                        
                        "object_id": clientIP,
                        "logicalId": clientIP,
                        "category": {
                            "security": "1"
                        },
                        "isVisible": "0",
                        "isEnable": "1",
                        "configuration" : { 
                            "alertInterval": 60,
                            "nbSavedFiles": 0
                        },
                        "cmd": 
                            [
                                {
                                    "name":"Alert",   
                                    "logicalId": "Alert",
                                    "display":{ 
                                        "icon":"",
                                        "invertBinary":"0"
                                    },
                                    "value":"",
                                    "currentValue": "",
                                    "type":"info",
                                    "subType":"string",
                                    "isVisible":"1",
                                    "isHistorized":"0",                                    
                                    "unite":""
                                }
                            ]
                    }
                }
            )
            .then((response, error) => {
                if (error !== undefined) {
                    log.error("Error when creating equipment" + error);
                    return undefined;
                }
                else {
                    log.debug("Response of equipment creation: " + response);
                    return JSON.parse(response).result;
                }
            });
        }    
        else {
            log.debug("The equipment found is: "+JSON.stringify(equip));
            return equip;
        } 
    });
}


class MyAlerterFileSystem extends FileSystem{    

    constructor(ip){
        super();
        this.clientIP = ip;        
        this.current_dir = "/";
    }

    get(fileName) {      
        log.debug("FTPSrv Get "+fileName);
        if (fileName === '.'){
            return Promise.resolve({
                isDirectory: () => true
            });
        }
        else{
            return Promise.resolve({});
        }
    }
    
    currentDirectory(){
        log.debug("FTPSrv currentDirectory");
        return "/";
    }
  
    list(path) {        
        log.debug("FTPSrv list " + path);
        return Promise.resolve([]);
    }

    chdir(path){        
        log.debug("FTPSrv chdir " + path);
        if (path === undefined || path === ""){
            this.current_dir = "/";
        }        
        else if (!path.endsWith("/")){
            this.current_dir = path +"/";
        }
        else{
            this.current_dir = path;
        }
        if (this.current_dir.startsWith(".")){            
            this.current_dir = this.current_dir.substring(0);            
        }
        if (this.current_dir.startsWith("//")){
            this.current_dir = this.current_dir.substring(0);
        }
        if (!this.current_dir.startsWith("/")){
            this.current_dir = "/" + this.current_dir;
        }
        return Promise.resolve(this.current_dir);
    }

    isTooEarly(alertInterval){
        if (alertInterval !== undefined){
            const lastTime = ip2lastAlertTime[this.clientIP];
            const currentTime = Date.now();
            if (lastTime !== undefined){
                const diffInSeconds = Math.floor((currentTime - lastTime)/1000);                     
                if (diffInSeconds < alertInterval){
                    log.info("Alert not sent from ip="+this.clientIP+" since the last one was less than "+alertInterval+" seconds");
                    return true;
                }
            }
        }
        return false;
    }

    async write(fileName){        
        log.info("Received new file " + this.current_dir + fileName + " from ip=" + this.clientIP);              

        // if we already have the interval time for this client IP
        // we can check and avoir a call to the getOrCreateEquipment        
        if (this.isTooEarly(ip2IntervalTime[this.clientIP])){            
            return this.noOpWritable();
        }

            
        var equip = await getOrCreateEquipement(this.clientIP)
                    .catch(e => log.error("Error when getting equipement "+e));
                    
        if (equip !== undefined){
            // update the interval time if it changes or not yet in the map
            ip2IntervalTime[this.clientIP] = equip.configuration.alertInterval;                
            if (this.isTooEarly(equip.configuration.alertInterval)){
                return this.noOpWritable();
            }
            
            const currentTime = Date.now();
            ip2lastAlertTime[this.clientIP]=currentTime;
            
            var outDir = OUTPUT_FILE_DIR+this.clientIP+"/";
            
            log.debug("Delete files after: "+ equip.configuration?.filesMaxAge);
            if (equip.configuration?.filesMaxAge !== undefined && equip.configuration?.filesMaxAge > 0){
                log.debug("File needs to be stored and remove files oldest than "+equip.configuration?.filesMaxAge+" seconds");                

                var filePath = outDir+fileName;
                var downloadUrl = 'core/php/downloadFile.php?pathfile='+encodeURI(filePath);
                
                fs.mkdirSync(outDir, { recursive: true });
                const writeStream = this.writeTo(filePath);
                writeStream.on('error', (error) => {
                    log.error("Error when writting file: "+filePath+" send an alert without storing file. "+error);
                    this.updateAlert(equip.id, downloadUrl);
                });
                writeStream.on("finish", () => {
                    log.debug("File writting is finished: "+filePath);
                    this.updateAlert(equip.id, downloadUrl);
                });
                writeStream.on("end", () => {
                    log.debug("File writting is ended: "+filePath);
                    this.updateAlert(equip.id, downloadUrl);
                });
                
                log.debug("Deleting old files");
                findRemoveSync(OUTPUT_FILE_DIR+this.clientIP, {
                    age: { seconds: equip.configuration?.filesMaxAge },
                    files: "*.*",
                    dir: "*"
                });                

                return writeStream;
            }
            else {
                log.debug("No file to store");
                this.updateAlert(equip.id, this.current_dir + fileName);                
                findRemoveSync(outDir, {                    
                    dir: '*', 
                    files: '*.*' 
                });
                return this.noOpWritable();
            }
        }
    }


    updateAlert(equipId, filePath){
        updateAttributeWithValue(equipId, "Alert", filePath)
        .then((result, error) => {
            if (result !== undefined){
                log.debug("Command updated");
            }
            else if (error !== undefined){
                log.error("Error in updateFileUploaded "+ error)
            }
        })
        .catch(e => log.error(e));   
    }


    read(fileName){        
        log.debug("FTPSrv read "+fileName);
        return Readable.from(['camPatrol plugin file']);        
    }

    delete(path) {        
        log.debug("FTPSrv delete "+path);
    }

    mkdir(path){                
        log.debug("FTPSrv mkdir "+path);        
    }

    rename(from, to){           
        log.debug("FTPSrv rename "+from+" => "+to);     
    }

    chmod(path, mode){        
        log.debug("FTPSrv chmod "+path+" => "+mode);     
    }

    getUniqueName(){        
        log.debug("FTPSrv getUniqueName");     
        return "tmp";
    }

    noOpWritable(){
        return new Writable({           
            write(chunk, encoding, callback) {
                setImmediate(callback);
            },
        });
    }
  
    writeTo(file) {
        log.debug("Writting file to: "+file+" with fs: "+fs);
        return fs.createWriteStream(file);
    }
}
 