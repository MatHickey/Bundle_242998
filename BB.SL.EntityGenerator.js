/** * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 * @author Brendan Boyd
 * @version 0.1.3
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

String.prototype.toCamelCase = function() {
    return this.replace(/^([A-Z])|[\s-_]+(\w)/g, function(match, p1, p2, offset) {
        if (p2) return p2.toUpperCase();
        return p1.toLowerCase();
    });
};

String.prototype.prefixFilter = function() {
    var pattern = ['custentity', 'customrecord', 'custrecord', 'custitem', 'custbody', 'custcol', '_bb_'];
    return this.replace(new RegExp(pattern.join('|'), 'g'), '');
};
var CUSTOM_TYPES = [{type: 'customrecord_bb_project_adder', name: 'Project Adder'}, {type: 'customrecord_bb_project_bom', name: 'Project BOM'}];
define(['N/record', 'N/runtime', 'N/render', 'N/file', 'N/ui/serverWidget'],

    function(record, runtime, render, file, widget) {
        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            if (context.request.method == 'POST') {
                var selectEntity = context.request.parameters['custpage_selectentity'];
                var fieldExlude = ['address_country_state_map', 'autoname','class', 'customwhence', 'nldept', 'nlloc', 'nlrole', 'nlsub', 'nluser', 'nsapiCT',
                                   'nsapiFC', 'nsapiLC', 'nsapiLI', 'nsapiPD', 'nsapiPI', 'nsapiPS', 'nsapiRC', 'nsapiSR',
                                   'nsapiVD', 'nsapiVF', 'nsapiVI', 'nsapiVL', 'nsbrowserenv', 'selectedtab', 'wfFC', 'wfPI',
                                   'wfPS', 'wfSR', 'wfVF', 'wfinstances', 'whence', '_eml_nkey_', '_multibtnstate_'];
                var code = renderTemplate([selectEntity], null, null, fieldExlude, CUSTOM_TYPES);
                // todo: use search to find folder in desired location. If doesn't exist, create one.
                var codeGenFolder = record.load({
                    type: record.Type.FOLDER,
                    id: 715
                });

                var entityFile = file.create({
                    name: [selectEntity, '.js'].join(''),
                    fileType: file.Type.JAVASCRIPT,
                    contents: code
                });
                entityFile.folder = codeGenFolder.id;
                var fileId = entityFile.save();
                if (fileId) {
                    log.debug('success');
                } else {
                    log.debug('fail');
                }
            }
            var form = widget.createForm({
                title: 'Entity Generator'
            });
            var entityList = form.addField({
                id: 'custpage_selectentity',
                type: widget.FieldType.SELECT,
                label: 'Select Entity'
            });
            addTypesToList(entityList, CUSTOM_TYPES);
            form.addSubmitButton({
                label: 'Generate'
            });
            context.response.writePage(form);

        }

        function addTypesToList(entityList, types) {
            for (var prop in record.Type) {
                entityList.addSelectOption({
                    value: record.Type[prop],
                    text: prop
                });
            }
            types.forEach(function(type){
                entityList.addSelectOption({
                    value: type.type,
                    text: type.name
                });
            });
        }

        function renderTemplate(entity, template, prefixExclude, fieldExclude, customTypes) {
            var result = '';
            var renderer = render.create();
            renderer.templateContent = file.load('Templates/Code Gen/entity-generator.ftl').getContents();
            var types = Object.keys(record.Type).map(function(type){
                return {
                    type: record.Type[type],
                    name: type
                };
            }).concat(customTypes);
            for(var i = 0; i < types.length; i++) {
                var type = types[i].type;
                log.debug(type);
                if (entity.indexOf(type) !== -1) {
                    try {
                        var data = JSON.stringify({
                            type: type,
                            fields: getFields(type, fieldExclude)
                        });
                        renderer.addCustomDataSource({
                            format: render.DataSource.JSON,
                            alias: "metadata",
                            data: data
                        });
                        result = renderer.renderAsString();
                        log.debug('result', result);
                        break;
                    } catch (error) {
                        log.error(error);
                    }
                }
            }
            return result;
        }

        function getFields(prop, fieldExlude) {
            var meta = record.create({
                type: prop
            });
            var fields = meta.getFields().filter(function(field) {
                return fieldExlude.indexOf(field) == -1;
            }).map(function(field) {
                return {
                    id: field,
                    static: field.prefixFilter().toUpperCase(),
                    instance: field.prefixFilter().toCamelCase()
                };
            }).sort(function(a, b){
                if(a.static > b.static) return 1;
                if(a.static < b.static) return -1;
                return 0;
            });
            log.debug('fields', fields);
            return fields;
        }

        return {
            onRequest: onRequest
        };
    });
