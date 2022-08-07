

// https://github.com/QuorumDMS/ftp-srv
import { FtpSrv, FileSystem } from "ftp-srv";
import { readableNoopStream, writableNoopStream} from "noop-stream";
import { request } from 'http';
import { writeFile } from 'fs';
import argsParser from 'args-parser';
import dns from "dns";



const args = argsParser(process.argv);
const port=args.ftpPort;

function usage(){
    console.log("node server.js --pid=/tmp/campat.pid --port=8090 --user=patrouilleur --pwd=patrouilleur -alertUrl=http://www.google.com");    
    process.exit(1);
}

if (args.port === undefined){
    console.error("port argument is missing");    
    usage();
}
if (args.user === undefined){
    console.error("user argument is missing");
    usage();
}
if (args.pwd === undefined){
    console.error("pwd argument is missing");
    usage();
}
if (args.alertUrl === undefined){
    console.error("alertUrl argument is missing");
    usage();
}
if (args.pid === undefined){
    console.error("pid argument is missing");
    usage();
}

writeFile(args.pid, process.pid.toString(), function(err) {
    if(err) {
        console.error("Impossible to write pid file");
        process.exit(2)
    }
});


console.log("Port: "+args.port+" user: "+args.user+" "+" alertUrl: "+args.alertUrl);

const ftpServer = new FtpSrv({
    url: "ftp://0.0.0.0:" + args.port,    
    anonymous:false,
    tls: false,
    greeting : [ "Welcome to FTPSrv-Alerter" ]
});

ftpServer.on('login', (data, resolve, reject) => {
    // the client address IP is present at two different places
    let ip = data?.connection?.log?.fields?.ip;
    const ip2 = data?.connection?.commandSocket?._peername?.address;
    if (ip === undefined){
        ip = ip2;
    }
     
    if(data.username === args.user && data.password === args.pwd){
        console.log("FTP Virtual FileSystem");
        return resolve({ fs: new MyAlerterFileSystem(ip)});
    }
    return reject({
         name: "401",
         message: "Invalid username or password",
    });
});

ftpServer.on ( 'client-error', (connection, context, error) =>
{
  console.log ( 'connection: ' +  connection );
  console.log ( 'context: '    +  context );
  console.log ( 'error: '      +  error );
});

ftpServer.listen().then(() => {
    console.log('Ftp server is starting...')
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
            console.log("Alert from ip="+this.clientIP+" hostname="+hostname);

            request(args.alertUrl+"?ip="+this.clientIP+"&hostname="+hostname, { }, (res) => {
                const { statusCode } = res;
                console.log("Alert send http result: "+statusCode);
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
 