/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime', 'N/ui/serverWidget', 'N/render', 'N/file', './BB SS/SS Lib/BB.SS.OAuth1.0Module'],

    function(record, runtime, serverWidget, render, file, oauth) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            if (context.request.method == 'GET') {
                var config = record.load({
                    type: 'customrecord_bb_solar_success_configurtn',
                    id: 1
                });
                var env = config.getText({fieldId: 'custrecord_bb_bay_so_item_avail_enviro'});

                var requestParam = context.request.parameters.baywaavailability;
                var templateId = runtime.getCurrentScript().getParameter({name: 'custscript_baywa_html_template_id'});

                log.debug('request parameters', JSON.parse(requestParam));
                log.debug('templateId', templateId);

                var response = oauth.callEndpoint(env, 'BayWa', 'POST', 'script=529&deploy=1', requestParam);
                log.debug('reponse', response);
                if (requestParam && templateId) {
                    var renderer = render.create();
                    var htmlTemplate = file.load({id: templateId});

                    renderer.templateContent = htmlTemplate.getContents();

                    var obj = JSON.parse(response);

                    renderer.addCustomDataSource({
                        format: render.DataSource.OBJECT,
                        alias: "data",
                        data: obj
                    });
                    renderer.renderToResponse({
                        response: context.response,
                    });
                }
            }
        }
        return {
            onRequest: onRequest
        };

    });
