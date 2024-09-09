/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @author Blu Banyan Solutions
 * @NModuleScope Public
 * @version 0.0.1
 */

/**
 * Copyright 2017-2021 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */

define(['N/url'], function(urlModule){

    var _export = {};

    _export.render = function(params){
        var
            _portlet = params.portlet
            , _url = urlModule.resolveScript({
                scriptId: 'customscript_bb_sl_part_calen_event',
                deploymentId: 'customdeploy_bb_sl_part_calen_event'
            })
        ;

        _portlet.title = 'Partner Calendar Events';
        _portlet.html = `<iframe id="sl_view_tasks" src="${_url}" 
                    border="0" frameborder="0" width="100%" 
                    scrolling="yes" height="600px"></iframe>`;

    };

    return _export;

});




