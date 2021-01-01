import { IntentRequest, RequestType } from '@voiceflow/general-types';

import { Context, ContextHandler } from '@/types';

import { AbstractManager, injectServices } from '../utils';

export const utils = {};

export const EMPTY_INTENT = '_empty';

@injectServices({ utils })
class NLU extends AbstractManager<{ utils: typeof utils }> implements ContextHandler {
  // TODO: implement NLU handler
  handle = async (context: Context) => {
    if (context.request?.type !== RequestType.TEXT) {
      return context;
    }

    // empty string input - we can also consider return request: null as well (this won't advance the conversation)
    if (!context.request.payload) {
      const request: IntentRequest = {
        type: RequestType.INTENT,
        payload: {
          query: '',
          intent: { name: EMPTY_INTENT },
          entities: [],
        },
      };
      return {
        ...context,
        request,
      };
    }

    const version = await this.services.dataAPI.getVersion(context.versionID);

    if (!version) {
      throw new Error();
    }

    try {
      const { data } = await this.services.axios.post<IntentRequest>(`${this.config.GENERAL_SERVICE_ENDPOINT}/runtime/${version.projectID}/predict`, {
        query: context.request.payload,
      });

      return { ...context, request: data };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      throw err;
    }
  };
}

export default NLU;