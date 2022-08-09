import { FtpSrv, FileSystem } from 'ftp-srv'; // https://github.com/QuorumDMS/ftp-srv
import { readableNoopStream, writableNoopStream} from 'noop-stream';
import argsParser from 'args-parser';
import { networkInterfaces } from 'os';
import { Netmask } from 'netmask';
import { JeedomLog, write_pid, executeApiCmd } from './jeedom.mjs';

const JEEDOM_URL="http://localhost/core/api/jeeApi.php";

var ip2lastAlertTime = {};

const args = argsParser(process.argv);
if (args.log === undefined){
    console.log("log argument is missing");
}
if (args.logLevel === undefined){
    console.log("logLevel argument is missing");    
}

const log = new JeedomLog(args.log, args.logLevel);


log.info("Server started with: "+process.argv);

function usage(){
    log.info("node server.js --pidFile=/tmp/campat.pid --port=8090 --user=patrouilleur --pwd=patrouilleur --apikey=XXXXXXX --ip=0.0.0.0 --logLevel=debug");    
    process.exit(1);
}

if (args.port === undefined){
    log.error("port argument is missing");    
    usage();
}
if (args.user === undefined){
    log.error("user argument is missing");
    usage();
}
if (args.pwd === undefined){
    log.error("pwd argument is missing");
    usage();
}
if (args.ip === undefined){
    log.error("ip argument is missing");
    usage();
}
if (args.pidFile === undefined){
    log.error("pidFile argument is missing");
    usage();
}
if (args.apikey === undefined){
    log.error("apikey argument is missing");
    usage();
}
if (args.pluginId === undefined){
    log.error("pluginId argument is missing");
    usage();
}

write_pid(args.pidFile);


log.debug("Server config port: "+args.port+" user: "+args.user);

////////////////////////////////////////////////
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
////////////////////////////////////////////////
const ftpServer = new FtpSrv({
    url: "ftp://"+ args.ip + ":" + args.port,    
    anonymous:false,
    tls: false,
    greeting : [ "Welcome to CamPatrouille" ],
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
    log.info('CamPatrouille server is started')
});


// function for the jeedom equipment
function updateAttributeWithValue(equipmentId, attributeName, attributeNewValue){   
    log.debug("Search the command info to update for equipment Id: "+ equipmentId); 
    return executeApiCmd(JEEDOM_URL, {
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
                return executeApiCmd(JEEDOM_URL, {
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
    log.debug("Get all equipments");
    return executeApiCmd(JEEDOM_URL, {
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
            return executeApiCmd(JEEDOM_URL,
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
                            "alertInterval": 60 
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

    write(fileName){        
        log.info("Received new file " + this.current_dir + fileName + " from ip=" + this.clientIP);            
        getOrCreateEquipement(this.clientIP)
        .then((equip, error) => {
            if (error === undefined){
                const lastTime = ip2lastAlertTime[this.clientIP];
                const currentTime = Date.now();
                let sendUpdate=true;
                if (lastTime === undefined){
                    ip2lastAlertTime[this.clientIP]=currentTime;
                }
                else {
                    const diffInSeconds = Math.floor((currentTime - lastTime)/1000);                    
                    if (diffInSeconds < equip.configuration.alertInterval){
                        log.info("Alert not sent from ip="+this.clientIP+" since the last one was less than "+diffInSeconds+" seconds");
                        sendUpdate=false;
                        return undefined;
                    }
                }
                ip2lastAlertTime[this.clientIP]=currentTime;
                return updateAttributeWithValue(equip.id, "Alert", this.current_dir + fileName);    
            }
            else {
                log.error("Error in getOrCreateEquipement"+ error);
                return undefined;
            } 
        })
        .then((result, error) => {
            if (result !== undefined){
                log.debug("Command updated");
            }
            else if (error !== undefined){
                log.error("Error in updateFileUploaded "+ error)
            }
        })
        .catch(e => log.error(e));

        return writableNoopStream();
    }

    read(fileName){        
        log.debug("FTPSrv read "+fileName);
        return readableNoopStream({size: 10});
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
  
}
 