/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope public
 * @author Michael Golichenko
 */

/**
 * Copyright 2017-2018 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

function maintenanceModeUserEvent(runtimeModule, messageModule, redirectModule, serverWidgetModule, dialogModule){

  function buildAdminScreen(scriptContext) {
    var
      _form = scriptContext.form
      , _modalField
    ;
    messageModule.create({
      title: 'Maintenance Mode',
      message: 'System is currently in maintenance mode.',
      type: messageModule.Type.WARNING
    }).show();

    _modalField = _form.addField({
      id: 'custpage_maintenance_modal'
      , label: ' '
      , type: serverWidgetModule.FieldType.INLINEHTML
    });

    _modalField.defaultValue = '' +
      '<script type="text/javascript">\n' +
      'require(["N/ui/message"], function(messageModule){\n' +
      '    messageModule.create({\n' +
      '      title: "Maintenance Mode",\n' +
      '      message: "System is currently in maintenance mode.",\n' +
      '      type: messageModule.Type.WARNING\n' +
      '    }).show();\n' +
      '});\n' +
      '</script>';
  }

  function buildScreen(scriptContext) {
    var
      _form = scriptContext.form
      , _currentScript = runtimeModule.getCurrentScript()
      , _redirectUrl = _currentScript.getParameter({name: 'custscript_bb_ss_maintenance_redirecturl'})
      , _messageHtml = _currentScript.getParameter({name: 'custscript_bb_ss_maintenance_message'})
      , _modalField
    ;

    log.debug('_redirectUrl', _redirectUrl);

    if(typeof _redirectUrl === 'string' && _redirectUrl.trim().length > 0) {
      redirectModule.redirect({url: _redirectUrl});
      return;
    }

    if(!_messageHtml) {
      _messageHtml = 'System is currently in maintenance mode.';
    }

    _modalField = _form.addField({
      id: 'custpage_maintenance_modal'
      , label: ' '
      , type: serverWidgetModule.FieldType.INLINEHTML
    });

    _modalField.defaultValue = '' +
      '<script type="text/javascript">\n' +
      'jQuery("#div__header").css("z-index", 9999);\n' +
      'require(["N/ui/dialog"], function(dialogModule){\n' +
      '    dialogModule.create({\n' +
      '      title: "Maintenance Mode",\n' +
      '      message: "' + _messageHtml + '",\n' +
      '    });\n' +
      '    jQuery(".x-shadow:last").remove();\n' +
      '    jQuery(".x-window:last .uir-message-buttons").remove();\n' +
      '    jQuery(".ext-el-mask:last").height(jQuery(".ext-el-mask:last").height() + 100);\n' +
      '    jQuery(".ext-el-mask:last").css("background-color", "#fff");\n' +
      '    jQuery(".ext-el-mask:last").css("opacity", "1");\n' +
      '});\n' +
      '</script>';
  }

  function beforeLoad(scriptContext){
    var
      _currentUser = runtimeModule.getCurrentUser()
      , _role = _currentUser.roleId
    ;

    if(/administrator/i.test(_role)) {
      buildAdminScreen(scriptContext);
    } else {
      buildScreen(scriptContext);
    }
  }


  return {
    beforeLoad: beforeLoad
  }
}

define(['N/runtime', 'N/ui/message', 'N/redirect', 'N/ui/serverWidget', 'N/ui/dialog'], maintenanceModeUserEvent)