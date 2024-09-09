/**
 *@NApiVersion 2.x
 *@NScriptType Portlet
 */
 define(['N/search'], function(search) {

    function render(params) {
        var scriptid = ''
        var scriptdeploymentSearchObj = search.create({
            type: "scriptdeployment",
            filters:
            [
               ["script.name","is","BB.SL.GoogleMaps"]
            ],
            columns:
            [
               search.createColumn({
                  name: "title",
                  sort: search.Sort.ASC,
                  label: "Title"
               }),
               search.createColumn({name: "scriptid", label: "Custom ID"}),
               search.createColumn({name: "script", label: "Script ID"}),
               search.createColumn({name: "recordtype", label: "Record Type"}),
               search.createColumn({name: "status", label: "Status"})
            ]
         });
         var searchResultCount = scriptdeploymentSearchObj.runPaged().count;
         log.debug("scriptdeploymentSearchObj result count",searchResultCount);
         scriptdeploymentSearchObj.run().each(function(result){
             scriptid = result.getValue('script');
             log.debug('script id', scriptid);

            // .run().each has a limit of 4,000 results
            return true;
         });
        var portlet = params.portlet;
        portlet.title = 'Google Maps';
        var content = '<iframe src="/app/site/hosting/scriptlet.nl?script=' + scriptid + '&deploy=1" width="100%" height="600"></iframe>';
        portlet.html = content;
    }

    return {
        render: render
    }
});
