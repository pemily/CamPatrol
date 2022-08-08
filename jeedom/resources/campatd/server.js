import { FtpSrv, FileSystem } from 'ftp-srv'; // https://github.com/QuorumDMS/ftp-srv
import { readableNoopStream, writableNoopStream} from 'noop-stream';
import { request } from 'http';
import argsParser from 'args-parser';
import dns from 'dns';
import { JeedomLog, write_pid, executeApiCmd } from './jeedom.mjs';

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

const ftpServer = new FtpSrv({
    url: "ftp://"+ args.ip + ":" + args.port,    
    anonymous:false,
    tls: false,
    greeting : [ "Welcome to CamPatrouille" ]
});

ftpServer.on('login', (data, resolve, reject) => {
    // the client address IP is present at two different places
    let ip = data?.connection?.log?.fields?.ip;
    const ip2 = data?.connection?.commandSocket?._peername?.address;
    if (ip === undefined){
        ip = ip2;
    }
     
    if(data.username === args.user && data.password === args.pwd){
        log.info("Connection successful ");
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

function genEquipmentId(clientIP, clientHost){
    if (clientHost === "" || clientHost === undefined){
        return clientIP;
    }
    return clientHost;
}

function updateAttributeWithValue(equip, attributeName, attributeNewValue){   
    log.debug("Search the command info to update for equipment Id: "+ equip.id); 
    return executeApiCmd( {
        "jsonrpc": "2.0",        
        "method": "eqLogic::fullById",
        "params": {
            "apikey": args.apikey,
            "plugin": args.pluginId,
            "eqType_name": args.pluginId,
            "id": equip.id
        }
    })
    .then((response, error) =>{
        if (error !== undefined){
            log.error("Error in updateFileUploaded "+error);            
        }
        else {
            log.error("RESPONSE SEARCH CMD" + response);
            JSON.parse(response).result.cmds.forEach(cmd => {                
                if (cmd.name === attributeName) {
                    log.debug("Update "+attributeName+" command ID: "+ cmd.id +"  with: "+ attributeNewValue); 
                    return executeApiCmd({
                        "jsonrpc": "2.0",        
                        "method": "cmd::event",
                        "params": {
                            "apikey":  args.apikey,
                            "plugin": args.pluginId,
                            "eqType_name": args.pluginId,
                            "id": cmd.id,
                            "value": attributeNewValue
                        }
                    });
                }
            });
        }
    });
}

function getEquipement(clientIP, clientHostname){
    log.debug("Get all equipments");
    return executeApiCmd( {
        "jsonrpc": "2.0",        
        "method": "eqLogic::all",
        "params": {
            "apikey": args.apikey,
            "plugin": args.pluginId
        }
    })
    .then((response, reject) =>{        
        if (reject === undefined){
            log.debug("Search equipment with IP: "+clientIP +" and hostname: "+clientHostname);
            const equipementId = genEquipmentId(clientIP, clientHostname);
            
            var eqFound = undefined;
            JSON.parse(response).result.forEach(eq => { 
                if (eq.logicalId === equipementId){
                    log.debug("Equipment found! "+JSON.stringify(eq));
                    eqFound =eq;                    
                }
            });
            log.error("Equipment found exit! "+JSON.stringify(eqFound));
            return eqFound;
        }
        
        log.debug("No equipment found");
        return undefined;
    });
}



function getOrCreateEquipement(clientIP, clientHostname) {
    return getEquipement(clientIP, clientHostname)
    .then((equip, error) => {
        log.error("EQUIPEMEINT TEST" + equip);
        if (error !== undefined) {
            log.error("Error when getting equipment" + error);
            return undefined;
        }
        if (equip === undefined){
            log.debug("Create equipment with IP: "+ clientIP+" and hostname: "+clientHostname);
            // crée l'équipement
            const equipementId = genEquipmentId(clientIP, clientHostname);            
            return executeApiCmd(
                {
                    "jsonrpc": "2.0",    
                    "method": "eqLogic::save",
                    "params": {
                        "apikey": args.apikey,
                        "plugin": args.pluginId,
                        "eqType_name": args.pluginId,
                        "name": equipementId,
                        "object_id": equipementId,
                        "logicalId": equipementId,
                        "category": {
                            "security": "1"
                        },
                        "isVisible": "0",
                        "isEnable": "1",
                        "cmd": 
                            [
                                {
                                    "name":"LastUploadedFile",                                    
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
                                    "configuration":{"minValue":"","maxValue":""},
                                    "unite":""
                                },                    
                                {                        
                                    "name":"IP",
                                    "object_id": "IP",
                                    "display":{ 
                                        "icon":"",
                                        "invertBinary":"0"
                                    },
                                    "value":clientIP,
                                    "currentValue": clientIP,
                                    "type":"info",
                                    "subType":"string",
                                    "isVisible":"1",
                                    "isHistorized":"0",
                                    "configuration":{"minValue":"","maxValue":""},
                                    "unite":""
                                },
                                {                        
                                    "name":"Hostname",                                    
                                    "display":{ 
                                        "icon":"",
                                        "invertBinary":"0"
                                    },
                                    "value": clientHostname,
                                    "currentValue": clientHostname,
                                    "type":"info",
                                    "subType":"string",
                                    "isVisible":"1",
                                    "isHistorized":"0",
                                    "configuration":{"minValue":"","maxValue":""},
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
            log.debug("The equipment found is: "+equip);
            return equip;
        } 
    });
}


class MyAlerterFileSystem extends FileSystem{    

    constructor(ip){
        super();
        this.clientIP = ip;                    
    }

    get(fileName) {        
        if (fileName === '.'){
            return {
                isDirectory: () => true
            };
        }
        else{
            return {};
        }
    }
    
    currentDirectory(){
        return "/";
    }
  
    list(path) {        
        return [];
    }

    chdir(path){        
        return "/";
    }

    write(fileName){        
        // use the ssh port (22)
        dns.lookupService(this.clientIP, 22, (err, hostname, service) => {
            if (hostname === undefined || hostname === ""){
                hostname = "";
            }
            log.info("Received new file from ip="+this.clientIP+" hostname="+hostname);
            getOrCreateEquipement(this.clientIP, hostname)
            .then((equip, error) => {
                if (error === undefined){
                    return updateAttributeWithValue(equip, "LastUploadedFile", fileName);    
                }
                else {
                    log.error("Error in getOrCreateEquipement"+ error);
                    return undefined;
                } 
            })
            .then((result, error) => {
                if (error === undefined){
                    log.debug("Command updated");
                }
                else{
                    log.error("Error in updateFileUploaded "+ error)
                }
            })
            .catch(e => log.error(e));
        });
        
        return writableNoopStream();
    }

    read(){        
        return readableNoopStream({size: 10});
    }

    delete(path) {        
    }

    mkdir(path){                
    }

    rename(from, to){                
    }

    chmod(path, mode){        
    }

    getUniqueName(){        
        return "tmp";
    }
  
}
 