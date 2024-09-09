/**
 * @NApiVersion 2.x
 * @NScriptType Portlet
 * @NModuleScope Public
 * @author Ashley Wallace
 */

 define([], function(){
    function render(params)
    {
        var portlet = params.portlet;
        portlet.title = 'Bar Chart Example';
        var content = '<iframe scrolling="no" align="left" width="500" height="500" src="/app/site/hosting/scriptlet.nl?script=724&deploy=1" style="margin:0px; border:0px; padding:0px"></iframe>';
        portlet.html = content;
    }

    return {
        render: render
    }
 })