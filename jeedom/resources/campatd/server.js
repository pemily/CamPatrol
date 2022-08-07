import { FtpSrv, FileSystem } from 'ftp-srv'; // https://github.com/QuorumDMS/ftp-srv
import { readableNoopStream, writableNoopStream} from 'noop-stream';
import { request } from 'http';
import argsParser from 'args-parser';
import dns from 'dns';
import { log_setLevel, log_debug, log_info, log_error, write_pid, send_change_immediate } from './jeedom.mjs';

const args = argsParser(process.argv);

function usage(){
    log_info("node server.js --pidFile=/tmp/campat.pid --port=8090 --user=patrouilleur --pwd=patrouilleur --apikey=XXXXXXX --ip=0.0.0.0 --logLevel=debug");    
    process.exit(1);
}

if (args.port === undefined){
    log_error("port argument is missing");    
    usage();
}
if (args.user === undefined){
    log_error("user argument is missing");
    usage();
}
if (args.pwd === undefined){
    log_error("pwd argument is missing");
    usage();
}
if (args.ip === undefined){
    log_error("ip argument is missing");
    usage();
}
if (args.pidFile === undefined){
    log_error("pidFile argument is missing");
    usage();
}
if (args.apikey === undefined){
    log_error("apikey argument is missing");
    usage();
}
if (args.logLevel === undefined){
    log_error("logLevel argument is missing");
    usage();
}
else {
    log_setLevel(args.logLevel);
}

write_pid(args.pidFile);

//https://doc.jeedom.com/fr_FR/core/4.1/jsonrpc_api
send_change_immediate({
    "jsonrpc": "2.0",    
    "method": "eqLogic::save",
    "params": {
        "apikey": args.apikey,
        "eqType_name": "camPatrouille",
        "name": "MonSuperEtDernierEquipement"
    }
});

log_debug("Server config port: "+args.port+" user: "+args.user);

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
        log_info("Connection successful ");
        return resolve({ fs: new MyAlerterFileSystem(ip)});
    }
    return reject({
         name: "401",
         message: "Invalid username or password",
    });
});

ftpServer.on ( 'client-error', (connection, context, error) =>
{
  log_error ( 'connection: ' +  connection );
  log_error ( 'context: '    +  context );
  log_error ( 'error: '      +  error );
});

ftpServer.listen().then(() => {
    log_info('CamPatrouille server is started')
});


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

    write(){        
        // use the ssh port (22)
        dns.lookupService(this.clientIP, 22, (err, hostname, service) => {
            if (hostname === undefined || hostname === ""){
                hostname = "";
            }
            log_info("Alert from ip="+this.clientIP+" hostname="+hostname);

            request(args.alertUrl+"?ip="+this.clientIP+"&hostname="+hostname, { }, (res) => {
                const { statusCode } = res;
                log_error("Alert send http result: "+statusCode);
            }).end();                        
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
 