/**
 * @NApiVersion 2.0
 * @NScriptType suitelet
 * @NModuleScope Public
 * @author Matt Lehman
 */

/**
 * Copyright 2017-2020 Blue Banyan Solutions, Inc.
 * All Rights Reserved.
 *
 * This software and information are proprietary to Blue Banyan Solutions, Inc.
 * Any use of the software and information shall be in accordance with the terms
 * of the license agreement you entered into with Blue Banyan Solutions, Inc,
 * including possible restrictions on redistribution, misuse, and alteration.
 */
 
define(['N/redirect'], function(redirect) {
    function onRequest(context) {
        redirect.toSuitelet({
            scriptId: 'customscript_bb_ss_sl_proj_action',
            deploymentId: 'customdeploy_bb_ss_sl_proj_action',
            parameters: {
                phase: context.request.parameters.phase,
                package: context.request.parameters.package,
                projectId: context.request.parameters.projectId
            }
        });
    }

    return {
        onRequest: onRequest
    };
});
