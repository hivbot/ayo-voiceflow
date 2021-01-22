import { PrototypeModel } from '@voiceflow/api-sdk';
import { utils } from '@voiceflow/common';
import { DEFAULT_INTENTS_MAP, IntentRequest, Locale, RequestType } from '@voiceflow/general-types';
import NLC, { IIntentFullfilment, IIntentSlot } from '@voiceflow/natural-language-commander';
import { getRequired } from '@voiceflow/natural-language-commander/dist/lib/standardSlots';
import _ from 'lodash';

import logger from '@/logger';

import { getNoneIntentRequest } from './utils';

const { getUtterancesWithSlotNames } = utils.intent;

export const registerSlots = (nlc: NLC, { slots }: PrototypeModel) => {
  slots.forEach((slot) => {
    try {
      if (slot.type?.value?.toLowerCase() !== 'custom') {
        nlc.addSlotType({ type: slot.name, matcher: /[\S\s]*/ });
      } else {
        const matcher = _.flatten(slot.inputs.map((input) => input.split(',')))
          .map((value) => value.trim())
          .filter(Boolean);

        nlc.addSlotType({ type: slot.name, matcher });
      }
    } catch (err) {
      logger.debug('NLC Unable To Register Slot', slot, err);
    }
  });
};

export const registerIntents = (nlc: NLC, { slots, intents }: PrototypeModel) => {
  intents.forEach((intent) => {
    const samples = getUtterancesWithSlotNames(intent.inputs, slots)
      .map((value) => value.trim())
      .filter(Boolean);

    let intentSlots: IIntentSlot[] = [];

    if (intent.slots) {
      intentSlots = intent.slots.reduce<IIntentSlot[]>((acc, intentSlot) => {
        const slot = slots.find(({ key }) => key === intentSlot.id);

        if (!slot) {
          return acc;
        }

        return [
          ...acc,
          {
            name: slot.name,
            type: slot.name,
            required: !!intentSlot.required,
          },
        ];
      }, []);
    }

    try {
      nlc.registerIntent({
        slots: intentSlots,
        intent: intent.name,
        utterances: samples,
      });
    } catch (err) {
      logger.debug('NLC Unable To Register Custom Intent', intent, err);
    }
  });
};

export const registerBuiltInIntents = (nlc: NLC, locale = Locale.EN_US) => {
  const lang = locale.slice(0, 2);
  const builtInIntents = DEFAULT_INTENTS_MAP[lang] || DEFAULT_INTENTS_MAP.en;

  builtInIntents.forEach((intent) => {
    const { name, samples } = intent;

    try {
      nlc.registerIntent({ intent: name, utterances: samples });
    } catch (err) {
      logger.debug('NLC Unable To Register Built In Intent', err);
    }
  });
};

const createNLC = ({ model, locale }: { model: PrototypeModel; locale: Locale }) => {
  const nlc = new NLC();

  registerSlots(nlc, model);
  registerIntents(nlc, model);
  registerBuiltInIntents(nlc, locale);

  return nlc;
};

const nlcToIntent = (intent: IIntentFullfilment | null, query = ''): IntentRequest =>
  (intent && {
    type: RequestType.INTENT,
    payload: {
      query,
      intent: { name: intent.intent },
      // only add entity if value is defined
      entities: intent.slots.reduce<{ name: string; value: string }[]>((acc, { name, value }) => (value ? [...acc, { name, value }] : acc), []),
    },
  }) ||
  getNoneIntentRequest(query);

export const handleNLCCommand = ({ query, model, locale }: { query: string; model: PrototypeModel; locale: Locale }): IntentRequest => {
  const nlc = createNLC({ model, locale });

  return nlcToIntent(nlc.handleCommand(query), query);
};

export const handleNLCDialog = ({
  query,
  model,
  locale,
  dmRequest,
}: {
  query: string;
  model: PrototypeModel;
  locale: Locale;
  dmRequest: IntentRequest;
}): IntentRequest => {
  const nlc = createNLC({ model, locale });

  const intentName = dmRequest.payload.intent.name;
  const filledEntities = dmRequest.payload.entities;

  // turn the dmRequest into IIntentFullfilment
  const fulfillment: IIntentFullfilment = {
    intent: intentName,
    slots: filledEntities, // luckily payload.entities and ISlotFullfilment are compatible
    required: getRequired(nlc.getIntent(intentName)?.slots || [], filledEntities),
  };

  return nlcToIntent(nlc.handleDialog(fulfillment, query), query);
};