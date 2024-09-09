/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @author Michael Golichenko
 * @NModuleScope Public
 * @version 0.0.1
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

define(['N/url', 'N/runtime', 'N/file', 'N/render', 'N/search'], function(urlModule, runtimeModule, fileModule, renderModule, searchModule){

  var _export = {};

  _export.render = function(params){
    var
      _portlet = params.portlet
      , _currentScript = runtimeModule.getCurrentScript()
      , _searchId = _currentScript.getParameter({name: 'custscript_bb_ss_googlemapmarkerv2_srch'})
      , _title = _currentScript.getParameter({name: 'custscript_bb_ss_googlemapmarkersv2_titl'})
      , _url = urlModule.resolveScript({
        scriptId: 'customscript_bb_ss_sl_googlemapmarkersv2',
        deploymentId: 'customdeploy_bb_ss_sl_googlemapmarkersv2',
        params: {
          searchId: _searchId
        }
      })
    ;
    _portlet.title = typeof _title === 'string' && _title.trim().length > 0 ? _title : 'Markers';
    _portlet.html = !_searchId
      ? 'No Search specified in deployment'
      : `<iframe id="${_currentScript.deploymentId}" class="sl-map-control" src="${_url}" border="0" frameborder="0" height="600px" width="100%" scrolling="no"></iframe>`;

  };

  return _export;

});