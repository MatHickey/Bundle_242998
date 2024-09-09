/**
 * SA-44630 SuiteScript Versioning Guidelines
 * SA-43522 SuiteScript 2.x JSDoc Validation
 *
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 *
 * @description Portlet instance of SearchMerge script.
 *
 * Created by Kevin Kirkley on 5/18/22
 *
 * @copyright 2022 Blue Banyan Solutions
 */
define(['N/url', 'N/runtime'],
    function(urlModule, runtime) {

        var _export = {};


        _export.render = function(params) {
            let currentScript = runtime.getCurrentScript();
            let deploymentId = currentScript.getParameter({name: 'custscript_bb_ss_srchmrg_depl_id'});
            let portletTitle = currentScript.getParameter({name: 'custscript_bb_ss_srchmrg_title'});
            var
                _portlet = params.portlet

            ;

            _portlet.title = portletTitle;
            _portlet.html = `<iframe id="sl_search_merge" src="/app/site/hosting/scriptlet.nl?script=customscript_bb_sl_searchmerge&hideNav=t&deploy=${deploymentId}" 
                    border="0" frameborder="0" width="100%"
                    scrolling="yes" height="600px"></iframe>`;
        }

        return _export;
    });
