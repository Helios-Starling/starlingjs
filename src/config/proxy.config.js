import { handleMessageError, handleNotification, handleRequest, handleResponse } from "@helios-starling/utils";

/**
 * @type {import("@helios-starling/utils").ProxyHandlers}
 */
export const proxyConfiguration = {
    request: async context => {
        
        handleRequest(context.starling, context);
    },
    response: async context => {
        handleResponse(context.starling, context);
    },
    notification: async context => {
        handleNotification(context.starling, context);
    },
    errorMessage: async context => {
        handleMessageError(context.starling, context);
    }
}