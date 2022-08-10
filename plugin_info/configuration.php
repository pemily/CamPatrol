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

require_once dirname(__FILE__) . '/../../../core/php/core.inc.php';
include_file('core', 'authentification', 'php');
if (!isConnect()) {
  include_file('desktop', '404', 'php');
  die();
}
?>
<form class="form-horizontal">
  <fieldset>
    <div class="form-group">
      <label class="col-md-4 control-label">{{Nom d'utilisateur :}}
        <sup><i class="fas fa-question-circle tooltips" title="{{Le nom de votre choix}}"></i></sup>
      </label>
      <div class="col-md-4">
        <input class="configKey form-control" data-l1key="server_username" placeholder="campat"/>
      </div>
    </div>
    <div class="form-group">
      <label class="col-md-4 control-label">{{Mot de passe :}}
        <sup><i class="fas fa-question-circle tooltips" title="{{Le mot de passe de votre choix}}"></i></sup>
      </label>
      <div class="col-md-4">
        <input class="configKey form-control" data-l1key="server_password" placeholder="campat"/>
      </div>
    </div>
    <div class="form-group">
      <label class="col-md-4 control-label">{{Le port FTP :}}
        <sup><i class="fas fa-question-circle tooltips" title="{{Le port du serveur FTP de votre choix}}"></i></sup>
      </label>
      <div class="col-md-4">
        <input class="configKey form-control" data-l1key="server_port" placeholder="21"/>
      </div>
    </div>
    <div class="form-group">
      <label class="col-md-4 control-label">{{L'IP FTP:}}
        <sup><i class="fas fa-question-circle tooltips" title="{{L'adresse IP du server FTP. Ne mettez à jour qu'en cas de problème reseaux.}}"></i></sup>
      </label>
      <div class="col-md-4">
        <input class="configKey form-control" data-l1key="server_ip" placeholder="0.0.0.0" />
      </div>
    </div>    
  </fieldset>
</form>
