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
      <label class="col-md-4 control-label">{{Username :}}
        <sup><i class="fas fa-question-circle tooltips" title="{{The username of your choice}}"></i></sup>
      </label>
      <div class="col-md-4">
        <input class="configKey form-control" data-l1key="username" placeholder="campat"/>
      </div>
    </div>
    <div class="form-group">
      <label class="col-md-4 control-label">{{Password :}}
        <sup><i class="fas fa-question-circle tooltips" title="{{The password of your choice}}"></i></sup>
      </label>
      <div class="col-md-4">
        <input class="configKey form-control" data-l1key="password" placeholder="campat"/>
      </div>
    </div>
    <div class="form-group">
      <label class="col-md-4 control-label">{{FTP Port :}}
        <sup><i class="fas fa-question-circle tooltips" title="{{The ftp port of your choice}}"></i></sup>
      </label>
      <div class="col-md-4">
        <input class="configKey form-control" data-l1key="port" placeholder="21"/>
      </div>
    </div>
    <div class="form-group">
      <label class="col-md-4 control-label">{{FTP IP :}}
        <sup><i class="fas fa-question-circle tooltips" title="{{The ftp ip. Update it only in case of ftp server start problem.}}"></i></sup>
      </label>
      <div class="col-md-4">
        <input class="configKey form-control" data-l1key="ip" placeholder="0.0.0.0" />
      </div>
    </div>    
  </fieldset>
</form>
