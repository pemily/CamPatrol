<?php
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

/* * ***************************Includes********************************* */
require_once __DIR__  . '/../../../../core/php/core.inc.php';

class camPatrol extends eqLogic {

  /*     * ***********************Methode static*************************** */
	public static function dependancy_info() {
		$return = array();
		$return['log'] = __CLASS__;
		$return['progress_file'] = jeedom::getTmpFolder(__CLASS__) . '/dependance';
		$return['state'] = 'ok';
		if (exec('which node | wc -l') == 0) {
			$return['state'] = 'nok';
		}
		return $return;
	}


  public static function deamon_info() {      
    $return = array();
    $return['log'] = __CLASS__;
    $return['state'] = 'nok';
    $pid_file = jeedom::getTmpFolder(__CLASS__) . '/daemon.pid';
    if (file_exists($pid_file)) {
        if (@posix_getsid(trim(file_get_contents($pid_file)))) {
            $return['state'] = 'ok';
        } else {
            shell_exec(system::getCmdSudo() . 'rm -rf ' . $pid_file . ' 2>&1 > /dev/null');
        }
    }
    $return['launchable'] = 'ok';

    $plugin = plugin::byId(__CLASS__);
    $pluginId = $plugin->getId();

    $user = config::byKey('server_username', $pluginId); 
    $pswd = config::byKey('server_password', $pluginId); 
    $port = config::byKey('server_port', $pluginId); 
    $ip = config::byKey('server_ip', $pluginId);     
    if ($user == '') {
        $return['launchable'] = 'nok';
        $return['launchable_message'] = __("Le nom d'utilisateur n'est pas configuré", __FILE__);
    } elseif ($pswd == '') {
        $return['launchable'] = 'nok';
        $return['launchable_message'] = __("Le mot de passe n'est pas configuré", __FILE__);
    } elseif ($port == '') {
        $return['launchable'] = 'nok';
        $return['launchable_message'] = __("Le port n'est pas configuré", __FILE__);
    }  elseif ($ip == '') {
        $return['launchable'] = 'nok';
        $return['launchable_message'] = __("L'IP n'est pas configurée", __FILE__);
    }    

    return $return;
  }


  public static function deamon_start($_debug = false) {
    $dependancy_info = self::dependancy_info();
    if ($dependancy_info['state' != 'ok']) {
      log::add(__CLASS__, 'error', __("Veuillez vérifier les dépendances", __FILE__));
      return;
    }
    
    if (! jeedom::isCapable('sudo')) {		
      log::add(__CLASS__, 'error',__("Erreur : Veuillez donner les droits sudo à Jeedom", __FILE__));
      return;
    }

    self::deamon_stop();
      
    log::add(__CLASS__, 'info', __('Démarrage du serveur FTP', __FILE__));

    $deamon_info = self::deamon_info();
    if ($deamon_info['launchable'] != 'ok') {
      log::add(__CLASS__, 'error', __("Veuillez vérifier la configuration", __FILE__));
      return;
    }

    $pluginId = __CLASS__;
    $apiKey = config::byKey('api', $pluginId);   
    if ($apiKey == ''){
      log::add(__CLASS__, 'error', __("la clé api n'a pas pu être récupéré", __FILE__));
      return;
    }

    // log node version
    shell_exec(system::getCmdSudo() . 'echo "node version:" >> ' . log::getPathToLog(__CLASS__) . ' 2>&1 &');
    shell_exec(system::getCmdSudo() . 'node -v >> ' . log::getPathToLog(__CLASS__) . ' 2>&1 &');

    $user = config::byKey('server_username', $pluginId); 
    $pswd = config::byKey('server_password', $pluginId); 
    $port = config::byKey('server_port', $pluginId); 
    $ip = config::byKey('server_ip', $pluginId);  

    $cmd = cleanPath('node ' . __DIR__ . '/../../resources/campatrold/server.js');
    $cmd .= ' --port=' . $port;
    $cmd .= ' --user=' . $user;
    $cmd .= ' --pwd=' . $pswd;
    $cmd .= ' --ip=' . $ip;
    $cmd .= ' --pluginId=' . $pluginId;
    $cmd .= ' --apikey=' . $apiKey;  
    $cmd .= ' --pidFile=' . jeedom::getTmpFolder(__CLASS__) . '/daemon.pid';
    $cmd .= ' --logLevel=' . log::convertLogLevel(log::getLogLevel(__CLASS__));    
    $cmd .= ' --alertsDir=' . cleanPath(__DIR__ . '/../../data/alerts');
    log::add(__CLASS__, 'debug', __("Commande lancée: ", __FILE__) . $cmd);

    shell_exec(system::getCmdSudo() . $cmd . ' >> ' . log::getPathToLog(__CLASS__) . ' 2>&1 &');
    log::add(__CLASS__, 'info', __("Démarrage du serveur FTP effectué", __FILE__));

    sleep(5);
  }

  public static function deamon_stop() {
    log::add(__CLASS__, 'info',  __("Stop le FTP Serveur", __FILE__));
    $deamon_info = self::deamon_info();
    $pid_file = jeedom::getTmpFolder(__CLASS__) . '/daemon.pid';  
    if (file_exists($pid_file)) {
      $pid = intval(trim(file_get_contents($pid_file)));
      system::kill($pid);
    }
    sleep(2);
  }
  
  public static function backupExclude() {
    return array('data/alerts');
  }

  public function preRemove() {
    // on va supprimer un equipement        
    $filesDir = jeedom::getTmpFolder(__CLASS__) . '/alerts/' .  $this->getLogicalId();
    log::add(__CLASS__, 'info',  __("Nettoyage du répertoire", __FILE__) . " ". $filesDir);
    if (file_exists($filesDir)) {
      rrmdir($filesDir);
    }    
    log::add(__CLASS__, 'info',  __("Fin du Nettoyage", __FILE__) . " " . $filesDir);    
  }
}

class camPatrolCmd extends cmd {

  // Exécution d'une commande
  public function execute($_options = array()) {
  }

}
