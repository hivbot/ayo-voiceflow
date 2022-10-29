import { AlexaConstants } from '@voiceflow/alexa-types';
import { GoogleConstants } from '@voiceflow/google-types';
import { VoiceflowConstants } from '@voiceflow/voiceflow-types';
import chai from 'chai';
import sinon from 'sinon';

import { mapChannelData } from '@/lib/services/nlu/utils';

const { expect } = chai;

describe('nlu manager utils unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('mapChannelData', () => {
    [
      VoiceflowConstants.PlatformType.GOOGLE,
      VoiceflowConstants.PlatformType.DIALOGFLOW_ES,
      VoiceflowConstants.PlatformType.DIALOGFLOW_ES_CHAT,
      VoiceflowConstants.PlatformType.DIALOGFLOW_ES_VOICE,
    ].forEach((platform) => {
      it(`maps vf intents for ${platform} platform`, async () => {
        const inputData = { payload: { intent: { name: VoiceflowConstants.IntentName.YES } } };
        const outputData = mapChannelData(inputData, platform);

        const expectData = { payload: { intent: { name: GoogleConstants.GoogleIntent.YES } } };
        expect(outputData).to.eql(expectData);
      });
    });

    // ALEXA
    it('maps vf intents for alexa platform (version with channel intents)', async () => {
      const inputData = { payload: { intent: { name: VoiceflowConstants.IntentName.YES } } };
      const outputData = mapChannelData(inputData, VoiceflowConstants.PlatformType.ALEXA, true);

      const expectData = { payload: { intent: { name: AlexaConstants.AmazonIntent.YES } } };
      expect(outputData).to.eql(expectData);
    });

    it('doesnt vf intents for alexa platform (version without channel intents)', async () => {
      const inputData = { payload: { intent: { name: VoiceflowConstants.IntentName.YES } } };
      const outputData = mapChannelData(inputData, VoiceflowConstants.PlatformType.ALEXA);

      const expectData = { payload: { intent: { name: VoiceflowConstants.IntentName.YES } } };
      expect(outputData).to.eql(expectData);
    });

    it('doesnt map alexa intents for alexa platform', async () => {
      const inputData = { payload: { intent: { name: AlexaConstants.AmazonIntent.YES } } };
      const outputData = mapChannelData(inputData, VoiceflowConstants.PlatformType.ALEXA);

      const expectData = { payload: { intent: { name: AlexaConstants.AmazonIntent.YES } } };
      expect(outputData).to.eql(expectData);
    });
  });
});